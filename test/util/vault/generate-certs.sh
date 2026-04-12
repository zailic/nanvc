#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CERTS_DIR="$SCRIPT_DIR/certs"
OPENSSL_DIR="$SCRIPT_DIR/openssl"

mkdir -p "$CERTS_DIR"
rm -f "$CERTS_DIR"/ca.key \
  "$CERTS_DIR"/ca.pem \
  "$CERTS_DIR"/ca.srl \
  "$CERTS_DIR"/client.crt \
  "$CERTS_DIR"/client.csr \
  "$CERTS_DIR"/client.key \
  "$CERTS_DIR"/server.crt \
  "$CERTS_DIR"/server.csr \
  "$CERTS_DIR"/server.key

openssl genrsa -out "$CERTS_DIR/ca.key" 2048
openssl req -x509 -new -nodes \
  -key "$CERTS_DIR/ca.key" \
  -sha256 \
  -days 3650 \
  -subj "/CN=nanvc-integration-ca" \
  -out "$CERTS_DIR/ca.pem"

openssl genrsa -out "$CERTS_DIR/server.key" 2048
openssl req -new \
  -key "$CERTS_DIR/server.key" \
  -subj "/CN=127.0.0.1" \
  -out "$CERTS_DIR/server.csr"
openssl x509 -req \
  -in "$CERTS_DIR/server.csr" \
  -CA "$CERTS_DIR/ca.pem" \
  -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERTS_DIR/server.crt" \
  -days 3650 \
  -sha256 \
  -extfile "$OPENSSL_DIR/server.ext"

openssl genrsa -out "$CERTS_DIR/client.key" 2048
openssl req -new \
  -key "$CERTS_DIR/client.key" \
  -subj "/CN=nanvc-integration-client" \
  -out "$CERTS_DIR/client.csr"
openssl x509 -req \
  -in "$CERTS_DIR/client.csr" \
  -CA "$CERTS_DIR/ca.pem" \
  -CAkey "$CERTS_DIR/ca.key" \
  -CAcreateserial \
  -out "$CERTS_DIR/client.crt" \
  -days 3650 \
  -sha256 \
  -extfile "$OPENSSL_DIR/client.ext"
