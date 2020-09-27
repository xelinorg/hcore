const { HSetting } = require('./hsetting')

function HTrace (option) {
  this.frameSymbol = option.frameSymbol
  this.setting = option.setting || new HSetting(option)
  this.headerTable = option.headerTable
  this.streamTable = option.streamTable
  this.frameTable = []
  this.socket = option.socket
  this.logger = option.logger || console
  this.outQueue = []
  this.alive = true
}

HTrace.prototype.frameIn = function hTraceFrameIn (curedFrame) {
  this.logger.log('hTraceFrameIn curedFrame', curedFrame)
  if (curedFrame.type === this.frameSymbol.setting) {
    this.outQueue.push(this.setting.synchronize(curedFrame))
  }
  if (curedFrame.type === this.frameSymbol.goaway) {
    this.alive = false
  }
  this.frameTable.push(curedFrame)
}

HTrace.prototype.frameOut = function hTraceFrameOut (option) {
  if (this.outQueue.length) {
    option.sendSetting(this.socket, this.outQueue.shift())
  }
}

HTrace.prototype.getStream = function hTraceGetStream (option) {
  this.logger.log('hTraceGetStream option', option)
}

module.exports.HTrace = HTrace

module.exports.createFactory = function hTraceCreateFactory (option) {
  const opt = option || {}
  return new HTrace(opt)
}
