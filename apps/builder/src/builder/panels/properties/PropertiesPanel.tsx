/**
 * PropertiesPanel - 속성 편집 패널
 *
 * PanelProps 인터페이스를 구현하여 패널 시스템과 통합
 * 요소별 속성 에디터를 동적으로 로드하여 표시
 *
 * ⭐ 최적화: PropertyEditorWrapper로 Editor 렌더링 분리
 *
 * 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
 */

import { useCallback, useMemo, memo, type ReactNode } from "react";
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
  SmartSelection,
  SelectionMemory,
  PanelContents,
} from "../../components";
import { ElementSlotSelector } from "./editors/ElementSlotSelector";
import { ComponentSemanticsSection } from "./ComponentSemanticsSection";
import { ComponentSlotFillSection } from "./ComponentSlotFillSection";
import { FrameSlotSection } from "./FrameSlotSection";
import { ButtonChildFields } from "./ButtonChildSection";
import { BUTTON_CHILD_HOST_TAGS } from "./buttonChildSectionUtils";
import { ElementAttributesSection } from "./ElementAttributesSection";
import { PageBodySection } from "./PageBodySection";
import { DEDICATED_SECTION_TYPES } from "./pageBodySectionConstants";
import { ActionIconButton } from "../../components/ui";
import { Settings2 } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 복사/붙여넣기 정본. */
const { copy: CopyIcon, paste: PasteIcon } = ACTION_ICONS;
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  useKeyboardShortcutsRegistry,
  bindHandlersToDefinitions,
  useCopyPaste,
  useActiveScope,
} from "@/builder/hooks";
import { useI18n } from "../../../i18n";
import { useStore } from "../../stores";
import {
  SLOT_NAME_MIRROR_FIELD,
  withSlotMirrorName,
} from "../../../adapters/canonical/slotMirror";
import { dispatchSemanticUpdateWithPropagation } from "./semanticUpdateDispatch";
import {
  isDelegatedSubpart,
  useSelectedSubpartOwnerType,
} from "../delegatedSubpart";
import {
  alignSelection,
  copySelection,
  distributeSelection,
  groupSelection,
  paste,
} from "../../workspace/canvas/actions/canvasActions";
import { selectionMemory } from "../../utils/selectionMemory";
import {
  panelNodeToElement,
  panelNodeMapToElementMap,
} from "./panelNodeElementMap";
import type { AlignmentType } from "../../stores/utils/elementAlignment";
import type { DistributionType } from "../../stores/utils/elementDistribution";
import {
  isCanonicalRefElement,
  type CanonicalRefResolvableNode,
  resolveCanonicalRefElement,
  resolveCanonicalRefTree,
} from "../../utils/canonicalRefResolution";
import {
  useCanonicalPropertyChildren,
  useCanonicalPropertyElementType,
  useCanonicalPropertyElementsMap,
  useCanonicalPropertyValue,
} from "./hooks/useCanonicalPropertyRead";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { getCanonicalPropertyReadIndex } from "./hooks/canonicalPropertyReadIndex";
import { isComponentInstanceMirrorElement } from "../../../adapters/canonical/componentSemanticsMirror";
import type { PanelNode } from "../panelNode";
import type { Element } from "../../../types/core/store.types";

type SelectedElementIdentity = Pick<SelectedElement, "id" | "type">;

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
const CatalogEditContractEditor = memo(function CatalogEditContractEditor({
  elementId,
  elementType,
  contentExtras,
}: {
  elementId: string;
  elementType: string;
  /** catalog "Content" 그룹에 주입할 비-catalog 컨트롤 (Button 자식 Icon/Text 편집). */
  contentExtras?: ReactNode;
}) {
  const { t } = useI18n();
  const selectedChildren = useCanonicalPropertyChildren(elementId);

  // 편집 계약 단일 진입점 — semantic ∪ style 필드를 origin 태그와 함께 산출.
  const contract = useEditContract(elementId);
  // Properties view = semantic origin (node.props / D2). style origin 은 Style view(후속).
  const semanticFields = useMemo(() => {
    const fields = contract.fields.filter((f) => f.origin === "semantic");
    // icon Button/ToggleButton: label 이 RSP 공식대로 `<Text>` 자식 element 로 이관되어
    //   Button.children 이 비므로, GenericFieldRenderer 의 "Text"(children) 필드를 제외한다.
    //   대신 ButtonChildSection 의 Text 입력이 그 `<Text>` 자식을 편집(중복 필드 방지).
    if (elementType === "Button" || elementType === "ToggleButton") {
      if (
        selectedChildren.some(
          (child) => child.type === "Icon" && !child.deleted,
        )
      ) {
        return fields.filter((f) => f.key !== "children");
      }
    }
    return fields;
  }, [contract, elementType, selectedChildren]);

  // semantic write — ADR-048 propagation + canonical ref 해소 보존 (legacy handleUpdate 동일).
  const handleSemanticUpdate = useCallback(
    (key: string, value: unknown) => {
      const state = useStore.getState();
      const canonicalDocument = getActiveCanonicalDocument();
      if (!canonicalDocument) return;
      const { childrenByParent, elementsById } =
        getCanonicalPropertyReadIndex(canonicalDocument);
      const element = elementsById.get(elementId);
      if (!element) return;

      const lookupRefElementList = Array.from(elementsById.values()).map(
        panelNodeToCanonicalRefNode,
      );

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

      // ADR-048 propagation 을 포함한 store 쓰기는 `semanticUpdateDispatch` 한 벌 — 여기서
      //   직접 store 액션을 부르면 seam 이 게이트 밖으로 나간다 (round 5 fe4m1, AST 게이트).
      dispatchSemanticUpdateWithPropagation({
        changedProps,
        propagationElement,
        childrenMap: propagationChildrenMap as Map<
          string,
          { id: string; type: string; props: Record<string, unknown> }[]
        >,
        elementsMap: propagationElementsMap as Map<
          string,
          { id: string; type: string; props: Record<string, unknown> }
        >,
        actions: state,
      });
    },
    [elementId],
  );

  // style write — Style view 전환(후속)까지는 미사용. updateSelectedStyle 단일 prop + distributeShorthand.
  const handleStyleUpdate = useCallback((key: string, value: unknown) => {
    const state = useStore.getState();
    state.updateSelectedStyle(key, value == null ? "" : String(value));
  }, []);

  if (semanticFields.length === 0) {
    // 비-catalog 오소링 섹션이 편집 축을 전담하는 타입(body)은 EmptyState 를 띄우지
    // 않는다 — 계약이 빈 게 결함이 아니라 축이 다른 것이고, 실제 컨트롤은
    // PageBodySection 이 공급하므로 함께 뜨면 모순된 안내가 된다.
    if (DEDICATED_SECTION_TYPES.has(elementType)) return null;
    if (contentExtras != null) {
      return (
        <GenericFieldRenderer
          fields={semanticFields}
          onSemanticUpdate={handleSemanticUpdate}
          onStyleUpdate={handleStyleUpdate}
          elementId={elementId}
          contentExtras={contentExtras}
        />
      );
    }
    return (
      <EmptyState
        icon={<Settings2 size={32} />}
        message={t("propertiesPanel.emptyMessage")}
        description={t("propertiesPanel.emptyDescription", {
          type: elementType,
        })}
      />
    );
  }

  return (
    <GenericFieldRenderer
      fields={semanticFields}
      onSemanticUpdate={handleSemanticUpdate}
      onStyleUpdate={handleStyleUpdate}
      elementId={elementId}
      contentExtras={contentExtras}
    />
  );
});

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
  selectedElement: SelectedElementIdentity;
  onSetSelectedElement: (
    id: string | null,
    props?: Record<string, unknown>,
  ) => void;
  onSetSelectedElements: (ids: string[]) => void;
}) {
  const { t } = useI18n();
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

  // Get actions without subscribing.
  // add/update/removeElement(단수) 는 그룹화·복사/붙여넣기가 `canvasActions` 로
  // 넘어가면서 이 컴포넌트에서 소비처가 사라졌다 (ADR-182 HC4).
  const removeElements = useStore.getState().removeElements;
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
  // 복사/붙여넣기는 `canvasActions` 공유 계층을 소비한다 (ADR-182 HC4) — 이 패널이
  // 세 번째 consumer 다. 종전엔 같은 오케스트레이션(copyMultipleElements →
  // serialize → clipboard / deserialize → pasteMultipleElements → batch add +
  // trackMultiPaste)을 자체 구현하고 있었고, 그래서 버튼 표기가 실제 단축키와
  // 어긋나도 드러나지 않았다.
  const handleCopyAll = async () => {
    await copySelection({
      elementsMap: getLegacyElementsMap(),
      writeClipboardText: copyText,
    });
  };

  const handlePasteAll = async () => {
    await paste({
      elementsMap: getLegacyElementsMap(),
      readClipboardText: pasteText,
      pasteHistory: "batch",
    });
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        t("propertiesPanel.confirmDeleteSelection", {
          count: selectedElementIds.length,
        }),
      )
    )
      return;
    try {
      const elementsMap = getLegacyElementsMap();
      const elementsToDelete = selectedElementIds
        .map((id: string) => elementsMap.get(id))
        .filter((el): el is NonNullable<typeof el> => el !== undefined);
      if (elementsToDelete.length === 0) return;
      // 배치 삭제 1회 = 되돌리기 1회. 요소별 removeElement 를 Promise.all 로 돌리면
      //   (a) 각 삭제가 자기 entry 를 만들어 undo 가 요소 수만큼 늘고, (b) 각각이 오래된
      //   currentState 를 기준으로 set 해서 마지막 commit 이 앞선 삭제를 메모리에 되살린다.
      //   removeElements 는 단일 set + 단일 entry 다.
      // trackMultiDelete 는 제거했다 — executeRemoval 이 canonical remove event 를 이미
      //   기록하므로 중복이었다 (요소당 1개씩 더해져 실측 2N 엔트리: 2개 삭제 → 4 entry).
      await removeElements(selectedElementIds);
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
      // batchUpdateElementProps 가 canonical update event 를 담은 batch entry 1개를
      //   스스로 기록한다 (elementUpdate.ts). 여기서 trackBatchUpdate 를 함께 부르면
      //   같은 변경이 두 엔트리가 되어 죽은 undo 단계가 생긴다 — 호출 제거.
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

  // 그룹화도 공유 계층 소비 (ADR-182 HC4). 자체 구현과의 차이 3건은 판정 후 흡수:
  //   ① `multiSelectMode` 게이트 — 이 컴포넌트가 `multiSelectMode && length > 1`
  //      에서만 렌더되므로 항상 통과 (동작 변화 없음)
  //   ② 자식의 `page_id` 갱신 — 자체 구현은 `parent_id` 만 저장해, cross-page
  //      선택을 그룹화하면 자식 page_id 가 옛 페이지에 남았다.
  //      `createGroupFromSelection` 은 frame page 로 옮긴 값을 이미 돌려준다
  //   ③ 선택 반영 — `onSetSelectedElement` 는 store `setSelectedElement` 그대로다
  const handleGroupSelection = async () => {
    await groupSelection({ elementsMap: getLegacyElementsMap() });
  };

  // 정렬·분배도 같은 공유 계층 — 자체 구현은 body 를 거르지 않아 ⌘A 선택의
  // 툴바 버튼이 페이지 루트에 left/top 을 썼다 (컨텍스트 메뉴·단축키는
  // `selectableWithoutBody` 를 지나는데 이 경로만 남아 있었다). 최소 개수 판정도
  // `ALIGN/DISTRIBUTE_MIN_SELECTION` 한 곳에서 나온다.
  const handleAlign = async (type: AlignmentType) => {
    await alignSelection({ elementsMap: getLegacyElementsMap() }, type);
  };

  const handleDistribute = async (type: DistributionType) => {
    await distributeSelection({ elementsMap: getLegacyElementsMap() }, type);
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
 * 선택 props 전체가 필요한 clipboard 축을 header leaf로 격리한다.
 * PropertiesPanelContent는 id/type만 구독하며, deferred snapshot이 새 id를 따라올 때까지
 * 복사 버튼을 비활성화해 직전 선택의 props를 복사하지 않는다.
 */
const PropertyClipboardActions = memo(function PropertyClipboardActions({
  elementId,
}: {
  elementId: string;
}) {
  const { t } = useI18n();
  const selectedElement = useDebouncedSelectedElementData();
  const activeScope = useActiveScope();
  const selectedProperties =
    selectedElement?.id === elementId ? selectedElement.properties : null;

  const { copy: copyProperties, paste: pasteProperties } = useCopyPaste({
    onPaste: (data) => {
      useStore.getState().updateSelectedProperties(data);
    },
    name: "properties",
  });

  const handleCopyProperties = useCallback(async () => {
    if (!selectedProperties) return;
    await copyProperties(selectedProperties);
  }, [copyProperties, selectedProperties]);

  const handlePasteProperties = useCallback(async () => {
    await pasteProperties();
  }, [pasteProperties]);

  const shortcuts = useMemo(
    () => [
      ...bindHandlersToDefinitions(["copyProperties", "pasteProperties"], {
        copyProperties: handleCopyProperties,
        pasteProperties: handlePasteProperties,
      }),
    ],
    [handleCopyProperties, handlePasteProperties],
  );

  useKeyboardShortcutsRegistry(
    shortcuts,
    [handleCopyProperties, handlePasteProperties],
    { activeScope },
  );

  return (
    <>
      <ActionIconButton
        onPress={handleCopyProperties}
        aria-label="Copy properties"
        isDisabled={
          !selectedProperties || Object.keys(selectedProperties).length === 0
        }
        tooltip={t("propertiesPanel.copyProperties")}
        shortcutId="copyProperties"
      >
        <CopyIcon
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </ActionIconButton>
      <ActionIconButton
        onPress={handlePasteProperties}
        aria-label="Paste properties"
        tooltip={t("propertiesPanel.pasteProperties")}
        shortcutId="pasteProperties"
      >
        <PasteIcon
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </ActionIconButton>
    </>
  );
});

/** slot mirror 값과 write closure도 선택 identity 소비자에서 분리한다. */
const SelectedElementSlotSelector = memo(function SelectedElementSlotSelector({
  elementId,
}: {
  elementId: string;
}) {
  const slotValue = useCanonicalPropertyValue(
    elementId,
    "semantic",
    SLOT_NAME_MIRROR_FIELD,
    null,
  );
  const currentSlotName = typeof slotValue === "string" ? slotValue : null;
  const handleSlotChange = useCallback(
    (slotName: string) => {
      const canonicalDocument = getActiveCanonicalDocument();
      if (!canonicalDocument) return;
      const element =
        getCanonicalPropertyReadIndex(canonicalDocument).elementsById.get(
          elementId,
        );
      if (!element) return;

      const props = withSlotMirrorName(
        (element.props ?? {}) as Record<string, unknown>,
        slotName,
      );
      const patch: Partial<Element> = {
        props: props as Element["props"],
      };
      (patch as Record<string, unknown>)[SLOT_NAME_MIRROR_FIELD] = slotName;
      void useStore.getState().updateElement(elementId, patch);
    },
    [elementId],
  );

  return (
    <ElementSlotSelector
      elementId={elementId}
      currentSlotName={currentSlotName}
      onSlotChange={handleSlotChange}
    />
  );
});

/**
 * PropertiesPanelContent - 실제 콘텐츠 컴포넌트
 * 훅은 여기서만 실행됨 (isActive=true일 때만)
 *
 * ADR-203 Phase 4: 선택 전체 객체 대신 id + 해소된 type scalar만 구독한다.
 * 전체 props가 필요한 clipboard/slot/field는 각각 leaf에서 구독한다.
 */
function PropertiesPanelContent() {
  const { t } = useI18n();
  const selectedElementId = useStore((state) => state.selectedElementId);
  const selectedElementType =
    useCanonicalPropertyElementType(selectedElementId);

  // 🚀 Performance: 액션만 가져오기 (구독 없음)
  // ADR-155 Phase 2: removeElement/updateElementProps/addElement 는 전역 단축키
  // 핸들러와 함께 CanvasSelectionShortcuts host 로 이동
  const setSelectedElement = useStore.getState().setSelectedElement;
  const setSelectedElements = useStore.getState().setSelectedElements;

  // 선택된 요소가 없으면 빈 상태 표시
  // ADR-923 잔여 1 (2026-09-03 판정 A): DOM 이 parent 로 self-compose 하는 sub-part (field 의 FieldError)
  //   는 편집 surface 를 parent 로 귀속 — 안내만 띄운다 (`delegatedSubpart.ts`).
  const selectedSubpartOwnerType =
    useSelectedSubpartOwnerType(selectedElementId);
  const delegatedSubpart = isDelegatedSubpart(
    selectedElementType,
    selectedSubpartOwnerType,
  );

  if (!selectedElementId || !selectedElementType) {
    return (
      <div className="panel">
        <PanelHeader
          icon={<Settings2 size={iconProps.size} />}
          title={t("panels.properties")}
          panelId="properties"
        />
        <PanelContents>
          <EmptyState
            icon={<Settings2 size={32} />}
            message={t("propertiesPanel.selectElement")}
          />
        </PanelContents>
      </div>
    );
  }

  return (
    <div className="panel">
      <PanelHeader
        icon={<Settings2 size={iconProps.size} />}
        title={selectedElementType}
        panelId="properties"
        actions={<PropertyClipboardActions elementId={selectedElementId} />}
      />

      <PanelContents>
        {delegatedSubpart ? (
          <EmptyState
            icon={<Settings2 size={32} />}
            message={t("propertiesPanel.delegatedSubpartMessage")}
            description={t("propertiesPanel.delegatedSubpartDescription", {
              type: selectedElementType,
              parent: selectedSubpartOwnerType ?? "",
            })}
          />
        ) : (
          <>
            {/* 🚀 Performance: MultiSelectContent - 다중 선택 UI 분리 */}
            <MultiSelectContent
              selectedElement={{
                id: selectedElementId,
                type: selectedElementType,
              }}
              onSetSelectedElement={setSelectedElement}
              onSetSelectedElements={setSelectedElements}
            />

            <ComponentSemanticsSection elementId={selectedElementId} />

            {/* 모든 element 공통의 DOM/CSS 식별 축 (id · class) — 퍼블리싱 문서와 인터랙션
            대상 지목이 그대로 쓰는 구조라 컴포넌트별 편집 계약과 분리한다. */}
            <ElementAttributesSection elementId={selectedElementId} />

            {/* body 의 페이지·프레임 오소링 축 (catalog accepts 로 표현 불가 — PageBodySection 주석) */}
            <PageBodySection elementId={selectedElementId} />

            <FrameSlotSection elementId={selectedElementId} />

            <ComponentSlotFillSection elementId={selectedElementId} />

            <CatalogEditContractEditor
              elementId={selectedElementId}
              elementType={selectedElementType}
              contentExtras={
                /* Button/ToggleButton 의 Icon·Text 자식 편집 — catalog 계약 밖 축이지만
               사용자에겐 같은 Content 라 별도 섹션을 만들지 않고 주입한다. */
                BUTTON_CHILD_HOST_TAGS.has(selectedElementType) ? (
                  <ButtonChildFields elementId={selectedElementId} />
                ) : undefined
              }
            />

            {/* ⭐ Layout/Slot System: Element가 들어갈 Slot 선택 */}
            <SelectedElementSlotSelector elementId={selectedElementId} />
          </>
        )}
      </PanelContents>
    </div>
  );
}
