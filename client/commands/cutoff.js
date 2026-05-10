/**
 * @fileoverview The main output when users call for the /cutoff command
 * Will display detailed information about ranking cutoff 
 * @author Potor10
 */

const { EmbedBuilder } = require('discord.js');
const { DIR_DATA, NENE_COLOR, FOOTER } = require('../../constants');
const https = require('https');
const fs = require('fs');
const regression = require('regression');

// --- NEW: Python execution bridge ---
const { spawn } = require('child_process');
const path = require('path');

const COMMAND = require('../command_data/cutoff');
const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');
const binarySearch = require('../methods/binarySearch');
const weightedLinearRegression = require('../methods/weightedLinearRegression');
const bisectLeft = require('../methods/bisect');

const weightsNormal = JSON.parse(fs.readFileSync('./JSONs/weights.json', 'utf-8'));
const weightsWL = JSON.parse(fs.readFileSync('./JSONs/weights_WL.json', 'utf-8'));

/**
 * Calls the Python Gaussian Process script to get the advanced cutoff prediction.
 * @param {Array} rankData - Array of all data points for the live event
 * @param {Integer} tier - The ranking that the user wants to find
 * @param {Integer} duration - Total duration of the event in milliseconds
 * @param {Integer} eventStart - Epoch timestamp of the event start
 * @return {Promise<Object>} JSON object containing the { estimate, error }
 */
const getGPEstimate = (rankData, tier, duration, eventStart, isWorldBloom) => {
  return new Promise((resolve, reject) => {
    // Format data for Python: x is normalized time (0.0 to 1.0), y is score
    const liveDataObj = rankData.map(d => ({
      x: Math.min((d.timestamp - eventStart) / duration, 1),
      y: d.score
    }));

    const liveDataStr = JSON.stringify(liveDataObj);

    // ADJUST THIS PATH based on where you put gp_predict.py relative to this file
    const pythonScript = path.join(__dirname, '../pyScripts/gp_predict.py');

    // We no longer pass the big JSON string as an argument
    const pyProg = spawn('python3.11', [pythonScript, tier.toString(), isWorldBloom.toString()]);

    let data = '';
    let errorData = '';

    // Write the big JSON string to Python's stdin
    pyProg.stdin.write(liveDataStr);
    pyProg.stdin.end();

    pyProg.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });

    pyProg.stderr.on('data', (chunk) => {
      errorData += chunk.toString();
    });

    pyProg.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python GP Error: ${errorData}`);
        return resolve({ estimate: 'Error', error: 'N/A' });
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        resolve({ estimate: 'Error', error: 'N/A' });
      }
    });
  });
};

/**
 * Operates on a http request and returns the current rate being hosted on GH actions.
 * @return {Promise<Object>} Json object of the ranking rate constants.
 * @error Status code of the http request
 */
const requestRate = () => {
  return new Promise((resolve, reject) => {
    const options = {
      host: COMMAND.CONSTANTS.RATE_HOST,
      path: COMMAND.CONSTANTS.RATE_PATH,
      headers: { 'User-Agent': 'request' }
    };

    https.get(options, (res) => {
      let json = '';
      res.on('data', (chunk) => { json += chunk; });
      res.on('end', async () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(json)); }
          catch (err) { reject(err); }
        } else {
          reject(res.statusCode);
        }
      });
    }).on('error', (err) => { reject(err); });
  });
};

/**
 * Calculates the standard error of given data points and model
 * @param {Array} data - Array of all data points
 * @param {Object} model - Linear Regression Model
 * @param {Number} finalRate - Calculated rate multiplier
 * @return {Number} Calculated Standard Error of model
 */
function stdError(data, model, finalRate) {
  let s = 0;
  data.forEach((v) => {
    let duration = v[0];
    let points = v[1];
    let estimate = (model.equation[0] * finalRate * duration) + model.equation[1];
    s += Math.abs(points - estimate);
  });
  return s / data.length;
}

/**
 * Calculates the return embed and sends it via discord interaction
 * @param {Interaction} interaction class provided via discord.js
 * @param {Object} event object that we are investigating
 * @param {Integer} timestamp in epochseconds
 * @param {Integer} tier the ranking that the user wants to find
 * @param {Integer} score of the current cutoff
 * @param {Object} rankData the ranking data obtained
 * @param {boolean} detailed determines if extra information shows
 * @param {DiscordClient} discordClient we are using to interact with discord
 */
const generateCutoff = async ({ interaction, event, timestamp, tier, score, rankData, detailed, discordClient }) => {

  // If rank data does not exist then send an error
  if (!rankData.length) {
    await interaction.editReply({
      embeds: [generateEmbed({
        name: COMMAND.INFO.name,
        content: COMMAND.CONSTANTS.NO_DATA_ERR,
        client: discordClient.client
      })]
    });
    return;
  }

  const msTaken = timestamp - event.startAt;
  const duration = event.aggregateAt - event.startAt;

  // Overall score gain per hour
  const scorePH = Math.round(score * 3600000 / msTaken);

  let lastHourPt = (rankData) ? rankData[0] : { timestamp: (new Date(timestamp)).toISOString(), score: score };

  // Every point is spaced by 1 minute intervals (assuming that there isn't any downtime)
  // Otherwise there maybe a difference of 1-2 minutes, but that's still generally ok for calculating
  for (let i = rankData.length - 1; i > 0; i--) {
    if (timestamp - rankData[i].timestamp >= 3600000 - 60000) {
      lastHourPt = rankData[i];
      break;
    }
  }

  // Estimate texts used in the embed
  let noSmoothingEstimate = 'N/A', smoothingEstimate = 'N/A', weightedEstimate = 'N/A';
  let weightedErrorStr = 'N/A', noSmoothingError = 'N/A', smoothingError = 'N/A';

  // The string we show that highlights the equation we use in detailed
  let linEquationStr = '', weightedEquationStr = '';

  // Saved indices of critical timestamps
  let oneDayIdx = -1, halfDayIdx = -1, lastDayIdx = rankData.length;

  // Find the index where 12 and 24 hours have passed into the event (or the latest timestamp)
  for (let i = 0; i < rankData.length; i++) {
    const currentEventTime = (new Date(rankData[i].timestamp)).getTime();
    if (halfDayIdx === -1 && currentEventTime >= event.startAt + 43200000) halfDayIdx = i;
    if (currentEventTime >= event.startAt + 86400000) { oneDayIdx = i; break; }
  }

  // Find the index where less than 24 hours left in the event (or the latest timestamp)
  if (timestamp >= event.aggregateAt - 86400000) {
    for (let i = 0; i < rankData.length; i++) {
      const currentEventTime = (new Date(rankData[i].timestamp)).getTime();
      lastDayIdx = i;
      if (currentEventTime >= event.aggregateAt - 86400000) break;
    }
  }

  // If we are at least 1 day into the event
  if (oneDayIdx !== -1) {
    // Get game information from saved json files
    const rate = await requestRate();
    const eventCards = JSON.parse(fs.readFileSync(`${DIR_DATA}/eventCards.json`));
    const cards = JSON.parse(fs.readFileSync(`${DIR_DATA}/cards.json`));
    const characterIds = [];

    // Find the characters relevant to the event
    eventCards.forEach(card => {
      if (card.eventId == event.id) {
        const cardInfo = binarySearch(card.cardId, 'id', cards);
        characterIds.push(cardInfo.characterId);
      }
    });

    // Values used to calculate the c constant in y = (c * m)x + b
    let totalRate = 0, totalSimilar = 0, allTotalRate = 0, rateCount = 0;

    // Calculate the idx of our rate (based on time into event)
    // Each index starts from 1 day into the event -> the end of the event, with 30 minute intervals
    const rateIdx = Math.floor((timestamp - 86400000) / 1800000);

    // Obtain The Event Type of the Current Event
    let currentEventType = discordClient.getCurrentEvent().eventType;

    // Identify a constant c used in y = (c * m)x + b that can be used via this event
    for (const eventId in rate) {
      if (rate[eventId].eventType !== currentEventType) continue;

      const similarity = characterIds.filter(el => { return rate[eventId].characterIds.indexOf(el) >= 0; }).length;

      if (rate[eventId][tier]) {
        // Make sure our idx is within bounds
        const eventRateIdx = Math.min(rateIdx, rate[eventId][tier].length - 1);

        // Calculate recency factor
        const eventWeight = parseInt(eventId, 10) / event.id;

        // Total Rate = Rate * # of similar characters * recency of event
        totalRate += rate[eventId][tier][eventRateIdx] * similarity * eventWeight;
        totalSimilar += similarity * eventWeight;

        allTotalRate += rate[eventId][tier][eventRateIdx];
        rateCount += 1;
      }
    }

    // Determine the final rate depending on if there was a previous event with similar chara, 
    // otherwise use the average of all events of same type
    // If there is no data to go off of, we use 1
    const finalRate = (totalSimilar) ? (totalRate / totalSimilar) : ((rateCount) ? (allTotalRate / rateCount) : 1);

    const points = [];

    // Only get data points past 12 hours and before last 24 hours
    rankData.slice(halfDayIdx, lastDayIdx).forEach((point) => {
      points.push([(new Date(point.timestamp)).getTime() - event.startAt, point.score]);
    });

    // Create a linear regression model with our data points
    const model = regression.linear(points, { precision: 100 });
    const predicted = (model.equation[0] * finalRate * duration) + model.equation[1];

    // Calculate Error 
    const error = stdError(points, model, finalRate) * (duration / points[points.length - 1][0]);

    // Final model without smoothing
    noSmoothingEstimate = Math.round(predicted).toLocaleString();
    noSmoothingError = Math.round(error).toLocaleString();

    // Generate the string for the equation
    linEquationStr = `\n\`${+(model.equation[0] + finalRate * 1000).toFixed(2)} \\* seconds into event + ${+(model.equation[1]).toFixed(2)}\``;

    // Create weighted linear regression model
    const weightedModel = weightedLinearRegression(points, points.map((x) => (x[0] / 86400000) ** 2));
    const weightedPredicted = (weightedModel.equation[0] * finalRate * duration) + weightedModel.equation[1];

    // Calculate Weighted Model Error
    const weightedError = stdError(points, weightedModel, finalRate) * (duration / points[points.length - 1][0]);

    // Final weighted model
    weightedEstimate = Math.round(weightedPredicted).toLocaleString();
    weightedErrorStr = Math.round(weightedError).toLocaleString();
    weightedEquationStr = `\n\`${+(weightedModel.equation[0] * finalRate * 1000).toFixed(2)} \\* seconds into event + ${+(weightedModel.equation[1]).toFixed(2)}\``;

    // Calculate smoothed result
    let totalWeight = 0, totalTime = 0, errorSmoothed = 0;

    // Grab 1 Estimate Every 60 Minutes For Smoothing
    const smoothingPoints = [];

    rankData.slice(halfDayIdx, oneDayIdx).forEach((point) => {
      smoothingPoints.push([(new Date(point.timestamp)).getTime() - event.startAt, point.score]);
    });

    let lastIdx = oneDayIdx;

    for (let i = oneDayIdx; i < lastDayIdx; i += 60) {
      rankData.slice(lastIdx, i).forEach((point) => {
        smoothingPoints.push([(new Date(point.timestamp)).getTime() - event.startAt, point.score]);
      });
      lastIdx = i;

      // Create a linear regression model with the current data points
      const modelSmoothed = regression.linear(smoothingPoints, { precision: 100 });
      const predictedSmoothed = (modelSmoothed.equation[0] * finalRate * duration) + modelSmoothed.equation[1];

      // Calculate Error 
      errorSmoothed = stdError(points, model, finalRate) * (duration / points[points.length - 1][0]);

      // Calculate the % through the event, we will use this as a weight for the estimation
      // If no indexes then crash and set amtThrough to 0
      var amtThrough = (smoothingPoints.length > 0) ? (smoothingPoints[smoothingPoints.length - 1][0]) / duration : 0;

      // Total score of all of our estimates with account to weight
      if (!isNaN(predictedSmoothed)) { totalWeight += predictedSmoothed * Math.pow(amtThrough, 2); }

      // Total time weights
      totalTime += Math.pow(amtThrough, 2);
    }

    smoothingEstimate = Math.round(totalWeight / totalTime).toLocaleString();
    smoothingError = Math.round(errorSmoothed).toLocaleString();
  }

  const eventPercentage = Math.min((timestamp - event.startAt) * 100 / duration, 100);

  // weight consists of 3 lists: percentage, std_dev, and mean
  const weights = (event.eventType === 'world_bloom') ? weightsWL : weightsNormal;
  const weight = weights[tier.toString()];
  let percentage = weight[0];
  let std_dev = weight[1];
  let mean = weight[2];

  let i = bisectLeft(percentage, eventPercentage / 100.0);
  if (i == percentage.length) i--;

  let sigma = (score - mean[i]) / std_dev[i];
  let NormalEstimate = Math.round((sigma * std_dev[std_dev.length - 1]) + mean[mean.length - 1]);
  let regEquationStr = `\n\`${sigma.toFixed(2)} * ${std_dev[std_dev.length - 1].toFixed(2)} + ${mean[mean.length - 1].toFixed(2)}\``;

  // --- NEW: FETCH GAUSSIAN PROCESS ESTIMATE ---
  const gpResult = await getGPEstimate(rankData, tier, duration, event.startAt, event.eventType === 'world_bloom');
  const gpEstimateStr = gpResult.estimate !== 'Error' ? Math.round(gpResult.estimate).toLocaleString() : 'N/A';
  const gpErrorStr = gpResult.error !== 'N/A' ? Math.round(gpResult.error).toLocaleString() : 'N/A';
  const gpWarning = eventPercentage < 40 ? ' *(Low Confidence)*' : '';

  // Generate the cutoff embed
  const lastHourPtTimeMs = new Date(lastHourPt.timestamp).getTime();
  const lastHourPtTime = (timestamp > event.aggregateAt) ? Math.floor(timestamp / 1000) : Math.floor(lastHourPtTimeMs / 1000);
  const lastHourPtSpeed = (timestamp > event.aggregateAt) ? 0 : Math.round((score - lastHourPt.score) * 3600000 / (timestamp - lastHourPtTimeMs));

  const cutoffEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${event.name} T${tier} Cutoff Nyaa~`)
    .setDescription(`**Requested:** <t:${Math.floor(timestamp / 1000)}:R>`)
    .setThumbnail(event.banner)
    .addFields(
      { name: 'Cutoff Statistics', value: `Points: \`\`${score.toLocaleString()}\`\`\nAvg. Speed (Per Hour): \`\`${scorePH.toLocaleString()}/h\`\`\nAvg. Speed [<t:${lastHourPtTime}:R> to <t:${Math.floor(timestamp / 1000)}:R>] (Per Hour): \`\`${lastHourPtSpeed.toLocaleString()}/h\`\`\n` },
      { name: 'Event Information', value: `Ranking Started: <t:${Math.floor(event.startAt / 1000)}:R>\nRanking Ends: <t:${Math.floor(event.aggregateAt / 1000)}:R>\nPercentage Through Event: \`\`${+(eventPercentage).toFixed(2)}%\`\`\n` })
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user.displayAvatarURL() });

  if (tier < 100) { cutoffEmbed.addFields({ name: 'Warning', value: `*${COMMAND.CONSTANTS.PRED_WARNING}*` }); }

  cutoffEmbed.addFields({
    name: 'Point Estimation (Predictions)',
    value: `Estimated Points: \`\`${noSmoothingEstimate} ± ${noSmoothingError}\`\`\n` +
      ((detailed) ? `*${COMMAND.CONSTANTS.PRED_DESC}*${linEquationStr}\n\n` : '') +
      `Estimated Points (Weighted): \`\`${weightedEstimate} ± ${weightedErrorStr}\`\`\n` +
      ((detailed) ? `*${COMMAND.CONSTANTS.WEIGHT_PRED_DESC}*${weightedEquationStr}\n\n` : '') +
      `Estimated Points (Smoothing): \`\`${smoothingEstimate} ± ${smoothingError}\`\`\n` +
      ((detailed) ? `*${COMMAND.CONSTANTS.SMOOTH_PRED_DESC}*\n\n` : '') +
      `Estimated Points (Normal Dist): \`\`${NormalEstimate.toLocaleString()}\`\`\n` +
      ((detailed) ? `*${COMMAND.CONSTANTS.NORM_PRED_DESC}*${regEquationStr}\n\n` : '') +
      `Estimated Points (Gaussian Process): \`\`${gpEstimateStr} ± ${gpErrorStr}\`\`${gpWarning}\n` +
      ((detailed) ? '*Gaussian Process Residual Modeling.*\n' : '')
  });

  // Add a Naive Estimate if the user requests detailed information
  if (detailed) {
    const naiveEstimate = (oneDayIdx === -1) ? 'N/A' : Math.round(score + Math.max((event.aggregateAt - timestamp), 0) * (scorePH / 3600000)).toLocaleString();
    const naiveLastHrEstimate = (oneDayIdx === -1) ? 'N/A' : Math.round(score + Math.max((event.aggregateAt - timestamp), 0) * (lastHourPtSpeed / 3600000)).toLocaleString();

    cutoffEmbed.addFields({
      name: 'Naive Estimation (Predictions)',
      value: `Naive Estimate: \`\`${naiveEstimate}\`\`\n*${COMMAND.CONSTANTS.NAIVE_DESC}*\n\nNaive Estimate (Last Hour): \`\`${naiveLastHrEstimate}\`\`\n*${COMMAND.CONSTANTS.NAIVE_LAST_HR_DESC}*\n`
    });
  }

  await interaction.editReply({ embeds: [cutoffEmbed] });
};

const getWorldLink = (eventId) => {
  let worldLink = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json'));
  worldLink = worldLink.filter((x) => x.eventId === eventId);
  let idx = -1;
  let currentTime = Date.now();
  worldLink.forEach((x, i) => { if (x.chapterEndAt >= currentTime && x.chapterStartAt <= currentTime) { idx = i; } });
  return (idx == -1) ? -1 : worldLink[idx];
};

const getCharacterName = (characterId) => {
  const gameCharacters = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json'));
  const charInfo = gameCharacters[characterId - 1];
  return `${charInfo.givenName} ${charInfo.firstName}`.trim();
};

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction, discordClient) {
    await interaction.deferReply({ ephemeral: COMMAND.INFO.ephemeral });

    const event = discordClient.getCurrentEvent();
    if (event.id === -1) {
      await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: COMMAND.CONSTANTS.NO_EVENT_ERR, client: discordClient.client })] });
      return;
    }

    const tier = interaction.options._hoistedOptions[0].value;

    if (!discordClient.checkRateLimit(interaction.user.id)) {
      await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: COMMAND.CONSTANTS.RATE_LIMIT_ERR.type, message: COMMAND.CONSTANTS.RATE_LIMIT_ERR.message + `\n\nExpires: <t:${Math.floor(discordClient.getRateLimitRemoval(interaction.user.id) / 1000)}>` }, client: discordClient.client })] });
      return;
    }

    let detailed = interaction.options.getBoolean('detailed') ?? false;
    let chapter = interaction.options.getBoolean('chapter') ?? false;

    try {
      // Otherwise use internal data 
      if (chapter && event.eventType === 'world_bloom') {
        if (tier == 1500 || tier == 2500) {
          await interaction.editReply({ embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'Chapter cutoffs don\'t exist for T1500 or T2500. ' }, client: discordClient.client })] });
          return;
        }

        let world_link = getWorldLink(event.id);
        let cutoffs = await discordClient.pgClient.selectTier(parseInt(`${event.id}${world_link.gameCharacterId}`) , tier);
        
        let rankData = cutoffs.map(x => ({ timestamp: x.timestamp, score: x.score }));
        rankData.sort((a, b) => a.timestamp - b.timestamp);

        world_link.startAt = world_link.chapterStartAt;
        world_link.id = event.id;
        world_link.name = `${getCharacterName(world_link.gameCharacterId)}'s Chapter`;

        generateCutoff({ interaction: interaction, event: world_link, timestamp: rankData[rankData.length - 1].timestamp, tier: tier, score: rankData[rankData.length - 1].score, rankData: rankData, detailed: detailed, discordClient: discordClient });
      } else {
        let cutoffs = await discordClient.pgClient.selectTier(event.id, tier);
        let rankData = cutoffs.map(x => ({ timestamp: x.timestamp, score: x.score }));
        rankData.sort((a, b) => a.timestamp - b.timestamp);

        generateCutoff({ interaction: interaction, event: event, timestamp: rankData[rankData.length - 1].timestamp, tier: tier, score: rankData[rankData.length - 1].score, rankData: rankData, detailed: detailed, discordClient: discordClient });
      }
    } catch (err) {
      console.log(err);
      discordClient.logger.log({ level: 'error', timestamp: Date.now(), message: `Error parsing JSON data from cutoff: ${err}` });
    }
  }
};