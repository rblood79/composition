#!/usr/bin/env node
// ADR-248 G0: old nonvisual value witnesses through existing pure adapters.
// Legacy-only or dormant fields retain an explicit no-active-output status.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  readCanonicalThemes,
  snapshotThemesFromConfig,
} from "../src/adapters/canonical/themesAdapter.ts";
import {
  readCanonicalTokens,
  resolveCanonicalToken,
  snapshotTokensFromResolved,
} from "../src/adapters/canonical/variablesAdapter.ts";
import { resolvePlacementForDrop } from "../src/builder/workspace/canvas/scene/pagePlacementEdit.ts";
import { readDataBindingRows } from "../../../packages/shared/src/collections/resolveCollectionItems.ts";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const audit = read("nonvisual-field-audit.json");
const inventory = read("inventory.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== audit.baselineHead || head !== inventory.baselineHead)
  throw new Error("Old nonvisual runtime output uses another HEAD");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const themeInput = {
  tint: "blue",
  darkMode: "dark",
  neutral: "gray",
  radiusScale: "md",
};
const themes = snapshotThemesFromConfig(themeInput);
const themeOutput = readCanonicalThemes({
  version: "composition-1.0",
  themes,
  children: [],
});
assert.deepEqual(themeOutput, themeInput);
const tokenInput = { "color.accent": "#112233", "size.gap": 8 };
const tokens = snapshotTokensFromResolved(tokenInput);
const tokenOutput = readCanonicalTokens({
  version: "composition-1.0",
  tokens,
  children: [],
});
assert.deepEqual(tokenOutput, tokens);
assert.equal(resolveCanonicalToken("{color.accent}", { tokens }), "#112233");
const pointInput = { x: 48.4, y: 64.6 };
const drop = resolvePlacementForDrop(
  {
    pages: [{ id: "home" }, { id: "page" }],
    homePageId: "home",
    positions: { home: { x: 0, y: 0 }, page: { x: 0, y: 0 } },
    pageSizes: {},
    layout: { direction: "horizontal", columns: 1, gap: 0, trackWidth: 100 },
    placements: {},
    activeBreakpoint: "desktop",
    writeAsOverride: false,
  },
  "page",
  pointInput,
);
assert.equal(drop.kind, "absolute");
assert.deepEqual(drop.entries[0].placement.style, {
  position: "absolute",
  left: 48,
  top: 65,
});
const bindingInput = {
  type: "collection",
  source: "static",
  config: { data: [{ id: "row-one", label: "A" }] },
};
const bindingRows = readDataBindingRows(bindingInput);
assert.deepEqual(bindingRows, [{ id: "row-one", label: "A" }]);
const witness = new Map([
  ...Object.keys(themeInput).map((field) => [
    `ThemeSnapshot.${field}`,
    {
      input: themeInput[field],
      output: themeOutput[field],
      route: "snapshotThemesFromConfig → readCanonicalThemes",
    },
  ]),
  ...["type", "value", "source"].map((field) => [
    `TokensSnapshotEntry.${field}`,
    {
      input: field === "source" ? "spec-token" : tokens["color.accent"][field],
      output: tokenOutput["color.accent"][field],
      route: "snapshotTokensFromResolved → readCanonicalTokens",
    },
  ]),
  [
    "PagePositionPoint.x",
    {
      input: pointInput.x,
      output: drop.entries[0].placement.style.left,
      route: "resolvePlacementForDrop → PagePlacement.style.left",
    },
  ],
  [
    "PagePositionPoint.y",
    {
      input: pointInput.y,
      output: drop.entries[0].placement.style.top,
      route: "resolvePlacementForDrop → PagePlacement.style.top",
    },
  ],
  ...["type", "source", "config"].map((field) => [
    `SerializedDataBinding.${field}`,
    {
      input: bindingInput[field],
      output: bindingRows,
      route: "readDataBindingRows legacy static input",
    },
  ]),
]);
const rows = audit.fields.map((field) => {
  const key = `${field.family}.${field.field}`;
  const result = witness.get(key);
  return {
    key,
    disposition: field.disposition,
    writerPath: field.writer?.path ?? null,
    readerPath: field.reader?.path ?? null,
    scenarioId: `adr248-old-nonvisual-field/${key}`,
    oldInput: result?.input ?? null,
    oldOutput: result?.output ?? null,
    oldRoute: result?.route ?? null,
    status: result
      ? "OLD_PURE_RUNTIME_WITNESS"
      : "DISPOSITION_ONLY; NO_OLD_RUNTIME_WITNESS",
    futureBehavior: "UNVERIFIED",
  };
});
if (rows.length !== 19 || new Set(rows.map((row) => row.key)).size !== 19)
  throw new Error("Old nonvisual field output incomplete");
const scenario = {
  id: "adr248-old-nonvisual-field-values-v1",
  seed: 248,
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  theme: "default-light",
  font: "app-default",
  operations: [
    { op: "snapshotThemePreset", keys: Object.keys(themeInput) },
    { op: "snapshotTokens", keys: Object.keys(tokenInput) },
    { op: "resolvePageDrop", point: pointInput },
    { op: "readLegacyStaticBinding", rows: 1 },
  ],
  expectedRelations: [
    ["page", "placement"],
    ["binding", "row-one"],
  ],
};
const report = {
  head,
  runtime: "old Builder/shared pure adapter and reader modules",
  scenario,
  scenarioHash: hash(JSON.stringify(scenario)),
  status:
    "PARTIAL_OLD_NONVISUAL_OUTPUT; inactive and UI write paths remain classified separately",
  summary: {
    fields: rows.length,
    oldRuntimeWitnesses: rows.filter(
      (row) => row.status === "OLD_PURE_RUNTIME_WITNESS",
    ).length,
    dispositionOnly: rows.filter(
      (row) => row.status !== "OLD_PURE_RUNTIME_WITNESS",
    ).length,
  },
  rows,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
