// client/commands/skillorder.ts
/**
 * @fileoverview The main output when users call for the /skillorder command
 * Sends a order from Left to Right for Best to Worst player skill order
 * @author Ai0796
 */

import { EmbedBuilder, CommandInteraction, AutocompleteInteraction } from 'discord.js'; // Import necessary Discord.js types
import { NENE_COLOR, FOOTER } from '../../constants';

// Assuming command_data/skillorder.ts is converted
import * as COMMAND from '../command_data/skillorder';
import generateSlashCommand from '../methods/generateSlashCommand';
import Music from '../classes/Musics'; // Assuming Music class is default export
import generateSkillText from '../methods/generateSkillText'; // Assuming generateSkillText.ts is converted
import DiscordClient from '../client'; // Assuming default export

//Required since Proseka Skill order is not 1 2 3 4 5
const Difficulties = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
const ProsekaSkillOrder = [1, 2, 3, 4, 5, 'E']; // Assuming 'E' is for Encore

interface MusicMetaSkill {
  [difficulty: string]: (number | string)[]; // e.g., { easy: [1,2,3,4,5,'E'] }
}

interface OptimalDifficultyEntry {
  0: number; // score
  1: string; // difficulty acronym
}

function skillOrder(order: (number | string)[]): string {
  return `${order[0]} > ${order[1]} > ${order[2]} > ${order[3]} > ${order[4]} > ${order[5]}`;
}

function optimalDifficulty(difficulties: OptimalDifficultyEntry[]): string {
  // Sort by score (first element) in descending order
  difficulties.sort((a, b) => b[0] - a[0]);
  let returnStr = difficulties.map(difficulty => {
    return `${difficulty[1]}`;
  }).join(' > ');

  return `\`${returnStr}\``;
}

function musicSkillOrder(song: MusicMetaSkill): string[] {
  const arr: string[] = [];
  Difficulties.forEach(difficulty => {
    if (song[difficulty] !== null && song[difficulty] !== undefined) {
      arr.push(`${skillOrder(song[difficulty])}`);
    }
  });
  return arr;
}

const musicData = new Music(); // Instantiate Music class

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    try {
      const songIdOption = interaction.options.getInteger('song'); // Get song ID from options

      if (songIdOption !== null && musicData.ids.has(songIdOption)) {
        const id = songIdOption;
        const data: MusicMetaSkill = musicData.musicmetas[id];
        const optimalDifficulties: OptimalDifficultyEntry[] = musicData.optimalDifficulty[id];

        const skillOrderText = generateSkillText(Difficulties, musicSkillOrder(data));
        const optimalDifficultyText = optimalDifficulty(optimalDifficulties);

        //Generate Embed with given text
        const skillOrderEmbed = new EmbedBuilder()
          .setColor(NENE_COLOR)
          .setTitle(`${musicData.musics[id]}`)
          .setTimestamp()
          .addFields({ name: 'Skill Orders', value: skillOrderText, inline: false })
          .addFields({ name: 'Optimal Difficulty', value: optimalDifficultyText, inline: false })
          .setFooter({ text: FOOTER, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({
          embeds: [skillOrderEmbed],
        });
      } else {
        await interaction.reply({ content: 'Please select a valid song from the autocomplete options.', ephemeral: true });
      }
    } catch (e: any) { // Type as any for error
      console.error('Error executing skillorder command:', e); // Changed to console.error
      await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
    }
  },

  async autocomplete(interaction: AutocompleteInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    const focusedValue = interaction.options.getFocused();

    if (focusedValue === '') {
      await interaction.respond([
        { name: 'Hitorinbo Envy', value: 74 },
        { name: 'Lost and Found', value: 226 },
        { name: 'Melt', value: 47 },
      ]);
      return;
    }

    // Filter music data based on focused value (case-insensitive)
    const choices = Object.keys(musicData.musics)
      .filter((key: string) => musicData.musics[parseInt(key)].toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25); // Limit to 25 choices for Discord autocomplete

    await interaction.respond(choices.map((key: string) => {
      return { name: musicData.musics[parseInt(key)], value: parseInt(key) }; // Ensure value is a number
    }));
  }
};