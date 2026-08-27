// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useActiveScope } from "./useActiveScope";

/**
 * 2026-08-27 code-review #2 — ADR-192 액션 바 버튼이 `data-scope="canvas"` 를
 * 달고 있어, 키보드로 툴바에 진입한 뒤 ←/→ 로 버튼을 옮기면 `canvas-focused`
 * 의 형제 재배치가 함께 동작해 문서 순서가 바뀌었다. 오버레이가 자기 스코프를
 * 선언하면 캔버스 추론보다 우선한다.
 */
function mount(html: string, focusSelector: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  const target = host.querySelector<HTMLElement>(focusSelector);
  const hook = renderHook(() => useActiveScope());
  act(() => {
    target?.focus();
  });
  return { hook, host };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useActiveScope — data-shortcut-scope 선언", () => {
  it("캔버스 컨테이너 안의 포커스는 canvas-focused", () => {
    const { hook } = mount(
      `<div class="canvas-container" tabindex="-1"><button id="t">x</button></div>`,
      "#t",
    );
    expect(hook.result.current).toBe("canvas-focused");
  });

  it("자기 스코프를 선언한 오버레이 안에서는 선언 값이 이긴다", () => {
    const { hook } = mount(
      `<div class="canvas-container" tabindex="-1">
         <div data-shortcut-scope="global"><button id="t">x</button></div>
       </div>`,
      "#t",
    );
    expect(hook.result.current).toBe("global");
  });

  it("요소 자신의 data-scope=canvas 보다도 선언 스코프가 우선한다", () => {
    const { hook } = mount(
      `<div data-shortcut-scope="global">
         <button id="t" data-scope="canvas">x</button>
       </div>`,
      "#t",
    );
    expect(hook.result.current).toBe("global");
  });

  // 2026-08-27 code-review #13 — `data-panel-id` emitter 가 없어 이 단계가 늘
  // 건너뛰어졌고, 좌측 레이어 트리에 포커스를 둬도 "보이는 첫 우측 패널"
  // 폴백(panel:styles 등)이 잡혔다.
  it("포커스가 있는 패널이 폴백보다 우선한다", () => {
    const { hook } = mount(
      `<div data-panel-id="nodes"><div role="treeitem" tabindex="0" id="t">x</div></div>`,
      "#t",
    );
    expect(hook.result.current).toBe("panel:nodes");
  });

  it("알 수 없는 값은 무시하고 기존 추론으로 돌아간다", () => {
    const { hook } = mount(
      `<div class="canvas-container" tabindex="-1">
         <div data-shortcut-scope="not-a-scope"><button id="t">x</button></div>
       </div>`,
      "#t",
    );
    expect(hook.result.current).toBe("canvas-focused");
  });
});
