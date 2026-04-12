import type { VaultCommandSpec } from './spec.js';
import { auditHashSpec } from './sys-audit-hash.js';
import { auditsSpec, disableAuditSpec, enableAuditSpec } from './sys-audit.js';
import { authsSpec, disableAuthSpec, enableAuthSpec } from './sys-auth.js';
import { deleteSecretSpec, listSecretsSpec, readSecretSpec, updateSecretSpec, writeSecretSpec } from './crud.js';
import { initSpec, isInitializedSpec } from './sys-init.js';
import { mountSpec, mountsSpec, unmountSpec } from './sys-mounts.js';
import { addPolicySpec, policiesSpec, removePolicySpec } from './sys-policy.js';
import { remountSpec } from './sys-remount.js';
import { statusSpec } from './sys-seal-status.js';
import { sealSpec } from './sys-seal.js';
import { unsealSpec } from './sys-unseal.js';

export {
    type VaultApiResponse,
    type VaultAllowedHttpMethod,
    type VaultCommandSchema,
    type VaultCommandSpec,
    VaultResponse,
    type PartialVaultResponse,
} from './spec.js';

export type { VaultAuditHashPayloadRequest } from './sys-audit-hash.js';
export type { VaultAuditPayloadRequest } from './sys-audit.js';
export type { VaultAuthPayloadRequest } from './sys-auth.js';
export type { VaultInitPayloadRequest } from './sys-init.js';
export type { VaultMountsPayloadRequest } from './sys-mounts.js';
export type { VaultPolicyPayloadRequest } from './sys-policy.js';
export type { VaultRemountPayloadRequest } from './sys-remount.js';
export type { VaultUnsealPayloadRequest } from './sys-unseal.js';
export type { VaultPayload } from './helpers.js';
export type { RequestOptions } from './helpers.js';
export type { HttpMethod } from './helpers.js';

export { auditHashSpec } from './sys-audit-hash.js';
export { auditsSpec, disableAuditSpec, enableAuditSpec } from './sys-audit.js';
export { authsSpec, disableAuthSpec, enableAuthSpec } from './sys-auth.js';
export { deleteSecretSpec, listSecretsSpec, readSecretSpec, updateSecretSpec, writeSecretSpec } from './crud.js';
export { initSpec, isInitializedSpec } from './sys-init.js';
export { mountSpec, mountsSpec, unmountSpec } from './sys-mounts.js';
export { addPolicySpec, policiesSpec, removePolicySpec } from './sys-policy.js';
export { remountSpec } from './sys-remount.js';
export { statusSpec } from './sys-seal-status.js';
export { sealSpec } from './sys-seal.js';
export { unsealSpec } from './sys-unseal.js';

export { buildRequestOptions } from './helpers.js';
export { joinUrl } from './helpers.js';
export { MAX_URL_PART_LENGTH } from './helpers.js';

export const commandSpecs: Readonly<Record<string, VaultCommandSpec>> = {
    audits: auditsSpec,
    auditHash: auditHashSpec,
    auths: authsSpec,
    addPolicy: addPolicySpec,
    delete: deleteSecretSpec,
    disableAudit: disableAuditSpec,
    disableAuth: disableAuthSpec,
    enableAuth: enableAuthSpec,
    enableAudit: enableAuditSpec,
    isInitialized: isInitializedSpec,
    init: initSpec,
    list: listSecretsSpec,
    mount: mountSpec,
    mounts: mountsSpec,
    policies: policiesSpec,
    read: readSecretSpec,
    remount: remountSpec,
    removePolicy: removePolicySpec,
    seal: sealSpec,
    status: statusSpec,
    unmount: unmountSpec,
    update: updateSecretSpec,
    unseal: unsealSpec,
    write: writeSecretSpec,
};
