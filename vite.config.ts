import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import type { UserConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist-renderer",
    emptyOutDir: true
  },
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src/renderer', import.meta.url))
    }
  },
  esbuild: {
    target: "es2020"
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
    reporters: [
      'default',
      ['vitest-sonar-reporter', {
        outputFile: '../../coverage/test-report.xml',
        outputName: 'test-report.xml'
      }]
    ],
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/setup.ts',
        '**/*.vue',
        '**/types/**',
        'types/**',
        'renderer/types/**',
        '**/shims-vue.d.ts',
        '**/main.ts',
      ],
      reportsDirectory: '../../coverage'
    },
  }
} as UserConfig);
