var eiojson = require('eiojson')
  , _ = require('lodash')
  , uuid = require('node-uuid')
  ;

function success (obj, uuid) {
  return {extension: 'eiomethods', name:'_return', success:obj, uuid:uuid}
}

function failure (error, uuid) {
  error = error.message || error
  return {extension: 'eiomethods', name:'_return', error:error, uuid:uuid}
}

function keys (obj) {
  return _.filter(_.keys(obj), function (k) {return k.slice(0,1) !== '_'})
}

function binder (socket) {
  var exports = {}
    , pending = {}
    ;
  socket.export = function (name, fn) {
    exports[name] = fn
    socket.json({name:'_export', method:name, extension:'eiomethods'})
    return fn
  }

  socket.methods = {}

  function createRemoteInvoke (name) {
    function remoteInvoke () {
      var args = Array.prototype.slice.call(arguments)
        , cb = args.pop()
        , u = uuid()
        ;
      socket.json({name:name, args:args, uuid:u, extension:'eiomethods'})
      pending[u] = cb
    }
    return remoteInvoke
  }

  socket.on('json', function (obj) {
    if (obj.extension !== 'eiomethods') return
    if (obj.name.slice(0,1) === '_') {
      if (obj.name === '_list') return socket.json(success(keys(exports), obj.uuid))
      if (obj.name === '_export') return socket.methods[obj.method] = createRemoteInvoke(obj.method)
      if (obj.name === '_return') {
        if (typeof obj.error === 'string') obj.error = new Error(obj.error)
        pending[obj.uuid](obj.error, obj.success)
        delete pending[obj.uuid]
        return
      }
    }
    if (!obj.name || !obj.uuid || !obj.args) return socket.json(failure(new Error('Missing required arguments.'), obj.uuid))

    if (!exports[obj.name]) return socket.json(failure(new Error('Method does not exist'), obj.uuid))

    obj.args.push(function cb (err, o) {
      if (err) return socket.json(failure(err, obj.uuid))
      socket.json(success(o, obj.uuid))
    })

    exports[obj.name].apply(exports[obj.name], obj.args)
  })

  return socket
}

function bindServer (server) {
  server.on('connection', function (socket) {
    binder(socket)
  })
  return server
}

eiojson.wrap(eiojson.server, 'listen', bindServer)
eiojson.wrap(eiojson.server, 'attach', bindServer)

exports.server = eiojson.server
exports.client = function () {
  return binder(eiojson.client.apply(eiojson.client, arguments))
}

exports.binder = binder
exports.bindClient = binder
exports.bindServer = bindServer