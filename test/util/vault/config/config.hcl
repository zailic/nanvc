
disable_cache = true
disable_mlock = true

backend "consul" {
    address = "http://consul:9500"
    advertise_addr = "http://consul"
    path = "vault/" 
}
    
listener "tcp" {
    address = "0.0.0.0:8200"
    tls_disable = 1
}
