// client/commands/bar.ts
/**
 * @fileoverview Display a bar graph displaying the EP gain over a certain hour
 * @author Ai0796
 */

import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, CommandInteraction, MessageComponentInteraction, GuildMember } from 'discord.js'; // Import necessary types
import { NENE_COLOR, FOOTER } from '../../constants';

// Assuming command_data/bar.ts has been converted and exported properly
import * as COMMAND from '../command_data/bar';
import generateSlashCommand from '../methods/generateSlashCommand';
import generateEmbed from '../methods/generateEmbed';
import getEventData from '../methods/getEventData'; // Assuming getEventData.ts is converted
import DiscordClient from '../client'; // Assuming default export

const HOUR = 3600000; // milliseconds in an hour
const EMPTY_BAR = '░';
const FILLED_BAR = '█';
const LEFT_BOUND = '╢';
const RIGHT_BOUND = '╠';
const BAR_WIDTH = 15;

interface RankDataPoint {
  timestamp: number;
  score: number;
}

interface EventData {
  id: number;
  name: string;
  startAt: number;
  aggregateAt: number;
  closedAt: number;
  eventType: string;
  assetbundleName: string;
  banner?: string;
}

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} title title of the embed
 * @param {Array<Object>} body fields for the embed
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @return {EmbedBuilder} graph embed to be used as a reply via interaction
 */
const generateBarEmbed = (title: string, body: { name: string; value: string; inline?: boolean }[], discordClient: DiscordClient): EmbedBuilder => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${title} Nyaa~`)
    .setFields(body)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setThumbnail(discordClient.client.user?.displayAvatarURL() || '') // Optional chaining for user
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user?.displayAvatarURL() || '' }); // Optional chaining for user

  return graphEmbed;
};

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {string} str the string to be converted to ASCII 
 * @returns {string}
 */
function ensureASCII(str: string): string {
  return str.replace(/[^a-zA-Z0-9&]/gi, ' ');
}

/**
 * Generates a graph visualization using text bars for a specific hour of data
 * @param {RankDataPoint[][]} data the data, grouped by hour
 * @param {number} hour hour index to display the graph for
 * @param {number} eventStart event start timestamp to calculate relative time
 * @returns {{ name: string, value: string }} The field object for the embed
 */
const generateGraph = (data: RankDataPoint[][], hour: number, eventStart: number): { name: string, value: string } => {

  const formatTime = (timestamp: number): string => {
    const timeRelativeToStart = timestamp - eventStart;
    const hours = Math.floor(timeRelativeToStart / (1000 * 60 * 60));
    const minutes = Math.floor((timeRelativeToStart % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(minutes).padStart(2, '0')}`; // Use padStart for consistent formatting
  };

  const formatBar = (point: number, maxVal: number, minVal: number): string => {
    if (maxVal === minVal) { // Handle case where all scores in the hour are the same
      return `${LEFT_BOUND}${FILLED_BAR.repeat(BAR_WIDTH)}${RIGHT_BOUND}`;
    }
    const percentage = (point - minVal) / (maxVal - minVal);
    const barLength = Math.floor(percentage * BAR_WIDTH); // Adjusted to not add +1 immediately
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

  if (hour < 0 || hour >= data.length || !data[hour] || data[hour].length === 0) {
    return { name: 'Error', value: 'No data available for this hour.' };
  }

  const currentHourData = data[hour];
  const lines: string[] = [];

  const maxPoints = Math.max(...currentHourData.map(point => point.score));
  const minPoints = Math.min(...currentHourData.map(point => point.score));

  currentHourData.forEach((point) => {
    lines.push(`\`${formatTime(point.timestamp)} ${formatBar(point.score, maxPoints, minPoints)} ${point.score.toLocaleString()}\``);
  });

  return { name: `Games Hour ${hour} (${currentHourData.length} Games)`, value: lines.join('\n') }; // Changed hour-1 to hour as it's an index
};

async function sendBarEmbed(interaction: CommandInteraction, data: { name: string; value: string }, tierTitle: string, component: ActionRowBuilder<ButtonBuilder> | null, discordClient: DiscordClient): Promise<void> {
  const embed = generateBarEmbed(tierTitle, [data], discordClient);

  await interaction.editReply({
    embeds: [embed],
    components: component ? [component] : [], // Only send components if provided
  });
}

const formatTitle = (tier: number | string, hourNum: number, eventStart: number): string => {
  const hourStart = (eventStart + hourNum * HOUR) / 1000;
  const hourEnd = (eventStart + (hourNum + 1) * HOUR) / 1000;

  const hourString = `<t:${Math.floor(hourStart)}:f> - <t:${Math.floor(hourEnd)}:f>`;
  const title = `T${tier} Cutoff Activity\n\n${hourString}`; // Updated title format
  return title;
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

async function sendHistoricalTierRequest(eventData: EventData, tier: number, interaction: CommandInteraction, hour: number | null, discordClient: DiscordClient): Promise<void> {

  const response = discordClient.cutoffdb?.prepare('SELECT ID, Score FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY Timestamp DESC').all({ // Order by Timestamp DESC to get most recent ID for the tier
      eventID: eventData.id,
      tier: tier
    }) as { ID: string, Score: number }[] | undefined;

  if (response && response.length > 0) {
    const userId = response[0].ID; // Get the most recent ID for the tier

    const data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID) ORDER BY Timestamp ASC').all({
        id: userId,
        eventID: eventData.id
      }) as RankDataPoint[] | undefined;

    if (data && data.length > 0) {
      await postQuickChart(interaction, `T${tier} Historical Activity`, data, eventData, hour, discordClient);
    } else {
      noDataErrorMessage(interaction, discordClient);
    }
  } else {
    noDataErrorMessage(interaction, discordClient);
  }
}

async function sendTierRequest(eventData: EventData, tier: number, interaction: CommandInteraction, hour: number | null, discordClient: DiscordClient): Promise<void> {
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventData.id,
    targetRank: tier,
    lowerLimit: 0
  }, async (response: any) => { // Type response as any for API response
    if (!response || !response.rankings || !response.rankings[tier - 1]) {
      const reply = 'Could not retrieve ranking data. Please try again later.';
      const title = 'Error';
      await interaction.editReply({
        embeds: [generateEmbed({ name: title, content: { type: 'ERROR', message: reply }, client: discordClient.client })]
      });
      return;
    }

    const userId = response.rankings[tier - 1].userId; // Get the specific tier's userID

    const data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID) ORDER BY Timestamp ASC').all({
        id: userId,
        eventID: eventData.id
      }) as RankDataPoint[] | undefined;

    if (data && data.length > 0) {
      await postQuickChart(interaction, `T${tier} ${response.rankings[tier - 1]?.name || 'Unknown'} Activity`, data, eventData, hour, discordClient);
    } else {
      noDataErrorMessage(interaction, discordClient);
    }
  }, (err: any) => { // Type as any for error
    console.error('Error in sendTierRequest (ranking API call):', err);
    interaction.editReply({
      embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'error', message: err.toString() }, client: discordClient.client })]
    });
  });
}

/**
 * Processes data and generates the bar graph
 * @param {CommandInteraction} interaction discord interaction
 * @param {string | number} tier the ranking or user for the title
 * @param {RankDataPoint[]} rankData raw ranking data points
 * @param {EventData} eventData current event information
 * @param {number | null} initialHour initial hour to display
 * @param {DiscordClient} discordClient the client
 */
const postQuickChart = async (interaction: CommandInteraction, tier: string | number, rankData: RankDataPoint[], eventData: EventData, initialHour: number | null, discordClient: DiscordClient): Promise<void> => {
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

  let lastPoint = 0;
  const dataByHour: RankDataPoint[][] = []; // Array of arrays, each sub-array for an hour's games

  let currentHourStartTime = eventData.startAt;
  let currentHourGames: RankDataPoint[] = [];

  rankData.forEach(point => {
    // Skip points before event start (if any artifacts exist)
    if (point.timestamp < eventData.startAt) {
      lastPoint = point.score; // Update lastPoint even for skipped points
      return;
    }

    // Advance hour buckets if needed
    while (point.timestamp >= currentHourStartTime + HOUR) {
        dataByHour.push(currentHourGames);
        currentHourGames = [];
        currentHourStartTime += HOUR;
    }

    if (point.score > lastPoint) {
      const gain = point.score - lastPoint;
      // Only include valid "games" (score gain >= 100)
      if (gain >= 100 && gain < 150000) { // Limit max gain per game to prevent outliers
        currentHourGames.push({ score: gain, timestamp: point.timestamp });
      }
    }
    lastPoint = point.score;
  });
  // Push any remaining games for the last hour
  if (currentHourGames.length > 0) {
    dataByHour.push(currentHourGames);
  }

  // Determine the default hour to show (last hour with data)
  let currentHourIdx = initialHour !== null ? initialHour : dataByHour.length - 1;
  // Clamp hourIdx to valid range
  currentHourIdx = Math.max(0, Math.min(currentHourIdx, dataByHour.length - 1));

  // If no data points for any hour, or all hours are empty
  if (dataByHour.length === 0 || dataByHour.every(h => h.length === 0)) {
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

  const initialDataForEmbed = generateGraph(dataByHour, currentHourIdx, eventData.startAt);
  const initialTitle = formatTitle(tier, currentHourIdx, eventData.startAt);

  const sentMessage = await interaction.editReply({
    embeds: [generateBarEmbed(initialTitle, [initialDataForEmbed], discordClient)],
    components: [barButtons]
  });


  const collector = sentMessage.createMessageComponentCollector({
    filter: (i: MessageComponentInteraction) => {
      return (i.customId === 'prev' || i.customId === 'next');
    },
    time: COMMAND.CONSTANTS.INTERACTION_TIME
  });

  collector.on('collect', async (i: MessageComponentInteraction) => {
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
      return;
    }

    if (i.customId === 'prev') {
      currentHourIdx--;
    } else if (i.customId === 'next') {
      currentHourIdx++;
    }

    // Clamp hourIdx to valid range
    currentHourIdx = Math.max(0, Math.min(currentHourIdx, dataByHour.length - 1));

    const updatedDataForEmbed = generateGraph(dataByHour, currentHourIdx, eventData.startAt);
    const updatedTitle = formatTitle(tier, currentHourIdx, eventData.startAt);

    await i.update({
      embeds: [generateBarEmbed(updatedTitle, [updatedDataForEmbed], discordClient)],
      components: [barButtons]
    });
  });

  collector.on('end', async () => {
    // Re-fetch the final state for the embed without components
    const finalDataForEmbed = generateGraph(dataByHour, currentHourIdx, eventData.startAt);
    const finalTitle = formatTitle(tier, currentHourIdx, eventData.startAt);
    await interaction.editReply({
      embeds: [generateBarEmbed(finalTitle, [finalDataForEmbed], discordClient)],
      components: [] // Remove buttons when collector ends
    });
  });
};

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
    const hour = interaction.options.getInteger('hour'); // This is already number | null

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

    if (tier !== null) { // If tier is provided
      // Check if it's a historical tier (older event or beyond locked ID)
      const isHistorical = eventId < discordClient.getCurrentEvent().id;
      // Note: original code also checked `event.id > LOCKED_EVENT_ID` for historical,
      // but `LOCKED_EVENT_ID` seems to relate to user data storage, not historical display logic.
      // Re-using the same historical logic from other commands.

      if (isHistorical) {
        await sendHistoricalTierRequest(eventData, tier, interaction, hour, discordClient);
      } else {
        await sendTierRequest(eventData, tier, interaction, hour, discordClient);
      }
    } else if (user instanceof GuildMember) { // If user is provided and is a GuildMember
      try {
        const userId = discordClient.getId(user.id);

        if (userId === -1) {
          await interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        const data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM users ' +
          'WHERE (id=@id AND EventID=@eventID) ORDER BY Timestamp ASC').all({
            id: userId,
            eventID: eventId
          }) as RankDataPoint[] | undefined;

        if (data && data.length > 0) {
          const name = user.displayName;
          await postQuickChart(interaction, `${name}'s Activity`, data, eventData, hour, discordClient);
        } else {
          await interaction.editReply({ content: 'Have you tried linking to the bot it\'s not magic ya know' });
        }
      } catch (err: any) {
        console.error('Error fetching user data for bar command:', err);
        await interaction.editReply({ content: 'An unexpected error occurred while fetching user data.' });
      }
    } else { // Neither tier nor user was provided or invalid
        await interaction.editReply({ content: 'Please provide either a tier or a linked user.' });
    }
  }
};