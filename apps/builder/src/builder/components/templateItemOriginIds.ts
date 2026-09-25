/**
 * 목록 항목 template origin id — 의존 0 leaf.
 *
 * `slotHostPolicy` (Preview resolver 가 읽는다) 는 이 id 들만 필요하다. id 가 각 `*TemplateOrigins` 모듈 (origin 빌더
 * → `catalogOrigins` → factory 정의 전체 → hydration 이관) 에 있으면 Preview initial 번들이 builder 저작 코드를
 * 통째로 싣는다 (2026-09-25 실측 +31 KB gzip). 원 모듈은 여기서 re-export 한다 — 정의는 이 파일 하나.
 */
export const LISTBOX_ITEM_DEFAULT_ORIGIN_ID = "component-listbox-item-default";
export const LISTBOX_ITEM_SELECTED_ORIGIN_ID =
  "component-listbox-item-selected";
export const GRIDLIST_ITEM_DEFAULT_ORIGIN_ID =
  "component-gridlist-item-default";
export const MENU_ITEM_DEFAULT_ORIGIN_ID = "component-menu-item-default";
export const TAG_ITEM_DEFAULT_ORIGIN_ID = "component-tag-item-default";
export const TAG_ITEM_SELECTED_ORIGIN_ID = "component-tag-item-selected";
export const TAB_ITEM_DEFAULT_ORIGIN_ID = "component-tab-item-default";
export const TAB_ITEM_SELECTED_ORIGIN_ID = "component-tab-item-selected";
export const BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID =
  "component-breadcrumb-item-default";
export const TREE_ITEM_DEFAULT_ORIGIN_ID = "component-tree-item-default";
