import type { PrimitiveBinding } from "../types";

/**
 * TabList — Tabs projection 의 탭 컨테이너 (하단/우측 구분선).
 *
 * **ADR-912 projection 3 cutover (2026-06-15, TableRow Pattern B 동형)**: TabList 은 catalog 미등록
 *   상태에서 `TabList.spec.render.shapes`(하단/우측 1px 구분선 line)가 Skia 시각 유일 source 였다.
 *   catalog 등록으로 rule(`COMPONENT_RULES_TABLE.TabList`: transparent shell + sizes.{height}) +
 *   buildCatalogShapes generic(transparent box) + `tablist_divider` skiaPrimitive(append, 구분선
 *   line)으로 이전. orientation 데이터 분기만(ADR-142 §3).
 *
 * **Skia = transparent box generic + tablist_divider append**: TabList 은 자식 Tab projection 의
 *   owner scene node 다(appendTabRowProjection 이 owner=TabList 에 tab-row 전개). buildSpecNodeData 가
 *   `isCatalogCutover("TabList")` → transparent box + append divider. 폭/높이는
 *   CONTAINER_DIMENSION_TAGS 가 주입한 `_containerWidth`/`_containerHeight`(전체 탭 폭).
 *
 * **DOM = 부모 Tabs self-compose (독립 노드 0)**: renderTabs(RAC `<TabList>`)가 합성. canonical 문서에
 *   TabList element 가 없다(projection 전용 owner SceneNode) → DOM 변화 0. 발효 가치는 Skia 대칭
 *   (spec 의존 끊기 = step 4 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<Tabs>`/`<TabList>` 이 self-compose + ARIA(role=tablist).
 *     RAC D1/ARIA 권위 보존.
 * D2: size 편집 surface(컨테이너는 projection owner 라 편집 surface 최소).
 * D3: 시각(하단/우측 구분선)은 tablist_divider escape. Skia generic+divider ↔ DOM RAC self-compose
 *     시각 대칭.
 *
 * source.renderer "tablist" 은 DOM 에서 호출되지 않는다(부모 Tabs self-compose) — primitiveEntry 의
 * getPrimitiveBinding 타입 계약 충족용. canonical TabList element 가 없어 DELEGATING 등록 불요.
 */
export const tabListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablist",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "tablist_divider",
};
