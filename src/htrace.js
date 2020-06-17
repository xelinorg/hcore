function HTrace (option) {
  this.hversion = 'HTTP/2'
  this.setting = option.setting
  this.headerTable = option.headerTable
  this.streamTable = option.streamTable
  this.frameTable = []
}

HTrace.prototype.frame = function hTraceFrame (curedFrame) {
  this.frameTable.push(curedFrame)
}

HTrace.prototype.getStream = function hTraceGetStream (option) {
  console.log(frameArray)
}

module.exports.HTrace = HTrace

module.exports.createFactory = function hTraceCreateFactory (option) {
  const opt = option || {}
  !opt.headerTable && (opt.headerTable = [])
  !opt.streamTable && (opt.streamTable = [])
  !opt.setting && (opt.setting = {})
  return new HTrace(opt)
}
