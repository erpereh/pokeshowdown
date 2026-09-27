import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(rootDir, "src").replaceAll("\\", "/");

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: path.join(rootDir, "tests/support/empty.ts").replaceAll("\\", "/"),
      },
      {
        find: /^@\//,
        replacement: `${srcDir}/`,
      },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 120_000,
    passWithNoTests: true,
  },
});
