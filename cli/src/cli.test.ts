import { describe, expect, it, vi } from "vitest";
import { runCli } from "./index.js";

function makeStubClient(stub: Record<string, ReturnType<typeof vi.fn>>): Record<string, ReturnType<typeof vi.fn>> {
  return stub;
}

const TEST_ENV = { CORTHOGRAPHY_TOKEN: "T", CORTHOGRAPHY_API: "https://api.example/v1" };

describe("runCli", () => {
  it("query starts a template-query run with the right shape", async () => {
    const startRun = vi.fn().mockResolvedValue({ runId: "r-1", status: "queued" });
    const client = makeStubClient({ startRun });
    const out: string[] = [];
    const code = await runCli(
      ["node", "corthography", "query", "dms/c/t/n+slug", "--env", "test"],
      {
        env: TEST_ENV,
        makeClient: () => client as never,
        out: (s) => out.push(s),
        credentialsPath: "/non-existent",
        fractaryRoot: "",
      },
    );
    expect(code).toBe(0);
    expect(startRun).toHaveBeenCalledWith({
      workflow: "template-query",
      target: "dms/c/t/n+slug",
      environment: "test",
      templateRef: undefined,
    });
    expect(out.join("\n")).toContain("run_id=r-1");
  });

  it("--json switches output to JSON", async () => {
    const startRun = vi.fn().mockResolvedValue({ runId: "r-2", status: "queued" });
    const client = makeStubClient({ startRun });
    const out: string[] = [];
    const code = await runCli(
      ["node", "corthography", "--json", "render", "dms/c/t/n+slug"],
      {
        env: TEST_ENV,
        makeClient: () => client as never,
        out: (s) => out.push(s),
        credentialsPath: "/non-existent",
        fractaryRoot: "",
      },
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(out.join(""));
    expect(parsed).toEqual({ runId: "r-2", status: "queued" });
  });

  it("status calls getRun", async () => {
    const getRun = vi.fn().mockResolvedValue({
      runId: "r-3",
      partnerId: "dms",
      workflow: "template-render",
      target: "dms/c/t/n+s",
      environment: "test",
      status: "succeeded",
      startedAt: "2026-05-03T00:00:00Z",
    });
    const client = makeStubClient({ getRun });
    const out: string[] = [];
    const code = await runCli(["node", "corthography", "status", "r-3"], {
      env: TEST_ENV,
      makeClient: () => client as never,
      out: (s) => out.push(s),
      credentialsPath: "/non-existent",
      fractaryRoot: "",
    });
    expect(code).toBe(0);
    expect(getRun).toHaveBeenCalledWith("r-3");
    expect(out.join("\n")).toContain("succeeded");
  });

  it("approve --reject sends decision=reject", async () => {
    const approveRun = vi.fn().mockResolvedValue({ runId: "r-4", decision: "reject" });
    const client = makeStubClient({ approveRun });
    const out: string[] = [];
    const code = await runCli(["node", "corthography", "approve", "r-4", "--reject", "--reason", "no go"], {
      env: TEST_ENV,
      makeClient: () => client as never,
      out: (s) => out.push(s),
      credentialsPath: "/non-existent",
      fractaryRoot: "",
    });
    expect(code).toBe(0);
    expect(approveRun).toHaveBeenCalledWith("r-4", { decision: "reject", reason: "no go" });
  });

  it("missing token without env or creds returns non-zero exit", async () => {
    const out: string[] = [];
    const errOut: string[] = [];
    const code = await runCli(["node", "corthography", "render", "dms/c/t/n+slug"], {
      env: {},
      credentialsPath: "/non-existent",
      fractaryRoot: "",
      makeClient: () => ({ startRun: vi.fn() }) as never,
      out: (s) => out.push(s),
      err: (s) => errOut.push(s),
    });
    expect(code).toBe(1);
    expect(errOut.join("\n")).toMatch(/CORTHOGRAPHY_TOKEN/);
  });

  it("query prepends CORTHOGRAPHY_OWNER to a 3-segment target", async () => {
    const startRun = vi.fn().mockResolvedValue({ runId: "r-5", status: "queued" });
    const client = makeStubClient({ startRun });
    const out: string[] = [];
    const code = await runCli(
      ["node", "corthography", "query", "education-niche/colleges/overview+computer-science-degree"],
      {
        env: { ...TEST_ENV, CORTHOGRAPHY_OWNER: "dms" },
        makeClient: () => client as never,
        out: (s) => out.push(s),
        credentialsPath: "/non-existent",
        fractaryRoot: "",
      },
    );
    expect(code).toBe(0);
    expect(startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        target: "dms/education-niche/colleges/overview+computer-science-degree",
      }),
    );
  });

  it("3-segment target without an owner exits non-zero", async () => {
    const out: string[] = [];
    const errOut: string[] = [];
    const code = await runCli(
      ["node", "corthography", "query", "education-niche/colleges/overview+slug"],
      {
        env: TEST_ENV,
        credentialsPath: "/non-existent",
        fractaryRoot: "",
        makeClient: () => ({ startRun: vi.fn() }) as never,
        out: (s) => out.push(s),
        err: (s) => errOut.push(s),
      },
    );
    expect(code).toBe(1);
    expect(errOut.join("\n")).toMatch(/owner segment/);
  });

  it("projects calls listProjects and prints template_key lines", async () => {
    const listProjects = vi.fn().mockResolvedValue([
      { templateKey: "dms/c/t/n", projectSlugs: ["a", "b"] },
    ]);
    const client = makeStubClient({ listProjects });
    const out: string[] = [];
    const code = await runCli(["node", "corthography", "projects"], {
      env: TEST_ENV,
      makeClient: () => client as never,
      out: (s) => out.push(s),
      credentialsPath: "/non-existent",
      fractaryRoot: "",
    });
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("dms/c/t/n");
    expect(out.join("\n")).toContain("- a");
  });
});
