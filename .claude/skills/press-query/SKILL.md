---
name: press-query
description: Stage 1 of the Corthography Press pipeline — fetch Corthodex data and stage chunked JSON in the partner's S3 area. Use when collecting fresh data for a project before rendering.
---

# /press-query — Start a template-query run

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<target>` | Yes | Canonical `{owner}/{collection}/{type}/{name}+{project_slug}` string |
| `--env <test\|prod>` | No | Environment (default: test) |
| `--ref <branch\|tag\|sha>` | No | Pin a specific git ref of the partner template repo |
| `--json` | No | Output JSON instead of human-readable text |

## Procedure

1. Confirm the partner has `CORTHOGRAPHY_TOKEN` set (env var or `~/.corthography/credentials`)
2. Run:

   ```bash
   corthography query <target> [--env test|prod] [--ref <ref>] [--json]
   ```

3. Print the returned `run_id` and stop. The partner can poll status via `/press-status {run_id}`.

## Errors and what they mean

- `CORTHOGRAPHY_TOKEN` missing → `corthography` exits non-zero with a clear message; ask the partner to set the env var
- 403 / `PressScopeError` → the target is not in the partner's authorization registry. Don't retry; surface the API error message verbatim
- 429 / `PressQuotaError` → too many concurrent runs; suggest waiting for an in-flight run to complete

## Related

- `/press-status` — check progress
- `/press-render` — Stage 2 (after data is staged)
