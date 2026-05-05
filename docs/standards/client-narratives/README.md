---
title: "Client narratives standards"
description: "Index of contributor-facing standards that govern docs/client/ and the update-client-docs skill."
visibility: internal
audience: contributors
---

# Client narratives standards

Internal-only contributor docs that govern how the partner-facing
documentation in `docs/client/*.md` stays accurate and consistent
with the SDK, CLI, and plugin skills shipped from this repo.

| File | Role | Read when… |
|---|---|---|
| [narratives.md](./narratives.md) | Voice, structure, formatting, per-file scope for `docs/client/*.md` | Authoring or editing a partner-facing narrative |
| [drift-rules.md](./drift-rules.md) | Code-change → doc-file mapping rulebook | A code change might affect partner-visible behavior — or running the `update-client-docs` skill |
| [frontmatter.md](./frontmatter.md) | Required frontmatter keys + valid values | Adding a new doc file under `docs/client/` or changing an existing file's metadata |

These three files are the entire ruleset. The `update-client-docs`
skill at `.claude/skills/update-client-docs/` consults all three on
every invocation.

All standards are tagged `visibility: internal` so they don't sync to
the public docs site via codex routing. They live with the code they
govern.

## Scope of the client narratives standards

These standards govern only the partner-facing narratives at
`docs/client/*.md` (the files that flow to `docs.corthography.ai`).

They do **not** govern:

- The repo's `README.md` and `CLAUDE.md` — those have their own
  conventions and audiences (the README is the npm-published surface;
  CLAUDE.md is the Claude Code session primer)
- The `docs/install.md` file from before this docs effort — it
  predates the docs-site flow and remains a self-contained partner
  reference; the new `docs/client/install.md` supersedes it for the
  docs-site-published surface
- Each plugin skill's `SKILL.md` under `skills/` — those are
  authored as part of the plugin product and follow the skill format

The boundary is deliberate: the `update-client-docs` skill is tightly
scoped to publishable narratives so its behavior is predictable and
its diffs are easy to review.
