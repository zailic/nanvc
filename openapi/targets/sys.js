export const targetPaths = [
    {
        methods: ['get', 'post'],
        sourcePath: '/sys/init',
    },
    {
        methods: ['delete', 'post'],
        sourcePath: '/sys/mounts/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/seal-status',
    },
    {
        methods: ['post'],
        sourcePath: '/sys/unseal',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/health',
    },
    {
        methods: ['get', 'post'],
        sourcePath: '/sys/wrapping/lookup',
    },
    {
        methods: ['post'],
        sourcePath: '/sys/wrapping/rewrap',
    },
    {
        methods: ['post'],
        sourcePath: '/sys/wrapping/unwrap',
    },
    {
        methods: ['post'],
        sourcePath: '/sys/wrapping/wrap',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/policies/acl/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/sys/policies/acl/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/policies/egp/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/sys/policies/egp/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/policies/password/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/sys/policies/password/{name}',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/policies/password/{name}/generate',
    },
    {
        methods: ['get'],
        sourcePath: '/sys/policies/rgp/',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/sys/policies/rgp/{name}',
    },
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/sys/policies/rotation/{name}',
    },
];

export const targetSchemas = [
    'InitializeRequest',
    'MountsEnableSecretsEngineRequest',
    'PoliciesGeneratePasswordFromPasswordPolicyResponse',
    'PoliciesListAclPoliciesResponse',
    'PoliciesReadAclPolicyResponse',
    'PoliciesReadPasswordPolicyResponse',
    'PoliciesReadRotationPolicyResponse',
    'PoliciesWriteAclPolicyRequest',
    'PoliciesWritePasswordPolicyRequest',
    'PoliciesWriteRotationPolicyRequest',
    'ReadWrappingProperties2Response',
    'ReadWrappingPropertiesRequest',
    'ReadWrappingPropertiesResponse',
    'RewrapRequest',
    'SealStatusResponse',
    'StandardListResponse',
    'SystemWritePoliciesEgpNameRequest',
    'SystemWritePoliciesRgpNameRequest',
    'UnwrapRequest',
    'UnsealRequest',
    'UnsealResponse',
];
