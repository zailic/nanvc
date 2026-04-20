import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
    {
        ignores: [
            '_site/**',
            'coverage/**',
            'dist/**',
            'node_modules/**',
        ],
    },
    js.configs.recommended,
    {
        files: ['docs/assets/js/**/*.js'],
        languageOptions: {
            globals: {
                document: 'readonly',
                window: 'readonly',
            },
        },
    },
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: false,
            },
        },
        rules: {
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
    {
        files: ['test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-unused-vars': 'warn',
        },
    },
);
