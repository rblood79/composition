import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-05 감사 L8 — stage ResizeObserver 는 지금 마운트된 트리의 stage 를 본다.
 *
 * 레이아웃이 store 에 이미 있으면 (같은 세션의 두 번째 프로젝트 진입) 첫 렌더는 stageRect 가
 * 없어 fallback 트리이고, 측정 뒤 hydrated 트리로 바뀌며 stage DOM 이 교체된다. effect 가
 * `[isHydrated]` 에만 반응해 떨어져 나간 fallback stage 를 계속 관찰했고, stageRect · registry
 * 의 `maxWidth: "100%"` 가 창 크기를 따라가지 않았다.
 */
describe("PanelWorkspaceContent stage observer", () => {
  it("effect 가 마운트된 트리 (hydrated · fallback) 가 바뀔 때 다시 관찰한다", async () => {
    const source = await readFile(
      resolve(__dirname, "PanelWorkspace.tsx"),
      "utf8",
    );
    const start = source.indexOf("const observer = new ResizeObserver(updateRect);");
    const deps = source.slice(start, source.indexOf("]);", start) + 3);
    expect(deps).toContain("}, [hydratedTree]);");
    expect(source).toContain(
      "const hydratedTree = workspaceLayout !== null && stageRect !== null;",
    );
  });
});
