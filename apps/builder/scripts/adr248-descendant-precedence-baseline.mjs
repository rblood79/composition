#!/usr/bin/env node
// ADR-248 G0: exercise old descendant patch, fill ownership and resolver order.
// Semantic inputs stay independent of either saved document format.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  applyPropsPatch,
  composePropsPatches,
  resolveCanonicalDescendantOverride,
  resolveCanonicalRefProps,
} from "../src/adapters/canonical/instanceResolver.ts";
import { applyEditToSlotFill } from "../src/builder/components/slotFillEdit.ts";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Descendant precedence baseline uses another HEAD");
const scenario = {
  id: "adr248-old-descendant-precedence-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "resolveRootOverride", target: "instance", value: "instance" },
    { op: "patchDescendant", target: "label", text: "patched", color: null },
    { op: "fillSlot", target: "content", children: ["filled-label"] },
    { op: "editFilledNode", target: "filled-label", text: "edited" },
    { op: "composePatch", target: "label", first: "mask", last: "set" },
    { op: "rejectPatchMode", modes: ["replace", "fillSlot"] },
  ],
  expectedRelations: [
    ["instance", "label"],
    ["content", "filled-label"],
  ],
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const base = {
  id: "label",
  type: "Text",
  props: { children: "origin", style: { color: "red", fontSize: 12 } },
};
const rootProps = resolveCanonicalRefProps(
  { id: "origin", type: "Text", props: { children: "origin" } },
  {
    id: "instance",
    type: "ref",
    ref: "origin",
    props: { children: "instance" },
  },
);
assert.equal(rootProps.children, "instance");
const modeA = resolveCanonicalDescendantOverride(
  base,
  {
    label: {
      children: "patched",
      style: { color: null, fontWeight: 600 },
      enabled: false,
    },
  },
  "label",
);
assert.deepEqual(modeA.props, {
  children: "patched",
  style: { fontSize: 12, fontWeight: 600 },
});
assert.equal(modeA.enabled, false);
const filled = {
  content: {
    children: [
      {
        id: "filled-label",
        type: "Text",
        props: {
          children: "filled",
          style: { color: "blue", fontSize: 12 },
        },
      },
    ],
  },
  "content/filled-label": { children: "shadowed-mode-a" },
};
const modeC = applyEditToSlotFill(filled, "content/filled-label", {
  children: "edited",
  style: { color: null, fontWeight: 600 },
});
assert.ok(modeC);
const owned = modeC.content.children[0];
assert.deepEqual(owned.props, {
  children: "edited",
  style: { fontSize: 12, fontWeight: 600 },
});
assert.equal(modeC["content/filled-label"].children, "shadowed-mode-a");
assert.equal(applyEditToSlotFill({}, "content/label", { children: "x" }), null);
const composed = composePropsPatches(
  { children: "origin", style: { color: "red", fontSize: 12 } },
  { children: "last", style: { color: null } },
);
assert.equal(composed.style.color, null);
const applied = applyPropsPatch(base.props, composed);
assert.deepEqual(applied, {
  children: "last",
  style: { fontSize: 12 },
});
const rejected = [];
for (const [mode, override] of [
  ["replace", { type: "Text", props: { children: "replacement" } }],
  ["fillSlot", { children: [{ id: "new", type: "Text" }] }],
]) {
  try {
    resolveCanonicalDescendantOverride(base, { label: override }, "label");
    throw new Error(`${mode}: old patch resolver unexpectedly accepted mode`);
  } catch (error) {
    if (!String(error).includes("non-patch mode")) throw error;
    rejected.push(mode);
  }
}
const report = {
  head,
  runtime: "old Builder pure authoring/resolver modules",
  scenarioHash: hash(JSON.stringify(scenario)),
  scenario,
  sourceModules: [
    "apps/builder/src/adapters/canonical/instanceResolver.ts",
    "apps/builder/src/builder/components/slotFillEdit.ts",
    "apps/builder/src/builder/stores/inspectorActions.ts",
  ],
  oldOutput: {
    rootProps,
    modeA: { props: modeA.props, enabled: modeA.enabled },
    modeC: {
      ownedProps: owned.props,
      shadowedOuterPatch: modeC["content/filled-label"],
    },
    noOwnedSlotFallback: "mode A caller path",
    composed,
    applied,
    rejected,
  },
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.oldOutput)}\n`);
