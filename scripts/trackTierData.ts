// scripts/trackTierData.ts
/**
 * @fileoverview Main tracker of all cutoff data for internal storage in case Sekai.Best goes down
 * @author Ai0796
 */

import { TRACK_INTERVAL } from '../constants';
import * as fs from 'fs';
import DiscordClient from '../client/client'; // Assuming default export
import { TextBasedChannel } from 'discord.js';


const fp = './JSONs/track.json'; // File for tier tracking
const userFp = './JSONs/userTrack.json'; // File for user-specific tracking

interface TierTrackEntry {
    [score: string]: [string, string][]; // Maps score to an array of [channelId, mention]
}

interface TrackFile {
    [tier: string]: TierTrackEntry; // Maps tier (as string) to TierTrackEntry
}

interface UserTrackObject {
    userId: string;
    currentTier: number;
    cutoff: number | null;
    min: number;
    max: number;
    trackId: string;
    channel: string;
    lastScore: number;
    inLeaderboard: boolean;
    name: string;
    serverid: string;
}

interface RankingResponse {
    rankings: Array<{ score: number; rank: number; userId: string; name: string }>;
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

let userTrackFile: UserTrackObject[] = getUserTrackFile(); // Load on startup

async function clearFile(): Promise<void> {
    try {
        if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
        }
        if (fs.existsSync(userFp)) {
            fs.unlinkSync(userFp);
        }
    } catch (e: any) {
        console.error('Error occurred while clearing tracking files:', e);
    }
}

function readTiers(): string[] {
    try {
        if (!fs.existsSync(fp)) {
            return [];
        } else {
            const trackFile: TrackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
            return Object.keys(trackFile);
        }
    } catch (e: any) {
        console.error('Error occurred while reading tiers:', e);
        return [];
    }
}

function readScores(tier: string): string[] {
    try {
        if (!fs.existsSync(fp)) {
            return [];
        } else {
            const trackFile: TrackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
            if (tier in trackFile) {
                return Object.keys(trackFile[tier]);
            }
        }
    } catch (e: any) {
        console.error('Error occurred while reading scores:', e);
    }
    return [];
}

function getUserTrackFile(): UserTrackObject[] {
    try {
        if (!fs.existsSync(userFp)) {
            return [];
        } else {
            const data: any = JSON.parse(fs.readFileSync(userFp, 'utf8'));
            if (Array.isArray(data)) {
                return data as UserTrackObject[];
            } else {
                return [];
            }
        }
    } catch (e: any) {
        console.error('Error occurred while reading user tracking:', e);
        return [];
    }
}

function saveUserTrackFile(object: UserTrackObject[]): void {
    fs.writeFile(userFp, JSON.stringify(object), err => {
        if (err) {
            console.error('Error writing user tracking', err);
        } else {
            console.log('Wrote user tracking Successfully');
        }
    });
}

function getUsers(tier: string, score: string): [string, string][] {
    let users: [string, string][] = [];
    let trackFile: TrackFile;
    try {
        if (!fs.existsSync(fp)) {
            trackFile = {};
        } else {
            trackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (tier in trackFile && score in trackFile[tier]) {
            users = trackFile[tier][score];
            delete trackFile[tier][score];
            if (Object.keys(trackFile[tier]).length === 0) {
                delete trackFile[tier];
            }
        }

        fs.writeFile(fp, JSON.stringify(trackFile), err => {
            if (err) {
                console.error('Error writing Tracking', err);
            } else {
                console.log('Wrote Tracking Successfully');
            }
        });
    } catch (e: any) {
        console.error('Error occurred while writing Tracking:', e);
    }
    return users;
}

/**
 * Checks for changes in tracked tiers and notifies users
 * @param {DiscordClient} discordClient the client we are using 
 */
async function getCutoffs(discordClient: DiscordClient): Promise<number | void> {
    async function checkResults(response: RankingResponse) {
        try {
            if (!response?.rankings?.[0]) return; // Check if rankings[0] exists
            const tiers = readTiers();
            const trackFile = getUserTrackFile(); // Re-read to get latest state
            const userTrack: { [trackId: string]: UserTrackObject[] } = {};
            trackFile.forEach((track) => {
                if (track.trackId in userTrack) {
                    userTrack[track.trackId].push(track);
                } else {
                    userTrack[track.trackId] = [track];
                }
            });

            let changed = false;

            response.rankings.forEach((tierData, i) => {
                const rank = i + 1;
                const score = tierData.score;

                if (tiers.includes(rank.toString())) {
                    const scoreList = readScores(rank.toString());

                    scoreList.forEach((oldScoreStr) => {
                        const oldScore = parseInt(oldScoreStr);
                        if (score >= oldScore) {
                            const usersToNotify = getUsers(rank.toString(), oldScoreStr);

                            if (usersToNotify && usersToNotify.length > 0) {
                                usersToNotify.forEach((pair) => {
                                    const channel = discordClient.client.channels.cache.get(pair[0]);
                                    if (channel && channel.isTextBased()) { // Ensure it's a text-based channel
                                        try {
                                            (channel as TextBasedChannel).send(`${pair[1]} T${rank} Has started meowing, they are now at ${score.toLocaleString()} EP\nYou tracked ${oldScore.toLocaleString()} Nyaa~`);
                                        } catch (e: any) {
                                            console.error('Error occurred while sending message:', e);
                                        }
                                    }
                                });
                            }
                        }
                    });
                }

                if (tierData.userId.toString() in userTrack) {
                    userTrack[tierData.userId].forEach((track) => {
                        track.currentTier = i + 1;
                        const lastScore = track.lastScore;
                        const currentScore = tierData.score;
                        const change = currentScore - lastScore;
                        if (change === 0) {
                            return;
                        }
                        track.lastScore = currentScore;
                        changed = true;

                        if (track.cutoff) {
                            if (currentScore >= track.cutoff) {
                                const channel = discordClient.client.channels.cache.get(track.channel);
                                if (channel && channel.isTextBased()) {
                                    try {
                                        (channel as TextBasedChannel).send(`T${rank} ${track.name} has passed the cutoff ${track.cutoff.toLocaleString()}, they are now at ${score.toLocaleString()} EP`);
                                    } catch (e: any) {
                                        console.error('Error occurred while sending message:', e);
                                    }
                                }
                                track.cutoff = null; // Mark as null after notification
                            }
                        }
                        if (track.min || track.max) {
                            if (change >= track.min && change <= track.max) {
                                const channel = discordClient.client.channels.cache.get(track.channel);
                                if (channel && channel.isTextBased()) {
                                    try {
                                        const minStr = track.min !== null ? `Min: ${track.min.toLocaleString()}` : '';
                                        const maxStr = track.max === Number.MAX_SAFE_INTEGER ? 'Max: Infinte' : `Max: ${track.max.toLocaleString()}`;
                                        (channel as TextBasedChannel).send(`T${track.currentTier} ${track.name} had a game with ${(change).toLocaleString()} EP. Current EP: ${score.toLocaleString()} EP (${minStr} ${maxStr})`);
                                    } catch (e: any) {
                                        console.error('Error occurred while sending message:', e);
                                    }
                                }
                            }
                        }
                    });
                }
            });

            if (changed) saveUserTrackFile(Object.values(userTrack).flat()); // Flatten the object back to an array
        } catch (e: any) {
            console.error('Error occurred while checking results:', e);
        }
    }
    try {
        const event = getRankingEvent();
        if (event.id === -1) {
            await clearFile();
            return -1;
        } else {
            discordClient.addPrioritySekaiRequest('ranking', {
                eventId: event.id,
            }, checkResults, (err: any) => {
                discordClient.logger?.log({
                    level: 'error',
                    message: err.toString()
                });
            });
        }
    } catch (error: any) {
        console.error('Connection Error, Retrying:', error);
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
 * Continually grabs and updates the Cutoff data
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackTierData = async (discordClient: DiscordClient): Promise<void> => {
    setInterval(getCutoffs, TRACK_INTERVAL, discordClient);
    getCutoffs(discordClient); //Run function once since setInterval waits an interval to run it
};

export default trackTierData;