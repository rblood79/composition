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
import { intersectBoxes, type BoundingBox } from "../selection/types";
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
import {
  readPagePositionDelta,
  type PagePositionPresentationSnapshot,
} from "../interaction/pagePositionPresentation";

export interface HoverHighlightTarget {
  dashed: boolean;
  bounds: BoundingBox;
  /** 소유 페이지 — 페인트 순서상 위 페이지에 가려지는 부분을 clip 하기 위한 키 */
  pageId: string | null;
  semanticRole: EditingSemanticsRole | null;
  slotMarkerRole: EditingSemanticsRole | null;
}

export interface SlotMarkerTarget {
  bounds: BoundingBox;
  /** 소유 페이지 — 페인트 순서상 위 페이지에 가려지는 부분을 clip 하기 위한 키 */
  pageId: string | null;
  showHatch: boolean;
  slotMarkerRole: EditingSemanticsRole;
}

export interface CollectionRemainderTarget {
  bounds: BoundingBox;
  hiddenRows: number;
  /** 소유 페이지 — 페인트 순서상 위 페이지에 가려지는 부분을 clip 하기 위한 키 */
  pageId: string | null;
}

/** ADR-181 — 한 페이지의 수동 가이드 렌더 입력 (scene 좌표) */
export interface PageGuideRenderTarget {
  pageId: string;
  /** 페이지 rect (드래그 delta 반영) — 선 길이이자 클립 영역 */
  pageRect: BoundingBox;
  /** axis "x" = x 좌표를 고정하는 세로선 (snapGuides 와 같은 어법) */
  lines: ReadonlyArray<{ id: string; axis: "x" | "y"; position: number }>;
}

/**
 * chrome 소유 페이지 판독. 페이지 간 occlusion clip(skiaOverlayBuilder
 * `withPageOcclusionClip`)의 키 — hitBoundsMap 은 **조상** clip 만 알고
 * 페이지끼리는 조상 관계가 아니라서, 아래 페이지의 콘텐츠성 chrome 이
 * 위 페이지 body 를 가로지르는 것은 여기 실린 pageId 로만 잡을 수 있다.
 */
function readOwnerPageId(element: CanvasSceneNode | undefined): string | null {
  return element?.pageId ?? element?.page_id ?? null;
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

/**
 * @param hitBoundsMap 조상 clip 교차 히트 영역. 자식 점선 가이드라인은 **프레임마다**
 *   이 맵으로 판정한다 — 잘려서 화면에 없는 리프는 건너뛰고, 부분 가시 리프는 보이는
 *   구간에만 그린다. `hoveredLeafIds` 는 구조적 리스트라 스크롤로 갱신되지 않으므로,
 *   가시성 필터를 hover state 에 캐시하면 최초 가시 집합이 고착된다 (2026-07-24).
 *   미전달 시 `treeBoundsMap` 폴백 (clip 미추적 경로).
 */
export function buildHoverHighlightTargets(
  treeBoundsMap: Map<string, BoundingBox>,
  hoveredContextId: string | null,
  hoveredLeafIds: string[],
  isGroupHover: boolean,
  elementsMap: Map<string, CanvasSceneNode> = new Map(),
  pageFrames: PageFrame[] = [],
  hitBoundsMap: Map<string, BoundingBox> = treeBoundsMap,
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): HoverHighlightTarget[] {
  const targets: HoverHighlightTarget[] = [];

  if (hoveredContextId) {
    // 실선 context 아웃라인도 **가시 영역** 기준이다. 원본 박스를 쓰면 호버한 채로
    // 스크롤해 컨테이너가 프레임 밖으로 밀렸을 때 아웃라인만 캔버스 배경에 남는다
    // (2026-07-24 사용자 보고). 전부 잘리면 아웃라인 자체를 그리지 않는다.
    //   body 는 조상이 없어 clip 대상이 아니고, page body 는 두 맵 모두에 없을 수
    //   있어 `resolvePageBodyBounds` 폴백(프레임 경계)이 그대로 유지된다.
    const contextBounds =
      hitBoundsMap.get(hoveredContextId) ??
      resolvePageBodyBounds(
        hoveredContextId,
        elementsMap,
        pageFrames,
        pagePositionSnapshot,
      );
    if (contextBounds) {
      targets.push({
        bounds: contextBounds,
        dashed: false,
        pageId: readOwnerPageId(elementsMap.get(hoveredContextId)),
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
      const leafBounds = hitBoundsMap.get(leafId);
      if (leafBounds) {
        targets.push({
          bounds: leafBounds,
          dashed: true,
          pageId: readOwnerPageId(elementsMap.get(leafId)),
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
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): BoundingBox | null {
  const element = elementsMap.get(elementId);
  if (element?.type.toLowerCase() !== "body" || !element.page_id) {
    return null;
  }

  const pageFrame = pageFrames.find((frame) => frame.id === element.page_id);
  if (!pageFrame) return null;

  const delta = pagePositionSnapshot
    ? readPagePositionDelta(pageFrame.id, pagePositionSnapshot)
    : null;

  return {
    x: pageFrame.x + (delta?.dx ?? 0),
    y: pageFrame.y + (delta?.dy ?? 0),
    width: pageFrame.width,
    height: pageFrame.height,
  };
}

/**
 * slot / remainder chrome 은 "내용이 놓일 자리" 를 나타내는 **콘텐츠성** 오버레이다.
 * 따라서 선택 박스처럼 원본 박스를 쓰면 안 되고, 조상 clip 을 반영한 가시 영역
 * (`hitBoundsMap`)으로 잘라야 한다.
 *
 * **Why (2026-07-24 실측)**: 오버레이 패스는 씬의 clip save/restore **밖**에서 돌고
 * `renderSlotHatchPattern` 은 자기 bounds 로만 clipRect 를 건다. 그래서 원본 박스를
 * 넘기면 조상(page body `overflow:auto` 390x844 등)의 클립을 전혀 받지 않아, body 를
 * 스크롤해 프레임 밖으로 나간 ListBox/GridList 의 해치가 캔버스 배경 위에 그대로
 * 그려졌다(프레임 상단 경계 위로 66px 노출). 같은 요소의 히트 영역은 §8.5 로 이미
 * 클립돼 있어 "보이는데 클릭은 안 되는" 비대칭이 됐다.
 *
 * 전부 잘린 요소는 `hitBoundsMap` 에 미등재 → chrome 자체를 생성하지 않는다.
 */
function clipChromeBounds(
  bounds: BoundingBox,
  id: string,
  hitBoundsMap: Map<string, BoundingBox>,
): BoundingBox | null {
  const visible = hitBoundsMap.get(id);
  if (!visible) return null;
  return intersectBoxes(bounds, visible);
}

/**
 * 페이지 드래그 중 transient 위치(presentation snapshot)를 chrome bounds 에 반영한다.
 *
 * boundsMap/hitBoundsMap 은 스트림 빌드 시점의 canonical pagePositions 기준이라
 * 드래그 중에는 stale 하다. content 패스(executeRenderCommands)와 selection overlay
 * 는 렌더 시점에 delta 를 더해 함께 움직이므로, 콘텐츠성 chrome 도 동일 delta 를
 * 받아야 한다 — 미적용 시 슬롯 해치/테두리가 드래그 중 제자리에 남고 드롭 후에만
 * 한 번에 이동한다 (2026-08-11 사용자 보고).
 *
 * inset/클립 산출은 canonical 좌표계 안에서 끝낸 뒤 **최종 결과만** 평행이동한다 —
 * 조상 clip(페이지 body)도 같은 delta 로 움직이므로 클립 수식을 섞을 필요가 없다.
 */
function translateByPageDelta(
  bounds: BoundingBox,
  element: CanvasSceneNode | undefined,
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): BoundingBox {
  if (!pagePositionSnapshot || !element) return bounds;
  const pageId = element.pageId ?? element.page_id;
  const delta = pageId
    ? readPagePositionDelta(pageId, pagePositionSnapshot)
    : null;
  if (!delta) return bounds;
  return {
    x: bounds.x + delta.dx,
    y: bounds.y + delta.dy,
    width: bounds.width,
    height: bounds.height,
  };
}

/**
 * 수동 가이드 렌더 타깃 — ADR-181 Phase 4.
 *
 * 가이드 position 은 **페이지-로컬 px** 이므로 페이지 위치를 더해 scene 으로
 * 옮긴다. 드래그 중 페이지의 transient delta 도 함께 반영해야 본문과 같이
 * 움직인다 (슬롯 마커·collection remainder 와 같은 계약 — 미반영 시 드롭
 * 후에야 한 번에 따라온다).
 *
 * 가이드가 없는 페이지는 타깃을 만들지 않는다. 문서에 `pageGuides` 자체가
 * 없는 것이 통상이므로 호출부에서 빈 map 이면 아예 부르지 않는 것이 맞다.
 */
export function buildPageGuideTargets(
  guidesByPage: ReadonlyMap<
    string,
    readonly { id: string; axis: "x" | "y"; position: number }[]
  >,
  frames: ReadonlyArray<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): PageGuideRenderTarget[] {
  if (guidesByPage.size === 0) return [];

  const targets: PageGuideRenderTarget[] = [];
  for (const frame of frames) {
    const guides = guidesByPage.get(frame.id);
    if (!guides || guides.length === 0) continue;
    const delta = pagePositionSnapshot
      ? readPagePositionDelta(frame.id, pagePositionSnapshot)
      : null;
    const originX = frame.x + (delta?.dx ?? 0);
    const originY = frame.y + (delta?.dy ?? 0);
    targets.push({
      pageId: frame.id,
      pageRect: {
        x: originX,
        y: originY,
        width: frame.width,
        height: frame.height,
      },
      lines: guides.map((guide) => ({
        id: guide.id,
        axis: guide.axis,
        position:
          guide.axis === "x"
            ? originX + guide.position
            : originY + guide.position,
      })),
    });
  }
  return targets;
}

export function buildSlotMarkerTargets(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, CanvasSceneNode> = new Map(),
  childrenMap: Map<string, CanvasSceneNode[]> = new Map(),
  hitBoundsMap: Map<string, BoundingBox> = treeBoundsMap,
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
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

    // padding inset 은 **원본 박스** 기준(요소 박스에 상대적)이고, 가시 영역 클립은
    // 그 다음이다. 순서를 바꾸면 잘린 요소의 inset 이 잘린 박스 기준이 돼 어긋난다.
    const chromeBounds = clipChromeBounds(
      insetBoundsByPadding(bounds, element),
      id,
      hitBoundsMap,
    );
    if (!chromeBounds) continue;

    targets.push({
      bounds: translateByPageDelta(chromeBounds, element, pagePositionSnapshot),
      pageId: readOwnerPageId(element),
      showHatch: true,
      slotMarkerRole,
    });
  }

  return targets;
}

/**
 * ADR-157: data-bound collection 샘플 나머지(hatch placeholder) 노드의 overlay 대상 산출.
 * `projection.kind === "collection-remainder"` 인 render-space Box 를 treeBoundsMap 에서 찾아
 * 절대 bounds + hiddenRows(라벨용)를 수집한다. slot marker 와 달리 소유 collection 안에 이미
 * 채워진 layout Box 이므로 padding inset 없이 bounds 원본을 쓴다(rowsGroup 안 sample 행 바로 아래).
 */
export function buildCollectionRemainderTargets(
  treeBoundsMap: Map<string, BoundingBox>,
  elementsMap: Map<string, CanvasSceneNode> = new Map(),
  hitBoundsMap: Map<string, BoundingBox> = treeBoundsMap,
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): CollectionRemainderTarget[] {
  const targets: CollectionRemainderTarget[] = [];

  for (const [id, bounds] of treeBoundsMap) {
    const element = elementsMap.get(id);
    const projection = element?.projection;
    if (projection?.kind !== "collection-remainder") continue;
    const chromeBounds = clipChromeBounds(bounds, id, hitBoundsMap);
    if (!chromeBounds) continue;
    targets.push({
      bounds: translateByPageDelta(chromeBounds, element, pagePositionSnapshot),
      hiddenRows: projection.hiddenRows,
      pageId: readOwnerPageId(element),
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

/**
 * 지금 화면에 보이는 영역의 scene rect.
 *
 * 미니맵의 뷰포트 사각형과 가이드 드래그 미리보기 선(ADR-181)이 같은 값을
 * 쓴다 — "보이는 범위" 라는 한 개념이라 두 벌로 두지 않는다.
 */
export function buildViewportSceneRect(
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
  pagePositionSnapshot?: PagePositionPresentationSnapshot,
): PageTitleRenderItem[] {
  return pageFrames
    .filter((frame): frame is PageFrame & { title: string } =>
      Boolean(frame.title),
    )
    .map((frame) => {
      const delta = pagePositionSnapshot
        ? readPagePositionDelta(frame.id, pagePositionSnapshot)
        : null;
      return {
        pageId: frame.id,
        title: frame.title,
        x: frame.x + (delta?.dx ?? 0),
        y: frame.y + (delta?.dy ?? 0),
        elementCount: frame.elementCount ?? 0,
        highlighted: hasSelection && frame.id === activePageId,
      };
    });
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
