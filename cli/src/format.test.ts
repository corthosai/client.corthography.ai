import { describe, expect, it } from "vitest";
import { formatProgressLine, formatRunHumanReadable } from "./format.js";

const base = {
  runId: "r-1",
  status: "running",
  workflow: "template-query",
  target: "dms/c/t/n+s",
  environment: "test",
  startedAt: "2026-05-05T00:00:00Z",
};

describe("formatProgressLine", () => {
  it("returns undefined when a run reports no progress", () => {
    expect(formatProgressLine(base)).toBeUndefined();
  });

  it("renders the item count for a single-job query", () => {
    const line = formatProgressLine({
      ...base,
      progress: { status: "running", itemsFetched: 1400, updatedAt: new Date().toISOString() },
    });
    expect(line).toContain("1,400 items");
    expect(line).toContain("running");
    expect(line).toContain("updated");
  });

  it("renders the shard fan-out for a sharded run (items 0 until finalize)", () => {
    const line = formatProgressLine({
      ...base,
      progress: { status: "running", itemsFetched: 0, totalShards: 12 },
    });
    expect(line).toContain("0 items");
    expect(line).toContain("12 shards");
  });
});

describe("formatRunHumanReadable", () => {
  it("includes a progress line when present", () => {
    const out = formatRunHumanReadable({ ...base, progress: { status: "running", itemsFetched: 50 } });
    expect(out).toContain("progress:");
    expect(out).toContain("50 items");
  });

  it("omits the progress line when absent", () => {
    expect(formatRunHumanReadable(base)).not.toContain("progress:");
  });
});
