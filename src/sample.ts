import VaultClient from "./main";

let c = new VaultClient("http://vault.local:8200");

c.init({ secret_shares: 1, secret_threshold: 1 })
    .then( (result) => {
        if(result.succeded) {
            var keys = result.apiResponse.keys;
            c.token = result.apiResponse.root_token;
            return c.unseal({ secret_shares: 1, key: keys[0] })
        }
        console.error(result.errorMessage);
    });
c.isInitialized().then( r => {
    if(r.succeded) {
        console.log(r.apiResponse.initialized)
        return;
    }
    console.log(r.errorMessage);
});
c.status().then( r => console.log(r.apiResponse.sealed));