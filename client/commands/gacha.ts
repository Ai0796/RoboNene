// client/commands/gacha.ts
/**
 * @fileoverview Allows you to gacha
 * @author Ai0796
 */

import { CommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js'; // Import necessary types
import * as COMMAND from '../command_data/gacha'; // Import all exports from gacha
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import * as fs from 'fs';
import Axios from 'axios'; // Import Axios directly
import sharp from 'sharp'; // Import sharp directly
import DiscordClient from '../client/client'; // Assuming default export


interface CardData {
    id: number;
    attr: string;
    assetbundleName: string;
    cardRarityType: string;
}

interface GameCharacter {
    id: number;
    givenName: string;
    firstName: string;
}

/**
 * Generates an embed from the provided params
 * @param {string} name the name of the command
 * @param {string | undefined} image an image URL (if applicable)
 * @param {DiscordClient} client the client we are using to handle Discord requests
 * @return {EmbedBuilder} a generated embed
 */
const generateEmbed = ({ name, image, client }: { name: string; image?: string; client: DiscordClient['client'] }): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setColor(COMMAND.NENE_COLOR) // Assuming NENE_COLOR is in COMMAND.CONSTANTS
        .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
        .setTimestamp()
        .setFooter({ text: COMMAND.FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Assuming FOOTER is in COMMAND.CONSTANTS

    if (image) {
        embed.setImage(image);
    }

    return embed;
};

function randn_bm(): number {
    return Math.random();
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
        writer.on('error', (err: any) => { // Type as any for error
            writer.close();
            reject(err);
        });
        writer.on('close', () => resolve(filepath));
    });
}

/**
 * @typedef {Object} PRSKImage
 * @property {sharp.Sharp | null} normal the normal image
 * @property {sharp.Sharp | null} trained the trained image
 */
interface PRSKImage {
    normal: sharp.Sharp | null;
    trained: sharp.Sharp | null;
}

/**
 * Gets image from cache or downloads it and saves to cache, then returns image
 * @returns {Promise<PRSKImage>}
 * @param {string} assetBundleName
 * @param {string} rarityType
 */
async function getImage(assetBundleName: string, rarityType: string): Promise<PRSKImage> {
    const images: PRSKImage = { 'normal': null, 'trained': null };
    const cachedImagesDir = './gacha/cached_images';
    if (!fs.existsSync(cachedImagesDir)) {
        fs.mkdirSync(cachedImagesDir, { recursive: true });
    }

    try {
        const normalImagePath = `${cachedImagesDir}/${assetBundleName}_normal.png`;
        if (fs.existsSync(normalImagePath)) {
            images.normal = sharp(normalImagePath);
        } else {
            const normalImageURL = `https://storage.sekai.best/sekai-jp-assets/thumbnail/chara/${assetBundleName}_normal.webp`;
            await downloadImage(normalImageURL, normalImagePath);
            images.normal = sharp(normalImagePath);
        }
    } catch (error) {
        console.error(`Error processing normal image for ${assetBundleName}:`, error);
        images.normal = sharp('./gacha/default_error_image.png');
    }


    if (rarityType === 'rarity_3' || rarityType === 'rarity_4') {
        try {
            const trainedImagePath = `${cachedImagesDir}/${assetBundleName}_after_training.png`;
            if (fs.existsSync(trainedImagePath)) {
                images.trained = sharp(trainedImagePath);
            } else {
                const trainedImageURL = `https://storage.sekai.best/sekai-jp-assets/thumbnail/chara/${assetBundleName}_after_training.webp`;
                await downloadImage(trainedImageURL, trainedImagePath);
                images.trained = sharp(trainedImagePath);
            }
        } catch (error) {
            console.error(`Error processing trained image for ${assetBundleName}:`, error);
            images.trained = sharp('./gacha/default_error_image.png');
        }
    }
    return images;
}

async function overlayCard(image: sharp.Sharp, rarityType: string, attributeType: string): Promise<sharp.Sharp> {
    const rarityStarsDic: { [key: string]: string } = {
        'rarity_1': 'rarity_star_normal',
        'rarity_2': 'rarity_star_normal',
        'rarity_3': 'rarity_star_normal',
        'rarity_4': 'rarity_star_normal',
        'rarity_birthday': 'rarity_birthday',
    };

    const framesDic: { [key: string]: string } = {
        'rarity_1': 'cardFrame_S_1',
        'rarity_2': 'cardFrame_S_2',
        'rarity_3': 'cardFrame_S_3',
        'rarity_4': 'cardFrame_S_4',
        'rarity_birthday': 'cardFrame_S_bd',
    };

    const numStarsDic: { [key: string]: string } = {
        'rarity_1': '1',
        'rarity_2': '2',
        'rarity_3': '3',
        'rarity_4': '4',
        'rarity_birthday': '1',
    };

    const framePath = `./gacha/frames/${framesDic[rarityType]}.png`;
    const attributePath = `./gacha/attributes/icon_attribute_${attributeType}.png`;
    const rarityPath = `./gacha/rarity/${rarityStarsDic[rarityType]}.png`;

    const frame = sharp(framePath);

    const resizedImageBuffer = await image
        .resize(140, 140)
        .toBuffer();
    const attributeBuffer = await sharp(attributePath)
        .resize(35, 35)
        .toBuffer();
    const starBuffer = await sharp(rarityPath)
        .resize(28, 28)
        .toBuffer();
    const numStars = parseInt(numStarsDic[rarityType]);

    const composites: sharp.OverlayOptions[] = [
        { input: resizedImageBuffer, top: 8, left: 8 },
        { input: attributeBuffer, top: 1, left: 1 }
    ];

    for (let i = 0; i < numStars; i++) {
        composites.push({ input: starBuffer, top: 118, left: 10 + 26 * i });
    }

    const finalImage = frame.composite(composites);

    return finalImage;
}

async function overlayPulls(cards: sharp.Sharp[]): Promise<sharp.Sharp> {

    const frame = sharp('./gacha/pull_frame.png');

    const composites: sharp.OverlayOptions[] = [];

    let row, col;

    for (let i = 0; i < cards.length; i++) {
        row = Math.floor(i / 5);
        col = i % 5;
        const cardBuffer = await cards[i].toBuffer(); // Convert each Sharp object to buffer
        composites.push({ input: cardBuffer, top: 41 + row * 175, left: 41 + 175 * col });
    }

    const finalImage = frame.composite(composites);

    return finalImage;
}

async function getCards(n: number, embed: EmbedBuilder): Promise<AttachmentBuilder> {

    const cardRarities: { [key: string]: string } = {
        'rarity_1': '🌟',
        'rarity_2': '🌟🌟',
        'rarity_3': '🌟🌟🌟',
        'rarity_4': '🌟🌟🌟🌟',
        'rarity_birthday': '🎀',
    };

    const cards: CardData[] = JSON.parse(fs.readFileSync('./sekai_master/cards.json', 'utf8')) as CardData[];
    const gameCharacters: GameCharacter[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')) as GameCharacter[]; // Not used in this function, but in original

    const twoStars = cards.filter(card => card.cardRarityType === 'rarity_2');
    const threeStars = cards.filter(card => card.cardRarityType === 'rarity_3' || card.cardRarityType === 'rarity_birthday');
    const fourStars = cards.filter(card => card.cardRarityType === 'rarity_4');

    let no3Star = true; // Track if no 3-star or higher has been pulled
    const cardImages: sharp.Sharp[] = []; // Array to hold Sharp objects

    for (let i = 0; i < n; i++) {
        let randomCard: CardData;
        const randomVal = randn_bm();

        if (randomVal < 0.06) { // 6% for 4-star
            randomCard = fourStars[Math.floor(Math.random() * fourStars.length)];
            no3Star = false;
        } else if (randomVal < 0.145) { // 8.5% for 3-star (0.145 - 0.06)
            randomCard = threeStars[Math.floor(Math.random() * threeStars.length)];
            no3Star = false;
        } else { // Remaining for 2-star
            randomCard = twoStars[Math.floor(Math.random() * twoStars.length)];
        }

        // Guaranteed 3-star or higher on 10th pull if no 3-star+ yet
        if (i + 1 === n && no3Star && n >= 10) {
            if (randn_bm() < 0.06 / (0.06 + 0.085)) { // Proportional chance for 4-star vs 3-star
                randomCard = fourStars[Math.floor(Math.random() * fourStars.length)];
            } else {
                randomCard = threeStars[Math.floor(Math.random() * threeStars.length)];
            }
        }

        const assetBundleName = randomCard.assetbundleName;
        const attribute = randomCard.attr;
        const rarityType = randomCard.cardRarityType;

        const images = await getImage(assetBundleName, rarityType);

        // Always use the normal image for the overlay in gacha pulls, as it's a "pull" visualization
        // The `images.trained` is for profile display where it might show the trained version.
        if (images.normal) {
            const postImage = await overlayCard(images.normal, rarityType, attribute);
            cardImages.push(postImage);
        } else {
            console.error(`Could not get normal image for ${assetBundleName}, skipping.`);
            // Optionally push a placeholder error image here
            const errorImage = await overlayCard(sharp('./gacha/default_error_image.png'), 'rarity_1', 'cool'); // Placeholder
            cardImages.push(errorImage);
        }
    }

    const pullImage = await overlayPulls(cardImages);

    const file = new AttachmentBuilder(await pullImage.toBuffer(), { name: 'pull.png' });
    embed.setImage('attachment://pull.png');

    return file;
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Added types
        await interaction.deferReply({ ephemeral: false });
        try {
            const single = interaction.options.getBoolean('single') || false;

            const n = single ? 1 : 10;

            const embed = generateEmbed({ name: COMMAND.INFO.name, client: discordClient.client }); // Pass discordClient.client

            const file = await getCards(n, embed);

            await interaction.editReply({ embeds: [embed], files: [file] });
        } catch (e: any) { // Type as any for error
            console.error(e); // Changed to console.error
            await interaction.editReply('An unexpected error occurred during the gacha pull.');
        }
    }
};