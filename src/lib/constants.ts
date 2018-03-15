import { VaultCommandMetadata } from "./metadata/common";
import { 
    VaultAuditsCommandMetadata, 
    VaultEnableAuditCommandMetadata, 
    VaultDisableAuditCommandMetadata 
} from "./metadata/sys-audit";
import {
    VaultReadSecretCommandMetadata,
    VaultDeleteSecretCommandMetadata,
    VaultWriteSecretCommandMetadata,
    VaultUpdateSecretCommandMetadata
} from "./metadata/secrets";
import { 
    VaultIsInitializedCommandMetadata, 
    VaultInitCommandMetadata 
} from "./metadata/sys-init";
import { VaultUnsealCommandMetadata } from "./metadata/sys-unseal";
import { VaultStatusCommandMetadata } from "./metadata/sys-seal-status";
import { VaultAuditHashCommandMetadata } from "./metadata/sys-audit-hash";
import { VaultSealCommandMetadata } from "./metadata/sys-seal";
import { VaultPoliciesCommandMetadata } from "./metadata/sys-policy";

export const COMMANDS: { [command: string]: VaultCommandMetadata } = {
    audits: VaultAuditsCommandMetadata,
    auditHash: VaultAuditHashCommandMetadata,
    delete: VaultDeleteSecretCommandMetadata,
    disableAudit: VaultDisableAuditCommandMetadata,
    enableAudit: VaultEnableAuditCommandMetadata,
    isInitialized: VaultIsInitializedCommandMetadata,
    init: VaultInitCommandMetadata,
    policies: VaultPoliciesCommandMetadata,
    read: VaultReadSecretCommandMetadata,
    seal: VaultSealCommandMetadata,
    status: VaultStatusCommandMetadata,
    update: VaultUpdateSecretCommandMetadata,
    unseal: VaultUnsealCommandMetadata,
    write: VaultWriteSecretCommandMetadata
}