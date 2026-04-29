import VaultClient, { VaultClientV2 } from '../../../src/main.js';
import { expectSuccess, post200Spec } from './helpers.js';
import type {
    AppRoleCredentials,
    PersonaOptions,
    VaultClientFor,
    VaultClientVersion,
    VaultLoginResponse,
    WorkflowContext,
} from './types.js';

export class AppPersona<TVersion extends VaultClientVersion> {
    public readonly vault: VaultClientFor<TVersion>;

    private constructor(
        private readonly version: TVersion,
        options: PersonaOptions<TVersion> = {},
    ) {
        this.vault = options.client ?? createUnauthenticatedClient(version);
    }

    public static v1(options: PersonaOptions<'v1'> = {}): AppPersona<'v1'> {
        return new AppPersona('v1', options);
    }

    public static v2(options: PersonaOptions<'v2'> = {}): AppPersona<'v2'> {
        return new AppPersona('v2', options);
    }

    public async withWorkflow<TResult>(
        workflow: (context: WorkflowContext<TVersion>) => Promise<TResult> | TResult,
    ): Promise<TResult> {
        return workflow({ vault: this.vault });
    }

    public async loginWithAppRole(credentials: AppRoleCredentials): Promise<void> {
        if (this.version === 'v1') {
            const vault = this.vault as VaultClient;
            const loginResponse = await expectSuccess(
                vault.apiRequest(post200Spec, '/auth/approle/login', {
                    role_id: credentials.roleId,
                    secret_id: credentials.secretId,
                }),
                'Vault AppRole login failed',
            );
            const loginData = loginResponse.apiResponse as VaultLoginResponse | undefined;
            const appToken = loginData?.auth?.client_token;

            if (!appToken) {
                throw new Error('Vault AppRole login response did not include client_token');
            }

            vault.token = appToken;
            return;
        }

        await (this.vault as VaultClientV2).auth.loginWithAppRole({
            role_id: credentials.roleId,
            secret_id: credentials.secretId,
        }).unwrap();
    }
}

function createUnauthenticatedClient<TVersion extends VaultClientVersion>(version: TVersion): VaultClientFor<TVersion> {
    return (version === 'v1'
        ? new VaultClient({ authToken: null })
        : new VaultClientV2({ authToken: null })) as VaultClientFor<TVersion>;
}
