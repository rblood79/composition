/**
 * 빌더 native 폼 컨트롤 가드 (2026-11-10, 패널 감사 4) — 빌더 JSX 는 `<button>` · `<input>` · `<textarea>` ·
 * `<select>` 를 직접 쓰지 않고 RAC (`Button` · `ToggleButton` · `Input` · `TextArea` · `FileTrigger` · 공용
 * `Checkbox` · `PanelSelect`) 를 쓴다. 허용 목록은 RAC 로 옮길 수 없는 자리만, 사유와 함께.
 *
 * Why: native 컨트롤은 hover · focus-visible · pressed 상태를 RAC 의 data-* 로 내지 않아 CSS 가 `:hover` ·
 * `:focus` 로 따로 적었고, 키보드 · 터치 누름이 RAC 버튼과 달랐다 (예: Image fill 미리보기의 div onClick 은
 * 키보드로 열 수 없었다). 감사 당시 50 파일 · 약 100 곳이었다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const BUILDER = import.meta.dirname;
const NATIVE = new Set(["button", "input", "textarea", "select"]);

/** `파일 → 태그별 개수` 와 사유 */
const ALLOWED: Record<string, { tags: Record<string, number>; why: string }> = {
  "layout/PanelWorkspace.tsx": {
    tags: { button: 1 },
    why: "패널 이동 손잡이 — useMove 끌기 + 포인터 좌표 capture (RAC Button 은 누름으로 포인터를 가져간다)",
  },
  "workspace/canvas/catalog/CatalogGridTrackLayer.tsx": {
    tags: { button: 2 },
    why: "Canvas 위 grid 트랙 · 교체 손잡이 — setPointerCapture 끌기",
  },
  "workspace/canvas/catalog/CatalogTextEditor.tsx": {
    tags: { textarea: 1 },
    why: "Canvas 글자 편집기 — 글자 노드 위에 겹쳐 그 글꼴 · 크기로 그린다",
  },
  "workspace/canvas/overlay/pageHeader/PageHeaderLayer.components.tsx": {
    tags: { input: 1 },
    why: "Canvas 페이지 제목 편집 — 캔버스 좌표에 겹친다",
  },
  "panels/datatable/grid/DataGrid.components.tsx": {
    tags: { input: 1 },
    why: "file input — 표 메뉴 항목 (CSV 가져오기) 이 연다. FileTrigger 는 누를 자식이 필요하다",
  },
  "main/BuilderHeader.tsx": {
    tags: { input: 1 },
    why: "file input — 헤더 메뉴 항목 (프로젝트 가져오기) 이 연다",
  },
};

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

function nativeTags(file: string): Record<string, number> {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const out: Record<string, number> = {};
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText();
      if (NATIVE.has(name)) out[name] = (out[name] ?? 0) + 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return out;
}

describe("빌더 native 폼 컨트롤 — RAC 로", () => {
  const found: Record<string, Record<string, number>> = {};
  for (const f of walk(BUILDER)) {
    const tags = nativeTags(f);
    if (Object.keys(tags).length) found[relative(BUILDER, f)] = tags;
  }
  it("native 컨트롤이 있는 파일 = 허용 목록 (태그 · 개수까지)", () => {
    expect(found).toEqual(
      Object.fromEntries(
        Object.entries(ALLOWED).map(([file, { tags }]) => [file, tags]),
      ),
    );
  });
});
