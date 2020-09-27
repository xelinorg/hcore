const hcore = require('./hcore')

function HServer (option) {
  this.server = hcore.createServer(option)
}

HServer.prototype.get = function hServerGet (path, callback) {
  this.server.addHook({
    method: 'GET',
    path,
    callback: (req, res, cb) => {
      if (callback) callback(req, res)
      if (cb) cb()
    }
  })
}

module.exports = HServer
