/**
 * @fileoverview Implementation when users request any form of ranking information
 * from Project Sekai.
 * @author Potor10
 */

const { EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER, RESULTS_PER_PAGE } = require('../../constants');
const generateRankingText = require('../methods/generateRankingText');
const generateEmbed = require('../methods/generateEmbed'); 

// Messages displayed when there is an error
const RANK_CONSTANTS = {
  'NO_RESULTS_ERR': {
    type: 'Error',
    message: 'Unable to find the specified player on the ranking leaderboard.'
  },

  'NO_EVENT_ERR': {
    type: 'Error',
    message: 'There is currently no event going on',
  },

  'NO_RESPONSE_ERR': {
    type: 'Error',
    message: 'There was no response from the server. ' + 
      '\nPlease wait ~10 minutes after ranking concludes before trying again.',
  },

  'RATE_LIMIT_ERR': {
    type: 'Error', 
    message: 'You have reached the maximum amount of requests to the API. ' + 
      'You have been temporarily rate limited.'
  },

  'HIGHER_LIMIT': (RESULTS_PER_PAGE%2) ? Math.floor(RESULTS_PER_PAGE/2) : Math.floor(RESULTS_PER_PAGE/2)-1,
  'LOWER_LIMIT':  Math.floor(RESULTS_PER_PAGE/2)
};

/**
 * Obtains a snapshot of the ranking leaderboard from the provided parameters and replies to the
 * interaction with an embed.
 * @param {String} commandName the name of the command which needs to access the ranking leaderboard
 * @param {Interaction} interaction the discord interaction which initiated the command to access the leaderboard
 * @param {DiscordClient} discordClient the Discord Client we are accessing the interface with discord
 * @param {Object} requestParams the parameters provided to the API for our ranking leaderboard query 
 */
const getRank = async (commandName, interaction, discordClient, requestParams) => {
  const event = discordClient.getCurrentEvent();

  if (event.id === -1) {
    await interaction.editReply({
      embeds: [
        generateEmbed({
          name: commandName, 
          content: RANK_CONSTANTS.NO_EVENT_ERR, 
          client: discordClient.client
        })
      ]
    });
    return;
  }

  if (!discordClient.checkRateLimit(interaction.user.id)) {
    await interaction.editReply({
      embeds: [generateEmbed({
        name: commandName,
        content: { 
          type: RANK_CONSTANTS.RATE_LIMIT_ERR.type, 
          message: RANK_CONSTANTS.RATE_LIMIT_ERR.message + 
            `\n\nExpires: <t:${Math.floor(discordClient.getRateLimitRemoval(interaction.user.id) / 1000)}>`
        },
        client: discordClient.client
      })]
    });

    return;
  }

  
  // Check if 15 minutes have passed since the event ended
  if (Date.now() - event.aggregateAt > 0 && Date.now() - event.aggregateAt < 60 * 15 * 1000) {
    let id = discordClient.getId(interaction.user.id);

    if (id == -1) {
      interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
      return;
    }

    let data = discordClient.cutoffdb.prepare('SELECT * FROM users ' +
      'WHERE (id=@id AND EventID=@eventID)').all({
        id: id,
        eventID: event.id
      });
    if (data.length > 0)
    {
      let finalScore = data[data.length-1].Score;
      let finalRank = data[data.length-1].Tier;
      let finalTimestamp = data[data.length-1].Timestamp;

      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: commandName,
            content: {
              type: 'Success',
              message: `Event Ended, using last known data\n\n**T${finalRank}** - **${finalScore}** points, <t:${Math.floor(finalTimestamp/1000)}:T>`
            },
            client: discordClient.client
          })
        ]
      });

      return;
    }
    else {
      interaction.editReply({ content: 'Discord User found but no data logged (have you recently linked or event ended?)' });
    }
  }

  discordClient.addSekaiRequest('ranking', {
    eventId: event.id,
    ...requestParams
  }, async (response) => {

    // Check if the response is valid
    if (!response.rankings) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: commandName, 
            content: RANK_CONSTANTS.NO_RESPONSE_ERR, 
            client: discordClient.client
          })
        ]
      });
      return;
    } else if (response.rankings.length === 0) {
      await interaction.editReply({
        embeds: [
          generateEmbed({
            name: commandName, 
            content: RANK_CONSTANTS.NO_RESULTS_ERR, 
            client: discordClient.client
          })
        ]
      });
      return;
    }

    let higherLimit = RANK_CONSTANTS.HIGHER_LIMIT;
    let lowerLimit = RANK_CONSTANTS.LOWER_LIMIT;

    if (response.rankings[0].rank < RANK_CONSTANTS.HIGHER_LIMIT + 1) {
      const diff = RANK_CONSTANTS.HIGHER_LIMIT + 1 - response.rankings[0].rank;
      higherLimit -= diff;
      lowerLimit += diff;
    }

    requestParams.higherLimit = higherLimit;
    requestParams.lowerLimit = lowerLimit;

    discordClient.addSekaiRequest('ranking', {
      eventId: event.id,
      ...requestParams
    }, async (response) => {
      const timestamp = Date.now();    
  
      let leaderboardText = generateRankingText(response.rankings, 0, requestParams.higherLimit+1);
      const leaderboardEmbed = new EmbedBuilder()
        .setColor(NENE_COLOR)
        .setTitle(`${event.name}`)
        .addFields({
          name: `**Requested:** <t:${Math.floor(timestamp/1000)}:R>`, 
          value: leaderboardText, 
          inline: false
        })
        .setThumbnail(event.banner)
        .setTimestamp()
        .setFooter({text: FOOTER, iconURL: discordClient.client.user.displayAvatarURL()});
  
      await interaction.editReply({ 
        embeds: [leaderboardEmbed]
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
          name: commandName,
          content: { type: 'error', message: err.toString() },
          client: discordClient.client
        })]
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
        name: commandName,
        content: { type: 'error', message: err.toString() },
        client: discordClient.client
      })]
    });
  });
};

module.exports = getRank;