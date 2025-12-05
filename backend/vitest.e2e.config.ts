import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    clearMocks: true,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
