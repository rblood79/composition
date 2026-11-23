import type { PrimitiveBinding } from "../types";
import { menuBinding } from "./Menu.binding";
import {
  S2_PANEL_CLOSE_ON_SELECT_ACCEPTS,
  S2_PANEL_DISALLOW_EMPTY_ACCEPTS,
} from "./s2RacProps";
import { ITEM_DATA_BINDING_PROP } from "./loadingStateProps";

/**
 * ADR-238 Phase 2 — MenuSection: Menu collection 의 묶음 층 (RAC `MenuSection` — 자식 = Header + 항목 · Separator 는 Menu 자식).
 *
 * D1: RAC `MenuSection` 그대로 (`<section>`, Header 로 `aria-labelledby`). 중첩 없음 (한 단계).
 * D2: S2 · RAC `MenuSection` 선택 (S2 체크리스트 §9.2, 2026-11-24) — `selectionMode` · `selectedKeys` ·
 *   `disallowEmptySelection` · `shouldCloseOnSelect`. 선택 방식이 있으면 안 항목의 그룹은 Menu 가 아니라
 *   이 section 이다 (`groupSelection.ts` `catalogSelectionGroupOf` — ADR-308 그룹이 저장).
 * D3: 상자 시각 없음 (투명) — section 사이 간격 · Header 모양은 목록 CSS 규칙과 Canvas resolver 가 같은 값.
 */
export const menuSectionBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "MenuSection",
  },
  rac: {
    primitive: "MenuSection",
    parts: ["section"],
    slots: [],
    states: [],
    renderProps: [],
    dataAttributes: [],
  },
  props: {
    accepts: {
      // ADR-310 ①: the section's own data (grouped rows — its items fill each group's child rows).
      dataBinding: ITEM_DATA_BINDING_PROP,
      selectionMode: { ...menuBinding.props.accepts.selectionMode! },
      ...S2_PANEL_DISALLOW_EMPTY_ACCEPTS,
      ...S2_PANEL_CLOSE_ON_SELECT_ACCEPTS,
    },
    toRacProps: "default",
  },
};
