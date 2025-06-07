// client/commands/leaderboard.ts
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle, MessageComponentInteraction } from 'discord.js';
import { NENE_COLOR, FOOTER, RESULTS_PER_PAGE } from '../../constants';

// Assuming command_data/leaderboard.ts has been converted and exported properly
import * as COMMAND from '../command_data/leaderboard';
import generateSlashCommand from '../methods/generateSlashCommand';
import generateRankingTextChanges from '../methods/generateRankingTextChanges';
import generateAlternateRankingText from '../methods/generateAlternateRankingText';
import generateEmbed from '../methods/generateEmbed';
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export

const MAX_PAGE = Math.ceil(100 / RESULTS_PER_PAGE) - 1;

const HOUR = 3600000;

interface UserRanking {
  rank: number;
  name: string;
  score: number;
  userId: string;
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
  Timestamp: number;
  Score: number;
  ID: string;
  Tier: number;
  GameNum: number;
}

interface WorldBloom {
  eventId: number;
  id: number; // This is chapter ID in worldBlooms.json, typically combined with eventId
  chapterNo: number;
  chapterStartAt: number;
  chapterEndAt: number;
  gameCharacterId: number;
  // Add other properties if needed
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
  return sortedList.length - 1; // Return last index if no element is greater
}

function getLastHourData(response: any, rankingData: UserRanking[], event: EventData, discordClient: DiscordClient): [number[], number[], number[], number[], number] {
  // Use eventId from the passed event, not directly from discordClient.getCurrentEvent() for chapter data
  const eventIdForDb = event.id;

  const tier1Data = discordClient.cutoffdb?.prepare('SELECT Timestamp, Score, ID, Tier, GameNum FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY Timestamp ASC').all({
      eventID: eventIdForDb,
      tier: 1 // Always fetch tier 1 to get a representative timestamp range
    }) as CutoffDbEntry[] | undefined;

  let lastTimestamp = Date.now();
  let timestamps: number[] = [event.startAt, lastTimestamp]; // Default with event start and current time

  if (tier1Data && tier1Data.length > 0) {
    timestamps = tier1Data.map(x => x.Timestamp);
    timestamps.sort((a, b) => a - b);
    lastTimestamp = timestamps[timestamps.length - 1];
  }

  const lastHourIndex = getLastHour(timestamps, lastTimestamp - HOUR);
  const timestampIndex = timestamps[lastHourIndex]; // Timestamp for an hour ago

  let lastHourCutoffs: number[] = new Array(rankingData.length).fill(-1);
  let tierChange: number[] = new Array(rankingData.length).fill(0);
  let GPH: number[] = new Array(rankingData.length).fill(-1);
  let gamesPlayed: number[] = new Array(rankingData.length).fill(-1);
  const userIds = rankingData.map(r => r.userId);

  const currentData = discordClient.cutoffdb?.prepare('SELECT ID, Score, Tier, GameNum FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
      eventID: eventIdForDb,
      timestamp: lastTimestamp,
    }) as CutoffDbEntry[] | undefined;

  const lastHourData = discordClient.cutoffdb?.prepare('SELECT ID, Score, Tier, GameNum FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
      eventID: eventIdForDb,
      timestamp: timestampIndex,
    }) as CutoffDbEntry[] | undefined;

  const currentGamesPlayedMap = new Map<string, { score: number, games: number, tier: number }>();
  currentData?.forEach(data => {
    currentGamesPlayedMap.set(data.ID, { score: data.Score, games: data.GameNum || 0, tier: data.Tier });
  });

  lastHourData?.forEach((data) => {
    const gamesPlayedData = currentGamesPlayedMap.get(data.ID);
    const index = userIds.indexOf(data.ID);

    if (index !== -1 && gamesPlayedData) {
      lastHourCutoffs[index] = data.Score;
      tierChange[index] = data.Tier - gamesPlayedData.tier;
      GPH[index] = Math.max(gamesPlayedData.games - data.GameNum, 0);
      gamesPlayed[index] = gamesPlayedData.games || 0;
      if (rankingData[index].score >= gamesPlayedData.score + 100) {
        GPH[index]++;
        gamesPlayed[index]++;
      }
    }
  });

  return [lastHourCutoffs, tierChange, GPH, gamesPlayed, lastTimestamp];
}

const getWorldLink = (eventId: number): WorldBloom | -1 => {
  const worldLinkJson: WorldBloom[] = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json', 'utf8')) as WorldBloom[];
  const filteredWorldLink = worldLinkJson.filter((x) => x.eventId === eventId);

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

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: MessageComponentInteraction, discordClient: DiscordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const event = discordClient.getCurrentEvent();
    // There is no event at the moment
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

    // Ensure that the user has not surpassed the rate limit
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

    const sendLeaderboardEmbed = async (response: any, timestamp: number) => { // Type response as any for now
      // Check if the response is valid
      if (!response.rankings) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name, // Use COMMAND.INFO.name here
              content: COMMAND.CONSTANTS.NO_RESPONSE_ERR,
              client: discordClient.client
            })
          ]
        });
        return;
      } else if (response.rankings.length === 0) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.INFO.name, // Use COMMAND.INFO.name here
              content: COMMAND.CONSTANTS.BAD_INPUT_ERROR,
              client: discordClient.client
            })
          ]
        });
        return;
      }

      let rankingData: UserRanking[] = response.rankings;

      let target: number | null = null;
      let page = 0;

      // Check for options, assuming it comes from a CommandInteraction, not MessageComponentInteraction directly here
      // The original code was for CommandInteraction, but the execute method is for MessageComponentInteraction
      // For simplicity, I'll assume if this is called from a CommandInteraction, the options were handled.
      // If the `interaction` is an `Interaction` type, it might not have `.options` directly.
      // Assuming a specific type for `interaction` or using type guards.
      if (interaction.isCommand()) { // Only process options if it's a CommandInteraction
        const commandInteraction = interaction;
        const rankOption = commandInteraction.options.getInteger('rank');
        if (rankOption !== null) {
          if (rankOption > 100 || rankOption < 1) {
            await interaction.editReply({
              embeds: [
                generateEmbed({
                  name: COMMAND.INFO.name,
                  content: COMMAND.CONSTANTS.BAD_RANGE_ERR,
                  client: discordClient.client
                })
              ]
            });
            return;
          } else {
            target = rankOption;
            page = Math.floor((target - 1) / RESULTS_PER_PAGE);
          }
        }
      }

      let start = page * RESULTS_PER_PAGE;
      let end = start + RESULTS_PER_PAGE;

      let overallData = getLastHourData(response, rankingData, event, discordClient);
      let chapterData: [number[], number[], number[], number[], number] | undefined;
      let chapterRankingData: UserRanking[] | undefined;

      let [lastHourCutoffs, tierChange, GPH, gamesPlayed, timestampIndex] = overallData;

      const worldLink = getWorldLink(event.id);
      if (worldLink !== -1 && response.userWorldBloomChapterRankings) {
        // Assuming chapterNo is 1-indexed and matches array index, or needs mapping
        const chapterResponse = response.userWorldBloomChapterRankings.find((c: any) => c.gameCharacterId === (worldLink as WorldBloom).gameCharacterId);
        if (chapterResponse) {
          chapterData = getLastHourData(chapterResponse, chapterResponse.rankings, { ...event, id: parseInt(`${event.id}${worldLink.gameCharacterId}`) }, discordClient);
          chapterRankingData = chapterResponse.rankings;
        }
      }

      let mobile = false;
      let alt = false;
      let offset = false; // Controls if we shift ranks by 10
      let chapter = false; // Controls if we are showing chapter data or overall data

      let slice: UserRanking[];
      let sliceOffset: number[];
      let sliceTierChange: number[];
      let sliceGPH: number[];
      let sliceGamesPlayed: number[];

      const getSlicedData = (rankDataArr: UserRanking[], lastHourCutoffsArr: number[], tierChangeArr: number[], gamesPlayedArr: number[], GPHArr: number[]) => {
        let currentStart = page * RESULTS_PER_PAGE;
        let currentEnd = currentStart + RESULTS_PER_PAGE;
        if (offset) {
          currentStart += 10;
          currentEnd += 10;
          // Ensure indices wrap around for 120 (T1-T100 + T1-T20 for 120 total)
          // Simplified: assuming 120 is max size of data, wrap around if needed.
          // This specific logic might need refinement based on exact data structure for T120.
          // For a simple T100 + T1-T20, this can be complex.
          // Assuming `rankingData` (and related arrays) is always large enough or sliced correctly.
          if (currentStart >= rankDataArr.length) {
            currentStart = currentStart % rankDataArr.length;
            currentEnd = currentEnd % rankDataArr.length;
          }
        }
        if (currentStart > currentEnd) {
          return {
            slice: rankDataArr.slice(currentStart).concat(rankDataArr.slice(0, currentEnd)),
            sliceOffset: lastHourCutoffsArr.slice(currentStart).concat(lastHourCutoffsArr.slice(0, currentEnd)),
            sliceTierChange: tierChangeArr.slice(currentStart).concat(tierChangeArr.slice(0, currentEnd)),
            sliceGamesPlayed: gamesPlayedArr.slice(currentStart).concat(gamesPlayedArr.slice(0, currentEnd)),
            sliceGPH: GPHArr.slice(currentStart).concat(GPHArr.slice(0, currentEnd))
          };
        } else {
          return {
            slice: rankDataArr.slice(currentStart, currentEnd),
            sliceOffset: lastHourCutoffsArr.slice(currentStart, currentEnd),
            sliceTierChange: tierChangeArr.slice(currentStart, currentEnd),
            sliceGamesPlayed: gamesPlayedArr.slice(currentStart, currentEnd),
            sliceGPH: GPHArr.slice(currentStart, currentEnd)
          };
        }
      };


      const { slice: initialSlice, sliceOffset: initialSliceOffset, sliceTierChange: initialSliceTierChange, sliceGamesPlayed: initialSliceGamesPlayed, sliceGPH: initialSliceGPH } = getSlicedData(rankingData, lastHourCutoffs, tierChange, gamesPlayed, GPH);
      slice = initialSlice;
      sliceOffset = initialSliceOffset;
      sliceTierChange = initialSliceTierChange;
      sliceGamesPlayed = initialSliceGamesPlayed;
      sliceGPH = initialSliceGPH;


      let leaderboardText = generateRankingTextChanges(slice, page, target, sliceOffset, sliceTierChange, mobile);

      let leaderboardEmbed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle(`${event.name} Nyaa~`)
        .setDescription(`T100 Leaderboard at <t:${Math.floor(timestamp / 1000)}>\nChange since <t:${Math.floor(timestampIndex / 1000)}>`)
        .addFields({ name: `Page ${page + 1} / ${MAX_PAGE + 1}`, value: leaderboardText, inline: false })
        .setThumbnail(event.banner)
        .setTimestamp()
        .setFooter({ text: FOOTER, iconURL: interaction.user.displayAvatarURL() });

      const leaderboardButtons = new ActionRowBuilder<ButtonBuilder>()
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
            .setEmoji(COMMAND.CONSTANTS.RIGHT),
          new ButtonBuilder()
            .setCustomId('mobile')
            .setLabel('MOBILE')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(COMMAND.CONSTANTS.MOBILE),
          new ButtonBuilder()
            .setCustomId('offset')
            .setLabel('OFFSET')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(COMMAND.CONSTANTS.OFFSET),
          new ButtonBuilder()
            .setCustomId('alt')
            .setLabel('ALT')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(COMMAND.CONSTANTS.ALT));

      const worldLinkButtons = new ActionRowBuilder<ButtonBuilder>();

      if (getWorldLink(event.id) !== -1) {
        worldLinkButtons.addComponents(
          new ButtonBuilder()
            .setCustomId('chapter')
            .setLabel('CHAPTER')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(COMMAND.CONSTANTS.LINK)
        );
      }

      let components: ActionRowBuilder<ButtonBuilder>[] = (getWorldLink(event.id) !== -1) ? [leaderboardButtons, worldLinkButtons] : [leaderboardButtons];

      const leaderboardMessage = await interaction.editReply({
        embeds: [leaderboardEmbed],
        components: components,
        fetchReply: true
      });

      // Create a filter for valid responses
      const filter = (i: MessageComponentInteraction) => {
        return i.customId === 'prev' ||
          i.customId === 'next' ||
          i.customId === 'mobile' ||
          i.customId === 'alt' ||
          i.customId === 'offset' ||
          i.customId === 'chapter';
      };

      const collector = leaderboardMessage.createMessageComponentCollector({
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
          return;
        }

        if (i.customId === 'prev') {
          if (page === 0) {
            page = MAX_PAGE;
          } else {
            page -= 1;
          }
        } else if (i.customId === 'next') {
          if (page === MAX_PAGE) {
            page = 0;
          } else {
            page += 1;
          }
        } else if (i.customId === 'mobile') {
          mobile = !mobile;
        } else if (i.customId === 'alt') {
          alt = !alt;
        } else if (i.customId === 'offset') {
          offset = !offset;
        } else if (i.customId === 'chapter') {
          chapter = !chapter; // Toggle chapter state
          if (chapter && chapterData && chapterRankingData) { // If now showing chapter data
            [lastHourCutoffs, tierChange, GPH, gamesPlayed, timestampIndex] = chapterData;
            rankingData = chapterRankingData;
          } else { // If now showing overall data
            [lastHourCutoffs, tierChange, GPH, gamesPlayed, timestampIndex] = overallData;
            rankingData = response.rankings; // Revert to original full response rankings
          }
        } else {
          return;
        }

        const { slice: currentSlice, sliceOffset: currentSliceOffset, sliceTierChange: currentSliceTierChange, sliceGamesPlayed: currentSliceGamesPlayed, sliceGPH: currentSliceGPH } = getSlicedData(rankingData, lastHourCutoffs, tierChange, gamesPlayed, GPH);
        slice = currentSlice;
        sliceOffset = currentSliceOffset;
        sliceTierChange = currentSliceTierChange;
        sliceGamesPlayed = currentSliceGamesPlayed;
        sliceGPH = currentSliceGPH;


        if (!alt) {
          leaderboardText = generateRankingTextChanges(slice, page, target, sliceOffset, sliceTierChange, mobile);
        }
        else {
          leaderboardText = generateAlternateRankingText(slice, page, target, sliceOffset, sliceGamesPlayed, sliceGPH, mobile);
        }
        leaderboardEmbed = new EmbedBuilder()
          .setColor(NENE_COLOR)
          .setTitle(`${event.name} Nyaa~`)
          .setDescription(`T100 Leaderboard at <t:${Math.floor(timestamp / 1000)}>\nChange since <t:${Math.floor(timestampIndex / 1000)}>\n`)
          .addFields({ name: `Page ${page + 1} / ${MAX_PAGE + 1}`, value: leaderboardText, inline: false })
          .setThumbnail(event.banner)
          .setTimestamp()
          .setFooter({ text: FOOTER, iconURL: interaction.user.displayAvatarURL() });

        await i.update({
          embeds: [leaderboardEmbed],
          components: components
        });
      });

      collector.on('end', async () => {
        // Ensure the last state of the embed is sent without components
        await interaction.editReply({
          embeds: [leaderboardEmbed],
          components: []
        });
      });
    };

    if (discordClient.cutoffCache !== null) {
      console.log('Using cached data');
      let { response, timestamp } = discordClient.cutoffCache;
      sendLeaderboardEmbed(response, timestamp);
      return;
    }

    discordClient.addSekaiRequest('ranking', {
      eventId: event.id,
    }, async (response: any) => { // Type response as any
      sendLeaderboardEmbed(response, Date.now());
    }, async (err: any) => { // Type err as any
      // Log the error
      discordClient.logger?.log({
        level: 'error',
        timestamp: Date.now(),
        message: err.toString()
      });

      await interaction.editReply({
        embeds: [generateEmbed({
          name: COMMAND.INFO.name,
          content: { type: 'error', message: err.toString() },
          client: discordClient.client
        })]
      });
    });
  }
};