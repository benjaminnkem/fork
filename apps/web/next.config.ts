import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = dirname(fileURLToPath(import.meta.url));

function loadRootEnv() {
  let current = here;
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(current, ".env");
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return;
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

loadRootEnv();

const nextConfig: NextConfig = {
  transpilePackages: ["@fork/shared"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
