import type { PrimitiveBinding } from "../types";

/**
 * AvatarGroup — 아바타 그룹 컨테이너 (Avatar 자식 묶음). composition 자체 추상 + S2 참조
 * (`react-spectrum.adobe.com/AvatarGroup`) — RAC/starter 에 `AvatarGroup` 없음(S2 전용).
 * origin template 이 자식 Avatar×3 을 둔다 (reusableOriginLibrary.ts).
 *
 * **ADR-912 R7 G1-a/b (container shell catalog cutover, 2026-06-15)**:
 *   DOM CSS · Skia 시각 모두 `COMPONENT_RULES_TABLE.AvatarGroup`(variant transparent + sizes
 *   height/radius) 이 정본이다. Card 본체(R6) 동형 — archetype default 컨테이너.
 *
 * **시각 = generic shell(자식 Avatar 가 내용 렌더)**: AvatarGroup 은 컨테이너이므로 Canvas 는
 *   투명 shell 을 그리고 자식 Avatar 노드가 시각을 담당한다.
 *
 * **DOM 렌더 = `CATALOG_DELEGATED_DOM.avatargroup` (delegatedDom.tsx)**: 자식 Avatar 노드를 flex row
 *   div 안에 그린다. 고유 renderer id(`"avatargroup"`)가 그 항목의 key 다.
 *
 * D1: composition `<div>` (internal source, generic DOM).
 * D2: label(content) + size(appearance) + isDisabled(state) 편집 surface.
 * D3: 시각(variant transparent + radius full)은 theme rule(COMPONENT_RULES_TABLE.AvatarGroup).
 *     Skia generic box shell ↔ DOM flex row `div` (delegatedDom) 시각 대칭.
 */
export const avatarGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 고유 renderer id — CATALOG_DELEGATED_DOM.avatargroup 이 자식 Avatar 노드를 flex row 로 그린다.
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
