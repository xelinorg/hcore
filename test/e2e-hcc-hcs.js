const hc = require('../src/hcore')
const ancryptoo = require('../crypto/cryptoption')
const copt = {
  port: 4444,
  host: 'server.hcore',
  ca: ancryptoo.ca,
  tls: require('tls'),
  ALPNProtocols: ['h2']
}

const hcc = hc.createClient(copt)
hcc.request({header:{ ':method': 'GET', ':path': '/hello?v=h2#gama'}})

hcc.socket[0].on('data', (dt) => {
  hcc.frame(dt).forEach(frm => {
    if (frm.type === 'h2_data' && frm.flags.readInt8() === 1) {
      console.log(hcc.frame(dt))
      hcc.reset(hcc.socket[0])
    }
  })
})
