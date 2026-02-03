
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types'); // 需要安装: npm install mime-types

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

        // 关键修复：简化路径存储逻辑
        let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');

        // 确保路径格式统一为 /uploads/userId/categoryId/filename
        if (!relativePath.startsWith('/uploads')) {
          relativePath = '/uploads' + relativePath;
        }

        console.log('存储的 file_path:', relativePath); // 应该是 /uploads/3/5/file-xxx.jpg

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
  
  // // 检查是否是有效的邮箱格式
  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // if (!emailRegex.test(email)) {
  //   return res.status(400).json({ error: '邮箱格式不正确' });
  // }
  
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
    res.status(200).json({ emails: results });
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

// 获取单封邮件详情（包含附件下载链接）
app.get('/api/email/:emailId/detail', (req, res) => {
  const { emailId } = req.params;
  const { userEmail } = req.query;
  
  if (!userEmail) {
    return res.status(400).json({ error: '缺少用户邮箱参数' });
  }
  
  const query = 'SELECT * FROM learning_emails WHERE id = ? AND recipient_email = ?';
  db.query(query, [emailId, userEmail], (err, results) => {
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
      attachments = JSON.parse(email.attachments || '[]');
    } catch (e) {
      attachments = [];
    }
    
    // 为每个附件添加下载URL
    const attachmentsWithUrls = attachments.map(att => ({
      ...att,
      downloadUrl: att.type === 'internal' && att.fileId 
        ? `/api/download/${att.fileId}?userId=${email.sender_id}`  // 注意：附件下载需要发件人的userId，这里简化处理
        : null
    }));
    
    res.status(200).json({
      email: {
        ...email,
        attachments: attachmentsWithUrls
      }
    });
  });
});

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
