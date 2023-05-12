
const { TWITTER_INTERVAL } = require('../constants');
const axios = require('axios');

const fp = './JSONs/twitter.json';
const { TwitterToken } = require('../config');

const getTweets = async (username) => {
    const get = async (url) => {
        const h = {
            'Authorization': TwitterToken
        };

        const res = await axios.get(url, { headers: h });
        return res.data;
    };

    const url = `https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=${username}`;
    let data = await get(url);

    return data.map((tweet) => { return tweet.id_str; });
};

const collectTwitter = async (data, discordClient) => {

    const username = data.username;
    const channelid = data.channel;
  
    let date = new Date();
    let hour = date.getHours();
    let minute = date.getMinutes();
    if (minute - 5 < 0) {
      hour -= 1;
      minute = 60 + (minute - 5);
    } else {
      minute -= 5;
    }
    date.setHours(hour);
    date.setMinutes(minute);

    const tweets = await getTweets(username);
    for (let i = 0; i < tweets.length; i++) {
        if (!(data.tweets.includes(tweets[i]))) {
            data.tweets.push(tweets[i]);

            let channel = discordClient.client.channels.cache.get(channelid);
            let str = `https://twitter.com/${username}/status/${tweets[i]}`;

            if (data.role) {
                str = `<@&${data.role}> ${str}`;
            }
            channel.send(str);
        }
    }

    return data;
};

const readTwitterData = () => {
    const fs = require('fs');
    if (fs.existsSync(fp)) {
        const data = JSON.parse(fs.readFileSync(fp));
        return data;
    }
    return [];
};

const writeTwitterData = (data) => {
    const fs = require('fs');
    fs.writeFileSync(fp, JSON.stringify(data));
};

const addTwitterData = async (username, channelid, role) => {
    const data = readTwitterData();

    data.push({
        username: username,
        channel: channelid,
        role: role,
        tweets: []
    });
    writeTwitterData(data);
    return true;
};

const removeTwitterData = (username, channelid) => {
    const data = readTwitterData();
    for (let i = 0; i < data.length; i++) {
        if (data[i].username === username && data[i].channel === channelid) {
            data.splice(i, 1);
            writeTwitterData(data);
            return true;
        }
    }
    return false;
};

const collectTwitterData = async (discordClient) => {
    let data = readTwitterData();
    for (let i = 0; i < data.length; i++) {
        data[i] = await collectTwitter(data[i], discordClient);
    };
    writeTwitterData(data);
};

/**
 * Continaully grabs and updates the Cutoff data
 * @param {DiscordClient} discordClient the client we are using 
 */
const trackTwitterData = async (discordClient) => {
    let dataUpdater = setInterval(collectTwitterData, TWITTER_INTERVAL, discordClient);
    collectTwitterData(discordClient); //Run function once since setInterval waits an interval to run it
};

module.exports = {trackTwitterData, addTwitterData, removeTwitterData, getTweets};