// client/commands/pray.ts
/**
 * @fileoverview Allows you to pray to Kohane
 * @author Ai0796
 */

import * as COMMAND from '../command_data/pray'; // Assuming command_data/pray.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import DiscordClient from '../client/client'; // Assuming default export
import { CommandInteraction, Message } from 'discord.js'; // Import CommandInteraction and Message

const getTimeTrunc = async (): Promise<number> => {
    const date = new Date();
    date.setMinutes(0, 0, 0); // Truncate to the nearest hour
    return date.getTime();
};

function randn_bm(): number {
    return Math.random(); // Original code simply returns Math.random()
}

const HOUR = 3600000; // Milliseconds in an hour

const badPrays = [
    'You pray to {}, but she doesn\'t respond. You feel like you\'ve been ignored. You lose one luck',
    'You pray to {}, but it was actually Akito. You lose one luck.',
    'You pray to {}, but she knows you ship ak*koha. You lose one luck.',
    'You pray to {}, but passed a hamster without patting it first. You lose one luck.',
    'You pray to {}, but she\'s too busy playing with her snake. You lose one luck.',
    'You pray to {}, but you should be sleeping. You lose one luck.',
    'You pray to {}, but spent all your crystals on the evillous banner. You lose one luck.',
];

const goodPrays = [
    'You pray to {} and Pope Lemo. You gain 20 luck.',
    'You pray to {} after patting a hamster. You gain 20 luck.',
    'You pray to {}, but it was actually An. You gain 20 luck.',
    'You pray to {} and sacrifice a peach bun. You gain 20 luck.',
    'You pray to {} after a healthy tiering session. You gain 20 luck.',
    'You pray to {} after filling for Lemo. You gain 20 luck.',
    'You pray to {}, but it was actually Toya. You gain 20 luck.',
    'You pray to {}, but it was actually Kanade. Mack is jealous. You gain 20 luck.',
    'You pray to {}, but it was actually Kaito. You gain 20 luck',
    'You pray to {}, but it was actually Luka. Ai0 wants to know your location. You gain 20 luck.',
    'You pray to {}, but it was actually Miku. You gain 20 luck and a min roll.',
    'You pray to {}, but it was actually Ichika. You gain 20 luck',
    'You pray to {}, but it was actually Minorin. You gain 20 luck',
    'You pray to {}, but it was actually Haruka. You gain 20 luck',
    '你向小羽祈祷。你获得 20 点幸运',
    'こはねに祈る。幸運を20得る'
];

const Ai0Prays = [
    'You pray to Pocket and Ai0. You gain 80 luck.',
    'You pray to Washii and Ai0. You gain 80 luck.'
];

// Extend String prototype with format method
declare global {
    interface String {
        format(...args: any[]): string;
    }
}

// Add format method to String.prototype if it doesn't exist
if (!String.prototype.format) {
    String.prototype.format = function (this: string, ...args: any[]): string {
        let i = 0;
        return this.replace(/{}/g, function () {
            return typeof args[i] !== 'undefined' ? args[i++] : '';
        });
    };
}

interface PrayerData {
    id: string;
    luck: number;
    prays: number;
    lastTimestamp: number;
    totalLuck: number;
}

async function updatePrays(data: PrayerData, discordClient: DiscordClient, id: string): Promise<void> {
    discordClient.prayerdb?.prepare('UPDATE prayers SET ' +
        'luck=@luck, prays=@prays, lastTimestamp=@lastTimestamp, totalLuck = @totalLuck ' +
        'WHERE id=@id').run(
            {
                'id': id,
                'luck': data.luck,
                'prays': data.prays,
                'lastTimestamp': data.lastTimestamp,
                'totalLuck': data.totalLuck
            }
        );
}

async function insertPrays(data: PrayerData, discordClient: DiscordClient): Promise<void> {
    discordClient.prayerdb?.prepare('INSERT INTO prayers' +
        '(id, luck, prays, lastTimestamp, totalLuck)' +
        'VALUES (@id, @luck, @prays, @lastTimestamp, @totalLuck);').run(data);
}

async function getReturnQuote(): Promise<{ val: number; returnQuote: string }> {
    let val = randn_bm();
    let returnQuote: string;
    val *= 15;

    val = Math.round(val);

    if (val >= 14) {
        if (randn_bm() > 0.95) {
            val = 75;
            returnQuote = 'You pray to Mochi and Ai0. You gain 75 luck.';
        } else if (randn_bm() > 0.80) {
            val = 80;
            returnQuote = Ai0Prays[Math.floor(Math.random() * Ai0Prays.length)];
        }
        else {
            val = 50;
            returnQuote = 'You pray to Kohane, but she was on a double date An, Haruka and Minori. You gain 50 luck.';
        }

    } else if (val === 0) {
        if (randn_bm() > 0.8) {
            val = -50;
            returnQuote = 'You pray to {}, but it\'s actually Akito fifthwheeling An, Kohane, Haruka, and Minori. You lose 50 luck.';
        } else {
            val = 30;
            returnQuote = 'You pray to {}, but it\'s actually Akito and Toya on a date. you gain 30 luck.';
        }

    }
    else if (val <= 2) {
        val = -1;

        returnQuote = badPrays[Math.floor(Math.random() * badPrays.length)];
    } else if (val >= 10) {
        val = 20;
        returnQuote = goodPrays[Math.floor(Math.random() * goodPrays.length)];
    } else {
        returnQuote = `You pray to {}. You gain ${val} luck.`;
    }

    return { 'val': val, 'returnQuote': returnQuote };
}

/**
 *
 * @param {string} userId
 * @param {string} character
 * @param {DiscordClient} discordClient
 * @returns {string} Pray quote
 */
async function getPray(userId: string, character: string, discordClient: DiscordClient): Promise<string> {
    let returnQuote: string;
    let data: PrayerData | undefined; // Use undefined for initial data

    try {
        const result = discordClient.prayerdb?.prepare('SELECT * FROM prayers ' +
            'WHERE (id=@id)').all({
                id: userId
            }) as PrayerData[] | undefined; // Type assertion for DB result

        if (result && result.length > 0) {
            data = result[0];
        } else {
            const quote = await getReturnQuote();
            data = { 'id': userId, 'luck': quote.val, 'totalLuck': Math.max(0, quote.val), 'lastTimestamp': Date.now(), 'prays': 1 };
            insertPrays(data, discordClient);
            returnQuote = quote.returnQuote; // Set returnQuote for initial pray
        }

        const time = await getTimeTrunc();

        if (data.lastTimestamp < time) {
            const quote = await getReturnQuote();
            data.luck += quote.val;
            data.totalLuck += Math.max(0, quote.val);
            data.lastTimestamp = Date.now();
            data.prays++;
            returnQuote = quote.returnQuote;
        }
        else if (data.lastTimestamp >= time) { // Changed to >= to include current hour prays if already done
            returnQuote = `You have already prayed to {} this hour, you may pray again <t:${Math.floor((time + HOUR) / 1000)}:R>!`;
        } else {
            returnQuote = 'Random error occured while praying';
        }
    } catch (e: any) { // Type as any for error
        console.error('Error occurred while writing prayers:', e); // Changed to console.error
        returnQuote = 'An error occurred while processing your prayer.'; // Default error message
    }

    if (data) { // Only update if data is defined
        await updatePrays(data, discordClient, userId);
        returnQuote += ` You have ${Math.floor(data.luck)} luck (${Math.floor(data.totalLuck)} over lifetime) and have prayed ${data.prays} times.`;
    }

    // Discord limits message to 2000 characters so limit it if gets past that
    if (returnQuote.length + character.length > 2000) {
        character = character.slice(0, Math.max(0, 2000 - returnQuote.length - character.length)); // Ensure slice length is non-negative
    }
    return returnQuote.format(character);
}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        try {
            const id = interaction.user.id.toString();
            const character = interaction.options.getString('character') || 'Kohane';
            const pray = await getPray(id, character, discordClient);

            await interaction.reply(pray);
        } catch (e: any) { // Type as any for error
            console.error('Error executing pray command:', e); // Changed to console.error
            await interaction.reply('An unexpected error occurred during your prayer.');
        }
    },

    async executeMessage(message: Message, discordClient: DiscordClient) { // Explicitly type message
        try {
            const id = message.author.id.toString();
            let character: string = message.content.split(' ').slice(1).join(' ').trim();
            if (!character) {
                character = 'Kohane'; // Default if no character is specified
            }
            const pray = await getPray(id, character, discordClient);

            await message.channel.send(pray);
        } catch (e: any) { // Type as any for error
            console.error('Error executing pray message command:', e); // Changed to console.error
            await message.channel.send('An unexpected error occurred during your prayer.');
        }
    }
};