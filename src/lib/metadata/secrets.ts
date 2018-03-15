import { VaultCommandMetadata, VaultCommandValidationSchema } from "./common";

export const VaultReadSecretCommandMetadata: VaultCommandMetadata = {
    method: 'GET',
    path: '/secret/:path',
    acceptedCodes: [200]
}

export const VaultWriteSecretCommandMetadata: VaultCommandMetadata = {
    method: 'POST',
    path: '/secret/:path',
    acceptedCodes: [204]
}

export const VaultUpdateSecretCommandMetadata: VaultCommandMetadata = {
    method: 'PUT',
    path: '/secret/:path',
    acceptedCodes: [204]
}

export const VaultDeleteSecretCommandMetadata: VaultCommandMetadata = {
    method: 'DELETE',
    path: '/secret/:path',
    acceptedCodes: [204]
}