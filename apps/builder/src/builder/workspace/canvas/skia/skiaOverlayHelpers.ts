import { parsePadding4Way } from "@composition/specs";
// ADR-912 단계5 step4 (2026-06-17): specs 정본 resolveContainerStylesFallback 은 spec-only
//   (LOWERCASE_TAG_SPEC_MAP lookup) — ListBox 등 catalog cutover spec 삭제 시 {} 반환 → padding 소실.
//   builder 버전(implicitStyles)은 spec 부재 시 LOWERCASE_COMPONENT_RULE_CONTAINER catalog rule
//   fallback 을 합성하므로 cutover 컨테이너 padding(rule.containerStyles) 정확히 복구.
import { resolveContainerStylesFallback } from "../layout/engines/implicitStyles";
import { measureWorkspacePanelInsets } from "../../utils/panelLayoutRuntime";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { isListBoxTemplateAnchor } from "../../../components/listbox/listBoxTemplateOrigins";
import {
  getEditingSlotMarkerRole,
  getEditingSemanticsRole,
  hasEditingSlotMarker,
  type EditingSemanticsRole,
} from "../../../utils/editingSemantics";
import type { BoundingBox } from "../selection/types";
import {
  DEFAULT_MINIMAP_CONFIG,
  MINIMAP_CANVAS_RATIO,
  MINIMAP_MAX_HEIGHT,
  MINIMAP_MAX_WIDTH,
  MINIMAP_MIN_HEIGHT,
  MINIMAP_MIN_WIDTH,
  type MinimapConfig,
} from "./workflowMinimap";
import type { FrameAreaGroup, WorkflowEdge } from "./workflowEdges";
import type { PageFrame } from "./workflowRenderer";

export interface HoverHighlightTarget {
  dashed: boolean;
  bounds: BoundingBox;
  semanticRole: EditingSemanticsRole | null;
  slotMarkerRole: EditingSemanticsRole | null;
}

export interface SlotMarkerTarget {
  bounds: BoundingBox;
  showHatch: boolean;
  slotMarkerRole: EditingSemanticsRole;
}

export interface PageTitleRenderItem {
  elementCount: number;
  highlighted: boolean;
  title: string;
  x: number;
  y: number;
  pageId: string;
}

export interface FrameTitleRenderItem {
  highlighted: boolean;
  title: string;
  x: number;
  y: number;
  frameId: string;
}

/**
 * 페이지 타이틀의 scene 좌표 히트 영역.
 *
 * page title 은 `canvas.translate(frame.x, frame.y)` 후 `canvas.scale(invZoom, invZoom)`
 * 안에서 screen-px 기준으로 그려지므로, scene 좌표 bounds 는 아래와 같이 변환한다:
 *
 *   sceneX = frame.x
 *   sceneY = frame.y + (textY - PAGE_TITLE_FONT_SIZE * 0.85) * invZoom
 *   sceneWidth = (titleWidth + badgeGap + badgeWidth) * invZoom
 *   sceneHeight = PAGE_TITLE_FONT_SIZE * invZoom + small padding
 *
 * drag 히트 테스트는 scene 좌표에서 수행하므로 (screenToViewportPoint 결과와 직접 비교)
 * renderer 가 매 프레임 이 맵을 clear + populate 한다.
 */
export interface PageTitleBounds {
  pageId: string;
  sceneX: number;
  sceneY: number;
  sceneWidth: number;
  sceneHeight: number;
}

export function buildHoverHighlightTargets(
  treeBoundsMap: Map<string, BoundingBox>,
  hoveredContextId: string | null,
  hoveredLeafIds: string[],
  isGroupHover: boolean,
  elementsMap: Map<string, CanvasSceneNode> = new Map(),
  pageFrames: PageFrame[] = [],
): HoverHighlightTarget[] {
  const targets: HoverHighlightTarget[] = [];

  if (hoveredContextId) {
    const contextBounds =
      treeBoundsMap.get(hoveredContextId) ??
      resolvePageBodyBounds(hoveredContextId, elementsMap, pageFrames);
    if (contextBounds) {
      targets.push({
        bounds: contextBounds,
        dashed: false,
        semanticRole: getEditingSemanticsRole(
          elementsMap.get(hoveredContextId),
        ),
        slotMarkerRole: getEditingSlotMarkerRole(
          elementsMap.get(hoveredContextId),
          elementsMap,
        ),
      });
    }
  }

  if (isGroupHover && hoveredLeafIds.length > 0) {
    for (const leafId of hoveredLeafIds) {
      const leafBounds = treeBoundsMap.get(leafId);
      if (leafBounds) {
        targets.push({
          bounds: leafBounds,
          dashed: true,
          semanticRole: getEditingSemanticsRole(elementsMap.get(leafId)),
          slotMarkerRole: getEditingSlotMarkerRole(
            elementsMap.get(leafId),
            elementsMap,
          ),
        });
      }
    }
  }

  return targets;
}

function resolvePageBodyBounds(
  elementId: string,
  elementsMap: Map<string, CanvasSceneNode>,
  pageFrames: PageFrame[],
): BoundingBox | null {
  const element = elementsMap.get(elementId);
  if (element?.type.toLowerCase() !== "body" || !element.page_id) {
    return null;
  }

  const pageFrame = pageFrames.find((frame) => frame.id === element.page_id);
  if (!pageFrame) return null;

  return {
    x: pageFrame.x,
    y: pageFrame.y,
    width: pageFrame.width,
    height: pageFrame.height,
  };
}

export function buildSlotMarkerTargets(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, CanvasSceneNode> = new Map(),
  childrenMap: Map<string, CanvasSceneNode[]> = new Map(),
): SlotMarkerTarget[] {
  const targets: SlotMarkerTarget[] = [];

  for (const [id, bounds] of treeBoundsMap) {
    const element = elementsMap.get(id);
    if (!hasEditingSlotMarker(element)) continue;
    // 빈 slot 일 때만 authoring chrome(사선 + 테두리) 을 표시한다. row child(또는 projection row)
    // 등 visible content 가 있으면 marker 자체를 생성하지 않는다.
    //   Why: 과거에는 content 가 있으면 hatch 만 숨기고(showHatch=false) 테두리는
    //   renderSlotHatchPattern 이 무조건 그려, ListBox 처럼 행이 채워진 slot 위에도
    //   border line 이 남았다(사용자 보고). 채워진 slot 은 chrome 전체를 숨긴다.
    if (hasVisibleSlotContent(id, elementsMap, childrenMap)) continue;

    const slotMarkerRole = getEditingSlotMarkerRole(element, elementsMap);
    if (!slotMarkerRole) continue;

    targets.push({
      bounds: insetBoundsByPadding(bounds, element),
      showHatch: true,
      slotMarkerRole,
    });
  }

  return targets;
}

/**
 * slot marker chrome(사선 + 테두리)을 요소의 padding 안쪽 content-box 에만
 * 그리도록 bounds 를 padding 만큼 inset 한다.
 *
 * pencil 의 빈 slot path 와 동일한 시각 패턴(사선 + 테두리 모두 안쪽으로 들여
 * 그림)이되, inset 값은 pencil 의 고정 10px 이 아니라 요소의 실제
 * padding(top/right/bottom/left).
 *
 * 실제 적용 padding = spec containerStyles fallback + 사용자 style override.
 * ListBox 등 collection 컨테이너는 padding 이 spec containerStyles
 * (예: `{spacing.xs}` = 4) 에만 정의되고 `element.props.style` 에는 없다 —
 * `element.props.style` 만 읽으면 0 으로 보여 전체에 사선이 그려진다(버그).
 * `resolveContainerStylesFallback` 은 layout(Taffy)이 컨테이너 padding 을
 * 주입할 때 쓰는 바로 그 SSOT 경로(implicitStyles 와 동일)이며, parentStyle 에
 * 이미 명시된 키는 건드리지 않으므로 사용자 padding 이 항상 우선한다.
 *
 * padding 이 0 이면 bounds 원본을 그대로 반환한다.
 * Why: longhand(paddingTop 등) 우선 + shorthand(padding) fallback 은
 *      parsePadding4Way 가 처리 — style-ssot.md store longhand 정책 정합.
 */
function insetBoundsByPadding(
  bounds: BoundingBox,
  element: CanvasSceneNode | undefined,
): BoundingBox {
  if (!element) return bounds;

  const rawStyle =
    typeof element.props === "object" && element.props !== null
      ? (element.props as { style?: unknown }).style
      : undefined;
  const userStyle: Record<string, unknown> =
    rawStyle && typeof rawStyle === "object"
      ? (rawStyle as Record<string, unknown>)
      : {};

  const type =
    typeof element.type === "string" ? element.type.toLowerCase() : "";
  const specFallback = type
    ? resolveContainerStylesFallback(type, userStyle)
    : {};

  const { top, right, bottom, left } = parsePadding4Way({
    ...specFallback,
    ...userStyle,
  });
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return bounds;

  return {
    x: bounds.x + left,
    y: bounds.y + top,
    width: Math.max(0, bounds.width - left - right),
    height: Math.max(0, bounds.height - top - bottom),
  };
}

function hasVisibleSlotContent(
  slotHostId: string,
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap: Map<string, CanvasSceneNode[]>,
): boolean {
  // ListBox template anchor 는 실제 data row 가 아니라 템플릿(rowProjectionSource)이다.
  //   빈 instance 는 itemsLen 0 이어도 항상 이 anchor child 를 가지므로, 이를 content 로
  //   카운트하면 origin(자식 0개) 과 달리 영영 "filled" 로 판정되어 hatch 가 안 나온다.
  //   → template anchor 는 content 에서 제외해 빈 instance 도 origin 처럼 사선을 표시한다.
  //   (복사-붙여넣기로 만든 ListBox 는 anchor 구조가 달라 이미 정상 표시됨 — 그 동작과 일치시킨다.)
  const renderChildren = childrenMap.get(slotHostId);
  if (
    renderChildren?.some(
      (child) => !child.deleted && !isListBoxTemplateAnchor(child),
    )
  ) {
    return true;
  }

  for (const element of elementsMap.values()) {
    if (element.parent_id !== slotHostId) continue;
    if (element.deleted) continue;
    if (isListBoxTemplateAnchor(element)) continue;
    return true;
  }

  return false;
}

export function shouldRenderWorkflowMinimap(
  showWorkflowOverlay: boolean,
  minimapVisible: boolean,
  pageFrameCount: number,
): boolean {
  return showWorkflowOverlay && minimapVisible && pageFrameCount > 0;
}

export function buildMinimapConfig(
  screenWidth: number,
  screenHeight: number,
): MinimapConfig {
  const width = Math.max(
    MINIMAP_MIN_WIDTH,
    Math.min(MINIMAP_MAX_WIDTH, Math.round(screenWidth * MINIMAP_CANVAS_RATIO)),
  );
  const height = Math.max(
    MINIMAP_MIN_HEIGHT,
    Math.min(
      MINIMAP_MAX_HEIGHT,
      Math.round(screenHeight * MINIMAP_CANVAS_RATIO),
    ),
  );
  const { right: inspectorWidth } = measureWorkspacePanelInsets();

  return {
    ...DEFAULT_MINIMAP_CONFIG,
    width,
    height,
    screenRight: inspectorWidth + DEFAULT_MINIMAP_CONFIG.screenRight,
  };
}

export function buildMinimapViewportBounds(
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
  screenWidth: number,
  screenHeight: number,
) {
  return {
    x: -cameraX / cameraZoom,
    y: -cameraY / cameraZoom,
    width: screenWidth / cameraZoom,
    height: screenHeight / cameraZoom,
  };
}

export function buildMinimapRenderData(
  pageFrames: Map<string, PageFrame>,
  edges: WorkflowEdge[],
  focusedPageId: string | null,
  viewportBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
) {
  return {
    pageFrames,
    edges,
    focusedPageId,
    viewportBounds,
  };
}

export function buildPageTitleRenderItems(
  pageFrames: PageFrame[],
  activePageId: string | null,
  hasSelection: boolean,
): PageTitleRenderItem[] {
  return pageFrames
    .filter((frame): frame is PageFrame & { title: string } =>
      Boolean(frame.title),
    )
    .map((frame) => ({
      pageId: frame.id,
      title: frame.title,
      x: frame.x,
      y: frame.y,
      elementCount: frame.elementCount ?? 0,
      highlighted: hasSelection && frame.id === activePageId,
    }));
}

export function buildFrameTitleRenderItems(
  frameAreas: FrameAreaGroup[],
  activeFrameId: string | null,
): FrameTitleRenderItem[] {
  return frameAreas
    .filter((frame): frame is FrameAreaGroup & { frameName: string } =>
      Boolean(frame.frameName),
    )
    .map((frame) => ({
      frameId: frame.frameId,
      title: frame.frameName,
      x: frame.x,
      y: frame.y,
      highlighted: frame.frameId === activeFrameId,
    }));
}

export function buildGridRenderInput(
  cullingBounds: DOMRect,
  gridSize: number,
  zoom: number,
) {
  return {
    cullingBounds,
    gridSize,
    zoom,
    showGrid: true as const,
  };
}
