import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveConfig } from "./config.js";

describe("resolveConfig", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "corthography-cfg-"));
    mkdirSync(join(tmpRoot, ".fractary", "env"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writeFractaryEnv(envName: string, body: string): void {
    writeFileSync(join(tmpRoot, ".fractary", "env", `.env.${envName}`), body);
  }

  it("reads CORTHOGRAPHY_TOKEN from .fractary/env/.env.<env>", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=fractary-token\n");
    const cfg = resolveConfig({
      env: {},
      credentialsPath: "/non-existent",
      fractaryRoot: tmpRoot,
      cliEnv: "test",
    });
    expect(cfg.token).toBe("fractary-token");
  });

  it("env var beats fractary file", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=from-file\n");
    const cfg = resolveConfig({
      env: { CORTHOGRAPHY_TOKEN: "from-env" },
      credentialsPath: "/non-existent",
      fractaryRoot: tmpRoot,
      cliEnv: "test",
    });
    expect(cfg.token).toBe("from-env");
  });

  it("fractary file beats ~/.corthography/credentials", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=from-fractary\n");
    const credsPath = join(tmpRoot, "creds");
    writeFileSync(credsPath, "token=from-creds\n");
    const cfg = resolveConfig({
      env: {},
      credentialsPath: credsPath,
      fractaryRoot: tmpRoot,
      cliEnv: "test",
    });
    expect(cfg.token).toBe("from-fractary");
  });

  it("picks the file matching --env", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=test-token\n");
    writeFractaryEnv("prod", "CORTHOGRAPHY_TOKEN=prod-token\n");
    const cfg = resolveConfig({
      env: {},
      credentialsPath: "/non-existent",
      fractaryRoot: tmpRoot,
      cliEnv: "prod",
    });
    expect(cfg.token).toBe("prod-token");
  });

  it("defaults <env> to 'test' when neither cliEnv nor CORTHOGRAPHY_ENV is set", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=default-test\n");
    const cfg = resolveConfig({
      env: {},
      credentialsPath: "/non-existent",
      fractaryRoot: tmpRoot,
    });
    expect(cfg.token).toBe("default-test");
  });

  it("supports `export KEY=value` and quoted values", () => {
    writeFractaryEnv(
      "test",
      [
        "# leading comment",
        '  export CORTHOGRAPHY_TOKEN="quoted token"',
        "export CORTHOGRAPHY_API='https://api.example/v1'",
        "CORTHOGRAPHY_OWNER=mf",
      ].join("\n"),
    );
    const cfg = resolveConfig({
      env: {},
      credentialsPath: "/non-existent",
      fractaryRoot: tmpRoot,
      cliEnv: "test",
    });
    expect(cfg.token).toBe("quoted token");
    expect(cfg.apiUrl).toBe("https://api.example/v1");
    expect(cfg.owner).toBe("mf");
  });

  it("CORTHOGRAPHY_OWNER env var beats the fractary file", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=t\nCORTHOGRAPHY_OWNER=from-file\n");
    const cfg = resolveConfig({
      env: { CORTHOGRAPHY_OWNER: "from-env" },
      credentialsPath: "/non-existent",
      fractaryRoot: tmpRoot,
      cliEnv: "test",
    });
    expect(cfg.owner).toBe("from-env");
  });

  it("error message names the env-specific file", () => {
    expect(() =>
      resolveConfig({
        env: {},
        credentialsPath: "/non-existent",
        fractaryRoot: tmpRoot,
        cliEnv: "prod",
      }),
    ).toThrow(/\.fractary\/env\/\.env\.prod/);
  });

  it("walks up from cwd to find .fractary/", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=walked\n");
    const nested = join(tmpRoot, "a", "b", "c");
    mkdirSync(nested, { recursive: true });
    const cfg = resolveConfig({
      env: {},
      credentialsPath: "/non-existent",
      cwd: nested,
      cliEnv: "test",
    });
    expect(cfg.token).toBe("walked");
  });

  it("empty fractaryRoot disables the lookup", () => {
    writeFractaryEnv("test", "CORTHOGRAPHY_TOKEN=should-not-be-read\n");
    expect(() =>
      resolveConfig({
        env: {},
        credentialsPath: "/non-existent",
        fractaryRoot: "",
        cliEnv: "test",
      }),
    ).toThrow(/CORTHOGRAPHY_TOKEN/);
  });
});
