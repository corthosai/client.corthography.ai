/** Output formatting helpers. CLI honors --json for machine-readable output. */

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

interface RunProgressLike {
  phase?: string;
  status?: string;
  itemsFetched?: number;
  chunksCreated?: number;
  totalShards?: number;
  updatedAt?: string;
}

interface TemplateCommitLike {
  repo: string;
  ref: string;
  sha: string;
  resolvedAt?: string;
}

interface RunLike {
  runId: string;
  status: string;
  workflow: string;
  target: string;
  environment: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  currentPhase?: string;
  progress?: RunProgressLike;
  templateCommits?: TemplateCommitLike[];
}

/** Compact relative age, e.g. "4s ago" / "3m ago" / "1.2h ago". */
function formatAge(iso?: string): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return `${Math.floor(s)}s ago`;
  if (s < 5400) return `${Math.floor(s / 60)}m ago`;
  return `${(s / 3600).toFixed(1)}h ago`;
}

const CHAINED_WORKFLOWS: ReadonlySet<string> = new Set([
  "template-query-render",
  "template-query-render-publish",
]);

/** One-line live progress, or undefined when a run reports none. Shows the
 * per-entity count (live for single-job queries; 0-until-finalize for sharded,
 * where `totalShards` conveys the fan-out instead).
 *
 * Progress belongs to one stage. In a chained run the query stage's
 * "completed" stays on the record while later stages run, so the line names
 * the stage ("query completed") instead of reading as if the run were done. */
export function formatProgressLine(run: RunLike): string | undefined {
  const p = run.progress;
  if (!p) return undefined;
  const parts: string[] = [];
  if (typeof p.itemsFetched === "number") parts.push(`${p.itemsFetched.toLocaleString()} items`);
  if (typeof p.totalShards === "number" && p.totalShards > 1) parts.push(`${p.totalShards} shards`);
  if (parts.length === 0 && p.phase) parts.push(`${p.phase} phase`);
  if (parts.length === 0) return undefined;
  const age = formatAge(p.updatedAt);
  const stageStatus = p.status ?? run.status;
  const status = CHAINED_WORKFLOWS.has(run.workflow) && p.phase ? `${p.phase} ${stageStatus}` : stageStatus;
  return `progress:     ${status} — ${parts.join(", ")}${age ? ` (updated ${age})` : ""}`;
}

/** One `commit:` line per template-repo ref the run resolved; none when the
 * run reports no commits. The SHA is printed in full so it can be pasted into
 * `--ref`. A ref that is itself the commit prints once, and the repo is shown
 * only when the run spans more than one. */
export function formatCommitLines(run: RunLike): string[] {
  const commits = run.templateCommits ?? [];
  const showRepo = new Set(commits.map((c) => c.repo)).size > 1;
  return commits.map((c) => {
    const what = c.ref === c.sha ? c.sha : `${c.ref} @ ${c.sha}`;
    return `commit:       ${what}${showRepo ? ` (${c.repo})` : ""}`;
  });
}

export function formatRunHumanReadable(run: RunLike): string {
  const lines = [
    `run_id:       ${run.runId}`,
    `workflow:     ${run.workflow}`,
    `target:       ${run.target}`,
    `environment:  ${run.environment}`,
    `status:       ${run.status}`,
  ];
  if (run.currentPhase) lines.push(`phase:        ${run.currentPhase}`);
  const progressLine = formatProgressLine(run);
  if (progressLine) lines.push(progressLine);
  lines.push(...formatCommitLines(run));
  lines.push(`started_at:   ${run.startedAt}`);
  if (run.completedAt) lines.push(`completed_at: ${run.completedAt}`);
  if (run.error) lines.push(`error:        ${run.error}`);
  return lines.join("\n");
}
