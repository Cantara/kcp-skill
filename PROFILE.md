# The governed-skill authoring profile (v0.1)

Conventions for writing `kind: skill` units that are useful to agents and defensible to
auditors. The spec (§4.3a) defines the fields; this profile defines the craft. Rules the
linter enforces carry their code.

## 1. One skill, one procedure

A skill is a *repeatable sequence of steps with a completion state* — "rotate the signing
key", "bump a dependency with verification". If you can't say when it's done, it's
knowledge (`kind: knowledge`); if it's a standing constraint, it's `kind: policy`.

## 2. Identity (SK001)

- `id`: kebab-case verb phrase — `rotate-signing-key`, not `signing` or `RotateKey`.
- `path`: points at the playbook (`skills/<id>/SKILL.md` in this library).
- `intent`: the question or task the skill answers, one sentence (SK008). This is the
  selection signal — write it the way a user would ask.

## 3. The envelope is the contract (SK002–SK004)

`action_scope` is what a trusted renderer or conformance checker uses to bound enaction.
Author it like a firewall rule, not a description:

- **Start from nothing.** Empty is the fail-closed default (SK007). Add each tool/path
  because a step needs it, not because it might be handy.
- **`tools`** — the named tools the steps actually invoke. If a step says "edit the
  changelog", `edit` (or your harness's equivalent) belongs here; `bash` alone is not a
  scope, it's an escape hatch — prefer naming the narrower tool when the harness has one.
- **`paths`** — globs for what the procedure may touch, relative to the manifest root
  (SK004). Include the files the playbook *writes*; reads of broadly-shared docs usually
  don't need scoping. Never `**` at the root — that's an unscoped skill wearing a scope.
- **`capabilities`** — named privileges the procedure exercises (`key-management`,
  `deploy`, `spend`). These are the hooks approval workflows and wallets key off.

A useful authoring test: *could a reviewer reject a diff for touching a file outside
`paths`?* If the scope is too broad to make that call, tighten it.

## 4. Audience and scope (SK006)

`audience` must include `agent` for the skill to be selectable by one; add `operator`
when a human runs the same playbook. `scope: project` unless the skill is genuinely
org-wide.

## 5. The playbook (`SKILL.md`)

Structure that has worked:

1. **Preconditions** — what must be true before step 1 (and how to check).
2. **Steps** — numbered, each naming the tool it uses (the linter doesn't check
   step-vs-scope consistency yet; reviewers should — a step invoking a tool absent from
   `action_scope` is the #1 authoring bug).
3. **Verification** — how the agent proves completion (a command, a diff shape, a green
   check). A skill without a verification step is a hope, not a procedure.
4. **Rollback** — what to do when verification fails. May be "stop and page a human" —
   that is a valid, fail-closed rollback.

## 6. Freshness

Skills rot like any knowledge. Use `validated:` dates and re-validate when the underlying
tools change. A skill whose playbook references a flag that no longer exists is worse
than no skill — the agent enacts confidently. (This repo's CI lints the library on every
push; that catches shape, not truth. Truth needs periodic human re-validation, or a
producer that verifies declarations against evidence.)

## 7. Portability

Write tool names against the harness-neutral vocabulary where possible (`read`, `bash`,
`edit`, `git`) and put harness-specific bindings in the playbook body, not the envelope.
The same unit should govern a Pi session (pi-kcp), an MCP-proxied session (kcp-harness),
or any future consumer without editing the manifest.
