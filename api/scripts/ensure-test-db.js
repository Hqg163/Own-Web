const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path:path.join(__dirname, '..', '..', '.env') });
const database = process.env.TEST_DB_NAME || 'own_web_test';
(async()=>{const connection=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD});await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await connection.end()})().catch((error)=>{console.error(error);process.exitCode=1});
