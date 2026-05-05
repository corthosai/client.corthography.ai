---
name: corthography-press-render
description: Stage 2 of the Corthography Press pipeline — render Markdown content from previously staged data chunks. Use when the partner wants fresh rendered output without re-querying.
---

# /corthography-press-render — Start a template-render run

## Arguments

Same as `/corthography-press-query`:

| Argument | Required | Description |
|----------|----------|-------------|
| `<target>` | Yes | `{owner}/{collection}/{type}/{name}+{project_slug}` |
| `--env <test\|prod>` | No | Environment (default: test) |
| `--ref <branch\|tag\|sha>` | No | Pin a specific git ref |
| `--json` | No | JSON output |

## Procedure

```bash
corthography render <target> [--env test|prod] [--ref <ref>] [--json]
```

Print the returned `run_id`.

## Notes

- Rendering can take minutes to hours depending on dataset size. The CLI returns immediately with a queued run_id; status updates land in DynamoDB and surface via `/corthography-press-status`.
- If the partner hasn't staged data yet (no prior `query` run), the render will fail with no input data. Run `/corthography-press-query` first.

## Related

- `/corthography-press-query` — Stage 1
- `/corthography-press-publish` — Stage 3
- `/corthography-press-status` — poll
