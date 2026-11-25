import { describe, expect, it } from "vitest";
import { formatCommitLines, formatProgressLine, formatRunHumanReadable } from "./format.js";

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

  it("names the stage in a chained run, where a finished stage's progress outlives it", () => {
    // What the API returns while the render stage of a query-render run is
    // going: the run is running, and the progress is the query stage's.
    const line = formatProgressLine({
      ...base,
      workflow: "template-query-render",
      status: "running",
      progress: { phase: "query", status: "completed", itemsFetched: 1 },
    });
    expect(line).toBe("progress:     query completed — 1 items");
  });

  it("leaves a single-stage run's progress line as it was", () => {
    const line = formatProgressLine({
      ...base,
      progress: { phase: "query", status: "completed", itemsFetched: 1 },
    });
    expect(line).toBe("progress:     completed — 1 items");
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

describe("formatCommitLines", () => {
  const SHA = "59e323b56617e6c12b18e64ad4bf658818bcff47";
  const BRANCH_SHA = "b36a443aa30f3c1d2e4f5a6b7c8d9e0f1a2b3c4d";
  const REPO = "github.com/your-org/your-templates";

  it("returns no lines when a run reports no commits", () => {
    expect(formatCommitLines(base)).toEqual([]);
    expect(formatCommitLines({ ...base, templateCommits: [] })).toEqual([]);
  });

  it("prints the ref and the full SHA", () => {
    const lines = formatCommitLines({ ...base, templateCommits: [{ repo: REPO, ref: "main", sha: SHA }] });
    expect(lines).toEqual([`commit:       main @ ${SHA}`]);
  });

  it("prints one line per ref, in the order given", () => {
    const lines = formatCommitLines({
      ...base,
      templateCommits: [
        { repo: REPO, ref: "feat/388-roi", sha: BRANCH_SHA },
        { repo: REPO, ref: "main", sha: SHA },
      ],
    });
    expect(lines).toEqual([`commit:       feat/388-roi @ ${BRANCH_SHA}`, `commit:       main @ ${SHA}`]);
  });

  it("prints a ref that is itself the commit once", () => {
    const lines = formatCommitLines({ ...base, templateCommits: [{ repo: REPO, ref: SHA, sha: SHA }] });
    expect(lines).toEqual([`commit:       ${SHA}`]);
  });

  it("names the repo only when the run spans more than one", () => {
    const lines = formatCommitLines({
      ...base,
      templateCommits: [
        { repo: REPO, ref: "main", sha: SHA },
        { repo: "github.com/your-org/shared-macros", ref: "main", sha: BRANCH_SHA },
      ],
    });
    expect(lines).toEqual([
      `commit:       main @ ${SHA} (${REPO})`,
      `commit:       main @ ${BRANCH_SHA} (github.com/your-org/shared-macros)`,
    ]);
  });
});

describe("formatRunHumanReadable commits", () => {
  const SHA = "59e323b56617e6c12b18e64ad4bf658818bcff47";

  it("puts the commit line between the status block and the timestamps", () => {
    const out = formatRunHumanReadable({
      ...base,
      status: "succeeded",
      completedAt: "2026-05-05T00:05:00Z",
      templateCommits: [{ repo: "github.com/your-org/your-templates", ref: "main", sha: SHA }],
    });
    expect(out.split("\n")).toEqual([
      "run_id:       r-1",
      "workflow:     template-query",
      "target:       dms/c/t/n+s",
      "environment:  test",
      "status:       succeeded",
      `commit:       main @ ${SHA}`,
      "started_at:   2026-05-05T00:00:00Z",
      "completed_at: 2026-05-05T00:05:00Z",
    ]);
  });

  it("is unchanged for a run without commits", () => {
    expect(formatRunHumanReadable(base)).not.toContain("commit:");
  });
});
