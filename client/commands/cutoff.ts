// client/commands/cutoff.ts
/**
 * @fileoverview The main output when users call for the /cutoff command
 * Will display detailed information about ranking cutoff
 * @author Potor10
 */

import { EmbedBuilder, CommandInteraction } from 'discord.js'; // Import CommandInteraction
import { DIR_DATA, NENE_COLOR, FOOTER } from '../../constants';
import * as https from 'https';
import * as fs from 'fs';
import * as regression from 'regression'; // Import regression as module

import * as COMMAND from '../command_data/cutoff'; // Import all exports from cutoff
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import binarySearch from '../methods/binarySearch'; // Assuming default export
import weightedLinearRegression from '../methods/weightedLinearRegression'; // Assuming default export
import bisectLeft from '../methods/bisect'; // Assuming default export
import DiscordClient from '../client'; // Assuming default export

const fp = './JSONs/weights.json';
const weights: { [tier: string]: [number[], number[], number[]] } = JSON.parse(fs.readFileSync(fp, 'utf8')); // Type assertion for weights

interface RateData {
  [eventId: string]: {
    eventType: string;
    characterIds: number[];
    [tier: string]: number[]; // Tier data (array of rates)
  };
}

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

interface RankDataPoint {
  timestamp: number;
  score: number;
}

interface CutoffCalculationParams {
  interaction: CommandInteraction;
  event: EventData;
  timestamp: number;
  tier: number;
  score: number;
  rankData: RankDataPoint[];
  detailed: boolean;
  discordClient: DiscordClient;
}


/**
 * Operates on a http request and returns the current rate being hosted on GH actions.
 * @return {Promise<RateData>} Json object of the ranking rate constants.
 * @error Status code of the http request
 */
const requestRate = (): Promise<RateData> => {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = { // Explicitly type options
      host: COMMAND.CONSTANTS.RATE_HOST,
      path: COMMAND.CONSTANTS.RATE_PATH,
      headers: { 'User-Agent': 'request' }
    };

    https.get(options, (res) => {
      let json = '';
      res.on('data', (chunk) => {
        json += chunk;
      });
      res.on('end', async () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(json) as RateData); // Type assertion
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Failed to fetch rate data: Status ${res.statusCode}`)); // Reject with an Error object
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};


/**
 * Calculates the standard error of given data points and model
 * @param {Array<number[]>} data Array of all data points [[x, y], ...]
 * @param {regression.Result} model Linear Regression Model result
 * @param {number} finalRate Final rate factor
 * @return {number} Calculated Standard Error of model
 */
function stdError(data: number[][], model: regression.Result | { equation: number[] }, finalRate: number): number {
  let s = 0;

  data.forEach((v) => {
    const duration = v[0];
    const points = v[1];
    // Ensure equation is an array of numbers
    const equation = model.equation;
    if (!Array.isArray(equation) || equation.length < 2) {
        return; // Skip if equation is not in expected format
    }
    const estimate = (equation[0] * finalRate * duration) + equation[1];

    s += Math.abs(points - estimate);
  });

  return s / data.length;
}

/**
 * Calculates the return embed and sends it via discord interaction
 * @param {CutoffCalculationParams} params Object containing interaction, event, timestamp, tier, score, rankData, detailed, discordClient
 */
const generateCutoff = async ({ interaction, event,
  timestamp, tier, score, rankData, detailed, discordClient }: CutoffCalculationParams): Promise<void> => {

  // If rank data does not exist then send an error
  if (!rankData.length) {
    await interaction.editReply({
      embeds: [
        generateEmbed({
          name: COMMAND.INFO.name,
          content: COMMAND.CONSTANTS.NO_DATA_ERR,
          client: discordClient.client
        })
      ]
    });
    return;
  }

  const msTaken = timestamp - event.startAt;
  const duration = event.aggregateAt - event.startAt;

  // Overall score gain per hour
  const scorePH = Math.round(score * 3600000 / msTaken);

  let lastHourPt: RankDataPoint | undefined; // Make it possibly undefined
  // Every point is spaced by 1 minute intervals (assuming that there isn't any downtime)
  // Otherwise there maybe a difference of 1-2 minutes, but that's still generally ok for calculating
  for (let i = rankData.length - 1; i >= 0; i--) { // Start from the end, include index 0
    if (timestamp - rankData[i].timestamp >= 3600000 - 60000) {
      lastHourPt = rankData[i];
      break;
    }
  }

  // If lastHourPt is not found (e.g., event just started), use current score
  if (!lastHourPt) {
      lastHourPt = { timestamp: timestamp - 3600000, score: score - scorePH}; // Estimate a point from 1 hour ago
      if (lastHourPt.timestamp < event.startAt) {
          lastHourPt = { timestamp: event.startAt, score: 0 };
      }
  }

  // Estimate texts used in the embed
  let noSmoothingEstimate = 'N/A';
  let smoothingEstimate = 'N/A';
  let weightedEstimate = 'N/A';
  let weightedErrorStr = 'N/A';
  let noSmoothingError = 'N/A';
  let smoothingError = 'N/A';

  // The string we show that highlights the equation we use in detailed
  let linEquationStr = '';
  let weightedEquationStr = '';

  // Saved indices of critical timestamps
  let oneDayIdx = -1;
  let halfDayIdx = -1;
  let lastDayIdx = rankData.length;

  // Find the index where 12 and 24 hours have passed into the event (or the latest timestamp)
  for (let i = 0; i < rankData.length; i++) {
    const currentEventTime = rankData[i].timestamp;
    if (halfDayIdx === -1 && currentEventTime >= event.startAt + 43200000) {
      halfDayIdx = i;
    }
    if (currentEventTime >= event.startAt + 86400000) {
      oneDayIdx = i;
      break;
    }
  }

  // Find the index where less than 24 hours left in the event (or the latest timestamp)
  if (timestamp >= event.aggregateAt - 86400000) {
    for (let i = 0; i < rankData.length; i++) {
      const currentEventTime = rankData[i].timestamp;
      if (currentEventTime >= event.aggregateAt - 86400000) {
        lastDayIdx = i;
        break;
      }
    }
  }


  // If we are at least 1 day into the event
  if (oneDayIdx !== -1) {
    // Get game information from saved json files
    const rate = await requestRate();
    const eventCards: any[] = JSON.parse(fs.readFileSync(`${DIR_DATA}/eventCards.json`, 'utf8')); // Type as any array
    const cards: any[] = JSON.parse(fs.readFileSync(`${DIR_DATA}/cards.json`, 'utf8')); // Type as any array

    const characterIds: number[] = [];

    // Find the characters relevant to the event
    eventCards.forEach(card => {
      if (card.eventId === event.id) {
        const cardInfo = binarySearch(card.cardId, 'id', cards);
        if (cardInfo) { // Check if cardInfo is found
          characterIds.push(cardInfo.characterId);
        }
      }
    });

    // Values used to calculate the c constant in y = (c * m)x + b
    let totalRate = 0;
    let totalSimilar = 0;

    let allTotalRate = 0;
    let rateCount = 0;

    // Calculate the idx of our rate (based on time into event)
    // Each index starts from 1 day into the event -> the end of the event, with 30 minute intervals
    const rateIdx = Math.floor((timestamp - event.startAt - 86400000) / 1800000); // Adjusted to be relative to startAt

    // Obtain The Event Type of the Current Event
    const currentEventType = discordClient.getCurrentEvent().eventType;

    // Identify a constant c used in y = (c * m)x + b that can be used via this event
    for (const eventIdKey in rate) { // Iterate over keys of RateData
      const eventRateData = rate[eventIdKey];
      if (eventRateData.eventType !== currentEventType) {
        continue;
      }

      const similarity = characterIds.filter(el => eventRateData.characterIds.includes(el)).length; // Use .includes()
      if (eventRateData[tier]) { // Check if tier exists on eventRateData
        // Make sure our idx is within bounds
        const eventRateTierData = eventRateData[tier]; // Get the array of rates for this tier
        if (!Array.isArray(eventRateTierData)) continue; // Ensure it's an array

        const currentEventRateIdx = Math.min(rateIdx, eventRateTierData.length - 1);

        // Calculate recency factor
        const eventWeight = parseInt(eventIdKey, 10) / event.id; // Use eventIdKey (string) here

        // Total Rate = Rate * # of similar characters * recency of event
        totalRate += eventRateTierData[currentEventRateIdx] * similarity * eventWeight;
        totalSimilar += similarity * eventWeight;

        allTotalRate += eventRateTierData[currentEventRateIdx];
        rateCount += 1;
      }
    }

    // Determine the final rate depending on if there was a previous event with similar chara,
    // otherwise use the average of all events of same type
    // If there is no data to go off of, we use 1
    const finalRate = (totalSimilar) ? (totalRate / totalSimilar) : ((rateCount) ? (allTotalRate / rateCount) : 1);
    console.log(`The Final Rate is ${finalRate}`);

    const points: number[][] = [];

    // Only get data points past 12 hours and before last 24 hours
    rankData.slice(halfDayIdx, lastDayIdx).forEach((point) => {
      points.push([point.timestamp - event.startAt, point.score]);
    });

    if (points.length === 0) { // Handle case where no points are available for regression
        noSmoothingEstimate = 'N/A';
        noSmoothingError = 'N/A';
        weightedEstimate = 'N/A';
        weightedErrorStr = 'N/A';
        smoothingEstimate = 'N/A';
        smoothingError = 'N/A';
    } else {
        // Create a linear regression model with our data points
        const model = regression.linear(points, { precision: 100 });
        const predicted = (model.equation[0] * finalRate * duration) + model.equation[1];

        // Calculate Error
        // Check `points[points.length - 1]` before accessing `[0]`
        const lastPointDuration = points.length > 0 ? points[points.length - 1][0] : 1; // Prevent division by zero
        const error = stdError(points, model, finalRate) * (duration / lastPointDuration);

        // Final model without smoothing
        noSmoothingEstimate = Math.round(predicted).toLocaleString();
        noSmoothingError = Math.round(error).toLocaleString();

        // Generate the string for the equation
        linEquationStr = `\n\`${+(model.equation[0] * finalRate * 1000).toFixed(2)} \\* ` + // Adjusted multiplication by finalRate
        `seconds into event + ${+(model.equation[1]).toFixed(2)}\``;


        // Create weighted linear regression model
        const weightedModel = weightedLinearRegression(points, points.map((x) => (x[0]/86400000)**2));
        const weightedPredicted = (weightedModel.equation[0] * finalRate * duration) + weightedModel.equation[1];

        // Calculate Weighted Model Error
        const weightedError = stdError(points, weightedModel, finalRate) * (duration / lastPointDuration);

        // Final weighted model
        weightedEstimate = Math.round(weightedPredicted).toLocaleString();
        weightedErrorStr = Math.round(weightedError).toLocaleString();

        weightedEquationStr = `\n\`${+(weightedModel.equation[0] * finalRate * 1000).toFixed(2)} \\*` +
        ` seconds into event + ${+(weightedModel.equation[1]).toFixed(2)}\``;


        // Calculate smoothed result
        let totalWeight = 0;
        let totalTime = 0;

        //Stores error
        let errorSmoothed = 0;

        // Grab 1 Estimate Every 60 Minutes For Smoothing
        const smoothingPoints: number[][] = [];

        rankData.slice(halfDayIdx, oneDayIdx).forEach((point) => {
            smoothingPoints.push([point.timestamp - event.startAt, point.score]);
        });

        let lastIdx = oneDayIdx;

        for (let i = oneDayIdx; i < lastDayIdx; i += 60) {
            // console.log(`Added ${rankData.slice(lastIdx, i).length} points to the smoothingPts`)
            rankData.slice(lastIdx, i).forEach((point) => {
                smoothingPoints.push([point.timestamp - event.startAt, point.score]);
            });

            lastIdx = i;

            if (smoothingPoints.length === 0) continue; // Skip if no points for smoothing

            // Create a linear regression model with the current data points
            const modelSmoothed = regression.linear(smoothingPoints, { precision: 100 });
            const predictedSmoothed = (modelSmoothed.equation[0] * finalRate * duration) + modelSmoothed.equation[1];

            // Calculate Error
            errorSmoothed = stdError(points, modelSmoothed, finalRate) * (duration / lastPointDuration); // Use modelSmoothed here

            let amtThrough = 0;

            // Calculate the % through the event, we will use this as a weight for the estimation
            // If no indexes then crash and set amtThrough to 0
            if (smoothingPoints.length > 0) {
                amtThrough = (smoothingPoints[smoothingPoints.length - 1][0]) / duration;
            }

            // Total score of all of our estimates with account to weight
            if(!isNaN(predictedSmoothed))
            {
                totalWeight += predictedSmoothed * Math.pow(amtThrough, 2);
            }

            // Total time weights
            totalTime += Math.pow(amtThrough, 2);
        }
        smoothingEstimate = totalTime > 0 ? Math.round(totalWeight / totalTime).toLocaleString() : 'N/A';
        smoothingError = Math.round(errorSmoothed).toLocaleString();
    }


  const eventPercentage = Math.min((timestamp - event.startAt) * 100 / duration, 100);

  //weight consists of 3 lists, percentage, std_dev, and mean
  const weight = weights[tier.toString()];
  let percentage = weight[0];
  let std_dev = weight[1];
  let mean = weight[2];

  let i = bisectLeft(percentage, eventPercentage / 100.0);

  if (i === percentage.length) { // Corrected condition for `i` being out of bounds
    i = percentage.length - 1;
  }

  console.log(`Using weight index ${i}/${percentage.length} for tier ${tier}`);

  // Ensure std_dev and mean arrays are not empty before accessing their last elements
  const finalStdDev = std_dev.length > 0 ? std_dev[std_dev.length - 1] : 0;
  const finalMean = mean.length > 0 ? mean[mean.length - 1] : 0;

  const sigma = (score - mean[i]) / std_dev[i];
  const NormalEstimate = Math.round((sigma * finalStdDev) + finalMean); // Use finalStdDev and finalMean

  const regEquationStr = `\n\`${sigma.toFixed(2)} * ${finalStdDev.toFixed(2)} + ${finalMean.toFixed(2)}\``;


  // Generate the cutoff embed
  const lastHourPtTimeMs = lastHourPt ? lastHourPt.timestamp : timestamp; // Fallback if lastHourPt is undefined
  const lastHourPtScore = lastHourPt ? lastHourPt.score : score; // Fallback

  const lastHourPtTime = (timestamp > event.aggregateAt) ? Math.floor(timestamp / 1000) :
    Math.floor(lastHourPtTimeMs / 1000);
  const lastHourPtSpeed = (timestamp > event.aggregateAt) ? 0 :
    Math.round((score - lastHourPtScore) * 3600000 / (timestamp - lastHourPtTimeMs));


  const cutoffEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${event.name} T${tier} Cutoff Nyaa~`)
    .setDescription(`**Requested:** <t:${Math.floor(timestamp / 1000)}:R>`)
    .setThumbnail(event.banner)
    .addFields(
      {
        name: 'Cutoff Statistics', value: `Points: \`\`${score.toLocaleString()}\`\`\n` +
          `Avg. Speed (Per Hour): \`\`${scorePH.toLocaleString()}/h\`\`\n` +
          `Avg. Speed [<t:${lastHourPtTime}:R> to <t:${Math.floor(timestamp / 1000)}:R>] ` +
          `(Per Hour): \`\`${lastHourPtSpeed.toLocaleString()}/h\`\`\n`
      },
      {
        name: 'Event Information', value: `Ranking Started: <t:${Math.floor(event.startAt / 1000)}:R>\n` +
          `Ranking Ends: <t:${Math.floor(event.aggregateAt / 1000)}:R>\n` +
          `Percentage Through Event: \`\`${+(eventPercentage).toFixed(2)}%\`\`\n`
      })
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user?.displayAvatarURL() || '' }); // Optional chaining

  if (tier < 100) {
    cutoffEmbed.addFields({ name: 'Warning', value: `*${COMMAND.CONSTANTS.PRED_WARNING}*` });
  }

  cutoffEmbed.addFields(
    {
      name: 'Point Estimation (Predictions)',
      value: `Estimated Points: \`\`${noSmoothingEstimate}` +
        ` ± ${noSmoothingError}\`\`\n` +
        ((detailed) ? `*${COMMAND.CONSTANTS.PRED_DESC}*${linEquationStr}\n\n` : '') +
        `Estimated Points (Weighted): \`\`${weightedEstimate}` +
        ` ± ${weightedErrorStr}\`\`\n` +
        ((detailed) ? `*${COMMAND.CONSTANTS.WEIGHT_PRED_DESC}*${weightedEquationStr}\n\n` : '') +
        `Estimated Points (Smoothing): \`\`${smoothingEstimate}` +
        ` ± ${smoothingError}\`\`\n` +
        ((detailed) ? `*${COMMAND.CONSTANTS.SMOOTH_PRED_DESC}*\n\n` : '') +
        `Estimated Points (Normal Dist): \`\`${NormalEstimate.toLocaleString()}\`\`\n` +
        ((detailed) ? `*${COMMAND.CONSTANTS.NORM_PRED_DESC}*${regEquationStr}\n` : '')
    });


  // Add a Naive Estimate if the user requests detailed information
  if (detailed) {
    const naiveEstimate = (oneDayIdx === -1) ? 'N/A' :
      Math.round(score + Math.max((event.aggregateAt - timestamp), 0) * (scorePH / 3600000)).toLocaleString();
    const naiveLastHrEstimate = (oneDayIdx === -1 || !lastHourPt) ? 'N/A' : // Ensure lastHourPt exists
      Math.round(score + Math.max((event.aggregateAt - timestamp), 0) * (lastHourPtSpeed / 3600000)).toLocaleString();

    cutoffEmbed.addFields({
      name: 'Naive Estimation (Predictions)',
      value: `Naive Estimate: \`\`${naiveEstimate}\`\`\n` +
        `*${COMMAND.CONSTANTS.NAIVE_DESC}*\n\n` +
        `Naive Estimate (Last Hour): \`\`${naiveLastHrEstimate}\`\`\n` +
        `*${COMMAND.CONSTANTS.NAIVE_LAST_HR_DESC}*\n`
    });
  }

  await interaction.editReply({
    embeds: [cutoffEmbed]
  });
  }
};

const getWorldLink = (eventId: number): any => { // Type as any for simplicity
  const worldLink: any[] = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json', 'utf8'));
  const filteredWorldLink = worldLink.filter((x) => x.eventId === eventId);

  let idx = -1;
  const currentTime = Date.now();

  filteredWorldLink.forEach((x, i) => {
    if (x.chapterEndAt >= currentTime && x.chapterStartAt <= currentTime) {
      idx = i;
    }
  });

  if (idx === -1) {
    return -1;
  }
  else {
    return filteredWorldLink[idx];
  }
};

const getCharacterName = (characterId: number): string => {
  const gameCharacters: any[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')); // Type as any for simplicity
  const charInfo = gameCharacters.find(char => char.id === characterId); // Use find
  if (charInfo) {
    return `${charInfo.givenName} ${charInfo.firstName}`.trim();
  }
  return 'Unknown Character'; // Fallback
};

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const event = discordClient.getCurrentEvent();
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

    // interaction.options._hoistedOptions[0].value gives the tier
    const tier = interaction.options.getInteger('tier'); // Safely get tier from options

    if (tier === null) { // Handle case where tier is not provided (shouldn't happen with required: true)
        await interaction.editReply({
            embeds: [generateEmbed({
                name: COMMAND.INFO.name,
                content: { type: 'Error', message: 'Please provide a tier.' },
                client: discordClient.client
            })]
        });
        return;
    }

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

    const detailed = interaction.options.getBoolean('detailed') ?? false;
    const chapter = interaction.options.getBoolean('chapter') ?? false;

    try {
      // Otherwise use internal data
      if (chapter && event.eventType === 'world_bloom') {

        if (tier === 1500 || tier === 2500) { // Check if tier is 1500 or 2500
          await interaction.editReply({
            embeds: [generateEmbed({
              name: COMMAND.INFO.name,
              content: {
                type: 'Error',
                message: 'Chapter cutoffs don\'t exist for T1500 or T2500.' // Corrected message
              },
              client: discordClient.client
            })]
          });
          return;
        }

        console.log(`Getting World Link for ${event.id}`);

        const world_link = getWorldLink(event.id);
        if (world_link === -1) {
          await interaction.editReply({
            embeds: [generateEmbed({
              name: COMMAND.INFO.name,
              content: { type: 'Error', message: 'No active World Link chapter found for this event.' },
              client: discordClient.client
            })]
          });
          return;
        }

        const cutoffs: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
          'WHERE (EventID=@eventID AND Tier=@tier)').all({
            eventID: parseInt(`${event.id}${world_link.gameCharacterId}`), // Use template literal for chapter ID
            tier: tier
          }) as CutoffDbEntry[] || []; // Type assertion

        const rankData: RankDataPoint[] = cutoffs.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
        rankData.sort((a, b) => a.timestamp - b.timestamp);

        if (rankData.length === 0) { // Check if no data is returned
            await interaction.editReply({
                embeds: [generateEmbed({
                    name: COMMAND.INFO.name,
                    content: COMMAND.CONSTANTS.NO_DATA_ERR,
                    client: discordClient.client
                })]
            });
            return;
        }

        console.log(rankData.length);

        const chapterEventData: EventData = { // Create a specific event data object for the chapter
            id: event.id, // Original event ID
            name: `${getCharacterName(world_link.gameCharacterId)}'s Chapter`,
            startAt: world_link.chapterStartAt,
            aggregateAt: world_link.chapterEndAt,
            closedAt: world_link.chapterEndAt, // Assuming closedAt is the same as aggregateAt for chapter
            banner: event.banner, // Use parent event banner
            eventType: world_link.eventType, // Use world_link event type
            assetbundleName: event.assetbundleName, // Use parent event assetbundleName
        };

        generateCutoff({
          interaction: interaction,
          event: chapterEventData,
          timestamp: rankData[rankData.length - 1].timestamp,
          tier: tier,
          score: rankData[rankData.length - 1].score,
          rankData: rankData,
          detailed: detailed,
          discordClient: discordClient,
        });
      } else {
        const cutoffs: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
          'WHERE (EventID=@eventID AND Tier=@tier)').all({
            eventID: event.id,
            tier: tier
          }) as CutoffDbEntry[] || []; // Type assertion

        const rankData: RankDataPoint[] = cutoffs.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
        rankData.sort((a, b) => a.timestamp - b.timestamp);

        if (rankData.length === 0) { // Check if no data is returned
            await interaction.editReply({
                embeds: [generateEmbed({
                    name: COMMAND.INFO.name,
                    content: COMMAND.CONSTANTS.NO_DATA_ERR,
                    client: discordClient.client
                })]
            });
            return;
        }

        generateCutoff({
          interaction: interaction,
          event: event,
          timestamp: rankData[rankData.length - 1].timestamp,
          tier: tier,
          score: rankData[rankData.length - 1].score,
          rankData: rankData,
          detailed: detailed,
          discordClient: discordClient
        });
      }
    } catch (err: any) { // Type as any for error
      console.error('Error in cutoff command:', err); // Changed to console.error
      discordClient.logger?.log({ // Optional chaining
        level: 'error',
        timestamp: Date.now(),
        message: `Error parsing JSON data from cutoff: ${err.toString()}` // Convert error to string
      });
      await interaction.editReply({
        embeds: [generateEmbed({
          name: COMMAND.INFO.name,
          content: { type: 'Error', message: 'An unexpected error occurred.' },
          client: discordClient.client
        })]
      });
    }
  }
};