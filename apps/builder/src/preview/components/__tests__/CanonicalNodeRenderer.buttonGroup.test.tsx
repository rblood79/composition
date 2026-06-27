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

/**
 * ButtonGroup 동형 self-compose 컨테이너 전수 가드 (2026-06-27 grep 감사).
 *
 * ButtonGroup fix(ac0646f98) 후 같은 패턴 누락을 전수 grep 한 결과 AvatarGroup / CardView /
 * Pagination 3종이 동일 버그였다 — factory 가 자식(Avatar×3 / Card×3 / Button×5)을 자동 생성하고
 * `render{Type}` 가 `context.childrenByParent.get(element.id)` 로 그 자식을 `children.map(renderElement)`
 * 렌더하는 self-compose 컨테이너인데, binding `source.renderer="div"` + delegating 미등록이라
 * generic fall-through 로 빠져 childrenByParent 보강을 못 받음 → 자식 통째 미렌더(Skia 는 자식 직접
 * 렌더 → 비대칭). "type별로 골라 합성"이 아니라 generic map 이어도 childrenByParent 가 비면 자식 0개
 * (ButtonGroup 도 generic map 이었음). TableView/Card/ButtonGroup 선례와 동형.
 */
describe("CanonicalNodeRenderer — self-compose 컨테이너 DELEGATING 위임 (ButtonGroup 동형)", () => {
  const SELF_COMPOSE_CONTAINERS = ["AvatarGroup", "CardView", "Pagination"];

  for (const type of SELF_COMPOSE_CONTAINERS) {
    it(`${type} binding 은 internal source + 고유 renderer id ('div' 금지)`, () => {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} binding source.kind`).toBe(
        "internal",
      );
      if (binding?.source.kind === "internal") {
        expect(
          binding.source.renderer,
          `${type} renderer 가 'div' → delegating 위임 불가 → factory 자식 미렌더 회귀(ButtonGroup 동형)`,
        ).not.toBe("div");
      }
    });

    it(`${type} renderer 가 DELEGATING_INTERNAL_RENDERERS 에 등록`, () => {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind).toBe("internal");
      if (binding?.source.kind === "internal") {
        expect(
          DELEGATING_INTERNAL_RENDERERS.has(binding.source.renderer),
          `${type} (renderer="${binding.source.renderer}") 가 DELEGATING_INTERNAL_RENDERERS 에 누락 → generic fall-through → childrenByParent 빈 배열 → 자식 미렌더`,
        ).toBe(true);
      }
    });

    it(`rendererMap.${type}(self-compose renderer) 존재`, () => {
      expect(
        (rendererMap as Record<string, unknown>)[type],
        `rendererMap.${type} 누락 → delegating 위임 대상 없음`,
      ).toBeTypeOf("function");
    });
  }
});
