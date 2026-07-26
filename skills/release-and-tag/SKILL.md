# Release and tag

Governed skill: cut a release — version bump, changelog, tag — without shipping an
unverified or snapshot artifact.

## Preconditions
- All release-blocking checks green on the release commit.
- Version scheme known (semver assumed below).

## Steps
1. **(read)** Confirm the working tree is the commit CI verified — not that commit
   plus "one tiny fix".
2. **(bash)** Bump the version in the build file. Never tag a SNAPSHOT/dev suffix:
   release artifacts carry release versions.
3. **(edit)** Update the changelog from the actual merged history — measured, not
   remembered.
4. **(git)** Commit, tag (`vX.Y.Z`), push commit and tag together.

## Verification
The tag's CI run is green and the published artifact's version string equals the tag.

## Rollback
If verification fails after tagging: fix forward with a patch release. Do not move or
delete a pushed tag — consumers may already have resolved it.
