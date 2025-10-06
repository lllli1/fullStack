// reset-db.js
const fs = require('fs');
const path = require('path');

// SQLite 数据库文件路径（跟你项目里一致）
const dbPath = path.join(__dirname, 'db.sqlite');

// 1) 如果存在旧的数据库文件，先删除
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✅ 已删除旧的 db.sqlite 文件');
} else {
  console.log('ℹ️ 没有发现旧的 db.sqlite 文件');
}

// 2) 引入 database.js，会自动运行建表逻辑
require('./database');

console.log('✅ 数据库已重建完成');
