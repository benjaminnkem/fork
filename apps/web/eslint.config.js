import { nextJsConfig } from "@repo/eslint-config/next-js";

export default [
  ...nextJsConfig,
  {
    ignores: ["playwright-report/**", "test-results/**", "e2e/**"],
  },
];
