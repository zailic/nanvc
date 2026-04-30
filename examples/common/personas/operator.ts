import VaultClient, { VaultClientV2 } from '../../../src/main.js';
import {
    expectSuccess,
    expectSuccessOrAlreadyExists,
    isMountAlreadyExistsError,
    loadEnvFile,
    toExampleAuthError,
    updateEnvFile,
    validateInitData,
    validateV2InitData,
} from './helpers.js';
import type { PersonaOptions, VaultClientFor, VaultClientVersion, VaultInitResponse, WorkflowContext } from './types.js';

export class OperatorPersona<V extends VaultClientVersion> {
    public readonly vault: VaultClientFor<V>;

    private constructor(
        private readonly version: V,
        private readonly options: PersonaOptions<V> = {},
    ) {
        if (options.envPath) {
            loadEnvFile(options.envPath);
        }

        this.vault = options.client ?? createClient(version);
    }

    public static v1(options: PersonaOptions<'v1'> = {}): OperatorPersona<'v1'> {
        return new OperatorPersona('v1', options);
    }

    public static v2(options: PersonaOptions<'v2'> = {}): OperatorPersona<'v2'> {
        return new OperatorPersona('v2', options);
    }

    public async withWorkflow<R>(
        workflow: (context: WorkflowContext<V>) => Promise<R> | R,
    ): Promise<R> {
        return workflow({ vault: this.vault });
    }

    public async ensureVaultIsReady(): Promise<void> {
        if (this.version === 'v1') {
            await this.ensureV1VaultIsReady(this.vault as VaultClient);
            return;
        }

        await this.ensureV2VaultIsReady(this.vault as VaultClientV2);
    }

    public async ensureKvMountAvailable(
        path: string, 
        engineVersion: 1 | 2 = this.version === 'v1' ? 1 : 2,
    ): Promise<void> {
        if (this.version === 'v1') {
            await expectSuccessOrAlreadyExists(
                (this.vault as VaultClient).mount(path, {
                    type: 'kv',
                }),
                'Vault KV mount enable failed',
            );
            return;
        }

        const [, error] = await (this.vault as VaultClientV2).sys.mount.enable(path, {
            type: 'kv',
            options: {
                version: String(engineVersion),
            },
        });
        if (error && !isMountAlreadyExistsError(error)) {
            throw toExampleAuthError(error, this.options.envPath);
        }
    }

    private async ensureV1VaultIsReady(vault: VaultClient): Promise<void> {
        const statusResponse = await expectSuccess(vault.status(), 'Vault seal status failed');
        const status = statusResponse.apiResponse as { initialized?: boolean; sealed?: boolean } | undefined;

        if (!status?.initialized) {
            await this.initializeAndUnsealV1(vault);
            return;
        }

        if (status.sealed) {
            const unsealKey = process.env.NANVC_VAULT_UNSEAL_KEY;
            if (!unsealKey) {
                throw new Error('NANVC_VAULT_UNSEAL_KEY environment variable is not set');
            }

            await expectSuccess(vault.unseal({ key: unsealKey }), 'Vault unseal failed');
        }
    }

    private async initializeAndUnsealV1(vault: VaultClient): Promise<void> {
        const initResponse = await expectSuccess(
            vault.init({
                secret_shares: 1,
                secret_threshold: 1,
            }),
            'Vault init failed',
        );
        const initData = initResponse.apiResponse as VaultInitResponse | undefined;

        validateInitData(initData);
        this.persistInitData(initData);
        vault.token = initData.root_token;

        await expectSuccess(vault.unseal({ key: initData.keys[0] }), 'Vault unseal failed');
    }

    private async ensureV2VaultIsReady(vault: VaultClientV2): Promise<void> {
        if (!await vault.sys.isReady().unwrap()) {
            const isInitialized = await vault.sys.isInitialized().unwrap();
            if (!isInitialized) {
                await this.initializeAndUnsealV2(vault);
            } else {
                const unsealKey = process.env.NANVC_VAULT_UNSEAL_KEY;
                if (!unsealKey) {
                    throw new Error('NANVC_VAULT_UNSEAL_KEY environment variable is not set');
                }
                await vault.sys.unseal({ key: unsealKey }).unwrap();
            }
        }
    }

    private async initializeAndUnsealV2(vault: VaultClientV2): Promise<void> {
        const [initData, initError] = await vault.sys.init({
            secret_shares: 1,
            secret_threshold: 1,
        });
        if (initError) {
            throw initError;
        }

        validateV2InitData(initData);
        this.persistInitData(initData);

        const [, unsealError] = await vault.sys.unseal({
            key: initData.keys[0],
        });
        if (unsealError) {
            throw unsealError;
        }
    }

    private persistInitData(initData: VaultInitResponse): void {
        if (this.options.envPath) {
            updateEnvFile(this.options.envPath, initData);
            return;
        }

        process.env.NANVC_VAULT_UNSEAL_KEY = initData.keys[0];
        process.env.NANVC_VAULT_AUTH_TOKEN = initData.root_token;
    }
}

function createClient<TVersion extends VaultClientVersion>(version: TVersion): VaultClientFor<TVersion> {
    return (version === 'v1' ? new VaultClient() : new VaultClientV2()) as VaultClientFor<TVersion>;
}
