#!/usr/bin/env node
/**
 * ADR-923 Phase 0 §C-2 — "block 컨테이너 + inline-level 자식" 문서 스캐너 (R2 · G2 입력).
 *
 * 사용: node scripts/adr-923/scan-block-inline.mjs <doc.json> [...more] [--verbose]
 *
 * 입력 문서 형식 (자동 판별):
 *   - canonical: `{ version, children: [ { id, type, props: { style }, children } ] }`
 *   - legacy export: `{ elements: [ { id, tag, props: { style }, parent_id } ] }`
 *     (`parent_id === "body"` 또는 null 인 요소는 합성 `body` 루트의 자식)
 *
 * display 해석은 **현행 코드와 같게** 둔다 (Node 내장 모듈만 — 소스 파일을 텍스트로 읽어 상수를 뽑는다):
 *   - INLINE_BLOCK_TAGS: `engines/utils.ts` 의 Set 리터럴
 *   - catalog 실효 display (Canvas 자기 style — `implicitStyles.ts resolveContainerStylesFallback`):
 *       top-level `rule.containerStyles` 가 있으면 그 display, 없으면
 *       `structure.composition.layout` 토큰 → `structure.containerStyles` → `structure.composition.containerStyles`
 *       순 last-wins (`resolveCatalogContainerBase`)
 *   - 컨테이너 자기 display (inner solver 선택, `fullTreeLayout.ts:1057`):
 *       style.display ?? catalog 실효 display ?? (INLINE_BLOCK_TAGS ? "inline-block" : "block")
 *   - 부모가 보는 자식 display (`fullTreeLayout.ts:1797 getElementDisplay` — catalog 를 **보지 않는다**):
 *       style.display ?? (INLINE_BLOCK_TAGS ? "inline-block" : "block")
 *     → `classifyChildDisplay`: outer=inline ∧ inner∈{flow, flow-root} 만 inline (inline-flex/inline-grid 는 block)
 *   - IFC 시뮬레이션 발생 = 컨테이너 own display 의 outer=block ∧ inner∈{flow, flow-root} ∧ inline 자식 ≥1
 *     (`displayAdapter.ts toEngineDisplay` 마지막 분기 — flex/grid/inline-* 컨테이너는 검사 자체를 안 한다)
 *
 * 추가로 **C′ 계약 근사** 도 센다 — Phase 5 후 자식 default display 가 catalog(=DOM, HC2) 에서 파생될 때
 * line box 가 생기는 컨테이너 수. 근사 규칙: 자식 outer = parse(style.display ?? catalog 구조 병합 display
 * (top-level Canvas override 제외) ?? top-level ?? INLINE_BLOCK_TAGS→inline-block ?? block).outer.
 * 이 수가 "기존 문서 배치 이동" 의 상한 후보다.
 *
 * 출력: 문서별·합계 — 전체 컨테이너 수 / block 컨테이너 수 / 영향 컨테이너 수(현행·C′) / 비율(%) /
 * 영향 문서 수 / 전체 문서 수. `--verbose` 면 영향 노드 id 목록.
 *
 * 규모·분포 주의 (measurement-validity.md Q1): 저장소 fixture 는 스크립트 동작 확인용 smoke 다. 실 문서
 * 분포는 사용자 export 로만 잰다 — 합성 문서로 채우지 않는다.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UTILS_TS = resolve(
  REPO,
  "apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts",
);
const RULES_TS = resolve(
  REPO,
  "packages/shared/src/catalog/generated/componentRulesTable.ts",
);
const LAYOUT_TOKENS_TS = resolve(
  REPO,
  "packages/specs/src/renderers/layoutTokens.ts",
);

// ── 소스 상수 추출 ──

function readInlineBlockTags() {
  const src = readFileSync(UTILS_TS, "utf8");
  const m = src.match(/export const INLINE_BLOCK_TAGS = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) throw new Error(`INLINE_BLOCK_TAGS Set 리터럴을 찾지 못함: ${UTILS_TS}`);
  const body = m[1].replace(/\/\/[^\n]*/g, "");
  return new Set([...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]));
}

function readLayoutTokenDisplays() {
  const src = readFileSync(LAYOUT_TOKENS_TS, "utf8");
  const m = src.match(/LAYOUT_TOKEN_STYLES[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!m) throw new Error(`LAYOUT_TOKEN_STYLES 를 찾지 못함: ${LAYOUT_TOKENS_TS}`);
  const out = {};
  const re = /"?([a-z-]+)"?:\s*\{[^}]*?display:\s*"([^"]+)"/g;
  for (const t of m[1].matchAll(re)) out[t[1]] = t[2];
  return out;
}

/**
 * componentRulesTable.ts 를 들여쓰기 기반으로 걸어 rule 별 display 위치를 뽑는다.
 * 관심 경로: <Rule>.containerStyles.display / <Rule>.structure.containerStyles.display /
 * <Rule>.structure.composition.containerStyles.display / <Rule>.structure.composition.layout
 */
function readCatalogDisplays() {
  const lines = readFileSync(RULES_TS, "utf8").split("\n");
  const rules = {};
  const stack = []; // { indent, key }
  const pathOf = () => stack.map((s) => s.key).join(".");
  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, "");
    const indent = line.match(/^ */)[0].length;
    if (/^export const COMPONENT_RULES_TABLE\b.*\{\s*$/.test(line)) {
      stack.length = 0;
      stack.push({ indent, key: "COMPONENT_RULES_TABLE" });
      continue;
    }
    if (/^\s*\},?\s*$/.test(line) || /^\s*\],?\s*$/.test(line)) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      continue;
    }
    const open = line.match(/^\s*(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*[\{\[]\s*$/);
    const anon = line.match(/^\s*[\{\[]\s*,?\s*$/);
    if (open || anon) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const key = open ? (open[1] ?? open[2]) : "[]";
      stack.push({ indent, key });
      if (stack.length === 2 && stack[0].key === "COMPONENT_RULES_TABLE") {
        rules[key] ??= { hasTop: false, top: null, structTop: null, compTop: null, layout: null };
      }
      continue;
    }
    if (stack.length === 1 && /^export const COMPONENT_RULES_TABLE/.test(line)) continue;
    const kv = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*"([^"]*)"\s*,?\s*$/);
    if (!kv) continue;
    const path = pathOf();
    const seg = path.split(".");
    if (seg[0] !== "COMPONENT_RULES_TABLE" || seg.length < 2) continue;
    const rule = rules[seg[1]];
    if (!rule) continue;
    const rest = seg.slice(2).join(".");
    if (rest === "containerStyles") {
      rule.hasTop = true;
      if (kv[1] === "display") rule.top = kv[2];
    } else if (rest === "structure.containerStyles" && kv[1] === "display") {
      rule.structTop = kv[2];
    } else if (rest === "structure.composition.containerStyles" && kv[1] === "display") {
      rule.compTop = kv[2];
    } else if (rest === "structure.composition" && kv[1] === "layout") {
      rule.layout = kv[2];
    }
  }
  // top-level containerStyles 가 display 없이 존재하는 경우도 hasTop 으로 잡기 위해 재스캔
  const src = readFileSync(RULES_TS, "utf8");
  for (const m of src.matchAll(/^  (?:"([^"]+)"|([A-Za-z_$][\w$]*)): \{\n([\s\S]*?)^  \},?$/gm)) {
    const name = m[1] ?? m[2];
    if (rules[name] && /^    containerStyles: \{/m.test(m[3])) rules[name].hasTop = true;
  }
  return rules;
}

// ── display 해석 ──

function parseDisplay(value) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "block":
      return { outer: "block", inner: "flow" };
    case "inline":
      return { outer: "inline", inner: "flow" };
    case "inline-block":
      return { outer: "inline", inner: "flow-root" };
    case "flow-root":
      return { outer: "block", inner: "flow-root" };
    case "flex":
      return { outer: "block", inner: "flex" };
    case "inline-flex":
      return { outer: "inline", inner: "flex" };
    case "grid":
      return { outer: "block", inner: "grid" };
    case "inline-grid":
      return { outer: "inline", inner: "grid" };
    case "none":
      return { outer: "none", inner: "none" };
    default:
      return { outer: "block", inner: "flow" };
  }
}

function makeResolver(inlineBlockTags, catalog, layoutTokens) {
  const byLower = new Map(Object.keys(catalog).map((k) => [k.toLowerCase(), k]));
  const ruleOf = (type) => catalog[byLower.get((type ?? "").toLowerCase())];
  const structureMerged = (rule) => {
    if (!rule) return null;
    let d = null;
    if (rule.layout && layoutTokens[rule.layout]) d = layoutTokens[rule.layout];
    if (rule.structTop) d = rule.structTop;
    if (rule.compTop) d = rule.compTop;
    return d;
  };
  const canvasEffective = (type) => {
    const rule = ruleOf(type);
    if (!rule) return null;
    if (rule.hasTop) return rule.top; // top-level 은 대체(override 아님) — display 없으면 null
    return structureMerged(rule);
  };
  const isIbt = (type) => inlineBlockTags.has((type ?? "").toLowerCase());
  const styleDisplay = (node) => {
    const d = node.props?.style?.display;
    return typeof d === "string" && d.length > 0 ? d : null;
  };
  return {
    /** 컨테이너 자기 display (fullTreeLayout.ts:1057 — catalog fallback merge 후 getElementDisplay). */
    ownDisplay(node) {
      return (
        styleDisplay(node) ??
        canvasEffective(node.type) ??
        (isIbt(node.type) ? "inline-block" : "block")
      );
    },
    /** 부모가 보는 자식 display (getElementDisplay — catalog 미참조). */
    childDisplayCurrent(node) {
      return styleDisplay(node) ?? (isIbt(node.type) ? "inline-block" : "block");
    },
    /** C′ 근사: default display 를 catalog 구조 병합(=DOM 가정) 에서 파생. */
    childDisplayCprime(node) {
      const rule = ruleOf(node.type);
      return (
        styleDisplay(node) ??
        structureMerged(rule) ??
        rule?.top ??
        (isIbt(node.type) ? "inline-block" : "block")
      );
    },
  };
}

function classifyChildDisplay(display) {
  const p = parseDisplay(display);
  if (p.outer === "none") return "none";
  if (p.outer === "inline" && (p.inner === "flow" || p.inner === "flow-root")) return "inline";
  return "block";
}

function isIfcHostCandidate(display) {
  const p = parseDisplay(display);
  return p.outer === "block" && (p.inner === "flow" || p.inner === "flow-root");
}

// ── 문서 로딩 ──

function loadDocument(path) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(json.children)) {
    return { format: "canonical", roots: json.children };
  }
  if (Array.isArray(json.elements)) {
    const byId = new Map();
    for (const el of json.elements) {
      byId.set(el.id, { id: el.id, type: el.tag ?? el.type, props: el.props ?? {}, children: [] });
    }
    const roots = [];
    for (const el of json.elements) {
      const node = byId.get(el.id);
      const parent = el.parent_id != null ? byId.get(el.parent_id) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    // legacy export: parent_id "body" 는 페이지 루트 — 합성 body 컨테이너로 감싼다
    return { format: "legacy-export", roots: [{ id: "body", type: "body", props: {}, children: roots }] };
  }
  throw new Error(`알 수 없는 문서 형식 (children[] 도 elements[] 도 없음): ${path}`);
}

function scanDocument(path, resolver, verbose) {
  const { format, roots } = loadDocument(path);
  const stat = {
    file: path,
    format,
    nodes: 0,
    containers: 0,
    blockContainers: 0,
    affectedCurrent: 0,
    affectedCprime: 0,
    affectedIdsCurrent: [],
    affectedIdsCprime: [],
  };
  const walk = (node) => {
    stat.nodes += 1;
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) {
      stat.containers += 1;
      const own = resolver.ownDisplay(node);
      if (isIfcHostCandidate(own)) {
        stat.blockContainers += 1;
        if (children.some((c) => classifyChildDisplay(resolver.childDisplayCurrent(c)) === "inline")) {
          stat.affectedCurrent += 1;
          stat.affectedIdsCurrent.push(node.id ?? "(no id)");
        }
        if (children.some((c) => parseDisplay(resolver.childDisplayCprime(c)).outer === "inline")) {
          stat.affectedCprime += 1;
          stat.affectedIdsCprime.push(node.id ?? "(no id)");
        }
      }
      for (const c of children) walk(c);
    }
  };
  for (const r of roots) walk(r);
  if (!verbose) {
    delete stat.affectedIdsCurrent;
    delete stat.affectedIdsCprime;
  }
  return stat;
}

// ── main ──

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const files = args.filter((a) => !a.startsWith("--"));
if (args.includes("--dump-constants")) {
  // 소스 상수 추출 결과만 출력 — tsx import 로 얻은 실제 값과 대조하는 자기 검증용
  console.log(
    JSON.stringify(
      {
        inlineBlockTags: [...readInlineBlockTags()],
        catalog: readCatalogDisplays(),
        layoutTokens: readLayoutTokenDisplays(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (files.length === 0) {
  console.error("usage: node scripts/adr-923/scan-block-inline.mjs <doc.json> [...] [--verbose]");
  process.exit(2);
}

const inlineBlockTags = readInlineBlockTags();
const catalog = readCatalogDisplays();
const layoutTokens = readLayoutTokenDisplays();
const resolver = makeResolver(inlineBlockTags, catalog, layoutTokens);

const perDoc = files.map((f) => scanDocument(f, resolver, verbose));
const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 10000) / 100);
const total = perDoc.reduce(
  (acc, s) => {
    acc.nodes += s.nodes;
    acc.containers += s.containers;
    acc.blockContainers += s.blockContainers;
    acc.affectedCurrent += s.affectedCurrent;
    acc.affectedCprime += s.affectedCprime;
    if (s.affectedCurrent > 0) acc.docsAffectedCurrent += 1;
    if (s.affectedCprime > 0) acc.docsAffectedCprime += 1;
    return acc;
  },
  {
    docs: perDoc.length,
    nodes: 0,
    containers: 0,
    blockContainers: 0,
    affectedCurrent: 0,
    affectedCprime: 0,
    docsAffectedCurrent: 0,
    docsAffectedCprime: 0,
  },
);
const report = {
  constants: {
    inlineBlockTagsCount: inlineBlockTags.size,
    catalogRulesCount: Object.keys(catalog).length,
    catalogTopLevelDisplayCount: Object.values(catalog).filter((r) => r.top).length,
    layoutTokens,
  },
  perDocument: perDoc,
  total: {
    ...total,
    affectedCurrentPctOfContainers: pct(total.affectedCurrent, total.containers),
    affectedCprimePctOfContainers: pct(total.affectedCprime, total.containers),
    affectedCurrentPctOfBlockContainers: pct(total.affectedCurrent, total.blockContainers),
    affectedCprimePctOfBlockContainers: pct(total.affectedCprime, total.blockContainers),
  },
};
console.log(JSON.stringify(report, null, 2));
