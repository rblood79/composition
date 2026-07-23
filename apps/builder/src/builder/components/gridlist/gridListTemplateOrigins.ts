import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

export const GRIDLIST_ITEM_DEFAULT_ORIGIN_ID =
  "component-gridlist-item-default";

/**
 * ADR-161 Phase 1: GridList 컨테이너 재사용 origin (ListBox `component-listbox` 동형).
 * components 페이지에 등록되고, 인스턴스(factory)가 이 master 를 `ref` 로 참조한다(Phase 2).
 * `slot` 배열이 item origin 을 가리켜 카드 템플릿을 구성한다.
 */
export const GRIDLIST_ORIGIN_ID = "component-gridlist";

/**
 * ADR-148 Phase 4: GridListItem reusable origin 의 조합 자식(Text(label) / Text(description)).
 *
 * ADR-147 ListBoxItem 모델 복제 — 템플릿 바인딩 `{label}`/`{description}` 은 row projection
 * (appendGridListRowProjection, items/dataBinding) 이 채운다. origin flat props(`children`/
 * `textValue`/`description`)는 BC 및 gridlist_card escape 데이터 경로 유지를 위해 보존한다
 * (자식은 authoring 구조 + slot 스타일 SSOT — origin 에서 slot 자식을 지우면 그 slot 이
 * 카드에서 사라진다).
 */
function gridListItemSlotChildren(originId: string): CanonicalNode[] {
  return [
    {
      id: `${originId}__label`,
      type: "Text",
      name: "Label",
      // RAC GridListItem 은 label slot 미제공(DEFAULT_SLOT + description 만) — ListBoxItem 과
      //   달리 `slot:"label"` 을 실으면 이 자식이 GridListItem 맥락에서 직접 렌더될 때
      //   "Invalid slot" 크래시. slot 구성은 metadata.slotRole 이 담당(getSlotRole 이
      //   metadata.slotRole 우선)하므로 props.slot 은 불필요 + 유해 → 제거(default slot).
      props: { children: "{label}" },
      metadata: {
        type: "gridlist-item-slot",
        systemOwned: true,
        slotRole: "label",
      },
    },
    {
      id: `${originId}__description`,
      type: "Text",
      name: "Description",
      props: { slot: "description", children: "{description}" },
      metadata: {
        type: "gridlist-item-slot",
        systemOwned: true,
        slotRole: "description",
        optional: true,
      },
    },
  ];
}

const GRIDLIST_SYSTEM_ORIGIN_IDS = new Set([
  GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
  GRIDLIST_ORIGIN_ID,
]);

function createGridListItemDefaultOrigin(): CanonicalNode {
  return {
    id: GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
    type: "GridListItem",
    name: "GridListItem/Default",
    reusable: true,
    props: {
      children: "{label}",
      textValue: "{label}",
      description: "{description}",
    },
    // ADR-148 Phase 4: label/description slot 조합 자식. flat props 와 병존(데이터 경로 BC).
    children: gridListItemSlotChildren(GRIDLIST_ITEM_DEFAULT_ORIGIN_ID),
    metadata: {
      type: "gridlist-template-origin",
      systemOwned: true,
      componentFamily: "GridList",
      variant: "default",
    },
  };
}

/**
 * ADR-161 Phase 1: GridList 컨테이너 master origin (ListBox `createListBoxOrigin` 동형).
 * 기본값은 현행 factory 행동 기본값(layout:"stack" / columns:2 / selectionMode:"none")과
 * 일치시켜 Phase 2 인스턴스 override 부담을 최소화한다 (리뷰 round 1 LOW #1). width:100% 등
 * layout-context 는 Phase 2 에서 instance override 로 이관.
 */
function createGridListOrigin(): CanonicalNode {
  return {
    id: GRIDLIST_ORIGIN_ID,
    type: "GridList",
    name: "GridList",
    reusable: true,
    props: {
      layout: "stack",
      columns: 2,
      selectionMode: "none",
      items: [],
    },
    slot: [GRIDLIST_ITEM_DEFAULT_ORIGIN_ID],
    metadata: {
      type: "gridlist-origin",
      systemOwned: true,
      componentFamily: "GridList",
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
        "gridlist-template-origin",
      systemOwned: true,
      componentFamily: "GridList",
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (GRIDLIST_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !GRIDLIST_SYSTEM_ORIGIN_IDS.has(node.id))
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

export function ensureGridListTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(
      existingOrigins.get(GRIDLIST_ITEM_DEFAULT_ORIGIN_ID),
      createGridListItemDefaultOrigin,
    ),
    // ADR-161 Phase 1: 컨테이너 master origin (item 다음, ListBox 순서 동형).
    repairOrigin(existingOrigins.get(GRIDLIST_ORIGIN_ID), createGridListOrigin),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
