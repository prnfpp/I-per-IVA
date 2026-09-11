import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@iperiva/rules': fileURLToPath(new URL('./packages/rules/src/index.ts', import.meta.url)),
      '@iperiva/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: { include: ['packages/**/test/**/*.test.ts'], environment: 'node' },
})
