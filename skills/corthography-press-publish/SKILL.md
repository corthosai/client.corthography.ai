---
name: corthography-press-publish
description: Stage 3 of the Corthography Press pipeline — distribute rendered content to the destination bucket. Use when the partner wants to publish rendered output. `--env prod` requires explicit approval before production publish.
---

# /corthography-press-publish — Start a template-publish run

## Arguments

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

1. **Production safety**: if `--env prod`, ask the partner to confirm explicitly before invoking. The API will pause the run at the release gate; an approver must call `/corthography-press-approve {run_id}` to release to prod.

2. Run:

   ```bash
   corthography publish <target> [--env test|prod] [--ref <ref>] [--json]
   ```

3. Print the returned `run_id`.

### Polling option

Pass `--wait` to block on a single bash call until terminal. For `--env prod` the run will pause at the release gate — `--wait` exits with code `2` (paused) so the agent can route to `/corthography-press-approve`. Exit codes:

- `0` — succeeded (`--env test` finished, or prod was approved and completed)
- `1` — failed or cancelled (or any preexisting CLI/network error)
- `2` — paused at the prod release gate (`awaiting_approval`)
- `3` — `--wait-timeout` reached (re-invoke `/corthography-press-status {run_id} --wait` to keep waiting)

`--wait-timeout <seconds>` (default 600) and `--poll-interval <seconds>` (default adaptive 5s/15s) tune the loop.

## Notes

- `--env test` publishes to the test destination directly.
- `--env prod` publishes to test first, then **pauses for approval**. After human review, an approver runs `/corthography-press-approve {run_id}` to release.
- The destination bucket and prefix are part of the partner's authorization scope — set in `api.corthography.ai/config/partners.yaml`. Attempts to publish elsewhere are rejected by the API.

## Related

- `/corthography-press-approve` — release a paused prod run
- `/corthography-press-status` — poll progress
- `/corthography-press-logs` — get the CloudWatch log group for this run
