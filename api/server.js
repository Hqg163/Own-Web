const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// 允许跨域请求
app.use(cors());
// 解析 JSON 请求体
app.use(bodyParser.json());

// MySQL数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Qqg20040424', // 修改为你的数据库密码
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
    if (err) {
      console.error('创建用户表失败:', err);
    } else {
      console.log('用户表创建成功或已存在');
    }
  });
});

// 注册 API
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱、密码都是必填项' });
    }

    const username = '用户' + Math.floor(Math.random() * 1000);
    
    // 检查邮箱是否已存在
    const checkEmailQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkEmailQuery, [email], async (err, results) => {
      if (err) {
        return res.status(500).json({ error: '数据库查询失败' });
      }
      
      if (results.length > 0) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }
      
      // 检查用户名是否已存在
      const checkUsernameQuery = 'SELECT * FROM users WHERE username = ?';
      db.query(checkUsernameQuery, [username], async (err, results) => {
        if (err) {
          return res.status(500).json({ error: '数据库查询失败' });
        }
        
        if (results.length > 0) {
          return res.status(400).json({ error: '该用户名已被使用' });
        }
        
        // 哈希密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // 插入新用户
        const insertQuery = `
          INSERT INTO users (username, email, password) 
          VALUES (?, ?, ?)
        `;
        
        db.query(insertQuery, [username, email, hashedPassword], (err, results) => {
          if (err) {
            return res.status(500).json({ error: '用户注册失败' });
          }
          
          res.status(201).json({ 
            message: '用户注册成功',
            userId: results.insertId 
          });
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
  
  console.log(email, password);

  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码是必填项' });
  }
  
  // 查询用户
  const query = 'SELECT * FROM users WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err) {
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    const user = results[0];
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    // 登录成功，返回用户信息（排除密码）
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ 
      message: '登录成功',
      user: userWithoutPassword 
    });
  });
});

// 获取用户信息 API
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  const query = 'SELECT id, username, email, birthday, hobbies, occupation, notes FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.status(200).json({ user: results[0] });
  });
});

// 更新用户信息 API
app.put('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { username, birthday, hobbies, occupation, notes } = req.body;
  
  // 检查用户名是否已存在（排除当前用户）
  const checkUsernameQuery = 'SELECT * FROM users WHERE username = ? AND id != ?';
  db.query(checkUsernameQuery, [username, userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    if (results.length > 0) {
      return res.status(400).json({ error: '该用户名已被使用' });
    }
    
    // 更新用户信息
    const updateQuery = `
      UPDATE users 
      SET username = ?, birthday = ?, hobbies = ?, occupation = ?, notes = ?
      WHERE id = ?
    `;
    
    db.query(updateQuery, [username, birthday, hobbies, occupation, notes, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: '更新用户信息失败' });
      }
      
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
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
  
  // 先查询用户当前密码
  const query = 'SELECT password FROM users WHERE id = ?';
  db.query(query, [userId], async (err, results) => {
    if (err) {
      return res.status(500).json({ error: '数据库查询失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = results[0];
    
    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '旧密码错误' });
    }
    
    // 哈希新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // 更新密码
    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
    db.query(updateQuery, [hashedPassword, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: '更新密码失败' });
      }
      
      res.status(200).json({ message: '密码更新成功' });
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