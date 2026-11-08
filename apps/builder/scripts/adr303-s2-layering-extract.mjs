/**
 * ADR-303 Phase 0 (G0) — 설치된 `@react-spectrum/s2` 의 `src/*.tsx` 에서 층 · 그림자 · 테두리 선언을 뽑는다.
 * oracle = 설치본 소스, 손 표 금지 (리뷰 h1: 파일 전체 속성이 아니라 style 심볼과 실제 바인딩 대상까지).
 *
 * 각 `style(...)` 호출 (심볼 `let|const X = style(` 또는 JSX 안 inline) 의 객체 리터럴을 괄호 균형으로 읽어
 * 최상위 키 중 아래 PROPS 만 남긴다. 값은 문자열 리터럴 → 문자열, 조건 객체 → { 조건: 값 } (재귀),
 * 그 밖의 식 (`lightDark('a', 'b')`) → 원문 문자열. 심볼의 사용처 (`className={X(` · `X(` 호출) 는
 * 가장 가까운 앞쪽 JSX 태그 이름과 줄 번호로 남긴다.
 *
 *   node apps/builder/scripts/adr303-s2-layering-extract.mjs           # fixture 갱신
 *   node apps/builder/scripts/adr303-s2-layering-extract.mjs --check   # 설치본 ≠ fixture 면 exit 1
 *
 * 출력: packages/shared/src/catalog/__tests__/fixtures/adr303-s2-layering.json
 *   { s2Version, files: { "Popover.tsx": [ { symbol, line, boundTo: [{ tag, line }], props: { … } } ] } }
 *
 * S2 버전을 올릴 때는 apps/builder/package.json 의 고정 버전과 이 fixture 를 같은 커밋에서 고친다.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const builderDir = resolve(here, "..");
const repoRoot = resolve(builderDir, "../..");
const require = createRequire(join(builderDir, "package.json"));
const s2Dir = dirname(require.resolve("@react-spectrum/s2/package.json"));
const s2Version = JSON.parse(
  readFileSync(join(s2Dir, "package.json"), "utf8"),
).version;
const outFile = join(
  repoRoot,
  "packages/shared/src/catalog/__tests__/fixtures/adr303-s2-layering.json",
);

/** 배정표 (ADR-303 Context 표 · breakdown 2a · 2b) 가 인용하는 파일. */
const FILES = [
  "Popover.tsx",
  "Modal.tsx",
  "Dialog.tsx",
  "Tooltip.tsx",
  "Card.tsx",
  "Toast.tsx",
  "TableView.tsx",
  "ActionBar.tsx",
  "Menu.tsx",
  "ListBox.tsx",
  "Avatar.tsx",
  "TreeView.tsx",
  "Badge.tsx",
  "InlineAlert.tsx",
  "TagGroup.tsx",
  "Divider.tsx",
  "Link.tsx",
  "DropZone.tsx",
  "Provider.tsx",
];
const PROPS = new Set([
  "--s2-container-bg",
  "backgroundColor",
  "boxShadow",
  "filter",
  "fill",
  "outlineColor",
  "outlineWidth",
  "outlineStyle",
  "borderColor",
  "borderWidth",
]);

const OPEN = { "(": ")", "{": "}", "[": "]" };

/** `src[start]` 이 여는 괄호일 때 짝 닫는 괄호의 위치. 문자열 · 템플릿 · 주석은 건너뛴다. */
function matchClose(src, start) {
  const stack = [OPEN[src[start]]];
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 1;
      continue;
    }
    if (OPEN[c]) stack.push(OPEN[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) return i;
    }
  }
  throw new Error(`unbalanced at ${start}`);
}
function skipString(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] === q) return j;
  }
  throw new Error(`unterminated string at ${i}`);
}

/** 객체 리터럴 본문 (`{` · `}` 제외) 을 최상위 `key: value` 쌍으로 자른다. spread 는 `...` 키. */
function topLevelEntries(body) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'" || c === '"' || c === "`") {
      const j = skipString(body, i);
      cur += body.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === "/" && body[i + 1] === "/") {
      const j = body.indexOf("\n", i);
      i = j === -1 ? body.length : j;
      continue;
    }
    if (OPEN[c]) depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    if (c === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  const out = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (p.startsWith("...")) {
      out.push(["...", p.slice(3).trim()]);
      continue;
    }
    const m = /^('([^']*)'|"([^"]*)"|([A-Za-z_$][\w$-]*))\s*:\s*([\s\S]*)$/.exec(
      p,
    );
    if (!m) continue;
    out.push([m[2] ?? m[3] ?? m[4], m[5].trim()]);
  }
  return out;
}

function parseValue(text) {
  const t = text.trim();
  const s = /^'([^']*)'$|^"([^"]*)"$/.exec(t);
  if (s) return s[1] ?? s[2];
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith("{") && matchClose(t, 0) === t.length - 1) {
    const obj = {};
    for (const [k, v] of topLevelEntries(t.slice(1, -1))) obj[k] = parseValue(v);
    return obj;
  }
  return t.replace(/\s+/g, " ");
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

function extractFile(name) {
  const src = readFileSync(join(s2Dir, "src", name), "utf8");
  const entries = [];
  const re = /\bstyle\s*(<|\()/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length - 1;
    if (src[i] === "<") {
      // 제네릭 타입 인자 — `<` `>` 균형 (`=>` 는 화살표라 세지 않는다)
      let depth = 0;
      for (; i < src.length; i++) {
        if (src[i] === "<") depth++;
        else if (src[i] === ">" && src[i - 1] !== "=" && --depth === 0) break;
      }
      i = src.slice(i + 1).search(/\S/) + i + 1;
      if (src[i] !== "(") continue;
    }
    const objStart = src.slice(i + 1).search(/\S/) + i + 1;
    if (src[objStart] !== "{") continue;
    const objEnd = matchClose(src, objStart);
    const head = src.slice(Math.max(0, m.index - 80), m.index);
    const sym = /(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(head)?.[1];
    const props = {};
    for (const [k, v] of topLevelEntries(src.slice(objStart + 1, objEnd))) {
      if (PROPS.has(k)) props[k] = parseValue(v);
    }
    re.lastIndex = objEnd;
    if (Object.keys(props).length === 0) continue;
    const line = lineOf(src, m.index);
    entries.push({
      symbol: sym ?? `inline@${line}`,
      line,
      boundTo: sym ? usages(src, sym, m.index) : [enclosingTag(src, m.index)],
      props,
    });
  }
  // style() 밖의 조건 객체 상수 (`const rowBackgroundColor = { … } as const`) 중 컨테이너 배경을 읽는 것
  const cre = /(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  while ((m = cre.exec(src))) {
    const objStart = src.indexOf("{", m.index);
    const objEnd = matchClose(src, objStart);
    const text = src.slice(objStart, objEnd + 1);
    cre.lastIndex = objEnd;
    if (!text.includes("--s2-container-bg")) continue;
    entries.push({
      symbol: m[1],
      kind: "const",
      line: lineOf(src, m.index),
      boundTo: usages(src, m[1], m.index).map(({ line }) => ({ tag: "(ref)", line })),
      props: { value: parseValue(text) },
    });
  }
  return entries;
}

/** 심볼 사용처 — 정의 밖의 `sym(` · `sym}` · `sym,` 등장 → 가장 가까운 앞쪽 JSX 태그. */
function usages(src, sym, defIdx) {
  const out = [];
  const re = new RegExp(`(?<![\\w$.'"-])${sym}(?=\\s*[(}),])`, "g");
  let m;
  while ((m = re.exec(src))) {
    if (m.index >= defIdx && m.index < defIdx + sym.length + 40) continue;
    const tag = enclosingTag(src, m.index);
    if (tag) out.push(tag);
  }
  return out;
}
function enclosingTag(src, idx) {
  const before = src.slice(Math.max(0, idx - 1500), idx);
  const tags = [...before.matchAll(/<([A-Z][\w.]*|[a-z]+)(?=[\s>])/g)];
  const last = tags[tags.length - 1];
  if (!last) return null;
  return {
    tag: last[1],
    line: lineOf(src, Math.max(0, idx - 1500) + last.index),
  };
}

const result = { s2Version, files: {} };
for (const f of FILES) result.files[f] = extractFile(f);
const json = JSON.stringify(result, null, 2) + "\n";

if (process.argv.includes("--check")) {
  const cur = readFileSync(outFile, "utf8");
  if (cur !== json) {
    console.error(`adr303-s2-layering.json ≠ 설치 S2 ${s2Version} — 생성기로 갱신`);
    process.exit(1);
  }
  console.log(`adr303-s2-layering.json = 설치 S2 ${s2Version}`);
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, json);
  const n = Object.values(result.files).reduce((a, e) => a + e.length, 0);
  console.log(`wrote ${outFile} (S2 ${s2Version}, style 블록 ${n})`);
}
