/**
 * ADR-158 Phase 3 — catalog generic 경로의 인터랙션 **트리거** 배선.
 *
 * **Why (2026-08-16 라이브 실측)**: `createEventHandlerMap` 을 호출하는 곳이
 * `rendererMap` 계열 renderer 14곳뿐이라, catalog cutover 116 타입은 규칙을
 * 등재해도 콜백이 컴포넌트에 **아예 전달되지 않았다** — Link 의 RAC fiber props
 * 에 `on*` 이 하나도 없었다. 대상 축의 `accepts` 결손(→ `capabilityBindingReach`)
 * 과 같은 형태이고, 두 축 모두 dispatcher 는 멀쩡한데 배선만 끊긴 모습이라
 * "규칙을 만들었는데 아무 일도 없다" 로만 보인다.
 *
 * cutover 타입이 곧 사용자가 실제로 누르는 것들(Button/Link/Checkbox/Switch/
 * Select …)이라, 이 경로가 끊기면 인터랙션 기능 전체가 사실상 죽는다.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

function ctxWithHandlers(
  handlers: Record<string, (e: Event) => void>,
  spy?: (elementId: string) => void,
): RenderContext {
  return {
    services: {
      createEventHandlerMap: (element: { id: string }) => {
        spy?.(element.id);
        return handlers;
      },
    },
  } as unknown as RenderContext;
}

describe("catalog generic 경로 — 인터랙션 트리거 배선", () => {
  it("services 가 준 콜백이 cutover 컴포넌트까지 도달한다", () => {
    const onPress = vi.fn();
    const node: ResolvedNode = {
      id: "btn-trigger",
      type: "Button",
      props: { children: "OK" },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctxWithHandlers({
          onPress: onPress as unknown as (e: Event) => void,
        })}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );

    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    btn?.click();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("요소 id 로 조회한다 — 규칙은 요소별이다", () => {
    const spy = vi.fn();
    render(
      <CanonicalNodeRenderer
        node={{ id: "link-1", type: "Link", props: { children: "About" } }}
        renderContext={ctxWithHandlers({}, spy)}
        cutoverPrimitives={new Set(["Link"])}
      />,
    );
    expect(spy).toHaveBeenCalledWith("link-1");
  });

  it("catalog prop 이 트리거 콜백을 덮지 않는다", () => {
    // `toRacProps` 결과 뒤에 펼쳐야 한다. 순서가 뒤집히면 같은 이름의 catalog
    // prop 이 있을 때 콜백이 조용히 사라진다.
    const onPress = vi.fn();
    const { container } = render(
      <CanonicalNodeRenderer
        node={{
          id: "btn-order",
          type: "Button",
          props: { children: "OK", onPress: "stale-string-value" },
        }}
        renderContext={ctxWithHandlers({
          onPress: onPress as unknown as (e: Event) => void,
        })}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );
    container.querySelector("button")?.click();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("services 미공급(publish 등)이어도 렌더가 깨지지 않는다", () => {
    const { container } = render(
      <CanonicalNodeRenderer
        node={{ id: "btn-plain", type: "Button", props: { children: "OK" } }}
        renderContext={{} as unknown as RenderContext}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );
    expect(container.querySelector("button")?.textContent).toBe("OK");
  });
});
