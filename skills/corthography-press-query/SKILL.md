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

## Procedure

1. Confirm `CORTHOGRAPHY_TOKEN` is reachable. The CLI checks, in order: `--token` flag, env var, `.fractary/env/.env.<env>` (walked up from cwd), `~/.corthography/credentials`.
2. Run:

   ```bash
   corthography query <target> [--env test|prod] [--ref <ref>] [--json]
   ```

3. Print the returned `run_id` and stop. The partner can poll status via `/corthography-press-status {run_id}`.

## Errors and what they mean

- `CORTHOGRAPHY_TOKEN` missing → `corthography` exits non-zero with a clear message; ask the partner to set it via env var, `.fractary/env/.env.<env>`, or `~/.corthography/credentials`
- "missing the owner segment" → the partner used a 3-segment target without `CORTHOGRAPHY_OWNER` set. Either prepend the owner (e.g., `dms/...`) or set the env var.
- 403 / `PressScopeError` → the target is not in the partner's authorization registry. Don't retry; surface the API error message verbatim
- 429 / `PressQuotaError` → too many concurrent runs; suggest waiting for an in-flight run to complete

## Related

- `/corthography-press-status` — check progress
- `/corthography-press-render` — Stage 2 (after data is staged)
