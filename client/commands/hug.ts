// client/commands/hug.ts
/**
 * @fileoverview Allows you to bonk a user
 * @author Ai0796
 */


import { CommandInteraction, User, GuildMember } from 'discord.js'; // Import necessary types
import * as COMMAND from '../command_data/hug'; // Import all exports from hug
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import axios from 'axios'; // Import axios directly
import * as fs from 'fs';
import DiscordClient from '../client'; // Assuming default export

const fp = './JSONs/hug.json';
const hugAPIURL = 'https://api.otakugifs.xyz/gif?reaction=hug';

interface HugFile {
    [userId: string]: number;
}

function getHugs(userId: string): number { // Added type for userId
    let hugs = 1;
    let fileContent: HugFile; // Explicitly type fileContent
    try {
        if (!fs.existsSync(fp)) {
            fileContent = {}; // Initialize as empty object if file doesn't exist
        }
        else {
            fileContent = JSON.parse(fs.readFileSync(fp, 'utf8')) as HugFile; // Type assertion
        }

        if (userId in fileContent) {
            fileContent[userId] = fileContent[userId] + 1;
        }
        else {
            fileContent[userId] = 1;
        }

        hugs = fileContent[userId];

        fs.writeFile(fp, JSON.stringify(fileContent), err => {
            if (err) {
                console.error('Error writing Hugs', err); // Changed to console.error
            } else {
                console.log('Wrote Hugs Successfully');
            }
        });
    } catch (e: any) { // Type as any for error
        console.error('Error occurred while writing hugs:', e); // Changed to console.error
    }

    return hugs;
}

async function getHugGif(): Promise<string> {
    const response = await axios.get(hugAPIURL);
    return response.data.url;
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types for interaction and discordClient
        try {
            // interaction.options.getMember('user') returns GuildMember | null
            const userOption = interaction.options.getMember('user');
            // If userOption is null, default to interaction.user (User object)
            const targetUser: User | GuildMember = userOption || interaction.user;

            const id = targetUser.id; // Get ID from User or GuildMember

            const hugs = getHugs(id);
            const mention = `<@${id}>`;
            const selfMention = `<@${interaction.user.id}>`;

            if (targetUser.id === interaction.user.id) { // If user is hugging themselves
                const hugURL = 'https://tenor.com/view/emu-otori-nene-neo-hug-jump-gif-1414561477616308005';
                await interaction.reply(`Emu is here to hug you, ${mention} Wonderhoy!\nYou have been hugged ${hugs} times!`);
                await interaction.followUp(hugURL);
                return;
            } else {
                const hugURL = await getHugGif();
                await interaction.reply(`${mention} has been hugged by ${selfMention}\n ${mention} has been hugged ${hugs} times!`);
                await interaction.followUp(hugURL);
                return;
            }
        } catch (e: any) { // Type as any for error
            console.error(e); // Changed to console.error
            await interaction.reply('An unexpected error occurred while processing the hug command.');
        }
    }
};