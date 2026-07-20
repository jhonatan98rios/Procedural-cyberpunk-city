#!/bin/bash
# IDD deterministic fingerprint and gate helper.
#
# Usage:
#   idd-gate.sh fingerprints      Print change-set and rule fingerprints
#                                 as JSON: {head, stagedFingerprint,
#                                 worktreeFingerprint, rulesFingerprint}.
#   idd-gate.sh gate staged       Exit 0 (allow) or exit 1 with an
#   idd-gate.sh gate worktree     actionable message (block) based on
#                                 the judgment attestation.
#
# The single shared implementation used by /idd-judgment-review and by
# the harness hooks (commit gate validates the staged fingerprint; the
# completion gate validates the worktree fingerprint). Deterministic:
# git + hashing + jq only — this script never invokes an LLM; it
# verifies evidence that an LLM review was recorded against the exact
# current state.
#
# Degrades silently (exit 0) outside a git repository or when git, jq,
# or a sha256 tool is missing — adopting IDD never breaks a repo.

set -u

LEARNED=".github/idd/learned.md"
ATTEST=".idd-state/judgment-review.json"
STATE_DIR=".idd-state"

sha() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum | awk '{print $1}'
	else
		shasum -a 256 | awk '{print $1}'
	fi
}

have_tools() {
	command -v git >/dev/null 2>&1 || return 1
	command -v jq >/dev/null 2>&1 || return 1
	command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || return 1
	git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1
}

head_id() {
	git rev-parse HEAD 2>/dev/null || echo none
}

# Exact commit candidate: HEAD plus the index tree. write-tree fails on
# unmerged paths; fall back to the sorted staged name-status listing.
staged_fp() {
	{
		head_id
		git write-tree 2>/dev/null || git diff --cached --name-status | LC_ALL=C sort
	} | sha
}

# Full proposed state: HEAD plus sorted status records (staged,
# unstaged, untracked; deletions marked explicitly; renames appear as
# their delete+add record pair) plus the sha256 of current bytes for
# every path that exists. Session-local state is always excluded so
# writing the attestation never invalidates itself.
worktree_fp() {
	{
		head_id
		git status --porcelain -uall --no-renames 2>/dev/null | LC_ALL=C sort | while IFS= read -r line; do
			path="${line:3}"
			case "$path" in "$STATE_DIR"/*|"\"$STATE_DIR"*) continue ;; esac
			printf '%s\t' "$line"
			if [ -f "$path" ]; then
				sha < "$path"
			else
				echo deleted
			fi
		done
	} | sha
}

# Normalized active judgment rows of learned.md — the source of truth,
# never the compiled instruction files. Columns (8-col schema):
# 2 Rule-Id | 3 Rule Type | 4 Scope | 5 Constraint | 6 Rationale |
# 7 Enforcement | 8 Check-Id | 9 Status.
rules_rows() {
	[ -f "$LEARNED" ] || return 0
	awk -F'|' '
		/^\|/ {
			n = split($0, c, "|")
			if (n < 10) next
			for (i = 1; i <= n; i++) {
				gsub(/[ \t]+/, " ", c[i])
				gsub(/^ +| +$/, "", c[i])
			}
			if (c[7] == "judgment" && c[9] == "active")
				print c[2] "|" c[4] "|" c[5] "|" c[6] "|" c[9]
		}
	' "$LEARNED"
}

rules_fp() {
	rules_rows | LC_ALL=C sort | sha
}

judgment_scopes() {
	rules_rows | awk -F'|' '{print $2}' | tr ',' '\n' \
		| sed 's/`//g; s/^ *//; s/ *$//' | awk 'NF' | LC_ALL=C sort -u
}

changed_paths() {
	if [ "$1" = staged ]; then
		git diff --cached --name-only 2>/dev/null
	else
		{
			git diff --cached --name-only
			git diff --name-only
			git ls-files --others --exclude-standard
		} 2>/dev/null
	fi | grep -v "^$STATE_DIR/" | LC_ALL=C sort -u
}

# Scope matching uses git's own :(glob) pathspec semantics so the gate
# and the compiler agree on what a glob means; `*` is repo-wide.
matched_paths() {
	local mode="$1" g
	while IFS= read -r g; do
		[ -n "$g" ] || continue
		if [ "$g" = "*" ]; then
			changed_paths "$mode"
			continue
		fi
		if [ "$mode" = staged ]; then
			git diff --cached --name-only -- ":(glob)$g" 2>/dev/null
		else
			{
				git diff --cached --name-only -- ":(glob)$g"
				git diff --name-only -- ":(glob)$g"
				git ls-files --others --exclude-standard -- ":(glob)$g"
			} 2>/dev/null
		fi
	done < <(judgment_scopes) | grep -v "^$STATE_DIR/" | LC_ALL=C sort -u
}

fingerprints() {
	printf '{"head":"%s","stagedFingerprint":"%s","worktreeFingerprint":"%s","rulesFingerprint":"%s"}\n' \
		"$(head_id)" "$(staged_fp)" "$(worktree_fp)" "$(rules_fp)"
}

gate() {
	local mode="$1" word matched result att_cs att_rules cur_cs cur_rules
	case "$mode" in
		staged) word="committing" ;;
		worktree) word="completing the task" ;;
		*) echo "usage: idd-gate.sh gate staged|worktree" >&2; exit 2 ;;
	esac
	matched=$(matched_paths "$mode" | head -1)
	[ -n "$matched" ] || exit 0
	if [ ! -f "$ATTEST" ]; then
		echo "IDD judgment review is missing: changed files match active judgment rules. Run /idd-judgment-review before $word." >&2
		exit 1
	fi
	result=$(jq -r '.result // empty' "$ATTEST" 2>/dev/null)
	if [ "$result" != "pass" ]; then
		echo "IDD judgment review did not pass (result: ${result:-unreadable}). Fix the findings and rerun /idd-judgment-review before $word." >&2
		exit 1
	fi
	cur_rules=$(rules_fp)
	att_rules=$(jq -r '.rulesFingerprint // empty' "$ATTEST" 2>/dev/null)
	if [ "$mode" = staged ]; then
		cur_cs=$(staged_fp)
		att_cs=$(jq -r '.stagedFingerprint // empty' "$ATTEST" 2>/dev/null)
	else
		cur_cs=$(worktree_fp)
		att_cs=$(jq -r '.worktreeFingerprint // empty' "$ATTEST" 2>/dev/null)
	fi
	if [ "$att_cs" != "$cur_cs" ] || [ "$att_rules" != "$cur_rules" ]; then
		echo "IDD judgment review is stale: the $mode state or the judgment rules changed after review. Run /idd-judgment-review before $word." >&2
		exit 1
	fi
	exit 0
}

have_tools || exit 0

case "${1:-}" in
	fingerprints) fingerprints ;;
	gate) gate "${2:-}" ;;
	*)
		echo "usage: idd-gate.sh fingerprints | gate staged|worktree" >&2
		exit 2
		;;
esac
