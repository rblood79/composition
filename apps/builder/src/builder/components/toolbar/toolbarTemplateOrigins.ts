import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

/**
 * ADR-912 R-5 (HC#5 "조합 = 데이터"): Toolbar reusable composite origin.
 *
 * Toolbar 는 self-compose wrapper 가 아닌 **순수 조합**(Button×3 + Separator 를 generic
 * 자식 재귀로 렌더, `renderToolbar` = `children.map(renderElement)`)이다. 따라서 ListBox 처럼
 * `slot` 간접 참조 없이 **direct children** 으로 조합 트리를 origin 문서에 담는다.
 *
 * 종전 `createToolbarDefinition`(factory 코드)이 매 palette-add 마다 Button×3+Separator 트리를
 * 하드코딩 생성하던 seam 을 제거하고, 그 조합 트리를 본 reusable origin 1벌로 옮긴다. palette-add
 * 는 `REUSABLE_COMPOSITE_ORIGINS` 레지스트리(데이터)를 보고 `type:"ref"` instance 만 생성한다 —
 * 신규 조합 추가 = origin 문서 + 레지스트리 1줄 (factory 코드 변경 0).
 *
 * 선례: `listBoxTemplateOrigins.ts`(ADR-147) — origin seed + strip + ensure (멱등) 패턴 동형.
 */

export const TOOLBAR_ORIGIN_ID = "component-toolbar";

const TOOLBAR_SYSTEM_ORIGIN_IDS = new Set([TOOLBAR_ORIGIN_ID]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Toolbar origin 의 조합 자식 — Button×3 + Separator.
 *
 * 종전 `createToolbarDefinition`(FormComponents.ts) 의 하드코딩 트리를 1:1 보존한다
 * (Action 1 / Action 2 / Separator(vertical 1px×20px) / Action 3).
 */
function toolbarOriginChildren(): CanonicalNode[] {
  const button = (childIndex: number, label: string): CanonicalNode => ({
    id: `${TOOLBAR_ORIGIN_ID}__button-${childIndex}`,
    type: "Button",
    name: `Button/${label}`,
    props: {
      children: label,
      variant: "default",
      size: "sm",
      isDisabled: false,
    },
    metadata: {
      type: "toolbar-origin-child",
      systemOwned: true,
    },
  });

  return [
    button(1, "Action 1"),
    button(2, "Action 2"),
    {
      id: `${TOOLBAR_ORIGIN_ID}__separator`,
      type: "Separator",
      name: "Separator",
      props: {
        orientation: "vertical",
        style: {
          width: "1px",
          height: "20px",
        },
      },
      metadata: {
        type: "toolbar-origin-child",
        systemOwned: true,
      },
    },
    button(3, "Action 3"),
  ];
}

function createToolbarOrigin(): CanonicalNode {
  return {
    id: TOOLBAR_ORIGIN_ID,
    type: "Toolbar",
    name: "Toolbar",
    reusable: true,
    props: {
      "aria-label": "Toolbar",
    },
    children: toolbarOriginChildren(),
    metadata: {
      type: "toolbar-origin",
      systemOwned: true,
      componentFamily: "Toolbar",
    },
  };
}

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
      type: existing.metadata?.type ?? base.metadata?.type ?? "toolbar-origin",
      systemOwned: true,
      componentFamily: "Toolbar",
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (TOOLBAR_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !TOOLBAR_SYSTEM_ORIGIN_IDS.has(node.id))
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

/**
 * Toolbar reusable origin 을 Components page body 에 보장한다 (멱등).
 *
 * `listBoxTemplateOrigins.ensureListBoxTemplateOrigins` 와 동형 — 기존 origin 이 있으면
 * `repairOrigin` 으로 사용자 편집(props/children)을 보존하며 system metadata 만 회복하고,
 * 없으면 새로 seed 한다. document 변경 없으면 동일 참조 반환.
 */
export function ensureToolbarTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(existingOrigins.get(TOOLBAR_ORIGIN_ID), createToolbarOrigin),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}

/** Toolbar origin id 여부 (테스트/외부 가드용). */
export function isToolbarSystemOrigin(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.id === TOOLBAR_ORIGIN_ID;
}
