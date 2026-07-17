import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { PropsSchema } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

/**
 * ADR-148 Phase 2: IconButton — 첫 신규 reusable 수직 슬라이스 (propsSchema 첫 소비).
 *
 * Button leaf primitive 는 icon 을 번들하지 않는다 (Button.binding.ts 파일럿 결정 —
 * "아이콘이 붙은 Button 은 reusable 조합 문서", ADR-142 설계 §3). 본 origin 이 그
 * 조합(Button > Icon(slotRole:icon, optional) + Text(slotRole:label))의 데이터 정본이다.
 *
 * **propsSchema (Decision 4 — `metadata.propsSchema` 채택)**: origin root metadata 에
 * 편집 계약(label/icon/variant/size)을 선언한다. Inspector `resolveEditContract` 가
 * ref instance 선택 시 이를 generic 편집 필드로 소비하고, 편집은 instance root props
 * override 로 기록된다. 템플릿 바인딩 `{label}`/`{icon}` 은 resolve 단계
 * (`canonicalRefResolution.ts` — propsSchema gate)가 instance root props 로 치환한다.
 * variant/size 는 placeholder 가 아니라 origin root props passthrough (Button 이 직접
 * 소비하는 실제 prop) — 키 1:1 정적 검증은 두 축을 나눠 확인한다 (__tests__ 참조).
 *
 * 선례: `toolbarTemplateOrigins.ts` — origin seed + strip + ensure (멱등) 패턴 동형.
 */

export const ICONBUTTON_ORIGIN_ID = "component-iconbutton";

const ICONBUTTON_SYSTEM_ORIGIN_IDS = new Set([ICONBUTTON_ORIGIN_ID]);

/**
 * IconButton 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/icon/variant/size 재사용).
 * `label`/`icon` 은 템플릿 바인딩 키, `variant`/`size` 는 root props passthrough.
 */
export const ICONBUTTON_PROPS_SCHEMA: PropsSchema = {
  label: {
    kind: "string",
    label: "Label",
    default: "Button",
    section: "content",
  },
  icon: {
    kind: "icon",
    label: "Icon",
    default: "star",
    section: "content",
  },
  variant: {
    kind: "variant",
    label: "Variant",
    default: "primary",
    section: "appearance",
  },
  size: {
    kind: "size",
    label: "Size",
    default: "md",
    section: "appearance",
  },
};

/**
 * IconButton origin 의 조합 자식 — Icon(optional) + Text(label).
 * slotRole 병기(metadata.slotRole + props.slot)는 ListBoxItem origin seed 규약 승계
 * (`getSlotRole` 이 metadata 우선 / props.slot fallback 양축 판독).
 */
function iconButtonOriginChildren(): CanonicalNode[] {
  return [
    {
      id: `${ICONBUTTON_ORIGIN_ID}__icon`,
      type: "Icon",
      name: "Icon",
      props: { slot: "icon", iconName: "{icon}" },
      metadata: {
        type: "iconbutton-origin-child",
        systemOwned: true,
        slotRole: "icon",
        optional: true,
      },
    },
    {
      id: `${ICONBUTTON_ORIGIN_ID}__label`,
      type: "Text",
      name: "Label",
      props: { slot: "label", children: "{label}" },
      metadata: {
        type: "iconbutton-origin-child",
        systemOwned: true,
        slotRole: "label",
      },
    },
  ];
}

function createIconButtonOrigin(): CanonicalNode {
  return {
    id: ICONBUTTON_ORIGIN_ID,
    type: "Button",
    name: "IconButton",
    reusable: true,
    props: {
      variant: "primary",
      size: "md",
    },
    children: iconButtonOriginChildren(),
    metadata: {
      type: "iconbutton-origin",
      systemOwned: true,
      componentFamily: "IconButton",
      propsSchema: ICONBUTTON_PROPS_SCHEMA,
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
        existing.metadata?.type ?? base.metadata?.type ?? "iconbutton-origin",
      systemOwned: true,
      componentFamily: "IconButton",
      // 편집 계약은 코드 정본 우선 — schema 진화(키 추가) 시 기존 문서에도 반영.
      propsSchema: ICONBUTTON_PROPS_SCHEMA,
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (ICONBUTTON_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !ICONBUTTON_SYSTEM_ORIGIN_IDS.has(node.id))
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
 * IconButton reusable origin 을 Components page body 에 보장한다 (멱등).
 * `toolbarTemplateOrigins.ensureToolbarTemplateOrigins` 와 동형.
 */
export function ensureIconButtonTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(
      existingOrigins.get(ICONBUTTON_ORIGIN_ID),
      createIconButtonOrigin,
    ),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
