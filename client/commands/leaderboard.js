/**
 * @fileoverview The main output when users call for the /leaderboard command
 * Shows an updated, scrollable snapshot of the top 100 ranks at the moment
 * @author Potor10
 */

const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
const { NENE_COLOR, FOOTER, RESULTS_PER_PAGE } = require('../../constants');

const COMMAND = require('../command_data/leaderboard');

const MAX_PAGE = Math.ceil(100 / RESULTS_PER_PAGE) -1;

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateRankingText = require('../methods/generateRankingTextChanges');
const generateAlternateRankingText = require('../methods/generateAlternateRankingText');
const generateEmbed = require('../methods/generateEmbed'); 

function getLastHour(sortedList, el) {
  for (let i = 0; i < sortedList.length; i++) {
    if (sortedList[i] > el) {
      return i;
    }
  }
  return 0;
}

const HOUR = 3600000;

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction, discordClient) {
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

    discordClient.addSekaiRequest('ranking', {
      eventId: event.id,
    }, async (response) => {
      // Check if the response is valid
      if (!response.rankings) {
        await interaction.editReply({
          embeds: [
            generateEmbed({
              name: COMMAND.commandName, 
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
              name: COMMAND.commandName, 
              content: COMMAND.CONSTANTS.BAD_INPUT_ERROR, 
              client: discordClient.client
            })
          ]
        });
        return;
      }

      const rankingData = response.rankings;
      const timestamp = Date.now();

      let target = 0;
      let page = 0;

      if (interaction.options._hoistedOptions.length) {
        // User has selected a specific rank to jump to
          if (interaction.options._hoistedOptions[0].value > 100 || 
            interaction.options._hoistedOptions[0].value < 1) {
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
            target = interaction.options._hoistedOptions[0].value;
            page = Math.floor((target - 1) / RESULTS_PER_PAGE);
          }
      }

      let start = page * RESULTS_PER_PAGE;
      let end = start + RESULTS_PER_PAGE;

      let data = discordClient.cutoffdb.prepare('SELECT Timestamp, Score FROM cutoffs ' +
        'WHERE (EventID=@eventID AND ID=@id)').all({
          id: response['rankings'][0]['userId'],
          eventID: event.id
        });

      let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      let timestamps = rankData.map(x => x.timestamp);
      timestamps.sort((a, b) => a - b);
      let lastTimestamp = timestamps[timestamps.length - 1];

      let lastHourIndex = getLastHour(timestamps, lastTimestamp - HOUR);
      let timestampIndex = timestamps[lastHourIndex];

      let lastHourCutoffs = [];
      let tierChange = [];
      let GPH = [];
      let gamesPlayed = [];
      let userIds = [];

      for(let i = 0; i < rankingData.length; i++) {
        lastHourCutoffs.push(-1);
        tierChange.push(0);
        gamesPlayed.push(-1);
        GPH.push(-1);
        userIds.push(rankingData[i].userId);
      }

      let currentData = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
        'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
          eventID: event.id,
          timestamp: lastTimestamp,
        });

      let lastHourData = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
        'WHERE (EventID=@eventID AND Timestamp=@timestamp)').all({
          eventID: event.id,
          timestamp: timestampIndex,
        });

      lastHourData.sort((a, b) => a.Tier - b.Tier);
      let currentGamesPlayed = {};
      currentData.forEach(x => {
        currentGamesPlayed[x.ID] = {'id': x.ID, 'score': x.Score, 'games': x.GameNum || 0, 'tier': x.Tier};
      });

      lastHourData.forEach((data) => {
        let gamesPlayedData = currentGamesPlayed[data.ID];

        if (gamesPlayedData) {
          let index = userIds.indexOf(data.ID);
          if (index === -1) return;
          lastHourCutoffs[index] = data.Score;
          tierChange[index] = data.Tier - gamesPlayedData.tier;
          GPH[index] = Math.max(gamesPlayedData.games - data.GameNum, 0);
          gamesPlayed[index] = gamesPlayedData.games;
          if (rankingData[index].score >= gamesPlayedData.score + 100) {
            GPH[index]++;
            gamesPlayed[index]++;
          }
        }
      });

      let mobile = false;
      let alt = false;
      let offset = false;
      var slice, sliceOffset, sliceTierChange, sliceGPH, sliceGamesPlayed;

      let leaderboardText = generateRankingText(rankingData.slice(start, end), page, target, lastHourCutoffs.slice(start, end), tierChange.slice(start, end), mobile);
      
      let leaderboardEmbed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle(`${event.name} Nyaa~`)
        .setDescription(`T100 Leaderboard at <t:${Math.floor(timestamp / 1000)}>\nChange since <t:${Math.floor(timestampIndex / 1000)}>`)
        .addFields({name: `Page ${page+1}`, value: leaderboardText, inline: false})
        .setThumbnail(event.banner)
        .setTimestamp()
        .setFooter({text: FOOTER, iconURL: interaction.user.displayAvatarURL()});
      
      const leaderboardButtons = new ActionRowBuilder()
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

      const leaderboardMessage = await interaction.editReply({ 
        embeds: [leaderboardEmbed], 
        components: [leaderboardButtons],
        fetchReply: true
      });

      // Create a filter for valid responses
      const filter = (i) => {
        return i.customId == 'prev' || 
        i.customId == 'next' || 
        i.customId == 'mobile' || 
        i.customId == 'alt' ||
        i.customId == 'offset';
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
          if (page == 0) {
            page = MAX_PAGE;
          } else {
            page -= 1;
          }
        } else if (i.customId === 'next') {
          if (page == MAX_PAGE) {
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
        }

        start = page * RESULTS_PER_PAGE;
        end = start + RESULTS_PER_PAGE;
        if (offset) {
          start += 10;
          end += 10;
          end %= 120;
        }

        if(start > end) {
          slice = rankingData.slice(start, 120).concat(rankingData.slice(0, end));
          sliceOffset = lastHourCutoffs.slice(start, 120).concat(lastHourCutoffs.slice(0, end));
          sliceTierChange = tierChange.slice(start, 120).concat(tierChange.slice(0, end));
          sliceGamesPlayed = gamesPlayed.slice(start, 120).concat(gamesPlayed.slice(0, end));
          sliceGPH = GPH.slice(start, 120).concat(GPH.slice(0, end));
        }
        else {
          slice = rankingData.slice(start, end);
          sliceOffset = lastHourCutoffs.slice(start, end);
          sliceTierChange = tierChange.slice(start, end);
          sliceGamesPlayed = gamesPlayed.slice(start, end);
          sliceGPH = GPH.slice(start, end);
        }
        if (!alt) {
          leaderboardText = generateRankingText(slice, page, target, sliceOffset, sliceTierChange, mobile);
        }
        else {
          leaderboardText = generateAlternateRankingText(slice, page, target, sliceOffset, sliceGamesPlayed, sliceGPH, mobile);
        }
        leaderboardEmbed = new EmbedBuilder()
          .setColor(NENE_COLOR)
          .setTitle(`${event.name} Nyaa~`)
          .setDescription(`T100 Leaderboard at <t:${Math.floor(timestamp / 1000)}>\nChange since <t:${Math.floor(timestampIndex / 1000)}>\n`)
          .addFields({name: `Page ${page+1} / ${MAX_PAGE+1}`, value: leaderboardText, inline: false})
          .setThumbnail(event.banner)
          .setTimestamp()
          .setFooter({text: FOOTER, iconURL: interaction.user.displayAvatarURL()});

        await i.update({ 
          embeds: [leaderboardEmbed], 
          components: [leaderboardButtons]
        });
      });

      collector.on('end', async () => {
        await interaction.editReply({ 
          embeds: [leaderboardEmbed], 
          components: []
        });
      });
    }, async (err) => {
      // Log the error
      discordClient.logger.log({
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