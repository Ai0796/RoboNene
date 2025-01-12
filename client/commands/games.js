/**
 * @fileoverview Displays statistics of a user or tier
 * @author Ai0796
 */

const COMMAND = require('../command_data/games');

const generateSlashCommand = require('../methods/generateSlashCommand');
const { EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');

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

/**
 * Generates an embed from the provided params
 * @param {String} name the name of the command
 * @param {Object} content the content of the message
 * @param {String} image an image URL (if applicable)
 * @param {DiscordClient} client the client we are using to handle Discord requests
 * @return {EmbedBuilder} a generated embed
 */
const generateEmbed = ({ name, client }) => {
    const embed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
        .setThumbnail(client.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: FOOTER, iconURL: client.user.displayAvatarURL() });

    return embed;
};

function generateEnergyTable(eventPoints) {
    return energyBoost.map(x => x * eventPoints);
}

function getEnergyPerGame(energyTable, eventPoints) {
    let index = 0;
    energyTable.forEach((points, i) => {
        if (Math.abs(eventPoints - points[1]) < Math.abs(eventPoints - energyTable[index][1])) {
            index = i;
        }
    });

    return energyTable[index][0];
}

async function sendEmbed(interaction, embed) {

    interaction.editReply({
        embeds: [embed],
        fetchReply: true
    });
}

async function sendData(data, tier, eventId, eventData, discordClient, interaction) {

    if (data['ppg'].length > 0) {

        let user = data.name;
        let title = `T${tier} ${user} Energy Usage`;
    
        let pointTable = generateEnergyTable(data.basePoints);

        const energyCounts = new Array(energyBoost.length).fill(0);
        let energyUsed = 0;

        data.ppg.forEach((point) => {
            if (point >= 100) {
                let tempEnergyTable = [];
                energyBoost.forEach((x, i) => {
                    if (point % x == 0) {
                        tempEnergyTable.push([i, pointTable[i]]);
                    }
                });
                let energyUsedGame = getEnergyPerGame(tempEnergyTable, point);
                energyCounts[energyUsedGame]++;
                energyUsed += energyUsedGame;
            }
        });

        let embed = generateEmbed({
            name: title,
            client: discordClient.client
        });

        let energyLabel = 'Cost';
        let gamesLabel = 'Games';

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

        //Ignore this entire section
        embed.addFields(
            { name: 'Energy Usage', value: embedStr },
            { name: 'Estimated Base Points', value: `${data.basePoints}` },
            { name: 'Total Energy Used', value: `${energyUsed}` },
        );

        await sendEmbed(interaction, embed);
    }
    else {
        interaction.editReply({ content: 'Discord User found but no data logged (have you recently linked or event ended?)' });
    }
}

async function getData(tier, eventId, eventData, discordClient, interaction) {

    discordClient.addPrioritySekaiRequest('ranking', {
        eventId: eventId,
        targetRank: tier,
        lowerLimit: 0
    }, async (response) => {
        let data = discordClient.cutoffdb.prepare('SELECT Timestamp, Score FROM cutoffs ' +
            'WHERE (EventID=@eventID AND ID=@id)').all({
                id: response['rankings'][tier - 1]['userId'],
                eventID: eventId
            });

        if (data.length == 0) {
            let reply = 'Please input a tier in the range 1-100';
            let title = 'Tier Not Found';

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

        let points = new Set();
        let ppg = [];
        let baseScores = [];

        data.forEach(x => {
            if (!points.has(x.Score)) {
                points.add(x.Score);
            }
        });

        let lastPoint = 0;

        points = Array.from(points).sort((a, b) => a - b);
        points.forEach(x => {
            if (x - lastPoint >= 100) {
                let ep = x - lastPoint;
                ppg.push(ep);
                energyBoost.forEach(y => {
                    if (ep % y == 0) {
                        if (ep / y > 4000) {
                            return;
                        }
                        baseScores.push(Math.round(ep / y / 25) * 25);
                    }
                });
            }
            lastPoint = x;
        });

        let pointSet = new Set(baseScores);
        let filtered = [];

        let mode = -1;
        let peak = 25;
        while (mode == -1) {
            pointSet.forEach(x => {
                let count = baseScores.filter(y => y == x).length;
                if (count > baseScores.length / peak) {
                    filtered.push(x);
                }
            });

            console.log(filtered);
            mode = median(filtered);
            peak += 5;
        }

        // let mode = baseScores.reduce((a, b, i, arr) => {
        //     let count = arr.filter(x => x == b).length;
        //     if (count > arr.filter(x => x == a).length) {
        //         return b;
        //     }
        //     return a;
        // });

        await sendData({
            'rankings': response['rankings'],
            'basePoints': mode,
            'name': response['rankings'][tier - 1]['name'],
            'ppg': ppg
        }, tier, eventId, eventData, discordClient, interaction);

    }, (err) => {
        discordClient.logger.log({
            level: 'error',
            message: err.toString()
        });
    });
}

function median(values)  {

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

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
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

        try {
            await getData(tier, event.id, event, discordClient, interaction);
        } catch (err) {
            console.log(err);
        }
    }
};