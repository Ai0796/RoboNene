// scripts/trackGameData.ts
/**
 * @fileoverview The main implementation towards maintaining our bot with up to data information.
 * Will async download data from Sekai.best once in a while when the bot is running
 * @author Potor10
 */

import { DIR_DATA } from '../constants';
import * as https from 'https';
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export

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
    'gachas',
    'musicVocals'
  ]
};

/**
 * Downloads all the requested data one by one
 */
const getData = (discordClient: DiscordClient): void => {
  discordClient.addPrioritySekaiRequest('master', {}, async (response: any) => { // Type response as any
    if (response) {
      for (const key in response) {
        if (GAME_CONSTANTS.JSON.indexOf(key) === -1) continue;
        try {
          fs.writeFileSync(`${DIR_DATA}/${key}.json`, JSON.stringify(response[key]));
          console.log(`${key}.json Retrieved`);
        } catch (err) {
          console.error(`Error writing ${key}.json:`, err);
        }
      }
    }
  }, (err: any) => { // Type err as any
    discordClient.logger?.log({ // Optional chaining
      level: 'error',
      message: err.toString()
    });
  });
};

/**
 * Enables the tracking of the game database, and requests game data once every two hours
 * @param {DiscordClient} discordClient the client we are using to interact with Discord
 */
const trackGameData = async (discordClient: DiscordClient): Promise<void> => {
  // Obtain the game data
  getData(discordClient);

  console.log('Game Data Requested, Pausing For 2 Hours');
  setTimeout(() => { trackGameData(discordClient); }, 7200000);
};

export default trackGameData;