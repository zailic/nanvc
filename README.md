# nanvc - Not Another Node Vault Client
[![Build Status](https://travis-ci.org/zailic/nanvc.svg?branch=master)](https://travis-ci.org/zailic/nanvc)
[![Coverage Status](https://coveralls.io/repos/github/zailic/nanvc/badge.svg?branch=master)](https://coveralls.io/github/zailic/nanvc?branch=master)

This is a [Vault](https://www.vaultproject.io/) client written in typescript, heavily inspired from much more mature
project: [node-vault](https://github.com/kr1sp1n/node-vault)

## Install - requires nodejs >=6
``` bash
npm install nanvc --save
```
## How to use it
### ES5
```javascript
var VaultClient = require('nanvc');
var vault = new VaultClient('http://127.0.0.1:8200');
vault.init({ secret_shares: 1, secret_threshold: 1 })
     .then(
        function(result) {
            if(!result.succeded) {
                console.error(result.errorMessage);
                return;
            }
            var keys = result.apiResponse.keys;
            vault.token = result.apiResponse.root_token;
            vault.unseal({ 
                    secret_shares: 1, 
                    key: keys[0] 
                })
                .then(
                    function(result) {
                        console.log(result.succeded)
                    }
                )
        }
     );
```
### ES6
```javascript
import VaultClient from "nanvc";
let vault = new Vault('http://127.0.0.1');
const initAndUnseal = async () => {
    let initResponse = await vault.init({
        secret_shares: 1, 
        secret_threshold: 1
    });
    if (initResponse.succeded) {
        let unsealResponse = await vault.unseal({
            secret_shares: 1,
            key: initResponse.apiResoponse.keys[0]
        });
        if(!unsealResponse.succeded) {
            throw new Error(unsealResponse.errorMessage);
        }
    } else {
        throw new Error(initResponse.errorMessage);
    }
}
```
