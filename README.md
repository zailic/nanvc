# nanvc - Not Another Node Vault Client
[![Build Status](https://travis-ci.org/zailic/nanvc.svg?branch=master)](https://travis-ci.org/zailic/nanvc)
[![Coverage Status](https://coveralls.io/repos/github/zailic/nanvc/badge.svg?branch=master)](https://coveralls.io/github/zailic/nanvc?branch=master)

This is a [Vault](https://www.vaultproject.io/) client written in typescript, heavily inspired from much more mature
project: [node-vault](https://github.com/kr1sp1n/node-vault)

# Table of contents
* [Install](#install)
* [How to use it](#how-to-use-it)
    * [ES5](#es5)
    * [ES6](#es6)
* [What is supported](#what-is-supported)
* [TODO list](#todo-list)

## Install
``` bash
# requires nodejs >=6
npm install nanvc --save
```
## How to use it

The VaultClient constructor takes three optional arguments:
- vault cluster address - if not passed in, defaults to NANVC_VAULT_CLUSER_ADDRESS environment variable otherwise it will take 'http://127.0.0.1:8200' value
- vault auth token - if not passed in, defaults to NANVC_VAULT_AUTH_TOKEN env. variable, otherwise will be set to null
- vault api version - if not passed in, defaults to NANVC_VAULT_API_VERSION environment variable, otherwise is set internaly to 'v1'

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
## What is supported

Vault Rest API Call | Http Method | Client Library Method | Tested
--------------------|-------------|-----------------------|-------
/secret/:path|GET|VaultClient.read(secretPath: string)| Yes
/secret/:path|POST|VaultClient.write(secretPath: string, secretData: object)| Yes
/secret/:path|PUT|VaultClient.update(secretPath: string, secretData: object)| Yes
/secret/:path|DELETE|VaultClient.delete(secretPath: string)| Yes
/sys/audit|GET|VaultClient.audits()|No
/sys/audit/:name|PUT|VaultClient.enableAudit(auditName: string)|No
/sys/audit/:name|DELETE|VaultClient.disableAudit(auditName: string)|No
/sys/audit-hash/:path|POST|N/A|N/A
/sys/auth|GET|N/A|No
/sys/auth|POST|N/A|No
/sys/auth|DELETE|N/A|No
/sys/capabilities|POST|N/A|N/A
/sys/capabilities-accessor|POST|N/A|N/A
/sys/capabilities-self|POST|N/A|N/A
/sys/config/auditing|GET|N/A|N/A
/sys/config/control-group|GET|N/A|N/A
/sys/config/cors|GET|N/A|N/A
/sys/control-group|POST|N/A|N/A
/sys/generate-root|GET|N/A|N/A
/sys/health|HEAD|N/A|N/A
/sys/health|GET|N/A|N/A
/sys/init|GET|VaultClient.isInitialized()|YES
/sys/init|PUT|VaultClient.init(initData: object)|YES
/sys/key-status|GET|N/A|N/A
/sys/leader|GET|N/A|N/A
/sys/leases|PUT|N/A|N/A
/sys/leases|LIST|N/A|N/A
/sys/license|GET|N/A|N/A
/sys/mfa|N/A|N/A|N/A
/sys/mounts|N/A|No
/sys/mounts/:mount_point|POST|N/A|No
/sys/mounts/:mount_point|DELETE|N/A|No
/sys/mounts/:mount_point/tune|POST|N/A|N/A
/sys/plugins/reload/backend|PUT|N/A|N/A
/sys/plugins/catalog|LIST|N/A|N/A
/sys/plugins/catalog/:catalog_name|PUT|N/A|N/A
/sys/plugins/catalog/:catalog_name|GET|N/A|N/A
/sys/plugins/catalog/:catalog_name|DELETE|N/A|N/A
/sys/policy|GET|VaultClient.policies()|No
/sys/policy|PUT|VaultClient.addPolicy(policyName: string, policyData: obkect )|No
/sys/policy|DELETE|VaultClient.removePolicy(policyName: string)|No
/sys/policies|N/A|N/A|N/a
/sys/raw|N/A|N/A|N/A
/sys/rekey|N/A|N/A|N/A
/sys/rekey-recovery-key|N/A|N/A|N/A
/sys/remount|POST|VaultClient.remount(remountData: object)|No
/sys/replication|N/A|N/A|N/A
/sys/rotate|N/A|N/A|N/A
/sys/seal|PUT|VaultClient.seal()|No
/sys/seal-status|GET|VaultClient.status()|Yes
/sys/step-down|N/A|N/A|N/A
/sys/tools|N/A|N/A|N/A
/sys/unseal|PUT|VaultClient.unseal(unsealData: object)|No
/sys/wrapping/lookup|N/A|N/A|N/A
/sys/wrapping/rewrap|N/A|N/A|N/A
/sys/wrapping/unwrap|N/A|N/A|N/A
/sys/wrapping/wrap|N/A|N/A|N/A

## TODO list
- [x] Better documentation(API, more samples, what is supported and what is NOT)
- [ ] Full support for ["System Backend Commands"](https://www.vaultproject.io/api/system/index.html)
- [x] Typescript declarations - it will bring IDE intellisense for tools like Vscode, IntelliJ IDEA, Atom, etc