---
title: "Templates-repo workflow"
description: "End-to-end edit → test → publish loop for a partner working in their own template repo."
visibility: external
audience: integrators
order: 5
---

# Templates-repo workflow

This page walks the full loop a partner uses to ship a template
change: edit in their template repo, validate against `test`, promote
to `prod` through the approval gate. The client's job is to dispatch
runs and report state; the templates and project configs themselves
live in the [partner's owned template repo](../press/governance.md).

## Pre-flight

Before your first run:

1. Install one of the three client deliverables — see [install.md](./install.md).
2. Confirm your token resolves: `corthography projects` should print
   the projects you're authorized for. An empty list (with no error)
   means the API answered but your scope is empty; a `403` means the
   token is valid but the API can't see any scope (talk to your
   press-core liaison).
3. Confirm your template repo is registered. The partner repo URL and
   default ref are in press-core's `config/template-sources.yaml`;
   onboarding adds your owner there. See
   [../press/governance.md § Setup overview](../press/governance.md#setup-overview).

## The loop

```
            ┌────────────────────────────────────────────┐
            │  edit template (index.md.j2 / config.json) │
            │   in your partner repo, on a branch        │
            └─────────────────────┬──────────────────────┘
                                  │  push branch
                                  ▼
            ┌────────────────────────────────────────────┐
            │  query --ref <branch>  (--env test)        │
            └─────────────────────┬──────────────────────┘
                                  │  status / logs
                                  ▼
            ┌────────────────────────────────────────────┐
            │  render --ref <branch>  (--env test)       │
            └─────────────────────┬──────────────────────┘
                                  │  inspect rendered Markdown
                                  ▼
            ┌────────────────────────────────────────────┐
            │  publish --ref <branch>  (--env test)      │
            └─────────────────────┬──────────────────────┘
                                  │  validate test destination
                                  ▼
                  merge branch to your repo's main
                                  │
                                  ▼
            ┌────────────────────────────────────────────┐
            │  publish  (--env prod)                     │
            │   pauses at release gate                   │
            └─────────────────────┬──────────────────────┘
                                  │  approver runs:
                                  ▼
                  /corthography-press-approve <run_id>
```

## Stage 1: query

```bash
corthography query dms/education-niche/colleges/overview+computer-science-degree \
  --ref my-branch --env test
# → started query: run_id=run-1714824742-a3f8c901

corthography status run-1714824742-a3f8c901
# → succeeded
```

Stage 1 fetches Corthodex API data into chunked JSON staged in S3.
The data is keyed by `(template, project, environment)`; subsequent
`render` calls against the same target reuse it until you re-query.

`--ref` is the key for development: it tells the engine to clone your
template repo at that ref before resolving the template. Pin to a
branch while iterating, to a tag or SHA when you want a stable
reference.

## Stage 2: render

```bash
corthography render dms/education-niche/colleges/overview+computer-science-degree \
  --ref my-branch --env test
```

Stage 2 evaluates `index.md.j2` against the staged data and writes
Markdown to the `test` bucket. Inspect the output by walking the run
record's `outputPaths` after `succeeded`:

```bash
corthography status run-... --json | jq '.outputPaths'
```

If the render fails, the typical culprits are:

- A Spintax / Jinja syntax error in `index.md.j2`
- A missing data field referenced in the template that the
  `template-query` stage didn't fetch (check the template's
  `config.json` `item_endpoints`)
- A `sample_items` shape mismatch if you're using `dev` mode

See [troubleshooting.md](./troubleshooting.md) for the common error
classes and [../press/templates.md](../press/templates.md) for
template-side conventions.

## Stage 3: publish (test)

```bash
corthography publish dms/education-niche/colleges/overview+computer-science-degree \
  --ref my-branch --env test
```

Distributes the rendered files to the project's `publish_config`
destination. For a CoPublisher project, this hits the staging target;
for a plain S3 project, this writes to the test bucket configured
in the project's `publish_config`.

Validate the test destination before promoting.

## Stage 3: publish (prod)

```bash
corthography publish dms/education-niche/colleges/overview+computer-science-degree \
  --env prod
# → started publish: run_id=run-...

corthography status run-...
# → awaiting_approval
```

Prod publishes always pause at the API's release gate. The run's
status reads `awaiting_approval` indefinitely until either:

```bash
corthography approve run-...                                # release to prod
corthography approve run-... --reject --reason "needs editorial review"
```

Approval is recorded against the run; the `--reason` lands in the run
metadata. See [../press/governance.md](../press/governance.md) for
who has authority to approve, and [../api/approval-gate.md](../api/approval-gate.md)
for the API's idempotency and timeout behavior.

## Pinning with `--ref`

`--ref` accepts any value `git rev-parse` would accept inside the
partner repo: a branch, a tag, or a full SHA. The engine clones the
ref before resolving the template, so a stale clone cache is never
the bug.

Common patterns:

- **Iteration**: `--ref my-feature-branch` against `--env test`
- **Reproducible test renders**: `--ref v1.4.0`
- **Hotfix verification**: `--ref <SHA-of-the-cherry-pick>`

For prod runs without `--ref`, the engine uses the project's
`template_ref` if set (in the project's `config.json`), else falls
back to the partner repo's default ref from
`config/template-sources.yaml`. See [../press/projects.md § Optional fields](../press/projects.md#optional-fields)
for `template_ref` semantics.

## Common variants

**Re-render without re-querying** (data hasn't changed):

```bash
corthography render <target> --env test
# Reuses the existing staged data from the last successful query
```

**One-shot full pipeline** in CI:

```bash
corthography query <target> --env test
corthography render <target> --env test
corthography publish <target> --env test
```

Each stage starts a separate run; chain them by polling `status`
between calls (or use the SDK to do this synchronously — see
[sdk.md § Polling pattern](./sdk.md#polling-pattern)).

**Batch over projects**:

```bash
corthography projects --json | jq -r '.[] | .templateKey + "+" + .projectSlugs[0]' \
  | xargs -I {} corthography render {} --env test
```

## Higher-level: bundled FABER workflows

If you'd rather drive the loop through a single FABER invocation — with one
human approval gate between the test cycle and the prod cycle, and a place
to hang your own pre/post steps — the client plugin ships five FABER
workflows that wrap the `corthography-press-*` skills:
`template-query`, `template-render`, `template-publish`, the composite
`template-query-render-publish`, and `template-hotfix` (guided template
edits with the standards loaded as context, an autopush to a feature
branch, and an end-to-end `--env test` verification). See
[extending-workflows.md](./extending-workflows.md) for invocation, the
single-gate model, and how to extend any of them from your own repo.

For the template-side discipline that the hotfix workflow enforces — and
that the manual loop benefits from too — see
[template-authoring.md](./template-authoring.md).

## What this doc does NOT cover

- How to author or edit the template body itself — see
  [../press/templates.md](../press/templates.md)
- How to declare data queries in `config.json` — see
  [../press/data-queries.md](../press/data-queries.md)
- The API's release-gate timing semantics — see
  [../api/approval-gate.md](../api/approval-gate.md)
- Getting added to a new partner repo — see
  [../press/governance.md](../press/governance.md)
