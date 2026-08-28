const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
const databaseName = process.env.TEST_DB_NAME || 'own_web_test';
const config = { host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD };

async function ensureDatabase() {
  const connection = await mysql.createConnection(config);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
  return databaseName;
}

async function cleanupEmails(emails) {
  const connection = await mysql.createConnection({ ...config, database: databaseName });
  if (emails?.length) await connection.query(`DELETE FROM users WHERE email IN (${emails.map(() => '?').join(',')})`, emails);
  await connection.end();
}

module.exports = { databaseName, config, ensureDatabase, cleanupEmails };
