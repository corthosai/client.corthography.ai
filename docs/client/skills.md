---
title: "Agent skills"
description: "The 8 `/corthography-press-*` slash commands shipped with the Claude plugin (and parallel Codex / Cursor manifests)."
visibility: external
audience: integrators
order: 4
---

# Agent skills

The Claude plugin exposes the [CLI](./cli.md) as 8 slash commands so
partner engineers can dispatch and inspect Press runs without leaving
their Claude Code session. The same skill tree is mounted for Codex
(`.codex-plugin/plugin.json`) and Cursor (`.cursor-plugin/plugin.json`)
— one source of truth, three harnesses.

For install, see [install.md](./install.md). For the underlying CLI
verbs, see [cli.md](./cli.md).

## Catalog

| Slash command | Stage | What it does |
|---|---|---|
| `/corthography-press-query <target>` | 1 | Stage Corthodex API data into chunked JSON in the partner's S3 area |
| `/corthography-press-render <target>` | 2 | Render Markdown from previously staged data |
| `/corthography-press-publish <target>` | 3 | Distribute rendered content to its destination (`--env prod` requires approval) |
| `/corthography-press-status <run_id>` | — | Show the current status of a run |
| `/corthography-press-logs <run_id>` | — | Show the CloudWatch log group for a run |
| `/corthography-press-approve <run_id>` | — | Release a run paused at the prod gate (`--reject` to reject) |
| `/corthography-press-list-projects` | — | List projects the partner is authorized to target |
| `/corthography-press-list-templates` | — | List templates the partner is authorized to target |

## When to invoke each

The pipeline commands form the daily workflow:

1. **Editing a template?** Push your changes to a branch, then run
   `/corthography-press-query` (and/or `render`, `publish`) with
   `--ref <branch>` against `--env test` to validate. See
   [workflow.md](./workflow.md) for the full loop.
2. **Pipeline run failed or stuck?** Use `/corthography-press-status`
   for the high-level state, then `/corthography-press-logs` for the
   CloudWatch pointer. Common failure modes are in
   [troubleshooting.md](./troubleshooting.md).
3. **Need to ship to production?** `/corthography-press-publish ... --env prod`
   pauses at the API release gate; an authorized approver runs
   `/corthography-press-approve <run_id>` to release.
4. **Lost track of what you can target?** `/corthography-press-list-projects`
   and `/corthography-press-list-templates` show your current scope.

## Arguments

The pipeline commands all take the same shape:

| Argument | Required | Description |
|---|---|---|
| `<target>` | yes | Canonical `{owner}/{collection}/{type}/{name}+{project_slug}` (e.g., `dms/education-niche/colleges/overview+computer-science-degree`) |
| `--env <test\|prod>` | no | Default `test`. `prod` requires approval for `publish`. |
| `--ref <ref>` | no | Pin a partner-repo git ref (branch, tag, or SHA) |
| `--json` | no | Emit JSON instead of human-readable text |

The inspection commands take a `<run_id>` returned by an earlier
start command.

`/corthography-press-approve` adds:

| Argument | Required | Description |
|---|---|---|
| `--reject` | no | Reject instead of approve |
| `--reason <text>` | no | Reason recorded in the run metadata |

## Production safety in skill prompts

The `/corthography-press-publish` skill explicitly prompts the
operator to confirm before invoking with `--env prod` — this is a
guardrail layered on top of the API's release-gate. Both must
greenlight a prod publish; neither alone is sufficient.

Similarly, `/corthography-press-approve` is the only skill that
releases work to production data. It expects a `run_id` already in
`awaiting_approval` state; calling it on any other state returns 409.

## Customization

The skills are deliberately thin wrappers — each delegates to the
matching CLI verb. Partners typically don't need to fork them; if you
need a behavior the CLI doesn't expose, file an issue against this
repo rather than diverging the skill prompts. The skill tree is
mirrored to multiple harnesses, so divergence multiplies.

## What this doc does NOT cover

- The skill installation flow — see [install.md § Claude plugin](./install.md#1-claude-plugin-recommended)
- CLI flag minutiae — see [cli.md](./cli.md)
- The end-to-end edit → test → publish loop — see
  [workflow.md](./workflow.md)
- Press-side semantics for each stage — see
  [../press/overview.md](../press/overview.md)
