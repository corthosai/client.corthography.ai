---
name: corthography-press-logs
description: Show the CloudWatch log group for a run so the partner can inspect detailed execution logs. Use when diagnosing a failed or stuck run.
---

# /corthography-press-logs — Get the log group for a run

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<run_id>` | Yes | Run identifier |
| `--json` | No | JSON output |

## Procedure

```bash
corthography logs <run_id>
```

Returns the CloudWatch log group path (e.g., `/aws/press/runs/{partner_id}/{run_id}`).

The partner can then read the log stream via:

```bash
aws logs tail "/aws/press/runs/{partner_id}/{run_id}" --follow \
  --profile <their-aws-profile-with-press-logs-read>
```

## Notes

- Log access requires AWS credentials with `logs:GetLogEvents` on the partner-prefixed log group. Press core grants this via the per-partner IAM role; the partner's own AWS profile needs to be able to assume the partner role.
- Phase 2A returns the log group pointer only. A signed-URL streaming endpoint is a phase 2B candidate.
