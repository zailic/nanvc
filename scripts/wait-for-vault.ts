import {VaultClient} from "../src/v2/client/vault-client.js";
const deadline = Date.now() + 15_000; // 15 seconds timeout
const poll = () => {
    const address = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
    const client = new VaultClient({
        clusterAddress: address
    });
    const ready = client.sys.isReady().unwrapOr(false);
    if (!ready) {
       if (Date.now() >= deadline) {
            console.error(`Timed out waiting for Vault readiness at ${address}`);
            process.exit(1);
        }
        setTimeout(poll, 1000);
    } else {
        process.exit(0);
    }
}
poll();
