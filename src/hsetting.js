const SETTINGS_HEADER_TABLE_SIZE = {
  id: 0x1,
  initial: 4096,
  value: undefined
}
const SETTINGS_ENABLE_PUSH = {
  id: 0x2,
  initial: 1,
  value: 1
}
const SETTINGS_MAX_CONCURRENT_STREAMS = {
  id: 0x3,
  initial: 100,
  value: undefined
}
const SETTINGS_INITIAL_WINDOW_SIZE = {
  id: 0x4,
  initial: 2 ** 16 - 1,
  max: 2 ** 31 - 1,
  value: undefined
}
const SETTINGS_MAX_FRAME_SIZE = {
  id: 0x5,
  initial: 2 ** 14,
  max: 2 ** 24 - 1,
  value: undefined
}
const SETTINGS_MAX_HEADER_LIST_SIZE = {
  id: 0x6,
  value: undefined
}

const ACK_SETTINGS = [0, 0, 0, 4, 1, 0, 0, 0, 0]

const EMPTY_SETTINGS = [0, 0, 0, 4, 0, 0, 0, 0, 0]

const someDefault = [
  0, 0, 18, 4, 0, 0, 0, 0, 0,
  0, 1, 0, 1, 0, 0,
  0, 4, 0, 2, 0, 0,
  0, 5, 0, 0, 64, 0
]

function isEmptySetting (setting) {
  return EMPTY_SETTINGS.length === setting.length
    && EMPTY_SETTINGS.every((value, index) => value === setting[index])
}

function HSetting () {
  this.current = null
  this.previous = null
  this.logger = console
}

HSetting.prototype.acknowledge = function hSettingAcknowledge () {
  return Buffer.from(ACK_SETTINGS)
}

HSetting.prototype.synchronize = function hSettingSynchronize (frame) {
  this.logger.log(
    'hSettingSynchronize setting definitions',
    SETTINGS_HEADER_TABLE_SIZE,
    SETTINGS_ENABLE_PUSH,
    SETTINGS_MAX_CONCURRENT_STREAMS,
    SETTINGS_INITIAL_WINDOW_SIZE,
    SETTINGS_MAX_FRAME_SIZE,
    SETTINGS_MAX_HEADER_LIST_SIZE
  )
  this.logger.log('hSettingSynchronize frame', frame)
  if (isEmptySetting(frame.raw)) {
    return someDefault
  }
  this.previous = this.current
  this.current = frame
  return ACK_SETTINGS
}

module.exports = {
  HSetting
}
