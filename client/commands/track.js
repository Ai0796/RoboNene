/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */
const fs = require('fs');

const COMMAND = require('../command_data/track');

const { PermissionsBitField } = require('discord.js');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');

const fp = './JSONs/track.json';
const userFp = './JSONs/userTrack.json';

const userTrackFile = getUserTrackFile();

function checkIsAdmin(msg) {
    try {
        return msg.member.permissionsIn(msg.channel).has('Administrator');
    }
    catch {
        return false;
    }
}

function addTrack(tier, score, mention, channel) {
    tier = tier.toString();
    var trackFile;
    try {
        if (!fs.existsSync(fp)) {
            trackFile = new Object();
        }
        else {
            trackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (tier in trackFile && score in trackFile[tier]) {
            trackFile[tier][score].push([channel, mention]);
        }
        else {
            if(!(tier in trackFile))
            {
                trackFile[tier] = new Object();
            }
            trackFile[tier][score] = [[channel, mention]];
        }

        fs.writeFile(fp, JSON.stringify(trackFile), err => {
            if (err) {
                console.log('Error writing Tracking', err);
            } else {
                console.log('Wrote Tracking Successfully');
            }
        });
    } catch (e) {
        console.log('Error occured while writing Tracking: ', e);
    }
}

function getUserTrackFile() {
    try {
        if (!fs.existsSync(userFp)) {
            return [];
        }
        else {
            let data = JSON.parse(fs.readFileSync(userFp, 'utf8'));
            if (Array.isArray(data)) {
                return data;
            } else {
                return [];
            }
        }
    } catch (e) {
        console.log('Error occured while reading user tracking: ', e);
    }
}

function saveUserTrackFile(object) {
    fs.writeFile(userFp, JSON.stringify(object), err => {
        if (err) {
            console.log('Error writing user tracking', err);
        } else {
            console.log('Wrote user tracking Successfully');
        }
    });
}

async function sendUserTrack(discordClient, interaction) {
    try {
        let serverid = interaction.guild.id;
        
        let isAdmin = checkIsAdmin(interaction.member);
        let userId = interaction.member.user.id;
        let message = '';
        let count = 0;
        userTrackFile.forEach((trackObject) => {
            if (trackObject.serverid == serverid && (isAdmin || trackObject.userId == userId)) {
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
    } catch (e) {
        console.log('Error occured while sending user tracking: ', e);
    }
}

function formatTrackMessage(trackObject) {
    let settingsText = '';

    settingsText += `Added tracking for ${trackObject.name} ${trackObject.currentTier}\n`;

    if (trackObject.cutoff) {
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

async function addUserTrack(discordClient, interaction) {
    discordClient.addPrioritySekaiRequest('ranking', {}, async (response) => {
        try {
            let tier = interaction.options.getInteger('tier');

            if(tier > 100) {
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
            
            let userId = interaction.member.user.id;
            let serverid = interaction.guild.id;
            let name = response['rankings'][tier-1]['name'];
            let cutoff = interaction.options.getInteger('cutoff') || response['rankings'][tier - 1]['score'] + 1;
            let min = interaction.options.getInteger('min') || 100;
            let max = interaction.options.getInteger('max') || Number.MAX_SAFE_INTEGER;
            let trackId = response['rankings'][tier - 1]['userId'];
            
            let trackObject = {
                userId: userId,
                currentTier: tier,
                cutoff: cutoff,
                min: min,
                max: max,
                trackId: trackId,
                channel: interaction.channelId,
                lastScore: response['rankings'][tier - 1]['score'],
                inLeaderboard: true,
                name: name,
                serverid: serverid
            };

            userTrackFile.push(trackObject);
            let settingsText = formatTrackMessage(trackObject);

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
        } catch (e) {
            console.log('Error occured while adding user tracking: ', e);
        }
    });
}

async function removeUserTrack(discordClient, interaction) {
    try {
        let serverid = interaction.guild.id;
        let num = interaction.options.getInteger('num');
        let userId = interaction.member.user.id;
        let isAdmin = checkIsAdmin(interaction.member);
        let tracks = [];
        let index = 0;
        userTrackFile.forEach(trackObject => {
            if (trackObject.serverid == serverid && (isAdmin || trackObject.userId == userId)) {
                tracks.push(index);
            }
            index++;
        });

        if (num < 1 || num > tracks.length) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: {
                            type: 'Error',
                            message: `Invalid tracker number. Please use a number between 1 and ${tracks.length}`
                        },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        let track = tracks[num-1];
        let message = `Removed tracking for:\n${formatTrackMessage(userTrackFile[track])}`;
        userTrackFile.splice(track - 1, 1);
        saveUserTrackFile(userTrackFile);

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

    } catch (e) {
        console.log('Error occured while removing user tracking: ', e);
    }
}

/**
 * Obtains the current event within the ranking period
 * @return {Object} the ranking event information
 */
const getRankingEvent = () => {
    const events = JSON.parse(fs.readFileSync('sekai_master/events.json'));
    const currentTime = Date.now();

    for (let i = events.length - 1; i >= 0; i--) {
        //Time of Distribution + buffer time of 15 minutes to get final cutoff
        if (events[i].startAt < currentTime && events[i].aggregateAt > currentTime) {
            return {
                id: events[i].id,
                banner: 'https://sekai-res.dnaroma.eu/file/sekai-en-assets/event/' +
                    `${events[i].assetbundleName}/logo_rip/logo.webp`,
                name: events[i].name,
                startAt: events[i].startAt,
                aggregateAt: events[i].aggregateAt,
                closedAt: events[i].closedAt,
                eventType: events[i].eventType
            };
        }
    }

    return {
        id: -1,
        banner: '',
        name: ''
    };
};

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        if (interaction.options.getSubcommand() === 'list') {
            await sendUserTrack(discordClient, interaction);
            return;
        } else if (interaction.options.getSubcommand() === 'user') {
            await addUserTrack(discordClient, interaction);
            return;
        } else if (interaction.options.getSubcommand() === 'remove') {
            await removeUserTrack(discordClient, interaction);
            return;
        }

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

        const tier = interaction.options.getInteger('tier');
        const cutoff = interaction.options.getInteger('cutoff');

        if(tier > 100) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.TIER_ERR,
                        client: discordClient.client
                    })
                ]
            });
        }

        else {
            try {
                discordClient.addPrioritySekaiRequest('ranking', {
                    eventId: event.id,
                    targetRank: tier,
                    lowerLimit: 0
                }, async (response) => {
                    try {
                        let score = response['rankings'][tier-1]['score'];
                        if(cutoff != undefined){
                            score = cutoff;
                        } else {
                            score += 1;
                        }
                        let id = interaction.member.user.id;
                        let mention = '<@' + id + '>';
                        let channel = interaction.channelId;
                        addTrack(tier, score, mention, channel);

                        let message = {
                            'type': 'Success',
                            'message': `Starting to track tier ${tier} for ${mention}\nCutoff: ${score.toLocaleString() }`
                        };

                        let warning = {
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

                        if (!interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
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
                    } catch (e) {
                        console.log('Error occured while adding tracking data: ', e);
                    }
                }, (err) => {
                    discordClient.logger.log({
                        level: 'error',
                        message: err.toString()
                    });
                });
            } catch (e) {
                console.log('Error occured while adding tracking data: ', e);
            }          
        }
    }
};