const { Pool } =  require('pg');
const { PG_Key } = require('../config.json');
const format = require('pg-format');


class pgClient {
    constructor() {
        this.client = new Pool({
            user: 'nenerobo_user',
            host: 'localhost',
            database: 'nenerobo_db',
            password: PG_Key,
            port: 5432,
            max: 20,
            idleTimeoutMillis: 30000,
        });

        this.idCache = new Map();
        this.MAX_CACHE_SIZE = 1000;

        this.client.on('error', (err) => {
            console.error('Unexpected error on idle PostgreSQL client', err);
        });
    }

    async connect() {
        try {
            await this.client.connect();
            console.log('Connected to PostgreSQL database');
        } catch (err) {
            console.error('Error connecting to PostgreSQL database:', err);
        }
    }

    async query(queryText, params) {
        try {
            const res = await this.client.query(queryText, params);
            return res;
        } catch (err) {
            console.error('Error executing query:', err);
            throw err;
        }
    }

    async disconnect() {
        try {
            await this.client.end();
            console.log('Disconnected from PostgreSQL database');
        }
        catch (err) {
            console.error('Error disconnecting from PostgreSQL database:', err);
        }
    }

    // Helper to manage the cache size
    async _getInternalID(sekaiID, dbClient) {
        const dID = String(sekaiID);

        // 1. Check RAM Cache first
        if (this.idCache.has(dID)) {
            return this.idCache.get(dID);
        }

        // 2. Not in RAM, hit the DB (Upsert logic)
        const userRes = await dbClient.query(`
            INSERT INTO id_mapping (sekai_id) 
            VALUES ($1) 
            ON CONFLICT (sekai_id) DO UPDATE SET sekai_id = EXCLUDED.sekai_id
            RETURNING internal_id`, 
            [dID]
        );

        const internalID = userRes.rows[0].internal_id;

        // 3. Add to Cache and maintain size (Remove oldest entry if full)
        if (this.idCache.size >= this.MAX_CACHE_SIZE) {
            // Map keys are ordered by insertion; this removes the oldest
            const firstKey = this.idCache.keys().next().value;
            this.idCache.delete(firstKey);
        }
        this.idCache.set(dID, internalID);

        return internalID;
    }

    // Typical commands
    async insertTiers(values) {
        const dbClient = await this.client.connect(); 
        try {
            await dbClient.query('BEGIN');

            const processedValues = [];

            for (const row of values) {
                const [eventID, tier, timestamp, score, sekaiID, gameNum] = row;

                // Use the helper with caching
                const internalID = await this._getInternalID(sekaiID, dbClient);

                processedValues.push([eventID, tier, timestamp, score, internalID, gameNum]);
            }

            const queryText = format(
                'INSERT INTO cutoffs (event_id, tier, timestamp, score, user_id, game_num) VALUES %L', 
                processedValues
            );
            
            await dbClient.query(queryText);
            await dbClient.query('COMMIT');
        } catch (err) {
            await dbClient.query('ROLLBACK');
            throw err;
        } finally {
            dbClient.release(); 
        }
    }

    async selectTier(tier, eventID, limit=null) {
        const queryText = 'SELECT * FROM cutoffs WHERE Tier = $1 AND EventID = $2' + (limit !== null ? ' LIMIT $3' : '');
        const res = await this.client.query(queryText, limit !== null ? [tier, eventID, limit] : [tier, eventID]);
        return res.rows;
    }

    async selectTierDESC(tier, eventID, limit=null) {
        const queryText = 'SELECT * FROM cutoffs WHERE Tier = $1 AND EventID = $2 ORDER BY Score DESC' + (limit !== null ? ' LIMIT $3' : '');
        const res = await this.client.query(queryText, limit !== null ? [tier, eventID, limit] : [tier, eventID]);
        return res.rows;
    }

    async selectTimestamp(timestamp, eventID, limit=null) {
        const queryText = 'SELECT * FROM cutoffs WHERE Timestamp = $1 AND EventID = $2 DESC' + (limit !== null ? ' LIMIT $3' : '');
        const res = await this.client.query(queryText, limit !== null ? [timestamp, eventID, limit] : [timestamp, eventID]);
        return res.rows;
    }

    async selectUserID(eventID, sekaiID, limit = null) {
        let internalID = await this._getInternalID(sekaiID, this.client);
        if (!internalID) return [];
        
        const queryText = `SELECT * FROM cutoffs WHERE eventid = $1 AND id = $2 ${limit !== null ? 'LIMIT $3' : ''}`;
        const params = limit !== null ? [eventID, internalID, limit] : [eventID, internalID];
        const res = await this.client.query(queryText, params);
        return res.rows;
    }

    async selectUser(eventID, sekaiID, limit = null) {
        let internalID = await this._getInternalID(sekaiID, this.client);
        if (!internalID) return [];

        const queryText = `SELECT * FROM users WHERE eventid = $1 AND id = $2 ${limit !== null ? 'LIMIT $3' : ''}`;
        const params = limit !== null ? [eventID, internalID, limit] : [eventID, internalID];
        const res = await this.client.query(queryText, params);
        return res.rows;
    }
}

module.exports = {
  pgClient
};