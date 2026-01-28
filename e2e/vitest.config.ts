import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const e2eDir = resolve(__dirname)

export default defineConfig({
  test: {
    root: e2eDir,
    globalSetup: [resolve(e2eDir, 'globalSetup.ts')],
    include: ['**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
  },
})
