'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATION_LOCK_ID = 2_024_081_601;
const MIGRATIONS_DIRECTORY = path.resolve(__dirname, '..', 'migrations');
const MIGRATION_NAME_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;

async function run() {
  const client = new Client(databaseConfig());
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name varchar(255) PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const names = (await fs.readdir(MIGRATIONS_DIRECTORY))
      .filter((name) => MIGRATION_NAME_PATTERN.test(name))
      .sort();

    for (const name of names) {
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [name],
      );
      if (applied.rowCount > 0) continue;

      const sql = await fs.readFile(path.join(MIGRATIONS_DIRECTORY, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [name],
        );
        await client.query('COMMIT');
        console.log(`Applied migration ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    await client.end();
  }
}

function databaseConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sslCa = process.env.DATABASE_SSL_CA;
  if (isProduction && !sslCa) {
    throw new Error('DATABASE_SSL_CA is required in production');
  }

  const ssl = isProduction
    ? { ca: sslCa.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : false;
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres_dev',
    database: process.env.DATABASE_NAME || 'multiplayer_games',
    ssl,
  };
}

run().catch((error) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});