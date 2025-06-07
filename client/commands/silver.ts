// client/commands/silver.ts
/**
 * @fileoverview Tracks Silvers APs
 * @author Ai0796
 */

import * as COMMAND from '../command_data/silver'; // Assuming command_data/silver.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import * as fs from 'fs';
import { CommandInteraction } from 'discord.js'; // Import CommandInteraction
import DiscordClient from '../client/client'; // Assuming default export

const fp = './JSONs/silver.json';

// Use a specific interface for the file content
interface SilverFileContent {
  apCount: number;
}

function getBonks(reset?: boolean): number { // Make reset optional
  let apCount = 1;
  let silverFile: number[] | undefined; // Use number array as in original for consistency, or SilverFileContent

  try {
    if (!fs.existsSync(fp) || reset) {
      silverFile = []; // Initialize as empty array for reset or if file doesn't exist
    } else {
      silverFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
    }

    if (silverFile && silverFile.length > 0 && typeof silverFile[0] === 'number') {
      silverFile[0] += 1;
    } else {
      silverFile = [1]; // Initialize if empty or not a number
    }

    apCount = silverFile[0];

    fs.writeFile(fp, JSON.stringify(silverFile), err => {
      if (err) {
        console.error('Error writing Silver file:', err); // Changed to console.error
      } else {
        // console.log(`Wrote Silver Successfully`);
      }
    });
  } catch (e: any) { // Type as any for error
    console.error('Error occurred while writing Silver file:', e); // Changed to console.error
  }

  return apCount;
}

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    let bonks: number;
    const failedOption = interaction.options.getBoolean('failed'); // Get boolean option

    if (failedOption !== null) { // Check if the option was provided
      bonks = getBonks(failedOption); // Pass the boolean value
      await interaction.reply(`Silver got another AP\nSilver has APed ${bonks} times in a row`);
    } else {
      bonks = getBonks(); // Call without reset if option not provided
      await interaction.reply(`Silver got another AP\nSilver has APed ${bonks} times in a row`);
    }
  }
};