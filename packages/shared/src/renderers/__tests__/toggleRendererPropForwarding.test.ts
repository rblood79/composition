/**
 * design-data 감사 §1-2 축③ (2026-08-21) — toggle 계열 delegating renderer 의 prop 전달 계약.
 *
 * **결손**: `renderToggleButton` 이 `isQuiet` / `staticColor` 를 shared 컴포넌트로 넘기지
 * 않아, D2 표면·catalog·CSS 가 모두 갖춰진 뒤에도 **DOM(Preview/publish) 경로에서만** 두
 * prop 이 dead 였다. Skia 는 canonical props 를 직접 읽으므로 CSS↔Skia 비대칭이 된다
 * (감사 §1-1 "표면 단절" 과 같은 결함 축이되 지점이 renderer).
 *
 * 계약: root JSX props 에 해당 키가 canonical props 값 그대로 실린다.
 */

import { describe, it, expect } from "vitest";
import { isValidElement } from "react";

import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import {
  renderToggleButton,
  renderToggleButtonGroup,
} from "../CollectionRenderers";

function makeContext(
  elements: PreviewElement[],
  childrenByParent: Map<string, PreviewElement[]> = new Map(),
): RenderContext {
  return {
    elements,
    elementsById: new Map(elements.map((e) => [e.id, e])),
    childrenByParent,
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

function rootProps(node: unknown): Record<string, unknown> {
  return isValidElement(node)
    ? (node.props as Record<string, unknown>)
    : ({} as Record<string, unknown>);
}

describe("toggle renderer prop forwarding (§1-2 축③)", () => {
  it("renderToggleButton 이 isQuiet / staticColor 를 전달", () => {
    const el: PreviewElement = {
      id: "tb-1",
      type: "ToggleButton",
      props: { isQuiet: true, staticColor: "black", children: "A" },
    };
    const props = rootProps(renderToggleButton(el, makeContext([el])));
    expect(props.isQuiet).toBe(true);
    expect(props.staticColor).toBe("black");
  });

  it("renderToggleButton 미지정 시 staticColor 는 auto 기본값", () => {
    const el: PreviewElement = {
      id: "tb-2",
      type: "ToggleButton",
      props: { children: "A" },
    };
    const props = rootProps(renderToggleButton(el, makeContext([el])));
    expect(props.staticColor).toBe("auto");
    expect(props.isQuiet).toBe(false);
  });

  it("renderToggleButtonGroup 이 staticColor 를 전달 (자식 상속 채널 진입점)", () => {
    const el: PreviewElement = {
      id: "tbg-1",
      type: "ToggleButtonGroup",
      props: { staticColor: "white" },
    };
    const props = rootProps(renderToggleButtonGroup(el, makeContext([el])));
    expect(props.staticColor).toBe("white");
  });
});
