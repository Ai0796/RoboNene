// client/commands/bonk.ts
/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */

import { CommandInteraction, User, GuildMember } from 'discord.js'; // Import necessary types
import * as COMMAND from '../command_data/bonk'; // Import all exports from bonk
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export

const fp = './JSONs/bonk.json';

interface BonkFile {
    [userId: string]: number;
}

function getBonks(userId: string): number { // Added type for userId
    let bonk = 1;
    let bonkFile: BonkFile; // Explicitly type bonkFile
    try {
        if (!fs.existsSync(fp)) {
            bonkFile = {}; // Initialize as empty object if file doesn't exist
        }
        else {
            bonkFile = JSON.parse(fs.readFileSync(fp, 'utf8')) as BonkFile; // Type assertion
        }

        if (userId in bonkFile) {
            bonkFile[userId] = bonkFile[userId] + 1;
        }
        else {
            bonkFile[userId] = 1;
        }

        bonk = bonkFile[userId];

        fs.writeFile(fp, JSON.stringify(bonkFile), err => {
            if (err) {
                console.error('Error writing Bonk', err); // Changed to console.error
            } else {
                console.log('Wrote Bonk Successfully');
            }
        });
    } catch (e: any) { // Type as any for error
        console.error('Error occurred while writing bonks:', e); // Changed to console.error
    }

    return bonk;
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient
        try {
            // interaction.options._hoistedOptions[0] can be problematic if no options are present or structure changes
            // Better to use interaction.options.getUser('user')
            const userOption = interaction.options.getUser('user');

            if (userOption) { // Check if userOption exists
                const id = userOption.id;
                const mention = `<@${id}>`;

                const bonks = getBonks(id);

                await interaction.reply(`<:emugun:974080545560608778> Bonk ${mention}, go to sleep\n ${mention} has been bonked ${bonks} times`);
            } else {
                // Handle case where user option is not provided (though it's required in command_data)
                // This branch might only be hit if discord.js interaction structure is different or unexpected
                await interaction.reply('Please specify a user to bonk.');
            }
        } catch (e: any) { // Type as any for error
            console.error(e); // Changed to console.error
            await interaction.reply('An unexpected error occurred while processing the bonk command.');
        }
    }
};