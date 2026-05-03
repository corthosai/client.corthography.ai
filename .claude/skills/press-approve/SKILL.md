---
name: press-approve
description: Approve (or reject) a Corthography Press run paused at the production release gate. Use when a publish run with --env prod is awaiting human approval.
---

# /press-approve — Release a paused prod run

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<run_id>` | Yes | Run identifier (status must be `awaiting_approval`) |
| `--reject` | No | Reject the release instead of approving |
| `--reason <text>` | No | Optional reason recorded in the run metadata |
| `--json` | No | JSON output |

## Procedure

```bash
corthography approve <run_id> [--reject] [--reason "..."]
```

## Notes

- Default approves; pass `--reject` to fail the run.
- Whether the partner can self-approve depends on their `auto_approve_prod` flag in the registry. By default this is `false` — only a press-core engineer can release prod runs. Partners should coordinate with their press-core contact when paused at this gate.
