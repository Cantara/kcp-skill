# Bump a dependency with verification

Governed skill: update one dependency pin and prove the project still holds, before merge.

## Preconditions
- Clean working tree on a feature branch.
- The project's full verification command is known (test suite, or a conformance
  gauntlet for pinned external tools).

## Steps
1. **(read)** Read the current pin and the upstream changelog/release notes for the
   target version. Note anything the release calls breaking.
2. **(bash)** Update the pin in the build/lock file only — no drive-by edits.
3. **(bash)** Run the full verification suite. A pinned-tool bump (e.g. a CI-pinned
   CLI) gets its full gauntlet, not a smoke subset.
4. **(bash)** If verification fails: decide regression-vs-drift *with evidence* —
   bisect intermediate versions when cheap. An upstream regression becomes a bug
   report with a repro; do not absorb it silently with a workaround unless the
   workaround is scoped, commented, and linked to the report.
5. **(git)** Commit with the measured evidence in the message (what ran, what passed).

## Verification
The full suite/gauntlet is green on the exact commit being merged, and the commit
message says so with numbers, not adjectives.

## Rollback
Revert the pin commit. The previous pin is by definition the last verified state.
