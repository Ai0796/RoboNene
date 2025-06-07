// client/commands/games.ts
/**
 * @fileoverview Displays statistics of a user or tier
 * @author Ai0796
 */

import { CommandInteraction, EmbedBuilder, GuildMember } from 'discord.js'; // Import necessary types
import * as COMMAND from '../command_data/games'; // Import all exports from games
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import DiscordClient from '../client'; // Assuming default export
import { NENE_COLOR, FOOTER } from '../../constants';

const energyBoost = [
    1,
    5,
    10,
    15,
    19,
    23,
    26,
    29,
    31,
    33,
    35
];

interface EventData {
    id: number;
    banner: string;
    name: string;
    startAt: number;
    aggregateAt: number;
    closedAt: number;
    eventType: string;
    assetbundleName: string;
}

/**
 * Generates an embed from the provided params
 * @param {string} name the name of the command
 * @param {DiscordClient['client']} client the client we are using to handle Discord requests
 * @return {EmbedBuilder} a generated embed
 */
const generateBasicEmbed = ({ name, client }: { name: string; client: DiscordClient['client'] }): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setColor(NENE_COLOR) // Assuming NENE_COLOR is in COMMAND.CONSTANTS
        .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
        .setThumbnail(client.user?.displayAvatarURL() || '') // Optional chaining
        .setTimestamp()
        .setFooter({ text: FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Optional chaining

    return embed;
};

function generateEnergyTable(eventPoints: number): number[][] {
    return energyBoost.map(x => [x, x * eventPoints]); // Return both multiplier and points
}

function getEnergyPerGame(energyTable: number[][], eventPoints: number): number {
    let index = 0;
    energyTable.forEach((pointsEntry, i) => {
        // pointsEntry[1] is the calculated points for that multiplier
        if (Math.abs(eventPoints - pointsEntry[1]) < Math.abs(eventPoints - energyTable[index][1])) {
            index = i;
        }
    });

    return energyTable[index][0]; // Return the multiplier
}

async function sendEmbed(interaction: CommandInteraction, embed: EmbedBuilder): Promise<void> {
    await interaction.editReply({
        embeds: [embed]
    });
}

interface UserGamesData {
    rankings: any[]; // Assuming structure from SekaiAPI
    basePoints: number;
    name: string;
    ppg: number[]; // Points per game
}

async function sendData(data: UserGamesData, tier: number, eventId: number, eventData: EventData, discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {

    if (data.ppg.length > 0) {

        const user = data.name;
        const title = `T${tier} ${user} Energy Usage`;

        const pointTable = generateEnergyTable(data.basePoints);

        const energyCounts = new Array(energyBoost.length).fill(0);
        let totalEnergyUsed = 0;

        data.ppg.forEach((point) => {
            if (point >= 100) {
                const possibleEnergyCombos: number[][] = []; // Array of [multiplier, points]
                energyBoost.forEach((x, i) => {
                    if (point % x === 0) {
                        // Check if points per game is reasonable for this multiplier
                        if (point / x <= 4000) { // Assuming average points per game doesn't exceed 4000 for any energy
                            possibleEnergyCombos.push([i, pointTable[i][1]]); // Store [multiplier_index, theoretical_points]
                        }
                    }
                });

                if (possibleEnergyCombos.length > 0) {
                    const energyUsedGame = getEnergyPerGame(possibleEnergyCombos, point);
                    energyCounts[energyUsedGame]++;
                    totalEnergyUsed += energyUsedGame;
                }
            }
        });

        const embed = generateBasicEmbed({
            name: title,
            client: discordClient.client
        });

        const energyLabel = 'Cost';
        const gamesLabel = 'Games';

        let energyLength = energyLabel.length;
        let gamesLength = gamesLabel.length;

        for (let i = 0; i < energyBoost.length; i++) {
            if (`x${i}`.length > energyLength) {
                energyLength = `x${i}`.length;
            }
            if (`${energyCounts[i]}`.length > gamesLength) {
                gamesLength = `${energyCounts[i]}`.length;
            }
        }

        let embedStr = `\`${energyLabel} ${' '.repeat(energyLength - energyLabel.length)} ${' '.repeat(gamesLength - gamesLabel.length)}${gamesLabel}\`\n`;

        for (let i = 0; i < energyBoost.length; i++) {
            embedStr += `\`${i}x ${' '.repeat(energyLength - `${i}x`.length)} ${' '.repeat(gamesLength - `${energyCounts[i]}`.length)}${energyCounts[i]}\`\n`;
        }

        embed.addFields(
            { name: 'Energy Usage', value: embedStr },
            { name: 'Estimated Base Points', value: `${data.basePoints}` },
            { name: 'Total Energy Used', value: `${totalEnergyUsed}` },
        );

        await sendEmbed(interaction, embed);
    }
    else {
        await interaction.editReply({ content: 'Discord User found but no data logged (have you recently linked or event ended?)' });
    }
}

interface CutoffEntry {
    Timestamp: number;
    Score: number;
    ID?: string; // Optional ID for historical cutoffs
    GameNum?: number; // Optional game number
}

async function getData(tier: number, eventId: number, eventData: EventData, discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {

    discordClient.addPrioritySekaiRequest('ranking', {
        eventId: eventId,
        targetRank: tier,
        lowerLimit: 0
    }, async (response: any) => { // Type response as any for simplicity
        if (!response?.rankings || response.rankings.length === 0) {
            const reply = 'Could not retrieve ranking data for this tier.';
            const title = 'Error';
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: title,
                        content: {
                            'type': 'ERROR',
                            'message': reply
                        },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const rankingUser = response.rankings.find((r: any) => r.rank === tier);
        if (!rankingUser) {
            const reply = 'Could not find a user at this tier.';
            const title = 'Tier Not Found';
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: title,
                        content: {
                            'type': 'ERROR',
                            'message': reply
                        },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const data: CutoffEntry[] = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM cutoffs ' +
            'WHERE (EventID=@eventID AND ID=@id)').all({
                id: rankingUser.userId,
                eventID: eventId
            }) as CutoffEntry[] || [];

        if (data.length === 0) {
            const reply = 'Please input a tier in the range 1-100 or input 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, or 50000';
            const title = 'Tier Not Found';

            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: title,
                        content: {
                            'type': 'ERROR',
                            'message': reply
                        },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const points = new Set<number>();
        const ppg: number[] = []; // Points per game
        const baseScores: number[] = [];

        data.forEach(x => {
            points.add(x.Score);
        });

        let lastPoint = 0;

        const sortedPoints = Array.from(points).sort((a, b) => a - b);
        sortedPoints.forEach(x => {
            if (x - lastPoint >= 100) { // Assuming minimum EP for a game is 100
                const ep = x - lastPoint;
                ppg.push(ep);
                energyBoost.forEach(y => {
                    if (ep % y === 0) {
                        if (ep / y <= 4000) { // Filter out extremely high base points
                             baseScores.push(Math.round(ep / y / 25) * 25); // Round to nearest 25
                        }
                    }
                });
            }
            lastPoint = x;
        });

        const mode = median(baseScores); // Using median as it's more robust to outliers than a simple mode calculation

        await sendData({
            'rankings': response.rankings,
            'basePoints': mode,
            'name': rankingUser.name,
            'ppg': ppg
        }, tier, eventId, eventData, discordClient, interaction);

    }, (err: any) => { // Type err as any for simplicity
        discordClient.logger?.log({
            level: 'error',
            message: err.toString()
        });
        interaction.editReply({
            embeds: [generateEmbed({
                name: COMMAND.INFO.name,
                content: { type: 'Error', message: 'Failed to fetch ranking data for games command.' },
                client: discordClient.client
            })]
        });
    });
}

function median(values: number[]): number {

    if (values.length === 0) {
        return -1;
    }

    // Sorting values, preventing original array
    // from being mutated.
    values = [...values].sort((a, b) => a - b);

    const half = Math.floor(values.length / 2);

    return (values.length % 2
        ? values[half]
        : (values[half - 1] + values[half]) / 2
    );

}

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        const event = discordClient.getCurrentEvent();

        const tier = interaction.options.getInteger('tier');

        if (event.id === -1) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.NO_EVENT_ERR,
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        if (tier === null) {
            // This case should ideally not happen if tier is required or has a default.
            // If it can happen, provide appropriate error feedback.
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: { type: 'Error', message: 'Please provide a tier.' },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        try {
            await getData(tier, event.id, event, discordClient, interaction);
        } catch (err: any) { // Type as any for error
            console.error(err); // Changed to console.error
            await interaction.editReply('An unexpected error occurred while processing the games command.');
        }
    }
};