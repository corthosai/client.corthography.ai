---
name: corthography-press-render
description: Stage 2 of the Corthography Press pipeline — render Markdown content from previously staged data chunks. Use when the partner wants fresh rendered output without re-querying.
---

# /corthography-press-render — Start a template-render run

## Arguments

Same as `/corthography-press-query`:

| Argument | Required | Description |
|----------|----------|-------------|
| `<target>` | Yes | `{owner}/{collection}/{type}/{name}+{project_slug}`, or the 3-segment shorthand if `CORTHOGRAPHY_OWNER` is set |
| `--env <test\|prod>` | No | Environment (default: test) |
| `--ref <branch\|tag\|sha>` | No | Pin a specific git ref |
| `--json` | No | JSON output |
| `--wait` | No | Block until the run reaches a terminal state, then print final status |
| `--wait-timeout <seconds>` | No | Max wait time when `--wait` is set (default: 600) |
| `--poll-interval <seconds>` | No | Fixed poll cadence (default: adaptive 5s for 30s, then 15s) |

## Procedure

```bash
corthography render <target> [--env test|prod] [--ref <ref>] [--json]
```

Print the returned `run_id`.

### Polling option

Pass `--wait` to block on a single bash call until terminal — one input/output pair regardless of run duration. Exit codes:

- `0` — succeeded
- `1` — failed or cancelled (or any preexisting CLI/network error)
- `2` — paused at the prod release gate (`awaiting_approval`)
- `3` — `--wait-timeout` reached (re-invoke `/corthography-press-status {run_id} --wait` to keep waiting)

`--wait-timeout <seconds>` (default 600) bounds the wait. Renders that exceed the default exit with code 3 — partners can re-wait or pass a larger timeout for terminal use.

## Notes

- Rendering can take minutes to hours depending on dataset size. Without `--wait` the CLI returns immediately with a queued run_id; status updates land in DynamoDB and surface via `/corthography-press-status`.
- If the partner hasn't staged data yet (no prior `query` run), the render will fail with no input data. Run `/corthography-press-query` first.

## Related

- `/corthography-press-query` — Stage 1
- `/corthography-press-publish` — Stage 3
- `/corthography-press-status` — poll
