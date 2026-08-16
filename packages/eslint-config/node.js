import { config as baseConfig } from "./base.js";

/**
 * Shared ESLint config for Node/Nest packages.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nodeConfig = [
  ...baseConfig,
  {
    ignores: ["dist/**", "coverage/**"],
  },
];
