// client/commands/rm.ts
/**
 * @fileoverview Allows a user to change the name of a regex verified channel.
 * The channel name must follow the format `*-#####` or `*-#####-X`, where `*` is any string,
 * @author Ai0796
 */

import * as COMMAND from '../command_data/rm'; // Assuming command_data/rm.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, Message, TextBasedChannel, type MessageComponentInteraction } from 'discord.js'; // Import CommandInteraction, Message, TextBasedChannel
import DiscordClient from '../client'; // Assuming default export

const timeout = 600000; // 10 minutes in milliseconds
// Using a simple in-memory object to store channel timestamps.
// In a production environment, this might need persistence across restarts.
const channels: { [channelId: string]: number[] } = {};

function pad(num: number | string, size: number): string {
    if (typeof num === 'string') {
        num = parseInt(num); // Convert string to number
    }
    if (isNaN(num)) {
        return num.toString(); // Return as string if NaN
    }

    num = Math.abs(num);
    let s = num.toString();
    while (s.length < size) s = '0' + s;
    return s;
}

// Verifies if the channel name matches the expected format `*-#####` or `*-#####-X`
async function verify(channelName: string): Promise<boolean> {
    // Regex for: starts with anything, then '-', then 5 digits/x, then optionally '-X' or nothing.
    const regex = /^.*-[0-9x]{5}(-[0-4f])?$/i; // Added /i for case-insensitivity on 'f'
    return regex.test(channelName);
}

// Checks and updates the rate limit for channel name changes
const checkTimeout = async (channelId: string): Promise<boolean> => {
    const time = Date.now();
    if (!channels[channelId]) {
        channels[channelId] = [time];
        return true;
    }

    // Filter out old timestamps (older than 10 minutes)
    channels[channelId] = channels[channelId].filter(t => time - t < timeout);

    if (channels[channelId].length < 2) { // Allow up to 2 changes within the timeout window
        channels[channelId].push(time);
        return true;
    } else {
        return false;
    }
};

// Changes the channel name and handles rate limits
const changeName = async (channel: TextBasedChannel, channelName: string, discordClient: DiscordClient): Promise<any> => {
    if (channelName === channel.name) {
        return {
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        'type': 'Success',
                        'message': `Channel name is already ${channelName}` // Updated message
                    },
                    client: discordClient.client
                })
            ]
        };
    }

    if (await checkTimeout(channel.id)) {
        try {
            await channel.setName(channelName);
            return {
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: {
                            'type': 'Success',
                            'message': `Channel name changed to ${channelName}`
                        },
                        client: discordClient.client
                    })
                ]
            };
        } catch (e: any) {
            console.error('Error changing channel name:', e);
            return {
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.ERROR,
                        client: discordClient.client
                    })
                ]
            };
        }
    } else {
        // Calculate next available time
        const nextAvailableTime = (channels[channel.id][0] || 0) + timeout;
        return {
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        'type': 'Error',
                        'message': `You can only change the name of a channel twice every 10 minutes.\nNext change <t:${Math.floor(nextAvailableTime / 1000)}:R>\nChannel Name: \`${channelName}\``,
                    },
                    client: discordClient.client
                })
            ]
        };
    }
};

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        if (!interaction.channel || !interaction.channel.isTextBased()) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: { type: 'Error', message: 'This command can only be used in a text channel.' },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        if (!(await verify(interaction.channel.name))) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.WRONG_FORMAT,
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        let code: string | null = null;
        let players: string | null = null;
        let channelName: string;
        const nameSplit = interaction.channel.name.split('-');
        const baseName = nameSplit[0];
        const currentCode = nameSplit[1];
        const currentPlayers = nameSplit[2];

        if (subcommand === 'code' || subcommand === 'both') {
            const codeOption = interaction.options.getInteger('code');
            if (codeOption !== null) {
                code = pad(codeOption, 5);
                if (code.length !== 5) {
                    await interaction.editReply({
                        embeds: [
                            generateEmbed({
                                name: COMMAND.INFO.name,
                                content: COMMAND.CONSTANTS.WRONG_CODE_LENGTH,
                                client: discordClient.client
                            })
                        ]
                    });
                    return;
                }
            } else if (subcommand === 'code') {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'Please provide a code for the "code" subcommand.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }
        }

        if (subcommand === 'players' || subcommand === 'both') {
            const playersOption = interaction.options.getString('players');
            if (playersOption !== null) {
                players = playersOption;
                if (players === '0') players = 'f'; // Convert '0' to 'f' as per original logic
            } else if (subcommand === 'players') {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'Please provide player count for the "players" subcommand.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }
        }

        if (subcommand === 'close') {
            channelName = `${baseName}-xxxxx`; // Standard "closed" format
        } else {
            // Determine final code and players, prioritizing new input over current channel name parts
            const finalCode = code || currentCode;
            const finalPlayers = players || currentPlayers; // This could be 'f' or a number

            if (!finalCode) {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'Could not determine a valid room code from input or channel name.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            if (finalPlayers) {
                channelName = `${baseName}-${finalCode}-${finalPlayers}`;
            } else {
                channelName = `${baseName}-${finalCode}`;
            }
        }

        await interaction.editReply(await changeName(interaction.channel, channelName, discordClient));

    },

    async executeMessage(message: Message, discordClient: DiscordClient) { // Explicitly type message
        if (!message.channel || !message.channel.isTextBased()) {
            await message.reply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: { type: 'Error', message: 'This command can only be used in a text channel.' },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        if (!(await verify(message.channel.name))) {
            await message.reply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.WRONG_FORMAT,
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const messageSplit = message.content.split(/ +/).slice(1);
        let code: string | null = null;
        let players: string | null = null;

        // Try to parse code and players from message arguments
        for (let i = 0; i < messageSplit.length; i++) {
            const part = messageSplit[i];
            if (part.length === 5 && !isNaN(Number(part)) && parseInt(part) >= 0 && parseInt(part) <= 99999) {
                code = part;
            } else if (part.length === 1 && !isNaN(Number(part)) && parseInt(part) >= 0 && parseInt(part) < 5) {
                players = part;
            } else if (part.toLowerCase() === 'f' && players === null) { // Handle 'f' for full
                players = 'f';
            }
        }

        let channelName: string;
        const nameSplit = message.channel.name.split('-');
        const baseName = nameSplit[0];
        const currentCode = nameSplit[1];
        const currentPlayers = nameSplit[2];

        if (code || players) {
            const finalCode = code || currentCode;
            const finalPlayers = players || currentPlayers;

            if (!finalCode) {
                await message.channel.send({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'Could not determine a valid room code from input or channel name.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            if (finalCode.length !== 5) {
                await message.channel.send({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: COMMAND.CONSTANTS.WRONG_CODE_LENGTH,
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }

            if (finalPlayers) {
                channelName = `${baseName}-${pad(finalCode, 5)}-${finalPlayers}`;
            } else {
                channelName = `${baseName}-${pad(finalCode, 5)}`;
            }

        } else if (messageSplit.length > 0 && !isNaN(Number(messageSplit.join('')))) { // If only numbers are provided, it might be an invalid code
            await message.channel.send({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: {
                            'type': 'error',
                            'message': `Invalid arguments: ${message.content}`
                        },
                        client: discordClient.client
                    })
                ]
            });
            return;
        } else { // No specific code/players provided, revert to xxxxx
            channelName = `${baseName}-xxxxx`;
        }

        await message.channel.send(await changeName(message.channel, channelName, discordClient));
    },

    async promptExecuteMessage(message: Message, discordClient: DiscordClient) { // Explicitly type message
        if (!message.channel || !message.channel.isTextBased()) {
            return; // Only process in text-based channels
        }

        if (await verify(message.channel.name)) {
            const messageContentCleaned = message.content.replace(/[^0-9f]/gi, ''); // Include 'f' for full
            let code: string | null = null;
            let players: string | null = null;

            // Extract code and players from cleaned message
            // Assuming first 5 digits are code, next 1 digit is player count
            const codeMatch = messageContentCleaned.match(/[0-9]{5}/);
            if (codeMatch) {
                code = codeMatch[0];
                const remaining = messageContentCleaned.substring(codeMatch.index! + codeMatch[0].length);
                const playerMatch = remaining.match(/^[0-4f]/i); // Check for 0-4 or 'f'
                if (playerMatch) {
                    players = playerMatch[0];
                    if (players.toLowerCase() === '0') players = 'f'; // Convert '0' to 'f'
                }
            } else {
                // If no 5-digit code, check if it's just players (e.g., "+3" or "f")
                const playerOnlyMatch = messageContentCleaned.match(/^[0-4f]/i);
                if(playerOnlyMatch) {
                    players = playerOnlyMatch[0];
                    if (players.toLowerCase() === '0') players = 'f';
                }
            }


            let channelName = '';
            const nameSplit = message.channel.name.split('-');
            const baseName = nameSplit[0];
            const currentCode = nameSplit[1];
            const currentPlayers = nameSplit[2];

            if (code || players) {
                const finalCode = code || currentCode;
                const finalPlayers = players || currentPlayers;

                if (!finalCode || finalCode.length !== 5) {
                    // Cannot form a valid channel name, don't prompt
                    return;
                }

                if (finalPlayers) {
                    channelName = `${baseName}-${pad(finalCode, 5)}-${finalPlayers}`;
                } else {
                    channelName = `${baseName}-${pad(finalCode, 5)}`;
                }
            } else {
                return; // No relevant info to prompt
            }

            let deleted = false;
            const promptEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Room Change Nyaa~')
                .setDescription(`Do you want to change the room code to ${channelName}?`)
                .setFooter({ text: 'This prompt will expire in 30 seconds' });

            const roomButtons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('yes')
                        .setLabel('YES')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(COMMAND.CONSTANTS.YES),
                    new ButtonBuilder()
                        .setCustomId('no')
                        .setLabel('NO')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(COMMAND.CONSTANTS.NO)
                );

            const promptMessage = await message.channel.send({
                embeds: [promptEmbed],
                components: [roomButtons]
            });

            const filter = (i: MessageComponentInteraction) => {
                return i.customId === 'yes' || i.customId === 'no';
            };

            const collector = promptMessage.createMessageComponentCollector({
                filter,
                time: COMMAND.CONSTANTS.INTERACTION_TIME
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'yes') {
                    await message.channel.send(await changeName(message.channel, channelName, discordClient));
                    await promptMessage.delete();
                    deleted = true;
                } else if (i.customId === 'no') {
                    await promptMessage.delete();
                    deleted = true;
                }
            });

            collector.on('end', async () => {
                try {
                    if (!deleted) {
                        await promptMessage.delete();
                    }
                } catch (e) {
                    console.error('Error deleting prompt message after timeout:', e);
                }
            });
        }
    }
};