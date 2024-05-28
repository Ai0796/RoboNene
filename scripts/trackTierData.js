/**
 * @fileoverview Main tracker of all cutoff data for internal storage in case Sekai.Best goes down
 * @author Ai0796
 */

const { TRACK_INTERVAL } = require('../constants');
const fs = require('fs');

const fp = './JSONs/track.json';
const userFp = './JSONs/userTrack.json';

/**
 * Writes JSON response from Project Sekai servers to local JSON
 * @param {Object} response from project sekai client
*/

async function clearFile() {
    try {
        if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
        }
        if (fs.existsSync(userFp)) {
            fs.unlinkSync(userFp);
        }
    } catch (e) {
        console.log('Error occured while writing Tracking: ', e);
    }
}

function readTiers() {
    var trackFile;
    try {
        if (!fs.existsSync(fp)) {
            trackFile = new Object();
        }
        else {
            trackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        return Object.keys(trackFile);

    } catch (e) {
        console.log('Error occured while writing Tracking: ', e);
    }
}

function readScores(tier) {
    tier = tier.toString();
    var trackFile;
    try {
        if (!fs.existsSync(fp)) {
            trackFile = new Object();
        }
        else {
            trackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (tier in trackFile) {
            return Object.keys(trackFile[tier]);
        }

    } catch (e) {
        console.log('Error occured while writing Tracking: ', e);
    }

    return [];
}

function getUserTrackFile() {
    try {
        if (!fs.existsSync(userFp)) {
            return [];
        }
        else {
            let data = JSON.parse(fs.readFileSync(userFp, 'utf8'));
            if (Array.isArray(data)) {
                return data;
            } else {
                return [];
            }
        }
    } catch (e) {
        console.log('Error occured while reading user tracking: ', e);
    }
}

function saveUserTrackFile(object) {
    fs.writeFile(userFp, JSON.stringify(object), err => {
        if (err) {
            console.log('Error writing user tracking', err);
        } else {
            console.log('Wrote user tracking Successfully');
        }
    });
}

function getUsers(tier, score) {
    tier = tier.toString();
    var users = [];
    var trackFile;
    try {
        if (!fs.existsSync(fp)) {
            trackFile = new Object();
        }
        else {
            trackFile = JSON.parse(fs.readFileSync(fp, 'utf8'));
        }

        if (tier in trackFile) {
            users = trackFile[tier][score];
            delete trackFile[tier][score];
            if (Object.keys(trackFile[tier]).length === 0) {
                delete trackFile[tier];
            }
        }

        fs.writeFile(fp, JSON.stringify(trackFile), err => {
            if (err) {
                console.log('Error writing Tracking', err);
            } else {
                console.log('Wrote Tracking Successfully');
            }
        });
    } catch (e) {
        console.log('Error occured while writing Tracking: ', e);
    }

    return users;
}

/**
 * Recurvsively adds cutoff tracks to queue
 * @param {Integer} target index of cutoff in a cutoff list
 * @param {Integer} target event, if -1 calculates the event based on current time
 * @param {DiscordClient} discordClient the client we are using 
*/
async function getCutoffs(discordClient) {
    async function checkResults(response) {
        try {
            if (response['rankings'][0] == null) return;
            let tiers = readTiers();
            let trackFile = getUserTrackFile();
            let userTrack = {};
            trackFile.forEach((track) => {
                if (track.trackId in userTrack) {
                    userTrack[track.trackId].push(track);
                } else {
                    userTrack[track.trackId] = [track];
                }
            });

            let changed = false;

            response['rankings'].forEach((tier, i) => {
                let rank = i+1;
                let score = tier.score;
                if (tiers.includes(rank.toString())) {
                    let scoreList = readScores(rank.toString());

                    scoreList.forEach((oldScore) => {
                        if (score >= parseInt(oldScore)) {
                            let users = getUsers(rank, oldScore);

                            if (users != undefined) {
                                users.forEach((pair) => {
                                    let channel = discordClient.client.channels.cache.get(pair[0]);
                                    try {
                                        channel.send(`${ pair[1]} T${ rank } Has started moving, they are now at ${ score.toLocaleString() } EP\nYou tracked ${ parseInt(oldScore).toLocaleString() }`);
                                    } catch (e) {
                                        console.log('Error occured while sending message: ', e);
                                    }
                                });
                            }
                        }
                    });
                }

                if (tier['userId'] in userTrack) {
                    userTrack[tier['userId']].forEach((track) => {
                        track.currentTier = i+1;
                        let lastScore = track.lastScore;
                        let currentScore = tier.score;
                        let change = currentScore - lastScore;
                        if (change == 0) {
                            return;
                        }
                        track.lastScore = currentScore;
                        changed = true;

                        if (track.cutoff) {
                            if (currentScore >= track.cutoff) {
                                let channel = discordClient.client.channels.cache.get(track.channel);
                                try {
                                    channel.send(`T${rank} ${track.name} has passed the cutoff ${track.cutoff.toLocaleString()}, they are now at ${score.toLocaleString()} EP`);
                                } catch (e) {
                                    console.log('Error occured while sending message: ', e);
                                }
                                track.cutoff = null;
                            }
                        } if (track.min || track.max) {
                            if (change >= track.min && change <= track.max) {
                                let channel = discordClient.client.channels.cache.get(track.channel);
                                try {
                                    let minStr = track.min ? `Min: ${track.min.toLocaleString()}` : '';
                                    let maxStr = track.max == Number.MAX_SAFE_INTEGER ? 'Max: Infinte' : `Max: ${track.max.toLocaleString()}`;
                                    channel.send(`T${track.currentTier} ${track.name} had a game with ${(change).toLocaleString()} EP. Current EP: ${score.toLocaleString()} EP (${minStr} ${maxStr})`);
                                } catch (e) {
                                    console.log('Error occured while sending message: ', e);
                                }
                            }
                        }
                    });
                }
            });

            if (changed) saveUserTrackFile(userTrack);
        } catch (e) {
            console.log('Error occured while adding cutoffs: ', e);
        }
    }
    try {
        let event = getRankingEvent().id;
        if (event == -1) {
            await clearFile();
            return -1;
        } else {
            discordClient.addPrioritySekaiRequest('ranking', {
                eventId: event,
            }, checkResults, (err) => {
                discordClient.logger.log({
                    level: 'error',
                    message: err.toString()
                });
            });
        }
    } catch (error) {
        console.log(error);
        console.log('Connection Error, Retrying');
        return;
    }
}

/**
 * Obtains the current event within the ranking period
 * @return {Object} the ranking event information
 */
const getRankingEvent = () => {
    const events = JSON.parse(fs.readFileSync('sekai_master/events.json'));
    const currentTime = Date.now();

    for (let i = events.length - 1; i >= 0; i--) {
        //Time of Distribution + buffer time of 15 minutes to get final cutoff
        if (events[i].startAt < currentTime && events[i].aggregateAt > currentTime) {
            return {
                id: events[i].id,
                banner: 'https://sekai-res.dnaroma.eu/file/sekai-en-assets/event/' +
                    `${events[i].assetbundleName}/logo_rip/logo.webp`,
                name: events[i].name,
                startAt: events[i].startAt,
                aggregateAt: events[i].aggregateAt,
                closedAt: events[i].closedAt,
                eventType: events[i].eventType
            };
        }
    }

    return {
        id: -1,
        banner: '',
        name: ''
    };
};

/**
 * Continaully grabs and updates the Cutoff data
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackTierData = async (discordClient) => {
    let dataUpdater = setInterval(getCutoffs, TRACK_INTERVAL, discordClient);
    getCutoffs(discordClient); //Run function once since setInterval waits an interval to run it
};

module.exports = trackTierData;