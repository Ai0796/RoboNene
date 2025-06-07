// scripts/loadGameData.ts
/**
 * @fileoverview The main implementation towards maintaining our bot with up to data information.
 * Pulls data from Sekai.best once, before executing the callback.
 * @author Potor10
 */

import { DIR_DATA } from '../constants';
import * as https from 'https';
import * as fs from 'fs';

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
 * Recursively downloads the data one by one, then executes a callback to confirm all
 * data has been downloaded
 * @param {number} idx the current index on that data we have downloaded
 * @param {Function} callback a callback to run upon the successful download of all data
 */
const loadGameData = (idx: number, callback: () => void): void => {
  if (idx >= GAME_CONSTANTS.JSON.length) {
    callback();
  } else {
    const filename = GAME_CONSTANTS.JSON[idx];

    const options: https.RequestOptions = { // Explicitly type options
      host: GAME_CONSTANTS.HOST,
      path: `${GAME_CONSTANTS.PATH}${filename}.json`,
      headers: { 'User-Agent': 'request' },
      timeout: 3000
    };

    const req = https.get(options, (res) => {
      let json = '';
      res.on('data', (chunk) => {
        json += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            fs.writeFileSync(`${DIR_DATA}/${filename}.json`, JSON.stringify(JSON.parse(json)));
            console.log(`${filename}.json Retrieved`);
            loadGameData(idx + 1, callback);
          } catch (err) {
            console.error(`Error parsing JSON for ${filename}:`, err); // Changed to console.error
            loadGameData(idx + 1, callback); // Try next file even if current fails
          }
        } else {
          console.error(`Error retrieving via HTTPS for ${filename}. Status: ${res.statusCode}`); // Changed to console.error
          loadGameData(idx + 1, callback); // Try next file even if current fails
        }
      });
      res.on('timeout', () => {
        console.error(`Request for ${filename} timed out.`); // Changed to console.error
        req.destroy();
        loadGameData(idx, callback); // Retry current file
      });
    });

    req.on('error', (err) => {
      console.error(`Error during HTTPS request for ${filename}:`, err); // Changed to console.error
      loadGameData(idx + 1, callback); // Try next file even if current fails
    });
  }
};

export default loadGameData;