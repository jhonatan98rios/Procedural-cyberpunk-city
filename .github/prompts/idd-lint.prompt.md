---
description: Sweep the IDD wiki and feature specs for drift, duplication, orphans, and broken anchors.
---

# /idd-lint

You are running the IDD lint and consolidation pass. This is an
on-demand command, not an automatic check. It complements the per-task
Write-Back Protocol (see `wiki::write-back-protocol::mental-model`) by
performing a repo-wide reconciliation.

## Scope

Sweep these artifacts:

- `.github/copilot-instructions.md`
- `.github/idd/architecture.md`
- `.github/idd/conventions.md`
- `.github/idd/learned.md`
- `.github/idd/wiki/*.md`
- `.github/idd/features/*.md`

## Checks

For each, produce findings, not file mutations:

1. **Anchor resolution.** Walk every `code::`, `feature::`, and `wiki::`
   anchor and confirm the target exists. Treat source code as the fixed
   point per `wiki::anchor-grammar::mental-model`.
2. **Inbound-edge view.** Materialize "who points at this" for each
   wiki entry and each feature spec. Do not persist this view.
3. **Duplicate or overlapping concepts.** Flag wiki entries that have
   drifted into covering the same concept; propose a merge.
4. **Orphans.** Surface wiki entries no feature spec references, and
   feature specs no wiki entry produced. Ask the user whether to keep,
   merge, or retire each.
5. **Stale claims.** Flag wiki prose whose anchored code has moved or
   changed shape since the entry was last touched.
6. **`learned.md` Notes drain.** Walk Notes left by write-back. For each,
   either resolve in place or convert it into an Open Question on the
   relevant wiki entry.
7. **Enforcement sync.** Compare the `learned.md` Rules table against
   its compiled artifacts, in both directions:
   - Every rule has a `Rule-Id`: present, unique, lowercase
     kebab-case. Flag missing, duplicate, or malformed IDs, and
     compiled instruction files whose listed `Rule-Id` values no
     longer resolve.
   - Every `Scope` is a valid glob (`*` or glob patterns); a semantic
     label (`interfaces`, `callbacks`, `models`) is not a glob — flag
     it. Flag `active` rules whose scopes or constraints reference
     paths, layers, or dependencies this repository does not contain
     (unreconciled foreign rules).
   - No authoritative artifact is gitignored or untracked: run
     `git check-ignore` over `.github/copilot-instructions.md`,
     `.github/idd/`, `.github/prompts/`, `.github/hooks/idd.json`,
     `sgconfig.yml`, and `.claude/settings.json`, and flag any hit.
     Conversely, flag a committed `.idd-state/` — attestations are
     session-local and must never be committed.
   - Every `mechanical` rule with a check-id maps to a live check —
     either a `.github/idd/checks/<check-id>.yml` file or, for
     `linter:<rule-code>` entries, the code selected in the repo's
     linter config. Flag rules whose check is missing and checks whose
     rule is gone.
   - Every check's `files:` globs agree with its rule's `Scope`: a
     rule scoped narrower than repo-wide (`*`) must have matching
     globs in the check's `files:` field, and a repo-wide rule's check
     must omit `files:`. Flag mismatches — an unscoped check for a
     scoped rule over-enforces outside its scope.
   - Every check has a live fixture, and every fixture a check:
     `.github/idd/checks/<id>.yml` pairs with
     `.github/idd/check-tests/<id>-test.yml` in both directions
     (`_template` files exempt; `linter:` check-ids need no fixture).
     Then run
     `ast-grep test -t .github/idd/check-tests --skip-snapshot-tests`
     — a non-zero exit means a dead or drifted check; report each
     failure as a finding. The harness silently ignores unpaired
     fixtures and skips `severity: off` rules, so the file pairing
     above must be asserted, not assumed.
   - Every compiled instruction file (marked `idd:compiled`) still
     matches the `active` `judgment` rules and `Scope` globs it was
     generated from. Flag drift and propose recompilation as a repair.
   These are deterministic comparisons — file reads and glob matching,
   no model judgment needed to detect drift, only to propose repairs.
8. **Lifecycle proposals.** Propose promotions of `mechanical` rules to
   `enforced` where the check is committed and the gates are wired
   (promotion drops the rule from compiled prose — the pruning
   mechanism), and flag rules the code no longer exercises as
   `deprecated` candidates.

## Output

Write a single structured report into the chat with these sections:

- Broken anchors
- Inbound-edge view (per artifact)
- Duplicate or overlapping concepts
- Orphans
- Stale claims
- `learned.md` Notes status
- Enforcement sync (rule ↔ check-id ↔ compiled artifact, both
  directions, plus promotion and deprecation proposals)

## Safety

- Treat source code as authoritative. Never edit source code to make
  docs pass. If code is wrong, that is a new feature task.
- Mutate files only after explicit user approval for each proposed
  change, consistent with `code::.github/copilot-instructions.md::§10`.
- Do not introduce persistent `Backlinks` tables; the inbound-edge view
  is materialized for this report only and discarded.
