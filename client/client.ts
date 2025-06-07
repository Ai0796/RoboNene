// client/client.ts
/**
 * @fileoverview The main class that handles a majority of the discord.js
 * and project sekai interactions between the command layer & app layer.
 * @author Potor10
 */

import { token, secretKey } from '../config'; // Import from TS config
import { Client, GatewayIntentBits, Events, Collection, Message, Guild } from 'discord.js';
import { SekaiClient } from 'sekapi';
import { RATE_LIMIT } from '../constants';

const winston = require('winston'); // Importing the winston logger for logging
const Database = require('better-sqlite3-multiple-ciphers'); // Importing the Database class from better-sqlite3-multiple-ciphers
type DatabaseType = InstanceType<typeof Database>;
import { AceBase, AceBaseLocalSettings } from 'acebase';

import * as fs from 'fs';
import * as path from 'path';
import { CommandInfo } from './methods/generateSlashCommand'; // Import CommandInfo interface
import getEventData from './methods/getEventData'; // Import getEventData

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

interface RateLimitInfo {
  timestamp: number;
  usage: number;
}

interface SekaiRequest {
  type: 'profile' | 'ranking' | 'border' | 'master';
  params: any; // More specific types can be added here
  callback: (response: any) => void;
  error: (err: any) => void;
}

/**
 * A client designed to interface discord.js requests and provide
 * integration into the custom Project Sekai API designed for this project
 */
class DiscordClient {
  token: string;
  commands: { data: CommandInfo; execute: Function; autocomplete?: Function; modalSubmit?: Function; adminOnly?: boolean; requiresLink?: boolean }[];
  logger: winston.Logger | null;
  db: DatabaseType | null;
  cutoffdb: DatabaseType | null;
  prayerdb: DatabaseType | null;
  stockdb: AceBase | null;

  prefix: string;
  changePlayers: string;

  api: SekaiClient[];
  priorityApiQueue: SekaiRequest[];
  apiQueue: SekaiRequest[];

  rateLimit: { [userId: string]: RateLimitInfo };
  cutoffCache: { response: any; timestamp: number } | null;

  client: Client;

  constructor(tk: string = token) {
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
    this.cutoffCache = null;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent, // Needed for message based commands
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

      if (message.content.length === 5 && !isNaN(Number(message.content))) {
        // Dynamic import of rm.ts
        const rmCommand = await import(`${CLIENT_CONSTANTS.CMD_DIR}/rm.ts`);
        rmCommand.promptExecuteMessage(message, this);
      }
      else if (message.content.length === 2 && message.content.startsWith(this.changePlayers) &&
        !isNaN(Number(message.content[1]))) {
        const rmCommand = await import(`${CLIENT_CONSTANTS.CMD_DIR}/rm.ts`);
        rmCommand.promptExecuteMessage(message, this);
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
        const magicGhostNeneCommand = await import(`${CLIENT_CONSTANTS.CMD_DIR}/magicghostnene.ts`);
        this.logger?.info(`Magic Ghostnene command called by ${message.author.username}`);
        magicGhostNeneCommand.executeMessage(message, this);
      }
      if (!message.content.startsWith(this.prefix)) return;
      let commandArgs = message.content.slice(this.prefix.length).split(/ +/);
      const commandName = commandArgs[0];
      this.logger?.info(`Command ${commandName} called by ${message.author.username}`);

      if (commandName === 'rm') {
        const rmCommand = await import(`${CLIENT_CONSTANTS.CMD_DIR}/rm.ts`);
        rmCommand.executeMessage(message, this);
      } else if (commandName === 'pray') {
        const prayCommand = await import(`${CLIENT_CONSTANTS.CMD_DIR}/pray.ts`);
        prayCommand.executeMessage(message, this);
      }
    });
  }

  loadServerHandler() {
    this.client.on(Events.GuildCreate, async (guild: Guild) => {
      this.logger?.log({
        level: 'join',
        message: `Added to Guild: ${guild.name} Id: ${guild.id} Member Count: ${guild.memberCount} Total Guilds: ${this.client.guilds.cache.size} Timestamp: ${new Date().toUTCString()}`
      });
    });
  }

  /**
   * Loads the commands code into the bot via a provided directory
   * @param {string} dir the directory containing the code for the commands
   */
  loadCommands(dir: string = CLIENT_CONSTANTS.CMD_DIR) {
    // Parse commands
    const commandFiles = fs.readdirSync(dir).filter(file => file.endsWith('.ts') || file.endsWith('.js')); // Look for .ts and .js

    for (const file of commandFiles) {
      // Dynamic import
      const commandPath = `${dir}/${file}`;
      import(commandPath).then(module => {
        const command = module.default || module; // Handle both default and named exports
        if (command.INFO && (command.data === null || command.data === undefined)) {
          // This check is for command data being built by generateSlashCommand, which might be in the command file itself
          // For now, allow it to be undefined if it's generated later.
          // console.warn(`Command ${file} does not have a data object, Skipping Load.`);
          // continue;
        }
        if (command.data && command.data.name) {
          console.log(`Loaded command ${command.data.name} from ${file}`);
          this.commands.push(command);
        } else if (command.INFO && command.INFO.name) { // For commands that define INFO but not 'data' directly in the file
          console.log(`Loaded command ${command.INFO.name} (info object) from ${file}`);
          this.commands.push(command);
        } else {
          console.warn(`Could not load command from ${file}: Missing INFO or data.name`);
        }
      }).catch(error => {
        console.error(`Error loading command from ${file}:`, error);
      });
    }
  }

  /**
   * Loads the event handlers into the bot via a provided directory
   * @param {string} dir the directory containing the code for the event handlers
   */
  loadEvents(dir: string = CLIENT_CONSTANTS.EVENT_DIR) {
    // Parse events
    const eventFiles = fs.readdirSync(dir).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of eventFiles) {
      const eventPath = `${dir}/${file}`;
      import(eventPath).then(module => {
        const event = module.default || module;
        if (event.once) {
          this.client.once(event.name, (...args) => event.execute(...args));
        } else {
          this.client.on(event.name, (...args) => event.execute(...args, this));
        }
      }).catch(error => {
        console.error(`Error loading event from ${file}:`, error);
      });
    }
  }

  /**
   * Starts the logger designed to query application usage
   * Also, enables capture of errors within the code to be sent to the log
   * file in production.
   * @param {string} dir the directory containing the log files
   */
  loadLogger(dir: string = CLIENT_CONSTANTS.LOG_DIR) {
    // Create log directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

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
      this.logger?.log({ // Optional chaining for logger
        level: 'error',
        message: `A websocket connection encountered an error: ${error}`
      });
    });

    /* Uncomment this in production
    process.on('unhandledRejection', error => {
      this.logger?.log({ // Optional chaining for logger
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
  loadDb(dir: string = CLIENT_CONSTANTS.DB_DIR) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(`${dir}/${CLIENT_CONSTANTS.DB_NAME}`);

    // Read an encrypted database
    this.db.pragma(`key='${secretKey}'`);
    this.db.pragma('journal_mode = DELETE');

    this.db.prepare('CREATE TABLE IF NOT EXISTS users ' +
      '(id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT UNIQUE, sekai_id TEXT UNIQUE, private INTEGER DEFAULT 1, ' + // Added AUTOINCREMENT and UNIQUE
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
    this.db?.close(); // Optional chaining for db
  }

  /**
   * Initializes the user databases (if it does not already exist) and loads
   * the databases for usage.
   * @param {string} dir the directory containing the encrypted databases
   */
  loadCutoffDb(dir: string = CLIENT_CONSTANTS.CUTOFF_DB_DIR) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.cutoffdb = new Database(`${dir}/${CLIENT_CONSTANTS.CUTOFF_DB_NAME}`);

    // Read an encrypted database
    this.cutoffdb.pragma(`key='${secretKey}'`);
    this.cutoffdb.pragma('journal_mode = DELETE');

    // Initialize the tracking database instance
    this.cutoffdb.prepare('CREATE TABLE IF NOT EXISTS cutoffs ' +
      '(EventID INTEGER, Tier INTEGER, Timestamp INTEGER, Score INTEGER, ID TEXT, GameNum INTEGER, ' + // Changed ID to TEXT for consistency with Discord/Sekai IDs
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
      '(id TEXT, Tier INTEGER, EventID INTEGER,' + // Changed ID to TEXT
      'Timestamp INTEGER, Score INTEGER,' +
      'PRIMARY KEY(id, EventID, Timestamp))').run();
  }

  /**
   * Initializes the prayer databases (if it does not already exist) and loads
   * the databases for usage.
   */
  loadPrayerDb(dir: string = CLIENT_CONSTANTS.PRAYER_DB_DIR) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.prayerdb = new Database(`${dir}/${CLIENT_CONSTANTS.PRAYER_DB_NAME}`);

    // Read an encrypted database
    this.prayerdb.pragma(`key='${secretKey}'`);
    this.prayerdb.pragma('journal_mode = DELETE');

    // Initialize the prayer database table
    this.prayerdb.prepare('CREATE TABLE IF NOT EXISTS prayers ' +
      '(id TEXT PRIMARY KEY, luck REAL, prays INTEGER, lastTimestamp INTEGER, totalLuck REAL)').run();

    // Migrate old prayers.json if it exists
    if (fs.existsSync('prayers.json')) {
      const data: any[] = JSON.parse(fs.readFileSync('prayers.json', 'utf8'));

      data.forEach((prayer) => {
        const result = this.prayerdb?.prepare('SELECT * FROM prayers WHERE id = ?').get(prayer.id);
        if (result && (result as any).luck > prayer.luck) return; // Type assertion for result

        this.prayerdb?.prepare('INSERT OR REPLACE INTO prayers (id, luck, prays, lastTimestamp, totalLuck) ' +
          'VALUES (@id, @luck, @prays, @lastTimestamp, @totalLuck)').run({
            id: prayer.id,
            luck: prayer.luck * 1.0,
            prays: prayer.prays,
            lastTimestamp: prayer.lastTimestamp,
            totalLuck: prayer.totalLuck * 1.0,
          });
      });
      // Optionally, delete the old file after migration
      // fs.unlinkSync('prayers.json');
    }
  }

  /**
   * Initializes the Stock AceBase NoSQL database (if it does not already exist) and loads
   * the databases for usage.
   */
  async loadStockDb(dir: string = CLIENT_CONSTANTS.STOCK_DB_DIR) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const options: AceBaseLocalSettings = { storage: { path: dir } };
    this.stockdb = new AceBase(`${CLIENT_CONSTANTS.STOCK_DB_NAME}`, options);

    await this.stockdb.ready();
  }

  /**
   *
   * @param {string} discord_id users discord ID
   * @returns {number} users unique database ID
   */
  getId(discord_id: string): number {
    const data = this.db?.prepare('SELECT * FROM users ' +
      'WHERE (discord_id=@discord_id)').all({
        discord_id: discord_id,
      }) as { id: number }[]; // Type assertion for DB result

    if (data && data.length > 0) {
      return data[0].id;
    } else {
      return -1;
    }
  }

  /**
   * Starts up the Project Sekai Client used to communicate to the game servers
   * @param {string} dir the directory containing the Project Sekai player data
   */
  async loadSekaiClient(dir: string = CLIENT_CONSTANTS.PREFS_DIR) {
    // Parse clients
    const apiPrefs = fs.readdirSync(dir).filter(file => file.endsWith('.js')); // Assuming prefs are still .js

    for (const file of apiPrefs) {
      const playerPrefs = require(`${dir}/${file}`); // Dynamic import
      console.log(`Loaded client ${playerPrefs.account_install_id} from ${file}`);

      // Sekai Api Init
      const apiClient = new SekaiClient(playerPrefs);
      this.api.push(apiClient);
    }

    // Await for all clients to be initialized
    await Promise.all(this.api.map(client => client.login()));
  }

  /**
   * Ensures that the specified user has not exhausted their total amount of queries
   * available through the Project Sekai api.
   * @param {string} userId the ID of the account accessing the client
   * @return {boolean} True if the user is not rate limited, false if they are
   */
  checkRateLimit(userId: string): boolean {
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
   * @return {number} timestamp in epochsecond when the rate limit will reset
   */
  getRateLimitRemoval(userId: string): number {
    return this.rateLimit[userId].timestamp;
  }

  /**
   * Adds a standard user request to the Queue of Project Sekai Requests
   * @param {string} type the type of request to be added (profile or ranking)
   * @param {Object} params the parameters provided for the request
   * @param {Function} callback a callback to run on successful query of information
   * @param {Function} error an error function to be run if there was an issue
   */
  async addSekaiRequest(type: 'profile' | 'ranking' | 'border' | 'master', params: any, callback: (response: any) => void, error: (err: any) => void) {
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
  async addPrioritySekaiRequest(type: 'profile' | 'ranking' | 'border' | 'master', params: any, callback: (response: any) => void, error: (err: any) => void) {
    this.priorityApiQueue.unshift({
      type: type,
      params: params,
      callback: callback,
      error: error
    });
  }

  /**
   * Enables the clients to begin async running the requests inside the queue
   * @param {number} rate the rate that a Sekai Client will check the queue for a request (if idle)
   */
  async runSekaiRequests(rate: number = 10) {
    const runRequest = async (apiClient: SekaiClient, request: SekaiRequest) => {
      // Profile disabled as of now
      if (request.type === 'profile') {
        const response = await apiClient.userProfile(request.params.userId);

        // If our response is valid we run the callback
        if (response) {
          request.callback(response);
        }
      } else if (request.type === 'ranking') {

        const eventId = request.params.eventId || this.getCurrentEvent().id;
        if (eventId === -1) {
          request.error(new Error('No event is currently running'));
          return;
        }
        const response = await apiClient.eventRankingT100(eventId, request.params.targetRank, request.params.lowerLimit, request.params.higherLimit); // Added other params

        // If our response is valid we run the callback
        if (response) {
          request.callback(response);

          if (response.rankings && response.rankings.length !== 0) {
            console.log('Saving Cache at ' + Date.now().toString());
            this.cutoffCache = { response: response, timestamp: Date.now() }; // Update the cache to be used by leaderboard
          }
        }
      } else if (request.type === 'border') {
        const eventId = request.params.eventId || this.getCurrentEvent().id;
        if (eventId === -1) {
          request.error(new Error('No event is currently running'));
          return;
        }
        const response = await apiClient.eventRankingCutoffs(eventId);

        if (response) {
          request.callback(response);
        }
      }
      else if (request.type === 'master') {
        const response = await apiClient.master();

        if (response) {
          request.callback(response);
        }
      }
      return runClient(apiClient, rate);
    };

    const runClient = async (apiClient: SekaiClient, rate: number) => {
      // console.log(`prioq: ${this.priorityApiQueue.length}, q: ${this.apiQueue.length}`)
      if (this.priorityApiQueue.length > 0) {
        runRequest(apiClient, this.priorityApiQueue.pop() as SekaiRequest); // Type assertion, should be safe given unshift
      } else if (this.apiQueue.length > 0) {
        runRequest(apiClient, this.apiQueue.pop() as SekaiRequest); // Type assertion
      } else {
        setTimeout(() => { runClient(apiClient, rate); }, rate);
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
  getCurrentEvent(): { id: number; banner: string; name: string; startAt: number; aggregateAt: number; closedAt: number; eventType: string; assetbundleName: string } {
    const events: any[] = JSON.parse(fs.readFileSync('./sekai_master/events.json', 'utf8')); // Type as any for simplicity

    const currentTime = Date.now();

    for (let i = 0; i < events.length; i++) {
      if (events[i].startAt <= currentTime && events[i].closedAt >= currentTime) {
        return {
          id: events[i].id,
          banner: 'https://storage.sekai.best/sekai-en-assets/event/' +
            `${events[i].assetbundleName}/logo/logo.webp`,
          name: events[i].name,
          startAt: events[i].startAt,
          aggregateAt: events[i].aggregateAt,
          closedAt: events[i].closedAt,
          eventType: events[i].eventType,
          assetbundleName: events[i].assetbundleName
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
      assetbundleName: ''
    };
  }

  getWorldLink(): any { // Using any for simplicity for now
    const worldLink: any[] = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json', 'utf8'));
    const eventId = this.getCurrentEvent().id;
    const filteredWorldLink = worldLink.filter((x) => x.eventId === eventId);

    let idx = -1;
    const currentTime = Date.now();

    filteredWorldLink.forEach((x, i) => {
      if (x.chapterEndAt >= currentTime && x.chapterStartAt <= currentTime) {
        idx = i;
      }
    });

    if (idx == -1) {
      return -1;
    }
    else {
      return filteredWorldLink[idx];
    }
  }

  getAllWorldLinkChapters(eventId: number | null = null): any[] { // Using any for simplicity for now
    let worldLink: any[] = JSON.parse(fs.readFileSync('./sekai_master/worldBlooms.json', 'utf8'));
    const currentTime = Date.now();
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

  getCharacterName(characterId: number): string {
    const gameCharacters: any[] = JSON.parse(fs.readFileSync('./sekai_master/gameCharacters.json', 'utf8')); // Type as any for simplicity
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

export default DiscordClient;