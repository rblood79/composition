// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../../stores";
import { useActionBarPlacement } from "./useActionBarPlacement";

/**
 * 2026-08-27 code-review #4 / #11.
 *
 * jsdom 은 레이아웃이 없어 `getBoundingClientRect` 가 전부 0 이고
 * `ResizeObserver` 도 없다. 둘 다 여기서 세운다 — 검증 대상은 "언제 clamp 가
 * 다시 도는가" 와 "commit 이 어느 단계에서 일어나는가" 지 clamp 수식이 아니다
 * (수식은 `actionBarPlacement.test.ts` 가 순수 함수로 고정).
 */
type Rect = { width: number; height: number };

// 요소 identity 가 아니라 data-testid 로 잰다 — 바 DOM 은 렌더 뒤에야 생기는데
// 크기는 그 전에 정해 둬야 "마운트 시점 clamp" 를 볼 수 있다
const rects = new Map<string, Rect>();
let observers: Array<{ targets: Element[]; cb: () => void }> = [];

function setRect(testId: string, rect: Rect) {
  rects.set(testId, rect);
}

function fireResize() {
  observers.forEach((o) => o.cb());
}

// `useStore.setState` 는 새 state 객체를 만들면서 mock 함수까지 복사한다 —
// `vi.restoreAllMocks()` 가 복원한 것은 버려진 옛 객체라, 원본 참조를 잡아 두고
// 매 테스트 앞에서 명시적으로 되돌린다 (canvasActions.test.ts 와 같은 이유).
const originalSetActionBarOffset = useStore.getState().setActionBarOffset;

beforeEach(() => {
  observers = [];
  rects.clear();
  useStore.setState({
    setActionBarOffset: originalSetActionBarOffset,
  } as never);

  vi.stubGlobal(
    "ResizeObserver",
    class {
      private entry: { targets: Element[]; cb: () => void };
      constructor(cb: () => void) {
        this.entry = { targets: [], cb };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.targets.push(target);
      }
      disconnect() {
        observers = observers.filter((o) => o !== this.entry);
      }
      unobserve() {}
    },
  );

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const id = this.getAttribute?.("data-testid") ?? "";
      const r = rects.get(id) ?? { width: 0, height: 0 };
      return {
        ...r,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );

  useStore.setState({
    actionBar: { hidden: false, pinned: false, offset: { dx: 9999, dy: 0 } },
  } as never);
});

afterEach(() => {
  // vitest globals 미사용이라 RTL auto-cleanup 이 등록되지 않는다
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 실제 바처럼 "모델이 있을 때만" 루트를 그리는 소비자 */
function Harness({ visible }: { visible: boolean }) {
  const placement = useActionBarPlacement();
  if (!visible) return null;
  return (
    <div data-testid="overlay">
      <div
        data-testid="bar"
        ref={placement.barRef}
        {...placement.handleProps}
      />
    </div>
  );
}

describe("useActionBarPlacement — 저장 offset clamp (R4)", () => {
  it("바가 나타난 뒤에 clamp 가 실행된다 (마운트 시점에는 잴 것이 없다)", () => {
    const setActionBarOffset = vi.spyOn(
      useStore.getState(),
      "setActionBarOffset",
    );

    setRect("bar", { width: 200, height: 40 });
    setRect("overlay", { width: 1000, height: 600 });

    // 선택 0 / 편집 중 — 바 DOM 없음
    const view = render(<Harness visible={false} />);
    expect(setActionBarOffset).not.toHaveBeenCalled();

    // 요소를 선택해 바가 나타남 — clamp 는 ResizeObserver 전달을 기다리지 않고
    // 그 시점에 바로 돈다 (hidden 탭에서 RO 콜백이 멈추는 실측 때문)
    view.rerender(<Harness visible />);

    // dx 9999 는 overlay 밖 → 안으로 잘려 store 에 다시 기록된다
    expect(setActionBarOffset).toHaveBeenCalledTimes(1);
    expect(setActionBarOffset.mock.calls[0][0]).toEqual({ dx: 400, dy: 0 });
  });

  it("바 폭이 커지면(컨텍스트 전환) 다시 clamp 한다", () => {
    // store 를 실제로 바꾸지 않아야 effect 가 재실행되지 않고 — 즉 "바 크기
    // 변화만으로" 다시 clamp 되는지를 본다
    const setActionBarOffset = vi
      .spyOn(useStore.getState(), "setActionBarOffset")
      .mockImplementation(() => {});

    setRect("overlay", { width: 1000, height: 600 });
    setRect("bar", { width: 200, height: 40 }); // single(2항목)
    render(<Harness visible />);
    expect(setActionBarOffset.mock.calls.at(-1)?.[0]).toEqual({
      dx: 400,
      dy: 0,
    });

    setRect("bar", { width: 300, height: 40 }); // multi(4항목) — 바가 넓어짐
    act(() => {
      fireResize();
    });
    expect(setActionBarOffset.mock.calls.at(-1)?.[0]).toEqual({
      dx: 350,
      dy: 0,
    });
  });
});

describe("useActionBarPlacement — 드래그 commit (#11)", () => {
  it("commit 은 setState updater 밖(핸들러 본문)에서 일어난다", () => {
    useStore.setState({
      actionBar: { hidden: false, pinned: false, offset: null },
    } as never);
    setRect("bar", { width: 200, height: 40 });
    setRect("overlay", { width: 1000, height: 600 });
    const view = render(<Harness visible />);
    const bar = view.getByTestId("bar");

    const setActionBarOffset = vi.spyOn(
      useStore.getState(),
      "setActionBarOffset",
    );
    // updater 안에서 store 를 쓰면 React 가 render phase 갱신으로 경고한다
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const pointer = (type: string, x: number) =>
      act(() => {
        const event = new MouseEvent(type, {
          bubbles: true,
          clientX: x,
          clientY: 0,
          button: 0,
        }) as MouseEvent & { pointerId?: number };
        event.pointerId = 1;
        bar.setPointerCapture = () => {};
        bar.hasPointerCapture = () => false;
        bar.dispatchEvent(event);
      });

    pointer("pointerdown", 500);
    pointer("pointermove", 460);
    pointer("pointerup", 460);

    expect(setActionBarOffset).toHaveBeenCalledTimes(1);
    expect(setActionBarOffset.mock.calls[0][0]).toEqual({ dx: -40, dy: 0 });
    expect(
      consoleError.mock.calls.filter((call) =>
        String(call[0]).includes("while rendering a different component"),
      ),
    ).toHaveLength(0);
  });
});
