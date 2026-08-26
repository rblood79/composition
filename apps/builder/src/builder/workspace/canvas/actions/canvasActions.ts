import { useStore } from "../../../stores";
import {
  copyMultipleElements,
  deserializeCopiedElements,
  pasteMultipleElements,
  resolvePasteTargetParentId,
  serializeCopiedElements,
} from "../../../utils/multiElementCopy";
import {
  createGroupFromSelection,
  isFrameOrLegacyGroup,
  ungroupElement,
} from "../../../stores/utils/elementGrouping";
import { alignElements } from "../../../stores/utils/elementAlignment";
import type { AlignmentType } from "../../../stores/utils/elementAlignment";
import { distributeElements } from "../../../stores/utils/elementDistribution";
import type { DistributionType } from "../../../stores/utils/elementDistribution";
import {
  trackGroupCreation,
  trackMultiPaste,
  trackUngroup,
} from "../../../stores/utils/historyHelpers";

type CanvasActionElementsMap = Parameters<typeof copyMultipleElements>[1];
type CanvasActionStoreElement = NonNullable<
  ReturnType<CanvasActionElementsMap["get"]>
>;

export interface CanvasActionElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  parentId?: string | null;
  pageId?: string | null;
  customId?: string | null;
  componentName?: string | null;
  deleted?: boolean;
}

export interface CanvasActionContext {
  elementsMap: ReadonlyMap<string, CanvasActionElement>;
  scenePoint?: { x: number; y: number };
  readClipboardText?: () => Promise<string | null>;
  writeClipboardText?: (text: string) => Promise<boolean>;
  pasteHistory?: "per-element" | "batch";
  requireCurrentPageForCopy?: boolean;
}

/**
 * Normalize the two read models consumed by the action layer.
 *
 * Properties uses PanelNode/legacy snake_case fields while Canvas uses the
 * interactive scene map and may expose canonical camelCase aliases. The
 * action utilities still consume the legacy compatibility shape, so this is
 * the single adapter boundary for both consumers.
 */
export function buildCanvasActionElementsMap(
  elementsMap: ReadonlyMap<string, CanvasActionElement>,
): CanvasActionElementsMap {
  return new Map(
    Array.from(elementsMap.entries()).map(([id, element]) => {
      const {
        parentId: _parentId,
        pageId: _pageId,
        customId: _customId,
        componentName: _componentName,
        ...rest
      } = element;

      return [
        id,
        {
          ...rest,
          parent_id: element.parent_id ?? element.parentId ?? null,
          page_id: element.page_id ?? element.pageId ?? null,
          ...(element.customId != null ? { customId: element.customId } : {}),
          ...(element.componentName != null
            ? { componentName: element.componentName }
            : {}),
        } as CanvasActionStoreElement,
      ];
    }),
  );
}

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function readClipboardText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

function getActionElements(
  context: CanvasActionContext,
): CanvasActionElementsMap {
  return buildCanvasActionElementsMap(context.elementsMap);
}

/**
 * @returns 클립보드 쓰기까지 성공했으면 true. `cutSelection` 이 이 값으로
 *   삭제 여부를 정한다 — 복사가 실패했는데 지우면 내용이 사라진다.
 */
export async function copySelection(
  context: CanvasActionContext,
): Promise<boolean> {
  const { selectedElementIds, currentPageId } = useStore.getState();
  if (
    selectedElementIds.length === 0 ||
    (context.requireCurrentPageForCopy && !currentPageId)
  ) {
    return false;
  }

  const elementsMap = getActionElements(context);
  const copiedData = copyMultipleElements(selectedElementIds, elementsMap);
  const serialized = serializeCopiedElements(copiedData);
  return await (context.writeClipboardText ?? writeClipboardText)(serialized);
}

/**
 * 잘라내기 = 복사 + 삭제 (ADR-182 Phase 4 — `keyboardShortcuts.ts` 의 dead
 * definition 소생).
 *
 * **복사 성공이 삭제의 전제**다. 클립보드 쓰기는 권한·포커스 문제로 조용히
 * 실패할 수 있는데, 그때도 지우면 되돌릴 곳 없이 내용이 사라진다.
 */
export async function cutSelection(
  context: CanvasActionContext,
): Promise<void> {
  const copied = await copySelection(context);
  if (!copied) return;

  await deleteSelection(context);
}

export async function paste(context: CanvasActionContext): Promise<void> {
  const { currentPageId, addElement, selectedElementId } = useStore.getState();
  if (!currentPageId) return;

  const text = await (context.readClipboardText ?? readClipboardText)();
  if (!text) return;

  const copiedData = deserializeCopiedElements(text);
  if (!copiedData) return;

  const elementsMap = getActionElements(context);
  const newElements = pasteMultipleElements(
    copiedData,
    currentPageId,
    context.scenePoint ?? { x: 10, y: 10 },
    Array.from(elementsMap.values()),
    {
      targetParentId: resolvePasteTargetParentId({
        currentPageId,
        selectedElementId,
        elements: elementsMap.values(),
      }),
    },
  );

  if (context.pasteHistory === "batch") {
    await Promise.all(
      newElements.map((element) => addElement(element, { skipHistory: true })),
    );
    if (newElements.length > 0) trackMultiPaste(newElements);
    return;
  }

  for (const element of newElements) {
    await addElement(element);
  }
}

export async function duplicateSelection(
  context: CanvasActionContext,
): Promise<void> {
  const { selectedElementIds, currentPageId, addElement, setSelectedElements } =
    useStore.getState();
  // ADR-182 후속 (2026-08-27, ADR-192 Phase 2 live 실측): 복제는 단일 선택에서도
  // 의미가 있는데 `multiSelectMode` 게이트 탓에 메뉴·⌘D·액션 바 모두 조용한
  // no-op 이었다. 다중 선택 전용 게이트는 group/align/distribute 에만 남긴다.
  if (selectedElementIds.length === 0 || !currentPageId) {
    return;
  }

  const elementsMap = getActionElements(context);
  const copiedData = copyMultipleElements(selectedElementIds, elementsMap);
  const newElements = pasteMultipleElements(
    copiedData,
    currentPageId,
    { x: 10, y: 10 },
    Array.from(elementsMap.values()),
  );
  if (newElements.length === 0) return;

  await Promise.all(
    newElements.map((element) => addElement(element, { skipHistory: true })),
  );
  trackMultiPaste(newElements);
  setSelectedElements(newElements.map((element) => element.id));
}

export async function deleteSelection(
  context: CanvasActionContext,
): Promise<void> {
  const {
    selectedElementId,
    selectedElementIds,
    removeElements,
    setSelectedElement,
  } = useStore.getState();
  const elementsMap = getActionElements(context);
  const selectedIdsForDelete = [...selectedElementIds];

  if (selectedElementId && !selectedIdsForDelete.includes(selectedElementId)) {
    const primaryElement = elementsMap.get(selectedElementId);
    if (primaryElement?.type.toLowerCase() !== "body") {
      selectedIdsForDelete.unshift(selectedElementId);
    }
  }

  if (selectedIdsForDelete.length === 0) return;

  const deletableIds = selectedIdsForDelete.filter((id) => {
    const element = elementsMap.get(id);
    return element && element.type.toLowerCase() !== "body";
  });
  if (deletableIds.length === 0) return;

  setSelectedElement(null);
  await removeElements(deletableIds);
}

export async function groupSelection(
  context: CanvasActionContext,
): Promise<void> {
  const {
    multiSelectMode,
    selectedElementIds,
    currentPageId,
    addElement,
    updateElement,
    setSelectedElement,
  } = useStore.getState();
  if (!multiSelectMode || selectedElementIds.length < 2 || !currentPageId) {
    return;
  }

  const elementsMap = getActionElements(context);
  const previousChildren = selectedElementIds
    .map((id) => elementsMap.get(id))
    .filter(
      (element): element is CanvasActionStoreElement => element !== undefined,
    );
  const { groupElement, updatedChildren } = createGroupFromSelection(
    selectedElementIds,
    elementsMap,
    currentPageId,
  );

  await addElement(groupElement, { skipHistory: true });
  await Promise.all(
    updatedChildren.map((child) =>
      updateElement(child.id, {
        parent_id: child.parent_id,
        page_id: child.page_id,
      }),
    ),
  );
  trackGroupCreation(groupElement, previousChildren, updatedChildren);
  setSelectedElement(groupElement.id, groupElement.props);
}

export async function ungroupSelection(
  context: CanvasActionContext,
): Promise<void> {
  const {
    selectedElementId,
    updateElement,
    removeElement,
    setSelectedElement,
  } = useStore.getState();
  if (!selectedElementId) return;

  const elementsMap = getActionElements(context);
  const selectedElement = elementsMap.get(selectedElementId);
  if (!selectedElement || !isFrameOrLegacyGroup(selectedElement.type)) return;

  const groupElementForHistory = elementsMap.get(selectedElementId);
  const previousChildren = Array.from(elementsMap.values()).filter(
    (element) => element.parent_id === selectedElementId,
  );
  const { updatedChildren, groupIdToDelete } = ungroupElement(
    selectedElementId,
    elementsMap,
  );

  if (groupElementForHistory) {
    trackUngroup(
      groupIdToDelete,
      previousChildren,
      groupElementForHistory,
      updatedChildren,
    );
  }
  await Promise.all(
    updatedChildren.map((child) =>
      updateElement(child.id, { parent_id: child.parent_id }),
    ),
  );
  await removeElement(groupIdToDelete, { skipHistory: true });

  if (updatedChildren.length > 0) {
    setSelectedElement(updatedChildren[0].id, updatedChildren[0].props);
  } else {
    setSelectedElement(null);
  }
}

export async function alignSelection(
  context: CanvasActionContext,
  type: AlignmentType,
): Promise<void> {
  const { multiSelectMode, selectedElementIds, batchUpdateElementProps } =
    useStore.getState();
  if (!multiSelectMode || selectedElementIds.length < 2) return;

  const elementsMap = getActionElements(context);
  const updates = alignElements(selectedElementIds, elementsMap, type);
  if (updates.length === 0) return;

  await batchUpdateElementProps(
    updates.flatMap((update) => {
      const element = elementsMap.get(update.id);
      if (!element) return [];
      return [
        {
          elementId: update.id,
          props: {
            style: {
              ...((element.props.style as Record<string, unknown>) || {}),
              ...update.style,
            },
          },
        },
      ];
    }),
  );
}

export async function distributeSelection(
  context: CanvasActionContext,
  type: DistributionType,
): Promise<void> {
  const { multiSelectMode, selectedElementIds, batchUpdateElementProps } =
    useStore.getState();
  if (!multiSelectMode || selectedElementIds.length < 3) return;

  const elementsMap = getActionElements(context);
  const updates = distributeElements(selectedElementIds, elementsMap, type);
  if (updates.length === 0) return;

  await batchUpdateElementProps(
    updates.flatMap((update) => {
      const element = elementsMap.get(update.id);
      if (!element) return [];
      return [
        {
          elementId: update.id,
          props: {
            style: {
              ...((element.props.style as Record<string, unknown>) || {}),
              ...update.style,
            },
          },
        },
      ];
    }),
  );
}
