---
title: "Client narratives standard"
description: "Voice, structure, and per-file scope for the partner-facing client documentation in docs/client/*.md."
visibility: internal
audience: contributors
---

# Client narratives standard

This standard governs the six companion narrative files in
`docs/client/` plus their index. They describe the partner-facing
surface of the Corthography Press client: install paths, the CLI, the
SDK, the agent skills, the end-to-end workflow, and the
troubleshooting playbook.

The `update-client-docs` skill reads this standard on every invocation
as its rulebook for narrative drift.

## Voice and tone

**Integrator-first.** The reader is a partner engineer with a token,
trying to dispatch a Press run from their terminal, their CI
pipeline, or their Claude Code session. They are not a marketing-copy
reader. They are not learning what an SDK is. They want to know what
the install command is, what flag to pass, what error class to catch.

Specific conventions:

- **Terse over thorough.** Two short paragraphs beats one long one.
  If a section runs over 200 words without a code block, it probably
  needs splitting or trimming.
- **Concrete over abstract.** Always show a `bash` or `ts` snippet
  before describing what it does.
- **Behavior, not philosophy.** Describe *what the client does*, not
  *what we think a client SDK should do*.
- **Second person ("you", "your"), not first ("we", "our").** "You'll
  get a 401 if your token is missing" beats "We return a 401."
- **No marketing voice.** "The CLI exposes nine subcommands" beats
  "Our powerful CLI provides a comprehensive set of tools."
- **Numeric specifics over hedges.** "30-second default timeout"
  beats "a reasonable timeout." "Don't poll faster than 1Hz" beats
  "don't poll too fast."

## Structure conventions

Every file in `docs/client/` follows the same outline:

1. **Frontmatter** (per `frontmatter.md`)
2. **H1 title** (matches frontmatter `title:`)
3. **One opening paragraph** explaining what this file covers and
   what it doesn't
4. **H2 sections** organizing the rest. Avoid H3+ unless a section
   is genuinely long (the SDK reference and troubleshooting are the
   exceptions).
5. **Code blocks** for every concrete example (bash, ts, http)

## Code block conventions

### Bash examples

Use ` ```bash ` for shell commands.

```bash
corthography render dms/education-niche/colleges/overview+computer-science-degree \
  --ref my-branch --env test
```

Rules:

- Prefer realistic targets (`dms/education-niche/colleges/overview+computer-science-degree`)
  over placeholder text (`<owner>/<collection>/...`). Placeholders
  appear only when the example is documenting the format itself.
- Show flags on the same command line, broken with `\` if long
- For multi-step examples, separate commands with comments showing
  the expected output:
  ```bash
  corthography render <target>
  # → started render: run_id=run-1714824742-a3f8c901
  ```

### TypeScript examples

Use ` ```ts ` for SDK snippets. Import from the package root, not
from internal paths:

```ts
import { PressClient, PressAuthError } from "@corthos/corthography-sdk";
```

Show realistic option values; use `process.env.CORTHOGRAPHY_TOKEN!`
rather than `"your-token-here"`.

### JSON / response bodies

Use ` ```json ` for response bodies. Match the API's snake_case
on-the-wire form when showing wire bodies; match the SDK's camelCase
when showing what the SDK returns.

### HTTP examples

Use ` ```http ` for raw HTTP only when documenting the wire format
directly. The `cli.md` and `sdk.md` should rarely need this — the
[../api/](../api/) section covers HTTP.

## Link conventions

Within `docs/client/`, link by relative path with the `.md` extension
included:

```markdown
See [sdk.md](./sdk.md) for the underlying API.
```

To link across sections on the docs site, use `../api/` or
`../press/`:

```markdown
See [../api/approval-gate.md](../api/approval-gate.md) for the
release-gate mechanics.
```

The Astro Starlight build resolves these to clean URLs.

To link out to GitHub source, use full https URLs only when pointing
at a code file no docs-site page covers (e.g., a specific source
file):

```markdown
See [`sdk/js/src/client.ts`](https://github.com/corthosai/client.corthography.ai/blob/main/sdk/js/src/client.ts)
for the implementation.
```

For cross-section references (api, press), prefer the relative
`../api/` form even if those pages don't exist yet — Phase B's
forward-refs to those sections were always expected to resolve once
sibling sections shipped.

## Per-file scope

Each of the 6 narrative files has a strict scope. The skill enforces
"stay in lane" — if drift detection wants to add content that doesn't
fit a file's scope, it goes in the right file or it doesn't go in.

### `install.md`

**Covers**: the three install paths (Claude plugin, CLI binary, SDK),
credential resolution chain, where to get a token, smoke-test the
install with the discovery commands.

**Out of scope**:
- CLI subcommand details (live in `cli.md`)
- SDK constructor option details (live in `sdk.md`)
- Token authorization scope (lives in `../press/governance.md`)

### `cli.md`

**Covers**: every `corthography` subcommand (`query`, `render`,
`publish`, `status`, `list`, `logs`, `approve`, `projects`,
`templates`), global flags, output modes, exit codes.

**Out of scope**:
- Install (lives in `install.md`)
- SDK API (lives in `sdk.md`)
- Workflow walkthrough (lives in `workflow.md`)
- Troubleshooting (lives in `troubleshooting.md`)

### `sdk.md`

**Covers**: the `PressClient` class (constructor + every public
method), the request/response type set, the typed error hierarchy,
the polling pattern.

**Out of scope**:
- CLI surface (lives in `cli.md`)
- HTTP wire format (lives in `../api/overview.md`)
- Workflow semantics (lives in `../press/overview.md`)

**This file is the single source of truth for the error class
hierarchy.** Other narratives reference it; they do not duplicate.

### `skills.md`

**Covers**: the catalog of 8 `/corthography-press-*` slash commands,
arguments, when to invoke each, production-safety prompts in the
skill bodies.

**Out of scope**:
- Plugin install mechanics (lives in `install.md`)
- CLI flag minutiae (lives in `cli.md`)
- Workflow walkthrough (lives in `workflow.md`)

### `workflow.md`

**Covers**: the end-to-end edit → test → publish loop, the `--ref`
flag's role, the prod approval gate from the partner's perspective.

**Out of scope**:
- How to write the template body or `config.json` (lives in
  `../press/templates.md` / `../press/data-queries.md`)
- API-side approval gate semantics (lives in
  `../api/approval-gate.md`)
- Per-command flag details (lives in `cli.md`)

### `troubleshooting.md`

**Covers**: symptom → cause → fix for the common error states. One
section per error class (auth, scope, quota, not-found,
awaiting_approval) plus network/timeout and plugin-install issues.

**Out of scope**:
- The error class hierarchy itself (lives in `sdk.md`)
- Engine-side render failures (lives in `../press/templates.md`)

### `README.md`

**Covers**: index, brief description of each file, the client →
api → press chain in one paragraph.

**Out of scope**: anything else. Stays under 30 lines.

## Cross-section linking rules

The client narratives link out to two other docs-site sections:

- **`../api/`** for HTTP wire format, error envelope, and release-gate
  semantics
- **`../press/`** for engine-side concerns (template structure, data
  queries, governance)

Both already exist on the docs site. When in doubt about which to
link, ask: *is this about the wire contract* (link to api) *or about
what happens server-side after dispatch* (link to press)?

## Frontmatter

Every file must satisfy `frontmatter.md` (`visibility: external`,
`audience: integrators`, `order:` set for the 6 narrative files,
`title:` and `description:` populated). The skill verifies this on
every modified file.

## What this standard does NOT govern

- The repo's `README.md` and `CLAUDE.md` — different audiences,
  different conventions
- The legacy `docs/install.md` — superseded by `docs/client/install.md`
  for the docs-site flow
- Each plugin skill's `SKILL.md` under `skills/` — those are part of
  the plugin product, not the docs-site narratives
- Comments in source code — see this repo's `CLAUDE.md`

## When to update this standard

Update `narratives.md` when:

- A new narrative file is added to `docs/client/` (extend "Per-file
  scope")
- A new convention is established by review (e.g., "all bash
  examples must show expected output as a comment")
- A scope boundary needs adjusting (content keeps appearing in two
  files; pick a primary)

Don't update for:

- One-off improvements to a single doc — make those edits, don't add
  a new rule
- Speculative future conventions — wait until a real case
  demonstrates the need
