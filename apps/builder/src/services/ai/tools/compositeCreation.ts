/**
 * AI 가 만드는 합성 컴포넌트 (ADR-134 Phase 6, D7).
 *
 * **결함**: `create_element` 는 지금까지 `type` 이 무엇이든 element 1개만 만들었다. 그래서
 * AI 가 만든 `Select` 는 Button/Popover/ListBox 자식이 없는 **빈 껍데기**였고, `Card` 는
 * reusable origin 을 참조하는 인스턴스조차 아니었다 (2026-08-28 live 실측: 자식 0개).
 * 팔레트로 만든 같은 컴포넌트와 결과가 달랐다.
 *
 * **왜 별도 도구가 아닌가**: breakdown 은 `createComposite` 도구를 산출물로 적었지만, 그러면
 * 모델이 "어떤 type 이 합성인가" 를 알아야 하고 그 지식이 또 갈라진다. 팔레트는 `type` 하나로
 * 판정한다 (`entryUniverse.resolveCreationMode`) — AI 도 같은 판정을 쓰면 알 필요가 없다.
 * 그래서 도구를 늘리지 않고 `create_element` 가 **팔레트와 같은 분기**를 타게 한다.
 *
 * 분기 SSOT 는 팔레트와 공유한다:
 * - reusable composite (`getReusableCompositeOriginId`) → `type:"ref"` 인스턴스
 * - COMPLEX (`COMPLEX_COMPONENT_TAGS`) → `ComponentFactory.createComplexComponent`
 * - 그 외 leaf → 호출자가 기존 단일 element 경로로 만든다
 */
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";
import { ComponentFactory } from "../../../builder/factories/ComponentFactory";
import { COMPLEX_COMPONENT_TAGS } from "../../../builder/factories/constants";
import { getReusableCompositeOriginId } from "../../../builder/components/reusableCompositeOrigins";
import { resolveCreationParentId } from "../../../builder/hooks/useElementCreator";
import { generateCustomId } from "../../../builder/utils/idGeneration";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import {
  COMPONENT_ROLE_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
} from "../../../adapters/canonical/componentSemanticsMirror";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";

/** 합성 생성 분기 — 팔레트(`useElementCreator`)와 같은 우선순위. */
export type CompositeMode = "reusable" | "complex" | "leaf";

export function resolveCompositeMode(type: string): CompositeMode {
  if (getReusableCompositeOriginId(type)) return "reusable";
  if (COMPLEX_COMPONENT_TAGS.has(type)) return "complex";
  return "leaf";
}

export interface CompositeCreationInput {
  type: string;
  elements: Element[];
  currentPageId: string | null;
  selectedElementId: string | null;
  parentIdOverride?: string | null;
  addElement: (element: Element) => void | Promise<void>;
}

export interface CompositeCreationOutcome {
  elementId: string;
  mode: Exclude<CompositeMode, "leaf">;
  /** 함께 만들어진 자식 수 — 도구 결과에 실어 모델이 구조를 알게 한다. */
  childCount: number;
}

function activeDocument(): CompositionDocument | null {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return null;
  return canonical.documents.get(projectId) ?? null;
}

/**
 * 합성 컴포넌트면 팩토리/ref 경로로 만들고 결과를 돌려준다. leaf 면 `null` —
 * 호출자가 기존 단일 element 경로를 그대로 쓴다.
 */
export async function createCompositeElement(
  input: CompositeCreationInput,
): Promise<CompositeCreationOutcome | null> {
  const mode = resolveCompositeMode(input.type);
  if (mode === "leaf") return null;

  const doc = activeDocument();
  if (!doc) return null;

  const parentId =
    input.parentIdOverride ??
    resolveCreationParentId({
      selectedElementId: input.selectedElementId,
      elements: input.elements,
      currentPageId: input.currentPageId,
      layoutId: null,
      doc,
    });

  if (mode === "reusable") {
    // 조합 트리는 origin (Components page) 이 갖는다 — 인스턴스는 ref 만 만든다.
    const originId = getReusableCompositeOriginId(input.type);
    if (!originId) return null;

    const refElement = withFrameElementMirrorId(
      {
        id: crypto.randomUUID(),
        type: "ref",
        ref: originId,
        [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: originId,
        customId: generateCustomId(input.type, input.elements),
        componentName: input.type,
        props: {},
        page_id: input.currentPageId,
        parent_id: parentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Element,
      null,
    );

    await input.addElement(refElement);
    return { elementId: refElement.id, mode, childCount: 0 };
  }

  // COMPLEX — 팩토리가 부모+자식을 만들고 스토어에 직접 넣는다.
  const parentElement = parentId
    ? (input.elements.find((el) => el.id === parentId) ?? null)
    : null;

  const result = await ComponentFactory.createComplexComponent(
    input.type,
    parentElement,
    input.currentPageId ?? "",
    input.elements,
    null,
    doc,
  );

  return {
    elementId: result.parent.id,
    mode,
    childCount: result.children.length,
  };
}
