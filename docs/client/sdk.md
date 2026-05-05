---
title: "SDK reference"
description: "TypeScript SDK surface — PressClient methods, request/response types, and the typed error hierarchy."
visibility: external
audience: integrators
order: 3
---

# SDK reference

`@corthos/corthography-sdk` is the TypeScript wrapper around the
[Corthography Press API](../api/overview.md). It's what the
[CLI](./cli.md) and the [Claude plugin skills](./skills.md) use under
the hood; install it directly when you want programmatic control —
custom integrations, CI scripts, dashboards.

## Install

```bash
npm install @corthos/corthography-sdk
```

Requires Node 20+ (the SDK uses the global `fetch`).

## Constructor

```ts
import { PressClient } from "@corthos/corthography-sdk";

const client = new PressClient({
  token: process.env.CORTHOGRAPHY_TOKEN!,
  baseUrl: "https://api.corthography.ai/v1",  // optional; this is the default
  timeoutMs: 30_000,                           // optional; this is the default
});
```

| Option | Type | Required | Default | Notes |
|---|---|---|---|---|
| `token` | `string` | yes | — | Bearer token. Empty string throws in the constructor. |
| `baseUrl` | `string` | no | `https://api.corthography.ai/v1` | Trailing slashes are stripped. |
| `fetch` | `typeof fetch` | no | global `fetch` | Inject a custom fetch (e.g., `undici` instance) — useful for tests. |
| `timeoutMs` | `number` | no | `30_000` | Per-request timeout via `AbortController`. |

## Methods

All methods return Promises that resolve with parsed JSON on 2xx, or
reject with one of the typed error subclasses on 4xx/5xx (see
[Error hierarchy](#error-hierarchy)).

### `startRun(req)`

Start a new workflow run.

```ts
const { runId, status } = await client.startRun({
  workflow: "template-render",   // "template-query" | "template-render" | "template-publish"
  target: "dms/education-niche/colleges/overview+computer-science-degree",
  environment: "test",            // "test" | "prod" — defaults to "test"
  templateRef: "v1.4.0",          // optional partner-repo git ref
});
// runId === "run-..."  status === "queued"
```

`POST /v1/runs` underneath. Returns `{ runId, status: "queued" }`.

### `getRun(runId)`

Fetch the current state of a run.

```ts
const summary = await client.getRun("run-1714824742-a3f8c901");
```

Returns a `RunSummary` (see [Types](#types)). `404` from the API maps
to `PressNotFoundError`.

### `listRuns(opts?)`

List recent runs for the current partner scope.

```ts
const recent = await client.listRuns();
const failed = await client.listRuns({ limit: 50, status: "failed" });
```

| Option | Type | Notes |
|---|---|---|
| `limit` | `number` | Defaults to API default. Max enforced server-side. |
| `status` | `string` | Filter to one of the `RunStatus` values. |

### `getRunLogs(runId)`

```ts
const { logGroup, runId } = await client.getRunLogs("run-...");
```

Returns the CloudWatch log group pointer; logs themselves are fetched
out-of-band from AWS.

### `approveRun(runId, req?)`

Approve or reject a prod-publish run paused at the release gate.

```ts
await client.approveRun("run-...");                                     // approve
await client.approveRun("run-...", { decision: "reject", reason: "…" }); // reject
```

`decision` defaults to `"approve"`. The run must be in
`awaiting_approval`; otherwise the API returns 409.

### `listProjects()`

```ts
const projects = await client.listProjects();
// [{ templateKey: "dms/.../colleges/overview", projectSlugs: ["computer-science-degree", ...] }]
```

### `listTemplates()`

```ts
const templates = await client.listTemplates();
// [{ templateKey: "dms/.../colleges/overview" }, ...]
```

### `health()`

Unauthenticated probe.

```ts
const { status, version } = await client.health();
// { status: "ok", version: "0.1.0" }
```

## Types

```ts
type Workflow = "template-query" | "template-render" | "template-publish";
type Environment = "test" | "prod";
type RunStatus =
  | "queued" | "running" | "awaiting_approval"
  | "succeeded" | "failed" | "cancelled";

interface StartRunRequest {
  workflow: Workflow;
  target: string;
  environment?: Environment;
  templateRef?: string;
}

interface RunSummary {
  runId: string;
  partnerId: string;
  workflow: Workflow;
  target: string;
  environment: Environment;
  status: RunStatus;
  currentPhase?: string;
  startedAt: string;
  completedAt?: string;
  sfnExecutionArn?: string;
  outputPaths?: Record<string, string>;
  error?: string;
}
```

The full type set is exported from the package root:

```ts
import type {
  ClientOptions, StartRunRequest, StartRunResponse, RunSummary,
  ProjectListItem, TemplateListItem, HealthResponse,
  Workflow, Environment, RunStatus,
} from "@corthos/corthography-sdk";
```

## Error hierarchy

The SDK maps the API's uniform `ApiError` envelope to typed exceptions
so callers can branch cleanly:

```
PressApiError                  (any non-2xx, base class)
├── PressAuthError             (401: missing/malformed/unknown/revoked token)
├── PressScopeError            (403: token valid but not authorized for this action/target)
├── PressNotFoundError         (404: run/project/template not found, or scoped away)
└── PressQuotaError            (429: per-partner concurrent or daily quota exceeded)
```

Each carries:

```ts
class PressApiError extends Error {
  readonly status: number;     // HTTP status
  readonly errorCode: string;  // API "error" field
  readonly detail?: string;    // API "detail" field
  readonly requestId?: string; // API "request_id" — quote this when filing issues
}
```

A typical handler:

```ts
import {
  PressClient,
  PressAuthError, PressScopeError, PressQuotaError, PressNotFoundError,
} from "@corthos/corthography-sdk";

try {
  await client.startRun({ workflow: "template-render", target });
} catch (e) {
  if (e instanceof PressAuthError) /* re-issue token, see install.md */;
  else if (e instanceof PressScopeError) /* contact press-core liaison */;
  else if (e instanceof PressQuotaError) /* back off and retry */;
  else if (e instanceof PressNotFoundError) /* fix target string */;
  else throw e;  // 5xx, network, abort — let it propagate
}
```

See [troubleshooting.md](./troubleshooting.md) for symptom-keyed
remediation.

## Polling pattern

The API doesn't push; clients poll. A reasonable shape:

```ts
const { runId } = await client.startRun({ workflow, target });
let summary = await client.getRun(runId);
while (summary.status === "queued" || summary.status === "running") {
  await new Promise((r) => setTimeout(r, 5_000));
  summary = await client.getRun(runId);
}
if (summary.status === "succeeded") console.log(summary.outputPaths);
else if (summary.status === "awaiting_approval") /* notify approver */;
else console.error(summary.error ?? summary.status);
```

For long-running renders, 5–10 second polls are appropriate. Don't
poll faster than 1Hz — you'll hit `PressQuotaError` before you hit
the run's actual completion.

## What this doc does NOT cover

- The CLI wrapper — see [cli.md](./cli.md)
- The Claude plugin slash commands — see [skills.md](./skills.md)
- The HTTP wire format — see [../api/overview.md](../api/overview.md)
  and the OpenAPI reference
- Workflow semantics (what each workflow actually does on the engine
  side) — see [../press/overview.md](../press/overview.md)
