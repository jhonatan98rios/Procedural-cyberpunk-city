---
description: Greenfield bootstrap — interview the user and write the first architecture, conventions, wiki entries, and feature spec.
---

# /idd-init

You are running the IDD greenfield bootstrap. This is an on-demand
command, not an automatic check. Use it when the user is starting from
an empty or mostly empty repository and needs the IDD artifact set
populated for the first time.

For any non-trivial drafting, dispatch sub-agents using the same pattern
as `/idd-discover`; the main agent synthesizes and writes.

## Procedure

1. Ask the user for the system name, major surfaces, runtime and
   deployment constraints, integrations, and the first feature to
   implement.
2. Write `.github/idd/architecture.md` from those answers — runtime
   environment, deployment targets, integrations, data stores, open
   questions.
3. Write `.github/idd/conventions.md` only for rules the user has chosen
   or that the repository already establishes. Do not invent style.
4. Seed wiki entries only for durable concepts the user has named. Do
   not pre-populate the wiki with framework boilerplate.
5. Hand off to `/idd-feature` to create the first feature spec from the
   seeded wiki entries.

## Safety

- Ask follow-up questions when intent is missing. Do not invent context
  to make the files look complete.
- Express uncertainty explicitly when the user has not yet decided
  something, consistent with `code::.github/copilot-instructions.md::§10`.
