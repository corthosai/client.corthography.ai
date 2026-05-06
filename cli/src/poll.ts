/** Polling loop for `--wait`. Lives in the CLI so a single Bash invocation
 * blocks until terminal state, instead of the agent burning tokens on a
 * status loop. Cost shifts from agent context to API requests.
 */

import type { PressClient, RunStatus, RunSummary } from "@corthos/corthography-sdk";

export type PollReason = "terminal" | "paused" | "timeout";

export interface PollOptions {
  /** Fixed cadence override. When unset, adaptive cadence is used. */
  pollIntervalMs?: number;
  /** Total wall-clock budget. Defaults to 600_000 (10 min). */
  timeoutMs?: number;
  /** Cancel mid-poll. */
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const FAST_INTERVAL_MS = 5_000;
const SLOW_INTERVAL_MS = 15_000;
const FAST_WINDOW_MS = 30_000;

const TERMINAL: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "succeeded",
  "failed",
  "cancelled",
]);

export async function pollUntilDone(
  client: Pick<PressClient, "getRun">,
  runId: string,
  opts: PollOptions = {},
): Promise<{ run: RunSummary; reason: PollReason }> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();
  const deadline = start + timeoutMs;

  while (true) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const run = await client.getRun(runId);
    if (TERMINAL.has(run.status)) {
      return { run, reason: "terminal" };
    }
    if (run.status === "awaiting_approval") {
      return { run, reason: "paused" };
    }

    const now = Date.now();
    if (now >= deadline) {
      return { run, reason: "timeout" };
    }

    const interval =
      opts.pollIntervalMs ??
      (now - start < FAST_WINDOW_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS);
    const wait = Math.min(interval, deadline - now);
    await sleep(wait, opts.signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
