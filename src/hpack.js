const hnode = require('./hnode').createFactory()

const hnoderoot = hnode.buildTree(hnode.HUFFMAN_CODES, hnode.HUFFMAN_CODE_LENGTHS)

const staticTable = [
  [':authority'],
  [':method', 'GET'],
  [':method', 'POST'],
  [':path', '/'],
  [':path', '/index.html'],
  [':scheme', 'http'],
  [':scheme', 'https'],
  ['status', '200'],
  ['status', '204'],
  ['status', '206'],
  ['status', '304'],
  ['status', '400'],
  ['status', '404'],
  ['status', '500'],
  ['accept-charset'],
  ['accept-encoding', 'gzip, deflate'],
  ['accept-language'],
  ['accept-ranges'],
  ['accept'],
  ['access-control-allow-origin'],
  ['age'],
  ['allow'],
  ['authorization'],
  ['cache-control'],
  ['content-disposition'],
  ['content-encoding'],
  ['content-language'],
  ['content-length'],
  ['content-location'],
  ['content-range'],
  ['content-type'],
  ['cookie'],
  ['date'],
  ['etag'],
  ['expect'],
  ['expires'],
  ['from'],
  ['host'],
  ['if-match'],
  ['if-modified-since'],
  ['if-none-match'],
  ['if-range'],
  ['if-unmodified-since'],
  ['last-modified'],
  ['link'],
  ['location'],
  ['max-forwards'],
  ['proxy-authenticate'],
  ['proxy-authorization'],
  ['range'],
  ['referer'],
  ['refresh'],
  ['retry-after'],
  ['server'],
  ['set-cookie'],
  ['strict-transport-security'],
  ['transfer-encoding'],
  ['user-agent'],
  ['vary'],
  ['via'],
  ['www-authenticate']
]

const prefixMatrix = {
  indexedHeaderFieldRepresentation: 0x7f,
  literalHeaderFieldWithIncrementalIndexing: 0x40,
  literalHeaderFieldWithoutIndexing: 0x8,
  literalHeaderFieldNeverIndexed: 0x10
}

function extendPrefixWithInteger (intVal, prefix) {
  const extendedInt = []
  extendedInt.push(prefix)
  let intext = intVal - prefix
  while (intext >= 0x80) {
    extendedInt.push(((intext % 0x80) + 0x80))
    intext /= 0x80
  }
  extendedInt.push(intext)
  return Uint8Array.from(extendedInt)
}

function encodeInteger (intVal, prefix) {
  // should not encode zero and the prefix should be between 1 and 8
  if (intVal < prefix) {
    return Uint8Array.from([intVal])
  }
  return extendPrefixWithInteger(intVal, prefix)
}

function decodeInteger (codelist, prefix) {
  const bitseq = codelist
  let i = bitseq[0]
  if (i < prefix && codelist.length === 1) {
    return i
  }

  let oct = 1
  let m = 0
  let b
  do {
    b = bitseq[oct]
    i += (b & 0x7f) * 2 ** m
    m += 7
    oct += 1
  } while ((b & 0x80) === 0x80)
  return i
}

function expandByte (byte) {
  return [byte, byte.toString(16), byte.toString(2)]
}

function flagPrefixBoundary (intVal, prefix) {
  const mask = (prefix >> 1) ^ prefix
  return intVal | mask
}

function fixprefix (prefix) {
  if (prefix === 0xff) {
    return 0x7f
  }
  if (prefix === 0x7f) {
    return 0x3f
  }
  if (prefix === 0x3f) {
    return 0x1f
  }
  if (prefix === 0x1f) {
    return 0x0f
  }
  if (prefix === 0x0f) {
    return 0x0f
  }
  return 0x00
}

function readHuffman (literalBuf) {
  const baos = []
  const root = hnoderoot
  let node = root
  let current = 0
  let bits = 0
  for (let i = 0; i < literalBuf.length; i += 1) {
    const b = literalBuf[i] & 0xFF
    current = (current << 8) | b
    bits += 8
    while (bits >= 8) {
      const c = (current >>> (bits - 8)) & 0xFF
      node = node.children[c]
      bits -= node.bits
      if (node.isTerminal()) {
        if (node.symbol === 256) {
          throw new Error('EOS_DECODED')
        }
        baos.push(node.symbol)
        node = root
      }
    }
  }

  while (bits > 0) {
    const c = (current << (8 - bits)) & 0xFF
    if (!node.isTerminal()) {
      node = node.children[c]
    }
    if (node.isTerminal() && node.bits <= bits) {
      bits -= node.bits
      baos.push(node.symbol)
    } else {
      break
    }
  }

  const mask = (1 << bits) - 1
  if ((current & mask) !== mask) {
    throw new Error('INVALID_PADDING')
  }
  return baos
}

function maskHuffmanBit (buffer) {
  return buffer.reduce((nlacc, nlcur, idx) => {
    if (idx) {
      nlacc.push(nlcur)
    } else {
      nlacc.push(nlcur ^ 0x80)
    }
    return nlacc
  }, [])
}

function headerField (current) {
  return {
    prefix: current,
    indexed: [],
    name: {
      nlength: [],
      octets: []
    },
    value: {
      vlength: [],
      octets: []
    },
    decoded: []
  }
}

function headerFieldProcessor (cleanHeaderField, dynamicTable) {
  let readingFor = -1
  let readingIndex = false
  let readingLength = false
  let readingString = false
  let isHuffman = false
  return cleanHeaderField.reduce((acc, cur) => {
    if (readingFor >= 0) {
      const readingAcc = acc[readingFor]
      // for sure not reading the first byte, all readings have length
      // if not we are in the begining on a new read
      if (readingString) {
        if (readingAcc.decoded.length === 0) {
          readingAcc.name.octets.push(cur)
          const nameLengthArray = isHuffman
            ? maskHuffmanBit(readingAcc.name.nlength)
            : readingAcc.name.nlength
          const decodedLength = decodeInteger(nameLengthArray, 0x7f)
          if (decodedLength === readingAcc.name.octets.length) {
            const name = isHuffman
              ? readHuffman(readingAcc.name.octets)
              : readingAcc.name.octets
            readingAcc.decoded.push(Buffer.from(name).toString())
            readingString = false
            isHuffman = false
            readingLength = true
          }
        } else if (readingAcc.decoded.length === 1) {
          readingAcc.value.octets.push(cur)
          const valueLengthArray = isHuffman
            ? maskHuffmanBit(readingAcc.value.vlength)
            : readingAcc.value.vlength
          const decodedLength = decodeInteger(valueLengthArray, 0x7f)
          if (decodedLength === readingAcc.value.octets.length) {
            const value = isHuffman
              ? readHuffman(readingAcc.value.octets)
              : readingAcc.value.octets
            readingAcc.decoded.push(Buffer.from(value).toString())
            readingString = false
            isHuffman = false
            readingFor = -1
            if (readingAcc.prefix < 0x80 && readingAcc.prefix >= 0x40) {
              dynamicTable.unshift(readingAcc.decoded)
              // here we should update the dynamic table
            }
          }
        } else {
          Error('hpack headerFieldProcessor reading string error')
        }
      } else if (readingLength) {
        if (readingAcc.decoded.length === 0) {
          readingAcc.name.nlength.push(cur)
          if (readingAcc.name.nlength.length === 1) {
            isHuffman = cur > 0x80
            if ((isHuffman && cur !== 0xff) || (!isHuffman && cur !== 0x7f)) {
              readingString = true
              readingLength = false
            }
          } else if (cur < 0x80) {
            readingString = true
            readingLength = false
          }
        } else if (readingAcc.decoded.length === 1) {
          readingAcc.value.vlength.push(cur)
          if (readingAcc.value.vlength.length === 1) {
            isHuffman = cur > 0x80
            if ((isHuffman && cur !== 0xff) || (!isHuffman && cur !== 0x7f)) {
              readingString = true
              readingLength = false
            }
          } else if (cur < 0x80) {
            readingString = true
            readingLength = false
          }
        } else {
          Error('hpack headerFieldProcessor reading length error')
        }
      } else if (readingIndex) {
        readingAcc.indexed.push(cur)
        if (cur < 0x80) {
          readingIndex = false
          readingLength = true
          const fixedprefix = fixprefix(readingAcc.prefix)
          const indexedFieldArray = [fixedprefix].concat(readingAcc.indexed)
          const idx = decodeInteger(indexedFieldArray, fixedprefix) - 1
          const name = idx < staticTable.length
            ? staticTable[idx][0]
            : dynamicTable[idx - staticTable.length][0]
          readingAcc.decoded.push(name)
        }
      } else {
        const nameLengthReads = [0x70, 0x00, 0x10, 0x40]
        if (
          !readingLength
          && nameLengthReads.includes(readingAcc.prefix)
          && readingAcc.name.nlength.length === 0
        ) {
          readingLength = true
          isHuffman = cur > 0x80
          readingAcc.name.nlength.push(cur)
          if ((isHuffman && cur !== 0xff) || (!isHuffman && cur !== 0x7f)) {
            readingString = true
            readingLength = false
          }
        }
        if (
          !readingLength
          && readingAcc.value.vlength.length === 0
          && readingAcc.decoded.length === 1
        ) {
          readingLength = true
          isHuffman = cur > 0x80
          readingAcc.value.vlength.push(cur)
          if ((isHuffman && cur !== 0xff) || (!isHuffman && cur !== 0x7f)) {
            readingString = true
            readingLength = false
          }
        }
        const indexReads = [0xff, 0x7f, 0x0f, 0x1f, 0x3f] // 0x3f matches Dynamic Table Size Update
        if (
          !readingIndex
          && indexReads.includes(readingAcc.prefix)
          && readingAcc.indexed.length === 0
        ) {
          readingIndex = true
          readingAcc.indexed.push(cur)
          if (cur < 0x80) {
            readingIndex = false
            readingLength = true
            const fixedprefix = fixprefix(readingAcc.prefix)
            const indexedFieldArray = [fixedprefix].concat(readingAcc.indexed)
            const idx = decodeInteger(indexedFieldArray, fixedprefix) - 1
            const name = idx < staticTable.length
              ? staticTable[idx][0]
              : dynamicTable[idx - staticTable.length][0]
            readingAcc.decoded.push(name)
          }
        }
      }
    } else if (readingFor < 0) {
      // we create a new instance of a headerField with prefix the current byte
      const headerFieldInstance = headerField(cur)
      if (cur > 0x80) {
        // 6.1. Indexed Header Field Representation
        if (cur !== 0xff) {
          // we are done
          const idx = (cur ^ 0x80) - 1
          const completePair = idx < staticTable.length
            ? staticTable[idx]
            : dynamicTable[idx - staticTable.length]
          headerFieldInstance.decoded.push(completePair[0], completePair[1])
          // he have to make sure we do not raize reading and friends on the end !!!
        }
      } else if (cur >= 0x40) {
        // 6.2.1. Literal Header Field with Incremental Indexing
        if (cur !== 0x7f && cur !== 0x40) {
          const idx = (cur ^ 0x40) - 1
          const headerFieldName = idx < staticTable.length
            ? staticTable[idx][0]
            : dynamicTable[idx - staticTable.length]
          headerFieldInstance.decoded.push(headerFieldName)
        }
      } else if (cur > 0x20 && cur <= 0x3f) {
        // 6.3. Dynamic Table Size Update
        if (cur !== 0x3f) {
          headerFieldInstance.decoded.push('Dynamic Table Size Update', cur ^ 0x20)
        }
      } else if (cur > 0x10 && cur <= 0x1f) {
        // 6.2.3. Literal Header Field Never Indexed
        if (cur !== 0x1f && cur !== 0x10) {
          const idx = (cur ^ 0x10) - 1
          const headerFieldName = idx < staticTable.length
            ? staticTable[idx][0]
            : dynamicTable[idx - staticTable.length]
          headerFieldInstance.decoded.push(headerFieldName)
        }
      } else if (cur >= 0 && cur <= 0x0f) {
        // 6.2.2. Literal Header Field without Indexing
        if (cur !== 0x0f && cur !== 0x00) {
          const headerFieldName = staticTable[cur - 1][0]
          headerFieldInstance.decoded.push(headerFieldName)
        }
      } else {
        Error('hpack headerFieldProcessor no initial header field match error')
      }

      // if 6.1. Indexed Header Field Representation is done (there is name and value)
      // or if is 6.3. Dynamic Table Size Update loop for the next header field
      // all other cases should set the reading flag and friends
      if ((!(cur > 0x20 && cur <= 0x3f) && !(cur > 0x80 && cur !== 0xff))) {
        readingFor = acc.push(headerFieldInstance) - 1
      } else {
        acc.push(headerFieldInstance)
      }
    }

    return acc
  }, [])
}

module.exports.staticTable = staticTable
module.exports.prefixMatrix = prefixMatrix
module.exports.hnoderoot = hnoderoot
module.exports.fixprefix = fixprefix
module.exports.encodeInteger = encodeInteger
module.exports.decodeInteger = decodeInteger
module.exports.readHuffman = readHuffman
module.exports.maskHuffmanBit = maskHuffmanBit
module.exports.headerFieldProcessor = headerFieldProcessor

module.exports.expandByte = expandByte
module.exports.flagPrefixBoundary = flagPrefixBoundary
