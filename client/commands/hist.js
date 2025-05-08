/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */

const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } = require('../../constants');

const COMMAND = require('../command_data/hist');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');
const getEventData = require('../methods/getEventData');

const renderPlotlyImage = require('../../scripts/plotly_puppet.js');

const HOUR = 3600000;

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

const average = array => array.reduce((a, b) => a + b) / array.length;

const modeOf = a =>
  Object.values(
    a.reduce((count, e) => {
      if (!(e in count)) {
        count[e] = [0, e];
      }

      count[e][0]++;
      return count;
    }, {})
  ).reduce((a, v) => v[0] < a[0] ? a : v, [0, null])[1];

async function getStdDev(data) {
  let mean = average(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += Math.pow(data[i] - mean, 2);
  }
  return Math.sqrt(sum / data.length);
}

async function generateNormalDist(xData) {
  let start = Math.min(...xData);
  let end = Math.max(...xData);
  let step = (end - start) / 1000;
  let mean = average(xData);
  let stdDev = await getStdDev(xData);

  let x = [];
  let y = [];

  for (let i = start; i < end; i += step) {
    let val = Math.E ** (-1 * ((i - mean) ** 2) / (2 * stdDev ** 2)) / (stdDev * Math.sqrt(2 * Math.PI));
    x.push(i);
    y.push(val);
  }
  return { 'x': x, 'y': y };
}

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
    .setTitle(`${tier} Nyaa~`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
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

function getLastHour(sortedList, el) {
  if (sortedList.length === 0) {
    return 0;
  }
  for (let i = 0; i < sortedList.length; i++) {
    if (sortedList[i] > el) {
      return i;
    }
  }

  return sortedList.length - 1;

  // return Math.max(sortedList.indexOf(val), 0);
}

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {Object} interaction object provided via discord
 * @param {Integer} tier the ranking that the user wants to find
 * @param {Object} rankData the ranking data obtained
 * @param {DiscordClient} client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (interaction, tier, rankData, binSize, min, max, hourly, showGames, discordClient) => {
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

  let pointsPerGame = [];
  let energyPossibilities = energyBoost.map(() => 0);
  let lastPoint = 0;
  tier = ensureASCII(tier);

  var highBound;
  var lowBound;

  if (!hourly) {
    highBound = Math.min(max || 150000, 150000);
    lowBound = Math.max(min || 100, 100);
  }
  else {
    highBound = Math.min(max || 3000000, 3000000);
    lowBound = Math.max(min || 100, 100);
  }

  if (hourly) {
    let timestamps = rankData.map(x => x.timestamp);
    let movingWindowSpeeds = [];
    let timestampIndex = 0;

    rankData.slice(1).forEach((point, i) => {
      if (lastPoint < point.score && point.score - lastPoint >= 100) {
        let windowIndex = getLastHour(timestamps, point.timestamp - HOUR);
        timestamps = timestamps.slice(windowIndex);
        timestampIndex += windowIndex;
        let change = point.score - rankData[timestampIndex].score;
        if (change < highBound && change >= lowBound) {
          if (showGames) {
            let games = 0;
            for (let j = timestampIndex; j <= i; j++) {
              if (j <= 0) {
                continue;
              }
              if (rankData[j].score - rankData[j - 1].score >= 100) {
                games++;
              }
            }
            movingWindowSpeeds.push(games);
          } else {
            movingWindowSpeeds.push(change);
          }
        }
      }
      lastPoint = point.score;
    });

    pointsPerGame = movingWindowSpeeds;
  }
  else {
    rankData.forEach(point => {
      if (point.score > lastPoint) {
        let gain = point.score - lastPoint;
        if (gain < highBound && gain >= lowBound) {
          pointsPerGame.push(gain);
          energyBoost.forEach((x, idx) => {
            if (x != 1 && gain % x == 0 && gain < 2000 * x) {
              energyPossibilities[idx] += 1;
            }
          });
        }
        lastPoint = point.score;
      }
    });
  }

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

  let normalDistData = await generateNormalDist(pointsPerGame);
  let estimatedEnergy = energyPossibilities.indexOf(Math.max(...energyPossibilities));
  let binsize = binSize || Math.max(5, energyBoost[estimatedEnergy], Math.max(...pointsPerGame) / 1000);

  pointsPerGame = pointsPerGame.filter(x => x != 2456);

  if (hourly) {
    binsize = Math.max(1000, binSize || 10000);

  }

  if (showGames) {
    binsize = 1;
  }

  const average = (pointsPerGame.reduce((a, b) => a + b) / pointsPerGame.length).toFixed(2);
  const mode = modeOf(pointsPerGame);

  let layout = {
    title: tier,
    xaxis: {
      title: 'Event Points'
    },
    yaxis: { title: 'Count' },
    yaxis2: {
      title: 'Normal Distribution',
      overlaying: 'y',
      side: 'right',
      range: [0, Math.max(...normalDistData.y)]
    },
    bargap: 0.25,
    template: {
      data: {
        histogram: [
          {
            type: 'histogram',
            marker: {
              colorbar: {
                ticks: ''
              }
            }
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
    showlegend: true,
    legend: {
      title: {
        text: `n=${pointsPerGame.length}<br>` +
          `Max Score: ${Math.max(...pointsPerGame)}<br>` +
          `Average Score: ${average}<br>` +
          `Mode Score: ${mode}<br>`
      }
    }
  };

  let normal = {
      name: 'Normal Distribution',
      x: normalDistData.x,
      y: normalDistData.y,
      yaxis: 'y2',
      type: 'scatter'
  };

  var data = {
    data: [
      {
        name: `${tier}`,
        x: pointsPerGame,
        mode: 'markers',
        type: 'histogram',
        marker: {
          color: 'rgb(141,211,199)',
          line: {
            color: 'rgb(141,211,199)'
          }
        },
        autobinx: false,
        xbins: {
          start: min || Math.min(...pointsPerGame),
          end: max || Math.max(...pointsPerGame),
          size: binsize
        },
      }
    ],
    layout: layout
  };

  if (hourly) {
    data.data.push(normal);
  }

  let buffer = await renderPlotlyImage(data.data, data.layout);


  let file = new AttachmentBuilder(buffer, {name: 'hist.png'});
  await interaction.editReply({
    embeds: [generateGraphEmbed('attachment://hist.png', tier, discordClient)], files: [file]
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

async function sendHistoricalTierRequest(eventData, tier, binSize, min, max, hourly, showGames, interaction, discordClient) {
  
  let response = discordClient.cutoffdb.prepare('SELECT ID, Score FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY TIMESTAMP DESC').all({
      eventID: eventData.id,
      tier: tier
    });
  if (response.length > 0) {

    let userId = response[0]['ID'];//Get the last ID in the list
    let data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: eventData.id
      });
    if (data.length > 0) {
      let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      rankData.unshift({ timestamp: eventData.startAt, score: 0 });
      rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);
      // if (userId == 162304911000768500) {
      //   let maxVal = Math.max(...rankData.map(x => x.score));
      //   let minVal = maxVal / 35 * 29;
      //   rankData = rankData.filter(x => x.score >= minVal);
      // }
      postQuickChart(interaction, `${eventData.name} T${tier} Cutoffs`, rankData, binSize, min, max, hourly, showGames, discordClient);
    } else {
      noDataErrorMessage(interaction, discordClient);
    }
  } else {
    noDataErrorMessage(interaction, discordClient);
  }
}


async function sendTierRequest(eventData, tier, binSize, min, max, hourly, showGames, interaction, discordClient) {
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventData.id,
    targetRank: tier,
    lowerLimit: 0
  }, async (response) => {

    let userId = response['rankings'][0]['userId'];//Get the last ID in the list
    let data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: eventData.id
      });
    if (data.length > 0) {
      let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      rankData.unshift({ timestamp: eventData.startAt, score: 0 });
      rankData.push({ timestamp: Date.now(), score: response['rankings'][0]['score'] });
      rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);
      postQuickChart(interaction, `${eventData.name} T${tier} ${response['rankings'][0]['name']} Cutoffs`, rankData, binSize, min, max, hourly, showGames, discordClient);
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
    const binSize = interaction.options.getInteger('binsize');
    const min = interaction.options.getInteger('min');
    const max = interaction.options.getInteger('max');
    const hourly = interaction.options.getBoolean('hourly') || false;
    const eventId = interaction.options.getInteger('event') || event.id;
    const showGames = interaction.options.getBoolean('games') || false;
    const chapterId = interaction.options.getInteger('chapter') ?? null;

    let eventData = getEventData(eventId);

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

    if (chapterId !== null) {
      let eventId = Math.floor(chapterId / 100);
      eventData = getEventData(eventId);
      let world_blooms = discordClient.getAllWorldLinkChapters();

      let world_link = world_blooms.find(chapter => chapter.id == chapterId);
      eventData.startAt = world_link.chapterStartAt;
      eventData.aggregateAt = world_link.chapterEndAt;
      eventData.id = parseInt(`${eventData.id}${world_link.gameCharacterId}`);
      eventData.name = `${discordClient.getCharacterName(world_link.gameCharacterId)}'s Chapter`;
    }


    if (tier) {
      var data = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
        'WHERE (Tier=@tier AND EventID=@eventID)').all({
          tier: tier,
          eventID: eventData.id
        });
      if (data.length == 0) {
        noDataErrorMessage(interaction, discordClient);
        return;
      } else if (tier >= 200) {
        let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
        rankData.unshift({ timestamp: eventData.startAt, score: 0 });
        rankData.push({ timestamp: Date.now(), score: data[0].Score });
        rankData.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : (b.timestamp > a.timestamp) ? -1 : 0);
        postQuickChart(interaction, `${eventData.name} T${tier} Cutoffs`, rankData, binSize, min, max, hourly, showGames, discordClient);
      } else if (eventData.id < discordClient.getCurrentEvent().id || event.id > LOCKED_EVENT_ID) {
        sendHistoricalTierRequest(eventData, tier, binSize, min, max, hourly, showGames, interaction, discordClient);
      } else {
        sendTierRequest(eventData, tier, binSize, min, max, hourly, showGames, interaction, discordClient);
      }
    } else if (user) {
      try {
        if (eventData.id > LOCKED_EVENT_ID) {
          interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
          return;
        }
        
        let id = discordClient.getId(user.id);

        if (id == -1) {
          interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        let data = discordClient.cutoffdb.prepare('SELECT * FROM users ' +
          'WHERE (id=@id AND EventID=@eventID)').all({
            id: id,
            eventID: eventData.id
          });
        if (data.length > 0) {
          let name = user.displayName;
          let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          rankData.unshift({ timestamp: eventData.startAt, score: 0 });
          let title = `${eventData.name} ${name} Event Points`;
          postQuickChart(interaction, title, rankData, binSize, min, max, hourly, showGames, discordClient);
        }
        else {
          interaction.editReply({ content: 'Discord User found but no data logged (have you recently linked or event ended?)' });
        }
      } catch (err) {
        // Error parsing JSON: ${err}`
      }
    }
  },

  async autocomplete(interaction, discordClient) {

    let world_blooms = discordClient.getAllWorldLinkChapters();

    let options = world_blooms.map((chapter, i) => {
      return {
        name: chapter.character,
        value: chapter.id,
      };
    });

    await interaction.respond(options);
  }
};