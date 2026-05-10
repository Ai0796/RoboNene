/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */

const { EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } = require('../../constants');
const https = require('https');

const COMMAND = require('../command_data/graph');

const generateSlashCommand = require('../methods/generateSlashCommand');
const generateEmbed = require('../methods/generateEmbed');
const getEventData = require('../methods/getEventData');
const { search } = require('fast-fuzzy');

const colors = [
  '#FF77217F',
  '#0077DD7F',
  '#00BBDC7F',
  '#FF679A7F',
  '#FFCDAC7F',
  '#99CDFF7F',
  '#FFA9CC7F',
  '#9AEEDE7F',
];

const characterColors = {
  'Ichika Hoshino': '#33AAEE7F',
  'Saki Tenma': '#FFDD447F',
  'Honami Mochizuki': '#EE66667F',
  'Shiho Hinomori': '#BBDD227F',
  'Minori Hanasato': '#FFCCAA7F',
  'Haruka Kiritani': '#99CCFF7F',
  'Airi Momoi': '#FFAACC7F',
  'Shizuku Hinomori': '#99EEDD7F',
  'Kohane Azusawa': '#FF66997F',
  'An Shiraishi': '#00BBDD7F',
  'Akito Shinonome': '#FF77227F',
  'Toya Aoyagi': '#0077DD7F',
  'Tsukasa Tenma': '#FFBB007F',
  'Emu Otori': '#FF66BB7F',
  'Nene Kusanagi': '#33DD997F',
  'Rui Kamishiro': '#BB88EE7F',
  'Kanade Yoisaki': '#BB66887F',
  'Mafuyu Asahina': '#8888CC7F',
  'Ena Shinonome': '#CCAA887F',
  'Mizuki Akiyama': '#DDAACC7F',
  'Hatsune Miku': '#33CCBB7F',
  'Kagamine Rin': '#FFCC117F',
  'Kagamine Len': '#FFEE117F',
  'Megurine Luka': '#FFBBCC7F',
  'MEIKO': '#DD44447F',
  'KAITO': '#3366CC7F'
};

// using patternomoly library
const patterns = [
  'plus',
  'dash',
  'disc',
  'zigzag',
  'triangle',
  'square',
  'dimanond-box',
];

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} graphUrl url of the graph we are trying to embed
 * @param {Integer} tier the ranking that the user wants to find
 * @param {DiscordClient} client we are using to interact with discord
 * @return {MessageEmbed} graph embed to be used as a reply via interaction
 */
const generateGraphEmbed = (graphUrl, tier, discordClient) => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${tier} Nyaa~`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setThumbnail(discordClient.client.user.displayAvatarURL())
    .setImage(graphUrl)
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user.displayAvatarURL() });

  return graphEmbed;
};

async function getUserData(userId, event, discordClient) {
  let data = await discordClient.pgClient.selectUser(event.id, userId);
  data = data.map(x => ({ timestamp: x.timestamp, score: x.score }));
  data.unshift({ timestamp: event.startAt, score: 0 });
  return data;
}

async function getTierData(tier, event, discordClient) {
  let data = await discordClient.pgClient.selectTier(tier, event.id);
  data = data.map(x => ({ timestamp: x.timestamp, score: x.score }));
  data.unshift({ timestamp: event.startAt, score: 0 });
  return data;
}

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {String} str the string to be converted to ASCII 
 * @returns 
 */
function ensureASCII(str) {
  return str.replace(/[^ -~]/gi, ' ');
}

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {Object} interaction object provided via discord
 * @param {Integer} tier the ranking that the user wants to find
 * @param {Object} rankData the ranking data obtained
 * @param {DiscordClient} client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (interaction, tier, rankDatas, events, discordClient) => {
  if (!rankDatas) {
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
  for (let i = 0; i < rankDatas.length; i++) {
    rankDatas[i] = rankDatas[i].filter(point => point.timestamp < events[i].aggregateAt + 60 * 15 * 1000);
  }

  let interpolate = 1;

  if (rankDatas.length > 2) {
    interpolate = rankDatas.length; // If we have too many graphs only get every X points to reduce size
  }

  rankDatas = rankDatas.map((rankData, i) => {

    let j = 0;
    let startTime = events[i].startAt ?? Math.min(...rankData.map(p => p.timestamp));

    return rankData.map(point => {
      j++;

      if (j % interpolate !== 0 && interpolate > 1) {
        return null;
      }

      return {
        x: point.timestamp - startTime,
        y: point.score
      };
    }).filter(point => point !== null);
  });

  let totalEvents = rankDatas.length;

  var usableColors;

  if (rankDatas.length >= 4) {
    usableColors = colors;
  } else {
    usableColors = colors.slice(2, rankDatas.length + 2);
  }

  let colorLen = usableColors.length;

  let usedColors = [];
  let usedPatterns = [];

  let characters = events.map(event => discordClient.SekaiEventObject.getCharacter(event.chapterId ?? event.id));
  let characterDict = {};

  characters.forEach(character => {
    if (characterDict[character]) {
      characterDict[character]++;
    } else {
      characterDict[character] = 0;
    }

    usedColors.push(characterColors[character] || usableColors[usedColors.length % colorLen]);
    usedPatterns.push(patterns[characterDict[character] % patterns.length], usedColors[usedColors.length - 1]); // If we have multiple of the same character use patterns to differentiate;
  });
  console.log(usedColors, usedPatterns);


  let graphData = rankDatas.map((rankData, i) => {
    return {
      'type': 'scatter',
      'borderWidth': 2,
      'label': ensureASCII(`${events[i].id}: ${events[i].name} ${tier}`),
      'fill': true,
      'spanGaps': false,
      'pointRadius': 0,
      // 'borderDash': [
      //   2,
      //   totalEvents
      // ],
      // 'borderDashOffset': i,
      'borderColor': usedColors[i],
      'backgroundColor': usedColors[i] ?? '',
      'order': totalEvents - i,
      'data': rankData
    };
  });

  let postData = JSON.stringify({
    'backgroundColor': '#FFFFFF',
    'format': 'png',
    'chart': {
      'type': 'line',
      'data': {
        'datasets': graphData
      },
      'options': {
        'scales': {
          'xAxes': [{
            'type': 'time',
            'distribution': 'linear',
            'time': {
              'displayFormats': {
                'hour': '[Day] D HH'
              },
              'unit': 'hour',
              'stepSize': 3
            }
          }]
        }
      }
    }
  });

  const options = {
    host: 'quickchart.io',
    port: 443,
    path: '/chart/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    console.log(`statusCode: ${res.statusCode}`);

    let json = '';
    res.on('data', (chunk) => {
      json += chunk;
    });
    res.on('end', async () => {
      if (res.statusCode === 200) {
        try {
          console.log(JSON.stringify(JSON.parse(json)));
          await interaction.editReply({
            content: `<${JSON.parse(json).url}?width=1000&height=600>`,
            embeds: [generateGraphEmbed(JSON.parse(json).url + '?width=1000&height=600', tier, discordClient)]
          });
        } catch (err) {
          // Error parsing JSON: ${err}`
          console.log(`ERROR 1 ${err}`);
        }
      } else {
        // Error retrieving via HTTPS. Status: ${res.statusCode}
        console.log(`Error retrieving via HTTPS ${res.statusCode} ${json}`);
      }
    });
  }).on('error', () => { });

  req.write(postData);
  req.end();
};

async function noDataErrorMessage(interaction, discordClient) {
  let reply = 'Please input a tier in the range 1-100';
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

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    let event = discordClient.getCurrentEvent();

    const tier = interaction.options.getString('tier');

    // When people use the command for cutoffs they usually want to see the tier graph
    const graphTierDefault = (['50', '100', '200', '300', '400', '500', '1000', '2000', '3000', '4000', '5000', '10000', '20000', '30000', '40000', '50000', '100000'].includes(tier)) ? true : false;

    const user = interaction.options.getMember('user');
    let events = interaction.options.getString('event') || [event];
    const graphTier = interaction.options.getBoolean('by_tier') || graphTierDefault;
    let chapter = interaction.options.getString('chapter') ?? null;

    var splitEvents;
    var splitTiers;

    if (typeof (events) === 'string') {
      splitEvents = events.split(',').map(x => getEventData(parseInt(x)));
    } else {
      splitEvents = events;
    }

    if (typeof (tier) === 'string') {
      splitTiers = tier.split(',').map(x => parseInt(x));
    } else {
      splitTiers = [tier];
    }

    if (typeof (chapter) === 'string') {
      chapter = chapter.split(',').map(x => parseInt(x));
    }

    let tierName = splitTiers.map(x => `T${x}`).join(', ');

    events = [];

    splitEvents.forEach(event => {
      if (chapter !== null && event.eventType === 'world_bloom') {
        let world_blooms = discordClient.getAllWorldLinkChapters(event.id);

        chapter.forEach(chapterId => {
          let world_link = world_blooms.find(x => x.chapterNo === chapterId);
          if (!world_link) {
            return;
          }
          world_link.startAt = world_link.chapterStartAt;
          world_link.aggregateAt = world_link.chapterEndAt;
          world_link.id = parseInt(`${event.id}${world_link.gameCharacterId}`);
          world_link.chapterId = `${event.id}-${chapterId}`;
          world_link.name = `${discordClient.SekaiEventObject.getEventName(world_link.chapterId)}`;
          for (let i = 0; i < splitTiers.length; i++) {
            events.push(world_link);
          }
        });
      } else {
        for (let i = 0; i < splitTiers.length; i++) {
          events.push(event);
        }
      }
    });

    let eventsUnique = [];
    let eventsUniqueIds = new Set();

    events.forEach(event => {
      if (!eventsUniqueIds.has(event.id)) {
        eventsUniqueIds.add(event.id);
        eventsUnique.push(event);
      }
    });

    // eventsUnique = eventsUnique.slice(0, 10); // If I graph too much the bot will literally die

    if (events.filter(x => x.id > 0).length === 0) {
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

    if (tier) {
      if (graphTier) {
        let data = [];
        for (const tierNum of splitTiers) {
          for (const event of eventsUnique) {
            const tierData = await getTierData(tierNum, event, discordClient);
            data.push(tierData);
          }
        }
        data = data.filter(x => x.length > 0);
        if (data.length === 0) {
          noDataErrorMessage(interaction, discordClient);
          return;
        }
        postQuickChart(interaction, `${tierName}`, data, events, discordClient);
      } else {
        let data = [];
        for (const tierNum of splitTiers) {
          for (const event of eventsUnique) {
            const tierData = await getTierData(tierNum, event, discordClient);
            data.push(tierData);
          }
        }
        console.log(data.length, events.length);
        data = data.filter(x => x.length > 0);
        if (data.length === 0) {
          noDataErrorMessage(interaction, discordClient);
          return;
        }
        postQuickChart(interaction, `${tierName} Player`, data, events, discordClient);
      }
    } else if (user) {
      try {
        if (event.id > LOCKED_EVENT_ID) {
          interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
          return;
        }

        let id = discordClient.getId(user.id);

        if (id == -1) {
          interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        let data = await Promise.all(
            events.map(async (event) => {
                return await getUserData(id, event.id, discordClient);
            })
        );
        data = data.filter(x => x.length > 0);
        if (data.length > 0) {
          let name = user.displayName;
          postQuickChart(interaction, `${event.name} ${name} Event Points`, data, events, discordClient);
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

    // TODO : Refactor to use getWorldBloomAutocomplete method
    // Graph doesn't override to allow graphing multiple World Blooms
    // So eventID still needs to be added

    let world_blooms = discordClient.getAllWorldLinkChapters();

    let options = world_blooms.map((chapter, i) => {
      return {
        name: chapter.character,
        value: `${chapter.chapterNo}`,
      };
    });

    options.unshift({
      name: 'All Chapters',
      value: [...new Set(options.map(x => x.value))].join(','),
    });

    if (interaction.options.getFocused()) {
      options = search(interaction.options.getFocused(), options, {
        keySelector: (option) => option.name,
        threshold: 0.4,
      });
    }

    options = options.slice(0, 25);

    await interaction.respond(options);
  }
};