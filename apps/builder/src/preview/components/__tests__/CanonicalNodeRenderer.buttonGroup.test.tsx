import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "@composition/shared";
import { rendererMap } from "@composition/shared/renderers";

import { DELEGATING_INTERNAL_RENDERERS } from "../CanonicalNodeRenderer";

/**
 * ButtonGroup self-compose 위임 회귀 가드 (2026-06-27 live 적발 → 수정).
 *
 * **회귀 근본**: ButtonGroup 은 FAMILY_1 catalog cutover 라 generic `cutoverPrimitives` 경로로
 * 들어간다. `renderButtonGroup`(LayoutRenderers)이 `context.childrenByParent.get(element.id)` 로
 * 자식 Button×2(factory 자동 생성: Cancel outline / Save accent)를 self-compose 하는 wrapper 다.
 *
 * binding `source.renderer` 가 `"div"` 로 남아 있으면 `DELEGATING_INTERNAL_RENDERERS`
 * (`binding.source.renderer` lowercase 기준 매칭)에 들지 못해 delegating 분기를 못 타고,
 * `INTERNAL_RENDERERS["div"]` 도 undefined 라 generic fall-through(`rendererMap.ButtonGroup`)로
 * 빠진다. 이 경로는 `flattenNodeChildrenByParent` 보강을 안 주므로 canonical Preview 의
 * `childrenByParent` 가 비어 `children = []` → 자식 Button 통째 미렌더 → 빈 `<div>` 만 그려진다
 * (Skia 는 자식 Button 직접 렌더 → CSS↔Skia 비대칭, "Preview 렌더링 안 됨" 증상).
 *
 * TableView(2026-06-25) / Card 패밀리(2026-06-24) 가 같은 버그를 `renderer:"div"→고유 id` +
 * renderFacetDeclaration delegating-internal 등록으로 해소한 선례와 동형. ButtonGroup 만 누락됐다.
 */
describe("CanonicalNodeRenderer — ButtonGroup self-compose DELEGATING 위임", () => {
  it("ButtonGroup binding 은 internal source + 고유 renderer id ('div' 금지)", () => {
    const binding = getPrimitiveBinding("ButtonGroup");
    expect(binding?.source.kind, "ButtonGroup binding source.kind").toBe(
      "internal",
    );
    if (binding?.source.kind === "internal") {
      // "div" 면 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을 못 타 generic fall-through →
      //   childrenByParent 보강 누락 → 자식 Button 미렌더 (TableView 선례).
      expect(
        binding.source.renderer,
        "ButtonGroup renderer 가 'div' → delegating 위임 불가 → 자식 미렌더 회귀",
      ).not.toBe("div");
    }
  });

  it("ButtonGroup renderer 가 DELEGATING_INTERNAL_RENDERERS 에 등록", () => {
    const binding = getPrimitiveBinding("ButtonGroup");
    expect(binding?.source.kind).toBe("internal");
    if (binding?.source.kind === "internal") {
      expect(
        DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer),
        `ButtonGroup (renderer="${binding.source.renderer}") 가 DELEGATING_INTERNAL_RENDERERS 에 누락 → generic fall-through → childrenByParent 빈 배열 → 자식 Button 미렌더`,
      ).toBe(true);
    }
  });

  it("delegating 분기가 위임하는 rendererMap.ButtonGroup(self-compose renderer) 존재", () => {
    // delegating 분기는 rendererMap[adaptedEl.type](PascalCase type) 를 호출한다.
    expect(
      rendererMap.ButtonGroup,
      "rendererMap.ButtonGroup 누락 → delegating 위임 대상 없음",
    ).toBeTypeOf("function");
  });
});
