/**
 * ADR-295 Phase 0 — rule 값 종류 재집계 (breakdown §2a · §2b).
 *
 * `COMPONENT_RULES_TABLE` 을 import 해 모든 치수 키의 값을 「토큰 참조 (`{…}`)」 · 「px 숫자 리터럴」 ·
 * 「그 밖 (문자열 px · var())」 로 센다. 손 grep 집계 (ADR F1) 와 다르면 이 스크립트가 정본.
 *
 *   pnpm -F @composition/builder exec tsx scripts/adr295-rule-literal-inventory.ts [out.json]
 */
import { writeFileSync } from "node:fs";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";

const KEYS = [
  "fontSize",
  "borderRadius",
  "lineHeight",
  "borderWidth",
  "height",
  "minHeight",
  "iconSize",
  "minWidth",
  "paddingX",
  "paddingY",
  "gap",
  "iconGap",
] as const;
type Key = (typeof KEYS)[number];
type Bucket = { token: number; literal: number; other: number };

const counts = Object.fromEntries(
  KEYS.map((k) => [k, { token: 0, literal: 0, other: 0 }]),
) as Record<Key, Bucket>;
const tokenRefs: Record<string, Record<string, number>> = {};
const literalValues: Record<string, Record<string, number>> = {};
const sizeKeys: Record<string, number> = {};

function bump(
  map: Record<string, Record<string, number>>,
  k: string,
  v: string,
) {
  (map[k] ??= {})[v] = (map[k][v] ?? 0) + 1;
}

function walk(node: unknown) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if ((KEYS as readonly string[]).includes(k)) {
      const b = counts[k as Key];
      if (typeof v === "number") {
        b.literal++;
        bump(literalValues, k, String(v));
      } else if (typeof v === "string" && /^\{.+\}$/.test(v)) {
        b.token++;
        bump(tokenRefs, k, v);
      } else if (v !== undefined) {
        b.other++;
      }
    }
    if (k === "sizes" && v && typeof v === "object") {
      for (const s of Object.keys(v)) sizeKeys[s] = (sizeKeys[s] ?? 0) + 1;
    }
    walk(v);
  }
}

walk(COMPONENT_RULES_TABLE);

// §2b — 컴포넌트별 sizes.height (숫자만)
const heights: Record<string, Record<string, number | string>> = {};
for (const [name, rule] of Object.entries(COMPONENT_RULES_TABLE)) {
  const sizes = (rule as { sizes?: Record<string, { height?: unknown }> })
    .sizes;
  if (!sizes) continue;
  const row: Record<string, number | string> = {};
  for (const [s, v] of Object.entries(sizes)) {
    if (v && v.height !== undefined) row[s] = v.height as number | string;
  }
  if (Object.keys(row).length) heights[name] = row;
}

const out = {
  generatedAt: new Date().toISOString(),
  components: Object.keys(COMPONENT_RULES_TABLE).length,
  counts,
  tokenRefs,
  literalValues,
  sizeKeys,
  heights,
};
const path = process.argv[2];
if (path) writeFileSync(path, JSON.stringify(out, null, 2));
console.table(counts);
console.log("sizeKeys", sizeKeys);
console.log("typography refs", tokenRefs.fontSize);
console.log("lineHeight refs", tokenRefs.lineHeight);
console.log("radius refs", tokenRefs.borderRadius);
