const http2 = require('http2')
const ancryptoo = require('../crypto/cryptoption')

const logger = console

const client = http2.connect('https://server.hcore:4444', {
  ca: ancryptoo.ca
})

const responseCallback = (...rest) => {
  const [headers, flags] = rest
  logger.log('responseCallback arguments', ...rest)
  logger.log('flags', flags)
  Object.keys(headers).forEach((key) => logger.log(`${key}: ${headers[key]}`))
}

function onResponse (req, cb) {
  req.on('response', cb)
}

const errorCallback = (err) => {
  logger.log('error is', err)
}
function onError (req, cb) {
  req.on('error', cb)
}

const goawayCallback = (...rest) => {
  logger.log('goaway event fired with args', ...rest)
}
function onGoAway (req, cb) {
  req.on('goaway', cb)
}

const closeCallback = (...rest) => {
  logger.log('close event fired with args', ...rest)
}
function onClose (req, cb) {
  req.on('close', cb)
}

const frameErrorCallback = (ferr) => {
  logger.log('frameError is', ferr)
}
function onFrameError (req, cb) {
  req.on('frameError', cb)
}

const dataCallbackWrap = (dataBuffer) => (chunk) => dataBuffer.push(chunk)

function onData (req, cb) {
  req.setEncoding('utf8')
  req.on('data', cb)
}

const endCallbackWrap = (dataBuffer, conncounter) => () => {
  logger.log('on end dataBuffer is :', dataBuffer.join('').split('<br/>').join('\n'))
  conncounter.pop()
  if (conncounter.length === 0) {
    client.close()
  }
}

function onEnd (req, cb) {
  req.on('end', cb)
}

function doRequest (reqArray) {
  reqArray.reduce((acc, cur) => {
    acc.push(cur)
    return acc
  }, []).forEach((r) => {
    onError(r, errorCallback)
    onFrameError(r, frameErrorCallback)
    onGoAway(r, goawayCallback)
    onClose(r, closeCallback)
    onResponse(r, responseCallback)
    const dtBuffer = []
    const dataCallback = dataCallbackWrap(dtBuffer)
    onData(r, dataCallback)
    const endCallback = endCallbackWrap(dtBuffer, reqArray)
    onEnd(r, endCallback)
    // r.end()
  })
}

const req1 = client.request({ ':method': 'GET', ':path': '/html' })
const req2 = client.request({ ':method': 'GET', ':path': '/json' })

doRequest([req1, req2])
