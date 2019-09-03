import { VaultClient } from './lib/client'; 

let vault = new VaultClient('http://vault.local:8200');
 
async function main() {
    try {
        /*[ '946f46c92eb38cc923f62851fcafc1c3d41153b4345546daaf38b76378ca1ec7' ],
        keys_base64: [ 'lG9GyS6zjMkj9ihR/K/Bw9QRU7Q0VUbarzi3Y3jKHsc=' ],
        root_token: 's.lKp0isgqwo8ZHE54i9r3TDk6' },*/

        /*let initResponse = await vault.init({
            secret_shares: 1,
            secret_threshold: 1
        });
 
        if (initResponse.succeeded) {
            console.log(initResponse);
            vault.token = initResponse.apiResponse.root_token;
            let unsealResponse = await vault.unseal({key: initResponse.apiResponse.keys[0]});
            console.log(unsealResponse);
            if (!unsealResponse.succeeded) {
                throw new Error(unsealResponse.errorMessage);
            }
        } else {
            throw new Error(initResponse.errorMessage);
        }*/
        vault.token = 's.lKp0isgqwo8ZHE54i9r3TDk6';

        console.log(await vault.mounts());

        console.log(await vault.mount('secret', { type: "kv"}));
        // write a secret
        let writeSecretResponse = await vault.write('/secret/my-app/my-secret', { 'foo': 'my-password' });
        console.log(writeSecretResponse);
        // update a secret
        let updateSecretResponse = await vault.update('/secret/my-app/my-secret', { 'foo': 'my-updated-password' });
        console.log(updateSecretResponse);
        // read a secret
        let mySecretQueryResponse = await vault.read('/secret/my-app/my-secret');
        let mySecret = mySecretQueryResponse.succeeded && mySecretQueryResponse.apiResponse.data.foo;
        console.log(mySecretQueryResponse);
        // delete a secret
        let mySecretDeleteQueryResponse = await vault.delete('/secret/my-app/my-secret');
        let mySecretIsDeleted = mySecretDeleteQueryResponse.succeeded;
        console.log(mySecretDeleteQueryResponse);
    } catch (e) {
        throw (e);
    }
 
}
 
main().then().catch(console.error);
