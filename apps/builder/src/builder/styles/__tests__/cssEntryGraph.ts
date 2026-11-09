/**
 * ADR-305 경계 게이트 지원 — HTML 진입 하나가 실제로 싣는 CSS 파일 집합.
 *
 * HTML 의 `<script type="module" src>` 진입 모듈부터 TS/JS import 를 정적으로 따라가며 (정적 · 동적 `import()`
 * 둘 다 — lazy chunk 의 CSS 도 같은 문서에 실린다, `import type` 제외) 만난 `.css` import 를 모으고, 그
 * CSS 의 `@import` 를 실제 파일로 펼친다 (`node_modules` 시트 포함). 배럴만 비교하지 않는다 (Decision 1).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import postcss from "postcss";

export const REPO = resolve(import.meta.dirname, "../../../../../..");
const BUILDER = join(REPO, "apps/builder");
const SHARED = join(REPO, "packages/shared/src");
const requireFromBuilder = createRequire(join(BUILDER, "package.json"));

const ALIASES: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^@\/(.*)$/, (m) => join(BUILDER, "src", m[1])],
  [
    /^@composition\/shared\/components\/styles\/(.*)$/,
    (m) => join(SHARED, "components/styles", m[1]),
  ],
  [
    /^@composition\/shared\/components\/(.*)$/,
    (m) => join(SHARED, "components", m[1]),
  ],
  [
    /^@composition\/shared\/(components|assets|utils|types|hooks)$/,
    (m) => join(SHARED, m[1], "index.ts"),
  ],
  [/^@composition\/shared$/, () => join(SHARED, "index.ts")],
  [/^@composition\/shared\/(.*)$/, (m) => join(SHARED, m[1])],
  [/^@composition\/publish$/, () => join(REPO, "apps/publish/src/index.ts")],
];

const EXT = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
];
function asFile(base: string): string | null {
  for (const ext of EXT) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

function resolveSpec(from: string, spec: string): string | null {
  const clean = spec.replace(/\?.*$/, "");
  if (clean.startsWith(".")) return asFile(resolve(dirname(from), clean));
  if (clean.startsWith("/")) return asFile(join(BUILDER, clean));
  for (const [re, to] of ALIASES) {
    const m = clean.match(re);
    if (m) return asFile(to(m));
  }
  if (clean.endsWith(".css")) {
    try {
      return requireFromBuilder.resolve(clean);
    } catch {
      return null;
    }
  }
  return null; // node_modules JS — 우리 CSS 를 싣지 않는다
}

const IMPORT_RE =
  /(?:^|[\s;])(?:import|export)\s+(?!type\b)(?:[^'"`;]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** CSS 파일 하나와 그 `@import` 를 펼친다 (cascade 순서). bare 패키지 import (`tailwindcss`) 는 `external:` 로. */
export function expandCss(
  file: string,
  out: string[] = [],
  seen = new Set<string>(),
): string[] {
  if (seen.has(file)) return out;
  seen.add(file);
  const root = postcss.parse(readFileSync(file, "utf8"), { from: file });
  root.walkAtRules("import", (at) => {
    const m = /^(?:url\()?\s*["']([^"']+)["']/.exec(at.params);
    if (!m) return;
    const target = m[1].startsWith(".")
      ? resolve(dirname(file), m[1])
      : (() => {
          try {
            const r = requireFromBuilder.resolve(m[1]);
            return r.endsWith(".css") ? r : null;
          } catch {
            return null;
          }
        })();
    if (!target || !existsSync(target)) {
      out.push(`external:${m[1]}`);
      return;
    }
    expandCss(target, out, seen);
  });
  out.push(file);
  return out;
}

/** HTML 진입 → 그 문서가 싣는 CSS 파일 (저장소 기준 상대 경로 · `external:*`). */
export function cssOfHtmlEntry(htmlPath: string): Set<string> {
  const html = readFileSync(htmlPath, "utf8");
  const scripts = [
    ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
  ].map((m) => join(BUILDER, m[1]));
  const seen = new Set<string>();
  const css = new Set<string>();
  const stack = [...scripts];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2];
      const target = resolveSpec(file, spec);
      if (!target) continue;
      if (target.endsWith(".css")) {
        for (const f of expandCss(target))
          css.add(f.startsWith("external:") ? f : relative(REPO, f));
      } else if (
        /\.(tsx?|m?js)$/.test(target) &&
        !/\.(test|spec)\.|__tests__/.test(target)
      ) {
        stack.push(target);
      }
    }
  }
  return css;
}

/**
 * 중립 시트 (Decision 1): 선언이 전부 `--*` 인 규칙 · `@font-face` · 그것을 감싼 `@layer` · `@layer` 순서
 * 문장 · 주석 · `@import` 만. 위반 문장을 돌려준다 (빈 배열 = 중립).
 */
export function nonNeutralStatements(file: string): string[] {
  const root = postcss.parse(readFileSync(join(REPO, file), "utf8"), {
    from: file,
  });
  const bad: string[] = [];
  const visit = (node: postcss.ChildNode) => {
    if (node.type === "comment") return;
    if (node.type === "atrule") {
      if (node.name === "import" || node.name === "font-face") return;
      if (node.name === "layer") {
        node.nodes?.forEach(visit);
        return;
      }
      bad.push(`@${node.name} ${node.params}`);
      return;
    }
    if (node.type === "rule") {
      for (const child of node.nodes) {
        if (child.type === "comment") continue;
        if (child.type !== "decl" || !child.prop.startsWith("--")) {
          bad.push(`${node.selector} { ${child.toString().slice(0, 60)} }`);
          return;
        }
      }
      return;
    }
    bad.push(node.toString().slice(0, 60));
  };
  root.nodes.forEach(visit);
  return bad;
}
