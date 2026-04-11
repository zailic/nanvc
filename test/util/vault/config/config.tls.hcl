disable_cache = true
disable_mlock = true

storage "inmem" {}

listener "tcp" {
    address = "0.0.0.0:8200"
    tls_cert_file = "/vault/certs/server.crt"
    tls_key_file = "/vault/certs/server.key"
}
