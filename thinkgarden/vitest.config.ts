import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist-electron'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'electron/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'electron/**/*.d.ts',
        '**/node_modules/**',
        '**/*.test.{ts,tsx}',
      ],
      reporter: ['text', 'json', 'html'],
    },
  },
});