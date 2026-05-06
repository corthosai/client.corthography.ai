# client.corthography.ai

TypeScript SDK, CLI, and Claude plugin for invoking [Corthography Press](https://github.com/corthosai/press.corthography.ai) workflows.

This is the **partner-facing** surface of the multi-tenant Press service (SPEC-00018). Engineers in partner repos install this client to start template-query / template-render / template-publish runs from their own Claude Code sessions, terminals, or CI without ever touching Press core.

```
[ Partner engineer ]
    ↓ /corthography-press-render dms/.../colleges/overview+computer-science-degree
[ Claude plugin (this repo) ]
    ↓ corthography render ...
[ @corthos/corthography-cli ]
    ↓ PressClient.startRun(...)
[ @corthos/corthography-sdk ]
    ↓ HTTPS + Bearer token
[ api.corthography.ai ]
    ↓ AssumeRole + StartExecution
[ press.corthography.ai engine ]
```

The SDK and CLI are public; the API and engine are private. Security is enforced by the partner token and the API's authorization registry — not by hiding the client.

## Three deliverables, one repo

| Package | What it is | Who uses it |
|---|---|---|
| [`@corthos/corthography-sdk`](./sdk/js) | Typed SDK wrapping the REST API | Custom integrations, CI scripts |
| [`@corthos/corthography-cli`](./cli) | `corthography` binary built on the SDK | Engineers in terminals, CI pipelines |
| Claude plugin | Slash commands (`/corthography-press-render`, etc.) wrapping the CLI | Partner engineers in Claude Code |

All three are versioned together.

## Install

### Claude plugin (recommended for partners)

In a Claude Code session, add this repo as a marketplace and install the plugin:

```
/plugin marketplace add corthosai/client.corthography.ai
/plugin install corthography-press-client@corthography-client
```

The legacy direct install (`/plugin install corthosai/client.corthography.ai`) also still works.

#### Other agentic harnesses

The same `skills/` tree is exposed to other harnesses via parallel manifests, so the slash commands are available regardless of which agent the partner uses:

- **Codex** — `.codex-plugin/plugin.json`
- **Cursor** — `.cursor-plugin/plugin.json`

Each harness's manifest points at `./skills/`, so there is one source of truth for the `corthography-press-*` skill content.

Then add your token to your shell:

```bash
export CORTHOGRAPHY_TOKEN=...
export CORTHOGRAPHY_API=https://api.corthography.ai/v1
```

### CLI (standalone)

```bash
npm install -g @corthos/corthography-cli
corthography --help
```

### SDK (programmatic)

```bash
npm install @corthos/corthography-sdk
```

```ts
import { PressClient } from "@corthos/corthography-sdk";

const client = new PressClient({
  token: process.env.CORTHOGRAPHY_TOKEN!,
  baseUrl: "https://api.corthography.ai/v1",
});

const run = await client.startRun({
  workflow: "template-render",
  target: "dms/education-niche/colleges/overview+computer-science-degree",
  environment: "test",
});
console.log(run.runId);
```

## Slash commands

| Command | What it does |
|---|---|
| `/corthography-press-query {target}` | Stage 1: collect Corthodex API data into S3 chunks (supports `--wait`) |
| `/corthography-press-render {target}` | Stage 2: render Markdown from staged data (supports `--wait`) |
| `/corthography-press-publish {target}` | Stage 3: distribute rendered content to destination (test); use `--env prod` for production (requires approval); supports `--wait` |
| `/corthography-press-status {run_id}` | Check run status; pass `--wait` to block until terminal |
| `/corthography-press-logs {run_id}` | Get the CloudWatch log group for a run |
| `/corthography-press-approve {run_id}` | Approve a run paused at the prod release gate |
| `/corthography-press-list-projects` | Show projects you're authorized for |
| `/corthography-press-list-templates` | Show templates you're authorized for |

`{target}` is the canonical `{owner}/{collection}/{type}/{name}+{project_slug}` string, e.g., `dms/education-niche/colleges/overview+computer-science-degree`.

### Polling (`--wait`)

`query`, `render`, `publish`, and `status` all accept `--wait` to block the bash invocation until the run reaches a terminal state. This collapses an agent-side poll loop into a single input/output pair — the agent sees one Bash call regardless of how long the run takes, which is much cheaper in context tokens.

```bash
corthography query <target> --wait                    # default 10-minute budget
corthography render <target> --wait --wait-timeout 3600   # longer terminal use
corthography status <run_id> --wait                   # block on an existing run
```

Exit codes when `--wait` is set:

- `0` — `succeeded`
- `1` — `failed` or `cancelled` (or any preexisting CLI/network error)
- `2` — `awaiting_approval` (paused at the prod release gate — call `/corthography-press-approve`)
- `3` — `--wait-timeout` reached (run still in progress; re-invoke `status --wait` to keep waiting)

Polling cadence defaults to 5s for the first 30s and 15s thereafter; override with `--poll-interval <seconds>`. The default `--wait-timeout` is 600s (matches Claude Code's 10-minute Bash ceiling).

## Token, base URL, and owner

These can come from any of the following, listed high → low precedence:

1. CLI flags `--token` / `--api`
2. Env vars `CORTHOGRAPHY_TOKEN`, `CORTHOGRAPHY_API`, `CORTHOGRAPHY_OWNER`
3. `.fractary/env/.env.<env>` in the partner repo (walked up from cwd; `<env>` follows the subcommand's `--env` flag, defaults to `test`)
4. `~/.corthography/credentials` (TOML-ish key=value)

```bash
CORTHOGRAPHY_TOKEN=...                              # required
CORTHOGRAPHY_API=https://test.api.corthography.ai   # optional; defaults to test or prod based on --env
CORTHOGRAPHY_OWNER=dms                              # optional, see "Owner inference" below
```

**Default API URL**: when `CORTHOGRAPHY_API` is not set, the CLI defaults to `https://test.api.corthography.ai/v1` for `--env test` and `https://api.corthography.ai/v1` for `--env prod`. The `/v1` suffix is added automatically if you supply a base URL without it.

The fractary file lookup pairs `--env test` with `.fractary/env/.env.test` and `--env prod` with `.fractary/env/.env.prod`, so partners can keep credentials env-aware alongside the rest of their Fractary configuration.

### Owner inference

The canonical target is `{owner}/{collection}/{type}/{name}+{project_slug}`. From inside a partner repo the owner is implicit, so the CLI accepts a 3-segment shorthand:

```bash
# With CORTHOGRAPHY_OWNER=dms set, both of these are equivalent:
corthography query education-niche/colleges/overview+computer-science-degree
corthography query dms/education-niche/colleges/overview+computer-science-degree
```

A 3-segment target without an owner configured fails with a clear error. 4-segment targets always pass through unchanged.

## Development

```bash
# Install workspace deps
npm install

# Build all packages
npm run build

# Test
npm test

# Run the CLI from source
node cli/dist/bin.js --help
```

Requires Node 20+.

## Status

🟢 **Phase 7 (SPEC-00018)** — `@corthos/corthography-sdk@0.1.0` and `@corthos/corthography-cli@0.1.0` are live on the public npm registry with signed provenance attestations. The remaining gating item before partners can run end-to-end workflows is `api.corthography.ai` reaching production.
