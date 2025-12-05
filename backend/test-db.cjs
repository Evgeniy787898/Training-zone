require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

console.log('Testing connection to:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

async function test() {
    try {
        await client.connect();
        console.log('✅ Connection successful!');
        const res = await client.query('SELECT NOW()');
        console.log('Time from DB:', res.rows[0].now);
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err);
        process.exit(1);
    }
}

test();
