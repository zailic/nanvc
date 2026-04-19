export type VaultTlsOptions = {
    ca?: string | Buffer;
    cert?: string | Buffer;
    key?: string | Buffer;
    passphrase?: string;
    rejectUnauthorized?: boolean;
};

export type VaultClientOptions = {
    apiVersion?: string;
    clusterAddress?: string;
    timeoutMs?: number;
    tls?: VaultTlsOptions;
    authToken?: string | null;
};

export type VaultRequestMethod = 'DELETE' | 'GET' | 'HEAD' | 'LIST' | 'POST' | 'PUT';

export type VaultRequestOptions = {
    body?: unknown;
    headers?: Record<string, string>;
    method: VaultRequestMethod;
    path: string;
    query?: Record<string, boolean | number | string | undefined>;
    token?: string | null;
};

export type VaultTransportResponse = {
    body: unknown;
    headers: Record<string, string | string[] | undefined>;
    ok: boolean;
    status: number;
    statusText: string;
};
