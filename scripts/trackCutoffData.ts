// scripts/trackCutoffData.ts
/**
 * @fileoverview Main tracker of all cutoff data for internal storage in case Sekai.Best goes down
 * @author Ai0796
 */

import { CUTOFF_INTERVAL } from '../constants';
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export

// Cutoffs we store
const cutoffs = [
    200,
    300,
    400,
    500,
    1000,
    2000,
    3000,
    4000,
    5000,
    10000,
    20000,
    30000,
    40000,
    50000,
];

interface RankingEvent {
    id: number;
    banner: string;
    name: string;
    startAt: number;
    aggregateAt: number;
    closedAt: number;
    eventType: string;
    assetbundleName: string;
}

/**
 * Recursively adds cutoff tracks to queue
 * @param {DiscordClient} discordClient the client we are using 
*/
async function getCutoffs(discordClient: DiscordClient): Promise<number | void> {
    async function logResults(response: any) { // Type as any since response structure is not fully defined
        try {
            const event = getRankingEvent();
            if (response?.rankings?.[0] != null && event.id !== -1) { // Optional chaining and check event.id
                const score = response.rankings[0].score;
                const rank = response.rankings[0].rank;
                const timestamp = Date.now();
                const id = response.rankings[0].userId;

                discordClient.cutoffdb?.prepare('INSERT INTO cutoffs ' + // Optional chaining
                    '(EventID, Tier, Timestamp, Score, ID) ' +
                    'VALUES(@eventID, @tier, @timestamp, @score, @id)').run({
                        score: score,
                        eventID: event.id,
                        tier: rank,
                        timestamp: timestamp,
                        id: id
                    });
            }
        } catch (e: any) { // Type as any for error
            console.error('Error occurred while adding cutoffs:', e); // Changed to console.error
        }
    }
    try {
        const event = getRankingEvent();
        if (event.id === -1) {
            return -1;
        } else {
            cutoffs.forEach(cutoff => {
                discordClient.addPrioritySekaiRequest('ranking', {
                    eventId: event.id,
                    targetRank: cutoff,
                    lowerLimit: 0
                }, logResults, (err: any) => { // Type as any for error
                    discordClient.logger?.log({ // Optional chaining
                        level: 'error',
                        message: err.toString()
                    });
                });
            });
        }
    } catch (error: any) { // Type as any for error
        console.error('Connection Error, Retrying:', error); // Changed to console.error
        return;
    }
}

/**
 * Obtains the current event within the ranking period
 * @return {RankingEvent} the ranking event information
 */
const getRankingEvent = (): RankingEvent => {
    let events: RankingEvent[] = [];
    try {
        events = JSON.parse(fs.readFileSync('sekai_master/events.json', 'utf8')) as RankingEvent[];
    } catch (err) {
        console.error('Error reading events.json:', err);
        return {
            id: -1,
            banner: '',
            name: '',
            startAt: 0,
            aggregateAt: 0,
            closedAt: 0,
            eventType: '',
            assetbundleName: '',
        };
    }


    const currentTime = Date.now();

    for (let i = events.length - 1; i >= 0; i--) {
        //Time of Distribution + buffer time of 15 minutes to get final cutoff
        if (events[i].startAt < currentTime && events[i].aggregateAt + 15 * 60 * 1000 > currentTime) {
            return {
                id: events[i].id,
                banner: 'https://storage.sekai.best/sekai-en-assets/event/' +
                    `${events[i].assetbundleName}/logo/logo.webp`,
                name: events[i].name,
                startAt: events[i].startAt,
                aggregateAt: events[i].aggregateAt,
                closedAt: events[i].closedAt,
                eventType: events[i].eventType,
                assetbundleName: events[i].assetbundleName,
            };
        }
    }

    return {
        id: -1,
        banner: '',
        name: '',
        startAt: 0,
        aggregateAt: 0,
        closedAt: 0,
        eventType: '',
        assetbundleName: '',
    };
};

/**
 * Continually grabs and updates the Cutoff data
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackCutoffData = async (discordClient: DiscordClient): Promise<void> => {
    // Set an interval to run getCutoffs periodically
    setInterval(getCutoffs, CUTOFF_INTERVAL, discordClient);
    // Run function once immediately since setInterval waits an interval to run it
    getCutoffs(discordClient);
};

export default trackCutoffData;