---
name: corthography-template-fields
description: How to reference entity fields in a Corthography Press template safely. Read this skill before adding any new `entity.foo` reference — referencing fields the API doesn't actually return is the #1 source of silent template bugs.
---

# /corthography-template-fields — Referencing entity fields safely

> Partner-facing extract of press-core's internal `template-development-standards.md`.
> The press repo is canonical; this skill covers the partner-applicable subset.

## The "dead reference" failure mode

Templates run against the Corthodex API's response. The API returns the
fields it returns; if your template references a field the API never
produces, **the failure is silent**:

- `{% if entity.foo %}` evaluates falsy when `foo` is undefined → the section
  silently disappears.
- `{{ entity.foo }}` renders as `<nil>` or empty depending on the helper — no
  exception is raised.
- `<nil>`-style validators all pass because no Python error happened.

Press-core encountered this enough times during template imports (specifically
runs #156, #300, and the first pass of #323) that the standards doc calls it
out as a top-priority concern. The fix is workflow-level: **probe the API
shape before referencing fields, every time.**

## The verification workflow

For every new field reference you add to a template:

1. Run the data query against your edit branch and a known sample:
   ```bash
   corthography query <target> --ref <your-branch> --env test --wait
   ```
2. Inspect the staged data — pull one chunk and check for the field:
   ```bash
   corthography status <run_id> --json | jq '.outputPaths[0]'
   # then aws s3 cp / curl the chunk and grep for the field name
   ```
3. Confirm:
   - The field exists at the expected path in the entity dict
   - It exists for *typical* entities, not just one outlier
   - Its type matches what your template assumes (string vs. number vs. list)
4. Only then add `{{ entity.your_field }}` to the template.

The skill `/corthography-press-query` wraps step 1; `/corthography-press-status`
wraps step 2. Both already exist.

## Safe-access patterns

Even after confirming a field exists, defend against the long tail where it's
absent or null. Three patterns, in order of preference:

**Gate the use of the field with `{% if %}`** — best for distinct sentences
or sections (see `corthography-template-sectioning`):

```twig
{% if college.accreditation_body %}
{{ college.name }} is accredited by the {{ college.accreditation_body }}.
{% endif %}
```

**`| default("")` for inline string fields** — when omission would leave a
broken sentence and a fallback is editorially acceptable:

```twig
{{ college.name }}{% if college.tagline %} — {{ college.tagline }}{% endif %}
```

(Note this is a gated pattern, not `default("")` — when the value is `null`,
`{{ "" }}` would still render the leading dash. Always inspect the rendered
output.)

**Never bare `{{ entity.optional_field }}`** without one of the above. That's
the dead-reference smell: a field that *might* be missing rendered as if it's
guaranteed.

## Nested fields and list access

Press flattens many list-of-dicts into nested structures. When you reach into
`entity.programs[0].cipcode`, two things can fail:

- `programs` is empty → `programs[0]` raises an IndexError at render
- `programs[0]` exists but has no `cipcode` → renders empty

Always guard the list and the field:

```twig
{% if college.programs and college.programs | length > 0 %}
{% set first_program = college.programs | first %}
{% if first_program.cipcode %}
The lead program is in CIP {{ first_program.cipcode }}.
{% endif %}
{% endif %}
```

For loops, prefer pre-filtering with `selectattr` over per-iteration `{% if %}`:

```twig
{% set funded_programs = college.programs | selectattr("annual_budget") | list %}
{% if funded_programs | length > 0 %}
{% for p in funded_programs %}
- {{ p.name }} (${{ p.annual_budget }})
{% endfor %}
{% endif %}
```

## Where field names come from

Field names live in three places, and templates should treat the API as
canonical:

1. **The Corthodex API response.** This is the source of truth. Anything not
   in the response shape doesn't exist for the template.
2. **`config.json`'s `primary_key` / `secondary_keys`.** These tell press
   which fields key the entity. They must match field names returned by the
   `list_endpoint`. See `corthography-template-config`.
3. **The `site` context dict.** Project-level config provides
   `site.slug`, `site.domain`, `site.context.*`, `site.metadata.*`. Use
   `site.context.get("key", "fallback")` for project-specific values that
   might not always be present.

If a template references a field invented in the legacy/competitor source
that the new API doesn't produce, the right move is to drop the reference,
not to gate it defensively. Defensive gating against fields that *will never*
exist hides the gap from editorial review.

## Worked example: adding an `accreditation_body` reference

Goal: enrich a college overview template with the accrediting body when
present.

1. **Confirm the field exists in the API response.** Run a query and inspect:
   ```bash
   corthography query dms/education-niche/colleges/overview+computer-science-degree \
     --ref hotfix/accreditation --env test --wait
   # Once succeeded, fetch a sample chunk and grep:
   # ... | jq '.[0].accreditation_body'
   ```
   If the field shows for typical institutions (not just outliers), proceed.
   If not, stop — the legacy template's reference doesn't translate.

2. **Gate the section** (see `corthography-template-sectioning`):
   ```twig
   {% if college.accreditation_body %}
   ## Accreditation

   {{ college.name }} is accredited by the {{ college.accreditation_body }}.
   {% if college.accreditation_year %}
   The current accreditation was granted in {{ college.accreditation_year }}.
   {% endif %}
   {% endif %}
   ```

3. **Render-test against a sparse entity** as well as a typical one:
   ```bash
   corthography render dms/education-niche/colleges/overview+computer-science-degree \
     --ref hotfix/accreditation --env test --wait
   ```
   Confirm: typical entities have the section; entities missing
   `accreditation_body` produce no orphan heading and no `<nil>`.

## Validation checklist

Before pushing a field-reference change:

- [ ] Every new `{{ entity.X }}` or `entity.X` in `{% if %}` corresponds to a
      field present in a fresh `corthography query` output for the same target
- [ ] Optional fields are gated with `{% if %}` or guarded with a sentence
      that's complete with or without them
- [ ] List access (`entity.list[0]`, `entity.list | first`) is preceded by
      `{% if entity.list and entity.list | length > 0 %}`
- [ ] No `<nil>`, `$ ` (dollar followed by whitespace), `,,` (double comma),
      `{{ }}` braces, or other unexpanded markers appear in the rendered
      output for at least one sparsely-populated sample entity
- [ ] If you're removing a reference (because the API doesn't produce that
      field), you've also removed the surrounding section/sentence, not just
      defensive-gated it
