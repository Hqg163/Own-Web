const mysql = require('mysql2/promise');
const { config, databaseName } = require('./test-db.cjs');

module.exports = async function cleanup() {
  const connection = await mysql.createConnection({ ...config, database:databaseName });
  await connection.query("DELETE FROM users WHERE email LIKE '%@own-web.test'");
  await connection.end();
};
