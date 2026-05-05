import VaultClient, { VaultClientV2 } from '../../../src/main.js';
import { expectSuccessOrAlreadyExists, isMountAlreadyExistsError, toExampleAuthError } from './helpers.js';
import type { PersonaOptions, VaultClientFor, VaultClientVersion, WorkflowContext } from './types.js';

export class OperatorPersona<V extends VaultClientVersion> {
    public readonly vault: VaultClientFor<V>;

    private constructor(
        private readonly version: V,
        private readonly options: PersonaOptions<V> = {},
    ) {
        this.vault = options.client ?? createClient(version);
    }

    public static v1(options: PersonaOptions<'v1'> = {}): OperatorPersona<'v1'> {
        return new OperatorPersona('v1', options);
    }

    public static v2(options: PersonaOptions<'v2'> = {}): OperatorPersona<'v2'> {
        return new OperatorPersona('v2', options);
    }

    public async withWorkflow<R>(workflow: (context: WorkflowContext<V>) => Promise<R> | R): Promise<R> {
        return workflow({ vault: this.vault });
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
            throw toExampleAuthError(error);
        }
    }
}

function createClient<TVersion extends VaultClientVersion>(version: TVersion): VaultClientFor<TVersion> {
    return (version === 'v1' ? new VaultClient() : new VaultClientV2()) as VaultClientFor<TVersion>;
}
