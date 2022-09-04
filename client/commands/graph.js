/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */

const { MessageEmbed } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const https = require('https');
const fs = require('fs');

const COMMAND = require('../command_data/graph')

const generateSlashCommand = require('../methods/generateSlashCommand')
const generateEmbed = require('../methods/generateEmbed') 

const HOUR = 3600000;

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} graphUrl url of the graph we are trying to embed
 * @param {Integer} tier the ranking that the user wants to find
 * @param {DiscordClient} client we are using to interact with discord
 * @return {MessageEmbed} graph embed to be used as a reply via interaction
 */
const generateGraphEmbed = (graphUrl, tier, discordClient) => {
  const graphEmbed = new MessageEmbed()
    .setColor(NENE_COLOR)
    .setTitle(`${tier}`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now()/1000)}:R>`)
    .setThumbnail(discordClient.client.user.displayAvatarURL())
    .setImage(graphUrl)
    .setTimestamp()
    .setFooter(FOOTER, discordClient.client.user.displayAvatarURL());

  return graphEmbed
}

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {String} str the string to be converted to ASCII 
 * @returns 
 */
function ensureASCII(str) {
  return str.replace(/[^a-z0-9&]/gi, ' ')
}

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {Object} interaction object provided via discord
 * @param {Integer} tier the ranking that the user wants to find
 * @param {Object} rankData the ranking data obtained
 * @param {DiscordClient} client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (interaction, tier, rankData, discordClient) => {
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
    return
  }

  graphData = []

  rankData.forEach(point => {
    graphData.push({
      x: point.timestamp,
      y: point.score
    })
  });

  postData = JSON.stringify({
    "backgroundColor": "#FFFFFF",
    "format": "png",
    'chart': {
      'type': 'line', 
      'data': {
        'datasets': [{
          'label': `${ensureASCII(tier)}`, 
          "fill": false,
          'data': graphData
        }]
      },
      "options": {
        "scales": {
          "xAxes": [{
            "type": "time",
            "distribution": 'linear',
            "time": {
              "displayFormats": {
                "day": "MMM DD YYYY HH:mm"
              },
              "unit": 'hour',
              "stepSize": 6
            }
          }]
        }
      }
    }
  })

  const options = {
    host: 'quickchart.io',
    port: 443,
    path: `/chart/create`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`)

    let json = '';
    res.on('data', (chunk) => {
      json += chunk;
    });
    res.on('end', async () => {
      if (res.statusCode === 200) {
        try {
          console.log(JSON.stringify(JSON.parse(json)))
          await interaction.editReply({ 
            embeds: [generateGraphEmbed(JSON.parse(json).url, tier, discordClient)]
          })
        } catch (err) {
          // Error parsing JSON: ${err}`
          console.log(`ERROR 1 ${err}`)
        }
      } else {
        // Error retrieving via HTTPS. Status: ${res.statusCode}
        console.log(`Error retrieving via HTTPS ${res.statusCode}`)
      }
    });
  }).on('error', (err) => {});

  req.write(postData)
  req.end()
}

function getEventName(eventID) 
{
  const data = JSON.parse(fs.readFileSync('./sekai_master/events.json'));
  let currentEventIdx = -1;
  let currentDate = new Date();

  for (let i = 0; i < data.length; i++) {
    if (Math.floor(data[i].closedAt / 1000) > Math.floor(currentDate / 1000) &&
      Math.floor(data[i].startAt / 1000) < Math.floor(currentDate / 1000)) {
      currentEventIdx = i;
    }
  }
  
  return data[currentEventIdx].name
}

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),
  
  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    })
    
    const event = discordClient.getCurrentEvent()
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
      return
    }

    const eventName = getEventName(event.id)

    const tier = interaction.options.getInteger('tier');
    const user = interaction.options.getUser('user');

    if(tier)
    {
      const options = {
        host: COMMAND.CONSTANTS.SEKAI_BEST_HOST,
        path: `/event/${event.id}/rankings/graph?rank=${tier}&region=en`,
        headers: { 'User-Agent': 'request' },
        timeout: 5000
      };

      const request = https.request(options, (res) => {
        let json = '';
        res.on('data', (chunk) => {
          json += chunk;
        });
        res.on('end', async () => {
          if (res.statusCode === 200) {
            try {
              const rankData = JSON.parse(json);
              postQuickChart(interaction, `${eventName} T${tier} Cutoffs`, rankData.data.eventRankings, discordClient);
            } catch (err) {
              // Error parsing JSON: ${err}`
            }
          } else {
            // Error retrieving via HTTPS. Status: ${res.statusCode}
          }
        });
      }).on('error', (err) => { });
      request.setTimeout(5000, () => {
        try {
          let cutoffs = discordClient.cutoffdb.prepare('SELECT * FROM cutoffs ' +
            'WHERE (EventID=@eventID AND Tier=@tier)').all({
              eventID: event.id,
              tier: tier
            });
          let rankData = cutoffs.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          console.log(rankData);
          postQuickChart(interaction, `${eventName} T${tier} Cutoffs`, rankData, discordClient);
        } catch (err) {
          // Error parsing JSON: ${err}`
        }
      });
    } else if (user) {
      try {
        let data = discordClient.cutoffdb.prepare('SELECT * FROM users ' +
          'WHERE (discord_id=@discord_id AND EventID=@eventID)').all({
            discord_id: user.id,
            eventID: event.id
          });
        if (data.length)
        {
          let name = user.username;
          let rankData = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          postQuickChart(interaction, `${eventName} ${name} Event Points`, rankData, discordClient);
        }
        else
        {
          interaction.editReply({content: 'Discord User not found (are you sure that account is linked?)'})
        }
      } catch (err) {
        // Error parsing JSON: ${err}`
      }
    }
  }
};