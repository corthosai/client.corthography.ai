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
