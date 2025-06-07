// client/commands/bar.ts
/**
 * @fileoverview Display a heatmap of a given tier or player
 * @author Ai0796
 */

import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, CommandInteraction, InteractionReplyOptions } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';

import * as COMMAND from '../command_data/bar'; // Import all exports from bar
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import getEventData from '../methods/getEventData'; // Assuming default export
import DiscordClient from '../client/client'; // Assuming default export

const HOUR = 3600000;
const EMPTY_BAR = '░';
const FILLED_BAR = '█';
const LEFT_BOUND = '╢';
const RIGHT_BOUND = '╠';
const BAR_WIDTH = 15;

interface RankDataPoint {
  timestamp: number;
  score: number;
}

interface EmbedBodyField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} title title of the embed
 * @param {EmbedBodyField[]} body fields to display in the embed
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @return {EmbedBuilder} graph embed to be used as a reply via interaction
 */
const generateBarEmbed = (title: string, body: EmbedBodyField[], discordClient: DiscordClient): EmbedBuilder => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${title} Nyaa~`)
    .setFields(body)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setThumbnail(discordClient.client.user?.displayAvatarURL() || '') // Optional chaining
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user?.displayAvatarURL() || '' }); // Optional chaining

  return graphEmbed;
};

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {String} str the string to be converted to ASCII
 * @returns {string}
 */
function ensureASCII(str: string): string {
  return str.replace(/[^a-z0-9&]/gi, ' ');
}

/**
 * Generates a graph using data and returns the image stream
 * @param {RankDataPoint[][]} data the data to be used in the graph, array of arrays of points for each hour
 * @param {number} hour hour to display the graph for
 * @param {number} eventStart event start timestamp
 * @returns {EmbedBodyField} the field object for the embed
 */
const generateGraph = (data: RankDataPoint[][], hour: number, eventStart: number): EmbedBodyField => {

  const formatTime = (timestamp: number): string => {
    let hourVal = timestamp / 1000 / 60 / 60;
    let minute = (hourVal - Math.floor(hourVal)) * 60;
    minute = Math.floor(minute);
    return `${String(minute).padStart(2, '0')}`; // Use padStart for consistent 2-digit minutes
  };

  const formatGraph = (point: number, maxVal: number, minVal: number): string => {
    if (maxVal === minVal) { // Handle case where all points are the same
        return `<span class="math-inline">\{LEFT\_BOUND\}</span>{FILLED_BAR.repeat(BAR_WIDTH)}${RIGHT_BOUND}`;
    }
    let percentage = (point - minVal) / (maxVal - minVal);
    let barLength = Math.floor(percentage * BAR_WIDTH);
    // Ensure at least one filled bar if percentage is > 0 and scale is not collapsed
    if (percentage > 0 && barLength === 0) barLength = 1;
    // Ensure barLength doesn't exceed BAR_WIDTH
    if (barLength > BAR_WIDTH) barLength = BAR_WIDTH;

    let bar = LEFT_BOUND;
    for (let i = 0; i < BAR_WIDTH; i++) {
      if (i < barLength) {
        bar += FILLED_BAR;
      } else {
        bar += EMPTY_BAR;
      }
    }
    bar += RIGHT_BOUND;
    return bar;
  };

  if (hour < 0 || hour >= data.length || !data[hour] || data[hour].length === 0) { // Check for valid index and non-empty array
    return { name: `Games Hour ${hour} (No Data)`, value: 'No data available for this hour.' }; // Adjust label for no data
  }

  const currentHourData = data[hour];
  let lines: string[] = [];

  let maxPoints = currentHourData.reduce((max, p) => Math.max(max, p.score), -Infinity);
  let minPoints = currentHourData.reduce((min, p) => Math.min(min, p.score), Infinity);

  // Handle case where minPoints or maxPoints might remain Infinity (if array empty, though checked above)
  if (currentHourData.length > 0 && (maxPoints === -Infinity || minPoints === Infinity)) {
      maxPoints = currentHourData[0].score;
      minPoints = currentHourData[0].score;
  }
  
  currentHourData.forEach((point) => {
    lines.push(`\`${formatTime(point.timestamp - eventStart)} ${formatGraph(point.score, maxPoints, minPoints)} ${point.score.toLocaleString()}\``);
  });

  return { name: `Games Hour <span class="math-inline">\{hour\} \(</span>{currentHourData.length} Games)`, value: lines.join('\n') }; // Changed label from hour-1 to hour
};

const sendBarEmbed = async (interaction: CommandInteraction, data: EmbedBodyField, tier: string, component: ActionRowBuilder<ButtonBuilder> | null, discordClient: DiscordClient): Promise<void> => {
  let embed = generateBarEmbed(tier, [data], discordClient);

  await interaction.editReply({
    embeds: [embed],
    components: component ? [component] : [],
    fetchReply: true
  } as InteractionReplyOptions); // Type assertion for options
};

const sendUpdate = async (i: any, data: EmbedBodyField, tier: string, discordClient: DiscordClient): Promise<void> => { // Type i as any for simplicity on interaction collector
  let embed = generateBarEmbed(tier, [data], discordClient);

  await i.update({
    embeds: [embed]
  });
};

const formatTitle = (tier: number | string, hourNum: number, eventStart: number): string => {
  const hourStartDate = new Date(eventStart + hourNum * HOUR);
  const hourEndDate = new Date(eventStart + (hourNum + 1) * HOUR);

  const hourString = `<t:<span class="math-inline">\{Math\.floor\(hourStartDate\.getTime\(\) / 1000\)\}\:f\> \- <t\:</span>{Math.floor(hourEndDate.getTime() / 1000)}:f>`;
  const title = `T${tier} EP per Game\n\n${hourString}`; // Adjusted title
  return title;
};

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {CommandInteraction} interaction object provided via discord
 * @param {number | string} tier the ranking that the user wants to find
 * @param {RankDataPoint[]} rankData the ranking data obtained
 * @param {any} eventData the event data
 * @param {number | null} hour hour to display the graph for
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 */
const postQuickChart = async (interaction: CommandInteraction, tier: number | string, rankData: RankDataPoint[], eventData: any, hour: number | null, discordClient: DiscordClient): Promise<void> => {
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

  tier = ensureASCII(String(tier)); // Ensure tier is string and ASCII

  let lastPoint = 0;
  let pointsPerGame: RankDataPoint[] = [];

  rankData.forEach(point => {
    if (point.score > lastPoint) {
      // Assuming a "game" is defined by a score increase
      pointsPerGame.push({ timestamp: point.timestamp, score: point.score - lastPoint });
      lastPoint = point.score;
    }
  });

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

  let xData: RankDataPoint[][] = []; // Array of arrays of points for each hour
  let currentHourGames: RankDataPoint[] = [];
  let maxTimestamp = eventData.startAt + HOUR;

  // Filter out data points before event start
  const filteredRankData = rankData.filter(p => p.timestamp >= eventData.startAt);
  lastPoint = filteredRankData.length > 0 ? filteredRankData[0].score : 0;


  for (let i = 0; i < filteredRankData.length; i++) {
    const point = filteredRankData[i];
    if (point.timestamp > eventData.aggregateAt) { // Stop processing if past aggregate time
      break;
    }
    while (point.timestamp > maxTimestamp) {
      xData.push(currentHourGames);
      currentHourGames = [];
      maxTimestamp += HOUR;
    }
    if (point.score > lastPoint) {
      const gain = point.score - lastPoint;
      if (gain >= 100) { // Assuming a gain of at least 100 is a "game"
        currentHourGames.push({ score: gain, timestamp: point.timestamp });
      }
    }
    lastPoint = point.score;
  }
  // Add any remaining games in the last hour
  if (currentHourGames.length > 0) {
    xData.push(currentHourGames);
  }

  let lastHourWithGame = xData.length > 0 ? xData.length - 1 : 0;
  for(let i = xData.length - 1; i >= 0; i--){ // Find the last hour that actually has games
      if(xData[i].length > 0){
          lastHourWithGame = i;
          break;
      }
  }


  let currentHourIdx = hour ?? lastHourWithGame; // Use the last hour with data if no hour is specified

  const barButtons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('PREV')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(COMMAND.CONSTANTS.LEFT),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('NEXT')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(COMMAND.CONSTANTS.RIGHT)
    );

  // Initial reply with loading state
  const barEmbedMessage = await interaction.editReply({
    content: 'Loading...',
    fetchReply: true // Ensure we get the message object back
  });

  const dataForEmbed = generateGraph(xData, currentHourIdx, eventData.startAt);
  await sendBarEmbed(interaction, dataForEmbed, formatTitle(tier, currentHourIdx, eventData.startAt),
    barButtons, discordClient);

  const filter = (i: any) => { // Type as any for simplicity on interaction collector
    return i.customId === 'prev' || i.customId === 'next';
  };

  const collector = barEmbedMessage.createMessageComponentCollector({
    filter,
    time: COMMAND.CONSTANTS.INTERACTION_TIME
  });

  // Collect user interactions with the prev / next buttons
  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        embeds: [
          generateEmbed({
            name: COMMAND.INFO.name,
            content: COMMAND.CONSTANTS.WRONG_USER_ERR,
            client: discordClient.client
          })
        ],
        ephemeral: true
      });
    } else {
      if (i.customId === 'prev') {
        currentHourIdx--;
      } else if (i.customId === 'next') {
        currentHourIdx++;
      }

      // Clamp hour index
      if (currentHourIdx < 0) {
        currentHourIdx = 0;
      } else if (currentHourIdx >= xData.length) {
        currentHourIdx = xData.length - 1;
      }

      const updatedDataForEmbed = generateGraph(xData, currentHourIdx, eventData.startAt);
      await sendUpdate(i, updatedDataForEmbed, formatTitle(tier, currentHourIdx, eventData.startAt), discordClient);
    }
  });

  collector.on('end', async () => {
    const finalDataForEmbed = generateGraph(xData, currentHourIdx, eventData.startAt);
    await sendBarEmbed(interaction, finalDataForEmbed, formatTitle(tier, currentHourIdx, eventData.startAt), null, discordClient); // Remove buttons
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

interface CutoffDbEntry {
  EventID: number;
  Tier: number;
  Timestamp: number;
  Score: number;
  ID: string; // Assuming ID is string
  GameNum?: number; // Optional GameNum
}


async function sendHistoricalTierRequest(eventData: EventData, tier: number, interaction: CommandInteraction, hour: number | null, discordClient: DiscordClient): Promise<void> {

  // Fetch the latest entry for this tier to get the user ID
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
    const title = `<span class="math-inline">\{eventData\.name\} T</span>{tier} Heatmap`; // Title based on event name and tier

    // Assuming rankData needs to be sorted chronologically
    rankData.sort((a, b) => a.timestamp - b.timestamp);

    postQuickChart(interaction, title, rankData, eventData, hour, discordClient);

  } else {
    await noDataErrorMessage(interaction, discordClient);
  }
}

async function sendTierRequest(eventData: EventData, tier: number, interaction: CommandInteraction, hour: number | null, discordClient: DiscordClient): Promise<void> {
  // Use SekaiClient to get current ranking for the specified tier
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventData.id,
    targetRank: tier,
    lowerLimit: 0 // Fetch around the target rank
  }, async (response: any) => { // Type response as any for simplicity
    if (!response || !response.rankings || response.rankings.length === 0) {
      await noDataErrorMessage(interaction, discordClient);
      return;
    }

    // Find the specific user data for the requested tier
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
      // Add current live data point
      rankData.push({ timestamp: Date.now(), score: targetRanking.score });
      rankData.sort((a, b) => a.timestamp - b.timestamp);

      const title = `<span class="math-inline">\{eventData\.name\} T</span>{tier} ${targetRanking.name} Games Played`; // Adjusted title
      postQuickChart(interaction, title, rankData, eventData, hour, discordClient);

    } else {
      await noDataErrorMessage(interaction, discordClient);
    }
  }, (err: any) => {
    console.error('Error fetching ranking data for bar command:', err);
    discordClient.logger?.log({
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
    const eventId = interaction.options.getInteger('event') || event.id;
    const hour = interaction.options.getInteger('hour');

    const eventData = getEventData(eventId);
    // const eventName = eventData.name; // Unused variable in TS conversion, but keeping for context

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

    if (tier !== null) { // Check if tier is provided
      // Fetch historical data for tier or current live data
      const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
        'WHERE (Tier=@tier AND EventID=@eventID)').all({
          tier: tier,
          eventID: eventId
        }) as CutoffDbEntry[] || [];

      if (data.length === 0) {
        await noDataErrorMessage(interaction, discordClient);
        return;
      }
      else if (eventId < discordClient.getCurrentEvent().id) { // Historical event
        // We already have the data, send it directly
        const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
        rankData.sort((a,b) => a.timestamp - b.timestamp);
        postQuickChart(interaction, tier, rankData, eventData, hour, discordClient);
      }
      else { // Current event, fetch live data first
        sendTierRequest(eventData, tier, interaction, hour, discordClient);
      }
    } else if (user) {
      try {
        const id = discordClient.getId(user.id);

        if (id === -1) {
          await interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM users ' +
          'WHERE (id=@id AND EventID=@eventID)').all({
            id: id,
            eventID: eventId
          }) as CutoffDbEntry[] || [];

        if (data.length > 0) {
          const name = user.displayName;
          const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          rankData.sort((a,b) => a.timestamp -