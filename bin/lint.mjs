#!/usr/bin/env node
// kcp-skill linter — validates `kind: skill` units in a knowledge.yaml against
// the v0.1 profile (see PROFILE.md for rules SK001–SK008). Deterministic,
// fail-closed: errors exit 1, parse/usage failures exit 2, warnings exit 0.
//
//   node bin/lint.mjs <manifest.yaml> [--json]
//   node bin/lint.mjs --vectors            # run conformance vectors (self-test)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const KNOWN_SCOPE_FIELDS = new Set(["tools", "paths", "capabilities"]);

export function lintManifest(doc) {
  const findings = [];
  const add = (level, code, unitId, message) =>
    findings.push({ level, code, unit: unitId ?? null, message });

  if (!doc || typeof doc !== "object" || !Array.isArray(doc.units)) {
    return { findings: [{ level: "error", code: "PARSE", unit: null, message: "manifest has no top-level units list" }] };
  }

  // Which units this profile declined to check, and under which kind. Reported (SK009)
  // rather than dropped: a silent skip makes "nothing was wrong with it" and "nothing
  // looked at it" produce identical output, so a knowledge unit that should have been
  // `kind: skill` reads as clean. Counted per kind and reported once — per-unit would
  // bury the real findings under hundreds of lines on a library-sized manifest.
  const skipped = new Map();

  for (const unit of doc.units) {
    if (!unit || typeof unit !== "object") continue;
    if (unit.kind !== "skill") {
      // §4.3: non-skill kinds are none of our business to *validate* — but whose they
      // are is still worth saying out loud. An absent kind is `knowledge` per §4.3a.
      const kind = typeof unit.kind === "string" && unit.kind.trim()
        ? unit.kind.trim()
        : "knowledge (kind unset)";
      skipped.set(kind, (skipped.get(kind) ?? 0) + 1);
      continue;
    }

    const id = typeof unit.id === "string" && unit.id ? unit.id : "(missing id)";

    for (const field of ["id", "path", "intent"]) {
      if (typeof unit[field] !== "string" || !unit[field].trim()) {
        add("error", "SK001", id, `skill unit must declare '${field}'`);
      }
    }

    const scope = unit.action_scope;
    if (scope === undefined || scope === null) {
      add("warning", "SK002", id, "no action_scope — this skill is ungoverned; declare its envelope");
    } else if (typeof scope !== "object" || Array.isArray(scope)) {
      add("error", "SK003", id, "action_scope must be a mapping");
    } else {
      for (const [key, value] of Object.entries(scope)) {
        if (!KNOWN_SCOPE_FIELDS.has(key)) {
          add("warning", "SK005", id, `unknown action_scope field '${key}' (carried, not enforced)`);
          continue;
        }
        if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) {
          add("error", "SK003", id, `action_scope.${key} must be an array of non-empty strings`);
          continue;
        }
        if (key === "paths") {
          for (const p of value) {
            if (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) || p.split(/[\\/]/).includes("..")) {
              add("error", "SK004", id, `action_scope.paths entry '${p}' must be relative and must not contain '..'`);
            }
          }
        }
      }
      if (!("capabilities" in scope) || (Array.isArray(scope.capabilities) && scope.capabilities.length === 0)) {
        add("info", "SK007", id, "capabilities empty/omitted — fail-closed default");
      }
    }

    const audience = unit.audience;
    if (!Array.isArray(audience) || !audience.includes("agent")) {
      add("warning", "SK006", id, "audience should include 'agent'");
    }

    if (typeof unit.intent === "string" && unit.intent.trim()) {
      const intent = unit.intent.trim();
      const taskLike = intent.endsWith("?") || /^(how|what|when|where|why|deploy|rotate|bump|release|run|create|update|verify|migrate|publish|sign|fix)\b/i.test(intent);
      if (!taskLike) add("warning", "SK008", id, "intent should read as a question or task description");
    }
  }

  if (skipped.size > 0) {
    const total = [...skipped.values()].reduce((a, b) => a + b, 0);
    const breakdown = [...skipped.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([kind, n]) => `${kind}=${n}`)
      .join(", ");
    add("info", "SK009", null,
      `${total} unit(s) not checked — this profile governs kind: skill only (${breakdown})`);
  }

  return { findings };
}

function summarize(findings) {
  const count = (lvl) => findings.filter((f) => f.level === lvl).length;
  return { errors: count("error"), warnings: count("warning"), infos: count("info") };
}

function runFile(path, asJson) {
  let doc;
  try {
    doc = yaml.load(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`parse failure: ${e.message}`);
    process.exit(2);
  }
  const { findings } = lintManifest(doc);
  const s = summarize(findings);
  if (asJson) {
    console.log(JSON.stringify({ manifest: path, ...s, findings }, null, 2));
  } else {
    for (const f of findings) console.log(`${f.level.padEnd(7)} ${f.code}  ${f.unit ?? "-"}  ${f.message}`);
    console.log(`${s.errors} error(s), ${s.warnings} warning(s), ${s.infos} info`);
  }
  process.exit(s.errors > 0 ? 1 : 0);
}

function runVectors() {
  const vectorsDir = resolve(HERE, "..", "vectors");
  let failed = 0;
  for (const name of readdirSync(vectorsDir).sort()) {
    const dir = join(vectorsDir, name);
    const manifestPath = join(dir, "manifest.yaml");
    const expectedPath = join(dir, "expected.json");
    if (!existsSync(manifestPath) || !existsSync(expectedPath)) continue;
    const doc = yaml.load(readFileSync(manifestPath, "utf8"));
    const { findings } = lintManifest(doc);
    const exp = JSON.parse(readFileSync(expectedPath, "utf8"));
    const got = findings.filter((f) => f.level !== "info").map((f) => f.code).sort();
    const expected = exp.codes.slice().sort();
    let ok = JSON.stringify(got) === JSON.stringify(expected);
    let detail = `expected [${expected}] got [${got}]`;

    // Infos were dropped before comparison, so a vector could not assert one even if the
    // behaviour mattered — the same "unreported is indistinguishable from absent" shape
    // SK009 exists to fix. Asserted only when a vector declares `infos`, so vectors that
    // do not care are unaffected.
    if (exp.infos) {
      const gotInfos = findings.filter((f) => f.level === "info").map((f) => f.code).sort();
      const expInfos = exp.infos.slice().sort();
      ok = ok && JSON.stringify(gotInfos) === JSON.stringify(expInfos);
      detail += `  infos expected [${expInfos}] got [${gotInfos}]`;
    }
    console.log(`${ok ? "ok " : "FAIL"} ${name}  ${detail}`);
    if (!ok) failed++;
  }
  process.exit(failed > 0 ? 1 : 0);
}

const args = process.argv.slice(2);
if (args[0] === "--vectors") runVectors();
else if (args.length >= 1 && !args[0].startsWith("--")) runFile(args[0], args.includes("--json"));
else {
  console.error("usage: lint.mjs <manifest.yaml> [--json] | lint.mjs --vectors");
  process.exit(2);
}
