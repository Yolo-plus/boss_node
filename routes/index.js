var express = require('express')
var router = express.Router()
const md5 = require('blueimp-md5')
const { UserModel, ChatModel } = require('../db/models')
const filter = { password: 0, __v: 0 }  // 指定过滤的属性

/* 展示首页 */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' })
})

// 注册
router.post('/register', function (req, res) {
  const { username, password, type } = req.body

  // 查询
  UserModel.findOne({ username }, function (err, user) {
    if (user) {
      res.send({ code: 1, msg: '此用户已存在' })
    } else {
      // md5加密
      new UserModel({ username, type, password: md5(password) }).save(function (error, user) {
        res.cookie('userid', user._id, { maxAge: 1000 * 60 * 60 * 24 })

        const data = { username, type, _id: user._id }  // 响应数据中不要携带password
        res.send({ code: 0, data })
      })
    }
  })
})

// 登陆
router.post('/login', function (req, res) {
  const { username, password } = req.body

  UserModel.findOne({ username, password: md5(password) }, filter, function (err, user) {
    if (user) {
      res.cookie('userid', user._id, { maxAge: 1000 * 60 * 60 * 24 })

      res.send({ code: 0, data: user })
    } else {
      res.send({ code: 1, msg: '用户名或密码不正确' })
    }
  })
})

// 更新用户信息的
router.post('/update', function (req, res) {
  const userid = req.cookies.userid

  // 如果不存在, 直接返回一个提示信息
  if (!userid) {
    return res.send({ code: 1, msg: '请先登陆' })
  }
  // 存在, 根据userid更新对应的user文档数据
  // 得到提交的用户数据
  const user = req.body
  UserModel.findByIdAndUpdate({ _id: userid }, user, function (error, oldUser) {
    if (!oldUser) {
      // 通知浏览器删除userid cookie
      res.clearCookie('userid')
      // 返回返回一个提示信息
      res.send({ code: 1, msg: '请先登陆' })
    } else {
      // 准备一个返回的user数据对象
      const { _id, username, type } = oldUser
      const data = Object.assign({ _id, username, type }, user)

      res.send({ code: 0, data })
    }
  })
})

// 获取用户信息
router.get('/user', function (req, res) {
  const userid = req.cookies.userid

  // 如果不存在, 直接返回一个提示信息
  if (!userid) {
    return res.send({ code: 1, msg: '请先登陆' })
  }

  UserModel.findOne({ _id: userid }, filter, function (error, user) {
    if (user) {
      res.send({ code: 0, data: user })
    } else {
      // 通知浏览器删除userid cookie
      res.clearCookie('userid')
      res.send({ code: 1, msg: '请先登陆' })
    }

  })
})

// 获取用户列表
router.get('/userlist', function (req, res) {
  const { type } = req.query

  UserModel.find({ type }, filter, function (error, users) {
    res.send({ code: 0, data: users })
  })
})

// 获取当前用户所有相关聊天信息列表
router.get('/msglist', function (req, res) {
  const userid = req.cookies.userid

  // 查询得到所有user文档数组
  UserModel.find(function (err, userDocs) {
    // 用对象存储所有user信息: key为user的_id, val为name和header组成的user对象
    const users = userDocs.reduce((users, user) => {
      users[user._id] = { username: user.username, header: user.header }
      return users
    }, {})

    ChatModel.find({ '$or': [{ from: userid }, { to: userid }] }, filter, function (err, chatMsgs) {
      // 返回包含所有用户和当前用户相关的所有聊天消息的数据
      res.send({ code: 0, data: { users, chatMsgs } })
    })
  })
})

// 修改指定消息为已读
router.post('/readmsg', function (req, res) {
  const from = req.body.from
  const to = req.cookies.userid

  /*
    更新数据库中的chat数据
    参数1: 查询条件
    参数2: 更新为指定的数据对象
    参数3: 是否1次更新多条, 默认只更新一条
    参数4: 更新完成的回调函数
   */
  ChatModel.update({ from, to, read: false }, { read: true }, { multi: true }, function (err, doc) {
    res.send({ code: 0, data: doc.nModified }) // 更新的数量
  })
})

module.exports = router;
