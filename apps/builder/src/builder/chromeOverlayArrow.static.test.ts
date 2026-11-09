/**
 * 빌더 chrome 오버레이에 화살표 없음 (2026-11-10 사용자 지시 「react-aria-OverlayArrow 는 필수가 아니니 제거」).
 *
 * (a) 빌더 소스는 RAC `OverlayArrow` 를 그리지 않는다 — 툴팁 (`ActionTooltip`) 포함.
 * (b) 공용 `Popover` (`@composition/shared/components/Popover` — 기본이 화살표 있음) 를 쓰는 빌더 자리는
 *     `hideArrow` 를 준다.
 * 사용자 컴포넌트 (catalog Tooltip · Popover 의 화살표 — ADR-256) 는 대상이 아니다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const BUILDER = import.meta.dirname;
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === "__tests__"
        ? []
        : walk(join(dir, e.name))
      : /\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );

describe("빌더 chrome 오버레이 — 화살표 없음", () => {
  const files = walk(BUILDER);
  it("(a) 빌더 JSX 에 OverlayArrow 0", () => {
    const hits = files.filter((f) => /<OverlayArrow[\s>]/.test(readFileSync(f, "utf8")));
    expect(hits.map((f) => relative(BUILDER, f))).toEqual([]);
  });
  it("(b) 공용 Popover 를 쓰는 자리마다 hideArrow", () => {
    const missing: string[] = [];
    let found = 0;
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      if (!text.includes('"@composition/shared/components/Popover"')) continue;
      const src = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText() === "Popover"
        ) {
          found += 1;
          const has = node.attributes.properties.some(
            (p) => ts.isJsxAttribute(p) && p.name.getText() === "hideArrow",
          );
          if (!has)
            missing.push(
              `${relative(BUILDER, f)}:${src.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
            );
        }
        ts.forEachChild(node, visit);
      };
      visit(src);
    }
    expect(found).toBeGreaterThan(3);
    expect(missing).toEqual([]);
  });
});
