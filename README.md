# kcp-skill

Conventions, linter, conformance vectors, and a curated library for **governed KCP skills** —
`kind: skill` units with an `action_scope`, as specified in
[KCP v0.26 §4.3a](https://github.com/Cantara/knowledge-context-protocol).

A governed skill is a repeatable procedure an agent *enacts*, not prose it merely reads.
Its **selection** is gated like knowledge (intent, audience, scope, temporal validity);
its **enaction** is bounded by a declared envelope of tools, paths, and capabilities —
and it **fails closed**: absent an explicit grant, a skill renders pointer-only with
`invocation: explicit`.

```yaml
- id: rotate-signing-key
  path: skills/rotate-signing-key/SKILL.md
  kind: skill
  intent: "How do I rotate the manifest signing key safely?"
  scope: project
  audience: [agent, operator]
  action_scope:
    tools: [kcp-sign, git]
    paths: ["schema/**", ".well-known/kcp-signing-key"]
    capabilities: [key-management]
```

## Why this repo

The spec defines *what* a skill unit is. This repo owns the layer above the spec and
below the producers/consumers:

| Layer | Home |
|---|---|
| `kind: skill` + `action_scope` semantics | [knowledge-context-protocol](https://github.com/Cantara/knowledge-context-protocol) §4.3a |
| **Authoring conventions** (what a *good* skill unit looks like) | **this repo — [PROFILE.md](PROFILE.md)** |
| **Linter** (are your skill units well-formed and fail-closed?) | **this repo — `bin/lint.mjs`** |
| **Conformance vectors** (test your producer/consumer against expected verdicts) | **this repo — `vectors/`** |
| **Curated skill library** (governed playbooks any harness can adopt) | **this repo — `skills/`** |
| Runtime enforcement of `action_scope` | [pi-kcp](https://github.com/Cantara/pi-kcp), [kcp-harness](https://github.com/Cantara/kcp-harness) |
| Selection/planning over skill units | [kcp-agent](https://github.com/Cantara/kcp-agent) |
| Evidence-based generation of skill units | [Synthesis](https://github.com/exoreaction/Synthesis) ([#477](https://github.com/exoreaction/Synthesis/issues/477)) |

The model is [kcp-commands](https://github.com/Cantara/kcp-commands): a repo whose main
asset is a curated, versioned library of manifests — here, of governed skills.

## Quick start

**▶ Try it live — no install:** the [**kcp-skill playground**](https://cantara.github.io/kcp-skill/) runs this exact
linter (`bin/lint.mjs`'s `lintManifest`) in your browser. Edit a manifest, load a conformance vector,
and watch `action_scope` fail closed.

```bash
# Lint the skill units in a manifest
node bin/lint.mjs path/to/knowledge.yaml

# Machine-readable output (CI)
node bin/lint.mjs path/to/knowledge.yaml --json

# Run the conformance vectors (self-test)
node bin/lint.mjs --vectors
```

Exit codes: `0` clean or warnings only · `1` errors · `2` usage/parse failure.

## Rules (v0.1)

| Code | Level | Rule |
|---|---|---|
| SK001 | error | a `kind: skill` unit must have `id`, `path`, and `intent` |
| SK002 | warning | a skill without `action_scope` is ungoverned — declare the envelope |
| SK003 | error | `action_scope.tools` / `paths` / `capabilities` must be arrays of non-empty strings |
| SK004 | error | `action_scope.paths` entries must be relative and must not contain `..` |
| SK005 | warning | unknown `action_scope` sub-field (forward-compat: carried, not enforced) |
| SK006 | warning | `audience` should include `agent` — a skill no agent may select is dead weight |
| SK007 | info | empty/omitted `capabilities` is the fail-closed default — nothing to fix |
| SK008 | warning | `intent` should read as a question or task ("How do I …", "Deploy …") |
| SK009 | info | how many units were **not** checked, by kind — coverage, not a defect |

Non-`skill` kinds are **never** flagged by this linter — `policy`, `schema`, `service`,
`executable` are valid spec kinds and none of the skill rules apply to them (§4.3:
unknown kinds are silently ignored).

They are, however, **counted**. Skipping silently makes "nothing was wrong with it" and
"nothing looked at it" print the same output, so a manifest whose units are all
`kind: knowledge` — including one that should have been `kind: skill` — reports a clean
pass. SK009 says what was left alone:

```
info    SK009  -  644 unit(s) not checked — this profile governs kind: skill only (knowledge (kind unset)=644)
0 error(s), 0 warning(s), 1 info
```

A unit with no `kind` counts as `knowledge`, per §4.3a's default.

## The library

Each skill in `skills/` is a directory with a `SKILL.md` playbook; `skills/library.yaml`
declares them all as spec-conformant units, ready to merge into a project manifest or to
reference from a federated root.

| Skill | Envelope (summary) |
|---|---|
| [rotate-signing-key](skills/rotate-signing-key/SKILL.md) | `kcp-sign`, `git` · key paths only |
| [dependency-bump](skills/dependency-bump/SKILL.md) | `read`, `bash`, `git` · build files + lockfiles |
| [release-and-tag](skills/release-and-tag/SKILL.md) | `read`, `bash`, `git` · version + changelog files |

Contributions of new skills follow [PROFILE.md](PROFILE.md) and must pass the linter.

## License

Apache 2.0 — see [LICENSE](LICENSE).
