import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mysql = require('mysql2/promise')
const mysqlRaw = require('mysql2')
const dotenv = require('dotenv')
const { runMigrations } = require(path.join(process.cwd(), 'api', 'migrations.js'))

dotenv.config({ path: path.join(process.cwd(), '.env') })

const databaseName = `own_web_migration_${process.pid}_${Date.now()}_${randomBytes(4).toString('hex')}`
const port = 37000 + Math.floor(Math.random() * 1000)
const origin = `http://127.0.0.1:${port}`
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
}
const scopedDbConfig = { ...dbConfig, database: databaseName }
const authSecret = process.env.AUTH_SECRET || 'phase-b-migration-only-secret'
let databaseCreated = false

function assertDatabaseConfig() {
  assert.ok(dbConfig.user, 'DB_USER is required for the migration test')
  assert.ok(dbConfig.password, 'DB_PASSWORD is required for the migration test')
}

async function createTemporaryDatabase() {
  const connection = await mysql.createConnection(dbConfig)
  try {
    // This is the only DDL issued by this test. Business tables are created by
    // the normal Express bootstrap, which invokes api/migrations.js.
    await connection.query(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    databaseCreated = true
  } finally {
    await connection.end()
  }
}

async function dropTemporaryDatabase() {
  if (!databaseCreated) return
  const connection = await mysql.createConnection(dbConfig)
  try {
    await connection.query(`DROP DATABASE \`${databaseName}\``)
  } finally {
    await connection.end()
  }
}

function serverEnvironment() {
  return {
    ...process.env,
    NODE_ENV: 'test',
    DB_HOST: dbConfig.host,
    DB_PORT: String(dbConfig.port),
    DB_USER: dbConfig.user,
    DB_PASSWORD: dbConfig.password,
    DB_NAME: databaseName,
    AUTH_SECRET: authSecret,
    PORT: String(port),
    CORS_ORIGIN: origin,
    SITE_OWNER_USER_ID: '',
    ADMIN_EMAILS: '',
    TEST_AUTH_RATE_LIMIT_SCALE: '10',
  }
}

async function waitForApi(child: ChildProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Express exited before migration smoke was ready (code ${child.exitCode})`)
    }
    try {
      const response = await fetch(`${origin}/api/health`)
      if (response.ok) return
    } catch (_) {
      // The child is still creating its base schema and applying migrations.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Express migration smoke did not start')
}

async function stopServer(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

async function assertMigrationSchema() {
  const connection = await mysql.createConnection(scopedDbConfig)
  try {
    const [tables] = await connection.query(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('projects', 'series')
       ORDER BY TABLE_NAME`,
    )
    assert.deepEqual(
      tables.map((row: { TABLE_NAME: string }) => row.TABLE_NAME),
      ['projects', 'series'],
    )

    const [columns] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'posts' AND COLUMN_NAME IN ('series_id', 'series_order'))
           OR (TABLE_NAME IN ('projects', 'series') AND COLUMN_NAME = 'owner_id'))
       ORDER BY TABLE_NAME, COLUMN_NAME`,
    )
    type ColumnRow = { TABLE_NAME: string; COLUMN_NAME: string; IS_NULLABLE: string; DATA_TYPE: string }
    const columnMap = new Map<string, ColumnRow>(
      columns.map((row: ColumnRow): [string, ColumnRow] => [
        `${row.TABLE_NAME}.${row.COLUMN_NAME}`,
        row,
      ]),
    )
    for (const name of ['projects.owner_id', 'series.owner_id', 'posts.series_id', 'posts.series_order']) {
      assert.ok(columnMap.has(name), `missing migrated column ${name}`)
    }
    assert.equal(columnMap.get('posts.series_id')?.IS_NULLABLE, 'YES')
    assert.equal(columnMap.get('posts.series_id')?.DATA_TYPE, 'bigint')
    assert.equal(columnMap.get('posts.series_order')?.IS_NULLABLE, 'YES')
    assert.equal(columnMap.get('posts.series_order')?.DATA_TYPE, 'int')

    const [indexes] = await connection.query(
      `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'projects' AND INDEX_NAME IN ('unique_project_slug', 'idx_projects_owner_featured'))
           OR (TABLE_NAME = 'series' AND INDEX_NAME IN ('unique_series_slug', 'idx_series_owner_order'))
           OR (TABLE_NAME = 'posts' AND INDEX_NAME IN ('idx_posts_series_order', 'idx_posts_featured')))
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    )
    const expectedIndexes = new Map([
      ['projects.unique_project_slug', ['slug']],
      ['projects.idx_projects_owner_featured', ['owner_id', 'featured', 'sort_order', 'id']],
      ['series.unique_series_slug', ['slug']],
      ['series.idx_series_owner_order', ['owner_id', 'sort_order', 'id']],
      ['posts.idx_posts_series_order', ['series_id', 'series_order', 'published_at', 'id']],
      ['posts.idx_posts_featured', ['featured', 'featured_order', 'published_at', 'id']],
    ])
    for (const [key, expectedColumns] of expectedIndexes) {
      const [table, index] = key.split('.')
      const rows = indexes
        .filter((row: { TABLE_NAME: string; INDEX_NAME: string }) => row.TABLE_NAME === table && row.INDEX_NAME === index)
        .sort((left: { SEQ_IN_INDEX: number }, right: { SEQ_IN_INDEX: number }) => left.SEQ_IN_INDEX - right.SEQ_IN_INDEX)
      assert.deepEqual(rows.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME), expectedColumns, `index ${key}`)
      if (index.startsWith('unique_')) assert.equal(rows[0]?.NON_UNIQUE, 0, `index ${key} must be unique`)
    }

    const [foreignKeys] = await connection.query(
      `SELECT kcu.CONSTRAINT_NAME, kcu.TABLE_NAME, kcu.COLUMN_NAME,
              kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, rc.DELETE_RULE
       FROM information_schema.KEY_COLUMN_USAGE kcu
       JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
         ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
        AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME = kcu.TABLE_NAME
       WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
         AND kcu.TABLE_NAME IN ('projects', 'series', 'posts')
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`,
    )
    const expectForeignKey = (
      table: string,
      column: string,
      referencedTable: string,
      deleteRule: string,
      constraintName?: string,
    ) => {
      const row = foreignKeys.find(
        (candidate: { TABLE_NAME: string; COLUMN_NAME: string }) => candidate.TABLE_NAME === table && candidate.COLUMN_NAME === column,
      )
      assert.ok(row, `missing foreign key ${table}.${column}`)
      assert.equal(row.REFERENCED_TABLE_NAME, referencedTable)
      assert.equal(row.REFERENCED_COLUMN_NAME, 'id')
      assert.equal(row.DELETE_RULE, deleteRule)
      if (constraintName) assert.equal(row.CONSTRAINT_NAME, constraintName)
    }
    expectForeignKey('projects', 'owner_id', 'users', 'CASCADE')
    expectForeignKey('series', 'owner_id', 'users', 'CASCADE')
    expectForeignKey('posts', 'series_id', 'series', 'SET NULL', 'fk_posts_series')

    const [sentinel] = await connection.query(
      'SELECT id FROM schema_migrations WHERE id = ?',
      ['20260830_personal_site_v1'],
    )
    assert.equal(sentinel.length, 1, 'personal-site migration sentinel was not recorded')
  } finally {
    await connection.end()
  }
}

async function main() {
  assertDatabaseConfig()
  let child: ChildProcess | undefined
  try {
    await createTemporaryDatabase()

    // The regular server bootstrap creates its legacy prerequisites and calls
    // runMigrations. The test deliberately contains no business-table DDL.
    child = spawn(process.execPath, [path.join(process.cwd(), 'api', 'server.js')], {
      stdio: 'inherit',
      env: serverEnvironment(),
    })
    await waitForApi(child)
    const projectsResponse = await fetch(`${origin}/api/public/projects`)
    assert.equal(projectsResponse.status, 200)
    assert.deepEqual((await projectsResponse.json()).items, [])
    const missingSeriesResponse = await fetch(`${origin}/api/public/series/migration-smoke-missing`)
    assert.equal(missingSeriesResponse.status, 404)
    await stopServer(child)
    child = undefined

    // Call the migration entry point directly as an idempotence check against
    // the same unique database before inspecting the resulting schema.
    const connection = mysqlRaw.createConnection(scopedDbConfig)
    try {
      await runMigrations(connection)
      await runMigrations(connection)
    } finally {
      await connection.promise().end()
    }
    await assertMigrationSchema()
    console.log(`sixth-pass migration checks passed on ${databaseName}`)
  } finally {
    await stopServer(child)
    await dropTemporaryDatabase()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
