# Rotate the manifest signing key

Governed skill: replace the Ed25519 key that signs `knowledge.yaml`, without a window
where consumers see an unverifiable manifest.

## Preconditions
- `kcp-sign` (or `synthesis kcp sign`) available and currently able to verify the manifest
  with the *old* key: signature status is `verified`, trust tier `TRUSTED`/`KNOWN`.
- Write access to the key location (`.well-known/kcp-signing-key`) and the manifest.

## Steps
1. **(kcp-sign)** Generate the new keypair; do not delete the old one yet.
2. **(kcp-sign)** Re-sign the manifest with the new key — updates the in-manifest
   `signing:` block and the detached `.sig` envelope.
3. **(git)** Commit manifest + `.sig` + public-key file in one commit; the diff must
   touch only paths in this skill's `action_scope.paths`.
4. **(kcp-sign)** Verify with the *new* key id.

## Verification
`kcp-agent plan "<any task>" --manifest knowledge.yaml --require-signature` succeeds
("ed25519 signature verified"), and a deliberately tampered copy is rejected with exit 1.

## Rollback
Restore the previous manifest + `.sig` from git (`git checkout HEAD~1 -- <paths>`); the
old key still verifies them. If neither key verifies, stop — page a human. Do not ship
an unsigned manifest to recover: fail closed.
