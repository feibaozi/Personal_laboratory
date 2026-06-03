import tsEslint from 'typescript-eslint';
import js from '@eslint/js';

export default tsEslint.config(
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      '**/*.node',
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/src-tauri/**',
      '**/test-fixtures/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  }
);