import { describe, expect, it, vi } from "vitest";
import { pollUntilDone } from "./poll.js";
import type { RunStatus, RunSummary } from "@corthos/corthography-sdk";

function summary(status: RunStatus, runId = "r-1"): RunSummary {
  return {
    runId,
    partnerId: "dms",
    workflow: "template-query",
    target: "dms/c/t/n+s",
    environment: "test",
    status,
    startedAt: "2026-05-05T00:00:00Z",
  };
}

function stubClient(statuses: RunStatus[]): { getRun: ReturnType<typeof vi.fn> } {
  let i = 0;
  const getRun = vi.fn().mockImplementation(() => {
    const next = statuses[Math.min(i, statuses.length - 1)];
    i += 1;
    return Promise.resolve(summary(next));
  });
  return { getRun };
}

describe("pollUntilDone", () => {
  it("returns terminal/succeeded immediately when first response is succeeded", async () => {
    const client = stubClient(["succeeded"]);
    const { run, reason } = await pollUntilDone(client as never, "r-1", { pollIntervalMs: 1 });
    expect(reason).toBe("terminal");
    expect(run.status).toBe("succeeded");
    expect(client.getRun).toHaveBeenCalledTimes(1);
  });

  it("returns terminal on failed", async () => {
    const client = stubClient(["running", "failed"]);
    const { run, reason } = await pollUntilDone(client as never, "r-1", { pollIntervalMs: 1 });
    expect(reason).toBe("terminal");
    expect(run.status).toBe("failed");
    expect(client.getRun).toHaveBeenCalledTimes(2);
  });

  it("returns terminal on cancelled", async () => {
    const client = stubClient(["running", "cancelled"]);
    const { reason, run } = await pollUntilDone(client as never, "r-1", { pollIntervalMs: 1 });
    expect(reason).toBe("terminal");
    expect(run.status).toBe("cancelled");
  });

  it("returns paused when run is awaiting_approval", async () => {
    const client = stubClient(["queued", "awaiting_approval"]);
    const { run, reason } = await pollUntilDone(client as never, "r-1", { pollIntervalMs: 1 });
    expect(reason).toBe("paused");
    expect(run.status).toBe("awaiting_approval");
  });

  it("returns timeout when wall-clock budget elapses while still running", async () => {
    const client = stubClient(["running"]);
    const { run, reason } = await pollUntilDone(client as never, "r-1", {
      pollIntervalMs: 5,
      timeoutMs: 20,
    });
    expect(reason).toBe("timeout");
    expect(run.status).toBe("running");
    expect(client.getRun.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("respects custom pollIntervalMs by polling faster than the adaptive default", async () => {
    const client = stubClient(["running"]);
    const start = Date.now();
    const { reason } = await pollUntilDone(client as never, "r-1", {
      pollIntervalMs: 5,
      timeoutMs: 30,
    });
    const elapsed = Date.now() - start;
    // With the adaptive default (5s) and a 30ms budget, we'd see exactly 1 call.
    // A 5ms custom cadence should fit several polls into the same budget.
    expect(reason).toBe("timeout");
    expect(client.getRun.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(elapsed).toBeGreaterThanOrEqual(25);
  });

  it("aborts mid-poll when the signal fires", async () => {
    const controller = new AbortController();
    const client = stubClient(["running"]);
    const promise = pollUntilDone(client as never, "r-1", {
      pollIntervalMs: 100,
      timeoutMs: 5000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 10);
    await expect(promise).rejects.toThrow(/Aborted/);
  });
});
