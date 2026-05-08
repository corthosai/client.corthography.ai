---
title: "Example partner workflows"
description: "Starter templates partners can copy into their own repos to extend the client's bundled FABER workflows."
visibility: external
audience: integrators
---

# Example partner workflows

Files in this directory are **not loaded** by the client plugin (FABER discovers
workflows from the parent `.fractary/faber/workflows/` directory only — anything
under `examples/` is ignored). They exist as starter templates partners can copy
into their own repos.

## Files

| File | Extends | What it shows |
|---|---|---|
| `my-org-publish.example.json` | `corthos-corthography:template-query-render-publish` | A `release.post_steps` Slack notification injected after the prod publish step. |

## Copying into your own repo

1. Create `.fractary/faber/workflows/` in your partner repo if it doesn't exist.
2. Copy the example file there and rename to `<your-workflow-id>.json`.
3. Change the `id` field to match the new filename (without `.example`).
4. Edit the `post_steps` (and/or `pre_steps`) under each phase to add your custom steps.
5. Verify with `python -c "import json; json.load(open('.fractary/faber/workflows/<file>.json'))"`.

See [`../../../docs/client/extending-workflows.md`](../../../docs/client/extending-workflows.md)
for the full extension model (inheritance order, namespace resolution, autonomy overrides).
