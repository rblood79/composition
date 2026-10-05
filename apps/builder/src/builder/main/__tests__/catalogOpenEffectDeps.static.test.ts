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

  // 2026-10-05 감사 L2 — 취소된 실행은 page source 를 등록하지 않고, dispose 된 workspace 를
  // 열지 않는다 (cleanup 이 await 도중 돌면 등록 해제가 영영 일어나지 않았다).
  it("page source 등록 · open 확정 전에 취소를 확인한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../CatalogBuilderCore.tsx"),
      "utf8",
    );
    const register = source.indexOf(
      "restorePageSource = registerVariableOwnerPageSource(",
    );
    const beforeRegister = source.slice(source.indexOf("stage(75);"), register);
    expect(beforeRegister).toContain("if (cancelled) return;");
    const setOpen = source.indexOf('kind: "open",');
    const beforeOpen = source.slice(
      source.indexOf("__COMPOSITION_CATALOG__ ="),
      setOpen,
    );
    expect(beforeOpen).toContain("if (cancelled) return;");
  });
});
