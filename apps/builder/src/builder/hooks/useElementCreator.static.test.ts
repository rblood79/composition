import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 컴포넌트 패널 추가(handleAddElement) 후 동작 계약 가드.
 *
 * 두 가지 회귀를 방지한다:
 *
 * 1. **auto-select**: 추가된 최상위 요소를 즉시 선택해야 한다. 미선택 시 selection 이
 *    직전 상태(보통 body)에 머물러 추가 직후 Delete 가 body 가드에 걸린다.
 *
 * 2. **canvas focus**: auto-select 직후 `.canvas-container` 에 DOM 포커스를 옮겨야
 *    한다. setSelectedElement 는 store selection 만 갱신하고 포커스는 클릭한 팔레트
 *    카드(BUTTON.list-item)에 남는다. Delete/Backspace 단축키 scope 는
 *    "canvas-focused" (= document.activeElement 가 .canvas-container 내부)이므로,
 *    포커스를 옮기지 않으면 추가 직후 바로 Delete 가 핸들러 scope 필터에서 탈락해
 *    동작하지 않는다 (사용자가 캔버스를 다시 클릭해야만 삭제 가능하던 증상).
 */
describe("useElementCreator add-then-delete contract", () => {
  it("auto-selects the created top-level element and focuses the canvas container", async () => {
    const source = await readFile(
      resolve(__dirname, "useElementCreator.ts"),
      "utf-8",
    );

    const selectIndex = source.indexOf(
      "useStore.getState().setSelectedElement(createdTopLevelId);",
    );
    // 캔버스 포커스는 `useActiveScope` 의 helper 를 경유한다 — scope 판정과 같은
    // 셀렉터 정본(`CANVAS_CONTAINER_SELECTOR`)을 읽는다
    const focusCallIndex = source.indexOf(
      "focusCanvasContainer({ preventScroll: true });",
    );

    // auto-select 호출 존재
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    // 캔버스 포커스가 auto-select 뒤에 온다 (선택 후 포커스)
    expect(focusCallIndex).toBeGreaterThan(selectIndex);
  });

  it("each operation branch returns the created top-level id for auto-select", async () => {
    const source = await readFile(
      resolve(__dirname, "useElementCreator.ts"),
      "utf-8",
    );

    // ref / complex / simple 세 분기가 모두 최상위 id 를 반환해야 createdTopLevelId 가
    // 채워진다 (반환 누락 시 auto-select skip → body 잔류).
    expect(source).toContain("return refElement.id;");
    expect(source).toContain("return result.parent.id;");
    expect(source).toContain("return newElement.id;");
  });
});
