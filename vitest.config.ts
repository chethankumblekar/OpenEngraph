import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{core,cli,server,plugins/*,benchmarks}/test/**/*.test.ts']
  }
});
