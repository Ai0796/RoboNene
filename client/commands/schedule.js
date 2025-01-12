/**
 * @fileoverview The main output when users call for the /schedule command
 * Generates a embed showing current & future events based on datamined information
 * @author Potor10
 */

const { EmbedBuilder } = require('discord.js');
const { NENE_COLOR, FOOTER } = require('../../constants');
const fs = require('fs');

const COMMAND = require('../command_data/schedule');

const generateSlashCommand = require('../methods/generateSlashCommand');
const { DateTime } = require('luxon');

const getCharacterName = (characterId, gameCharacters) => {
  const charInfo = gameCharacters[characterId - 1];
  return `${charInfo.givenName} ${charInfo.firstName}`.trim();
};

/**
 * Obtains the time of the next daily reset in game
 * @param {Date} currentDate the Date object of the current date time
 * @return {Integer} the epochseconds of the next daily reset in game
 */
const getNextReset = (currentDate) => {

  var nextReset = DateTime.now().setZone('America/Los_Angeles');
  nextReset = nextReset.set({
    hour: 4,
    minutes: 0,
    seconds: 0,
    millisecond: 0
  });

  if (nextReset < currentDate) {
    nextReset = nextReset.set({
      day: nextReset.day + 1
    });
  }

  return Math.floor(nextReset.toSeconds());
};

const addEvent = (event, gameCharacters, worldBlooms, embed) => {
  let startTime = Math.floor(event.startAt / 1000);
  let aggregateTime = Math.floor(event.aggregateAt / 1000);

  if (event.eventType === 'world_bloom') {

    embed.addFields(
      { name: `**__Event ${event.id}: ${event.name}__**`, value: `${event.name} *[${event.eventType}]*` },
    );

    let world_events = worldBlooms.filter((x) => x.eventId === event.id);
    world_events.sort((a, b) => a.id - b.id);

    world_events.forEach((world_event) => {

      let startTime = Math.floor(world_event.chapterStartAt / 1000);
      let aggregateTime = Math.floor(world_event.aggregateAt / 1000);
      
      let character = getCharacterName(world_event.gameCharacterId, gameCharacters);
      embed.addFields(
        { name: `${character}'s Chapter`, value: `<t:${startTime}> - <t:${startTime}:R>` },
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

const getFutureGachas = () => {
  let gachas = JSON.parse(fs.readFileSync('./sekai_master/gachas.json'));
  let currentDate = new Date();
  let futureGachas = [];

  for (let i = 0; i < gachas.length; i++) {
    if (Math.floor(gachas[i].startAt) > Math.floor(currentDate)) {
      futureGachas.push(gachas[i]);
    }
  }

  return futureGachas;

};

/**
 * Creates an embed of the current schedule data provided
 * @param {Object} data the current datamined schedule & event information
 * @param {DiscordClient} client the Discord Client we are recieving / sending requests to
 * @return {MessageEmbed} the embed that we will display to the user
 */
const createScheduleEmbed = (showVLive, eventData, vLiveData, gameCharacters, worldBlooms, client) => {
  let currentDate = new Date();
  let nextReset = getNextReset(currentDate);
  let currentEventIdx = -1;
  let nextEventIdx = -1;

  for (let i = 0; i < eventData.length; i++) {
    if (Math.floor(eventData[i].closedAt / 1000) > Math.floor(currentDate / 1000) &&
      Math.floor(eventData[i].startAt / 1000) < Math.floor(currentDate / 1000)) {
      currentEventIdx = i;
    }
    if (Math.floor(eventData[i].startAt / 1000) > Math.floor(currentDate / 1000)) {
      if (nextEventIdx == -1) {
        nextEventIdx = i;
      } else if (Math.floor(eventData[i].startAt / 1000) < Math.floor(eventData[nextEventIdx].startAt / 1000)) {
        nextEventIdx = i;
      }
    }
  }

  // Event Schedule
  let scheduleEmbed = new EmbedBuilder()
    .setColor(NENE_COLOR)
    .setTitle('Event Schedule Nyaa~')
    .addFields(
      { name: '**__Next Daily Reset__**', value: `<t:${nextReset}> - <t:${nextReset}:R>` },
      { name: '** **', value: '** **' },
    )
    .setTimestamp()
    .setFooter({text: FOOTER, iconURL: client.user.avatar_url});

  // Determine if there is a event currently going on
  if (currentEventIdx !== -1) {
    addEvent(eventData[currentEventIdx], gameCharacters, worldBlooms, scheduleEmbed);
    // let startTime = Math.floor(eventData[currentEventIdx].startAt / 1000);
    // let aggregateTime = Math.floor(eventData[currentEventIdx].aggregateAt / 1000);

    // scheduleEmbed.addFields(
    //   { name: '**__Event (Current)__**', value: `${eventData[currentEventIdx].name} *[${eventData[currentEventIdx].eventType}]*` },
    //   { name: 'Event Started', value: `<t:${startTime}> - <t:${startTime}:R>` },
    //   { name: 'Ranking Closes', value: `<t:${aggregateTime}> - <t:${aggregateTime}:R>` },
    // );
  }

  // Determine if there is the next event in the future (closest)
  if (nextEventIdx !== -1) {
    if (currentEventIdx !== -1) { scheduleEmbed.addFields({name: '** **', value: '** **'});}

    addEvent(eventData[nextEventIdx], gameCharacters, worldBlooms, scheduleEmbed);

    // let startTime = Math.floor(eventData[nextEventIdx].startAt / 1000);
    // let aggregateTime = Math.floor(eventData[nextEventIdx].aggregateAt / 1000);

    // scheduleEmbed.addFields(
    //   { name: '**__Event (Next)__**', value: `${eventData[nextEventIdx].name} *[${eventData[nextEventIdx].eventType}]*` },
    //   { name: 'Event Starts', value: `<t:${startTime}> - <t:${startTime}:R>` },
    //   { name: 'Ranking Closes', value: `<t:${aggregateTime}> - <t:${aggregateTime}:R>` },
    // );
  }

  // Add a spacer between the event and gacha schedules
  scheduleEmbed.addFields({ name: '** **', value: '** **' });

  // Gacha Schedule
  let futureGachas = getFutureGachas();
  // Limit to 5 gachas
  futureGachas = futureGachas.slice(0, 5);

  let gachaStr = '';

  for (let i = 0; i < futureGachas.length; i++) {
    let gacha = futureGachas[i];
    let startTime = Math.floor(gacha.startAt / 1000);
    let name = gacha.name;

    gachaStr += `**${name}**\n<t:${startTime}>\n\n`;
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

  let runningVLives = [];

  for (let i = 0; i < vLiveData.length; i++) {
    if (Math.floor(vLiveData[i].endAt / 1000) > Math.floor(currentDate / 1000) &&
      Math.floor(vLiveData[i].startAt / 1000) < Math.floor(currentDate / 1000)) {
      runningVLives.push(i);
    }
  }

  if (runningVLives.length > 0) {
    runningVLives.forEach(vLiveIdx => {

      let lives = vLiveData[vLiveIdx]['virtualLiveSchedules'];
      let currentLiveIdx = -1;

      for (let i = 0; i < lives.length; i++) {
        lives[i].startAt = Math.floor(lives[i].startAt / 1000);
        if (lives[i].startAt > Math.floor(currentDate / 1000) && currentLiveIdx === -1) {
          currentLiveIdx = i;
        }
      }

      if (currentLiveIdx === -1) {
        return;
      }

      let nextLives = lives.slice(currentLiveIdx);

      scheduleEmbed.addFields(
        { name: '**__Virtual Live__**', value: `${vLiveData[vLiveIdx]['name']}` },
        { name: 'Show Times', value: nextLives.map((x) => `<t:${x['startAt']}:R> at <t:${x['startAt']}:f>`).join('\n') },
      );
    });
  } else {
    scheduleEmbed.addFields(
      { name: '**__Virtual Live__**', value: 'No Virtual Lives Currently Running' },
    );
  }

  return scheduleEmbed;
};

module.exports = {
  ...COMMAND.INFO,
  data: generateSlashCommand(COMMAND.INFO),
  
  async execute(interaction, discordClient) {
    await interaction.deferReply({
      ephemeral: COMMAND.INFO.ephemeral
    });

    let showVirtualLives = interaction.options.getBoolean('show-vlive') ?? true;

    const events = JSON.parse(fs.readFileSync('./sekai_master/events.json'));
    const virtualLives = JSON.parse(fs.readFileSync('./sekai_master/virtualLives.json'));
    const gameCharacters = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json'));
    const worldBlooms = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json'));
    const scheduleEmbed = createScheduleEmbed(showVirtualLives, events, virtualLives, gameCharacters, worldBlooms, discordClient.client);
    await interaction.editReply({ embeds: [scheduleEmbed] });
  }    
};