/** Token + base URL + owner resolution for the CLI.
 *
 * Precedence (high → low):
 *   1. --token / --api flags
 *   2. CORTHOGRAPHY_TOKEN / CORTHOGRAPHY_API / CORTHOGRAPHY_OWNER env vars
 *   3. .fractary/env/.env.<env> in the project (walked up from cwd)
 *   4. ~/.corthography/credentials (key=value, one per line)
 *
 * <env> resolution: cliEnv arg → CORTHOGRAPHY_ENV env var → "test".
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface ResolvedConfig {
  token: string;
  apiUrl: string;
  owner?: string;
}

const DEFAULT_API_URL = "https://api.corthography.ai/v1";

export interface ResolveOptions {
  cliToken?: string;
  cliApi?: string;
  /** Subcommand --env value (test/prod). Used to pick .fractary/env/.env.<env>. */
  cliEnv?: string;
  credentialsPath?: string;
  /**
   * Override fractary project root. Pass an empty string to skip the lookup
   * entirely (used by tests to keep them deterministic).
   */
  fractaryRoot?: string;
  /** cwd to start walking from when fractaryRoot is not provided. */
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveConfig(opts: ResolveOptions = {}): ResolvedConfig {
  const env = opts.env ?? process.env;
  const cliEnv = opts.cliEnv ?? env.CORTHOGRAPHY_ENV ?? "test";

  const credsPath = opts.credentialsPath ?? join(homedir(), ".corthography", "credentials");
  const fileCreds = readCredentialsFile(credsPath);

  const fractaryRoot = resolveFractaryRoot(opts);
  const fractaryCreds = fractaryRoot
    ? readDotenvFile(join(fractaryRoot, ".fractary", "env", `.env.${cliEnv}`))
    : {};

  const token = opts.cliToken ?? env.CORTHOGRAPHY_TOKEN ?? fractaryCreds.token ?? fileCreds.token;
  const apiUrl =
    opts.cliApi ?? env.CORTHOGRAPHY_API ?? fractaryCreds.apiUrl ?? fileCreds.apiUrl ?? DEFAULT_API_URL;
  const owner = env.CORTHOGRAPHY_OWNER ?? fractaryCreds.owner ?? fileCreds.owner;

  if (!token) {
    throw new Error(
      "No CORTHOGRAPHY_TOKEN found. Set the env var, pass --token, add it to " +
        `.fractary/env/.env.${cliEnv}, or write ${credsPath} (key=value lines).`,
    );
  }

  return { token, apiUrl, owner };
}

function resolveFractaryRoot(opts: ResolveOptions): string | undefined {
  if (opts.fractaryRoot !== undefined) {
    return opts.fractaryRoot || undefined;
  }
  return findFractaryRoot(opts.cwd ?? process.cwd());
}

function findFractaryRoot(start: string): string | undefined {
  let current: string;
  try {
    current = resolve(start);
  } catch {
    return undefined;
  }
  while (true) {
    const marker = join(current, ".fractary");
    if (existsSync(marker)) {
      try {
        if (statSync(marker).isDirectory()) return current;
      } catch {
        // fall through
      }
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

interface ParsedCreds {
  token?: string;
  apiUrl?: string;
  owner?: string;
}

function readCredentialsFile(path: string): ParsedCreds {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out: ParsedCreds = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key === "token" || key === "corthography_token") out.token = value;
    if (key === "api" || key === "corthography_api" || key === "api_url") out.apiUrl = value;
    if (key === "owner" || key === "corthography_owner") out.owner = value;
  }
  return out;
}

/**
 * Parse a .env-style file. Supports:
 *   - `KEY=value`
 *   - `export KEY=value`
 *   - single- or double-quoted values
 *   - `#` line comments and blank lines
 * Recognized keys: CORTHOGRAPHY_TOKEN, CORTHOGRAPHY_API, CORTHOGRAPHY_OWNER.
 */
function readDotenvFile(path: string): ParsedCreds {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out: ParsedCreds = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const stripped = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = stripped.indexOf("=");
    if (eq < 0) continue;
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key === "CORTHOGRAPHY_TOKEN") out.token = value;
    else if (key === "CORTHOGRAPHY_API") out.apiUrl = value;
    else if (key === "CORTHOGRAPHY_OWNER") out.owner = value;
  }
  return out;
}
