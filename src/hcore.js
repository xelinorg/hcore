const htrace = require('./htrace')
const hpack = require('./hpack')

const dict = {
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
    string: 'string',
    hex: 'hex'
  },
  hone: {
    versionx: 'HTTP/1.x'
  },
  htwo: {
    version: 'HTTP/2',
    frame: {
      raw: Symbol('h2-raw'),
      data: Symbol('h2-data'),
      header: Symbol('h2-header'),
      priority: Symbol('h2-priority'),
      resetstream: Symbol('h2-rest-strean'),
      setting: Symbol('h2-setting'),
      pushpromise: Symbol('h2-push-promise'),
      ping: Symbol('h2-ping'),
      goaway: Symbol('h2-goaway'),
      windowupdate: Symbol('h2-window-update'),
      continuation: Symbol('h2-continuation')
    }
  }
}

Object.seal(dict)

function HCore () {
  this.session = []
  this.socket = []
  this.trace = []
  this.dynamicTable = []
  this.hook = []
  this.logger = console
}

HCore.prototype.prefaceMarker = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n')

HCore.prototype.dict = dict

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

HCore.prototype.frameTypeVariant = {
  0x0: dict.htwo.frame.data, // DATA
  0x1: dict.htwo.frame.header, // HEADERS
  0x2: dict.htwo.frame.priority, // PRIORITY
  0x3: dict.htwo.frame.resetstream, // RST_STREAM
  0x4: dict.htwo.frame.setting, // SETTINGS
  0x5: dict.htwo.frame.pushpromise, // PUSH_PROMISE
  0x6: dict.htwo.frame.ping, // PING
  0x7: dict.htwo.frame.goaway, // GOAWAY
  0x8: dict.htwo.frame.windowupdate, // WINDOW_UPDATE
  0x9: dict.htwo.frame.continuation // CONTINUATION
}

HCore.prototype.frameType = function hCoreFrameType (typeBuffer) {
  const target = parseInt(typeBuffer.toString(this.dict.global.hex), 16)
  return this.frameTypeVariant[target] || target
}

HCore.prototype.detecthttp = function hCoreDetecthttp (payload, handoverVersion) {
  if (!payload) return {}
  const h2v = this.dict.htwo.version
  const h2prefaceIdx = payload.lastIndexOf(this.prefaceMarker)
  const cleanraw = h2prefaceIdx === 0
    ? payload.slice(this.prefaceMarker.length, payload.length)
    : payload
  const hversion = handoverVersion || h2prefaceIdx >= 0 ? h2v : this.dict.hone.versionx
  return {
    hversion,
    frameStack: hversion === h2v ? this.frame(cleanraw) : [],
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

HCore.prototype.flagHandler = function hCoreFlagHandler (type) {
  const option = {}
  const raw = (inner) => inner
  const h2fd = this.dict.htwo.frame
  option[h2fd.raw] = raw
  option[h2fd.data] = this.frameDataFlag.bind(this)
  option[h2fd.header] = this.frameHeaderFlag.bind(this)
  option[h2fd.priority] = raw
  option[h2fd.resetstream] = raw
  option[h2fd.setting] = this.frameSettingFlag.bind(this)
  option[h2fd.pushpromise] = raw
  option[h2fd.ping] = raw
  option[h2fd.goaway] = raw
  option[h2fd.windowupdate] = raw
  option[h2fd.continuation] = raw
  return option[type] || option[h2fd.raw]
}

HCore.prototype.frameHeaderFlag = function hCoreFrameHeaderFlag (raw) {
  const END_STREAM = 0x1
  const END_HEADERS = 0x4
  const PADDED = 0x8
  const PRIORITY = 0x20
  const rawint = raw.readUInt8()
  return {
    endStream: (rawint & END_STREAM) === END_STREAM,
    endHeaders: (rawint & END_HEADERS) === END_HEADERS,
    padded: (rawint & PADDED) === PADDED,
    priority: (rawint & PRIORITY) === PRIORITY,
    raw
  }
}

HCore.prototype.frameDataFlag = function hCoreFrameHeaderFlag (raw) {
  const END_STREAM = 0x1
  const PADDED = 0x8
  const rawint = raw.readUInt8()
  return {
    endStream: (rawint & END_STREAM) === END_STREAM,
    padded: (rawint & PADDED) === PADDED,
    raw
  }
}

HCore.prototype.frameSettingFlag = function hCoreFrameHeaderFlag (raw) {
  const ACK = 0x1
  const rawint = raw.readUInt8()
  return {
    acknowledge: (rawint & ACK) === ACK,
    raw
  }
}

HCore.prototype.frameHandler = function hCoreFrameHandler (type) {
  const option = {}
  const raw = (inner) => inner
  const h2fd = this.dict.htwo.frame

  option[h2fd.raw] = raw
  option[h2fd.data] = this.frameData.bind(this)
  option[h2fd.header] = this.frameHeader.bind(this)
  option[h2fd.priority] = this.framePriority.bind(this)
  option[h2fd.resetstream] = raw
  option[h2fd.setting] = this.frameSetting.bind(this)
  option[h2fd.pushpromise] = raw
  option[h2fd.ping] = raw
  option[h2fd.goaway] = this.frameGoAway.bind(this)
  option[h2fd.windowupdate] = raw
  option[h2fd.continuation] = raw

  return option[type] || option[h2fd.raw]
}

HCore.prototype.frame = function hCoreFrame (frameBuffer) {
  return this.chopraw(frameBuffer).reduce((acc, cur) => {
    const inner = cur.slice(9, cur.length)
    const type = this.frameType(cur.slice(3, 4))
    const flag = this.flagHandler(type)(cur.slice(4, 5))
    acc.push(
      {
        rawlength: cur.length,
        datalength: cur.slice(0, 3).readUIntBE(0, 3),
        type,
        flag,
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
  if (!this.silent) {
    return {
      ...goaway,
      explain: this.errorCode(goaway.errorCode)
    }
  }
  return goaway
}

HCore.prototype.frameData = function hCoreFrameData (rawInner) {
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
    if (!next || !acc[next - 1] || acc[next - 1].length !== 2) {
      acc.push([[cur], []])
    } else if (acc[next - 1][0].length >= 0 && acc[next - 1][0].length < 2) {
      acc[next - 1][0].push(cur)
    } else if (acc[next - 1][0].length === 2 && acc[next - 1][1].length < 4) {
      acc[next - 1][1].push(cur)
    } else {
      acc.push([[cur], []])
    }
    return acc
  }, []).reduce((acc, cur) => {
    acc.push({
      settingKey: Buffer.from(cur[0]).toString('hex'),
      settingValue: Buffer.from(cur[1]).readUIntBE(0, 4) / 8,
      raw: cur
    })
    return acc
  }, [])
}

HCore.prototype.frameHeader = function hCoreFrameHeader (rawInner, flag) {
  let cleanHeaderField = rawInner
  const depedency = {}
  // we should take care of padding first.. needs implementation
  if (flag.raw.readInt8() >= 0x20 && flag.raw.readInt8() < 0x30) {
    depedency.stream = Buffer.from([
      rawInner[0] >= 0x80 ? rawInner[0] ^ 0x80 : rawInner[0],
      rawInner[1],
      rawInner[2],
      rawInner[3]]).readUIntBE(0, 4)

    depedency.weigth = rawInner.readUInt8(4)

    cleanHeaderField = rawInner.slice(5, rawInner.length)
  }
  const decodedHeadField = hpack.headerFieldProcessor(cleanHeaderField, this.dynamicTable)

  return { depedency, headerField: decodedHeadField }
}

HCore.prototype.setting = function hCoreSetting (option) {
  if (option) {
    return Buffer.from(option)
  }
  // 4 is the setting frame type and 1 means we acknowledge the settings
  return Buffer.from([0, 0, 0, 4, 1, 0, 0, 0, 0])
}

HCore.prototype.reset = function hCoreReset (socket) {
  if (socket) {
    socket.destroy()
  }
}

HCore.prototype.handoverPotocolToHVersion = function hCoreHandoverPotocolToHVersion (alpnProtocol) {
  const hversion = {
    httptwo: this.dict.htwo.version
  }
  const option = {
    h2: hversion.httptwo,
    h2c: hversion.httptwo
  }
  return option[alpnProtocol]
}

HCore.prototype.handover = function hCoreHandover (socket, connectmeta) {
  if (socket.alpnProtocol && socket.alpnProtocol === 'h2' && connectmeta === 'secure') {
    const socketIdx = this.socket.push(socket) - 1
    // should wire more events here
    socket.on(this.dict.on.data, (data) => {
      this.tick(socketIdx, data, this.handoverPotocolToHVersion(socket.alpnProtocol))
    })
    socket.on(this.dict.on.error, (err) => {
      this.logger.log(err)
      this.reset(socket)
    })
  }
}

HCore.prototype.tick = function hCoreTick (socketIdx, raw, handoverProtocol) {
  const socketTraceInstance = this.trace[socketIdx]
  const tickState = {
    socketIdx,
    traceSocket: socketTraceInstance ? socketTraceInstance[0] : undefined,
    traceInstance: socketTraceInstance ? socketTraceInstance[1] : undefined
  }
  let stateTickTrace = tickState.traceSocket && tickState.traceInstance
  if (stateTickTrace) {
    // socket is already in the stack
    this.frame(raw).forEach((f) => tickState.traceInstance.frameIn(f))
  } else {
    const detected = this.detecthttp(raw, handoverProtocol)
    this.trace.push([this.socket[tickState.socketIdx]])
    this.trace[tickState.socketIdx].push(htrace.createFactory({
      socket: this.socket[tickState.socketIdx],
      frameSymbol: dict.htwo.frame
    }))

    const [traceSocket, traceInstance] = this.trace[tickState.socketIdx]

    tickState.traceSocket = traceSocket
    tickState.traceInstance = traceInstance
    detected.frameStack.forEach((detectedFrame) => tickState.traceInstance.frameIn(detectedFrame))
    stateTickTrace = true
  }
  // check all went well we should acknowledge the settings for this connection if
  // have not done so
  if (stateTickTrace && tickState.traceInstance.alive) {
    tickState.traceInstance.frameOut({
      sendSetting: this.sendSetting.bind(this)
    })

    tickState.traceInstance.frameTable.forEach((frame) => {
      if (
        frame.type === this.dict.htwo.frame.header
        && frame.state !== 9
        && frame.flag.endStream
        && frame.flag.endHeaders
      ) {
        const sendbind = this.send.bind(this)
        const endbind = this.end.bind(this)
        setTimeout(() => {
          const send = this.hook.reduce((acc, cur) => {
            let found = acc
            const headerField = frame.cured.headerField.find(
              (hf) => hf.decoded[0] === ':path' && hf.decoded[1] === cur.path
            )
            if (headerField) {
              const req = {
                header: headerField
              }
              let hookHeaders = {}
              const res = {
                setHeader: (upperHookHeaders) => {
                  hookHeaders = upperHookHeaders
                },
                send: (body) => {
                  sendbind(hookHeaders, body, frame.streamId, tickState.traceSocket)
                },
                end: (code) => {
                  endbind(tickState.traceSocket, code)
                }
              }
              cur.callback(req, res, () => {
                found += 1
              })
              headerField.state = 9
            }
            return found
          }, 0)
          if (!send) this.notFound(tickState.traceSocket, frame.streamId)
        }, 0)
      }
    })
  }
}

HCore.prototype.sendSetting = function hCoreSendSetting (socket, raw) {
  return socket.write(typeof raw === 'string' ? raw : this.setting(raw))
}

HCore.prototype.encodeHeaderBlock = function hCoreEncodeHeaderBlock (header, starter) {
  return Object.keys(header).reduce((hacc, hcur) => {
    // this is very fake if the index is not found we set a string :/
    const headerIndexFieldName = hpack.staticTable.findIndex((hidx) => hidx[0] === hcur) + 1 || hcur
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

HCore.prototype.headerFrame = function hCoreHeaderFrame (
  streamId,
  statusIdx,
  header,
  payload,
  mimetype
) {
  const rawStreamId = Buffer.from([0, 0, 0, streamId])
  const headerFlag = Buffer.from([1 | 4])
  const status = Buffer.from([(statusIdx | 0x80)])
  const transHeader = header || {}
  if (payload) {
    transHeader['content-type'] = mimetype || 'text/html; charset=UTF-8'
    transHeader['content-length'] = payload.length
  }
  const headerBlock = this.encodeHeaderBlock(transHeader, status)
  const headerLength = Buffer.from([0, 0, headerBlock.length])
  const headerFrameType = Buffer.from([1])
  return Buffer.concat([headerLength, headerFrameType, headerFlag, rawStreamId, headerBlock])
}

HCore.prototype.send = function hCoreSend (header, payload, streamId, socket) {
  let bodyPayload
  if (header['content-type'] === 'application/json') {
    bodyPayload = Buffer.from(JSON.stringify(payload))
  } else if (header['content-type'] === 'image/x-icon') {
    bodyPayload = Buffer.from(payload, 'base64')
  } else {
    bodyPayload = Buffer.from(payload)
  }

  const saneHeader = {
    ...header,
    'content-length': bodyPayload.length
  }

  if (!header['content-type']) saneHeader['content-type'] = 'text/html; charset=UTF-8'

  const rawStreamId = Buffer.from([0, 0, 0, streamId])

  const headerFlag = Buffer.from([4])
  const status200 = Buffer.from([(8 | 0x80)])

  const headerBlock = this.encodeHeaderBlock(saneHeader, status200)
  const headerLength = Buffer.from([0, 0, headerBlock.length])
  const headerFrameType = Buffer.from([1])
  const bufferedHeader = Buffer.concat([
    headerLength,
    headerFrameType,
    headerFlag,
    rawStreamId,
    headerBlock
  ])

  socket.write(bufferedHeader)

  let dataFlag = Buffer.from([0])
  let done = false
  const fragSplitLength = 64
  let start = 0
  let frag
  do {
    if ((start + fragSplitLength) <= bodyPayload.length) {
      frag = bodyPayload.slice(start, start + fragSplitLength)
      start += fragSplitLength
    } else {
      frag = bodyPayload.slice(start, bodyPayload.length)
      done = true
      dataFlag = Buffer.from([1])
    }
    const fragLength = Buffer.from([0, 0, frag.length])
    const dataFrameType = Buffer.from([0])
    socket.write(Buffer.concat([fragLength, dataFrameType, dataFlag, rawStreamId, frag]))
  } while (!done)
}

HCore.prototype.addHook = function hCoreAddHook (option) {
  this.hook.push(option)
}

HCore.prototype.notFound = function hCoreNotFound (socket, streamId) {
  // 12 points to an hpack static table header and more specifically the 400 status
  socket.write(this.headerFrame(streamId, 13))
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
  const sessionData = this.session.find((sessionInstance) => {
    if (Object.keys(sessionInstance)[0] === sessionId.toString('hex')) {
      return true
    }
    return false
  })
  return callback(null, sessionData)
}

HCore.prototype.keylog = function hCoreKeylog (line, socket) {
  this.logger.debug(
    'hCoreKeylog',
    line.toString(),
    socket.localAddress,
    socket.localPort,
    socket.remoteAddress,
    socket.remotePort,
    socket.remoteFamily
  )
}

HCore.prototype.ocspRequest = function hCoreOcspRequest (certificate, issuer, callback) {
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

function createServer (option) {
  const cryptoo = option && typeof option.ancryptoo === 'object' ? option.ancryptoo : {}
  const opt = {}
  opt.key = cryptoo.key
  opt.cert = cryptoo.cert
  opt.ca = cryptoo.ca
  opt.port = option ? option.port : undefined
  opt.ALPNProtocols = option.ALPNProtocols

  const hcs = new HCore()
  const tls = option && option.tls ? option.tls : null
  if (!tls) {
    return new Error('not tls provider')
  }
  const epoint = tls.createServer(opt)

  epoint.on(hcs.dict.on.newSession, opt.newSession || hcs.newSession.bind(hcs))

  epoint.on(hcs.dict.on.resumeSession, opt.resumeSession || hcs.resumeSession.bind(hcs))

  epoint.on(hcs.dict.on.keylog, opt.keylog || hcs.keylog.bind(hcs))

  epoint.on(hcs.dict.on.ocspRequest, opt.ocspRequest || hcs.ocspRequest.bind(hcs))

  epoint.on(hcs.dict.on.end, opt.end || hcs.end.bind(hcs))

  epoint.on(hcs.dict.on.secureConnection, opt.secureConnection || hcs.secureConnection.bind(hcs))

  epoint.on(hcs.dict.on.connection, opt.connection || hcs.connection.bind(hcs))

  epoint.listen(opt.port)

  return hcs
}

module.exports.createServer = createServer

module.exports.HCore = HCore
