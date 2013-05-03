var eiomethods = require('./index')
  , cleanup = require('cleanup')
  , assert = require('assert')
  , ok = require('okdone')
  , eioemitter = require('eioemitter')
  , engine = require('engine.io')
  , client = require('engine.io-client')
  ;

var d = cleanup(function (error) {
  if (error) process.exit(1)
  ok.done()
  process.exit()
})

function binder (socket) {
  socket.export('test', function (x, y, z, cb) {
    assert.equal(x, 0)
    assert.equal(y, 1)
    assert.equal(z, 2)
    cb(null, {test:1})
  })
  socket.export('testFuture', function (cb) {
    setTimeout(cb.bind(cb, null, 1), 10)
  })
  socket.export('testError', function (cb) {
    cb(new Error('test'))
  })
  return socket
}

var completed = 0
function check (name) {
  ok(name)
  completed += 1
  if (completed === 6) d.cleanup()
}

function test (c) {
  c.methods.test(0, 1, 2, function (error, success) {
    if (error) throw error
    assert.deepEqual(success, {test:1})
    check('test')
  })
  c.methods.testFuture(function (error, s) {
    if (error) throw error
    assert.equal(s, 1)
    check('testFuture')
  })
  c.methods.testError(function (err, s) {
    assert.ok(!s)
    assert.equal(err.message, 'test')
    check('testError')
  })
  return c
}

var s = engine.listen(8080, function () {
  var c = eiomethods(client('ws://localhost:8080'))

  var ee = eioemitter(c)
  ee.on('ready', function () {
    test(c)
  })
  binder(c)
  ee.emit('ready')

})

s.on('connection', function (c) {
  eiomethods(c)
  var ee = eioemitter(c)
  ee.on('ready', function () {
    test(c)
  })
  binder(c)
  ee.emit('ready')
})
