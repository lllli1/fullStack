const express = require('express');
const db = require('../../database');
const { func } = require('joi');
const { request } = require('chai');

const BadWordsNext = require('bad-words-next');
const en = require('bad-words-next/lib/en');  // 英文字典；如需中文，用 'bad-words-next/lib/ch'
const badwords = new BadWordsNext({ data: en });  // 创建实例，可加 { exclusions: ['专业词1'] } 排除
// 工具函数：将脏话替换为等长的 *
function censorText(text) {
  if (typeof text !== 'string') return text;
  return text
    .split(/\b/)
    .map(tok => (badwords.check(tok) ? '*'.repeat([...tok].length) : tok))
    .join('');
}




async function listEventCategories(event_id) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT c.category_id, c.name
      FROM categories c
      JOIN event_categories ec ON ec.category_id = c.category_id
      WHERE ec.event_id = ?
      ORDER BY c.name ASC
    `, [event_id], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function validateCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return true; // 允许空数组（未定义）
  const uniqueIds = [...new Set(categories.filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length !== categories.length) return false; // 重复或无效 ID
  return new Promise((resolve, reject) => {
    const placeholders = uniqueIds.map(() => '?').join(',');
    db.all(`SELECT category_id FROM categories WHERE category_id IN (${placeholders})`, uniqueIds, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.length === uniqueIds.length);
    });
  });
}

async function updateEventCategories(event_id, categories) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM event_categories WHERE event_id = ?', [event_id], async (delErr) => {
      if (delErr) return reject(delErr);
      if (!categories || categories.length === 0) return resolve(); // 未定义，不插入
      const stmt = db.prepare('INSERT INTO event_categories (event_id, category_id) VALUES (?, ?)');
      try {
        for (const catId of categories) {
          stmt.run([event_id, catId]);
        }
        stmt.finalize();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}











function getAuthToken(req) 
{
  return req.header('X-Authorization') || null;
}
function timeTransfer() 
{
  return Math.floor(Date.now() / 1000);
}
function loadUserByToken(token) 
{
  return new Promise((resolve, reject) => 
  {
    db.get('SELECT user_id, first_name, last_name, email FROM users WHERE session_token = ?',[token],(err, row) => 
        (err ? reject(err) : resolve(row || null)));
  });
}

function eventDetails(event_id)
{
  return new Promise((resolve,reject) =>
  {
    db.get(`SELECT e.event_id,e.name,e.description,e.location,e.start_date,e.close_registration,e.max_attendees,e.creator_id,
      u.first_name AS creator_first_name,u.last_name AS creator_last_name,u.email AS creator_email
      FROM events e
      LEFT JOIN users u on u.user_id = e.creator_id
      WHERE e.event_id = ?`,[event_id],(err,row) =>
      (err ? reject(err) : resolve(row || null)));
  });
}
function countMembers(event_id)
{
  return new Promise((resolve,reject)=>
  {
    db.get(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT a.user_id FROM attendees a WHERE a.event_id = ?
        UNION
        SELECT e.creator_id AS user_id FROM events e WHERE e.event_id = ?
      ) AS uniq
    `,[event_id, event_id],(err,row)=>
      {
        if(err)
        {
          return reject(err);
        }
        resolve(row?.count ?? 0);
      });
  });
}
function listMembers(event_id)
{
  return new Promise((reslove,reject)=>
  {
    db.all(`
      SELECT u.user_id, u.first_name, u.last_name, u.email
      FROM users u
      WHERE u.user_id IN (
        SELECT a.user_id FROM attendees a WHERE a.event_id = ?
        UNION
        SELECT e.creator_id FROM events e WHERE e.event_id = ?
      )
      ORDER BY u.user_id ASC
    `,[event_id, event_id],(err,rows) => 
      (err ? reject(err):reslove(rows || [])));
  });
}

function listQuestionsDetails(event_id)
{
  return new Promise((reslove,reject) => 
  {
    db.all(`SELECT q.question_id,q.question,q.votes,q.asked_by,au.first_name AS asked_by_first_name
      FROM questions q
      LEFT JOIN users au on au.user_id = q.asked_by
      WHERE q.event_id = ?
      ORDER by q.question_id DESC`,[event_id],(err,rows)=>
      {
        if(err)
        {
          return reject(err);
        }
        const result = (rows || []).map(r =>
        ({
          question_id:r.question_id,
          question:r.question,
          votes:typeof r.votes === 'number' ? r.votes:0,
          asked_by:r.asked_by ? {user_id:r.asked_by,first_name:r.asked_by_first_name} : null
        })
        );
        reslove(result);
      });
  });
}






module.exports = function (app) 
{
  const router = express.Router();
  router.use((req, res, next) => {
    res.app.set('json spaces', 2);
    next();
  });
 router.post('/events', async (req, res) => {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).send();
    }
    const user = await loadUserByToken(token);
    if (!user) {
      return res.status(401).send();
    }

    const { name, description, location, start, close_registration, max_attendees, categories } = req.body || {};
    const startVal = req.body?.start;
    const close_registrationVal = req.body?.close_registration;
    const max_attendeesVal = req.body?.max_attendees;

    // 检查额外字段
    const allowedKeys = ['name', 'description', 'location', 'start', 'close_registration', 'max_attendees', 'categories'];
    const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return res.status(400).json({ error_message: '无效字段' });
    }

    // 验证必填字段
    if (
      typeof name !== 'string' || name.trim() === '' ||
      typeof description !== 'string' || description.trim() === '' ||
      typeof location !== 'string' || location.trim() === '' ||
      startVal === '' || close_registrationVal === '' || max_attendeesVal === '' ||
      startVal == null || close_registrationVal == null || max_attendeesVal == null
    ) {
      return res.status(400).json({ error_message: '必填字段缺失或为空' });
    }

    // 清理文本
    const cleanName = censorText(name.trim());
    const cleanDesc = censorText(description.trim());
    const cleanLoc = censorText(location.trim());

    // 数值验证
    const startNum = Number(start);
    const closeRegNum = Number(close_registration);
    const maxAttendeesNum = Number(max_attendees);
    if (
      !Number.isInteger(startNum) || startNum < 0 ||
      !Number.isInteger(closeRegNum) || closeRegNum < 0 ||
      !Number.isInteger(maxAttendeesNum) || maxAttendeesNum <= 0
    ) {
      return res.status(400).json({ error_message: '字段类型无效' });
    }

    const now = timeTransfer();
    if (startNum <= now) {
      return res.status(400).json({ error_message: '开始时间不能早于当前时间' });
    }
    if (closeRegNum > startNum) {
      return res.status(400).json({ error_message: '报名截止时间不能晚于开始时间' });
    }

    // 验证类别
    if (categories !== undefined && !await validateCategories(categories)) {
      return res.status(400).json({ error_message: '无效类别' });
    }

    // 插入事件到数据库
    const sql = `
      INSERT INTO events (name, description, location, start_date, close_registration, max_attendees, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const event_id = await new Promise((resolve, reject) => {
      db.run(sql, [cleanName, cleanDesc, cleanLoc, startNum, closeRegNum, maxAttendeesNum, user.user_id], function (err) {
        if (err) {
          console.error('[DEBUG SQL Error]', err);
          return reject(err);
        }
        resolve(this.lastID);
      });
    });

    // 更新类别关联
    if (categories && categories.length > 0) {
      await updateEventCategories(event_id, categories);
    }

    return res.status(201).json({ event_id });
  } catch (e) {
    console.error('[POST /events] error:', e);
    return res.status(500).send();
  }
});

  router.get('/event/:event_id',async(req,res) =>
  {
    try
    {
      const eventID = parseInt(req.params.event_id,10);
      if(!Number.isInteger(eventID))
      {
        return res
        .status(404)
        .send();
      }
      const token = getAuthToken(req);
      const requster = token ? await loadUserByToken(token) : null;
      const ev = await eventDetails(eventID);
      if(!ev)
      {
        return res
        .status(404)
        .send();
      }
      const number_member = await countMembers(eventID);
      let attendees = undefined;
      if(requster && requster.user_id === ev.creator_id)
      {
        attendees = await listMembers(eventID);
      }
      const questions = await listQuestionsDetails(eventID);
      const categories = await listEventCategories(eventID);
      return res
      .status(200)
      .json(
      {
        
        event_id:ev.event_id,
        creator:
        {
          creator_id:ev.creator_id,
          first_name:ev.creator_first_name,
          last_name:ev.creator_last_name,
          email:ev.creator_email
        },
        name:ev.name,
        description:ev.description,
        location:ev.location,
        start:ev.start_date,
        close_registration:ev.close_registration,
        max_attendees:ev.max_attendees,
        number_attending: number_member,
        ...(attendees ? {attendees}:{}),
        questions: questions,
        categories: categories.length > 0 ? categories : [{ category_id: null, name: 'Undefined' }]
      });
    }
    catch(e)
    {
      console.error('[GET /event/:event_id] error:', e);
      return res
      .status(500)
      .send();
    }
  });

router.post('/event/:event_id',async(req,res) =>
{
  try
  {
    const eventID = parseInt(req.params.event_id,10);
    if(!Number.isInteger(eventID))
    {
      return res
      .status(404)
      .send();
    }
    const token = getAuthToken(req);
    if(!token)
    {

      return res
      .status(401)
      .send();
    }
    const user = await loadUserByToken(token);
    console.log('User:', user); // Debugging line
    if(!user)
    {

      return res
      .status(401)
      .send();
    }
    const ev = await eventDetails(eventID);
    if(!ev)
    {
      return res
      .status(404)
      .send();
    }
    if (user.user_id === ev.creator_id) {
      return res.status(403).json({ error_message: 'You are already registered' });
    }
    const registeredSuccess  = await new Promise((resolve,reject) =>
      {
        db.get(`SELECT 1 FROM attendees WHERE event_id = ? AND user_id = ?`,[eventID, user.user_id],(err, row) => 
          (err ? reject(err) : resolve(!!row)));
      });
    const now = timeTransfer();
    /*
    const count_member = await new Promise((resolve,reject) =>
    {
      db.get(`SELECT COUNT(*) AS count FROM attendees WHERE event_id = ?`,[eventID],(err, row) => 
      (err ? reject(err) : resolve(row?.count ?? 0)));
    });
*/
    const count_member = await countMembers(eventID);
    if(now > ev.close_registration)
    {
      return res
      .status(403)
      .json({error_message:'Registration is closed'});
    }
    if(count_member >= ev.max_attendees)
    {
      return res
      .status(403)
      .json({error_message:'Event is at capacity'});
    }
    if(registeredSuccess)
    {
      return res
      .status(403)
      .json({error_message:'You are already registered'});
    }

    await new Promise((resolve,reject) =>
    {
      db.run(`INSERT INTO attendees (event_id, user_id) VALUES (?, ?)`,[eventID, user.user_id],err => 
        (err ? reject(err) : resolve()));
    });
    return res.status(200).send();
  }
  catch(e)
  {
    console.error('[POST /event/:event_id] error:', e);
    return res
    .status(500)
    .send();
  }
});

router.delete('/event/:event_id',async (req,res)=>
{
  try
  {
    const eventID = parseInt(req.params.event_id,10);
    if(!Number.isInteger(eventID))
    {
      return res
      .status(404)
      .send();
    }
    const token = getAuthToken(req);
    if(!token)
    {
      return res
      .status(401)
      .send();
    }
    const user = await loadUserByToken(token);
    if(!user)
    {
      return res
      .status(401)
      .send();
    }
    const ev = await eventDetails(eventID);
    if(!ev)
    {
      return res
      .status(404)
      .send();                                                                              
    }
    if(ev.creator_id !== user.user_id)
    {
      return res
      .status(403)
      .json({error_message:"只能删除自己创建的活动"});
    }

    await new Promise((resolve,reject) =>
    {
      db.run(`UPDATE events SET close_registration = -1 WHERE event_id  = ?`,[eventID],err => 
      (err ? reject(err) : resolve()));
    });
    return res.status(200).send();
  }
  catch(e)
  {
    console.error('[DELETE /event/:event_id] error:', e);
    return res
    .status(500)
    .send();
  }
});

router.patch('/event/:event_id', async (req, res) => {
  try {
    const eventID = parseInt(req.params.event_id, 10);
    if (!Number.isInteger(eventID)) return res.status(404).send();

    const token = getAuthToken(req);
    if (!token) return res.status(401).send();

    const user = await loadUserByToken(token);
    if (!user) return res.status(401).send();

    const event = await eventDetails(eventID);
    if (!event) return res.status(404).send();

    if (event.creator_id !== user.user_id)
      return res.status(403).json({ error_message: "You can only update your own events" });

    // === 检查是否有多余字段 ===
    const allowedKeys = ['name', 'description', 'location', 'start', 'close_registration', 'max_attendees','categories'];
    const extraKeys = Object.keys(req.body || {}).filter(k => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return res.status(400).json({ error_message: 'Invalid field(s) in request body' });
    }

    // === 取出字段并进行类型转换 ===
    let { name, description, location, start, close_registration, max_attendees,categories} = req.body;
    if (start !== undefined) start = Number(start);
    if (close_registration !== undefined) close_registration = Number(close_registration);
    if (max_attendees !== undefined) max_attendees = Number(max_attendees);

    const fieldsToUpdate = {};
    const now = Math.floor(Date.now() / 1000); // 当前时间（秒）

    // === name ===
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '')
        return res.status(400).json({ error_message: 'Invalid name' });
      fieldsToUpdate.name = name.trim();
    }

    // === description ===
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim() === '')
        return res.status(400).json({ error_message: 'Invalid description' });
      fieldsToUpdate.description = description.trim();
    }

    // === location ===
    if (location !== undefined) {
      if (typeof location !== 'string' || location.trim() === '')
        return res.status(400).json({ error_message: 'Invalid location' });
      fieldsToUpdate.location = location.trim();
    }

    // === start ===
    if (start !== undefined) {
      // 新增：检测空字符串
      if (req.body.start === '') {
        return res.status(400).json({ error_message: 'Invalid start time' });
      }

      if (isNaN(start) || !Number.isInteger(start) || start < 0)
        return res.status(400).json({ error_message: 'Invalid start time' });

      // 空字符串或过去时间不合法
      if (start <= now)
        return res.status(400).json({ error_message: 'Start time must be in the future' });

      fieldsToUpdate.start_date = start;
    }

    // === close_registration ===
    if (close_registration !== undefined) {
      // 新增：检测空字符串
      if (req.body.close_registration === '') {
        return res.status(400).json({ error_message: 'Invalid close registration time' });
      }

      if (isNaN(close_registration) || !Number.isInteger(close_registration) || close_registration < 0)
        return res.status(400).json({ error_message: 'Invalid close registration time' });

      const startToCompare = start !== undefined ? start : event.start_date;
      if (close_registration > startToCompare)
        return res.status(400).json({ error_message: 'Registration cannot close after event start' });

      fieldsToUpdate.close_registration = close_registration;
    }

    // === max_attendees ===
    if (max_attendees !== undefined) {
      if (isNaN(max_attendees) || !Number.isInteger(max_attendees) || max_attendees <= 0)
        return res.status(400).json({ error_message: 'Invalid max attendees' });
      fieldsToUpdate.max_attendees = max_attendees;
    }


    if (categories !== undefined) {
      if (!await validateCategories(categories)) {
        return res.status(400).json({ error_message: 'Invalid categories' });
      }
      await updateEventCategories(eventID, categories);
    }


    // === 没有任何可更新字段 ===
    if (Object.keys(fieldsToUpdate).length === 0)
      return res.status(200).send();

    // === 执行 SQL 更新 ===
    const setClauses = Object.keys(fieldsToUpdate).map(f => `${f} = ?`).join(', ');
    const values = Object.values(fieldsToUpdate).concat(eventID);
    const sql = `UPDATE events SET ${setClauses} WHERE event_id = ?`;

    db.run(sql, values, function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error_message: 'Database error' });
      }
      return res.status(200).send();
    });

  } catch (e) {
    console.error('[PATCH /event/:event_id] error:', e);
    return res.status(500).send();
  }
});



app.get('/search',async(req,res) =>
{
  try
  {
    const q = req.query.q || null;
    const status = req.query.status || null;
    const limit = parseInt(req.query.limit,10) || 20
    const offset = parseInt(req.query.offset,10) || 0;
    const category = req.query.category || null;
    if(limit < 1 || limit > 100 || offset < 0)
    {
      return res
      .status(400)
      .json({error_message:"limit和offset不符合要求"});
    }
    if(status && !['MY_EVENTS','ATTENDING','OPEN','ARCHIVE'].includes(status))
    {
      return res
      .status(400)
      .json({error_message:"status不符合要求"});
    }
    let user = null;
    const token = getAuthToken(req);
    if(token)
    {
      user = await loadUserByToken(token);
    }
    if((status === 'MY_EVENTS' || status === 'ATTENDING')&& !user)
    {
      return res
      .status(400)
      .send();
    }
    let sql = `SELECT e.*,u.user_id AS creator_id,u.first_name,u.last_name,u.email
    FROM events e
    JOIN users u ON e.creator_id = u.user_id WHERE 1=1`;//AI RERFERENCE
    const params = [];
    if(q)
    {
      sql += ' AND e.name LIKE ?';;
      params.push(`%${q}%`);
    }

    if(category)
    {
      if(category === 'undefined')
      {
        sql += ' AND NOT EXISTS (SELECT 1 FROM event_categories ec WHERE ec.veent_id AND ec.category_id = ?)';
      }
      else
      {
        const catID = Number(category);
        if(Number.isInteger(catID) || catID > 0)
        {
          sql += ' AND EXISTS (SELECT 1 FROM event_categories ec WHERE ec.event_id = e.event_id AND ec.category_id = ?)'
          params.push(catID);
        }
        else
        {
          return res
          .status(400)
          .json({error_message:"category不符合要求"});
        }
      }
    }








    const now = Math.floor(Date.now()/1000);

    if(status === 'MY_EVENTS')
    {
      sql += ' AND e.creator_id = ?'; 
      params.push(user.user_id);
    }
    else if(status === 'ATTENDING')
    {
      
      /*sql += ' AND e.event_id IN (SELECT event_id FROM attendees WHERE user_id = ?)';
      params.push(user.user_id); 
      */
      sql += ' AND e.event_id IN (SELECT event_id FROM attendees WHERE user_id = ?)';
      sql += ' AND e.close_registration != ? AND e.start_date >= ?';
      params.push(user.user_id, -1, now);
    }
    else if(status === 'OPEN')
    {
      sql += ' AND e.close_registration > ?';
      params.push(now);
    }
    else if(status === 'ARCHIVE')
    {
      sql += ' AND (e.close_registration = ? OR e.start_date < ?)';
      params.push(-1,now);
    }
    sql += ' ORDER BY e.start_date DESC LIMIT ? OFFSET ?';
    params.push(limit,offset);
 
  const rows  = await new Promise((resolve,reject)=>
  {
    db.all(sql,params,(err,results) =>
    (err ? reject(err):resolve(results)));
  });
  const events = rows.map(row =>
  ({
    event_id:row.event_id,
    creator:
    {
      creator_id:row.creator_id,
      first_name:row.first_name,
      last_name:row.last_name,
      email:row.email
    },
    name:row.name,
    description:row.description,
    location:row.location,
    start:row.start_date,
    close_registration:row.close_registration,
    max_attendees:row.max_attendees,
    category:row.category
  }));
  return res.status(200).json(events);
  } 
  catch(err)
  {
    console.error('[GET /search] error:', err);
    return res
    .status(500)
    .send();
  }
});

/// 获取类别列表的端点
router.get('/categories', async (req, res) => {
  try {
    const categories = await new Promise((resolve, reject) => {
      db.all('SELECT category_id, name FROM categories ORDER BY name ASC', (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
    return res.status(200).json(categories);
  } catch (e) {
    console.error('[GET /categories] error:', e);
    return res.status(500).send();
  }
});


  app.use('/', router);
};
