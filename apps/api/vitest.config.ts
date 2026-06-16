import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    // اختبارات التكامل تشترك في قاعدة بيانات واحدة → نشغّلها بتسلسل.
    fileParallelism: false,
    hookTimeout: 30000,
  },
});
