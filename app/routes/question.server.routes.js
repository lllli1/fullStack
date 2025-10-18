const db = require('../../database');
const express = require('express');

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
      const body = req.body || {};
      const questionText = (req.body && req.body.question || '').trim();
      const token = req.header('X-Authorization') || '';

      const allowedKeys = ['question'];
      const extraKeys = Object.keys(body).filter(k => !allowedKeys.includes(k));
      if (extraKeys.length > 0) 
      {
        return res.status(400).json({ error_message: 'Extra field(s) present' });
      }

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
          const cleanQuestion = censorText(questionText);
          const sqlInsert =
            'INSERT INTO questions (question, asked_by, event_id, votes) VALUES (?, ?, ?, 0)';
          db.run(sqlInsert, [cleanQuestion, userID, eventID], function (errInsert) {
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
router.delete('/question/:question_id', async (req, res) => {
  try {
    const token = req.header('X-Authorization') || '';
    // 未登录优先返回 401
    if (!token) {
      return res.status(401).send();
    }

    const quesID = Number(req.params.question_id);
    // 如果问题 ID 无效，则返回 404
    if (!Number.isInteger(quesID) || quesID <= 0) {
      return res.status(404).send();
    }

    const user = await loadUserByToken(token);
    if (!user) {
      return res.status(401).send();
    }

    const userID = user.user_id;

    // 查询问题并检查
    const sqlGetQues = `
      SELECT q.question_id, q.asked_by, q.event_id, e.creator_id
      FROM questions q
      LEFT JOIN events e ON e.event_id = q.event_id
      WHERE q.question_id = ?
    `;
    db.get(sqlGetQues, [quesID], (errQues, rowQues) => {
      if (errQues) {
        //console.error('Error getting question:', errQues);
        return res.status(500).send();
      }

      if (!rowQues) {
        //console.log(`Question ${quesID} not found`);
        return res.status(404).send();
      }

      const isAuthor = rowQues.asked_by === userID;
      const isEventCreator = rowQues.creator_id === userID;
      if (!isAuthor && !isEventCreator) {
        return res.status(403).json({ error_message: '只能删除自己提出的问题或自己创建的活动中的问题' });
      }

      // 执行删除操作
      const sqlDel = `DELETE FROM questions WHERE question_id = ?`;
      db.run(sqlDel, [quesID], function (errDel) {
        if (errDel) {
          //console.error('Error deleting question:', errDel);
          return res.status(500).send();
        }
        // 如果删除成功，返回 200
        return res.status(200).send();
      });
    });
  } catch (e) {
    //console.error('[DELETE /question/:question_id] error:', e);
    return res.status(500).send();
  }
});
/*
// 修正：使用已存在的 votes 表
router.post('/question/:question_id/vote', async (req, res) => {
  try {
    const token = req.header('X-Authorization') || '';
    const questionID = Number(req.params.question_id);

    // 如果没有 token，则返回 401
    if (!token) {
      return res.status(401).send();
    }

    if (!Number.isInteger(questionID) || questionID <= 0) {
      return res.status(404).send();
    }

    const user = await loadUserByToken(token);
    if (!user) {
      return res.status(401).send();
    }

    const userID = user.user_id;

    // 检查用户是否已参与活动
    const sqlGetQ = 'SELECT question_id, event_id FROM questions WHERE question_id = ?';
    const question = await new Promise((resolve, reject) => {
      db.get(sqlGetQ, [questionID], (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!question) {
      return res.status(404).send();
    }

    // 检查用户是否是该问题所在活动的参与者
    const sqlIsAttendee = 'SELECT 1 FROM attendees WHERE event_id = ? AND user_id = ?';
    const isAttendee = await new Promise((resolve, reject) => {
      db.get(sqlIsAttendee, [question.event_id, userID], (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!isAttendee) {
      return res.status(403).json({ error_message: '只能投票参加的活动' });
    }

    // 检查用户是否已投票
    const sqlHasVoted = 'SELECT 1 FROM votes WHERE question_id = ? AND voter_id = ?';
    const hasVoted = await new Promise((resolve, reject) => {
      db.get(sqlHasVoted, [questionID, userID], (err, row) => (err ? reject(err) : resolve(!!row)));
    });

    if (hasVoted) {
      return res.status(403).json({ error_message: '你已投过票' });
    }

    // 投票：插入记录并更新票数
    const sqlInsertVote = 'INSERT INTO votes (question_id, voter_id) VALUES (?, ?)';
    db.run(sqlInsertVote, [questionID, userID], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send();
      }

      const sqlUpdateVotes = 'UPDATE questions SET votes = COALESCE(votes, 0) + 1 WHERE question_id = ?';
      db.run(sqlUpdateVotes, [questionID], function (errUpdate) {
        if (errUpdate) {
          console.error(errUpdate);
          return res.status(500).send();
        }
        return res.status(200).send();
      });
    });
  } catch (e) {
    console.error('[POST /question/:question_id/vote] error:', e);
    return res.status(500).send();
  }
});

router.delete('/question/:question_id/vote', async (req, res) => {
  try {
    const token = req.header('X-Authorization') || '';
    const questionID = Number(req.params.question_id);

    // 如果没有 token，则返回 401
    if (!token) {
      return res.status(401).send();
    }

    if (!Number.isInteger(questionID) || questionID <= 0) {
      return res.status(404).send();
    }

    const user = await loadUserByToken(token);
    if (!user) {
      return res.status(401).send();
    }

    const userID = user.user_id;

    // 检查用户是否已参与活动
    const sqlGetQ = 'SELECT question_id, event_id FROM questions WHERE question_id = ?';
    const question = await new Promise((resolve, reject) => {
      db.get(sqlGetQ, [questionID], (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!question) {
      return res.status(404).send();
    }

    // 检查用户是否是该问题所在活动的参与者
    const sqlIsAttendee = 'SELECT 1 FROM attendees WHERE event_id = ? AND user_id = ?';
    const isAttendee = await new Promise((resolve, reject) => {
      db.get(sqlIsAttendee, [question.event_id, userID], (err, row) => (err ? reject(err) : resolve(row)));
    });

    if (!isAttendee) {
      return res.status(403).json({ error_message: '只能取消投票参加的活动' });
    }

    // 检查用户是否已投票
    const sqlHasVoted = 'SELECT 1 FROM votes WHERE question_id = ? AND voter_id = ?';
    const hasVoted = await new Promise((resolve, reject) => {
      db.get(sqlHasVoted, [questionID, userID], (err, row) => (err ? reject(err) : resolve(!!row)));
    });

    if (!hasVoted) {
      return res.status(403).json({ error_message: '你没有投票，无法取消投票' });
    }

    // 取消投票：删除记录并更新票数
    const sqlDeleteVote = 'DELETE FROM votes WHERE question_id = ? AND voter_id = ?';
    db.run(sqlDeleteVote, [questionID, userID], function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send();
      }

      const sqlUpdateVotes = 'UPDATE questions SET votes = CASE WHEN votes > 0 THEN votes - 1 ELSE 0 END WHERE question_id = ?';
      db.run(sqlUpdateVotes, [questionID], function (errUpdate) {
        if (errUpdate) {
          console.error(errUpdate);
          return res.status(500).send();
        }
        return res.status(200).send();
      });
    });
  } catch (e) {
    console.error('[DELETE /question/:question_id/vote] error:', e);
    return res.status(500).send();
  }
});*/
// 投赞成票
router.post('/question/:question_id/vote', async (req, res) => {
    try {
      const token = req.header('X-Authorization') || '';
      if (!token) return res.status(401).send();

      const qid = Number(req.params.question_id);
      if (!Number.isInteger(qid) || qid <= 0) return res.status(404).send();

      const user = await loadUserByToken(token);
      if (!user) return res.status(401).send();
      const uid = user.user_id;

      // 问题是否存在
      const q = await new Promise((resolve, reject) => {
        db.get('SELECT question_id FROM questions WHERE question_id = ?', [qid],
          (e, r) => (e ? reject(e) : resolve(r)));
      });
      if (!q) return res.status(404).send();

      // 是否已投票（无论之前投的是赞成还是反对，只要投过就不允许再次投）
      const voted = await new Promise((resolve, reject) => {
        db.get('SELECT 1 FROM votes WHERE question_id = ? AND voter_id = ?',
          [qid, uid], (e, r) => (e ? reject(e) : resolve(!!r)));
      });
      if (voted) return res.status(403).json({ error_message: 'You have already voted on this question' });

      // 记录投票并加一分
      db.run('INSERT INTO votes (question_id, voter_id) VALUES (?, ?)', [qid, uid], function (insErr) {
        if (insErr) { console.error(insErr); return res.status(500).send(); }
        db.run('UPDATE questions SET votes = COALESCE(votes, 0) + 1 WHERE question_id = ?', [qid], function (updErr) {
          if (updErr) { console.error(updErr); return res.status(500).send(); }
          return res.status(200).send();
        });
      });
    } catch (e) {
      console.error('[POST /question/:question_id/vote] error:', e);
      return res.status(500).send();
    }
  });

  // 反对票：DELETE /question/:question_id/vote
  router.delete('/question/:question_id/vote', async (req, res) => {
    try {
      const token = req.header('X-Authorization') || '';
      if (!token) return res.status(401).send();

      const qid = Number(req.params.question_id);
      if (!Number.isInteger(qid) || qid <= 0) return res.status(404).send();

      const user = await loadUserByToken(token);
      if (!user) return res.status(401).send();
      const uid = user.user_id;

      // 问题是否存在
      const q = await new Promise((resolve, reject) => {
        db.get('SELECT question_id FROM questions WHERE question_id = ?', [qid],
          (e, r) => (e ? reject(e) : resolve(r)));
      });
      if (!q) return res.status(404).send();

      // 是否已投过任何票（已投则不允许再次投反对票）
      const voted = await new Promise((resolve, reject) => {
        db.get('SELECT 1 FROM votes WHERE question_id = ? AND voter_id = ?',
          [qid, uid], (e, r) => (e ? reject(e) : resolve(!!r)));
      });
      if (voted) return res.status(403).json({ error_message: 'You have already voted on this question' });

      // 记录投票并减一分
      db.run('INSERT INTO votes (question_id, voter_id) VALUES (?, ?)', [qid, uid], function (insErr) {
        if (insErr) { console.error(insErr); return res.status(500).send(); }
        db.run('UPDATE questions SET votes = COALESCE(votes, 0) - 1 WHERE question_id = ?', [qid], function (updErr) {
          if (updErr) { console.error(updErr); return res.status(500).send(); }
          return res.status(200).send();
        });
      });
    } catch (e) {
      console.error('[DELETE /question/:question_id/vote] error:', e);
      return res.status(500).send();
    }
  });

  app.use('/', router);
};
