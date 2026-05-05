# client.corthography.ai — Claude Code session primer

## What this repo is

The **partner-facing client tools** for Corthography Press. One repo, three deliverables, one shared SDK:

| Package | What it is | Who uses it |
|---|---|---|
| [`@corthography/client`](./packages/sdk) | Typed TypeScript SDK wrapping the REST API | Custom integrations, CI scripts |
| [`@corthography/cli`](./packages/cli) | `corthography` binary built on the SDK | Engineers in terminals, CI pipelines |
| Claude plugin | Slash commands (`/corthography-press-render`, etc.) wrapping the CLI | Partner engineers in Claude Code |

## Where it sits in the stack

```
[ Partner Claude Code (in dms.corthography.ai etc.) ]
        ↓ /corthography-press-render dms/.../colleges/overview+computer-science-degree
[ THIS REPO — Claude plugin → @corthography/cli → @corthography/client SDK ]
        ↓ HTTPS + Bearer token
[ api.corthography.ai ]    ← github.com/corthosai/api.corthography.ai
        ↓ AssumeRole + StartExecution
[ press.corthography.ai ]  ← github.com/corthosai/press.corthography.ai
```

This repo is **public**. The API and engine repos are private. Security comes from the bearer token, not from hiding the client.

## Canonical reference

[**SPEC-00018: Multi-Tenant Service Architecture**](https://github.com/corthosai/press.corthography.ai/blob/main/docs/specs/SPEC-00018-multi-tenant-service-architecture.md) lives in press-core. Read that for the full design.

## Active work

```bash
gh issue list --repo corthosai/client.corthography.ai --state open
```

Phase 6 is bootstrapped. The remaining work to make the client usable for the dms pilot:

- **#3** Add GitHub Actions CI workflow
- **#4** Set up `@corthography` npm scope and publish v0.1.0
- **#5** End-to-end smoke test against deployed api.corthography.ai
- **#6** *(optional)* Replace hand-written types with OpenAPI codegen

Suggested ordering: **#3 → #4 → #5** (depends on api being deployed first).

## Local development

Requires Node 20+. Confirmed working under Node 22.

```bash
# Install all workspace deps
npm install

# Build all packages (typescript → dist/)
npm run build

# Run all tests (15 currently — 9 SDK + 6 CLI)
npm test

# Run the CLI from source
node packages/cli/dist/bin.js --help
```

## Critical rules

- **No secrets in this repo.** It's public. The bearer token lives in the partner's environment, never in code.
- **Don't break the wire shape** between the SDK and `api.corthography.ai`. The SDK normalizes snake_case → camelCase for callers — if the API adds a field, add the snake_case mapping in `packages/sdk/src/client.ts` (`toRunSummary`).
- **Errors map by status code**, not error name string. `makeApiError` in `packages/sdk/src/errors.ts` is the single decision point. Don't sprinkle status-code branches elsewhere.
- **CLI flags > env vars > credentials file.** Token resolution precedence is documented in `packages/cli/src/config.ts`. Don't reorder.
- **Slash commands are thin shell-outs.** They invoke the CLI, never reimplement logic. If a SKILL.md duplicates SDK behavior, that's a smell — push it down.
- **Match the API contract surface.** This client targets `api.corthography.ai/v1`. New endpoints in the API need a corresponding SDK method + CLI command + (where it makes sense) a slash command.

## Things that often surprise

- The CLI binary is at `packages/cli/dist/bin.js` after build. The `bin` mapping in `packages/cli/package.json` makes it `corthography` once installed globally.
- Tests use `vitest`, not Jest. Vitest API is mostly Jest-compatible but `vi.fn()` not `jest.fn()`.
- `tsconfig.json` at the root is the **base** config. Each package's `tsconfig.json` extends it. Don't add target/module overrides at the root; they cascade unexpectedly.
- The `cli` package depends on `@corthography/client` via npm workspaces — don't add a relative path import; let the workspace resolution handle it.
- Node 22+ has `fetch` globally; we use it via the `fetch?: typeof fetch` constructor option to allow test injection. Don't import `node-fetch` — that breaks browser/edge runtime compatibility.

## Distribution status (as of bootstrap)

- ✅ Builds + tests pass locally
- ✅ Public GitHub repo
- ❌ Not yet on npm — partners must build from source until #4 lands
- ❌ Not yet wired into a real api endpoint — #5 closes that loop

When all three of those flip to ✅, partners can `/plugin install corthosai/client.corthography.ai` and start running workflows.
