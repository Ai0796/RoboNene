// client/commands/cat.ts
/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

import { CommandInteraction } from 'discord.js'; // Import CommandInteraction
import * as COMMAND from '../command_data/cat'; // Import all exports from cat
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import Axios from 'axios'; // Import Axios directly
import { CAT_API_KEY } from '../../config'; // Assuming CAT_API_KEY is exported from config
import DiscordClient from '../client'; // Assuming default export


export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient
        try {
            const queryParams = {
                'has_breeds': true,
                'mime_types': 'jpg,png',
                'size': 'small',
                'sub_id': interaction.user.id,
                'limit': 1
            };

            let url = 'https://api.thecatapi.com/v1/images/search';
            const urlObj = new URL(url); // Use URL object for query params
            urlObj.search = new URLSearchParams(queryParams).toString(); // Type assertion for URLSearchParams

            const response = await Axios.get(urlObj.toString(), { headers: { 'x-api-key': CAT_API_KEY } });
            const data: any[] = response.data; // Type as any array for simplicity
            const catUrl = data[0]?.url; // Optional chaining in case data[0] is undefined

            if (catUrl) {
                await interaction.reply({ content: 'Cat', files: [catUrl] });
            } else {
                await interaction.reply('Could not fetch a cat image at this time. Nyaa~');
            }
        } catch (e: any) { // Type as any for error
            console.error(e); // Changed to console.error
            await interaction.reply('An unexpected error occurred while fetching a cat. Meow...');
        }
    }
};