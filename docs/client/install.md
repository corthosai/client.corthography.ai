---
title: "Install & auth"
description: "Three install paths for the Corthography Press client (Claude plugin, CLI, SDK) plus credential resolution."
visibility: external
audience: integrators
order: 1
---

# Install & auth

The client ships three deliverables from one repo, each appropriate
for a different use case.

| Path | Best for | Install |
|---|---|---|
| Claude plugin | Partner engineers in Claude Code | `/plugin install` (see below) |
| CLI binary | Engineers in terminals or CI pipelines | `npm install -g @corthos/corthography-cli` |
| SDK (TypeScript) | Custom integrations, scripts, automation | `npm install @corthos/corthography-sdk` |

All three share the same credential resolution and talk to the same
API. The plugin invokes the CLI under the hood; the CLI uses the SDK.

## 1. Claude plugin (recommended)

In a Claude Code session inside your partner repo:

```
/plugin marketplace add corthosai/client.corthography.ai
/plugin install corthography-press-client@corthography-client
```

The legacy direct install (`/plugin install corthosai/client.corthography.ai`)
also still works.

The same `skills/` tree is exposed to other agentic harnesses via
parallel manifests (Codex at `.codex-plugin/plugin.json`, Cursor at
`.cursor-plugin/plugin.json`), so the slash commands are available
regardless of which agent the partner uses.

## 2. CLI binary

```bash
npm install -g @corthos/corthography-cli
corthography --help
```

Requires Node 20+ (the CLI uses the global `fetch`).

## 3. SDK (programmatic)

```bash
npm install @corthos/corthography-sdk
```

```ts
import { PressClient } from "@corthos/corthography-sdk";

const client = new PressClient({
  token: process.env.CORTHOGRAPHY_TOKEN!,
});

const run = await client.startRun({
  workflow: "template-render",
  target: "dms/education-niche/colleges/overview+computer-science-degree",
  environment: "test",
});
console.log(run.runId);
```

See [sdk.md](./sdk.md) for the full surface.

## Credential resolution

Both the CLI and the plugin resolve the bearer token and base URL in
this order (highest precedence first):

1. **CLI flags** — `--token <token>` and `--api <url>`
2. **Env vars** — `CORTHOGRAPHY_TOKEN` and `CORTHOGRAPHY_API`
3. **`~/.corthography/credentials`** — one `key=value` per line; lines
   starting with `#` are comments

Recognized keys in the credentials file (case-insensitive):

| Key | Maps to |
|---|---|
| `token` or `corthography_token` | bearer token |
| `api`, `corthography_api`, or `api_url` | base URL |

Default base URL: `https://api.corthography.ai/v1`.

If no token is found, the CLI exits with:

```
No CORTHOGRAPHY_TOKEN found. Set the env var, pass --token, or write
/home/<you>/.corthography/credentials (key=value lines).
```

For the SDK, the `token` field is required and validated in the
constructor — passing an empty string throws.

## Where to get a token

Tokens are issued during partner onboarding. Open an issue in
`corthosai/api.corthography.ai` (or contact your press-core liaison)
referencing your partner repo and the workflows you need access to.

Treat the token like a database password — don't commit it, don't
share it across partners. The token's authorization scope is recorded
on the API side; see [../press/governance.md](../press/governance.md)
for what that scope controls.

## Verifying the install

The fastest end-to-end smoke test is the discovery commands — they
exercise auth and the partner's authorization scope without starting
any work:

```bash
corthography projects   # lists projects you can target
corthography templates  # lists templates you can target
```

Empty output here is normal for a brand-new partner with no
authorization yet; a `403 ScopeViolation` means your token is valid
but your scope is empty (see [troubleshooting.md](./troubleshooting.md)).
