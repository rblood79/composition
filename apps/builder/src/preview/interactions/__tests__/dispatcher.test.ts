// @vitest-environment node
/**
 * ADR-158 Phase 3 — dispatcher 실행 계약.
 *
 * G2 게이트의 4종(navigate / toast / hide·show / modal open)을 **DOM 없이** 먼저
 * 고정한다. 라이브 확증은 Chrome MCP 로 따로 하지만, 여기서 실패하면 라이브에서도
 * 실패하므로 진단이 훨씬 싸다.
 */
import { describe, expect, it, vi } from "vitest";
import type { InteractionRule } from "@composition/shared";
import { executeInteractionRule, type DispatchDeps } from "../dispatcher";
import { buildInteractionIndex, createElementHandlers } from "../bindings";

function makeDeps(
  elements: Record<string, { type: string; props: Record<string, unknown> }>,
): DispatchDeps & {
  patches: Array<{ id: string; props: Record<string, unknown> }>;
  navigations: string[];
  toasts: string[];
} {
  const patches: Array<{ id: string; props: Record<string, unknown> }> = [];
  const navigations: string[] = [];
  const toasts: string[] = [];
  return {
    patches,
    navigations,
    toasts,
    getElement: (id) => elements[id],
    updateElementProps: (id, props) => {
      patches.push({ id, props });
      elements[id] = {
        ...elements[id],
        props: { ...elements[id].props, ...props },
      };
    },
    navigate: (path) => navigations.push(path),
    showToast: (message) => toasts.push(message),
  };
}

function rule(action: InteractionRule["action"]): InteractionRule {
  return {
    id: "r1",
    type: "interaction",
    elementId: "btn",
    trigger: "onPress",
    action,
  };
}

describe("G2 4종 — 앱 액션", () => {
  it("navigate 는 router 로 경로를 넘긴다", () => {
    const deps = makeDeps({});
    const outcome = executeInteractionRule(
      rule({ kind: "navigate", params: { path: "/page-2" } }),
      deps,
    );

    expect(outcome).toEqual({ ok: true, kind: "navigate" });
    expect(deps.navigations).toEqual(["/page-2"]);
  });

  it("toast 는 큐에 메시지를 넣는다", () => {
    const deps = makeDeps({});
    const outcome = executeInteractionRule(
      rule({ kind: "toast", params: { message: "저장됨" } }),
      deps,
    );

    expect(outcome).toEqual({ ok: true, kind: "toast" });
    expect(deps.toasts).toEqual(["저장됨"]);
  });
});

describe("G2 4종 — capability patch", () => {
  it("hide 는 style.display 를 none 으로 patch 한다", () => {
    const deps = makeDeps({ card: { type: "Card", props: {} } });
    const outcome = executeInteractionRule(
      rule({ kind: "capability", targetId: "card", capability: "hide" }),
      deps,
    );

    expect(outcome).toEqual({ ok: true, kind: "capability" });
    expect(deps.patches).toEqual([
      { id: "card", props: { style: { display: "none" } } },
    ]);
  });

  it("show 는 display 키를 제거한다 (남겨 두면 none 이 유지된다)", () => {
    const deps = makeDeps({
      card: { type: "Card", props: { style: { display: "none", gap: 8 } } },
    });
    executeInteractionRule(
      rule({ kind: "capability", targetId: "card", capability: "show" }),
      deps,
    );

    expect(deps.patches[0].props).toEqual({ style: { gap: 8 } });
  });

  it("modal open 은 isOpen 을 true 로 patch 한다", () => {
    const deps = makeDeps({
      m: { type: "Modal", props: { isOpen: false } },
    });
    const outcome = executeInteractionRule(
      rule({ kind: "capability", targetId: "m", capability: "open" }),
      deps,
    );

    expect(outcome).toEqual({ ok: true, kind: "capability" });
    expect(deps.patches).toEqual([{ id: "m", props: { isOpen: true } }]);
  });
});

describe("patch 규칙", () => {
  it("style patch 는 기존 스타일을 보존한다", () => {
    const deps = makeDeps({
      card: { type: "Card", props: { style: { gap: 8, padding: 12 } } },
    });
    executeInteractionRule(
      rule({ kind: "capability", targetId: "card", capability: "hide" }),
      deps,
    );

    expect(deps.patches[0].props).toEqual({
      style: { gap: 8, padding: 12, display: "none" },
    });
  });

  it("toggle 은 현재값 유무로 뒤집는다", () => {
    const deps = makeDeps({ card: { type: "Card", props: {} } });
    const toggle = rule({
      kind: "capability",
      targetId: "card",
      capability: "toggle",
    });

    executeInteractionRule(toggle, deps);
    expect(deps.patches[0].props).toEqual({ style: { display: "none" } });

    executeInteractionRule(toggle, deps);
    expect(deps.patches[1].props).toEqual({ style: {} });
  });

  it("컴포넌트 고유 capability 가 공통 키를 덮는다", () => {
    // Modal 은 open/close 를 갖고, 공통 show/hide 도 함께 쓸 수 있어야 한다
    const deps = makeDeps({ m: { type: "Modal", props: {} } });
    executeInteractionRule(
      rule({ kind: "capability", targetId: "m", capability: "hide" }),
      deps,
    );
    expect(deps.patches[0].props).toEqual({ style: { display: "none" } });
  });
});

describe("실패는 삼키지 않는다", () => {
  it("대상 요소가 없으면 사유를 돌려준다", () => {
    const deps = makeDeps({});
    expect(
      executeInteractionRule(
        rule({ kind: "capability", targetId: "gone", capability: "hide" }),
        deps,
      ),
    ).toEqual({ ok: false, reason: "대상 요소 없음: gone" });
  });

  it("미등재 capability 는 no-op 이 아니라 실패다", () => {
    const deps = makeDeps({ b: { type: "Button", props: {} } });
    const outcome = executeInteractionRule(
      rule({ kind: "capability", targetId: "b", capability: "selectItem" }),
      deps,
    );

    expect(outcome.ok).toBe(false);
    expect(deps.patches).toEqual([]);
  });

  it("값이 필요한 capability 에 params 가 없으면 실패다", () => {
    const deps = makeDeps({
      lb: { type: "ListBox", props: {} },
    });
    const outcome = executeInteractionRule(
      rule({ kind: "capability", targetId: "lb", capability: "selectItem" }),
      deps,
    );

    expect(outcome).toEqual({
      ok: false,
      reason: "capability 가 값을 요구하나 params 가 없다",
    });
  });

  it("navigate 에 path 가 없으면 이동하지 않는다", () => {
    const deps = makeDeps({});
    const outcome = executeInteractionRule(
      rule({ kind: "navigate", params: { path: "" } }),
      deps,
    );

    expect(outcome.ok).toBe(false);
    expect(deps.navigations).toEqual([]);
  });
});

describe("bindings — 색인과 callback", () => {
  it("elementId·trigger 로 색인하고 구 스키마 entry 는 걸러낸다", () => {
    const index = buildInteractionIndex([
      rule({ kind: "toast", params: { message: "a" } }),
      { id: "legacy", type: "event", elementId: "btn", eventType: "onClick" },
      { ...rule({ kind: "toast", params: { message: "b" } }), id: "r2" },
    ]);

    expect(index.get("btn")?.get("onPress")).toHaveLength(2);
    expect(index.size).toBe(1);
  });

  it("한 trigger 의 규칙을 선언 순서대로 전부 실행한다", () => {
    const deps = makeDeps({});
    const index = buildInteractionIndex([
      rule({ kind: "toast", params: { message: "first" } }),
      { ...rule({ kind: "toast", params: { message: "second" } }), id: "r2" },
    ]);

    createElementHandlers("btn", index, deps).onPress();
    expect(deps.toasts).toEqual(["first", "second"]);
  });

  it("규칙 없는 요소는 같은 빈 객체를 돌려준다 (memo 보존)", () => {
    const deps = makeDeps({});
    const index = buildInteractionIndex([]);
    expect(createElementHandlers("x", index, deps)).toBe(
      createElementHandlers("y", index, deps),
    );
  });

  it("실행 결과를 관찰자에게 알린다 (조용한 실패 방지)", () => {
    const deps = makeDeps({});
    const onOutcome = vi.fn();
    const index = buildInteractionIndex([
      rule({ kind: "navigate", params: { path: "" } }),
    ]);

    createElementHandlers("btn", index, deps, onOutcome).onPress();
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1" }),
      expect.objectContaining({ ok: false }),
    );
  });
});
