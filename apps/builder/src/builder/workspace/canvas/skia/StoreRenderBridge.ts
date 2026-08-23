/**
 * StoreRenderBridge (ADR-100 Phase 6.2 + 증분 갱신)
 *
 * Zustand store 변경을 감지하여 skiaNodeRegistry를 직접 채운다.
 * 개별 React renderer 호출 대신 store 데이터를 Skia node로 변환한다.
 *
 * 증분 갱신: prevElementsMap 참조 비교로 변경된 요소만 rebuild.
 * Zustand immutable update 패턴 덕분에 변경된 요소만 새 참조를 가짐.
 *
 * 사용법:
 *   const bridge = new StoreRenderBridge();
 *   bridge.connect(store);  // store subscribe 시작
 *   bridge.dispose();       // cleanup
 */

import type { CanvasLayoutNode } from "../layout/layoutNode";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { BoundingBox } from "../selection/types";
import {
  getComponentMasterReference as getInstanceMasterRef,
  isComponentInstanceMirrorElement as isInstanceElement,
} from "../../../../adapters/canonical/componentSemanticsMirror";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type {
  SkiaNodeData,
  SkiaPresentationFillTarget,
} from "./nodeRendererTypes";
import { buildSkiaNodeData, type BuildContext } from "./buildSkiaNodeData";
import { buildBoxNodeData } from "./buildBoxNodeData";
import { buildImageNodeData } from "./buildImageNodeData";
import {
  buildSpecNodeData,
  SYNTHETIC_CHILD_PROP_MERGE_TAGS,
} from "./buildSpecNodeData";
import {
  getSkiaNode,
  registerSkiaNode,
  unregisterSkiaNode,
} from "./useSkiaNode";
import { useScrollState } from "../../../stores/scrollState";
import { useStore } from "../../../stores";
import { useThemeConfigStore } from "../../../../stores/themeConfigStore";
import { resolveResponsiveLayoutNode } from "../layout/resolveResponsive";
import { getSkImage, loadSkImage, releaseSkImage } from "./imageCache";
import { getSpecForTag, IMAGE_TAGS } from "../styleConversion/tagSpecMap";
import { onLayoutPublished } from "../layout";
import { getSyntheticElementsMap } from "../layout/engines/fullTreeLayout";
import type { TransitionManager } from "./transitionManager";
import { ANIMATABLE_NUMERIC_PROPERTIES } from "./interpolators";
import type { CanonicalNode } from "@composition/shared";
import { isCatalogCutover } from "@composition/shared";
import { parsePxValue } from "@composition/specs";
import { resolveInstanceWithSharedCache } from "@/resolvers/canonical/storeBridge";
import { resolveCanonicalRefElement } from "../../../utils/canonicalRefResolution";
import {
  recordEditorPresentationBridgeFullRebuild,
  recordEditorPresentationTargetIncrementalPatches,
} from "../../../performance/editorPresentationPhase0Metrics";
import { FillType, type FillItem } from "../../../../types/builder/fill.types";
import {
  fillsToSkiaFillColor,
  fillsToSkiaFillStyle,
} from "../../../panels/styles/utils/fillToSkia";
import {
  invalidateNodePicture,
  setPresentationVolatileNodeIds,
} from "./nodePictureCache";
import {
  buildSubtreeCommandStream,
  getCachedCommandStreamSnapshot,
  recordCommitLanePatchFallback,
  recordCommitLanePatchDamage,
  recordCommitLanePatchSuccess,
  recordCommitLaneQueue,
  recordCommitLanePromotedSyncSkip,
  recordCommitLaneSync,
} from "./renderCommands";
import { applyCommitSubtreeCommandPatch } from "./subtreeCommandPatch";
import { createCommitPatchPlan } from "../../../presentation/commitPatchPlan";
import type { EditorMutationDescriptor } from "../../../presentation/editorPresentationTypes";

function presentationColorEquals(
  target: SkiaPresentationFillTarget,
  canonicalColor: Float32Array,
): boolean {
  return (
    target.color.length === canonicalColor.length &&
    target.color[0] === canonicalColor[0] &&
    target.color[1] === canonicalColor[1] &&
    target.color[2] === canonicalColor[2] &&
    target.color[3] ===
      Math.fround(canonicalColor[3] * target.opacityMultiplier)
  );
}

function setPresentationColor(
  target: SkiaPresentationFillTarget,
  canonicalColor: Float32Array,
): void {
  target.color[0] = canonicalColor[0];
  target.color[1] = canonicalColor[1];
  target.color[2] = canonicalColor[2];
  target.color[3] = canonicalColor[3] * target.opacityMultiplier;
}

function haveSamePresentationColorSlots(
  left: readonly SkiaPresentationFillTarget[],
  right: readonly SkiaPresentationFillTarget[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (target, index) =>
        target.color === right[index]?.color &&
        target.opacityMultiplier === right[index]?.opacityMultiplier &&
        target.fillId === right[index]?.fillId &&
        target.gradientWidth === right[index]?.gradientWidth &&
        target.gradientHeight === right[index]?.gradientHeight &&
        target.gradientColors === right[index]?.gradientColors &&
        target.gradientPositions === right[index]?.gradientPositions,
    )
  );
}

function isMutableGradientFill(fill: FillItem | undefined): fill is Extract<
  FillItem,
  {
    type:
      | FillType.LinearGradient
      | FillType.RadialGradient
      | FillType.AngularGradient;
  }
> {
  return (
    fill?.type === FillType.LinearGradient ||
    fill?.type === FillType.RadialGradient ||
    fill?.type === FillType.AngularGradient
  );
}

function isImageElement(element: CanvasSceneNode): boolean {
  return IMAGE_TAGS.has(element.type);
}

function toSyntheticSceneNode(element: CanvasLayoutNode): CanvasSceneNode {
  const parentId = element.parentId ?? element.parent_id ?? null;
  const pageId = element.pageId ?? element.page_id ?? null;
  const layoutId = element.layoutId ?? null;
  const nameCandidate = element.name ?? element.componentName;
  const name = typeof nameCandidate === "string" ? nameCandidate : undefined;
  const slot =
    element.slot === false || Array.isArray(element.slot)
      ? element.slot
      : undefined;
  const sourceNode: CanonicalNode = {
    id: element.id,
    type: element.type as CanonicalNode["type"],
    props: element.props,
  };
  if (name !== undefined) sourceNode.name = name;
  if (element.reusable === true) sourceNode.reusable = true;
  if (slot !== undefined) sourceNode.slot = slot;

  const sceneNode: CanvasSceneNode = {
    id: element.id,
    type: element.type,
    props: element.props,
    parentId,
    pageId,
    layoutId,
    parent_id: parentId,
    page_id: pageId,
    sourceNode,
  };
  if (typeof element.customId === "string")
    sceneNode.customId = element.customId;
  if (typeof element.componentName === "string") {
    sceneNode.componentName = element.componentName;
  }
  if (name !== undefined) sceneNode.name = name;
  if (element.deleted !== undefined) sceneNode.deleted = element.deleted;
  if (element.reusable === true) sceneNode.reusable = true;
  if (slot !== undefined) sceneNode.slot = slot;
  return sceneNode;
}

const EMPTY_LAYOUT_MAP = new Map<string, ComputedLayout>();

/**
 * 루트 x/y(요소 위치)를 제외한 SkiaNodeData 동등성.
 *
 * 이동/드래그는 위치만 바꾸므로 노드 identity 를 보존해야 노드 Picture 캐시의
 * 위치-불변 키(r1 M1)가 실효한다. children 내부 x/y 는 spec shape 상대 좌표
 * (self-draw 내용)라 비교에 포함된다.
 */
function skiaNodeContentEqualsIgnoringPosition(
  a: SkiaNodeData,
  b: SkiaNodeData,
): boolean {
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  const keysA = Object.keys(ra);
  // x/y 는 SkiaNodeData 필수 필드라 양쪽 다 존재 — 개수 보정 없이 비교에서만 제외
  if (keysA.length !== Object.keys(rb).length) return false;
  for (const k of keysA) {
    if (k === "x" || k === "y") continue;
    if (!skiaNodeContentEquals(ra[k], rb[k])) return false;
  }
  return true;
}

/**
 * SkiaNodeData 구조 동등성 (ADR-153 Phase 3 — registerBuiltNode 전용).
 *
 * plain object / 배열 / TypedArray 만 구조 비교하고, 그 외 객체(SkImage 등
 * WASM 핸들)는 identity 비교. false negative(내용 같은데 불일치 판정)는
 * 재기록 1회 낭비일 뿐이라 안전 방향이다 — stale 위험이 없다.
 */
function skiaNodeContentEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const protoA = Object.getPrototypeOf(a);
  if (protoA !== Object.getPrototypeOf(b)) return false;
  if (ArrayBuffer.isView(a)) {
    const ta = a as unknown as ArrayLike<number>;
    const tb = b as unknown as ArrayLike<number>;
    if (ta.length !== tb.length) return false;
    for (let i = 0; i < ta.length; i++) {
      if (ta[i] !== tb[i]) return false;
    }
    return true;
  }
  if (Array.isArray(a)) {
    const ba = b as unknown[];
    if (a.length !== ba.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!skiaNodeContentEquals(a[i], ba[i])) return false;
    }
    return true;
  }
  // class instance (WASM 핸들 등) 는 identity 만 신뢰
  if (protoA !== Object.prototype && protoA !== null) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keysA = Object.keys(ra);
  if (keysA.length !== Object.keys(rb).length) return false;
  for (const k of keysA) {
    if (!skiaNodeContentEquals(ra[k], rb[k])) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// CSS Transition 헬퍼
// ---------------------------------------------------------------------------

interface TransitionDef {
  property: string;
  duration: number; // ms
  easing: string;
}

export function parseTransitionShorthand(value: string): TransitionDef[] {
  if (!value || value === "none") return [];
  return value.split(",").map((part) => {
    const tokens = part.trim().split(/\s+/);
    const property = tokens[0] ?? "all";
    const durationStr = tokens[1] ?? "0s";
    let duration = parseFloat(durationStr);
    if (!durationStr.endsWith("ms") && durationStr.endsWith("s")) {
      duration *= 1000;
    }
    const easing = tokens[2] ?? "ease";
    return { property, duration, easing };
  });
}

/**
 * Spec 경로 사용 여부: TAG_SPEC_MAP 등록 여부 OR catalog Skia cutover.
 * ADR-058 Phase 4: `buildTextNodeData` 완전 폐지로 TEXT_TAGS 분기 로직 제거.
 * 모든 text 컴포넌트가 spec 경로(`buildSpecNodeData`)로 통일됨.
 *
 * ADR-912 단계 5 step 4 (TEXT_LEAF spec 삭제 후속, 2026-06-09): spec 파일이 삭제된
 *   catalog cutover type(Text/Heading/Paragraph/Code/Kbd)은 `getSpecForTag → null` 이지만
 *   generic 경로(buildCatalogShapesOrPrimitive)로 그릴 수 있으므로 spec 경로로 보낸다.
 *   **Why**: 이 게이트가 spec 등록 여부만 보면 spec 삭제된 catalog type 이 spec 경로 진입
 *   자체를 못 해(buildSpecNodeData 호출 누락) Skia 노드 미생성 → 텍스트 미표시.
 */
function isSpecPath(element: CanvasSceneNode): boolean {
  return !!getSpecForTag(element.type) || isCatalogCutover(element.type);
}

// ---------------------------------------------------------------------------
// StoreRenderBridge
// ---------------------------------------------------------------------------

export interface StoreRenderSyncResult {
  readonly commandStreamPatched: boolean;
  readonly commandStreamInvalidated: boolean;
  /** 성공한 subtree patch의 이전/이후 hit bounds 합집합. */
  readonly damageBounds?: BoundingBox;
  /** patch를 발생시킨 canonical document revision. */
  readonly damageRevision?: number;
}

interface PendingCommitPatchResult {
  readonly applied: boolean;
  readonly damageBounds?: BoundingBox;
  readonly revision?: number;
}

function unionDamageBounds(
  current: BoundingBox | undefined,
  next: BoundingBox | undefined,
): BoundingBox | undefined {
  if (!current) return next;
  if (!next) return current;
  const left = Math.min(current.x, next.x);
  const top = Math.min(current.y, next.y);
  const right = Math.max(current.x + current.width, next.x + next.width);
  const bottom = Math.max(current.y + current.height, next.y + next.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export class StoreRenderBridge {
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLayout: (() => void) | null = null;
  private unsubscribeScroll: (() => void) | null = null;
  private registeredIds = new Set<string>();
  /** 이미지 src → element id 매핑 (라이프사이클 관리) */
  private loadedImageSrcs = new Map<string, string>();
  /** 비동기 이미지 로딩 후 재동기화용 콜백 */
  private pendingResync: (() => void) | null = null;
  /** 이전 elementsMap 참조 (증분 갱신용) */
  private prevElementsMap: Map<string, CanvasSceneNode> | null = null;
  private prevProjectionVersion: number | null = null;
  private lastObservedCanonicalRevision: number | null = null;
  /** 이전 theme (변경 감지 → fullRebuild 강제) */
  private prevTheme: "light" | "dark" = "light";
  /**
   * no-op 가드 입력 스냅샷 (ADR-153 Phase 3) — 전부 동일하면 rebuild 생략.
   *
   * **보수 의무**: `buildSkiaNodeFromElement` 가 읽는 전역 입력이 늘어나면 이
   * 목록도 같이 늘려야 한다. 빠뜨리면 그 입력만 바뀐 편집이 조용히 무시되고
   * (다음 팬/줌 전까지 화면에 안 나타남) 증상이 다른 결함처럼 보인다 —
   * layoutVersion 5-심볼 체인 / sceneVersion signature 와 동급 보수 대상.
   */
  private prevSyncInputs: {
    layoutMap: Map<string, ComputedLayout> | null;
    scrollMap: unknown;
    syntheticMap: unknown;
    breakpoint: unknown;
    themeVersion: number;
  } | null = null;
  /** ref 비교 밖 입력 변경 (bridge 자체 이미지 로드 등) — 다음 sync 가드 1회 해제 */
  private externalDirty = false;
  /** ADR-187: presentation 종료 시 exact restore할 draw color slot snapshot. */
  private presentationBaseById = new Map<
    string,
    {
      readonly colors: readonly Float32Array[];
      readonly gradientColors: readonly (readonly Float32Array[] | undefined)[];
      readonly gradientPositions: readonly (readonly number[] | undefined)[];
      readonly targets: readonly SkiaPresentationFillTarget[];
    }
  >();
  private presentationNodeIds = new Set<string>();
  /** canonical commit descriptor — 다음 rendererInput sync에서만 소비한다. */
  private pendingCommit: {
    readonly mutations: readonly EditorMutationDescriptor[];
    readonly revision: number;
    readonly queuedCanonicalRevision: number | null;
    layoutWaited: boolean;
  } | null = null;
  /** patch 직후 layout publish가 한 번 더 들어와도 promoted stream을 보존한다. */
  private lastPatchedCanonicalRevision: number | null = null;
  /** CSS transition 애니메이션 매니저 (선택 연결) */
  public transitionManager: TransitionManager | null = null;

  /**
   * ADR-187 paint lane: registry/command-stream/layout identity를 바꾸지 않고
   * 기존 draw color slot만 교체한다. canonical sync entrypoint는 호출하지 않는다.
   */
  applyPresentationFillPatch(
    elementId: string,
    fills: readonly FillItem[],
  ): boolean {
    const node = getSkiaNode(elementId);
    const targets = node?.presentationFillTargets;
    if (!node || !targets || targets.length === 0) return false;

    const nextFillColor = fillsToSkiaFillColor([...fills]);
    let changed = false;
    for (const target of targets) {
      if (nextFillColor && !presentationColorEquals(target, nextFillColor)) {
        changed = true;
      }

      if (!target.gradientColors || !target.fillId) continue;
      const nextFill = fills.find((fill) => fill.id === target.fillId);
      if (!isMutableGradientFill(nextFill)) continue;
      const nextStyle = fillsToSkiaFillStyle(
        [nextFill],
        target.gradientWidth ?? node.width,
        target.gradientHeight ?? node.height,
      );
      if (
        !nextStyle ||
        !(
          nextStyle.type === "linear-gradient" ||
          nextStyle.type === "radial-gradient" ||
          nextStyle.type === "angular-gradient"
        ) ||
        target.gradientColors.length !== nextStyle.colors.length ||
        (target.gradientPositions?.length ?? 0) !== nextStyle.positions.length
      ) {
        continue;
      }
      if (
        target.gradientColors.some((color, index) =>
          color.some(
            (channel, channelIndex) =>
              !Object.is(channel, nextStyle.colors[index]?.[channelIndex]),
          ),
        ) ||
        target.gradientPositions?.some(
          (position, index) => !Object.is(position, nextStyle.positions[index]),
        )
      ) {
        changed = true;
      }
    }
    if (!changed) return false;

    const existingBase = this.presentationBaseById.get(elementId);
    if (
      !existingBase ||
      !haveSamePresentationColorSlots(existingBase.targets, targets)
    ) {
      this.presentationBaseById.set(elementId, {
        colors: targets.map((target) => Float32Array.from(target.color)),
        gradientColors: targets.map((target) =>
          target.gradientColors?.map((color) => Float32Array.from(color)),
        ),
        gradientPositions: targets.map((target) =>
          target.gradientPositions ? [...target.gradientPositions] : undefined,
        ),
        targets,
      });
    }
    for (const target of targets) {
      if (nextFillColor) setPresentationColor(target, nextFillColor);
      if (!target.gradientColors || !target.fillId) continue;
      const nextFill = fills.find((fill) => fill.id === target.fillId);
      if (!isMutableGradientFill(nextFill)) continue;
      const nextStyle = fillsToSkiaFillStyle(
        [nextFill],
        target.gradientWidth ?? node.width,
        target.gradientHeight ?? node.height,
      );
      if (
        !nextStyle ||
        !(
          nextStyle.type === "linear-gradient" ||
          nextStyle.type === "radial-gradient" ||
          nextStyle.type === "angular-gradient"
        ) ||
        target.gradientColors.length !== nextStyle.colors.length
      ) {
        continue;
      }
      target.gradientColors.forEach((color, index) =>
        color.set(nextStyle.colors[index]!),
      );
      if (
        target.gradientPositions &&
        target.gradientPositions.length === nextStyle.positions.length
      ) {
        target.gradientPositions.splice(
          0,
          target.gradientPositions.length,
          ...nextStyle.positions,
        );
      }
    }
    invalidateNodePicture(elementId);
    this.presentationNodeIds.add(elementId);
    setPresentationVolatileNodeIds(this.presentationNodeIds);
    return true;
  }

  /** terminal/canonical handoff 전에 presentation draw data를 exact 복원한다. */
  restorePresentationFillPatch(elementId: string): boolean {
    const base = this.presentationBaseById.get(elementId);
    if (!base) return false;

    const node = getSkiaNode(elementId);
    const targets = node?.presentationFillTargets;
    const canRestore =
      targets !== undefined &&
      haveSamePresentationColorSlots(base.targets, targets);
    if (canRestore) {
      targets.forEach((target, index) => {
        target.color.set(base.colors[index]!);
        const gradientColors = base.gradientColors[index];
        if (gradientColors && target.gradientColors) {
          target.gradientColors.forEach((color, colorIndex) => {
            const snapshot = gradientColors[colorIndex];
            if (snapshot) color.set(snapshot);
          });
        }
        const gradientPositions = base.gradientPositions[index];
        if (gradientPositions && target.gradientPositions) {
          target.gradientPositions.splice(
            0,
            target.gradientPositions.length,
            ...gradientPositions,
          );
        }
      });
      invalidateNodePicture(elementId);
    }
    this.presentationBaseById.delete(elementId);
    this.presentationNodeIds.delete(elementId);
    setPresentationVolatileNodeIds(this.presentationNodeIds);
    return canRestore;
  }

  /** canonical renderer input이 도착한 뒤 base 복원 없이 overlay ownership만 해제한다. */
  releasePresentationFillPatch(elementId: string): boolean {
    if (!this.presentationBaseById.delete(elementId)) return false;
    this.presentationNodeIds.delete(elementId);
    setPresentationVolatileNodeIds(this.presentationNodeIds);
    return true;
  }

  restoreAllPresentationFillPatches(): number {
    let restored = 0;
    for (const elementId of [...this.presentationBaseById.keys()]) {
      if (this.restorePresentationFillPatch(elementId)) restored += 1;
    }
    return restored;
  }

  /**
   * canonical terminal event를 queue한다. canonical store와 rendererInput은
   * 서로 다른 React/effect 경계를 가지므로 여기서 즉시 stream을 만들지 않고,
   * post-commit elements/layout map이 도착한 다음 sync에서 원자적으로 소비한다.
   */
  queueCommitPatch(
    mutations: readonly EditorMutationDescriptor[],
    revision: number,
  ): void {
    if (
      mutations.length === 0 ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    ) {
      return;
    }
    this.pendingCommit = {
      mutations: [...mutations],
      revision,
      queuedCanonicalRevision: this.lastObservedCanonicalRevision,
      layoutWaited: false,
    };
    recordCommitLaneQueue();
  }

  /**
   * Store에 연결하여 elementsMap 변경 시 skiaNodeRegistry를 갱신.
   */
  connect(options: {
    getElements: () => Map<string, CanvasSceneNode>;
    getLayoutMap: () => Map<string, ComputedLayout> | null;
    getChildrenMap?: () => Map<string, CanvasSceneNode[]>;
    getProjectionVersion: () => number;
    getCanonicalRevision?: () => number;
    subscribe: (callback: () => void) => () => void;
    getTheme?: () => "light" | "dark";
    onDidSync?: (result: StoreRenderSyncResult) => void;
    theme?: "light" | "dark";
  }): void {
    this.dispose();

    const {
      getElements,
      getLayoutMap,
      getChildrenMap,
      getProjectionVersion,
      getCanonicalRevision,
      subscribe,
      getTheme,
      onDidSync,
      theme = "light",
    } = options;

    const resolveTheme = getTheme ?? (() => theme);

    const resync = (forceFullRebuild = false) => {
      const result = this.sync(
        getElements(),
        getLayoutMap(),
        resolveTheme(),
        getChildrenMap?.() ?? null,
        getProjectionVersion(),
        forceFullRebuild,
        getCanonicalRevision?.(),
      );
      onDidSync?.(result);
    };
    this.pendingResync = () => resync(true);

    // 초기 동기화 (전체 rebuild)
    resync(true);

    // 변경 구독: Zustand store + layout publish
    this.unsubscribe = subscribe(() => resync(false));
    this.unsubscribeLayout = onLayoutPublished(() => resync(true));

    // 스크롤 구독: wheel(scrollBy)로 scrollTop/scrollLeft 가 바뀌면 해당 요소만 재빌드한다.
    //   메인 store subscribe 는 별도 store(useScrollState) 변경에 반응하지 않으므로 필요.
    //   재빌드된 노드가 fresh scrollOffset 을 담고, registerSkiaNode 가 registryVersion 을
    //   올려 다음 프레임에서 command stream 이 갱신된다 — hit-test bounds(hitBoundsMap)도
    //   같은 재빌드가 재생성하므로 렌더↔인터랙션 split-brain 없음. maxScroll(콘텐츠 크기) 변경은 layout
    //   publish(onLayoutPublished→fullRebuild)가 커버하므로 여기서는 위치 변경만 감지한다.
    let prevScrollMap = useScrollState.getState().scrollMap;
    this.unsubscribeScroll = useScrollState.subscribe((state) => {
      const nextScrollMap = state.scrollMap;
      if (nextScrollMap === prevScrollMap) return;
      const changed = new Set<string>();
      for (const [sid, s] of nextScrollMap) {
        const p = prevScrollMap.get(sid);
        if (
          !p ||
          p.scrollTop !== s.scrollTop ||
          p.scrollLeft !== s.scrollLeft
        ) {
          changed.add(sid);
        }
      }
      prevScrollMap = nextScrollMap;
      if (changed.size === 0) return;
      this.incrementalSync(
        changed,
        getElements(),
        getLayoutMap(),
        resolveTheme(),
        getChildrenMap?.() ?? null,
      );
      onDidSync?.({
        commandStreamPatched: false,
        commandStreamInvalidated: true,
      });
    });
  }

  /**
   * 동기화: 증분 갱신 또는 전체 rebuild 자동 선택.
   */
  sync(
    elementsMap: Map<string, CanvasSceneNode>,
    layoutMap: Map<string, ComputedLayout> | null,
    theme: "light" | "dark",
    childrenMap: Map<string, CanvasSceneNode[]> | null = null,
    projectionVersion: number,
    forceFullRebuild = false,
    canonicalRevision?: number,
  ): StoreRenderSyncResult {
    recordCommitLaneSync(this.pendingCommit !== null);
    if (canonicalRevision !== undefined) {
      this.lastObservedCanonicalRevision = canonicalRevision;
    }
    // theme 변경 시 전체 rebuild 강제 (모든 Spec 색상 재계산 필요)
    const themeChanged = theme !== this.prevTheme;
    this.prevTheme = theme;
    const projectionChanged =
      this.prevProjectionVersion !== null &&
      this.prevProjectionVersion !== projectionVersion;

    // ADR-153 Phase 3: 렌더 입력 무변경 no-op 가드.
    // rendererInput effect / store 구독은 카메라 이동(줌/팬)·선택 변경 같은
    // 프레임 노이즈에도 발화하지만, node 빌드가 읽는 입력(요소/레이아웃/테마
    // 토큰/브레이크포인트/스크롤/synthetic)이 전부 동일하면 rebuild 는 내용
    // 동일한 새 객체만 만든다 — 노드 identity 를 흔들어 노드 Picture 캐시를
    // 전량 무효화하는 순수 낭비이므로 건너뛴다. (레이아웃/synthetic 맵은
    // 버전 캐시 기반이라 ref 비교 = 버전 비교, 이미지 로드는 invalidateLayout
    // 경유 새 layoutMap ref 또는 externalDirty 로 가드를 해제한다.)
    const scrollMapRef = useScrollState.getState().scrollMap;
    const syntheticMapRef = getSyntheticElementsMap();
    const breakpoint = useStore.getState().activeBreakpoint;
    const themeVersion = useThemeConfigStore.getState().themeVersion;
    const prevInputs = this.prevSyncInputs;
    if (
      this.pendingCommit === null &&
      !this.externalDirty &&
      !themeChanged &&
      !projectionChanged &&
      this.prevElementsMap === elementsMap &&
      prevInputs !== null &&
      prevInputs.layoutMap === layoutMap &&
      prevInputs.scrollMap === scrollMapRef &&
      prevInputs.syntheticMap === syntheticMapRef &&
      prevInputs.breakpoint === breakpoint &&
      prevInputs.themeVersion === themeVersion
    ) {
      return {
        commandStreamPatched: false,
        commandStreamInvalidated: false,
      };
    }

    // canonical commit은 rendererInput과 layout publish를 서로 다른 React
    // 경계에서 발행한다. patch 성공 직후 같은 map/layout을 가진 후속
    // projection sync가 forceFullRebuild로 들어오면, 이미 승격한 stream을
    // 다시 무효화하지 않는다. 요소/map/layout이 달라진 경우에는 이 guard를
    // 통과하지 않아 기존 full rebuild 경계를 보존한다.
    if (
      this.pendingCommit === null &&
      this.lastPatchedCanonicalRevision !== null &&
      canonicalRevision === this.lastPatchedCanonicalRevision &&
      (projectionChanged || forceFullRebuild) &&
      prevInputs !== null &&
      prevInputs.layoutMap === layoutMap
    ) {
      const changedAfterPatch =
        this.prevElementsMap === elementsMap
          ? new Set<string>()
          : this.detectChangedIds(elementsMap);
      if (changedAfterPatch?.size === 0) {
        recordCommitLanePromotedSyncSkip();
        this.prevElementsMap = elementsMap;
        this.prevProjectionVersion = projectionVersion;
        return {
          commandStreamPatched: false,
          commandStreamInvalidated: false,
        };
      }
    }

    this.lastPatchedCanonicalRevision = null;
    this.externalDirty = false;
    this.prevSyncInputs = {
      layoutMap,
      scrollMap: scrollMapRef,
      syntheticMap: syntheticMapRef,
      breakpoint,
      themeVersion,
    };

    const changedIds =
      (this.pendingCommit !== null && !themeChanged) ||
      (!forceFullRebuild && !themeChanged && !projectionChanged)
        ? this.detectChangedIds(elementsMap)
        : null;

    if (this.pendingCommit !== null) {
      // rendererInput effect는 legacy 호환상 forceFullRebuild=true로 호출되지만,
      // pending commit이 있으면 먼저 변경 ID만 registry에 반영하고 현재 stream의
      // dirty root를 splice한다. patch 실패 시에만 아래 full rebuild를 실행한다.
      // canonical commit 자체가 scene/projection version을 증가시킨다. pending
      // descriptor와 같은 post-commit projection 변경은 dirty-root patch의
      // 입력이며, projectionChanged를 full rebuild 조건으로 취급하면 commit
      // lane이 항상 탈락한다. theme 변경처럼 descriptor 범위를 벗어난 전역
      // 입력만 fail-closed 한다.
      const shouldWaitForPublishedLayout =
        !this.pendingCommit.layoutWaited &&
        projectionChanged &&
        canonicalRevision !== undefined &&
        this.pendingCommit.queuedCanonicalRevision !== null &&
        canonicalRevision === this.pendingCommit.queuedCanonicalRevision;
      if (shouldWaitForPublishedLayout) {
        this.pendingCommit.layoutWaited = true;
        return {
          commandStreamPatched: false,
          commandStreamInvalidated: false,
        };
      }
      if (themeChanged) {
        this.pendingCommit = null;
        this.fullRebuild(elementsMap, layoutMap, theme, childrenMap);
        this.prevElementsMap = elementsMap;
        this.prevProjectionVersion = projectionVersion;
        this.lastPatchedCanonicalRevision = null;
        return {
          commandStreamPatched: false,
          commandStreamInvalidated: true,
        };
      }
      const pendingChangedIds =
        changedIds ?? new Set<string>(elementsMap.keys());
      if (pendingChangedIds.size > 0) {
        this.incrementalSync(
          pendingChangedIds,
          elementsMap,
          layoutMap,
          theme,
          childrenMap,
        );
      }
      const patchResult = this.applyPendingCommitPatch(
        elementsMap,
        layoutMap,
        childrenMap,
        canonicalRevision,
      );
      if (patchResult.applied) {
        this.prevElementsMap = elementsMap;
        this.prevProjectionVersion = projectionVersion;
        this.lastPatchedCanonicalRevision = canonicalRevision ?? null;
        return {
          commandStreamPatched: true,
          commandStreamInvalidated: false,
          damageBounds: patchResult.damageBounds,
          damageRevision: patchResult.revision,
        };
      }
      this.pendingCommit = null;
      this.fullRebuild(elementsMap, layoutMap, theme, childrenMap);
    } else if (changedIds === null || changedIds.size === 0) {
      // null(첫 실행, theme 변경, layout publish, image load)과 빈 집합(동일
      // 참조 = 요소 변경 없음, layout만 변경) 모두 전체 rebuild.
      // layout publish는 layout-dependent Spec node를 materialize한다.
      // addElement 직후 첫 store sync에서 layout이 아직 없으면
      // buildSpecNodeData가 null을 반환할 수 있으므로 incremental sync로
      // 빠지면 "selection은 있으나 보이지 않음" 상태가 남는다.
      this.fullRebuild(elementsMap, layoutMap, theme, childrenMap);
    } else {
      // 증분 갱신: 변경된 요소만 rebuild
      this.incrementalSync(
        changedIds,
        elementsMap,
        layoutMap,
        theme,
        childrenMap,
      );
    }

    this.prevElementsMap = elementsMap;
    this.prevProjectionVersion = projectionVersion;
    this.lastPatchedCanonicalRevision = null;
    return {
      commandStreamPatched: false,
      commandStreamInvalidated: true,
    };
  }

  private applyPendingCommitPatch(
    elementsMap: Map<string, CanvasSceneNode>,
    layoutMap: Map<string, ComputedLayout> | null,
    childrenMap: Map<string, CanvasSceneNode[]> | null,
    canonicalRevision?: number,
  ): PendingCommitPatchResult {
    const pending = this.pendingCommit;
    const current = getCachedCommandStreamSnapshot();
    if (!pending || !current || !childrenMap) {
      if (pending) recordCommitLanePatchFallback();
      return { applied: false };
    }

    const tree = buildCommitTreeIndex(elementsMap, childrenMap);
    const planResult = createCommitPatchPlan({
      mutations: pending.mutations,
      revision: pending.revision,
      tree,
    });
    if (!planResult.ok) {
      recordCommitLanePatchFallback();
      return { applied: false };
    }

    // presentation revision과 canonical document revision은 서로 다른 producer가
    // 발행한다. 두 값이 역전되어도 stale reject가 commit을 잃지 않도록 stream 내부
    // revision은 단조 증가 envelope로 만든다. canonical revision 자체는 별도의
    // baseCanonicalRevision으로 검증/승격한다.
    const patchRevision = Math.max(
      pending.revision,
      current.presentationRevision + 1,
    );

    let damageBounds: BoundingBox | undefined;
    for (const plan of planResult.plans) {
      for (const rootId of plan.dirtyRootIds) {
        const context = current.subtreeBuildContextByElement.get(rootId);
        if (!context) {
          recordCommitLanePatchFallback();
          return { applied: false };
        }
        const replacement = buildSubtreeCommandStream({
          rootId,
          childrenMap,
          layoutMap: layoutMap ?? EMPTY_LAYOUT_MAP,
          context,
          revision: {
            presentationRevision: patchRevision,
            baseCanonicalRevision: current.baseCanonicalRevision,
            presentationRevisionByRootKey: new Map([
              [plan.rootKey, patchRevision],
            ]),
          },
        });
        const result = applyCommitSubtreeCommandPatch({
          current,
          replacement,
          rootId,
          rootKey: plan.rootKey,
          revision: patchRevision,
          canonicalRevision: current.baseCanonicalRevision,
        });
        if (!result.applied) return { applied: false };
        damageBounds = unionDamageBounds(damageBounds, result.damageBounds);
      }
    }
    this.pendingCommit = null;
    if (canonicalRevision !== undefined) {
      current.baseCanonicalRevision = canonicalRevision;
    }
    recordCommitLanePatchSuccess();
    recordCommitLanePatchDamage(damageBounds);
    return { applied: true, damageBounds, revision: pending.revision };
  }

  /**
   * 변경된 요소 ID 감지 (참조 비교).
   * - null: 첫 실행 → 전체 rebuild 필요
   * - empty Set: 변경 없음
   * - non-empty Set: 변경된 요소 ID 목록
   */
  private detectChangedIds(
    elementsMap: Map<string, CanvasSceneNode>,
  ): Set<string> | null {
    if (!this.prevElementsMap) return null;
    if (this.prevElementsMap === elementsMap) {
      // 동일 참조 = store 요소 변경 없음. 일반 구독 경로에서는 empty Set 반환
      // → sync()가 fullRebuild 분기 선택 (size === 0). layout publish는
      // connect()에서 forceFullRebuild=true로 들어와 이 감지 함수에 의존하지 않는다.
      return new Set();
    }

    const changed = new Set<string>();

    // 추가/변경된 요소 (Zustand immutable → 변경 시 새 참조)
    for (const [id, el] of elementsMap) {
      const prev = this.prevElementsMap.get(id);
      if (!prev || prev !== el) changed.add(id);
    }

    // 삭제된 요소
    for (const id of this.prevElementsMap.keys()) {
      if (!elementsMap.has(id)) changed.add(id);
    }

    // ADR-066: synthetic element(가상 Tab)도 매 sync마다 rebuild 대상.
    // layout 변경 시 items/size가 반영될 수 있음.
    for (const id of getSyntheticElementsMap().keys()) {
      changed.add(id);
    }

    return changed;
  }

  /**
   * 증분 갱신: 변경된 요소만 rebuild.
   */
  private incrementalSync(
    changedIds: Set<string>,
    elementsMap: Map<string, CanvasSceneNode>,
    layoutMap: Map<string, ComputedLayout> | null,
    theme: "light" | "dark",
    childrenMap: Map<string, CanvasSceneNode[]> | null,
  ): void {
    const ctx: BuildContext = {
      layoutMap: layoutMap ?? EMPTY_LAYOUT_MAP,
      theme,
    };

    // 부모 prop(showIndicator 등)이 자식 spec shapes에 영향 → 양방향 rebuild 확장
    const expandedIds = new Set(changedIds);
    for (const id of changedIds) {
      const element = elementsMap.get(id);
      if (!element) continue;

      if (element.parent_id) {
        const parent = elementsMap.get(element.parent_id);
        if (parent && SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(parent.type)) {
          expandedIds.add(element.parent_id);
        }
      }

      if (SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(element.type) && childrenMap) {
        const children = childrenMap.get(id);
        if (children) {
          for (const child of children) {
            expandedIds.add(child.id);
            const grandchildren = childrenMap.get(child.id);
            if (grandchildren) {
              for (const gc of grandchildren) expandedIds.add(gc.id);
            }
          }
        }
      }
    }

    recordEditorPresentationTargetIncrementalPatches(expandedIds.size);

    // ADR-066: synthetic elements (virtual Tab 등)도 증분 처리. 렌더링을 위해
    // Skia node가 필요하며 items 등 변경 시 rebuild 필요.
    const syntheticMap = getSyntheticElementsMap();

    for (const id of expandedIds) {
      const syntheticElement = syntheticMap.get(id);
      const element =
        elementsMap.get(id) ??
        (syntheticElement ? toSyntheticSceneNode(syntheticElement) : undefined);
      if (!element) {
        // 삭제된 요소
        unregisterSkiaNode(id);
        this.registeredIds.delete(id);
        this.transitionManager?.remove(id);
        // 이미지 해제
        const oldSrc = this.loadedImageSrcs.get(id);
        if (oldSrc) {
          releaseSkImage(oldSrc);
          this.loadedImageSrcs.delete(id);
        }
        continue;
      }

      // CSS transition 트리거: 이전 element가 있고 transitionManager가 연결된 경우
      if (this.transitionManager && this.prevElementsMap) {
        const prevElement = this.prevElementsMap.get(id);
        if (prevElement && prevElement !== element) {
          this.triggerTransitions(id, prevElement, element);
        }
      }

      // 추가 또는 변경된 요소 rebuild
      this.registeredIds.add(id);
      const layout = ctx.layoutMap.get(id) ?? undefined;
      const nodeData = this.buildNodeForElement(
        element,
        id,
        layout,
        ctx,
        elementsMap,
        childrenMap,
      );
      if (nodeData) {
        this.registerBuiltNode(id, nodeData);
      }
    }
  }

  /**
   * build 결과 등록 — 내용이 기존 등록 객체와 동일하면 기존 객체를 유지한다
   * (ADR-153 Phase 3). fullRebuild 는 요소 1개 편집에도 전체 노드를 재생성하는데,
   * 무변경 노드까지 새 객체로 갈아끼우면 노드 identity(= 노드 Picture 캐시 키)가
   * 전량 흔들려 편집 1회가 전 노드 re-record 로 번진다. identity 유지 시
   * registerSkiaNode 의 동일-참조 skip 이 registryVersion 증가도 막는다.
   */
  private registerBuiltNode(id: string, nodeData: SkiaNodeData): void {
    const prev = getSkiaNode(id);
    if (prev && skiaNodeContentEqualsIgnoringPosition(prev, nodeData)) {
      // 루트 x/y(위치)만 다른 경우: 이동은 self-draw 내용을 바꾸지 않는다
      // (Picture 키도 위치 제외 — r1 M1). 기존 객체를 유지하되 layout 부재 시
      // fallback 으로 읽히는 좌표만 동기화한다.
      prev.x = nodeData.x;
      prev.y = nodeData.y;
      return;
    }
    registerSkiaNode(id, nodeData);
  }

  /**
   * 전체 rebuild: 모든 요소 순회 + skiaNodeRegistry 갱신.
   */
  private fullRebuild(
    elementsMap: Map<string, CanvasSceneNode>,
    layoutMap: Map<string, ComputedLayout> | null,
    theme: "light" | "dark",
    childrenMap: Map<string, CanvasSceneNode[]> | null,
  ): void {
    recordEditorPresentationBridgeFullRebuild();
    const ctx: BuildContext = {
      layoutMap: layoutMap ?? EMPTY_LAYOUT_MAP,
      theme,
    };

    const currentIds = new Set<string>();
    const currentImageSrcs = new Map<string, string>();

    // ADR-066: synthetic elements (virtual Tab 등) 합산 처리. elementsMap에 없는
    // virtual id를 Skia node registry에도 등록해야 renderCommands visitElement가
    // 렌더링한다.
    const syntheticMap = getSyntheticElementsMap();
    const syntheticEntries: Array<[string, CanvasSceneNode]> = [];
    for (const [id, element] of syntheticMap) {
      if (!elementsMap.has(id)) {
        syntheticEntries.push([id, toSyntheticSceneNode(element)]);
      }
    }
    const iterableEntries: Array<[string, CanvasSceneNode]> = [
      ...elementsMap.entries(),
      ...syntheticEntries,
    ];

    for (const [id, element] of iterableEntries) {
      currentIds.add(id);

      const layout = ctx.layoutMap.get(id) ?? undefined;
      const nodeData = this.buildNodeForElement(
        element,
        id,
        layout,
        ctx,
        elementsMap,
        childrenMap,
      );

      if (nodeData) {
        this.registerBuiltNode(id, nodeData);
      }

      // 이미지 추적
      if (isImageElement(element)) {
        const src = getImageSrc(element);
        if (src) {
          currentImageSrcs.set(id, src);
          if (!getSkImage(src) && !this.loadedImageSrcs.has(id)) {
            this.loadImageAsync(id, src);
          }
        }
      }
    }

    // 삭제된 요소 unregister
    for (const id of this.registeredIds) {
      if (!currentIds.has(id)) {
        unregisterSkiaNode(id);
      }
    }

    // 삭제된 이미지 src 해제
    for (const [id, src] of this.loadedImageSrcs) {
      if (!currentImageSrcs.has(id) || currentImageSrcs.get(id) !== src) {
        releaseSkImage(src);
      }
    }

    this.registeredIds = currentIds;
    this.loadedImageSrcs = currentImageSrcs;
  }

  /**
   * 단일 요소의 SkiaNodeData 빌드 (routing + build).
   */
  private buildNodeForElement(
    element: CanvasSceneNode,
    id: string,
    layout: ComputedLayout | undefined,
    ctx: BuildContext,
    elementsMap: Map<string, CanvasSceneNode>,
    childrenMap: Map<string, CanvasSceneNode[]> | null,
  ): SkiaNodeData | null {
    // ADR-903 P2 D-C: instance → resolved (master props 머지)
    // master/instance 시스템에서 instance.props 는 createInstance 시 빈 객체로
    // 시작하므로, 본 진입부에서 origin props 와 instance override mirror 를 머지하지
    // 않으면 빈 element 가 그려진다.
    //
    // shared `ResolverCache` (Preview / Skia 공통) 를 통과하는 canonical 경로
    // 사용 — `resolveInstanceWithSharedCache` 가 mini CompositionDocument 를
    // 만들어 P2 resolver 통과 후 CanvasSceneNode 재구성 (legacy resolveInstanceElement
    // 와 시각 등가, ADR-903 storeBridge.test.ts TC9 검증).
    //
    // master 가 없는 broken instance 는 null 반환 → 원본 element 유지.
    let effectiveElement = resolveCanonicalRefElement(
      element,
      elementsMap.values(),
    );
    // ADR-116 G5-B P5-D: component master reference 는 mirror adapter 를
    // 경유한다 (canonical RefNode ref 자동 호환).
    if (isInstanceElement(element)) {
      const masterRef = getInstanceMasterRef(element);
      if (masterRef) {
        const master = elementsMap.get(masterRef);
        const resolved = resolveInstanceWithSharedCache(element, master);
        if (resolved) effectiveElement = resolved;
      }
    }

    // ADR-154: 반응형 override 를 activeBreakpoint 기준 resolve — render-visual props
    //   (fontSize/textAlign 등)가 base 가 아닌 override 값으로 glyph 에 반영되게 한다.
    //   layout 경로(useLayoutPublisher)와 **동일** resolveResponsiveLayoutNode 를 써서
    //   Skia glyph == Skia box(layout) == DOM(@media) 3경로 정합(R2). desktop 또는
    //   responsive 부재면 identity(무비용). activeBreakpoint 변경 → invalidateLayout →
    //   layout republish → 이 sync 가 forceFullRebuild 로 재실행되어 자연 재resolve.
    effectiveElement = resolveResponsiveLayoutNode(
      effectiveElement,
      useStore.getState().activeBreakpoint,
    );

    // TagGroup maxRows chip 접힘 — layout(fullTreeLayout Step 4.5b)이 이미 Taffy 실측 rowY 기준으로
    //   초과 chip(+ 미접힘 시 Show all)을 RowsGroup Taffy 트리에서 제외했다. 제외된 chip 은
    //   `ctx.layoutMap` 에 좌표가 없으므로(=미배치), 여기서 layoutMap 부재를 미emit 신호로 사용한다.
    //   **Why layoutMap 기반**: chip 개수 제어 SSOT = layout 의 rowY 접힘(폭 가변 견고). render 가
    //   추정 wrap 공식(resolveTagWrapLayout)을 재실행하면 layout 판정과 갈릴 수 있어 단일화 위반 —
    //   layout 이 뺀 chip 은 좌표 없음 → 안 그림, 남긴 chip 은 좌표 있음 → 그림 (자동 정합).
    {
      const proj = (
        effectiveElement as {
          projection?: { kind?: string; rowIndex?: number };
        }
      ).projection;
      if (proj?.kind === "tag-row") {
        // maxRows 접힘 대상(TagGroup) 인지 — owner TagGroup.maxRows 확인.
        const tagListId = (proj as { listBoxId?: string }).listBoxId;
        const tagList = tagListId ? elementsMap.get(tagListId) : undefined;
        const tlProps = tagList?.props as Record<string, unknown> | undefined;
        const ownerTg = tagList?.parent_id
          ? elementsMap.get(tagList.parent_id)
          : undefined;
        const ownerProps =
          ownerTg?.type === "TagGroup"
            ? (ownerTg.props as Record<string, unknown> | undefined)
            : undefined;
        const maxRows =
          typeof ownerProps?.maxRows === "number"
            ? ownerProps.maxRows
            : typeof tlProps?.maxRows === "number"
              ? tlProps.maxRows
              : 0;
        // maxRows 설정된 chip 이 layout 에서 제외됨(좌표 없음) → 미emit. (미설정이면 항상 배치)
        if (maxRows > 0 && !ctx.layoutMap.get(id)) {
          return null;
        }
      }
    }

    // 구 InlineAlert → Heading/Description font 인라인 분기는 buildSpecNodeData 의
    //   resolveInlineAlertChildFont resolver 로 이관 (2026-08-14) — 위임 로직의 거처를
    //   registry/resolver 2개 층으로 한정 (bridge 라우팅이 세 번째 레이어가 되던 것 해소).
    //   구 근거였던 "spec/text 양쪽 경로 lift-up 필수"(ADR-058 P2)는 buildTextNodeData
    //   폐지(ADR-058 P4)로 소멸 — Heading/Description 은 항상 spec 경로 단일.

    // overflow:scroll/auto 스크롤 상태 — spec/box 양 경로에 공급 (sprite 시대 배선이 bridge
    // 이관 때 탈락했던 부분). scrollBy(wheel) 후 아래 scrollState 구독이 이 요소를 재빌드한다.
    const scrollState = useScrollState.getState().scrollMap.get(id) ?? null;

    if (isSpecPath(effectiveElement)) {
      // childrenMap은 props 변경 시 rebuild되지 않는다 (구조 변경만 rebuild).
      // SYNTHETIC_CHILD_PROP_MERGE_TAGS는 자식 props로 shapes를 만들므로(_crumbs 등)
      // 각 자식을 elementsMap에서 새 참조로 교체하여 stale data를 방지한다.
      const rawChildElements = childrenMap?.get(id);
      const childElements = rawChildElements
        ? SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(effectiveElement.type)
          ? rawChildElements.map((child) => elementsMap.get(child.id) ?? child)
          : rawChildElements
        : undefined;
      const nodeData = buildSpecNodeData({
        element: effectiveElement,
        layout,
        theme: ctx.theme,
        childElements,
        elementsMap,
        childrenMap: childrenMap ?? undefined,
        scrollState,
      });
      if (nodeData) return nodeData;
      // theme 전달 필수 — buildBoxNodeData 의 catalog 해석(shell 배경 토큰 / ADR-166 boxShadow
      //   TokenRef)이 theme 인자를 쓴다. 누락 시 기본값 "light" 로 떨어져 dark 캔버스에서
      //   light 값이 나온다 (아래 box 분기는 이미 ctx.theme 을 넘기고 있었다).
      return (
        buildBoxNodeData({
          element: effectiveElement,
          layout,
          theme: ctx.theme,
          scrollState,
        }) ?? buildSkiaNodeData(effectiveElement, ctx)
      );
    }

    // ADR-903 P2 D-C: image / box fallback 도 instance resolved 결과 사용.
    if (isImageElement(effectiveElement)) {
      const src = getImageSrc(effectiveElement);
      const skImage = src ? getSkImage(src) : null;

      if (src) {
        const alreadyLoading = this.loadedImageSrcs.has(id);
        this.loadedImageSrcs.set(id, src);
        if (!skImage && !alreadyLoading) {
          this.loadImageAsync(id, src);
        }
      }

      // theme 전달 필수 — placeholder 배경 토큰({color.neutral-subtle}) theme 해석.
      return buildImageNodeData({
        element: effectiveElement,
        layout,
        skImage,
        theme: ctx.theme,
      });
    }

    // Box / fallback — 구 isCollectionItem(GridListItem/ListBoxItem 카드 리터럴) 분기는
    //   두 태그가 catalog cutover 상수라 isSpecPath 게이트를 항상 통과, 이 지점 도달 불가
    //   확인 후 제거 (2026-08-14).
    return (
      buildBoxNodeData({
        element: effectiveElement,
        layout,
        theme: ctx.theme,
        scrollState,
      }) ?? buildSkiaNodeData(effectiveElement, ctx)
    );
  }

  /**
   * CSS transition 트리거: 이전/현재 element style 비교 후
   * 변경된 numeric 속성에 대해 transitionManager.start() 호출.
   */
  private triggerTransitions(
    elementId: string,
    prevElement: CanvasSceneNode,
    nextElement: CanvasSceneNode,
  ): void {
    const tm = this.transitionManager;
    if (!tm) return;

    const nextStyle = (nextElement.props as Record<string, unknown>)?.style as
      Record<string, unknown> | undefined;
    if (!nextStyle) return;

    const transitionValue = nextStyle.transition as string | undefined;
    if (!transitionValue || transitionValue === "none") return;

    const defs = parseTransitionShorthand(transitionValue);
    if (defs.length === 0) return;

    const prevStyle = ((prevElement.props as Record<string, unknown>)?.style ??
      {}) as Record<string, unknown>;

    for (const def of defs) {
      const { property, duration, easing } = def;
      if (duration <= 0) continue;

      // "all" 처리: ANIMATABLE_NUMERIC_PROPERTIES 전체 검사
      const targetProps =
        property === "all"
          ? ANIMATABLE_NUMERIC_PROPERTIES
          : ANIMATABLE_NUMERIC_PROPERTIES.has(property)
            ? new Set([property])
            : null;

      if (!targetProps) continue;

      for (const prop of targetProps) {
        const prevVal = parsePxValue(prevStyle[prop], undefined);
        const nextVal = parsePxValue(nextStyle[prop], undefined);

        if (
          prevVal !== undefined &&
          nextVal !== undefined &&
          prevVal !== nextVal
        ) {
          tm.start(elementId, prop, prevVal, nextVal, duration, easing);
        }
      }
    }
  }

  /**
   * 비동기 이미지 로딩 후 재동기화 트리거.
   */
  private loadImageAsync(elementId: string, src: string): void {
    void loadSkImage(src).then((img) => {
      if (!img) return;
      if (!this.registeredIds.has(elementId)) {
        releaseSkImage(src);
        return;
      }
      // 이미지 로드 완료는 ref 비교 대상 밖 입력 변경 — no-op 가드 1회 해제
      this.externalDirty = true;
      this.pendingResync?.();
    });
  }

  /**
   * 연결 해제 + 등록 해제
   */
  dispose(): void {
    this.restoreAllPresentationFillPatches();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.unsubscribeLayout) {
      this.unsubscribeLayout();
      this.unsubscribeLayout = null;
    }
    if (this.unsubscribeScroll) {
      this.unsubscribeScroll();
      this.unsubscribeScroll = null;
    }
    this.pendingResync = null;
    this.pendingCommit = null;
    this.prevElementsMap = null;
    this.prevProjectionVersion = null;
    this.lastObservedCanonicalRevision = null;
    // no-op 가드 스냅샷 리셋 — 재연결 직후 sync 가 skip 되지 않도록
    this.prevSyncInputs = null;
    this.externalDirty = false;
    this.lastPatchedCanonicalRevision = null;

    for (const id of this.registeredIds) {
      unregisterSkiaNode(id);
    }
    this.registeredIds.clear();

    for (const [, src] of this.loadedImageSrcs) {
      releaseSkImage(src);
    }
    this.loadedImageSrcs.clear();
  }

  /** 현재 등록된 요소 수 */
  get size(): number {
    return this.registeredIds.size;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCommitTreeIndex(
  elementsMap: Map<string, CanvasSceneNode>,
  childrenMap: Map<string, CanvasSceneNode[]>,
): {
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  readonly parentById: ReadonlyMap<string, string | null>;
  readonly nodeById: ReadonlyMap<string, CanvasLayoutNode>;
  readonly rootKeyByNodeId: ReadonlyMap<string, string>;
} {
  const childrenByParent = new Map<string, readonly string[]>();
  for (const [parentId, children] of childrenMap) {
    childrenByParent.set(
      parentId,
      children.map((child) => child.id),
    );
  }
  const parentById = new Map<string, string | null>();
  const rootKeyByNodeId = new Map<string, string>();
  for (const [id, element] of elementsMap) {
    parentById.set(id, element.parent_id ?? element.parentId ?? null);
  }
  const rootKeyFor = (id: string): string => {
    let current = id;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const element = elementsMap.get(current);
      if (!element) break;
      const parentId = element.parent_id ?? element.parentId ?? null;
      if (!parentId) {
        const pageId = element.page_id ?? element.pageId ?? "unknown";
        return `page:${pageId}`;
      }
      current = parentId;
    }
    return "__default__";
  };
  for (const id of elementsMap.keys()) rootKeyByNodeId.set(id, rootKeyFor(id));
  return {
    childrenByParent,
    parentById,
    nodeById: elementsMap as unknown as ReadonlyMap<string, CanvasLayoutNode>,
    rootKeyByNodeId,
  };
}

function getImageSrc(element: CanvasSceneNode): string | null {
  const props = element.props as Record<string, unknown> | undefined;
  const src = (props?.src as string) || (props?.source as string) || "";
  return src || null;
}
