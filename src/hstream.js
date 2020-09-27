const dict = {
  idle: Symbol('idle'),
  reservedLocal: Symbol('reserved-local'),
  reservedRemote: Symbol('reserved-remote'),
  open: Symbol('open'),
  halfClosedLocal: Symbol('half-closed-local'),
  halfClosedRemote: Symbol('half-closed-remote'),
  closed: Symbol('closed')
}

function HStream (option) {
  this.id = option.id
  this.state = dict.idle
  this.depends = 0
  this.weight = 16
}

HStream.prototype.open = function hStreamOpen () {
  if (this.state === dict.idle) {
    this.state = dict.open
  }
}

HStream.prototype.reserveLocal = function hStreamReserveLocal () {
  if (this.state === dict.idle) {
    this.state = dict.reservedLocal
  }
}

HStream.prototype.reserveRemote = function hStreamReserveRemote () {
  if (this.state === dict.idle) {
    this.state = dict.reservedRemote
  }
}

HStream.prototype.halfCloseLocal = function hStreamHalfCloseLocal () {
  const s = this.state
  const d = dict
  if (s === d.open || s === d.reservedLocal || s === d.reservedRemote) {
    this.state = d.halfClosedLocal
  }
}

HStream.prototype.halfCloseRemote = function hStreamHalfCloseRemote () {
  const s = this.state
  const d = dict
  if (s === d.open || s === d.reservedLocal || s === d.reservedRemote) {
    this.state = d.halfClosedRemote
  }
}

HStream.prototype.close = function hStreamClose () {
  const s = this.state
  const d = dict
  if (s === d.open || s === d.halfClosedLocal || s === d.halfClosedRemote) {
    this.state = d.closed
  }
}

module.exports.HStream = HStream

module.exports.createFactory = function hStreamCreateFactory (option) {
  const opt = typeof option === 'object' ? option : {}
  return new HStream(opt)
}
