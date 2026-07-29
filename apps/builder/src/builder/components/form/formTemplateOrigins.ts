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
 * 종전 `createFormDefinition`(factory 코드)이 매 palette-add 마다 조합 트리를 하드코딩
 * 생성하던 seam 을 제거하고, 그 조합 트리를 본 reusable origin 1벌로 옮긴다. palette-add 는
 * `REUSABLE_COMPOSITE_ORIGINS` 레지스트리(데이터)를 보고 `type:"ref"` instance 만 생성한다 —
 * 신규 조합 추가 = origin 문서 + 레지스트리 1줄 (factory 코드 변경 0).
 *
 * **ADR-171 Phase 6 (2026-07-29) — 조합을 레퍼런스 모양으로 되돌렸다.**
 * 구 트리는 `Form > Heading + Description + FormField×2 > (Label + TextField)` 였는데,
 * `FormField` 는 어느 레퍼런스에도 없는 composition 자체 추상이다(`FormField.binding.ts` 가
 * "RAC/starter 전용 컴포넌트 없음" 이라고 스스로 밝힌다). 게다가 `Label` 요소와 `TextField`
 * 의 `label` prop 이 **둘 다** 렌더돼 라벨이 두 겹이었다("Field Label" 아래 "Text Field").
 *
 * RAC/RSP 는 필드를 Form 직계 자식으로 두고 Label↔입력 묶음은 필드 컴포넌트가 소유한다:
 *   `<Form><TextField label="Name" …/><TextField label="Email" …/><버튼 행/></Form>`
 * 그대로 따라 `Form > TextField×2 + ButtonGroup` 으로 재구성했다. 버튼 행은 composition 의
 * `ButtonGroup`(factory 정본 = Cancel outline / Save accent)이 RAC 예제의 `<div>` 자리를 맡는다.
 * 없어진 래퍼와 함께 그 인라인 layout 4키(FormField)도 사라져 ADR-171 이관 대상에서 빠진다.
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
  const textField = (
    index: number,
    label: string,
    type: string,
    placeholder: string,
  ): CanonicalNode => ({
    id: `${FORM_ORIGIN_ID}__field-${index}`,
    type: "TextField",
    name: `TextField/${label}`,
    props: {
      label,
      name: "",
      description: "",
      errorMessage: "",
      placeholder,
      value: "",
      type,
      size: "md",
      labelPosition: "top",
      isRequired: true,
      isDisabled: false,
      isReadOnly: false,
      isInvalid: false,
      style: { width: "100%" },
    },
    // `createTextFieldDefinition`(FormComponents.ts) 자식 트리 미러. TextField 는 leaf 가 아니라
    //   Label + Input(+ FieldError) 를 **자식 Element** 로 갖는 조합이라, 자식 없이 저작하면
    //   캔버스에 라벨만 그려지고 입력 박스가 없다. 구 origin 도 자식 0이라 같은 상태였는데
    //   FormField 안의 별도 Label 이 필드처럼 보이게 가리고 있었다(ADR-171 Phase 6).
    children: [
      {
        id: `${FORM_ORIGIN_ID}__field-${index}-label`,
        type: "Label",
        name: `Label/${label}`,
        props: {
          children: label,
          style: { width: "fit-content", fontWeight: 600 },
        },
        metadata: { type: "form-origin-child", systemOwned: true },
      },
      {
        id: `${FORM_ORIGIN_ID}__field-${index}-input`,
        type: "Input",
        name: "Input",
        props: { type, placeholder, style: { width: "100%" } },
        metadata: { type: "form-origin-child", systemOwned: true },
      },
      {
        id: `${FORM_ORIGIN_ID}__field-${index}-error`,
        type: "FieldError",
        name: "FieldError",
        props: { children: "", style: { fontSize: 12, display: "none" } },
        metadata: { type: "form-origin-child", systemOwned: true },
      },
    ],
    metadata: {
      type: "form-origin-child",
      systemOwned: true,
    },
  });

  const button = (
    index: number,
    text: string,
    variant: string,
    fillStyle: string,
  ): CanonicalNode => ({
    id: `${FORM_ORIGIN_ID}__action-${index}`,
    type: "Button",
    name: `Button/${text}`,
    props: { children: text, variant, fillStyle, size: "md" },
    metadata: {
      type: "form-origin-child",
      systemOwned: true,
    },
  });

  return [
    textField(1, "Name", "text", "Enter your full name"),
    textField(2, "Email", "email", "Enter your email"),
    {
      id: `${FORM_ORIGIN_ID}__actions`,
      type: "ButtonGroup",
      name: "ButtonGroup",
      // createButtonGroupDefinition(DisplayComponents.ts) 의 parent props 미러 —
      //   layout 은 catalog ButtonGroup 이 아직 채우지 않아 인라인이 두 채널 공급원이다.
      props: {
        size: "md",
        orientation: "horizontal",
        align: "end",
        style: {
          display: "flex",
          flexDirection: "row",
          gap: 8,
          width: "fit-content",
        },
      },
      children: [
        button(1, "Cancel", "secondary", "outline"),
        button(2, "Save", "accent", "fill"),
      ],
      metadata: {
        type: "form-origin-child",
        systemOwned: true,
      },
    },
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
      // ADR-171 Phase 6: layout 3선언(display / flexDirection / gap → live 4키)을 제거했다.
      //   catalog `form` containerStyles 가 `flex column · gap 16px` 를 두 소비자에 공급하고
      //   실효 DOM 도 같다(3자 일치). width 는 catalog 미보유 + 요소별 저작 값이라 존치.
      style: {
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
    // ADR-154: 사용자 responsive override 는 top-level canonical 필드라 base(seed)에
    // 없다. props 처럼 existing 을 보존하지 않으면 reseed(hydration repair)마다 소실된다.
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
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
