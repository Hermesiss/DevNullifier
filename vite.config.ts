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
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/setup.ts',
      ],
    },
  }
} as UserConfig);
