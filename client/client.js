/**
 * @fileoverview The main class that handles a majority of the discord.js
 * and project sekai interactions between the command layer & app layer.
 * @author Potor10
 */

const { token, secretKey } = require('../config.json');
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { SekaiClient } = require('sekapi');
const { RATE_LIMIT } = require('../constants');

const winston = require('winston');
const Database = require('better-sqlite3-multiple-ciphers');
const { AceBase } = require('acebase');

const fs = require('fs');
const path = require('path');

// Constants used to locate the directories of data
const CLIENT_CONSTANTS = {
  // eslint-disable-next-line no-undef
  'CMD_DIR': path.join(__dirname, '/commands'),
  'EVENT_DIR': path.join(__dirname, '/events'),
  'LOG_DIR': path.join(__dirname, '../logs'),
  'DB_DIR': path.join(__dirname, '../databases'),
  'DB_NAME': 'databases.db',
  'CUTOFF_DB_DIR': path.join(__dirname, '../cutoff_data'),
  'CUTOFF_DB_NAME': 'cutoffs.db',
  'PRAYER_DB_DIR': path.join(__dirname, '../prayer_data'),
  'PRAYER_DB_NAME': 'prayers.db',
  'STOCK_DB_DIR': path.join(__dirname, '../stock_data'),
  'STOCK_DB_NAME': 'stocks',

  'PREFS_DIR': path.join(__dirname, '../prefs')
};

/**
 * A client designed to interface discord.js requests and provide
 * integration into the custom Project Sekai API designed for this project
 */
class DiscordClient {
  constructor(tk = token) {
    this.token = tk;
    this.commands = [];
    this.logger = null;
    this.db = null;
    this.cutoffdb = null;
    this.prayerdb = null;
    this.stockdb = null;

    this.prefix = '%';
    this.changePlayers = '+';

    this.api = [];
    this.priorityApiQueue = [];
    this.apiQueue = [];

    this.rateLimit = {};

    this.client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessageReactions,
      ], 
      partials: [
        'CHANNEL'
      ], 
      shards: 'auto'
    });
  }

  loadMessageHandler() {
    this.client.on(Events.MessageCreate, async message => {
      if (message.author.bot) return;

      if (message.content.length === 5 && isNaN(message.content) === false) {
        const event = require(`${CLIENT_CONSTANTS.CMD_DIR}/rm.js`);

        event.promptExecuteMessage(message, this);
      } 
      else if (message.content.length === 2 && message.content.startsWith(this.changePlayers) &&
        isNaN(message.content[1]) === false) {
          const event = require(`${CLIENT_CONSTANTS.CMD_DIR}/rm.js`);

          event.promptExecuteMessage(message, this);
        }

      if (message.channel.id == '1135951698741964800') {
        if (message.content.toUpperCase() === 'CAN I ENTER G1') {
          if (message.author.id === '670399881990373422' || message.author.id == '1127443854644219914') {
            message.channel.send('Yes');
          } else {
            message.channel.send('No');
          }
        }
      }

      if (message.content.toLowerCase().startsWith('oh magic ghostnenerobo')) {
        const event = require(`${CLIENT_CONSTANTS.CMD_DIR}/magicghostnene.js`);
        this.logger.info(`Magic Ghostnene command called by ${message.author.username}`);
        event.executeMessage(message, this);
      }
      if (!message.content.startsWith(this.prefix)) return;
      let command = message.content.slice(this.prefix.length).split(/ +/);
      this.logger.info(`Command ${command[0]} called by ${message.author.username}`);

      if (command[0] === 'rm') {
        const event = require(`${CLIENT_CONSTANTS.CMD_DIR}/rm.js`);

        event.executeMessage(message, this);
      } else if (command[0] === 'pray') {
        const event = require(`${CLIENT_CONSTANTS.CMD_DIR}/pray.js`);

        event.executeMessage(message, this);
      }
    });
  }

  loadServerHandler() {
    this.client.on(Events.GuildCreate, async guild => {
      this.logger.log({
        level: 'join', 
        message: `Added to Guild: ${guild.name} Id: ${guild.id} Member Count: ${guild.memberCount} Total Guilds: ${this.client.guilds.cache.size} Timestamp: ${new Date().toUTCString()}`
      });
    });
  }

  /**
   * Loads the commands code into the bot via a provided directory
   * @param {string} dir the directory containing the code for the commands
   */
  loadCommands(dir=CLIENT_CONSTANTS.CMD_DIR) {
    // Parse commands
    const commandFiles = fs.readdirSync(dir).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(`${dir}/${file}`);
      if (command.data === null || command.data === undefined) {
        console.log(`Command ${file} does not have a data object, Skipping Load.`);
        continue;
      }
      console.log(`Loaded command ${command.data.name} from ${file}`);
      this.commands.push(command);
    }
  }

  /**
   * Loads the event handlers into the bot via a provided directory
   * @param {string} dir the directory containing the code for the event handlers
   */
  loadEvents(dir=CLIENT_CONSTANTS.EVENT_DIR) {
    // Parse events
    const eventFiles = fs.readdirSync(dir).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      const event = require(`${dir}/${file}`);
      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args));
      } else {
        this.client.on(event.name, (...args) => event.execute(...args, this));
      }
    }
  }

  /**
   * Starts the logger designed to query application usage
   * Also, enables capture of errors within the code to be sent to the log
   * file in production.
   * @param {string} dir the directory containing the log files
   */
  loadLogger(dir=CLIENT_CONSTANTS.LOG_DIR) {
    // Winston logger initialization
    this.logger = winston.createLogger({
      levels: {
        'error': 2,
        'join': 1,
        'info': 2
      },
      format: winston.format.json(),
      defaultMeta: { service: 'user-service' },
      transports: [
        // - Write all logs with level `error` and below to `error.log`
        // - Write all logs with level `info` and below to `combined.log`
        // - Write all logs with level `join` and below to `joins.log`
        new winston.transports.File({ filename: `${dir}/error.log`, level: 'error' }),
        new winston.transports.File({ filename: `${dir}/joins.log`, level: 'join' }),
        new winston.transports.File({ filename: `${dir}/combined.log` }),
      ],
    });

    this.client.on('shardError', error => {
      this.logger.log({
        level: 'error',
        message: `A websocket connection encountered an error: ${error}`
      });
    });

    /* Uncomment this in production
    process.on('unhandledRejection', error => {
      this.logger.log({
        level: 'error',
        message: `Unhandled promise rejection: ${error}`
      })
    });
    */
  }

  /**
   * Initializes the user databases (if it does not already exist) and loads
   * the databases for usage.
   * @param {string} dir the directory containing the encrypted databases
   */
  loadDb(dir = CLIENT_CONSTANTS.DB_DIR) {
    this.db = new Database(`${dir}/${CLIENT_CONSTANTS.DB_NAME}`);

    // Read an encrypted database
    this.db.pragma(`key='${secretKey}'`);
    this.db.pragma('journal_mode = DELETE');

    this.db.prepare('CREATE TABLE IF NOT EXISTS users ' +
      '(id INTEGER PRIMARY KEY, discord_id TEXT, sekai_id TEXT, private INTEGER DEFAULT 1, ' +
      'quiz_correct INTEGER DEFAULT 0, quiz_question INTEGER DEFAULT 0)').run();

    this.db.prepare('CREATE INDEX IF NOT EXISTS IDs ON users (discord_id, id, quiz_correct)').run();

    // Initialize the tracking database instance
    this.db.prepare('CREATE TABLE IF NOT EXISTS tracking ' + 
      '(channel_id TEXT PRIMARY KEY, guild_id TEXT, tracking_type INTEGER)').run();
  }

  /**
   * Closes the databases that have been previously opened
   */
  closeDb() {
    this.db.close();
  }

  /**
   * Initializes the user databases (if it does not already exist) and loads
   * the databases for usage.
   * @param {string} dir the directory containing the encrypted databases
   */
  loadCutoffDb(dir = CLIENT_CONSTANTS.CUTOFF_DB_DIR) {
    this.cutoffdb = new Database(`${dir}/${CLIENT_CONSTANTS.CUTOFF_DB_NAME}`);

    // Read an encrypted database
    this.cutoffdb.pragma(`key='${secretKey}'`);
    this.cutoffdb.pragma('journal_mode = DELETE');

    // Initialize the tracking database instance
    this.cutoffdb.prepare('CREATE TABLE IF NOT EXISTS cutoffs ' +
      '(EventID INTEGER, Tier INTEGER, Timestamp INTEGER, Score INTEGER, ID INTEGER, GameNum INTEGER, ' +
      'PRIMARY KEY(EventID, Tier, Timestamp))').run();

    //Add an index to cutoffs
    this.cutoffdb.prepare('CREATE INDEX IF NOT EXISTS IDs ON cutoffs (ID, Timestamp, Score)').run();

    //Add an index to cutoffs for user
    this.cutoffdb.prepare('CREATE INDEX IF NOT EXISTS userIndex ON cutoffs (EventId, ID)').run();

    // //Add an index to cutoffs for user
    this.cutoffdb.prepare('CREATE INDEX IF NOT EXISTS EventIDTier ON cutoffs (EventId, Tier)').run();

    // //Add an index to cutoffs for user
    this.cutoffdb.prepare('CREATE INDEX IF NOT EXISTS EventIDTimestamp ON cutoffs (EventId, Timestamp)').run();

    // Initialize User Tracking
    this.cutoffdb.prepare('CREATE TABLE IF NOT EXISTS users ' +
      '(id INTEGER, Tier INTEGER, EventID INTEGER,' +
      'Timestamp INTEGER, Score INTEGER,' +
      'PRIMARY KEY(id, EventID, Timestamp))').run();
  }

  /**
   * Initializes the prayer databases (if it does not already exist) and loads
   * the databases for usage.
   */
  loadPrayerDb(dir = CLIENT_CONSTANTS.PRAYER_DB_DIR) {
    this.prayerdb = new Database(`${dir}/${CLIENT_CONSTANTS.PRAYER_DB_NAME}`);

    // Read an encrypted database
    this.prayerdb.pragma(`key='${secretKey}'`);
    this.prayerdb.pragma('journal_mode = DELETE');

    // Initialize the prayer database table
    this.prayerdb.prepare('CREATE TABLE IF NOT EXISTS prayers ' +
    '(id STRING PRIMARY KEY, luck REAL, prays INTEGER, lastTimestamp INTEGER, totalLuck REAL)').run();

    if (!fs.existsSync('prayers.json')) return;
    let data = JSON.parse(fs.readFileSync('prayers.json'));
    
    data.forEach((prayer) => {
      let result = this.prayerdb.prepare('SELECT * FROM prayers WHERE id = ?').get(prayer.id);
      if (result.length > 0 && result[0].luck > prayer.luck) return;
      this.prayerdb.prepare('INSERT OR REPLACE INTO prayers (id, luck, prays, lastTimestamp, totalLuck) ' +
        'VALUES (@id, @luck, @prays, @lastTimestamp, @totalLuck)').run({
          id: prayer.id,
          luck: prayer.luck * 1.0,
          prays: prayer.prays,
          lastTimestamp: prayer.lastTimestamp,
          totalLuck: prayer.totalLuck * 1.0,
        });
    });
    
      // this.prayerdb.prepare('ALTER TABLE prayers MODIFY luck REAL').run();
    // this.prayerdb.prepare('ALTER TABLE prayers MODIFY totalLuck REAL').run();
  }

  /**
   * Initializes the Stock AceBase NoSQL database (if it does not already exist) and loads
   * the databases for usage.
   */
  async loadStockDb(dir = CLIENT_CONSTANTS.STOCK_DB_DIR) {
    const options = { storage: { path: dir } };
    this.stockdb = new AceBase(`${CLIENT_CONSTANTS.STOCK_DB_NAME}`, options);

    await this.stockdb.ready();
  }

  /**
   * 
   * @param {string} discord_id users discord ID
   * @returns {int} users unique database ID
   */
  getId(discord_id) {
    let data = this.db.prepare('SELECT * FROM users ' +
      'WHERE (discord_id=@discord_id)').all({
        discord_id: discord_id,
      });
    if (data.length > 0) {
      return data[0].id;
    } else {
      return -1;
    }
  }

  /**
   * Starts up the Project Sekai Client used to communicate to the game servers
   * @param {string} dir the directory containing the Project Sekai player data
   */
  async loadSekaiClient(dir=CLIENT_CONSTANTS.PREFS_DIR) {
    // Parse clients
    const apiPrefs = fs.readdirSync(dir).filter(file => file.endsWith('.js'));

    for (const file of apiPrefs) {
      const playerPrefs = require(`${dir}/${file}`);
      console.log(`Loaded client ${playerPrefs.account_user_id} from ${file}`);

      // Sekai Api Init
      const apiClient = new SekaiClient(playerPrefs);
      this.api.push(apiClient);
    }

    //Await for all clients to be initialized
    await Promise.all(this.api.map(client => client.login()));
  }

  /**
   * Ensures that the specified user has not exhausted their total amount of queries
   * available through the Project Sekai api.
   * @param {string} userId the ID of the account accessing the client
   * @return {boolean} True if the user is not rate limited, false if they are
   */
  checkRateLimit(userId) {
    if (!(userId in this.rateLimit) || 
      this.rateLimit[userId].timestamp < Date.now()) {
      this.rateLimit[userId] = {
        timestamp: Date.now() + 3600000,
        usage: 0
      };
    }

    if (this.rateLimit[userId].usage + 1 > RATE_LIMIT) {
      return false;
    } 

    this.rateLimit[userId].usage++;
    return true;
  }

  /**
   * Obtains the time when a user's rate limit counter will reset
   * @param {string} userId the ID of the account accessing the client
   * @return {Integer} timestamp in epochsecond when the rate limit will reset
   */
  getRateLimitRemoval(userId) {
    return this.rateLimit[userId].timestamp;
  }

  /**
   * Adds a standard user request to the Queue of Project Sekai Requests
   * @param {string} type the type of request to be added (profile or ranking)
   * @param {Object} params the parameters provided for the request
   * @param {Function} callback a callback to run on successful query of information
   * @param {Function} error an error function to be run if there was an issue
   */
  async addSekaiRequest(type, params, callback, error) {
    this.apiQueue.unshift({
      type: type,
      params: params,
      callback: callback,
      error: error
    });
  }

  /**
   * Adds a priority request to the Queue of Project Sekai Requests (reserved for bot's tracking feature)
   * @param {string} type the type of request to be added (profile or ranking)
   * @param {Object} params the parameters provided for the request
   * @param {Function} callback a callback to run on successful query of information
   * @param {Function} error an error function to be run if there was an issue
   */
  async addPrioritySekaiRequest(type, params, callback, error) {
    this.priorityApiQueue.unshift({
      type: type,
      params: params,
      callback: callback,
      error: error
    });
  }

  /**
   * Enables the clients to begin async running the requests inside the queue
   * @param {Integer} rate the rate that a Sekai Client will check the queue for a request (if idle)
   */
  async runSekaiRequests(rate=10) {
    const runRequest = async (apiClient, request) => {
      // Profile disabled as of now
      if (request.type === 'profile') {
        const response = await apiClient.userProfile(request.params.userId);

        // If our response is valid we run the callback
        if (response) {
          request.callback(response);
        }
      } else if (request.type === 'ranking') {

        let eventId = request.params.eventId || this.getCurrentEvent().id;
        if (eventId === -1) {
          request.error('No event is currently running');
          return;
        }
        const response = await apiClient.eventRankingT100(eventId);

        // If our response is valid we run the callback
        if (response) {
          request.callback(response);
        }
      } else if (request.type === 'master') {
        const response = await apiClient.master();

        if (response) {
          request.callback(response);
        }
      }
      return runClient(apiClient, rate);
    };

    const runClient = async (apiClient, rate) => {
      // console.log(`prioq: ${this.priorityApiQueue.length}, q: ${this.apiQueue.length}`)
      if (this.priorityApiQueue.length > 0) {
        runRequest(apiClient, this.priorityApiQueue.pop());
      } else if (this.apiQueue.length > 0) {
        runRequest(apiClient, this.apiQueue.pop());
      } else {
        setTimeout(() => {runClient(apiClient, rate);}, rate);
      }
    };

    this.api.forEach((apiClient) => {
      runClient(apiClient, rate);
    });
  }

  /**
   * Returns data of the event that is currently taking place
   * @return {Object} event data of the event that is currently taking place
   */
  getCurrentEvent() {
    const events = JSON.parse(fs.readFileSync('./sekai_master/events.json'));
    const currentTime = Date.now();

    for (let i = 0; i < events.length; i++) {
      if (events[i].startAt <= currentTime && events[i].closedAt >= currentTime) {
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
  }

  getWorldLink() {
    let worldLink = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json'));
    let eventId = this.getCurrentEvent().id;
    worldLink = worldLink.filter((x) => x.eventId === eventId);

    let idx = -1;
    let currentTime = Date.now();

    worldLink.forEach((x, i) => {
      if (x.chapterEndAt >= currentTime && x.chapterStartAt <= currentTime) {
        idx = i;
      }
    });

    if (idx == -1) {
      return -1;
    }
    else {
      return worldLink[idx];
    }
  }

  getAllWorldLinkChapters(eventId = null) {
    let worldLink = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json'));
    let currentTime = Date.now();
    if (eventId === null) {
      worldLink = worldLink.filter((x) => x.chapterStartAt <= currentTime);
    } else {
      worldLink = worldLink.filter((x) => x.eventId === eventId);
    }
    

    worldLink.forEach((x) => {
      x.character = `${this.getCharacterName(x.gameCharacterId)} (Event ${x.eventId})`;
    });

    return worldLink;
  }

  getCharacterName(characterId) {
    const gameCharacters = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json'));
    const charInfo = gameCharacters[characterId - 1];
    return `${charInfo.givenName} ${charInfo.firstName}`.trim();
  }

  /**
   * Logs into the Discord Bot using the provided token
   */
  async login() {
    await this.client.login(this.token);
  }
}

module.exports = DiscordClient;