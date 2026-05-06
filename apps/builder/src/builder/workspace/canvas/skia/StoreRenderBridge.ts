/**
 * StoreRenderBridge (ADR-100 Phase 6.2 + 증분 갱신)
 *
 * Zustand store 변경을 감지하여 skiaNodeRegistry를 직접 채운다.
 * PixiJS Sprite 컴포넌트(ElementSprite/BoxSprite/TextSprite/ImageSprite)의
 * useSkiaNode() 호출을 대체.
 *
 * 증분 갱신: prevElementsMap 참조 비교로 변경된 요소만 rebuild.
 * Zustand immutable update 패턴 덕분에 변경된 요소만 새 참조를 가짐.
 *
 * 사용법:
 *   const bridge = new StoreRenderBridge();
 *   bridge.connect(store);  // store subscribe 시작
 *   bridge.dispose();       // cleanup
 */

import type { Element } from "../../../../types/core/store.types";
import {
  getComponentMasterReference as getInstanceMasterRef,
  isComponentInstanceMirrorElement as isInstanceElement,
} from "../../../../adapters/canonical/componentSemanticsMirror";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { buildSkiaNodeData, type BuildContext } from "./buildSkiaNodeData";
import { buildBoxNodeData } from "./buildBoxNodeData";
import { buildImageNodeData } from "./buildImageNodeData";
import {
  buildSpecNodeData,
  SYNTHETIC_CHILD_PROP_MERGE_TAGS,
} from "./buildSpecNodeData";
import { registerSkiaNode, unregisterSkiaNode } from "./useSkiaNode";
import { getSkImage, loadSkImage, releaseSkImage } from "./imageCache";
import { getSpecForTag, IMAGE_TAGS } from "../sprites/tagSpecMap";
import { onLayoutPublished } from "../layout";
import { getSyntheticElementsMap } from "../layout/engines/fullTreeLayout";
import type { TransitionManager } from "./transitionManager";
import { ANIMATABLE_NUMERIC_PROPERTIES } from "./interpolators";
import { InlineAlertSpec, parsePxValue } from "@composition/specs";
import { resolveInstanceWithSharedCache } from "@/resolvers/canonical/storeBridge";
import {
  resolveCanonicalRefElement,
  resolveCanonicalRefTree,
} from "../../../utils/canonicalRefResolution";

function isImageElement(element: Element): boolean {
  return IMAGE_TAGS.has(element.type);
}

/** Collection item 태그 — 기본 border/background 스타일 적용 대상 */
const COLLECTION_ITEM_TAGS = new Set(["GridListItem", "ListBoxItem"]);

const EMPTY_LAYOUT_MAP = new Map<string, ComputedLayout>();

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
 * Spec 경로 사용 여부: TAG_SPEC_MAP 등록 여부.
 * ADR-058 Phase 4: `buildTextNodeData` 완전 폐지로 TEXT_TAGS 분기 로직 제거.
 * 모든 text 컴포넌트가 spec 경로(`buildSpecNodeData`)로 통일됨.
 */
function isSpecPath(element: Element): boolean {
  return !!getSpecForTag(element.type);
}

// ---------------------------------------------------------------------------
// StoreRenderBridge
// ---------------------------------------------------------------------------

export class StoreRenderBridge {
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLayout: (() => void) | null = null;
  private registeredIds = new Set<string>();
  /** 이미지 src → element id 매핑 (라이프사이클 관리) */
  private loadedImageSrcs = new Map<string, string>();
  /** 비동기 이미지 로딩 후 재동기화용 콜백 */
  private pendingResync: (() => void) | null = null;
  /** 이전 elementsMap 참조 (증분 갱신용) */
  private prevElementsMap: Map<string, Element> | null = null;
  /** 이전 theme (변경 감지 → fullRebuild 강제) */
  private prevTheme: "light" | "dark" = "light";
  /** CSS transition 애니메이션 매니저 (선택 연결) */
  public transitionManager: TransitionManager | null = null;

  /**
   * Store에 연결하여 elementsMap 변경 시 skiaNodeRegistry를 갱신.
   */
  connect(options: {
    getElements: () => Map<string, Element>;
    getLayoutMap: () => Map<string, ComputedLayout> | null;
    getChildrenMap?: () => Map<string, Element[]>;
    subscribe: (callback: () => void) => () => void;
    getTheme?: () => "light" | "dark";
    theme?: "light" | "dark";
  }): void {
    this.dispose();

    const {
      getElements,
      getLayoutMap,
      getChildrenMap,
      subscribe,
      getTheme,
      theme = "light",
    } = options;

    const resolveTheme = getTheme ?? (() => theme);

    const resync = (forceFullRebuild = false) => {
      this.sync(
        getElements(),
        getLayoutMap(),
        resolveTheme(),
        getChildrenMap?.() ?? null,
        forceFullRebuild,
      );
    };
    this.pendingResync = () => resync(true);

    // 초기 동기화 (전체 rebuild)
    resync(true);

    // 변경 구독: Zustand store + layout publish
    this.unsubscribe = subscribe(() => resync(false));
    this.unsubscribeLayout = onLayoutPublished(() => resync(true));
  }

  /**
   * 동기화: 증분 갱신 또는 전체 rebuild 자동 선택.
   */
  sync(
    elementsMap: Map<string, Element>,
    layoutMap: Map<string, ComputedLayout> | null,
    theme: "light" | "dark",
    childrenMap: Map<string, Element[]> | null = null,
    forceFullRebuild = false,
  ): void {
    const resolvedTree = resolveCanonicalRefTree({
      childrenMap,
      elements: Array.from(elementsMap.values()),
      elementsMap,
    });
    const renderElementsMap = resolvedTree.elementsMap;
    const renderChildrenMap = resolvedTree.childrenMap;

    // theme 변경 시 전체 rebuild 강제 (모든 Spec 색상 재계산 필요)
    const themeChanged = theme !== this.prevTheme;
    this.prevTheme = theme;

    const changedIds =
      forceFullRebuild || themeChanged
        ? null
        : this.detectChangedIds(renderElementsMap);

    if (changedIds === null) {
      // 첫 실행, theme 변경, layout publish, image load: 전체 rebuild
      // layout publish는 layout-dependent Spec node를 materialize한다.
      // addElement 직후 첫 store sync에서 layout이 아직 없으면
      // buildSpecNodeData가 null을 반환할 수 있으므로 incremental sync로
      // 빠지면 "selection은 있으나 보이지 않음" 상태가 남는다.
      this.fullRebuild(renderElementsMap, layoutMap, theme, renderChildrenMap);
    } else if (changedIds.size === 0) {
      // 동일 참조 = 요소 변경 없음, layout만 변경 → 전체 rebuild
      this.fullRebuild(renderElementsMap, layoutMap, theme, renderChildrenMap);
    } else {
      // 증분 갱신: 변경된 요소만 rebuild
      this.incrementalSync(
        changedIds,
        renderElementsMap,
        layoutMap,
        theme,
        renderChildrenMap,
      );
    }

    this.prevElementsMap = renderElementsMap;
  }

  /**
   * 변경된 요소 ID 감지 (참조 비교).
   * - null: 첫 실행 → 전체 rebuild 필요
   * - empty Set: 변경 없음
   * - non-empty Set: 변경된 요소 ID 목록
   */
  private detectChangedIds(
    elementsMap: Map<string, Element>,
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
    elementsMap: Map<string, Element>,
    layoutMap: Map<string, ComputedLayout> | null,
    theme: "light" | "dark",
    childrenMap: Map<string, Element[]> | null,
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

    // ADR-066: synthetic elements (virtual Tab 등)도 증분 처리. 렌더링을 위해
    // Skia node가 필요하며 items 등 변경 시 rebuild 필요.
    const syntheticMap = getSyntheticElementsMap();

    for (const id of expandedIds) {
      const element = elementsMap.get(id) ?? syntheticMap.get(id);
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
        registerSkiaNode(id, nodeData);
      }
    }
  }

  /**
   * 전체 rebuild: 모든 요소 순회 + skiaNodeRegistry 갱신.
   */
  private fullRebuild(
    elementsMap: Map<string, Element>,
    layoutMap: Map<string, ComputedLayout> | null,
    theme: "light" | "dark",
    childrenMap: Map<string, Element[]> | null,
  ): void {
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
    const iterableEntries: Array<[string, Element]> = [
      ...elementsMap.entries(),
      ...[...syntheticMap.entries()].filter(([id]) => !elementsMap.has(id)),
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
        registerSkiaNode(id, nodeData);
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
    element: Element,
    id: string,
    layout: ComputedLayout | undefined,
    ctx: BuildContext,
    elementsMap: Map<string, Element>,
    childrenMap: Map<string, Element[]> | null,
  ): import("./nodeRendererTypes").SkiaNodeData | null {
    // ADR-903 P2 D-C: instance → resolved (master props 머지)
    // master/instance 시스템에서 instance.props 는 createInstance 시 빈 객체로
    // 시작하므로, 본 진입부에서 origin props 와 instance override mirror 를 머지하지
    // 않으면 빈 element 가 그려진다.
    //
    // shared `ResolverCache` (Preview / Skia 공통) 를 통과하는 canonical 경로
    // 사용 — `resolveInstanceWithSharedCache` 가 mini CompositionDocument 를
    // 만들어 P2 resolver 통과 후 Element 재구성 (legacy resolveInstanceElement
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

    // InlineAlert → Heading/Description font delegation (Skia 렌더링 경로)
    // fullTreeLayout + implicitStyles의 주입은 레이아웃 계산용이라 store에 반영 안됨.
    // ADR-058 Phase 2: Heading이 spec 경로로 이동했으므로 lift-up 필수 — spec/text
    // 양쪽 경로가 동일한 effectiveElement를 바라보게 한다.
    //
    // ADR-903 P2 D-C: instance resolution 결과(effectiveElement) 기반으로 spread.
    if (
      (effectiveElement.type === "Heading" ||
        effectiveElement.type === "Description") &&
      effectiveElement.parent_id
    ) {
      const parent = elementsMap.get(effectiveElement.parent_id);
      if (parent?.type === "InlineAlert") {
        const parentSize =
          ((parent.props as Record<string, unknown>)?.size as string) ?? "md";
        const specSize = (InlineAlertSpec.sizes[parentSize] ??
          InlineAlertSpec.sizes[
            InlineAlertSpec.defaultSize
          ]) as unknown as Record<string, unknown>;
        const cs = (effectiveElement.props?.style ?? {}) as Record<
          string,
          unknown
        >;
        const isHeading = effectiveElement.type === "Heading";
        const fontSize = isHeading
          ? (specSize.headingFontSize as number)
          : (specSize.descFontSize as number);
        const fontWeight = isHeading
          ? (specSize.headingFontWeight as number)
          : (specSize.descFontWeight as number);
        effectiveElement = {
          ...effectiveElement,
          props: {
            ...effectiveElement.props,
            style: {
              ...cs,
              fontSize: cs.fontSize ?? fontSize,
              fontWeight: cs.fontWeight ?? fontWeight,
            },
          },
        };
      }
    }

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
      });
      if (nodeData) return nodeData;
      return (
        buildBoxNodeData({ element: effectiveElement, layout }) ??
        buildSkiaNodeData(effectiveElement, ctx)
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

      return buildImageNodeData({ element: effectiveElement, layout, skImage });
    }

    // Box / fallback
    const isCollectionItem = COLLECTION_ITEM_TAGS.has(effectiveElement.type);
    return (
      buildBoxNodeData({
        element: effectiveElement,
        layout,
        isCollectionItem,
        theme: ctx.theme,
      }) ?? buildSkiaNodeData(effectiveElement, ctx)
    );
  }

  /**
   * CSS transition 트리거: 이전/현재 element style 비교 후
   * 변경된 numeric 속성에 대해 transitionManager.start() 호출.
   */
  private triggerTransitions(
    elementId: string,
    prevElement: Element,
    nextElement: Element,
  ): void {
    const tm = this.transitionManager;
    if (!tm) return;

    const nextStyle = (nextElement.props as Record<string, unknown>)?.style as
      | Record<string, unknown>
      | undefined;
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
      this.pendingResync?.();
    });
  }

  /**
   * 연결 해제 + 등록 해제
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.unsubscribeLayout) {
      this.unsubscribeLayout();
      this.unsubscribeLayout = null;
    }
    this.pendingResync = null;
    this.prevElementsMap = null;

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

function getImageSrc(element: Element): string | null {
  const props = element.props as Record<string, unknown> | undefined;
  const src = (props?.src as string) || (props?.source as string) || "";
  return src || null;
}
