import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup-env.ts'],
    // bcrypt cost 12 bisa lambat pada mesin CI dengan CPU terbatas.
    testTimeout: 20_000,
  },
});
