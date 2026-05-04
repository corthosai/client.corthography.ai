# Installing the Corthography Press client

Three installation options: Claude plugin (recommended for partner engineers), CLI binary, or programmatic SDK use.

## 1. Claude plugin (recommended)

In a Claude Code session inside your partner repo:

```
/plugin install corthosai/client.corthography.ai
```

Then add credentials:

```bash
# .env (or your shell profile)
export CORTHOGRAPHY_TOKEN=...
export CORTHOGRAPHY_API=https://api.corthography.ai/v1
```

Restart Claude Code. Slash commands `/press-query`, `/press-render`, etc. become available.

## 2. CLI binary

Once `@corthography/cli` is published to npm (phase 7):

```bash
npm install -g @corthography/cli
```

For now (during the bootstrap phase), build from source:

```bash
git clone https://github.com/corthosai/client.corthography.ai.git
cd client.corthography.ai
npm install
npm run build
node cli/dist/bin.js --help
```

## 3. SDK (programmatic)

```bash
npm install @corthography/sdk
```

```ts
import { PressClient } from "@corthography/sdk";

const client = new PressClient({
  token: process.env.CORTHOGRAPHY_TOKEN!,
  baseUrl: "https://api.corthography.ai/v1",
});

const run = await client.startRun({
  workflow: "template-render",
  target: "dms/education-niche/colleges/overview+computer-science-degree",
  environment: "test",
});

let summary = await client.getRun(run.runId);
while (summary.status === "queued" || summary.status === "running") {
  await new Promise((r) => setTimeout(r, 5_000));
  summary = await client.getRun(run.runId);
}
console.log(summary.status, summary.outputPaths);
```

## Credential resolution precedence

1. CLI flags `--token` / `--api`
2. Env vars `CORTHOGRAPHY_TOKEN` / `CORTHOGRAPHY_API`
3. `~/.corthography/credentials` file (one `key=value` per line; comments start with `#`)

The token is provided by your press-core contact. Treat it like a database password — don't commit it, don't share it across partners.

## Where do I get a token?

Tokens are issued during partner onboarding. Open an issue in `corthosai/api.corthography.ai` (or contact your press-core liaison) referencing your partner repo and the workflows you need access to.
