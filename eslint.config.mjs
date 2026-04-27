import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      // No parserOptions.project: the configured rules below are
      // syntactic-only (no-explicit-any, no-var-requires, no-unused-vars)
      // and don't need type info. Setting `project: true` would require
      // every linted .ts file to be in some tsconfig 'include' — which
      // test files (excluded from build tsconfigs) are not. Add a
      // tsconfig.lint.json + reference it here later when type-aware
      // rules are introduced.
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      // Enforce no-any with a comment explaining the justification
      '@typescript-eslint/no-explicit-any': 'error',
      // Prefer const assertions
      '@typescript-eslint/no-var-requires': 'error',
      // Unused vars are errors (with underscore-prefix escape hatch)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Disable formatting rules that conflict with Prettier (must be last)
  prettierConfig,
];

export default config;
