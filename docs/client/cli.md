---
title: "CLI reference"
description: "Subcommand reference for the `corthography` CLI — flags, examples, and exit behavior for each verb."
visibility: external
audience: integrators
order: 2
---

# CLI reference

The `corthography` binary ships from `@corthos/corthography-cli` and
wraps the [SDK](./sdk.md). It exposes nine subcommands grouped into
three categories: **start a run** (`query`, `render`, `publish`),
**inspect runs** (`status`, `list`, `logs`, `approve`), and **discover
scope** (`projects`, `templates`).

For install and credentials, see [install.md](./install.md).

## Global flags

| Flag | Default | Description |
|---|---|---|
| `--token <token>` | `CORTHOGRAPHY_TOKEN` env var, then credentials file | Bearer token (overrides env + file) |
| `--api <url>` | `CORTHOGRAPHY_API` env var, then file, then `https://api.corthography.ai/v1` | API base URL (overrides env + file) |
| `--json` | off | Emit JSON instead of human-readable output |

## Pipeline commands

The three workflows correspond to the three Press pipeline stages
(see [../press/overview.md](../press/overview.md)). All three accept
the same arguments.

### `query <target>`

Stage 1: collect Corthodex API data into S3 chunks.

```bash
corthography query dms/education-niche/colleges/overview+computer-science-degree
# → started query: run_id=run-1714824742-a3f8c901
```

| Flag | Default | Description |
|---|---|---|
| `--env <test\|prod>` | `test` | Environment to dispatch into |
| `--ref <ref>` | (latest of partner repo's default branch) | Pin a partner-repo git ref (branch, tag, or SHA) |

### `render <target>`

Stage 2: render Markdown content from previously staged data. Same
flags as `query`.

```bash
corthography render dms/education-niche/colleges/overview+computer-science-degree --ref v1.4.0
```

### `publish <target>`

Stage 3: distribute rendered content to its destination.

```bash
corthography publish dms/education-niche/colleges/overview+computer-science-degree
corthography publish dms/education-niche/colleges/overview+computer-science-degree --env prod
```

`--env prod` runs pause at the API's release gate; an authorized
approver must release them via `corthography approve` (see below).
See [../press/governance.md](../press/governance.md) for the gate
mechanics and [../api/approval-gate.md](../api/approval-gate.md) for
the API-side flow.

## Run-inspection commands

### `status <run_id>`

```bash
corthography status run-1714824742-a3f8c901
```

Shows current phase, status, started/completed timestamps, and any
output paths or error message. Use `--json` for the full payload.

### `list`

```bash
corthography list
corthography list --limit 50 --status awaiting_approval
```

| Flag | Default | Description |
|---|---|---|
| `--limit <n>` | `20` | How many runs to return |
| `--status <status>` | (all) | Filter to a single status (`queued`, `running`, `awaiting_approval`, `succeeded`, `failed`, `cancelled`) |

### `logs <run_id>`

```bash
corthography logs run-1714824742-a3f8c901
# → log_group: /aws/states/dms-press-render-test
```

Returns the CloudWatch log group for the run. Logs themselves are
fetched out-of-band — see the AWS console or `aws logs` CLI.

### `approve <run_id>`

Approve (or reject) a run paused at the prod release gate.

```bash
corthography approve run-1714824742-a3f8c901
corthography approve run-1714824742-a3f8c901 --reject --reason "needs editorial review"
```

| Flag | Default | Description |
|---|---|---|
| `--reject` | off | Reject the release instead of approving |
| `--reason <text>` | (none) | Reason recorded in the run metadata |

The run must be in `awaiting_approval` state. Approving an idempotent
no-op succeeds; approving a non-paused run returns 409.

## Discovery commands

### `projects`

```bash
corthography projects
# dms/education-niche/colleges/overview
#   - computer-science-degree
#   - nursing-degree
```

Lists `template_key → [project_slugs]` pairs your token is authorized
to target. A `*` slug means any slug under that template is allowed.

### `templates`

```bash
corthography templates
# dms/education-niche/colleges/overview
# dms/education-niche/colleges/admission-applications
```

Lists authorized template keys, one per line.

## Output modes

By default the CLI emits short human-readable lines. `--json` prints
the parsed API response as pretty JSON, suitable for piping into `jq`:

```bash
corthography list --json | jq '.[] | select(.status == "failed") | .runId'
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Any failure — invalid arguments, auth/scope/quota error, network failure, run not found |

The CLI prints the underlying error message to stderr. Errors map to
the typed error classes documented in [sdk.md § Error hierarchy](./sdk.md#error-hierarchy);
see [troubleshooting.md](./troubleshooting.md) for the common ones.

## What this doc does NOT cover

- Programmatic access — see [sdk.md](./sdk.md) for the underlying
  `PressClient` API
- The slash-command equivalents in Claude Code — see [skills.md](./skills.md)
- The end-to-end edit → test → publish loop — see
  [workflow.md](./workflow.md)
- Press-side semantics (what `template-query` actually does, etc.) —
  see [../press/overview.md](../press/overview.md)
- The HTTP contract underneath — see [../api/overview.md](../api/overview.md)
  and the OpenAPI reference
