---
name: corthography-template-config
description: The shape of `config.json` that lives next to every `index.md.j2`. Read this skill when creating a new template, changing which API endpoints feed it, adding `sample_items`, or wiring up `item_explode` for cross-product page expansion.
---

# /corthography-template-config — `config.json` schema

> Partner-facing extract of press-core's internal `template-config-standards.md`
> and `partner-repo-standards.md`. The press repo is canonical; this skill covers
> the partner-applicable subset.

## What `config.json` does

Every template directory (the one holding `index.md.j2`) must contain a
`config.json` that declares:

- The template's identity (`id`, `name`, `description`)
- Which fields key the entity (`primary_key`, `secondary_keys`)
- Which Corthodex API endpoints feed it (`list_endpoint`, `item_endpoints`)
- Optionally, sample entities for fast iteration (`sample_items`)
- Optionally, cross-product expansion rules (`item_explode`)
- Optionally, a custom slug pattern for output filenames (`slug_pattern`)

Press-core reads this file when running `corthography query` and when
rendering. Project configs and templates can drift, but `config.json` for the
template is load-bearing — it defines the entire data contract.

## Minimal schema

```json
{
  "id": "<owner>-<collection>-<type>-<name>",
  "name": "Human-readable Template Name",
  "description": "One-sentence description of what this template produces.",
  "primary_key": "<entity-id-field>",
  "secondary_keys": [],
  "list_endpoint": "<corthodex-collection-path>",
  "item_endpoints": [
    "<corthodex-collection-path>/{<primary-key>}"
  ]
}
```

### Required fields

| Field | Type | What it does |
|---|---|---|
| `id` | string | Globally unique template identifier. Format: `{owner}-{collection}-{type}-{name}`, all lowercase, hyphenated. |
| `name` | string | Human-readable template name (used in dashboards and run summaries). |
| `description` | string | One-sentence description of what this template renders. |
| `primary_key` | string | The field name on the list-endpoint response that identifies one entity. Substituted into `{primary_key}` placeholders in `item_endpoints`. |
| `secondary_keys` | array of strings | Other fields that contribute to entity identity. **Use `[]`, never `null`.** Required when `item_explode` is declared (each explosion stage's `identity` must appear here). |
| `list_endpoint` | string | The Corthodex API endpoint that returns the list of entities for this template. Forward slashes only; no leading or trailing slash. |
| `item_endpoints` | array | One or more per-entity detail endpoints. Most templates use one; some need a second for supplementary data (e.g., admissions stats). |

### Optional fields

| Field | Type | What it does |
|---|---|---|
| `sample_items` | array of objects | Representative entities used by `--sample` mode. Each object's keys must be exactly `primary_key + secondary_keys`. Project-level overrides win. |
| `item_explode` | array of objects | Declares cross-product expansion (e.g., one page per (college × program)). See "Item-explode" below. |
| `slug_pattern` | string | Output filename pattern, e.g., `"{college_slug}__{program_slug}"`. Default is `__`-joined `primary_key` + `secondary_keys`. |

## Worked examples

### Single-entity template (one page per college)

```json
{
  "id": "dms-education-niche-colleges-overview",
  "name": "College Overview",
  "description": "General college overview with rankings, statistics, and basic institutional info.",
  "primary_key": "college_slug",
  "secondary_keys": [],
  "list_endpoint": "education/colleges",
  "item_endpoints": [
    "education/colleges/{college_slug}"
  ],
  "sample_items": [
    {"college_slug": "harvard-university"},
    {"college_slug": "massachusetts-institute-of-technology"},
    {"college_slug": "stanford-university"}
  ]
}
```

### Multi-endpoint template (overview + admissions data)

```json
{
  "id": "dms-education-niche-colleges-admission-applications",
  "name": "Admission Applications",
  "description": "Application process, admission requirements, and acceptance statistics.",
  "primary_key": "college_slug",
  "secondary_keys": [],
  "list_endpoint": "education/colleges",
  "item_endpoints": [
    "education/colleges/{college_slug}",
    "education/colleges/{college_slug}/admission"
  ]
}
```

The renderer merges fields from both responses into the entity dict before
the template runs. Reference them as `entity.field_from_first` or
`entity.field_from_second` — there's no namespace separation.

### Compound-key template (one page per (college × program))

```json
{
  "id": "dms-education-niche-colleges-programs",
  "name": "College + Program",
  "description": "Per-program pages within a college, e.g., Harvard's CS program.",
  "primary_key": "college_slug",
  "secondary_keys": ["program_slug"],
  "list_endpoint": "education/colleges/?include=programs",
  "item_explode": [
    {"source": "programs", "as": "program", "identity": "program_slug"}
  ],
  "item_endpoints": [
    "education/colleges/{college_slug}/programs/{program_slug}"
  ],
  "sample_items": [
    {"college_slug": "harvard-university", "program_slug": "computer-science"},
    {"college_slug": "stanford-university", "program_slug": "computer-science"}
  ]
}
```

## Item-explode: cross-product page expansion

Use `item_explode` when one parent record on the list endpoint should produce
*many* rendered pages — typically one page per child element of a list field.

Each explode stage:

```json
{"source": "<dotted-path>", "as": "<alias>", "identity": "<field>"}
```

- `source` — a dotted path rooted in the cumulative entity (`programs`,
  `award.places`). Press auto-flatmaps when a segment lands on a list, so
  `programs_by_cip2.programs_by_cip4` walks every cip2 record and concatenates
  its cip4 array. **JMESPath is not supported.** Stick to
  `[A-Za-z_]\w*(\.[A-Za-z_]\w*)*`.
- `as` — name of the sub-item in the rendered Jinja context. Must be unique
  across stages.
- `identity` — the field whose value distinguishes pages within the stage.
  **Must appear in `secondary_keys`.**

Multi-stage cross-products work — e.g., one page per (program ×
award_level × place):

```json
"item_explode": [
  {"source": "by_award_level", "as": "award", "identity": "award_level"},
  {"source": "award.places",   "as": "place", "identity": "place_slug"}
]
```

For a same-shape hierarchy where you want one page per item at every level,
use a list of paths:

```json
"item_explode": [
  {
    "source": [
      "programs_by_cip2",
      "programs_by_cip2.programs_by_cip4",
      "programs_by_cip2.programs_by_cip4.programs_by_cip6"
    ],
    "as": "program",
    "identity": "cipcode"
  }
]
```

## `sample_items` and the dev iteration loop

`sample_items` is what `corthography query --sample` queries to seed a fast
iteration loop — three or so representative entities instead of the full set.
Every entry's keys must exactly match `primary_key + secondary_keys`:

```json
"sample_items": [
  {"college_slug": "harvard-university", "program_slug": "computer-science"}
]
```

**Project-level overrides win over template-level.** A project's
`config.json` may declare its own `sample_items` keyed by template slug:

```json
{
  "sample_items": {
    "education-niche/colleges/programs": [
      {"college_slug": "harvard-university", "program_slug": "computer-science"}
    ],
    "education-niche/colleges/*": [
      {"college_slug": "stanford-university"}
    ]
  }
}
```

Resolution: exact match → longest-glob match → template-level → error.
Globs use `fnmatch` semantics (`*` matches across `/`).

This matters because one template (`colleges/programs`) is reused across many
projects (`computer-science-degree`, `nursing-degree`, ...), and the sample
slugs that exercise one project's `cip_begins_with` filter are irrelevant to
another's. Override per-project; don't pin a one-size-fits-all list at the
template level.

## Project-level overrides on the template ref

A project's `config.json` can also pin which git ref of the partner template
repo it uses, via `template_ref`:

```json
{
  "project_slug": "computer-science-degree",
  "template_ref": "v2026.04-stable"
}
```

Without `template_ref`, the engine uses the partner repo's default ref from
the press-core registry. Override is most often used to keep production
projects on a signed tag while the partner repo's `main` evolves.

## Validation rules (recap)

1. Every template directory has a `config.json` — no exceptions.
2. `id` is globally unique, hyphenated, all lowercase.
3. `primary_key` matches the actual field name from `list_endpoint`'s
   response — verify with `corthography query` and inspect.
4. `secondary_keys` is `[]`, never `null`, when there are no secondary keys.
5. Every explode stage's `identity` appears in `secondary_keys`.
6. Endpoint paths use forward slashes; no leading or trailing slashes.
7. Every `sample_items` entry's keys are exactly `primary_key + secondary_keys`.
8. Quick parse-check before pushing:
   ```bash
   python3 -c "import json; json.load(open('templates/.../config.json'))"
   ```

## Worked example: adding an extra item endpoint

Goal: enrich an existing college-overview template with admissions data
(GPA distribution, test scores) currently fetched only on demand.

```json
{
  "id": "dms-education-niche-colleges-overview",
  "name": "College Overview",
  "description": "General college overview enriched with admissions context.",
  "primary_key": "college_slug",
  "secondary_keys": [],
  "list_endpoint": "education/colleges",
  "item_endpoints": [
    "education/colleges/{college_slug}",
    "education/colleges/{college_slug}/admission"
  ]
}
```

After the config change:

1. Re-run `corthography query <target> --ref <branch> --env test --wait` to
   refetch with the new endpoint
2. Inspect a chunk: confirm the merged entity now has the admissions fields
   you expect (e.g., `entity.gpa_25th_percentile`, `entity.gpa_75th_percentile`)
3. Reference them in `index.md.j2` per the rules in
   `corthography-template-fields` (gate optional fields, defend against
   missing data)
4. Re-render and inspect

## Related

- `corthography-template-fields` — how to safely reference the fields you've
  declared here
- `corthography-template-sectioning` — how to gate sections that depend on
  optional fields from `item_endpoints`
- `corthography-template-spintax` — how to vary the rendered text once your
  data is in place
