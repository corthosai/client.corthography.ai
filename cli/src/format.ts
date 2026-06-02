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

/** One-line live progress, or undefined when a run reports none. Shows the
 * per-entity count (live for single-job queries; 0-until-finalize for sharded,
 * where `totalShards` conveys the fan-out instead). */
export function formatProgressLine(run: RunLike): string | undefined {
  const p = run.progress;
  if (!p) return undefined;
  const parts: string[] = [];
  if (typeof p.itemsFetched === "number") parts.push(`${p.itemsFetched.toLocaleString()} items`);
  if (typeof p.totalShards === "number" && p.totalShards > 1) parts.push(`${p.totalShards} shards`);
  if (parts.length === 0 && p.phase) parts.push(`${p.phase} phase`);
  if (parts.length === 0) return undefined;
  const age = formatAge(p.updatedAt);
  const status = p.status ?? run.status;
  return `progress:     ${status} — ${parts.join(", ")}${age ? ` (updated ${age})` : ""}`;
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
  lines.push(`started_at:   ${run.startedAt}`);
  if (run.completedAt) lines.push(`completed_at: ${run.completedAt}`);
  if (run.error) lines.push(`error:        ${run.error}`);
  return lines.join("\n");
}
