// client/commands/twittertracker.ts
/**
 * @fileoverview Does a thing
 * @author Ai0796
 */

import * as COMMAND from '../command_data/twittertracker'; // Assuming command_data/twittertracker.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import { addTwitterData, getTweets, removeTwitterData } from '../../scripts/trackTwitterData'; // Assuming these are named exports
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, CommandInteraction, MessageComponentInteraction, Role } from 'discord.js'; // Import necessary types
import generateEmbed from '../methods/generateEmbed';
import DiscordClient from '../client'; // Assuming default export

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) {

        await interaction.deferReply({ ephemeral: COMMAND.INFO.ephemeral });

        const username = interaction.options.getString('username');
        const role = interaction.options.getRole('role') as Role | null; // Cast to Role or null if not found

        if (!username) { // Username is required for all subcommands
            await interaction.editReply({
                embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'Username is required.' }, client: discordClient.client })]
            });
            return;
        }

        if (interaction.channel?.type !== ChannelType.GuildText) { // Check for guild text channel
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
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'remove') {
                if (removeTwitterData(username, interaction.channel.id)) {
                    await interaction.editReply(`Removed ${username} from tracking`);
                } else {
                    await interaction.editReply(`Failed to remove ${username} from tracking or ${username} was not being tracked in this channel`);
                }
            }
            else if (subcommand === 'add') { // Explicitly handle 'add' subcommand
                const tweets = await getTweets(username);
                if (tweets.length === 0) {
                    await interaction.editReply(`No tweets found for ${username} or account is private/non-existent.`);
                    return;
                }
                const recentTweet = `https://twitter.com/${username}/status/${tweets[0]}`;

                const tweetButtons = new ActionRowBuilder<ButtonBuilder>()
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
                const filter = (i: MessageComponentInteraction) => {
                    return (i.customId === 'correct' || i.customId === 'incorrect') && i.user.id === interaction.user.id;
                };

                const collector = tweetMessage.createMessageComponentCollector({
                    filter,
                    time: COMMAND.CONSTANTS.INTERACTION_TIME // Assuming INTERACTION_TIME is defined
                });

                collector.on('collect', async (i) => {
                    if (i.customId === 'correct') {
                        // Pass role.id if role exists, otherwise undefined
                        if (await addTwitterData(username, interaction.channel!.id, role?.id)) { // Non-null assertion for channel
                            await i.update(`${username} added`);
                        } else {
                            await i.update(`${username} already exists for this channel`);
                        }
                    }
                    else if (i.customId === 'incorrect') {
                        await i.update(`${username} not added`);
                    }
                    // Disable all buttons after a choice is made
                    for (const button of tweetButtons.components) {
                        button.setDisabled(true);
                    }
                    // Update the original message to remove buttons
                    await interaction.editReply({ components: [] });
                    collector.stop(); // Stop collector after user interaction
                });

                collector.on('end', async (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        // If no interaction occurred (timeout)
                        await interaction.editReply({
                            content: `${username} tracker confirmation timed out.`,
                            components: [] // Remove buttons
                        });
                    }
                });
            }
        } catch (e: any) {
            console.error('Error in twittertracker command:', e);
            await interaction.editReply('Error, Twitter account not found or not public');
        }
    }
};