// client/commands/id.ts
/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */

import { CommandInteraction } from 'discord.js'; // Import CommandInteraction
import * as COMMAND from '../command_data/id'; // Import all exports from id
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import DiscordClient from '../client'; // Assuming default export

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient
        let ephemeral = interaction.options.getBoolean('show');
        if (ephemeral === null) { // If 'show' option is not provided
            ephemeral = true; // Default to true (only shown to user)
        }
        else {
            ephemeral = !ephemeral; // If 'show' is true, make ephemeral false (shown to everyone), and vice versa
        }
        await interaction.deferReply({
            ephemeral: ephemeral
        });

        try {
            const id = interaction.user.id; // Get Discord user ID
            const name = interaction.user.username;
            const sendName = `${name}'s Sekai ID`;
            const userData: any[] = discordClient.db?.prepare('SELECT * FROM users WHERE discord_id=@discordid').all({
                discordid: id
            }) || []; // Type assertion for DB result, provide empty array fallback

            if (userData.length > 0) {
                const sekaiID = userData[0].sekai_id;
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: sendName.toString(), // Ensure name is string
                            content: {
                                'type': 'Sekai ID',
                                'message': sekaiID
                            },
                            client: discordClient.client
                        })
                    ]
                });
            }
            else {
                await interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
            }
        } catch (err: any) { // Type as any for error
            console.error(err); // Changed to console.error
            await interaction.editReply('An unexpected error occurred while fetching your Sekai ID.');
        }
    }
};