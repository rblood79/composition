#!/usr/bin/env node
/**
 * ADR-205 Phase 0 — 텍스트 CSS 시각 축 격차표를 **코드에서** 생성한다.
 *
 * 속성 집합의 출처는 손 목록이 아니라 코드 2곳의 합집합이다 (ADR-205 R4):
 *   A. `cssResolver.INHERITABLE_PROPERTIES` 의 텍스트 항목 (`visibility` 제외 — 텍스트 축 아님)
 *   B. ADR-057 블록 (`buildSpecNodeData.ts`) 이 인라인 style 을 읽어 `child.text.*` 로 옮기는 속성
 *
 * 표면(도달 여부)도 코드에서 읽는다:
 *   S1 DOM/Preview  — renderer root 의 `style={element.props.style}` 통과 (브라우저 cascade)
 *   S2 layout 폭 leg — `calculateContentWidth` 안의 `style?.X` / `computedStyle?.X`
 *   S3 layout wrap leg — `measureTextWithWhiteSpace` · `measureWrappedTextHeight` 의 파라미터 이름
 *   S4 Skia 텍스트 노드 — ADR-057 블록의 `style.X` (인라인 전용 — S4 상속 채널은 F20 으로 부재)
 *
 * 사용:
 *   node scripts/generate-text-axis-matrix.mjs          # 문서 갱신
 *   node scripts/generate-text-axis-matrix.mjs --check  # drift 만 검사 (preflight)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANVAS = "apps/builder/src/builder/workspace/canvas";
const SRC = {
  cssResolver: `${CANVAS}/layout/engines/cssResolver.ts`,
  layoutUtils: `${CANVAS}/layout/engines/utils.ts`,
  textMeasure: `${CANVAS}/utils/textMeasure.ts`,
  seam: `${CANVAS}/utils/textRenderStyle.ts`,
  skiaBuild: `${CANVAS}/skia/buildSpecNodeData.ts`,
};
const DOC = resolve(ROOT, "docs/adr/evidence/205-text-axis-gap-matrix.md");
const BEGIN = "<!-- text-axis-matrix:begin -->";
const END = "<!-- text-axis-matrix:end -->";

const readRaw = (rel) => readFileSync(resolve(ROOT, rel), "utf8");
const read = (rel) => stripComments(readRaw(rel));

/**
 * 주석을 지운다 — 주석 안의 `style.overflow` 같은 서술이 도달 판정으로 새는 것을 막는다.
 * 줄 수를 보존해야 라인 인용이 유지되므로 블록 주석은 개행만 남긴다.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:])\/\/[^\n]*/g,
      (m, p1) => p1 + " ".repeat(m.length - p1.length),
    );
}

/** 최상위 함수 본문 — 시그니처 시작부터 컬럼 0 의 닫는 중괄호까지. */
function topLevelFunction(src, name) {
  const start = src.indexOf(`export function ${name}(`);
  if (start < 0) throw new Error(`${name}: 정의를 찾지 못함`);
  const end = src.indexOf("\n}\n", start);
  if (end < 0) throw new Error(`${name}: 끝을 찾지 못함`);
  return src.slice(start, end + 2);
}

/** 함수 시그니처의 파라미터 이름 목록. */
function parameterNames(fnSrc) {
  let depth = 0;
  let params = null;
  for (let i = fnSrc.indexOf("("); i < fnSrc.length; i++) {
    if (fnSrc[i] === "(") depth++;
    else if (fnSrc[i] === ")") {
      depth--;
      if (depth === 0) {
        params = fnSrc.slice(fnSrc.indexOf("(") + 1, i);
        break;
      }
    }
  }
  if (params === null) throw new Error("파라미터 파싱 실패");
  return [...params.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*[?:]/g)].map(
    (m) => m[1],
  );
}

/** A. 상속 텍스트 속성 — `visibility` 는 텍스트 축이 아니라 제외한다. */
function inheritableTextProps(src) {
  const m = src.match(
    /export const INHERITABLE_PROPERTIES = new Set\(\[([\s\S]*?)\]\)/,
  );
  if (!m) throw new Error("INHERITABLE_PROPERTIES 파싱 실패");
  const all = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return all.filter((p) => p !== "visibility");
}

/**
 * B. ADR-057 블록이 인라인 style 을 읽어 `child.text.*` 로 옮기는 속성.
 *
 * 손 목록이 아니라 **쌍**으로 판정한다 — `style.X` 를 읽은 뒤 `child.text.` 에 쓰는
 * 근방 문장만 센다. `style.overflow` (clipText 파생원) 는 루프 밖에서 읽히므로 자연히 빠진다.
 */
function adr057BlockRegion(raw) {
  // 주석 제거는 길이를 보존하므로 (블록은 개행만 남기고 나머지는 공백) 두 문자열의 오프셋이 같다.
  // 마커는 주석 안에 있으므로 원본에서 찾고, 내용 판정은 주석을 지운 쪽에서 한다.
  const src = stripComments(raw);
  const marker = "Text style overrides (ADR-057";
  const at = raw.indexOf(marker);
  if (at < 0) throw new Error("ADR-057 블록 마커를 찾지 못함");
  const loopAt = src.indexOf("for (const child of specNode.children)", at);
  if (loopAt < 0) throw new Error("ADR-057 블록의 자식 루프를 찾지 못함");
  let depth = 0;
  let end = -1;
  for (let i = src.indexOf("{", loopAt); i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("ADR-057 블록의 끝을 찾지 못함");
  return src.slice(loopAt, end);
}

/** B 집합 — 블록이 `style.X` 를 읽고 `child.text.` 에 쓰는 근방 문장만 센다. */
function adr057BlockProps(raw) {
  const body = adr057BlockRegion(raw);
  const props = [];
  let pending = [];
  for (const line of body.split("\n")) {
    for (const m of line.matchAll(/\bstyle\.([A-Za-z][\w]*)/g))
      pending.push(m[1]);
    if (line.includes("child.text.")) {
      for (const p of pending) if (!props.includes(p)) props.push(p);
      pending = [];
    }
  }
  return props;
}

/** 측정 축 — `TextMeasureStyle` 이 선언하는 필드 (S2/S3 열의 적용 대상 판정). */
function measureStyleFields(src) {
  const m = src.match(/export interface TextMeasureStyle \{([\s\S]*?)\n\}/);
  if (!m) throw new Error("TextMeasureStyle 파싱 실패");
  return new Set(
    [...m[1].matchAll(/^\s{2}([A-Za-z][\w]*)\??:/gm)].map((x) => x[1]),
  );
}

/** S4 인라인 — Skia scene build 가 인라인 `style.X` / `style?.X` 를 읽는가. */
function skiaSources(dir) {
  return execFileSync("git", ["ls-files", `${dir}/*.ts`], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f && !f.includes(".test.") && !f.includes("__tests__"))
    .map((f) => read(f));
}

function skiaInlineReach(dir) {
  const props = new Set();
  for (const src of skiaSources(dir)) {
    for (const m of src.matchAll(/\bstyle\??\.([A-Za-z][\w]*)/g))
      props.add(m[1]);
    for (const m of src.matchAll(/\bexistingStyle\??\.([A-Za-z][\w]*)/g))
      props.add(m[1]);
  }
  return props;
}

/** S2 — `calculateContentWidth` 안의 인라인 / computed 참조. */
function widthLegReach(src) {
  const fn = topLevelFunction(src, "calculateContentWidth");
  const inline = new Set(
    [...fn.matchAll(/\bstyle\?\.([A-Za-z][\w]*)/g)].map((m) => m[1]),
  );
  const computed = new Set(
    [...fn.matchAll(/\bcomputedStyle\?\.([A-Za-z][\w]*)/g)].map((m) => m[1]),
  );
  return { inline, computed };
}

/** S3 — wrap/height leg 두 계층이 **받는** 축 (파라미터 이름). */
function wrapLegReach(layoutSrc, measureSrc) {
  const a = parameterNames(
    topLevelFunction(layoutSrc, "measureTextWithWhiteSpace"),
  );
  const b = parameterNames(
    topLevelFunction(measureSrc, "measureWrappedTextHeight"),
  );
  const norm = (n) => n.replace(/(Override|Val)$/, "");
  return new Set([...a, ...b].map(norm));
}

/** S4 상속 채널 — Skia scene build 에 `ComputedStyle` 이 존재하는가 (F20). */
function skiaHasComputedStyle(dir) {
  // 주석을 지운 소스에서만 본다 — 서술 주석("scene build 는 ComputedStyle 을 쥔 적이 없다")
  // 이 도달 판정으로 새는 것을 Phase 1 에서 실측했다.
  return skiaSources(dir).some((src) =>
    /ComputedStyle|resolveStyle\(/.test(src),
  );
}

/** seam 이 선언하는 축 — `*Source` 는 채널 표시이지 축이 아니다. */
function seamAxes(src) {
  const m = src.match(/export interface TextRenderStyle \{([\s\S]*?)\n\}/);
  if (!m) throw new Error("TextRenderStyle 파싱 실패");
  return new Set(
    [...m[1].matchAll(/^\s{2}([A-Za-z][\w]*)\??:/gm)]
      .map((x) => x[1])
      .filter((n) => !n.endsWith("Source")),
  );
}

/**
 * 표면이 seam 을 호출하는가 — 호출하면 seam 이 선언한 축 전부에 도달한 것이다.
 * 인자가 2개면 computed(상속) 채널까지, 1개면 인라인 채널만.
 *
 * 이 인지가 없으면 결선하는 순간 표가 ❌ 로 뒤집힌다 (속성별 배선만 보던 검출기의 사각).
 */
function seamCall(region) {
  const calls = [...region.matchAll(/resolveTextRenderStyle\(([^)]*)\)/g)];
  if (calls.length === 0) return null;
  return { inline: true, computed: calls.some((c) => c[1].includes(",")) };
}

/** S1 — Preview renderer 의 인라인 style 통과 지점 수 (F13). */
function domPassthroughCount() {
  try {
    const out = execFileSync(
      "grep",
      [
        "-rn",
        "style={element.props.style",
        resolve(ROOT, "packages/shared/src/renderers"),
      ],
      { encoding: "utf8" },
    );
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

export function buildMatrix() {
  const cssResolver = read(SRC.cssResolver);
  const layoutUtils = read(SRC.layoutUtils);
  const textMeasure = read(SRC.textMeasure);
  const skiaBuild = readRaw(SRC.skiaBuild);

  const setA = inheritableTextProps(cssResolver);
  const setB = adr057BlockProps(skiaBuild);
  const axes = seamAxes(read(SRC.seam));
  const skiaSeam = seamCall(adr057BlockRegion(skiaBuild));
  if (skiaSeam)
    for (const axis of axes) if (!setB.includes(axis)) setB.push(axis);
  const props = [...new Set([...setA, ...setB])].sort();

  const width = widthLegReach(layoutUtils);
  const wrap = wrapLegReach(layoutUtils, textMeasure);
  const skiaInline = skiaInlineReach(`${CANVAS}/skia`);
  const skiaInherits = skiaHasComputedStyle(`${CANVAS}/skia`);

  // seam 경유 도달 — 표면이 `resolveTextRenderStyle` 을 부르면 seam 축 전부에 닿는다.
  const widthSeam = seamCall(
    topLevelFunction(layoutUtils, "calculateContentWidth"),
  );
  for (const axis of axes) {
    if (widthSeam?.inline) width.inline.add(axis);
    if (widthSeam?.computed) width.computed.add(axis);
    if (skiaSeam?.inline) skiaInline.add(axis);
  }

  // 측정 축 = `TextMeasureStyle` 필드 ∪ 폭 leg 이 실제로 읽는 축.
  // 이 집합 밖(color·textDecoration·textShadow 등)은 줄 수·폭을 바꾸지 않으므로
  // S2/S3 열이 "해당 없음" 이다 — ❌ 로 세면 결손이 부풀려진다.
  const measureAxis = new Set([
    ...measureStyleFields(textMeasure),
    ...width.inline,
    ...width.computed,
  ]);

  const rows = props.map((p) => {
    const measures = measureAxis.has(p);
    return {
      property: p,
      inherited: setA.includes(p),
      measures,
      widthInline: measures ? width.inline.has(p) : null,
      widthComputed: measures ? width.computed.has(p) : null,
      wrap: measures ? wrap.has(p) : null,
      skiaInline: skiaInline.has(p),
      skiaComputed: skiaInherits,
      adr057: setB.includes(p),
    };
  });

  return {
    rows,
    setA,
    setB,
    skiaInherits,
    domPassthrough: domPassthroughCount(),
  };
}

const mark = (ok) => (ok === null ? "—" : ok ? "✅" : "❌");

function render(matrix) {
  const { rows, setA, setB, skiaInherits, domPassthrough } = matrix;
  const gaps = rows.filter(
    (r) => (r.measures && !r.wrap) || (r.measures && !r.skiaInline),
  );
  const lines = [];
  lines.push(
    "> 이 절은 `scripts/generate-text-axis-matrix.mjs` 가 코드에서 생성한다. 손으로 고치지 않는다.",
    "",
    `- 속성 집합 = A ∪ B — A: \`cssResolver.INHERITABLE_PROPERTIES\` 텍스트 항목 ${setA.length}개 (\`visibility\` 제외) · B: ADR-057 블록이 \`child.text.*\` 로 옮기는 인라인 속성 ${setB.length}개 → 합집합 **${rows.length}개**`,
    `- S1 DOM/Preview 는 renderer root 의 \`style={element.props.style}\` 통과 (${domPassthrough}곳 — F13) — 인라인 전 속성이 브라우저 cascade 로 도달하므로 열을 따로 두지 않는다`,
    `- S4 상속 채널: Skia scene build 의 \`ComputedStyle\` 참조 ${skiaInherits ? "있음" : "**0건**"} → 상속 축은 전 속성 미도달 (ADR-205 F20 · R7)`,
    "- **측정** 열이 `—` 인 속성은 줄 수·폭을 바꾸지 않아 S2/S3 가 해당 없다 (측정 축 = `TextMeasureStyle` 필드 ∪ 폭 leg 실참조)",
    "",
    "| 속성 | 상속 | 측정 축 | S2 폭 leg 인라인 | S2 폭 leg 상속 | S3 wrap leg | S4 Skia 인라인 | S4 Skia 상속 |",
    "| --- | :--: | :--: | :--: | :--: | :--: | :--: | :--: |",
  );
  for (const r of rows) {
    lines.push(
      `| \`${r.property}\` | ${r.inherited ? "상속" : "비상속"} | ${r.measures ? "측정" : "—"} | ${mark(r.widthInline)} | ${mark(r.widthComputed)} | ${mark(r.wrap)} | ${mark(r.skiaInline)}${r.adr057 ? " ⁽⁰⁵⁷⁾" : ""} | ${mark(r.skiaComputed)} |`,
    );
  }
  lines.push(
    "",
    "⁽⁰⁵⁷⁾ = ADR-057 블록(`buildSpecNodeData`)이 `child.text.*` 로 옮기는 축. 표식이 없는 ✅ 는 Skia scene build 의 다른 지점이 인라인 style 을 읽는다는 뜻.",
    "",
    `**결손 — 측정 축인데 wrap leg 또는 Skia 인라인에 미도달: ${gaps.length}개**`,
    "",
    ...(gaps.length
      ? gaps.map(
          (r) =>
            `- \`${r.property}\` — ${[!r.wrap && "S3 wrap leg", !r.skiaInline && "S4 Skia 인라인"].filter(Boolean).join(" · ")} 미도달`,
        )
      : ["- 없음"]),
  );
  return lines.join("\n");
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const isCheck = process.argv.includes("--check");
  const matrix = buildMatrix();
  const generated = render(matrix);
  const doc = readFileSync(DOC, "utf8");
  const a = doc.indexOf(BEGIN);
  const b = doc.indexOf(END);
  if (a < 0 || b < 0)
    throw new Error(`${DOC}: 마커 ${BEGIN} / ${END} 를 찾지 못함`);
  const raw = `${doc.slice(0, a + BEGIN.length)}\n\n${generated}\n\n${doc.slice(b)}`;
  // Prettier 가 표 정렬을 되돌리므로 생성 단계에서 같은 포맷터를 통과시킨다 —
  // 그래야 `--check` 가 커밋된 (포맷된) 문서와 어긋나지 않는다.
  const next = await format(raw, {
    ...((await resolveConfig(DOC)) ?? {}),
    filepath: DOC,
  });

  if (isCheck) {
    if (next !== doc) {
      console.error(
        "[text-axis-matrix] 문서가 코드와 어긋남 — `node scripts/generate-text-axis-matrix.mjs` 실행 후 커밋",
      );
      process.exit(1);
    }
    console.log(
      `[text-axis-matrix] OK — 속성 ${matrix.rows.length}개, drift 없음`,
    );
  } else {
    writeFileSync(DOC, next);
    console.log(
      `[text-axis-matrix] ${DOC} 갱신 — 속성 ${matrix.rows.length}개`,
    );
  }
}
