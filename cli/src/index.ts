/** Programmatic CLI entry — `runCli(argv)` is exported for tests.
 *
 * The bin shim (`bin.ts`) just calls `runCli(process.argv)`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { PressClient } from "@corthos/corthography-sdk";
import { resolveConfig } from "./config.js";
import { resolveTarget } from "./target.js";
import { formatJson, formatRunHumanReadable } from "./format.js";
import { pollUntilDone, type PollReason } from "./poll.js";

interface WaitOpts {
  wait?: boolean;
  waitTimeout?: string;
  pollInterval?: string;
}

function parsePositiveSeconds(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${flag} must be a positive number of seconds (got ${raw})`);
  }
  return n * 1000;
}

function exitCodeForReason(reason: PollReason, status: string): number {
  if (reason === "timeout") return 3;
  if (reason === "paused") return 2;
  // terminal
  if (status === "succeeded") return 0;
  return 1; // failed | cancelled
}

function readCliVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export interface CliDeps {
  /** Optional client factory. Tests inject a stub. */
  makeClient?: (token: string, apiUrl: string) => PressClient;
  /** Optional output sink. Defaults to console. */
  out?: (s: string) => void;
  err?: (s: string) => void;
  /** Optional env override (tests). */
  env?: NodeJS.ProcessEnv;
  /** Override credentials path (tests). */
  credentialsPath?: string;
  /** Override fractary project root (tests). Empty string disables the lookup. */
  fractaryRoot?: string;
  /** Override cwd used for fractary root discovery (tests). */
  cwd?: string;
}

export async function runCli(argv: readonly string[], deps: CliDeps = {}): Promise<number> {
  const out = deps.out ?? ((s) => process.stdout.write(s + "\n"));
  const err = deps.err ?? ((s) => process.stderr.write(s + "\n"));
  const makeClient =
    deps.makeClient ?? ((token: string, apiUrl: string) => new PressClient({ token, baseUrl: apiUrl }));

  const program = new Command("corthography");
  program
    .version(readCliVersion(), "-v, --version", "Print the CLI version")
    .description("Corthography Press CLI — start workflow runs and inspect run state")
    .option("--token <token>", "Bearer token (env: CORTHOGRAPHY_TOKEN)")
    .option("--api <url>", "API base URL (env: CORTHOGRAPHY_API)")
    .option("--json", "Output JSON instead of human-readable text")
    .exitOverride();

  const buildContext = (cliEnv?: string): { client: PressClient; owner?: string } => {
    const opts = program.opts<{ token?: string; api?: string }>();
    const cfg = resolveConfig({
      cliToken: opts.token,
      cliApi: opts.api,
      cliEnv,
      env: deps.env,
      credentialsPath: deps.credentialsPath,
      fractaryRoot: deps.fractaryRoot,
      cwd: deps.cwd,
    });
    return { client: makeClient(cfg.token, cfg.apiUrl), owner: cfg.owner };
  };

  const isJson = (): boolean => Boolean(program.opts<{ json?: boolean }>().json);

  let pendingExitCode = 0;

  const runWaitFlow = async (
    client: PressClient,
    runId: string,
    waitOpts: WaitOpts,
  ): Promise<void> => {
    const timeoutMs = parsePositiveSeconds(waitOpts.waitTimeout, "--wait-timeout") ?? 600_000;
    const pollIntervalMs = parsePositiveSeconds(waitOpts.pollInterval, "--poll-interval");
    const { run, reason } = await pollUntilDone(client, runId, { timeoutMs, pollIntervalMs });
    if (isJson()) {
      out(formatJson(run));
    } else {
      out(formatRunHumanReadable(run));
      if (reason === "paused") {
        out(`paused: awaiting approval — release with \`corthography approve ${run.runId}\``);
      } else if (reason === "timeout") {
        out(
          `still running, last status: ${run.status} — re-run with \`corthography status ${run.runId} --wait\` to keep waiting`,
        );
      }
    }
    pendingExitCode = exitCodeForReason(reason, run.status);
  };

  const startCommand = (
    name: "query" | "render" | "publish",
    workflow: "template-query" | "template-render" | "template-publish",
    description: string,
  ): Command =>
    program
      .command(`${name} <target>`)
      .description(description)
      .option("--env <env>", "test or prod", "test")
      .option("--ref <ref>", "Pin a partner-repo git ref (branch/tag/SHA)")
      .option("--wait", "Block until the run reaches a terminal state")
      .option("--wait-timeout <seconds>", "Max wait time when --wait is set (default: 600)")
      .option("--poll-interval <seconds>", "Fixed poll cadence (default: adaptive 5s/15s)")
      .action(
        async (
          target: string,
          opts: { env: string; ref?: string } & WaitOpts,
        ) => {
          const ctx = buildContext(opts.env);
          const r = await ctx.client.startRun({
            workflow,
            target: resolveTarget(target, { owner: ctx.owner }),
            environment: opts.env as "test" | "prod",
            templateRef: opts.ref,
          });
          if (opts.wait) {
            await runWaitFlow(ctx.client, r.runId, opts);
            return;
          }
          out(isJson() ? formatJson(r) : `started ${name}: run_id=${r.runId}`);
        },
      );

  startCommand("query", "template-query", "Stage 1: collect Corthodex API data into S3 chunks");
  startCommand("render", "template-render", "Stage 2: render Markdown content from staged data");
  startCommand(
    "publish",
    "template-publish",
    "Stage 3: distribute rendered content to destination (test); --env prod requires approval",
  );

  program
    .command("status <run_id>")
    .description("Show the current status of a run")
    .option("--wait", "Block until the run reaches a terminal state")
    .option("--wait-timeout <seconds>", "Max wait time when --wait is set (default: 600)")
    .option("--poll-interval <seconds>", "Fixed poll cadence (default: adaptive 5s/15s)")
    .action(async (runId: string, opts: WaitOpts) => {
      const { client } = buildContext();
      if (opts.wait) {
        await runWaitFlow(client, runId, opts);
        return;
      }
      const run = await client.getRun(runId);
      out(isJson() ? formatJson(run) : formatRunHumanReadable(run));
    });

  program
    .command("list")
    .description("List your recent runs")
    .option("--limit <n>", "How many to return", "20")
    .option("--status <status>", "Filter by status (queued, running, succeeded, failed, ...)")
    .action(async (opts: { limit: string; status?: string }) => {
      const { client } = buildContext();
      const runs = await client.listRuns({ limit: Number(opts.limit), status: opts.status });
      out(isJson() ? formatJson(runs) : runs.map(formatRunHumanReadable).join("\n---\n"));
    });

  program
    .command("logs <run_id>")
    .description("Show the CloudWatch log group for a run")
    .action(async (runId: string) => {
      const { client } = buildContext();
      const r = await client.getRunLogs(runId);
      out(isJson() ? formatJson(r) : `log_group: ${r.logGroup}`);
    });

  program
    .command("approve <run_id>")
    .description("Approve a run paused at the prod release gate")
    .option("--reject", "Reject instead of approve")
    .option("--reason <reason>", "Reason for the decision")
    .action(async (runId: string, opts: { reject?: boolean; reason?: string }) => {
      const { client } = buildContext();
      const r = await client.approveRun(runId, {
        decision: opts.reject ? "reject" : "approve",
        reason: opts.reason,
      });
      out(isJson() ? formatJson(r) : `${r.decision}: ${r.runId}`);
    });

  program
    .command("projects")
    .description("List projects you're authorized to target")
    .action(async () => {
      const { client } = buildContext();
      const projects = await client.listProjects();
      out(
        isJson()
          ? formatJson(projects)
          : projects
              .map((p) => `${p.templateKey}\n  ${p.projectSlugs.map((s) => `- ${s}`).join("\n  ")}`)
              .join("\n"),
      );
    });

  program
    .command("templates")
    .description("List templates you're authorized to target")
    .action(async () => {
      const { client } = buildContext();
      const templates = await client.listTemplates();
      out(isJson() ? formatJson(templates) : templates.map((t) => t.templateKey).join("\n"));
    });

  try {
    await program.parseAsync(argv);
    return pendingExitCode;
  } catch (e) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
    if (typeof code === "string" && code.startsWith("commander.")) {
      // --help and --version are normal terminations, not failures.
      return code === "commander.version" || code.startsWith("commander.help") ? 0 : 1;
    }
    err(e instanceof Error ? e.message : String(e));
    return 1;
  }
}
