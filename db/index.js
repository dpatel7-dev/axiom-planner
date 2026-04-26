const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection pool — uses DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize DB: run schema.sql on startup.
// We split the schema into its three commented sections (TABLES, MIGRATIONS, INDEXES)
// and run each as its own statement-block. This way:
//   - if MIGRATIONS fails, TABLES are still created
//   - if INDEXES fails, MIGRATIONS still ran
// Each section uses IF NOT EXISTS / IF EXISTS so all are idempotent.
async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split on the section markers from schema.sql
  const sections = schema.split(/-- =+\n-- \d+\. /);
  // Phase 0 is the file header; phases 1+ are the real work.
  // Each section after the regex looks like:
  //   "CREATE TABLES (no-ops if they already exist)\n<sql>"
  // So we extract the first line as the human-readable name, and run the rest as SQL.
  const phases = sections.slice(1).map((s, i) => {
    const newlineIdx = s.indexOf('\n');
    const name = newlineIdx === -1
      ? `Phase ${i + 1}`
      : s.slice(0, newlineIdx).replace(/—.*$/, '').trim() || `Phase ${i + 1}`;
    const sql = newlineIdx === -1 ? '' : s.slice(newlineIdx + 1);
    return { name, sql };
  });

  if (phases.length === 0) {
    // Fallback: schema didn't have section markers, run it as one block
    await pool.query(schema);
    console.log('✓ Database schema ready');
    return;
  }

  for (const phase of phases) {
    try {
      await pool.query(phase.sql);
      console.log(`  ✓ ${phase.name}`);
    } catch (err) {
      console.error(`  ✗ ${phase.name}:`, err.message);
      throw err;
    }
  }
  console.log('✓ Database schema ready');
}

module.exports = { pool, initDb };
