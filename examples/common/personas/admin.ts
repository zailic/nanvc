import VaultClient, { VaultClientV2 } from '../../../src/main.js';
import { expectSuccess, expectSuccessOrAlreadyExists, post200Spec } from './helpers.js';
import type {
    AppRoleConfig,
    AppRoleCredentials,
    PersonaOptions,
    VaultClientFor,
    VaultClientVersion,
    VaultResponseData,
    WorkflowContext,
} from './types.js';

export class AdminPersona<TVersion extends VaultClientVersion> {
    public readonly vault: VaultClientFor<TVersion>;

    private constructor(
        private readonly version: TVersion,
        options: PersonaOptions<TVersion> = {},
    ) {
        this.vault = options.client ?? createClient(version);
    }

    public static v1(options: PersonaOptions<'v1'> = {}): AdminPersona<'v1'> {
        return new AdminPersona('v1', options);
    }

    public static v2(options: PersonaOptions<'v2'> = {}): AdminPersona<'v2'> {
        return new AdminPersona('v2', options);
    }

    public async withWorkflow<TResult>(
        workflow: (context: WorkflowContext<TVersion>) => Promise<TResult> | TResult,
    ): Promise<TResult> {
        return workflow({ vault: this.vault });
    }

    public async enableAppRoleAuth(): Promise<void> {
        if (this.version === 'v1') {
            await expectSuccessOrAlreadyExists(
                (this.vault as VaultClient).enableAuth('approle', { type: 'approle' }),
                'Vault AppRole auth enable failed',
            );
            return;
        }

        await (this.vault as VaultClientV2).auth.enableAuthMethod('approle', { type: 'approle' }).unwrap();
    }

    public async createPolicy(name: string, policy: string): Promise<void> {
        if (this.version === 'v1') {
            await expectSuccess(
                (this.vault as VaultClient).addPolicy(name, { policy }),
                'Vault policy write failed',
            );
            return;
        }

        await (this.vault as VaultClientV2).sys.policies.acl.write(name, { policy }).unwrap();
    }

    public async registerAppRole(roleName: string, config: AppRoleConfig): Promise<void> {
        if (this.version === 'v1') {
            await expectSuccess(
                (this.vault as VaultClient).write(`/auth/approle/role/${roleName}`, config),
                'Vault AppRole registration failed',
            );
            return;
        }

        await (this.vault as VaultClientV2).auth.registerAppRole(roleName, config).unwrap();
    }

    public async createAppRoleCredentials(roleName: string): Promise<AppRoleCredentials> {
        if (this.version === 'v1') {
            return this.createV1AppRoleCredentials(roleName);
        }

        const vault = this.vault as VaultClientV2;
        const roleIdData = await vault.auth.getAppRoleRoleId(roleName).unwrap();
        const secretIdData = await vault.auth.generateAppRoleSecretId(roleName).unwrap();
        const asString = (value: unknown): string => value as string;
        
        return {
            roleId: asString(roleIdData.role_id),
            secretId: asString(secretIdData.secret_id),
        };
    }

    private async createV1AppRoleCredentials(roleName: string): Promise<AppRoleCredentials> {
        const vault = this.vault as VaultClient;
        const roleIdResponse = await expectSuccess(
            vault.read(`/auth/approle/role/${roleName}/role-id`),
            'Vault AppRole role ID read failed',
        );
        const roleIdData = roleIdResponse.apiResponse as VaultResponseData<{ role_id?: string }> | undefined;
        const roleId = roleIdData?.data?.role_id;

        if (!roleId) {
            throw new Error('Vault AppRole role ID response did not include role_id');
        }

        const secretIdResponse = await expectSuccess(
            vault.apiRequest(post200Spec, `/auth/approle/role/${roleName}/secret-id`, {}),
            'Vault AppRole secret ID generation failed',
        );
        const secretIdData = secretIdResponse.apiResponse as VaultResponseData<{ secret_id?: string }> | undefined;
        const secretId = secretIdData?.data?.secret_id;

        if (!secretId) {
            throw new Error('Vault AppRole secret ID response did not include secret_id');
        }

        return { roleId, secretId };
    }
}



function createClient<TVersion extends VaultClientVersion>(version: TVersion): VaultClientFor<TVersion> {
    return (version === 'v1' ? new VaultClient() : new VaultClientV2()) as VaultClientFor<TVersion>;
}
