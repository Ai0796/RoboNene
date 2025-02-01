/**
 * @fileoverview The main implementation towards maintaining tracked ranking information
 * Will update servers that have signed up with live update leaderboard every 2 minutes or 1 hour
 * @author Potor10
 */

const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { NENE_COLOR } = require('../constants');
const RANKING_RANGE = require('./trackRankingRange.json');
const RANKING_RANGE_V2 = require('./trackRankingRangeV2.json');
const fs = require('fs');
const generateRankingText = require('../client/methods/generateRankingTextChanges');

const HOUR = 3600000;
const gameFilePath = './JSONs/games.json';

function getLastHour(sortedList, el) {
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
 * @param {Object} rankingData a collection of the top 20 players on the leaderboard
 * @param {Object} event data about the current event that is going on
 * @param {Integer} timestamp the time when the data was collected, in epochseconds
 * @param {DiscordClient} discordClient the client we are using to interact with Discord
 */
const sendTrackingEmbed = async (rankingData, event, timestamp, discordClient) => {
  const generateTrackingEmbed = () => {
      let data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
          'WHERE (EventID=@eventID AND Tier=@tier)').all({
            eventID: event.id,
            tier: 1
          });

      let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      let timestamps = rankData.map(x => x.timestamp);
      let lastTimestamp = timestamps[timestamps.length - 1];

      let lastHourIndex = getLastHour(timestamps, lastTimestamp - HOUR);
      let timestampIndex = timestamps[lastHourIndex];

      let lastHourCutoffs = [];
      let userIds = [];

      for(let i = 0; i < rankingData.length; i++) {
        lastHourCutoffs.push(-1);
        userIds.push(rankingData[i].userId);
      }

      let lastHourData = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
        'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
          eventID: event.id,
          timestamp: timestampIndex,
        });

      lastHourData.forEach(data => {
        let index = userIds.indexOf(data.ID);

        if (index != -1) {
          lastHourCutoffs[index] = data.Score;
        }
      });

      let mobile = false;

      let leaderboardText = generateRankingText(rankingData, 1, null, lastHourCutoffs, mobile);
      
      let leaderboardEmbed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle(`${event.name}`)
        .setDescription(`T20 Leaderboard at <t:${Math.floor(timestamp / 1000)}>\nChange since <t:${Math.floor(timestampIndex / 1000)}>`)
        .addFields(
          {name: 'T20', value: leaderboardText, inline: false}
        )
        .setThumbnail(event.banner)
        .setTimestamp();
  
      return leaderboardEmbed;
  };
  
  const send = async (target, embed) => {
    const channel = discordClient.client.channels.cache.get(target.channel_id);
    if (channel) {
      const guild = discordClient.client.guilds.cache.get(channel.guild.id);
      const perms = guild.members.me.permissionsIn(channel);
      if (perms.has(PermissionsBitField.Flags.SendMessages)) {
        try {
          await channel.send({ embeds: [embed] });
          return;
        } catch {
          console.log(`Failed to send message to ${target.channel_id}`);
        }
      }
    }

    // Request deletion of the channel from the database
    // console.log(`Requesting deletion of ${target.channel_id}`);
    // discordClient.db.prepare('DELETE FROM tracking WHERE guild_id=@guildId AND channel_id=@channelId').run({
    //   guildId: target.guild_id,
    //   channelId: target.channel_id
    // });
  };

  const removeDuplicates = async (arr) => {
    return [...new Set(arr)];
  };

  if (rankingData.length > 0) {
    const trackingEmbed = generateTrackingEmbed();

    const channels = await removeDuplicates(discordClient.db.prepare('SELECT * FROM tracking').all());

    channels.forEach(async (channel) => {
      if (channel.tracking_type == 2) {
        send(channel, trackingEmbed);
      } else {
        const nearestHour = new Date(timestamp);
        nearestHour.setHours(nearestHour.getHours() + Math.round(nearestHour.getMinutes()/60));
        nearestHour.setMinutes(0, 0, 0);
    
        if (Math.abs(nearestHour.getTime() - timestamp) <= 30000) {
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
const getNextCheck = () => {
  const nextCheck = new Date();
  nextCheck.setMinutes(nextCheck.getMinutes() + Math.round(nextCheck.getSeconds()/60));
  nextCheck.setSeconds(0, 0);

  nextCheck.setMinutes(nextCheck.getMinutes() + 1);
  return nextCheck.getTime() - Date.now();
};

async function getGames() {

  var gameFile;

  try {
    if (!fs.existsSync(gameFilePath)) {
      gameFile = new Object();
    }
    else {
      gameFile = JSON.parse(fs.readFileSync(gameFilePath, 'utf8'));
    }

    return gameFile;
  } catch (e) {
    console.log('Error occured while reading game tracking file: ', e);
    return new Object();
  }
}

async function writeGames(object) {
  fs.writeFile(gameFilePath, JSON.stringify(object), err => {
    if (err) {
      console.log('Error writing game tracking file', err);
    } else {
      console.log('Wrote game tracking file Successfully');
    }
  });
}

async function deleteGames() {
  if (fs.existsSync(gameFilePath)) {
    fs.unlinkSync(gameFilePath);
  }
}

/**
 * Requests the next rank of data recursively
 * @param {Object} event our ranking event data
 * @param {DiscordClient} discordClient the client we are using 
 */
const requestRanking = async (event, discordClient) => {
  const retrieveResult = async (response) => {
    
    // TODO: Add a check here if response is not available
    // EX: { httpStatus: 403, errorCode: 'session_error', errorMessage: '' }
    const rankingData = response.rankings;
    const timestamp = Date.now();

    let gameCache = await getGames();

    rankingData.forEach((ranking) => {
      if (ranking != null && event != -1) {
        // User is already linked
        let score = ranking['score'];
        let rank = ranking['rank'];
        let id = ranking['userId'];
        if (id in gameCache) {
          if (score >= gameCache[id].score + 100) {
            gameCache[id].games++;
            gameCache[id].score = score;
          }
        } else {
          gameCache[id] = {'score': score, 'games': 1};
        }

        let games = gameCache[id].games;

        discordClient.cutoffdb.prepare('INSERT INTO cutoffs ' +
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
      response.userWorldBloomChapterRankings.forEach((chapter) => {
        let chapterId = parseInt(`${event.id}${chapter.gameCharacterId}`);
        chapter.rankings.forEach((ranking) => {
          let score = ranking['score'];
          let rank = ranking['rank'];
          let id = ranking['userId'];
          let games = 1;
          if (id in gameCache) {
            if (score >= gameCache[id].score + 100) {
              gameCache[id].games++;
              gameCache[id].score = score;
            }
          } else {
            gameCache[id] = {'score': score, 'games': 1};
          }

          games = gameCache[id].games;

          discordClient.cutoffdb.prepare('INSERT INTO cutoffs ' +
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
    sendTrackingEmbed(response.rankings, event, timestamp, discordClient);
  };

  for(const idx in RANKING_RANGE) {
    // Make Priority Requests (We Need These On Time)
    discordClient.addPrioritySekaiRequest('ranking', {
      eventId: event.id
    }, retrieveResult, (err) => {
      discordClient.logger.log({
        level: 'error',
        message: err.toString()
      });
    });
  }
};

/**
 * Requests the event borders
 * @param {Object} event our ranking event data
 * @param {DiscordClient} discordClient the client we are using 
 */
const requestBorder = async (event, discordClient) => {
  const saveBorderData = async (response) => {

    // TODO: Add a check here if response is not available
    // EX: { httpStatus: 403, errorCode: 'session_error', errorMessage: '' }
    const rankingData = response.borderRankings;
    const timestamp = Date.now();

    rankingData.forEach((ranking) => {
      if (ranking != null && event != -1) {
        // User is already linked
        let score = ranking['score'];
        let rank = ranking['rank'];
        let id = ranking['userId'];

        let games = 1;

        discordClient.cutoffdb.prepare('INSERT INTO cutoffs ' +
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
      response.userWorldBloomChapterRankingBorders.forEach((chapter) => {
        let chapterId = parseInt(`${event.id}${chapter.gameCharacterId}`);
        chapter.borderRankings.forEach((ranking) => {
          let score = ranking['score'];
          let rank = ranking['rank'];
          let id = ranking['userId'];
          let games = 1;

          discordClient.cutoffdb.prepare('INSERT INTO cutoffs ' +
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


  console.log('Getting Border Data')
  discordClient.addPrioritySekaiRequest('border', {
    eventId: event.id
  }, saveBorderData, (err) => {
    discordClient.logger.log({
      level: 'error',
      message: err.toString()
    });
  });
};

const getWorldLink = (eventId) => {
  let worldLink = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json'));
  worldLink = worldLink.filter((x) => x.eventId === eventId);

  let idx = -1;
  let currentTime = Date.now();

  worldLink.forEach((x, i) => {
    if (x.chapterEndAt >= currentTime && x.chapterStartAt <= currentTime) {
      idx = i;
    }
  });

  if (idx == -1) {
    return -1;
  }
  else {
    return worldLink[idx];
  }
};

/**
 * Obtains the current event within the ranking period
 * @return {Object} the ranking event information
 */
const getRankingEvent = () => {
  let events = {};
  try {
    events = JSON.parse(fs.readFileSync('./sekai_master/events.json'));
  } catch (err) {
    return { id: -1, banner: '', name: '' };
  }

  const currentTime = Date.now();
  for (let i = 0; i < events.length; i++) {
    //buffer of 15 minutes for after event
    if (events[i].startAt <= currentTime && events[i].aggregateAt + 60 * 15 * 1000 >= currentTime) {
      return {
        id: events[i].id,
        banner: 'https://sekai-res.dnaroma.eu/file/sekai-en-assets/event/' +
          `${events[i].assetbundleName}/logo_rip/logo.webp`,
        name: events[i].name
      };
    }
  }
  return { id: -1, banner: '', name: '' };
};

/**
 * Continaully grabs and updates the ranking data
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackRankingData = async (discordClient) => {
  // Identify current event from schedule
  const event = getRankingEvent();

  // change later back to correct === -1
  if (event.id === -1) {
    deleteGames();
    let eta_ms = getNextCheck();
    console.log(`No Current Ranking Event Active, Pausing For ${eta_ms} ms`);
    // 1 extra second to make sure event is on
    setTimeout(() => {trackRankingData(discordClient);}, eta_ms + 1000);
  } else {
    requestRanking(event, discordClient);
    // Only need to request border every 5 minutes
    if (new Date().getMinutes() % 5 == 0) {
      requestBorder(event, discordClient);
    }
    let eta_ms = getNextCheck();
    console.log(`Event Scores Retrieved, Pausing For ${eta_ms} ms`);
    // 1 extra second to make sure event is on
    setTimeout(() => {trackRankingData(discordClient);}, eta_ms + 1000);
  }
};

module.exports = trackRankingData;