import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['src/**/*.integration.*', 'src/**/*.e2e.*'],
    coverage: {
      reporter: ['text', 'json-summary'],
    },
    clearMocks: true,
  },
});
