import { useCallback, useRef, useEffect } from "react";
import type { CompositionDocument } from "@composition/shared";
import {
  getCatalogDefaultProps,
  getComponentCatalogEntry,
  type ComponentCatalogEntry,
  type PrimitivePlacementChildTemplate,
} from "@composition/shared/catalog";
import {
  Element,
  ComponentElementProps,
} from "../../types/builder/unified.types";
import { useErrorHandler, type ErrorInfo } from "./useErrorHandler";
import { generateCustomId } from "../utils/idGeneration";
import { ElementUtils } from "../../utils/element/elementUtils";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import { createTabsCompositeElements } from "../factories/definitions/LayoutComponents";
import {
  createSelectCompositeElements,
  createComboBoxCompositeElements,
  createListBoxCompositeElements,
  createMenuCompositeElements,
} from "../factories/definitions/SelectionComponents";
import type { ComponentCreationContext } from "../factories/types";
//import { useStore } from '../stores';

/**
 * ADR-144 Wave D — catalog 진입점 (resolveCatalogElementCreation /
 * useElementCreator.handleAddElement) 가 composite RAC 5 family
 * (Tabs / Select / ComboBox / ListBox / Menu) 의 경우 PrimitiveBinding
 * defaultProps (props.items[] legacy payload) 대신 composite factory
 * (createXxxCompositeElements) 를 호출하여 reusable origin + ref +
 * descendants + slot canonical tree 를 생성한다. ADR-142 catalog cutover
 * 와 ADR-144 composite contract 의 정합 진입점.
 */
const COMPOSITE_RAC_TYPES = new Set([
  "Tabs",
  "Select",
  "ComboBox",
  "ListBox",
  "Menu",
]);

function isCompositeRacType(type: string): boolean {
  return COMPOSITE_RAC_TYPES.has(type);
}

export interface UseElementCreatorReturn {
  getDefaultProps: (type: string) => ComponentElementProps | undefined;
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

export interface CatalogElementCreationPayload {
  elementType: string;
  props: ComponentElementProps;
  ref?: string;
  componentRole?: "instance";
  masterId?: string;
  componentName?: string;
  children?: CatalogElementCreationPayload[];
  /**
   * ADR-144 Wave D — composite RAC 5 family (Tabs/Select/ComboBox/ListBox/
   * Menu) sentinel. true 이면 caller (handleAddElement) 가
   * createXxxCompositeElements factory 호출 분기로 진입하여 masters +
   * instance 를 생성. 본 payload 의 elementType/props 는 fallback 표시용.
   */
  composite?: true;
}

function isCatalogEntry(value: unknown): value is ComponentCatalogEntry {
  return value !== null && typeof value === "object" && "cutover" in value;
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

export function resolveCatalogElementCreation(
  input: string | ComponentCatalogEntry,
): CatalogElementCreationPayload | undefined {
  const entry = isCatalogEntry(input) ? input : getComponentCatalogEntry(input);
  if (!entry || entry.cutover !== "catalog") return undefined;

  if (entry.kind === "primitive") {
    // ADR-144 Wave D — composite RAC 5 family 진입점 분리.
    // PrimitiveBinding.defaultProps (props.items[] legacy payload) 대신
    // composite factory (createXxxCompositeElements) 가 reusable origin
    // + ref + descendants + slot canonical tree 생성. caller 가
    // payload.composite 감지 후 분기.
    if (isCompositeRacType(entry.type)) {
      return {
        elementType: entry.type,
        props: { ...entry.binding.defaultProps } as ComponentElementProps,
        composite: true,
      };
    }
    const placement = entry.binding.placement;
    return {
      elementType: entry.type,
      props: { ...entry.binding.defaultProps } as ComponentElementProps,
      ...(placement?.kind === "node-with-children"
        ? {
            children: placement.children.map((child) =>
              cloneCatalogPlacementChild(child),
            ),
          }
        : {}),
    };
  }

  if (entry.kind === "reusable") {
    return {
      elementType: "ref",
      props: {} as ComponentElementProps,
      ref: entry.reusableId,
      componentRole: "instance",
      masterId: entry.reusableId,
      componentName: entry.type,
    };
  }

  return {
    elementType: entry.type,
    props: { ...(entry.defaultProps ?? {}) } as ComponentElementProps,
  };
}

function cloneCatalogPlacementChild(
  child: PrimitivePlacementChildTemplate,
): CatalogElementCreationPayload {
  return {
    elementType: child.type,
    props: { ...child.props } as ComponentElementProps,
    ...(child.children
      ? {
          children: child.children.map((nestedChild) =>
            cloneCatalogPlacementChild(nestedChild),
          ),
        }
      : {}),
  };
}

function createCatalogChildElements({
  children,
  parentId,
  currentPageId,
  layoutId,
  elements,
  createdElements,
}: {
  children: CatalogElementCreationPayload[];
  parentId: string;
  currentPageId: string;
  layoutId: string | null | undefined;
  elements: Element[];
  createdElements: Element[];
}): Element[] {
  const result: Element[] = [];
  const createChildren = (
    childPayloads: CatalogElementCreationPayload[],
    currentParentId: string,
  ): void => {
    childPayloads.forEach((childPayload) => {
      const child = withFrameElementMirrorId(
        {
          id: crypto.randomUUID(),
          type: childPayload.elementType,
          customId: generateCustomId(childPayload.elementType, [
            ...elements,
            ...createdElements,
            ...result,
          ]),
          props: childPayload.props,
          page_id: layoutId ? null : currentPageId,
          parent_id: currentParentId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        layoutId || null,
      );
      result.push(child);
      if (childPayload.children?.length) {
        createChildren(childPayload.children, child.id);
      }
    });
  };

  createChildren(children, parentId);
  return result;
}

export function resolveDefaultPropsForCreation(
  type: string,
): ComponentElementProps | undefined {
  return getCatalogDefaultProps(type) as ComponentElementProps | undefined;
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

  const getDefaultProps = useCallback(
    (type: string): ComponentElementProps | undefined =>
      resolveDefaultPropsForCreation(type),
    [],
  );

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

          const catalogCreation = resolveCatalogElementCreation(type);
          if (!catalogCreation) {
            handleError(
              new Error(`Catalog entry not found for component type: ${type}`),
              `요소 생성 실패: ${type}`,
              {
                type: "validation",
                severity: "high",
                operation: "create",
                recoverable: false,
              },
            );
            return;
          }

          // 롤백 포인트 추가
          addRollbackPoint({
            operation: "create",
            elementId: "pending",
            previousElements: [...elements],
            timestamp: new Date(),
          });

          const operation = async () => {
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

            // ADR-144 Wave D — composite RAC 5 family 분기 (catalog 정합 진입점)
            if (catalogCreation.composite) {
              const compositeContext: ComponentCreationContext = {
                parentElement: parentEl ?? null,
                pageId: currentPageId || "",
                elements,
                layoutId,
                doc,
              };
              const compositeOptions = { parentId: parentId ?? null };

              let result: { masters: Element[]; instance: Element };
              switch (type) {
                case "Tabs":
                  result = createTabsCompositeElements(
                    compositeContext,
                    compositeOptions,
                  );
                  break;
                case "Select":
                  result = createSelectCompositeElements(
                    compositeContext,
                    compositeOptions,
                  );
                  break;
                case "ComboBox":
                  result = createComboBoxCompositeElements(
                    compositeContext,
                    compositeOptions,
                  );
                  break;
                case "ListBox":
                  result = createListBoxCompositeElements(
                    compositeContext,
                    compositeOptions,
                  );
                  break;
                case "Menu":
                  result = createMenuCompositeElements(
                    compositeContext,
                    compositeOptions,
                  );
                  break;
                default:
                  throw new Error(
                    `ADR-144 Wave D: composite RAC type 미등록 — ${type}. COMPOSITE_RAC_TYPES Set 와 switch 분기 동기화 필요`,
                  );
              }

              // masters + instance 양쪽 addElement — mergeElementsCanonicalPrimary
              // 의 upsertElementIntoDocument 가 masters 는 reusableComponents
              // 로, instance 는 page tree 로 라우팅.
              result.masters.forEach((master) => addElement(master));
              addElement(result.instance);
              return;
            }

            const newElement: Element = withFrameElementMirrorId(
              {
                id: crypto.randomUUID(),
                type: catalogCreation.elementType,
                customId: generateCustomId(type, elements),
                props: catalogCreation.props,
                ...(catalogCreation.ref
                  ? {
                      ref: catalogCreation.ref,
                      componentRole: catalogCreation.componentRole,
                      masterId: catalogCreation.masterId,
                      componentName: catalogCreation.componentName,
                    }
                  : {}),
                page_id: layoutId ? null : currentPageId,
                parent_id: parentId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              layoutId || null,
            );
            const childElements = createCatalogChildElements({
              children: catalogCreation.children ?? [],
              parentId: newElement.id,
              currentPageId,
              layoutId,
              elements,
              createdElements: [newElement],
            });

            addElement(newElement);
            childElements.forEach((child) => addElement(child));
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
