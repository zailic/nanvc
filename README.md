# nanvc - Not Another Node Vault Client
[![Build Status](https://travis-ci.org/zailic/nanvc.svg?branch=master)](https://travis-ci.org/zailic/nanvc)
[![Coverage Status](https://coveralls.io/repos/github/zailic/nanvc/badge.svg?branch=master)](https://coveralls.io/github/zailic/nanvc?branch=master)

This is a [Vault](https://www.vaultproject.io/) client written in typescript, heavily inspired from much more mature
project: [node-vault](https://github.com/kr1sp1n/node-vault)

## TODO list
- [ ] Better documentation(API, more samples, what is supported and what is NOT)
- [ ] Full support for ["System Backend Commands"](https://www.vaultproject.io/api/system/index.html)
- [ ] Typescript declarations - it will bring IDE intellisense for tools like Vscode, IntelliJ IDEA, Atom, etc

## Install - requires nodejs >=6
``` bash
npm install nanvc --save
```
## How to use it

### ES5
```javascript
var VaultClient = require('nanvc');
var vault = new VaultClient('http://vault.local:8200');
try {
    vault.init({ secret_shares: 1, secret_threshold: 1 })
        .then(
            function (result) {
                console.log(result);
                if (!result.succeded) {
                   throw new Error(result.errorMessage);
                }
                var keys = result.apiResponse.keys;
                vault.token = result.apiResponse.root_token;
                vault.unseal({
                    secret_shares: 1,
                    key: keys[0]
                })
                    .then(
                        function (result) {
                            if (result.succeded) {
                                // write a secret
                                vault.write('my-app/my-secret', { 'foo': 'my-password' }).then(
                                    function (writeSecretResponse) {
                                        console.log(writeSecretResponse);
                                        /*process the response here*/
                                    });
                                // update a secret
                                vault.update('my-app/my-secret', { 'foo': 'my-password-updated' }).then(
                                    function (updateSecretResponse) {
                                        console.log(updateSecretResponse);
                                        /*process the response here*/
                                    });
                                // read a secret
                                var mySecret = null;
                                vault.read('my-app/my-secret').then(
                                    function (mySecretQueryResponse) {
                                        console.log(mySecretQueryResponse);
                                        mySecret = mySecretQueryResponse.succceded && mySecretQueryResponse.apiResponse.data.foo;
                                    })
                                // delete a secret
                                var mySecretIsDeleted = null;
                                vault.delete('my-app/my-secret').then(
                                    function (mySecretDeleteQueryResponse) {
                                        console.log(mySecretDeleteQueryResponse);
                                        mySecretIsDeleted = mySecretDeleteQueryResponse.succeded;
                                        //...
                                    });
                            } else {
                                throw new Error(result.errorMessage);
                            }
                        }
                    )
            }
        ).catch(console.error);

} catch (e) {
    console.error(e);
}
```
### ES6
```javascript
import VaultClient from "nanvc";
let vault = new VaultClient('http://vault.local:8200');

async function main() {
    try {
        let initResponse = await vault.init({
            secret_shares: 1,
            secret_threshold: 1
        });

        if (initResponse.succeded) {
            console.log(initResponse);
            vault.token = initResponse.apiResponse.root_token;
            let unsealResponse = await vault.unseal({
                secret_shares: 1,
                key: initResponse.apiResponse.keys[0]
            });
            if (!unsealResponse.succeded) {
                throw new Error(unsealResponse.errorMessage);
            }
        } else {
            throw new Error(initResponse.errorMessage);
        }
        // write a secret
        let writeSecretResponse = await vault.write('my-app/my-secret', { 'foo': 'my-password' });
        console.log(writeSecretResponse);
        // update a secret
        let updateSecretResponse = await vault.update('my-app/my-secret', { 'foo': 'my-updated-password' });
        console.log(updateSecretResponse);
        // read a secret
        let mySecretQueryResponse = await vault.read('my-app/my-secret');
        let mySecret = mySecretQueryResponse.succeded && mySecretQueryResponse.apiResponse.data.foo;
        console.log(mySecretQueryResponse);
        // delete a secret
        let mySecretDeleteQueryResponse = await vault.delete('my-app/my-secret');
        let mySecretIsDeleted = mySecretDeleteQueryResponse.succeded;
        console.log(mySecretDeleteQueryResponse);
    } catch (e) {
        throw (e);
    }

}

main().then().catch(console.error);

```
