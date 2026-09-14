const mysql = require('mysql2/promise');
const { config, databaseName } = require('./test-db.cjs');

module.exports = async function cleanup() {
  const connection = await mysql.createConnection({ ...config, database:databaseName });
  try {
    // A test owner is deliberately allowed to publish public articles. Delete
    // those roots before the account so their cascades cannot leave public
    // fixture cards behind for the next visual run.
    await connection.query(`DELETE posts FROM posts
      INNER JOIN users ON users.id = posts.author_id
      WHERE users.email LIKE '%@own-web.test'`);
    await connection.query("DELETE FROM users WHERE email LIKE '%@own-web.test'");
  } finally {
    await connection.end();
  }
};
