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
```javascript
var VaultClient = require('nanvc');
var vault = new VaultClient(
    'http://127.0.0.1:8200', // default
    'root-token',
    'v1', // default 
);
vault.init({ secret_shares: 1, secret_threshold: 1 })
    .then( (result) => {
        var keys = result.keys;
        vault.token = result.root_token;
        return vault.unseal({ secret_shares: 1, key: keys[0] })
    })
    .catch(console.error);
```
####

