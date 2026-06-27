import type { PrimitiveBinding } from "../types";

/**
 * AvatarGroup — 아바타 그룹 컨테이너 (Avatar 자식 묶음). composition 자체 추상 + S2 참조
 * (`react-spectrum.adobe.com/AvatarGroup`) — RAC/starter 에 `AvatarGroup` 없음(S2 전용).
 * factory(`DisplayComponents.ts::createAvatarGroupDefinition`)가 자식 Avatar×3 을 자동 생성한다.
 *
 * **ADR-912 R7 G1-a/b (container shell catalog cutover, 2026-06-15)**:
 *   구 `AvatarGroup.spec.ts`(render.shapes=`()=>[]` 투명 컨테이너, skipCSSGeneration:false → 자체
 *   generated/AvatarGroup.css)는 시각 분기가 없는 빈 셸이었다. generate-css virtual 전환(R7 G1-a)으로
 *   DOM CSS source 를 `COMPONENT_RULES_TABLE.AvatarGroup`(variant transparent + sizes height/radius)
 *   로 이전했고, 본 catalog 등록으로 Skia 시각도 spec.render.shapes → buildCatalogShapes generic box
 *   shell 로 이전하여 spec 의존을 끊는다. Card 본체(R6) 동형 — archetype default 컨테이너.
 *
 * **시각 = generic shell(자식 Avatar 가 내용 렌더) + factory props.style layout**: AvatarGroup 은
 *   컨테이너이므로 buildCatalogShapes 가 `_hasChildren` shell(투명 box)을 그리고 자식 Avatar Element
 *   가 시각을 담당한다. container layout(`display:flex` / `flexDirection:row` / `alignItems:center`)은
 *   factory `props.style` SSOT(ADR-907 Layer B, Skia/Taffy 직접 read).
 *
 * **DOM 렌더 = renderAvatarGroup self-compose 위임 (2026-06-27)**: factory 가 자식 Avatar×3 을
 *   생성하므로 AvatarGroup 은 자식을 렌더하는 self-compose 컨테이너다. renderAvatarGroup 이
 *   `context.childrenByParent` 로 자식 Avatar 를 flex div 안에 `children.map(renderElement)` 렌더한다.
 *   따라서 `renderer:"div"` generic fallback 으로 두면 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을
 *   못 타 generic fall-through 로 빠지고, flattenNodeChildrenByParent 보강을 못 받아 childrenByParent 가
 *   비어 자식 Avatar 가 통째 미렌더된다(Preview 빈 div, Skia 는 자식 직접 렌더 → 비대칭). ButtonGroup/
 *   TableView/Card 선례와 동형 — 고유 renderer id(`"avatargroup"`) + renderFacetDeclaration
 *   delegating-internal 등록으로 renderAvatarGroup 위임 활성화.
 *   isSpecOrCatalogBacked + `react-aria-AvatarGroup` className + `data-size` 보존 → generated CSS 매칭 불변.
 *
 * D1: composition `<div>` (internal source, generic DOM).
 * D2: label(content) + size(appearance) + isDisabled(state) 편집 surface.
 * D3: 시각(variant transparent + radius full)은 theme rule(COMPONENT_RULES_TABLE.AvatarGroup).
 *     Skia generic box shell ↔ DOM `react-aria-AvatarGroup[data-size]` 시각 대칭.
 */
export const avatarGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "avatargroup". factory 가 자식 Avatar×3(A/B/C)을 생성하고 renderAvatarGroup 이
    //   context.childrenByParent 로 그 자식을 flex div 안에 렌더하는 self-compose 컨테이너다(ButtonGroup/
    //   TableView 동형). renderer:"div" 는 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을 못 타 generic
    //   fall-through 로 빠지고 flattenNodeChildrenByParent 보강을 못 받아 자식 Avatar 미렌더(Skia 비대칭).
    //   고유 renderer id + renderFacetDeclaration delegating-internal 등록으로 renderAvatarGroup 위임 활성화.
    renderer: "avatargroup",
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
