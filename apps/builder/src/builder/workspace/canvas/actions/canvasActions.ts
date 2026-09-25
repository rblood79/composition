import { confirmStructuralOriginImpact } from "../../../stores/utils/elementUpdate";
import {
  createOperableLookup,
  filterOperable,
  notifyOperationRejected,
  type OperableNode,
  type OperableSelection,
  type StructuralOp,
} from "../../../domain/canOperate";
import { useStore } from "../../../stores";
import { isSyntheticDescendantId } from "../../../stores/canonical/syntheticDescendantLookup";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import {
  createEffectiveTypeResolver,
  notifyMoveTargetRejected,
  resolveMoveTarget,
} from "../../../domain/resolveMoveTarget";
import { notifyNestingRelocation } from "../interaction/nestingNotice";
import {
  copyMultipleElements,
  deserializeCopiedElements,
  pasteMultipleElements,
  resolvePasteTargetParentId,
  serializeCopiedElements,
} from "../../../utils/multiElementCopy";
import {
  createGroupFromSelection,
  ungroupElement,
} from "../../../stores/utils/elementGrouping";
import { alignElements } from "../../../stores/utils/elementAlignment";
import type { AlignmentType } from "../../../stores/utils/elementAlignment";
import { distributeElements } from "../../../stores/utils/elementDistribution";
import type { DistributionType } from "../../../stores/utils/elementDistribution";
import type { EditingSemanticsTarget } from "@/adapters/canonical/editingSemantics";
import {
  trackGroupCreation,
  trackMultiPaste,
  trackUngroup,
} from "../../../stores/utils/historyHelpers";
import { attachCanonicalStateToCopy } from "../../../utils/canonicalCopyState";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";

type CanvasActionElementsMap = Parameters<typeof copyMultipleElements>[1];
type CanvasActionStoreElement = NonNullable<
  ReturnType<CanvasActionElementsMap["get"]>
>;

/**
 * 캔버스 액션 계층이 읽는 element.
 *
 * 시맨틱 축 필드는 `EditingSemanticsTarget` 을 그대로 합친다 — 구조상 이미
 * 통과하던 것을 **타입으로 고정**해, 사영이 그 필드를 떨어뜨리면 여기서
 * 먼저 걸리게 한다 (ADR-199 R7 — 해소가 인스턴스 자신의 `reusable` 을 지워
 * 캔버스 메뉴만 반대 라벨을 띄웠다). 필드 이름은 어댑터 타입이 소유한다
 * (ADR-116 G5 — legacy mirror 필드명은 `adapters/canonical/**` 안에서만).
 */
export type CanvasActionElement = {
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
} & Partial<Omit<EditingSemanticsTarget, "id">>;

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
 *
 * instance 의 synthetic 자식 (`<instance>/<path>`) 은 여기서 뺀다 — store 노드가 아니라 자식은
 * origin · `descendants` 에서 온다. 넣어 두면 복사 · 복제가 부모-자식 관계로 자손을 모으다
 * 새 ref 아래 실제 자식으로 붙여 origin 자식과 두 벌 그려졌다 (B-3, 2026-09-24 live).
 */
export function buildCanvasActionElementsMap(
  elementsMap: ReadonlyMap<string, CanvasActionElement>,
): CanvasActionElementsMap {
  return new Map(
    Array.from(elementsMap.entries())
      .filter(([id]) => !isSyntheticDescendantId(id))
      .map(([id, element]) => {
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
 * 선택 중 이 작업을 할 수 있는 id — 선택을 문서 구조로 바꾸는 모든 행동의 공통 관문 (ADR-236
 * Phase 3). 판정은 `canOperate` 하나다: body (페이지 루트 — ⌘A 가 같이 고른다) · instance 의
 * synthetic 자식 (store 노드가 아니다, B-3) 은 모든 작업에서, systemOwned origin · ListBox template
 * anchor 는 삭제에서 빠진다. 컨텍스트 메뉴 · 액션 바 · 단축키 판정 (`commandMeta`) 도 같은 함수를
 * 읽어 노출 판정과 실행 판정이 갈리지 않는다.
 *
 * 필드는 store 노드에서 읽는다 — 표면 맵 (캔버스 상호작용 맵) 에는 `reusable` · `metadata` 가 없다.
 */
export function selectOperable(
  op: StructuralOp,
  ids: readonly string[],
  elementsMap: ReadonlyMap<string, OperableNode>,
): OperableSelection {
  return filterOperable(
    op,
    ids,
    createOperableLookup(elementsMap, useStore.getState().elementsMap),
  );
}

/**
 * 구조 변경 행동의 최소 선택 개수 — body 를 뺀 뒤의 개수 기준.
 * 컨텍스트 메뉴·액션 바의 노출 판정도 같은 상수를 읽는다 (한쪽만 바뀌면
 * 조건 미충족 dead 항목이 다시 생긴다 — 2026-08-27 code-review #10 계열).
 */
export const GROUP_MIN_SELECTION = 2;
export const ALIGN_MIN_SELECTION = 2;
export const DISTRIBUTE_MIN_SELECTION = 3;

/**
 * @returns 클립보드 쓰기까지 성공했으면 true. `cutSelection` 이 이 값으로
 *   삭제 여부를 정한다 — 복사가 실패했는데 지우면 내용이 사라진다.
 */
export async function copySelection(
  context: CanvasActionContext,
): Promise<boolean> {
  const { selectedElementIds, currentPageId } = useStore.getState();
  if (context.requireCurrentPageForCopy && !currentPageId) return false;

  const elementsMap = getActionElements(context);
  // ⌘A→⌘C→⌘V 는 복제와 같은 경로로 두 번째 body 를 문서에 넣는다 — 복제·삭제와
  // 같은 관문을 지난다. body 만 선택된 경우는 복사할 것이 없다 (cut 은 이 false
  // 로 삭제도 건너뛴다).
  const copyableIds = selectOperable(
    "copy",
    selectedElementIds,
    elementsMap,
  ).ids;
  if (copyableIds.length === 0) return false;

  // ADR-214: state 는 canonical 노드에서 읽는다 (read model 값은 버린다 — 정본 하나).
  const copiedData = attachCanonicalStateToCopy(
    copyMultipleElements(copyableIds, elementsMap),
    getActiveCanonicalDocument(),
  );
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
  const rawTargetParentId = resolvePasteTargetParentId({
    currentPageId,
    selectedElementId,
    elements: elementsMap.values(),
  });

  // 대상 판정 (`resolveMoveTarget`, nearest-ancestor) — 붙여넣는 루트 타입들이 대상 안에 못 들어가면
  // 가까운 유효 조상으로 옮기고, 어디에도 못 두면 취소한다 (canonical guard 가 조용히 거부하기 전에
  // 알린다). ref instance 는 원본 타입으로 읽는다 — 팔레트와 같은 규칙 (ADR-236 Phase 3, E7).
  const nodes = elementsMap as ReadonlyMap<string, CanvasInteractionNode>;
  const doc = getActiveCanonicalDocument();
  const typeOf = createEffectiveTypeResolver(nodes, doc);
  const rootTypes = copiedData.rootIds
    .map((id) => copiedData.elements.find((el) => el.id === id))
    .filter((el): el is NonNullable<typeof el> => el !== undefined)
    .map((el) => typeOf(el as unknown as CanvasInteractionNode));
  const target = rawTargetParentId
    ? resolveMoveTarget({
        targetParentId: rawTargetParentId,
        insertionIndex: Number.MAX_SAFE_INTEGER,
        movingTypes: rootTypes,
        nodes,
        policy: "nearest-ancestor",
        doc,
      })
    : null;
  if (target && !target.ok) {
    notifyMoveTargetRejected(target);
    return;
  }
  const relocation = target?.relocation ?? null;
  const targetParentId = target ? target.parentId : rawTargetParentId;

  const newElements = pasteMultipleElements(
    copiedData,
    currentPageId,
    context.scenePoint ?? { x: 10, y: 10 },
    Array.from(elementsMap.values()),
    { targetParentId },
  );

  // origin 안에 붙여넣으면 모든 instance 가 바뀐다 (E4) — 추가 루프 전에 한 번 묻는다 (확인된 origin 은
  //   캐시돼 store 진입부 게이트가 동기 통과한다. 병렬 추가가 대화상자를 겹쳐 띄우지 않게).
  const pasteGate = confirmStructuralOriginImpact(
    newElements.map((element) => element.parent_id),
  );
  if (pasteGate !== true && !(await pasteGate)) return;

  // batch 경로는 trackMultiPaste 가 entry 하나를 남기므로 undo 1회가 붙여넣기 전체를
  //   되돌린다. 비-batch 경로는 element 마다 entry 라 단일일 때만 되돌리기를 준다.
  const notifyIfRelocated = (withUndo: boolean): void => {
    if (!relocation || !targetParentId || newElements.length === 0) return;
    const parent = nodes.get(targetParentId);
    notifyNestingRelocation(
      relocation,
      parent ? typeOf(parent) : targetParentId,
      { withUndo },
    );
  };

  if (context.pasteHistory === "batch") {
    await Promise.all(
      newElements.map((element) => addElement(element, { skipHistory: true })),
    );
    if (newElements.length > 0) trackMultiPaste(newElements);
    notifyIfRelocated(true);
    return;
  }

  for (const element of newElements) {
    await addElement(element);
  }
  notifyIfRelocated(newElements.length === 1);
}

export async function duplicateSelection(
  context: CanvasActionContext,
): Promise<void> {
  const { selectedElementIds, currentPageId, addElement, setSelectedElements } =
    useStore.getState();
  // ADR-182 후속 (2026-08-27, ADR-192 Phase 2 live 실측): 복제는 단일 선택에서도
  // 의미가 있는데 `multiSelectMode` 게이트 탓에 메뉴·⌘D·액션 바 모두 조용한
  // no-op 이었다. 다중 선택 전용 게이트는 group/align/distribute 에만 남긴다.
  if (!currentPageId) return;

  const elementsMap = getActionElements(context);
  // body 는 페이지당 1개다 — 복제하면 씬(splitPageBody first-wins)이 두 번째
  // body 를 버려 자손이 고아가 되는데도 문서·IndexedDB 에는 남고,
  // deleteSelection 이 body 를 거부해 undo 외엔 지울 수 없다. 삭제 경로와 같은
  // 필터를 복제에도 적용한다 (2026-08-27 code-review #1).
  const duplicableIds = selectOperable(
    "duplicate",
    selectedElementIds,
    elementsMap,
  ).ids;
  if (duplicableIds.length === 0) return;

  // ADR-214: state 는 canonical 노드에서 읽고, paste 의 id 재발급 pass 가 새 id 를 발급한다.
  const copiedData = attachCanonicalStateToCopy(
    copyMultipleElements(duplicableIds, elementsMap),
    getActiveCanonicalDocument(),
  );
  const newElements = pasteMultipleElements(
    copiedData,
    currentPageId,
    { x: 10, y: 10 },
    Array.from(elementsMap.values()),
  );
  if (newElements.length === 0) return;
  // origin 안 복제는 모든 instance 를 바꾼다 (E4) — 병렬 추가 전에 한 번 묻는다.
  const duplicateGate = confirmStructuralOriginImpact(
    newElements.map((element) => element.parent_id),
  );
  if (duplicateGate !== true && !(await duplicateGate)) return;

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
    selectedIdsForDelete.unshift(selectedElementId);
  }

  const deletable = selectOperable("delete", selectedIdsForDelete, elementsMap);
  if (deletable.ids.length === 0) {
    // 메뉴는 이 선택에 삭제를 세우지 않지만 단축키 · agent 는 판정 없이 온다 — 무음 no-op 대신 이유를 보인다 (E3 · E11).
    notifyOperationRejected(deletable.rejected);
    return;
  }
  const deletableIds = deletable.ids;

  setSelectedElement(null);
  await removeElements(deletableIds);
}

export async function groupSelection(
  context: CanvasActionContext,
): Promise<void> {
  const {
    selectedElementIds,
    currentPageId,
    addElement,
    updateElement,
    setSelectedElement,
  } = useStore.getState();
  // 개수로만 판정한다 — `multiSelectMode` 를 따로 요구하면 메뉴 (개수 판정) 에 선 항목이 no-op 이 된다 (E9).
  if (!currentPageId) return;

  const elementsMap = getActionElements(context);
  // 컨텍스트 메뉴는 body 가 섞인 선택에 group 항목을 만들지 않지만 ⌘G 는 그
  // 관문을 거치지 않는다 — 필터가 없으면 `createGroupFromSelection` 이 페이지
  // 루트를 새 frame 의 자식으로 reparent 한다 (2026-08-27 관찰의 같은 계열).
  const groupableIds = selectOperable(
    "group",
    selectedElementIds,
    elementsMap,
  ).ids;
  if (groupableIds.length < GROUP_MIN_SELECTION) return;

  // 필터를 통과한 id 는 map 에 있다
  const previousChildren = groupableIds.map(
    (id) => elementsMap.get(id) as CanvasActionStoreElement,
  );
  const { groupElement, updatedChildren } = createGroupFromSelection(
    groupableIds,
    elementsMap,
    currentPageId,
  );

  // 새 frame 이 부모 (예: ListBox 같은 strict 컬렉션) 에 못 들어가면 백스톱이 frame 만
  // 거부하고, 이어지는 parent_id patch 가 자식을 없는 부모 아래로 보낸다. 묶기 전에
  // 판정한다 — 다른 조상으로 옮기면 선택이 제자리를 떠나므로 relocation 없이 거부.
  if (groupElement.parent_id) {
    const target = resolveMoveTarget({
      targetParentId: groupElement.parent_id,
      insertionIndex: Number.MAX_SAFE_INTEGER,
      movingTypes: [groupElement.type],
      nodes: elementsMap as ReadonlyMap<string, CanvasInteractionNode>,
      policy: "reject",
      doc: getActiveCanonicalDocument(),
    });
    if (!target.ok) {
      notifyMoveTargetRejected(target);
      return;
    }
  }

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
  if (!selectedElement) return;
  // frame 이 아니면 조용히 끝내고, systemOwned frame 은 이유를 보인다 — ungroup 은 frame 을 지우는데
  // 지울 수 없는 origin 이면 자식만 빠지고 빈 origin 이 남는다 (E5).
  const verdict = selectOperable("ungroup", [selectedElementId], elementsMap);
  if (verdict.ids.length === 0) {
    notifyOperationRejected(verdict.rejected);
    return;
  }

  const groupElementForHistory = elementsMap.get(selectedElementId);
  const previousChildren = Array.from(elementsMap.values()).filter(
    (element) => element.parent_id === selectedElementId,
  );
  const { updatedChildren, groupIdToDelete } = ungroupElement(
    selectedElementId,
    elementsMap,
  );

  // 자식 하나라도 frame 의 부모에 못 들어가면 전체를 거부한다 — 일부 자식만 거부된 채
  // 아래 removeElement 가 frame 을 지우면 남은 자식이 frame 과 함께 삭제된다.
  const releaseParentId = selectedElement.parent_id;
  if (releaseParentId && updatedChildren.length > 0) {
    const nodes = elementsMap as ReadonlyMap<string, CanvasInteractionNode>;
    const doc = getActiveCanonicalDocument();
    const typeOf = createEffectiveTypeResolver(nodes, doc);
    const target = resolveMoveTarget({
      targetParentId: releaseParentId,
      insertionIndex: Number.MAX_SAFE_INTEGER,
      movingTypes: updatedChildren.map((child) =>
        typeOf(child as CanvasInteractionNode),
      ),
      nodes,
      policy: "reject",
      doc,
    });
    if (!target.ok) {
      notifyMoveTargetRejected(target);
      return;
    }
  }

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
  const { selectedElementIds, batchUpdateElementProps } = useStore.getState();

  const elementsMap = getActionElements(context);
  // ⌘A 선택에는 body 가 섞인다 — 정렬 대상에 들어가면 페이지 루트에 left/top 을
  // 쓰고, body 의 bounding box 가 전체를 덮어 나머지 요소의 정렬 기준까지
  // 무너뜨린다 (2026-08-27 관찰).
  const alignableIds = selectOperable(
    "move",
    selectedElementIds,
    elementsMap,
  ).ids;
  if (alignableIds.length < ALIGN_MIN_SELECTION) return;

  const updates = alignElements(alignableIds, elementsMap, type);
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
  const { selectedElementIds, batchUpdateElementProps } = useStore.getState();

  const elementsMap = getActionElements(context);
  // 정렬과 같은 이유 — 분배는 양 끝 요소를 고정점으로 잡는데 body 가 섞이면
  // 페이지 루트가 고정점이 된다.
  const distributableIds = selectOperable(
    "move",
    selectedElementIds,
    elementsMap,
  ).ids;
  if (distributableIds.length < DISTRIBUTE_MIN_SELECTION) return;

  const updates = distributeElements(distributableIds, elementsMap, type);
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
