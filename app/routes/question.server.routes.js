const db = require('../../database');
const express = require('express');

function loadUserByToken(token) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT user_id, first_name, last_name, email FROM users WHERE session_token = ?',
      [token],
      (err, row) => (err ? reject(err) : resolve(row || null))
    );
  });
}

module.exports = function (app) {
  const router = express.Router();

  router.post('/event/:event_id/question', async (req, res) => {
    try {
      const eventIDStr = req.params.event_id;
      const questionText = (req.body && req.body.question || '').trim();
      const token = req.header('X-Authorization') || '';

      const eventID = Number(eventIDStr);
      if (!Number.isInteger(eventID) || eventID <= 0) {
        return res.status(400).send();
      }
      if (!questionText) {
        return res.status(400).send();
      }
      if (!token) {
        return res.status(401).send();
      }

      const user = await loadUserByToken(token);
      if (!user) {
        return res.status(401).send();
      }
      const userID = user.user_id;

      const sqlEvent = 'SELECT event_id, creator_id FROM events WHERE event_id = ?';
      db.get(sqlEvent, [eventID], (errEvent, eventRow) => {
        if (errEvent) {
          console.error(errEvent);
          return res.status(500).send();
        }
        if (!eventRow) {
          return res.status(400).send();
        }
        if (eventRow.creator_id === userID) {
          return res
            .status(403)
            .json({ error_message: '不能向自己创建的活动提问' });
        }

        const sqlIsAttendee = 'SELECT 1 FROM attendees WHERE event_id = ? AND user_id = ?';
        db.get(sqlIsAttendee, [eventID, userID], (errAttendee, attendeeRow) => {
          if (errAttendee) {
            console.error(errAttendee);
            return res.status(500).send();
          }
          if (!attendeeRow) {
            return res
              .status(403)
              .json({ error_message: '只能提问已参加的活动' });
          }

          const sqlInsert =
            'INSERT INTO questions (question, asked_by, event_id, votes) VALUES (?, ?, ?, 0)';
          db.run(sqlInsert, [questionText, userID, eventID], function (errInsert) {
            if (errInsert) {
              console.error(errInsert);
              return res.status(500).send();
            }
            return res.status(201).json({ question_id: this.lastID });
          });
        });
      });
    } catch (e) {
      console.error('[POST /event/:event_id/question] error:', e);
      return res.status(500).send();
    }
  });
router.delete('question/:question_id',async (req,res) =>
{
    try
    {
        const quesID = Number(req.params.question_id);
        const token = req.header('X-Authorization') || '';
        if(!Number.isInteger(quesID) || quesID <= 0)
        {
            return res
            .status(404)
            .send();
        }
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
        const userID = user.user_id;
        const sqlGetQues = `SELECT q.question_id,q.asked_by,q.event_id,e.creator_id
        FROM questions q
        LEFT JOIN events e ON e.event_id = q.event_id
        WHERE q.question_id = ?`;
        db.get(sqlGetQues,[quesID],(errQues,rowQues)=>
        {
            if(errQues)
            {
                return res
                .status(500)
                .send();
            }
            if(!rowQues)
            {
                return res
                .status(404)
                .send();
            }
            const isAuthor = rowQues.asked_by === userID;
            const isEventCreator = rowQues.creator_id === userID;
            if(!isAuthor && !isEventCreator)
            {
                return res
                .status(403)
                .json({error_message:"只能删除自己提出的问题或自己创建的活动中的问题"});
            }
            const sqlDel = `DELETE FROM question HWERE question_id = ?`;
            db.run(sqlDel,[quesID],function(errDel)
            {
                if(errDel)
                {
                    console.error(errDel);
                    return res
                    .status(500)
                    .send();
                }
                return res.status(200).send();
            });
        });
    }
    catch(e)
    {
        console.error('[DELETE /question/:question_id] error:',e);
        return res
        .status(500)
        .send()
    }
});
// 修正：使用已存在的 votes 表
router.post('/question/:question_id/vote', async (req, res) => {
  try 
  {
    const qid = Number(req.params.question_id);
    const token = req.header('X-Authorization') || '';

    if (!Number.isInteger(qid) || qid <= 0) 
    {
      return res.status(404).send();
    }
    if (!token) 
    {
      return res.status(401).send();
    }

    const user = await loadUserByToken(token);
    if (!user) 
    {
      return res.status(401).send();
    }
    const userID = user.user_id;

    const sqlGetQ = 'SELECT question_id FROM questions WHERE question_id = ?';
    db.get(sqlGetQ, [qid], (errQ, rowQ) => 
    {
      if (errQ) 
      {
        console.error(errQ);
        return res.status(500).send();
      }
      if (!rowQ) 
      {
        return res.status(404).send();
      }

      // 2) 尝试写入 votes（依赖 PRIMARY KEY (question_id, voter_id) 限制重复）
      const sqlInsertVote = 'INSERT OR IGNORE INTO votes (question_id, voter_id) VALUES (?, ?)';
      db.run(sqlInsertVote, [qid, userID], function (errIns) 
      {
        if (errIns) 
        {
          console.error(errIns);
          return res.status(500).send();
        }

        // this.changes === 0 说明已投过票，被 IGNORE -> 返回 403
        if (this.changes === 0) 
        {
          return res.status(403).send('已经投过票');
        }

        // 3) 首次投票则累加计数
        const sqlUpdate = 'UPDATE questions SET votes = COALESCE(votes, 0) + 1 WHERE question_id = ?';
        db.run(sqlUpdate, [qid], function (errUpd) 
        {
          if (errUpd) 
          {
            console.error(errUpd);
            return res.status(500).send();
          }
          return res.status(200).send();
        });
      });
    });
  } 
  catch (e) 
  {
    console.error('[POST /question/:question_id/vote] error:', e);
    return res.status(500).send();
  }
});
 
router.delete('/question/:question_id/vote',async(req,res)=>
{
  try
  {
    const quesID = Number(req.params.question_id);
    const token = req.header('X-Authorization') || '';
    if(!Number.isInteger(quesID) || quesID <= 0)
    {
      return res
      .status(404)
      .send();
    }
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
    const userID = user.user_id;
    const sqlGetQ = `SELECT question_id FROM questions WHERE question_id = ?`;
    db.get(sqlGetQ,[quesID],(errQues,rowQues)=>
    {
      if(errQues)
      {
        console.error(errQues);
        return res
        .status(500)
        .send();
      }
      if(!rowQues)
      {
        return res
        .status(404)
        .send();
      }

    const sqlHasVoted = `SELECT 1 FROM votes WHERE question_id = ? AND voter_id = ?`;
    db.get(sqlHasVoted,[quesID,userID],(errHasVoted,rowHasVoted)=>
    {
      if(errHasVoted)
      {
        console.error(errHasVoted);
        return res
        .status(500)
        .send();
      }
      if(!rowHasVoted)
      {
        return res
        .status(403)
        .json({error_message:"没投票不能取消"});
      }
      const sqlDelVote = `DELETE FROM votes WHERE question_id = ? AND voter_id = ?`;
      db.run(sqlDelVote,[quesID,userID],function(errDel)
      {
        if(errDel)
        {
          console.error(errDel);
          return res
          .status(500)
          .send();
        }
        const sqlDec = `UPDATE questions SET votes = CASE WHEN votes > 0 THEN votes - 1 ELSE 0 END WHERE question_id = ?`;
        db.run(sqlDec,[quesID],function(errDec)
        {
          if(errDec)
          {
            console.error(errDec);
            return res
            .status(500)
            .send();
          }
          return res.status(200).send();
        });
      });
    });
    });
  }
  catch(e)
  {
    console.error('[DELETE /question/:question_id/vote] error:',e);
    return res
    .status(500)
    .send();
  }
})

  app.use('/', router);
};
