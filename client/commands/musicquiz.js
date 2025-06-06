/**
 * @fileoverview The main output when users call for the /quiz command
 * Contains various classes designed to pool information from the master db and
 * dynamically generate questions for the user.
 * Also contains the main method of user access to the quiz, and randomly selection
 * of a category.
 * @author Potor10
 */

const { 
  ActionRowBuilder, 
  EmbedBuilder, 
  AttachmentBuilder, 
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  TextInputBuilder,
  ModalBuilder,
} = require('discord.js');

const { NENE_COLOR, FOOTER } = require('../../constants');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const music = require('../classes/Musics');

const COMMAND = require('../command_data/musicquiz');

const generateSlashCommand = require('../methods/generateSlashCommand');
const Axios = require('axios');
const { Buffer } = require('buffer');
const { pipeline } = require('stream/promises');
const { fuzzy } = require('fast-fuzzy');

const mp3Duration = require('mp3-duration');

const priority = ['SEKAI ver.', 'VIRTUAL SINGER ver.'];
const notWorking = new Set([-1, 609]);
const generateEmbed = require('../methods/generateEmbed');

const musicData = new music();
const idList = Array.from(musicData.ids);

const maxTries = 4;
const diffLength = [1, 3, 5, 7];
const diffNames = ['Addict', 'Hard', 'Medium', 'Easy'];

const currentUsers = new Object(); // To track current users in the quiz

const downloadSong = async (assetName) => {

  if (notWorking.has(assetName)) {
    console.error(`Skipping download for ${assetName} as it is known to not work.`);
    return false;
  }

  let filepath = `./songs/long/${assetName}.mp3`;

  if (!fs.existsSync(filepath)) {
    // Try to download the song
    try {

      let url = `https://storage.sekai.best/sekai-jp-assets/music/long/${assetName}/${assetName}.mp3`;

      console.log(`Downloading song ${assetName} from ${url}...`);

      const response = await Axios({
        url: url,
        method: 'get',
        responseType: 'stream'
      });

      response.data.on('error', (err) => {
        console.error(`Error checking song ${assetName} from ${url}:`, err);
        notWorking.add(assetName);
      });

      const filestream = fs.createWriteStream(filepath);

      await pipeline(response.data, filestream);

    } catch (err) {
      console.error(`Failed to download song ${assetName} from ${url}:`, err);
      notWorking.add(assetName);
    }
  }
};

const getSong = async (songId) => {
  const vocals = JSON.parse(fs.readFileSync('./sekai_master/musicVocals.json'));
  let filteredVocals = vocals.filter((vocal) => {
    return vocal.musicId === songId;
  });

  let assetName = null;

  priority.forEach((vocal) => {
    if (filteredVocals.caption === vocal && assetName === null) {
      assetName = filteredVocals.assetbundleName;
    }
  });

  if (assetName === null) {
    assetName = filteredVocals[0].assetbundleName;
  }

  await downloadSong(assetName);

  return assetName;
};

async function getMp3Duration(filePath) {
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
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }
}

const trimSong = async (assetName, length) => {
  const inputPath = `./songs/long/${assetName}.mp3`;

  let songLength = await getMp3Duration(inputPath);

  let randomStart = Math.floor(Math.random() * (songLength - length - 8));
  randomStart += 8; // Ensure we start after the first 8 seconds

  return new Promise((resolve, reject) => {

    const audioChunks = [];

    ffmpeg(inputPath)
      .setStartTime(randomStart)
      .setDuration(length)
      .format('mp3')
      .on('end', () => {
        const audioBuffer = Buffer.concat(audioChunks);
        resolve(audioBuffer);
      })
      .on('error', (err) => {
        reject(err);
      })
      .pipe()
      .on('data', (chunk) => {
        audioChunks.push(chunk);
      })
      .on('error', (err) => {
        console.error(`Error processing audio: ${err}`);
        reject(err);
      });
  });
};

/**
 * Obtain the account statistics of the user (if it exists)
 * @param {String} userId the Id of the user using the quiz
 * @param {DiscordClient} discordClient the client we are using to serve requests
 * @return {Object} an object containing the overall stats of the user
 */
const getAccount = (userId, discordClient) => {
  // Obtain our user stats
  const user = discordClient.db.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
    discordId: userId
  });

  let account = null;
  if (user.length) {
    account = user[0];
  }

  return account;
};

async function getAudioFields(songList, lengths, names) {
  let audioFields = [];

  songList.forEach((song, index) => {
    let name = names[index];
    let length = lengths[index];

    audioFields.push({
      name: name,
      value: `Length: ${length} seconds`,
      inline: true
    });
  });

  return audioFields;
}

async function generateAttachments(songList) {

  let audioFiles = songList.map((song, index) => {

    let file = new AttachmentBuilder(song, { name: `Mystery Song (${diffLength[index]} Seconds).mp3` });

    return file;
  });

  return audioFiles;
}

module.exports = {
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction, discordClient) {

      await interaction.deferReply({ ephemeral: false });

      const interactionSec = Math.round(COMMAND.CONSTANTS.INTERACTION_TIME / 1000);

      const content = {
          type: 'Music Quiz',
          message: `\n*You have ${interactionSec} seconds to answer this question*`
      };

      if (!(interaction.channel.id in currentUsers)) {
        currentUsers[interaction.channel.id] = {};
      }

      let tries = 0;

      let trimmedSongs = [];

      let songId = -1;
      while (notWorking.has(songId) || songId === -1) {
          songId = idList[Math.floor(Math.random() * idList.length)];
      }

      let assetName = await getSong(songId);
      let newTrim = await trimSong(assetName, diffLength[0]);
      trimmedSongs.push(newTrim);

      let files = await generateAttachments(trimmedSongs, diffLength, diffNames);

      // --- NEW: Create a button to open the modal ---
      const guessButton = new ButtonBuilder()
          .setCustomId('guessSongButton') // Unique ID for this button
          .setLabel('Guess the Song!')
          .setStyle(ButtonStyle.Primary); // Blue button

      const actionRowForButton = new ActionRowBuilder()
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
      const modalTextInputRow = new ActionRowBuilder().addComponents(songNameTextInput);

      // Add the ActionRow to the Modal
      quizModal.addComponents(modalTextInputRow);

      // --- Send the initial quiz message with the button ---
      // This is your original line 279, now updated with the button
      const quizMessage = await interaction.editReply({
          embeds: [
              generateEmbed({
                  name: COMMAND.INFO.name,
                  content: content,
                  client: discordClient.client
              })
          ],
          components: [actionRowForButton], // Send the ActionRow with the button
          files: files,
          fetchReply: true
      });

      // --- Collector for the Button Click (to open the modal) ---
      const buttonFilter = i => i.customId === 'guessSongButton' && i.user.id === interaction.user.id;

      const buttonCollector = quizMessage.createMessageComponentCollector({
          filter: buttonFilter,
          time: COMMAND.CONSTANTS.INTERACTION_TIME
      });

      buttonCollector.on('collect', async (buttonInteraction) => {
          // Defer update to show Discord that the bot is processing,
          // otherwise, the modal might not show if interaction isn't acknowledged.
          await buttonInteraction.showModal(quizModal);
      });

      currentUsers[interaction.channel.id][interaction.user.id] = {
        tries: 0,
        songId: songId, // This will be set later
        interaction: interaction,
        trimmedSongs: trimmedSongs, // Store the trimmed songs for later use
        assetName: assetName,
        actionRow: actionRowForButton, // Store the button row for later use
        collector: buttonCollector, // Store the collector for later use
        content: content // Store the content for later use
      };

      // --- Collector for the Quiz Timeout (remains mostly the same) ---
      // This collector now also acts as the overall quiz timer.
      // The modal submission will implicitly 'end' the collector if correct.
      buttonCollector.on('end', async (collected, reason) => {

           // Only if the quiz wasn't solved already by a modal submit
           if (reason === 'time' && tries < maxTries) { // Assuming 'tries' is updated externally or passed through state
              const timeoutContent = {
                  type: COMMAND.CONSTANTS.QUESTION_TIMEOUT_TYPE,
                  message: COMMAND.CONSTANTS.QUESTION_TIMEOUT_MSG + ` The song was: \`${musicData.musics[songId]}\``
              };

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

           currentUsers[interaction.channel.id][interaction.user.id] = null; // Clear user state after quiz ends
      });
  },

  async modalSubmit(modelInteraction, discordClient) {
    if (modelInteraction.customId === 'musicquiz') {
          // Handle the modal submission
      const songName = modelInteraction.fields.getTextInputValue('musicquiz_input');

          // currentUsers[interaction.channel.id][interaction.user.id] = {
          //   tries: 0,
          //   maxTries: 3,
          //   songId: songId, // This will be set later
          //   interaction: quizMessage, // Store the message to delete later
          //   audioFiles: files, // Store the audio files for later use
          //   trimmedSongs: trimmedSongs, // Store the trimmed songs for later use
          //   assetName: assetName
          // };

      if (!currentUsers[modelInteraction.channel.id] || !currentUsers[modelInteraction.channel.id][modelInteraction.user.id]) {
              return modelInteraction.reply({
                  content: 'You are not currently in a music quiz.',
                  ephemeral: true
              });
          }

      await modelInteraction.reply('Processing your answer...');
      await modelInteraction.deleteReply();

      const userData = currentUsers[modelInteraction.channel.id][modelInteraction.user.id];

          // Retrieve the active quiz state for this user
          // Example: const quizState = activeQuizzes.get(interaction.user.id);
          // For simplicity, let's assume we have the songId and tries from the interaction context
          const songId = userData.songId; // Replace with actual songId from your state management
          const tries = ++userData.tries; // Replace with actual tries from your state management
          const trimmedSongs = userData.trimmedSongs; // The audio files for the quiz
          const assetName = userData.assetName; // The asset name for the song
          let content = userData.content; // The content for the embed
          content.message += `\nGuess ${tries} of ${maxTries}: \`${songName}\``;
          let replyInteraction = userData.interaction; // The original interaction message

          if (fuzzy(songName, musicData.musics[songId], {useSellers : false}) > 0.7) {

              // Correct answer
            await replyInteraction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: {
                            type: 'Correct Answer',
                            message: content.message + 
                            `\n\nCongratulations! You guessed the song correctly: \`${musicData.musics[songId]}\` in ${tries} tries!`
                        },
                        client: discordClient.client
                    })
                ],
                components: [], // Remove components when quiz ends
                files: [] // Clear files if they were related to active quiz
              });
              userData.collector.stop('solved'); // Stop the button collector if the answer is correct
          } else if (tries >= maxTries) {
              // Max tries reached

              content.message += `\n\nYou have ran out of tries, the correct answer was: \`${musicData.musics[songId]}\``

            await replyInteraction.editReply({
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
          } 
          else {

              trimmedSongs.push(await trimSong(assetName, diffLength[tries]));
              let files = await generateAttachments(trimmedSongs, diffLength, diffNames);

            await replyInteraction.editReply({
                embeds: [
                  generateEmbed({
                      name: COMMAND.INFO.name,
                      content: userData.content,
                      client: discordClient.client
                  })
                ],
                components: [userData.actionRow], // Remove components when quiz ends
                files: files // Clear files if they were related to active quiz
              });
              // Increment tries and check if max tries reached, then end quiz if so.
              // Example: quizState.tries++;
              // if (quizState.tries >= COMMAND.CONSTANTS.MAX_TRIES) { ... }
          }
      }
  }
};