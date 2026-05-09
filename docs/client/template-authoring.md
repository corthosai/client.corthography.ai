---
title: "Template authoring standards"
description: "What makes a good Corthography Press template — Spintax discipline, sectioning, field access, and config.json shape. Pairs with the template-hotfix workflow and four bundled standards skills."
visibility: external
audience: integrators
order: 7
---

# Template authoring standards

Corthography Press is deterministic by design. There is no runtime LLM —
every variation in the rendered output comes from the Jinja2 + Spintax in
your template, picked by a stable seed. That means a small number of habits
matter a lot: the same edit done well or done poorly is the difference
between consistent quality across a hundred thousand pages and a long tail
of `<nil>`-suffixed strings, orphan headings, and silently-skipped sections.

This page introduces the four habits, each backed by a focused skill you can
invoke directly to read in full or that the
[`template-hotfix`](./extending-workflows.md#template-hotfix) workflow loads
as context when applying an edit.

## The four standards

### 1. Spintax discipline → [`/corthography-template-spintax`](../../skills/corthography-template-spintax/SKILL.md)

Spintax (`{a|b|c}`) is the alternation syntax that produces surface variation
across pages. Every alternation must convey the same facts; the seed must be
deterministic from `(site, entity)`; nested branching that explodes
combinatorially is forbidden. The skill walks through patterns that work
(word-level synonyms, phrase-level openers, sentence-level structural
variation) and patterns that don't (nested 3×3×3, factual divergence,
ephemeral seeds).

### 2. Sectioning → [`/corthography-template-sectioning`](../../skills/corthography-template-sectioning/SKILL.md)

A heading printed without content is worse than no section. Every `##`,
`###`, intro paragraph, and container block must be inside the same `{% if
%}` as the data it introduces. The skill covers heading-with-data gates,
pre-filtering loops with `selectattr` so empty result sets don't print the
heading, and conditional-heading patterns where the wording changes with the
data.

### 3. Field references → [`/corthography-template-fields`](../../skills/corthography-template-fields/SKILL.md)

The #1 source of silent template bugs is referencing fields the Corthodex
API doesn't actually return. The defensive `{% if %}` makes the failure
invisible — sections silently disappear and `<nil>`-style validators all
pass. The skill defines the verification workflow (run `corthography query
--ref <branch>`, inspect a chunk, confirm the field exists for typical
entities, *then* add the reference) and the safe-access patterns for fields
that are sometimes-missing.

### 4. `config.json` shape → [`/corthography-template-config`](../../skills/corthography-template-config/SKILL.md)

Every template directory has a `config.json` next to its `index.md.j2`. It
declares the template's identity, which API endpoints feed it, the fields
that key the entity, and (optionally) cross-product page expansion via
`item_explode`. The skill covers the schema, the rules around
`primary_key` / `secondary_keys`, the `sample_items` pattern for fast
iteration, and the project-level overrides that let one template serve many
sites.

## When to use the workflow vs. edit by hand

Both paths land at the same correctness floor. Pick whichever fits the
change.

**Use [`template-hotfix`](./extending-workflows.md#template-hotfix)** when:
- You want Claude to apply the change with the standards loaded as context
  and surface the diff for review before commit
- You want the workflow to verify end-to-end against the test environment
  (query → render → publish at the hotfix branch ref) before you decide
  whether to merge
- The change touches enough surface that you'd benefit from the standards
  skills' validation checklists running through the diff

**Edit by hand** when:
- It's a one-character typo or pure copy edit
- You're already deep in the template and the standards are top-of-mind

In either case, the standards apply. Read the relevant skill before pushing
a change you're not sure about.

## How the standards relate to press-core

These four skills are partner-facing extracts of press-core's internal
[`docs/standards/template-development-standards.md`](https://github.com/corthosai/press.corthography.ai/blob/main/docs/standards/template-development-standards.md),
[`template-config-standards.md`](https://github.com/corthosai/press.corthography.ai/blob/main/docs/standards/template-config-standards.md),
and
[`partner-repo-standards.md`](https://github.com/corthosai/press.corthography.ai/blob/main/docs/standards/partner-repo-standards.md).
The press repo is the canonical source. The skills cover the
partner-applicable subset — the press infrastructure detail (S3 paths, AWS
profile names, internal codepaths) is intentionally absent.

If a template behavior surprises you and isn't covered here, the press repo
is the next stop. Coordinate with your press-core liaison if you find a gap.

## Related

- [`extending-workflows.md`](./extending-workflows.md) — the bundled FABER
  workflows including `template-hotfix`
- [`workflow.md`](./workflow.md) — the manual edit → test → publish loop using
  `--ref <branch>` directly from the CLI
- [`troubleshooting.md`](./troubleshooting.md) — symptom-keyed fixes
