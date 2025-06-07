// client/commands/predict.ts
/**
 * @fileoverview Predicts the current tier of the event given the current cutoff and tier.
 * @author Ai0796
 */

import * as COMMAND from '../command_data/predict'; // Assuming command_data/predict.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import * as fs from 'fs';
import bisectLeft from '../methods/bisect'; // Assuming bisect.ts is converted
import DiscordClient from '../client/client'; // Assuming default export
import { CommandInteraction } from 'discord.js'; // Import CommandInteraction

const fp = './JSONs/weights.json';
const weights: { [tier: string]: [number[], number[], number[]] } = JSON.parse(fs.readFileSync(fp, 'utf8')); // Type assertion for weights.json

export default {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
        await interaction.deferReply(
            { ephemeral: COMMAND.INFO.ephemeral }
        );
        const tier = interaction.options.getInteger('tier');
        const cutoff = interaction.options.getInteger('currentpoints');
        const chapter = interaction.options.getBoolean('chapter') ?? false;

        if (tier === null || cutoff === null) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: COMMAND.CONSTANTS.BAD_INPUT_ERROR,
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        //weight consists of 3 lists, percentage, std_dev, and mean
        const weight = weights[tier.toString()];
        if (!weight) {
            await interaction.editReply({
                embeds: [
                    generateEmbed({
                        name: COMMAND.INFO.name,
                        content: { type: 'Error', message: `No prediction data available for tier ${tier}.` },
                        client: discordClient.client
                    })
                ]
            });
            return;
        }

        const percentage = weight[0];
        const std_dev = weight[1];
        const mean = weight[2];

        let event = discordClient.getCurrentEvent();

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

        if (event.eventType === 'world_bloom' && chapter) {
            const worldLinkEvent = discordClient.getWorldLink(); // This should return the specific world link chapter
            if (worldLinkEvent && worldLinkEvent !== -1) {
                event = {
                    ...event, // Copy existing event properties
                    startAt: worldLinkEvent.chapterStartAt,
                    aggregateAt: worldLinkEvent.chapterEndAt,
                    name: `${discordClient.getCharacterName(worldLinkEvent.gameCharacterId)}'s Chapter`
                };
            } else {
                await interaction.editReply({
                    embeds: [
                        generateEmbed({
                            name: COMMAND.INFO.name,
                            content: { type: 'Error', message: 'No active World Link chapter found.' },
                            client: discordClient.client
                        })
                    ]
                });
                return;
            }
        }

        const currentTime = new Date().getTime();
        const eventDuration = event.aggregateAt - event.startAt;
        const eventPercentage = Math.min((currentTime - event.startAt) / eventDuration, 1); // Percentage as a decimal

        let i = bisectLeft(percentage, eventPercentage);

        if (i === percentage.length) {
            i--;
        }

        // Handle cases where std_dev[i] might be 0 or very small to prevent division by zero or large numbers
        const currentStdDev = std_dev[i] || 1; // Default to 1 to prevent division by zero
        const currentMean = mean[i] || 0;

        const sigma = (cutoff - currentMean) / currentStdDev;
        const finalStdDev = std_dev[std_dev.length - 1] || 1; // Default to 1
        const finalMean = mean[mean.length - 1] || 0;

        const prediction = Math.round((sigma * finalStdDev) + finalMean);

        const formattedEventPercentage = (eventPercentage * 100).toFixed(2); // Convert to 2 decimal places for display

        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        type: 'Prediction',
                        message: `The predicted cutoff for T${tier} is: \`${prediction.toLocaleString()}\` EP (input: \`${cutoff.toLocaleString()}\` EP @ \`${formattedEventPercentage}%\` of the event)`,
                    },
                    client: discordClient.client
                })
            ]
        });

        await interaction.followUp({
            content: 'Note: Ghostnene can track border cutoffs again, you can use /cutoff to get the exact cutoffs and prediction'
        });
    }
};