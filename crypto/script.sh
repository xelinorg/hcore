cd crypto
echo "ca and peer key and crt pems"
echo "add server.crl on hosts file"
CA_SUBJ="/C=gh/ST=Athens/L=Europe/O=hcore/CN=CA.hcore"
echo "CA_SUBJ is $CA_SUBJ"
CRLOPP_SUBJ="/C=gh/ST=Athens/L=Europe/O=hcore/CN=server.hcore"
echo "CRLOPP_SUBJ is $CRLOPP_SUBJ"

echo "doing CA key"
openssl genrsa -out rootCA.key 4096
echo "doing CA crt"
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 1024 -out rootCA.crt -subj $CA_SUBJ
echo "doing crloop key"
openssl genrsa -out hcore.key 2048
echo "doing crloop csr"
openssl req -new -key hcore.key -out hcore.csr -subj $CRLOPP_SUBJ
echo "doing crloop crt"
openssl x509 -req -in hcore.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial -out hcore.crt -days 500 -sha256

echo "doing crloop pems"
openssl rsa -in hcore.key -text > hcore.key.pem
openssl x509 -inform PEM -in hcore.crt > hcore.crt.pem
openssl x509 -inform PEM -in rootCA.crt > rootCA.crt.pem

openssl x509 -in hcore.crt.pem -noout -text
openssl x509 -in rootCA.crt.pem -noout -text
