const hc = require('../src/hcore')
const ancryptoo = require('../crypto/cryptoption')
const copt = {
  port: 4444,
  host: 'server.crl',
  ca: ancryptoo.ca,
  tls: require('tls'),
  ALPNProtocols: ['h2']
}

const hcc = hc.createClient(copt)
hcc.sendSetting(hcc.socket[0])
hcc.socket[0].write(hcc.send(hcc.socket[0]))

hcc.socket[0].on('data', (dt) => {
  console.log(hcc.frame(dt))
})
