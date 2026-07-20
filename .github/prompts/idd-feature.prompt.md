---
description: Derive a bounded feature spec from a wiki entry, with acceptance criteria and a glossary.
---

# /idd-feature

You are deriving an IDD feature spec from the wiki. This is an
on-demand command.

A wiki entry holds the durable concept. Feature files are instructions
for Copilot on how to implement or modify that concept. A single wiki
entry typically has many feature files over its lifetime — one per
bounded change (initial implementation, later additions, refactors,
deprecations). Feature files are derived from the wiki, never invented
in isolation. See `wiki::wiki-first-workflow::mental-model`.

## Procedure

1. Read `architecture.md`, `conventions.md`, `learned.md`, and the
   relevant wiki entries.
2. If no wiki entry yet covers the concept, work with the user to draft
   one first under `.github/idd/wiki/` before generating any feature
   files.
3. Decompose the requested change into as many bounded feature files
   as the work actually needs. Each file is one bounded change another
   agent can pick up and finish on its own. Create them in
   `.github/idd/features/` from `.github/idd/features/_template.md`.
4. Order the files so an LLM agent can implement them sequentially.
   Use a numeric prefix (`NN-slug.md`) that reflects execution order,
   and state dependencies on earlier files explicitly inside each
   spec. Later files may assume earlier files are done; they must not
   assume later files exist.
5. Anchor every feature file back at the originating wiki section via
   the anchor grammar in `code::.github/copilot-instructions.md::§8`.
6. In each file, state what that feature does, what is in scope, and
   what is out of scope. Keep scope tight enough that the file is one
   coherent unit of work.
7. Keep acceptance criteria atomic and verifiable. Each criterion gets
   a runnable `Verify:` command, per Red / Green TDD
   (`wiki::red-green-tdd::mental-model`).
8. For brownfield work, include discovery notes or constraints when
   the repo already implies limits or dependencies.
9. Populate each `## Glossary` table with the stable anchors the next
   agent will need.

## Safety

- One feature file is one bounded change to a concept, not the whole
  concept and not one file per helper. Multiple feature files per wiki
  entry are expected and normal.
- Foundational constraints in `architecture.md` and `conventions.md`
  outrank the spec being authored. If the spec would contradict them,
  fix the spec, do not weaken the foundation.
- Express uncertainty when intent is incomplete instead of inventing
  detail, consistent with `code::.github/copilot-instructions.md::§10`.
