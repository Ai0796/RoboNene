/**
 * @fileoverview The main code to run when you start the bot
 * @author Potor10
 */

const DiscordClient = require('./client/client');
const loadGameData = require('./scripts/loadGameData');
const loadMusicMeta = require('./scripts/loadMusicMeta');
const trackGameData = require('./scripts/trackGameData');
const trackRankingData = require('./scripts/trackRankingData');
const trackCutoffData = require('./scripts/trackCutoffData');
const trackUserCutoffs = require('./scripts/trackUserCutoffs');
const trackTierData = require('./scripts/trackTierData');
const updateActivity = require('./scripts/updateActivity');
const fs = require('fs');
const { trackTwitterData } = require('./scripts/trackTwitterData');

console.log('Loading game data...');

loadMusicMeta(0);
loadGameData(50, async () => {
  console.log('Finished loading game data, starting bot...');
  const client = new DiscordClient();
  client.loadCommands();
  client.loadEvents();
  client.loadDb();
  client.loadCutoffDb();
  client.loadLogger();
  // client.loadMessageHandler();
  client.loadServerHandler();
  client.loadEventData();

  client.loadPrayerDb();
  client.loadStockDb();

  await client.login();
  await client.loadSekaiClient();
  await client.runSekaiRequests();

  // Begin the scripts
  trackGameData(client);
  trackRankingData(client);
  // trackCutoffData(client);
  // trackUserCutoffs(client);
  trackTierData(client);
  // trackTwitterData(client);

  // Lower Priority Tasks
  // updateActivity(client);

  //This is a very duct tape solution
  if(fs.existsSync('messages.json')) {
    let messages = JSON.parse(fs.readFileSync('messages.json', 'utf8'));
    Object.keys(messages).forEach((key) => {
      let message = messages[key];
      let channel = client.client.channels.cache.get(key);
      if(channel) {
        channel.send(message);
      }
    });

    fs.unlinkSync('messages.json');
  }
});
