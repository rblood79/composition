import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { isSelectedStateOrigin } from "../stateVariantOrigins";
import { catalogReusableOriginId } from "@composition/shared";
import { buildCatalogOrigin, repairCatalogOrigin } from "../catalogOrigins";
import { ensureTemplateOrigins } from "../ensureTemplateOrigins";

/**
 * ADR-233 Phase 1 — Tabs 의 Tab 항목 template origin (ADR-229 `tagGroupTemplateOrigins` 동형).
 *
 * Tab 은 ADR-066 뒤 `items [{id,title}]` 데이터로만 합성되어 Components 페이지에 편집할 자리가
 * 없었다 (`appendTabRowProjection` `templateOriginId: null`). 이 모듈이 `component-tab-item-default`
 * / `-selected` origin (label slot 자식 Text `{label}`) 을 시드하고, `component-tabs` origin root 에
 * `slot: [default, selected]` 를 등록한다 — Tab 행 projection (Skia) 과 Preview `renderTabs` 가 그
 * slot 을 같은 순서로 읽는다.
 *
 * Tabs origin 자체는 ADR-228 generic seed (`buildCatalogOrigin("Tabs")`) 와 **같은 트리**다 — 이
 * 모듈은 root slot 만 얹는다. ADR-066 은 유지: Tab element 를 canonical Tabs 자식으로 되살리지 않는다.
 */

export const TAB_ITEM_DEFAULT_ORIGIN_ID = "component-tab-item-default";
export const TAB_ITEM_SELECTED_ORIGIN_ID = "component-tab-item-selected";
export const TABS_ORIGIN_ID = catalogReusableOriginId("Tabs");

export const TAB_ITEM_TEMPLATE_SLOT = [
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
] as const;

/** Tab 의 조합 자식 — 한 줄 label 하나 (Tab 은 leading/trailing slot 이 없다). */
function tabItemSlotChildren(originId: string): CanonicalNode[] {
  return [
    {
      id: `${originId}__label`,
      type: "Text",
      name: "Label",
      props: { slot: "label", children: "{label}" },
      metadata: {
        type: "tab-item-slot",
        systemOwned: true,
        slotRole: "label",
      },
    },
  ];
}

/**
 * origin root 의 저작 조합 layout — Components 페이지에서 label 자식을 Tab 처럼 가운데에 놓는다.
 * Tab 행에는 싣지 않는다 (`ITEM_TEMPLATE_AUTHORING_LAYOUT_STYLE_KEYS` 를 두 leg 가 뺀다).
 */
const TAB_ITEM_AUTHORING_LAYOUT_STYLE: Record<string, unknown> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
};

function createTabItemDefaultOrigin(): CanonicalNode {
  return {
    id: TAB_ITEM_DEFAULT_ORIGIN_ID,
    type: "Tab",
    name: "Tab/Default",
    reusable: true,
    props: { style: { ...TAB_ITEM_AUTHORING_LAYOUT_STYLE } },
    children: tabItemSlotChildren(TAB_ITEM_DEFAULT_ORIGIN_ID),
    metadata: {
      type: "tab-template-origin",
      systemOwned: true,
      componentFamily: "Tabs",
      variant: "default",
    },
  };
}

function createTabItemSelectedOrigin(): CanonicalNode {
  return {
    id: TAB_ITEM_SELECTED_ORIGIN_ID,
    type: "Tab",
    name: "Tab/Selected",
    reusable: true,
    props: {
      // Tab rule 의 selected 표현 (indicator) 이 base — origin style 은 그 위 override 층.
      _isSelected: true,
      style: { ...TAB_ITEM_AUTHORING_LAYOUT_STYLE },
    },
    children: tabItemSlotChildren(TAB_ITEM_SELECTED_ORIGIN_ID),
    metadata: {
      type: "tab-template-origin",
      systemOwned: true,
      componentFamily: "Tabs",
      variant: "selected",
    },
  };
}

/** slot 은 Tabs root 가 갖는다 (Tag 와 같은 자리). 사용자가 둔 slot 은 보존 — 부재 시만 보충 (BC ii). */
function withTemplateSlot(origin: CanonicalNode): CanonicalNode {
  if (Array.isArray(origin.slot)) return origin;
  return { ...origin, slot: [...TAB_ITEM_TEMPLATE_SLOT] };
}

function repairItemOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  return {
    ...base,
    ...(existing.name ? { name: existing.name } : {}),
    props: existing.props ?? base.props,
    children: existing.children ?? base.children,
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    ...(existing.fills ? { fills: existing.fills } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type:
        existing.metadata?.type ?? base.metadata?.type ?? "tab-template-origin",
      systemOwned: true,
      componentFamily: "Tabs",
    },
  };
}

const TABS_SYSTEM_ORIGIN_IDS = new Set([
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
  TABS_ORIGIN_ID,
]);

export function ensureTabsTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  return ensureTemplateOrigins(
    document,
    TABS_SYSTEM_ORIGIN_IDS,
    (existingOrigins) => [
      repairItemOrigin(
        existingOrigins.get(TAB_ITEM_DEFAULT_ORIGIN_ID),
        createTabItemDefaultOrigin,
      ),
      // ADR-234: 이관을 지난 default (= 선택 상태 origin) 가 있으면 selected 를 되살리지 않는다.
      ...(isSelectedStateOrigin(existingOrigins.get(TAB_ITEM_DEFAULT_ORIGIN_ID))
        ? []
        : [
            repairItemOrigin(
              existingOrigins.get(TAB_ITEM_SELECTED_ORIGIN_ID),
              createTabItemSelectedOrigin,
            ),
          ]),
      // generic seed 와 같은 트리 + root slot 결손 보충 (기존 자식 보존은 repairCatalogOrigin).
      withTemplateSlot(
        repairCatalogOrigin(
          existingOrigins.get(TABS_ORIGIN_ID),
          withTemplateSlot(buildCatalogOrigin("Tabs")),
        ),
      ),
    ],
  );
}
