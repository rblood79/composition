import type { PrimitiveBinding } from "../types";

/**
 * Tag — TagList 안의 chip (RAC `Tag`).
 *
 * **노드 트리**: Tag origin template 은 `Tag > Icon + Avatar + Text({label}) + Button[slot=remove] >
 *   Icon` 이다 (`reusableOriginLibrary.ts`). remove 버튼은 TagGroup 의 `allowsRemoving` 일 때만
 *   보인다 (`showWhen`) — X 는 Icon 노드라 DOM(Button slot=remove) ↔ Canvas 시각 대칭.
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.Tag`: variants default/selected + sizes.{fontSize/
 *   lineHeight/borderRadius/height/paddingX}) 의 상자. TagGroup `maxRows` 를 넘는 chip 은
 *   `compositionRoot.ts` `settleTagRows` 가 흐름에서 뺀다. 바인딩된 TagList 는 Tag 자리를 행마다
 *   반복한다 (resolver `CATALOG_ROW_ITEM_TYPES`).
 *
 * **DOM**: `domRegistry.tsx` `INTERNAL_RENDERERS.tag` (shared `components/TagGroup` 의 Tag) 가
 *   TagList (`delegatedDom.tsx` `taglist`) 안에서 그린다.
 *
 * D1: RAC `<TagGroup>`/`<Tag>` — ARIA(role=row/gridcell, aria-selected) 는 RAC 권위.
 * D2: children(label) + size + isSelected (그룹 선택 — RAC TagGroup
 *     `defaultSelectedKeys`, Tag 자체 variant 없음 2026-10-09) 편집 surface.
 * D3: 시각(box+text 색/크기/형태)은 theme rule(COMPONENT_RULES_TABLE.Tag) —
 *     variants{default/selected}.fill + sizes{fontSize/lineHeight/borderRadius/height/paddingX}.
 */
export const tagBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tag",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // A selected Tag is its TagGroup's selection (RAC · S2 Tag has no `variant` — 2026-10-09):
      //   the TagGroup hands RAC the keys of its selected Tags (`defaultSelectedKeys`), the rule's
      //   `selected` variant paints it (Canvas `_isSelected` · DOM `[data-selected]`).
      isSelected: { kind: "boolean", label: "Selected", section: "state" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // 항목별 leading icon (2026-08-21): `leading_icon` 은 **append 모드** escape 라 generic
  //   box+text 위에 glyph 만 덧그린다. 자기 게이팅(`leadingIcon.nameProp` 값이 없으면 빈 배열)
  //   이라 아이콘 없는 chip 에는 아무 영향이 없다 — Tag rule 의 leadingIcon 데이터가 실제
  //   가시성을 정한다(컴포넌트 식별 분기 아님, ADR-142 §3).
  //   `leading_avatar`(2026-08-21)도 같은 append 규칙 — 둘은 **같은 좌측 슬롯**을 공유하고
  //   `resolveLeadingSlot` 이 하나만 고르므로(avatar 우선) 동시에 그려지지 않는다. 배열 등록이
  //   없으면 dispatch 자체가 안 돼 rule/CSS 가 갖춰져 있어도 캔버스만 조용히 비는 축.
  skiaPrimitive: ["leading_icon", "leading_avatar"],
};
