/**
 * @fileoverview Display a heatmap of a given tier or player
 * @author Ai0796
 */

const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');

const COMMAND = require('../command_data/bar');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed'); 
const getEventData = require('../methods/getEventData');

const HOUR = 3600000; 
const EMPTY_BAR = '░';
const FILLED_BAR = '█';
const LEFT_BOUND = '╢';
const RIGHT_BOUND = '╠';
const BAR_WIDTH = 15;

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} graphUrl url of the graph we are trying to embed
 * @param {Integer} tier the ranking that the user wants to find
 * @param {DiscordClient} client we are using to interact with discord
 * @return {EmbedBuilder} graph embed to be used as a reply via interaction
 */
const generateBarEmbed = (title, body, discordClient) => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${title} Nyaa~`)
    .setFields(body)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now()/1000)}:R>`)
    .setThumbnail(discordClient.client.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({text: FOOTER, iconURL: discordClient.client.user.displayAvatarURL()});

  return graphEmbed;
};

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {String} str the string to be converted to ASCII 
 * @returns 
 */
function ensureASCII(str) {
  return str.replace(/[^a-z0-9&]/gi, ' ');
}

/**
 * Generated a graph using plotly and returns the image stream
 * @param {Object} data the data to be used in the graph
 * @param {Integer} hour hour to display the graph for
 * @returns {ImageData} the url of the graph
 */
const generateGraph = (data, hour, eventStart) => {

  const formatTime = (timestamp) => {
    let hour = timestamp / 1000 / 60 / 60;
    let minute = (hour - Math.floor(hour)) * 60;
    minute = Math.floor(minute);
    return `${String(minute).padEnd(2, ' ')}`;
  };

  const formatGraph = (point, maxVal, minVal) => {
    let percentage = (point - minVal) / (maxVal - minVal);
    let barLength = Math.floor(percentage * BAR_WIDTH) + 1;
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

  if (hour < 0 || hour > data.length - 1) {
    return { name: 'Error', value: 'No data available' };
  }

  let lines = [];

  let maxPoints = Math.max(...data[hour].map(point => point.score));
  let minPoints = Math.min(...data[hour].map(point => point.score));

  data[hour].forEach((point) => {
    lines.push(`\`${formatTime(point.timestamp - eventStart)} ${formatGraph(point.score, maxPoints, minPoints)} ${point.score.toLocaleString()}\``);
  });

  return { name: `Games Hour ${hour-1} (${data[hour].length} Games)`, value: lines.join('\n') };
};

const sendBarEmbed = (interaction, data, tier, component, discordClient) => {

  let embed = generateBarEmbed(tier, [data], discordClient);

  interaction.editReply({
    embeds: [embed],
    components: [component],
    fetchReply: true
  });
};

const sendUpdate = (i, data, tier, discordClient) => {
  
  let embed = generateBarEmbed(tier, [data], discordClient);

  i.update({
    embeds: [embed]
  });
};

const formatTitle = (tier, hourNum, eventstart) => {
  let hourStart = (eventstart + hourNum * HOUR) / 1000;
  let hourEnd = (eventstart + (hourNum + 1) * HOUR) / 1000;

  let hourString = `<t:${hourStart}:f> - <t:${hourEnd}:f>`;
  let title = `${tier}\n\n${hourString}`;
  return title;
};

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {Object} interaction object provided via discord
 * @param {Integer} tier the ranking that the user wants to find
 * @param {Object} rankData the ranking data obtained
 * @param {DiscordClient} client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (interaction, tier, rankData, eventData, hour, discordClient) => {
  if (!rankData) {
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

  tier = ensureASCII(tier);

  let lastPoint = 0;
  let pointsPerGame = [];

  rankData.forEach(point => {
    if (point.score > lastPoint) {
      let gain = point.score - lastPoint;
      if (gain < 150000 && gain >= 100) {
        pointsPerGame.push(gain);
      }
      lastPoint = point.score;
    }
  });

  if (pointsPerGame.length == 0) {
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
  
  let xData = [];
  let games = [];
  let maxTimestamp = eventData.startAt + HOUR;
  lastPoint = 0;

  let lastHourWithGame = 0;

  rankData.forEach(point => {
    if (point.timestamp > eventData.aggregateAt) {
      return;
    }
    while (point.timestamp > maxTimestamp) {
      xData.push(games);
      games = [];
      maxTimestamp += HOUR;
    }
    if (point.score > lastPoint) {
      let gain = point.score - lastPoint;
      if (gain < 150000 && gain >= 100) {
        games.push({ score: gain , timestamp: point.timestamp });
      }
      lastPoint = point.score;

      lastHourWithGame = xData.length;
    }
  });

  if (games.length > 0) {
    xData.push(games);
  }

  hour = hour ?? lastHourWithGame;

  const barButtons = new ActionRowBuilder()
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

  let barEmbed = await interaction.editReply(
    'Loading...',
    {
      collectors: [barButtons],
      fetchReply: true
    }
  );

  let data = generateGraph(xData, hour, eventData.startAt);
  sendBarEmbed(interaction, data, formatTitle(tier, hour, eventData.startAt), 
    barButtons, discordClient);

  const filter = (i) => {
    return i.customId == 'prev' || 
    i.customId == 'next';
  };

  const collector = barEmbed.createMessageComponentCollector({ 
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
      if (i.customId == 'prev') {
        hour--;
      } else if (i.customId == 'next') {
        hour++;
      }

      if (hour < 0) {
        hour = 0;
      } else if (hour > xData.length -1) {
        hour = xData.length - 1;
      }

      let data = generateGraph(xData, hour, eventData.startAt);
      sendUpdate(i, data, formatTitle(tier, hour, eventData.startAt), discordClient);
    }
  });

  collector.on('end', async (collected, reason) => {
    let options = generateGraph(xData, hour);
    sendBarEmbed(interaction, options, tier, null, discordClient);
  });
};

async function noDataErrorMessage(interaction, discordClient) {
  let reply = 'Please input a tier in the range 1-100 or input 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, or 50000';
  let title = 'Tier Not Found';

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
  return;
}

async function sendHistoricalTierRequest(eventData, tier, interaction, hour, discordClient) {
  
  let response = discordClient.cutoffdb.prepare('SELECT ID, score FROM cutoffs ' +
    'WHERE (Tier=@tier AND EventID=@eventID) ORDER BY SCORE DESC').all({
      tier: tier,
      eventID: eventData.id
    });

  if (response.length == 0) {
    noDataErrorMessage(interaction, discordClient);
  } else {
    let userId = response[0]['ID']; //Get the last ID in the list

    let data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: eventData.id
      });
    if (data.length > 0) {
      let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      let title = `${eventData.name} T${tier} Heatmap`;

      rankData.unshift({ timestamp: eventData.startAt, score: 0 });
      rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);

      postQuickChart(interaction, title, rankData, eventData, hour, discordClient);

    } else {
      noDataErrorMessage(interaction, discordClient);
    }
  }
}

async function sendTierRequest(eventData, tier, interaction, hour, discordClient) {
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventData.id,
    targetRank: tier,
    lowerLimit: 0
  }, async (response) => {

    let userId = response['rankings'][tier-1]['userId']; //Get the specific tier's userID
    
    let data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: eventData.id
      });
    if(data.length > 0) {
      let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      let title = `${eventData.name} T${tier} ${response['rankings'][tier-1]['name']}boo Heatmap`;

      rankData.unshift({ timestamp: eventData.startAt, score: 0 });
      rankData.push({ timestamp: Date.now(), score: response['rankings'][tier-1]['score'] });
      rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);
      
      postQuickChart(interaction, title, rankData, eventData, hour, discordClient);
      
    } else {
      noDataErrorMessage(interaction, discordClient);
    }
  }, (err) => {
    console.log(err);
  });
}

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),
  
  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });
    
    const event = discordClient.getCurrentEvent();

    const tier = interaction.options.getInteger('tier');
    const user = interaction.options.getMember('user');
    const eventId = interaction.options.getInteger('event') || event.id;
    const hour = interaction.options.getInteger('hour');

    const eventData = getEventData(eventId);
    const eventName = eventData.name;

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

    if(tier)
    {
      var data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
        'WHERE (Tier=@tier AND EventID=@eventID)').all({
          tier: tier,
          eventID: eventId
        });
      if (data.length == 0) {
        noDataErrorMessage(interaction, discordClient);
        return;
      }
      else if (eventId < discordClient.getCurrentEvent().id) {
        sendHistoricalTierRequest(eventData, tier, interaction, hour, discordClient);
      }
      else {
        sendTierRequest(eventData, tier, interaction, hour, discordClient);
      }
    } else if (user) {
      try {
        let id = discordClient.getId(user.id);

        if (id == -1) {
          interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        let data = discordClient.cutoffdb.prepare('SELECT * FROM users ' +
          'WHERE (id=@id AND EventID=@eventID)').all({
            id: id,
            eventID: eventId
          });

        if (data.length > 0)
        {
          let name = user.displayName;
          let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          rankData.unshift({ timestamp: eventData.startAt, score: 0 });
          postQuickChart(interaction, `${eventName} ${name} Heatmap`, rankData, eventData, hour, discordClient);
        }
        else
        {
          interaction.editReply({ content: 'Have you tried linking to the bot it\'s not magic ya know' });
        }
      } catch (err) {
        // Error parsing JSON: ${err}`
      }
    }
  }
};