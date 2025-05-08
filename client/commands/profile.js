/**
 * @fileoverview The main output when users call for the /profile command
 * Creates and returns an embed with all of the user's information available ingame
 * @author Potor10
 */

const { EmbedBuilder, AttachmentBuilder} = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const fs = require('fs');

const COMMAND = require('../command_data/profile');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed'); 
const binarySearch = require('../methods/binarySearch');
const calculateTeam = require('../methods/calculateTeam');
const sharp = require('sharp');
const Axios = require('axios');

async function downloadImage(url, filepath) {
  const response = await Axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 5000,
  });
  return new Promise((resolve, reject) => {
    response.data.pipe(fs.createWriteStream(filepath))
      .on('error', reject)
      .once('close', () => resolve(filepath));
  });
}

/**
 * @typedef {Object} PRSKImage
 * @property {String} normal the normal image
 * @property {String} trained the trained image
 */

/**
 * Gets image from cache or downloads it and saves to chache, then returns image
 * @returns {Promise<PRSKImage>}
 * @param {sharp} assetBundleName 
 * @param {sharp} rarity 
 */
async function getImage(assetBundleName, rarityType) {

  const folderLocation = './gacha/cached_full_images';

  let images = { 'normal': null, 'trained': null };
  try {
    if (fs.existsSync(`${folderLocation}/${assetBundleName}_normal.webp`)) {

      images.normal = sharp(`${folderLocation}/${assetBundleName}_normal.webp`);
  
    } else {
  
      let normalImage = `https://storage.sekai.best/sekai-jp-assets/character/member_cutout/${assetBundleName}/normal.webp`;
      await downloadImage(normalImage, `${folderLocation}/${assetBundleName}_normal.webp`);
      images.normal = sharp(`${folderLocation}/${assetBundleName}_normal.webp`);
    }
  } catch (error) {
    console.log(error);
    images.normal = sharp('./gacha/default_error_image.png');
  }
  

  if (rarityType == 'rarity_3' || rarityType == 'rarity_4') {

    try {
      if (fs.existsSync(`${folderLocation}/${assetBundleName}_after_training.webp`)) {
        images.trained = sharp(`${folderLocation}/${assetBundleName}_after_training.webp`);
      } else {
  
        let trainedImage = `https://storage.sekai.best/sekai-jp-assets/character/member_cutout/${assetBundleName}/after_training.webp`;
        await downloadImage(trainedImage, `${folderLocation}/${assetBundleName}_after_training.webp`);
        images.trained = sharp(`${folderLocation}/${assetBundleName}_after_training.webp`);
      }
    } catch (error) {
      console.log(error);
      images.trained = sharp('./gacha/default_error_image.png');
    }
    
  }

  return images;
}

async function overlayCard(image, rarityType, attributeType, mastery, level, trained) {
  const rarityStarsDic = {
    'rarity_1': 'rarity_star_normal',
    'rarity_2': 'rarity_star_normal',
    'rarity_3': 'rarity_star_normal',
    'rarity_4': 'rarity_star_normal',
    'rarity_birthday': 'rarity_birthday',
  };

  const framesDic = {
    'rarity_1': 'cardFrame_M_1',
    'rarity_2': 'cardFrame_M_2',
    'rarity_3': 'cardFrame_M_3',
    'rarity_4': 'cardFrame_M_4',
    'rarity_birthday': 'cardFrame_M_bd',
  };

  const numStarsDic = {
    'rarity_1': '1',
    'rarity_2': '2',
    'rarity_3': '3',
    'rarity_4': '4',
    'rarity_birthday': '1',
  };

  let rarityStars = trained ? rarityStarsDic[rarityType].replace('_normal', '_afterTraining') : rarityStarsDic[rarityType];

  const framePath = `./gacha/frames/${framesDic[rarityType]}.png`;
  const attributePath = `./gacha/attributes/icon_attribute_${attributeType}.png`;
  const rarityPath = `./gacha/rarity/${rarityStars}.png`;
  const masteryPath = `./gacha/mastery/masterRank_L_${mastery}.png`;

  const crop = await sharp('./gacha/frameblend.png')
    .resize(330, 520)
    .toBuffer();
  const levelBorder = await sharp('./gacha/levelBorder.png')
    .toBuffer();
  image = await image
    .resize({ width: 520, height: 520 , fit: 'fill' })
    .extract({ left: 80, top: 0, width: 330, height: 520 });
  let frame = await sharp(framePath)
    .resize(330, 520)
    .toBuffer();
  let attribute = await sharp(attributePath)
    .resize(58, 58)
    .toBuffer();
  let star = await sharp(rarityPath)
    .resize(52, 52)
    .toBuffer();
  let masteryImage = await sharp(masteryPath)
    .resize(95, 95)
    .toBuffer();

  let levelText = await sharp({
    text: {
      text: `<span color="#FFFFFF" background="#444466">Lv.${level}</span>`,
      font: 'Arial',
      fontfile: './gacha/Arial.ttf',
      width: 100, // max width
      height: 36, // max height
      rgba: true
    }
  })
    .toFormat('png')
    .toBuffer();
  let numStars = numStarsDic[rarityType];

  let composites = [
    { input: levelBorder, top: 460, left: 0 },
    { input: crop, blend: 'dest-in' },
    { input: frame, top: 0, left: 0 },
    { input: attribute, top: 8, left: 8 },
    { input: levelText, top: 470, left: 25 }
  ];

  for (let i = 0; i < numStars; i++) {
    composites.push({ input: star, top: 405, left: 20 + 52 * i });
  }

  if (mastery > 0) {
    composites.push({ input: masteryImage, top: 415, left: 225 });
  }

  let finalImage = await image.composite(composites);

  return finalImage;
}

async function overlayCards(cards) {
  let frame = sharp('./gacha/teamFrame.png');

  let composites = [];

  var row, col;

  for (let i = 0; i < cards.length; i++) {
    row = Math.floor(i / 5);
    col = i % 5;
    let card = cards[i];
    composites.push({ input: await card.toBuffer(), top: 55 + row * 175, left: 18 + 338 * col });
  }

  let finalImage = frame.composite(composites);

  return finalImage;
}

/**
 * Generates an embed for the profile of the player
 * @param {DiscordClient} client we are using to interact with disc
 * @param {String} userId the id of the user we are trying to access
 * @param {Object} data the player data returned from the API acess of the user in question
 * @param {boolean} private if the play has set their profile to private (private by default)
 * @return {MessageEmbed} the embed we will display to the user
 */
const generateProfileEmbed = async (discordClient, userId, data, private) => {
  const areas = JSON.parse(fs.readFileSync('./sekai_master/areas.json'));
  const areaItemLevels = JSON.parse(fs.readFileSync('./sekai_master/areaItemLevels.json'));
  const areaItems = JSON.parse(fs.readFileSync('./sekai_master/areaItems.json'));
  const gameCharacters = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json'));
  const cards = JSON.parse(fs.readFileSync('./sekai_master/cards.json'));

  const leaderCardId = data.userCards[0].cardId;
  let leader = {};
  
  for(const idx in data.userCards) {
    if (data.userCards[idx].cardId === leaderCardId) {
      leader = data.userCards[idx];
      break;
    }
  }

  const leaderCard = binarySearch(leaderCardId, 'id', cards);
  const teamData = calculateTeam(data, discordClient.getCurrentEvent().id);

  let leaderThumbURL = `https://storage.sekai.best/sekai-assets/thumbnail/chara/${leaderCard.assetbundleName}`;

  if (leader.defaultImage === 'special_training') {
    leaderThumbURL += '_after_training.webp';
  } else {
    leaderThumbURL += '_normal.webp';
  }

  const cardRarities = {
    'rarity_1': '🌟',
    'rarity_2': '🌟🌟',
    'rarity_3': '🌟🌟🌟',
    'rarity_4': '🌟🌟🌟🌟',
    'rarity_birthday': '🎀',
  };

  const specialTrainingPossible = [
    'rarity_3',
    'rarity_4',
  ];

  let cardImages = [];
  let teamText = [];

  // Generate Text For Profile's Teams

  let order = [
    data.userDeck.member1,
    data.userDeck.member2,
    data.userDeck.member3,
    data.userDeck.member4,
    data.userDeck.member5,
  ];


  for (const id of order) {
    const cardInfo = binarySearch(id, 'id', cards);
    const card = data.userCards.filter((c) => c.cardId === id)[0];
    const charInfo = gameCharacters[cardInfo.characterId-1];
    teamText += `${cardRarities[cardInfo.cardRarityType]}`;
    teamText += ' ';
    teamText += `__${cardInfo.prefix} ${charInfo.givenName} ${charInfo.firstName}__\n`;
    
    let cardData = teamData.cards.filter((c) => c.cardId === id)[0];
    teamText += '**Talent:**\n';
    teamText += `Base: \`${cardData.baseTalent.toLocaleString()}\`\n`;
    teamText += `Character Deco: \`${cardData.characterDecoTalent.toFixed(0).toLocaleString()}\`\n`;
    teamText += `Area Deco: \`${cardData.areaDecoTalent.toFixed(0).toLocaleString()}\`\n`;
    teamText += `Character Rank: \`${cardData.CRTalent.toFixed(0).toLocaleString()}\`\n`;
    teamText += `Total: \`${cardData.talent.toFixed(0).toLocaleString()}\`\n`;
    teamText += '\n';

    let image = await getImage(cardInfo.assetbundleName, cardInfo.cardRarityType);
    var imageOverlayed;

    if (specialTrainingPossible.includes(cardInfo.cardRarityType) || card.defaultImage != 'original') {
      imageOverlayed = await overlayCard(image.trained, cardInfo.cardRarityType, cardInfo.attr, card.masterRank, card.level, false);
    } else {
      imageOverlayed = await overlayCard(image.normal, cardInfo.cardRarityType, cardInfo.attr, card.masterRank, card.level, false);
    }

    cardImages.push(imageOverlayed);
  }

  let teamImage = await overlayCards(cardImages);
  let file = new AttachmentBuilder(await teamImage.toBuffer(), {name: 'team.png'});

  // Get Challenge Rank Data for all characters
  let challengeRankInfo = {};
  for (let i = 0; i < data.userChallengeLiveSoloStages.length; i++) {
    const currentChallengeRank = data.userChallengeLiveSoloStages[i];
    if (!(currentChallengeRank.characterId in challengeRankInfo)) {
      challengeRankInfo[currentChallengeRank.characterId] = currentChallengeRank.rank;
    } else {
      if (challengeRankInfo[currentChallengeRank.characterId] < currentChallengeRank.rank) {
        challengeRankInfo[currentChallengeRank.characterId] = currentChallengeRank.rank;
      }
    }
  }

  // Generate Text For Profile's Character Ranks

  let nameTitle = 'Name';
  let crTitle = 'CR';
  let chlgTitle = 'CHLG';

  let maxNameLength = nameTitle.length;
  let maxCRLength = crTitle.length;
  let maxCHLGLength = chlgTitle.length;

  // Get Max Lengths for each column
  data.userCharacters.forEach((char) => {
    const charInfo = gameCharacters[char.characterId-1];
    let charName = charInfo.givenName;
    if (charInfo.firstName) {
      charName += ` ${charInfo.firstName}`;
    }
    let rankText = `${char.characterRank}`;

    let chlgText = '0';
    if (char.characterId in challengeRankInfo) {
      chlgText = `${challengeRankInfo[char.characterId]}`;
    }

    if (maxNameLength < charName.length) {
      maxNameLength = charName.length;
    }

    if (maxCRLength < rankText.length) {
      maxCRLength = rankText.length;
    }
    
    if (maxCHLGLength < chlgText.length) {
      maxCHLGLength = chlgText.length;
    }
  });

  // Set column headers
  nameTitle = nameTitle + ' '.repeat(maxNameLength-nameTitle.length);
  crTitle = ' '.repeat(maxCRLength - crTitle.length) + crTitle;
  chlgTitle = ' '.repeat(maxCHLGLength - chlgTitle.length) + chlgTitle;

  let challengeRankText = `\`${nameTitle} ${crTitle} ${chlgTitle}\`\n`;


  // Add each character's rank and Challenge show to the text
  data.userCharacters.forEach((char) => {
    const charInfo = gameCharacters[char.characterId -1];

    let charName = charInfo.givenName;
    if (charInfo.firstName) {
      charName += ` ${charInfo.firstName}`;
    }
    let rankText = `${char.characterRank}`;
    let chlgText = '0';
    if (char.characterId in challengeRankInfo) {
      chlgText = `${challengeRankInfo[char.characterId]}`;
    }
    charName += ' '.repeat(maxNameLength-charName.length);
    rankText = ' '.repeat(maxCRLength-rankText.length) + rankText;
    chlgText = ' '.repeat(maxCHLGLength-chlgText.length) + chlgText;

    challengeRankText += `\`\`${charName} ${rankText} ${chlgText}\`\`\n`;
  });

  // Create the Embed for the profile using the pregenerated values
  const profileEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${data.user.name}'s Profile Nyaa~d`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now()/1000)}:R>`)
    .setAuthor({ 
      name: `${data.user.name}`, 
      iconURL: `${leaderThumbURL}` 
    })
    .setThumbnail(leaderThumbURL)
    .addFields(
      { name: 'Name', value: `${data.user.name}`, inline: true },
      { name: 'Rank', value: `${data.user.rank}`, inline: true },
      { name: 'Warning', value: 'Due to API changes, estimated individual card talent assumes both side stories read and level 15 area items', inline: true },
      { name: 'Cards', value: `${teamText}` },
      { name: 'Talent', value: `${data.totalPower.totalPower}`, inline: true },
      { name: 'Estimated Event Bonus', value: `${teamData.eventBonusText}`, inline: true },
      { name: 'Description', value: `${data.userProfile.word}\u200b` },
      { name: 'Twitter', value: `@${data.userProfile.twitterId}\u200b` },
      { name: 'Character & Challenge Ranks', value: `${challengeRankText}\u200b` },
    )
    .setImage('attachment://team.png')
    .setTimestamp()
    .setFooter({text: FOOTER, iconURL: discordClient.client.user.displayAvatarURL()});
  
  return {'embed': profileEmbed, 'file': file}; 
};

/**
 * Makes a request to Project Sekai to obtain the information of the player
 * @param {Interaction} interaction class provided via discord.js
 * @param {DiscordClient} client we are using to interact with disc
 * @param {Integer} userId the id of the user we are trying to access
 */
const getProfile = async (interaction, discordClient, userId) => {
  if (!discordClient.checkRateLimit(interaction.user.id)) {
    await interaction.editReply({
      embeds: [generateEmbed({
        name: COMMAND.INFO.name,
        content: { 
          type: COMMAND.CONSTANTS.RATE_LIMIT_ERR.type, 
          message: COMMAND.CONSTANTS.RATE_LIMIT_ERR.message + 
            `\n\nExpires: <t:${Math.floor(discordClient.getRateLimitRemoval(interaction.user.id) / 1000)}>`
        },
        client: discordClient.client
      })]
    });
    return;
  }

  if (isNaN(userId)) {
    await interaction.editReply({
      embeds: [generateEmbed({
        name: COMMAND.INFO.name,
        content: COMMAND.CONSTANTS.BAD_ID_ERR,
        client: discordClient.client
      })]
    });
    return;
  }

  discordClient.addSekaiRequest('profile', {
    userId: userId
  }, async (response) => {
    let private = true;
    const user = discordClient.db.prepare('SELECT * FROM users WHERE sekai_id=@sekaiId').all({
      sekaiId: userId
    });

    const profileEmbed = await generateProfileEmbed(discordClient, userId, response, private);
    await interaction.editReply({
      embeds: [profileEmbed.embed],
      files: [profileEmbed.file]
    });
  }, async (err) => {
    // Log the error
    discordClient.logger.log({
      level: 'error',
      timestamp: Date.now(),
      message: err.toString()
    });

    if (err.getCode() === 404) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name, 
            content: COMMAND.CONSTANTS.BAD_ACC_ERR, 
            client: discordClient.client
          })
        ]
      });
    } else {
      await interaction.editReply({
        embeds: [generateEmbed({
          name: COMMAND.INFO.name,
          content: { type: 'error', message: err.toString() },
          client: discordClient.client
        })]
      });
    }
  });
};

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    let accountId = '';
    let self = false;
    var userid;

    if (interaction.options.getSubcommand() === 'self') {
      userid = interaction.user.id;
      self = true;
    }
    else {
      userid = interaction.options.getMember('user')?.id;
      accountId = interaction.options.getString('id');
    }

    if (userid) {
      const user = discordClient.db.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
        discordId: userid
      });

      if (!user.length) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name, 
              content: COMMAND.CONSTANTS.NO_ACC_ERR, 
              client: discordClient.client
            })
          ]
        });
        return;
      }

      if (user[0].private && !self) {
          await interaction.editReply({
            embeds: [
              generateEmbed({
                name: COMMAND.INFO.name,
                content: COMMAND.CONSTANTS.PRIVATE,
                client: discordClient.client
              })
            ]
          });
          return;
      }
      accountId = user[0].sekai_id;
    }

    if (!accountId || isNaN(accountId)) {
      // Do something because there is an empty account id input
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name, 
            content: COMMAND.CONSTANTS.BAD_ID_ERR, 
            client: discordClient.client
          })
        ]
      });
      return;
    }

    getProfile(interaction, discordClient, accountId);
  }
};