import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { isSelectedStateOrigin } from "../stateVariantOrigins";
import { catalogReusableOriginId } from "@composition/shared";
import { buildCatalogOrigin, repairCatalogOrigin } from "../catalogOrigins";
import { ensureTemplateOrigins } from "../ensureTemplateOrigins";

/**
 * ADR-229 Phase 1 — TagGroup 의 chip item template origin (ListBox `listBoxTemplateOrigins` 동형).
 *
 * TagGroup 은 ADR-097 Addendum 1 뒤 chip 이 `items[]` 데이터로만 합성되어 Components 페이지에
 * 편집할 자리가 없었다 (`appendTagRowProjection` `templateOriginId: null`). 이 모듈이
 * `component-tag-item-default` / `-selected` origin (slot 자식 Icon `{icon}` · Avatar `{avatar}` ·
 * Text `{label}`) 을 시드하고, `component-taggroup` origin 의 TagList 자식에 `slot: [default,
 * selected]` 를 등록한다 — 행 projection (Skia) 과 Preview 가 그 slot 을 같은 순서로 읽는다.
 *
 * TagGroup origin 자체는 ADR-228 generic seed (`buildCatalogOrigin("TagGroup")`) 와 **같은 트리**다 —
 * 팔레트 생성과 같은 노드라는 228 계약을 유지하고, 이 모듈은 TagList 의 slot 등록만 얹는다.
 * (breakdown §3 Phase 1: slot 보유자가 origin 자식이라 generic 경로가 표현하지 못해 손 ensurer.)
 */

export const TAG_ITEM_DEFAULT_ORIGIN_ID = "component-tag-item-default";
export const TAG_ITEM_SELECTED_ORIGIN_ID = "component-tag-item-selected";
export const TAGGROUP_ORIGIN_ID = catalogReusableOriginId("TagGroup");

export const TAG_ITEM_TEMPLATE_SLOT = [
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
] as const;

/**
 * chip 의 조합 자식. leading 자리 (icon · avatar) 는 둘 다 optional — 소비자는 데이터가 있는 활성
 * slot 중 avatar > icon 하나만 그린다 (DOM `renderTagLeadingSlot` · Skia `resolveLeadingSlot` 판정).
 * label 은 필수. remove X 는 render-time (`allowsRemoving`) — SelectionIndicator 판정 승계.
 */
function tagItemSlotChildren(originId: string): CanonicalNode[] {
  return [
    {
      id: `${originId}__icon`,
      type: "Icon",
      name: "Icon",
      props: { slot: "icon", iconName: "{icon}" },
      metadata: {
        type: "tag-item-slot",
        systemOwned: true,
        slotRole: "icon",
        optional: true,
      },
    },
    {
      id: `${originId}__avatar`,
      type: "Avatar",
      name: "Avatar",
      props: { slot: "avatar", src: "{avatar}", alt: "" },
      metadata: {
        type: "tag-item-slot",
        systemOwned: true,
        slotRole: "avatar",
        optional: true,
      },
    },
    {
      id: `${originId}__label`,
      type: "Text",
      name: "Label",
      props: { slot: "label", children: "{label}" },
      metadata: {
        type: "tag-item-slot",
        systemOwned: true,
        slotRole: "label",
      },
    },
  ];
}

/**
 * origin root 의 저작 조합 layout — Components 페이지에서 slot 자식을 chip 처럼 가로로 놓는다.
 * chip 에는 싣지 않는다 (`resolveTagItemTemplateStyle` 가 뺀다): 데이터 chip 은 자식이 없는 leaf 라
 * leading/label 배치를 Tag rule (leadingIcon.gap 등) 이 담당한다.
 */
const TAG_ITEM_AUTHORING_LAYOUT_STYLE: Record<string, unknown> = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  width: "fit-content",
};

function createTagItemDefaultOrigin(): CanonicalNode {
  return {
    id: TAG_ITEM_DEFAULT_ORIGIN_ID,
    type: "Tag",
    name: "Tag/Default",
    reusable: true,
    props: {
      children: "{label}",
      style: { ...TAG_ITEM_AUTHORING_LAYOUT_STYLE },
    },
    children: tagItemSlotChildren(TAG_ITEM_DEFAULT_ORIGIN_ID),
    metadata: {
      type: "tag-template-origin",
      systemOwned: true,
      componentFamily: "TagGroup",
      variant: "default",
    },
  };
}

function createTagItemSelectedOrigin(): CanonicalNode {
  return {
    id: TAG_ITEM_SELECTED_ORIGIN_ID,
    type: "Tag",
    name: "Tag/Selected",
    reusable: true,
    props: {
      children: "{label}",
      // Tag rule 의 `selected` variant 가 base — origin style 은 그 위 override 층 (ListBox Selected 동형).
      _isSelected: true,
      style: { ...TAG_ITEM_AUTHORING_LAYOUT_STYLE },
    },
    children: tagItemSlotChildren(TAG_ITEM_SELECTED_ORIGIN_ID),
    metadata: {
      type: "tag-template-origin",
      systemOwned: true,
      componentFamily: "TagGroup",
      variant: "selected",
    },
  };
}

/** origin 의 TagList 자식 — instance 의 synthetic TagList 도 같은 경로로 찾는다 (legacy slot 폴백용). */
export function findTagGroupOriginTagList(
  origin: Pick<CanonicalNode, "children"> | undefined,
): CanonicalNode | undefined {
  return origin?.children?.find((child) => child.type === "TagList");
}

function isTemplateSlot(slot: unknown): boolean {
  return (
    Array.isArray(slot) &&
    slot.length === TAG_ITEM_TEMPLATE_SLOT.length &&
    slot.every((entry, index) => entry === TAG_ITEM_TEMPLATE_SLOT[index])
  );
}

/**
 * item template slot 은 **TagGroup root** 가 갖는다 — ListBox/GridList (`component-listbox.slot`) 와
 * 같은 자리. Phase 1 (2026-09-21 당일) 은 TagList 자식에 두었는데, Properties 가 "자식의 slot 배열"
 * 을 사용자 fill 대상 (`ComponentSlotFillSection` — instance 에 "Target slot: TagList") 으로 읽고 origin
 * 에는 ListBox 처럼 "Slot" 절이 뜨지 않았다 (사용자 지적). 같은 날 시드된 문서의 TagList slot (표준
 * 두 id 그대로일 때만) 은 root 로 옮긴다 — 사용자가 바꾼 slot 은 보존.
 */
function withTemplateSlot(origin: CanonicalNode): CanonicalNode {
  let next = origin;
  const tagList = findTagGroupOriginTagList(origin);
  if (tagList && isTemplateSlot(tagList.slot) && origin.children) {
    next = {
      ...next,
      children: origin.children.map((child) => {
        if (child !== tagList) return child;
        const { slot: _slot, ...rest } = child;
        return rest as CanonicalNode;
      }),
    };
  }
  if (!Array.isArray(next.slot)) {
    next = { ...next, slot: [...TAG_ITEM_TEMPLATE_SLOT] };
  }
  return next;
}

function repairItemOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  return {
    ...base,
    // ADR-234: 이관이 다시 쓴 이름 보존 (Tab repair 와 같은 규칙 — 재hydration Δ0).
    ...(existing.name ? { name: existing.name } : {}),
    props: existing.props ?? base.props,
    children: existing.children ?? base.children,
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    ...(existing.fills ? { fills: existing.fills } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type:
        existing.metadata?.type ?? base.metadata?.type ?? "tag-template-origin",
      systemOwned: true,
      componentFamily: "TagGroup",
    },
  };
}

const TAGGROUP_SYSTEM_ORIGIN_IDS = new Set([
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
  TAGGROUP_ORIGIN_ID,
]);

export function ensureTagGroupTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  return ensureTemplateOrigins(
    document,
    TAGGROUP_SYSTEM_ORIGIN_IDS,
    (existingOrigins) => [
      repairItemOrigin(
        existingOrigins.get(TAG_ITEM_DEFAULT_ORIGIN_ID),
        createTagItemDefaultOrigin,
      ),
      // ADR-234: 이관을 지난 default (= 선택 상태 origin) 가 있으면 selected 를 되살리지 않는다.
      ...(isSelectedStateOrigin(existingOrigins.get(TAG_ITEM_DEFAULT_ORIGIN_ID))
        ? []
        : [
            repairItemOrigin(
              existingOrigins.get(TAG_ITEM_SELECTED_ORIGIN_ID),
              createTagItemSelectedOrigin,
            ),
          ]),
      // generic seed 와 같은 트리 + TagList slot 결손 보충 (기존 자식 보존은 repairCatalogOrigin).
      withTemplateSlot(
        repairCatalogOrigin(
          existingOrigins.get(TAGGROUP_ORIGIN_ID),
          withTemplateSlot(buildCatalogOrigin("TagGroup")),
        ),
      ),
    ],
  );
}
