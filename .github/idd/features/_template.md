# Feature: [name]

> **Status**: `draft` | `in-progress` | `partial` | `complete`

This file is the primary execution and maintenance contract for the feature.

## What

[one-sentence feature summary]

## Acceptance Criteria

Each criterion must reference a verification command that fails before
the change (Red) and passes after (Green). An acceptance criterion may
only be marked `[x]` once its referenced verification passes.

- [ ] [criterion]
      Verify: `[command]`
- [ ] [criterion]
      Verify: `[command]`
- [ ] [criterion]
      Verify: `[command]`

## TDD

Execute each acceptance criterion as a Red → Green → Anchor loop, per
`wiki::red-green-tdd::mental-model`:

1. Red: run the criterion's `Verify` command and confirm it fails.
2. Green: make the minimal change and re-run `Verify` until it passes.
3. Anchor: update the Glossary so the change is reachable from the spec.

For docs and contract changes, `grep`/`awk`/`test` style commands are
valid verifications under `conventions.md` ad-hoc verification policy.

## Details

### Constraints

- [constraint]

### Out of Scope

- [out-of-scope item]

---

## Dependencies

### Feature Dependencies

- [dependency]

### External Dependencies

- [dependency]

---

## Technical Considerations

### Performance

- [performance requirement]

### Security

- [security requirement]

### Backward Compatibility

- [compatibility requirement]

---

## API Contract (if applicable)

```text
[contract notes]
```

---

## Glossary

Use glossary anchors to reconnect later maintenance work to the source code that implements this feature.
Anchor forms (see `code::.github/copilot-instructions.md::§8`):

- `code::<path>::<symbol>` for source symbols and Markdown sections.
- `feature::<feature-id>::ac-N` for cross-feature acceptance criteria.
- `wiki::<topic>::<section>` for wiki sections.

| Location | Type | Description |
|----------|------|-------------|
| `code::<path>::<symbol>` | source | example anchor row |
