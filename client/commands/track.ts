// client/commands/track.ts
/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */
import * as fs from 'fs';

import * as COMMAND from '../command_data/track'; // Assuming command_data/track.ts is converted
import { PermissionsBitField, CommandInteraction, GuildMember } from 'discord.js'; // Import necessary types
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client'; // Assuming default export

const fp = './JSONs/track.json'; // File for tier tracking
const userFp = './JSONs/userTrack.json'; // File for user-specific tracking

interface TierTrackEntry {
    [score: string]: [string, string][]; // Maps score to an array of [channelId, mention]
}

interface TrackFile {
    [tier: string]: TierTrackEntry; // Maps tier (as string) to TierTrackEntry
}

interface UserTrackObject {
    userId: string;
    currentTier: number;
    cutoff: number | null;
    min: number;
    max: number;
    trackId: string;
    channel: string;
    lastScore: number;
    inLeaderboard: boolean;
    name: string;
    serverid: string;
}

// Ensure userTrackFile is loaded on module initialization
let userTrackFile: UserTrackObject[] = getUserTrackFile();

function checkIsAdmin(member: GuildMember): boolean {
    try {
        // member.permissionsIn(member.channel) is deprecated, use member.permissions instead
        return member.permissions.has('Administrator');
    }
    catch (e) {
        console.error('Error checking admin permissions:', e);
        return false;
    }
}

function addTrack(tier: number, score: number, mention: string, channel: string): void {
    const tierStr = tier.toString();
    let trackFile: TrackFile;
    try {
        if (!fs.existsSync(fp)) {
            trackFile = {};
        }
        else {
            trackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (trackFile[tierStr] && trackFile[tierStr][score.toString()]) {
            trackFile[tierStr][score.toString()].push([channel, mention]);
        }
        else {
            if (!(tierStr in trackFile)) {
                trackFile[tierStr] = {};
            }
            trackFile[tierStr][score.toString()] = [[channel, mention]];
        }

        fs.writeFile(fp, JSON.stringify(trackFile), err => {
            if (err) {
                console.error('Error writing Tracking:', err);
            } else {
                console.log('Wrote Tracking Successfully');
            }
        });
    } catch (e: any) {
        console.error('Error occurred while writing Tracking:', e);
    }
}

function getUserTrackFile(): UserTrackObject[] {
    try {
        if (!fs.existsSync(userFp)) {
            return [];
        }
        else {
            const data: any = JSON.parse(fs.readFileSync(userFp, 'utf8'));
            if (Array.isArray(data)) {
                return data as UserTrackObject[]; // Type assertion
            } else {
                return [];
            }
        }
    } catch (e: any) {
        console.error('Error occurred while reading user tracking:', e);
        return [];
    }
}

function saveUserTrackFile(object: UserTrackObject[]): void {
    fs.writeFile(userFp, JSON.stringify(object), err => {
        if (err) {
            console.error('Error writing user tracking', err);
        } else {
            console.log('Wrote user tracking Successfully');
        }
    });
}

function formatTrackMessage(trackObject: UserTrackObject): string {
    let settingsText = '';

    settingsText += `Added tracking for ${trackObject.name} T${trackObject.currentTier}\n`;

    if (trackObject.cutoff !== null && trackObject.cutoff !== undefined) {
        settingsText += `Cutoff: ${trackObject.cutoff.toLocaleString()}\n`;
    }

    if (trackObject.min > 100) {
        settingsText += `Min: ${trackObject.min.toLocaleString()}\n`;
    }

    if (trackObject.max < Number.MAX_SAFE_INTEGER) {
        settingsText += `Max: ${trackObject.max.toLocaleString()}\n`;
    }

    return settingsText;
}


async function sendUserTrack(discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {
    try {
        const serverid = interaction.guild?.id; // Optional chaining for guild
        if (!serverid) {
            await interaction.editReply({
                embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'This command can only be used in a guild.' }, client: discordClient.client })]
            });
            return;
        }

        // Re-read userTrackFile to get the latest state before sending
        userTrackFile = getUserTrackFile();

        const isAdmin = checkIsAdmin(interaction.member as GuildMember); // Type assertion
        const userId = interaction.member?.user.id; // Optional chaining

        let message = '';
        let count = 0;
        userTrackFile.forEach((trackObject) => {
            if (trackObject.serverid === serverid && (isAdmin || trackObject.userId === userId)) {
                message += `\`Tracked User ${++count}\`\n${formatTrackMessage(trackObject)}\n`;
            }
        });
        if (message === '') {
            message = 'No trackings found';
        }
        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        type: 'Success',
                        message: message
                    },
                    client: discordClient.client
                })
            ]
        });
    } catch (e: any) {
        console.error('Error occurred while sending user tracking:', e);
        await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An unexpected error occurred.' }, client: discordClient.client })] });
    }
}

async function addUserTrack(discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {
    discordClient.addPrioritySekaiRequest('ranking', { eventId: discordClient.getCurrentEvent().id }, async (response: any) => { // Type response as any
        try {
            const tier = interaction.options.getInteger('tier');

            if (tier === null || tier > 100 || tier < 1) { // Validate tier input
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: COMMAND.CONSTANTS.TIER_ERR,
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            if (!response || !response.rankings || !response.rankings[tier - 1]) {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'Could not find ranking data for the specified tier.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            const userId = interaction.member?.user.id; // Optional chaining
            const serverid = interaction.guild?.id; // Optional chaining

            if (!userId || !serverid || !interaction.channelId) {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'Could not determine user, server, or channel ID.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            const name = response.rankings[tier - 1].name;
            const currentTierScore = response.rankings[tier - 1].score;
            const cutoff = interaction.options.getInteger('cutoff') ?? (currentTierScore + 1); // Use nullish coalescing
            const min = interaction.options.getInteger('min') ?? 100;
            const max = interaction.options.getInteger('max') ?? Number.MAX_SAFE_INTEGER;
            const trackId = response.rankings[tier - 1].userId;

            // Check if user already has 5 trackers on this server
            const userTrackersOnServer = userTrackFile.filter(t => t.userId === userId && t.serverid === serverid).length;
            if (userTrackersOnServer >= 5) {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'You can only have a maximum of 5 trackers per server.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            const trackObject: UserTrackObject = {
                userId: userId,
                currentTier: tier,
                cutoff: cutoff,
                min: min,
                max: max,
                trackId: trackId,
                channel: interaction.channelId,
                lastScore: currentTierScore,
                inLeaderboard: true,
                name: name,
                serverid: serverid
            };

            userTrackFile.push(trackObject);
            const settingsText = formatTrackMessage(trackObject);

            saveUserTrackFile(userTrackFile);
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: {
                            type: 'Success',
                            message: settingsText
                        },
                        client: discordClient.client
                    })
                ]
            });
        } catch (e: any) {
            console.error('Error occurred while adding user tracking:', e);
            await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An unexpected error occurred.' }, client: discordClient.client })] });
        }
    }, (err: any) => { // Type as any for error
        discordClient.logger?.log({
            level: 'error',
            message: err.toString()
        });
        interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: err.toString() }, client: discordClient.client })] });
    });
}

async function removeUserTrack(discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {
    try {
        const serverid = interaction.guild?.id; // Optional chaining
        if (!serverid) {
            await interaction.editReply({
                embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'This command can only be used in a guild.' }, client: discordClient.client })]
            });
            return;
        }

        const num = interaction.options.getInteger('num');
        const userId = interaction.member?.user.id; // Optional chaining
        const isAdmin = checkIsAdmin(interaction.member as GuildMember); // Type assertion

        // Re-read userTrackFile to get the latest state before modifying
        userTrackFile = getUserTrackFile();

        const tracksIndices: number[] = [];
        userTrackFile.forEach((trackObject, index) => {
            if (trackObject.serverid === serverid && (isAdmin || trackObject.userId === userId)) {
                tracksIndices.push(index);
            }
        });

        if (num === null || num < 1 || num > tracksIndices.length) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: {
                            type: 'Error',
                            message: `Invalid tracker number. Please use a number between 1 and ${tracksIndices.length}`
                        },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const trackToRemoveIndex = tracksIndices[num - 1]; // Get the actual index in userTrackFile
        const removedTrack = userTrackFile.splice(trackToRemoveIndex, 1)[0]; // Remove and get the removed object

        const message = `Removed tracking for:\n${formatTrackMessage(removedTrack)}`;
        saveUserTrackFile(userTrackFile); // Save updated file

        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        type: 'Success',
                        message: message
                    },
                    client: discordClient.client
                })
            ]
        });

    } catch (e: any) {
        console.error('Error occurred while removing user tracking:', e);
        await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An unexpected error occurred.' }, client: discordClient.client })] });
    }
}

/**
 * Obtains the current event within the ranking period
 * @return {object} the ranking event information
 */
const getRankingEvent = (): { id: number; banner: string; name: string; startAt: number; aggregateAt: number; closedAt: number; eventType: string; assetbundleName: string } => {
    // This is a duplicate function from client/client.ts. Ideally, it should be imported.
    // For consistency with the provided file, I'll keep it here, but note the redundancy.
    let events: any[] = [];
    try {
        events = JSON.parse(fs.readFileSync('sekai_master/events.json', 'utf8'));
    } catch (err) {
        console.error('Error reading events.json for getRankingEvent:', err);
        return {
            id: -1,
            banner: '',
            name: '',
            startAt: 0,
            aggregateAt: 0,
            closedAt: 0,
            eventType: '',
            assetbundleName: '',
        };
    }

    const currentTime = Date.now();

    for (let i = events.length - 1; i >= 0; i--) {
        //Time of Distribution + buffer time of 15 minutes to get final cutoff
        if (events[i].startAt < currentTime && events[i].aggregateAt > currentTime) {
            return {
                id: events[i].id,
                banner: 'https://storage.sekai.best/sekai-en-assets/event/' +
                    `${events[i].assetbundleName}/logo/logo.webp`,
                name: events[i].name,
                startAt: events[i].startAt,
                aggregateAt: events[i].aggregateAt,
                closedAt: events[i].closedAt,
                eventType: events[i].eventType,
                assetbundleName: events[i].assetbundleName,
            };
        }
    }

    return {
        id: -1,
        banner: '',
        name: '',
        startAt: 0,
        aggregateAt: 0,
        closedAt: 0,
        eventType: '',
        assetbundleName: '',
    };
};

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'list') {
            await sendUserTrack(discordClient, interaction);
            return;
        } else if (subcommand === 'user') {
            await addUserTrack(discordClient, interaction);
            return;
        } else if (subcommand === 'remove') {
            await removeUserTrack(discordClient, interaction);
            return;
        }

        // Handle the 'tier' subcommand from the old code if still desired, though it's now nested under 'tier' in command_data
        // This part needs to be carefully aligned with `command_data/track.ts` subcommands structure.
        // Assuming the main `track` command can still take `tier` and `cutoff` directly if not a subcommand.
        const tier = interaction.options.getInteger('tier');
        const cutoff = interaction.options.getInteger('cutoff');

        const event = getRankingEvent();
        if (event.id === -1) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.NO_EVENT_ERR,
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        if (tier === null || tier < 1 || tier > 100) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.TIER_ERR,
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        try {
            discordClient.addPrioritySekaiRequest('ranking', {
                eventId: event.id,
                targetRank: tier,
                lowerLimit: 0
            }, async (response: any) => { // Type response as any
                try {
                    if (!response || !response.rankings || !response.rankings[tier - 1]) {
                        await interaction.editReply({
                            embeds: [generateEmbed({ name: COMMAND.INFO.name, content: COMMAND.CONSTANTS.NO_DATA_ERR, client: discordClient.client })]
                        });
                        return;
                    }

                    let score = response.rankings[tier - 1].score;
                    if (cutoff !== null && cutoff !== undefined) {
                        score = cutoff;
                    } else {
                        score += 1; // Track 1 point above current score by default
                    }
                    const id = interaction.member?.user.id; // Optional chaining for member and user
                    const mention = id ? `<@${id}>` : 'Unknown User'; // Handle case where ID might be null
                    const channel = interaction.channelId;

                    if (id && channel) { // Only proceed if IDs are available
                        addTrack(tier, score, mention, channel);

                        const message = {
                            'type': 'Success',
                            'message': `Starting to track tier ${tier} for ${mention}\nCutoff: ${score.toLocaleString()}`
                        };

                        const warning = {
                            'type': 'Warning',
                            'message': 'The bot does not have access to message in this channel'
                        };

                        await interaction.editReply({
                            embeds: [
                                generateEmbed({
                                    name: COMMAND.INFO.name,
                                    content: message,
                                    client: discordClient.client
                                })
                            ]
                        });

                        if (interaction.channel && !interaction.channel.permissionsFor(interaction.guild?.members.me || null)?.has(PermissionsBitField.Flags.SendMessages)) { // Check permissions
                            await interaction.followUp({
                                embeds: [
                                    generateEmbed({
                                        name: COMMAND.INFO.name,
                                        content: warning,
                                        client: discordClient.client
                                    })
                                ],
                                ephemeral: true
                            });
                        }
                    } else {
                        await interaction.editReply({
                            embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'Could not resolve user or channel for tracking.' }, client: discordClient.client })]
                        });
                    }
                } catch (e: any) {
                    console.error('Error occurred while adding tracking data:', e);
                    await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An unexpected error occurred.' }, client: discordClient.client })] });
                }
            }, (err: any) => { // Type as any for error
                discordClient.logger?.log({
                    level: 'error',
                    message: err.toString()
                });
                interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: err.toString() }, client: discordClient.client })] });
            });
        } catch (e: any) {
            console.error('Error occurred while adding tracking data (outer catch):', e);
            await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An unexpected error occurred.' }, client: discordClient.client })] });
        }
    }
};