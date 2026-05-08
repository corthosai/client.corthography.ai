---
title: "Extending the bundled FABER workflows"
description: "Run the client's bundled query/render/publish FABER workflows from your own repo, and extend them with partner-specific pre/post steps without forking."
visibility: external
audience: integrators
order: 6
---

# Extending the bundled FABER workflows

The Claude plugin ships four FABER workflows that orchestrate the
`corthography-press-*` skills (which already wrap the public CLI). You can
either invoke them as-is, or extend them in your own repo with custom steps —
Slack notifications, CMS validation, ticket-system updates, anything you need
around the standard pipeline — without forking.

This page covers what's bundled, how to invoke them, and how to extend them.

## Pre-flight

You need:

- The `corthos-corthography` plugin installed in your harness (Claude Code,
  Codex, or Cursor) — see [install.md](./install.md).
- The `fractary-faber` plugin installed alongside it (the bundled workflows
  rely on the FABER runtime to merge inheritance and run phase boundaries).
- A `CORTHOGRAPHY_TOKEN` resolvable from env, `~/.corthography/credentials`,
  or `.fractary/env/.env.<env>` — same as for direct CLI use.

## The bundled workflows

| Workflow id | Phases | Approval gate | What it does |
|---|---|---|---|
| `template-query` | build | none | Stage 1: `corthography query <target> --env test --wait`. |
| `template-render` | evaluate | none | Stage 2: `corthography render <target> --env test --wait`. |
| `template-publish` | evaluate, release | release | Test publish (autonomous), then prod publish after approval. |
| `template-query-render-publish` | evaluate, release | release | Full query→render→publish to test (autonomous), one human gate, then full query→render→publish to prod. |

All four are leaves — they don't `extends` anything, so partners only inherit
exactly what's listed.

> **Why the individual workflows are test-only.** They're the simplest case.
> For prod-only individual runs, call the CLI directly (`corthography query
> <target> --env prod`) — wrapping that in a one-step workflow buys you
> nothing the CLI doesn't already give you. The composite is the place where
> the test/prod separation earns its keep.

## Invoking a bundled workflow

Workflows from a Claude plugin are namespaced by the plugin name. The client
plugin's name is `corthos-corthography`, so partners invoke them as:

```
/fractary-faber-faber-run corthos-corthography:template-query-render-publish dms/education-niche/colleges/overview+computer-science-degree
```

For a single stage:

```
/fractary-faber-faber-run corthos-corthography:template-query <target>
/fractary-faber-faber-run corthos-corthography:template-render <target>
/fractary-faber-faber-run corthos-corthography:template-publish <target>
```

The `<target>` is the canonical
`{owner}/{collection}/{type}/{name}+{project_slug}` string. The 3-segment
shorthand works if `CORTHOGRAPHY_OWNER` is set, same as for the CLI.

## The single approval gate (composite)

`template-query-render-publish` runs the full pipeline twice:

1. **Evaluate phase (autonomous)**: `query → render → publish` against `--env test`.
2. **FABER pauses** before the release phase. A human reviews the test
   destination and approves (or rejects) at the FABER prompt.
3. **Release phase (after approval)**: `query → render → publish` against `--env prod`.

Re-querying for prod (rather than promoting test artifacts) means the prod
content reflects current upstream data. Treat the test cycle as a structural
sign-off, not a content lock-in.

### The API's own release gate

`corthography publish --env prod` *also* pauses at the API's release gate
(server-enforced). The CLI exits with code `2` at that pause; the publish step
in the release phase reports the run id and stops. To complete the run,
either:

- Run `/corthography-press-approve <run_id>` (only works if your registry has
  `auto_approve_prod=true`).
- Coordinate with your press-core liaison to release the run.

This is by design — partners cannot self-approve their own prod runs unless
explicitly granted that flag. The FABER gate and the API gate are independent;
crossing the FABER gate does not cross the API gate.

## Extending a bundled workflow

FABER workflows can extend a parent via the `extends` field. The merge
algorithm runs:

1. Parent `pre_steps` for each phase
2. **Child `pre_steps`** for that phase
3. **Child `steps`** for that phase (replaces parent main steps if any)
4. **Child `post_steps`** for that phase
5. Parent `post_steps` for that phase

So to add a step that fires *after* the parent's main steps in a given phase,
put it in that phase's `post_steps`. To add a step that fires *before*, put it
in `pre_steps`. The child's main `steps` array, if defined, replaces the
parent's main steps for that phase — leave it absent (or `[]`) when you only
want to inject around the parent.

### Minimal example: Slack notify after prod publish

In your partner repo, create
`.fractary/faber/workflows/my-org-publish.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/fractary/claude-plugins/main/plugins/faber/config/workflow.schema.json",
  "id": "my-org-publish",
  "asset_type": "content",
  "extends": "corthos-corthography:template-query-render-publish",
  "phases": {
    "frame":     { "enabled": false },
    "architect": { "enabled": false },
    "build":     { "enabled": false },
    "evaluate":  { "enabled": true },
    "release": {
      "enabled": true,
      "require_approval": true,
      "post_steps": [
        {
          "id": "release-slack-notify",
          "name": "Notify Slack",
          "prompt": "Use Bash to POST a JSON body to ${SLACK_WEBHOOK_URL} reporting that {asset} was published to prod (run {run_id}). Skip with a warning if SLACK_WEBHOOK_URL is unset."
        }
      ]
    }
  },
  "autonomy": { "level": "guarded", "description": "Inherits parent gating." }
}
```

Run it the same way as the bundled workflow, with your repo's namespace:

```
/fractary-faber-faber-run my-org-publish <target>
```

A more complete starter is at
[`.fractary/faber/workflows/examples/my-org-publish.example.json`](../../.fractary/faber/workflows/examples/my-org-publish.example.json)
in this repo — copy it into your own repo and edit.

### Other extension patterns

- **Custom CMS validation between render and publish** — add a `pre_step` to
  the bundled `template-publish` (or to the composite's release phase) that
  runs your CMS lint. Failure aborts the phase.
- **Block prod release on a Linear ticket state** — `pre_steps` on the
  release phase can call your ticket API; failure aborts.
- **Per-asset routing** — your child workflow can read `{asset}` and dispatch
  to one of several downstream notifiers based on owner/collection.
- **Replace, don't extend** — if you need a fundamentally different shape,
  define a workflow without `extends` and call the
  `corthography-press-*` skills directly from your own steps. The bundled
  workflows are not a required base; they're a convenience.

### Skipping inherited steps

If a future client release adds a step you don't want in your derived
workflow, list its id under `skip_steps` at the workflow root:

```json
"skip_steps": ["evaluate-press-publish-test"]
```

The id pattern is `<phase>-<short-name>` — see the bundled workflow JSONs at
`.fractary/faber/workflows/template-*.json` for the canonical step ids.

## What changes versus calling the CLI directly

Both paths produce the same Press API runs and write to the same destinations
— authorization is enforced server-side by your bearer token, not by which
client surface initiated the call. The workflow path adds:

- **A FABER gate between test and prod** for the composite, surfaced through
  whatever approval mechanism your harness uses (Claude Code prompts, Codex
  prompts, etc.) rather than only through `corthography approve`.
- **A place to hang custom pre/post steps** that all your runs go through,
  without modifying the underlying skills or CLI.
- **Run state tracked under `.fractary/faber/runs/`** in your repo — useful
  for resumption after a session restart.

If none of those help you, the CLI path is fine. The workflow path is opt-in.

## Related

- [skills.md](./skills.md) — the underlying `/corthography-press-*` slash commands
- [workflow.md](./workflow.md) — the manual edit → test → publish loop
- [cli.md](./cli.md) — `corthography` CLI reference
