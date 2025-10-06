const express = require("express");
const crypto = require('crypto');
const db = require("../../database");
module.exports = function(app){
    const router = express.Router();

router.post('/',(req,res) => 
{
    try
    {
        const {first_name, last_name, email, password} = req.body || {};
        if(!first_name || !last_name || !email || !password)
        {
            return res
            .status(400)
            .json({error_message: "存在错误信息1"});
        }
    
    const sql = `
        INSERT INTO users (first_name, last_name, email, password)
        VALUES (?, ?, ?, ?)
      `;
      db.run(sql,[first_name,last_name,email,password], function(err)
      {
        if(err)
        {
            return res
            .status(400)
            .json({error_message: "存在错误信息2"});
        }
        return res.status(201).json({user_id:this.lastID});
      });
    }
    catch(e)
    {
        return res.status(500).json({error_message:'服务器错误'});
    }
});
//app.use('/users',router);

app.post('/login',(req,res)=>
{
    try
    {
        const body = req.body || {};
        const keys = Object.keys(body);
        if(keys.length != 2 || !keys.includes('email') || !keys.includes('password'))
        {
            return res
            .status(400)
            .json({error_message: '登陆存在错误信息0' });
        }
        const {email,password} = body;
        if(!email || !password)
        {
            return res
            .status(400)
            .json({error_message:"登陆存在错误信息1"});
        }
        const getSql = `SELECT user_id,password,session_token FROM users WHERE email = ?`;
        db.get(getSql,[email],(err,row) => 
        {
            if(err)
            {
                return res
                .status(500)
                .json({error_message:"服务器错误"});
            }
            //密码不对或者没有
            if(!row || row.password !== password)
            {
                return res
                .status(400)
                .json({error_message:"登陆存在错误信息2"});
            }
            if (row.session_token) 
            {
                return res.status(200).json({user_id: row.user_id,session_token: row.session_token});
            }
            const session_token = crypto.randomBytes(16).toString('hex');

            //session_token写入数据库
            const updSql = `UPDATE users SET session_token = ? WHERE user_id = ?`;
            db.run(updSql,[session_token,row.user_id],function(updErr)
            {
                if(updErr)
                {
                    return res
                    .status(500)
                    .json({error_message:"服务器错误"});
                }
                return res.status(200).json({user_id:row.user_id,session_token});
            });
        });
    }
    catch(e)
    {
        return res
        .status(500)
        .json({error_message:"服务器错误"});
    }
});

app.post('/logout',(req,res)=>
{
    try
    {
        const token = req.header('X-Authorization');
        //res.set('X-Authorization', token);

        if(!token)
        {
            return res
            .status(401)
            .json({error_message:"缺少session_token"});
        }
        const getSql = `SELECT user_id FROM users WHERE session_token = ?`;
        db.get(getSql,[token],(err,row) =>
        {
            if(err)
            {
                return res
                .status(500)
                .json({error_message:"服务器错误"});
            }
            if(!row)
            {
                return res
                .status(401)
                .json({error_message:"无效的session_token或未登录"})
            }
        const clrSql = `UPDATE users SET session_token = NULL WHERE user_id = ?`;
        db.run(clrSql,[row.user_id],function(updErr)
        {
            if(updErr)
            {
                return res
                .status(500)
                .json({error_message:"服务器错误"});
         }
            return res.status(200).send();
        });
    });
    }
    catch(e)
    {
        return res
        .status(500)
        .json({error_message:"服务器错误"});
    }
});
app.use('/users',router);
};