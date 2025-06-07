// scripts/trackTwitterData.ts
import { TWITTER_INTERVAL } from '../constants';
import * as fs from 'fs';
import { Timeline } from 'twittxr'; // Assuming twittxr provides a Timeline class/object
import { TwitterCookie } from '../config'; // Assuming TwitterCookie is exported from config
import DiscordClient from '../client/client'; // Assuming default export
import { TextBasedChannel } from 'discord.js';


const fp = './JSONs/twitter.json';

interface TwitterTrackerData {
    username: string;
    channel: string;
    role?: string; // Optional role ID to ping
    tweets: string[]; // Array of tweet IDs
}

export const getTweets = async (username: string): Promise<string[]> => {
    try {
        await Timeline.usePuppeteer(); // Assuming this initializes Puppeteer
        const data = await Timeline.get(username,
            {
                cookie: TwitterCookie,
                retweets: false,
                replies: false
            });

        return data.map((tweet: { id: string }) => tweet.id); // Map to tweet IDs
    }
    catch (e: any) {
        console.error('Error fetching tweets:', e);
        return [];
    }
};

const collectTwitter = async (data: TwitterTrackerData, discordClient: DiscordClient): Promise<TwitterTrackerData> => {

    const username = data.username;
    const channelid = data.channel;

    // The original code tried to adjust date/time for filtering, but `Timeline.get` doesn't
    // seem to support date range, and filtering locally might miss tweets.
    // So, rely on comparing tweet IDs.

    const tweets = await getTweets(username);
    tweets.sort((a: string, b: string) => parseInt(b) - parseInt(a)); // Sort numerically descending by ID
    const newTweets: string[] = [];

    for (let i = 0; i < Math.min(tweets.length, 25); i++) { // Check up to 25 recent tweets
        if (!(data.tweets.includes(tweets[i]))) {
            newTweets.push(tweets[i]); // Collect new tweets
        }
    }

    // Add new tweets to the beginning of the list to maintain recency
    data.tweets = [...newTweets.reverse(), ...data.tweets]; // Reverse newTweets to add in chronological order

    // Remove old tweets, keeping a maximum of 50
    data.tweets = data.tweets.slice(-50);

    // Send new tweets
    for (const tweetId of newTweets) {
        const channel = discordClient.client.channels.cache.get(channelid);
        if (channel && channel.isTextBased()) { // Ensure it's a text-based channel
            let str = `https://vxtwitter.com/${username}/status/${tweetId}`;

            if (data.role) {
                str = `<@&${data.role}> ${str}`;
            }
            try {
                (channel as TextBasedChannel).send(str);
            } catch (e: any) {
                console.error(`Error sending tweet to channel ${channelid}:`, e);
            }
        } else {
            console.warn(`Channel ${channelid} not found or is not text-based for tweet notification.`);
        }
    }

    return data;
};

const readTwitterData = (): TwitterTrackerData[] => {
    try {
        if (fs.existsSync(fp)) {
            const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
            return data as TwitterTrackerData[]; // Type assertion
        }
    } catch (e: any) {
        console.error('Error reading twitter.json:', e);
    }
    return [];
};

const writeTwitterData = (data: TwitterTrackerData[]): void => {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2)); // Prettify JSON for readability
};

export const addTwitterData = async (username: string, channelid: string, role?: string): Promise<boolean> => {
    // Check if it already exists for this channel and username
    const existingEntry = twitterData.find(
        entry => entry.username === username && entry.channel === channelid
    );

    if (existingEntry) {
        // Update existing entry if found (e.g., update role)
        existingEntry.role = role;
        writeTwitterData(twitterData);
        return false; // Indicate that it already existed
    }

    // Fetch initial tweets to populate the `tweets` array
    const initialTweets = await getTweets(username);

    twitterData.push({
        username: username,
        channel: channelid,
        role: role,
        tweets: initialTweets
    });
    writeTwitterData(twitterData);
    return true; // Indicate new entry was added
};

export const removeTwitterData = (username: string, channelid: string): boolean => {
    const initialLength = twitterData.length;
    const updatedData = twitterData.filter(
        entry => !(entry.username === username && entry.channel === channelid)
    );
    if (updatedData.length < initialLength) {
        // If an entry was removed, update the global twitterData array and save
        twitterData.splice(0, twitterData.length, ...updatedData); // Replace content of original array
        writeTwitterData(twitterData);
        return true;
    }
    return false;
};

const collectAllTwitterData = async (discordClient: DiscordClient): Promise<void> => {
    for (let i = 0; i < twitterData.length; i++) {
        // Ensure data[i] is defined before passing to collectTwitter
        if (twitterData[i]) {
            twitterData[i] = await collectTwitter(twitterData[i], discordClient);
        }
    }
    writeTwitterData(twitterData);
};

const twitterData: TwitterTrackerData[] = readTwitterData(); // Load data on startup

/**
 * Continually grabs and updates the Twitter data
 * @param {DiscordClient} discordClient the client we are using 
 */
export const trackTwitterData = async (discordClient: DiscordClient): Promise<void> => {
    // The original code calls Timeline.usePuppeteer() inside getTweets which will launch a browser on each call.
    // It might be more efficient to launch it once if possible, but twittxr's API might not support it directly.
    // For now, sticking to the original logic.
    setInterval(collectAllTwitterData, TWITTER_INTERVAL, discordClient);
    collectAllTwitterData(discordClient); // Run function once since setInterval waits an interval to run it
};

// Exporting named functions as per original module.exports.
// This is done implicitly if they are `export const` or `export function`.