# export SSL_CERT_FILE=/path/to/hcore/crypto/rootCA.crt.pem
import requests
from hyper.contrib import HTTP20Adapter
s = requests.Session()
s.mount('https://server.hcore:4444', HTTP20Adapter())
r = s.get('https://server.hcore:4444/json')
print(r.text)
