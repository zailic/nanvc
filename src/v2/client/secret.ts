import type { RawVaultClient } from '../core/raw-client.js';
import { VaultSecretCubbyholeClient } from './secret-cubbyhole.js';
import { VaultSecretKvV1Client } from './secret-kv-v1.js';
import { VaultKvV2Client } from './secret-kv-v2.js';

export class VaultSecretClient {
    public readonly cubbyhole: VaultSecretCubbyholeClient;
    public readonly kv: {
        v1: VaultSecretKvV1Client;
        v2: VaultKvV2Client;
    };

    constructor(raw: RawVaultClient) {
        this.cubbyhole = new VaultSecretCubbyholeClient(raw);
        this.kv = {
            v1: new VaultSecretKvV1Client(raw),
            v2: new VaultKvV2Client(raw),
        };
    }
}
