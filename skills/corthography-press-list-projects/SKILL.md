---
name: corthography-press-list-projects
description: List the Corthography Press projects the partner is authorized to target. Use to discover what projects can be passed to /corthography-press-query, /corthography-press-render, /corthography-press-publish.
---

# /corthography-press-list-projects

## Procedure

```bash
corthography projects [--json]
```

Output is a list of `template_key → [project_slugs]`. The partner can pass any combination as a target like `{template_key}+{project_slug}` to start a run.

## Notes

- A `*` in the slugs list means any slug under that template is allowed.
- The list reflects the current registry state; if a partner asks why a project isn't listed, the answer is in `api.corthography.ai/config/partners.yaml`.
