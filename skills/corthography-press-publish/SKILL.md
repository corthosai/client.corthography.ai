---
name: corthography-press-publish
description: Stage 3 of the Corthography Press pipeline — distribute rendered content to the destination bucket. Use when the partner wants to publish rendered output. `--env prod` requires explicit approval before production publish.
---

# /corthography-press-publish — Start a template-publish run

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<target>` | Yes | `{owner}/{collection}/{type}/{name}+{project_slug}` |
| `--env <test\|prod>` | No | Environment (default: test) |
| `--ref <branch\|tag\|sha>` | No | Pin a specific git ref |
| `--json` | No | JSON output |

## Procedure

1. **Production safety**: if `--env prod`, ask the partner to confirm explicitly before invoking. The API will pause the run at the release gate; an approver must call `/corthography-press-approve {run_id}` to release to prod.

2. Run:

   ```bash
   corthography publish <target> [--env test|prod] [--ref <ref>] [--json]
   ```

3. Print the returned `run_id`.

## Notes

- `--env test` publishes to the test destination directly.
- `--env prod` publishes to test first, then **pauses for approval**. After human review, an approver runs `/corthography-press-approve {run_id}` to release.
- The destination bucket and prefix are part of the partner's authorization scope — set in `api.corthography.ai/config/partners.yaml`. Attempts to publish elsewhere are rejected by the API.

## Related

- `/corthography-press-approve` — release a paused prod run
- `/corthography-press-status` — poll progress
- `/corthography-press-logs` — get the CloudWatch log group for this run
