// db.js
const { Pool } = require('pg');

// Replace with your actual PostgreSQL credentials
const pool = new Pool({
  user: 'postgres',           // your PostgreSQL username
  host: 'localhost',          // or your server address
  database: 'aniket',     // your database name
  password: 'pass@123',   // your PostgreSQL password
  port: 5432,                 // default PostgreSQL port
});

pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch((err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
    process.exit(1);
  });

module.exports = pool;
