---
name: press-render
description: Stage 2 of the Corthography Press pipeline — render Markdown content from previously staged data chunks. Use when the partner wants fresh rendered output without re-querying.
---

# /press-render — Start a template-render run

## Arguments

Same as `/press-query`:

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

- Rendering can take minutes to hours depending on dataset size. The CLI returns immediately with a queued run_id; status updates land in DynamoDB and surface via `/press-status`.
- If the partner hasn't staged data yet (no prior `query` run), the render will fail with no input data. Run `/press-query` first.

## Related

- `/press-query` — Stage 1
- `/press-publish` — Stage 3
- `/press-status` — poll
