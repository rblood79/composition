/**
 * CanvasSelectionShortcutsHost — 핸들러 안정성 회귀 게이트 (2026-09-02 leak).
 *
 * 호스트는 mutation 마다 재렌더된다 (`elementsById` 즉시, `selectedElement` 는
 * useDeferredValue 라 한 렌더 늦게). 핸들러가 렌더별 값을 직접 캡처하면 렌더마다
 * 일부 useCallback 만 재생성되고, memo 로 살아남은 클로저가 직전 렌더 context 를
 * 잡는 V8 shared-context 사슬이 렌더 수만큼 자랐다 (실측: mutation 당 elements
 * view 1개 영구 보유, `scripts/perf-baseline.mjs --mode retainers`).
 *
 * 사슬의 필요조건은 "렌더 사이에 재생성되는 memo 클로저" 이므로, 값이 번갈아
 * 바뀌는 렌더를 여러 번 돌려도 registry 에 넘기는 shortcuts 배열과 keydown
 * 리스너가 첫 렌더의 참조 그대로인지를 고정한다.
 */
import { act, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registryCalls: unknown[][] = [];

// 호스트는 memo 라 같은 props 로 root.render 를 반복해도 재렌더가 없다 — 실제처럼
// 구독 값이 바뀌어 호스트 안에서 재렌더가 일어나도록 작은 external store 를 쓴다.
function createCell<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    use: () =>
      useSyncExternalStore(
        (l) => (listeners.add(l), () => listeners.delete(l)),
        () => value,
      ),
    set: (next: T) => {
      value = next;
      listeners.forEach((l) => l());
    },
  };
}
const elementsByIdCell = createCell(
  new Map<
    string,
    { id: string; type: string; props: Record<string, unknown> }
  >(),
);
const selectedElementCell = createCell<{
  id: string;
  style?: Record<string, unknown>;
} | null>(null);

vi.mock("../../stores", () => ({
  useStore: Object.assign(() => undefined, {
    getState: () => ({
      currentPageId: "page-1",
      selectedElementIds: [],
      selectedElementId: null,
      multiSelectMode: false,
      setSelectedElement: () => {},
      setSelectedElements: () => {},
      getPageElements: () => [],
    }),
  }),
  useDebouncedSelectedElementData: () => selectedElementCell.use(),
}));

vi.mock("@/builder/hooks", () => ({
  bindHandlersToDefinitions: (
    ids: string[],
    handlers: Record<string, unknown>,
  ) => ids.map((id) => ({ key: id, handler: handlers[id] })),
  useKeyboardShortcutsRegistry: (...args: unknown[]) => {
    registryCalls.push(args);
  },
  useActiveScope: () => "canvas-focused",
}));

vi.mock("./hooks/useCanonicalPropertyRead", () => ({
  useCanonicalPropertyElementsMap: () => elementsByIdCell.use(),
}));

vi.mock("../styles/hooks/useStyleActions", () => ({
  useStyleActions: () => ({
    copyStyles: async () => {},
    pasteStyles: async () => {},
  }),
}));

vi.mock("../../workspace/canvas/actions/canvasActions", () => ({
  alignSelection: async () => {},
  copySelection: async () => {},
  distributeSelection: async () => {},
  duplicateSelection: async () => {},
  groupSelection: async () => {},
  paste: async () => {},
  ungroupSelection: async () => {},
}));

import { CanvasSelectionShortcutsHost } from "./CanvasSelectionShortcuts";

describe("CanvasSelectionShortcutsHost 핸들러 안정성", () => {
  let container: HTMLDivElement;
  let root: Root;
  let addSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registryCalls.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    addSpy = vi.spyOn(window, "addEventListener");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    addSpy.mockRestore();
  });

  it("elementsById 와 selectedElement 가 번갈아 바뀌는 렌더에서도 shortcuts 참조와 keydown 등록이 첫 렌더 그대로다", () => {
    const render = () =>
      act(() => root.render(<CanvasSelectionShortcutsHost />));
    render();
    expect(registryCalls.length).toBeGreaterThan(0);
    const firstShortcuts = registryCalls[0][0];
    const keydownRegistrations = () =>
      addSpy.mock.calls.filter((call: unknown[]) => call[0] === "keydown")
        .length;
    const firstKeydownCount = keydownRegistrations();
    expect(firstKeydownCount).toBeGreaterThan(0);

    const rendersBefore = registryCalls.length;
    for (let i = 0; i < 6; i += 1) {
      // mutation: 새 elements view (즉시 반영)
      act(() =>
        elementsByIdCell.set(
          new Map([[`el-${i}`, { id: `el-${i}`, type: "Text", props: {} }]]),
        ),
      );
      // deferred: 한 렌더 늦게 바뀌는 선택 데이터
      act(() =>
        selectedElementCell.set({ id: `el-${i}`, style: { width: `${i}px` } }),
      );
    }
    // 재렌더가 실제로 일어났는지 (memo bailout 이면 이 게이트는 무의미)
    expect(registryCalls.length).toBeGreaterThanOrEqual(rendersBefore + 12);

    for (const call of registryCalls) expect(call[0]).toBe(firstShortcuts);
    expect(keydownRegistrations()).toBe(firstKeydownCount);
  });
});
