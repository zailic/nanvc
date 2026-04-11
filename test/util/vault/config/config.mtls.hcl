disable_cache = true
disable_mlock = true

storage "inmem" {}

listener "tcp" {
    address = "0.0.0.0:8200"
    tls_cert_file = "/vault/certs/server.crt"
    tls_key_file = "/vault/certs/server.key"
    tls_client_ca_file = "/vault/certs/ca.pem"
    tls_require_and_verify_client_cert = "true"
}
