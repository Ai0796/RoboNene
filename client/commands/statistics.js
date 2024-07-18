/**
 * @fileoverview Displays statistics of a user or tier
 * @author Ai0796
 */

const COMMAND = require('../command_data/statistics');

const generateSlashCommand = require('../methods/generateSlashCommand');
const calculateTeam = require('../methods/calculateTeam');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } = require('../../constants');
const getEventData = require('../methods/getEventData');

const HOUR = 3600000;
const SONGBIAS = 7.00; //Multiplier for Talent to get score

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
        .setFooter({text: FOOTER, iconURL: client.user.displayAvatarURL()});

    return embed;
};

function generateEnergyTable(eventPoints)
{
    return energyBoost.map(x => x * eventPoints);
}

function calculateEventPoints(score, multiscore, eventBoost, isCheerful)
{
    let scorePoints = isCheerful ? score / 12500 : score / 17500;
    let multiPoints = Math.min(multiscore, 1300000) / 100000;
    let cheerfulPoints = isCheerful ? 40 : 0;
    return (114 + scorePoints + multiPoints + cheerfulPoints) * (1 + eventBoost);
}

function calculateScore(talent)
{
    return talent * SONGBIAS;
}

function getEnergyPerGame(energyTable, eventPoints)
{
    let index = 0;
    energyTable.forEach((points, i) => {
        if(Math.abs(eventPoints - points[1]) < Math.abs(eventPoints - energyTable[index][1])){
            index = i;
        }
    });

    return energyTable[index][0];
}

function getLastHour(sortedList, el) {
    for(let i = 0; i < sortedList.length; i++) {
        if(sortedList[i] >= el) {
            return i;
        }
    }
    return 0;
}

function sanityLost(gamesPlayed, finalPoint)
{
    let sanity =  Math.pow(finalPoint, 0.75) * gamesPlayed;
    let sanityNum = parseInt(Math.log(sanity) / Math.log(1000));
    sanity /= Math.pow(1000, sanityNum);
    let suffix = sanityNum * 3;
    sanity = sanity.toFixed(6);
    return {sanity : sanity, suffix: suffix};
}

async function userStatistics(user, eventId, eventData, discordClient, interaction) {

    if (eventData.id > LOCKED_EVENT_ID) {
        interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
        return;
    }

    let id = discordClient.getId(user.id);

    if(id == -1) {
        interaction.editReply({ content: 'You haven\'t linked to the bot, do you expect GhostNene to just know where you live?' });
        return;
    }

    let data = discordClient.cutoffdb.prepare('SELECT * FROM users ' +
        'WHERE (id=@id AND EventID=@eventID)').all({
            id: id,
            eventID: eventId
        });
    let userData = discordClient.db.prepare('SELECT * FROM users ' +
        'WHERE (discord_id=@discord_id)').all({
            discord_id: user.id,
        });
    if (data.length) {

        let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
        let title = `${user.displayName} Statistics`;
        tierStatisticsEmbed(rankData, title, discordClient, interaction);
    }
    else {
        interaction.editReply({ content: 'Discord User found but no data logged (If after Kick it Up a Notch this command won\'t work)' });
    }
}

async function tierStatisticsEmbed(rankData, title, discordClient, interaction) {
    let lastTimestamp = rankData[rankData.length - 1].timestamp;
    let timestamps = rankData.map(x => x.timestamp);

    let lastHourIndex = getLastHour(timestamps, lastTimestamp - HOUR);

    let lastHour = rankData[lastHourIndex];
    let scoreLastHour = rankData[rankData.length - 1].score - lastHour.score;

    let lastPoint = rankData[0].score;

    let gamesPlayed = 0;
    let gamesPlayedHr = 0;
    let pointsPerGame = [];
    let energyPossibilities = energyBoost.map(() => 0);
    let energyPossiblitiesHour = energyBoost.map(() => 0);
    let timestampIndex = 0;
    let movingWindowSpeeds = [];

    rankData.slice(1).forEach((point, i) => {
        if (point.score - lastPoint >= 100) {
            let gain = point.score - lastPoint;
            let windowIndex = getLastHour(timestamps, point.timestamp - HOUR);
            timestamps = timestamps.slice(windowIndex);
            timestampIndex += windowIndex;
            movingWindowSpeeds.push(point.score - rankData[timestampIndex].score);
            energyBoost.forEach((x, idx) => {
                if (x != 1 && gain % x == 0 && gain < 2000 * x) {
                    energyPossibilities[idx] += 1;
                    if (i >= lastHourIndex) {
                        energyPossiblitiesHour[idx] += 1;
                    }
                }
            });
            gamesPlayed++;
            pointsPerGame.push({ points: gain, timestamp: parseInt(point.timestamp / 1000) });
            if (i >= lastHourIndex) {
                gamesPlayedHr++;
            }
            lastPoint = point.score;
        }
    });

    let timestamp = parseInt(rankData[rankData.length - 1].timestamp / 1000);

    let sanity = sanityLost(gamesPlayed, rankData[rankData.length - 1].score);

    let scorePerGame = parseFloat(scoreLastHour / gamesPlayedHr).toFixed(2);

    let estimatedEnergy = energyPossibilities.indexOf(Math.max(...energyPossibilities));
    let estimatedEnergyHour = energyPossiblitiesHour.indexOf(Math.max(...energyPossiblitiesHour));
    let peakSpeed = Math.max(...movingWindowSpeeds);

    let embed = generateEmbed({
        name: title,
        client: discordClient.client
    });

    // Embed Reply
    embed.addFields(
        { name: 'Current Event Points', value: rankData[rankData.length - 1].score.toLocaleString() },
        { name: 'Event Points Gained in the Last Hour', value: scoreLastHour.toLocaleString() },
        { name: 'Games Played in the Last Hour', value: `${gamesPlayedHr.toLocaleString()}`, inline: true },
        { name: 'Games Played', value: `${gamesPlayed.toLocaleString()}`, inline: true },
        { name: 'Average Score per Game over the hour', value: scorePerGame.toLocaleString() },
        { name: 'Peak Speed over an hour', value: peakSpeed.toLocaleString() },
        { name: 'Estimated Energy usage', value: `${estimatedEnergy}x` },
        { name: 'Estimated Energy usage over the hour', value: `${estimatedEnergyHour}x` },
        { name: 'Sanity Lost', value: `${sanity.sanity}e${sanity.suffix} <:sparkles:1012729567615656066>` },
    );

    //Ignore this entire section
    let reply = `Current Event Points: ${rankData[rankData.length - 1].score.toLocaleString()}\n` +
        `Event Points Gained in the Last Hour: ${scoreLastHour}\n` +
        `Games Played in the Last Hour: ${gamesPlayedHr} (${gamesPlayed} Total)\n` +
        `Average Score per Game over the hour: ${scorePerGame}\n` +
        `Peak Speed over an hour: ${peakSpeed}\n` +
        `Estimated Energy usage: ${estimatedEnergy}\n` +
        `Estimated Energy usage over the hour: ${estimatedEnergyHour}\n` +
        `Sanity Lost: ${sanity.sanity}e${sanity.suffix} <:sparkles:1012729567615656066>\n` +
        'Last 5 Games:\n';

    for (let i = 1; i < Math.min(6, pointsPerGame.length + 1); i++) {
        let game = pointsPerGame[pointsPerGame.length - i];
        reply += `**Game ${i}:** ${game.points} <t:${game.timestamp}:R> \n`;
    }

    reply += `Updated: <t:${timestamp}:R>`;

    let mobileEmbed = generateEmbed({
        name: title,
        client: discordClient.client
    });

    mobileEmbed.addFields(
        { name: title, value: reply }
    );

    for (let i = 1; i < Math.min(7, pointsPerGame.length + 1); i++) {
        let game = pointsPerGame[pointsPerGame.length - i];
        embed.addFields({ name: `**Game ${i}:**`, value: `${game.points}\n<t:${game.timestamp}:R>`, inline: true });
    }

    embed.addFields({ name: 'Updated:', value: `<t:${timestamp}:R>` });

    sendEmbed(interaction, embed, mobileEmbed);
}

async function tierStatistics(tier, eventId, eventData, discordClient, interaction) {

    discordClient.addPrioritySekaiRequest('ranking', {
        eventId: eventId,
        targetRank: tier,
        lowerLimit: 0
    }, async (response) => {
        let data = discordClient.cutoffdb.prepare('SELECT Timestamp, Score FROM cutoffs ' +
            'WHERE (EventID=@eventID AND ID=@id)').all({
                id: response['rankings'][tier-1]['userId'],
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
        let rankData = [];

        data.forEach(x => {
            if(!points.has(x.Score)){
                rankData.push({ timestamp: x.Timestamp, score: x.Score });
                points.add(x.Score);
            }
        });
        rankData.unshift({ timestamp: eventData.startAt, score: 0 });
        rankData.push({ timestamp: Date.now(), score: response['rankings'][0]['score'] });
        rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);
        let title = `T${tier} ${response['rankings'][0].name} Statistics`;

        tierStatisticsEmbed(rankData, title,discordClient, interaction);

    }, (err) => {
        discordClient.logger.log({
            level: 'error',
            message: err.toString()
        });
    });
}

async function tierHistoricalStatistics(tier, eventId, eventData, discordClient, interaction) {
    
    let response = discordClient.cutoffdb.prepare('SELECT ID, Score FROM cutoffs ' +
        'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY TIMESTAMP DESC').all({
            eventID: eventData.id,
            tier: tier
        });

    if (response.length > 0) {
        let data = discordClient.cutoffdb.prepare('SELECT Timestamp, Score FROM cutoffs ' +
            'WHERE (EventID=@eventID AND ID=@id)').all({
                id: response[0].ID,
                eventID: eventId
            });

        if (data.length == 0) {
            let reply = 'Please input a tier in the range 1-100 or input 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, or 50000';
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
        let rankData = [];

        data.forEach(x => {
            if (!points.has(x.Score)) {
                rankData.push({ timestamp: x.Timestamp, score: x.Score });
                points.add(x.Score);
            }
        });
        rankData.unshift({ timestamp: eventData.startAt, score: 0 });
        rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);

        let title = `${eventData.name} T${tier} Statistics`;

        tierStatisticsEmbed(rankData, title, discordClient, interaction);

    } else {
        let reply = 'Please input a tier in the range 1-100 or input 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, or 50000';
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
    }
}

async function sendEmbed(interaction, embed, mobileEmbed) {
    const statisticsButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('condensed')
                .setLabel('CONDENSED')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(COMMAND.CONSTANTS.CONDENSED)
        );

    const statisticsMessage = await interaction.editReply({
        embeds: [embed],
        components: [statisticsButtons],
        fetchReply: true
    });

    // Create a filter for valid responses
    const filter = (i) => {
        return i.customId == 'condensed';
    };

    const collector = statisticsMessage.createMessageComponentCollector({
        filter,
        time: COMMAND.CONSTANTS.INTERACTION_TIME
    });

    // Collect user interactions with the prev / next buttons
    var condensed = false;
    collector.on('collect', async (i) => {
        if (i.customId === 'condensed') {
            condensed = !condensed;
        }

        if (condensed) {
            await i.update({
                embeds: [mobileEmbed],
                components: [statisticsButtons]
            });
        }
        else {
            await i.update({
                embeds: [embed],
                components: [statisticsButtons]
            });
        }
    });
}

module.exports = {
    ...COMMAND.INFO,
    data: generateSlashCommand(COMMAND.INFO),

    async execute(interaction, discordClient) {
        await interaction.deferReply({
            ephemeral: COMMAND.INFO.ephemeral
        });

        const event = discordClient.getCurrentEvent();

        const user = interaction.options.getMember('user');
        const tier = interaction.options.getInteger('tier');
        const eventId = interaction.options.getInteger('event') || event.id;

        const eventData = getEventData(eventId);

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

        if (user) {
            try {
                userStatistics(user, eventId, eventData, discordClient, interaction);
            } catch (err) {
                console.log(err);
            }
        }

        else if (tier) {
            try {
                if (eventId < event.id || event.id > LOCKED_EVENT_ID) {
                    tierHistoricalStatistics(tier, eventId, eventData, discordClient, interaction);
                } else {
                    tierStatistics(tier, eventId, eventData, discordClient, interaction);
                }
            } catch (err) {
                console.log(err);
            }
        }
    }
};