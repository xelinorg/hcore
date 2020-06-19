const hc = require('../src/hcore')
const ancryptoo = require('../crypto/cryptoption')
const tls = require('tls')

// add '127.0.0.1 server.hcore' at /etc/hosts file

const sopt = {
  ancryptoo: ancryptoo,
  port: 4444,
  tls: tls,
  ALPNProtocols: ['h2', 'h2c']
}

const copt = {
  port: 4444,
  host: 'server.hcore',
  ca: ancryptoo.ca,
  tls: tls,
  ALPNProtocols: ['h2']
}

const hcs = hc.createServer(sopt)

const hcc = hc.createClient(copt)

hcc.socket[0].on('data', (dt) => {
  hcc.frame(dt).forEach(frm => {
    if (frm.type === 'h2_data' && frm.flags.readInt8() === 1) {
      console.table(hcc.frame(dt), ['streamId', 'type', 'cured'])
      //hcc.reset(hcc.socket[0])
    }
  })
})

setTimeout(function () {
    hcc.request({header:{ ':method': 'GET', ':path': '/hello?v=h2#gama'}})
}, 2000)

setTimeout(function () {
    hcc.request({header:{ ':method': 'POST', ':path': '/fake'}})
}, 3000)
