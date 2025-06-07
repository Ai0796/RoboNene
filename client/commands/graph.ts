// client/commands/graph.ts
/**
 * @fileoverview Display a graph of the previous ranking trend
 * @author Potor10
 */

import { EmbedBuilder, CommandInteraction, AttachmentBuilder } from 'discord.js'; // Import AttachmentBuilder
import { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } from '../../constants';
import * as https from 'https';

import * as COMMAND from '../command_data/graph'; // Import all exports from graph
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import getEventData from '../methods/getEventData'; // Assuming default export
import DiscordClient from '../client'; // Assuming default export

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

interface RankDataPoint {
  timestamp: number;
  score: number;
}

/**
 * Create a graph embed to be sent to the discord interaction
 * @param {string} graphUrl url of the graph we are trying to embed
 * @param {string} tier the ranking that the user wants to find
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @return {EmbedBuilder} graph embed to be used as a reply via interaction
 */
const generateGraphEmbed = (graphUrl: string, tier: string, discordClient: DiscordClient): EmbedBuilder => {
  const graphEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle(`${tier} Nyaa~`)
    .setDescription(`**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`)
    .setThumbnail(discordClient.client.user?.displayAvatarURL() || '') // Optional chaining
    .setImage(graphUrl)
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: discordClient.client.user?.displayAvatarURL() || '' }); // Optional chaining

  return graphEmbed;
};

/**
 * Ensures a string is ASCII to be sent through HTML
 * @param {String} str the string to be converted to ASCII
 * @returns {string}
 */
function ensureASCII(str: string): string {
  return str.replace(/[^ -~]/gi, ' ');
}

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {CommandInteraction} interaction object provided via discord
 * @param {string} tier the ranking that the user wants to find
 * @param {RankDataPoint[][]} rankDatas array of ranking data obtained for multiple events/tiers
 * @param {EventData[]} events array of event data
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (interaction: CommandInteraction, tier: string, rankDatas: RankDataPoint[][], events: EventData[], discordClient: DiscordClient): Promise<void> => {
  if (!rankDatas || rankDatas.length === 0 || rankDatas.every(data => data.length === 0)) {
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

  const chartTier = ensureASCII(tier); // Use chartTier for graph title/labels
  for (let i = 0; i < rankDatas.length; i++) {
    // Filter out data points after event aggregate time + 15 minutes buffer
    rankDatas[i] = rankDatas[i].filter(point => point.timestamp < events[i].aggregateAt + 60 * 15 * 1000);
  }
  const formattedRankDatas = rankDatas.map((rankData, i) => {
    return rankData.map(point => {
      return {
        x: point.timestamp - events[i].startAt, // Time elapsed from event start
        y: point.score
      };
    });
  });

  const totalEvents = formattedRankDatas.length;

  let usableColors: string[];

  if (formattedRankDatas.length >= 4) { // Use all 8 colors if 4 or more datasets
    usableColors = colors;
  } else { // Use a subset if fewer than 4 datasets
    usableColors = colors.slice(0, formattedRankDatas.length);
  }


  const graphData = formattedRankDatas.map((rankData, i) => {
    return {
      'type': 'line',
      'borderWidth': 2,
      'label': ensureASCII(`${events[i].id}: ${events[i].name} ${chartTier}`),
      'fill': false, // Changed to false for line graph, fill was true in original
      'spanGaps': false,
      'pointRadius': 0,
      'borderColor': usableColors[i % usableColors.length], // Cycle through available colors
      'backgroundColor': usableColors[i % usableColors.length],
      'order': totalEvents - i, // Ensure higher order for first elements (draw on top)
      'data': rankData
    };
  });

  const postData = JSON.stringify({
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
          }],
          'yAxes': [{ // Added y-axis configuration for clarity
            'ticks': {
              'beginAtZero': true
            }
          }]
        }
      }
    }
  });

  const options: https.RequestOptions = { // Explicitly type options
    host: 'quickchart.io',
    port: 443,
    path: '/chart/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData) // Use Buffer.byteLength
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
          const responseBody = JSON.parse(json);
          console.log(JSON.stringify(responseBody));
          const imageUrl = responseBody.url; // Get the URL from the response
          if (imageUrl) {
            await interaction.editReply({
              content: `<${imageUrl}?width=1000&height=600>`, // Use content for direct link
              embeds: [generateGraphEmbed(imageUrl + '?width=1000&height=600', chartTier, discordClient)] // Embed with image
            });
          } else {
            throw new Error('QuickChart did not return a URL.');
          }
        } catch (err: any) { // Type as any for error
          console.error(`ERROR parsing QuickChart JSON or generating reply: ${err.message}`); // Changed to console.error
          await interaction.editReply({
            embeds: [generateEmbed({
              name: COMMAND.INFO.name,
              content: { type: 'Error', message: 'Failed to generate graph: ' + err.message },
              client: discordClient.client
            })]
          });
        }
      } else {
        console.error(`Error retrieving graph from QuickChart. Status: ${res.statusCode}, Response: ${json}`); // Changed to console.error
        await interaction.editReply({
          embeds: [generateEmbed({
            name: COMMAND.INFO.name,
            content: { type: 'Error', message: `Failed to generate graph. QuickChart Status: ${res.statusCode}` },
            client: discordClient.client
          })]
        });
      }
    });
  });

  req.on('error', (err: any) => { // Type as any for error
    console.error(`Error during QuickChart request: ${err.message}`); // Changed to console.error
    interaction.editReply({
      embeds: [generateEmbed({
        name: COMMAND.INFO.name,
        content: { type: 'Error', message: 'Failed to connect to graph service.' },
        client: discordClient.client
      })]
    });
  });

  req.write(postData);
  req.end();
};

async function noDataErrorMessage(interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
  const reply = 'Please input a tier in the range 1-100'; // Message from original
  const title = 'Tier Not Found';

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
}

interface CutoffDbEntry {
  EventID: number;
  Tier: number;
  Timestamp: number;
  Score: number;
  ID: string;
}

function getUserData(userId: string, eventId: number, discordClient: DiscordClient): RankDataPoint[] {
  const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM users ' + // Use 'users' table for user data
    'WHERE (id=@id AND EventID=@eventID)').all({
      id: userId,
      eventID: eventId
    }) as CutoffDbEntry[] || [];
  const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
  // Add a starting point if not present
  if (rankData.length > 0 && rankData[0].timestamp !== discordClient.getCurrentEvent().startAt) {
      rankData.unshift({ timestamp: discordClient.getCurrentEvent().startAt, score: 0 });
  } else if (rankData.length === 0) { // If no data, return empty array
      return [];
  }
  return rankData;
}

function getTierData(tier: number, event: EventData, discordClient: DiscordClient): RankDataPoint[] {
  const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
    'WHERE (Tier=@tier AND EventID=@eventID)').all({
      tier: tier,
      eventID: event.id
    }) as CutoffDbEntry[] || [];
  const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
  // Add a starting point if not present
  if (rankData.length > 0 && rankData[0].timestamp !== event.startAt) {
      rankData.unshift({ timestamp: event.startAt, score: 0 });
  } else if (rankData.length === 0) { // If no data, return empty array
      return [];
  }
  return rankData;
}

function getTierPlayerData(tier: number, event: EventData, discordClient: DiscordClient): RankDataPoint[] {
  const data: { ID: string, Score: number }[] = discordClient.cutoffdb?.prepare('SELECT ID, Score FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY TIMESTAMP DESC LIMIT 1').all({ // Limit 1 to get the latest ID
      eventID: event.id,
      tier: tier
    }) as { ID: string, Score: number }[] || [];

  if (data.length > 0) {
    const userId = data[0].ID; // Get the user ID from the latest entry for that tier
    const userData: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: event.id
      }) as CutoffDbEntry[] || [];
    const rankData: RankDataPoint[] = userData.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
    if (rankData.length > 0 && rankData[0].timestamp !== event.startAt) {
        rankData.unshift({ timestamp: event.startAt, score: 0 });
    }
    return rankData;
  }
  return [];
}

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const event = discordClient.getCurrentEvent();

    const tier = interaction.options.getString('tier');
    const user = interaction.options.getMember('user');
    let eventsInput = interaction.options.getString('event'); // Renamed to avoid conflict with event object
    const graphTier = interaction.options.getBoolean('by_tier'); // True for tier, false for player
    let chapterInput = interaction.options.getString('chapter'); // Renamed to avoid conflict

    let splitEvents: EventData[] = [];
    let splitTiers: number[] = [];
    let chapterIds: number[] | null = null;


    if (eventsInput) {
      // Parse comma-separated event IDs
      const eventIds = eventsInput.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      splitEvents = eventIds.map(id => getEventData(id)).filter(e => e.id !== -1);
    } else {
      splitEvents = [event]; // Default to current event if none provided
    }

    if (tier) {
      splitTiers = tier.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
    }

    if (chapterInput) {
      chapterIds = chapterInput.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }


    let relevantEvents: EventData[] = [];

    // Filter relevant events based on chapter selection if applicable
    splitEvents.forEach(_event => { // Renamed parameter to avoid shadowing
      const currentEvent = _event; // Use a local variable for clarity

      if (chapterIds !== null && currentEvent.eventType === 'world_bloom') {
        const world_blooms = discordClient.getAllWorldLinkChapters(currentEvent.id);

        chapterIds.forEach(chapterId => {
          const world_link = world_blooms.find((x: any) => x.chapterNo === chapterId); // Type as any for world_link
          if (!world_link) {
            return;
          }
          // Create a new event object for the chapter for graphing purposes
          const chapterEvent: EventData = {
            id: parseInt(`${currentEvent.id}${world_link.gameCharacterId}`), // Unique ID for chapter
            name: `${discordClient.getCharacterName(world_link.gameCharacterId)}'s Chapter`,
            startAt: world_link.chapterStartAt,
            aggregateAt: world_link.chapterEndAt,
            closedAt: world_link.chapterEndAt, // Assuming closedAt is same as aggregateAt
            eventType: currentEvent.eventType,
            banner: currentEvent.banner,
            assetbundleName: currentEvent.assetbundleName,
          };
          // Add this chapter event for each relevant tier
          splitTiers.forEach(() => {
              relevantEvents.push(chapterEvent);
          });
        });
      } else {
        // For non-world_bloom events or if no chapter is specified, add the main event
        splitTiers.forEach(() => {
            relevantEvents.push(currentEvent);
        });
      }
    });

    // Ensure only unique events are processed
    const uniqueEventsMap = new Map<number, EventData>();
    relevantEvents.forEach(e => uniqueEventsMap.set(e.id, e));
    const eventsToGraph = Array.from(uniqueEventsMap.values());


    if (eventsToGraph.filter(x => x.id !== -1).length === 0) {
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
      let data: RankDataPoint[][] = [];
      splitTiers.forEach(tierNum => {
        eventsToGraph.forEach(e => { // Use eventsToGraph
          let tierData: RankDataPoint[];
          if (graphTier) { // Graphing specific tiers based on tier ID
            tierData = getTierData(tierNum, e, discordClient);
          } else { // Graphing specific players (whose current rank is `tierNum`)
            tierData = getTierPlayerData(tierNum, e, discordClient);
          }
          if (tierData.length > 0) {
              data.push(tierData);
          }
        });
      });

      if (data.length === 0) {
        await noDataErrorMessage(interaction, discordClient);
        return;
      }
      const tierNameForGraph = splitTiers.map(x => `T${x}`).join(', ');
      await postQuickChart(interaction, tierNameForGraph, data, eventsToGraph, discordClient);

    } else if (user) {
      try {
        if (event.id > LOCKED_EVENT_ID) {
          await interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
          return;
        }

        const id = discordClient.getId(user.id);

        if (id === -1) {
          await interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        const userDataArrays: RankDataPoint[][] = eventsToGraph.map(e => getUserData(id.toString(), e.id, discordClient));
        const filteredUserDataArrays = userDataArrays.filter(arr => arr.length > 0);

        if (filteredUserDataArrays.length > 0) {
          const name = user.displayName;
          await postQuickChart(interaction, `${event.name} ${name} Event Points`, filteredUserDataArrays, eventsToGraph, discordClient); // Pass eventsToGraph
        }
        else {
          await interaction.editReply({ content: 'Discord User found but no data logged (have you recently linked or event ended?)' });
        }
      } catch (err: any) {
        console.error('Error in graph command for user:', err);
        await interaction.editReply({
            embeds: [generateEmbed({
                name: COMMAND.INFO.name,
                content: { type: 'Error', message: 'An unexpected error occurred while fetching user data.' },
                client: discordClient.client
            })]
        });
      }
    } else {
        // If neither tier nor user is provided (should not happen due to command definition)
        await interaction.editReply({
            embeds: [generateEmbed({
                name: COMMAND.INFO.name,
                content: { type: 'Error', message: 'Please provide either a tier or a user.' },
                client: discordClient.client
            })]
        });
    }
  }
};