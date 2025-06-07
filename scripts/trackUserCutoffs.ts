// scripts/trackUserCutoffs.ts
/**
 * @fileoverview Main tracker of all cutoff data for internal storage in case Sekai.Best goes down
 * @author Ai0796
 */

import { CUTOFF_INTERVAL } from '../constants';
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export

// Type for cached points, mapping user ID to their last known score
const pointsCache: { [userId: string]: number } = {};

interface UserDbEntry {
    id: number;
    sekai_id: string; // Assuming sekai_id is a string
}

interface RankingResponse {
    rankings: Array<{ score: number; rank: number; userId: string }>;
}

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
    async function logResults(response: RankingResponse, id: number) {
        try {
            const event = getRankingEvent();
            if (response.rankings && response.rankings.length > 0 && event.id !== -1) {
                const score = response.rankings[0].score;
                const rank = response.rankings[0].rank;
                const timestamp = Date.now();

                let change = false;

                if (id in pointsCache) {
                    if (score >= pointsCache[id] + 100) { // Check for a significant change
                        pointsCache[id] = score;
                        change = true;
                    }
                } else {
                    pointsCache[id] = score;
                    change = true;
                }

                if (change) {
                    discordClient.cutoffdb?.prepare('INSERT INTO users ' +
                        '(id, Tier, EventID, Timestamp, Score) ' +
                        'VALUES(@id, @tier, @EventID, @timestamp, @score)').run({
                            id: id,
                            score: score,
                            EventID: event.id,
                            tier: rank,
                            timestamp: timestamp
                        });
                }
            }
        } catch (e: any) {
            console.error('Error occurred while adding user cutoffs:', e);
        }
    }
    try {
        const event = getRankingEvent();
        if (event.id === -1) {
            return -1;
        } else {
            const ids: UserDbEntry[] = discordClient.db?.prepare('SELECT id, sekai_id FROM users').all() as UserDbEntry[] || []; // Type assertion for DB result
            console.log('Getting cutoffs for ' + ids.length + ' users');

            for (const userEntry of ids) {
                discordClient.addSekaiRequest('ranking', {
                    eventId: event.id,
                    targetUserId: userEntry.sekai_id,
                    lowerLimit: 0
                },
                    (response: RankingResponse) => logResults(response, userEntry.id),
                    (err: any) => {
                        discordClient.logger?.log({
                            level: 'error',
                            message: `Error fetching user ranking for ID ${userEntry.sekai_id}: ${err.toString()}`
                        });
                    }
                );
                await new Promise(r => setTimeout(r, 50)); // Small delay to avoid overwhelming API
            }
        }
    } catch (error: any) {
        console.error('Connection Error for user cutoffs, Retrying:', error);
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
        console.error('Error reading events.json for getRankingEvent:', err);
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
        if (events[i].startAt < currentTime && events[i].aggregateAt > currentTime) {
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
 * Continually grabs and updates the Cutoff data for tracked users
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackUserCutoffs = async (discordClient: DiscordClient): Promise<void> => {
    // Set an interval to run getCutoffs periodically
    setInterval(getCutoffs, CUTOFF_INTERVAL, discordClient);
    // Run function once immediately since setInterval waits an interval to run it
    getCutoffs(discordClient);
};

export default trackUserCutoffs;