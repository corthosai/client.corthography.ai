---
name: corthography-template-sectioning
description: How to structure sections in `index.md.j2` so a Corthography Press template gracefully degrades when data is partial. Read this skill before adding or restructuring a section — empty sections, orphan headings, and silent skips are the most common rendered-output defects.
---

# /corthography-template-sectioning — Section structure

> Partner-facing extract of press-core's internal `template-development-standards.md`.
> The press repo is canonical; this skill covers the partner-applicable subset.

## The principle

Press templates render across a wide population of entities, and the API
returns sparse data for a long tail of those entities. A section that prints a
heading and an empty body is worse than no section at all — readers see the
heading, scan, find nothing, and lose trust.

**Gate every section on the presence of its data.** Headings, intros, and
container blocks should be inside the same `{% if %}` as the content they
introduce.

## What "gate" means in practice

```twig
{# WRONG — heading prints even when the API returned nothing #}

## Tuition and fees

{% if college.tuition_in_state %}
Tuition (in-state): ${{ college.tuition_in_state }}
{% endif %}
{% if college.tuition_out_state %}
Tuition (out-of-state): ${{ college.tuition_out_state }}
{% endif %}
```

```twig
{# RIGHT — heading and intro travel with the data #}

{% if college.tuition_in_state or college.tuition_out_state %}
## Tuition and fees

{% if college.tuition_in_state %}
Tuition (in-state): ${{ college.tuition_in_state }}
{% endif %}
{% if college.tuition_out_state %}
Tuition (out-of-state): ${{ college.tuition_out_state }}
{% endif %}
{% endif %}
```

The "guard at the top" pattern is the simplest version. For sections with
many optional sub-fields, gate on a derived "any field present" flag computed
once.

## Avoiding orphan and stub sections

A section is a stub when:

- It prints a heading but the body shrinks to one bullet or a single
  sentence in the rare case some data was present
- It prints an empty list (`*`, `*`, `*`) because the loop ran but every
  iteration's `{% if %}` filtered everything out
- It introduces sub-headings that themselves all gate to empty

For each, the fix is the same: lift the gate up the tree until the heading
has guaranteed company.

```twig
{# WRONG — produces "## Notable programs\n*\n*\n" if every program lacks the field #}

## Notable programs

{% for p in college.programs %}
{% if p.is_notable %}
* {{ p.name }}
{% endif %}
{% endfor %}
```

```twig
{# RIGHT — pre-filter, then only render the section if anything survives #}

{% set notable = college.programs | selectattr("is_notable") | list %}
{% if notable | length > 0 %}
## Notable programs

{% for p in notable %}
* {{ p.name }}
{% endfor %}
{% endif %}
```

## Conditional headings vs. conditional content

Some sections always have *some* content but the heading wording changes
based on what's present. That's fine — the heading is still inside an
`{% if %}`, just with multiple branches:

```twig
{% if college.acceptance_rate %}
{% if college.acceptance_rate < 0.10 %}
## Highly selective admissions
{% else %}
## Admissions overview
{% endif %}

The acceptance rate at {{ college.name }} is {{ (college.acceptance_rate * 100) | round(1) }}%.
{% endif %}
```

## Fallback copy when partial

When a section is mostly-present but one sub-field is missing, prefer
omitting that line over printing a placeholder. "${{ college.tuition }}" with
`tuition: null` produces `$<nil>` or `$` — both broken. Gate per-line:

```twig
{% if college.tuition_in_state or college.tuition_out_state or college.fees %}
## Tuition and fees

{% if college.tuition_in_state %}
- In-state tuition: ${{ "{:,.0f}".format(college.tuition_in_state) }}
{% endif %}
{% if college.tuition_out_state %}
- Out-of-state tuition: ${{ "{:,.0f}".format(college.tuition_out_state) }}
{% endif %}
{% if college.fees %}
- Required fees: ${{ "{:,.0f}".format(college.fees) }}
{% endif %}
{% endif %}
```

Editorial fallback copy is acceptable for narrative sections, but it must
read naturally — "Tuition figures were not available at the time of
publication" reads better than a missing paragraph for a section the page
otherwise needs structurally. Use sparingly; prefer omission.

## Worked example: gating a "Tuition and fees" section

```twig
{# templates/education-niche/colleges/overview/index.md.j2 — excerpt #}

{% set tuition_present = college.tuition_in_state or college.tuition_out_state %}
{% set fees_present = college.fees %}

{% if tuition_present or fees_present %}
## Tuition and fees at {{ college.name }}

{% if tuition_present %}
{% if college.tuition_in_state and college.tuition_out_state %}
{{ college.name }} charges ${{ "{:,.0f}".format(college.tuition_in_state) }} in-state and ${{ "{:,.0f}".format(college.tuition_out_state) }} out-of-state per year.
{% elif college.tuition_in_state %}
{{ college.name }} charges ${{ "{:,.0f}".format(college.tuition_in_state) }} per year for in-state students.
{% else %}
{{ college.name }} charges ${{ "{:,.0f}".format(college.tuition_out_state) }} per year for out-of-state students.
{% endif %}
{% endif %}

{% if fees_present %}
Required fees add ${{ "{:,.0f}".format(college.fees) }} per year on top of tuition.
{% endif %}
{% endif %}
```

The section is gated by an "any tuition or fees present" flag. Within, each
sentence handles its own missing-field case so partial data still produces a
well-formed paragraph.

## Validation checklist

Before pushing a sectioning change:

- [ ] Every `## Heading` and `### Subheading` is inside an `{% if %}` that
      gates on the presence of the section's data
- [ ] Every loop has a pre-computed `| length > 0` check before its
      surrounding heading prints
- [ ] No literal `{{ entity.field }}` reference outside an `{% if %}` for
      fields that the API doesn't always return (consult
      `corthography-template-fields`)
- [ ] `corthography render --ref <branch> --env test` produces no
      `<nil>`-suffixed strings, no `$` followed by whitespace, and no
      heading immediately followed by another heading
- [ ] For at least one sparsely-populated sample entity (`sample_items` in
      `config.json`), the rendered output reads naturally with the missing
      sections silently omitted
