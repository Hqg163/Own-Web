/**
 * Keep the MySQL session timezone aligned with the application UTC contract
 * whenever a pooled connection is first acquired. mysql2's `timezone: 'Z'`
 * only controls client conversion; it does not set @@session.time_zone.
 */
function installUtcPool(pool) {
  const rawGetConnection = pool.getConnection.bind(pool);
  pool.getConnection = (callback) => rawGetConnection((connectionError, connection) => {
    if (connectionError) return callback(connectionError);
    if (connection.__ownWebUtc) return callback(null, connection);
    connection.query("SET SESSION time_zone = '+00:00'", (setTimezoneError) => {
      if (setTimezoneError) {
        connection.destroy();
        return callback(setTimezoneError);
      }
      connection.__ownWebUtc = true;
      return callback(null, connection);
    });
  });
  return pool;
}

module.exports = { installUtcPool };
