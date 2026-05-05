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

## Procedure

```bash
corthography status <run_id> [--json]
```

Output includes: workflow, target, environment, status, current_phase, started_at, completed_at, error.

## Status values

- `queued` — accepted by the API, not yet running
- `running` — Step Functions execution in progress
- `awaiting_approval` — paused at the prod release gate (call `/corthography-press-approve`)
- `succeeded` — terminal success
- `failed` — terminal failure (check `error` and `/corthography-press-logs`)
- `cancelled` — manually stopped
