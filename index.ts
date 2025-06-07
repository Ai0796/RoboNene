// index.ts
/**
 * @fileoverview The main code to run when you start the bot
 * @author Potor10
 */

import DiscordClient from './client/client';
import loadGameData from './scripts/loadGameData';
import loadMusicMeta from './scripts/loadMusicMeta';
import trackGameData from './scripts/trackGameData';
import trackRankingData from './scripts/trackRankingData';
import trackCutoffData from './scripts/trackCutoffData';
import trackUserCutoffs from './scripts/trackUserCutoffs';
import trackTierData from './scripts/trackTierData';
import updateActivity from './scripts/updateActivity';
import * as fs from 'fs';
import { trackTwitterData } from './scripts/trackTwitterData'; // Import named export

// Initial data loading
loadMusicMeta(0);
loadGameData(0, async () => {
  const client = new DiscordClient();
  client.loadCommands();
  client.loadEvents();
  client.loadDb();
  client.loadCutoffDb();
  client.loadPrayerDb();
  client.loadStockDb();
  client.loadLogger();
  client.loadMessageHandler(); // Un-commented based on original code, assuming it's desired
  client.loadServerHandler();

  await client.login();
  // await client.loadSekaiClient();
  // await client.runSekaiRequests();

  // Begin the scripts
  trackGameData(client);
  trackRankingData(client);
  trackCutoffData(client); // Un-commented based on original code, assuming it's desired
  trackUserCutoffs(client); // Un-commented based on original code, assuming it's desired
  trackTierData(client);
  trackTwitterData(client);
  updateActivity(client);

  // This is a very duct tape solution
  if (fs.existsSync('messages.json')) {
    try {
      const messages: { [key: string]: string } = JSON.parse(fs.readFileSync('messages.json', 'utf8'));
      Object.keys(messages).forEach((key) => {
        const messageContent = messages[key];
        const channel = client.client.channels.cache.get(key);
        if (channel && channel.isTextBased()) { // Ensure it's a text-based channel
          channel.send(messageContent);
        }
      });
      fs.unlinkSync('messages.json');
    } catch (e) {
      console.error('Error processing messages.json:', e);
    }
  }
});