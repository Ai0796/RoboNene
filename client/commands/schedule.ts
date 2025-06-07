// client/commands/schedule.ts
/**
 * @fileoverview The main output when users call for the /schedule command
 * Generates a embed showing current & future events based on datamined information
 * @author Potor10
 */

import { EmbedBuilder } from 'discord.js';
import { NENE_COLOR, FOOTER } from '../../constants';
import * as fs from 'fs';

import * as COMMAND from '../command_data/schedule'; // Assuming command_data/schedule.ts is converted
import generateSlashCommand from '../methods/generateSlashCommand';
import { DateTime } from 'luxon';
import DiscordClient from '../client/client'; // Assuming default export

interface GameCharacter {
  id: number;
  givenName: string;
  firstName: string;
}

interface EventData {
  id: number;
  name: string;
  startAt: number;
  aggregateAt: number;
  closedAt: number;
  eventType: string;
  assetbundleName: string; // Added for banner URL construction
}

interface WorldBloom {
  eventId: number;
  id: number; // This is chapter ID in worldBlooms.json
  chapterStartAt: number;
  chapterEndAt: number;
  gameCharacterId: number;
  // Add other properties from worldBlooms.json if used
}

interface GachaData {
  id: number;
  name: string;
  startAt: number;
  endAt: number;
  // Add other properties from gachas.json if used
}

interface VirtualLiveSchedule {
  startAt: number;
  // Add other properties if needed
}

interface VirtualLive {
  id: number;
  name: string;
  startAt: number;
  endAt: number;
  virtualLiveSchedules: VirtualLiveSchedule[];
  // Add other properties if needed
}

const getCharacterName = (characterId: number, gameCharacters: GameCharacter[]): string => {
  const charInfo = gameCharacters.find(char => char.id === characterId); // Use find for robustness
  if (charInfo) {
    return `${charInfo.givenName} ${charInfo.firstName}`.trim();
  }
  return 'Unknown Character'; // Fallback for safety
};

/**
 * Obtains the time of the next daily reset in game
 * @param {Date} currentDate the Date object of the current date time
 * @return {number} the epochseconds of the next daily reset in game
 */
const getNextReset = (currentDate: Date): number => {
  let nextReset = DateTime.now().setZone('America/Los_Angeles'); // Set to specific timezone for reset
  nextReset = nextReset.set({
    hour: 4, // 4 AM PST
    minute: 0,
    second: 0,
    millisecond: 0
  });

  if (nextReset.toMillis() < currentDate.getTime()) {
    nextReset = nextReset.plus({ days: 1 }); // Move to next day if already passed today's reset
  }

  return Math.floor(nextReset.toSeconds());
};

const addEvent = (event: EventData, gameCharacters: GameCharacter[], worldBlooms: WorldBloom[], embed: EmbedBuilder): void => {
  const startTime = Math.floor(event.startAt / 1000);
  const aggregateTime = Math.floor(event.aggregateAt / 1000);

  if (event.eventType === 'world_bloom') {
    embed.addFields(
      { name: `**__Event ${event.id}: ${event.name}__**`, value: `${event.name} *[${event.eventType}]*` },
    );

    const world_events = worldBlooms.filter((x) => x.eventId === event.id);
    world_events.sort((a, b) => a.id - b.id); // Sort by world bloom chapter ID

    world_events.forEach((world_event) => {
      const chapterStartTime = Math.floor(world_event.chapterStartAt / 1000);
      const chapterEndTime = Math.floor(world_event.chapterEndAt / 1000); // Using chapterEndAt for clarity, original uses aggregateAt too
      const character = getCharacterName(world_event.gameCharacterId, gameCharacters);
      embed.addFields(
        { name: `${character}'s Chapter`, value: `<t:${chapterStartTime}> - <t:${chapterEndTime}:R>` },
      );
    });

    embed.addFields(
      { name: 'Ranking Closes', value: `<t:${aggregateTime}> - <t:${aggregateTime}:R>` }
    );

  } else {
    embed.addFields(
      { name: `**__Event ${event.id}: ${event.name}__**`, value: `${event.name} *[${event.eventType}]*` },
      { name: 'Event Started', value: `<t:${startTime}> - <t:${startTime}:R>` },
      { name: 'Ranking Closes', value: `<t:${aggregateTime}> - <t:${aggregateTime}:R>` },
    );
  }
};

const getFutureGachas = (): GachaData[] => {
  const gachas: GachaData[] = JSON.parse(fs.readFileSync('./sekai_master/gachas.json', 'utf8')) as GachaData[];
  const currentDate = new Date();
  const futureGachas = gachas.filter(gacha => gacha.startAt > currentDate.getTime());

  // Sort by start time to ensure closest gachas are first
  futureGachas.sort((a, b) => a.startAt - b.startAt);

  return futureGachas;
};

/**
 * Creates an embed of the current schedule data provided
 * @param {boolean} showVLive whether to include Virtual Live information
 * @param {EventData[]} eventData array of event information
 * @param {VirtualLive[]} vLiveData array of virtual live information
 * @param {GameCharacter[]} gameCharacters array of game character information
 * @param {WorldBloom[]} worldBlooms array of world bloom event information
 * @param {DiscordClient['client']} client the Discord Client we are receiving / sending requests to
 * @return {EmbedBuilder} the embed that we will display to the user
 */
const createScheduleEmbed = (showVLive: boolean, eventData: EventData[], vLiveData: VirtualLive[], gameCharacters: GameCharacter[], worldBlooms: WorldBloom[], client: DiscordClient['client']): EmbedBuilder => {
  const currentDate = new Date();
  const nextReset = getNextReset(currentDate);
  let currentEvent: EventData | undefined;
  let nextEvent: EventData | undefined;

  for (const event of eventData) {
    if (event.startAt <= currentDate.getTime() && event.closedAt >= currentDate.getTime()) {
      currentEvent = event;
    } else if (event.startAt > currentDate.getTime()) {
      if (!nextEvent || event.startAt < nextEvent.startAt) {
        nextEvent = event;
      }
    }
  }

  // Event Schedule
  const scheduleEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle('Event Schedule Nyaa~')
    .addFields(
      { name: '**__Next Daily Reset__**', value: `<t:${nextReset}> - <t:${nextReset}:R>` },
      { name: '** **', value: '** **' }, // Spacer
    )
    .setTimestamp()
    .setFooter({ text: FOOTER, iconURL: client.user?.displayAvatarURL() || '' }); // Optional chaining for client.user

  // Determine if there is a event currently going on
  if (currentEvent) {
    addEvent(currentEvent, gameCharacters, worldBlooms, scheduleEmbed);
  }

  // Determine if there is the next event in the future (closest)
  if (nextEvent) {
    if (currentEvent) { scheduleEmbed.addFields({ name: '** **', value: '** **' }); } // Spacer if current event exists
    addEvent(nextEvent, gameCharacters, worldBlooms, scheduleEmbed);
  }

  // Add a spacer between the event and gacha schedules
  scheduleEmbed.addFields({ name: '** **', value: '** **' });

  // Gacha Schedule
  let futureGachas = getFutureGachas();
  // Limit to 5 gachas
  futureGachas = futureGachas.slice(0, 5);

  let gachaStr = '';
  if (futureGachas.length > 0) {
    for (const gacha of futureGachas) {
      const startTime = Math.floor(gacha.startAt / 1000);
      const name = gacha.name;
      gachaStr += `**${name}**\n<t:${startTime}>\n\n`;
    }
  }

  if (gachaStr === '') {
    scheduleEmbed.addFields(
      { name: '**__Future Gachas__**', value: 'No Gachas Currently Scheduled' },
    );
  } else {
    scheduleEmbed.addFields(
      { name: '**__Future Gachas__**', value: gachaStr },
    );
  }

  if (showVLive === false) {
    return scheduleEmbed;
  }

  // Add a spacer between the gacha and virtual live schedules
  scheduleEmbed.addFields({ name: '** **', value: '** **' });

  //Virtual Live Schedule
  const runningVLives: VirtualLive[] = vLiveData.filter(vLive =>
    vLive.startAt <= currentDate.getTime() && vLive.endAt >= currentDate.getTime()
  );

  if (runningVLives.length > 0) {
    runningVLives.forEach(vLive => {
      const lives = vLive.virtualLiveSchedules;
      // Filter for future lives relative to current time
      const futureLives = lives.filter(live => live.startAt > currentDate.getTime());

      if (futureLives.length > 0) {
        scheduleEmbed.addFields(
          { name: '**__Virtual Live__**', value: `${vLive.name}` },
          { name: 'Show Times', value: futureLives.map((x) => `<t:${Math.floor(x.startAt / 1000)}:R> at <t:${Math.floor(x.startAt / 1000)}:f>`).join('\n') },
        );
      }
    });
  } else {
    scheduleEmbed.addFields(
      { name: '**__Virtual Live__**', value: 'No Virtual Lives Currently Running' },
    );
  }

  return scheduleEmbed;
};

export default {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),

  async execute(interaction: CommandInteraction, discordClient: DiscordClient) { // Explicitly type interaction
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    const showVirtualLives = interaction.options.getBoolean('show-vlive') ?? true;

    const events: EventData[] = JSON.parse(fs.readFileSync('./sekai_master/events.json', 'utf8')) as EventData[];
    const virtualLives: VirtualLive[] = JSON.parse(fs.readFileSync('./sekai_master/virtualLives.json', 'utf8')) as VirtualLive[];
    const gameCharacters: GameCharacter[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')) as GameCharacter[];
    const worldBlooms: WorldBloom[] = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json', 'utf8')) as WorldBloom[];

    const scheduleEmbed = createScheduleEmbed(showVirtualLives, events, virtualLives, gameCharacters, worldBlooms, discordClient.client);
    await interaction.editReply({ embeds: [scheduleEmbed] });
  }
};