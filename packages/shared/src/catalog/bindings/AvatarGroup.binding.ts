import type { PrimitiveBinding } from "../types";

/**
 * AvatarGroup — 아바타 그룹 컨테이너 (Avatar 자식 묶음). composition 자체 추상 + S2 참조
 * (`react-spectrum.adobe.com/AvatarGroup`) — RAC/starter 에 `AvatarGroup` 없음(S2 전용).
 * origin template 이 자식 Avatar×3 + 라벨 Text (`{label}` — 원본 `label`) 를 둔다 (reusableOriginLibrary.ts).
 * 2026-10-09 (사용자 「AvatarGroup label 노드 전환」): S2 의 `label` 은 아바타 뒤의 보이는 span
 *   (`marginStart: 8`) 이고 그룹 (`role="group"`) 의 이름이다 — 이 type 에는 `label` prop 이 없다.
 *
 * **ADR-912 R7 G1-a/b (container shell catalog cutover, 2026-06-15)**:
 *   DOM CSS · Skia 시각 모두 `COMPONENT_RULES_TABLE.AvatarGroup`(variant transparent + sizes
 *   height/radius) 이 정본이다. Card 본체(R6) 동형 — archetype default 컨테이너.
 *
 * **시각 = generic shell(자식 Avatar 가 내용 렌더)**: AvatarGroup 은 컨테이너이므로 Canvas 는
 *   투명 shell 을 그리고 자식 Avatar 노드가 시각을 담당한다.
 *
 * **DOM 렌더 = `CATALOG_DELEGATED_DOM.avatargroup` (delegatedDom.tsx)**: 자식 노드를 flex row
 *   `div role="group"` 안에 그리고, 라벨 Text 의 글자를 그룹 이름으로 쓴다.
 *
 * D1: composition `<div>` (internal source, generic DOM).
 * D2: size(appearance) + isDisabled(state) 편집 surface (label 은 원본 prop).
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
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
