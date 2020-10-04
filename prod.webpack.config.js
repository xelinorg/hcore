const path = require('path')
const fs = require('fs')

const config = {}

config.entry = {
  index: './index.js'
}

config.target = 'node'

config.mode = 'production'

config.externals = fs
  .readdirSync(path.join(__dirname, 'node_modules'))
  .reduce((acc, mod) => {
    if (mod === '.bin') {
      return acc
    }
    acc[mod] = `commonjs ${mod}`
    return acc
  }, {})

config.resolve = {
  mainFields: ['module', 'main'],
  extensions: ['.js', '.json']
}

config.node = {
  console: false,
  global: false,
  process: false,
  Buffer: false,
  __filename: false,
  __dirname: false
}

config.output = {
  path: path.join(__dirname, 'build'),
  filename: 'hcore.js',
  library: 'hcore',
  libraryTarget: 'umd',
  umdNamedDefine: true
}

config.module = {}

module.exports = config
