/*
  Create control-plane database using a LOCAL_DATABASE_URL (no db name).
  Usage:
    LOCAL_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/" \
    node scripts/create-control-db.js qodifynet
*/

const { Client } = require('pg')

async function main() {
  const dbName = (process.argv[2] || 'qodifynet').replace(/[^a-zA-Z0-9_]/g, '_')
  const baseUrl = process.env.LOCAL_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/'

  let host = 'localhost'
  let port = 5432
  let user = 'postgres'
  let password = 'postgres'

  try {
    const u = new URL(baseUrl)
    host = u.hostname || host
    port = Number(u.port || port)
    user = decodeURIComponent(u.username || user)
    password = decodeURIComponent(u.password || password)
  } catch (e) {
    // ignore malformed URL, fallback to defaults
  }

  const client = new Client({ host, port, user, password, database: 'postgres' })
  try {
    await client.connect()
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
    if (exists.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`)
      console.log(`✅ Database ${dbName} created`)
    } else {
      console.log(`ℹ️  Database ${dbName} already exists`)
    }
  } catch (err) {
    console.error('❌ Failed to create database:', err.message || err)
    process.exitCode = 1
  } finally {
    try { await client.end() } catch {}
  }
}

main()

