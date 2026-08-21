import type { PrimitiveBinding } from "../types";

/**
 * Tag — TagGroup chip 본체 (라벨 + allowsRemoving 시 remove X).
 *
 * **ADR-912 영역 B (A) — Tag catalog cutover (2026-06-12)**: Tag 는 catalog 미등록 상태에서
 *   `Tag.spec.render.shapes`(bg roundRect + border + text + allowsRemoving 시 X line×2)가 Skia
 *   시각 유일 source 였다. X 를 line×2 로 직접 그리는 것은 SelectIcon/SearchField clear 와
 *   비대칭(starter `<Button slot="remove"><X/></Button>` 은 Lucide glyph)이었다. catalog 등록으로
 *   rule(`COMPONENT_RULES_TABLE.Tag`: variants default/selected + sizes.{fontSize/lineHeight/
 *   borderRadius/height/paddingX}) + buildCatalogShapes generic(box+text)으로 이전하고, **remove X 는
 *   SelectIcon(iconName="x") 자식 노드**(appendTagRowProjection 이 allowsRemoving 시 chip 에 전개 —
 *   SearchField clear X 동형, X 는 이미 catalog cutover 된 SelectIcon icon_font glyph)로 바꿔
 *   DOM(Button slot=remove ✕) ↔ Skia(SelectIcon ✕) 시각 대칭 복원.
 *
 * **Skia = box+text generic (+ projection 이 SelectIcon "x" 자식 전개)**: Tag chip 은
 *   render-space projection 노드(appendTagRowProjection)다. buildSpecNodeData 가 `isCatalogCutover("Tag")`
 *   → `buildCatalogShapesOrPrimitive`(box+text) 로 그린다(skiaPrimitive 없음 — X 는 자식 SelectIcon 이
 *   독립 icon_font 노드로 담당, chip 본체 shape 아님). 컴포넌트별 if 아님 — projection 이 데이터(allowsRemoving)
 *   유무로만 SelectIcon 자식 전개(ADR-142 §3).
 *
 * **DOM = 부모 TagGroup self-compose (독립 노드 0)**: renderTagGroup(useResolvedCollectionItems /
 *   items[] SSOT)이 RAC `<TagGroup><TagList><Tag>` 합성. canonical Tag element 는 migration 으로
 *   제거(items[] 로 이전)되어 DOM 재귀 자식이 없다 → catalog 등록 후에도 DOM 변화 0. 발효 가치는
 *   Skia 대칭(특히 remove X 가 line → SelectIcon glyph 로 DOM Button slot=remove 정합) 한정.
 *
 * D1: composition — DOM 은 RAC `<TagGroup>`/`<Tag>` 가 self-compose + ARIA(role=row/gridcell,
 *     aria-selected). RAC D1/ARIA 권위 보존.
 * D2: children(label) + size + variant + allowsRemoving 편집 surface.
 * D3: 시각(box+text 색/크기/형태 + remove X)은 theme rule(COMPONENT_RULES_TABLE.Tag) —
 *     variants{default/selected}.fill + sizes{fontSize/lineHeight/borderRadius/height/paddingX}.
 *     Skia generic(box+text) + SelectIcon "x" 자식 ↔ DOM RAC self-compose 시각 대칭.
 */
export const tagBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tag",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      allowsRemoving: {
        kind: "boolean",
        label: "Allows Removing",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // 항목별 leading icon (2026-08-21): `leading_icon` 은 **append 모드** escape 라 generic
  //   box+text 위에 glyph 만 덧그린다. 자기 게이팅(`leadingIcon.nameProp` 값이 없으면 빈 배열)
  //   이라 아이콘 없는 chip 에는 아무 영향이 없다 — Tag rule 의 leadingIcon 데이터가 실제
  //   가시성을 정한다(컴포넌트 식별 분기 아님, ADR-142 §3).
  skiaPrimitive: "leading_icon",
};
