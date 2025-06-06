/**
 * @fileoverview The main output when users call for the /quiz command
 * Contains various classes designed to pool information from the master db and
 * dynamically generate questions for the user.
 * Also contains the main method of user access to the quiz, and randomly selection
 * of a category.
 * @author Potor10
 */

const { ActionRowBuilder, EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const music = require('../classes/Musics');

const COMMAND = require('../command_data/musicquiz');

const generateSlashCommand = require('../methods/generateSlashCommand');
const Axios = require('axios');
const { Buffer } = require('buffer');
const { pipeline } = require('stream/promises');

const mp3Duration = require('mp3-duration');
const { TextInputBuilder } = require('discord.js');

const priority = ['SEKAI ver.', 'VIRTUAL SINGER ver.'];
const notWorking = new Set([-1, 609]);
const { generateEmbed } = require('../methods/generateEmbed');

const musicData = new music();
const idList = Array.from(musicData.ids);

const generateAudioEmbed = ({ name, content, image, client }, audioFields) => {

  const embed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
    .addFields({
      name: content.type.charAt(0).toUpperCase() + content.type.slice(1),
      value: content.message.charAt(0).toUpperCase() + content.message.slice(1)
    })
    .addFields(...audioFields)
    .setThumbnail(client.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: client.user.displayAvatarURL() });

  return embed;
};

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

  downloadSong(assetName);

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

async function testDownloadTrim() {

  let randomSongId = idList[Math.floor(Math.random() * idList.length)];

  randomSongId = 74;

  const assetName = await getSong(randomSongId);
  
  if (assetName) {
    const trimmedSong = await trimSong(assetName, 30);
    fs.writeFileSync(`./songs/trimmed/${assetName}.mp3`, trimmedSong);
    console.log(`Trimmed song saved as ./songs/trimmed/${assetName}.mp3`);
  } else {
    console.log('No asset name found for song ID 609');
  }
}

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
}

async function generateAudioFiles(songList) {

  let audioFiles = songList.map((song, index) => {
    return {
      attachment: song,
      name: `trimmed_song_${index + 1}.mp3`
    };
  });

  return audioFiles;
}

testDownloadTrim();

module.exports = {
  data: generateSlashCommand(COMMAND.INFO),
  
  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const input = new TextInputBuilder()
      .setMaxLength(100)
      .setCustomId('musicquiz')
      .setLabel('Song Name')
      .setRequired(true)
      .setStyle(1); // 1 is for SHORT style;

    // Initialize our question selection menu
    const questionSelect = new ActionRowBuilder()
      .addComponents(input);

    const interactionSec = Math.round(COMMAND.CONSTANTS.INTERACTION_TIME / 1000);
    
    const content = {
      type: 'Music Quiz',
      message: prompt + `\n*You have ${interactionSec} seconds to answer this question*`
    };

    let tries = 0;
    let maxTries = 3;

    // Three tries to guess the song
    const diffLength = [3, 5, 7];
    const diffNames = ['Hard', 'Medium', 'Easy'];

    let trimmedSongs = [];

    let songId = -1;
    while (notWorking.has(songId) || songId === -1) {
      // Randomly select a song id from the list
      songId = idList[Math.floor(Math.random() * idList.length)];
    }

    let assetName = await getSong(songId);

    let newTrim = trimSong(assetName, diffLength[0]);
    trimmedSongs.push(newTrim);

    let fields = await getAudioFields(trimmedSongs, diffLength, diffNames);
    let files = await generateAudioFiles(trimmedSongs, diffLength, diffNames);

    const quizMessage = await interaction.editReply({
      embeds: [
        generateAudioEmbed({
          name: COMMAND.INFO.name,
          content: content,
          client: discordClient.client
        },
        fields)
      ],
      components: [questionSelect],
      files: files,
      fetchReply: true
    });

    const filter = i => { return i.customId === 'musicquiz'; };

    const collector = quizMessage.createMessageComponentCollector({
      filter,
      time: COMMAND.CONSTANTS.INTERACTION_TIME
    });

    collector.on('collect', async (i) => {
      // Determine if we have the correct user
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name, 
              content: COMMAND.CONSTANTS.WRONG_USER_ERR, 
              client: discordClient.client
            })
          ],
          ephemeral: true
        });
        return;
      }

      tries++;

      let songName = i.fields.getTextInputValue('musicquiz').trim();
      console.log(`User answered: ${songName}`);

      // Check if the song name matches the correct answer
      if (songName.toLowerCase() === musicData[songId].toLowerCase()) {
        // User has answered correctly, we can end the quiz
        await i.reply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: {
                type: COMMAND.CONSTANTS.QUESTION_RIGHT_TYPE,
                message: `Correct! The song was: \`${musicData[songId]}\` \n\n` +
                `You answered the question in ${tries} tries!`
              },
              client: discordClient.client
            })
          ],
          components: [],
          files: [],
          ephemeral: true
        });
        collector.stop();
        return;
      } else if (tries >= maxTries) {
        await i.reply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: {
                type: COMMAND.CONSTANTS.QUESTION_WRONG_TYPE,
                message: `You've ran out of tries, the song was: \`${musicData[songId]}`
              },
              client: discordClient.client
            })
          ],
          components: [],
          files: [],
          ephemeral: true
        });
        collector.stop();
        return;
      } else {
        // User has not answered correctly, we can continue

        let newTrim = await trimSong(assetName, diffLength[tries]);
        trimmedSongs.push(newTrim);

        fields = await getAudioFields(trimmedSongs, diffLength, diffNames);
        files = await generateAudioFiles(trimmedSongs, diffLength, diffNames);

        await i.reply({
          embeds: [
            generateAudioEmbed({
              name: COMMAND.INFO.name,
              content: {
                type: COMMAND.CONSTANTS.QUESTION_WRONG_TYPE,
                message: `Incorrect! You have ${maxTries - tries} tries left.`
              },
              client: discordClient.client
            },
            fields)
          ],
          components: [questionSelect],
          files: files,
          ephemeral: true
        });
        return;
      }
    });

    collector.on('end', async (collected) => {
      if (tries < maxTries) {
        console.log(`Collected ${collected.size} items`);

        // If the user has not answered the question yet
        const content = {
          type: COMMAND.CONSTANTS.QUESTION_TIMEOUT_TYPE,
          message: COMMAND.CONSTANTS.QUESTION_TIMEOUT_MSG
        };

        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name, 
              content: content, 
              client: discordClient.client
            })
          ],
          components: []
        });
      }
    });
  }
};