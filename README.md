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
| `/corthography-press-query {target}` | Stage 1: collect Corthodex API data into S3 chunks |
| `/corthography-press-render {target}` | Stage 2: render Markdown from staged data |
| `/corthography-press-publish {target}` | Stage 3: distribute rendered content to destination (test); use `--env prod` for production (requires approval) |
| `/corthography-press-status {run_id}` | Check run status |
| `/corthography-press-logs {run_id}` | Get the CloudWatch log group for a run |
| `/corthography-press-approve {run_id}` | Approve a run paused at the prod release gate |
| `/corthography-press-list-projects` | Show projects you're authorized for |
| `/corthography-press-list-templates` | Show templates you're authorized for |

`{target}` is the canonical `{owner}/{collection}/{type}/{name}+{project_slug}` string, e.g., `dms/education-niche/colleges/overview+computer-science-degree`.

## Token and base URL

Both can be set via env var or `~/.corthography/credentials` (TOML-ish key=value). Env vars take precedence:

```bash
CORTHOGRAPHY_TOKEN=...                     # required
CORTHOGRAPHY_API=https://api.corthography.ai/v1   # optional, defaults to this
```

CLI flags `--token` and `--api` override both.

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
