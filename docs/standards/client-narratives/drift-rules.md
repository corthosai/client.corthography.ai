---
title: "Drift rules"
description: "Code-change → doc-file mapping that the update-client-docs skill consults to identify potentially-stale client narratives."
visibility: internal
audience: contributors
---

# Drift rules

This file is the **single source of truth** for what code change
triggers what `docs/client/*.md` narrative update. The
`update-client-docs` skill walks this list on every invocation,
deterministically, in order. If an edit to `docs/client/*.md` cannot
trace to a rule here, the skill must not make it.

Rules are organized by source file. Each rule names the trigger
pattern, the narrative file(s) to check, and the specific section
within that narrative.

## sdk/js/src/client.ts — `PressClient` class

**Trigger: a public method is added, renamed, removed, or changes
signature; the constructor's option set changes; default values
change**

- **New method**: add to `sdk.md` § "Methods" with signature, return
  shape, and a short example. If the method has a CLI counterpart,
  cross-reference it from `cli.md` § the matching subcommand.
- **Renamed method**: update `sdk.md`'s method heading, examples, and
  any cross-section references. Sweep `troubleshooting.md` for the
  old name.
- **Removed method**: delete its `sdk.md` section. If the
  corresponding CLI verb is also removed, update `cli.md`. Sweep
  other narratives for stale references.
- **Constructor option added/renamed/removed**: update `sdk.md` §
  "Constructor" table and the example.
- **Default value changes** (e.g., `DEFAULT_TIMEOUT_MS`,
  `DEFAULT_BASE_URL`): update `sdk.md` § "Constructor" table and any
  bash/ts example showing the default.
- **Token validation behavior changes** (currently throws on empty
  token in constructor): update `sdk.md` § "Constructor" notes and
  `install.md` § "Credential resolution".

## sdk/js/src/types.ts — request/response types

**Trigger: any exported interface or type alias is added, renamed, or
has fields added/removed/renamed**

- **`Workflow` / `Environment` / `RunStatus` enum changes**: update
  `sdk.md` § "Types" and `cli.md` § the affected subcommand's flag
  description (e.g., `--env` if `Environment` changed).
- **`StartRunRequest` field added**: update `sdk.md` § "startRun"
  example and `cli.md` § the matching flag if partner-visible.
- **`RunSummary` field added/renamed/removed**: update `sdk.md` §
  "Types" `RunSummary` interface; update any example that shows the
  field. Also check `cli.md` § "status" — `formatRunHumanReadable`
  may need a doc update if the field is partner-visible.
- **New exported type**: add to `sdk.md` § "Types" import block.

## sdk/js/src/errors.ts — typed error hierarchy

**Trigger: an error class is added, renamed, or removed; the status
→ class mapping in `makeApiError` changes; the `ApiErrorBody`
envelope shape changes**

- **New error class**: add to `sdk.md` § "Error hierarchy" tree and
  to `troubleshooting.md` § the relevant category (or a new section
  if no existing category fits).
- **Renamed error class**: update both `sdk.md` § "Error hierarchy"
  and `troubleshooting.md` § the symptom heading.
- **Status code mapping change** (e.g., a new status added to
  `makeApiError`): update `sdk.md` § "Error hierarchy" tree.
- **`ApiErrorBody` envelope change** (currently `{error, detail?,
  request_id?}`): update `sdk.md` § "Error hierarchy" `PressApiError`
  fields table.

## sdk/js/src/index.ts — package exports

**Trigger: an export is added or removed from the package root**

- **New export** (type, class, or function): add to the relevant
  `sdk.md` section (Types or Error hierarchy) plus the import block.
- **Removed export**: sweep all narratives for the import line and
  remove. If the export was load-bearing in `troubleshooting.md`,
  rewrite the affected example.

## cli/src/index.ts — CLI command tree

**Trigger: a subcommand is added, renamed, or removed; a flag is
added, renamed, removed, or has its default changed; output behavior
changes**

- **New subcommand**: add to `cli.md` § the appropriate category
  (pipeline / inspection / discovery), with flags table and example.
  If it has an SDK method that doesn't exist yet, that's a `client.ts`
  change too — handle that rule first. If a slash command should
  wrap it, file an issue (skills are authored, not auto-generated).
- **Renamed subcommand**: update `cli.md` heading, examples, and any
  `bash` snippet in other narratives. Sweep `skills.md` and
  `workflow.md`.
- **New flag**: add to the subcommand's flags table in `cli.md`. If
  the flag affects partner workflow (e.g., a new `--ref` semantic),
  update `workflow.md`.
- **Renamed flag**: update `cli.md` flags table and any example
  using the old name.
- **Default flag value change** (e.g., `--limit` default for `list`):
  update the flags table.
- **Output-format change** (e.g., `formatRunHumanReadable` returns
  different text): update `cli.md` § "Output modes" if the JSON-vs-
  human distinction changed; otherwise no narrative change.

## cli/src/config.ts — credential resolution

**Trigger: the resolution precedence changes, a new credentials-file
key is recognized, or the default API URL changes**

- **Precedence order change**: update `install.md` § "Credential
  resolution" numbered list.
- **New credentials-file key recognized**: update the table in
  `install.md` § "Credential resolution".
- **Default API URL change** (currently `https://api.corthography.ai/v1`):
  update `install.md`, `sdk.md` § "Constructor" defaults table, and
  any example showing the URL.
- **Error message text change** (the "No CORTHOGRAPHY_TOKEN found"
  message): update `troubleshooting.md` § "`No CORTHOGRAPHY_TOKEN
  found`" exact-string callout.

## cli/src/format.ts — output formatters

**Trigger: `formatRunHumanReadable` or `formatJson` output shape
changes**

- **Field added to `formatRunHumanReadable`**: usually a
  consequence of a `RunSummary` field add — see types.ts rule.
  No narrative change unless the new field changes how operators
  parse the output.
- **JSON output structure changes** (currently pretty-printed
  parsed JSON): update `cli.md` § "Output modes".

## skills/*/SKILL.md — plugin slash commands

**Trigger: a skill is added, removed, or its behavior changes
materially (new arg, new pre-flight prompt, etc.)**

- **New skill**: add a row to `skills.md` § "Catalog" and a short
  "When to invoke" entry. Update `cli.md` if it surfaces a CLI verb
  not yet documented.
- **Removed skill**: delete from `skills.md` § "Catalog" and any
  cross-references.
- **Argument change**: update `skills.md` § "Arguments" section.
- **Production-safety behavior change** (e.g., a new pre-flight
  prompt): update `skills.md` § "Production safety in skill prompts".

## sdk/js/package.json — published version, deps

**Trigger: the SDK's published version changes, or a partner-visible
peer dep changes (Node engines field)**

- **Node engines change**: update `install.md` § "CLI binary" and
  § "SDK (programmatic)" Node version notes.
- **Major version bump**: update the SDK version reference in
  `sdk.md` § "Install" snippet and any `npm install` example.

## cli/package.json — published version, deps

**Trigger: the CLI's published version changes, or `commander` major
version change affects flag parsing**

- **Major version bump of `corthography` CLI**: update `install.md` §
  "CLI binary" install line.
- **`commander` major bump**: usually no narrative change; flag
  syntax is stable across commander v11/v12. If parser semantics
  change in a way partners would notice (e.g., subcommand parsing),
  update `cli.md`.

## What does NOT trigger narrative updates

These code changes are deliberately out of scope — the skill should
ignore them:

- Test files (`**/*.test.ts`)
- Build artifacts (`**/dist/**`, gitignored)
- Internal infrastructure (CI workflow YAML, npm publish workflow)
- The repo's `README.md` and `CLAUDE.md` — those have their own
  audiences and aren't governed by this standard
- The legacy `docs/install.md` — superseded by
  `docs/client/install.md`; left as a self-contained partner
  reference but not synced
- Comments and doc-strings in source

## Sweep: orphan-reference check

After applying all the above rules, run a final sweep:

- For each `docs/client/*.md` modified, search for any
  `sdk/js/src/<file>` or `cli/src/<file>` reference it still names —
  confirm the path still exists.
- For each link out to `https://github.com/corthosai/client.corthography.ai/blob/main/...`,
  confirm the path still exists. Link rot is doc rot.

## When to update this rules file

Add a new rule when:

- A new source file enters the partner-visible surface (rare — most
  additions go in existing files)
- A new pattern of drift appears that the skill missed (e.g., "we
  changed the polling backoff and forgot to update `sdk.md`")

Don't add a rule when:

- A code change is one-off and won't recur (just make the doc edit
  by hand)
- The "rule" would just be "always check everything" — that's not a
  rule, that's noise
