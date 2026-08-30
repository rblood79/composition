import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Maximize,
  Percent,
} from "lucide-react";
import {
  ACTION_ICONS,
  ALIGNMENT_ICONS,
  DISTRIBUTION_ICONS,
} from "../../../config/actionIcons";
import {
  getAlignmentDescription,
  type AlignmentType,
} from "../../../stores/utils/elementAlignment";
import {
  getDistributionDescription,
  type DistributionType,
} from "../../../stores/utils/elementDistribution";
import { useStore } from "../../../stores";
import {
  canDetachInstance,
  getEditingSemanticsOriginId,
  isEditingSemanticsOrigin,
} from "../../../utils/editingSemantics";
import { requestEditingSemanticsDetachConfirmation } from "../../../utils/editingSemanticsImpactConfirmation";
import { registerContextMenuProvider } from "../../../components/overlay/contextMenu";
import type {
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuProviderFn,
  ContextMenuRequest,
} from "../../../components/overlay/contextMenu";
import type { ShortcutId } from "../../../config/keyboardShortcuts";
import {
  ALIGN_MIN_SELECTION,
  DISTRIBUTE_MIN_SELECTION,
  GROUP_MIN_SELECTION,
  alignSelection,
  copySelection,
  deleteSelection,
  duplicateSelection,
  distributeSelection,
  groupSelection,
  paste,
  selectableWithoutBody,
  ungroupSelection,
} from "../actions/canvasActions";
import { isFrameOrLegacyGroup } from "../../../stores/utils/elementGrouping";
import { isRenderProjectionId } from "../../../projection/renderProjectionIds";
import type { CanvasActionElement } from "../actions/canvasActions";
import {
  applyViewportState,
  computeFitViewport,
  zoomViewportAtContainerCenter,
} from "../viewport/viewportActions";
import { useViewportSyncStore } from "../stores";

export interface CanvasContextMenuProviderOptions {
  getInteractiveElementsMap: () => ReadonlyMap<string, CanvasActionElement>;
}

function actionContext(options: CanvasContextMenuProviderOptions): {
  elementsMap: ReadonlyMap<string, CanvasActionElement>;
} {
  return { elementsMap: options.getInteractiveElementsMap() };
}

function actionItem(
  id: string,
  label: string,
  run: () => void | Promise<void>,
  shortcutId?: ShortcutId,
  options?: { icon?: ContextMenuIcon; destructive?: boolean },
): ContextMenuItem {
  return {
    kind: "action",
    id,
    label,
    ...(options?.icon ? { icon: options.icon } : {}),
    ...(shortcutId ? { shortcutId } : {}),
    ...(options?.destructive ? { destructive: true } : {}),
    run,
  };
}

/**
 * z-order 항목의 노출 조건 — 같은 부모 아래 형제가 2개 이상 (ADR-182 §2).
 *
 * 형제가 하나뿐이면 네 항목 모두 무조건 no-op 이라 조건 미충족 = 숨김
 * (Figma/Pen 공통 관례 — disabled 가 아니다).
 */
function hasReorderableSiblings(
  element: CanvasActionElement,
  elementsMap: ReadonlyMap<string, CanvasActionElement>,
): boolean {
  const parentId = element.parent_id ?? element.parentId ?? null;
  // 부모가 없으면 page body 이거나 루트 — 형제 재배치 대상이 아니다
  if (!parentId) return false;

  let siblingCount = 0;
  for (const candidate of elementsMap.values()) {
    if (candidate.deleted) continue;
    const candidateParentId = candidate.parent_id ?? candidate.parentId ?? null;
    if (candidateParentId !== parentId) continue;
    siblingCount += 1;
    if (siblingCount >= 2) return true;
  }
  return false;
}

/**
 * z-order 클러스터 (ADR-182 T1 #4~#7).
 *
 * **단일 선택 한정**이다 — 다중 선택의 상대 순서 보존 규칙이 정의되지 않았고
 * (§2 각주는 "공통 부모 형제군 한정" 이라고만 적는다), 기존 단축키 경로도
 * `handleReorderSibling` 이 다중이면 즉시 반환한다. 표시해 놓고 아무 일도
 * 일어나지 않는 것보다 숨기는 쪽이 정책(조건 미충족 = 숨김)에 맞다.
 */
function buildZOrderItems(element: CanvasActionElement): ContextMenuItem[] {
  const moveToEdge = (edge: "front" | "back") => () => {
    useStore.getState().moveElementToSiblingEdge(element.id, edge);
  };
  const reorder = (direction: -1 | 1) => () => {
    useStore.getState().reorderElementWithinParent(element.id, direction);
  };

  return [
    { kind: "separator", id: "z-order-separator" },
    // 아이콘은 한 걸음(Arrow{Up,Down}) ↔ 끝까지(Arrow{Up,Down}ToLine) 대비로
    // 네 항목이 한 가족으로 읽히게 둔다.
    actionItem(
      "bring-to-front",
      "맨 앞으로 / Bring to Front",
      moveToEdge("front"),
      "bringToFront",
      { icon: ArrowUpToLine },
    ),
    actionItem(
      "bring-forward",
      "앞으로 / Bring Forward",
      reorder(1),
      "bringForward",
      { icon: ArrowUp },
    ),
    actionItem(
      "send-backward",
      "뒤로 / Send Backward",
      reorder(-1),
      "sendBackward",
      { icon: ArrowDown },
    ),
    actionItem(
      "send-to-back",
      "맨 뒤로 / Send to Back",
      moveToEdge("back"),
      "sendToBack",
      { icon: ArrowDownToLine },
    ),
  ];
}

const ALIGNMENT_TYPES: readonly AlignmentType[] = [
  "left",
  "center",
  "right",
  "top",
  "middle",
  "bottom",
];
const DISTRIBUTION_TYPES: readonly DistributionType[] = [
  "horizontal",
  "vertical",
];

function buildAlignmentItems(
  options: CanvasContextMenuProviderOptions,
  /**
   * 분배 섹션 노출 여부 — 2 개 선택에서는 분배가 무반응 no-op 이라 만들지
   * 않는다. 조건 미충족 항목은 숨긴다는 182 노출 정책 그대로
   * (2026-08-27 code-review #10).
   */
  canDistribute: boolean,
): ContextMenuItem[] {
  // 다중 선택 툴바(MultiSelectStatusIndicator)와 **같은 정본**을 읽는다 —
  // 두 진입점이 다른 그림을 쓰면 같은 동작으로 안 읽힌다.
  const context = () => actionContext(options);

  return [
    ...ALIGNMENT_TYPES.map((type) =>
      actionItem(
        `align-${type}`,
        getAlignmentDescription(type),
        () => alignSelection(context(), type),
        undefined,
        { icon: ALIGNMENT_ICONS[type] },
      ),
    ),
    ...(canDistribute
      ? [
          { kind: "separator" as const, id: "align-distribute-separator" },
          ...DISTRIBUTION_TYPES.map((type) =>
            actionItem(
              `distribute-${type}`,
              getDistributionDescription(type),
              () => distributeSelection(context(), type),
              undefined,
              { icon: DISTRIBUTION_ICONS[type] },
            ),
          ),
        ]
      : []),
  ];
}

function buildElementMenuItems(
  request: ContextMenuRequest,
  options: CanvasContextMenuProviderOptions,
): ContextMenuItem[] {
  const elementsMap = options.getInteractiveElementsMap();
  const targetElementIds = request.targetElementIds;
  const selectedElements = targetElementIds
    .map((id) => elementsMap.get(id))
    .filter((element): element is CanvasActionElement => element !== undefined);
  // action 층과 같은 관문(`selectableWithoutBody`)으로 body 를 거른 개수 —
  // 노출 판정과 실행 판정이 같은 함수에서 나온다.
  const nonBodyCount = selectableWithoutBody(
    targetElementIds,
    elementsMap,
  ).length;
  // `groupSelection` 은 body 를 거른 뒤 `GROUP_MIN_SELECTION` 이상에서만
  // 실행한다 — 단일 선택 group 은 결정적 no-op 이었다 (code-review #10).
  const canGroupSelection =
    selectedElements.length >= GROUP_MIN_SELECTION &&
    nonBodyCount === selectedElements.length;
  const primaryElement = selectedElements[0];
  const isSingleSelection = selectedElements.length === 1;
  const isGroupSelection =
    isSingleSelection && isFrameOrLegacyGroup(primaryElement?.type);
  const originId = isSingleSelection
    ? getEditingSemanticsOriginId(primaryElement)
    : null;
  const originElement = originId ? elementsMap.get(originId) : undefined;
  // 판정은 `reusable` 축 하나 — 인스턴스이면서 원본인 노드에서 role 로 갈랐다가
  // "컴포넌트 만들기" 가 떠서, 이미 원본인 노드를 다시 원본으로 만드는 no-op
  // 항목이 됐다 (Properties 패널 Component 섹션과 같은 축을 쓴다).
  const isComponentOrigin = isEditingSemanticsOrigin(primaryElement);
  const detachableElement = selectedElements.find((element) =>
    canDetachInstance(element),
  );
  const context = () => actionContext(options);

  const items: ContextMenuItem[] = [
    actionItem(
      "copy",
      "복사 / Copy",
      // `copySelection` 은 `Promise<boolean>` 이라 `run` 계약(`void | Promise<void>`)에
      // 그대로 맞지 않는다. 호출부(`ContextMenuOverlay`)가 이미 `void item.run()` 으로
      // 버리므로 결과를 여기서 흘려보내도 동작은 같다.
      () => {
        void copySelection(context());
      },
      "copy",
      { icon: ACTION_ICONS.copy },
    ),
    actionItem(
      "paste",
      request.scenePoint ? "여기에 붙여넣기 / Paste here" : "붙여넣기 / Paste",
      () => paste({ ...context(), scenePoint: request.scenePoint }),
      "paste",
      { icon: ACTION_ICONS.paste },
    ),
    actionItem(
      "duplicate",
      "복제 / Duplicate",
      () => duplicateSelection(context()),
      "duplicate",
      { icon: ACTION_ICONS.duplicate },
    ),
    { kind: "separator", id: "selection-separator" },
  ];

  if (
    isSingleSelection &&
    primaryElement &&
    !isRenderProjectionId(primaryElement.id) &&
    hasReorderableSiblings(primaryElement, elementsMap)
  ) {
    items.push(...buildZOrderItems(primaryElement));
    // 뒤 섹션이 비어 이 구분선이 붕 뜨는 경우는 조립 지점의
    // `dropEmptySeparators` 가 정리한다
    items.push({ kind: "separator", id: "structure-separator" });
  }

  if (canGroupSelection) {
    items.push(
      actionItem(
        "group",
        "그룹 만들기 / Group selection",
        () => groupSelection(context()),
        "group",
        { icon: ACTION_ICONS.group },
      ),
    );
  }

  if (isGroupSelection) {
    items.push(
      actionItem(
        "ungroup",
        "그룹 해제 / Ungroup",
        () => ungroupSelection(context()),
        "ungroup",
        { icon: ACTION_ICONS.ungroup },
      ),
    );
  }

  // body 는 정렬·분배 대상이 아니다 (canvasActions 가 거른다) — ⌘A 처럼 body 가
  // 섞인 선택에서 남는 개수로 판정해야 조건 미충족 항목이 노출되지 않는다
  // (2026-08-27 관찰: dead 항목 계열).
  if (nonBodyCount >= ALIGN_MIN_SELECTION) {
    items.push({
      kind: "submenu",
      id: "align",
      label: "정렬 / Align",
      icon: ACTION_ICONS.align,
      items: buildAlignmentItems(
        options,
        nonBodyCount >= DISTRIBUTE_MIN_SELECTION,
      ),
    });
  }

  if (isSingleSelection && nonBodyCount === 1) {
    items.push({ kind: "separator", id: "component-separator" });
    items.push(
      actionItem(
        "toggle-component-origin",
        isComponentOrigin
          ? "컴포넌트 분리 / Detach component"
          : "컴포넌트 만들기 / Create component",
        async () => {
          await useStore.getState().toggleComponentOrigin(primaryElement.id);
        },
        "toggleComponentOrigin",
        // 생성/해제 양방향 토글이라 그림도 함께 뒤집는다 (pencil 과 같은
        // `diamond-plus` / `diamond-minus`) — 라벨만 바뀌고 그림이 고정이면
        // 어느 방향인지 아이콘이 말해 주지 않는다.
        {
          icon: isComponentOrigin
            ? ACTION_ICONS.detach
            : ACTION_ICONS.createComponent,
        },
      ),
    );

    if (originElement) {
      items.push(
        actionItem(
          "go-to-origin",
          "원본으로 이동 / Go to component",
          () => {
            useStore
              .getState()
              .selectElementWithPageTransition(
                originElement.id,
                originElement.page_id ?? originElement.pageId ?? null,
              );
          },
          undefined,
          { icon: ACTION_ICONS.goToOrigin },
        ),
      );
    }
  }

  if (detachableElement) {
    items.push(
      actionItem(
        "detach-instance",
        "인스턴스 분리 / Detach instance",
        async () => {
          const confirmed = await requestEditingSemanticsDetachConfirmation({
            instanceId: detachableElement.id,
            instanceLabel:
              detachableElement.componentName ??
              detachableElement.customId ??
              detachableElement.type ??
              detachableElement.id,
          });
          if (confirmed)
            useStore.getState().detachInstance(detachableElement.id);
        },
        "detachInstance",
        { icon: ACTION_ICONS.detach },
      ),
    );
  }

  if (nonBodyCount > 0) {
    items.push({ kind: "separator", id: "delete-separator" });
    items.push(
      actionItem(
        "delete",
        "삭제 / Delete",
        () => deleteSelection(context()),
        "delete",
        // Pen 모델 — destructive 스타일 + 최하단 격리로 오클릭 완화 (ADR-182 §2)
        { icon: ACTION_ICONS.delete, destructive: true },
      ),
    );
  }

  return items;
}

function buildEmptyCanvasMenuItems(
  request: ContextMenuRequest,
  options: CanvasContextMenuProviderOptions,
): ContextMenuItem[] {
  const context = () => actionContext(options);
  const state = useStore.getState();

  return [
    actionItem(
      "paste",
      "여기에 붙여넣기 / Paste here",
      () => paste({ ...context(), scenePoint: request.scenePoint }),
      "paste",
      { icon: ACTION_ICONS.paste },
    ),
    { kind: "separator", id: "viewport-separator" },
    actionItem(
      "zoom-to-fit",
      "화면에 맞추기 / Zoom to fit",
      () => {
        const viewport = useViewportSyncStore.getState();
        if (
          viewport.containerSize.width === 0 ||
          viewport.containerSize.height === 0
        ) {
          return;
        }
        applyViewportState(
          computeFitViewport({
            canvasSize: viewport.canvasSize,
            containerSize: viewport.containerSize,
          }),
        );
      },
      "zoomToFit",
      { icon: Maximize },
    ),
    actionItem(
      "zoom-100",
      "100%",
      () => zoomViewportAtContainerCenter(1),
      "zoom100",
      { icon: Percent },
    ),
    { kind: "separator", id: "settings-separator" },
    {
      kind: "toggle",
      id: "show-rulers",
      label: state.showRulers
        ? "눈금자 숨기기 / Hide rulers"
        : "눈금자 표시 / Show rulers",
      icon: ACTION_ICONS.toggleRulers,
      checked: state.showRulers,
      shortcutId: "toggleRulers",
      run: () =>
        useStore.getState().setShowRulers(!useStore.getState().showRulers),
    },
    {
      kind: "toggle",
      id: "snap-to-objects",
      label: "객체 스냅 / Snap to objects",
      icon: ACTION_ICONS.toggleSnap,
      checked: state.snapToObjects,
      run: () =>
        useStore
          .getState()
          .setSnapToObjects(!useStore.getState().snapToObjects),
    },
  ];
}

export function buildCanvasContextMenuItems(
  request: ContextMenuRequest,
  options: CanvasContextMenuProviderOptions,
): ContextMenuItem[] {
  if (request.surface === "canvas-empty") {
    return buildEmptyCanvasMenuItems(request, options);
  }

  return buildElementMenuItems(request, options);
}

export function registerCanvasContextMenuProviders(
  options: CanvasContextMenuProviderOptions,
): () => void {
  const provider: ContextMenuProviderFn = (request) =>
    buildCanvasContextMenuItems(request, options);
  const unregisterElement = registerContextMenuProvider(
    "canvas-element",
    provider,
  );
  const unregisterEmpty = registerContextMenuProvider("canvas-empty", provider);
  const unregisterLayer = registerContextMenuProvider("layer-item", provider);

  return () => {
    unregisterElement();
    unregisterEmpty();
    unregisterLayer();
  };
}

export { buildElementMenuItems, buildEmptyCanvasMenuItems };
