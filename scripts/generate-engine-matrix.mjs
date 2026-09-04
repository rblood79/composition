#!/usr/bin/env node
/**
 * `docs/CSS_SUPPORT_MATRIX.md` 의 엔진 절을 코드에서 생성한다.
 *
 * 정본은 `apps/builder/src/builder/workspace/canvas/layout/engines/layoutCapabilityMatrix.ts` —
 * 엔진이 CSS 의미를 그대로 구현하지 않는 자리를 property × value 로 선언하고, 값마다 Chrome 격차
 * 케이스를 실측 고정한다 (`tests/parity/adr923CapabilityMatrixSeed.browser.test.ts` 가 수치를 지킨다).
 *
 * 그 파일은 import 0 인 자족 모듈이라 정규식으로 읽는다 — builder 모듈 그래프 (canvaskit · store) 를
 * 끌어오지 않으려는 의도적 선택이다 (EXTERNAL_PATTERN_DELTA_2026-09 §A5-5).
 *
 * 사용:
 *   node scripts/generate-engine-matrix.mjs          # 문서 갱신
 *   node scripts/generate-engine-matrix.mjs --check  # drift 만 검사 (preflight)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(
  ROOT,
  "apps/builder/src/builder/workspace/canvas/layout/engines/layoutCapabilityMatrix.ts",
);
const DOC = resolve(ROOT, "docs/CSS_SUPPORT_MATRIX.md");
const BEGIN = "<!-- engine-matrix:begin -->";
const END = "<!-- engine-matrix:end -->";

/** `layoutCapabilityMatrix.ts` 의 행을 파싱한다. 문자열 리터럴은 ' " ` 세 종류 모두 나온다. */
function parseRows(src) {
  const body = src.slice(src.indexOf("LAYOUT_CAPABILITY_MATRIX"));
  const rows = [];
  const idRe = /\n\s{4}id:\s*"(S\d)"/g;
  const starts = [];
  let m;
  while ((m = idRe.exec(body)) !== null) starts.push({ id: m[1], at: m.index });
  for (let i = 0; i < starts.length; i++) {
    const chunk = body.slice(starts[i].at, starts[i + 1]?.at ?? body.length);
    rows.push({
      id: starts[i].id,
      property: field(chunk, "property"),
      value: field(chunk, "value"),
      engineSupport: field(chunk, "engineSupport"),
      policy: field(chunk, "policy"),
      behavior: field(chunk, "behavior"),
      followUp: field(chunk, "followUp"),
      oracles: [...chunk.matchAll(/caseId:\s*"([^"]+)"/g)].map((o, idx) => ({
        caseId: o[1],
        gap: gapAt(chunk, idx),
      })),
    });
  }
  return rows;
}

function field(chunk, name) {
  const re = new RegExp(`${name}:\\s*(?:\\n\\s*)?("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`);
  const m = chunk.match(re);
  if (!m) throw new Error(`layoutCapabilityMatrix: ${name} 파싱 실패`);
  const raw = m[1];
  return raw
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

function gapAt(chunk, idx) {
  const gaps = [...chunk.matchAll(
    /gap:\s*\{\s*dx:\s*(-?[\d.]+),\s*dy:\s*(-?[\d.]+),\s*dw:\s*(-?[\d.]+),\s*dh:\s*(-?[\d.]+)\s*\}/g,
  )];
  const g = gaps[idx];
  if (!g) throw new Error(`layoutCapabilityMatrix: oracle ${idx} 의 gap 파싱 실패`);
  return { dx: +g[1], dy: +g[2], dw: +g[3], dh: +g[4] };
}

/** 셀 안에서 표를 깨뜨리는 문자만 escape 한다. */
function cell(text) {
  return text.replace(/\|/g, "\\|").replace(/\n\s*/g, " ").trim();
}

function render(rows) {
  const lines = [
    BEGIN,
    "",
    "<!-- 이 블록은 `node scripts/generate-engine-matrix.mjs` 가 생성한다. 직접 편집하지 말 것 —",
    "     정본은 layout/engines/layoutCapabilityMatrix.ts, drift 는 codex:preflight 가 잡는다. -->",
    "",
    "| 자리 | 속성 | 값 | 엔진 구현 | 경계 정책 | 미지원 시 동작 | Chrome 격차 (px) | 후속 |",
    "| ---- | ---- | -- | --------- | --------- | -------------- | ---------------- | ---- |",
  ];
  for (const r of rows) {
    const gaps = r.oracles
      .map((o) => `\`${o.caseId}\` dx ${o.gap.dx} · dy ${o.gap.dy} · dw ${o.gap.dw} · dh ${o.gap.dh}`)
      .join("<br>");
    lines.push(
      `| ${r.id} | \`${cell(r.property)}\` | ${cell(r.value)} | ${r.engineSupport} | ${r.policy} | ${cell(r.behavior)} | ${gaps} | ${cell(r.followUp)} |`,
    );
  }
  lines.push(
    "",
    "**정책 어휘** — `pass`: 값이 경계에 실리고 엔진이 그 의미로 구현한다 · `declared-substitution`: 값이",
    "경계에 실리지만 엔진이 다른 의미로 치환한다 (치환 내용은 동작 열) · `ignored`: 속성이 `EngineStyle` /",
    "Rust `StyleInput` 에 없어 어댑터가 싣지 않는다 — 엔진은 읽을 기회조차 없다.",
    "",
    "격차 수치는 `apps/builder/tests/parity/adr923CapabilityMatrixSeed.browser.test.ts` 가 DOM leg",
    "(`getBoundingClientRect`) ↔ production 파이프라인 (`calculateFullTreeLayout`) 으로 고정한다. 수치가",
    "바뀌면 테스트가 RED 로 알린다 — 표를 유리하게 바꿔 격차를 줄이는 방향은 금지 (수리 결과로만 갱신).",
    "",
    END,
  );
  return lines.join("\n");
}

const rows = parseRows(readFileSync(SOURCE, "utf8"));
const block = render(rows);
const doc = readFileSync(DOC, "utf8");
const b = doc.indexOf(BEGIN);
const e = doc.indexOf(END);
if (b === -1 || e === -1) {
  console.error(`[engine-matrix] ${DOC} 에 ${BEGIN} / ${END} 마커가 없다.`);
  process.exit(1);
}
const next = doc.slice(0, b) + block + doc.slice(e + END.length);

if (process.argv.includes("--check")) {
  if (next !== doc) {
    console.error(
      "[engine-matrix] DRIFT — docs/CSS_SUPPORT_MATRIX.md 의 엔진 절이 layoutCapabilityMatrix.ts 와 다르다.\n" +
        "  고치기: node scripts/generate-engine-matrix.mjs",
    );
    process.exit(1);
  }
  console.log(`[engine-matrix] OK — ${rows.length} 행 일치`);
} else {
  writeFileSync(DOC, next);
  console.log(`[engine-matrix] 생성 — ${rows.length} 행`);
}
