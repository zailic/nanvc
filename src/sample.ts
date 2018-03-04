import VaultClient from "./main";

let c = new VaultClient;

c.unseal({ "key": "+UPKTBbZyBT1V1Vj6DUgES693tGdeTjp0dXFTnJYULg=" })
 .then(response => console.log(response));