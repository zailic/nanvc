export type VaultAllowedHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type VaultResponse = { [p: string]: any } | null;

export interface VaultCommandMetadata {
    method: VaultAllowedHttpMethod;
    path: string;
}
