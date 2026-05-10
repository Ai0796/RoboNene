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

        this.pool.on('error', (err) => {
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

    // Typical commands
    async insertTiers(values) {
        // 1. Checkout a dedicated connection
        const dbClient = await this.client.connect(); 
        try {
            await dbClient.query('BEGIN');
            
            // 2. Format and execute on that specific connection
            const queryText = format('INSERT INTO cutoffs (EventID, Tier, Timestamp, Score, ID, GameNum) VALUES %L', values);
            await dbClient.query(queryText);
            
            await dbClient.query('COMMIT');
        } catch (err) {
            await dbClient.query('ROLLBACK');
            console.error('Transaction failed:', err);
            throw err;
        } finally {
            // 3. Return the connection to the pool
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

    async selectUserID(eventID, userID, limit=null) {
        const queryText = 'SELECT * FROM cutoffs WHERE EventID = $1 AND ID = $2' + (limit !== null ? ' LIMIT $3' : '');
        const res = await this.client.query(queryText, limit !== null ? [eventID, userID, limit] : [eventID, userID]);
        return res.rows;
    }
}

module.exports = {
  pgClient
};