const net = require('net')
const point = new net.Server()

point.listen(4444)

point.on('end', function() {
  console.log('end args', arguments)
})

point.on('connection', function(socket) {
  socket.on('data', netbox(socket))
  socket.on('error', function() {
    console.log('socket on error args', arguments[0])
  })
})

point.on('close', function(dt) {
  console.log('point on close dt', dt)
})

point.on('error', function(dt) {
  console.log('point on error dt', dt)
})

function netbox (socket) {
  return function netreader (dt) {
    console.log('netreader dt', dt)
    const ct = Buffer.from([0])
    dt.copy(ct, 0, 0, 1)
    const vrsn = Buffer.from([0, 0])
    dt.copy(vrsn, 0, 1, 3)
    const lngth = dt.readUInt16BE(3)

    const msgtp = Buffer.from([0])
    dt.copy(msgtp, 0, 5, 6)
    if (ct.readUInt8() === 0x15) {
      console.log('netreader Alert is not handled yet, returning')
      return
    }
    const msglngth = dt.readUIntBE(6, 3)
    const msgdt = Buffer.alloc(msglngth)
    dt.copy(msgdt, 0, 9, msglngth - 1)
    console.log('contentType is ', contentType(ct))
    console.log('version is ', version(vrsn))
    console.log('length is valid', lngth + 5 === dt.length, dt.length, '/', lngth)
    console.log('message type is ', messageType(msgtp))
    console.log('message length ', msglngth)
    console.log('message data', messageHandler(msgtp)(msgdt))
    if (dt.length > msglngth + 9) {
      console.log('netreader dt optional mac or padding present')
    }
    socket.write('hello tls peer')
  }
}

function contentType (seq) {
  const option = {}
  option[0x14] = 'ChangeCipherSpec'
  option[0x15] = 'Alert'
  option[0x16] = 'Handshake'
  option[0x17] = 'Application'
  option[0x18] = 'Heartbeat'
  return option[seq.readUInt8()]
}

function messageType (seq) {
  const option = {
    '0': 'HelloRequest',
    '1': 'ClientHello',
    '2': 'ServerHello',
    '4': 'NewSessionTicket',
    '8': 'EncryptedExtensions',
    '11': 'Certificate',
    '12': 'ServerKeyExchange',
    '13': 'CertificateRequest',
    '14': 'ServerHelloDone',
    '15': 'CertificateVerify',
    '16': 'ClientKeyExchange',
    '20': 'Finished'
  }
  return option[seq.readUInt8()]
}

function messageHandler (messageType) {
  const option = {
    '1': clientHello,
  }
  return option[messageType.readUInt8()] || function (seq) {return seq}
}

function clientHello (seq) {
  let position = 2
  const legacyVersion = seq.subarray(0, position)
  position = 34
  const random = seq.subarray(2, position)
  position = seq.subarray(34, 35).readUInt8() + 35
  const legacySessionId = seq.subarray(35, position)
  const cipherSuites = decodeCipherSuites(35 + seq.subarray(34, 35).readUInt8(), seq)

  position = 35 + seq.subarray(34, 35).readUInt8() + seq.subarray(position, position + 2).readUInt16BE() + 2
  const cmlngth = seq.subarray(position , position + 1).readUInt8()
  position = position + 1
  const legacyCompressionMethods = seq.subarray(position, position + cmlngth)
  position = position + cmlngth
  const xseq = seq.subarray(position, seq.length)
  return {
    legacy_version: legacyVersion,
    random: random,
    legacy_session_id: legacySessionId,
    cipher_suites: cipherSuites,
    legacy_compression_methods: legacyCompressionMethods,
    extensions: decodeExtensions(xseq)
  }
}

function decodeCipherSuites (position, seq) {
  const cslngth = seq.subarray(position, position + 2).readUInt16BE()
  return seq.subarray(position + 2, position + 2 + cslngth).reduce((acc, cur) => {
    if (acc.length > 0) {
      if (acc[acc.length - 1].length === 1) {
        acc[acc.length - 1].push(cur.toString(16))
      } else {
        acc.push([cur.toString(16)])
      }
    } else {
      acc.push([cur.toString(16)])
    }
    return acc
  }, [])
}

function decodeExtensions (seq) {
  const lngth = seq.subarray(0, 2).readUInt16BE() // this is byte length
  const raw = seq.subarray(2, lngth)
  let position = 0
  const extensions = []
  do {
    const xnum = raw.subarray(position, position + 2).readUInt16BE()
    position += 2
    const xlngth = raw.subarray(position, position + 2).readUInt16BE()
    position += 2
    const data = raw.subarray(position, position + xlngth)
    extensions.push([xnum, xlngth, data])
    position += xlngth
  } while (position < raw.length)

  return extensions.reduce((acc, cur) => {
    const box = [cur[0], cur[1]]
    if (cur[0] === 0 ) {
      box.push(serverName(cur[2]))
    } else {
      box.push(cur[2])
    }
    acc.push(box)
    return acc
  }, [])
}

function serverName (seq) {
  const serverNameList = []
  let position = 0
  do {
    const recordlngth = seq.subarray(position, position + 2).readUInt16BE()
    position += 2
    const type = seq.subarray(position, position + 1).readUInt8()
    position += 1
    const dtlngth = seq.subarray(position, position + 2).readUInt16BE()
    position += 2
    const dt = seq.subarray(position, position + dtlngth)
    position += dtlngth
    if (recordlngth !== dtlngth + 3) {
      console.error('serverName record length missmatch', recordlngth, dtlngth + 1)
    }
    serverNameList.push([type, dt.toString()])
  } while (position < seq.length)
  return serverNameList
}

function version (seq) {
  return [seq.readUInt8(), seq.readUInt8(1)]
}
