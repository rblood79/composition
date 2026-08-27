// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextMenuItem } from "../contextMenu/types";
import type { ActionBarModel } from "./actionBarPolicy";

const model: ActionBarModel = {
  context: "single",
  items: [
    { kind: "action", id: "duplicate", label: "복제", run: () => undefined },
    {
      kind: "action",
      id: "toggle-component-origin",
      label: "컴포넌트 만들기",
      run: () => undefined,
    },
  ] satisfies ContextMenuItem[],
};

vi.mock("./buildActionBarItems", () => ({
  buildActionBarItems: () => model,
  buildActionBarRequest: (ids: readonly string[]) => ({
    surface: "canvas-element",
    clientX: 0,
    clientY: 0,
    targetElementIds: [...ids],
  }),
}));

import { I18nProvider } from "@/i18n";
import { useStore } from "../../../stores";
import { ContextMenuProvider } from "../contextMenu";
import { ContextualActionBar } from "./ContextualActionBar";

function renderBar() {
  const canvas = document.createElement("div");
  canvas.className = "canvas-container";
  canvas.tabIndex = -1;
  document.body.appendChild(canvas);

  const rendered = render(
    <I18nProvider>
      <ContextMenuProvider>
        <div className="workspace-overlay">
          <ContextualActionBar />
        </div>
      </ContextMenuProvider>
    </I18nProvider>,
  );
  return { canvas, rendered };
}

beforeEach(() => {
  // jsdom 에는 ResizeObserver 가 없다 (PanelWorkspace.occupancy.test.tsx 와 같은
  // 패턴) — 바 배치 훅이 저장 offset clamp 에 쓴다
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useStore.setState({
    selectedElementIds: ["a"],
    selectedElementId: "a",
    elements: [],
    elementsMap: new Map([["a", { id: "a", type: "Button" }]]),
  } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  useStore.setState({
    selectedElementIds: [],
    selectedElementId: null,
    elementsMap: new Map(),
  } as never);
});

describe("ContextualActionBar — 키보드 규약 (ADR-192 R2)", () => {
  // 2026-08-27 code-review #2 — 버튼의 `data-scope="canvas"` 탓에 툴바 안에서
  // ←/→ 를 누를 때마다 `canvas-focused` 형제 재배치가 함께 발화했다.
  it("버튼은 canvas scope 를 선언하지 않고 루트가 global 을 선언한다", () => {
    renderBar();

    const bar = document.querySelector(".contextual-action-bar");
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("data-shortcut-scope")).toBe("global");
    expect(bar!.querySelectorAll('[data-scope="canvas"]')).toHaveLength(0);
  });

  // 2026-08-27 code-review #7 — 바 여백·gap·separator 는 포커스를 받을 수 없어
  // 클릭 시 캔버스가 포커스를 잃고 body 로 떨어졌다. 그 순간 canvas-focused
  // 단축키(⌫ · 화살표 · ⌘G …) 가 통째로 침묵한다.
  it("바 chrome 을 클릭해도 캔버스 포커스가 유지된다", () => {
    const { canvas } = renderBar();
    canvas.focus();
    expect(document.activeElement).toBe(canvas);

    const bar = document.querySelector(".contextual-action-bar")!;
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    bar.dispatchEvent(event);

    // 기본 포커스 이동이 막혀야 한다 (click 자체는 그대로 발화)
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(canvas);
  });

  // 2026-08-27 code-review #8 — Escape 가 전역 핸들러로 흘러 선택이 풀리면 바
  // 자체가 언마운트돼 키보드 사용자는 툴바를 떠날 방법이 없었다.
  it("Escape 는 선택을 유지한 채 캔버스로 포커스를 되돌린다", () => {
    const { canvas } = renderBar();

    const button = screen.getByRole("button", { name: "복제" });
    button.focus();
    expect(document.activeElement).toBe(button);

    fireEvent.keyDown(button, { key: "Escape" });

    expect(document.activeElement).toBe(canvas);
    expect(useStore.getState().selectedElementIds).toEqual(["a"]);
  });
});
