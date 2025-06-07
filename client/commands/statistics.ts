// client/commands/statistics.ts
/**
 * @fileoverview Displays statistics of a user or tier
 * @author Ai0796
 */

import * as COMMAND from '../command_data/statistics'; // Assuming command_data/statistics.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, MessageComponentInteraction, GuildMember, type AutocompleteInteraction } from 'discord.js'; // Import necessary types
import { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } from '../../constants';
import getEventData from '../methods/getEventData'; // Assuming getEventData.ts is converted
import DiscordClient from '../client'; // Assuming default export
import generateEmbed from '../methods/generateEmbed';

const HOUR = 3600000; // milliseconds in an hour

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

interface RankDataPoint {
  timestamp: number;
  score: number;
}

interface EventData {
  id: number;
  name: string;
  startAt: number;
  aggregateAt: number;
  closedAt: number; // Added based on getEventData return type
  eventType: string; // Added based on getEventData return type
  assetbundleName: string; // Added based on getEventData return type
  banner?: string; // Added based on getEventData return type (for consistency)
}

/**
 * Generates an embed from the provided params
 * @param {String} name the name of the command
 * @param {DiscordClient} client the client we are using to handle Discord requests
 * @return {EmbedBuilder} a generated embed
 */
const generateEmbedTemplate = ({ name, client }: { name: string; client: DiscordClient['client'] }): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(name.charAt(0).toUpperCase() + name.slice(1) + ' Nyaa~')
    .setThumbnail(client.user?.displayAvatarURL() || '') // Optional chaining for user
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Optional chaining for user

  return embed;
};

function getLastHour(sortedList: number[], el: number): number {
  if (sortedList.length === 0) {
    return 0;
  }
  for (let i = 0; i < sortedList.length; i++) {
    if (sortedList[i] >= el) {
      return i;
    }
  }
  return sortedList.length - 1; // Return last index if no element is greater
}

function sanityLost(gamesPlayed: number, finalPoint: number): { sanity: string; suffix: number } {
  let sanity = Math.pow(finalPoint, 0.75) * gamesPlayed;
  let sanityNum = 0;
  if (sanity > 0) { // Avoid log(0) or log(negative)
      sanityNum = parseInt(Math.log(sanity) / Math.log(1000));
  }
  sanity /= Math.pow(1000, sanityNum);
  const suffix = sanityNum * 3;
  sanity = parseFloat(sanity.toFixed(6)); // Convert to float after toFixed to remove trailing zeros before toString
  return { sanity: sanity.toString(), suffix: suffix };
}


async function userStatistics(user: GuildMember, eventId: number, eventData: EventData, discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {

  if (eventData.id > LOCKED_EVENT_ID) {
    await interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
    return;
  }

  const id = discordClient.getId(user.id);

  if (id === -1) {
    await interaction.editReply({ content: 'You haven\'t linked to the bot, do you expect GhostNene to just know where you live?' });
    return;
  }

  const data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM users ' +
    'WHERE (id=@id AND EventID=@eventID) ORDER BY Timestamp ASC').all({ // Order by Timestamp to ensure proper data processing
      id: id,
      eventID: eventId
    }) as RankDataPoint[] | undefined; // Type assertion

  if (data && data.length > 0) {
    const title = `${user.displayName} Statistics`;
    await tierStatisticsEmbed(data, title, discordClient, interaction);
  } else {
    await interaction.editReply({ content: 'Discord User found but no data logged (If after Kick it Up a Notch this command won\'t work)' });
  }
}

async function tierStatisticsEmbed(rankData: RankDataPoint[], title: string, discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {
  let lastTimestamp = rankData[rankData.length - 1].timestamp;
  let timestamps = rankData.map(x => x.timestamp);
  timestamps.sort((a, b) => a - b); // Ensure timestamps are sorted for getLastHour

  let lastHourIndex = getLastHour(timestamps, lastTimestamp - HOUR);

  let lastHour = rankData[lastHourIndex];
  let scoreLastHour = rankData[rankData.length - 1].score - lastHour.score;

  let lastPoint = rankData[0].score;

  let gamesPlayed = 0;
  let gamesPlayedHr = 0;
  const pointsPerGame: { points: number; timestamp: number }[] = [];
  const energyPossibilities: number[] = energyBoost.map(() => 0); // Using map to initialize
  const energyPossiblitiesHour: number[] = energyBoost.map(() => 0); // Using map to initialize

  let currentTimestampIndex = 0;
  const movingWindowSpeeds: number[] = [];

  // Iterate over data points starting from the second point
  for (let i = 1; i < rankData.length; i++) {
    const point = rankData[i];
    if (point.score - lastPoint >= 100) { // Only count if score increased by at least 100 (a game)
      const gain = point.score - lastPoint;

      // Update moving window for speeds
      let windowIndex = getLastHour(timestamps, point.timestamp - HOUR);
      // Ensure windowIndex is within bounds for rankData
      windowIndex = Math.min(windowIndex, i);
      movingWindowSpeeds.push(point.score - rankData[windowIndex].score);

      energyBoost.forEach((x, idx) => {
        if (x !== 1 && gain % x === 0 && gain < 2000 * x) { // Check divisibility and reasonable gain
          energyPossibilities[idx] += 1;
          if (point.timestamp >= (lastTimestamp - HOUR)) { // Check if within last hour
            energyPossiblitiesHour[idx] += 1;
          }
        }
      });
      gamesPlayed++;
      pointsPerGame.push({ points: gain, timestamp: Math.floor(point.timestamp / 1000) });
      if (point.timestamp >= (lastTimestamp - HOUR)) { // Check if within last hour
        gamesPlayedHr++;
      }
      lastPoint = point.score;
    }
  }

  const timestamp = Math.floor(rankData[rankData.length - 1].timestamp / 1000);

  const sanity = sanityLost(gamesPlayed, rankData[rankData.length - 1].score);

  const scorePerGame = gamesPlayedHr > 0 ? parseFloat((scoreLastHour / gamesPlayedHr).toFixed(2)) : 0; // Avoid division by zero

  const estimatedEnergy = energyPossibilities.length > 0 ? energyPossibilities.indexOf(Math.max(...energyPossibilities)) : 0;
  const estimatedEnergyHour = energyPossiblitiesHour.length > 0 ? energyPossiblitiesHour.indexOf(Math.max(...energyPossiblitiesHour)) : 0;
  const peakSpeed = movingWindowSpeeds.length > 0 ? Math.max(...movingWindowSpeeds) : 0;


  const embed = generateEmbedTemplate({
    name: title,
    client: discordClient.client
  });

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

  // Mobile version for the condensed view
  let reply = `Current Event Points: ${rankData[rankData.length - 1].score.toLocaleString()}\n` +
    `Event Points Gained in the Last Hour: ${scoreLastHour}\n` +
    `Games Played in the Last Hour: ${gamesPlayedHr} (${gamesPlayed} Total)\n` +
    `Average Score per Game over the hour: ${scorePerGame}\n` +
    `Peak Speed over an hour: ${peakSpeed}\n` +
    `Estimated Energy usage: ${estimatedEnergy}\n` +
    `Estimated Energy usage over the hour: ${estimatedEnergyHour}\n` +
    `Sanity Lost: ${sanity.sanity}e${sanity.suffix} <:sparkles:1012729567615656066>\n` +
    'Last 5 Games:\n';

  for (let i = 1; i <= Math.min(5, pointsPerGame.length); i++) { // Loop up to 5 games, or less if not enough
    const game = pointsPerGame[pointsPerGame.length - i];
    reply += `**Game ${i}:** ${game.points} <t:${game.timestamp}:R> \n`;
  }

  reply += `Updated: <t:${timestamp}:R>`;

  const mobileEmbed = generateEmbedTemplate({
    name: title,
    client: discordClient.client
  });

  mobileEmbed.addFields(
    { name: title, value: reply }
  );

  await sendEmbed(interaction, embed, mobileEmbed);
}

async function tierStatistics(tier: number, eventId: number, eventData: EventData, discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {

  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventId,
    targetRank: tier,
    lowerLimit: 0
  }, async (response: any) => { // Type response as any for ranking API response
    if (!response || !response.rankings || response.rankings.length === 0) {
      const reply = 'Could not retrieve ranking data. Please try again later.';
      const title = 'Error';
      await interaction.editReply({
        embeds: [generateEmbed({ name: title, content: { type: 'ERROR', message: reply }, client: discordClient.client })]
      });
      return;
    }

    const targetUserId = response.rankings[tier - 1]?.userId; // Safely access userId
    if (!targetUserId) {
      const reply = 'Tier not found or user data unavailable for this tier.';
      const title = 'Tier Not Found';
      await interaction.editReply({
        embeds: [generateEmbed({ name: title, content: { type: 'ERROR', message: reply }, client: discordClient.client })]
      });
      return;
    }

    const data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM cutoffs ' +
      'WHERE (EventID=@eventID AND ID=@id) ORDER BY Timestamp ASC').all({ // Order by Timestamp
        id: targetUserId,
        eventID: eventId
      }) as RankDataPoint[] | undefined; // Type assertion

    if (data && data.length > 0) {
      const points = new Set<number>();
      let rankData: RankDataPoint[] = [];

      data.forEach(x => {
        if (!points.has(x.Score)) {
          rankData.push({ timestamp: x.Timestamp, score: x.Score });
          points.add(x.Score);
        }
      });
      rankData.unshift({ timestamp: eventData.startAt, score: 0 }); // Add 0 point at event start
      rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0); // Ensure sorting

      const title = `T${tier} ${response.rankings[tier - 1]?.name || 'Unknown'} Statistics`; // Safely access name
      await tierStatisticsEmbed(rankData, title, discordClient, interaction);
    } else {
      const reply = 'User data for this tier could not be retrieved. It might be too early in the event or the user is not consistently tracked.';
      const title = 'Tier Data Not Found';
      await interaction.editReply({
        embeds: [generateEmbed({ name: title, content: { type: 'ERROR', message: reply }, client: discordClient.client })]
      });
    }
  }, (err: any) => { // Type as any for error
    discordClient.logger?.log({
      level: 'error',
      message: err.toString()
    });
    interaction.editReply({
      embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'error', message: err.toString() }, client: discordClient.client })]
    });
  });
}

async function tierHistoricalStatistics(tier: number, eventId: number, eventData: EventData, discordClient: DiscordClient, interaction: CommandInteraction): Promise<void> {

  const response = discordClient.cutoffdb?.prepare('SELECT ID, Score FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY TIMESTAMP DESC').all({
      eventID: eventData.id,
      tier: tier
    }) as { ID: string, Score: number }[] | undefined; // Type assertion

  if (response && response.length > 0) {
    const targetUserId = response[0].ID; // Get the most recent ID for this tier

    const data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score FROM cutoffs ' +
      'WHERE (EventID=@eventID AND ID=@id) ORDER BY Timestamp ASC').all({
        id: targetUserId,
        eventID: eventId
      }) as RankDataPoint[] | undefined; // Type assertion

    if (data && data.length > 0) {
      const points = new Set<number>();
      let rankData: RankDataPoint[] = [];

      data.forEach(x => {
        if (!points.has(x.Score)) {
          rankData.push({ timestamp: x.Timestamp, score: x.Score });
          points.add(x.Score);
        }
      });
      rankData.unshift({ timestamp: eventData.startAt, score: 0 }); // Add 0 point at event start
      rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0); // Ensure sorting

      const title = `${eventData.name} T${tier} Statistics`;
      await tierStatisticsEmbed(rankData, title, discordClient, interaction);

    } else {
      const reply = 'Could not find historical data for this tier. It might not have been tracked sufficiently.';
      const title = 'Tier Data Not Found';
      await interaction.editReply({
        embeds: [generateEmbed({ name: title, content: { type: 'ERROR', message: reply }, client: discordClient.client })]
      });
    }
  } else {
    const reply = 'Please input a tier in the range 1-100 or input 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, or 50000';
    const title = 'Tier Not Found';

    await interaction.editReply({
      embeds: [generateEmbed({ name: title, content: { type: 'ERROR', message: reply }, client: discordClient.client })]
    });
  }
}

async function sendEmbed(interaction: CommandInteraction, embed: EmbedBuilder, mobileEmbed: EmbedBuilder): Promise<void> {
  const statisticsButtons = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('condensed')
        .setLabel('CONDENSED')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(COMMAND.CONSTANTS.CONDENSED)
    );

  const statisticsMessage = await interaction.editReply({
    embeds: [embed],
    components: [statisticsButtons]
  });

  // Create a filter for valid responses
  const filter = (i: MessageComponentInteraction) => {
    return i.customId === 'condensed';
  };

  const collector = statisticsMessage.createMessageComponentCollector({
    filter,
    time: COMMAND.CONSTANTS.INTERACTION_TIME // Assuming INTERACTION_TIME is defined in command_data/statistics.ts
  });

  // Collect user interactions with the prev / next buttons
  let condensed = false;
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

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const event = discordClient.getCurrentEvent();

    const user = interaction.options.getMember('user');
    const tier = interaction.options.getInteger('tier');
    const eventId = interaction.options.getInteger('event') || event.id;
    const chapterId = interaction.options.getInteger('chapter'); // This is already number | null

    let eventData: EventData = getEventData(eventId); // Get initial event data

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

    if (chapterId !== null) {
      const parentEventId = Math.floor(chapterId / 100); // Assuming chapterId is eventId + characterId as 100x + y
      const world_blooms = discordClient.getAllWorldLinkChapters(parentEventId); // Get all chapters for the parent event

      const world_link = world_blooms.find(chapter => chapter.id === chapterId); // Find the specific chapter
      if (world_link) {
        eventData.startAt = world_link.chapterStartAt;
        eventData.aggregateAt = world_link.chapterEndAt;
        eventData.id = parseInt(`${eventData.id}${world_link.gameCharacterId}`); // Update event ID for specific chapter
        eventData.name = `${discordClient.getCharacterName(world_link.gameCharacterId)}'s Chapter`;
      } else {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name,
              content: { type: 'Error', message: 'Invalid chapter ID provided.' },
              client: discordClient.client
            })
          ]
        });
        return;
      }
    }

    if (user) {
      try {
        userStatistics(user as GuildMember, eventId, eventData, discordClient, interaction); // Cast to GuildMember
      } catch (err: any) { // Type as any for error
        console.error('Error in userStatistics execution:', err);
        await interaction.editReply({
          embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An error occurred while fetching user statistics.' }, client: discordClient.client })]
        });
      }
    } else if (tier !== null) { // Check for null explicitly
      try {
        // Condition for historical data vs current event data or if event is past locked ID
        const isHistorical = eventId < discordClient.getCurrentEvent().id || discordClient.getCurrentEvent().id > LOCKED_EVENT_ID;

        if (isHistorical) {
          tierHistoricalStatistics(tier, eventId, eventData, discordClient, interaction);
        } else {
          tierStatistics(tier, eventId, eventData, discordClient, interaction);
        }
      } catch (err: any) { // Type as any for error
        console.error('Error in tierStatistics execution:', err);
        await interaction.editReply({
          embeds: [generateEmbed({ name: COMMAND.INFO.name, content: { type: 'Error', message: 'An error occurred while fetching tier statistics.' }, client: discordClient.client })]
        });
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    const world_blooms = discordClient.getAllWorldLinkChapters(); // This function should return an array of WorldBloom or similar objects with a 'character' and 'id' field.

    const options = world_blooms.map((chapter: any) => { // Type 'chapter' as any for now
      return {
        name: chapter.character,
        value: chapter.id, // Value should be chapter ID
      };
    });

    await interaction.respond(options);
  }
};