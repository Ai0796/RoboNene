// client/commands/musicquiz.ts
/**
 * @fileoverview The main output when users call for the /quiz command
 * Contains various classes designed to pool information from the master db and
 * dynamically generate questions for the user.
 * Also contains the main method of user access to the quiz, and randomly selection
 * of a category.
 * @author Potor10
 */

import {
  ActionRowBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  ModalBuilder,
  CommandInteraction, // For initial command interaction
  ModalSubmitInteraction, // For modal submission interaction
  MessageComponentInteraction // For button interaction (guessSongButton)
} from 'discord.js';

import { NENE_COLOR, FOOTER } from '../../constants';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg'; // Ensure fluent-ffmpeg is correctly imported
import Music from '../classes/Musics'; // Assuming default export
import * as COMMAND from '../command_data/musicquiz'; // Assuming command_data/musicquiz.ts is converted

import generateSlashCommand from '../methods/generateSlashCommand';
import Axios from 'axios';
import { Buffer } from 'buffer';
import { pipeline } from 'stream/promises';
import { search } from 'fast-fuzzy'; // Import search function directly

import mp3Duration from 'mp3-duration'; // Assuming mp3-duration is correctly imported
import generateEmbed from '../methods/generateEmbed'; // Ensure generateEmbed is imported
import DiscordClient from '../client/client'; // Assuming default export

const notWorking = new Set<number>([-1, 609]); // Use Set with number type
const musicData = new Music();
musicData.loadAliases(); // Load aliases on startup

const idList: number[] = Array.from(musicData.ids);

const maxTries = 4;
const diffLength = [1, 3, 5, 7];
const diffNames = ['Addict', 'Hard', 'Medium', 'Easy'];

interface UserQuizState {
  tries: number;
  songId: number;
  interaction: CommandInteraction; // The original command interaction
  trimmedSongs: Buffer[];
  assetName: string;
  actionRow: ActionRowBuilder<ButtonBuilder>;
  collector: any; // Collector type can be complex, use any for simplicity for now
  content: { type: string; message: string };
}

// To track current users in the quiz by channel ID and then user ID
const currentUsers: { [channelId: string]: { [userId: string]: UserQuizState | null } } = {};

const downloadSong = async (assetName: string): Promise<boolean> => {
  if (notWorking.has(parseInt(assetName))) { // Convert assetName to number if it's treated as songId here
    console.error(`Skipping download for ${assetName} as it is known to not work.`);
    return false;
  }

  const filepath = `./songs/long/${assetName}.mp3`;

  if (!fs.existsSync(filepath)) {
    try {
      const url = `https://storage.sekai.best/sekai-jp-assets/music/long/${assetName}/${assetName}.mp3`;
      console.log(`Downloading song ${assetName} from ${url}...`);

      const response = await Axios({
        url: url,
        method: 'get',
        responseType: 'stream'
      });

      response.data.on('error', (err: any) => { // Type as any
        console.error(`Error checking song ${assetName} from ${url}:`, err);
        notWorking.add(parseInt(assetName));
      });

      const filestream = fs.createWriteStream(filepath);

      await pipeline(response.data, filestream);
      return true; // Indicate successful download
    } catch (err: any) { // Type as any
      console.error(`Failed to download song ${assetName} from URL:`, err); // Log the full error
      notWorking.add(parseInt(assetName));
      return false; // Indicate failed download
    }
  }
  return true; // Song already exists
};

const getSong = async (songId: number): Promise<string> => {
  const vocals: any[] = JSON.parse(fs.readFileSync('./sekai_master/musicVocals.json', 'utf8')); // Type as any array
  const filteredVocals = vocals.filter((vocal) => {
    return vocal.musicId === songId;
  });

  if (filteredVocals.length === 0) {
    console.error(`No vocals found for songId: ${songId}`);
    return ''; // Return empty string or handle error appropriately
  }

  // Get random version
  const assetName = filteredVocals[Math.floor(Math.random() * filteredVocals.length)].assetbundleName;

  await downloadSong(assetName);

  return assetName;
};

async function getMp3Duration(filePath: string): Promise<number> {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return new Promise((resolve, reject) => {
      mp3Duration(fileBuffer, (err, duration) => {
        if (err) {
          return reject(new Error(`Failed to get MP3 duration: ${err.message}`));
        }
        resolve(duration); // duration is in seconds
      });
    });
  } catch (error: any) { // Type as any
    console.error(`Error reading file ${filePath}:`, error);
    throw error; // Re-throw to propagate the error
  }
}

const trimSong = async (assetName: string, length: number): Promise<Buffer> => {
  const inputPath = `./songs/long/${assetName}.mp3`;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input song file not found: ${inputPath}`);
  }

  const songLength = await getMp3Duration(inputPath);

  let randomStart = Math.floor(Math.random() * (songLength - length - 8));
  randomStart = Math.max(0, randomStart + 8); // Ensure we start after the first 8 seconds and not before 0

  return new Promise((resolve, reject) => {
    const audioChunks: Buffer[] = [];

    ffmpeg(inputPath)
      .setStartTime(randomStart)
      .setDuration(length)
      .toFormat('mp3')
      .on('end', () => {
        const audioBuffer = Buffer.concat(audioChunks);
        resolve(audioBuffer);
      })
      .on('error', (err: any) => { // Type as any
        console.error(`Error processing audio: ${err}`);
        reject(err);
      })
      .pipe() // Pipe to a Writable stream (e.g., in-memory buffer)
      .on('data', (chunk: Buffer) => {
        audioChunks.push(chunk);
      })
      .on('error', (err: any) => { // This error listener is important for the pipe
        console.error(`Error during piping audio data: ${err}`);
        reject(err);
      });
  });
};

/**
 * Obtain the account statistics of the user (if it exists)
 * @param {string} userId the Id of the user using the quiz
 * @param {DiscordClient} discordClient the client we are using to serve requests
 * @return {any} an object containing the overall stats of the user (type as any for simplicity)
 */
const getAccount = (userId: string, discordClient: DiscordClient): any => {
  // Obtain our user stats
  const user = discordClient.db?.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
    discordId: userId
  });

  let account = null;
  if (user && user.length) {
    account = user[0];
  }

  return account;
};

async function getAudioFields(songList: Buffer[], lengths: number[], names: string[]): Promise<{ name: string; value: string; inline: boolean }[]> {
  const audioFields: { name: string; value: string; inline: boolean }[] = [];

  songList.forEach((_song, index) => { // _song is unused
    const name = names[index];
    const length = lengths[index];

    audioFields.push({
      name: name,
      value: `Length: ${length} seconds`,
      inline: true
    });
  });

  return audioFields;
}

async function generateAttachments(songList: Buffer[], lengths: number[], names: string[]): Promise<AttachmentBuilder[]> {
  const audioFiles = songList.map((songBuffer, index) => {
    // Assuming songBuffer is already the Buffer content
    const fileName = `Mystery Song (${names[index]} ${lengths[index]} Seconds).mp3`;
    const file = new AttachmentBuilder(songBuffer, { name: fileName });
    return file;
  });

  return audioFiles;
}

export default {
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) {

    await interaction.deferReply({ ephemeral: false });

    const interactionSec = Math.round(COMMAND.CONSTANTS.INTERACTION_TIME / 1000);

    const content = {
      type: 'Music Quiz',
      message: `\n*You have ${interactionSec} seconds to answer this question*`
    };

    if (!interaction.channel) {
      await interaction.editReply("This command can only be used in a guild channel.");
      return;
    }

    if (!(interaction.channel.id in currentUsers)) {
      currentUsers[interaction.channel.id] = {};
    }

    let songId = -1;
    let attempts = 0;
    const maxSongSelectionAttempts = 10; // Prevent infinite loop for bad song IDs

    while (notWorking.has(songId) || songId === -1 && attempts < maxSongSelectionAttempts) {
      songId = idList[Math.floor(Math.random() * idList.length)];
      attempts++;
    }

    if (notWorking.has(songId) || songId === -1) {
      await interaction.editReply("Could not find a working song for the quiz. Please try again later.");
      return;
    }

    const assetName = await getSong(songId);
    if (!assetName) {
      await interaction.editReply("Could not prepare the song for the quiz. Please try again later.");
      return;
    }

    const trimmedSongs: Buffer[] = [];
    try {
      const newTrim = await trimSong(assetName, diffLength[0]);
      trimmedSongs.push(newTrim);
    } catch (e) {
      console.error(`Error trimming song ${assetName}:`, e);
      await interaction.editReply("There was an issue preparing the audio for the quiz. Please try again.");
      return;
    }


    const files = await generateAttachments(trimmedSongs, diffLength, diffNames);

    // --- NEW: Create a button to open the modal ---
    const guessButton = new ButtonBuilder()
      .setCustomId('guessSongButton') // Unique ID for this button
      .setLabel('Guess the Song!')
      .setStyle(ButtonStyle.Primary); // Blue button

    const actionRowForButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(guessButton);

    // --- Original 'input' TextInputBuilder (now part of the modal) ---
    const songNameTextInput = new TextInputBuilder()
      .setMaxLength(100)
      .setCustomId('musicquiz_input') // IMPORTANT: Changed customId to avoid conflict and be specific
      .setLabel('What is the song name?')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);

    // --- NEW: Create the Modal ---
    const quizModal = new ModalBuilder()
      .setCustomId('musicquiz') // Unique ID for this modal
      .setTitle('Guess the Song');

    // Add the TextInput to an ActionRow specifically for the Modal
    const modalTextInputRow = new ActionRowBuilder<TextInputBuilder>().addComponents(songNameTextInput);

    // Add the ActionRow to the Modal
    quizModal.addComponents(modalTextInputRow);

    // --- Send the initial quiz message with the button ---
    const quizMessage = await interaction.editReply({
      embeds: [
        generateEmbed({
          name: COMMAND.INFO.name,
          content: content,
          client: discordClient.client
        })
      ],
      components: [actionRowForButton],
      files: files,
      fetchReply: true
    });

    // --- Collector for the Button Click (to open the modal) ---
    const buttonFilter = (i: MessageComponentInteraction) => i.customId === 'guessSongButton' && i.user.id === interaction.user.id;

    const buttonCollector = quizMessage.createMessageComponentCollector({
      filter: buttonFilter,
      time: COMMAND.CONSTANTS.INTERACTION_TIME
    });

    currentUsers[interaction.channel.id][interaction.user.id] = {
      tries: 0,
      songId: songId,
      interaction: interaction,
      trimmedSongs: trimmedSongs,
      assetName: assetName,
      actionRow: actionRowForButton,
      collector: buttonCollector,
      content: { ...content } // Deep copy content to avoid shared mutation
    };

    // --- Collector on end (timeout) ---
    buttonCollector.on('end', async (collected, reason) => {
      // Retrieve quiz state from currentUsers, as it might have been updated by modalSubmit
      const finalUserData = currentUsers[interaction.channel.id][interaction.user.id];

      // Only if the quiz wasn't solved already by a modal submit
      if (reason === 'time' && finalUserData && finalUserData.tries < maxTries) {
        const songActual = musicData.musics[finalUserData.songId];
        const timeoutContent = {
          type: COMMAND.CONSTANTS.QUESTION_TIMEOUT_TYPE,
          message: COMMAND.CONSTANTS.QUESTION_TIMEOUT_MSG + ` The song was: \`${songActual}\``
        };

        // If the original interaction has already been replied/edited by modal submit, use followUp or just update
        // Check if the interaction has already been replied to, to avoid ERR_ALREADY_REPLIED
        if (!interaction.replied && !interaction.deferred) {
          await interaction.followUp({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
                content: timeoutContent,
                client: discordClient.client
              })
            ],
            components: [], // Remove components when quiz ends
            files: [] // Clear files if they were related to active quiz
          });
        } else {
          await interaction.editReply({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
                content: timeoutContent,
                client: discordClient.client
              })
            ],
            components: [], // Remove components when quiz ends
            files: [] // Clear files if they were related to active quiz
          });
        }
      }
      if (interaction.channel) {
        currentUsers[interaction.channel.id][interaction.user.id] = null; // Clear user state after quiz ends
      }
    });
  },

  async modalSubmit(modalInteraction: ModalSubmitInteraction, discordClient: DiscordClient) {
    if (modalInteraction.customId === 'musicquiz') {
      const songName = modalInteraction.fields.getTextInputValue('musicquiz_input');

      if (!modalInteraction.channel) {
        await modalInteraction.reply({
          content: 'This command can only be used in a guild channel.',
          ephemeral: true
        });
        return;
      }

      const userData = currentUsers[modalInteraction.channel.id]?.[modalInteraction.user.id];

      if (!userData) {
        await modalInteraction.reply({
          content: 'You are not currently in a music quiz.',
          ephemeral: true
        });
        return;
      }

      await modalInteraction.reply({ content: 'Processing your answer...', ephemeral: true });
      await modalInteraction.deleteReply(); // Delete the "Processing" reply quickly

      userData.tries++; // Increment tries
      const songActual = musicData.musics[userData.songId];
      let content = userData.content; // Use the stored content object
      content.message = `\n*You have ${COMMAND.CONSTANTS.INTERACTION_TIME / 1000} seconds to answer this question*`; // Reset base message part
      content.message += `\nGuess ${userData.tries} of ${maxTries}: \`${songName}\``;

      // Due to substring matching we want either 3 characters or 1/3 of the song name length, whichever is smaller
      const minLength = Math.min(3, Math.ceil(songActual.length / 3));

      // Use `musicData.aliases[userData.songId]` which should be an array of strings
      const aliasesForFuzzy = musicData.aliases[userData.songId] || [songActual];
      const fuzzyResults = search(songName, aliasesForFuzzy, {
        threshold: 0.0,
        ignoreSymbols: false,
        returnMatchData: true
      });

      // Filter results to only include matches with a score > 0.7 and length >= minLength
      const relevantFuzzyResult = fuzzyResults.find(result => result.score > 0.7 && songName.length >= minLength);


      if (relevantFuzzyResult) {
        // Correct answer
        content.type = 'Correct Answer';
        content.message +=
          `\n\nCongratulations! You guessed the song correctly: \`${songActual}\` in ${userData.tries} tries!` +
          `\n\nMatched with: \`${relevantFuzzyResult.item}\` (Score: ${relevantFuzzyResult.score.toFixed(2)})`;

        await userData.interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: content,
              client: discordClient.client
            })
          ],
          components: [], // Remove components when quiz ends
          files: [] // Clear files if they were related to active quiz
        });
        userData.collector.stop('solved'); // Stop the button collector if the answer is correct
        if (modalInteraction.channel) {
          currentUsers[modalInteraction.channel.id][modalInteraction.user.id] = null; // Clear user state
        }
      } else if (userData.tries >= maxTries) {
        // Max tries reached
        content.type = 'Out of Tries';
        content.message += `\n\nYou have run out of tries, the correct answer was: \`${songActual}\``;

        await userData.interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: content,
              client: discordClient.client
            })
          ],
          components: [], // Remove components when quiz ends
          files: [] // Clear files if they were related to active quiz
        });
        userData.collector.stop('max_tries'); // Stop collector after max tries
        if (modalInteraction.channel) {
          currentUsers[modalInteraction.channel.id][modalInteraction.user.id] = null; // Clear user state
        }
      }
      else {
        // Incorrect answer, provide next audio clip
        try {
          const nextTrim = await trimSong(userData.assetName, diffLength[userData.tries]); // Use userData.tries for next length
          userData.trimmedSongs.push(nextTrim);
        } catch (e) {
          console.error(`Error trimming song ${userData.assetName} for next try:`, e);
          content.type = 'Error';
          content.message = 'There was an issue preparing the next audio clip. Quiz ended.';
          await userData.interaction.editReply({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
                content: content,
                client: discordClient.client
              })
            ],
            components: [],
            files: []
          });
          userData.collector.stop('audio_error');
          if (modalInteraction.channel) {
            currentUsers[modalInteraction.channel.id][modalInteraction.user.id] = null;
          }
          return;
        }

        const files = await generateAttachments(userData.trimmedSongs, diffLength.slice(0, userData.tries + 1), diffNames.slice(0, userData.tries + 1));
        content.type = 'Incorrect Answer'; // Set type for incorrect guess feedback

        await userData.interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: content,
              client: discordClient.client
            })
          ],
          components: [userData.actionRow],
          files: files
        });
      }
    }
  }
};