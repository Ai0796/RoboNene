// client/commands/profile.ts
/**
 * @fileoverview The main output when users call for the /profile command
 * Creates and returns an embed with all of the user's information available ingame
 * @author Potor10
 */

import { EmbedBuilder, AttachmentBuilder, CommandInteraction, GuildMember } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';
import * as fs from 'fs';

import * as COMMAND from '../command_data/profile'; // Assuming command_data/profile.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import binarySearch from '../methods/binarySearch'; // Assuming binarySearch.ts is converted
import calculateTeam, { CalculatedCard, CalculatedTeam } from '../methods/calculateTeam'; // Assuming calculateTeam.ts is converted
import sharp from 'sharp'; // Import sharp
import Axios from 'axios'; // Import Axios
import DiscordClient from '../client/client'; // Assuming default export

interface SekaiProfileResponse {
  user: {
    name: string;
    rank: number;
  };
  userProfile: {
    word: string; // Profile comment
    twitterId: string;
  };
  userCards: Array<{
    cardId: number;
    level: number;
    specialTrainingStatus: string;
    masterRank: number;
    defaultImage: string;
  }>;
  userDeck: {
    member1: number;
    member2: number;
    member3: number;
    member4: number;
    member5: number;
  };
  userChallengeLiveSoloStages: Array<{
    characterId: number;
    rank: number;
  }>;
  userCharacters: Array<{
    characterId: number;
    characterRank: number;
  }>;
  totalPower: {
    totalPower: number;
  };
}

interface CardData {
  id: number;
  attr: string;
  cardRarityType: string;
  assetbundleName: string;
  prefix: string;
  characterId: number;
}

interface GameCharacter {
  id: number;
  givenName: string;
  firstName: string;
}

async function downloadImage(url: string, filepath: string): Promise<string> {
  const response = await Axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 5000,
  });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    writer.on('error', (err) => {
      console.error(`Error writing file ${filepath}:`, err);
      reject(err);
    });
    writer.on('finish', () => resolve(filepath));
    writer.on('pipe', () => { // Catch pipe errors
      response.data.on('error', (err: any) => {
        console.error(`Error in response stream for ${url}:`, err);
        writer.close(); // Close the writer on response stream error
        reject(err);
      });
    });
  });
}

/**
 * @typedef {Object} PRSKImage
 * @property {sharp.Sharp} normal the normal image
 * @property {sharp.Sharp | null} trained the trained image
 */

/**
 * Gets image from cache or downloads it and saves to cache, then returns image
 * @returns {Promise<{ normal: sharp.Sharp, trained: sharp.Sharp | null }>}
 * @param {string} assetBundleName
 * @param {string} rarityType
 */
async function getImage(assetBundleName: string, rarityType: string): Promise<{ normal: sharp.Sharp, trained: sharp.Sharp | null }> {
  const folderLocation = './gacha/cached_full_images';
  if (!fs.existsSync(folderLocation)) {
    fs.mkdirSync(folderLocation, { recursive: true });
  }

  const images: { normal: sharp.Sharp | null; trained: sharp.Sharp | null } = { 'normal': null, 'trained': null };
  const defaultErrorImage = sharp('./gacha/default_error_image.png');

  try {
    const normalPath = `${folderLocation}/${assetBundleName}_normal.webp`;
    if (fs.existsSync(normalPath)) {
      images.normal = sharp(normalPath);
    } else {
      const normalImageURL = `https://storage.sekai.best/sekai-jp-assets/character/member_cutout/${assetBundleName}/normal.webp`;
      await downloadImage(normalImageURL, normalPath);
      images.normal = sharp(normalPath);
    }
  } catch (error) {
    console.error(`Error getting normal image for ${assetBundleName}:`, error);
    images.normal = defaultErrorImage;
  }

  if (rarityType === 'rarity_3' || rarityType === 'rarity_4') {
    try {
      const trainedPath = `${folderLocation}/${assetBundleName}_after_training.webp`;
      if (fs.existsSync(trainedPath)) {
        images.trained = sharp(trainedPath);
      } else {
        const trainedImageURL = `https://storage.sekai.best/sekai-jp-assets/character/member_cutout/${assetBundleName}/after_training.webp`;
        await downloadImage(trainedImageURL, trainedPath);
        images.trained = sharp(trainedPath);
      }
    } catch (error) {
      console.error(`Error getting trained image for ${assetBundleName}:`, error);
      images.trained = defaultErrorImage;
    }
  }

  // Ensure normal image is always a sharp instance, even if it failed before
  if (!images.normal) {
      images.normal = defaultErrorImage;
  }

  return images as { normal: sharp.Sharp, trained: sharp.Sharp | null }; // Assert return type
}


async function overlayCard(image: sharp.Sharp, rarityType: string, attributeType: string, mastery: number, level: number, trained: boolean): Promise<sharp.Sharp> {
  const rarityStarsDic: { [key: string]: string } = {
    'rarity_1': 'rarity_star_normal',
    'rarity_2': 'rarity_star_normal',
    'rarity_3': 'rarity_star_normal',
    'rarity_4': 'rarity_star_normal',
    'rarity_birthday': 'rarity_birthday',
  };

  const framesDic: { [key: string]: string } = {
    'rarity_1': 'cardFrame_M_1',
    'rarity_2': 'cardFrame_M_2',
    'rarity_3': 'cardFrame_M_3',
    'rarity_4': 'cardFrame_M_4',
    'rarity_birthday': 'cardFrame_M_bd',
  };

  const numStarsDic: { [key: string]: string } = {
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
  image = image
    .resize({ width: 520, height: 520, fit: 'fill' })
    .extract({ left: 80, top: 0, width: 330, height: 520 }); // Chain extract after resize
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

  // Ensure Arial.ttf is accessible or use a system font if available
  const levelTextSvg = `<svg width="100" height="36">
                          <rect x="0" y="0" width="100%" height="100%" fill="#444466" rx="5" ry="5"/>
                          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="20" fill="white">Lv.${level}</text>
                        </svg>`;
  let levelText = await sharp(Buffer.from(levelTextSvg))
    .toFormat('png')
    .toBuffer();

  const numStars = parseInt(numStarsDic[rarityType]);

  const composites: sharp.OverlayOptions[] = [
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

async function overlayCards(cards: sharp.Sharp[]): Promise<sharp.Sharp> {
  let frame = sharp('./gacha/teamFrame.png');

  let composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < cards.length; i++) {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const card = cards[i]; // card is already a sharp instance
    composites.push({ input: await card.toBuffer(), top: 55 + row * 175, left: 18 + 338 * col });
  }

  let finalImage = frame.composite(composites);

  return finalImage;
}

/**
 * Generates an embed for the profile of the player
 * @param {DiscordClient} discordClient the client we are using to interact with disc
 * @param {string} userId the id of the user we are trying to access (Sekai ID)
 * @param {SekaiProfileResponse} data the player data returned from the API acess of the user in question
 * @param {boolean} isPrivate if the play has set their profile to private (private by default)
 * @return {{ embed: EmbedBuilder, file: AttachmentBuilder }} the embed we will display to the user and the image file
 */
const generateProfileEmbed = async (discordClient: DiscordClient, userId: string, data: SekaiProfileResponse, isPrivate: boolean): Promise<{ embed: EmbedBuilder, file: AttachmentBuilder }> => {
  const cardsJson: CardData[] = JSON.parse(fs.readFileSync('./sekai_master/cards.json', 'utf8')) as CardData[];
  const gameCharactersJson: GameCharacter[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')) as GameCharacter[];

  const leaderCardId = data.userCards[0].cardId;
  let leader: { cardId: number; level: number; specialTrainingStatus: string; masterRank: number; defaultImage: string } | undefined;

  for (const card of data.userCards) {
    if (card.cardId === leaderCardId) {
      leader = card;
      break;
    }
  }

  if (!leader) {
    throw new Error('Leader card not found in user cards.');
  }

  const leaderCard = binarySearch<CardData>(leaderCardId, 'id', cardsJson);
  if (!leaderCard) {
    throw new Error('Leader card data not found.');
  }

  const teamData = calculateTeam(data, discordClient.getCurrentEvent().id);

  let leaderThumbURL = `https://storage.sekai.best/sekai-assets/thumbnail/chara/${leaderCard.assetbundleName}`;

  if (leader.defaultImage === 'special_training') {
    leaderThumbURL += '_after_training.webp';
  } else {
    leaderThumbURL += '_normal.webp';
  }

  const cardRarities: { [key: string]: string } = {
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

  const cardImages: sharp.Sharp[] = [];
  let teamText: string = '';

  // Generate Text For Profile's Teams
  const order = [
    data.userDeck.member1,
    data.userDeck.member2,
    data.userDeck.member3,
    data.userDeck.member4,
    data.userDeck.member5,
  ];

  for (const id of order) {
    const cardInfo = binarySearch<CardData>(id, 'id', cardsJson);
    const userCard = data.userCards.filter((c) => c.cardId === id)[0];
    if (!cardInfo || !userCard) continue;

    const charInfo = gameCharactersJson[cardInfo.characterId - 1]; // Assuming characterId is 1-indexed for array access
    if (!charInfo) continue;

    teamText += `${cardRarities[cardInfo.cardRarityType]}`;
    teamText += ' ';
    teamText += `__${cardInfo.prefix} ${charInfo.givenName} ${charInfo.firstName}__\n`;

    const cardDataForTeam = teamData.cards.find((c) => c.cardId === id);
    if (cardDataForTeam) {
      teamText += '**Talent:**\n';
      teamText += `Base: \`${cardDataForTeam.baseTalent.toLocaleString()}\`\n`;
      teamText += `Character Deco: \`${cardDataForTeam.characterDecoTalent.toFixed(0).toLocaleString()}\`\n`;
      teamText += `Area Deco: \`${cardDataForTeam.areaDecoTalent.toFixed(0).toLocaleString()}\`\n`;
      teamText += `Character Rank: \`${cardDataForTeam.CRTalent.toFixed(0).toLocaleString()}\`\n`;
      teamText += `Total: \`${cardDataForTeam.talent.toFixed(0).toLocaleString()}\`\n`;
      teamText += '\n';
    }

    const image = await getImage(cardInfo.assetbundleName, cardInfo.cardRarityType);
    let imageOverlayed: sharp.Sharp;

    if (specialTrainingPossible.includes(cardInfo.cardRarityType) && userCard.defaultImage === 'special_training') {
      imageOverlayed = await overlayCard(image.trained || image.normal, cardInfo.cardRarityType, cardInfo.attr, userCard.masterRank, userCard.level, true); // Use trained if available
    } else {
      imageOverlayed = await overlayCard(image.normal, cardInfo.cardRarityType, cardInfo.attr, userCard.masterRank, userCard.level, false);
    }
    cardImages.push(imageOverlayed);
  }

  const teamImage = await overlayCards(cardImages);
  const file = new AttachmentBuilder(await teamImage.toBuffer(), { name: 'team.png' });

  // Get Challenge Rank Data for all characters
  const challengeRankInfo: { [characterId: number]: number } = {};
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
    const charInfo = gameCharactersJson[char.characterId - 1]; // Assuming characterId is 1-indexed
    if (!charInfo) return;
    let charName = charInfo.givenName;
    if (charInfo.firstName) {
      charName += ` ${charInfo.firstName}`;
    }
    const rankText = `${char.characterRank}`;

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
  nameTitle = nameTitle + ' '.repeat(maxNameLength - nameTitle.length);
  crTitle = ' '.repeat(maxCRLength - crTitle.length) + crTitle;
  chlgTitle = ' '.repeat(maxCHLGLength - chlgTitle.length) + chlgTitle;

  let challengeRankText = `\`${nameTitle} ${crTitle} ${chlgTitle}\`\n`;


  // Add each character's rank and Challenge show to the text
  data.userCharacters.forEach((char) => {
    const charInfo = gameCharactersJson[char.characterId - 1]; // Assuming characterId is 1-indexed
    if (!charInfo) return;

    let charName = charInfo.givenName;
    if (charInfo.firstName) {
      charName += ` ${charInfo.firstName}`;
    }
    const rankText = `${char.characterRank}`;
    let chlgText = '0';
    if (char.characterId in challengeRankInfo) {
      chlgText = `${challengeRankInfo[char.characterId]}`;
    }
    charName += ' '.repeat(Math.max(0, maxNameLength - charName.length)); // Ensure non-negative repeat count
    rankText = ' '.repeat(Math.max(0, maxCRLength - rankText.length)) + rankText;
    chlgText = ' '.repeat(Math.max(0, maxCHLGLength - chlgText.length)) + chlgText;

    challengeRankText += `\`\`${charName} ${rankText} ${chlgText}\`\`\n`;
  });

  // Create the Embed for the profile using the pregenerated values
  const profileEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${data.user.name}'s Profile Nyaa~d`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setAuthor({
      name: `${data.user.name}`,
      iconURL: `${leaderThumbURL}`
    })
    .setThumbnail(leaderThumbURL)
    .addFields(
      { name: 'Name', value: `${data.user.name}`, inline: true },
      { name: 'Rank', value: `${data.user.rank}`, inline: true },
      { name: 'Warning', value: 'Due to API changes, estimated individual card talent assumes both side stories read and level 15 area items', inline: false }, // Changed to inline: false for better readability as it's a long warning
      { name: 'Cards', value: `${teamText}` },
      { name: 'Talent', value: `${data.totalPower.totalPower}`, inline: true },
      { name: 'Estimated Event Bonus', value: `${teamData.eventBonusText}`, inline: true },
      { name: 'Description', value: `${data.userProfile.word || 'N/A'}\u200b` }, // Handle empty description
      { name: 'Twitter', value: `@${data.userProfile.twitterId || 'N/A'}\u200b` }, // Handle empty twitterId
      { name: 'Character & Challenge Ranks', value: `${challengeRankText}\u200b` },
    )
    .setImage('attachment://team.png')
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user?.displayAvatarURL() || '' }); // Optional chaining for user

  return { 'embed': profileEmbed, 'file': file };
};

/**
 * Makes a request to Project Sekai to obtain the information of the player
 * @param {CommandInteraction} interaction class provided via discord.js
 * @param {DiscordClient} client we are using to interact with disc
 * @param {string} userId the id of the user we are trying to access (Sekai ID)
 */
const getProfile = async (interaction: CommandInteraction, discordClient: DiscordClient, userId: string): Promise<void> => {
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

  if (isNaN(Number(userId))) { // Use Number() to safely check if it's a number string
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
  }, async (response: SekaiProfileResponse) => { // Type response explicitly
    const userDbEntry = discordClient.db?.prepare('SELECT * FROM users WHERE sekai_id=@sekaiId').all({
      sekaiId: userId
    }) as { private: number }[] | undefined; // Type assertion

    const isPrivate = userDbEntry && userDbEntry.length > 0 && userDbEntry[0].private === 1;

    const profileResult = await generateProfileEmbed(discordClient, userId, response, isPrivate);
    await interaction.editReply({
      embeds: [profileResult.embed],
      files: [profileResult.file]
    });
  }, async (err: any) => { // Type err as any
    // Log the error
    discordClient.logger?.log({
      level: 'error',
      timestamp: Date.now(),
      message: err.toString()
    });

    if (err.getCode && err.getCode() === 404) {
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

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    let accountId = '';
    let self = false;
    let targetDiscordId: string | undefined; // Using targetDiscordId to store the Discord ID to query from DB

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'self') {
      targetDiscordId = interaction.user.id;
      self = true;
    }
    else if (subcommand === 'user') {
      const userOption = interaction.options.getMember('user');
      if (userOption instanceof GuildMember) { // Ensure it's a GuildMember before getting ID
        targetDiscordId = userOption.id;
      }
    }
    else if (subcommand === 'id') {
      accountId = interaction.options.getString('id') || ''; // Get the ID string directly
    }

    if (targetDiscordId) {
      const userDbEntry = discordClient.db?.prepare('SELECT * FROM users WHERE discord_id=@discordId').all({
        discordId: targetDiscordId
      }) as { sekai_id: string; private: number }[] | undefined; // Type assertion

      if (!userDbEntry || userDbEntry.length === 0) {
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

      if (userDbEntry[0].private === 1 && !self) { // Check if private and not self-query
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
      accountId = userDbEntry[0].sekai_id;
    }

    // If accountId is still empty or not a valid number string
    if (!accountId || isNaN(Number(accountId))) {
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