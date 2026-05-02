import type { RawVaultClient } from '../core/raw-client.js';
import { VaultSecretKvV1Client } from './secret-kv-v1.js';
import { VaultKvV2Client } from './secret-kv-v2.js';
import { VaultSecretDbClient } from './secret-db.js';

export class VaultSecretClient {
    public readonly kv: {
        v1: VaultSecretKvV1Client;
        v2: VaultKvV2Client;
    };
    public readonly db: VaultSecretDbClient;

    constructor(raw: RawVaultClient) {
        this.kv = {
            v1: new VaultSecretKvV1Client(raw),
            v2: new VaultKvV2Client(raw),
        };
        this.db = new VaultSecretDbClient(raw);
    }
}
