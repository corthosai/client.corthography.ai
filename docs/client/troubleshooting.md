---
title: "Troubleshooting"
description: "Symptom-keyed remediation for the common error states partners hit with the Corthography Press client."
visibility: external
audience: integrators
order: 6
---

# Troubleshooting

Symptom → cause → fix for the failure modes partners hit most often
with the [CLI](./cli.md), [SDK](./sdk.md), and [agent skills](./skills.md).

The SDK maps the API's `ApiError` envelope to typed exception
subclasses ([sdk.md § Error hierarchy](./sdk.md#error-hierarchy));
the CLI surfaces the underlying `errorCode` and `detail` on stderr.
If you're filing an issue, quote the `requestId` — it's the API's
log-correlation handle.

## Auth & scope

### `No CORTHOGRAPHY_TOKEN found`

CLI exit message:

```
No CORTHOGRAPHY_TOKEN found. Set the env var, pass --token, or write
/home/<you>/.corthography/credentials (key=value lines).
```

**Cause**: nothing matched in the credential resolution chain — no
`--token` flag, no `CORTHOGRAPHY_TOKEN` env var, no
`~/.corthography/credentials` file (or the file existed but had no
`token=` line).

**Fix**: pick one of the three. See [install.md § Credential resolution](./install.md#credential-resolution).
Env var is fastest; the credentials file is durable across shells.

### `PressAuthError` (HTTP 401)

The token is missing, malformed, unknown to the API, or revoked.

**Fix**:
- Re-export `CORTHOGRAPHY_TOKEN` (a stale shell may have an expired
  value)
- Confirm you copied the full token — they're long; truncation is
  silent
- If the token was rotated, request a new one through your press-core
  liaison

The API doesn't distinguish "wrong token" from "revoked token" in the
response — both are 401 to discourage probing.

### `PressScopeError` (HTTP 403)

The token is valid, but the action you tried isn't in your
authorization scope. The `detail` field names what was rejected:

```
PressScopeError: ScopeViolation: target dms/.../colleges/overview+nursing-degree not in partner scope
```

**Fix**: this is not a client-side issue — your authorization scope
in `partners.yaml` doesn't include the requested target, environment,
or workflow. Contact your press-core liaison; reference the
`requestId`. See [../press/governance.md § Authorization scope](../press/governance.md#authorization-scope)
for what's gated.

A `403` on a `publish --env prod` against a target that works in
`test` usually means your scope authorizes test only. Same fix.

## Quotas & rate limits

### `PressQuotaError` (HTTP 429)

```
PressQuotaError: QuotaExceeded: 5 concurrent runs in flight (limit 5)
```

**Cause**: you're at your per-partner concurrent or daily quota. The
API enforces both.

**Fix**:
- Concurrent quota: wait for in-flight runs to complete
  (`corthography list --status running`), then retry
- Daily quota: reset window is reported in the `detail` field;
  pause until then
- If you legitimately need a higher quota for a workflow you're
  scheduling at scale, ask your press-core liaison

Don't auto-retry tighter than ~10 seconds — you'll hit the quota
again before the in-flight runs free their slots.

## Run state

### `PressNotFoundError` (HTTP 404) on `getRun` / `status`

```
PressNotFoundError: NotFound: run-... not found
```

**Cause**: the run id never existed, was issued for a different
partner, or has aged out.

**Fix**:
- Double-check the id (they're long; copy/paste mistakes are common)
- Confirm you're authenticated as the same partner that started the
  run — runs are partner-scoped; another partner's run id 404s
- If the run was started > 90 days ago and you no longer see it in
  `list`, it may have aged out of the runs table

### Run stuck in `awaiting_approval`

**Cause**: this is the prod release gate. A `publish --env prod` run
pauses indefinitely until released.

**Fix**: an authorized approver runs:

```bash
corthography approve <run_id>
# or to reject:
corthography approve <run_id> --reject --reason "..."
```

The decision is recorded in the run; `--reason` lands in run
metadata. Auto-approve is opt-in per partner and disabled by
default — see [../press/governance.md § Production safety](../press/governance.md#production-safety).

### Run reports `succeeded` but no output appears

**Cause**: the run completed but the `outputPaths` map points
somewhere you're not looking, or the destination's external
distribution lag (CDN, CoPublisher staging) hasn't caught up yet.

**Fix**:
- `corthography status <run_id> --json | jq '.outputPaths'` shows
  the canonical destination(s)
- For CoPublisher destinations, the file lands in the staging area;
  the publish-target-side workflow promotes it. Check the partner's
  CoPublisher dashboard.
- If `outputPaths` is empty and status is `succeeded`, that's a bug;
  open an issue with the `requestId`

### Render run fails with "missing data field"

**Cause**: the template references a field that the `template-query`
stage didn't fetch.

**Fix**: the template's `config.json` declares which Corthodex
endpoints to call. If your template body uses `entity.foo` but
`item_endpoints` doesn't fetch the resource that contains `foo`, the
field is `undefined` at render time. Add the endpoint to the
template's `config.json` (see [../press/data-queries.md](../press/data-queries.md))
and re-run with `--ref <branch>`.

## Network & timeouts

### `AbortError` from the SDK

```
AbortError: The operation was aborted
```

**Cause**: the SDK's per-request timeout fired (default 30s).

**Fix**:
- For polling loops, this is usually a transient network issue —
  wrap in a retry
- For `startRun`, 30s should always be enough; if it isn't, the API
  is degraded — check the API status (`corthography health` returns
  the unauthenticated `/v1/health`)
- To raise the timeout for a long-tail endpoint:
  ```ts
  new PressClient({ token, timeoutMs: 60_000 })
  ```

### CLI hangs indefinitely

**Cause**: the CLI doesn't print anything until the API responds. If
the API is slow, the CLI looks frozen.

**Fix**:
- Pass `--json` and pipe through `tee` to see whether anything is
  arriving incrementally (it isn't — these are unary calls)
- Cancel with Ctrl-C and retry; if it persistently hangs, the API
  is degraded

## Plugin / skill issues

### Slash commands don't appear in Claude Code

**Cause**: the plugin install didn't take, or your Claude Code
session was started before the plugin landed.

**Fix**:
- Confirm install: `/plugin list` should show `corthography-press-client`
- If absent, re-run the install:
  ```
  /plugin marketplace add corthosai/client.corthography.ai
  /plugin install corthography-press-client@corthography-client
  ```
- Restart the Claude Code session — slash commands are loaded at
  startup

### Slash command runs but says `command not found: corthography`

**Cause**: the plugin shells out to `corthography` (the CLI binary);
if the CLI isn't on PATH, the skill fails.

**Fix**: install the CLI globally:

```bash
npm install -g @corthos/corthography-cli
which corthography
```

## When to file an issue

Open one in `corthosai/client.corthography.ai` and include:

- The exact command (or SDK snippet) you ran
- The full error including `requestId`
- The output of `corthography health`
- Whether it's reproducible

For backend issues (`PressAuthError`, `PressScopeError`,
`PressQuotaError`, anything 5xx), open in `corthosai/api.corthography.ai`
instead — those are API/scope concerns, not client bugs.

## What this doc does NOT cover

- Press-side render failures unrelated to client behavior — see
  [../press/templates.md](../press/templates.md) for template
  conventions and [../press/data-queries.md](../press/data-queries.md)
  for endpoint declaration
- API-side error semantics in detail — see [../api/errors.md](../api/errors.md)
- Approval-gate timing edge cases — see [../api/approval-gate.md](../api/approval-gate.md)
