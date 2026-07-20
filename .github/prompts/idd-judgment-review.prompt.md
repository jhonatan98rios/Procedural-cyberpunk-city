---
description: Review the current change set against scope-matched active judgment rules and write the fingerprint-bound attestation.
---

# /idd-judgment-review

You are running the IDD judgment review — the mandatory §9 pass that
evaluates the final change set against every matching `active`
`judgment` rule and records the result as an attestation the
deterministic gates verify. Judgment *compilation* (scoped instruction
files) guides generation and is never evidence this review ran; only
this review may report `pass`. See `wiki::judgment-review::summary`.

## Procedure

1. **Fingerprint the change set.** Run
   `bash .github/idd/bin/idd-gate.sh fingerprints` and record `head`,
   `stagedFingerprint`, `worktreeFingerprint`, and `rulesFingerprint`.
   The review covers the union of staged, unstaged, and untracked
   proposed changes — not just `git diff`.
2. **Select the governing rules.** Read the `active` `judgment` rows
   of `.github/idd/learned.md`. Match the changed paths (staged,
   unstaged, and untracked) against each rule's `Scope` globs.
3. **Review.** For each matching rule, re-read the relevant diff and
   changed files against that rule — the rule and the diff, nothing
   else. Assign exactly one result per rule:
   - `pass` — the change set complies; cite the evidence.
   - `fail` — a concrete violation; cite file and finding.
   - `not-applicable` — no changed file matches the rule's scope, or
     the matched changes cannot interact with the constraint.
     `not-applicable` always requires evidence; it is never a default.
4. **Fix.** In implementation mode, fix every `fail` in this session.
   After fixing, rerun `fingerprints` (the change set changed) and
   re-review the **complete** matching rule set against the new state
   — fixes can introduce new violations.
5. **Attest.** Write `.idd-state/judgment-review.json`, replacing any
   existing file whole (the attestation is current evidence, not
   history). `mkdir -p .idd-state` first; the directory is gitignored
   and never committed. Write `"result": "pass"` only when every
   applicable rule is `pass` or evidenced `not-applicable` and no
   unresolved failure remains; any `fail` makes the overall result
   `fail`.

## Attestation schema

```json
{
  "schemaVersion": 1,
  "head": "<git object id>",
  "stagedFingerprint": "<sha256>",
  "worktreeFingerprint": "<sha256>",
  "rulesFingerprint": "<sha256>",
  "reviewedAt": "<ISO-8601 UTC>",
  "reviewer": { "harness": "<harness>", "agent": "<agent>", "sessionId": "<optional>" },
  "result": "pass | fail",
  "rules": [
    {
      "ruleId": "<Rule-Id from learned.md>",
      "scope": "<the rule's Scope>",
      "matchedFiles": ["<changed paths matching the scope>"],
      "result": "pass | fail | not-applicable",
      "evidence": "<one sentence of concrete evidence>"
    }
  ],
  "findings": []
}
```

All fingerprint fields must come from the same `fingerprints` run as
the final review pass — the gates compare them byte-for-byte, and any
mismatch reads as stale.

## Report

End with this summary (counts from the attestation you wrote):

```text
Judgment review
Change-set fingerprint: <worktreeFingerprint>
Rules fingerprint: <rulesFingerprint>
Applicable rules: <n>
Pass: <n>
Fail: <n>
Not applicable: <n>
Attestation: current
```

## Rules

- The attestation proves a review was recorded against the exact
  current state — never claim it proves the review was semantically
  correct.
- Never write a passing attestation for a state you have not
  re-reviewed after the last edit.
- Never edit fingerprints by hand; they come from
  `.github/idd/bin/idd-gate.sh` only.
- If `learned.md` has no `active` `judgment` rules, or no changed file
  matches any scope, report that plainly — the gates are inert in that
  case and no attestation is required.
- If the rule table predates the `Rule-Id` column, run the §7
  migration first; attestations name rules by `Rule-Id`.
