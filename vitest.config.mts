import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    restoreMocks: true,

    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
          environment: "node",
          restoreMocks: true,
        },
        resolve: { alias },
      },
      {
        test: {
          name: "concurrency",
          include: ["tests/concurrency/**/*.test.ts"],
          environment: "node",
          restoreMocks: true,
          fileParallelism: false,
        },
        resolve: { alias },
      },
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
