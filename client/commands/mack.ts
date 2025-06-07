// client/commands/mack.ts
/**
 * @fileoverview Tracks when Mack has a moment
 * @author Ai0796
 */

import * as COMMAND from '../command_data/mack'; // Assuming command_data/mack.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import * as fs from 'fs';
import { CommandInteraction } from 'discord.js'; // Import CommandInteraction
import DiscordClient from '../client/client'; // Assuming default export

const fp = './JSONs/mack.json';

function getBonks(): number {
    let bonk = 1;
    let bonkFile: { blessings?: number } = {}; // Use a specific interface for bonkFile
    try {
        if (!fs.existsSync(fp)) {
            bonkFile = {}; // Initialize as empty object if file doesn't exist
        } else {
            bonkFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if ('blessings' in bonkFile && typeof bonkFile.blessings === 'number') { // Check type explicitly
            bonkFile.blessings += 1;
        } else {
            bonkFile.blessings = 1; // Initialize if not present
        }

        bonk = bonkFile.blessings;

        fs.writeFile(fp, JSON.stringify(bonkFile), err => {
            if (err) {
                console.error('Error writing Mack file:', err); // Changed to console.error
            } else {
                // console.log(`Wrote Mack Successfully`);
            }
        });
    } catch (e: any) { // Type as any for error
        console.error('Error occurred while writing Mack:', e); // Changed to console.error
    }

    return bonk;
}

const phrases = [
    'nyaa',
    'so true bestie',
    'he\'s probably simping over kanade',
    'how do I transfer to MRE',
    'get the toe gif',
    'omg An',
    'get some help',
    'what a gorilla',
    'that\'s my t1 hermit',
    'please don\'t be rocks again',
    'omg fes kanade toes',
    'what a mizuki oshi'
];

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        // await interaction.reply("test")
        try {
            const moments = getBonks();

            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            await interaction.reply(`Mackaylen has had ${moments} moments, ${randomPhrase}`);
        } catch (e: any) { // Type as any for error
            console.error('Error executing mack command:', e); // Changed to console.error
        }
    }
};