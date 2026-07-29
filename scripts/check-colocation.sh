#!/usr/bin/env bash
# Fail if a skill unit changed under skills/ without skills/library.yaml changing
# in the same diff.
#
# A governed skill's id/intent/action_scope is declared in library.yaml (PROFILE.md)
# — that's the artifact a consumer or the linter actually reads. A SKILL.md edited
# without a matching library.yaml update drifts silently: the procedure changes, the
# declared envelope doesn't, and nothing says so until someone notices by hand. This
# check makes colocation structural instead of a convention nobody enforces — the
# pattern Anthropic's self-service analytics writeup called "modeling change without
# a skill update fails CI" (~90% of their data PRs ship both in one diff).
#
# Usage: ./scripts/check-colocation.sh [base-ref] [head-ref]
#   base-ref defaults to $COLOCATION_BASE, falling back to merge-base with main/origin/main
#   head-ref  defaults to $COLOCATION_HEAD, falling back to HEAD
set -euo pipefail
cd "$(dirname "$0")/.."

filter_skill_changes() {
  grep -E '^skills/' \
    | grep -v '^skills/library\.yaml$' \
    | grep -v '\.synthesis\.md$' \
    || true
}

# Self-test first: prove the filter fires on a known-bad synthetic diff and stays
# quiet on a known-clean one, before trusting either verdict on the real diff (see
# check-nul-bytes.sh precedent — an untested detector that always says "clean" is
# worse than no detector).
self_test() {
  local bad clean
  bad="$(printf 'skills/new-skill/SKILL.md\nREADME.md\n' | filter_skill_changes)"
  clean="$(printf 'skills/library.yaml\nskills/probe/.synthesis.md\nREADME.md\n' | filter_skill_changes)"
  if [ -z "$bad" ] || [ -n "$clean" ]; then
    echo "check-colocation: self-test failed — filter is not detecting correctly" >&2
    exit 2
  fi
}
self_test

BASE_REF="${1:-${COLOCATION_BASE:-}}"
HEAD_REF="${2:-${COLOCATION_HEAD:-HEAD}}"

if [ -z "$BASE_REF" ]; then
  BASE_REF="$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null || true)"
fi

if [ -z "$BASE_REF" ]; then
  echo "check-colocation: no base ref resolvable — skipping (not enough history / not a PR)" >&2
  exit 0
fi

changed="$(git diff --name-only "$BASE_REF" "$HEAD_REF")"
skill_files_changed="$(printf '%s\n' "$changed" | filter_skill_changes)"
library_changed="no"
printf '%s\n' "$changed" | grep -qx 'skills/library.yaml' && library_changed="yes"

if [ -n "$skill_files_changed" ] && [ "$library_changed" = "no" ]; then
  echo "check-colocation: skill file(s) changed without skills/library.yaml:" >&2
  printf '%s\n' "$skill_files_changed" | sed 's/^/  /' >&2
  echo "" >&2
  echo "Update skills/library.yaml (id/intent/action_scope) in the same diff — PROFILE.md." >&2
  exit 1
fi

echo "check-colocation: clean ($BASE_REF..$HEAD_REF)"
