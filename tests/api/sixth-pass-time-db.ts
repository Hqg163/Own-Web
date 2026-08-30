import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const mysql = require('mysql2')
const dotenv = require('dotenv')
const { installUtcPool } = require(path.join(process.cwd(), 'api', 'lib', 'utc-pool.js'))
const { config, databaseName, ensureDatabase } = require('../support/test-db.cjs')

dotenv.config({ path: path.join(process.cwd(), '.env') })

function getConnection(pool: any): Promise<any> {
  return new Promise((resolve, reject) => pool.getConnection((error: unknown, connection: any) => error ? reject(error) : resolve(connection)))
}

async function main() {
  await ensureDatabase()
  const pool = installUtcPool(mysql.createPool({ ...config, database: databaseName, timezone: 'Z', connectionLimit: 2 }))
  try {
    for (let index = 0; index < 4; index += 1) {
      const connection = await getConnection(pool)
      try {
        const [rows] = await connection.promise().query('SELECT @@session.time_zone AS time_zone')
        assert.equal(rows[0]?.time_zone, '+00:00')
      } finally {
        connection.release()
      }
    }
    console.log('sixth-pass database UTC session checks passed')
  } finally {
    await pool.promise().end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
