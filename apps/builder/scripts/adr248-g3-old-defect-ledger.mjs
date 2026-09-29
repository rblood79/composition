#!/usr/bin/env node
/**
 * ADR-248 Phase 3 G3 — per-node ledger for the old/new geometry leg (decision material, not a
 * verdict). For every FAIL type whose old/new geometry leg fails, each >1px pair and each
 * unpaired node is joined with the same new node's isolated RAC DOM box (harness
 * `canvasDom.geometryArbiter`) and with the old/new engine input differences on the node and
 * its ancestors. `class`: `candidate` only when new = DOM (≤1px) AND old ≠ DOM (>1px);
 * `noDomPair` when the isolated DOM renders no box for that new node (a substitute DOM box must be
 * named and compared case by case); `newSide` otherwise. The ledger does not change any verdict.
 *
 * Input:  docs/adr/design/248-phase3-palette-base-canvas.json (G3 harness output)
 * Output: docs/adr/design/248-phase3-g3-old-defect-ledger.json
 * `--scenario state`: 248-phase3-state-origin-canvas.json → 248-phase3-g3-state-old-defect-ledger.json
 * `--scenario child`: 248-phase3-system-child-canvas.json → 248-phase3-g3-child-old-defect-ledger.json
 *   (parent-relative rects; the harness arbiter DOM box is made parent-relative the same way)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const flag = process.argv.indexOf("--scenario");
const scenario = flag < 0 ? "base" : process.argv[flag + 1];
const files = {
  base: ["248-phase3-palette-base-canvas.json", "248-phase3-g3-old-defect-ledger.json"],
  state: ["248-phase3-state-origin-canvas.json", "248-phase3-g3-state-old-defect-ledger.json"],
  child: ["248-phase3-system-child-canvas.json", "248-phase3-g3-child-old-defect-ledger.json"],
}[scenario];
if (!files) throw new Error(`Unknown --scenario ${scenario}`);
const source = `docs/adr/design/${files[0]}`;
const input = resolve(root, source);
const output = resolve(root, `docs/adr/design/${files[1]}`);
const harness = JSON.parse(readFileSync(input, "utf8"));

const ONE_PX = 1;
const delta = (a, b) =>
  a && b
    ? Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      )
    : null;
const round = (value) => (value === null ? null : Math.round(value * 1000) / 1000);
/** Old path `A/B/C` → its own and ancestor paths (`A/B/C`, `A/B`, `A`, root ""). */
const ancestry = (path) => {
  const parts = path ? path.split("/") : [];
  return parts.map((_, i) => parts.slice(0, parts.length - i).join("/")).concat("");
};

const types = [];
for (const row of harness.types) {
  if (row.verdict !== "FAIL" || !row.failedLegs.includes("geometry")) continue;
  const arbiter = new Map(
    (row.canvasDom.geometryArbiter ?? []).map((entry) => [entry.new, entry.dom]),
  );
  const diffsByPath = new Map();
  for (const diff of row.inputDiffs ?? []) {
    const list = diffsByPath.get(diff.old) ?? [];
    list.push({ key: diff.key, old: diff.oldValue, new: diff.newValue });
    diffsByPath.set(diff.old, list);
  }
  const nodes = row.geometry.overOnePx.map((pair) => {
    const dom = arbiter.get(pair.new) ?? null;
    const newDom = delta(pair.newRect, dom);
    const oldDom = delta(pair.oldRect, dom);
    const inputDiffs = ancestry(pair.old).flatMap((path) =>
      (diffsByPath.get(path) ?? []).map((diff) => ({ path, ...diff })),
    );
    return {
      old: pair.old,
      new: pair.new,
      oldRect: pair.oldRect,
      newRect: pair.newRect,
      domRect: dom,
      oldNew: round(delta(pair.oldRect, pair.newRect)),
      newDom: round(newDom),
      oldDom: round(oldDom),
      class:
        dom === null
          ? "noDomPair"
          : newDom <= ONE_PX && oldDom > ONE_PX
            ? "candidate"
            : "newSide",
      inputDiffs,
    };
  });
  const unpaired = (row.geometry.unpaired ?? []).map((id) => ({ id }));
  const count = (kind) => nodes.filter((node) => node.class === kind).length;
  types.push({
    ...(row.id ? { id: row.id, state: row.state } : {}),
    type: row.type,
    failedLegs: row.failedLegs,
    pairs: nodes.length,
    candidates: count("candidate"),
    noDomPair: count("noDomPair"),
    newSide: count("newSide"),
    unpaired,
    nodes,
  });
}

const summary = {
  types: types.length,
  pairs: types.reduce((sum, type) => sum + type.pairs, 0),
  candidates: types.reduce((sum, type) => sum + type.candidates, 0),
  noDomPair: types.reduce((sum, type) => sum + type.noDomPair, 0),
  newSide: types.reduce((sum, type) => sum + type.newSide, 0),
  unpaired: types.reduce((sum, type) => sum + type.unpaired.length, 0),
  allCandidateTypes: types
    .filter((type) => type.candidates === type.pairs && type.unpaired.length === 0)
    .map((type) => type.id ?? type.type),
  typesWithNoDomPair: types
    .filter((type) => type.noDomPair > 0)
    .map((type) => type.id ?? type.type),
  typesWithUnpaired: types
    .filter((type) => type.unpaired.length > 0)
    .map((type) => type.id ?? type.type),
  typesWithNewSideNodes: types
    .filter((type) => type.newSide > 0)
    .map((type) => type.id ?? type.type),
};

writeFileSync(
  output,
  `${JSON.stringify(
    {
      adr: 248,
      phase: 3,
      check: "G3 old/new geometry leg — per-node old-defect ledger (decision material)",
      source,
      rule: "candidate = new↔DOM ≤1px AND old↔DOM >1px; verdicts unchanged",
      summary,
      types,
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify(summary, null, 2));
