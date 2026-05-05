---
name: update-client-docs
description: Refresh the partner-facing client docs (docs/client/*.md) after a code change. Applies drift rules to identify potentially-stale narratives, walks each through the standards in docs/standards/client-narratives/, and stages updates for human review before any commit or codex push. Tight scope — never touches README.md, CLAUDE.md, the legacy docs/install.md, plugin SKILL.md files, or any internal doc.
---

# Update client docs

Manually invoked after a code change that may affect partner-visible
client behavior (SDK methods, CLI commands/flags, error classes,
credential resolution, plugin skills). Produces a deterministic diff:
same code change → same set of edits, every time.

## When to invoke

- After merging a feature/fix that touches `sdk/js/src/**/*.ts`,
  `cli/src/**/*.ts`, `skills/*/SKILL.md`, or partner-visible package
  metadata in `sdk/js/package.json` / `cli/package.json`
- Before running `fractary-codex sync --direction to-codex` — so the
  synced content reflects the latest code
- As a sanity check before opening a PR that's expected to bump
  partner-visible behavior

Don't invoke for:

- Pure infrastructure changes (CI workflows, npm publish scripts,
  workspace tooling)
- Test-only changes (`**/*.test.ts`)
- Changes to internal docs outside `docs/client/` — `README.md`,
  `CLAUDE.md`, the legacy `docs/install.md`, anything else

## Arguments

| Argument | Required | Description |
|---|---|---|
| `--since <ref>` | No | Git ref to diff against. Default: the merge-base with `main` if on a feature branch, or `HEAD~1` if on `main`. **If you're invoking this on `main` right after merging a multi-commit feature branch, pass `--since <merge-base>` explicitly** — the default `HEAD~1` covers only the merge commit itself and will silently miss earlier drift in that branch. |
| `--dry-run` | No | Print proposed changes; don't write files. Useful for verifying drift detection. |

## Workflow

Execute these steps in order. Do not skip steps. Do not reorder.

### Step 1 — Read the standards

Read these three files in full before doing any analysis:

- `docs/standards/client-narratives/narratives.md` — voice, per-file scope, formatting rules
- `docs/standards/client-narratives/drift-rules.md` — code-change → doc-file mapping
- `docs/standards/client-narratives/frontmatter.md` — required frontmatter keys

These are the rulebook. Every edit you make must trace to a specific
rule in one of these files.

### Step 2 — Identify changed code

```bash
# Default range: merge-base with main if on a feature branch,
# else HEAD~1 (covers the case where merge-base returns HEAD itself
# because the current branch IS main).
SINCE=$(git merge-base HEAD main 2>/dev/null)
[ "$SINCE" = "$(git rev-parse HEAD)" ] && SINCE=HEAD~1
[ -z "$SINCE" ] && SINCE=HEAD~1
git diff --name-only ${SINCE}..HEAD
```

Or, if the user provided `--since <ref>`:

```bash
git diff --name-only <ref>..HEAD
```

Filter the result to source files that `drift-rules.md` covers.
Specifically:

- `sdk/js/src/client.ts`
- `sdk/js/src/types.ts`
- `sdk/js/src/errors.ts`
- `sdk/js/src/index.ts`
- `cli/src/index.ts`
- `cli/src/config.ts`
- `cli/src/format.ts`
- `skills/*/SKILL.md`
- `sdk/js/package.json`
- `cli/package.json`

Discard everything else. Test files (`**/*.test.ts`), build artifacts,
CI YAML, internal docs outside the list above — none of these
trigger narrative drift.

### Step 3 — Apply drift rules

For each changed source file, walk
`docs/standards/client-narratives/drift-rules.md` and identify which
rules fire. Build a deterministic list of `docs/client/*.md` files
that need review, with the specific section flagged for each rule
that fired.

Output format (mental model):

```
sdk/js/src/client.ts changed
  → rule "sdk/js/src/client.ts — PressClient class" fires
     → check: docs/client/sdk.md § "Methods" (which method changed?)
     → check: docs/client/cli.md § the matching subcommand if any

sdk/js/src/errors.ts changed
  → rule "sdk/js/src/errors.ts — typed error hierarchy" fires
     → check: docs/client/sdk.md § "Error hierarchy"
     → check: docs/client/troubleshooting.md § the relevant category
```

If no rules fire, the change is doc-irrelevant. Print a short report
and stop. Do not edit any narrative.

### Step 4 — Edit the flagged narratives

For each file flagged in step 3:

1. Read the file
2. Read the relevant section of
   `docs/standards/client-narratives/narratives.md` for its scope
3. Identify drift specifically:
   - Stale method signatures or option tables
   - Stale CLI flag tables (a flag that no longer exists, a renamed
     flag, a missing new flag)
   - Stale code examples (import names that no longer match exports;
     methods called with the wrong signature)
   - Stale GitHub source links (path moved or file renamed)
   - Stale type / enum value lists
4. Make targeted edits — only on rule-detected drift
5. Verify the file still satisfies `frontmatter.md`

**Do not** rewrite for style. **Do not** improve phrasing. **Do not**
add content the rules don't ask for. The rule-driven scope is the
whole point of this skill.

### Step 5 — Frontmatter check

For every modified `docs/client/*.md`:

- Confirm `visibility: external` is set
- Confirm `audience: integrators` is set
- Confirm `title:` and `description:` are present and meaningful (not
  "TODO")
- Confirm `order:` is unchanged (this skill never reorders sections —
  that's a separate decision). Exception: `README.md` does not have
  `order:`.

If any required key is missing or wrong, fix it in-place (this is
rule-detected drift per `frontmatter.md`) and report the fix in the
step 7 report.

### Step 6 — Stage updates

Leave the working tree dirty for human review. Do **NOT** commit.
Do **NOT** push. Do **NOT** run `fractary-codex sync`.

If `--dry-run` was passed, do not modify any files in this step —
print the proposed changes in the step 7 report instead, and skip
straight to it.

`git status --short` should show:

```
 M docs/client/<some narratives>.md           (one or more, depending on what fired)
```

No other paths should be modified.

### Step 7 — Print the report

Output the report to chat (not to a file):

```
update-client-docs report
  Changed files since <ref>:
    - sdk/js/src/client.ts
    - sdk/js/src/errors.ts
  Drift rules triggered:
    - "sdk/js/src/client.ts — PressClient class" → check docs/client/sdk.md
    - "sdk/js/src/errors.ts — typed error hierarchy" → check docs/client/sdk.md, docs/client/troubleshooting.md
  Edits made:
    - docs/client/sdk.md: added new `cancelRun` method to "Methods" section; added new `PressConflictError` class to "Error hierarchy"
    - docs/client/troubleshooting.md: added "Run state — `PressConflictError`" subsection
  Edits NOT made (rule did not fire):
    - docs/client/install.md, docs/client/cli.md, docs/client/skills.md, docs/client/workflow.md, docs/client/README.md
  Next steps:
    1. Review the diffs: git diff docs/client
    2. Commit when satisfied: git add docs/client && git commit
    3. After merge to main, push to codex: fractary-codex sync --direction to-codex
```

## Critical Rules

1. **Tight scope**. Only edit `docs/client/*.md`. Never `README.md`,
   `CLAUDE.md`, `docs/install.md` (the legacy file),
   `docs/standards/` (other than the `client-narratives/` ruleset,
   which the skill *reads* but does not *edit*), `skills/*/SKILL.md`,
   source code, or anything else.
2. **Rule-driven only**. Every edit must trace to a specific rule in
   `docs/standards/client-narratives/drift-rules.md` or a specific
   entry in `docs/standards/client-narratives/narratives.md`. If you
   can't cite the rule, don't make the edit.
3. **No speculative rewrites**. Style improvements, phrasing tweaks,
   restructuring — out of scope. A separate effort can polish prose;
   this skill's job is keeping content accurate.
4. **No commit, no push, no sync**. Human review gate is mandatory.
   Print the next-step commands; let the operator run them.
5. **Stop on errors**. If any rule lookup is ambiguous, stop and
   report. Don't guess.
6. **Determinism**. Same input (commits since `<ref>`) must produce
   the same edits across runs. If a rule has a judgment call ("update
   if material"), bias toward conservative — flag it in the report
   rather than making the edit.

## Output

A chat report (see step 7 format) plus working-tree changes to zero
or more `docs/client/*.md` files. Nothing else.

## Related

- [docs/standards/client-narratives/narratives.md](../../../docs/standards/client-narratives/narratives.md) — voice + scope rulebook
- [docs/standards/client-narratives/drift-rules.md](../../../docs/standards/client-narratives/drift-rules.md) — code-change → doc-file mapping
- [docs/standards/client-narratives/frontmatter.md](../../../docs/standards/client-narratives/frontmatter.md) — frontmatter schema
- [sdk/js/src/](../../../sdk/js/src/) — SDK source the drift rules track
- [cli/src/](../../../cli/src/) — CLI source the drift rules track

## Out of scope (deliberately)

- Updating docs in `api.corthography.ai`, `press.corthography.ai`, or
  `docs.corthography.ai` — those are different repos with their own
  update-`X`-docs skills
- Updating internal docs in this repo — `README.md`, `CLAUDE.md`, the
  legacy `docs/install.md`. Those are contributor / partner concerns
  with their own conventions.
- Updating plugin `skills/*/SKILL.md` content — those are part of the
  plugin product. The narratives' `skills.md` summarizes them; if a
  skill body changes materially, update `skills.md` per the
  drift-rules `skills/*/SKILL.md` rule.
- Pushing to codex — that's a separate step the operator runs after
  merge
- Adding new narrative files — if `docs/client/` needs a new file
  (e.g., a "rate-limits" narrative split out of `troubleshooting.md`),
  that's a deliberate authoring decision, not a drift fix. Add it
  manually, then update
  `docs/standards/client-narratives/narratives.md` to include the new
  file's per-file scope.
