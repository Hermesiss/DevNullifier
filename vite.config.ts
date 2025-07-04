import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

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
  }
});
