const htrace = require('./htrace')
const hpack = require('./hpack')

function createServer(option) {
  const cryptoo = option && typeof option.ancryptoo === 'object' ? option.ancryptoo : {}
  const opt = {}
  opt.key = cryptoo.key
  opt.cert = cryptoo.cert
  opt.ca = cryptoo.ca
  opt.port = option ? option.port : undefined
  opt.ALPNProtocols =  option.ALPNProtocols

  const hcs = new HCore()
  const tls = option && option.tls ? option.tls : null
  if (!tls) {
    return new Error('not tls provider')
  }
  const epoint = tls.createServer(opt)

  epoint.on(hcs.dict.on.newSession, opt.newSession || hcs.newSession.bind(hcs))

  epoint.on(hcs.dict.on.resumeSession, opt.resumeSession || hcs.resumeSession.bind(hcs))

  //epoint.on(reqproc.dict.on.keylog, opt.keylog || reqproc.keylog.bind(reqproc))

  epoint.on(hcs.dict.on.ocspRequest, opt.ocspRequest || hcs.ocspRequest.bind(hcs))

  epoint.on(hcs.dict.on.end, opt.end || hcs.end.bind(hcs))

  epoint.on(hcs.dict.on.secureConnection, opt.secureConnection || hcs.secureConnection.bind(hcs))

  epoint.on(hcs.dict.on.connection, opt.connection || hcs.connection.bind(hcs))

  epoint.listen(opt.port)

  return hcs
}

function createClient(option) {
  const o = option || {}
  const opt = {
    host: o.host,
    port: o.port,
    ca: o.ca,
    ALPNProtocols: o.ALPNProtocols
  }

  const hcc = new HCore()
  const connopt = {
    ca: opt.ca,
    ALPNProtocols: opt.ALPNProtocols,
    heckServerIdentity: opt.heckServerIdentity
  }
  const tls = option && option.tls ? option.tls : null
  if (!tls) {
    return new Error('not tls provider')
  }
  const epoint = tls.connect(opt.port, opt.host, connopt)

  epoint.on(hcc.dict.on.newSession, opt.newSession || hcc.newSession.bind(hcc))

  epoint.on(hcc.dict.on.resumeSession, opt.resumeSession || hcc.resumeSession.bind(hcc))

  epoint.on(hcc.dict.on.ocspRequest, opt.ocspRequest || hcc.ocspRequest.bind(hcc))

  epoint.on(hcc.dict.on.end, opt.end || hcc.end.bind(hcc))

  hcc.addSocket(epoint)
  return hcc
}

function HCore (option) {
  this.session = []
  this.socket = []
  this.trace = []
  this.dynamicTable = []
}

HCore.prototype.prefaceMarker = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n')

HCore.prototype.dict = {
  on: {
    connection: 'connection',
    error: 'error',
    data: 'data',
    end: 'end',
    exit: 'exit',
    newSession: 'newSession',
    resumeSession: 'resumeSession',
    keylog: 'keylog',
    ocspRequest: 'OCSPRequest',
    secureConnection: 'secureConnection'
  },
  global: {
    number: 'number',
    object: 'object',
    string: 'string'
  }
}

HCore.prototype.addSocket = function hCoreAddSocket (socket) {
  return this.socket.push(socket) - 1
}

HCore.prototype.errorCode = function hCoreErrorCode (raw) {
  const errorCodeOption = [
    ['NO_ERROR', 'The associated condition is not a result of an error. For example, a GOAWAY might include this code to indicate graceful shutdown of a connection.'],
    ['PROTOCOL_ERROR', 'The endpoint detected an unspecific protocol error. This error is for use when a more specific error code is not available.'],
    ['INTERNAL_ERROR', 'The endpoint encountered an unexpected internal error.'],
    ['FLOW_CONTROL_ERROR', 'The endpoint detected that its peer violated the flow-control protocol.'],
    ['SETTINGS_TIMEOUT', 'The endpoint sent a SETTINGS frame but did not receive a response in a timely manner. See Section 6.5.3 ("Settings Synchronization").'],
    ['STREAM_CLOSED', 'The endpoint received a frame after a stream was half-closed.'],
    ['FRAME_SIZE_ERROR', 'The endpoint received a frame with an invalid size.'],
    ['REFUSED_STREAM ', 'The endpoint refused the stream prior to performing any application processing (see Section 8.1.4 for details).'],
    ['CANCEL', 'Used by the endpoint to indicate that the stream is no longer needed.'],
    ['COMPRESSION_ERROR', 'The endpoint is unable to maintain the header compression context for the connection.'],
    ['CONNECT_ERROR', 'The connection established in response to a CONNECT request (Section 8.3) was reset or abnormally closed.'],
    ['ENHANCE_YOUR_CALM', 'The endpoint detected that its peer is exhibiting a behavior that might be generating excessive load.'],
    ['INADEQUATE_SECURITY', 'The underlying transport has properties that do not meet minimum security requirements (see Section 9.2).'],
    ['HTTP_1_1_REQUIRED', 'The endpoint requires that HTTP/1.1 be used instead of HTTP/2.']
  ]
  return raw >= 0x0 && raw <= 13 ? errorCodeOption[raw] : ['HCORE_INTERNAL_ERROR', 'Could not match any protocol CODE, conside not call this code if passed raw is not between 0 and 13']
}

HCore.prototype.frameType = function hCoreFrameType (typeBuffer) {
  const target = parseInt(typeBuffer.toString('hex'))
  const frameTypes = {}
  frameTypes[0x0] = 'h2_data', // DATA
  frameTypes[0x1] = 'h2_header', // HEADERS
  frameTypes[0x2] = 'h2_priority', // PRIORITY
  frameTypes[0x3] = 'h2_reset', // RST_STREAM
  frameTypes[0x4] = 'h2_setting', // SETTINGS
  frameTypes[0x5] = 'h2_promise', // PUSH_PROMISE
  frameTypes[0x6] = 'h2_ping', // PING
  frameTypes[0x7] = 'h2_goaway', // GOAWAY
  frameTypes[0x8] = 'h2_update', // WINDOW_UPDATE
  frameTypes[0x9] = 'h2_continuation' // CONTINUATION
  return frameTypes[target] || target
}

HCore.prototype.detecthttp = function hCoreDetecthttp (payload, handoverVersion) {
  if (!payload) return
  const h2prefaceIdx = payload.lastIndexOf(this.prefaceMarker)
  const cleanraw = h2prefaceIdx === 0 ? payload.slice(this.prefaceMarker.length, payload.length) : payload
  const hversion = handoverVersion || h2prefaceIdx >= 0 ? 'HTTP/2' : 'HTTP/1.x'
  return {
    hversion: hversion,
    frameStack: hversion === 'HTTP/2' ? this.frame(cleanraw) : [],
    raw: payload
  }
}

HCore.prototype.chopraw = function hCoreChopraw (raw) {
  const totalLength = raw.length
  let more = true
  let nextpoint = 0
  let nextlength = raw.slice(0, 3).readUIntBE(0, 3) + 9
  const frameStack = []
  do {
    frameStack.push(raw.slice(nextpoint, nextlength))

    if (nextlength < totalLength) {
      const nextlengthIdx = raw.slice(nextlength, nextlength + 3)
      nextpoint = nextlength
      nextlength = nextlength + nextlengthIdx.readUIntBE(0, 3) + 9
    } else {
      more = false
    }

  } while (more && nextlength <= totalLength)
  return frameStack
}

HCore.prototype.frameHandler = function hCoreFrameHandler (type) {
  const frameOption = {
    'raw': (inner) => inner,
    'h2_goaway': this.frameGoAway.bind(this),
    'h2_header': this.frameHeader.bind(this),
    'h2_data': this.frameData.bind(this),
    'h2_priority': this.framePriority.bind(this),
    'h2_setting': this.frameSetting.bind(this),
  }
  return frameOption[type] || frameOption['raw']
}

HCore.prototype.frame = function hCoreFrame (frameBuffer) {
  return  this.chopraw(frameBuffer).reduce( (acc, cur) => {
    const inner = cur.slice(9, cur.length)
    const type = this.frameType(cur.slice(3, 4))
    const flag = cur.slice(4, 5)
    acc.push(
      {
        rawlength: cur.length,
        datalength: cur.slice(0, 3).readUIntBE(0, 3),
        type: type,
        flags: flag,
        streamId: cur.slice(5, 9).readUIntBE(0, 4),
        cured: this.frameHandler(type)(inner, flag),
        raw: cur
      }
    )
    return acc
  }, [])
}

HCore.prototype.frameGoAway = function hCoreFrameGoAway (rawInner) {
  const goaway = {
    lastStreamId: rawInner.slice(0, 4).readUIntBE(0, 4),
    errorCode: rawInner.slice(4, 8).readUIntBE(0, 4),
    data: rawInner.slice(8, rawInner.length).toString(),
    raw: rawInner
  }
  !this.silent && (goaway.explain = this.errorCode (goaway.errorCode))
  return goaway
}

HCore.prototype.frameData = function hCoreFrameData(rawInner, flag) {
  // we should take care of padding first.. needs implementation
  return rawInner.toString()
}

HCore.prototype.framePriority = function hCoreFramePriority (rawInner) {
  return {
    depedency: rawInner.readUIntBE(0, 4),
    weigth: rawInner.readUInt8(4),
    raw: rawInner
  }
}

HCore.prototype.frameSetting = function hCoreFrameSetting (rawInner) {
  return rawInner.reduce((acc, cur) => {
    const next = acc.length
    if (!next || !acc[next-1] || acc[next-1].length != 2){
      acc.push([[cur],[]])
    } else if (acc[next-1][0].length >= 0 && acc[next-1][0].length < 2) {
      acc[next-1][0].push(cur)
    } else if (acc[next-1][0].length === 2 && acc[next-1][1].length < 4) {
      acc[next-1][1].push(cur)
    } else {
      acc.push([[cur],[]])
    }
    return acc
  }, []).reduce((acc, cur) => {
    acc.push({
      settingKey: Buffer.from(cur[0]).toString('hex'),
      settingValue: Buffer.from(cur[1]).readUIntBE(0, 4)/8,
      raw: cur
    })
    return acc
  }, [])
}

HCore.prototype.frameHeader = function hCoreFrameHeader (rawInner, flag) {
  let cleanHeaderField = rawInner
  const depedency = {}
  // we should take care of padding first.. needs implementation
  if (0x20 <= flag.readInt8()  && flag.readInt8() < 0x30 ) {
    depedency.stream = Buffer.from([
      rawInner[0] >= 0x80? rawInner[0] ^ 0x80 : rawInner[0],
      rawInner[1],
      rawInner[2],
      rawInner[3]]
    ).readUIntBE(0, 4)
    depedency.weigth = rawInner.readUInt8(4)

    cleanHeaderField = rawInner.slice(5, rawInner.length)
  }
  const decodedHeadField = hpack.headerFieldProcessor(cleanHeaderField, this.dynamicTable)

  return {depedency: depedency, headerField: decodedHeadField}
}

HCore.prototype.setting = function hCoreSetting (option) {
  if (option) {
    return Buffer.from(option)
  }
  return Buffer.from([0,0,0,4,0,0,0,0,0])
}

HCore.prototype.reset = function hCoreReset(socket) {
  if (socket) {
    socket.destroy()
  }
}

HCore.prototype.handoverPotocolToHVersion = function hCoreHandoverPotocolToHVersion (alpnProtocol) {
  const hversion = {
    httptwo: 'HTTP/2'
  }
  const option = {
    'h2': hversion.httptwo,
    'h2c': hversion.httptwo,
  }
  return option[alpnProtocol]
}

HCore.prototype.handover = function hCoreHandover (socket, connectmeta) {
  socket.on(this.dict.on.data, (data) => {
    this.tick(socket, data, this.handoverPotocolToHVersion(socket.alpnProtocol))
  })
  socket.on(this.dict.on.error, (err) => {
    this.reset(err)
  })
}

HCore.prototype.tick = function hCoreTick (socket, raw, handoverProtocol) {
  let socketIdx = this.socket.indexOf(socket)
  if ( socketIdx >= 0 ) {
    // socket is already in the stack, check for missing detection or discover if this
    // should be an error or continutation
    if (raw && this.trace[socketIdx][0] === socket) {
      const hversion = handoverProtocol || this.trace[socketIdx][1].hversion.toUpperCase()
      if (hversion === 'HTTP/2') {
        this.frame(raw).forEach(f=>this.trace[socketIdx][1].frame({frame:f, state:9}))
      } else {
        new Error('hCoreStart hversion is not defined on read error')
      }
    } else {
      new Error('hCoreStart socket miss match error')
    }
  } else {
    const detected = this.detecthttp(raw, handoverProtocol)
    socketIdx = this.socket.push(socket) - 1
    const traceIdx = this.trace.push([socket]) - 1
    const trace = htrace.createFactory()
    this.trace[traceIdx].push(trace)
    detected.frameStack.forEach(f=>this.trace[traceIdx][1].frame({frame:f, state:9}))
  }
  // check all went well
  if (this.trace[socketIdx][0] === socket && this.trace[socketIdx].length >= 1) {
    const trace = this.trace[socketIdx][1]
    const hversion = trace.hversion.toUpperCase()
    const helloMessage = 'hello http world'
    if (hversion === 'HTTP/2') {
      trace.frameTable.forEach(e => {
        if (e.state === 9 && e.frame.type === 'h2_header') {
          e.state = 0
          const h2hello = helloMessage.concat(e.frame.cured.headerField.reduce((dfacc, dfcur)=>{
            return dfacc.concat('<br/>'.concat(dfcur.decoded.join(' : ')))
          },''))
          this.sendSetting(socket)
          this.sendTextPayload(h2hello, e.frame.streamId, socket)
        }
      })
    } else {
      new Error('hCoreStart hversion is not defined on write error')
    }
  }
}

HCore.prototype.sendHello = function hCoreSendHello (socket, raw) {
  if (this.trace[socketIdx][0] === socket && this.trace[socketIdx].length >= 1) {
    const hversion = this.trace[socketIdx][1].toUpperCase()
    const helloMessage = 'hello http world'
    if (hversion === 'HTTP/2') {
      this.trace[socketIdx].forEach(e => {
        if (e.state === 9 && e.frame.type === 'h2_header') {
          e.state = 0
          const h2hello = helloMessage.concat(e.frame.cured.headerField.reduce((dfacc, dfcur)=>{
            return dfacc.concat('<br/>'.concat(dfcur.decoded.join(' : ')))
          },''))
          this.sendSetting(socket)
          this.sendTextPayload(h2hello, e.frame.streamId, socket)
        }
      })
    } else {
      new Error('hCoreStart hversion is not defined on write error')
    }
  }
}

HCore.prototype.sendSetting = function hCoreSendSetting (socket, raw) {
  return socket.write(typeof raw === this.dict.global.string ? raw : this.setting(raw))
}

HCore.prototype.encodeHeaderBlock = function hCoreEncodeHeaderBlock (header, starter) {
  return Object.keys(header).reduce((hacc, hcur) => {
    //this is very fake if the index is not found we set a string :/
    const headerIndexFieldName = hpack.staticTable.findIndex(hidx=>hidx[0]===hcur) + 1 || hcur
    const bufout = []
    const valBuffer = Buffer.from(header[hcur].toString())
    if (hacc && hacc.length > 0) {
      bufout.push(hacc)
    }
    bufout.push(
      Buffer.from(hpack.encodeInteger(headerIndexFieldName, 0xf)),
      Buffer.from(hpack.encodeInteger(valBuffer.length, 0x7f)),
      Buffer.from(valBuffer)
    )
    return Buffer.concat(bufout)
  }, starter)
}

HCore.prototype.sendTextPayload = function hCoreSendTextPayload (payload, streamId, socket) {
  const rawMsg = Buffer.from(payload || 'hello world')
  const rawStreamId = Buffer.from([0, 0, 0, streamId])

  const headerFlag = Buffer.from([4])
  const status200 = Buffer.from([(8 | 0x80)])
  const headerBlock = this.encodeHeaderBlock({
    'content-type': 'text/html; charset=UTF-8',
    'content-length': rawMsg.length
  }, status200)
  const headerLength = Buffer.from([0, 0, headerBlock.length])
  const headerFrameType = Buffer.from([1])
  const helloheader = Buffer.concat([headerLength, headerFrameType, headerFlag, rawStreamId, headerBlock])

  socket.write(helloheader)

  let dataFlag = Buffer.from([0])
  let done = false
  const fragSplitLength = 64
  let start = 0
  let frag
  do {
    if ((start + fragSplitLength) <= rawMsg.length) {
      frag = rawMsg.slice(start, start + fragSplitLength)
      start = start + fragSplitLength
    } else {
      frag = rawMsg.slice(start, rawMsg.length)
      done = true
      dataFlag = Buffer.from([1])
    }
    const fragLength = Buffer.from([0, 0, frag.length])
    const dataFrameType = Buffer.from([0])
    socket.write(Buffer.concat([fragLength, dataFrameType, dataFlag, rawStreamId, frag]))
  } while (!done)
}

HCore.prototype.request = function hCoreRequest(option) {
  if (!option) return
  const idx = option.idx || 0
  const nextStreamId = this.trace[idx] >= 1 ? this.trace[idx][1].getStream() : 1
  const rawStreamId = Buffer.from([0, 0, 0, nextStreamId])
  const headerFlag = Buffer.from([4])
  const headerBlock = this.encodeHeaderBlock(option.header)
  const headerLength = Buffer.from([0, 0, headerBlock.length])
  const headerFrameType = Buffer.from([1])
  const headerFrame = Buffer.concat([headerLength, headerFrameType, headerFlag, rawStreamId, headerBlock])
  this.socket[idx].write(headerFrame)
}

HCore.prototype.reply = function hCoreReply(option) {

}

// upper socket aka tls, start
HCore.prototype.newSession = function hCoreNewSession (sessionId, sessionData, callback) {
  const session = {}
  const sessionid = sessionId.toString('hex')
  session[sessionid] = sessionData
  this.session.push(session)
  return callback()
}

HCore.prototype.resumeSession = function hCoreResumeSession (sessionId, callback) {
  const sessionData = this.session.reduce((acc, curr) => {
    if (Object.keys(curr)[0] === sessionId.toString('hex')) {
      acc = curr[sessionId.toString('hex')]
    }
    return acc
  }, null)
  return callback(null, sessionData)
}

HCore.prototype.keylog = function hCoreKeylog (line, socket) {
  console.log('HCoreKeylog line toString', line.toString(), 'for socket', socket._tlsOptions.server.sessionIdContext)
}

HCore.prototype.ocspRequest = function hCoreOcspRequest (certificate, issuer, callback) {
  //console.log('HCoreOcspRequest certificate, issuer to string', certificate.toString(), issuer.toString())
  callback(null, null)
}

HCore.prototype.end = function hCoreEnd (socket) {
  this.reset(socket)
}

HCore.prototype.connection = function hCoreConnection (socket) {
  this.handover(socket, 'plain')
}

HCore.prototype.secureConnection = function hCoreSecureConnection (socket) {
  this.handover(socket, 'secure')
}
// upper socket aka tls, end

module.exports.createServer = createServer

module.exports.createClient = createClient

module.exports.HCore = HCore
