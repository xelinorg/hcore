const crypto = require('crypto')

function portCheck (option) {
  if (typeof option !== 'number' || option <= 1024 || option > 65535) return Math.floor(Math.random() * (65535 - 1024) + 1024)
  return option
}

function uuid (option) {
  const uuidparts = []
  let i = 0
  for (i = 0; i < 32; i += 1) {
    // const random = Math.random() * 16 | 0
    const random = (parseInt(option.crypto.randomBytes(4).toString('hex'), 16) / 4294967295) * 16 | 0

    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuidparts.push('-')
    }
    if (i === 12) {
      uuidparts.push(4)
    }

    if (i === 16) {
      uuidparts.push(((random & 3) | 8).toString(16))
    } else {
      uuidparts.push(random)
    }

    // uuidparts.push((i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16))
  }
  return uuidparts.join('')
}

module.exports.uuidgen = function utiluuidgen (option) {
  const opt = typeof option === 'object' ? option : {}
  if (!opt.crypto) opt.crypto = crypto
  return uuid(opt)
}

module.exports.portCheck = portCheck
