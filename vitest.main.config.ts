import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/main/**/*.{test,spec}.{js,ts}"],
    reporters: [
      "default",
      [
        "vitest-sonar-reporter",
        { outputFile: "./coverage/main/test-report.xml" }
      ],
      ["json", { outputFile: "./coverage/main/test.json" }]
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage/main",
      exclude: [
        "node_modules/",
        "dist/",
        "dist-renderer/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.config.js",
        "**/__tests__/**",
        "coverage/**",
        "**/*.vue",
        "**/types/**",
        "types/**",
        "**/shims-vue.d.ts",
        "**/main.ts",
        "src/main/preload.ts",
        "src/renderer"
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
