---
title: "Frontmatter standard"
description: "Required and optional frontmatter keys for docs/client/*.md (public-flow narratives) and docs/standards/client-narratives/*.md (internal-only)."
visibility: internal
audience: contributors
---

# Frontmatter standard

YAML frontmatter sits at the top of every markdown file in
`docs/client/` and `docs/standards/client-narratives/`. It serves
three jobs:

1. **Visibility gating** — codex sync routing reads `visibility:` to
   decide what flows to consumer projects (notably
   `docs.corthography.ai`).
2. **Site rendering** — the docs site reads `title:`, `description:`,
   and `order:` to populate the navigation and search index.
3. **Audit signal** — `audience:` documents intent for human
   reviewers.

## `docs/client/*.md` — partner-facing narratives

Required:

```yaml
---
title: "CLI reference"
description: "Subcommand reference for the `corthography` CLI — flags, examples, and exit behavior for each verb."
visibility: external
audience: integrators
order: 2
---
```

| Key | Required? | Type | Notes |
|---|---|---|---|
| `title` | yes | string | Human-readable section title; appears in the rendered site nav |
| `description` | yes | string | One-sentence summary; used by codex routing + search + meta tags |
| `visibility` | yes | `external` | Must be exactly `external` for these files. Triggers the codex public-flow filter. |
| `audience` | yes | `integrators` | Documents the intent. Other valid values listed below; `integrators` is the right value for partner-facing client narratives. |
| `order` | yes (narratives) / no (README) | integer | 1-based ordering within the Client section sidebar. Conventional spacing: 1, 2, 3, …. The README/index file does not need `order:`. |

## `docs/standards/client-narratives/*.md` — internal contributor docs

Required:

```yaml
---
title: "Drift rules"
description: "Code-change → doc-file mapping that the update-client-docs skill consults."
visibility: internal
audience: contributors
---
```

| Key | Required? | Type | Notes |
|---|---|---|---|
| `title` | yes | string | |
| `description` | yes | string | |
| `visibility` | yes | `internal` | Must be exactly `internal`. Keeps the file out of the codex public flow. |
| `audience` | yes | `contributors` | Other valid values: `operators` (for runbook-style docs). Most standards target contributors. |
| `order` | no | integer | Optional for standards; the skill reads them by name, not by order. |

## Other docs in this repo

- `README.md`, `CLAUDE.md`, and the legacy `docs/install.md` are
  **not governed by this standard**. They predate the docs-site
  flow and have their own conventions. The `update-client-docs`
  skill leaves them alone.
- Plugin `skills/*/SKILL.md` files use the Claude skill format
  (`name:` + `description:` only); they're part of the plugin
  product, not the docs-site narratives.

If a future need arises to bring these under a common scheme, that's
a separate, deliberate effort.

## Valid values

### `visibility:`
- `internal` — default for any doc not meant to leave this repo's
  audience boundary
- `external` — flows to `docs.corthography.ai` via codex routing

There is no third value. If a future need arises (e.g., partner-
specific gating), add it deliberately and update this standard plus
`.fractary/config.yaml` consumers.

### `audience:`
- `integrators` — partners writing code or running CLIs against the
  client; precise, schema-conscious
- `operators` — humans running deploys, rotating tokens, etc.;
  runbook-style
- `contributors` — engineers maintaining this repo
- `partners` — non-engineering partner-side readers (rare; reserved)

`audience:` is informational today (no automation reads it). It
exists so the skill, reviewers, and future tooling can reason about
voice/scope.

## What's NOT in frontmatter

- Authorship / dates — git is the source of truth for who/when
- Tags or categories beyond `audience:` — sidebar position comes
  from `order:`, search comes from full-text indexing
- Status flags (`draft:`, `deprecated:`) — if a doc is in-flight,
  leave it on a branch, don't ship a half-published version

## Compliance check

The `update-client-docs` skill verifies frontmatter on every modified
file in `docs/client/`. If a required key is missing, malformed, or
`visibility:` is set to anything other than `external`, the skill
fixes it in-place as part of step 5 (this is rule-detected drift per
this standard) and reports the fix in the step 7 summary. The fixed
file is left in the working tree for human review along with any
other narrative edits.

For `docs/standards/client-narratives/` files, frontmatter is checked
at PR review time by humans. There's no automated gate (these files
change rarely; ceremony isn't worth it).
