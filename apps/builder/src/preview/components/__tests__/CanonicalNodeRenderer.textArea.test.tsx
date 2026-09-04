import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";
import { DELEGATING_RAC_RENDERERS } from "../canonicalRendererRegistry";

/**
 * TextArea 가 진짜 `<textarea>` 로 렌더되는지 (2026-08-21 신설).
 *
 * **Why**: 이전에는 catalog generic 경로가 `RAC.TextField` 를 그리고 그 안에 factory 가 만든
 * canonical `Input` 자식이 들어가 DOM 이 **한 줄 `<input>`** 이었다 — 이름이 TextArea 인데
 * 여러 줄이 아니었고 `rows` 가 시각에 반영되지 않았다. RAC 에는 TextArea **컨테이너**
 * primitive 가 없고 `<TextField>` 안에 `<TextArea>` control 을 넣는 것이 D1 계약이라,
 * TextField 선례대로 wrapper self-compose(`delegating-rac`) 로 처리한다.
 *
 * 컨테이너 클래스는 `react-aria-TextField` 그대로여야 한다 — D1(RAC) 권위이고 생성 CSS 도
 * 그 이름으로 나온다. `.react-aria-TextArea` 는 RAC 가 **안쪽 `<textarea>`** 에 쓰는 이름이라
 * 컨테이너에 재사용하면 나중에 엉뚱한 요소에 걸린다.
 */

const ctx = {
  updateElementProps: () => {},
  childrenByParent: new Map(),
  renderElement: () => null,
} as unknown as RenderContext;

function renderTextAreaNode(props: Record<string, unknown>) {
  const node: ResolvedNode = { id: "ta-1", type: "TextArea", props };
  return render(
    <CanonicalNodeRenderer
      node={node}
      renderContext={ctx}
      cutoverPrimitives={new Set(["TextArea"])}
    />,
  );
}

describe("CanonicalNodeRenderer — TextArea 여러 줄 control", () => {
  it("TextArea 는 delegating-rac 로 등록돼 있다 — 빠지면 한 줄 input 회귀", () => {
    expect(DELEGATING_RAC_RENDERERS.has("TextArea")).toBe(true);
  });

  it("control 이 <textarea> 이고 rows 가 전달된다", () => {
    const { container } = renderTextAreaNode({ label: "Text Area", rows: 5 });
    const control = container.querySelector("textarea");
    expect(control).not.toBeNull();
    expect(control?.getAttribute("rows")).toBe("5");
    // 한 줄 <input> 이 남아 있으면 구 경로 회귀다.
    expect(container.querySelector("input")).toBeNull();
  });

  it("rows 미지정 시 기본 3줄", () => {
    const { container } = renderTextAreaNode({ label: "Text Area" });
    expect(container.querySelector("textarea")?.getAttribute("rows")).toBe("3");
  });

  it("컨테이너는 .react-aria-TextField, control 만 .react-aria-TextArea", () => {
    const { container } = renderTextAreaNode({ label: "Text Area" });
    const root = container.querySelector(".react-aria-TextField");
    expect(root).not.toBeNull();
    expect(root?.classList.contains("react-aria-TextArea")).toBe(false);
    expect(
      root
        ?.querySelector("textarea")
        ?.classList.contains("react-aria-TextArea"),
    ).toBe(true);
  });

  it("data-size / data-label-position / data-quiet 를 wrapper 가 직접 emit 한다", () => {
    // delegating 경로는 toRacProps 투영기를 타지 않는다 — 여기서 빠지면 theme CSS 가 통째로 죽는다.
    const { container } = renderTextAreaNode({
      label: "L",
      size: "lg",
      labelPosition: "side",
      isQuiet: true,
    });
    const root = container.querySelector(".react-aria-TextField");
    expect(root?.getAttribute("data-size")).toBe("lg");
    expect(root?.getAttribute("data-label-position")).toBe("side");
    expect(root?.getAttribute("data-quiet")).toBe("true");
  });

  it("quiet 이 꺼져 있으면 data-quiet 를 붙이지 않는다 — 존재 셀렉터가 걸리면 안 된다", () => {
    const { container } = renderTextAreaNode({ label: "L" });
    expect(
      container
        .querySelector(".react-aria-TextField")
        ?.hasAttribute("data-quiet"),
    ).toBe(false);
  });

  it("label / placeholder 가 DOM 에 도달한다", () => {
    const { container } = renderTextAreaNode({
      label: "설명",
      placeholder: "여기에 입력",
    });
    expect(container.querySelector("label")?.textContent).toContain("설명");
    expect(
      container.querySelector("textarea")?.getAttribute("placeholder"),
    ).toBe("여기에 입력");
  });
});
