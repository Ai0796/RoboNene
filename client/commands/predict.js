/**
 * @fileoverview Predicts the current tier of the event given the current cutoff and tier.
 * @author Ai0796
 */


const COMMAND = require('../command_data/predict');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');
const fs = require('fs');
const bisectLeft = require('../methods/bisect');

const fp = './JSONs/weights.json';

const weights = JSON.parse(fs.readFileSync(fp, 'utf-8'));

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        // await interaction.reply("test")
        await interaction.deferReply(
            { ephemeral: COMMAND.INFO.ephemeral }
        );
        let tier = interaction.options.getInteger('tier');
        let cutoff = interaction.options.getInteger('currentpoints');
        let chapter = interaction.options.getBoolean('chapter') ?? false;

        //weight consists of 3 lists, percentage, std_dev, and mean
        const weight = weights[tier.toString()];
        let percentage = weight[0];
        let std_dev = weight[1];
        let mean = weight[2];

        let event = await discordClient.getCurrentEvent();

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
            event = await discordClient.getWorldLink();
            event.startAt = event.chapterStartAt;
        }

        let currentTime = new Date().getTime();
        let eventPercentage = Math.min((currentTime - event.startAt) / (event.aggregateAt - event.startAt), 100);

        let i = bisectLeft(percentage, eventPercentage);

        if (i == percentage.length) {
            i--;
        }

        let sigma = (cutoff - mean[i]) / std_dev[i];
        let prediction = Math.round((sigma * std_dev[std_dev.length-1]) + mean[mean.length-1]);

        await interaction.editReply({
            embeds: [
                generateEmbed({
                    name: COMMAND.INFO.name,
                    content: {
                        type: 'Prediction',
                        message: `The predicted cutoff for T${tier} is: \`${prediction.toLocaleString()}\` EP (input: \`${cutoff.toLocaleString()}\` EP @ \`${(eventPercentage * 100).toFixed(2)}%\` of the event)`,
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

