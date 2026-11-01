/**
 * ADR-297 Phase 0 — 기준선 · 인벤토리 (breakdown §2 · §5 G0 (a) (c)).
 *
 *   pnpm -F @composition/builder exec tsx scripts/adr297-baseline.ts <outDir>
 *
 * 내는 파일 (outDir — `.agent/runs/` 아래 로컬 전용):
 * - `inventory.json` — 상태 표현 5 방식 (① fill.<style>.<state> · ② colors 접미사 키 · ③ structure.states ·
 *   ④ rootSelectors `&` 상태 키 · ⑤ variant 이름 selected) 의 rule 별 건수. 손 grep 집계와 다르면 이것이 정본.
 * - `paint.json` — `resolveCatalogPaint` 를 rule × variant × fillStyle × staticColor × quiet × emphasized ×
 *   selected × interaction 전수로 부른 결과 (G0 (c) paint oracle). 전환 뒤 같은 하니스로 `cmp`.
 * - `library.sha` — `buildCodeCatalogLibrary()` JSON 의 sha256.
 * - `css.sha` — 생성 CSS 디렉터리 전 파일의 sha256 (파일명 순).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";
import { buildCodeCatalogLibrary } from "../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  resolveCatalogPaint,
  type CatalogInteractionState,
} from "../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";
import { rulePaintReach } from "../../../packages/shared/src/catalog/rule/paintReach";
import type { ComponentRule } from "../../../packages/shared/src/types/catalog-style.types";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: adr297-baseline.ts <outDir>");
mkdirSync(outDir, { recursive: true });
const sha = (text: string) => createHash("sha256").update(text).digest("hex");

// ── inventory ──
const FILL_STATES = [
  "base",
  "hover",
  "pressed",
  "selected",
  "selectedHover",
  "selectedPressed",
  "emphasizedSelected",
] as const;
const COLOR_STATE_KEYS = [
  "textHover",
  "borderHover",
  "outlineText",
  "outlineBorder",
  "subtleText",
  "selectedText",
  "selectedBorder",
  "emphasizedSelectedText",
  "emphasizedSelectedBorder",
] as const;
type Counts = Record<string, number>;
const add = (counts: Counts, key: string, n = 1) => {
  counts[key] = (counts[key] ?? 0) + n;
};
const inventory: Record<string, Counts> = {};
const totals: Counts = {};
for (const [type, rule] of Object.entries(
  COMPONENT_RULES_TABLE as Record<string, ComponentRule>,
)) {
  const c: Counts = {};
  for (const [name, variant] of Object.entries(rule.variants ?? {})) {
    for (const style of ["default", "outline", "subtle", "quiet"] as const) {
      const states = variant.fill?.[style] as
        Record<string, unknown> | undefined;
      if (!states) continue;
      for (const state of FILL_STATES)
        if (states[state] !== undefined) add(c, `①fill.${style}.${state}`);
    }
    if (variant.fill?.alpha !== undefined) add(c, "①fill.alpha");
    for (const key of COLOR_STATE_KEYS)
      if (variant.colors?.[key] !== undefined) add(c, `②colors.${key}`);
    if (name === "selected" || name === "selectedEmphasized")
      add(c, `⑤variant.${name}`);
  }
  for (const [state, decls] of Object.entries(rule.structure?.states ?? {}))
    if (decls && Object.keys(decls).length > 0)
      add(c, `③states.${state}`, Object.keys(decls).length);
  const roots = rule.structure?.composition?.rootSelectors as
    Record<string, { styles?: Record<string, unknown> }> | undefined;
  for (const [selector, block] of Object.entries(roots ?? {})) {
    if (!/\[data-|:focus|:hover/.test(selector)) continue;
    const decls = Object.keys(block?.styles ?? {}).length;
    // `&` 자신 대상 (결합자 · pseudo-element 없음) ↔ 다른 대상 (자손 · 형제 · ::before)
    const self = !/[\s>+~]|::/.test(selector.replace(/\([^)]*\)/g, "()"));
    add(c, self ? "④root.self.keys" : "④root.other.keys");
    add(c, self ? "④root.self.decls" : "④root.other.decls", decls);
  }
  if (Object.keys(c).length > 0) {
    inventory[type] = c;
    for (const [k, v] of Object.entries(c)) add(totals, k, v);
  }
}
writeFileSync(
  path.join(outDir, "inventory.json"),
  `${JSON.stringify({ totals, byRule: inventory }, null, 2)}\n`,
);

// ── paint oracle ──
const INTERACTIONS: CatalogInteractionState[] = ["default", "hover", "pressed"];
const rows: unknown[] = [];
/** 닿는 입력만 (`rulePaintReach` — 받는 fillStyle 값 · 선택될 수 있는 rule). G1 의 비교 대상. */
const reachRows: unknown[] = [];
for (const [type, rule] of Object.entries(
  COMPONENT_RULES_TABLE as Record<string, ComponentRule>,
)) {
  const fillStyles: (string | undefined)[] = [
    undefined,
    rule.fillStyleValues?.outline ?? "outline",
    rule.fillStyleValues?.subtle ?? "subtle",
  ];
  const size = rule.defaultSize ? rule.sizes?.[rule.defaultSize] : undefined;
  for (const [variantName, variant] of Object.entries(rule.variants ?? {}))
    for (const fillStyle of fillStyles)
      for (const staticColor of [undefined, "black", "white"])
        for (const isQuiet of [false, true])
          for (const isEmphasized of [false, true])
            for (const isSelected of [false, true])
              for (const interactionState of INTERACTIONS) {
                const props = {
                  fillStyle,
                  staticColor,
                  isQuiet,
                  isEmphasized,
                  isSelected,
                };
                const row = [
                  type,
                  variantName,
                  fillStyle ?? "-",
                  staticColor ?? "-",
                  +isQuiet,
                  +isEmphasized,
                  +isSelected,
                  interactionState,
                  resolveCatalogPaint({
                    variant,
                    size,
                    props,
                    style: undefined,
                    interactionState,
                    fillStyleValues: rule.fillStyleValues,
                  }),
                ];
                rows.push(row);
                const reach = rulePaintReach(type, rule);
                if (
                  (fillStyle === undefined ||
                    reach.fillStyles?.includes(fillStyle)) &&
                  (!isSelected || reach.selectable)
                )
                  reachRows.push(row);
              }
}
const paintJson = `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
writeFileSync(path.join(outDir, "paint.jsonl"), paintJson);
const reachJson = `${reachRows.map((r) => JSON.stringify(r)).join("\n")}\n`;
writeFileSync(path.join(outDir, "paint.reach.jsonl"), reachJson);

// ── library · generated CSS ──
const library = await buildCodeCatalogLibrary();
// ADR-297: the rules the library copies carry the new `paint` tree — the projection (definitions) is
//   what must stay the same, so the copied variants are compared without it.
//   Keys are sorted (canonical JSON) — a rebuilt `fill` · `colors` object lists its keys in its own order.
const canonical = (value: unknown, parent?: object, key?: string): unknown => {
  if (key === "paint" && parent && "fill" in parent) return undefined;
  if (Array.isArray(value)) return value.map((v) => canonical(v));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [
          k,
          canonical((value as Record<string, unknown>)[k], value, k),
        ])
        .filter(([, v]) => v !== undefined),
    );
  return value;
};
const libraryJson = JSON.stringify(canonical(library));
writeFileSync(path.join(outDir, "library.sha"), `${sha(libraryJson)}\n`);
writeFileSync(
  path.join(outDir, "library.json"),
  `${JSON.stringify(JSON.parse(libraryJson), null, 1)}\n`,
);

const root = path.resolve(import.meta.dirname, "../../..");
const cssDir = path.join(
  root,
  "packages/shared/src/components/styles/generated",
);
const cssLines = readdirSync(cssDir)
  .filter((f) => f.endsWith(".css"))
  .sort()
  .map((f) => `${sha(readFileSync(path.join(cssDir, f), "utf8"))}  ${f}`);
writeFileSync(path.join(outDir, "css.sha"), `${cssLines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      rules: Object.keys(COMPONENT_RULES_TABLE).length,
      paintRows: rows.length,
      paintSha: sha(paintJson),
      reachRows: reachRows.length,
      reachSha: sha(reachJson),
      librarySha: sha(libraryJson),
      cssFiles: cssLines.length,
      cssSha: sha(cssLines.join("\n")),
      totals,
    },
    null,
    2,
  ),
);
