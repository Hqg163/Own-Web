
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types'); // 需要安装: npm install mime-types
const {imageSize} = require('image-size'); // 需要安装: npm install image-size
const mm = require('music-metadata');   // 需要安装: npm install music-metadata

const app = express();
const PORT = process.env.PORT || 3000;

// 允许跨域请求
app.use(cors());
// 解析 JSON 请求体
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 用于访问上传的文件
// 在 server.js 中，修改静态文件服务配置
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // 自动设置正确的 Content-Type
    const mimeType = mime.lookup(filePath);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    // 禁用缓存，确保实时预览
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// MySQL数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Qqg20040424',
  database: 'user_management'
});

// 连接到数据库
db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('MySQL数据库连接成功');
  
  // 创建用户表
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50),
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      birthday DATE,
      hobbies TEXT,
      occupation VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  
  db.query(createUsersTable, (err) => {
    if (err) console.error('创建用户表失败:', err);
    else console.log('用户表创建成功或已存在');
  });

  // 创建学习区分类表
  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS learning_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(50) NOT NULL,
      sort_order INT DEFAULT 0,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_category_per_user (user_id, name)
    )
  `;
  
  db.query(createCategoriesTable, (err) => {
    if (err) console.error('创建分类表失败:', err);
    else console.log('分类表创建成功或已存在');
  });

  // 创建学习区文件表
  const createFilesTable = `
    CREATE TABLE IF NOT EXISTS learning_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_size BIGINT,
      file_path VARCHAR(500) NOT NULL,
      markdown_content TEXT,
      is_markdown BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES learning_categories(id) ON DELETE CASCADE
    )
  `;
  
  db.query(createFilesTable, (err) => {
    if (err) console.error('创建文件表失败:', err);
    else console.log('文件表创建成功或已存在');
  });

  // 创建邮件表
  const createEmailsTable = `
    CREATE TABLE IF NOT EXISTS learning_emails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      sender_email VARCHAR(100) NOT NULL,
      sender_name VARCHAR(50),
      recipient_email VARCHAR(100) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      content TEXT,
      attachments JSON,
      is_read BOOLEAN DEFAULT FALSE,
      has_attachments BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_recipient (recipient_email),
      INDEX idx_created (created_at)
    )
  `;
  
  db.query(createEmailsTable, (err) => {
    if (err) console.error('创建邮件表失败:', err);
    else console.log('邮件表创建成功或已存在');
  });

  // 插入默认分类
  const defaultCategories = ['数学', '物理', '天文', 'web/app', '嵌入式', 'AI', '其它'];
  defaultCategories.forEach((cat, index) => {
    const checkQuery = 'SELECT id FROM learning_categories WHERE is_default = TRUE AND name = ?';
    db.query(checkQuery, [cat], (err, results) => {
      if (err) return;
      if (results.length === 0) {
        // 为所有现有用户插入默认分类
        db.query('SELECT id FROM users', (err, users) => {
          if (err) return;
          users.forEach(user => {
            const insertQuery = 'INSERT IGNORE INTO learning_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, TRUE)';
            db.query(insertQuery, [user.id, cat, index]);
          });
        });
      }
    });
  });
});

// 配置multer存储
// 修改 server.js 中的 storage 配置（第68-84行附近）
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 优先从 body 获取 userId，其次从 header
    const userId = req.body.userId || req.headers['x-user-id'] || 'temp';
    const categoryId = req.body.categoryId || req.body.category || '其它';
    
    // 需要根据 categoryId 查询分类名称，或者直接使用 categoryId 作为目录名
    // 这里简化处理，使用 categoryId
    const uploadPath = path.join(__dirname, 'uploads', userId.toString(), categoryId.toString());
    
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB限制
  fileFilter: function (req, file, cb) {
    // 允许所有文件类型，但会在前端提示
    cb(null, true);
  }
});

// ========== 用户认证相关API ==========

// 注册 API
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱、密码都是必填项' });
    }

    const username = '用户' + Math.floor(Math.random() * 1000);
    
    const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailQuery, [email], async (err, results) => {
      if (err) return res.status(500).json({ error: '数据库查询失败' });
      if (results.length > 0) return res.status(400).json({ error: '该邮箱已被注册' });
      
      const checkUsernameQuery = 'SELECT * FROM users WHERE username = ?';
      db.query(checkUsernameQuery, [username], async (err, results) => {
        if (err) return res.status(500).json({ error: '数据库查询失败' });
        if (results.length > 0) return res.status(400).json({ error: '该用户名已被使用' });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const insertQuery = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;

        db.query(insertQuery, [username, email, hashedPassword], (err, results) => {
          if (err) return res.status(500).json({ error: '用户注册失败' });
          
          const userId = results.insertId;
          // 为新用户创建默认分类
          const defaultCategories = ['数学', '物理', '天文', 'web/app', '嵌入式', 'AI', '其它'];
          defaultCategories.forEach((cat, index) => {
            const catQuery = 'INSERT INTO learning_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, TRUE)';
            db.query(catQuery, [userId, cat, index]);
          });
          
          res.status(201).json({ message: '用户注册成功', userId: userId });
        });
      });
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 登录 API
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码是必填项' });
  }
  
  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length === 0) return res.status(401).json({ error: '邮箱或密码错误' });
    
    const user = results[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: '邮箱或密码错误' });
    
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ message: '登录成功', user: userWithoutPassword });
  });
});

// 获取用户信息 API
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT id, username, email, birthday, hobbies, occupation, notes FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '用户不存在' });
    res.status(200).json({ user: results[0] });
  });
});

// 更新用户信息 API
app.put('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { username, birthday, hobbies, occupation, notes } = req.body;
  
  const checkUsernameQuery = 'SELECT * FROM users WHERE username = ? AND id != ?';
  db.query(checkUsernameQuery, [username, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length > 0) return res.status(400).json({ error: '该用户名已被使用' });
    
    const updateQuery = `UPDATE users SET username = ?, birthday = ?, hobbies = ?, occupation = ?, notes = ? WHERE id = ?`;
    db.query(updateQuery, [username, birthday, hobbies, occupation, notes, userId], (err, results) => {
      if (err) return res.status(500).json({ error: '更新用户信息失败' });
      if (results.affectedRows === 0) return res.status(404).json({ error: '用户不存在' });
      res.status(200).json({ message: '用户信息更新成功' });
    });
  });
});

// 更新密码 API
app.put('/api/user/:userId/password', async (req, res) => {
  const { userId } = req.params;
  const { oldPassword, newPassword } = req.body;
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '旧密码和新密码都是必填项' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码长度至少6位' });
  }
  
  const query = 'SELECT password FROM users WHERE id = ?';
  db.query(query, [userId], async (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '用户不存在' });
    
    const user = results[0];
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: '旧密码错误' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
    db.query(updateQuery, [hashedPassword, userId], (err, results) => {
      if (err) return res.status(500).json({ error: '更新密码失败' });
      res.status(200).json({ message: '密码更新成功' });
    });
  });
});

// ========== 学习区 - 分类管理API ==========

// 获取分类列表
app.get('/api/categories/:userId', (req, res) => {
  const { userId } = req.params;
  const query = 'SELECT * FROM learning_categories WHERE user_id = ? ORDER BY sort_order ASC, id ASC';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取分类失败' });
    res.status(200).json({ categories: results });
  });
});

// 添加新分类
app.post('/api/categories', (req, res) => {
  const { userId, name } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '分类名称不能为空' });
  }
  
  // 获取当前最大sort_order（在"其它"之前插入）
  const getMaxOrderQuery = 'SELECT MAX(sort_order) as max_order FROM learning_categories WHERE user_id = ? AND name != "其它"';
  db.query(getMaxOrderQuery, [userId], (err, results) => {
    const newOrder = results[0].max_order !== null ? results[0].max_order + 1 : 0;
    
    const insertQuery = 'INSERT INTO learning_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, FALSE)';
    db.query(insertQuery, [userId, name.trim(), newOrder], (err, result) => {
      if (err) {
        if (err.message.includes('Duplicate entry')) {
          return res.status(400).json({ error: '该分类名称已存在' });
        }
        return res.status(500).json({ error: '创建分类失败' });
      }
      res.status(201).json({ message: '分类创建成功', categoryId: result.insertId });
    });
  });
});

// ========== 学习区 - 文件管理API ==========

// 获取文件列表（支持按分类筛选）
app.get('/api/files/:userId', (req, res) => {
  const { userId } = req.params;
  const { categoryId, search } = req.query;
  
  let query = `
    SELECT f.*, c.name as category_name 
    FROM learning_files f 
    JOIN learning_categories c ON f.category_id = c.id 
    WHERE f.user_id = ?
  `;
  const params = [userId];
  
  if (categoryId && categoryId !== 'all') {
    query += ' AND f.category_id = ?';
    params.push(categoryId);
  }
  
  if (search && search.trim() !== '') {
    query += ' AND (f.original_name LIKE ? OR f.filename LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY f.created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: '获取文件列表失败' });
    res.status(200).json({ files: results });
  });
});

// 上传文件
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const { userId, categoryId, customName } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }
    
    // 检查是否同名
    const checkQuery = 'SELECT id FROM learning_files WHERE user_id = ? AND category_id = ? AND original_name = ?';
    db.query(checkQuery, [userId, categoryId, req.file.originalname], (err, results) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '检查文件名失败' });
      }
      if (results.length > 0) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: '该分类下已存在同名文件' });
      }
      
      const displayName = customName || req.file.originalname;
      const fileType = path.extname(req.file.originalname).toLowerCase() || 'unknown';
      
      // 关键修复：确保 file_path 以 /uploads 开头，存储绝对路径格式
      let filePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
      
      // 确保路径以 /uploads 开头
      if (!filePath.startsWith('/uploads')) {
        if (filePath.startsWith('/')) {
          filePath = '/uploads' + filePath;
        } else {
          filePath = '/uploads/' + filePath;
        }
      }
      
      console.log('存储的 file_path:', filePath); // 调试：应该是 /uploads/temp/其它/filename.png
      
      const insertQuery = `
        INSERT INTO learning_files (user_id, category_id, filename, original_name, file_type, file_size, file_path, is_markdown) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const isMarkdown = fileType === '.md';
      
      db.query(insertQuery, [
        userId, 
        categoryId, 
        req.file.filename, 
        displayName,
        fileType, 
        req.file.size, 
        filePath,  // 现在存储的是 /uploads/temp/其它/filename.png
        isMarkdown
      ], (err, result) => {
        if (err) {
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: '保存文件信息失败' });
        }
        res.status(201).json({ message: '上传成功', fileId: result.insertId });
      });
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 上传Markdown内容
app.post('/api/upload-markdown', (req, res) => {
  const { userId, categoryId, title, content } = req.body;
  
  // 创建markdown文件
  const categoryDir = path.join(__dirname, 'uploads', userId.toString(), 'markdown');
  fs.mkdirSync(categoryDir, { recursive: true });
  
  const filename = `md-${Date.now()}-${Math.round(Math.random() * 1E9)}.md`;
  const filePath = path.join(categoryDir, filename);
  
  fs.writeFile(filePath, content, (err) => {
    if (err) return res.status(500).json({ error: '保存Markdown文件失败' });
    
    const insertQuery = `
      INSERT INTO learning_files (user_id, category_id, filename, original_name, file_type, file_size, file_path, is_markdown, markdown_content) 
      VALUES (?, ?, ?, ?, '.md', ?, ?, TRUE, ?)
    `;
    
    const relativePath = filePath.replace(__dirname, '').replace(/\\/g, '/');
    
    db.query(insertQuery, [
      userId, 
      categoryId, 
      filename, 
      title + '.md',
      Buffer.byteLength(content, 'utf8'),
      relativePath,
      content
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(filePath);
        return res.status(500).json({ error: '保存文件信息失败' });
      }
      res.status(201).json({ message: '发布成功', fileId: result.insertId });
    });
  });
});

// 下载文件
app.get('/api/download/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { userId } = req.query;
  
  const query = 'SELECT * FROM learning_files WHERE id = ? AND user_id = ?';
  db.query(query, [fileId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询文件失败' });
    if (results.length === 0) return res.status(404).json({ error: '文件不存在' });
    
    const file = results[0];
    const fullPath = path.join(__dirname, file.file_path);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    // 关键修复：确保下载文件名有正确的扩展名
    let downloadName = file.original_name;
    const ext = file.file_type || '';
    
    if (ext && ext !== 'unknown') {
      const extWithDot = ext.startsWith('.') ? ext : '.' + ext;
      const lowerName = downloadName.toLowerCase();
      const lowerExt = extWithDot.toLowerCase();
      
      // 如果文件名没有以该扩展名结尾，则追加
      if (!lowerName.endsWith(lowerExt)) {
        downloadName = downloadName + extWithDot;
      }
    }
    
    // 编码文件名支持中文
    let encodedName = '';
    try {
      encodedName = encodeURIComponent(downloadName);
    } catch (e) {
      encodedName = downloadName;
    }
    
    // 设置Content-Type
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };
    
    const contentType = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // RFC 5987编码
    const asciiName = downloadName.replace(/[^\x00-\x7F]/g, '').replace(/["']/g, '') || 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error('下载错误:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: '下载失败' });
        }
      }
    });
  });
});

// 获取文件内容（预览）
app.get('/api/file-content/:fileId', (req, res) => {
  const { fileId } = req.params;
  const { userId } = req.query;
  
  const query = 'SELECT * FROM learning_files WHERE id = ? AND user_id = ?';
  db.query(query, [fileId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '文件不存在' });
    
    const file = results[0];
    const fullPath = path.join(__dirname, file.file_path);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    // 如果是Markdown且数据库有内容，直接返回
    if (file.is_markdown && file.markdown_content) {
      return res.json({ 
        file: file, 
        content: file.markdown_content,
        type: 'markdown'
      });
    }
    
    // 拓展：支持更多文本/代码文件格式
    const textExtensions = [
      '.txt', '.md', '.js', '.html', '.css', '.py', '.c', '.cpp', '.h', 
      '.java', '.json', '.xml', '.ts', '.vue', '.php', '.go', '.rs', 
      '.rb', '.swift', '.kt', '.sql', '.yaml', '.yml', '.sh', '.bash',
      '.css', '.scss', '.sass', '.less', '.jsx', '.tsx', '.csv', '.log'
    ];
    
    if (textExtensions.includes(file.file_type.toLowerCase())) {
      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: '读取文件失败' });
        res.json({ 
          file: file, 
          content: data, 
          type: file.file_type === '.md' ? 'markdown' : 'text' 
        });
      });
    } else {
      // 对于二进制文件，返回文件信息和URL
      res.json({ 
        file: file, 
        content: null, 
        type: 'binary',
        url: `/uploads${file.file_path.replace('/uploads', '').replace('uploads', '')}`
      });
    }
  });
});

// 批量删除文件
app.delete('/api/files', (req, res) => {
  const { fileIds, userId } = req.body;
  
  if (!fileIds || fileIds.length === 0) {
    return res.status(400).json({ error: '未选择要删除的文件' });
  }
  
  // 获取文件路径
  const query = 'SELECT * FROM learning_files WHERE id IN (?) AND user_id = ?';
  db.query(query, [fileIds, userId], (err, files) => {
    if (err) return res.status(500).json({ error: '查询文件失败' });
    
    // 删除物理文件
    files.forEach(file => {
      const fullPath = path.join(__dirname, file.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
    
    // 删除数据库记录
    const deleteQuery = 'DELETE FROM learning_files WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [fileIds, userId], (err) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      res.status(200).json({ message: '删除成功', count: fileIds.length });
    });
  });
});

// ========== 学习区 - 邮件系统API ==========

// 检查用户是否存在（用于发送邮件前验证）
app.get('/api/check-user', (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ error: '请提供邮箱地址' });
  }
  
  // 查询用户是否存在
  const query = 'SELECT id, username, email FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('检查用户失败:', err);
      return res.status(500).json({ error: '检查用户失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '该邮箱用户不存在', exists: false });
    }
    
    res.status(200).json({ 
      exists: true, 
      user: {
        id: results[0].id,
        username: results[0].username,
        email: results[0].email
      }
    });
  });
});

// 发送邮件（带收件人检查）
app.post('/api/emails', (req, res) => {
  const { senderId, senderEmail, senderName, recipientEmail, subject, content, attachments } = req.body;
  
  if (!recipientEmail || !subject) {
    return res.status(400).json({ error: '收件人和主题不能为空' });
  }
  
  // 先检查收件人是否存在
  const checkUserQuery = 'SELECT id FROM users WHERE email = ? OR username = ?';
  db.query(checkUserQuery, [recipientEmail, recipientEmail], (err, users) => {
    if (err) {
      console.error('检查收件人失败:', err);
      return res.status(500).json({ error: '检查收件人失败' });
    }
    
    if (users.length === 0) {
      return res.status(404).json({ error: '收件人不存在' });
    }
    
    // 收件人存在，执行发送
    const hasAttachments = attachments && attachments.length > 0;
    
    const insertQuery = `
      INSERT INTO learning_emails (sender_id, sender_email, sender_name, recipient_email, subject, content, attachments, has_attachments) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      senderId, senderEmail, senderName, recipientEmail, subject, content, 
      JSON.stringify(attachments || []), hasAttachments
    ], (err, result) => {
      if (err) {
        console.error('发送邮件失败:', err);
        return res.status(500).json({ error: '发送邮件失败' });
      }
      res.status(201).json({ message: '邮件发送成功', emailId: result.insertId });
    });
  });
});

// 获取收件箱
app.get('/api/emails/:userEmail', (req, res) => {
  const { userEmail } = req.params;
  const { filter } = req.query; // all, unread, read
  
  let query = 'SELECT * FROM learning_emails WHERE recipient_email = ?';
  const params = [userEmail];
  
  if (filter === 'unread') {
    query += ' AND is_read = FALSE';
  } else if (filter === 'read') {
    query += ' AND is_read = TRUE';
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: '获取邮件失败' });
    
    // 确保attachments字段是数组
    const emails = results.map(email => {
      try {
        if (typeof email.attachments === 'string') {
          email.attachments = JSON.parse(email.attachments);
        }
      } catch (e) {
        email.attachments = [];
      }
      if (!Array.isArray(email.attachments)) {
        email.attachments = [];
      }
      return email;
    });
    
    res.status(200).json({ emails: emails });
  });
});

// 标记邮件已读
app.put('/api/emails/:emailId/read', (req, res) => {
  const { emailId } = req.params;
  
  const query = 'UPDATE learning_emails SET is_read = TRUE WHERE id = ?';
  db.query(query, [emailId], (err) => {
    if (err) return res.status(500).json({ error: '更新状态失败' });
    res.status(200).json({ message: '已标记为已读' });
  });
});

// 获取单封邮件详情（修复版 - 包含附件下载链接）
app.get('/api/email/:emailId/detail', (req, res) => {
  const { emailId } = req.params;
  const { userEmail } = req.query;
  
  if (!userEmail) {
    return res.status(400).json({ error: '缺少用户邮箱参数' });
  }
  
  // 查询邮件 - 收件人或发件人都可以查看
  const query = 'SELECT * FROM learning_emails WHERE id = ? AND (recipient_email = ? OR sender_email = ?)';
  db.query(query, [emailId, userEmail, userEmail], (err, results) => {
    if (err) {
      console.error('获取邮件详情失败:', err);
      return res.status(500).json({ error: '获取邮件详情失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '邮件不存在或无权访问' });
    }
    
    const email = results[0];
    
    // 处理附件，添加下载URL
    let attachments = [];
    try {
      if (typeof email.attachments === 'string') {
        attachments = JSON.parse(email.attachments);
      } else if (Array.isArray(email.attachments)) {
        attachments = email.attachments;
      }
    } catch (e) {
      console.error('解析附件失败:', e);
      attachments = [];
    }
    
    // 为每个附件添加下载URL
    const attachmentsWithUrls = attachments.map(att => {
      if (att.type === 'internal' && att.fileId) {
        // 站内文件：使用发件人ID作为文件拥有者
        return {
          ...att,
          downloadUrl: `/api/download/${att.fileId}?userId=${email.sender_id}`
        };
      }
      return att;
    });
    
    res.status(200).json({
      email: {
        ...email,
        attachments: attachmentsWithUrls,
        has_attachments: attachmentsWithUrls.length > 0
      }
    });
  });
});

// 下载邮件附件（专用API）
app.get('/api/email-attachment/:emailId/:attachmentIndex', (req, res) => {
  const { emailId, attachmentIndex } = req.params;
  const { userEmail } = req.query;
  
  if (!userEmail) {
    return res.status(400).json({ error: '缺少用户邮箱参数' });
  }
  
  // 查询邮件
  const query = 'SELECT * FROM learning_emails WHERE id = ? AND (recipient_email = ? OR sender_email = ?)';
  db.query(query, [emailId, userEmail, userEmail], (err, results) => {
    if (err) {
      console.error('查询邮件失败:', err);
      return res.status(500).json({ error: '查询邮件失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '邮件不存在或无权访问' });
    }
    
    const email = results[0];
    
    // 解析附件
    let attachments = [];
    try {
      if (typeof email.attachments === 'string') {
        attachments = JSON.parse(email.attachments);
      } else if (Array.isArray(email.attachments)) {
        attachments = email.attachments;
      }
    } catch (e) {
      return res.status(500).json({ error: '附件数据损坏' });
    }
    
    const idx = parseInt(attachmentIndex);
    if (isNaN(idx) || idx < 0 || idx >= attachments.length) {
      return res.status(400).json({ error: '附件索引无效' });
    }
    
    const att = attachments[idx];
    
    // 处理不同类型的附件
    if (att.type === 'internal' && att.fileId) {
      // 站内文件：查询文件信息并下载
      const fileQuery = 'SELECT * FROM learning_files WHERE id = ?';
      db.query(fileQuery, [att.fileId], (err, files) => {
        if (err || files.length === 0) {
          return res.status(404).json({ error: '文件不存在' });
        }
        
        const file = files[0];
        const fullPath = path.join(__dirname, file.file_path);
        
        if (!fs.existsSync(fullPath)) {
          return res.status(404).json({ error: '文件已丢失' });
        }
        
        // 设置下载头
        let downloadName = att.name || file.original_name;
        const ext = file.file_type || '';
        
        if (ext && ext !== 'unknown') {
          const extWithDot = ext.startsWith('.') ? ext : '.' + ext;
          const lowerName = downloadName.toLowerCase();
          const lowerExt = extWithDot.toLowerCase();
          if (!downloadName.toLowerCase().endsWith(extWithDot.toLowerCase())) {
            downloadName = downloadName + extWithDot;
          }
        }
        
        const encodedName = encodeURIComponent(downloadName);
        const asciiName = downloadName.replace(/[^\x00-\x7F]/g, '').replace(/["']/g, '') || 'download';
        
        res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
        res.sendFile(fullPath);
      });
    } else {
      return res.status(400).json({ error: '不支持的附件类型或附件不存在' });
    }
  });
});

// ========== 娱乐区 - 图片管理API ==========

// 创建图片表
const createImagesTable = `
  CREATE TABLE IF NOT EXISTS entertainment_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    style VARCHAR(50) DEFAULT '普通',
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    description TEXT,
    width INT,
    height INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

db.query(createImagesTable, (err) => {
  if (err) console.error('创建图片表失败:', err);
  else console.log('图片表创建成功或已存在');
});

// 创建视频表
const createVideosTable = `
  CREATE TABLE IF NOT EXISTS entertainment_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    cover_path VARCHAR(500),
    duration VARCHAR(20),
    frame_rate VARCHAR(10),
    frame_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

db.query(createVideosTable, (err) => {
  if (err) console.error('创建视频表失败:', err);
  else console.log('视频表创建成功或已存在');
});

// 创建音乐表
const createMusicTable = `
  CREATE TABLE IF NOT EXISTS entertainment_music (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(100),
    album VARCHAR(100),
    release_date DATE,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    cover_path VARCHAR(500),
    duration VARCHAR(20),
    lyrics TEXT,
    play_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

db.query(createMusicTable, (err) => {
  if (err) console.error('创建音乐表失败:', err);
  else console.log('音乐表创建成功或已存在');
});

// 图片上传配置
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.body.userId || 'temp';
    const uploadPath = path.join(__dirname, 'uploads', 'entertainment', 'images', userId.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'img-' + uniqueSuffix + ext);
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片格式文件'));
    }
  }
});

// 获取最新5张图片（用于娱乐区首页预览）
app.get('/api/entertainment/images/recent/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, title, file_type, style, created_at, 
           CONCAT('/uploads/entertainment/images/', user_id, '/', filename) as thumbnail_path
    FROM entertainment_images 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  // 简化查询，返回基础信息
  const simpleQuery = `
    SELECT id, title, file_type, style, created_at, file_path, width, height
    FROM entertainment_images 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.query(simpleQuery, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取图片失败' });
    res.status(200).json({ images: results });
  });
});

// 获取所有图片
app.get('/api/entertainment/images/:userId', (req, res) => {
  const { userId } = req.params;
  const { style } = req.query;
  
  let query = `
    SELECT id, title, file_type, style, file_path, thumbnail_path, 
           description, width, height, created_at
    FROM entertainment_images 
    WHERE user_id = ?
  `;
  const params = [userId];
  
  if (style && style !== 'all') {
    query += ' AND style = ?';
    params.push(style);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: '获取图片列表失败' });
    res.status(200).json({ images: results });
  });
});

// 上传图片
app.post('/api/entertainment/images', imageUpload.single('image'), (req, res) => {
  try {
    const { userId, title, style, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择图片文件' });
    }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalTitle = title || req.file.originalname.replace(ext, '');
    const finalStyle = style || '普通';
    
    // 获取图片尺寸 - 使用 fs 读取文件后再用 image-size
    let width = 0, height = 0;
    try {
      // const fs = require('fs');
      const {imageSize} = require('image-size');
      const buffer = fs.readFileSync(req.file.path);
      const dimensions = imageSize(buffer);
      width = dimensions.width || 0;
      height = dimensions.height || 0;
    } catch (err) {
      console.error('读取图片尺寸失败:', err);
      width = 0;
      height = 0;
    }
    
    let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + relativePath;
    }
    
    const insertQuery = `
      INSERT INTO entertainment_images 
      (user_id, title, style, file_type, file_size, file_path, description, width, height) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      userId, finalTitle, finalStyle, ext, req.file.size, 
      relativePath, description || finalTitle, width, height
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '保存图片信息失败' });
      }
      res.status(201).json({ message: '上传成功', imageId: result.insertId });
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 批量更新图片风格
app.put('/api/entertainment/images/batch-style', (req, res) => {
  console.log('=== 收到批量归类请求 ===');  // 添加这行
  console.log('请求体:', req.body);  // 添加这行

  const { imageIds, style, userId } = req.body;
  
  if (!imageIds || imageIds.length === 0) {
    return res.status(400).json({ error: '未选择图片' });
  }
  
  if (!style) {
    return res.status(400).json({ error: '风格不能为空' });
  }
  
  // 生成占位符，例如：3个id -> '?,?,?'
  const placeholders = imageIds.map(() => '?').join(',');
  
  const updateQuery = `
    UPDATE entertainment_images 
    SET style = ?
    WHERE id IN (${placeholders}) AND user_id = ?
  `;
  
  // 参数顺序：style, id1, id2, id3..., userId
  const params = [style, ...imageIds, userId];
  
  console.log('批量归类SQL:', updateQuery);
  console.log('参数:', params);
  
  db.query(updateQuery, params, (err, result) => {
    if (err) {
      console.error('批量归类失败:', err);
      return res.status(500).json({ error: '批量归类失败: ' + err.message });
    }
    
    console.log('归类成功，影响行数:', result.affectedRows);
    res.status(200).json({ 
      message: '归类成功', 
      affectedRows: result.affectedRows 
    });
  });
});

// 更新图片信息
app.put('/api/entertainment/images/:imageId', (req, res) => {
  const { imageId } = req.params;
  const { title, style, description, userId } = req.body;
  
  const updateQuery = `
    UPDATE entertainment_images 
    SET title = ?, style = ?, description = ?
    WHERE id = ? AND user_id = ?
  `;
  
  db.query(updateQuery, [title, style, description, imageId, userId], (err) => {
    if (err) return res.status(500).json({ error: '更新失败' });
    res.status(200).json({ message: '更新成功' });
  });
});

// 批量删除图片
app.delete('/api/entertainment/images', (req, res) => {
  const { imageIds, userId } = req.body;
  
  if (!imageIds || imageIds.length === 0) {
    return res.status(400).json({ error: '未选择要删除的图片' });
  }
  
  // 获取文件路径
  const query = 'SELECT * FROM entertainment_images WHERE id IN (?) AND user_id = ?';
  db.query(query, [imageIds, userId], (err, images) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    
    // 删除物理文件
    images.forEach(img => {
      const fullPath = path.join(__dirname, img.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
    
    // 删除数据库记录
    const deleteQuery = 'DELETE FROM entertainment_images WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [imageIds, userId], (err) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      res.status(200).json({ message: '删除成功', count: imageIds.length });
    });
  });
});

// 获取图片文件
app.get('/api/entertainment/image-file/:imageId', (req, res) => {
  const { imageId } = req.params;
  const { userId } = req.query;
  
  const query = 'SELECT * FROM entertainment_images WHERE id = ? AND user_id = ?';
  db.query(query, [imageId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '图片不存在' });
    
    const image = results[0];
    const fullPath = path.join(__dirname, image.file_path);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    res.sendFile(fullPath);
  });
});

// ========== 娱乐区 - 视频管理API ==========

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.body.userId || 'temp';
    const uploadPath = path.join(__dirname, 'uploads', 'entertainment', 'videos', userId.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

const videoUpload = multer({ 
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传视频格式文件'));
    }
  }
});

// 获取最新5个视频（用于娱乐区首页预览）
app.get('/api/entertainment/videos/recent/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, title, file_type, duration, created_at
    FROM entertainment_videos 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取视频失败' });
    res.status(200).json({ videos: results });
  });
});

// 获取所有视频
app.get('/api/entertainment/videos/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, title, file_type, file_path, cover_path, duration, 
           frame_rate, frame_count, created_at
    FROM entertainment_videos 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取视频列表失败' });
    res.status(200).json({ videos: results });
  });
});

// 上传视频
app.post('/api/entertainment/videos', videoUpload.single('video'), async (req, res) => {
  try {
    const { userId, title } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择视频文件' });
    }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalTitle = title || req.file.originalname.replace(ext, '');
    
    // 使用 fluent-ffmpeg 获取视频信息
    let duration = '0:00';
    let frameRate = '未知';
    let frameCount = 0;
    
    try {
      const ffmpeg = require('fluent-ffmpeg');
      
      // 获取视频元数据
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      
      // 提取时长
      if (metadata.format && metadata.format.duration) {
        const totalSeconds = Math.floor(metadata.format.duration);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      
      // 提取帧率和帧数
      if (metadata.streams && metadata.streams[0]) {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video') || metadata.streams[0];
        
        // 帧率 (fps)
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          frameRate = den ? Math.round(num / den) + 'fps' : videoStream.r_frame_rate;
        } else if (videoStream.avg_frame_rate) {
          const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
          frameRate = den ? Math.round(num / den) + 'fps' : videoStream.avg_frame_rate;
        }
        
        // 帧数
        if (videoStream.nb_frames) {
          frameCount = parseInt(videoStream.nb_frames);
        } else if (metadata.format.duration && frameRate !== '未知') {
          // 估算帧数 = 时长 * 帧率
          const fps = parseInt(frameRate);
          frameCount = Math.round(metadata.format.duration * fps);
        }
      }
      
    } catch (err) {
      console.error('读取视频元数据失败:', err);
      // 使用默认值继续上传
    }
    
    let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + relativePath;
    }
    
    const insertQuery = `
      INSERT INTO entertainment_videos 
      (user_id, title, file_type, file_size, file_path, duration, frame_rate, frame_count) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      userId, finalTitle, ext, req.file.size, 
      relativePath, duration, frameRate, frameCount
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '保存视频信息失败' });
      }
      res.status(201).json({ message: '上传成功', videoId: result.insertId });
    });
  } catch (error) {
    console.error('上传视频错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 批量删除视频
app.delete('/api/entertainment/videos', (req, res) => {
  const { videoIds, userId } = req.body;
  
  if (!videoIds || videoIds.length === 0) {
    return res.status(400).json({ error: '未选择要删除的视频' });
  }
  
  const query = 'SELECT * FROM entertainment_videos WHERE id IN (?) AND user_id = ?';
  db.query(query, [videoIds, userId], (err, videos) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    
    videos.forEach(video => {
      const fullPath = path.join(__dirname, video.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
    
    const deleteQuery = 'DELETE FROM entertainment_videos WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [videoIds, userId], (err) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      res.status(200).json({ message: '删除成功', count: videoIds.length });
    });
  });
});

// 获取视频文件
app.get('/api/entertainment/video-file/:videoId', (req, res) => {
  const { videoId } = req.params;
  const { userId } = req.query;
  
  const query = 'SELECT * FROM entertainment_videos WHERE id = ? AND user_id = ?';
  db.query(query, [videoId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '视频不存在' });
    
    const video = results[0];
    const fullPath = path.join(__dirname, video.file_path);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    // 支持视频流式传输
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(fullPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(fullPath).pipe(res);
    }
  });
});

// ========== 娱乐区 - 音乐管理API ==========

const musicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.body.userId || 'temp';
    const uploadPath = path.join(__dirname, 'uploads', 'entertainment', 'music', userId.toString());
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'music-' + uniqueSuffix + ext);
  }
});

const musicUpload = multer({ 
  storage: musicStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传音频格式文件'));
    }
  }
});

// 获取最新5首音乐（用于娱乐区首页预览）
app.get('/api/entertainment/music/recent/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, title, artist, duration, created_at
    FROM entertainment_music 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取音乐失败' });
    res.status(200).json({ music: results });
  });
});

// 获取所有音乐
app.get('/api/entertainment/music/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, title, artist, album, release_date, file_type, 
           file_path, cover_path, duration, lyrics, created_at
    FROM entertainment_music 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取音乐列表失败' });
    res.status(200).json({ music: results });
  });
});

// 上传音乐
app.post('/api/entertainment/music', musicUpload.single('music'), async (req, res) => {
  try {
    const { userId, title, artist, album, releaseDate } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择音乐文件' });
    }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalTitle = title || req.file.originalname.replace(ext, '');
    
    // 使用 music-metadata 解析音频文件获取时长和元数据
    let duration = '0:00';
    let finalArtist = artist || '未知歌手';
    let finalAlbum = album || '';
    
    try {
      const metadata = await mm.parseFile(req.file.path);
      
      // 获取时长（转换为 mm:ss 格式）
      if (metadata.format.duration) {
        const totalSeconds = Math.floor(metadata.format.duration);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      
      // 从元数据获取歌手和专辑（如果前端没提供）
      if (metadata.common) {
        if (!artist && metadata.common.artist) {
          finalArtist = metadata.common.artist;
        }
        if (!album && metadata.common.album) {
          finalAlbum = metadata.common.album;
        }
      }
    } catch (err) {
      console.error('解析音频元数据失败:', err);
      // 解析失败时继续使用默认值
    }
    
    let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + relativePath;
    }
    
    const insertQuery = `
      INSERT INTO entertainment_music 
      (user_id, title, artist, album, release_date, file_type, file_size, file_path, duration) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      userId, finalTitle, finalArtist, finalAlbum, releaseDate || null,
      ext, req.file.size, relativePath, duration
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '保存音乐信息失败' });
      }
      res.status(201).json({ 
        message: '上传成功', 
        musicId: result.insertId,
        duration: duration,
        fileSize: req.file.size
      });
    });
  } catch (error) {
    console.error('上传音乐错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 批量删除音乐
app.delete('/api/entertainment/music', (req, res) => {
  const { musicIds, userId } = req.body;
  
  if (!musicIds || musicIds.length === 0) {
    return res.status(400).json({ error: '未选择要删除的歌曲' });
  }
  
  const query = 'SELECT * FROM entertainment_music WHERE id IN (?) AND user_id = ?';
  db.query(query, [musicIds, userId], (err, musics) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    
    musics.forEach(music => {
      const fullPath = path.join(__dirname, music.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
    
    const deleteQuery = 'DELETE FROM entertainment_music WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [musicIds, userId], (err) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      res.status(200).json({ message: '删除成功', count: musicIds.length });
    });
  });
});

// 获取音乐文件
app.get('/api/entertainment/music-file/:musicId', (req, res) => {
  const { musicId } = req.params;
  const { userId } = req.query;
  
  const query = 'SELECT * FROM entertainment_music WHERE id = ? AND user_id = ?';
  db.query(query, [musicId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '音乐不存在' });
    
    const music = results[0];
    const fullPath = path.join(__dirname, music.file_path);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    res.sendFile(fullPath);
  });
});

// 更新音乐歌词
app.put('/api/entertainment/music/:musicId/lyrics', (req, res) => {
  const { musicId } = req.params;
  const { lyrics, userId } = req.body;
  
  const updateQuery = 'UPDATE entertainment_music SET lyrics = ? WHERE id = ? AND user_id = ?';
  db.query(updateQuery, [lyrics, musicId, userId], (err) => {
    if (err) return res.status(500).json({ error: '更新歌词失败' });
    res.status(200).json({ message: '更新成功' });
  });
});

// 更新播放次数
app.post('/api/entertainment/music/:musicId/play', (req, res) => {
  const { musicId } = req.params;
  const { userId } = req.body;
  
  // 先检查音乐是否存在且属于该用户
  const checkQuery = 'SELECT id FROM entertainment_music WHERE id = ? AND user_id = ?';
  db.query(checkQuery, [musicId, userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: '音乐不存在' });
    }
    
    // 更新播放次数 - 需要先添加 play_count 字段到数据库表
    const updateQuery = `
      UPDATE entertainment_music 
      SET play_count = COALESCE(play_count, 0) + 1 
      WHERE id = ?
    `;
    
    db.query(updateQuery, [musicId], (err) => {
      if (err) {
        return res.status(500).json({ error: '更新播放次数失败' });
      }
      res.status(200).json({ message: '播放次数已更新' });
    });
  });
});

// 静态文件服务 - 娱乐区文件
app.use('/uploads/entertainment', express.static(path.join(__dirname, 'uploads', 'entertainment'), {
  setHeaders: (res, filePath) => {
    const mimeType = mime.lookup(filePath);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`API地址: http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  db.end();
  console.log('数据库连接已关闭');
  process.exit(0);
});
