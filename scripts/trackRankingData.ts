// scripts/trackRankingData.ts
/**
 * @fileoverview The main implementation towards maintaining tracked ranking information
 * Will update servers that have signed up with live update leaderboard every 2 minutes or 1 hour
 * @author Potor10
 */

import { EmbedBuilder, PermissionsBitField, TextBasedChannel } from 'discord.js';
import { NENE_COLOR } from '../constants';
import * as fs from 'fs';
import generateRankingTextChanges from '../client/methods/generateRankingTextChanges'; // Ensure correct import for generateRankingTextChanges
import DiscordClient from '../client/client'; // Assuming DiscordClient is default export

// Assuming these JSON files exist and have types defined or inferred
// const RANKING_RANGE = require('./trackRankingRange.json'); // No longer directly used
// const RANKING_RANGE_V2 = require('./trackRankingRangeV2.json'); // No longer directly used

const HOUR = 3600000; // milliseconds in an hour
const gameFilePath = './JSONs/games.json';

interface RankingDataEntry {
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

interface GameCacheEntry {
  score: number;
  games: number;
}

interface TrackedChannel {
  channel_id: string;
  guild_id: string;
  tracking_type: number; // 2 for 2 minutes, 60 for 1 hour
}

function getLastHour(sortedList: number[], el: number): number {
  for (let i = 0; i < sortedList.length; i++) {
    if (sortedList[i] > el) {
      return i;
    }
  }
  return 0;
}

/**
 * Sends an embed containing the top 20 players to specific Discord servers that have
 * signed up for tracking updates
 * @param {RankingDataEntry[]} rankingData a collection of the top 20 players on the leaderboard
 * @param {EventData} event data about the current event that is going on
 * @param {number} timestamp the time when the data was collected, in epochseconds
 * @param {DiscordClient} discordClient the client we are using to interact with Discord
 */
const sendTrackingEmbed = async (rankingData: RankingDataEntry[], event: EventData, timestamp: number, discordClient: DiscordClient): Promise<void> => {
  const generateEmbedContent = (): EmbedBuilder => {
    // Fetch data for tier 1 to determine last hour cutoff
    const tier1Data = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
      'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY Timestamp ASC').all({
        eventID: event.id,
        tier: 1
      }) as { Timestamp: number, Score: number }[];

    let lastTimestamp = 0;
    let timestamps: number[] = [];

    if (tier1Data && tier1Data.length > 0) {
      timestamps = tier1Data.map(x => x.Timestamp);
      lastTimestamp = timestamps[timestamps.length - 1];
    } else {
      // Fallback if no tier 1 data is available
      lastTimestamp = timestamp;
      timestamps = [event.startAt, timestamp];
    }

    const lastHourIndex = getLastHour(timestamps, lastTimestamp - HOUR);
    const timestampIndex = timestamps[lastHourIndex] || event.startAt; // Ensure a valid timestamp


    let lastHourCutoffs: number[] = new Array(rankingData.length).fill(-1);
    let tierChanges: number[] = new Array(rankingData.length).fill(0);
    let GPH: number[] = new Array(rankingData.length).fill(-1);
    let gamesPlayed: number[] = new Array(rankingData.length).fill(-1);

    const userIds = rankingData.map(r => r.userId);

    const currentCutoffData = discordClient.cutoffdb?.prepare('SELECT ID, Score, Tier, GameNum FROM cutoffs ' +
      'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
        eventID: event.id,
        timestamp: lastTimestamp,
      }) as { ID: string, Score: number, Tier: number, GameNum: number }[];

    const lastHourCutoffData = discordClient.cutoffdb?.prepare('SELECT ID, Score, Tier, GameNum FROM cutoffs ' +
      'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
        eventID: event.id,
        timestamp: timestampIndex,
      }) as { ID: string, Score: number, Tier: number, GameNum: number }[];

    const currentGamesPlayedMap = new Map<string, { score: number, games: number, tier: number }>();
    currentCutoffData?.forEach(data => {
      currentGamesPlayedMap.set(data.ID, { score: data.Score, games: data.GameNum || 0, tier: data.Tier });
    });

    lastHourCutoffData?.forEach(data => {
      const gamesPlayedData = currentGamesPlayedMap.get(data.ID);
      const index = userIds.indexOf(data.ID);

      if (index !== -1 && gamesPlayedData) {
        lastHourCutoffs[index] = data.Score;
        tierChanges[index] = data.Tier - gamesPlayedData.tier;
        GPH[index] = Math.max(gamesPlayedData.games - data.GameNum, 0);
        gamesPlayed[index] = gamesPlayedData.games || 0;

        // Additional check from original code to increment GPH/games if current score is significantly higher
        if (rankingData[index].score >= gamesPlayedData.score + 100) {
          GPH[index]++;
          gamesPlayed[index]++;
        }
      }
    });


    const leaderboardText = generateRankingTextChanges(rankingData, 0, null, lastHourCutoffs, tierChanges, false);

    const leaderboardEmbed = new EmbedBuilder()
      .setColor(NENE_COLOR)
      .setTitle(`${event.name}`)
      .setDescription(`T20 Leaderboard at <t:${Math.floor(timestamp / 1000)}>\nChange since <t:${Math.floor(timestampIndex / 1000)}>`)
      .addFields(
        { name: 'T20', value: leaderboardText, inline: false }
      )
      .setThumbnail(event.banner)
      .setTimestamp();

    return leaderboardEmbed;
  };

  const send = async (target: TrackedChannel, embed: EmbedBuilder): Promise<void> => {
    const channel = discordClient.client.channels.cache.get(target.channel_id);
    if (channel && channel.isTextBased()) { // Ensure it's a text-based channel
      const guild = discordClient.client.guilds.cache.get(channel.guild.id);
      if (guild) {
        const perms = guild.members.me?.permissionsIn(channel as TextBasedChannel); // Cast to TextBasedChannel
        if (perms?.has(PermissionsBitField.Flags.SendMessages)) {
          try {
            await channel.send({ embeds: [embed] });
            return;
          } catch (e) {
            console.error(`Failed to send message to ${target.channel_id}:`, e);
          }
        } else {
          console.warn(`Missing SEND_MESSAGES permission in channel ${target.channel_id} in guild ${guild.id}`);
        }
      }
    } else {
      console.warn(`Channel ${target.channel_id} not found or is not text-based.`);
    }

    // Request deletion of the channel from the database if sending failed or channel is invalid
    console.log(`Requesting deletion of tracking for channel ${target.channel_id}`);
    discordClient.db?.prepare('DELETE FROM tracking WHERE guild_id=@guildId AND channel_id=@channelId').run({
      guildId: target.guild_id,
      channelId: target.channel_id
    });
  };

  const removeDuplicates = (arr: TrackedChannel[]): TrackedChannel[] => {
    const seen = new Set<string>();
    return arr.filter(item => {
      const key = `${item.channel_id}-${item.guild_id}-${item.tracking_type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  if (rankingData.length > 0) {
    const trackingEmbed = generateEmbedContent();

    const channels = removeDuplicates(discordClient.db?.prepare('SELECT * FROM tracking').all() as TrackedChannel[] || []);

    channels.forEach(async (channel) => {
      if (channel.tracking_type === 2) { // 2 minutes
        send(channel, trackingEmbed);
      } else { // 1 hour
        const nearestHour = new Date(timestamp);
        nearestHour.setHours(nearestHour.getHours() + Math.round(nearestHour.getMinutes() / 60));
        nearestHour.setMinutes(0, 0, 0);

        if (Math.abs(nearestHour.getTime() - timestamp) <= 30000) { // Check if within 30 seconds of the hour
          send(channel, trackingEmbed);
        }
      }
    });
  }
};

/**
 * Identifies the time needed before the next check of data
 * @return {number} the ms to wait before checking again
 */
const getNextCheck = (): number => {
  const now = new Date();
  const nextCheck = new Date(now);
  nextCheck.setMinutes(now.getMinutes() + Math.round(now.getSeconds() / 60));
  nextCheck.setSeconds(0, 0);

  nextCheck.setMinutes(nextCheck.getMinutes() + 1); // Next full minute
  return nextCheck.getTime() - now.getTime();
};

async function getGames(): Promise<{ [userId: string]: GameCacheEntry }> {
  let gameFile: { [userId: string]: GameCacheEntry } = {};

  try {
    if (!fs.existsSync(gameFilePath)) {
      gameFile = {};
    }
    else {
      gameFile = JSON.parse(fs.readFileSync(gameFilePath, 'utf8'));
    }
    return gameFile;
  } catch (e) {
    console.error('Error occurred while reading game tracking file:', e);
    return {};
  }
}

async function writeGames(object: { [userId: string]: GameCacheEntry }): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(gameFilePath, JSON.stringify(object), err => {
      if (err) {
        console.error('Error writing game tracking file', err);
        reject(err);
      } else {
        console.log('Wrote game tracking file Successfully');
        resolve();
      }
    });
  });
}

async function deleteGames(): Promise<void> {
  return new Promise((resolve) => {
    if (fs.existsSync(gameFilePath)) {
      fs.unlink(gameFilePath, (err) => {
        if (err) {
          console.error('Error deleting games.json:', err);
        } else {
          console.log('Deleted games.json successfully.');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Requests the next rank of data recursively
 * @param {EventData} event our ranking event data
 * @param {DiscordClient} discordClient the client we are using 
 */
const requestRanking = async (event: EventData, discordClient: DiscordClient): Promise<void> => {
  const retrieveResult = async (response: any) => { // Type as any for response
    // TODO: Add a check here if response is not available
    // EX: { httpStatus: 403, errorCode: 'session_error', errorMessage: '' }
    if (!response || !response.rankings) {
      discordClient.logger?.log({
        level: 'error',
        message: 'Invalid ranking response received: ' + JSON.stringify(response)
      });
      return;
    }

    const rankingData: RankingDataEntry[] = response.rankings;
    const timestamp = Date.now();

    const gameCache = await getGames();

    rankingData.forEach((ranking) => {
      if (ranking && event.id !== -1) {
        const score = ranking.score;
        const rank = ranking.rank;
        const id = ranking.userId;

        if (id in gameCache) {
          if (score >= gameCache[id].score + 100) {
            gameCache[id].games++;
            gameCache[id].score = score;
          }
        } else {
          gameCache[id] = { 'score': score, 'games': 1 };
        }

        const games = gameCache[id].games;

        discordClient.cutoffdb?.prepare('INSERT INTO cutoffs ' +
          '(EventID, Tier, Timestamp, Score, ID, GameNum) ' +
          'VALUES(@eventID, @tier, @timestamp, @score, @id, @gameNum)').run({
            score: score,
            eventID: event.id,
            tier: rank,
            timestamp: timestamp,
            id: id,
            gameNum: games
          });
      }
    });

    if (response.userWorldBloomChapterRankings !== undefined) {
      response.userWorldBloomChapterRankings.forEach((chapter: any) => { // Type as any for chapter
        const chapterId = parseInt(`${event.id}${chapter.gameCharacterId}`);
        chapter.rankings.forEach((ranking: any) => { // Type as any for ranking
          const score = ranking.score;
          const rank = ranking.rank;
          const id = ranking.userId;
          let games = 1;
          if (id in gameCache) {
            if (score >= gameCache[id].score + 100) {
              gameCache[id].games++;
              gameCache[id].score = score;
            }
          } else {
            gameCache[id] = { 'score': score, 'games': 1 };
          }

          games = gameCache[id].games;

          discordClient.cutoffdb?.prepare('INSERT INTO cutoffs ' +
            '(EventID, Tier, Timestamp, Score, ID, GameNum) ' +
            'VALUES(@eventID, @tier, @timestamp, @score, @id, @gameNum)').run({
              score: score,
              eventID: chapterId,
              tier: rank,
              timestamp: timestamp,
              id: id,
              gameNum: games
            });
        });
      });
    }

    await writeGames(gameCache);
    sendTrackingEmbed(rankingData, event, timestamp, discordClient);
  };

  // Assuming RANKING_RANGE is an array of objects like { targetRank: number, lowerLimit: number, higherLimit: number }
  // For now, iterate through a dummy array or replace with actual usage if RANKING_RANGE is critical
  // If RANKING_RANGE is not actively used for multiple requests but just for a single T100 fetch, simplify.
  // Based on the original code, it seems like `rankingRange.json` is imported but not actively iterated
  // for multiple `addPrioritySekaiRequest` calls within this function, only used for `requestRanking` as a whole.
  // The primary ranking data fetch is for T100, which is handled by `eventRankingT100`.

  // If there are specific ranges to request, they should be defined and iterated.
  // As per original code, it calls `eventRankingT100` once.
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: event.id
  }, retrieveResult, (err: any) => {
    discordClient.logger?.log({
      level: 'error',
      message: err.toString()
    });
  });
};

/**
 * Requests the event borders
 * @param {EventData} event our ranking event data
 * @param {DiscordClient} discordClient the client we are using 
 */
const requestBorder = async (event: EventData, discordClient: DiscordClient): Promise<void> => {
  const saveBorderData = async (response: any) => { // Type as any for response

    if (!response || !response.borderRankings) {
      discordClient.logger?.log({
        level: 'error',
        message: 'Invalid border data response received: ' + JSON.stringify(response)
      });
      return;
    }

    const borderData: any[] = response.borderRankings; // Type as any array for simplicity
    const timestamp = Date.now();

    borderData.forEach((ranking) => {
      if (ranking != null && event.id !== -1) {
        const score = ranking.score;
        const rank = ranking.rank;
        const id = ranking.userId;
        const games = 1; // Defaulting to 1 as per original logic if not explicitly tracked for borders

        discordClient.cutoffdb?.prepare('INSERT INTO cutoffs ' +
          '(EventID, Tier, Timestamp, Score, ID, GameNum) ' +
          'VALUES(@eventID, @tier, @timestamp, @score, @id, @gameNum)').run({
            score: score,
            eventID: event.id,
            tier: rank,
            timestamp: timestamp,
            id: id,
            gameNum: games
          });
      }
    });

    if (response.userWorldBloomChapterRankingBorders !== undefined) {
      response.userWorldBloomChapterRankingBorders.forEach((chapter: any) => { // Type as any for chapter
        const chapterId = parseInt(`${event.id}${chapter.gameCharacterId}`);
        chapter.borderRankings.forEach((ranking: any) => { // Type as any for ranking
          const score = ranking.score;
          const rank = ranking.rank;
          const id = ranking.userId;
          const games = 1;

          discordClient.cutoffdb?.prepare('INSERT INTO cutoffs ' +
            '(EventID, Tier, Timestamp, Score, ID, GameNum) ' +
            'VALUES(@eventID, @tier, @timestamp, @score, @id, @gameNum)').run({
              score: score,
              eventID: chapterId,
              tier: rank,
              timestamp: timestamp,
              id: id,
              gameNum: games
            });
        });
      });
    }
  };


  console.log('Getting Border Data');
  discordClient.addPrioritySekaiRequest('border', {
    eventId: event.id
  }, saveBorderData, (err: any) => {
    discordClient.logger?.log({
      level: 'error',
      message: err.toString()
    });
  });
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

/**
 * Obtains the current event within the ranking period
 * @return {EventData} the ranking event information
 */
const getRankingEvent = (): EventData => {
  let events: EventData[] = [];
  try {
    events = JSON.parse(fs.readFileSync('./sekai_master/events.json', 'utf8')) as EventData[];
  } catch (err) {
    console.error('Error reading events.json for getRankingEvent:', err);
    return { id: -1, banner: '', name: '', startAt: 0, aggregateAt: 0, closedAt: 0, eventType: '', assetbundleName: '' };
  }

  const currentTime = Date.now();
  for (let i = 0; i < events.length; i++) {
    //buffer of 15 minutes for after event
    if (events[i].startAt <= currentTime && events[i].aggregateAt + 60 * 15 * 1000 >= currentTime) {
      return {
        id: events[i].id,
        banner: 'https://storage.sekai.best/sekai-en-assets/event/' +
          `${events[i].assetbundleName}/logo/logo.webp`,
        name: events[i].name,
        startAt: events[i].startAt, // Add missing properties
        aggregateAt: events[i].aggregateAt,
        closedAt: events[i].closedAt,
        eventType: events[i].eventType,
        assetbundleName: events[i].assetbundleName,
      };
    }
  }
  return { id: -1, banner: '', name: '', startAt: 0, aggregateAt: 0, closedAt: 0, eventType: '', assetbundleName: '' };
};

/**
 * Continually grabs and updates the ranking data
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackRankingData = async (discordClient: DiscordClient): Promise<void> => {
  // Identify current event from schedule
  const event = getRankingEvent();

  if (event.id === -1) {
    await deleteGames(); // Ensure deleteGames is awaited
    const eta_ms = getNextCheck();
    console.log(`No Current Ranking Event Active, Pausing For ${eta_ms} ms`);
    // 1 extra second to make sure event is on
    setTimeout(() => { trackRankingData(discordClient); }, eta_ms + 1000);
  } else {
    await requestRanking(event, discordClient); // Ensure requestRanking is awaited
    // Only need to request border every 5 minutes
    if (new Date().getMinutes() % 5 === 0) {
      await requestBorder(event, discordClient); // Ensure requestBorder is awaited
    }
    const eta_ms = getNextCheck();
    console.log(`Event Scores Retrieved, Pausing For ${eta_ms} ms`);
    // 1 extra second to make sure event is on
    setTimeout(() => { trackRankingData(discordClient); }, eta_ms + 1000);
  }
};

export default trackRankingData;