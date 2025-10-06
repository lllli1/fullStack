const express = require('express');
const db = require('../../database');
const { func } = require('joi');
const { request } = require('chai');

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
    db.get(`SELECT COUNT(*) AS count FROM attendees WHERE event_id = ?`,[event_id],(err,row)=>
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
    db.all(`SELECT a.user_id,u.first_name,u.last_name,u.email
      FROM attendees a
      JOIN users u on u.user_id = a.user_id
      WHERE a.event_id = ?
      ORDER BY a.user_id ASC`,[event_id],(err,rows) => 
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
      ORDER by q.question_id ASC`,[event_id],(err,rows)=>
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
  router.post('/events', async (req, res) => 
    {
    try 
    {
      const token = getAuthToken(req);
      if(!token) 
      {
        return res
        .status(401)
        .send();
      }
      const user = await loadUserByToken(token);
      if (!user)
      {
        return res
        .status(401)
        .send();
      }
    const {name,description,location,start,close_registration,max_attendees} = req.body || {};

    if (!name || !description || !location || start == null || close_registration == null || max_attendees == null) 
    {
        return res
        .status(400)
        .json({ error_message: 'Relevant error message goes in here必填' });
    }
    //数值检验
    if(!Number.isInteger(start) ||!Number.isInteger(close_registration) ||!Number.isInteger(max_attendees)) 
    {
        return res
        .status(400)
        .json({ error_message: 'Relevant error message goes in here类型' });
    }
    const now = timeTransfer();
    if(start <= now) 
    {
        return res
        .status(400)
        .json({ error_message: 'Relevant error message goes in here时间' });
    }
    if(!(close_registration <= start)) 
    {
        return res
        .status(400)
        .json({ error_message: 'Relevant error message goes in here报名时间' });
      }

    const sql ='INSERT INTO events (name, description, location, start_date, close_registration, max_attendees, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(sql,[name,description,location,start,close_registration,max_attendees,user.user_id],function (err) 
    {
    if (err) 
    {
        return res
        .status(500)
        .send(111);
    }
    return res.status(201).json({event_id: this.lastID });
    }
      );
    } 
    catch (e) 
    {
      return res
      .status(500)
      .send();
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
        questions: questions
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
    const registeredSuccess  = await new Promise((resolve,reject) =>
      {
        db.get(`SELECT 1 FROM attendees WHERE event_id = ? AND user_id = ?`,[eventID, user.user_id],(err, row) => 
          (err ? reject(err) : resolve(!!row)));
      });
    if(registeredSuccess)
    {
      return res
      .status(403)
      .json({error_message:'User is already registered for this event'});
    }
    const now = timeTransfer();
    if(now > ev.close_registration)
    {
      return res
      .status(403)
      .json({error_message:'Registration is closed'});
    }
    const count_member = await new Promise((resolve,reject) =>
    {
      db.get(`SELECT COUNT(*) AS count FROM attendees WHERE event_id = ?`,[eventID],(err, row) => 
      (err ? reject(err) : resolve(row?.count ?? 0)));
    });
    if(count_member >= ev.max_attendees)
    {
      return res
      .status(403)
      .json({error_message:'Event is full'});
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

router.patch('/event/:event_id',async(req,res) =>
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
    
    /*
    console.log('--- [PATCH /event/:event_id] START ---');

    const token = getAuthToken(req);
    console.log('[DEBUG] token from header:', token);

    if (!token) {
      console.log('[DEBUG] No token provided');
      return res.status(401).send();
    }

    const user = await loadUserByToken(token);
    console.log('[DEBUG] user loaded:', user);

    if (!user) {
      console.log('[DEBUG] Invalid token, user not found');
      return res.status(401).send();
    }

    const eventID = req.params.event_id;
    console.log('[DEBUG] eventID:', eventID);
*/

    if(ev.creator_id !== user.user_id)
    {
      return res
      .status(403)
      .json({error_message:"只能修改自己创建的活动"});
    }
    const {name,description,location,start,close_registration,max_attendees} = req.body;
    const fieldsToUpdate = {};
    if(name !== undefined) fieldsToUpdate.name = name;
    if(description !== undefined) fieldsToUpdate.description = description;
    if(location !== undefined) fieldsToUpdate.location = location;
    if(start !== undefined) fieldsToUpdate.start = start;
    if(close_registration !== undefined) fieldsToUpdate.close_registration = close_registration;
    if(max_attendees !== undefined) fieldsToUpdate.max_attendees = max_attendees;

    if(Object.keys(fieldsToUpdate).length === 0)
    {
      return res
      .status(400)
      .json({error_message:"没对任何字段进行修改"});
    }

    const setClauses = Object.keys(fieldsToUpdate).map(f => `${f} = ?`).join(', ');
    const values = Object.values(fieldsToUpdate);
    values.push(eventID);
    await new Promise((resolve,reject) =>
    {
      db.run(`UPDATE events SET ${setClauses} WHERE event_id = ?`,values,err =>
      (err ? reject(err):resolve()));
    });
    return res.status(200).send();
  }
  catch(e)
  {
    console.error('[PATCH /event/:event_id] error:',e);
    return res
    .status(500)
    .send();
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
      .status(401)
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
    const now = Math.floor(Date.now()/1000);

    if(status === 'MY_EVENTS')
    {
      sql += ' AND e.creator_id = ?'; 
      params.push(user.user_id);
    }
    else if(status === 'ATTENDING')
    {
      sql += ' AND e.event_id IN (SELECT event_id FROM registrations WHERE user_id = ?)';
      params.push(user.user_id); 
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
    max_attendees:row.max_attendees
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



  app.use('/', router);
};
