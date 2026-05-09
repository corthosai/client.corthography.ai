---
name: corthography-template-spintax
description: Spintax variation patterns and deterministic seeding for Corthography Press templates. Read this skill before adding or editing Spintax in `index.md.j2` — variation must be reproducible, factually invariant, and bounded.
---

# /corthography-template-spintax — Spintax in Corthography Press

> Partner-facing extract of press-core's internal `template-development-standards.md`.
> The press repo is canonical; this skill covers the partner-applicable subset.

## What Spintax is in this system

Spintax is the curly-brace alternation syntax (`{a|b|c}`) that lets one
template produce surface-level variations across pages without an LLM at render
time. Press registers a Jinja filter, `| spintax(seed)`, that picks one branch
per `{...}` group based on the seed. Same seed → same branch every time.

```twig
{{ "{High-quality|Excellent|Outstanding} programs at {this|our featured} institution." | spintax(site.slug, page_slug) }}
```

**The single non-negotiable rule:** the seed must be deterministic from the
entity + project, never random and never time-based. The standard pattern is:

```python
seed = f"{site.slug}:{page_slug}"   # site.slug from the project, page_slug from the entity
```

That's what the renderer passes by default. Don't override it with anything
that varies between runs.

## Why deterministic

Press's whole content-quality story rests on rerun stability:
- Editorial review at run N must still describe what's at the destination at
  run N+1. If the wording shifts between renders, reviewers can't trust their
  own eyes.
- CDN caching, downstream diffing, A/B comparison, and changelog generation
  all assume `(template, entity) → bytes` is a function, not a coin flip.
- There is **no runtime LLM**. All variation comes from your authored
  branches; the seed only picks among them.

## Variation patterns that work

**Word-level synonym swap** — small, safe, factually invariant:

```twig
{{ "Compare {tuition|cost} and {acceptance rate|admission rate} for {{ college.name }}." | spintax(seed) }}
```

**Phrase-level opener variation** — keeps openings from feeling templated when
a page index lists many siblings:

```twig
{{ "{For students considering {{ college.name }}|If you are evaluating {{ college.name }}|When weighing {{ college.name }} against peer institutions}, the figures below summarize the basics." | spintax(seed) }}
```

**Sentence-level structural variation** — same facts, different connective
tissue:

```twig
{{ "{Tuition is ${{ college.tuition }} per year.|At ${{ college.tuition }} a year, tuition is set above the regional median.|Annual tuition runs ${{ college.tuition }}.}" | spintax(seed) }}
```

## Don'ts

**Never vary facts.** Each branch must convey the same factual claim.

```twig
{# WRONG — branch 2 invents a fact branch 1 doesn't make #}
{{ "{The acceptance rate is high.|Acceptance is selective at under 10%.}" | spintax(seed) }}
```

**Never nest Spintax to combinatorial widths.** Three branches × three
branches × three branches is twenty-seven copies the editorial team has to
sign off on. Keep alternations flat or shallow.

```twig
{# WRONG — 3³ = 27 distinct outputs, none individually reviewed #}
{{ "{This|That|The} {school|college|institution} {offers|provides|has}..." | spintax(seed) }}
```

**Never put non-factual filler in a Spintax branch to "fill space."** If the
data is sparse, gate the section out (see
`corthography-template-sectioning`) — don't pad with airy variation.

**Don't seed off anything ephemeral.** Wall-clock time, run id, random uuid,
the user's locale — none of these belong in the seed. Stick to the standard
`site.slug:page_slug` pattern.

## Worked example: a college-overview opening sentence

```twig
{# templates/education-niche/colleges/overview/index.md.j2 #}

{% set seed = site.slug ~ ":" ~ college.college_slug %}

{{ "{ {{ college.name }} is a {{ college.carnegie_class | lower }} institution {{ "{located in|based in|sited in}" | spintax(seed) }} {{ college.city }}, {{ college.state }}. | Founded {{ college.year_founded }}, {{ college.name }} {{ "{operates as|is classified as|sits in the category of}" | spintax(seed) }} a {{ college.carnegie_class | lower }} institution in {{ college.city }}, {{ college.state }}. }" | spintax(seed) }}
```

Two top-level branches (different sentence structures, same facts), each
containing a small inner Spintax for a connector word. Total surface area: 6
distinct outputs, all reviewable. Seed is stable per `(site, college)` so the
same opener lands on every rerun for that combo.

## Validation checklist

Before pushing a Spintax change:

- [ ] Every branch in every `{...}` conveys the same facts as the others
- [ ] No branch references a field other branches don't reference
- [ ] Seed is `site.slug:page_slug` (or composed from those + a stable entity
      key — never time, run id, or random)
- [ ] `corthography render --ref <branch> --env test` produces stable output
      across two runs for the same entity (run twice, diff)
- [ ] Total branch count × branch count for any one paragraph stays under a
      dozen — if it doesn't, split the paragraph or drop branches
