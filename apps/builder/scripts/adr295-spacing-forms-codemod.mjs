#!/usr/bin/env node
/**
 * ADR-295 Phase 3c-3 — codemod: a rule's padding · gap literals → S2's value forms (Decision 3), and the
 * component font steps S2 writes one step down (G4 c). One table of (rule, key) → form, from the Phase 0
 * comparison (breakdown §6.0) and the S2 oracle (`adr295-s2-oracle.json` — the G4 gate checks the result):
 *
 * | rule                 | key              | S2                                   | form                  |
 * | -------------------- | ---------------- | ------------------------------------ | --------------------- |
 * | Button               | paddingX         | `pill` — height / 2                  | `ofHeight(1, 2)`      |
 * | Button               | gap · iconGap    | `text-to-visual` 6/14 em (touch 8/17) | `TEXT_TO_VISUAL`      |
 * | ToggleButton         | paddingX         | `edge-to-text` — height × 3/8        | `ofHeight(3, 8)`      |
 * | ToggleButton         | gap              | `text-to-visual`                     | `TEXT_TO_VISUAL`      |
 * | Tag · Input · DateInput | paddingX      | `edge-to-text`                       | `ofHeight(3, 8)`      |
 * | Checkbox · Radio · Switch | gap         | `text-to-control` 10/14 em           | `TEXT_TO_CONTROL`     |
 * | Checkbox · Radio · DateField | fontSize | ui-sm · ui · ui-lg · ui-xl (12 · 14 · 16 · 18) | `text-xs` … `text-lg` |
 *
 * Usage: node apps/builder/scripts/adr295-spacing-forms-codemod.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const file = path.join(
  root,
  "packages/shared/src/catalog/generated/componentRulesTable.ts",
);

const FORMS = {
  Button: {
    paddingX: "ofHeight(1, 2)",
    gap: "TEXT_TO_VISUAL",
    iconGap: "TEXT_TO_VISUAL",
  },
  ToggleButton: { paddingX: "ofHeight(3, 8)", gap: "TEXT_TO_VISUAL" },
  Tag: { paddingX: "ofHeight(3, 8)" },
  Input: { paddingX: "ofHeight(3, 8)" },
  DateInput: { paddingX: "ofHeight(3, 8)" },
  Checkbox: { gap: "TEXT_TO_CONTROL" },
  Radio: { gap: "TEXT_TO_CONTROL" },
  Switch: { gap: "TEXT_TO_CONTROL" },
};
const FONT_DOWN = {
  "text-sm": "text-xs",
  "text-base": "text-sm",
  "text-lg": "text-base",
  "text-xl": "text-lg",
};
const FONT_STEP_RULES = ["Checkbox", "Radio", "DateField"];

/** [start, end) of a top-level rule entry `  Name: {` … next top-level entry. */
function entryRange(source, name) {
  const start = source.indexOf(`\n  ${name}: {\n`);
  if (start < 0) throw new Error(`rule ${name} not found`);
  const next = /\n {2}[A-Z][A-Za-z]*: \{\n|\n\};\n/g;
  next.lastIndex = start + 1;
  const match = next.exec(source);
  return [start, match ? match.index : source.length];
}

/** [start, end) of the entry's `    sizes: {` block. */
function sizesRange(source, [start, end]) {
  const open = source.indexOf("\n    sizes: {\n", start);
  if (open < 0 || open > end) throw new Error("sizes block not found");
  const close = source.indexOf("\n    },\n", open);
  return [open, close];
}

let source = readFileSync(file, "utf8");
const original = source;
const replaceIn = (range, fn) => {
  source =
    source.slice(0, range[0]) +
    fn(source.slice(...range)) +
    source.slice(range[1]);
};
for (const [rule, keys] of Object.entries(FORMS))
  replaceIn(sizesRange(source, entryRange(source, rule)), (block) => {
    let out = block;
    for (const [key, form] of Object.entries(keys)) {
      const pattern = new RegExp(`(\\n {8}${key}: )-?\\d+(?:\\.\\d+)?,`, "g");
      const count = (out.match(pattern) ?? []).length;
      if (!count) throw new Error(`${rule}.${key}: no literal`);
      out = out.replace(pattern, `$1${form},`);
    }
    return out;
  });
for (const rule of FONT_STEP_RULES)
  replaceIn(sizesRange(source, entryRange(source, rule)), (block) =>
    block.replace(
      /(\n {8}fontSize: "\{typography\.)(text-[a-z]+)(\}",)/g,
      (_m, head, step, tail) => {
        if (!FONT_DOWN[step]) throw new Error(`${rule}: font ${step}`);
        return `${head}${FONT_DOWN[step]}${tail}`;
      },
    ),
  );

if (process.argv.includes("--check")) {
  console.log(source === original ? "no change" : "would change");
  process.exit(source === original ? 0 : 1);
}
writeFileSync(file, source);
console.log("componentRulesTable.ts: forms written");
