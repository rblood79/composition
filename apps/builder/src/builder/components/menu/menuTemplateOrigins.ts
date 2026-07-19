import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

export const MENU_ITEM_DEFAULT_ORIGIN_ID = "component-menu-item-default";

/**
 * ADR-148 Phase 4: MenuItem reusable origin 의 조합 자식
 * (Icon / Text(label) / Text(shortcut) / Text(description)).
 *
 * ADR-147 ListBoxItem 모델 복제 — Menu itemSchema 8키 중 **시각 slot 축 4키**
 * (icon/label/shortcut/description) 만 slot 자식이 담당한다. 잔여 4키(value/href/
 * isDisabled/onActionId)는 데이터·동작 축이라 slot 대상 아님 (itemSchema 정합 판정,
 * Phase 4 breakdown). Menu 는 Skia 캔버스에 trigger 버튼만 렌더하므로(catalog rule,
 * projection 없음) 소비 표면은 DOM emit(popover item) 단일 축 — 템플릿 바인딩
 * `{icon}`/`{label}`/`{shortcut}`/`{description}` 은 `props.items`(StoredMenuItem[])
 * 데이터가 채운다.
 */
function menuItemSlotChildren(originId: string): CanonicalNode[] {
  return [
    {
      id: `${originId}__icon`,
      type: "Icon",
      name: "Icon",
      props: { slot: "icon", iconName: "{icon}" },
      metadata: {
        type: "menu-item-slot",
        systemOwned: true,
        slotRole: "icon",
        optional: true,
      },
    },
    {
      id: `${originId}__label`,
      type: "Text",
      name: "Label",
      props: { slot: "label", children: "{label}" },
      metadata: {
        type: "menu-item-slot",
        systemOwned: true,
        slotRole: "label",
      },
    },
    {
      id: `${originId}__shortcut`,
      type: "Text",
      name: "Shortcut",
      props: { slot: "shortcut", children: "{shortcut}" },
      metadata: {
        type: "menu-item-slot",
        systemOwned: true,
        slotRole: "shortcut",
        optional: true,
      },
    },
    {
      id: `${originId}__description`,
      type: "Text",
      name: "Description",
      props: { slot: "description", children: "{description}" },
      metadata: {
        type: "menu-item-slot",
        systemOwned: true,
        slotRole: "description",
        optional: true,
      },
    },
  ];
}

const MENU_SYSTEM_ORIGIN_IDS = new Set([MENU_ITEM_DEFAULT_ORIGIN_ID]);

function createMenuItemDefaultOrigin(): CanonicalNode {
  return {
    id: MENU_ITEM_DEFAULT_ORIGIN_ID,
    type: "MenuItem",
    name: "MenuItem/Default",
    reusable: true,
    props: {
      children: "{label}",
      textValue: "{label}",
    },
    // ADR-148 Phase 4: icon/label/shortcut/description slot 조합 자식.
    children: menuItemSlotChildren(MENU_ITEM_DEFAULT_ORIGIN_ID),
    metadata: {
      type: "menu-template-origin",
      systemOwned: true,
      componentFamily: "Menu",
      variant: "default",
    },
  };
}

/**
 * `listBoxTemplateOrigins.ensureListBoxTemplateOrigins` 와 동형 — 기존 origin 이 있으면
 * 사용자 편집(props/children)을 보존하고 metadata 를 코드 정본으로 repair 한다 (멱등).
 */
function repairOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  return {
    ...base,
    props: existing.props ?? base.props,
    children: existing.children ?? base.children,
    // ADR-154: 사용자 responsive override 보존 (composite origin reseed 소실 방지)
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type:
        existing.metadata?.type ??
        base.metadata?.type ??
        "menu-template-origin",
      systemOwned: true,
      componentFamily: "Menu",
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (MENU_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !MENU_SYSTEM_ORIGIN_IDS.has(node.id))
    .map((node) => {
      if (!node.children) return node;
      return {
        ...node,
        children: stripOrigins(node.children),
      };
    });
}

function withOriginsInComponentsBody(
  nodes: readonly CanonicalNode[],
  origins: CanonicalNode[],
): CanonicalNode[] {
  return nodes.map((node) => {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
      return {
        ...node,
        children: [...(node.children ?? []), ...origins],
      };
    }
    if (!node.children) return node;
    return {
      ...node,
      children: withOriginsInComponentsBody(node.children, origins),
    };
  });
}

export function ensureMenuTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(
      existingOrigins.get(MENU_ITEM_DEFAULT_ORIGIN_ID),
      createMenuItemDefaultOrigin,
    ),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
