import { useCallback, useRef, useEffect } from "react";
import type { CompositionDocument } from "@composition/shared";
import {
  Element,
  ComponentElementProps,
  getDefaultProps as getCentralDefaultProps,
} from "../../types/builder/unified.types";
import { ComponentFactory } from "../factories/ComponentFactory";
import { COMPLEX_COMPONENT_TAGS } from "../factories/constants";
import { useErrorHandler, type ErrorInfo } from "./useErrorHandler";
import { generateCustomId } from "../utils/idGeneration";
import { ElementUtils } from "../../utils/element/elementUtils";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
//import { useStore } from '../stores';

export interface UseElementCreatorReturn {
  getDefaultProps: (type: string) => ComponentElementProps;
  handleAddElement: (
    type: string,
    currentPageId: string,
    selectedElementId: string | null,
    elements: Element[],
    addElement: (element: Element) => void,
    layoutId: string | null | undefined,
    doc: CompositionDocument,
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
  elements: Element[];
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

export const useElementCreator = (): UseElementCreatorReturn => {
  const isProcessingRef = useRef(false);
  const elementsRef = useRef<Element[]>([]);
  const lastOperationRef = useRef<(() => Promise<void>) | null>(null);
  const isConfiguredRef = useRef(false);

  const {
    handleError,
    addRollbackPoint,
    rollback,
    retryOperation,
    validateElements,
    getErrorStats,
  } = useErrorHandler();

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
      elements: Element[],
      addElement: (element: Element) => void,
      layoutId: string | null | undefined,
      doc: CompositionDocument,
    ) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // 요소 유효성 검사
      const validation = validateElements(elements);
      if (!validation.isValid) {
        handleError(validation.errors.join(", "), "요소 유효성 검사 실패", {
          type: "validation",
          severity: "high",
        });
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

          const operation = async () => {
            if (COMPLEX_COMPONENT_TAGS.has(type)) {
              // ComponentFactory를 사용하여 복합 컴포넌트 생성
              const result = await ComponentFactory.createComplexComponent(
                type,
                selectedElement ?? null,
                currentPageId,
                elements,
                layoutId, // ⭐ Layout/Slot System: layoutId 전달
                doc,
              );
              void result;
            } else {
              // 단순 컴포넌트 생성 (캐시 활용)
              // selectedElementId 는 page-level selection id 일 수 있으므로
              // 실제 element id 로 확인된 경우에만 parent_id 로 사용한다.
              let parentId = resolveCreationParentId({
                selectedElementId,
                elements,
                currentPageId: currentPageId || null,
                layoutId,
                doc,
              });

              // Card + action component → CardFooter 자동 라우팅
              const parentEl = parentId
                ? elements.find((el) => el.id === parentId)
                : null;
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
                      el.parent_id === parentId &&
                      el.type === "CardFooter" &&
                      !el.deleted,
                  );
                  if (cardFooter) {
                    parentId = cardFooter.id;
                    console.log(
                      `📎 Card action routing: ${type} → CardFooter (${cardFooter.id})`,
                    );
                  }
                }
              }

              const newElement: Element = withFrameElementMirrorId(
                {
                  id: crypto.randomUUID(), // UUID 생성
                  type,
                  customId: generateCustomId(type, elements),
                  props: getDefaultProps(type),
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
            }
          };

          // 마지막 작업 저장 (재시도용)
          lastOperationRef.current = operation;

          // 재시도 로직과 함께 작업 실행
          await retryOperation(operation, 3);
        }
      } catch (error) {
        handleError(error, `요소 생성 실패: ${type}`, {
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
