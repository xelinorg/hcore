const fs = require('fs')
const path = require('path')
const tls = require('tls')
const HServer = require('../src/hserver')
const ancryptoo = require('../crypto/cryptoption')
const favicon = require('./favicon')

// add '127.0.0.1 server.hcore' at /etc/hosts file

const sopt = {
  ancryptoo,
  port: 4444,
  tls,
  ALPNProtocols: ['h2', 'h2c']
}

const htmlpage = `<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>hcore test page</title>
    <style>
    .main {
      font-size: 200px;
      margin-top: 10%;
      font-weight: bold;
    }
    </style>
  </head>
  <body style="text-align: center;">
    <section class="main">...</section>
  </body>
  <script src="hcorescript.js"></script>
</html>`

const hcs = new HServer(sopt)
const msg = 'y00h00'

hcs.get('/', (req, res) => {
  res.setHeader({
    'content-type': 'text/html; charset=UTF-8'
  })
  res.send(htmlpage)
})

hcs.get('/favicon.ico', (req, res) => {
  res.setHeader({
    'content-type': 'image/x-icon'
  })
  res.send(favicon)
})

hcs.get('/hcorescript.js', (req, res) => {
  fs.readFile(path.resolve('test/hcorescript.js'), 'utf8', (err, data) => {
    if (err) {
      return res.end(500)
    }
    res.setHeader({
      'content-type': 'application/javascript'
    })
    return res.send(data)
  })
})

hcs.get('/html', (req, res) => {
  res.send(msg)
})

hcs.get('/json', (req, res) => {
  res.setHeader({
    'content-type': 'application/json'
  })
  res.send({ msg })
})
