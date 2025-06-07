// client/commands/sakiknife.ts
/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

import * as COMMAND from '../command_data/sakiknife'; // Assuming command_data/sakiknife.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import { CommandInteraction } from 'discord.js'; // Import CommandInteraction
import DiscordClient from '../client/client'; // Assuming default export

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        try {
            await interaction.reply('<:SakiKnife:1129108489634070538>');
        } catch (e: any) { // Type as any for error
            console.error('Error executing sakiknife command:', e); // Changed to console.error
        }
    }
};