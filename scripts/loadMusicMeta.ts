// scripts/loadMusicMeta.ts
/**
 * @fileoverview Pulls Music Meta Data from dnaroma.eu/sekai-best-assets
 * Seperate file due to music meta not being hosted on sekai.best
 * @author Ai0796
 */

import { DIR_DATA } from '../constants';
import * as https from 'https';
import * as fs from 'fs';

// The location we pull from and data modules we pull 
const GAME_CONSTANTS = {
    'HOST': 'storage.sekai.best',
    'PATH': '/sekai-best-assets/',
    'JSON': [
        'music_metas'
    ]
};

/**
 * Recursively downloads the data one by one
 * @param {number} idx the current index on that data we have downloaded
 */
const loadMusicMeta = async (idx: number): Promise<void> => {
    if (idx >= GAME_CONSTANTS.JSON.length) {
        return;
    } else {
        const filename = GAME_CONSTANTS.JSON[idx];

        const options: https.RequestOptions = { // Explicitly type options
            host: GAME_CONSTANTS.HOST,
            path: `${GAME_CONSTANTS.PATH}${filename}.json`,
            headers: { 'User-Agent': 'request' }
        };

        const req = https.get(options, (res) => {
            let json = '';
            res.on('data', (chunk) => {
                json += chunk;
            });
            res.on('end', async () => {
                if (res.statusCode === 200) {
                    try {
                        fs.writeFileSync(`${DIR_DATA}/${filename}.json`, JSON.stringify(JSON.parse(json)));
                        console.log(`${filename}.json Retrieved`);
                        loadMusicMeta(idx + 1);
                    } catch (err) {
                        console.error(`Error parsing JSON for ${filename}:`, err); // Changed to console.error
                        loadMusicMeta(idx + 1); // Try next file even if current fails
                    }
                } else {
                    console.error(`Error retrieving via HTTPS for ${filename}. Status: ${res.statusCode}`); // Changed to console.error
                    loadMusicMeta(idx + 1); // Try next file even if current fails
                }
            });
            req.on('timeout', () => { // Attach timeout handler to the request itself
                console.error(`Request for ${filename} timed out.`); // Changed to console.error
                req.destroy();
                loadMusicMeta(idx); // Retry current file
            });
        });

        req.on('error', (err) => { // Attach error handler to the request itself
            console.error(`Error during HTTPS request for ${filename}:`, err); // Changed to console.error
            loadMusicMeta(idx + 1); // Try next file even if current fails
        });
    }
};

export default loadMusicMeta;