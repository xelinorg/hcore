const http2 = require('http2')
const ancryptoo = require('../crypto/cryptoption')

const responseCallback = (headers, flags) => {
  console.log('response flags', flags)
  for (const name in headers) {
    console.log(`${name}: ${headers[name]}`)
  }
}
function onResponse (req, cb) {
  req.on('response', cb)
}

const errorCallback = (err) => {
  console.log('error is', err)
}
function onError (req, cb) {
  req.on('error', cb)
}

const goawayCallback = function () {
  console.log('goaway event fired with args', arguments)
}
function onGoAway (req, cb) {
  req.on('goaway', cb)
}

const closeCallback = function () {
  console.log('close event fired with args', arguments)
}
function onClose (req, cb) {
  req.on('close', cb)
}

const frameErrorCallback = (ferr) => {
  console.log('frameError is', ferr)
}
function onFrameError (req, cb) {
  req.on('frameError', cb)
}

const dataCallbackWrap = function (dataBuffer) {
  return function dataCallbackInner (chunk) {
    dataBuffer.push(chunk)
    //console.log('on data dataBuffer is :', dataBuffer.join('').split('<br/>').join('\n'))
  }
}
function onData (req, cb) {
  req.setEncoding('utf8')
  req.on('data', cb)
}

const endCallbackWrap = function (dataBuffer, conncounter) {
  return function endCallbackInner () {
    console.log('on end dataBuffer is :', dataBuffer.join('').split('<br/>').join('\n'))
    conncounter.pop()
    if (conncounter.length === 0){
      client.close()
    }
  }
}
function onEnd (req, cb) {
  req.on('end', cb )
}

function doRequest (reqArray) {
  reqArray.reduce((acc, cur)=>{
    acc.push(cur)
    return acc
  },[]).forEach(r => {
    onResponse(r, responseCallback)
    onError(r, errorCallback)
    onGoAway(r, goawayCallback)
    onClose(r, closeCallback)
    onFrameError(r, frameErrorCallback)
    const dtBuffer = []
    const dataCallback = dataCallbackWrap(dtBuffer)
    onData(r, dataCallback)
    const endCallback = endCallbackWrap(dtBuffer, reqArray)
    onEnd(r, endCallback)
    r.end()
  })
}

const client = http2.connect('https://server.hcore:4444', {
  ca: ancryptoo.ca
})

const req1 = client.request({ ':method': 'GET', ':path': '/hello?v=h2#alpha'})
const req2 = client.request({ ':method': 'GET', ':path': '/world?v=h2#beta'})

doRequest([req1, req2])
