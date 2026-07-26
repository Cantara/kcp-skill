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

  for (const unit of doc.units) {
    if (!unit || typeof unit !== "object") continue;
    if (unit.kind !== "skill") continue; // §4.3: non-skill kinds are none of our business

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
    const got = findings.filter((f) => f.level !== "info").map((f) => f.code).sort();
    const expected = JSON.parse(readFileSync(expectedPath, "utf8")).codes.slice().sort();
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    console.log(`${ok ? "ok " : "FAIL"} ${name}  expected [${expected}] got [${got}]`);
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
