import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpRight,
  ArrowUpToLine,
  ClipboardPaste,
  Component,
  Copy,
  CopyPlus,
  Group as GroupIcon,
  Magnet,
  Maximize,
  Percent,
  Ruler,
  Trash2,
  Ungroup,
  Unlink,
} from "lucide-react";
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
  getEditingSemanticsRole,
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
  alignSelection,
  copySelection,
  deleteSelection,
  duplicateSelection,
  distributeSelection,
  groupSelection,
  paste,
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

function buildAlignmentItems(
  options: CanvasContextMenuProviderOptions,
): ContextMenuItem[] {
  // 아이콘은 같은 액션을 쓰는 다중 선택 툴바(MultiSelectStatusIndicator)와
  // 동일 매핑 — 두 진입점이 다른 그림을 쓰면 같은 동작으로 안 읽힌다.
  const alignmentIcons: Record<AlignmentType, ContextMenuIcon> = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight,
    top: AlignVerticalJustifyStart,
    middle: AlignVerticalJustifyCenter,
    bottom: AlignVerticalJustifyEnd,
  };
  const distributionIcons: Record<DistributionType, ContextMenuIcon> = {
    horizontal: AlignHorizontalDistributeCenter,
    vertical: AlignVerticalDistributeCenter,
  };
  const alignmentTypes: AlignmentType[] = [
    "left",
    "center",
    "right",
    "top",
    "middle",
    "bottom",
  ];
  const distributionTypes: DistributionType[] = ["horizontal", "vertical"];
  const context = () => actionContext(options);

  return [
    ...alignmentTypes.map((type) =>
      actionItem(
        `align-${type}`,
        getAlignmentDescription(type),
        () => alignSelection(context(), type),
        undefined,
        { icon: alignmentIcons[type] },
      ),
    ),
    { kind: "separator", id: "align-distribute-separator" },
    ...distributionTypes.map((type) =>
      actionItem(
        `distribute-${type}`,
        getDistributionDescription(type),
        () => distributeSelection(context(), type),
        undefined,
        { icon: distributionIcons[type] },
      ),
    ),
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
  const nonBodyElements = selectedElements.filter(
    (element) => element.type.toLowerCase() !== "body",
  );
  const canGroupSelection =
    selectedElements.length > 0 &&
    nonBodyElements.length === selectedElements.length;
  const primaryElement = selectedElements[0];
  const isSingleSelection = selectedElements.length === 1;
  const isGroupSelection =
    isSingleSelection && isFrameOrLegacyGroup(primaryElement?.type);
  const originId = isSingleSelection
    ? getEditingSemanticsOriginId(primaryElement)
    : null;
  const originElement = originId ? elementsMap.get(originId) : undefined;
  const semanticsRole = getEditingSemanticsRole(primaryElement);
  const detachableElement = selectedElements.find((element) =>
    canDetachInstance(element),
  );
  const context = () => actionContext(options);

  const items: ContextMenuItem[] = [
    actionItem("copy", "복사 / Copy", () => copySelection(context()), "copy", {
      icon: Copy,
    }),
    actionItem(
      "paste",
      request.scenePoint ? "여기에 붙여넣기 / Paste here" : "붙여넣기 / Paste",
      () => paste({ ...context(), scenePoint: request.scenePoint }),
      "paste",
      { icon: ClipboardPaste },
    ),
    actionItem(
      "duplicate",
      "복제 / Duplicate",
      () => duplicateSelection(context()),
      "duplicate",
      { icon: CopyPlus },
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
    items.push({ kind: "separator", id: "structure-separator" });
  }

  if (canGroupSelection) {
    items.push(
      actionItem(
        "group",
        "그룹 만들기 / Group selection",
        () => groupSelection(context()),
        "group",
        { icon: GroupIcon },
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
        { icon: Ungroup },
      ),
    );
  }

  if (selectedElements.length >= 2) {
    items.push({
      kind: "submenu",
      id: "align",
      label: "정렬 / Align",
      icon: AlignCenterHorizontal,
      items: buildAlignmentItems(options),
    });
  }

  if (
    isSingleSelection &&
    primaryElement &&
    primaryElement.type.toLowerCase() !== "body"
  ) {
    items.push({ kind: "separator", id: "component-separator" });
    items.push(
      actionItem(
        "toggle-component-origin",
        semanticsRole === "origin"
          ? "컴포넌트 해제 / Remove component"
          : "컴포넌트 만들기 / Create component",
        async () => {
          await useStore.getState().toggleComponentOrigin(primaryElement.id);
        },
        "toggleComponentOrigin",
        { icon: Component },
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
          { icon: ArrowUpRight },
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
        { icon: Unlink },
      ),
    );
  }

  if (nonBodyElements.length > 0) {
    items.push({ kind: "separator", id: "delete-separator" });
    items.push(
      actionItem(
        "delete",
        "삭제 / Delete",
        () => deleteSelection(context()),
        "delete",
        // Pen 모델 — destructive 스타일 + 최하단 격리로 오클릭 완화 (ADR-182 §2)
        { icon: Trash2, destructive: true },
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
      { icon: ClipboardPaste },
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
      icon: Ruler,
      checked: state.showRulers,
      shortcutId: "toggleRulers",
      run: () =>
        useStore.getState().setShowRulers(!useStore.getState().showRulers),
    },
    {
      kind: "toggle",
      id: "snap-to-objects",
      label: "객체 스냅 / Snap to objects",
      icon: Magnet,
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
