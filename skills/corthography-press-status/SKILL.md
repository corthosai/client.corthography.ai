---
name: corthography-press-status
description: Show the current status of a Corthography Press run. Use when checking on a run started via /corthography-press-query, /corthography-press-render, or /corthography-press-publish.
---

# /corthography-press-status — Show run status

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<run_id>` | Yes | Run identifier returned by a previous start command |
| `--json` | No | JSON output |
| `--wait` | No | Block until the run reaches a terminal state, then print final status |
| `--wait-timeout <seconds>` | No | Max wait time when `--wait` is set (default: 600) |
| `--poll-interval <seconds>` | No | Fixed poll cadence (default: adaptive 5s for 30s, then 15s) |

## Procedure

```bash
corthography status <run_id> [--json] [--wait] [--wait-timeout <s>] [--poll-interval <s>]
```

Output includes: workflow, target, environment, status, current_phase, started_at, completed_at, error.

### Polling option

Without `--wait`, prints the current status once and exits. With `--wait`, the CLI polls internally and blocks until the run is terminal, then prints final status. This avoids burning agent context on a manual poll loop. Exit codes:

- `0` — succeeded
- `1` — failed or cancelled (or any preexisting CLI/network error)
- `2` — paused at the prod release gate (`awaiting_approval` — call `/corthography-press-approve`)
- `3` — `--wait-timeout` reached (run still in progress; re-invoke with `--wait` to keep waiting)

## Status values

- `queued` — accepted by the API, not yet running
- `running` — Step Functions execution in progress
- `awaiting_approval` — paused at the prod release gate (call `/corthography-press-approve`)
- `succeeded` — terminal success
- `failed` — terminal failure (check `error` and `/corthography-press-logs`)
- `cancelled` — manually stopped
