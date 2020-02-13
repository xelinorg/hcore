const hcore = require('./src')

const dict = {
  use: {
    hcore: 'hcore'
  },
  global: {
    number: 'number',
    object: 'object',
    string: 'string'
  }
}

if (process.argv.length > 2 && Object.keys(dict.use).includes(process.argv[2])) {
  const ancryptoo = require('./crypto/cryptoption')
  const instance = process.argv[2]
  const port = process.argv[3] ? parseInt(process.argv[3]) : 0
  const opt = {
    instance: instance,
    port: port,
    ancryptoo: ancryptoo,
    dict: {
      global: dict.global,
      use: dict.use
    }
  }
  hcore.spawn(opt)
} else {
  module.exports.automnet = hcore
  module.exports.andict = hcore
}
