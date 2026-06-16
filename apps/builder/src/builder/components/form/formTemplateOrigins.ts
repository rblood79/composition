import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

/**
 * ADR-912 R-5 (HC#5 "조합 = 데이터"): Form reusable composite origin.
 *
 * Form 은 self-compose wrapper 가 아닌 **순수 조합**(Heading + Description + FormField×2 를
 * generic 자식 재귀로 렌더, `renderForm` = `children.map(renderElement)`)이다. RAC `<Form>` 은
 * action/method/labelPosition 등 prop 만 전달하는 단순 wrapper 라 자식 slot 매핑이 없고,
 * `DELEGATING_INTERNAL_RENDERERS`/`DELEGATING_RAC_RENDERERS` 모두 미등록 → Toolbar 와 동일하게
 * direct children 으로 조합 트리를 origin 문서에 담는다.
 *
 * Toolbar(1단 = Button×3+Separator)와 다른 점은 **2단 중첩**(Form > FormField > Label+TextField).
 * R-5 의 중첩 조합 트리 처리를 검증하는 두 번째 proof — children 트리가 자식의 children 까지
 * 무손실로 origin 문서에 담기는지 확인한다.
 *
 * 종전 `createFormDefinition`(factory 코드)이 매 palette-add 마다 2단 중첩 트리를 하드코딩
 * 생성하던 seam 을 제거하고, 그 조합 트리를 본 reusable origin 1벌로 옮긴다. palette-add 는
 * `REUSABLE_COMPOSITE_ORIGINS` 레지스트리(데이터)를 보고 `type:"ref"` instance 만 생성한다 —
 * 신규 조합 추가 = origin 문서 + 레지스트리 1줄 (factory 코드 변경 0).
 *
 * 선례: `toolbarTemplateOrigins.ts`(R-5 첫 proof) — origin seed + strip + ensure (멱등) 패턴 동형.
 */

export const FORM_ORIGIN_ID = "component-form";

const FORM_SYSTEM_ORIGIN_IDS = new Set([FORM_ORIGIN_ID]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Form origin 의 조합 자식 — Heading + Description + FormField×2.
 *
 * 종전 `createFormDefinition`(FormComponents.ts) 의 하드코딩 트리를 1:1 보존한다
 * (Form Title / Description / FormField[Label "Field Label" + TextField] ×2). 각 FormField 는
 * 자식(Label+TextField)을 가진 **2단 중첩** — R-5 중첩 조합 검증 대상.
 */
function formOriginChildren(): CanonicalNode[] {
  const formField = (childIndex: number, labelText: string): CanonicalNode => ({
    id: `${FORM_ORIGIN_ID}__field-${childIndex}`,
    // FormField 는 childSpec sub-part 라 `ComponentTag` union 비멤버(의도된 정책 —
    // composition-vocabulary.ts:20 "child sub-part spec 은 union 비멤버"). R5 catalog
    // cutover(2026-06-15)로 런타임 유효 type 이며 catalog 등록(primitiveEntry "FormField")됨.
    // origin 문서의 1급 노드로 담으려면 union 정책 보존을 위해 캐스팅(Toolbar body 선례 동형).
    type: "FormField" as CanonicalNode["type"],
    name: "FormField",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        width: "100%",
      },
    },
    children: [
      {
        id: `${FORM_ORIGIN_ID}__field-${childIndex}-label`,
        type: "Label",
        name: `Label/${labelText}`,
        props: {
          children: labelText,
        },
        metadata: {
          type: "form-origin-child",
          systemOwned: true,
        },
      },
      {
        id: `${FORM_ORIGIN_ID}__field-${childIndex}-input`,
        type: "TextField",
        name: "TextField",
        props: {
          label: "Text Field",
          placeholder: "Enter value...",
          value: "",
          type: "text",
          isRequired: false,
          isDisabled: false,
          isReadOnly: false,
        },
        metadata: {
          type: "form-origin-child",
          systemOwned: true,
        },
      },
    ],
    metadata: {
      type: "form-origin-child",
      systemOwned: true,
    },
  });

  return [
    {
      id: `${FORM_ORIGIN_ID}__heading`,
      type: "Heading",
      name: "Heading/Form Title",
      props: {
        children: "Form Title",
        level: 3,
        style: {
          display: "block",
          fontSize: "18px",
          fontWeight: "600",
        },
      },
      metadata: {
        type: "form-origin-child",
        systemOwned: true,
      },
    },
    {
      id: `${FORM_ORIGIN_ID}__description`,
      type: "Description",
      name: "Description",
      props: {
        children: "",
        style: {
          display: "block",
          fontSize: "14px",
        },
      },
      metadata: {
        type: "form-origin-child",
        systemOwned: true,
      },
    },
    formField(1, "Field Label"),
    formField(2, "Another Field"),
  ];
}

function createFormOrigin(): CanonicalNode {
  return {
    id: FORM_ORIGIN_ID,
    type: "Form",
    name: "Form",
    reusable: true,
    props: {
      labelPosition: "top",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "100%",
      },
    },
    children: formOriginChildren(),
    metadata: {
      type: "form-origin",
      systemOwned: true,
      componentFamily: "Form",
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
      type: existing.metadata?.type ?? base.metadata?.type ?? "form-origin",
      systemOwned: true,
      componentFamily: "Form",
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (FORM_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !FORM_SYSTEM_ORIGIN_IDS.has(node.id))
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
 * Form reusable origin 을 Components page body 에 보장한다 (멱등).
 *
 * `toolbarTemplateOrigins.ensureToolbarTemplateOrigins` 와 동형 — 기존 origin 이 있으면
 * `repairOrigin` 으로 사용자 편집(props/children)을 보존하며 system metadata 만 회복하고,
 * 없으면 새로 seed 한다. document 변경 없으면 동일 참조 반환.
 */
export function ensureFormTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(existingOrigins.get(FORM_ORIGIN_ID), createFormOrigin),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}

/** Form origin id 여부 (테스트/외부 가드용). */
export function isFormSystemOrigin(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.id === FORM_ORIGIN_ID;
}
