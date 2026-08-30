const crypto = require('crypto');

async function columnExists(db, table, column) {
  const [rows] = await db.promise().query(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumn(db, table, column, definition) {
  if (!await columnExists(db, table, column)) {
    await db.promise().query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }
}

async function runMigrations(db) {
  const query = db.promise().query.bind(db.promise());
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const [done] = await query('SELECT id FROM schema_migrations WHERE id = ?', ['20260826_blog_v1']);
  if (!done.length) {

  await addColumn(db, 'users', 'avatar_path', 'VARCHAR(500) NULL');
  await addColumn(db, 'users', 'bio', 'TEXT NULL');
  await addColumn(db, 'users', 'blog_title', 'VARCHAR(120) NULL');
  await addColumn(db, 'users', 'blog_slug', 'VARCHAR(50) NULL');
  await addColumn(db, 'users', 'social_links', 'JSON NULL');
  await addColumn(db, 'users', 'profile_visibility', "ENUM('public','private') NOT NULL DEFAULT 'public'");
  await query("UPDATE users SET blog_slug = CONCAT('u-', id) WHERE blog_slug IS NULL OR blog_slug = ''");
  const [slugIndexes] = await query("SHOW INDEX FROM users WHERE Key_name = 'unique_blog_slug'");
  if (!slugIndexes.length) await query('ALTER TABLE users ADD UNIQUE KEY unique_blog_slug (blog_slug)');

  await query(`CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL, slug VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_category_slug (slug)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(60) NOT NULL, slug VARCHAR(80) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_tag_slug (slug)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS posts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, author_id INT NOT NULL, title VARCHAR(180) NOT NULL,
    slug VARCHAR(180) NOT NULL, excerpt VARCHAR(500) NULL, content_markdown MEDIUMTEXT NOT NULL,
    content_html MEDIUMTEXT NOT NULL, cover_image VARCHAR(500) NULL,
    status ENUM('draft','published','scheduled','archived') NOT NULL DEFAULT 'draft',
    visibility ENUM('public','private','followers','unlisted') NOT NULL DEFAULT 'public',
    share_token CHAR(64) NULL, allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
    published_at DATETIME NULL, scheduled_at DATETIME NULL,
    view_count INT UNSIGNED NOT NULL DEFAULT 0, like_count INT UNSIGNED NOT NULL DEFAULT 0,
    bookmark_count INT UNSIGNED NOT NULL DEFAULT 0, comment_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_post_slug (slug), KEY idx_post_listing (status, visibility, published_at), KEY idx_author_posts (author_id, status, updated_at)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS post_categories (
    post_id BIGINT NOT NULL, category_id INT NOT NULL, PRIMARY KEY(post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  )`);
  await query(`CREATE TABLE IF NOT EXISTS post_tags (
    post_id BIGINT NOT NULL, tag_id INT NOT NULL, PRIMARY KEY(post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )`);
  await query(`CREATE TABLE IF NOT EXISTS post_revisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, post_id BIGINT NOT NULL, editor_id INT NOT NULL,
    title VARCHAR(180) NOT NULL, content_markdown MEDIUMTEXT NOT NULL, source ENUM('autosave','manual','publish') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE CASCADE, KEY idx_revision_post (post_id, created_at)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS post_likes (post_id BIGINT NOT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(post_id,user_id), FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await query(`CREATE TABLE IF NOT EXISTS post_bookmarks (post_id BIGINT NOT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(post_id,user_id), FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await query(`CREATE TABLE IF NOT EXISTS follows (follower_id INT NOT NULL, following_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(follower_id,following_id), FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(following_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await query(`CREATE TABLE IF NOT EXISTS comments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, post_id BIGINT NOT NULL, author_id INT NOT NULL, parent_id BIGINT NULL,
    content TEXT NOT NULL, deleted_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_id) REFERENCES comments(id) ON DELETE CASCADE, KEY idx_comment_post(post_id,created_at)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, recipient_id INT NOT NULL, actor_id INT NULL,
    type ENUM('follow','like','comment','reply') NOT NULL, post_id BIGINT NULL, comment_id BIGINT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    KEY idx_notification_recipient(recipient_id,is_read,created_at)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, reporter_id INT NOT NULL, post_id BIGINT NULL, comment_id BIGINT NULL,
    reason VARCHAR(80) NOT NULL, details TEXT NULL, status ENUM('pending','reviewed','dismissed') NOT NULL DEFAULT 'pending',
    reviewed_by INT NULL, reviewed_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE, FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
  )`);
  await query(`CREATE TABLE IF NOT EXISTS post_media (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, owner_id INT NOT NULL, post_id BIGINT NULL, file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL, alt_text VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL
  )`);
  for (const [name, slug] of [['技术','technology'],['学习','learning'],['生活','life'],['作品','work']]) {
    await query('INSERT IGNORE INTO categories (name, slug) VALUES (?, ?)', [name, slug]);
  }
    await query('INSERT INTO schema_migrations (id) VALUES (?)', ['20260826_blog_v1']);
  }

  // Keep migrations additive. Existing deployments have already recorded the
  // blog migration above, so later schema changes must never be hidden behind
  // that single sentinel.
  const [mediaEditorDone] = await query('SELECT id FROM schema_migrations WHERE id = ?', ['20260828_media_editor_v1']);
  if (!mediaEditorDone.length) {
    await addColumn(db, 'entertainment_music', 'lyrics_offset_ms', 'INT NOT NULL DEFAULT 0');
    await query('INSERT INTO schema_migrations (id) VALUES (?)', ['20260828_media_editor_v1']);
  }

  const [blocksDone] = await query('SELECT id FROM schema_migrations WHERE id = ?', ['20260828_blocks_editor_v1']);
  if (!blocksDone.length) {
    await addColumn(db, 'posts', 'content_format', "ENUM('markdown','blocks') NOT NULL DEFAULT 'markdown'");
    await addColumn(db, 'posts', 'content_blocks', 'JSON NULL');
    await addColumn(db, 'post_revisions', 'content_format', "ENUM('markdown','blocks') NOT NULL DEFAULT 'markdown'");
    await addColumn(db, 'post_revisions', 'content_blocks', 'JSON NULL');
    await addColumn(db, 'post_media', 'media_kind', "ENUM('image','audio','video','file') NOT NULL DEFAULT 'image'");
    await addColumn(db, 'post_media', 'label', 'VARCHAR(255) NULL');
    await addColumn(db, 'post_media', 'caption', 'VARCHAR(500) NULL');
    await addColumn(db, 'post_media', 'metadata', 'JSON NULL');
    await query('INSERT INTO schema_migrations (id) VALUES (?)', ['20260828_blocks_editor_v1']);
  }

  const [contentDone] = await query('SELECT id FROM schema_migrations WHERE id = ?', ['20260828_content_safety_v1']);
  if (!contentDone.length) {
    await addColumn(db, 'users', 'session_version', 'INT NOT NULL DEFAULT 0');
    await addColumn(db, 'users', 'session_revoked_at', 'DATETIME NULL');
    await addColumn(db, 'posts', 'content_version', 'INT NOT NULL DEFAULT 1');
    await addColumn(db, 'posts', 'content_source', "VARCHAR(32) NOT NULL DEFAULT 'editor'");
    await addColumn(db, 'posts', 'cover_alt_text', 'VARCHAR(255) NULL');
    await addColumn(db, 'post_revisions', 'content_version', 'INT NOT NULL DEFAULT 1');
    await addColumn(db, 'post_revisions', 'content_source', "VARCHAR(32) NOT NULL DEFAULT 'editor'");
    await query('INSERT INTO schema_migrations (id) VALUES (?)', ['20260828_content_safety_v1']);
  }

  const [commentsDone] = await query('SELECT id FROM schema_migrations WHERE id = ?', ['20260829_comments_v2']);
  if (!commentsDone.length) {
    await addColumn(db, 'users', 'deleted_at', 'DATETIME NULL');
    await addColumn(db, 'comments', 'root_comment_id', 'BIGINT NULL');
    await addColumn(db, 'comments', 'reply_to_comment_id', 'BIGINT NULL');
    await addColumn(db, 'comments', 'like_count', 'INT UNSIGNED NOT NULL DEFAULT 0');
    await query('UPDATE comments SET root_comment_id = CASE WHEN parent_id IS NULL THEN id ELSE parent_id END WHERE root_comment_id IS NULL');
    await query('UPDATE comments SET reply_to_comment_id = parent_id WHERE parent_id IS NOT NULL AND reply_to_comment_id IS NULL');
    if (!await indexExists(db, 'comments', 'idx_comments_root_sort')) await query('CREATE INDEX idx_comments_root_sort ON comments (post_id, root_comment_id, created_at, id)');
    if (!await indexExists(db, 'comments', 'idx_comments_reply_sort')) await query('CREATE INDEX idx_comments_reply_sort ON comments (root_comment_id, created_at, id)');
    await query(`CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id BIGINT NOT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(comment_id, user_id),
      FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    await query(`CREATE TABLE IF NOT EXISTS comment_media (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, owner_id INT NOT NULL, comment_id BIGINT NULL,
      file_path VARCHAR(500) NOT NULL, mime_type VARCHAR(100) NOT NULL,
      file_size BIGINT UNSIGNED NOT NULL, alt_text VARCHAR(255) NOT NULL DEFAULT \'评论图片\',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      KEY idx_comment_media_comment (comment_id, created_at),
      KEY idx_comment_media_pending (owner_id, comment_id, created_at)
    )`);
    await query('UPDATE posts p SET comment_count=(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL)');
    await query('INSERT INTO schema_migrations (id) VALUES (?)', ['20260829_comments_v2']);
  }

  const [reportsDone] = await query('SELECT id FROM schema_migrations WHERE id = ?', ['20260830_reports_v2']);
  if (!reportsDone.length) {
    await addColumn(db, 'reports', 'reason_code', "VARCHAR(40) NOT NULL DEFAULT 'other'");
    await addColumn(db, 'reports', 'public_response', 'TEXT NULL');
    await addColumn(db, 'reports', 'internal_note', 'TEXT NULL');
    await addColumn(db, 'reports', 'resolved_at', 'DATETIME NULL');
    await addColumn(db, 'reports', 'target_snapshot', 'JSON NULL');

    // Existing deployments used `reviewed`; retain it during the transition,
    // normalize the historical rows, and then enforce the new vocabulary.
    await query("ALTER TABLE reports MODIFY status ENUM('pending','reviewing','resolved','dismissed','reviewed') NOT NULL DEFAULT 'pending'");
    await query("UPDATE reports SET status='resolved', resolved_at=COALESCE(resolved_at, reviewed_at) WHERE status='reviewed'");
    await query("UPDATE reports SET reason_code='other' WHERE reason_code IS NULL OR reason_code='' ");
    await query("ALTER TABLE reports MODIFY status ENUM('pending','reviewing','resolved','dismissed') NOT NULL DEFAULT 'pending'");

    // The target snapshot is the durable audit record. Target deletion must
    // not cascade-delete the report that explains why it was filed.
    await dropForeignKeysForColumn(db, 'reports', 'post_id');
    await dropForeignKeysForColumn(db, 'reports', 'comment_id');
    if (!await constraintExists(db, 'reports', 'fk_reports_post_set_null')) {
      await query('ALTER TABLE reports ADD CONSTRAINT fk_reports_post_set_null FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL');
    }
    if (!await constraintExists(db, 'reports', 'fk_reports_comment_set_null')) {
      await query('ALTER TABLE reports ADD CONSTRAINT fk_reports_comment_set_null FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL');
    }
    if (!await indexExists(db, 'reports', 'idx_reports_reporter_status')) await query('CREATE INDEX idx_reports_reporter_status ON reports (reporter_id, status, created_at)');
    if (!await indexExists(db, 'reports', 'idx_reports_target_status')) await query('CREATE INDEX idx_reports_target_status ON reports (post_id, comment_id, status, created_at)');
    if (!await indexExists(db, 'reports', 'idx_reports_status_created')) await query('CREATE INDEX idx_reports_status_created ON reports (status, created_at, id)');

    await addColumn(db, 'notifications', 'report_id', 'BIGINT NULL');
    await query("ALTER TABLE notifications MODIFY type ENUM('follow','like','comment','reply','report_update') NOT NULL");
    if (!await constraintExists(db, 'notifications', 'fk_notifications_report')) {
      await query('ALTER TABLE notifications ADD CONSTRAINT fk_notifications_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE');
    }
    if (!await indexExists(db, 'notifications', 'idx_notification_report')) await query('CREATE INDEX idx_notification_report ON notifications (report_id, recipient_id, created_at)');

    await query(`CREATE TABLE IF NOT EXISTS report_media (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      owner_id INT NOT NULL,
      report_id BIGINT NULL,
      file_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size BIGINT UNSIGNED NOT NULL,
      width INT UNSIGNED NOT NULL DEFAULT 0,
      height INT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
      KEY idx_report_media_pending (owner_id, report_id, expires_at),
      KEY idx_report_media_report (report_id, created_at)
    )`);
    await query('INSERT INTO schema_migrations (id) VALUES (?)', ['20260830_reports_v2']);
  }
}

async function indexExists(db, table, indexName) {
  const [rows] = await db.promise().query(
    `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function constraintExists(db, table, constraintName) {
  const [rows] = await db.promise().query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1`,
    [table, constraintName]
  );
  return rows.length > 0;
}

async function dropForeignKeysForColumn(db, table, column) {
  const [rows] = await db.promise().query(
    `SELECT DISTINCT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [table, column]
  );
  for (const row of rows) await db.promise().query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
}

function createShareToken() { return crypto.randomBytes(32).toString('hex'); }
module.exports = { runMigrations, createShareToken };
