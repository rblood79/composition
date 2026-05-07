/**
 * PropertiesPanel - 속성 편집 패널
 *
 * PanelProps 인터페이스를 구현하여 패널 시스템과 통합
 * 요소별 속성 에디터를 동적으로 로드하여 표시
 *
 * ⭐ 최적화: PropertyEditorWrapper로 Editor 렌더링 분리
 *
 * 🛡️ Gateway 패턴 적용 (2025-12-11)
 * - isActive 체크를 최상단에서 수행
 * - Content 컴포넌트 분리로 비활성 시 훅 실행 방지
 */

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import type { ComponentType } from "react";
import type { PanelProps } from "../core/types";
import {
  getEditor,
  type EditorContext,
} from "../../inspector/editors/registry";
import { useEditModeStore } from "../../stores/editMode";
import { useDebouncedSelectedElementData } from "../../stores";
import type {
  ComponentEditorProps,
  SelectedElement,
} from "../../inspector/types";
import {
  EmptyState,
  LoadingSpinner,
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
import { getFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
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
import {
  createGroupFromSelection,
  ungroupElement,
} from "../../stores/utils/elementGrouping";
import { alignElements } from "../../stores/utils/elementAlignment";
import type { AlignmentType } from "../../stores/utils/elementAlignment";
import { distributeElements } from "../../stores/utils/elementDistribution";
import type { DistributionType } from "../../stores/utils/elementDistribution";
import { canDetachInstance } from "../../utils/editingSemantics";
import {
  trackBatchUpdate,
  trackGroupCreation,
  trackUngroup,
  trackMultiPaste,
  trackMultiDelete,
} from "../../stores/utils/historyHelpers";
import { supabase } from "../../../env/supabase.client";
import type { Element } from "../../../types/core/store.types";
import { requestEditingSemanticsDetachConfirmation } from "../../utils/editingSemanticsImpactConfirmation";
import {
  isCanonicalRefElement,
  resolveCanonicalRefElement,
  resolveCanonicalRefTree,
} from "../../utils/canonicalRefResolution";
import {
  getActiveCanonicalElementSnapshot,
  getActiveCanonicalElementsSnapshot,
} from "../../stores/canonical/canonicalElementSnapshot";
import { isComponentInstanceMirrorElement } from "../../../adapters/canonical/componentSemanticsMirror";

/**
 * PropertyEditorWrapper - Editor 컴포넌트를 분리하여 불필요한 리렌더링 방지
 *
 * PropertiesPanel이 리렌더링되어도 실제 props가 변경되지 않으면 Editor는 리렌더링되지 않음
 */
const PropertyEditorWrapper = memo(
  function PropertyEditorWrapper({
    selectedElement,
  }: {
    selectedElement: SelectedElement;
  }) {
    const [Editor, setEditor] =
      useState<ComponentType<ComponentEditorProps> | null>(null);
    const [loading, setLoading] = useState(true);

    // ⭐ Phase 6 Fix: body 타입의 경우 현재 편집 모드(editMode)에 따라 다른 Editor 로드
    // - Page 모드: PageBodyEditor
    // - Layout 모드: LayoutBodyEditor
    const editMode = useEditModeStore((state) => state.mode);
    const elementContext = useMemo((): EditorContext => {
      const element =
        useStore.getState().elementsMap.get(selectedElement.id) ??
        getActiveCanonicalElementSnapshot(selectedElement.id);
      return {
        layoutId: element ? getFrameElementMirrorId(element) : null,
        pageId: element?.page_id || null,
        editMode, // ⭐ 현재 편집 모드 전달
      };
    }, [selectedElement.id, editMode]);

    // 요소 타입에 맞는 에디터 동적 로드
    useEffect(() => {
      let isMounted = true;

      if (!selectedElement) {
        Promise.resolve().then(() => {
          if (isMounted) {
            setEditor(null);
            setLoading(false);
          }
        });
        return;
      }

      Promise.resolve().then(() => {
        if (!isMounted) return;

        setLoading(true);

        // ⭐ Phase 6: context 전달 (body 타입의 경우 layoutId로 Editor 결정)
        getEditor(selectedElement.type, elementContext)
          .then((editor) => {
            if (isMounted) {
              setEditor(() => editor);
              setLoading(false);
            }
          })
          .catch((error) => {
            if (isMounted) {
              if (import.meta.env.DEV) {
                console.error(
                  "[PropertyEditorWrapper] Failed to load editor:",
                  selectedElement.type,
                  error,
                );
              }
              setEditor(null);
              setLoading(false);
            }
          });
      });

      return () => {
        isMounted = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedElement.type, elementContext.editMode]);

    // handleUpdate는 항상 안정적인 함수 (getState 사용)
    // ⚠️ 에디터들이 { ...currentProps, [key]: value } 패턴으로 전체 props를 보내는데,
    // useDeferredValue로 인해 currentProps가 stale할 수 있음.
    // 최신 element.props와 비교하여 실제 변경된 prop만 전달하여 stale 값 덮어쓰기 방지.
    const handleUpdate = useCallback(
      (updatedProps: Record<string, unknown>) => {
        const state = useStore.getState();
        let element = state.elementsMap.get(state.selectedElementId ?? "");
        let lookupElements: Iterable<Element> = state.elementsMap.values();
        if (!element && state.selectedElementId) {
          const canonicalElements = getActiveCanonicalElementsSnapshot();
          element =
            canonicalElements?.find(
              (candidate) => candidate.id === state.selectedElementId,
            ) ?? undefined;
          lookupElements = canonicalElements ?? lookupElements;
        }
        if (!element) return;

        const lookupElementList = Array.from(lookupElements);
        const effectiveElement = isCanonicalRefElement(element)
          ? resolveCanonicalRefElement(element, lookupElementList)
          : element;
        const baselineProps = (effectiveElement.props ?? {}) as Record<
          string,
          unknown
        >;
        const changedProps: Record<string, unknown> = {};
        let changedCount = 0;
        for (const [key, value] of Object.entries(updatedProps)) {
          if (key === "style" || key === "computedStyle" || key === "events")
            continue;
          if (baselineProps[key] !== value) {
            changedProps[key] = value;
            changedCount++;
          }
        }

        if (changedCount === 0) return;

        const isComponentInstanceSelection =
          isCanonicalRefElement(element) ||
          isComponentInstanceMirrorElement(element);
        const propagationSource = isComponentInstanceSelection
          ? (() => {
              const lookupElementsMap = new Map(
                lookupElementList.map((candidate) => [candidate.id, candidate]),
              );
              return resolveCanonicalRefTree({
                elements: lookupElementList,
                elementsMap: lookupElementsMap,
              });
            })()
          : null;
        const propagationElement =
          propagationSource?.elementsMap.get(element.id) ?? effectiveElement;
        const propagationChildrenMap =
          propagationSource?.childrenMap ?? state.childrenMap;
        const propagationElementsMap =
          propagationSource?.elementsMap ?? state.elementsMap;

        // ADR-048: propagation 규칙 중 변경된 prop과 매칭되는 것이 있으면 자식도 업데이트
        const rules = getPropagationRules(propagationElement.type);
        if (rules && rules.some((r) => r.parentProp in changedProps)) {
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
      [],
    );

    if (loading) {
      return (
        <LoadingSpinner
          message="에디터를 불러오는 중..."
          description={`${selectedElement.type} 속성 에디터 로드`}
        />
      );
    }

    if (!Editor) {
      return (
        <EmptyState
          message="사용 가능한 속성 에디터가 없습니다"
          description={`'${selectedElement.type}' 컴포넌트의 에디터를 찾을 수 없습니다.`}
        />
      );
    }

    return (
      <Editor
        elementId={selectedElement.id}
        currentProps={selectedElement.properties}
        onUpdate={handleUpdate}
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

/**
 * PropertiesPanel - Gateway 컴포넌트
 * 🛡️ isActive 체크 후 Content 렌더링
 */
export function PropertiesPanel({ isActive }: PanelProps) {
  // 🛡️ Gateway: 비활성 시 즉시 반환 (훅 실행 방지)
  if (!isActive) {
    return null;
  }

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

  const isMultiSelectActive = multiSelectMode && selectedElementIds.length > 1;

  // Get actions without subscribing
  const removeElement = useStore.getState().removeElement;
  const addElement = useStore.getState().addElement;
  const updateElement = useStore.getState().updateElement;
  const getElementsMap = () => useStore.getState().elementsMap;
  const getPageElements = useStore.getState().getPageElements;

  // Get current page elements
  const currentPageElements = currentPageId
    ? getPageElements(currentPageId)
    : [];

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
        resolved.push(el);
      }
    }
    return resolved;
  }, [isMultiSelectActive, selectedElementIds, currentPageId]);

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
      const elementsMap = getElementsMap();
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
      const elementsMap = getElementsMap();
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
      await Promise.all(newElements.map((element) => addElement(element)));
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
      const elementsMap = getElementsMap();
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
      const elementsMap = getElementsMap();
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
      const elementsMap = getElementsMap();
      const { groupElement, updatedChildren } = createGroupFromSelection(
        selectedElementIds,
        elementsMap,
        currentPageId,
      );
      await addElement(groupElement);
      await Promise.all(
        updatedChildren.map(async (child) => {
          await updateElement(child.id, {
            parent_id: child.parent_id,
          });
          await supabase
            .from("elements")
            .update({
              parent_id: child.parent_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", child.id);
        }),
      );
      trackGroupCreation(groupElement, updatedChildren);
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
      const elementsMap = getElementsMap();
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
      const elementsMap = getElementsMap();
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
  const actualElement = currentPageElements.find(
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
        allElements={currentPageElements}
        onFilteredElements={handleFilteredElements}
      />
      {actualElement && (
        <SmartSelection
          referenceElement={actualElement}
          allElements={currentPageElements}
          onSelect={(elementIds) => {
            onSetSelectedElements(elementIds);
            if (currentPageId) {
              selectionMemory.addSelection(
                elementIds,
                currentPageElements,
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

  // 🚀 Performance: 액션만 가져오기 (구독 없음)
  const removeElement = useStore.getState().removeElement;
  const setSelectedElement = useStore.getState().setSelectedElement;
  const updateElementProps = useStore.getState().updateElementProps;
  const addElement = useStore.getState().addElement;
  const updateElement = useStore.getState().updateElement;
  const setSelectedElements = useStore.getState().setSelectedElements;

  // 🚀 Performance: getState() 패턴 - 구독 없이 최신 상태 조회
  const getElementsMap = useCallback(() => useStore.getState().elementsMap, []);
  const getCurrentPageId = useCallback(
    () => useStore.getState().currentPageId,
    [],
  );
  const getSelectedElementIds = useCallback(
    () => useStore.getState().selectedElementIds || [],
    [],
  );
  const getSelectedElementId = useCallback(
    () => useStore.getState().selectedElementId,
    [],
  );
  const getMultiSelectMode = useCallback(
    () => useStore.getState().multiSelectMode || false,
    [],
  );

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

  // ⭐ Multi-select quick actions
  const handleCopyAll = useCallback(async () => {
    const selectedElementIds = getSelectedElementIds();
    console.log("[Copy] Starting copy operation...", { selectedElementIds });

    if (selectedElementIds.length === 0) {
      console.warn("[Copy] No elements selected");
      return;
    }

    try {
      // Copy elements with relationship preservation
      console.log("[Copy] Calling copyMultipleElements...");
      const elementsMap = getElementsMap();
      const copiedData = copyMultipleElements(selectedElementIds, elementsMap);
      console.log("[Copy] Copied data:", {
        elementCount: copiedData.elements.length,
        rootIds: copiedData.rootIds,
        externalParents: copiedData.externalParents.size,
      });

      // Serialize and copy to clipboard
      console.log("[Copy] Serializing to JSON...");
      const jsonData = serializeCopiedElements(copiedData);
      console.log("[Copy] JSON length:", jsonData.length, "bytes");

      console.log("[Copy] Writing to clipboard...");
      // Note: useCopyPaste hook doesn't support complex element copying with relationships
      // eslint-disable-next-line local/prefer-copy-paste-hook
      await navigator.clipboard.writeText(jsonData);

      console.log(
        `✅ [Copy] Successfully copied ${selectedElementIds.length} elements to clipboard`,
      );
      // TODO: Show toast notification
    } catch (error) {
      console.error("❌ [Copy] Failed to copy elements:", error);
      // TODO: Show error toast
    }
  }, [getSelectedElementIds, getElementsMap]);

  const handlePasteAll = useCallback(async () => {
    const currentPageId = getCurrentPageId();
    console.log("[Paste] Starting paste operation...", { currentPageId });

    if (!currentPageId) {
      console.warn("[Paste] No current page selected");
      return;
    }

    try {
      // Read from clipboard
      console.log("[Paste] Reading from clipboard...");
      // Note: useCopyPaste hook doesn't support complex element pasting with relationships
      // eslint-disable-next-line local/prefer-copy-paste-hook
      const clipboardText = await navigator.clipboard.readText();
      console.log(
        "[Paste] Clipboard text length:",
        clipboardText.length,
        "bytes",
      );
      console.log("[Paste] First 100 chars:", clipboardText.substring(0, 100));

      // Deserialize
      console.log("[Paste] Deserializing clipboard data...");
      const copiedData = deserializeCopiedElements(clipboardText);
      if (!copiedData) {
        console.warn(
          "[Paste] Clipboard does not contain valid composition element data",
        );
        return;
      }

      console.log("[Paste] Deserialized data:", {
        elementCount: copiedData.elements.length,
        rootIds: copiedData.rootIds,
        externalParents: copiedData.externalParents.size,
      });

      // Paste with offset
      console.log("[Paste] Creating new elements with offset...");
      const elementsMap = getElementsMap();
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
            selectedElementId: getSelectedElementId(),
            elements: elementsMap.values(),
          }),
        },
      );
      console.log("[Paste] New elements created:", newElements.length);

      if (newElements.length === 0) {
        console.warn("[Paste] No elements to paste");
        return;
      }

      // Add all new elements to store
      console.log("[Paste] Adding elements to store...");
      await Promise.all(
        newElements.map((element) => {
          console.log("[Paste] Adding element:", element.id, element.type);
          return addElement(element);
        }),
      );

      // ⭐ Phase 7: Track in history AFTER adding elements
      trackMultiPaste(newElements);

      console.log(
        `✅ [Paste] Successfully pasted ${newElements.length} elements`,
      );
      // TODO: Show toast notification
    } catch (error) {
      console.error("❌ [Paste] Failed to paste elements:", error);
      // TODO: Show error toast
    }
  }, [getCurrentPageId, getSelectedElementId, addElement]);

  // ⭐ Phase 6: Duplicate handler (Cmd+D)
  const handleDuplicate = useCallback(async () => {
    const multiSelectMode = getMultiSelectMode();
    const selectedElementIds = getSelectedElementIds();
    const currentPageId = getCurrentPageId();

    if (!multiSelectMode || selectedElementIds.length === 0 || !currentPageId) {
      console.warn("[Duplicate] No elements selected or no page active");
      return;
    }

    try {
      console.log(
        `[Duplicate] Duplicating ${selectedElementIds.length} elements`,
      );

      // Copy current selection
      const elementsMap = getElementsMap();
      const copiedData = copyMultipleElements(selectedElementIds, elementsMap);

      // Paste with 10px offset (standard offset for duplicate)
      const newElements = pasteMultipleElements(
        copiedData,
        currentPageId,
        {
          x: 10,
          y: 10,
        },
        Array.from(elementsMap.values()),
      );

      if (newElements.length === 0) {
        console.warn("[Duplicate] No elements to duplicate");
        return;
      }

      // Add all new elements to store
      await Promise.all(newElements.map((element) => addElement(element)));

      // ⭐ Track in history AFTER adding elements
      trackMultiPaste(newElements);

      // ⭐ Auto-select duplicated elements
      const newElementIds = newElements.map((el) => el.id);
      setSelectedElements(newElementIds);
      console.log(
        `✅ [Duplicate] Duplicated and selected ${newElements.length} elements`,
      );

      // TODO: Show toast notification
    } catch (error) {
      console.error("❌ [Duplicate] Failed to duplicate elements:", error);
      // TODO: Show error toast
    }
  }, [
    getMultiSelectMode,
    getSelectedElementIds,
    getCurrentPageId,
    getElementsMap,
    addElement,
    setSelectedElements,
  ]);

  // ⭐ Phase 3: Advanced Selection - Select All (Cmd+A)
  const handleSelectAll = useCallback(() => {
    const currentPageId = getCurrentPageId();

    if (!currentPageId) {
      console.warn("[SelectAll] No page selected");
      return;
    }

    // 🆕 O(1) 인덱스 기반 조회
    const getPageElements = useStore.getState().getPageElements;
    const pageElements = getPageElements(currentPageId);

    if (pageElements.length === 0) {
      console.warn("[SelectAll] No elements on current page");
      return;
    }

    // Get all element IDs from current page
    const allElementIds = pageElements.map((el) => el.id);

    // Use store's setSelectedElements
    setSelectedElements(allElementIds);
    console.log(`✅ [SelectAll] Selected ${allElementIds.length} elements`);
  }, [getCurrentPageId, setSelectedElements]);

  // ⭐ Phase 3: Advanced Selection - Clear Selection (Esc)
  const handleEscapeClearSelection = useCallback(() => {
    setSelectedElement(null);
    console.log("✅ [Esc] Selection cleared");
  }, [setSelectedElement]);

  const handleDetachSelectedInstance = useCallback(async () => {
    const state = useStore.getState();
    const selectedId = state.selectedElementId ?? selectedElement?.id;
    const element = selectedId ? state.elementsMap.get(selectedId) : null;
    if (!selectedId || !canDetachInstance(element)) return;

    const confirmed = await requestEditingSemanticsDetachConfirmation({
      instanceId: selectedId,
      instanceLabel:
        element?.componentName ??
        element?.customId ??
        element?.type ??
        selectedId,
    });
    if (!confirmed) return;

    state.detachInstance(selectedId);
  }, [selectedElement?.id]);

  // ⭐ Phase 3: Advanced Selection - Tab Navigation
  const handleTabNavigation = useCallback(
    (event: KeyboardEvent) => {
      const multiSelectMode = getMultiSelectMode();
      const selectedElementIds = getSelectedElementIds();

      if (!multiSelectMode || selectedElementIds.length === 0) return;

      event.preventDefault();

      const currentIndex = selectedElementIds.indexOf(
        selectedElement?.id || "",
      );
      let nextIndex: number;

      if (event.shiftKey) {
        // Shift+Tab: Navigate backwards
        nextIndex =
          currentIndex <= 0 ? selectedElementIds.length - 1 : currentIndex - 1;
      } else {
        // Tab: Navigate forwards
        nextIndex =
          currentIndex >= selectedElementIds.length - 1 ? 0 : currentIndex + 1;
      }

      const nextElementId = selectedElementIds[nextIndex];
      const elementsMap = getElementsMap();
      const nextElement = elementsMap.get(nextElementId);

      if (nextElement) {
        setSelectedElement(nextElementId, nextElement.props);
        console.log(
          `✅ [Tab] Navigated to element ${nextIndex + 1}/${selectedElementIds.length}:`,
          nextElement.type,
        );
      }
    },
    [
      getMultiSelectMode,
      getSelectedElementIds,
      selectedElement,
      getElementsMap,
      setSelectedElement,
    ],
  );

  // ⭐ Phase 4: Group Selection (Cmd+G)
  const handleGroupSelection = useCallback(async () => {
    const multiSelectMode = getMultiSelectMode();
    const selectedElementIds = getSelectedElementIds();
    const pageId = getCurrentPageId();

    if (!multiSelectMode || selectedElementIds.length < 2 || !pageId) {
      console.warn("[Group] Need at least 2 elements selected");
      return;
    }

    try {
      console.log("[Group] Grouping", selectedElementIds.length, "elements");

      const elementsMap = getElementsMap();

      // Create group from selection
      const { groupElement, updatedChildren } = createGroupFromSelection(
        selectedElementIds,
        elementsMap,
        pageId,
      );

      // Add group to store (this saves to DB)
      await addElement(groupElement);

      // Update children with new parent_id - Save to DB directly
      await Promise.all(
        updatedChildren.map(async (child) => {
          // Update memory state
          await updateElement(child.id, {
            parent_id: child.parent_id,
          });

          // Save to DB directly (Supabase)
          const { error } = await supabase
            .from("elements")
            .update({
              parent_id: child.parent_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", child.id);

          if (error) {
            console.error(
              `❌ [Group] Failed to save child ${child.id} to DB:`,
              error,
            );
          } else {
            console.log(
              `✅ [Group] Saved child ${child.id} to DB: parent_id=${child.parent_id}`,
            );
          }
        }),
      );

      // ⭐ Phase 7: Track in history AFTER group creation
      trackGroupCreation(groupElement, updatedChildren);

      // Select the new group
      setSelectedElement(groupElement.id, groupElement.props);

      console.log(
        `✅ [Group] Created group ${groupElement.id} with ${updatedChildren.length} children`,
      );
    } catch (error) {
      console.error("❌ [Group] Failed to create group:", error);
    }
  }, [
    getMultiSelectMode,
    getSelectedElementIds,
    getCurrentPageId,
    getElementsMap,
    addElement,
    updateElement,
    setSelectedElement,
  ]);

  // ⭐ Phase 4: Ungroup Selection (Cmd+Shift+G)
  const handleUngroupSelection = useCallback(async () => {
    if (!selectedElement || selectedElement.type !== "Group") {
      console.warn("[Ungroup] Selected element is not a Group");
      return;
    }

    try {
      console.log("[Ungroup] Ungrouping element", selectedElement.id);

      const elementsMap = getElementsMap();

      // Store group element before deletion for history
      const groupElementForHistory = elementsMap.get(selectedElement.id);

      // Ungroup element
      const { updatedChildren, groupIdToDelete } = ungroupElement(
        selectedElement.id,
        elementsMap,
      );

      // ⭐ Phase 7: Track in history BEFORE making changes
      if (groupElementForHistory) {
        trackUngroup(groupIdToDelete, updatedChildren, groupElementForHistory);
      }

      // Update children with new parent_id - Save to DB directly
      await Promise.all(
        updatedChildren.map(async (child) => {
          // Update memory state
          await updateElement(child.id, {
            parent_id: child.parent_id,
          });

          // Save to DB directly (Supabase)
          const { error } = await supabase
            .from("elements")
            .update({
              parent_id: child.parent_id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", child.id);

          if (error) {
            console.error(
              `❌ [Ungroup] Failed to save child ${child.id} to DB:`,
              error,
            );
          } else {
            console.log(
              `✅ [Ungroup] Saved child ${child.id} to DB: parent_id=${child.parent_id}`,
            );
          }
        }),
      );

      // Delete group element
      await removeElement(groupIdToDelete);

      // Select first child
      if (updatedChildren.length > 0) {
        setSelectedElement(updatedChildren[0].id, updatedChildren[0].props);
      } else {
        setSelectedElement(null);
      }

      console.log(`✅ [Ungroup] Ungrouped ${updatedChildren.length} elements`);
    } catch (error) {
      console.error("❌ [Ungroup] Failed to ungroup:", error);
    }
  }, [
    selectedElement,
    getElementsMap,
    updateElement,
    removeElement,
    setSelectedElement,
  ]);

  // ⭐ Phase 5.1: Element Alignment
  const handleAlign = useCallback(
    async (type: AlignmentType) => {
      const multiSelectMode = getMultiSelectMode();
      const selectedElementIds = getSelectedElementIds();

      if (!multiSelectMode || selectedElementIds.length < 2) {
        console.warn("[Alignment] Need at least 2 elements selected");
        return;
      }

      try {
        console.log(
          `[Alignment] Aligning ${selectedElementIds.length} elements to ${type}`,
        );

        const elementsMap = getElementsMap();

        // Calculate alignment updates
        const updates = alignElements(selectedElementIds, elementsMap, type);

        if (updates.length === 0) {
          console.warn("[Alignment] No updates generated");
          return;
        }

        // Collect style updates for history tracking
        const styleUpdates: Record<string, Record<string, unknown>> = {};
        updates.forEach((update) => {
          styleUpdates[update.id] = update.style;
        });

        // ⭐ Track in history BEFORE applying updates
        trackBatchUpdate(selectedElementIds, styleUpdates, elementsMap);

        // Apply updates to each element
        await Promise.all(
          updates.map((update) => {
            const element = elementsMap.get(update.id);
            if (element) {
              const updatedStyle = {
                ...((element.props.style as Record<string, unknown>) || {}),
                ...update.style,
              };
              return updateElementProps(update.id, { style: updatedStyle });
            }
            return Promise.resolve();
          }),
        );

        console.log(
          `✅ [Alignment] Aligned ${updates.length} elements to ${type}`,
        );
      } catch (error) {
        console.error("❌ [Alignment] Failed to align:", error);
      }
    },
    [
      getMultiSelectMode,
      getSelectedElementIds,
      getElementsMap,
      updateElementProps,
    ],
  );

  // ⭐ Phase 5.2: Element Distribution
  const handleDistribute = useCallback(
    async (type: DistributionType) => {
      const multiSelectMode = getMultiSelectMode();
      const selectedElementIds = getSelectedElementIds();

      if (!multiSelectMode || selectedElementIds.length < 3) {
        console.warn("[Distribution] Need at least 3 elements selected");
        return;
      }

      try {
        console.log(
          `[Distribution] Distributing ${selectedElementIds.length} elements ${type}ly`,
        );

        const elementsMap = getElementsMap();

        // Calculate distribution updates
        const updates = distributeElements(
          selectedElementIds,
          elementsMap,
          type,
        );

        if (updates.length === 0) {
          console.warn("[Distribution] No updates generated");
          return;
        }

        // Collect style updates for history tracking
        const styleUpdates: Record<string, Record<string, unknown>> = {};
        updates.forEach((update) => {
          styleUpdates[update.id] = update.style;
        });

        // ⭐ Track in history BEFORE applying updates
        trackBatchUpdate(selectedElementIds, styleUpdates, elementsMap);

        // Apply updates to each element
        await Promise.all(
          updates.map((update) => {
            const element = elementsMap.get(update.id);
            if (element) {
              const updatedStyle = {
                ...((element.props.style as Record<string, unknown>) || {}),
                ...update.style,
              };
              return updateElementProps(update.id, { style: updatedStyle });
            }
            return Promise.resolve();
          }),
        );

        console.log(
          `✅ [Distribution] Distributed ${updates.length} elements ${type}ly`,
        );
      } catch (error) {
        console.error("❌ [Distribution] Failed to distribute:", error);
      }
    },
    [
      getMultiSelectMode,
      getSelectedElementIds,
      getElementsMap,
      updateElementProps,
    ],
  );

  // 🔥 최적화: 키보드 단축키를 useKeyboardShortcutsRegistry로 통합
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
      // ⭐ Multi-element shortcuts
      {
        key: "c",
        modifier: "cmd" as const,
        handler: handleCopyAll,
        description: "Copy All Elements",
        scope: "panel:properties" as const,
      },
      {
        key: "v",
        modifier: "cmd" as const,
        handler: handlePasteAll,
        description: "Paste Elements",
        scope: "panel:properties" as const,
      },
      {
        key: "d",
        modifier: "cmd" as const,
        handler: handleDuplicate,
        description: "Duplicate Selection",
      },
      // ⭐ Phase 3: Advanced Selection shortcuts
      {
        key: "a",
        modifier: "cmd" as const,
        handler: handleSelectAll,
        description: "Select All",
      },
      {
        key: "Escape",
        modifier: "none" as const,
        handler: handleEscapeClearSelection,
        description: "Clear Selection",
      },
      {
        key: "x",
        modifier: "cmdAlt" as const,
        handler: handleDetachSelectedInstance,
        description: "Detach Instance",
      },
      // ⭐ Phase 4: Grouping shortcuts
      {
        key: "g",
        modifier: "cmd" as const,
        handler: handleGroupSelection,
        description: "Group Selection",
      },
      {
        key: "g",
        modifier: "cmdShift" as const,
        handler: handleUngroupSelection,
        description: "Ungroup Selection",
      },
      // ⭐ Phase 5.1: Alignment shortcuts
      {
        key: "l",
        modifier: "cmdShift" as const,
        handler: () => handleAlign("left"),
        description: "Align Left",
      },
      {
        key: "h",
        modifier: "cmdShift" as const,
        handler: () => handleAlign("center"),
        description: "Align Horizontal Center",
      },
      {
        key: "r",
        modifier: "cmdShift" as const,
        handler: () => handleAlign("right"),
        description: "Align Right",
      },
      {
        key: "t",
        modifier: "cmdShift" as const,
        handler: () => handleAlign("top"),
        description: "Align Top",
      },
      {
        key: "m",
        modifier: "cmdShift" as const,
        handler: () => handleAlign("middle"),
        description: "Align Vertical Middle",
      },
      {
        key: "b",
        modifier: "cmdShift" as const,
        handler: () => handleAlign("bottom"),
        description: "Align Bottom",
      },
      // ⭐ Phase 5.2: Distribution shortcuts
      {
        key: "d",
        modifier: "cmdShift" as const,
        handler: () => handleDistribute("horizontal"),
        description: "Distribute Horizontally",
      },
      {
        key: "v",
        modifier: "altShift" as const,
        handler: () => handleDistribute("vertical"),
        description: "Distribute Vertically",
      },
      // ⭐ Sprint 3: Keyboard Shortcuts Help
      {
        key: "?",
        modifier: "cmd" as const,
        handler: () => setShowKeyboardHelp((prev) => !prev),
        description: "Toggle Keyboard Shortcuts Help",
      },
    ],
    [
      handleCopyProperties,
      handlePasteProperties,
      handleCopyAll,
      handlePasteAll,
      handleDuplicate,
      handleSelectAll,
      handleEscapeClearSelection,
      handleDetachSelectedInstance,
      handleGroupSelection,
      handleUngroupSelection,
      handleAlign,
      handleDistribute,
    ],
  );

  useKeyboardShortcutsRegistry(
    shortcuts,
    [
      handleCopyProperties,
      handlePasteProperties,
      handleCopyAll,
      handlePasteAll,
      handleDuplicate,
      handleSelectAll,
      handleEscapeClearSelection,
      handleDetachSelectedInstance,
      handleGroupSelection,
      handleUngroupSelection,
      handleAlign,
      handleDistribute,
    ],
    { activeScope },
  );

  // ⭐ Phase 3: Tab navigation (requires special handling)
  // Note: Tab navigation requires special handling (Shift+Tab, preventDefault) that useKeyboardShortcutsRegistry doesn't support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const multiSelectMode = useStore.getState().multiSelectMode || false;
      const selectedElementIds = useStore.getState().selectedElementIds || [];

      if (
        event.key === "Tab" &&
        multiSelectMode &&
        selectedElementIds.length > 0
      ) {
        handleTabNavigation(event);
      }
    };

    // eslint-disable-next-line local/prefer-keyboard-shortcuts-registry
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTabNavigation]); // multiSelectMode, selectedElementIds 제거 (함수 내부에서 가져옴)

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

        <ComponentSlotFillSection elementId={selectedElement.id} />

        {/* ⭐ 최적화: PropertyEditorWrapper로 Editor 렌더링 분리 */}
        <PropertyEditorWrapper selectedElement={selectedElement} />

        {/* ⭐ Layout/Slot System: Element가 들어갈 Slot 선택 */}
        <ElementSlotSelector
          elementId={selectedElement.id}
          currentSlotName={getSlotMirrorName(selectedElement.properties)}
          onSlotChange={(slotName) => {
            const state = useStore.getState();
            const element = state.elementsMap.get(selectedElement.id);
            const props = withSlotMirrorName(
              (element?.props ?? selectedElement.properties) as Record<
                string,
                unknown
              >,
              slotName,
            );
            void state.updateElement(selectedElement.id, {
              props: props as Element["props"],
              [SLOT_NAME_MIRROR_FIELD]: slotName,
            });
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
