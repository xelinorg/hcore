const fs = require('fs')
const path = require('path')
const cryptopath = path.resolve(__dirname)
module.exports = {
  // Necessary only if the server requires client certificate authentication.
  key: fs.readFileSync(cryptopath.concat('/', 'hcore.key.pem')),
  cert: fs.readFileSync(cryptopath.concat('/', 'hcore.crt.pem')),

  // Necessary only if the server uses a self-signed certificate.
  ca: [fs.readFileSync(cryptopath.concat('/', 'rootCA.crt.pem'))],

  // Necessary only if the server's cert isn't for "localhost".
  checkServerIdentity: () => { return null; },
};
