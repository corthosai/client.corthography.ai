/** Output formatting helpers. CLI honors --json for machine-readable output. */

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatRunHumanReadable(run: {
  runId: string;
  status: string;
  workflow: string;
  target: string;
  environment: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  currentPhase?: string;
}): string {
  const lines = [
    `run_id:       ${run.runId}`,
    `workflow:     ${run.workflow}`,
    `target:       ${run.target}`,
    `environment:  ${run.environment}`,
    `status:       ${run.status}`,
  ];
  if (run.currentPhase) lines.push(`phase:        ${run.currentPhase}`);
  lines.push(`started_at:   ${run.startedAt}`);
  if (run.completedAt) lines.push(`completed_at: ${run.completedAt}`);
  if (run.error) lines.push(`error:        ${run.error}`);
  return lines.join("\n");
}
