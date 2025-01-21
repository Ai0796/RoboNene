const fs = require('fs');

const updateActivityLoop = async (client) => {
    console.log('Updating activity with next event');
    nextEventActivity(client);
};

const serverNumActivity = async (client) => {
    const { BOT_ACTIVITY } = require('../constants');
    client.user.setActivity(BOT_ACTIVITY() +
        `${client.guilds.cache.size} ${(client.guilds.cache.size > 1) ? 'servers' : 'server'}`);
};

const getCharacterName = (characterId, gameCharacters) => {
    const charInfo = gameCharacters[characterId - 1];
    return `${charInfo.givenName} ${charInfo.firstName}`.trim();
};

const nextEventActivity = async (client) => {
    const events = JSON.parse(fs.readFileSync('./sekai_master/events.json'));

    let currentEventIdx = -1;
    let currentDate = new Date();

    for (let i = 1; i < events.length; i++) {
        if (Math.floor(events[i].aggregateAt / 1000) > Math.floor(currentDate / 1000) &&
            Math.floor(events[i - 1].aggregateAt / 1000) < Math.floor(currentDate / 1000)) {
            currentEventIdx = i;
        }
    }

    var timeUntilStr;
    if (currentEventIdx == -1) {
        serverNumActivity(client);
    } else if (events[currentEventIdx].eventType === 'world_bloom') {
        const gameCharacters = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json'));
        const worldBlooms = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json'));

        let world_events = worldBlooms.filter((x) => x.eventId === events[currentEventIdx].id);
        world_events.sort((a, b) => a.id - b.id);

        let worldEventIdx = -1;

        for (let i = 0; i < world_events.length; i++) {
            if (Math.floor(world_events[i].aggregateAt / 1000) > Math.floor(currentDate / 1000)) {
                worldEventIdx = i;
                break;
            }
        }

        if (worldEventIdx == -1) {
            serverNumActivity(client);
        } else {
            let character = getCharacterName(world_events[worldEventIdx].gameCharacterId, gameCharacters);
            var nextCharacter;
            if (worldEventIdx < world_events.length - 1) {
                nextCharacter = getCharacterName(world_events[worldEventIdx + 1].gameCharacterId, gameCharacters);
            }

            if (currentDate < world_events[worldEventIdx].chapterStartAt) {
                timeUntilStr = `${await formatTime(world_events[worldEventIdx].chapterStartAt - currentDate)} Until ${character}'s Chapter Starts`;
            } else if (currentDate < world_events[worldEventIdx].aggregateAt && nextCharacter != undefined) {
                timeUntilStr = `${await formatTime(world_events[worldEventIdx].aggregateAt - currentDate)} Until ${character}'s Chapter Ends (${nextCharacter}'s Chapter Next)`;
            } else {
                timeUntilStr = `${await formatTime(world_events[worldEventIdx].aggregateAt - currentDate)} Until ${character}'s Chapter Ends`;
            }
            client.user.setActivity(timeUntilStr);
        }

    } else {

        if (currentDate < events[currentEventIdx].startAt) {
            timeUntilStr = `${await formatTime(events[currentEventIdx].startAt - currentDate)} Until ${events[currentEventIdx].name} Starts`;
        } else if (currentDate < events[currentEventIdx].aggregateAt) {
            timeUntilStr = `${await formatTime(events[currentEventIdx].aggregateAt - currentDate)} Until ${events[currentEventIdx].name} Ends`;
        }
        client.user.setActivity(timeUntilStr);
    }
};

const formatTime = async (time) => {

    let hours = Math.floor(time / 3600000);
    let minutes = Math.floor((time - (hours * 3600000)) / 60000);

    return `${hours}h ${minutes}m`;
};

const updateActivity = async (client) => {
    let time = new Date();
    time.setSeconds(0);
    time.setMilliseconds(0);
    time.setMinutes(time.getMinutes() + 1);
    let timeout = time - new Date();
    while (timeout < 0) {
        timeout += 60000;
    }
    setTimeout(() => setInterval(() => updateActivityLoop(client.client), 60000), timeout);
};

module.exports = updateActivity;