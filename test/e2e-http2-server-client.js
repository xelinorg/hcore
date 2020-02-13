const http2 = require('http2')
const ancryptoo = require('../crypto/cryptoption')

const server = http2.createSecureServer({
  key: ancryptoo.key,
  cert: ancryptoo.cert,
  ca: ancryptoo.ca
})
server.on('error', (err) => console.error(err))

server.on('stream', (stream, headers) => {
  console.log('headers', headers)
  stream.respond({
    'content-type': 'text/html',
    ':status': 200
  });
  stream.end('<h1>Hello World</h1>');
});

server.listen(4444);
