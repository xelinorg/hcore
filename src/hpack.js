function encodeInteger(intVal, prefix) {
  // should not encode zero and the prefix should be between 1 and 8
  if (intVal < prefix) {
    return Uint8Array.from([intVal])
  } else {
    return extendPrefixWithInteger(intVal, prefix)
  }
}

function decodeInteger(codelist, prefix) {
  const bitseq =  codelist
  let i = bitseq[0]
  if (i < prefix && codelist.length === 1) {
    return i
  } else {
    let oct = 1
    let m = 0
    let b
    do {
      b = bitseq[oct]
      i = i + (b & 0x7f) * 2**m
      m = m + 7
      oct++
    } while ((b & 0x80) === 0x80)
    return i
  }
}

function extendPrefixWithInteger (intVal, prefix) {
  const extendedInt = []
  extendedInt.push(prefix)
  let intext = intVal - prefix
  while (intext >= 0x80) {
    extendedInt.push(((intext % 0x80) + 0x80))
    intext = (intext / 0x80)
  }
  extendedInt.push(intext)
  return Uint8Array.from(extendedInt)
}

function expandByte (byte) {
  return [byte, byte.toString(16), byte.toString(2)]
}

const prefixMatrix = {
  'indexedHeaderFieldRepresentation': 0x7f,
  'literalHeaderFieldWithIncrementalIndexing': 0x40,
  'literalHeaderFieldWithoutIndexing': 0x8,
  'literalHeaderFieldNeverIndexed': 0x10
}

function flagPrefixBoundary (intVal, prefix) {
  const mask = (prefix >> 1) ^ prefix
  return intVal | mask
}

module.exports.encodeInteger = encodeInteger
module.exports.decodeInteger = decodeInteger
module.exports.prefixMatrix = prefixMatrix
