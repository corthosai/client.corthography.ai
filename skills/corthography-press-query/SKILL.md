---
name: corthography-press-query
description: Stage 1 of the Corthography Press pipeline — fetch Corthodex data and stage chunked JSON in the partner's S3 area. Use when collecting fresh data for a project before rendering.
---

# /corthography-press-query — Start a template-query run

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<target>` | Yes | `{owner}/{collection}/{type}/{name}+{project_slug}`, or the 3-segment shorthand if `CORTHOGRAPHY_OWNER` is set |
| `--env <test\|prod>` | No | Environment (default: test) |
| `--ref <branch\|tag\|sha>` | No | Pin a specific git ref of the partner template repo |
| `--json` | No | Output JSON instead of human-readable text |
| `--wait` | No | Block until the run reaches a terminal state, then print final status |
| `--wait-timeout <seconds>` | No | Max wait time when `--wait` is set (default: 600) |
| `--poll-interval <seconds>` | No | Fixed poll cadence (default: adaptive 5s for 30s, then 15s) |

## Procedure

Run the CLI directly. **Do not pre-check `CORTHOGRAPHY_TOKEN` or any credential file** — the CLI handles credential resolution itself and emits a precise error naming the missing piece if anything's wrong.

```bash
corthography query <target> [--env test|prod] [--ref <ref>] [--json]
```

Print the returned `run_id` and stop. The partner can poll status via `/corthography-press-status {run_id}`. If the CLI exits non-zero, surface its error message verbatim — don't guess.

### Polling option

Pass `--wait` to block on a single bash call until the run is terminal — saves agent context tokens versus loop-polling `/corthography-press-status`. The CLI prints the final status block once and exits with:

- `0` — succeeded
- `1` — failed or cancelled (or any preexisting CLI/network error)
- `2` — paused at the prod release gate (`awaiting_approval` — call `/corthography-press-approve`)
- `3` — `--wait-timeout` reached (run still running; re-invoke `/corthography-press-status {run_id} --wait` to keep waiting)

`--wait-timeout <seconds>` (default 600 — matches Claude Code's 10-minute Bash ceiling) and `--poll-interval <seconds>` (default adaptive: 5s for the first 30s, then 15s) tune the loop.

Credential resolution (handled inside the CLI, listed for reference only): `--token` flag → `CORTHOGRAPHY_TOKEN` env var → `.fractary/env/.env.<env>` (walked up from cwd, picked to match `--env`) → `~/.corthography/credentials`.

## Errors and what they mean

- `CORTHOGRAPHY_TOKEN` missing → `corthography` exits non-zero with a clear message; ask the partner to set it via env var, `.fractary/env/.env.<env>`, or `~/.corthography/credentials`
- "missing the owner segment" → the partner used a 3-segment target without `CORTHOGRAPHY_OWNER` set. Either prepend the owner (e.g., `dms/...`) or set the env var.
- 403 / `PressScopeError` → the target is not in the partner's authorization registry. Don't retry; surface the API error message verbatim
- 429 / `PressQuotaError` → too many concurrent runs; suggest waiting for an in-flight run to complete

## Related

- `/corthography-press-status` — check progress
- `/corthography-press-render` — Stage 2 (after data is staged)
