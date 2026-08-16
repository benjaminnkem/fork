import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnvFile } from "dotenv";

function findEnvFile(startDir: string): string | undefined {
  let current = startDir;
  for (let i = 0; i < 8; i += 1) {
    const candidate = resolve(current, ".env");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return undefined;
}

/** Loads repo-root `.env` if present. Does not override already-set process env. */
export function loadRootEnv(startDir: string = process.cwd()): string | undefined {
  const path = findEnvFile(startDir);
  if (!path) {
    return undefined;
  }
  loadEnvFile({ path, override: false });
  return path;
}
