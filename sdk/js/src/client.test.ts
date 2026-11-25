import { describe, expect, it, vi } from "vitest";
import { PressClient } from "./client.js";
import { PressApiError, PressAuthError, PressNetworkError, PressNotFoundError, PressScopeError } from "./errors.js";

function mockFetch(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input as string, init);
    return handler(req);
  }) as unknown as typeof fetch;
}

describe("PressClient", () => {
  it("rejects construction without a token", () => {
    expect(() => new PressClient({ token: "" })).toThrowError(/token.*required/);
  });

  it("sends the bearer token on authenticated requests", async () => {
    const seen: { headers?: Headers; method?: string; url?: string } = {};
    const fetchImpl = mockFetch(async (req) => {
      seen.headers = req.headers;
      seen.method = req.method;
      seen.url = req.url;
      return new Response(JSON.stringify({ run_id: "r-1", status: "queued" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({
      token: "TOKEN_ABC",
      baseUrl: "https://api.example/v1",
      fetch: fetchImpl,
    });
    const result = await client.startRun({
      workflow: "template-render",
      target: "dms/c/t/n+slug",
      environment: "test",
    });
    expect(result).toEqual({ runId: "r-1", status: "queued" });
    expect(seen.headers?.get("authorization")).toBe("Bearer TOKEN_ABC");
    expect(seen.method).toBe("POST");
  });

  it.each(["template-query-render", "template-query-render-publish"] as const)(
    "starts a chained %s run, sending the workflow name and ref unchanged",
    async (workflow) => {
      let sent: Record<string, unknown> = {};
      const fetchImpl = mockFetch(async (req) => {
        sent = (await req.json()) as Record<string, unknown>;
        return new Response(JSON.stringify({ run_id: "r-chain", status: "queued" }), {
          status: 202,
          headers: { "content-type": "application/json" },
        });
      });
      const client = new PressClient({ token: "T", baseUrl: "https://api.example/v1", fetch: fetchImpl });
      const result = await client.startRun({
        workflow,
        target: "dms/c/t/n+slug",
        environment: "prod",
        templateRef: "my-branch",
      });
      expect(result).toEqual({ runId: "r-chain", status: "queued" });
      expect(sent).toEqual({
        workflow,
        target: "dms/c/t/n+slug",
        environment: "prod",
        template_ref: "my-branch",
      });
    },
  );

  it("does not send the token on /v1/health", async () => {
    let authHeader: string | null = "STILL_HERE";
    const fetchImpl = mockFetch(async (req) => {
      authHeader = req.headers.get("authorization");
      return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({ token: "TOKEN_ABC", fetch: fetchImpl });
    await client.health();
    expect(authHeader).toBeNull();
  });

  it("maps 401 to PressAuthError", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ error: "Unauthenticated", detail: "missing partner identity" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({ token: "x", fetch: fetchImpl });
    await expect(client.listRuns()).rejects.toBeInstanceOf(PressAuthError);
  });

  it("maps 403 to PressScopeError", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ error: "ScopeViolation", detail: "owner 'mf' not in authorized_owners" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({ token: "x", fetch: fetchImpl });
    await expect(
      client.startRun({ workflow: "template-render", target: "mf/foo/bar/baz+slug" }),
    ).rejects.toBeInstanceOf(PressScopeError);
  });

  it("maps 404 to PressNotFoundError", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ error: "NotFound", detail: "run not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({ token: "x", fetch: fetchImpl });
    await expect(client.getRun("ghost")).rejects.toBeInstanceOf(PressNotFoundError);
  });

  it("normalises run summary snake_case → camelCase", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(
        JSON.stringify({
          run_id: "r-9",
          partner_id: "dms",
          workflow: "template-render",
          target: "dms/c/t/n+s",
          environment: "test",
          status: "succeeded",
          started_at: "2026-05-03T00:00:00Z",
          completed_at: "2026-05-03T00:05:00Z",
          sfn_execution_arn: "arn:...:r-9",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = new PressClient({ token: "x", fetch: fetchImpl });
    const run = await client.getRun("r-9");
    expect(run.runId).toBe("r-9");
    expect(run.partnerId).toBe("dms");
    expect(run.sfnExecutionArn).toBe("arn:...:r-9");
    expect(run.progress).toBeUndefined();
  });

  it("maps the nested progress object snake_case → camelCase", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(
        JSON.stringify({
          run_id: "r-10",
          partner_id: "dms",
          workflow: "template-query",
          target: "dms/c/t/n+s",
          environment: "test",
          status: "running",
          started_at: "2026-05-03T00:00:00Z",
          progress: {
            phase: "query",
            status: "running",
            items_fetched: 1400,
            chunks_created: 0,
            total_shards: 12,
            updated_at: "2026-05-03T00:01:00Z",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = new PressClient({ token: "x", fetch: fetchImpl });
    const run = await client.getRun("r-10");
    expect(run.progress).toEqual({
      phase: "query",
      status: "running",
      itemsFetched: 1400,
      chunksCreated: 0,
      totalShards: 12,
      updatedAt: "2026-05-03T00:01:00Z",
    });
  });

  it("listProjects normalises the response", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(
        JSON.stringify({
          projects: [
            { template_key: "dms/c/t/n", project_slugs: ["a", "b"] },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const client = new PressClient({ token: "x", fetch: fetchImpl });
    const projects = await client.listProjects();
    expect(projects).toEqual([{ templateKey: "dms/c/t/n", projectSlugs: ["a", "b"] }]);
  });

  it("normalises a base URL without /v1 by appending it", async () => {
    let seenUrl = "";
    const fetchImpl = mockFetch(async (req) => {
      seenUrl = req.url;
      return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({
      token: "x",
      baseUrl: "https://test.api.corthography.ai",
      fetch: fetchImpl,
    });
    await client.health();
    expect(seenUrl).toBe("https://test.api.corthography.ai/v1/health");
  });

  it("normalises a base URL with trailing slash", async () => {
    let seenUrl = "";
    const fetchImpl = mockFetch(async (req) => {
      seenUrl = req.url;
      return new Response(JSON.stringify({ status: "ok", version: "0.1.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = new PressClient({
      token: "x",
      baseUrl: "https://test.api.corthography.ai/v1/",
      fetch: fetchImpl,
    });
    await client.health();
    expect(seenUrl).toBe("https://test.api.corthography.ai/v1/health");
  });

  it("non-envelope error responses include status + URL + body in the message", async () => {
    const fetchImpl = mockFetch(
      async () =>
        new Response('{"message":"Not Found"}', {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new PressClient({
      token: "x",
      baseUrl: "https://api.example/v1",
      fetch: fetchImpl,
    });
    let caught: unknown;
    try {
      await client.health();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PressApiError);
    const msg = (caught as Error).message;
    expect(msg).toContain("HTTP 404");
    expect(msg).toContain("https://api.example/v1/health");
    expect(msg).toContain("UnknownError");
    expect(msg).toContain("Not Found");
    expect((caught as PressApiError).rawBody).toBe('{"message":"Not Found"}');
    expect((caught as PressApiError).url).toBe("https://api.example/v1/health");
  });

  it("DNS / connection failures surface as PressNetworkError with the URL", async () => {
    const fetchImpl = (() => {
      throw Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND", hostname: "no-such-host.example" },
      });
    }) as unknown as typeof fetch;
    const client = new PressClient({
      token: "x",
      baseUrl: "https://no-such-host.example/v1",
      fetch: fetchImpl,
    });
    let caught: unknown;
    try {
      await client.health();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PressNetworkError);
    expect((caught as Error).message).toContain("no-such-host.example/v1/health");
    expect((caught as Error).message).toContain("fetch failed");
  });

  it("aborts a request that exceeds timeoutMs", async () => {
    const fetchImpl = ((_input: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }) as unknown as typeof fetch;
    const client = new PressClient({
      token: "x",
      fetch: fetchImpl,
      timeoutMs: 50,
    });
    await expect(client.health()).rejects.toThrow(/aborted/);
  });
});

describe("PressClient template commits", () => {
  const SHA = "59e323b56617e6c12b18e64ad4bf658818bcff47";
  const OTHER_SHA = "0123456789abcdef0123456789abcdef01234567";
  const REPO = "github.com/your-org/your-templates";

  const runBody = (extra: Record<string, unknown>): Record<string, unknown> => ({
    run_id: "r-20",
    partner_id: "dms",
    workflow: "template-render",
    target: "dms/c/t/n+s",
    environment: "test",
    status: "succeeded",
    started_at: "2026-11-18T16:03:00Z",
    ...extra,
  });

  const clientReturning = (body: unknown): PressClient =>
    new PressClient({
      token: "x",
      fetch: mockFetch(
        async () =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    });

  it("maps template_commits snake_case → camelCase, keeping the API's order", async () => {
    const run = await clientReturning(
      runBody({
        template_commits: [
          { repo: REPO, ref: "main", sha: SHA, resolved_at: "2026-11-18T16:03:59Z" },
          { repo: REPO, ref: OTHER_SHA, sha: OTHER_SHA, resolved_at: "2026-11-18T16:04:40Z" },
        ],
      }),
    ).getRun("r-20");
    expect(run.templateCommits).toEqual([
      { repo: REPO, ref: "main", sha: SHA, resolvedAt: "2026-11-18T16:03:59Z" },
      { repo: REPO, ref: OTHER_SHA, sha: OTHER_SHA, resolvedAt: "2026-11-18T16:04:40Z" },
    ]);
  });

  it.each([
    ["absent", {}],
    ["null", { template_commits: null }],
    ["an empty list", { template_commits: [] }],
    ["not a list", { template_commits: { main: SHA } }],
  ])("is undefined when template_commits is %s", async (_label, extra) => {
    const run = await clientReturning(runBody(extra)).getRun("r-20");
    expect(run.templateCommits).toBeUndefined();
    expect(run.status).toBe("succeeded");
  });

  it("leaves out entries without a string repo, ref and sha instead of throwing", async () => {
    const run = await clientReturning(
      runBody({
        template_commits: [
          null,
          "main",
          { repo: REPO, ref: "main" },
          { repo: REPO, ref: 7, sha: SHA },
          { repo: "", ref: "main", sha: SHA },
          { repo: REPO, ref: "main", sha: SHA, resolved_at: null },
        ],
      }),
    ).getRun("r-20");
    expect(run.templateCommits).toEqual([{ repo: REPO, ref: "main", sha: SHA }]);
  });

  it("is undefined when no entry is usable", async () => {
    const run = await clientReturning(runBody({ template_commits: [{ repo: REPO }] })).getRun("r-20");
    expect(run.templateCommits).toBeUndefined();
  });

  it("maps template_commits for each run of listRuns", async () => {
    const runs = await clientReturning({
      runs: [
        runBody({ run_id: "r-new", template_commits: [{ repo: REPO, ref: "main", sha: SHA }] }),
        runBody({ run_id: "r-old", template_commits: null }),
      ],
    }).listRuns();
    expect(runs.map((r) => [r.runId, r.templateCommits?.[0]?.sha])).toEqual([
      ["r-new", SHA],
      ["r-old", undefined],
    ]);
  });
});
