echo "ca and peer key and crt pems"
echo "add server.crl on hosts file"
CA_SUBJ="/C=gh/ST=Athens/L=Europe/O=automnet/CN=AutomnetCA.crl"
echo "CA_SUBJ is $CA_SUBJ"
CRLOPP_SUBJ="/C=gh/ST=Athens/L=Europe/O=automnet/CN=server.crl"
echo "CRLOPP_SUBJ is $CRLOPP_SUBJ"

echo "doing CA key"
openssl genrsa -out rootCA.key 4096
echo "doing CA crt"
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 1024 -out rootCA.crt -subj $CA_SUBJ
echo "doing crloop key"
openssl genrsa -out crloop.key 2048
echo "doing crloop csr"
openssl req -new -key crloop.key -out crloop.csr -subj $CRLOPP_SUBJ
echo "doing crloop crt"
openssl x509 -req -in crloop.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial -out crloop.crt -days 500 -sha256

echo "doing crloop pems"
openssl rsa -in crloop.key -text > crloop.key.pem
openssl x509 -inform PEM -in crloop.crt > crloop.crt.pem
openssl x509 -inform PEM -in rootCA.crt > rootCA.crt.pem

openssl x509 -in crloop.crt.pem -noout -text
openssl x509 -in rootCA.crt.pem -noout -text
