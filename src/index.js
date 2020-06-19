const { spawn } = require("child_process")
const tls = require('tls')

const anutil = require('./util')
const hcore = require('./hcore')

function spawner (option) {
  const opt = {}
  opt.instance = option.instance
  opt.ancryptoo = option.ancryptoo
  opt.spawn = spawn
  opt.httpcore = hcore
  opt.port = option.port ? anutil.portCheck(option.port) : undefined
  opt.dict = option.dict || {}
  if (opt.instance === opt.dict.use.hcore) {
    const hcopt = {
      ancryptoo: opt.ancryptoo,
      port: anutil.portCheck(opt.port),
      ALPNProtocols: option.ALPNProtocols || ['h2', 'h2c'],
      tls: tls
    }
    const hcoreInstance = hcore.createServer(hcopt)
    console.debug('server spawned...');
    return hcoreInstance
  }
}

module.exports.spawn = spawner
