export const targetPaths = [
    {
        methods: ['delete', 'get', 'post'],
        sourcePath: '/cubbyhole/{path}',
    },
    {
        methods: ['get'],
        sourcePath: '/cubbyhole/{path}/',
    },
];

export const targetSchemas = [
    'StandardListResponse',
];
