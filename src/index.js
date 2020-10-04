const { spawn } = require('child_process')
const tls = require('tls')

const hcutil = require('./util')
const hcore = require('./hcore')
const hserver = require('./hserver')

function spawner (option) {
  const opt = {}
  const logger = option.logger || console
  opt.instance = option.instance
  opt.ancryptoo = option.ancryptoo
  opt.spawn = spawn
  opt.httpcore = hcore
  opt.port = option.port ? hcutil.portCheck(option.port) : undefined
  opt.dict = option.dict || {}
  if (opt.instance === opt.dict.use.hcore) {
    const hcopt = {
      ancryptoo: opt.ancryptoo,
      port: hcutil.portCheck(opt.port),
      ALPNProtocols: option.ALPNProtocols || ['h2', 'h2c'],
      tls
    }
    const hcoreInstance = hcore.createServer(hcopt)
    logger.debug('server spawned...port is '.concat(hcopt.port))
    return hcoreInstance
  }
  return {}
}

module.exports.spawn = spawner
module.exports.hcutil = hcutil
module.exports.hserver = hserver
