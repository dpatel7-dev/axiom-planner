const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection pool — uses DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize DB: run schema.sql on startup
async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(schema);
    console.log('✓ Database schema ready');
  } catch (err) {
    console.error('Database init error:', err);
    throw err;
  }
}

module.exports = { pool, initDb };
