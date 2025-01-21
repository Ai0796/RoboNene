/**
 * @fileoverview The main implementation towards maintaining our bot with up to data information.
 * Will async download data from Sekai.best once in a while when the bot is running
 * @author Potor10
 */

const { DIR_DATA } = require('../constants');
const https = require('https');
const fs = require('fs');

// The location we pull from and data modules we pull 
const GAME_CONSTANTS = {
  'HOST': 'raw.githubusercontent.com',
  'PATH': '/Sekai-World/sekai-master-db-en-diff/main/',
  'JSON': [
    'gameCharacters',
    'gameCharacterUnits',
    'characterProfiles',
    'areas',
    'areaItems',
    'areaItemLevels',
    'events',
    'eventCards',
    'cards',
    'cardEpisodes',
    'musics',
    'eventDeckBonuses',
    'virtualLives',
    'worldBlooms',
    'gachas'
  ]
};

/**
 * Downloads all the requested data one by one
 */
const getData = (discordClient) => {
  discordClient.addPrioritySekaiRequest('master', {}, async (response) => {
    if (response) {
      for (const key in response) {
        if (GAME_CONSTANTS.JSON.indexOf(key) === -1) continue;
        fs.writeFileSync(`${DIR_DATA}/${key}.json`, JSON.stringify(response[key]));
        console.log(`${key}.json Retrieved`);
      }
    }
  });
};

/**
 * Enables the tracking of the game database, and requests game data once every two hours
 * @param {DiscordClient} discordClient the client we are using to interact with Discord
 */
const trackGameData = async (discordClient) => {
  // Obtain the game data
  getData(discordClient);

  console.log('Game Data Requested, Pausing For 2 Hours');
  setTimeout(() => {trackGameData(discordClient);}, 7200000);
};

module.exports = trackGameData;