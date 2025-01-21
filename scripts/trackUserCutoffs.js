/**
 * @fileoverview Main tracker of all cutoff data for internal storage in case Sekai.Best goes down
 * @author Ai0796
 */

const { CUTOFF_INTERVAL } = require('../constants');
const fs = require('fs');
/**
 * Writes JSON response from Project Sekai servers to local JSON
 * @param {Object} response from project sekai client
*/

const pointsCache = {};


/**
 * Recurvsively adds cutoff tracks to queue
 * @param {Integer} target index of cutoff in a cutoff list
 * @param {Integer} target event, if -1 calculates the event based on current time
 * @param {DiscordClient} discordClient the client we are using 
*/
async function getCutoffs(discordClient) {
    async function logResults(response, id) {
        try {
            let event = getRankingEvent().id;
            if (response['rankings'][0] != null && event != -1) {
                // User is already linked
                let score = response['rankings'][0]['score'];
                let rank = response['rankings'][0]['rank'];
                let timestamp = Date.now();

                let change = false;

                if (id in pointsCache) {
                    if (score >= pointsCache[id] + 100) {
                        pointsCache[id] = score;
                        change = true;
                    }
                } else {
                    pointsCache[id] = score;
                    change = true;
                }
                

                if (change) {
                    discordClient.cutoffdb.prepare('INSERT INTO users ' +
                    '(id, Tier, EventID, Timestamp, Score) ' +
                    'VALUES(@id, @tier, @EventID, @timestamp, @score)').run({
                        id: id,
                        score: score,
                        EventID: event,
                        tier: rank,
                        timestamp: timestamp
                    });
                }
            }
        } catch (e) {
            console.log('Error occured while adding cutoffs: ', e);
        }
    }
    try {
        let event = getRankingEvent().id;
        if (event == -1) {
            return -1;
        } else {
            const ids = discordClient.db.prepare('Select * FROM users').all();
            console.log('Getting cutoffs for ' + ids.length + ' users');
            ids.forEach(async(id) => {
                discordClient.addSekaiRequest('ranking', {
                    eventId: event,
                    targetUserId: id.sekai_id,
                    lowerLimit: 0
                }, function(k) { logResults(k, id.id); }, (err) => {
                    discordClient.logger.log({
                        level: 'error',
                        message: err.toString()
                    });
                });
                await new Promise(r => setTimeout(r, 50));
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
const trackUserCutoffs = async (discordClient) => {
    let dataUpdater = setInterval(getCutoffs, CUTOFF_INTERVAL, discordClient);
    getCutoffs(discordClient); //Run function once since setInterval waits an interval to run it
};

module.exports = trackUserCutoffs;