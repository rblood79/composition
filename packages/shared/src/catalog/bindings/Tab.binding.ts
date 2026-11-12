import type { PrimitiveBinding } from "../types";
import {
  ITEM_LINK_PROP_CONTRACTS,
  ITEM_KEY_PROP_CONTRACT,
} from "../document/itemLinks";

/**
 * Tab — TabList 안의 개별 탭 (RAC `Tab`).
 *
 * **노드 트리**: Tab origin template 은 `Tab > Text({label}) + SelectionIndicator` 다
 *   (`reusableOriginLibrary.ts`). 라벨은 Text 자식 노드, 선택 막대는 SelectionIndicator 노드
 *   (ADR-256 Phase 5e).
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.Tab`: variants.default transparent fill +
 *   colors.text/textHover + sizes.{fontSize/paddingX/paddingY/height/borderRadius}) 이 상자와 글자
 *   색을 정한다. 선택 여부는 Tabs 의 선택 key 가 정한다 (`rulePaint.ts` 의 `_isSelected`).
 *
 * **DOM**: `domRegistry.tsx` `INTERNAL_RENDERERS.tab` (shared `components/Tabs` 의 Tab — RAC Tab 이라
 *   render props 를 받는다, `RENDER_PROPS_INTERNAL_RENDERERS`) 이 TabList (`delegatedDom.tsx`
 *   `tablist`) 안에서 그린다. TabList 밖의 Tab 은 RAC 항목이 아니다 (`domBinding.tsx` `ruleDom` 의
 *   `outsideCollection`).
 *
 * D1: RAC `<Tab>` — ARIA(role=tab, aria-selected) 는 RAC 권위.
 * D2: size · isDisabled 편집 surface.
 * D3: 시각(라벨 색/크기)은 theme rule(COMPONENT_RULES_TABLE.Tab), 선택 막대는 SelectionIndicator
 *     노드.
 */
export const tabBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tab",
  },
  props: {
    accepts: {
      // ADR-308 사용자 결정 2: its RAC key — the name its group's selection uses.
      id: ITEM_KEY_PROP_CONTRACT,
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // Tabs 의 density 내부 운반 값 (resolver 전파 — 패널 미노출). 탭 높이 32 · 48
      //   (rule containerVariants.density, ADR-295 Phase 3c-3c ②c).
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        editorHidden: true,
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
        ],
      },
      // ADR-237 Phase 2 — RAC/RSP 항목 `isDisabled`. Canvas 는 이미 읽는데 (상태 층 disabled) accepts 미선언이라
      //   DOM 에만 닿지 않았다 (두 leg 발산) — Tag 와 같은 선언.
      // ADR-259 Phase 1: S2 · RAC item link (`href` · `target` · `rel` — RAC draws the link).
      ...ITEM_LINK_PROP_CONTRACTS,
      // (ADR-308: its selection is its group's keys — no `isSelected` of its own.)
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // (ADR-256 Phase 5e: the selected Tab's bar is its SelectionIndicator node, not a Tab primitive.)
};
