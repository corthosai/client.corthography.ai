/** Programmatic CLI entry — `runCli(argv)` is exported for tests.
 *
 * The bin shim (`bin.ts`) just calls `runCli(process.argv)`.
 */

import { Command } from "commander";
import { PressClient } from "@corthos/corthography-sdk";
import { resolveConfig } from "./config.js";
import { resolveTarget } from "./target.js";
import { formatJson, formatRunHumanReadable } from "./format.js";

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

  program
    .command("query <target>")
    .description("Stage 1: collect Corthodex API data into S3 chunks")
    .option("--env <env>", "test or prod", "test")
    .option("--ref <ref>", "Pin a partner-repo git ref (branch/tag/SHA)")
    .action(async (target: string, opts: { env: string; ref?: string }) => {
      const ctx = buildContext(opts.env);
      const r = await ctx.client.startRun({
        workflow: "template-query",
        target: resolveTarget(target, { owner: ctx.owner }),
        environment: opts.env as "test" | "prod",
        templateRef: opts.ref,
      });
      out(isJson() ? formatJson(r) : `started query: run_id=${r.runId}`);
    });

  program
    .command("render <target>")
    .description("Stage 2: render Markdown content from staged data")
    .option("--env <env>", "test or prod", "test")
    .option("--ref <ref>", "Pin a partner-repo git ref")
    .action(async (target: string, opts: { env: string; ref?: string }) => {
      const ctx = buildContext(opts.env);
      const r = await ctx.client.startRun({
        workflow: "template-render",
        target: resolveTarget(target, { owner: ctx.owner }),
        environment: opts.env as "test" | "prod",
        templateRef: opts.ref,
      });
      out(isJson() ? formatJson(r) : `started render: run_id=${r.runId}`);
    });

  program
    .command("publish <target>")
    .description("Stage 3: distribute rendered content to destination (test); --env prod requires approval")
    .option("--env <env>", "test or prod", "test")
    .option("--ref <ref>", "Pin a partner-repo git ref")
    .action(async (target: string, opts: { env: string; ref?: string }) => {
      const ctx = buildContext(opts.env);
      const r = await ctx.client.startRun({
        workflow: "template-publish",
        target: resolveTarget(target, { owner: ctx.owner }),
        environment: opts.env as "test" | "prod",
        templateRef: opts.ref,
      });
      out(isJson() ? formatJson(r) : `started publish: run_id=${r.runId}`);
    });

  program
    .command("status <run_id>")
    .description("Show the current status of a run")
    .action(async (runId: string) => {
      const { client } = buildContext();
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
    return 0;
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code?.startsWith("commander.")) {
      // commander already printed help/version/error
      return 1;
    }
    err(e instanceof Error ? e.message : String(e));
    return 1;
  }
}
