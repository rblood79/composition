import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-09 속성 감사 (사용자 「5번 주석 정리」): binding 주석이 지워진 renderer · factory · spec ·
 * 파이프라인을 지금 쓰이는 것처럼 인용하고 있었다 (343곳). 그 이름들이 다시 들어오면 실패한다 —
 * 지금의 소비자는 `runtime/delegatedDom.tsx` · `domBinding.tsx` (DOM) 와 catalog rule ·
 * `presence.ts` · `compositionRoot.ts` (Canvas) 다.
 */
const BINDINGS = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEAD = [
  /\bbuildSpecNodeData\b/,
  /\bisSpecOrCatalogBacked\b/,
  /\bKNOWN_HTML\b/,
  /\bresolveGenericHtmlTag\b/,
  /\bresolveLabelAlignment\b/,
  /\bresolveParentLabelText\b/,
  /\brendererMap\b/,
  /\bisCatalogSkiaCutover\b/,
  /\bCONTAINER_DIMENSION_TAGS\b/,
  /\bappend\w+RowProjection\b/,
  /\b(Layout|Form|Display|Navigation|Overlay)Renderers\.tsx\b/,
  /\b(Layout|Form|Display|Navigation|Overlay)Components\.ts\b/,
  /\b[A-Z]\w+\.spec\.ts\b/,
  // (render + a component name — the old per-type renderers; not the live `renderCatalogDom`,
  // `renderFacetDeclaration` module or a RAC `renderProps` list.)
  /\brender(?!Facet|Props\b|CatalogDom\b)[A-Z]\w+\b/,
];

/** The comment text of a source file (line and block comments). */
const commentsOf = (source: string) =>
  [...source.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)].map((match) => match[0]);

describe("binding 주석은 지워진 심볼을 인용하지 않는다", () => {
  const files = readdirSync(BINDINGS).filter((name) => name.endsWith(".ts"));
  it.each(files)("%s", (name) => {
    const comments = commentsOf(readFileSync(join(BINDINGS, name), "utf8"));
    const hits = comments.flatMap((comment) =>
      DEAD.flatMap((pattern) => {
        const found = pattern.exec(comment);
        return found ? [found[0]] : [];
      }),
    );
    expect(hits).toEqual([]);
  });
});
