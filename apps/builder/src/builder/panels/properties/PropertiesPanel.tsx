/**
 * PropertiesPanel - 속성 편집 패널
 *
 * PanelProps 인터페이스를 구현하여 패널 시스템과 통합
 * 요소별 속성 에디터를 동적으로 로드하여 표시
 *
 * ⭐ 최적화: PropertyEditorWrapper로 Editor 렌더링 분리
 *
 * 비활성 gating 은 PanelContainer 의 <Activity mode="hidden"> 이 담당 (ADR-155)
 */

import { useState, useCallback, useMemo, memo } from "react";
import { useDebouncedSelectedElementData } from "../../stores";
import type { SelectedElement } from "../../inspector/types";
import { useEditContract } from "./hooks/useEditContract";
import { GenericFieldRenderer } from "./generic/GenericFieldRenderer";
import {
  EmptyState,
  PanelHeader,
  MultiSelectStatusIndicator,
  BatchPropertyEditor,
  SelectionFilter,
  KeyboardShortcutsHelp,
  SmartSelection,
  SelectionMemory,
} from "../../components";
import { ElementSlotSelector } from "./editors/ElementSlotSelector";
import { ComponentSemanticsSection } from "./ComponentSemanticsSection";
import { ComponentSlotFillSection } from "./ComponentSlotFillSection";
import { FrameSlotSection } from "./FrameSlotSection";
import { ButtonChildSection } from "./ButtonChildSection";
import { ActionIconButton } from "../../components/ui";
import { Copy, ClipboardPaste, Settings2 } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  useKeyboardShortcutsRegistry,
  useCopyPaste,
  useActiveScope,
} from "@/builder/hooks";
import { useStore } from "../../stores";
import {
  getSlotMirrorName,
  SLOT_NAME_MIRROR_FIELD,
  withSlotMirrorName,
} from "../../../adapters/canonical/slotMirror";
import { getPropagationRules } from "../../utils/propagationRegistry";
import { buildPropagationUpdates } from "../../utils/propagationEngine";
import type { BatchPropsUpdate } from "../../stores/utils/elementUpdate";
import {
  copyMultipleElements,
  pasteMultipleElements,
  resolvePasteTargetParentId,
  serializeCopiedElements,
  deserializeCopiedElements,
} from "../../utils/multiElementCopy";
import { selectionMemory } from "../../utils/selectionMemory";
import { createGroupFromSelection } from "../../stores/utils/elementGrouping";
import {
  panelNodeToElement,
  panelNodeMapToElementMap,
} from "./panelNodeElementMap";
import { alignElements } from "../../stores/utils/elementAlignment";
import type { AlignmentType } from "../../stores/utils/elementAlignment";
import { distributeElements } from "../../stores/utils/elementDistribution";
import type { DistributionType } from "../../stores/utils/elementDistribution";
import {
  trackBatchUpdate,
  trackGroupCreation,
  trackMultiPaste,
  trackMultiDelete,
} from "../../stores/utils/historyHelpers";
import {
  isCanonicalRefElement,
  type CanonicalRefResolvableNode,
  resolveCanonicalRefElement,
  resolveCanonicalRefTree,
} from "../../utils/canonicalRefResolution";
import {
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElement,
  useCanonicalPropertyElementsMap,
} from "./hooks/useCanonicalPropertyRead";
import { isComponentInstanceMirrorElement } from "../../../adapters/canonical/componentSemanticsMirror";
import type { PanelNode } from "../panelNode";
import type { Element } from "../../../types/core/store.types";

type PanelCanonicalRefNode = CanonicalRefResolvableNode & {
  props: Record<string, unknown>;
};

function panelNodeToCanonicalRefNode(node: PanelNode): PanelCanonicalRefNode {
  const { componentName, customId, metadata, name, ...rest } = node;
  return {
    ...rest,
    props: node.props,
    ...(customId != null ? { customId } : {}),
    ...(componentName != null ? { componentName } : {}),
    ...(metadata ? { metadata } : {}),
    ...(name != null ? { name } : {}),
  };
}

/**
 * CatalogEditContractEditor - ADR-912 단계 2 generic Properties view.
 *
 * getEditor(per-type 동적 에디터) 다중 등록 대신 `useEditContract` 단일 진입점 + generic
 * `GenericFieldRenderer` 로 semantic 필드(node.props, D2 의미층)를 편집한다. 컴포넌트별
 * editor 분기 0 — catalog entry(binding.accepts) + theme rule 단일 source 파생(HC#1/#2).
 *
 * **단계 2 scope (사용자 결정 2026-06-03 "Properties view만 단계 2")**: Properties view =
 * `origin:"semantic"` 필드만 렌더. Style view(origin:"style") 전면 전환은 후속 단계.
 *
 * **보존 동작**: semantic write 는 ADR-048 propagation(부모 prop 변경 → 자식 전파) +
 * canonical ref instance 해소를 그대로 유지(legacy PropertyEditorWrapper.handleUpdate 동일 로직 +
 * 동일 `as Map<...>` cast — PanelNode/Element 경계 우회 보존).
 */
const CatalogEditContractEditor = memo(
  function CatalogEditContractEditor({
    selectedElement,
  }: {
    selectedElement: SelectedElement;
  }) {
    const selectedCanonicalElement = useCanonicalPropertyElement(
      selectedElement.id,
    );
    const elementsById = useCanonicalPropertyElementsMap();
    const childrenByParent = useCanonicalPropertyChildrenMap();
    const lookupElementList = useMemo(
      () => Array.from(elementsById.values()),
      [elementsById],
    );
    const lookupRefElementList = useMemo(
      () => lookupElementList.map(panelNodeToCanonicalRefNode),
      [lookupElementList],
    );

    // 편집 계약 단일 진입점 — semantic ∪ style 필드를 origin 태그와 함께 산출.
    const contract = useEditContract(selectedElement.id);
    // Properties view = semantic origin (node.props / D2). style origin 은 Style view(후속).
    const semanticFields = useMemo(() => {
      const fields = contract.fields.filter((f) => f.origin === "semantic");
      // icon Button/ToggleButton: label 이 RSP 공식대로 `<Text>` 자식 element 로 이관되어
      //   Button.children 이 비므로, GenericFieldRenderer 의 "Text"(children) 필드를 제외한다.
      //   대신 ButtonChildSection 의 Text 입력이 그 `<Text>` 자식을 편집(중복 필드 방지).
      if (
        selectedElement.type === "Button" ||
        selectedElement.type === "ToggleButton"
      ) {
        const kids = childrenByParent.get(selectedElement.id) ?? [];
        if (kids.some((c) => c.type === "Icon" && !c.deleted)) {
          return fields.filter((f) => f.key !== "children");
        }
      }
      return fields;
    }, [contract, selectedElement.type, selectedElement.id, childrenByParent]);

    // semantic write — ADR-048 propagation + canonical ref 해소 보존 (legacy handleUpdate 동일).
    const handleSemanticUpdate = useCallback(
      (key: string, value: unknown) => {
        const state = useStore.getState();
        const element =
          elementsById.get(selectedElement.id) ?? selectedCanonicalElement;
        if (!element) return;

        const refElement = panelNodeToCanonicalRefNode(element);
        const effectiveElement = isCanonicalRefElement(refElement)
          ? resolveCanonicalRefElement(refElement, lookupRefElementList)
          : refElement;
        const baselineProps = (effectiveElement.props ?? {}) as Record<
          string,
          unknown
        >;
        // 실제 변경된 경우만 — stale 덮어쓰기 방지(legacy handleUpdate 동일).
        if (baselineProps[key] === value) return;
        const changedProps: Record<string, unknown> = { [key]: value };

        const isComponentInstanceSelection =
          isCanonicalRefElement(refElement) ||
          isComponentInstanceMirrorElement(panelNodeToElement(element));
        const propagationSource = isComponentInstanceSelection
          ? (() => {
              const lookupElementsMap = new Map(
                lookupRefElementList.map((candidate) => [
                  candidate.id,
                  candidate,
                ]),
              );
              return resolveCanonicalRefTree({
                elements: lookupRefElementList,
                elementsMap: lookupElementsMap,
              });
            })()
          : null;
        const propagationElement =
          propagationSource?.elementsMap.get(refElement.id) ?? effectiveElement;
        const propagationChildrenMap =
          propagationSource?.childrenMap ?? childrenByParent;
        const propagationElementsMap =
          propagationSource?.elementsMap ?? elementsById;

        // ADR-048: propagation 규칙 중 변경된 prop과 매칭되는 것이 있으면 자식도 업데이트
        const rules = getPropagationRules(propagationElement.type);
        if (
          rules &&
          rules.some(
            (r) =>
              typeof r.parentProp === "string" && r.parentProp in changedProps,
          )
        ) {
          const childUpdates = buildPropagationUpdates(
            propagationElement,
            changedProps,
            rules,
            propagationChildrenMap as Map<
              string,
              { id: string; type: string; props: Record<string, unknown> }[]
            >,
            propagationElementsMap as Map<
              string,
              { id: string; type: string; props: Record<string, unknown> }
            >,
          );

          if (childUpdates.length > 0) {
            const batchChildUpdates: BatchPropsUpdate[] = childUpdates.map(
              (u) => ({
                elementId: u.elementId,
                props: u.props as BatchPropsUpdate["props"],
              }),
            );
            state.updateSelectedPropertiesWithChildren(
              changedProps,
              batchChildUpdates,
            );
            return;
          }
        }

        state.updateSelectedProperties(changedProps);
      },
      [
        childrenByParent,
        elementsById,
        lookupRefElementList,
        selectedCanonicalElement,
        selectedElement.id,
      ],
    );

    // style write — Style view 전환(후속)까지는 미사용. updateSelectedStyle 단일 prop + distributeShorthand.
    const handleStyleUpdate = useCallback((key: string, value: unknown) => {
      const state = useStore.getState();
      state.updateSelectedStyle(key, value == null ? "" : String(value));
    }, []);

    if (semanticFields.length === 0) {
      return (
        <EmptyState
          message="편집 가능한 속성이 없습니다"
          description={`'${selectedElement.type}' 컴포넌트의 편집 계약이 비어 있습니다.`}
        />
      );
    }

    return (
      <GenericFieldRenderer
        fields={semanticFields}
        onSemanticUpdate={handleSemanticUpdate}
        onStyleUpdate={handleStyleUpdate}
        elementId={selectedElement.id}
      />
    );
  },
  (prevProps, nextProps) => {
    // 🚀 Phase 14: 참조 비교 우선, JSON.stringify 최소화
    const prev = prevProps.selectedElement;
    const next = nextProps.selectedElement;

    // 1단계: 기본 필드 빠른 비교 (primitive, early return)
    if (prev.id !== next.id) return false;
    if (prev.type !== next.type) return false;
    if (prev.customId !== next.customId) return false;

    // 2단계: 참조 비교 우선 (가장 빠름)
    // - 같은 참조면 확실히 동일 → JSON.stringify 스킵
    // - 다른 참조여도 내용이 같을 수 있음 → JSON.stringify로 확인
    const propertiesSame =
      prev.properties === next.properties ||
      JSON.stringify(prev.properties) === JSON.stringify(next.properties);
    if (!propertiesSame) return false;

    const styleSame =
      prev.style === next.style ||
      JSON.stringify(prev.style) === JSON.stringify(next.style);
    if (!styleSame) return false;

    const dataBindingSame =
      prev.dataBinding === next.dataBinding ||
      JSON.stringify(prev.dataBinding) === JSON.stringify(next.dataBinding);
    if (!dataBindingSame) return false;

    const eventsSame =
      prev.events === next.events ||
      JSON.stringify(prev.events) === JSON.stringify(next.events);
    if (!eventsSame) return false;

    // 모든 필드가 같으면 리렌더 불필요
    return true;
  },
);

/**
 * ⭐ Phase 4: useAsyncAction/useAsyncData 사용 가이드
 *
 * 비동기 작업이 필요한 경우 아래 훅들을 사용하세요:
 *
 * 1. useAsyncAction (React Query의 useMutation 스타일)
 *    - 서버에 데이터 저장/수정/삭제
 *    - 자동 재시도 (3회, Exponential backoff)
 *    - 4xx 에러는 재시도 스킵
 *
 *    예시:
 *    ```typescript
 *    import { useAsyncAction } from '../../hooks/useAsyncAction';
 *
 *    const { execute: saveElement, isLoading, error } = useAsyncAction({
 *      actionKey: 'save-element',
 *      action: async (element: Element) => {
 *        const { data, error } = await supabase
 *          .from('elements')
 *          .insert(element)
 *          .select()
 *          .single();
 *        if (error) throw error;
 *        return data;
 *      },
 *      onSuccess: (data) => {
 *        console.log('Element saved:', data);
 *        // TODO: Show toast notification
 *      },
 *      onError: (error) => {
 *        console.error('Failed to save:', error);
 *        // TODO: Show error toast
 *      },
 *      retry: 3,
 *    });
 *
 *    // 사용
 *    await saveElement(newElement);
 *    ```
 *
 * 2. useAsyncData (React Query의 useQuery 스타일)
 *    - 서버에서 데이터 fetch
 *    - 자동 캐싱 (staleTime)
 *    - 주기적 갱신 (refetchInterval)
 *
 *    예시:
 *    ```typescript
 *    import { useAsyncData } from '../../hooks/useAsyncData';
 *
 *    const { data: tokens, isLoading, error, refetch } = useAsyncData({
 *      queryKey: 'design-tokens',
 *      queryFn: async () => {
 *        const { data, error } = await supabase
 *          .from('design_tokens')
 *          .select('*')
 *          .eq('project_id', projectId);
 *        if (error) throw error;
 *        return data;
 *      },
 *      staleTime: 5 * 60 * 1000, // 5분 캐시
 *      refetchInterval: 30000,    // 30초마다 갱신
 *      onSuccess: (data) => console.log('Tokens loaded:', data.length),
 *    });
 *
 *    if (isLoading) return <LoadingSpinner />;
 *    if (error) return <ErrorMessage error={error} />;
 *    ```
 */

export function PropertiesPanel() {
  return <PropertiesPanelContent />;
}

/**
 * 🚀 Performance: MultiSelectContent - 다중 선택 UI 분리 컴포넌트
 *
 * multiSelectMode, selectedElementIds 구독을 이 컴포넌트에서만 수행
 * PropertiesPanelContent는 이 상태들을 구독하지 않아 불필요한 리렌더 방지
 */
const MultiSelectContent = memo(function MultiSelectContent({
  selectedElement,
  onSetSelectedElement,
  onSetSelectedElements,
}: {
  selectedElement: SelectedElement;
  onSetSelectedElement: (
    id: string | null,
    props?: Record<string, unknown>,
  ) => void;
  onSetSelectedElements: (ids: string[]) => void;
}) {
  // 🚀 이 컴포넌트에서만 multiSelectMode, selectedElementIds 구독
  const multiSelectMode = useStore((state) => state.multiSelectMode) || false;
  const rawSelectedElementIds = useStore((state) => state.selectedElementIds);
  const selectedElementIds = useMemo(
    () => rawSelectedElementIds || [],
    [rawSelectedElementIds],
  );
  const currentPageId = useStore((state) => state.currentPageId);
  const elementsById = useCanonicalPropertyElementsMap();

  const isMultiSelectActive = multiSelectMode && selectedElementIds.length > 1;

  // Get actions without subscribing
  const removeElement = useStore.getState().removeElement;
  const addElement = useStore.getState().addElement;
  const updateElement = useStore.getState().updateElement;
  const getElementsMap = useCallback(
    () => new Map(elementsById),
    [elementsById],
  );
  const getLegacyElementsMap = useCallback(
    () => panelNodeMapToElementMap(elementsById),
    [elementsById],
  );

  // Get current page elements
  const currentPageElements = useMemo(
    () =>
      currentPageId
        ? Array.from(elementsById.values()).filter(
            (element) => !element.deleted && element.page_id === currentPageId,
          )
        : [],
    [currentPageId, elementsById],
  );
  const legacyCurrentPageElements = useMemo(
    () => currentPageElements.map(panelNodeToElement),
    [currentPageElements],
  );

  // Get selected elements array for BatchPropertyEditor
  const selectedElements = useMemo(() => {
    if (
      !isMultiSelectActive ||
      !currentPageId ||
      selectedElementIds.length === 0
    )
      return [];
    const elementsMap = getElementsMap();
    const resolved: Element[] = [];
    for (const id of selectedElementIds) {
      const el = elementsMap.get(id);
      if (el && el.page_id === currentPageId) {
        resolved.push(panelNodeToElement(el));
      }
    }
    return resolved;
  }, [isMultiSelectActive, selectedElementIds, currentPageId, getElementsMap]);

  // useCopyPaste hook을 사용하여 클립보드 작업 수행
  const { copyText, pasteText } = useCopyPaste({
    onPaste: () => {}, // 별도 처리하므로 빈 함수
    name: "multi-elements",
  });

  // 다중 선택이 아니면 null 반환 (빠른 종료)
  if (!isMultiSelectActive) {
    return null;
  }

  // Multi-select handlers
  const handleCopyAll = async () => {
    if (selectedElementIds.length === 0) return;
    try {
      const elementsMap = getLegacyElementsMap();
      const copiedData = copyMultipleElements(selectedElementIds, elementsMap);
      const jsonData = serializeCopiedElements(copiedData);
      await copyText(jsonData);
      console.log(`✅ [Copy] Copied ${selectedElementIds.length} elements`);
    } catch (error) {
      console.error("❌ [Copy] Failed:", error);
    }
  };

  const handlePasteAll = async () => {
    if (!currentPageId) return;
    try {
      const clipboardText = await pasteText();
      if (!clipboardText) return;
      const copiedData = deserializeCopiedElements(clipboardText);
      if (!copiedData) return;
      const elementsMap = getLegacyElementsMap();
      const newElements = pasteMultipleElements(
        copiedData,
        currentPageId,
        {
          x: 10,
          y: 10,
        },
        Array.from(elementsMap.values()),
        {
          targetParentId: resolvePasteTargetParentId({
            currentPageId,
            selectedElementId: useStore.getState().selectedElementId,
            elements: elementsMap.values(),
          }),
        },
      );
      if (newElements.length === 0) return;
      await Promise.all(
        newElements.map((element) =>
          addElement(element, { skipHistory: true }),
        ),
      );
      trackMultiPaste(newElements);
      console.log(`✅ [Paste] Pasted ${newElements.length} elements`);
    } catch (error) {
      console.error("❌ [Paste] Failed:", error);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(`${selectedElementIds.length}개 요소를 모두 삭제하시겠습니까?`)
    )
      return;
    try {
      const elementsMap = getLegacyElementsMap();
      const elementsToDelete = selectedElementIds
        .map((id: string) => elementsMap.get(id))
        .filter((el): el is NonNullable<typeof el> => el !== undefined);
      if (elementsToDelete.length === 0) return;
      trackMultiDelete(elementsToDelete);
      await Promise.all(
        selectedElementIds.map((id: string) => removeElement(id)),
      );
      console.log(`✅ [DeleteAll] Deleted ${elementsToDelete.length} elements`);
    } catch (error) {
      console.error("❌ [DeleteAll] Failed:", error);
    }
  };

  const handleClearSelection = () => {
    onSetSelectedElement(null);
  };

  const handleBatchUpdate = async (updates: Record<string, unknown>) => {
    try {
      const elementsMap = getLegacyElementsMap();
      trackBatchUpdate(selectedElementIds, updates, elementsMap);
      const batchUpdateElementProps =
        useStore.getState().batchUpdateElementProps;
      await batchUpdateElementProps(
        selectedElementIds.map((id: string) => ({
          elementId: id,
          props:
            updates as unknown as import("../../../types/core/store.types").ComponentElementProps,
        })),
      );
      console.log(
        "Batch update applied to",
        selectedElementIds.length,
        "elements",
      );
    } catch (error) {
      console.error("Failed to batch update:", error);
    }
  };

  const handleFilteredElements = (filteredIds: string[]) => {
    if (filteredIds.length > 0) {
      onSetSelectedElements(filteredIds);
    } else {
      onSetSelectedElement(null);
    }
  };

  const handleGroupSelection = async () => {
    if (selectedElementIds.length < 2 || !currentPageId) return;
    try {
      const elementsMap = getLegacyElementsMap();
      const previousChildren = selectedElementIds
        .map((id: string) => elementsMap.get(id))
        .filter((el): el is NonNullable<typeof el> => el !== undefined);
      const { groupElement, updatedChildren } = createGroupFromSelection(
        selectedElementIds,
        elementsMap,
        currentPageId,
      );
      await addElement(groupElement, { skipHistory: true });
      await Promise.all(
        updatedChildren.map(async (child) => {
          await updateElement(child.id, {
            parent_id: child.parent_id,
          });
        }),
      );
      trackGroupCreation(groupElement, previousChildren, updatedChildren);
      onSetSelectedElement(groupElement.id, groupElement.props);
      console.log(
        `✅ [Group] Created group with ${updatedChildren.length} children`,
      );
    } catch (error) {
      console.error("❌ [Group] Failed:", error);
    }
  };

  const handleAlign = async (type: AlignmentType) => {
    if (selectedElementIds.length < 2) return;
    try {
      const elementsMap = getLegacyElementsMap();
      const updates = alignElements(selectedElementIds, elementsMap, type);
      if (updates.length === 0) return;
      const styleUpdates: Record<string, Record<string, unknown>> = {};
      updates.forEach((update) => {
        styleUpdates[update.id] = update.style;
      });
      trackBatchUpdate(selectedElementIds, styleUpdates, elementsMap);
      const batchUpdateElementProps =
        useStore.getState().batchUpdateElementProps;
      const batch = updates.flatMap((update) => {
        const element = elementsMap.get(update.id);
        if (!element) return [];
        const updatedStyle = {
          ...((element.props.style as Record<string, unknown>) || {}),
          ...update.style,
        };
        return [
          {
            elementId: update.id,
            props: {
              style: updatedStyle,
            } as import("../../../types/core/store.types").ComponentElementProps,
          },
        ];
      });
      await batchUpdateElementProps(batch);
      console.log(
        `✅ [Alignment] Aligned ${updates.length} elements to ${type}`,
      );
    } catch (error) {
      console.error("❌ [Alignment] Failed:", error);
    }
  };

  const handleDistribute = async (type: DistributionType) => {
    if (selectedElementIds.length < 3) return;
    try {
      const elementsMap = getLegacyElementsMap();
      const updates = distributeElements(selectedElementIds, elementsMap, type);
      if (updates.length === 0) return;
      const styleUpdates: Record<string, Record<string, unknown>> = {};
      updates.forEach((update) => {
        styleUpdates[update.id] = update.style;
      });
      trackBatchUpdate(selectedElementIds, styleUpdates, elementsMap);
      const batchUpdateElementProps =
        useStore.getState().batchUpdateElementProps;
      const batch = updates.flatMap((update) => {
        const element = elementsMap.get(update.id);
        if (!element) return [];
        const updatedStyle = {
          ...((element.props.style as Record<string, unknown>) || {}),
          ...update.style,
        };
        return [
          {
            elementId: update.id,
            props: {
              style: updatedStyle,
            } as import("../../../types/core/store.types").ComponentElementProps,
          },
        ];
      });
      await batchUpdateElementProps(batch);
      console.log(
        `✅ [Distribution] Distributed ${updates.length} elements ${type}ly`,
      );
    } catch (error) {
      console.error("❌ [Distribution] Failed:", error);
    }
  };

  // Get actual Element from store for SmartSelection
  const actualElement = legacyCurrentPageElements.find(
    (el) => el.id === selectedElement.id,
  );

  return (
    <>
      <MultiSelectStatusIndicator
        count={selectedElementIds.length}
        primaryElementId={selectedElementIds[0]}
        primaryElementType={selectedElement?.type}
        onCopyAll={handleCopyAll}
        onPasteAll={handlePasteAll}
        onDeleteAll={handleDeleteAll}
        onClearSelection={handleClearSelection}
        onGroupSelection={handleGroupSelection}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
      />
      <BatchPropertyEditor
        selectedElements={selectedElements}
        onBatchUpdate={handleBatchUpdate}
      />
      <SelectionFilter
        allElements={legacyCurrentPageElements}
        onFilteredElements={handleFilteredElements}
      />
      {actualElement && (
        <SmartSelection
          referenceElement={actualElement}
          allElements={legacyCurrentPageElements}
          onSelect={(elementIds) => {
            onSetSelectedElements(elementIds);
            if (currentPageId) {
              selectionMemory.addSelection(
                elementIds,
                legacyCurrentPageElements,
                currentPageId,
              );
            }
          }}
        />
      )}
      <SelectionMemory
        currentPageId={currentPageId}
        onRestore={(elementIds) => onSetSelectedElements(elementIds)}
      />
    </>
  );
});

/**
 * PropertiesPanelContent - 실제 콘텐츠 컴포넌트
 * 훅은 여기서만 실행됨 (isActive=true일 때만)
 *
 * 🚀 Performance: multiSelectMode, selectedElementIds 구독을 MultiSelectContent로 분리
 * 이 컴포넌트는 selectedElement만 구독하여 단일 선택 시 불필요한 리렌더 방지
 */
function PropertiesPanelContent() {
  // ⭐ CRITICAL: Only subscribe to selectedElement (like StylesPanel)
  // multiSelectMode, selectedElementIds 구독은 MultiSelectContent에서 수행
  // 🚀 Phase 3: 디바운스된 선택 데이터 사용 (100ms 지연)
  const selectedElement = useDebouncedSelectedElementData();
  const elementsById = useCanonicalPropertyElementsMap();
  const selectedCanonicalElement = useCanonicalPropertyElement(
    selectedElement?.id ?? "",
  );

  // 🚀 Performance: 액션만 가져오기 (구독 없음)
  // ADR-155 Phase 2: removeElement/updateElementProps/addElement 는 전역 단축키
  // 핸들러와 함께 CanvasSelectionShortcuts host 로 이동
  const setSelectedElement = useStore.getState().setSelectedElement;
  const updateElement = useStore.getState().updateElement;
  const setSelectedElements = useStore.getState().setSelectedElements;

  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const activeScope = useActiveScope();

  // 🔥 최적화: useCopyPaste hook 사용
  const { copy: copyProperties, paste: pasteProperties } = useCopyPaste({
    onPaste: (data) => {
      useStore.getState().updateSelectedProperties(data);
    },
    name: "properties",
  });

  const handleCopyProperties = useCallback(async () => {
    if (!selectedElement?.properties) return;
    await copyProperties(selectedElement.properties);
    // TODO: Show toast notification
  }, [selectedElement, copyProperties]);

  const handlePasteProperties = useCallback(async () => {
    await pasteProperties();
    // TODO: Show toast notification
  }, [pasteProperties]);

  // 🔥 최적화: 키보드 단축키를 useKeyboardShortcutsRegistry로 통합
  // ADR-155 Phase 2: 캔버스 전역 단축키 (Cmd+C/V/D/A, Escape, Cmd+G, 정렬/분배,
  // detach, Tab 네비게이션) 는 CanvasSelectionShortcuts host 로 이전 — 패널이
  // Activity gating 으로 숨겨져도 동작 유지. 여기에는 패널 UI 단축키만 잔류.
  const shortcuts = useMemo(
    () => [
      {
        key: "c",
        modifier: "cmdShift" as const,
        handler: handleCopyProperties,
        description: "Copy Properties",
        scope: "panel:properties" as const,
      },
      {
        key: "v",
        modifier: "cmdShift" as const,
        handler: handlePasteProperties,
        description: "Paste Properties",
        scope: "panel:properties" as const,
      },
      // ⭐ Sprint 3: Keyboard Shortcuts Help
      {
        key: "?",
        modifier: "cmd" as const,
        handler: () => setShowKeyboardHelp((prev) => !prev),
        description: "Toggle Keyboard Shortcuts Help",
      },
    ],
    [handleCopyProperties, handlePasteProperties],
  );

  useKeyboardShortcutsRegistry(
    shortcuts,
    [handleCopyProperties, handlePasteProperties],
    { activeScope },
  );

  // 선택된 요소가 없으면 빈 상태 표시
  if (!selectedElement) {
    return <EmptyState message="요소를 선택하세요" />;
  }

  return (
    <div className="panel">
      <PanelHeader
        icon={<Settings2 size={iconProps.size} />}
        title={selectedElement.type}
        actions={
          <>
            <ActionIconButton
              onPress={handleCopyProperties}
              aria-label="Copy properties"
              isDisabled={
                !selectedElement?.properties ||
                Object.keys(selectedElement.properties).length === 0
              }
              tooltip="속성 복사"
            >
              <Copy
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ActionIconButton>
            <ActionIconButton
              onPress={handlePasteProperties}
              aria-label="Paste properties"
              tooltip="속성 붙여넣기"
            >
              <ClipboardPaste
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ActionIconButton>
          </>
        }
      />

      <div className="panel-contents">
        {/* 🚀 Performance: MultiSelectContent - 다중 선택 UI 분리 */}
        <MultiSelectContent
          selectedElement={selectedElement}
          onSetSelectedElement={setSelectedElement}
          onSetSelectedElements={setSelectedElements}
        />

        <ComponentSemanticsSection elementId={selectedElement.id} />

        <FrameSlotSection elementId={selectedElement.id} />

        <ButtonChildSection elementId={selectedElement.id} />

        <ComponentSlotFillSection elementId={selectedElement.id} />

        <CatalogEditContractEditor selectedElement={selectedElement} />

        {/* ⭐ Layout/Slot System: Element가 들어갈 Slot 선택 */}
        <ElementSlotSelector
          elementId={selectedElement.id}
          currentSlotName={getSlotMirrorName(selectedElement.properties)}
          onSlotChange={(slotName) => {
            const element =
              elementsById.get(selectedElement.id) ?? selectedCanonicalElement;
            const props = withSlotMirrorName(
              (element?.props ?? selectedElement.properties) as Record<
                string,
                unknown
              >,
              slotName,
            );
            const patch: Partial<Element> = {
              props: props as Element["props"],
            };
            (patch as Record<string, unknown>)[SLOT_NAME_MIRROR_FIELD] =
              slotName;
            void updateElement(selectedElement.id, patch);
          }}
        />

        {/* ⭐ Sprint 3: Keyboard Shortcuts Help Panel */}
        <KeyboardShortcutsHelp
          isOpen={showKeyboardHelp}
          onClose={() => setShowKeyboardHelp(false)}
        />
      </div>
    </div>
  );
}
