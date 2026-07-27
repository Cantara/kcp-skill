#!/usr/bin/env node
/**
 * Vocabulary guard — "playbook" names a protocol kind, not a section of a skill.
 *
 * KCP v0.29 (RFC-0027) added `kind: playbook`: a manifest-level composition of units,
 * governed per step. This repo previously used the same word for the prose body of a
 * single skill (`SKILL.md`), which is not merely a different meaning but an actively
 * misleading one — RFC-0027 exists *because* prose steps inside one artifact drift from
 * the units they describe. A reader of both documents would reasonably conclude the two
 * are the same concept.
 *
 * This guard exists because the one-time cleanup decays otherwise. "Playbook" is the
 * natural English word for what a SKILL.md contains, so a future contributor will reach
 * for it innocently. The check is cheap and the failure message explains the distinction
 * rather than just refusing.
 *
 * Permission is scoped to the **paragraph**, not the line. A first attempt matched per
 * line and immediately flagged the passage in PROFILE.md §5 that explains this very
 * distinction: prose that establishes "kind: playbook (§4.3b, RFC-0027)" in one sentence
 * goes on to say "its steps", "such units", "a playbook" in the next three, and none of
 * those lines carry a marker of their own. A guard that cannot tell the difference between
 * misusing a term and *defining* it would make the correct document unwritable — so
 * context established anywhere in a paragraph licenses the bare word throughout it.
 *
 * Usage: node bin/check-vocabulary.mjs [file ...]   (defaults to the docs it governs)
 */

import { readFileSync } from "node:fs";

const DEFAULT_FILES = ["PROFILE.md", "README.md"];

// A line may say "playbook" when it is unambiguously naming the protocol kind.
const PERMITTED = [
  /kind:\s*`?playbook/i,        // kind: playbook
  /`playbook`/,                 // backticked — the kind, not the prose
  /§\s*4\.3b/,                  // citing the section that defines it
  /RFC-0027/,                   // citing the RFC that introduced it
  /kcp-playbook/,               // a repo name, should one ever exist
];

const EXPLANATION = `
  "playbook" names a KCP protocol kind (§4.3b, RFC-0027): an ordered composition of
  units, governed per step. It is not a section of a skill.

  For the prose body of a SKILL.md, say "the procedure body", "the SKILL.md body", or
  just "SKILL.md". The distinction matters because RFC-0027 exists precisely because
  prose steps inside one artifact drift from the units they describe — so calling a
  skill's body a playbook names it after the thing it is not.

  If you genuinely mean the protocol kind, write it so a reader can tell: backtick it
  (\`playbook\`), write "kind: playbook", or cite §4.3b / RFC-0027 on the same line.
`;

/** Split into paragraphs (blank-line separated), keeping 1-based line numbers. */
function paragraphs(lines) {
  const out = [];
  let current = null;
  lines.forEach((line, i) => {
    if (line.trim() === "") { current = null; return; }
    if (!current) { current = { start: i + 1, lines: [] }; out.push(current); }
    current.lines.push({ n: i + 1, text: line });
  });
  return out;
}

function scan(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];  // a file that does not exist is not a violation
  }

  // Fenced blocks are examples and manifests — `kind: playbook` belongs there verbatim.
  let inFence = false;
  const lines = text.split("\n").map((line) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return ""; }
    return inFence ? "" : line;
  });

  const offences = [];
  for (const para of paragraphs(lines)) {
    const body = para.lines.map((l) => l.text).join("\n");
    // Context established anywhere in the paragraph licenses the bare word throughout it.
    if (PERMITTED.some((re) => re.test(body))) continue;
    for (const l of para.lines) {
      if (/playbook/i.test(l.text)) {
        offences.push({ file, line: l.n, text: l.text.trim() });
      }
    }
  }
  return offences;
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;
const offences = files.flatMap(scan);

if (offences.length === 0) {
  console.log(`vocabulary: ok — no ambiguous use of "playbook" in ${files.join(", ")}`);
  process.exit(0);
}

console.error(`vocabulary: ${offences.length} ambiguous use(s) of "playbook"\n`);
for (const o of offences) {
  console.error(`  ${o.file}:${o.line}  ${o.text.slice(0, 100)}`);
}
console.error(EXPLANATION);
process.exit(1);
