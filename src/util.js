function portCheck (option) {
    if (typeof option !== 'number' || option <= 1024 || option > 65535) return Math.floor(Math.random() * (65535 - 1024) + 1024)
    return option
}

function uuid(option) {
    const uuidparts = []
    let i = 0
    for (i = 0; i < 32; i++) {
        // const random = Math.random() * 16 | 0
        const random = parseInt(option.crypto.randomBytes(4).toString('hex'), 16) / 4294967295 * 16 | 0

        if (i == 8 || i == 12 || i == 16 || i == 20) {
            uuidparts.push('-')
        }
        uuidparts.push( (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16))
    }
    return uuidparts.join('')
}

module.exports.uuidgen = function utiluuidgen(option) {
  const opt = typeof option === 'object' ? option : {}
  !opt.crypto && (opt.crypto = require('crypto'))
  return uuid(opt)
}

module.exports.portCheck = portCheck
