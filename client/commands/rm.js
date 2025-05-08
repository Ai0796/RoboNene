/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

const COMMAND = require('../command_data/rm');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { channel } = require('diagnostics_channel');

const timeout = 600000;
const channels = {};

function pad(num, size) {
    num = Math.abs(num);
    num = num.toString();
    while (num.length < size) num = '0' + num;
    return num;
}

async function verify(channelName) {
    let regex = /^.*-[0-9x]{5}.*/g;
    let match = channelName.match(regex);
    if (match != null) {
        return match[0] === channelName;
    } else {
        return false;
    }
}

const checkTimeout = async (channelid) => {
    let time = Date.now();
    if (channels[channelid]) {
        if (time - channels[channelid][0] > timeout && channels[channelid].length >= 2) {
            channels[channelid].shift();
            channels[channelid].push(time);
            return true;
        } else if (channels[channelid].length < 2) {
            channels[channelid].push(time);
            return true;
        }
        else {
            return false;
        }
    } else {
        channels[channelid] = [time];
        return true;
    }
};

const changeName = async (channel, channelName, discordClient) => {
    if (channelName == channel.name) return {
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
    if (await checkTimeout(channel.id)) {
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
    } else {
        return {
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        'type': 'error',
                        'message': `You can only change the name of a channel twice every 10 minutes.\nNext change <t:${Math.floor((channels[channel.id][0] + timeout) / 1000)}:R>\nChannel Name: \`${channelName}\``,
                    },
                    client: discordClient.client
                })
            ]
        };
    }
};

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        let code = interaction.options.getInteger('code');
        let players = interaction.options.getString('players');

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

        try {
            var channelName;
            if (code || players) {
                let nameSplit = interaction.channel.name.split('-');

                let name = nameSplit[0];
                code = code || nameSplit[1];
                code = pad(code, 5);
                players = players || nameSplit[2];
                
                if (`${code}`.length != 5) {
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

                if (players) {
                    channelName = `${name}-${code}-${players}`;
                } else {
                    channelName = `${name}-${code}`;
                }

            } else {
                let nameSplit = interaction.channel.name.split('-');

                let name = nameSplit[0];
                channelName = `${name}-xxxxx`;
            }

            await interaction.editReply(await changeName(interaction.channel, channelName, discordClient));
            
        } catch (e) {
            console.log(e);
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.ERROR,
                        client: discordClient.client
                    })
                ]
            });
        } // Due to possible null values add a try catch
    },

    async executeMessage(message, discordClient) {

        let messageSplit = message.content.split(/ +/).slice(1);

        let code = null;
        let players = null;

        for (let i = 0; i < messageSplit.length; i++) {
            if (messageSplit[i].length == 5 && 
                code == null && 
                !isNaN(messageSplit[i]) &&
                parseInt(messageSplit[i]) >= 0 &&
                parseInt(messageSplit[i]) <= 99999) 
            {
                code = messageSplit[i];
            } else if (messageSplit[i].length == 1 && 
                players == null &&
                !isNaN(messageSplit[i]) &&
                parseInt(messageSplit[i]) >= 0 &&
                parseInt(messageSplit[i]) < 5)
            {
                players = messageSplit[i];
            }
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

        try {
            var channelName;
            if (code || players) {
                let nameSplit = message.channel.name.split('-');

                let name = nameSplit[0];
                code = code || nameSplit[1];
                code = pad(code, 5);
                if (players == 0) {
                    players = 'f';
                }
                players = players || nameSplit[2];

                if (`${code}`.length != 5) {
                    await message.reply({
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

                if (players) {
                    channelName = `${name}-${code}-${players}`;
                } else {
                    channelName = `${name}-${code}`;
                }

            } else if (messageSplit.length > 0) {
                if (!isNaN(messageSplit.join(''))){
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
                } else {
                    let nameSplit = message.channel.name.split('-');

                    let name = nameSplit[0];
                    channelName = `${name}-xxxxx`;
                }
            } else {
                let nameSplit = message.channel.name.split('-');

                let name = nameSplit[0];
                channelName = `${name}-xxxxx`;
            }

            await message.channel.send(await changeName(message.channel, channelName, discordClient));
        } catch (e) {
            console.log(e);
            await message.channel.send({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.ERROR,
                        client: discordClient.client
                    })
                ]
            });
        }
    },

    async promptExecuteMessage(message, discordClient) {
        if (await verify(message.channel.name)) {
            let messageSplit = message.content.replace(/[^0-9]/g, '').split(/ +/);
            let code = null;
            let players = null;

            for (let i = 0; i < messageSplit.length; i++) {
                if (messageSplit[i].length == 5 &&
                    code == null &&
                    !isNaN(messageSplit[i]) &&
                    parseInt(messageSplit[i]) >= 0 &&
                    parseInt(messageSplit[i]) <= 99999) {
                    code = messageSplit[i];
                } else if (messageSplit[i].length == 1 &&
                    players == null &&
                    !isNaN(messageSplit[i]) &&
                    parseInt(messageSplit[i]) >= 0 &&
                    parseInt(messageSplit[i]) < 5) {
                    players = messageSplit[i];
                }
            }
            let deleted = false;
            let channelName = '';

            if (code || players) {
                let nameSplit = message.channel.name.split('-');

                let name = nameSplit[0];
                code = code || nameSplit[1];
                code = pad(code, 5);
                players = players || nameSplit[2];

                if (parseInt(players) === 0) {
                    players = 'f';
                }

                if (players) {
                    channelName = `${name}-${code}-${players}`;
                } else {
                    channelName = `${name}-${code}`;
                }
            } else {
                return;
            }

            let prompt = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Room Change Nyaa~')
                .setDescription(`Do you want to change the room code to ${channelName}?`)
                .setFooter({text: 'This prompt will expire in 30 seconds'});
            
            const roomButtons = new ActionRowBuilder()
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

            message = await message.channel.send({
                embeds: [prompt],
                components: [roomButtons],
                fetchReply: true
            });

            // Create a filter for valid responses
            const filter = (i) => {
                return i.customId == 'yes' ||
                    i.customId == 'no';
            };

            const collector = message.createMessageComponentCollector({
                filter,
                time: COMMAND.CONSTANTS.INTERACTION_TIME
            });

            // Collect user interactions with the prev / next buttons
            collector.on('collect', async (i) => {

                if (i.customId === 'yes') {
                    await message.channel.send(await changeName(message.channel, channelName, discordClient));
                    await message.delete();
                    deleted = true;

                } else if (i.customId === 'no') {
                    await message.delete();
                    deleted = true;
                }
            });

            collector.on('end', async () => {
                try {
                    if (!deleted) {
                        await message.delete();
                    }
                } catch (e) {
                    console.log(e);
                }
            });
        }
    }
};

