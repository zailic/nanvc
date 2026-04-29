import { VaultClient } from "../src/v2/client/vault-client.js";

const deadline = Date.now() + 15_000; // 15 seconds timeout
const address = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
const client = new VaultClient({clusterAddress: address});

const poll = async () => {
    while (Date.now() < deadline) {
        const error = await client.raw.get('/sys/health').intoErr();
        
        if (
            !error || 
            (
                (error.code === 'HTTP_ERROR') && 
                (error.status !== undefined) && 
                (error.status === 501 || error.status === 503)
            )
        ) {
           return true;
        } 
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    }
    
    return false;
}

(async () => {
    const ok = await poll();
    if (ok) {
        process.exit(0);
    } else {
        console.error(`Timed out waiting for Vault readiness at ${address}`);
        process.exit(1);
    }
})();
