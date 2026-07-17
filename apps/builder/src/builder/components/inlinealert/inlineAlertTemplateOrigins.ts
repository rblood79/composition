import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { PropsSchema } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

/**
 * ADR-148 Phase 3: InlineAlert — factory-대체군 reusable 전환 (재판정 적격).
 *
 * 재판정 근거 (breakdown §3 Phase 3): DOM 은 generic fallback(rendererMap 위임 제거,
 * ADR-912 internal 4 slice) + 자식 재귀, Skia 는 catalog box shell (전용 escape 없음),
 * propagation rule 없음 — `createInlineAlertDefinition` seam 을 본 origin 문서가 대체한다.
 *
 * 조합: InlineAlert > Heading(slotRole:label, `{title}`) + Description(slotRole:description,
 * `{description}`). variant 는 origin root props passthrough (InlineAlert 가 직접 소비).
 *
 * 선례: `iconButtonTemplateOrigins.ts` — origin seed + strip + ensure (멱등) 패턴 동형.
 */

export const INLINE_ALERT_ORIGIN_ID = "component-inline-alert";

const INLINE_ALERT_SYSTEM_ORIGIN_IDS = new Set([INLINE_ALERT_ORIGIN_ID]);

/**
 * InlineAlert 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/variant 재사용).
 * `title`/`description` 은 템플릿 바인딩 키, `variant` 는 root props passthrough.
 */
export const INLINE_ALERT_PROPS_SCHEMA: PropsSchema = {
  title: {
    kind: "string",
    label: "Title",
    default: "Alert Heading",
    section: "content",
  },
  description: {
    kind: "string",
    label: "Description",
    default: "There was an error processing your request. Please try again.",
    section: "content",
  },
  variant: {
    kind: "variant",
    label: "Variant",
    default: "info",
    section: "appearance",
  },
};

/** InlineAlert origin 의 조합 자식 — 구 factory definition 의 자식 트리 승계. */
function inlineAlertOriginChildren(): CanonicalNode[] {
  return [
    {
      id: `${INLINE_ALERT_ORIGIN_ID}__title`,
      type: "Heading",
      name: "Title",
      props: {
        slot: "label",
        children: "{title}",
        level: 3,
        className: "alert-heading",
      },
      metadata: {
        type: "inline-alert-origin-child",
        systemOwned: true,
        slotRole: "label",
      },
    },
    {
      id: `${INLINE_ALERT_ORIGIN_ID}__description`,
      type: "Description",
      name: "Description",
      props: {
        slot: "description",
        children: "{description}",
        className: "react-aria-Description",
      },
      metadata: {
        type: "inline-alert-origin-child",
        systemOwned: true,
        slotRole: "description",
      },
    },
  ];
}

function createInlineAlertOrigin(): CanonicalNode {
  return {
    id: INLINE_ALERT_ORIGIN_ID,
    type: "InlineAlert",
    name: "InlineAlert",
    reusable: true,
    props: {
      variant: "info",
    },
    children: inlineAlertOriginChildren(),
    metadata: {
      type: "inline-alert-origin",
      systemOwned: true,
      componentFamily: "InlineAlert",
      propsSchema: INLINE_ALERT_PROPS_SCHEMA,
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
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type:
        existing.metadata?.type ?? base.metadata?.type ?? "inline-alert-origin",
      systemOwned: true,
      componentFamily: "InlineAlert",
      // 편집 계약은 코드 정본 우선 — schema 진화(키 추가) 시 기존 문서에도 반영.
      propsSchema: INLINE_ALERT_PROPS_SCHEMA,
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (INLINE_ALERT_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !INLINE_ALERT_SYSTEM_ORIGIN_IDS.has(node.id))
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
 * InlineAlert reusable origin 을 Components page body 에 보장한다 (멱등).
 * `iconButtonTemplateOrigins.ensureIconButtonTemplateOrigins` 와 동형.
 */
export function ensureInlineAlertTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(
      existingOrigins.get(INLINE_ALERT_ORIGIN_ID),
      createInlineAlertOrigin,
    ),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
