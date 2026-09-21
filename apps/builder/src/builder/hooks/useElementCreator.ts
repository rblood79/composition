import { useCallback, useRef, useEffect } from "react";
import { useI18n } from "@/i18n";
import { focusCanvasContainer } from "./useActiveScope";
import type { CompositionDocument } from "@composition/shared";
import {
  createCanonicalNestingIndex,
  findCanonicalNodeById,
  findCanonicalNodeType,
} from "@composition/shared";
import {
  Element,
  ComponentElementProps,
  getDefaultProps as getCentralDefaultProps,
} from "../../types/builder/unified.types";
import { ComponentFactory } from "../factories/ComponentFactory";
import { composeCreationProps } from "../factories/creationStyleDefaults";
import type { ComponentCreationSourceNode } from "../factories/types";
import type { CanvasInteractionNode } from "../workspace/canvas/interaction/interactionNode";
import { resolveNestingAwareTarget } from "../workspace/canvas/interaction/nestingRelocation";
import {
  notifyNestingRejected,
  notifyNestingRelocation,
} from "../workspace/canvas/interaction/nestingNotice";

import { COMPLEX_COMPONENT_TAGS } from "../factories/constants";
import { getReusableCompositeOriginId } from "../components/reusableCompositeOrigins";
import { useErrorHandler, type ErrorInfo } from "./useErrorHandler";
import { generateCustomId } from "../utils/idGeneration";
import { ElementUtils } from "../../utils/element/elementUtils";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import {
  COMPONENT_ROLE_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
} from "../../adapters/canonical/componentSemanticsMirror";
import { useStore } from "../stores";

/**
 * 팔레트 추가의 중첩 preflight. 선택된 요소 (= 생성 부모) 가 `type` 을 담을 수 없으면
 * 가까운 유효 조상으로 부모를 옮기고, 어디에도 못 두면 `rejected` 로 취소한다.
 * `notify()` 는 요소가 실제로 추가된 **뒤** 에 불러야 되돌리기가 그 추가를 되돌린다.
 */
function resolveNestedCreationParent(
  type: string,
  parentId: string | null,
  elements: readonly ComponentCreationSourceNode[],
  doc: CompositionDocument,
): {
  parentId: string | null;
  parentElement: ComponentCreationSourceNode | null;
  rejected: boolean;
  relocated: boolean;
  notify: () => void;
} {
  // ADR-228: ref instance 는 원본 root 의 타입으로 판정한다 — 팔레트 배치가 전부 instance 라
  //   "ref" 를 그대로 두면 preflight 가 opaque 통과해 Button 안 Button 같은 규칙이 무력해진다
  //   (canonical guard 의 `canonicalNestingContext.effectiveType` 과 같은 규칙).
  //   origin 은 Components 페이지에 있어 page-scoped `elements` 에 없다 — 문서에서 읽는다
  //   (codex round 3 h1: elements 만 보던 첫 구현이 headed 에서 Button 안 Button 을 만들었다).
  const rawById = new Map(elements.map((el) => [el.id, el]));
  const nestingIndex = createCanonicalNestingIndex(doc);
  const effectiveType = (el: ComponentCreationSourceNode): string => {
    const ref = (el as { ref?: unknown }).ref;
    if (el.type !== "ref" || typeof ref !== "string") return el.type;
    const origin = rawById.get(ref);
    if (origin && origin.type !== "ref") return origin.type;
    return findCanonicalNodeType(nestingIndex, ref) ?? el.type;
  };
  const byId = new Map<string, CanvasInteractionNode>(
    elements.map((el) => [
      el.id,
      {
        id: el.id,
        type: effectiveType(el),
        props: el.props ?? {},
        parent_id: el.parent_id ?? null,
        page_id: el.page_id ?? null,
      },
    ]),
  );
  const passthrough = {
    parentId,
    parentElement: parentId
      ? (elements.find((el) => el.id === parentId) ?? null)
      : null,
    rejected: false,
    relocated: false,
    notify: () => {},
  };
  if (!parentId) return passthrough;

  const nesting = resolveNestingAwareTarget({
    renderTargetId: parentId,
    insertionIndex: Number.MAX_SAFE_INTEGER,
    movingTypes: [type],
    elementsMap: byId,
  });
  if (!nesting.relocation) return passthrough;
  if (nesting.relocation.relocatedToId === null) {
    notifyNestingRejected(nesting.relocation.violation);
    return { ...passthrough, rejected: true };
  }
  const relocation = nesting.relocation;
  const nextParentId = nesting.renderTargetId;
  return {
    parentId: nextParentId,
    parentElement: elements.find((el) => el.id === nextParentId) ?? null,
    rejected: false,
    relocated: true,
    notify: () =>
      notifyNestingRelocation(
        relocation,
        byId.get(nextParentId)?.type ?? nextParentId,
      ),
  };
}

export interface UseElementCreatorReturn {
  getDefaultProps: (type: string) => ComponentElementProps;
  handleAddElement: (
    type: string,
    currentPageId: string,
    selectedElementId: string | null,
    elements: ComponentCreationSourceNode[],
    addElement: (element: Element) => void,
    layoutId: string | null | undefined,
    doc: CompositionDocument,
    initialProps?: Record<string, unknown>,
  ) => Promise<void>;
  getPerformanceStats: () => {
    cacheSize: number;
    childrenCacheSize: number;
    hitRate: number;
  };
  clearCache: () => void;
  updateCacheConfig: (
    config: Partial<{
      maxCacheSize: number;
      enableIncrementalUpdate: boolean;
      enableBatchProcessing: boolean;
      batchSize: number;
    }>,
  ) => void;
  getErrorStats: () => {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: ErrorInfo[];
  };
  rollback: (steps?: number) => Promise<boolean>;
  retryLastOperation: () => Promise<void>;
}

interface ResolveCreationParentIdInput {
  selectedElementId: string | null;
  elements: ComponentCreationSourceNode[];
  currentPageId: string | null;
  layoutId: string | null | undefined;
  doc: CompositionDocument;
}

export function resolveCreationParentId({
  selectedElementId,
  elements,
  currentPageId,
  layoutId,
  doc,
}: ResolveCreationParentIdInput): string | null {
  const selectedElement = selectedElementId
    ? elements.find((el) => el.id === selectedElementId)
    : null;
  if (selectedElement) {
    return selectedElement.id;
  }

  return ElementUtils.findBodyByContext(
    elements,
    currentPageId || null,
    layoutId || null,
    doc,
  );
}

/**
 * ADR-228: reusable instance 의 초기 props — 호출자가 명시한 initialProps 만 override 로 둔다.
 * origin 기본 props 를 복사하지 않는다 (unmodified 값은 origin 변경을 따라야 한다).
 * `style` 은 origin style 과 resolve 시 deep-merge 되므로 여기서도 명시분만 싣는다.
 */
export function buildReusableInstanceProps(
  initialProps: Record<string, unknown> | undefined,
  originProps: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!initialProps) return {};
  // 팔레트 creationVariants (Chart `chart-*`) 의 initialProps 는 `createChartInitialProps(chartType)`
  //   전체다 — 그대로 실으면 instance 가 origin 기본값을 통째로 소유해 origin 편집이 전파되지
  //   않는다 (리뷰 H1). origin 유효값과 **다른 키만** patch 로 남기고, 진입점을 가르는
  //   `chartType` 은 값이 같아도 명시 보존한다 (breakdown §3.2).
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(initialProps)) {
    if (
      key !== "chartType" &&
      originProps &&
      Object.hasOwn(originProps, key) &&
      JSON.stringify(originProps[key]) === JSON.stringify(value)
    ) {
      continue;
    }
    patch[key] = value;
  }
  return patch;
}

/**
 * 생성 부모 결정 — plain / ref 두 분기가 같이 쓴다 (ADR-228 에서 ref 분기로 확장).
 * ① 선택 → 실제 element id 확인 ② Card + 액션 컴포넌트 → CardFooter 자동 라우팅
 * ③ 중첩 preflight (가까운 유효 조상으로 이동 · 어디에도 못 두면 rejected).
 */
export function resolveCreationParentForType(
  type: string,
  input: {
    selectedElementId: string | null;
    elements: readonly ComponentCreationSourceNode[];
    currentPageId: string | null;
    layoutId: string | null | undefined;
    doc: CompositionDocument;
  },
): ReturnType<typeof resolveNestedCreationParent> {
  const elements = input.elements as ComponentCreationSourceNode[];
  let parentId = resolveCreationParentId({
    selectedElementId: input.selectedElementId,
    elements,
    currentPageId: input.currentPageId,
    layoutId: input.layoutId,
    doc: input.doc,
  });

  // Card + action component → CardFooter 자동 라우팅
  const parentEl = parentId ? elements.find((el) => el.id === parentId) : null;
  if (parentEl?.type === "Card") {
    const ACTION_TAGS = new Set([
      "Button",
      "ToggleButton",
      "Link",
      "ActionButtonGroup",
      "ButtonGroup",
    ]);
    if (ACTION_TAGS.has(type)) {
      const cardFooter = elements.find(
        (el) =>
          el.parent_id === parentId && el.type === "CardFooter" && !el.deleted,
      );
      if (cardFooter) {
        parentId = cardFooter.id;
        console.log(
          `📎 Card action routing: ${type} → CardFooter (${cardFooter.id})`,
        );
      }
    }
  }

  // 중첩 preflight — Button 안에 Button, Text 안에 무엇이든 등은 가까운 유효
  //   조상으로 옮기고 알린다. 어디에도 못 두면 취소.
  return resolveNestedCreationParent(type, parentId, elements, input.doc);
}

export const useElementCreator = (): UseElementCreatorReturn => {
  const isProcessingRef = useRef(false);
  const elementsRef = useRef<ComponentCreationSourceNode[]>([]);
  const lastOperationRef = useRef<(() => Promise<string | null>) | null>(null);
  const isConfiguredRef = useRef(false);

  const {
    handleError,
    addRollbackPoint,
    rollback,
    retryOperation,
    validateElements,
    getErrorStats,
  } = useErrorHandler();
  const { t } = useI18n();

  useEffect(() => {
    if (!isConfiguredRef.current) {
      isConfiguredRef.current = true;
    }
  }, []); // 빈 의존성 배열로 한 번만 실행

  const getDefaultProps = useCallback((type: string): ComponentElementProps => {
    return getCentralDefaultProps(type);
  }, []);

  const handleAddElement = useCallback(
    async (
      type: string,
      currentPageId: string,
      selectedElementId: string | null,
      elements: ComponentCreationSourceNode[],
      addElement: (element: Element) => void,
      layoutId: string | null | undefined,
      doc: CompositionDocument,
      initialProps?: Record<string, unknown>,
    ) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // 요소 유효성 검사
      const validation = validateElements(elements, {
        frameScoped: Boolean(layoutId),
      });
      if (!validation.isValid) {
        handleError(
          validation.errors.join(", "),
          t("errors.elementValidation"),
          {
            type: "validation",
            severity: "high",
          },
        );
        isProcessingRef.current = false;
        return;
      }

      try {
        // Page 모드 또는 Layout 모드에서 실행
        if (currentPageId || layoutId) {
          // 요소 배열 참조 업데이트
          elementsRef.current = elements;

          const selectedElement = selectedElementId
            ? elements.find((el) => el.id === selectedElementId)
            : null;

          // 롤백 포인트 추가
          addRollbackPoint({
            operation: "create",
            elementId: "pending",
            previousElements: [...elements],
            timestamp: new Date(),
          });

          // 복합 컴포넌트인지 확인 (공유 상수 사용)

          // 생성된 최상위 element id (auto-select 용). 각 분기에서 설정.
          const operation = async (): Promise<string | null> => {
            const reusableCompositeOriginId =
              getReusableCompositeOriginId(type);
            if (reusableCompositeOriginId) {
              // ADR-912 R-5 (HC#5 조합=데이터): reusable composite 는 factory definition
              //   코드 없이 origin 문서를 참조하는 type:"ref" instance 로 생성한다.
              //   조합 트리(자식)는 origin (Components page body) 이 보유 → palette-add 는
              //   ref 만 만든다 (paste 경로와 동일한 instance shape).
              // ADR-228 (2026-09-21): 팔레트 RAC 전 항목이 이 분기를 탄다 — plain 분기와 같은
              //   부모 결정 (Card 액션 → CardFooter 라우팅 · 중첩 preflight) 을 거치고,
              //   instance 는 **호출자가 명시한 initialProps 만** override 로 소유한다 (Chart
              //   진입점의 chartType 등, breakdown §3.2). 공통 기본값은 origin 상속.
              const parent = resolveCreationParentForType(type, {
                selectedElementId,
                elements,
                currentPageId: currentPageId || null,
                layoutId,
                doc,
              });
              if (parent.rejected) return null;

              const refElement: Element = withFrameElementMirrorId(
                {
                  id: crypto.randomUUID(),
                  type: "ref",
                  ref: reusableCompositeOriginId,
                  [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
                  [COMPONENT_MASTER_ID_MIRROR_FIELD]: reusableCompositeOriginId,
                  customId: generateCustomId(type, elements),
                  componentName: type,
                  // origin 은 Components 페이지에 있어 page-scoped `elements` 에 없다 — 문서에서 읽는다.
                  props: buildReusableInstanceProps(
                    initialProps,
                    findCanonicalNodeById(doc, reusableCompositeOriginId)
                      ?.props,
                  ),
                  page_id: layoutId ? null : currentPageId,
                  parent_id: parent.parentId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                } as Element,
                layoutId || null,
              );

              addElement(refElement);
              parent.notify();
              return refElement.id;
            } else if (COMPLEX_COMPONENT_TAGS.has(type)) {
              // 중첩 preflight — 선택된 요소가 이 타입을 담을 수 없으면 가까운 유효 조상으로
              //   옮기고 알린다 (canonical guard 가 조용히 거부하기 전에).
              const complexParent = resolveNestedCreationParent(
                type,
                selectedElement?.id ?? null,
                elements,
                doc,
              );
              if (complexParent.rejected) return null;
              // ComponentFactory를 사용하여 복합 컴포넌트 생성
              const result = await ComponentFactory.createComplexComponent(
                type,
                // relocation 이 없으면 기존 인자 그대로 — 선택 요소가 elements 에 없는
                //   stale 선택 창 (ADR-137) 에서 루트 생성으로 바뀌지 않게 (리뷰 MEDIUM)
                complexParent.relocated
                  ? complexParent.parentElement
                  : (selectedElement ?? null),
                currentPageId,
                elements,
                layoutId, // ⭐ Layout/Slot System: layoutId 전달
                doc,
                initialProps,
              );
              complexParent.notify();
              return result.parent.id;
            } else {
              // 단순 컴포넌트 생성 (캐시 활용)
              // selectedElementId 는 page-level selection id 일 수 있으므로
              // 실제 element id 로 확인된 경우에만 parent_id 로 사용한다.
              const nested = resolveCreationParentForType(type, {
                selectedElementId,
                elements,
                currentPageId: currentPageId || null,
                layoutId,
                doc,
              });
              if (nested.rejected) return null;
              const parentId = nested.parentId;

              const newElement: Element = withFrameElementMirrorId(
                {
                  id: crypto.randomUUID(), // UUID 생성
                  type,
                  customId: generateCustomId(type, elements),
                  props: composeCreationProps(
                    type,
                    getDefaultProps(type),
                    initialProps,
                  ),
                  // Layout 모드면 legacy layout binding 사용, 아니면 page_id 사용
                  page_id: layoutId ? null : currentPageId,
                  parent_id: parentId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                layoutId || null,
              );

              // addElement 호출 (내부에서 DB 저장 처리)
              addElement(newElement);
              nested.notify();
              return newElement.id;
            }
          };

          // 마지막 작업 저장 (재시도용)
          lastOperationRef.current = operation;

          // 재시도 로직과 함께 작업 실행
          const createdTopLevelId = await retryOperation(operation, 3);

          // 추가 직후 새 요소를 선택 (단순/복합/ref 공통).
          // 미선택 시 selection 이 직전 상태(보통 body)에 머물러, 추가 직후 Delete 가
          // body 가드에 걸린다. Fix 1 로 elementsMap 동기화가 보장되므로 select 한 id 가
          // 즉시 유효하다.
          if (createdTopLevelId) {
            useStore.getState().setSelectedElement(createdTopLevelId);

            // 캔버스 컨테이너에 DOM 포커스를 옮긴다.
            // setSelectedElement 는 store selection 만 갱신하고 포커스는 클릭한 팔레트
            // 카드(BUTTON.list-item)에 남는다. Delete/Backspace 단축키 scope 는
            // "canvas-focused" (= document.activeElement 가 .canvas-container 내부)
            // 이므로, 포커스를 옮기지 않으면 추가 직후 바로 Delete 가 핸들러 scope
            // 필터에서 탈락해 동작하지 않는다 (사용자가 캔버스를 다시 클릭해야만
            // 삭제 가능하던 증상). BuilderCanvas onPointerDown 의 containerRef.focus()
            // 와 동일 패턴 — 여기선 hook 밖이라 DOM selector 로 접근.
            focusCanvasContainer({ preventScroll: true });
          }
        }
      } catch (error) {
        handleError(error, t("errors.elementCreateFailed", { type }), {
          type: "creation",
          severity: "high",
          elementId: selectedElementId || undefined,
          operation: "create",
          recoverable: true,
        });
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      getDefaultProps,
      handleError,
      t,
      addRollbackPoint,
      retryOperation,
      validateElements,
    ],
  );

  const getPerformanceStats = useCallback(() => {
    return {
      cacheSize: 0,
      childrenCacheSize: 0,
      hitRate: 0,
    };
  }, []);

  const clearCache = useCallback(() => {
    return;
  }, []);

  const updateCacheConfig = useCallback(
    (
      config: Partial<{
        maxCacheSize: number;
        enableIncrementalUpdate: boolean;
        enableBatchProcessing: boolean;
        batchSize: number;
      }>,
    ) => {
      void config;
    },
    [],
  );

  const retryLastOperation = useCallback(async () => {
    if (lastOperationRef.current) {
      await retryOperation(lastOperationRef.current, 3);
    }
  }, [retryOperation]);

  return {
    getDefaultProps,
    handleAddElement,
    getPerformanceStats,
    clearCache,
    updateCacheConfig,
    getErrorStats,
    rollback,
    retryLastOperation,
  };
};
