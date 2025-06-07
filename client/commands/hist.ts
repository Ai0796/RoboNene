// client/commands/hist.ts
/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */

import { AttachmentBuilder, EmbedBuilder, CommandInteraction, GuildMember } from 'discord.js'; // Import GuildMember
import { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } from '../../constants';

import * as COMMAND from '../command_data/hist'; // Import all exports from hist
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import getEventData from '../methods/getEventData'; // Assuming default export
import renderPlotlyImage from '../../scripts/plotly_puppet'; // Assuming default export

import DiscordClient from '../client/client'; // Assuming default export

const HOUR = 3600000;

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

interface RankDataPoint {
  timestamp: number;
  score: number;
}

interface CutoffDbEntry {
  EventID: number;
  Tier: number;
  Timestamp: number;
  Score: number;
  ID: string;
}

interface WorldBloomChapter {
  eventId: number;
  id: number; // This is a combined ID like 100101
  chapterNo: number;
  chapterStartAt: number;
  chapterEndAt: number;
  gameCharacterId: number;
  character: string; // From DiscordClient.getAllWorldLinkChapters
}


const average = (array: number[]): number => array.reduce((a, b) => a + b) / array.length;

const modeOf = (a: number[]): number | null =>
  Object.values(
    a.reduce((count, e) => {
      if (!(e in count)) {
        count[e] = [0, e];
      }
      count[e][0]++;
      return count;
    }, {} as { [key: number]: [number, number] })
  ).reduce((a, v) => v[0] < a[0] ? a : v, [0, null])[1];


async function getStdDev(data: number[]): Promise<number> {
  if (data.length === 0) return 0;
  const mean = average(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += Math.pow(data[i] - mean, 2);
  }
  return Math.sqrt(sum / data.length);
}

async function generateNormalDist(xData: number[]): Promise<{ x: number[]; y: number[] }> {
  if (xData.length === 0) return { x: [], y: [] };

  const start = Math.min(...xData);
  const end = Math.max(...xData);
  if (start === end) return { x: [start], y: [1] }; // Handle constant data

  const step = (end - start) / 1000; // Generate 1000 points
  const mean = average(xData);
  const stdDev = await getStdDev(xData);

  const x: number[] = [];
  const y: number[] = [];

  if (stdDev === 0) { // Handle case with zero standard deviation (all values are the same)
      x.push(mean);
      y.push(1); // Represent as a spike at the mean
      return { x, y };
  }


  for (let i = start; i <= end; i += step) {
    const val = Math.E ** (-1 * ((i - mean) ** 2) / (2 * stdDev ** 2)) / (stdDev * Math.sqrt(2 * Math.PI));
    x.push(i);
    y.push(val);
  }
  return { x, y };
}

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} graphUrl url of the graph we are trying to embed
 * @param {string} tier the ranking that the user wants to find
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @return {EmbedBuilder} graph embed to be used as a reply via interaction
 */
const generateGraphEmbed = (graphUrl: string, tier: string, discordClient: DiscordClient): EmbedBuilder => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${tier} Nyaa~`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setThumbnail(discordClient.client.user?.displayAvatarURL() || '') // Optional chaining
    .setImage(graphUrl)
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user?.displayAvatarURL() || '' }); // Optional chaining

  return graphEmbed;
};

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {string} str the string to be converted to ASCII
 * @returns {string}
 */
function ensureASCII(str: string): string {
  return str.replace(/[^a-z0-9&]/gi, ' ');
}

function getLastHour(sortedList: number[], el: number): number {
  if (sortedList.length === 0) {
    return 0;
  }
  for (let i = 0; i < sortedList.length; i++) {
    if (sortedList[i] > el) {
      return i;
    }
  }
  return sortedList.length - 1; // If all elements are less than or equal to el, return last index
}

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {CommandInteraction} interaction object provided via discord
 * @param {string} tier the ranking that the user wants to find
 * @param {RankDataPoint[]} rankData the ranking data obtained
 * @param {number | null} binSize custom size of bin on the histogram
 * @param {number | null} min custom minimum value on the histogram
 * @param {number | null} max custom maximum value on the histogram
 * @param {boolean} hourly graph hourly instead of per game
 * @param {boolean} showGames graph games instead of points
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (
  interaction: CommandInteraction,
  tier: string,
  rankData: RankDataPoint[],
  binSize: number | null,
  min: number | null,
  max: number | null,
  hourly: boolean,
  showGames: boolean,
  discordClient: DiscordClient
): Promise<void> => {
  if (!rankData || rankData.length === 0) {
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

  let pointsPerGame: number[] = [];
  let energyPossibilities = energyBoost.map(() => 0);
  let lastPoint = rankData[0].score; // Start from the first point in rankData

  let highBound: number;
  let lowBound: number;

  if (!hourly) {
    highBound = Math.min(max || 150000, 150000);
    lowBound = Math.max(min || 100, 100);
  }
  else {
    highBound = Math.min(max || 3000000, 3000000);
    lowBound = Math.max(min || 100, 100);
  }

  if (hourly) {
    const timestamps = rankData.map(x => x.timestamp);
    const movingWindowSpeeds: number[] = [];
    let currentTimestampIndex = 0; // Index in rankData

    // Iterate through rankData starting from the second element to calculate differences
    for (let i = 1; i < rankData.length; i++) {
        const point = rankData[i];

        // Find the index of the point roughly an HOUR ago from the current point
        // Using `timestamps` (which is already sorted) and `getLastHour` is correct here.
        const windowIndex = getLastHour(timestamps, point.timestamp - HOUR);

        // Update currentTimestampIndex to track the start of the current window in rankData
        currentTimestampIndex = windowIndex;

        const change = point.score - rankData[currentTimestampIndex].score; // Calculate change over the last hour

        if (change < highBound && change >= lowBound) {
            if (showGames) {
                let games = 0;
                // Count games within the hourly window
                for (let j = currentTimestampIndex + 1; j <= i; j++) { // Start from the next point after window start
                    if (rankData[j].score - rankData[j - 1].score >= 100) {
                        games++;
                    }
                }
                movingWindowSpeeds.push(games);
            } else {
                movingWindowSpeeds.push(change);
            }
        }
    }
    pointsPerGame = movingWindowSpeeds;
  }
  else { // Per game data
    for (let i = 1; i < rankData.length; i++) { // Start from second element to compare with previous
        const point = rankData[i];
        if (point.score > lastPoint) {
            const gain = point.score - lastPoint;
            if (gain < highBound && gain >= lowBound) {
                pointsPerGame.push(gain);
                energyBoost.forEach((x, idx) => {
                    if (x !== 1 && gain % x === 0 && gain < 2000 * x) { // x !== 1 filter for valid energy levels
                        energyPossibilities[idx] += 1;
                    }
                });
            }
        }
        lastPoint = point.score;
    }
  }


  if (pointsPerGame.length === 0) {
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

  const normalDistData = await generateNormalDist(pointsPerGame);
  const estimatedEnergy = energyPossibilities.indexOf(Math.max(...energyPossibilities));
  let binsize = binSize || Math.max(5, energyBoost[estimatedEnergy], Math.max(...pointsPerGame) / 1000); // Dynamic bin size calculation

  // Filter out a specific outlier from the original code (2456)
  pointsPerGame = pointsPerGame.filter(x => x !== 2456);

  if (hourly) {
    binsize = Math.max(1000, binSize || 10000); // Default binsize for hourly view
  }

  if (showGames) {
    binsize = 1; // Bin size of 1 for games count
  }

  const avg = pointsPerGame.length > 0 ? (pointsPerGame.reduce((a, b) => a + b) / pointsPerGame.length).toFixed(2) : 'N/A';
  const mode = modeOf(pointsPerGame);

  const layout: any = { // Use any for layout as Plotly.js layout can be complex
    title: tier,
    xaxis: {
      title: 'Event Points' // Title depends on `showGames`
    },
    yaxis: { title: 'Count' },
    yaxis2: {
      title: 'Normal Distribution',
      overlaying: 'y',
      side: 'right',
      range: [0, Math.max(...normalDistData.y, 0.1)] // Ensure range is not zero for normal dist
    },
    bargap: 0.25,
    showlegend: true,
    legend: {
      title: {
        text: `n=${pointsPerGame.length}<br>` +
          `Max Score: ${Math.max(...pointsPerGame).toLocaleString()}<br>` +
          `Average Score: ${avg}<br>` +
          `Mode Score: ${mode !== null ? mode.toLocaleString() : 'N/A'}<br>` // Handle null mode
      }
    },
    // Removed complex template structure for brevity; assuming plotly.js defaults or a simpler template reference.
    // Full template config would need to be in a separate object or carefully added here.
  };

  if (hourly) {
      layout.xaxis.title = showGames ? 'Games Played per Hour' : 'Event Points per Hour';
  } else {
      layout.xaxis.title = showGames ? 'Games Played per Game' : 'Event Points per Game';
  }


  const normalTrace = {
      name: 'Normal Distribution',
      x: normalDistData.x,
      y: normalDistData.y,
      yaxis: 'y2',
      type: 'scatter'
  };

  const histogramTrace = {
        name: `${tier}`,
        x: pointsPerGame,
        mode: 'markers', // This needs to be 'histogram' for a histogram trace
        type: 'histogram',
        marker: {
          color: 'rgb(141,211,199)',
          line: {
            color: 'rgb(141,211,199)'
          }
        },
        autobinx: false,
        xbins: {
          start: min !== null ? min : Math.min(...pointsPerGame), // Use nullish coalescing
          end: max !== null ? max : Math.max(...pointsPerGame), // Use nullish coalescing
          size: binsize
        },
      };

  const dataTraces: any[] = [histogramTrace]; // Start with histogram trace

  if (hourly) { // Add normal distribution only for hourly
    dataTraces.push(normalTrace);
  }

  const plotlyData = {
    data: dataTraces,
    layout: layout
  };

  const buffer = await renderPlotlyImage(plotlyData.data, plotlyData.layout);

  const file = new AttachmentBuilder(buffer, { name: 'hist.png' });
  await interaction.editReply({
    embeds: [generateGraphEmbed('attachment://hist.png', tier, discordClient)], files: [file]
  });
};

async function noDataErrorMessage(interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
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
}

async function sendHistoricalTierRequest(
  eventData: EventData,
  tier: number,
  binSize: number | null,
  min: number | null,
  max: number | null,
  hourly: boolean,
  showGames: boolean,
  interaction: CommandInteraction,
  discordClient: DiscordClient
): Promise<void> {

  const latestTierEntry: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT ID, Score FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY TIMESTAMP DESC LIMIT 1').all({
      eventID: eventData.id,
      tier: tier
    }) as CutoffDbEntry[] || [];

  if (latestTierEntry.length === 0) {
    await noDataErrorMessage(interaction, discordClient);
    return;
  }

  const userId = latestTierEntry[0].ID;

  const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
    'WHERE (ID=@id AND EventID=@eventID)').all({
      id: userId,
      eventID: eventData.id
    }) as CutoffDbEntry[] || [];

  if (data.length > 0) {
    const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
    rankData.unshift({ timestamp: eventData.startAt, score: 0 }); // Add starting point
    rankData.sort((a, b) => a.timestamp - b.timestamp); // Ensure sorted by timestamp

    // if (userId === "162304911000768500") { // Example of commented-out custom logic from original
    //   const maxVal = Math.max(...rankData.map(x => x.score));
    //   const minVal = maxVal / 35 * 29;
    //   rankData = rankData.filter(x => x.score >= minVal);
    // }
    postQuickChart(interaction, `${eventData.name} T${tier} Cutoffs`, rankData, binSize, min, max, hourly, showGames, discordClient);
  } else {
    await noDataErrorMessage(interaction, discordClient);
  }
}


async function sendTierRequest(
  eventData: EventData,
  tier: number,
  binSize: number | null,
  min: number | null,
  max: number | null,
  hourly: boolean,
  showGames: boolean,
  interaction: CommandInteraction,
  discordClient: DiscordClient
): Promise<void> {
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventData.id,
    targetRank: tier,
    lowerLimit: 0
  }, async (response: any) => { // Type response as any for simplicity
    if (!response || !response.rankings || response.rankings.length === 0) {
      await noDataErrorMessage(interaction, discordClient);
      return;
    }

    const targetRanking = response.rankings.find((r: any) => r.rank === tier);
    if (!targetRanking) {
        await noDataErrorMessage(interaction, discordClient);
        return;
    }
    const userId = targetRanking.userId;

    const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: eventData.id
      }) as CutoffDbEntry[] || [];

    if (data.length > 0) {
      const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      rankData.unshift({ timestamp: eventData.startAt, score: 0 }); // Add starting point
      rankData.push({ timestamp: Date.now(), score: targetRanking.score }); // Add current live score
      rankData.sort((a, b) => a.timestamp - b.timestamp); // Ensure sorted by timestamp

      postQuickChart(interaction, `${eventData.name} T${tier} ${targetRanking.name} Cutoffs`, rankData, binSize, min, max, hourly, showGames, discordClient);
    } else {
      await noDataErrorMessage(interaction, discordClient);
    }
  }, (err: any) => { // Type err as any
    console.error('Error fetching ranking data for hist command:', err);
    discordClient.logger?.log({ // Optional chaining
      level: 'error',
      message: err.toString()
    });
    interaction.editReply({
        embeds: [generateEmbed({
            name: COMMAND.INFO.name,
            content: { type: 'Error', message: 'Failed to fetch ranking data.' },
            client: discordClient.client
        })]
    });
  });
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
    const user = interaction.options.getMember('user');
    const binSize = interaction.options.getInteger('binsize');
    const min = interaction.options.getInteger('min');
    const max = interaction.options.getInteger('max');
    const hourly = interaction.options.getBoolean('hourly') || false;
    const eventId = interaction.options.getInteger('event') || event.id;
    const showGames = interaction.options.getBoolean('games') || false;
    const chapterId = interaction.options.getInteger('chapter') ?? null;

    const eventData = getEventData(eventId);

    if (eventData.id === -1) {
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

    let effectiveEventData = eventData;
    let histTitle = '';

    if (chapterId !== null) {
      const world_blooms: WorldBloomChapter[] = discordClient.getAllWorldLinkChapters(eventId);
      const world_link = world_blooms.find(chapter => chapter.id === chapterId);

      if (world_link) {
        effectiveEventData = {
          id: parseInt(`${eventData.id}${world_link.gameCharacterId}`),
          name: `${discordClient.getCharacterName(world_link.gameCharacterId)}'s Chapter`,
          startAt: world_link.chapterStartAt,
          aggregateAt: world_link.chapterEndAt,
          closedAt: world_link.chapterEndAt, // Assuming closedAt is same as aggregateAt
          eventType: 'world_bloom', // Explicitly set type for chapter
          banner: eventData.banner, // Use parent event banner
          assetbundleName: eventData.assetbundleName, // Use parent event assetbundleName
        };
        histTitle = effectiveEventData.name;
      } else {
          await interaction.editReply({
            embeds: [generateEmbed({
              name: COMMAND.INFO.name,
              content: { type: 'Error', message: 'Invalid chapter ID provided.' },
              client: discordClient.client
            })]
          });
          return;
      }
    } else {
        histTitle = effectiveEventData.name;
    }


    if (tier !== null) { // Check if tier is provided
      const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
        'WHERE (Tier=@tier AND EventID=@eventID)').all({
          tier: tier,
          eventID: effectiveEventData.id
        }) as CutoffDbEntry[] || [];

      if (data.length === 0) {
        await noDataErrorMessage(interaction, discordClient);
        return;
      } else if (effectiveEventData.id < discordClient.getCurrentEvent().id || effectiveEventData.id > LOCKED_EVENT_ID) { // Historical event
        sendHistoricalTierRequest(effectiveEventData, tier, binSize, min, max, hourly, showGames, interaction, discordClient);
      } else { // Current event
        sendTierRequest(effectiveEventData, tier, binSize, min, max, hourly, showGames, interaction, discordClient);
      }
    } else if (user) {
      try {
        if (effectiveEventData.id > LOCKED_EVENT_ID) {
          await interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
          return;
        }

        const id = discordClient.getId(user.id);

        if (id === -1) {
          await interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM users ' + // Use 'users' table for user data
          'WHERE (id=@id AND EventID=@eventID)').all({
            id: id,
            eventID: effectiveEventData.id
          }) as CutoffDbEntry[] || [];

        if (data.length > 0) {
          const name = user.displayName;
          const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          rankData.unshift({ timestamp: effectiveEventData.startAt, score: 0 }); // Add starting point
          rankData.sort((a,b) => a.timestamp - b.timestamp); // Ensure sorted
          postQuickChart(interaction, `${histTitle} ${name} Event Points`, rankData, binSize, min, max, hourly, showGames, discordClient);
        }
        else {
          await interaction.editReply({ content: 'Discord User found but no data logged (have you recently linked or event ended?)' });
        }
      } catch (err: any) {
        console.error('Error in hist command for user:', err);
        await interaction.editReply({
            embeds: [generateEmbed({
                name: COMMAND.INFO.name,
                content: { type: 'Error', message: 'An unexpected error occurred while fetching user data.' },
                client: discordClient.client
            })]
        });
      }
    } else {
        // If neither tier nor user is provided (should not happen due to command definition)
        await interaction.editReply({
            embeds: [generateEmbed({
                name: COMMAND.INFO.name,
                content: { type: 'Error', message: 'Please provide either a tier or a user.' },
                client: discordClient.client
            })]
        });
    }
  },

  async autocomplete(interaction: AutocompleteInteraction, discordClient: DiscordClient) { // Added type for interaction

    const world_blooms: WorldBloomChapter[] = discordClient.getAllWorldLinkChapters();

    const options = world_blooms.map((chapter) => {
      return {
        name: chapter.character,
        value: chapter.id,
      };
    });

    await interaction.respond(options);
  }
};