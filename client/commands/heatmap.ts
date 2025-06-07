// client/commands/heatmap.ts
/**
 * @fileoverview Display a heatmap of a given tier or player
 * @author Ai0796
 */

import { AttachmentBuilder, EmbedBuilder, CommandInteraction, GuildMember } from 'discord.js'; // Import GuildMember
import { NENE_COLOR, FOOTER, LOCKED_EVENT_ID } from '../../constants';

import * as COMMAND from '../command_data/heatmap'; // Import all exports from heatmap
import generateSlashCommand from '../methods/generateSlashCommand'; // Assuming default export
import generateEmbed from '../methods/generateEmbed'; // Assuming default export
import getEventData from '../methods/getEventData'; // Assuming default export
import renderPlotlyImage from '../../scripts/plotly_puppet'; // Assuming default export
import DiscordClient from '../client'; // Assuming default export


const HOUR = 3600000;
const DAY = 86400000;

interface ColorPaletteEntry {
  0: string;
  1: string;
}

interface PlotlyColorScale {
    colorscale: ColorPaletteEntry[];
}

const formatPallete = (colors: string[]): PlotlyColorScale => {
  const formatted: ColorPaletteEntry[] = [];
  const distance = 1 / (colors.length - 1);
  colors.forEach((color, i) => {
    formatted.push([String((distance * i).toFixed(3)) as any, color]); // Type assertion because plotly.js-dist-min expects string for first element
  });
  return { colorscale: formatted };
};

const standard = formatPallete([
  '#fcd4dc',
  '#ece2f0',
  '#d0d1e6',
  '#a6bddb',
  '#67a9cf',
  '#3690c0',
  '#8B74BD',
  '#7953A9',
  '#301934',
]);

const legacy = formatPallete([
  '#f7fbff',
  '#deebf7',
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#4292c6',
  '#2171b5',
  '#08519c',
  '#08306b'
]);

const ankoha = formatPallete([
  '#f25e74',
  '#ff8884',
  '#026178',
  '#0682a6',
  '#34a1c7'
]);

const cinema = formatPallete([
  '#8c0d07',
  '#ec7c71',
  '#7ecccc',
  '#2d7d7e'
]);

const shinonome = formatPallete([
  '#ff7722',
  '#ccaa88'
]);

const miraclePaint = formatPallete([
  '#83e4d1',
  '#79c3fd',
  '#89a4fb',
  '#af8efe',
  '#fb8dcc',
  '#ff88ac',
  '#fe8b7f',
  '#fdda99',
  '#810095',
  '#5f01ab',
  '#04186d'
]);

const emu = formatPallete([
  '#fde4f2',
  '#f9cee7',
  '#f4b8da',
  '#eea1cd',
  '#e68bbe',
  '#ff66bc'
]);

const palettes = [
  standard,
  legacy,
  ankoha,
  cinema,
  shinonome,
  miraclePaint,
  emu
];

const labels = [
  '',
  'K',
  'M',
  'B'
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
 * @param {string} tier the ranking that the user wants to find (or title of heatmap)
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
 * @param {string} str the string to be converted to ASCII
 * @returns {string}
 */
function ensureASCII(str: string): string {
  return str.replace(/[^a-z0-9&]/gi, ' ');
}

async function postHamster(
  interaction: CommandInteraction,
  title: string,
  eventData: EventData,
  offset: number,
  palette: PlotlyColorScale,
  annotateGames: boolean,
  byPoints: boolean,
  discordClient: DiscordClient
): Promise<void> {
  const maxGamesPerHour = 32; // This value is hardcoded from the example heatmapData
  const heatmapData: number[][] = [
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 0, 21, 21, 5, 5, 5, 5, 0, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 5, 5, 5, 5, 5, 5, 0, 16, 16, 16, 16, 0, 0, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 21, 21, 5, 5, 5, 5, 5, 5, 0, 16, 16, 0, 32, 32, 32, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 21, 32, 32, 32, 32, 0, 5, 5, 5, 5, 0, 16, 0, 32, 32, 32, 32, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 21, 32, 32, 32, 32, 0, 5, 5, 5, 5, 5, 0, 32, 32, 32, 32, 0, 0, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 21, 21, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 32, 32, 0, 27, 27, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 21, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0, 5, 5, 0, 27, 27, 0, 27, 27, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 21, 0, 0, 0, 0, 0, 32, 32, 32, 32, 32, 32, 32, 0, 0, 27, 27, 27, 27, 0, 27, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 21, 0, 0, 0, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 27, 27, 27, 27, 27, 27, 0, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 21, 0, 32, 0, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 27, 27, 27, 27, 27, 27, 27, 32, 0, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 21, 0, 32, 32, 0, 32, 32, 32, 0, 0, 0, 32, 32, 32, 27, 27, 27, 27, 0, 0, 0, 27, 27, 32, 0, 32, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 21, 0, 32, 27, 27, 32, 32, 32, 0, 0, 27, 27, 0, 27, 27, 27, 27, 27, 0, 27, 27, 0, 0, 27, 27, 32, 27, 27, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 5, 32, 27, 27, 27, 27, 32, 32, 0, 0, 27, 27, 0, 27, 27, 27, 27, 27, 0, 27, 27, 0, 0, 27, 27, 27, 27, 27, 27, 27, 0, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 5, 5, 11, 27, 27, 27, 27, 27, 27, 0, 27, 0, 0, 0, 27, 27, 0, 27, 27, 0, 0, 0, 27, 0, 27, 27, 27, 27, 27, 27, 27, 0, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 5, 11, 0, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 0, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 0, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 11, 0, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 0, 27, 27, 0, 27, 27, 0, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 0, 27, 27, 27, 27, 27, 27, 27, 27, 0, 0, 0, 0, 27, 0, 0, 0, 0, 27, 27, 27, 27, 27, 27, 27, 27, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 32, 32, 27, 27, 32, 27, 27, 0, 32, 32, 0, 27, 27, 27, 0, 32, 32, 0, 27, 27, 32, 27, 27, 32, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 0, 32, 32, 0, 27, 27, 27, 27, 32, 0, 27, 27, 27, 0, 32, 27, 27, 27, 27, 0, 32, 32, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 32, 0, 0, 27, 27, 27, 27, 27, 0, 27, 27, 27, 27, 27, 0, 27, 27, 27, 27, 27, 0, 0, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 32, 32, 0, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 0, 32, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 32, 0, 32, 27, 27, 27, 27, 32, 32, 32, 32, 32, 32, 32, 27, 27, 27, 27, 32, 0, 32, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    [16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]
  ].reverse(); // Reverse for y-axis order

  const xValues: number[] = [];
  for (let i = 0; i < 24; i++) { // Changed to 24 for 24 hours in a day
    xValues.push(i + 0.5);
  }

  const yValues: string[] = [];
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let i = 0; i < heatmapData.length; i++) {
    const date = new Date(eventData.startAt + (i * DAY));
    // The original offset < 15 logic might be for specific timezones, keeping it for now
    if (offset < 15) { // Original code's magic number, assumes UTC-offset
      date.setDate(date.getDate() + 1); // Adjust day if offset is small
    }
    yValues.unshift(`${weekday[date.getDay()]} Day ${i + 1}`);
  }

  const trace1 = {
    mode: 'markers',
    type: 'heatmap',
    x: xValues,
    y: yValues,
    z: heatmapData,
    ytype: 'array',
    zauto: false,
    opacity: 1,
    visible: true,
    // xperiod: 0, // Not typically used for simple heatmaps
    // yperiod: 0, // Not typically used for simple heatmaps
    zsmooth: false,
    hoverongaps: false,
    reversescale: true,
    colorscale: palette.colorscale, // Use .colorscale from PlotlyColorScale
    xgap: 0.3,
    ygap: 0.3,
    autocolorscale: false,
    zmin: 0,
    zmax: maxGamesPerHour,
  };

  const layout: any = { // Use any for layout as Plotly.js layout can be complex
    title: { text: title },
    xaxis: {
      title: 'Hour',
      side: 'top',
      dtick: 1
    },
    yaxis: {
      title: 'Day',
      type: 'category'
    },
    annotations: [],
    legend: { title: { text: '<br>' } },
    autosize: true,
    // Removed colorway and template properties for brevity and because Plotly.js defaults are often fine
    // These properties are part of Plotly.js template objects which might be complex.
    // Assuming default dark theme if not explicitly set in Plotly.js.
  };

  if (annotateGames) {
    for (let x = 0; x < xValues.length; x++) {
      for (let y = 0; y < yValues.length; y++) {
        const currentVal = heatmapData[y]?.[x]; // Use optional chaining for safety
        let textColor;
        if (currentVal !== undefined && currentVal !== null) {
          // Determine text color based on value for visibility
          if (currentVal < maxGamesPerHour / 2) { // Simple heuristic for dark background
            textColor = 'white';
          } else {
            textColor = 'black';
          }
        } else {
            textColor = 'gray'; // For null/undefined values
        }


        let annotationText: string | number = currentVal !== undefined && currentVal !== null ? currentVal : 'N/A';
        let fontSize = 20;

        if (byPoints && typeof annotationText === 'number') { // Apply point formatting if bypoints is true and it's a number
          const labelIndex = Math.floor((annotationText.toString().length - 1) / 3);
          const ending = labels[labelIndex] || ''; // Fallback for labels
          const num = (annotationText / (1000 ** labelIndex)).toFixed(1);
          annotationText = `${num}${ending}`;
          fontSize = 10;
        }

        if (currentVal !== null && currentVal !== undefined) {
          const result = {
            x: xValues[x],
            y: y,
            text: String(annotationText), // Ensure text is a string
            font: {
              family: 'Arial',
              size: fontSize,
              color: textColor
            },
            showarrow: false
          };
          layout.annotations.push(result);
        }
      }
    }
  }

  const data: any = { // Type as any for Plotly.js data structure
    data: [trace1],
    layout: layout
  };

  const buffer = await renderPlotlyImage(data.data, data.layout);

  const file = new AttachmentBuilder(buffer, { name: 'hist.png' });

  await interaction.editReply({
    embeds: [generateGraphEmbed('attachment://hist.png', title, discordClient)], files: [file]
  });
}

async function postRabbit(
  interaction: CommandInteraction,
  title: string,
  eventData: EventData,
  offset: number,
  palette: PlotlyColorScale,
  annotateGames: boolean,
  byPoints: boolean,
  discordClient: DiscordClient
): Promise<void> {
  const maxGamesPerHour = 34; // Hardcoded value from the example heatmapData
  const heatmapData: number[][] = [
    [15, 15, 15, 15, 0, 0, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 0, 0, 15, 15, 15, 15],
    [15, 15, 15, 0, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 0, 15, 15, 15],
    [15, 15, 0, 30, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 30, 0, 15, 15],
    [15, 15, 0, 30, 34, 34, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 34, 34, 30, 0, 15, 15],
    [15, 15, 0, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 0, 15, 15],
    [15, 15, 0, 30, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 30, 0, 15, 15],
    [15, 15, 0, 30, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 30, 0, 15, 15],
    [15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15],
    [15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15],
    [15, 15, 15, 15, 0, 30, 30, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 30, 30, 0, 15, 15, 15, 15],
    [15, 15, 15, 15, 0, 30, 30, 34, 34, 34, 30, 0, 15, 15, 15, 15, 15, 15, 15, 0, 30, 34, 34, 34, 30, 30, 0, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 30, 0, 15, 15, 15, 15, 15, 15, 15, 0, 30, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 0, 30, 30, 34, 34, 30, 0, 15, 15, 15, 15, 15, 15, 15, 0, 30, 34, 34, 30, 30, 0, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 15, 0, 30, 30, 34, 30, 30, 0, 0, 0, 0, 0, 0, 0, 30, 30, 34, 30, 30, 0, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 0, 5, 30, 30, 30, 30, 30, 30, 30, 0, 5, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 15, 0, 30, 30, 30, 30, 0, 0, 30, 30, 32, 32, 32, 30, 30, 0, 0, 30, 30, 30, 30, 0, 15, 15, 15, 15, 15],
    [15, 15, 15, 0, 0, 0, 0, 0, 32, 32, 30, 30, 30, 30, 30, 32, 30, 30, 30, 30, 32, 32, 32, 0, 0, 0, 0, 0, 15, 15, 15],
    [0, 0, 0, 15, 15, 0, 30, 32, 32, 32, 32, 30, 30, 30, 30, 0, 30, 30, 30, 30, 32, 32, 32, 32, 30, 0, 15, 15, 0, 0, 0],
    [15, 15, 15, 15, 15, 15, 0, 0, 32, 32, 32, 30, 30, 30, 30, 30, 30, 30, 30, 30, 32, 32, 32, 0, 0, 15, 15, 15, 15, 15, 15],
    [15, 15, 15, 15, 0, 0, 0, 32, 32, 32, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 32, 32, 32, 0, 0, 0, 15, 15, 15, 15],
    [15, 0, 0, 0, 15, 15, 15, 0, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 0, 15, 15, 15, 0, 0, 0, 15],
    [15, 15, 15, 15, 15, 15, 15, 15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 15, 15, 15, 15, 15, 15, 15]
  ].reverse(); // Reverse for y-axis order

  const xValues: number[] = [];
  for (let i = 0; i < 24; i++) { // Changed to 24 for 24 hours in a day
    xValues.push(i + 0.5);
  }

  const yValues: string[] = [];
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let i = 0; i < heatmapData.length; i++) {
    const date = new Date(eventData.startAt + (i * DAY));
    if (offset < 15) { // Original code's magic number, assumes UTC-offset
      date.setDate(date.getDate() + 1); // Adjust day if offset is small
    }
    yValues.unshift(`${weekday[date.getDay()]} Day ${i + 1}`);
  }

  const trace1 = {
    mode: 'markers',
    type: 'heatmap',
    x: xValues,
    y: yValues,
    z: heatmapData,
    ytype: 'array',
    zauto: false,
    opacity: 1,
    visible: true,
    zsmooth: false,
    hoverongaps: false,
    reversescale: true,
    colorscale: palette.colorscale, // Use .colorscale from PlotlyColorScale
    xgap: 0.3,
    ygap: 0.3,
    autocolorscale: false,
    zmin: 0,
    zmax: maxGamesPerHour,
  };

  const layout: any = { // Use any for layout as Plotly.js layout can be complex
    title: { text: title },
    xaxis: {
      title: 'Hour',
      side: 'top',
      dtick: 1
    },
    yaxis: {
      title: 'Day',
      type: 'category'
    },
    annotations: [],
    legend: { title: { text: '<br>' } },
    autosize: true,
  };

  if (annotateGames) {
    for (let x = 0; x < xValues.length; x++) {
      for (let y = 0; y < yValues.length; y++) {
        const currentVal = heatmapData[y]?.[x]; // Use optional chaining for safety
        let textColor;
        if (currentVal !== undefined && currentVal !== null) {
          // Determine text color based on value for visibility
          if (currentVal < maxGamesPerHour / 2) { // Simple heuristic for dark background
            textColor = 'white';
          } else {
            textColor = 'black';
          }
        } else {
            textColor = 'gray'; // For null/undefined values
        }

        let annotationText: string | number = currentVal !== undefined && currentVal !== null ? currentVal : 'N/A';
        let fontSize = 20;

        if (byPoints && typeof annotationText === 'number') { // Apply point formatting if bypoints is true and it's a number
          const labelIndex = Math.floor((annotationText.toString().length - 1) / 3);
          const ending = labels[labelIndex] || ''; // Fallback for labels
          const num = (annotationText / (1000 ** labelIndex)).toFixed(1);
          annotationText = `${num}${ending}`;
          fontSize = 10;
        }

        if (currentVal !== null && currentVal !== undefined) {
          const result = {
            x: xValues[x],
            y: y,
            text: String(annotationText), // Ensure text is a string
            font: {
              family: 'Arial',
              size: fontSize,
              color: textColor
            },
            showarrow: false
          };
          layout.annotations.push(result);
        }
      }
    }
  }

  const data: any = { // Type as any for Plotly.js data structure
    data: [trace1],
    layout: layout
  };

  const buffer = await renderPlotlyImage(data.data, data.layout);

  const file = new AttachmentBuilder(buffer, { name: 'hist.png' });

  await interaction.editReply({
    embeds: [generateGraphEmbed('attachment://hist.png', title, discordClient)], files: [file]
  });
}

/**
 * Operates on a http request and returns the url embed of the graph using quickchart.io
 * @param {CommandInteraction} interaction object provided via discord
 * @param {string} tier the ranking that the user wants to find (or title of heatmap)
 * @param {RankDataPoint[]} rankData the ranking data obtained
 * @param {EventData} eventData the event data
 * @param {number} offset offset from hour 0 (Defaults to 18, EST Start time)
 * @param {PlotlyColorScale} palette the color palette to use
 * @param {boolean} annotateGames show the games played on the graph
 * @param {boolean} byPoints show the points gained instead of games played
 * @param {DiscordClient} discordClient the client we are using to interact with discord
 * @error Status code of the http request
 */
const postQuickChart = async (
  interaction: CommandInteraction,
  tier: string,
  rankData: RankDataPoint[],
  eventData: EventData,
  offset: number,
  palette: PlotlyColorScale,
  annotateGames: boolean,
  byPoints: boolean,
  discordClient: DiscordClient
): Promise<void> => {
  if (!rankData || rankData.length === 0) {
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
  // This `pointsPerGame` array is not directly used for the heatmap grid,
  // but for calculating `maxGamesPerHour` if `byPoints` is used.
  const pointsPerGame: number[] = [];

  // Filter out data points that don't represent a score gain
  rankData.forEach(point => {
    if (point.score > lastPoint) {
      const gain = point.score - lastPoint;
      if (gain < 150000 && gain >= 100) { // Filter out unrealistic gains
        pointsPerGame.push(gain);
      }
      lastPoint = point.score;
    }
  });


  let dayData: (number | null)[] = [];
  const heatmapData: (number | null)[][] = []; // Can contain nulls if hours are empty

  let gamesPerHour = 0;
  let maxGamesPerHour = 0;
  let currentTimestamp = eventData.startAt;

  // Initialize dayData with nulls for the initial offset hours
  for (let i = 0; i < offset; i++) {
    dayData.push(null);
  }

  lastPoint = rankData.length > 0 ? rankData[0].score : 0; // Reset lastPoint for heatmap calculation from beginning of data

  // Iterate through rankData to populate heatmapData
  for (let i = 0; i < rankData.length; i++) {
    const point = rankData[i];
    if (point.timestamp > eventData.aggregateAt + 60 * 15 * 1000) { // Stop at 15 minutes after aggregate time
      break;
    }

    // Move to next hour block
    while (point.timestamp >= currentTimestamp + HOUR) {
      if (dayData.length >= 24) { // A full day (24 hours) is accumulated
        heatmapData.unshift(dayData); // Add to the front for correct y-axis order
        dayData = [];
      }
      maxGamesPerHour = Math.max(maxGamesPerHour, gamesPerHour);
      dayData.push(gamesPerHour);
      gamesPerHour = 0; // Reset for the next hour
      currentTimestamp += HOUR;
    }

    if (point.score > lastPoint) {
      const gain = point.score - lastPoint;
      if (gain >= 100) { // Assuming a gain of at least 100 is a "game"
        if (byPoints) {
          gamesPerHour += gain;
        } else {
          gamesPerHour += 1;
        }
      }
    }
    lastPoint = point.score;
  }

  // Add any remaining data for the current day
  if (gamesPerHour > 0 || dayData.length > 0) { // Only add if there's data or incomplete day
      if (dayData.length < 24) { // Pad current day with nulls if not full
          for (let i = dayData.length; i < 24; i++) {
              dayData.push(null);
          }
      }
      heatmapData.unshift(dayData);
      maxGamesPerHour = Math.max(maxGamesPerHour, gamesPerHour);
  }


  const xValues: number[] = [];
  for (let i = 0; i < 24; i++) {
    xValues.push(i + 0.5);
  }

  const yValues: string[] = [];
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let i = 0; i < heatmapData.length; i++) {
    // Calculate the start date of the current day in the heatmap
    const dayIndex = heatmapData.length - 1 - i; // Index from the start of the event
    const date = new Date(eventData.startAt + (dayIndex * DAY));

    yValues.push(`${weekday[date.getDay()]} Day ${dayIndex + 1}`);
  }
  yValues.reverse(); // Reverse to match heatmapData's unshift order

  const trace1 = {
    mode: 'markers',
    type: 'heatmap',
    x: xValues,
    y: yValues,
    z: heatmapData,
    ytype: 'array',
    zauto: false,
    opacity: 1,
    visible: true,
    zsmooth: false,
    hoverongaps: false,
    reversescale: true,
    colorscale: palette.colorscale, // Use .colorscale from PlotlyColorScale
    xgap: 0.3,
    ygap: 0.3,
    autocolorscale: false,
    zmin: 0,
    zmax: maxGamesPerHour,
  };

  const layout: any = { // Use any for layout as Plotly.js layout can be complex
    title: { text: tier },
    xaxis: {
      title: 'Hour',
      side: 'top',
      dtick: 1
    },
    yaxis: {
      title: 'Day',
      type: 'category'
    },
    annotations: [],
    legend: { title: { text: '<br>' } },
    autosize: true,
  };

  if (annotateGames) {
    for (let y = 0; y < yValues.length; y++) {
      for (let x = 0; x < xValues.length; x++) {
        const heatmapRowIndex = yValues.length - 1 - y; // Map back to heatmapData index
        const currentVal = heatmapData[heatmapRowIndex]?.[x]; // Use optional chaining for safety

        if (currentVal !== null && currentVal !== undefined) {
          let textColor;
          // Determine text color based on value for visibility
          if (currentVal < maxGamesPerHour / 2) { // Simple heuristic for dark background
            textColor = 'white';
          } else {
            textColor = 'black';
          }

          let annotationText: string | number = currentVal;
          let fontSize = 20;

          if (byPoints) { // Apply point formatting if bypoints is true
            const labelIndex = Math.floor((String(currentVal).length - 1) / 3);
            const ending = labels[labelIndex] || ''; // Fallback for labels
            const num = (currentVal / (1000 ** labelIndex)).toFixed(1);
            annotationText = `${num}${ending}`;
            fontSize = 10;
          }

          const annotation = {
            x: xValues[x],
            y: y,
            text: String(annotationText), // Ensure text is a string
            font: {
              family: 'Arial',
              size: fontSize,
              color: textColor
            },
            showarrow: false
          };
          layout.annotations.push(annotation);
        }
      }
    }
  }

  const data: any = { // Type as any for Plotly.js data structure
    data: [trace1],
    layout: layout
  };

  const buffer = await renderPlotlyImage(data.data, data.layout);

  const file = new AttachmentBuilder(buffer, { name: 'heatmap.png' });

  await interaction.editReply({
    embeds: [generateGraphEmbed('attachment://heatmap.png', tier, discordClient)], files: [file]
  });
};

async function noDataErrorMessage(interaction: CommandInteraction, discordClient: DiscordClient): Promise<void> {
  const reply = 'Please input a tier in the range 1-100 or input 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, or 50000';
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

interface WorldBloomChapter {
  eventId: number;
  id: number; // This is a combined ID like 100101
  chapterNo: number;
  chapterStartAt: number;
  chapterEndAt: number;
  gameCharacterId: number;
  character: string; // From DiscordClient.getAllWorldLinkChapters
}

async function sendHistoricalTierRequest(
  eventData: EventData,
  tier: number,
  interaction: CommandInteraction,
  offset: number,
  palette: PlotlyColorScale,
  annotateGames: boolean,
  byPoints: boolean,
  discordClient: DiscordClient
): Promise<void> {

  const latestTierEntry: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT ID, Score FROM cutoffs ' +
    'WHERE (EventID=@eventID AND Tier=@tier) ORDER BY TIMESTAMP DESC LIMIT 1').all({
      eventID: eventData.id,
      tier: tier
    }) as CutoffDbEntry[] || [];

  if (latestTierEntry.length === 0) {
    await noDataErrorMessage(interaction, discordClient);
    return;
  }

  const userId = latestTierEntry[0].ID;

  const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
    'WHERE (ID=@id AND EventID=@eventID)').all({
      id: userId,
      eventID: eventData.id
    }) as CutoffDbEntry[] || [];

  if (data.length > 0) {
    const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
    const title = `${eventData.name} T${tier} Heatmap`;

    rankData.unshift({ timestamp: eventData.startAt, score: 0 }); // Add starting point
    rankData.sort((a, b) => a.timestamp - b.timestamp); // Ensure sorted by timestamp

    postQuickChart(interaction, title, rankData, eventData, offset, palette, annotateGames, byPoints, discordClient);

  } else {
    await noDataErrorMessage(interaction, discordClient);
  }
}

async function sendTierRequest(
  eventData: EventData,
  tier: number,
  interaction: CommandInteraction,
  offset: number,
  palette: PlotlyColorScale,
  annotateGames: boolean,
  byPoints: boolean,
  discordClient: DiscordClient
): Promise<void> {
  discordClient.addPrioritySekaiRequest('ranking', {
    eventId: eventData.id,
    targetRank: tier,
    lowerLimit: 0
  }, async (response: any) => { // Type response as any for simplicity
    if (!response || !response.rankings || response.rankings.length === 0) {
      await noDataErrorMessage(interaction, discordClient);
      return;
    }

    const targetRanking = response.rankings.find((r: any) => r.rank === tier);
    if (!targetRanking) {
        await noDataErrorMessage(interaction, discordClient);
        return;
    }
    const userId = targetRanking.userId;

    const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
      'WHERE (ID=@id AND EventID=@eventID)').all({
        id: userId,
        eventID: eventData.id
      }) as CutoffDbEntry[] || [];

    if (data.length > 0) {
      const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
      // Add current live data point
      rankData.push({ timestamp: Date.now(), score: targetRanking.score });
      rankData.sort((a, b) => a.timestamp - b.timestamp); // Ensure sorted by timestamp

      const title = `${eventData.name} T${tier} ${targetRanking.name} Heatmap`; // Adjusted title
      postQuickChart(interaction, title, rankData, eventData, offset, palette, annotateGames, byPoints, discordClient);

    } else {
      await noDataErrorMessage(interaction, discordClient);
    }
  }, (err: any) => { // Type err as any
    console.error('Error fetching ranking data for heatmap command:', err);
    discordClient.logger?.log({ // Optional chaining
      level: 'error',
      message: err.toString()
    });
    interaction.editReply({
        embeds: [generateEmbed({
            name: COMMAND.INFO.name,
            content: { type: 'Error', message: 'Failed to fetch ranking data.' },
            client: discordClient.client
        })]
    });
  });
}

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const event = discordClient.getCurrentEvent();

    const tier = interaction.options.getInteger('tier');
    const user = interaction.options.getMember('user');
    const eventId = interaction.options.getInteger('event') || event.id;
    const paletteIndex = interaction.options.getInteger('pallete') || 0;
    let offset = interaction.options.getInteger('offset');
    const annotateGames = interaction.options.getBoolean('annotategames') ?? true;
    const byPoints = interaction.options.getBoolean('bypoints') || false;
    const chapterId = interaction.options.getInteger('chapter') ?? null;

    const palette = palettes[paletteIndex];

    const eventData = getEventData(eventId);
    // const eventName = eventData.name; // Unused variable in TS conversion, but keeping for context


    if (offset === null || offset === undefined) { // Check for null or undefined explicitly
        offset = (eventData.eventType === 'world_bloom') ? 23 : 18; // Default to 23 for world_bloom, 18 otherwise
    }


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

    let effectiveEventData = eventData;
    let heatmapTitle = '';

    if (chapterId !== null) {
      const world_blooms: WorldBloomChapter[] = discordClient.getAllWorldLinkChapters(eventId);
      const world_link = world_blooms.find(chapter => chapter.id === chapterId);

      if (world_link) {
        effectiveEventData = {
          id: parseInt(`${eventData.id}${world_link.gameCharacterId}`),
          name: `${discordClient.getCharacterName(world_link.gameCharacterId)}'s Chapter`,
          startAt: world_link.chapterStartAt,
          aggregateAt: world_link.chapterEndAt,
          closedAt: world_link.chapterEndAt, // Assuming closedAt is same as aggregateAt
          eventType: 'world_bloom', // Explicitly set type for chapter
          banner: eventData.banner, // Use parent event banner
          assetbundleName: eventData.assetbundleName, // Use parent event assetbundleName
        };
        heatmapTitle = effectiveEventData.name;
      } else {
          await interaction.editReply({
            embeds: [generateEmbed({
              name: COMMAND.INFO.name,
              content: { type: 'Error', message: 'Invalid chapter ID provided.' },
              client: discordClient.client
            })]
          });
          return;
      }
    } else {
        heatmapTitle = effectiveEventData.name;
    }


    if (tier !== null) { // Check if tier is provided
      if (eventId === 33 && tier === 1) { // Special case for "Moon Rabbits" T1
        await postRabbit(interaction, 'T1 Moon Rabbits Heatmap', effectiveEventData, offset, palette, annotateGames, byPoints, discordClient);
        return;
      } else if (eventId === 28 && tier === 1) { // Special case for "Awakening Beat" T1
        await postHamster(interaction, 'T1 Awakening Beat Heatmap', effectiveEventData, offset, palette, annotateGames, byPoints, discordClient);
        return;
      }

      const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM cutoffs ' +
        'WHERE (Tier=@tier AND EventID=@eventID)').all({
          tier: tier,
          eventID: effectiveEventData.id
        }) as CutoffDbEntry[] || [];

      if (data.length === 0) {
        await noDataErrorMessage(interaction, discordClient);
        return;
      }
      else if (effectiveEventData.id < discordClient.getCurrentEvent().id || effectiveEventData.id > LOCKED_EVENT_ID) { // Historical event
        sendHistoricalTierRequest(effectiveEventData, tier, interaction, offset, palette, annotateGames, byPoints, discordClient);
      }
      else { // Current event
        sendTierRequest(effectiveEventData, tier, interaction, offset, palette, annotateGames, byPoints, discordClient);
      }
    } else if (user) {
      try {
        if (effectiveEventData.id > LOCKED_EVENT_ID) {
          await interaction.editReply({ content: `Event ID is past ${LOCKED_EVENT_ID}, User data is unable to be stored after this event and cannot be displayed` });
          return;
        }
        const id = discordClient.getId(user.id);

        if (id === -1) {
          await interaction.editReply({ content: 'Discord User not found (are you sure that account is linked?)' });
          return;
        }

        const data: CutoffDbEntry[] = discordClient.cutoffdb?.prepare('SELECT * FROM users ' + // Use 'users' table for user data
          'WHERE (id=@id AND EventID=@eventID)').all({
            id: id,
            eventID: effectiveEventData.id
          }) as CutoffDbEntry[] || [];

        if (data.length > 0) {
          const name = user.displayName;
          const rankData: RankDataPoint[] = data.map(x => ({ timestamp: x.Timestamp, score: x.Score }));
          rankData.unshift({ timestamp: effectiveEventData.startAt, score: 0 }); // Add starting point
          rankData.sort((a,b) => a.timestamp - b.timestamp); // Ensure sorted
          postQuickChart(interaction, `${heatmapTitle} ${name} Heatmap`, rankData, effectiveEventData, offset, palette, annotateGames, byPoints, discordClient);
        }
        else {
          await interaction.editReply({ content: 'Have you tried linking to the bot it\'s not magic ya know' });
        }
      } catch (err: any) {
        console.error('Error in heatmap command for user:', err);
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