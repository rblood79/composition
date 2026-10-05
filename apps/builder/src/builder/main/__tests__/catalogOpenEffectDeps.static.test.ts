import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-05 감사 M2 — 언어를 바꿔도 프로젝트를 다시 열지 않는다.
 *
 * open effect 의 cleanup 은 workspace 를 dispose 한다 (세션 · 히스토리 · autosave 구독).
 * `t` 는 locale 이 바뀌면 identity 가 바뀌므로 deps 에 두면 언어 변경이 곧 재오픈이 되어
 * undo 스택 · 현재 페이지 · 선택이 사라진다. 실패 문구는 최신 `t` 를 ref 로 읽는다.
 */
describe("CatalogBuilderCore open effect", () => {
  it("deps 는 route 와 open 횟수뿐이다", async () => {
    const source = await readFile(
      resolve(__dirname, "../CatalogBuilderCore.tsx"),
      "utf8",
    );
    const start = source.indexOf("let opened: CatalogWorkspace | undefined;");
    const effect = source.slice(start, source.indexOf("}, [", start) + 40);
    expect(effect).toContain("}, [routeId, openCount]);");
    expect(effect).toContain("const t = tRef.current;");
  });
});
