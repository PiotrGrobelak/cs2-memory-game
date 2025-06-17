import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.{test,spec}.{js,ts,vue}"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "coverage/",
        ".nuxt/",
        ".output/",
      ],
    },
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "."),
      "@": resolve(__dirname, "."),
    },
  },
});
