import { VaultCommandMetadata } from './metadata/common';
import {
    VaultAuditsCommandMetadata,
    VaultEnableAuditCommandMetadata,
    VaultDisableAuditCommandMetadata,
} from './metadata/sys-audit';
import {
    VaultReadSecretCommandMetadata,
    VaultDeleteSecretCommandMetadata,
    VaultWriteSecretCommandMetadata,
    VaultUpdateSecretCommandMetadata,
    VaultListCommandMetadata,
} from './metadata/crud';
import {
    VaultIsInitializedCommandMetadata,
    VaultInitCommandMetadata,
} from './metadata/sys-init';
import { VaultUnsealCommandMetadata } from './metadata/sys-unseal';
import { VaultStatusCommandMetadata } from './metadata/sys-seal-status';
import { VaultAuditHashCommandMetadata } from './metadata/sys-audit-hash';
import { VaultSealCommandMetadata } from './metadata/sys-seal';
import { VaultPoliciesCommandMetadata } from './metadata/sys-policy';
import {
    VaultMountCommandMetadata,
    VaultMountsCommandMetadata,
    VaultUnmountCommandMetadata,
} from './metadata/sys-mounts';
import { VaultRemountCommandMetadata } from './metadata/sys-remount';
import {
    VaultAuthsCommandMetadata,
    VaultEnableAuthCommandMetadata,
    VaultDisableAuthCommandMetadata,
} from './metadata/sys-auth';

export const COMMANDS: { [command: string]: VaultCommandMetadata } = {
    audits: VaultAuditsCommandMetadata,
    auditHash: VaultAuditHashCommandMetadata,
    auths: VaultAuthsCommandMetadata,
    delete: VaultDeleteSecretCommandMetadata,
    disableAudit: VaultDisableAuditCommandMetadata,
    disableAuth: VaultDisableAuthCommandMetadata,
    enableAuth: VaultEnableAuthCommandMetadata,
    enableAudit: VaultEnableAuditCommandMetadata,
    isInitialized: VaultIsInitializedCommandMetadata,
    init: VaultInitCommandMetadata,
    list: VaultListCommandMetadata,
    mount: VaultMountCommandMetadata,
    mounts: VaultMountsCommandMetadata,
    policies: VaultPoliciesCommandMetadata,
    read: VaultReadSecretCommandMetadata,
    remount: VaultRemountCommandMetadata,
    seal: VaultSealCommandMetadata,
    status: VaultStatusCommandMetadata,
    unmount: VaultUnmountCommandMetadata,
    update: VaultUpdateSecretCommandMetadata,
    unseal: VaultUnsealCommandMetadata,
    write: VaultWriteSecretCommandMetadata,
};