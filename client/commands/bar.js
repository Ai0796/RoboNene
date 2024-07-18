/**
 * @fileoverview Display a heatmap of a given tier or player
 * @author Ai0796
 */

const { AttachmentBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const { plotlyKey, plotlyUser } = require('../../config.json');

const COMMAND = require('../command_data/bar');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed'); 
const getEventData = require('../methods/getEventData');

const Plotly = require('plotly')(plotlyUser, plotlyKey);

const HOUR = 3600000; 

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} graphUrl url of the graph we are trying to embed
 * @param {Integer} tier the ranking that the user wants to find
 * @param {DiscordClient} client we are using to interact with discord
 * @return {EmbedBuilder} graph embed to be used as a reply via interaction
 */
const generateGraphEmbed = (graphUrl, tier, discordClient) => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${tier}`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now()/1000)}:R>`)
    .setThumbnail(discordClient.client.user.displayAvatarURL())
    .setImage(graphUrl)
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
const generateGraph = (data, hour) => {

  if (hour < 0 || hour > data.length - 1) {
    return null;
  }

  let title = `Points Per Game Hour ${hour}-${hour+1}`;

  let xValues = [];
  let yValues = data[hour];

  for (let i = 0; i < data[hour].length; i++) {
    xValues.push(i + 1);
  }

  let maxVal = Math.max(...yValues);
  let minVal = Math.min(...yValues);

  let upperBound = maxVal + Math.ceil(maxVal / 50);
  let lowerBound = Math.max(minVal - Math.floor(maxVal / 50), 0);

  let trace1 = {
    mode: 'markers',
    type: 'bar',
    x: xValues,
    y: yValues,
    text: yValues.map(String),
    textposition: 'auto',
    hoverinfo: 'none',
    ytype: 'array',
    opacity: 1,
    visible: true,
    xperiod: 0,
    yperiod: 0,
    hoverongaps: false,
  };
  
  let layout = {
    title: { text: title },
    xaxis: {
      title: 'Game',
      dtick: 1
    },
    yaxis: {
      title: 'EP',
      range: [lowerBound, upperBound],
    },
    annotations: [],
    legend: { title: { text: '<br>' } },
    autosize: true,
    dragmode: 'zoom',
    template: {
      data: {
        heatmap: [
          {
            type: 'heatmap',
            colorbar: {
              ticks: '',
              outlinewidth: 0
            },
            autocolorscale: true
          }
        ]
      },
      layout: {
        geo: {
          bgcolor: 'rgb(17,17,17)',
          showland: true,
          lakecolor: 'rgb(17,17,17)',
          landcolor: 'rgb(17,17,17)',
          showlakes: true,
          subunitcolor: '#506784'
        },
        font: { color: '#f2f5fa' },
        polar: {
          bgcolor: 'rgb(17,17,17)',
          radialaxis: {
            ticks: '',
            gridcolor: '#506784',
            linecolor: '#506784'
          },
          angularaxis: {
            ticks: '',
            gridcolor: '#506784',
            linecolor: '#506784'
          }
        },
        scene: {
          xaxis: {
            ticks: '',
            gridcolor: '#506784',
            gridwidth: 2,
            linecolor: '#506784',
            zerolinecolor: '#C8D4E3',
            showbackground: true,
            backgroundcolor: 'rgb(17,17,17)'
          },
          yaxis: {
            ticks: '',
            gridcolor: '#506784',
            gridwidth: 2,
            linecolor: '#506784',
            zerolinecolor: '#C8D4E3',
            showbackground: true,
            backgroundcolor: 'rgb(17,17,17)'
          },
          zaxis: {
            ticks: '',
            gridcolor: '#506784',
            gridwidth: 2,
            linecolor: '#506784',
            zerolinecolor: '#C8D4E3',
            showbackground: true,
            backgroundcolor: 'rgb(17,17,17)'
          }
        },
        title: { x: 0.05 },
        xaxis: {
          ticks: '',
          gridcolor: '#283442',
          linecolor: '#506784',
          automargin: true,
          zerolinecolor: '#283442',
          zerolinewidth: 2
        },
        yaxis: {
          ticks: '',
          gridcolor: '#283442',
          linecolor: '#506784',
          automargin: true,
          zerolinecolor: '#283442',
          zerolinewidth: 2
        },
        ternary: {
          aaxis: {
            ticks: '',
            gridcolor: '#506784',
            linecolor: '#506784'
          },
          baxis: {
            ticks: '',
            gridcolor: '#506784',
            linecolor: '#506784'
          },
          caxis: {
            ticks: '',
            gridcolor: '#506784',
            linecolor: '#506784'
          },
          bgcolor: 'rgb(17,17,17)'
        },
        colorway: ['#636efa', '#EF553B', '#00cc96', '#ab63fa', '#19d3f3', '#e763fa', '#fecb52', '#ffa15a', '#ff6692', '#b6e880'],
        hovermode: 'closest',
        colorscale: {
          diverging: [['0', '#8e0152'], ['0.1', '#c51b7d'], ['0.2', '#de77ae'], ['0.3', '#f1b6da'], ['0.4', '#fde0ef'], ['0.5', '#f7f7f7'], ['0.6', '#e6f5d0'], ['0.7', '#b8e186'], ['0.8', '#7fbc41'], ['0.9', '#4d9221'], ['1', '#276419']],
          sequential: [['0', '#0508b8'], ['0.0893854748603352', '#1910d8'], ['0.1787709497206704', '#3c19f0'], ['0.2681564245810056', '#6b1cfb'], ['0.3575418994413408', '#981cfd'], ['0.44692737430167595', '#bf1cfd'], ['0.5363128491620112', '#dd2bfd'], ['0.6256983240223464', '#f246fe'], ['0.7150837988826816', '#fc67fd'], ['0.8044692737430168', '#fe88fc'], ['0.8938547486033519', '#fea5fd'], ['0.9832402234636871', '#febefe'], ['1', '#fec3fe']],
          sequentialminus: [['0', '#0508b8'], ['0.0893854748603352', '#1910d8'], ['0.1787709497206704', '#3c19f0'], ['0.2681564245810056', '#6b1cfb'], ['0.3575418994413408', '#981cfd'], ['0.44692737430167595', '#bf1cfd'], ['0.5363128491620112', '#dd2bfd'], ['0.6256983240223464', '#f246fe'], ['0.7150837988826816', '#fc67fd'], ['0.8044692737430168', '#fe88fc'], ['0.8938547486033519', '#fea5fd'], ['0.9832402234636871', '#febefe'], ['1', '#fec3fe']]
        },
        plot_bgcolor: 'rgb(17,17,17)',
        paper_bgcolor: 'rgb(17,17,17)',
        shapedefaults: {
          line: { width: 0 },
          opacity: 0.4,
          fillcolor: '#f2f5fa'
        },
        sliderdefaults: {
          bgcolor: '#C8D4E3',
          tickwidth: 0,
          bordercolor: 'rgb(17,17,17)',
          borderwidth: 1
        },
        annotationdefaults: {
          arrowhead: 0,
          arrowcolor: '#f2f5fa',
          arrowwidth: 1
        },
        updatemenudefaults: {
          bgcolor: '#506784',
          borderwidth: 0
        }
      },
      themeRef: 'PLOTLY_DARK'
    },
    hovermode: 'closest',
    colorscale: {
      diverging: [['0', '#40004b'], ['0.1', '#762a83'], ['0.2', '#9970ab'], ['0.3', '#c2a5cf'], ['0.4', '#e7d4e8'], ['0.5', '#f7f7f7'], ['0.6', '#d9f0d3'], ['0.7', '#a6dba0'], ['0.8', '#5aae61'], ['0.9', '#1b7837'], ['1', '#00441b']],
      sequential: [['0', '#000004'], ['0.1111111111111111', '#1b0c41'], ['0.2222222222222222', '#4a0c6b'], ['0.3333333333333333', '#781c6d'], ['0.4444444444444444', '#a52c60'], ['0.5555555555555556', '#cf4446'], ['0.6666666666666666', '#ed6925'], ['0.7777777777777778', '#fb9b06'], ['0.8888888888888888', '#f7d13d'], ['1', '#fcffa4']],
      sequentialminus: [['0', '#0508b8'], ['0.08333333333333333', '#1910d8'], ['0.16666666666666666', '#3c19f0'], ['0.25', '#6b1cfb'], ['0.3333333333333333', '#981cfd'], ['0.4166666666666667', '#bf1cfd'], ['0.5', '#dd2bfd'], ['0.5833333333333334', '#f246fe'], ['0.6666666666666666', '#fc67fd'], ['0.75', '#fe88fc'], ['0.8333333333333334', '#fea5fd'], ['0.9166666666666666', '#febefe'], ['1', '#fec3fe']]
    },
    showlegend: false
  };

  let graphData = {
    data: [trace1],
    layout: layout
  };

  var pngOptions = {format: 'png', width: 1000, height: 500};
  return { data: graphData, options: pngOptions};
};

const sendBarEmbed = (interaction, options, tier, component, discordClient) => {
  Plotly.getImage(options.data, options.options, (err, imageStream) => {
    if (err) {
      console.log(err);
    }
    let attachment = new AttachmentBuilder(imageStream, { name: 'bar.png' });
    interaction.editReply({
      embeds: [generateGraphEmbed('attachment://bar.png', tier, discordClient)],
      files: [attachment],
      components: [component],
      fetchReply: true
    });
  });
};

const sendUpdate = (i, options, tier, discordClient) => {
  Plotly.getImage(options.data, options.options, (err, imageStream) => {
    if (err) {
      console.log(err);
    }
    let attachment = new AttachmentBuilder(imageStream, { name: 'bar.png' });
    i.update({
      embeds: [generateGraphEmbed('attachment://bar.png', tier, discordClient)],
      files: [attachment]
    });
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
        games.push(gain);
      }
      lastPoint = point.score;
    }
  });

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

  let options = generateGraph(xData, hour);
  sendBarEmbed(interaction, options, formatTitle(tier, hour, eventData.startAt), 
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

      let options = generateGraph(xData, hour);
      sendUpdate(i, options, formatTitle(tier, hour, eventData.startAt), discordClient);
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
      let title = `${eventData.name} T${tier} ${response['rankings'][0]['name']} Heatmap`;

      rankData.unshift({ timestamp: eventData.startAt, score: 0 });
      rankData.push({ timestamp: Date.now(), score: response['rankings'][0]['score'] });
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