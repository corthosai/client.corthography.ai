---
title: "Client Documentation"
description: "Index of partner-facing narrative docs for the Corthography Press SDK, CLI, and Claude plugin."
visibility: external
audience: integrators
---

# Client documentation

Six partner-facing docs covering install, the CLI and SDK references,
the agent-skill catalog, the edit → test → publish workflow, and a
troubleshooting page keyed by symptom.

| File | Topic |
|---|---|
| [install.md](./install.md) | Three install paths (Claude plugin, CLI binary, SDK) + credential resolution |
| [cli.md](./cli.md) | `corthography` subcommand reference with flags and examples |
| [sdk.md](./sdk.md) | `PressClient` class, methods, types, and error hierarchy |
| [skills.md](./skills.md) | The 8 `/corthography-press-*` slash commands and when to use each |
| [workflow.md](./workflow.md) | Edit → test → publish loop with `--ref` and the prod approval gate |
| [troubleshooting.md](./troubleshooting.md) | Symptoms → fixes for the common error states |

The client talks to [api.corthography.ai](../api/) (HTTPS + bearer
token) which dispatches into [Corthography Press](../press/). All
three repos are versioned independently; this client surface is the
public partner-facing edge.
