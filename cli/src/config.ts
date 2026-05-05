/** Token + base URL resolution for the CLI.
 *
 * Precedence (high → low):
 *   1. --token / --api flags
 *   2. CORTHOGRAPHY_TOKEN / CORTHOGRAPHY_API env vars
 *   3. ~/.corthography/credentials (key=value, one per line)
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ResolvedConfig {
  token: string;
  apiUrl: string;
}

const DEFAULT_API_URL = "https://api.corthography.ai/v1";

export interface ResolveOptions {
  cliToken?: string;
  cliApi?: string;
  credentialsPath?: string;
  env?: NodeJS.ProcessEnv;
}

export function resolveConfig(opts: ResolveOptions = {}): ResolvedConfig {
  const env = opts.env ?? process.env;
  const credsPath = opts.credentialsPath ?? join(homedir(), ".corthography", "credentials");
  const fileCreds = readCredentialsFile(credsPath);

  const token = opts.cliToken ?? env.CORTHOGRAPHY_TOKEN ?? fileCreds.token;
  const apiUrl =
    opts.cliApi ?? env.CORTHOGRAPHY_API ?? fileCreds.apiUrl ?? DEFAULT_API_URL;

  if (!token) {
    throw new Error(
      "No CORTHOGRAPHY_TOKEN found. Set the env var, pass --token, or write " +
        `${credsPath} (key=value lines).`,
    );
  }

  return { token, apiUrl };
}

function readCredentialsFile(path: string): { token?: string; apiUrl?: string } {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out: { token?: string; apiUrl?: string } = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    if (key === "token" || key === "corthography_token") out.token = value;
    if (key === "api" || key === "corthography_api" || key === "api_url") out.apiUrl = value;
  }
  return out;
}
