// 🚀 Phase 1: Immer 제거 - 함수형 업데이트로 전환
// import { produce } from "immer"; // REMOVED
import type { StateCreator } from "zustand";
import { Element } from "../../../types/core/store.types";
import { normalizeExternalFillIngress } from "../../panels/styles/utils/fillExternalIngress";
import { historyManager } from "../history";
import { getDB } from "../../../lib/db";
import type { ElementsState } from "../elements";
import { normalizeElementTagInElement } from "./elementTagNormalizer";
import { applyFactoryPropagation } from "../../utils/propagationEngine";
import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
} from "@composition/shared";
import { getActiveCanonicalDocument } from "@/builder/stores/canonical/canonicalElementsBridge";
import { getCanonicalRefOverrideEntries } from "../canonical/canonicalElementsView";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import { buildCanonicalInsertEvents } from "../history/canonicalHistoryEvents";
import {
  areCanonicalMutationStoreActionsRegistered,
  mergeElementsCanonicalPrimary,
} from "@/adapters/canonical/canonicalMutations";
import { COMPONENT_MASTER_ID_MIRROR_FIELD } from "@/adapters/canonical/componentSemanticsMirror";
import { generateCustomId, getCustomIdBase } from "../../utils/idGeneration";

type SetState = Parameters<StateCreator<ElementsState>>[0];
type GetState = Parameters<StateCreator<ElementsState>>[1];
type BuilderDb = Awaited<ReturnType<typeof getDB>>;

// ─── ADR-903 P3-D-2: canonical parent context helpers ──────────────────────

/**
 * element.parent_id 가 속한 top-level page/reusable frame context 를 찾는다.
 * 실제 page element 생성은 body 같은 하위 container 아래에서 일어나므로
 * direct parent 뿐 아니라 canonical descendant ancestor 도 page context 로 본다.
 */
function isCanonicalNode(value: unknown): value is CanonicalNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { id?: unknown; type?: unknown };
  return typeof candidate.id === "string" && typeof candidate.type === "string";
}

function getDescendantOverrideChildren(override: unknown): CanonicalNode[] {
  if (isCanonicalNode(override)) return [override];
  if (!override || typeof override !== "object") return [];
  const children = (override as { children?: unknown }).children;
  return Array.isArray(children) ? children.filter(isCanonicalNode) : [];
}

function canonicalNodeContainsId(node: CanonicalNode, nodeId: string): boolean {
  if (node.id === nodeId) return true;
  if (node.children?.some((child) => canonicalNodeContainsId(child, nodeId))) {
    return true;
  }
  if (node.type !== "ref") return false;
  return getCanonicalRefOverrideEntries(node).some(([, override]) =>
    getDescendantOverrideChildren(override).some((child) =>
      canonicalNodeContainsId(child, nodeId),
    ),
  );
}

function isPageContextNode(node: CanonicalNode | undefined): node is FrameNode {
  if (!node || node.type !== "frame" || node.reusable === true) return false;
  const metadataType = (node.metadata as { type?: unknown } | undefined)?.type;
  return (
    metadataType === "page" ||
    metadataType === "legacy-page" ||
    metadataType === undefined
  );
}

function findCanonicalParentContext(
  doc: CompositionDocument,
  parentId: string | null | undefined,
): CanonicalNode | undefined {
  if (!parentId) return undefined;
  return doc.children.find(
    (node) =>
      (isPageContextNode(node) || isReusableContextFrame(node)) &&
      canonicalNodeContainsId(node, parentId),
  );
}

/** parent frame 이 page context (metadata.type === "page") 인지 */
function isPageContextFrame(node: CanonicalNode | undefined): boolean {
  return isPageContextNode(node);
}

/** parent context 가 reusable frame (reusable === true) 인지 */
function isReusableContextFrame(
  node: CanonicalNode | undefined,
): node is FrameNode {
  return node?.type === "frame" && node.reusable === true;
}

function mergeCreatedElementsIntoCanonicalDocument(elements: Element[]): void {
  if (!areCanonicalMutationStoreActionsRegistered()) return;
  mergeElementsCanonicalPrimary(elements);
}

function getRefMasterType<TElement extends Element>(
  element: TElement,
  elementsMap: ReadonlyMap<string, TElement>,
): string | null {
  if (element.type !== "ref") return null;
  const ref = (element as Element & { ref?: unknown }).ref;
  const masterId =
    typeof ref === "string"
      ? ref
      : (element as Element & { [COMPONENT_MASTER_ID_MIRROR_FIELD]?: unknown })[
          COMPONENT_MASTER_ID_MIRROR_FIELD
        ];
  if (typeof masterId !== "string") return null;
  return elementsMap.get(masterId)?.type ?? null;
}

function getCustomIdGenerationBase<TElement extends Element>(
  element: TElement,
  elementsMap: ReadonlyMap<string, TElement>,
): string {
  return (
    getCustomIdBase(element.customId) ??
    getRefMasterType(element, elementsMap) ??
    element.type
  );
}

function hasDuplicateCustomId(customId: string, elements: Element[]): boolean {
  return elements.some((element) => element.customId === customId);
}

function buildCreationElementMap<TElement extends Element>(
  elements: readonly TElement[],
): Map<string, TElement> {
  return new Map(elements.map((element) => [element.id, element]));
}

function withFreshCustomId(
  element: Element,
  allocatedElements: Element[],
): Element {
  if (
    element.customId &&
    !hasDuplicateCustomId(element.customId, allocatedElements)
  ) {
    return element;
  }

  return {
    ...element,
    customId: generateCustomId(
      getCustomIdGenerationBase(
        element,
        buildCreationElementMap(allocatedElements),
      ),
      allocatedElements,
    ),
  };
}

async function persistActiveCanonicalDocument(db: BuilderDb): Promise<void> {
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId) return;
  const doc = canonical.documents.get(projectId);
  if (!doc) return;
  await db.documents.put(projectId, doc);
}

/**
 * AddElement 액션 생성 팩토리
 *
 * 단일 요소를 추가하는 로직을 처리합니다.
 *
 * 처리 순서:
 * 1. canonical document mutation
 * 2. derived store cache 업데이트 (즉시 UI 반영)
 * 3. iframe 업데이트는 Preview canonical sync path가 처리
 * 4. IndexedDB canonical document 저장
 * @param set - Zustand setState 함수
 * @param get - Zustand getState 함수
 * @returns addElement 액션 함수
 */
export const createAddElementAction =
  (set: SetState, get: GetState) => async (element: Element) => {
    const normalizedElement = normalizeExternalFillIngress(
      normalizeElementTagInElement(element),
    );
    const currentState = get();
    const elementToAdd = withFreshCustomId(
      normalizedElement,
      currentState.elements,
    );

    // ADR-903 P3-D-2: canonical parent context 기반 분기
    // - 히스토리 조건: parent 가 page context 또는 reusable frame context 면 기록
    // - reorder 분기: page context → currentPageId 기반 / reusable → frame.id 기반
    const doc = getActiveCanonicalDocument();
    const parentContext = doc
      ? findCanonicalParentContext(doc, elementToAdd.parent_id)
      : undefined;
    const isPageContext = isPageContextFrame(parentContext);
    const isReusableContext = isReusableContextFrame(parentContext);

    mergeCreatedElementsIntoCanonicalDocument([elementToAdd]);

    // 🚀 Phase 1: Immer → 함수형 업데이트
    // 1. 히스토리 추가 (canonical parent 가 page 또는 reusable frame 안일 때)
    if (isPageContext || isReusableContext) {
      historyManager.addEntry({
        type: "add",
        elementId: elementToAdd.id,
        data: {
          canonicalEvents: buildCanonicalInsertEvents([elementToAdd]),
        },
      });
    }

    // 2. derived store cache 업데이트 (불변 - 새로운 배열 참조 생성)
    // ADR-006 P3-1: 구조 변경 → layoutVersion 무조건 증가
    set((prevState) => ({
      elements: [...prevState.elements, elementToAdd],
      layoutVersion: prevState.layoutVersion + 1,
    }));

    // 🔧 CRITICAL: elementsMap 재구축 (요소 추가 후 캐시 업데이트)
    get()._rebuildIndexes();

    // 3. iframe 업데이트는 useIframeMessenger의 useEffect에서 자동 처리
    // (elements 변경 감지 → sendElementsToIframe 자동 호출)

    // 4. Canonical document 저장
    try {
      const db = await getDB();
      await persistActiveCanonicalDocument(db);
    } catch (error) {
      console.warn(
        "⚠️ [IndexedDB] canonical document 저장 중 오류 (메모리는 정상):",
        error,
      );
    }
  };

/**
 * AddComplexElement 액션 생성 팩토리
 *
 * 부모 요소와 자식 요소들을 함께 추가하는 로직을 처리합니다.
 * 복합 컴포넌트(Tabs, Table 등)를 추가할 때 사용됩니다.
 *
 * 예: Tabs 컴포넌트 추가 시 Tab + Panel 쌍을 함께 생성
 *
 * @param set - Zustand setState 함수
 * @param get - Zustand getState 함수
 * @returns addComplexElement 액션 함수
 */
export const createAddComplexElementAction =
  (set: SetState, get: GetState) =>
  async (parentElement: Element, childElements: Element[]) => {
    const normalizedParent = normalizeExternalFillIngress(
      normalizeElementTagInElement(parentElement),
    );
    // ADR-048: 부모 props를 자식에 미리 전파 (Store 추가 전)
    const normalizedChildren = applyFactoryPropagation(
      normalizedParent,
      childElements.map((child) =>
        normalizeExternalFillIngress(normalizeElementTagInElement(child)),
      ),
    ).map((child) => normalizeExternalFillIngress(child));

    const currentState = get();
    const allocatedElements = [...currentState.elements];
    const parentToAdd = withFreshCustomId(normalizedParent, allocatedElements);
    allocatedElements.push(parentToAdd);
    const childrenToAdd = normalizedChildren.map((child) => {
      const nextChild = withFreshCustomId(child, allocatedElements);
      allocatedElements.push(nextChild);
      return nextChild;
    });

    const allElements = [parentToAdd, ...childrenToAdd];

    // ADR-903 P3-D-2: canonical parent context 기반 히스토리 조건
    const doc = getActiveCanonicalDocument();
    const parentContext = doc
      ? findCanonicalParentContext(doc, parentToAdd.parent_id)
      : undefined;
    const isPageContext = isPageContextFrame(parentContext);
    const isReusableContext = isReusableContextFrame(parentContext);

    mergeCreatedElementsIntoCanonicalDocument(allElements);

    // 🚀 Phase 1: Immer → 함수형 업데이트
    // 1. 히스토리 추가 (canonical parent 가 page 또는 reusable frame 안일 때)
    if (isPageContext || isReusableContext) {
      historyManager.addEntry({
        type: "add",
        elementId: parentToAdd.id,
        elementIds: allElements.map((element) => element.id),
        data: {
          canonicalEvents: buildCanonicalInsertEvents(allElements),
        },
      });
    }

    // 2. derived store cache 업데이트 (불변 - 새로운 배열 참조 생성)
    // ADR-006 P3-1: 구조 변경 → layoutVersion 무조건 증가
    set((prevState) => ({
      elements: [...prevState.elements, ...allElements],
      layoutVersion: prevState.layoutVersion + 1,
    }));

    // 🔧 CRITICAL: elementsMap 재구축 (복합 요소 추가 후 캐시 업데이트)
    get()._rebuildIndexes();

    // 3. iframe 업데이트는 useIframeMessenger의 useEffect에서 자동 처리
    // (elements 변경 감지 → sendElementsToIframe 자동 호출)

    // 4. Canonical document 저장
    try {
      const db = await getDB();
      await persistActiveCanonicalDocument(db);
    } catch (error) {
      console.warn(
        "⚠️ [IndexedDB] canonical document 저장 중 오류 (메모리는 정상):",
        error,
      );
    }
  };
