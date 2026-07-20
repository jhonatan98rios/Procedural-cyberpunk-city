---
description: Brownfield discovery — seed architecture, conventions, and wiki entries from existing repository evidence.
---

# /idd-discover

You are running the IDD brownfield discovery pass. This is an on-demand
command, not an automatic check. Use it when the user wants the
repository understood or decomposed into IDD artifacts for the first
time, or when a major refactor has invalidated existing artifacts.

Dispatch sub-agents for the initial scans (manifests, lint and CI
configs, representative source) and for drafting `architecture.md`
sections and seed wiki entries. Sub-agents return bounded summaries; the
main agent owns synthesis, conflict resolution, and the final writes to
artifact files. The main agent is the only writer. See
`wiki::sub-agent-discovery::mental-model`.

## Procedure

1. Read manifests, formatter configs, lint configs, CI workflows,
   deployment descriptors, and representative source files.
2. Seed bounded wiki entries under `.github/idd/wiki/` for the durable
   concepts you discover (architecture patterns, integrations, runtime
   topology decisions). Each wiki entry follows `wiki/_template.md`.
3. Populate `.github/idd/conventions.md` with patterns that are actually
   visible in the repository.
4. Populate `.github/idd/architecture.md` with the runtime and
   deployment reality: where the code runs, how it is built, what it
   integrates with, what topology and data stores it depends on.
5. If evidence is ambiguous, record that ambiguity in `Open Questions`
   or `Evidence` instead of guessing.
6. Any learned rule you derive — from this repository's history or
   imported from another rule set — lands in `learned.md` as
   `Status: proposed`, never `active`. Activation requires repository
   evidence that the paths, layers, and dependencies the rule names
   exist here, plus explicit user approval (contract §7). Rule
   `Scope` must be real glob patterns over this repository's actual
   paths — a semantic label (`interfaces`, `models`) is not a glob.

## Safety

- Do not create one wiki entry per trivial helper.
- Do not execute project code, builds, tests, or deploy commands unless
  the user explicitly asks.
- Treat source code as authoritative. Discovery describes what is
  already there; it does not invent intent.
- Express uncertainty explicitly when repository evidence is incomplete,
  consistent with `code::.github/copilot-instructions.md::§10`.
