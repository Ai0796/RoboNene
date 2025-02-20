/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */


const COMMAND = require('../command_data/twittertracker');

const generateSlashCommand = require('../methods/generateSlashCommand');
const { addTwitterData, getTweets, removeTwitterData } = require('../../scripts/trackTwitterData.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const generateEmbed = require('../methods/generateEmbed');

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        
        await interaction.deferReply({ ephemeral: COMMAND.INFO.ephemeral });

        const username = interaction.options.getString('username');
        const role = interaction.options.getRole('role')?.id;

        if (interaction.channel.type !== ChannelType.GuildText) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.INVALID_CHANNEL_ERR,
                        client: discordClient.client
                    })
                ]
            });

            return;
        }

        try {
            if (interaction.options.getSubcommand() === 'remove') {
                if (removeTwitterData(username, interaction.channelId)) {
                    await interaction.editReply(`Removed ${username} from tracking`);
                } else {
                    await interaction.editReply(`Failed to remove ${username} from tracking or ${username} was not being tracked in this channel`);
                }
            }

            else if (username) {

                let tweets = await getTweets(username);
                if (tweets.length === 0) {
                    await interaction.editReply(`No tweets found for ${username}`);
                    return;
                };
                let recentTweet = `https://twitter.com/${username}/status/${tweets[0]}`;

                const tweetButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('correct')
                            .setLabel('CORRECT')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(COMMAND.CONSTANTS.CORRECT),
                        new ButtonBuilder()
                            .setCustomId('incorrect')
                            .setLabel('INCORRECT')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji(COMMAND.CONSTANTS.INCORRECT)
                    );

                const tweetMessage = await interaction.editReply({
                    content: recentTweet,
                    components: [tweetButtons],
                    fetchReply: true
                });

                // Create a filter for valid responses
                const filter = (i) => {
                    return i.customId == 'correct' || i.customId == 'incorrect';
                };

                const collector = tweetMessage.createMessageComponentCollector({
                    filter,
                    time: COMMAND.CONSTANTS.INTERACTION_TIME
                });

                collector.on('collect', async (i) => {
                    if (i.customId === 'correct') {
                        if (await addTwitterData(username, interaction.channelId, role)) {
                            await i.update(`${username} added`);
                        } else {
                            await i.update(`${username} already exists for this channel`);
                        }
                    }

                    else if (i.customId === 'incorrect') {
                        await i.update(`${username} not added`);
                    }
                    for (const button of tweetButtons.components) {
                        button.setDisabled(true);
                    }
                    await interaction.editReply(
                        {components: []}
                    );
                });
            }
        } catch (e) {
            console.log(e);
            interaction.editReply('Error, Twitter account not found or not public');
        } // Due to possible null values add a try catch
    }
};

