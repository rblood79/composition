/**
 * useLayoutPublisher — PixiJS 독립 레이아웃 발행 (ADR-100 Phase 6.4)
 *
 * ElementsLayer 내부의 레이아웃 계산 + publishLayoutMap을 BuilderCanvas
 * 레벨로 추출. UNIFIED_ENGINE=true 시 PixiJS Application 없이도
 * sharedLayoutMap을 채운다.
 *
 * 원리: getCachedPageLayout은 순수 함수 — store 데이터만 필요.
 * publishLayoutMap으로 모듈 레벨 변수에 발행하면 Command Stream이 읽음.
 *
 * ADR-111 P3-δ fix #3 (2026-04-28): framePages 입력 추가 — page-centric
 * 가정 cracking 의 첫 단계. frame body 도 page 와 동일 layout 발행 logic 처리
 * → publishLayoutMap key fallback chain (D5=A: page id → layout binding → id)
 * 으로 구분. dimensionKey 단일 통합 (D6=A).
 */

import { useEffect, useRef } from "react";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { LayoutPublisherInput } from "../renderers";
import {
  publishFilteredChildrenMap,
  publishLayoutMapsBatch,
  publishSyntheticElementsMap,
} from "../layout";
import type { ComputedLayout } from "../layout";
import {
  getCachedPageLayout,
  createPageElementsSignature,
  createPageLayoutSignature,
  buildPageChildrenMap,
  buildChildrenIdMap,
} from "../scene/layoutCache";
import { resolveCanonicalRefTree } from "../../../utils/canonicalRefResolution";

interface PageLayoutInput {
  pageId: string;
  input: LayoutPublisherInput;
}

/**
 * 모든 visible page + frame body 의 레이아웃을 계산하고 publishLayoutMap 으로 발행.
 * 단일 useEffect 로 페이지 수에 무관하게 hooks 규칙 준수.
 *
 * @param pages    visible page input
 * @param framePages reusable frame body input (ADR-111 P3-δ fix #3)
 */
export function useLayoutPublisher(
  pages: PageLayoutInput[],
  framePages: PageLayoutInput[],
  layoutVersion: number,
): void {
  const pagesRef = useRef(pages);
  const framePagesRef = useRef(framePages);
  const publishedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pagesRef.current = pages;
    framePagesRef.current = framePages;
  });

  // 차원 서명: breakpoint(pageWidth/Height) 변경은 layoutVersion을 bump하지 않지만
  // getCachedPageLayout의 cache key에 포함되므로 재발행이 필요하다.
  // D6=A: 단일 dimensionKey 에 frame entry 도 통합 — frame width/height 변경 시
  // 동일 useEffect flow 로 재발행.
  const dimensionKey =
    pages
      .map(
        ({ pageId, input }) =>
          `p:${pageId}:${input.pageWidth}:${input.pageHeight}`,
      )
      .join("|") +
    "||" +
    framePages
      .map(
        ({ pageId, input }) =>
          `f:${pageId}:${input.pageWidth}:${input.pageHeight}`,
      )
      .join("|");

  // addElement 는 elements/layoutVersion 갱신 후 pageIndex/elementsMap 을 별도
  // commit 으로 rebuild 한다. 두 번째 commit 은 layoutVersion 이 변하지 않으므로
  // page/frame input 구조 자체도 publish trigger 에 포함해야 신규 child 가
  // layoutMap 없이 투명/미등록 상태로 남지 않는다.
  const layoutInputKey = [...pages, ...framePages]
    .map(({ pageId, input }) => {
      const pageElementsSignature = createPageElementsSignature(
        input.pageElements,
      );
      const pageLayoutSignature = createPageLayoutSignature(
        input.bodyElement,
        input.pageElements,
      );
      return `${pageId}:${input.bodyElement?.id ?? "no-body"}:${pageElementsSignature}:${pageLayoutSignature}`;
    })
    .join("||");

  // 새로고침 직후 frame inputs 가 먼저 생성되고 WASM layout 이 아직 pending 이면
  // effect 는 skip 된다. 이후 ready 전환만으로도 layoutMap 을 다시 publish 해야 한다.
  const readinessKey = [...pages, ...framePages]
    .map(
      ({ pageId, input }) =>
        `${pageId}:${input.wasmLayoutReady ? "ready" : "pending"}`,
    )
    .join("||");

  useEffect(() => {
    const all = [...pagesRef.current, ...framePagesRef.current];
    const activeKeys = new Set<string>();
    const layoutUpdates: Array<{
      key: string;
      map: Map<string, ComputedLayout> | null;
    }> = [];

    for (const { input } of all) {
      const {
        bodyElement,
        elementById,
        pageElements,
        pageWidth,
        pageHeight,
        wasmLayoutReady,
      } = input;

      if (!bodyElement || !wasmLayoutReady) continue;
      const key =
        bodyElement.page_id ??
        getFrameElementMirrorId(bodyElement) ??
        bodyElement.id;
      activeKeys.add(key);

      const sourceElementById = new Map(elementById);
      sourceElementById.set(bodyElement.id, bodyElement);
      for (const element of pageElements) {
        sourceElementById.set(element.id, element);
      }
      const resolvedTree = resolveCanonicalRefTree({
        elements: pageElements,
        elementsMap: sourceElementById,
      });
      const resolvedElementById = resolvedTree.elementsMap;
      const resolvedBodyElement =
        resolvedElementById.get(bodyElement.id) ?? bodyElement;
      const resolvedPageElements = resolvedTree.elements;

      const pageChildrenMap = buildPageChildrenMap({
        bodyElement: resolvedBodyElement,
        elementById: resolvedElementById,
        pageElements: resolvedPageElements,
      });
      const pageElementsSignature =
        createPageElementsSignature(resolvedPageElements);
      const freshElements = resolvedPageElements.map(
        (el) => resolvedElementById.get(el.id) ?? el,
      );
      const pageLayoutSignature = createPageLayoutSignature(
        resolvedBodyElement,
        freshElements,
      );
      const childrenIdMap = buildChildrenIdMap(pageChildrenMap);

      const layoutMap = getCachedPageLayout({
        bodyElement: resolvedBodyElement,
        childrenIdMap,
        elementById: resolvedElementById,
        pageChildrenMap,
        pageElementsSignature,
        pageLayoutSignature,
        pageHeight,
        pageWidth,
        wasmLayoutReady,
      });

      // D5=A: publishLayoutMap key fallback chain.
      // - page bodyElement: page_id 확정 → 기존 동작 유지
      // - frame bodyElement: frame mirror id → frameId 키로 발행
      // - 양쪽 모두 미정 시 element id fallback (graceful degradation)
      layoutUpdates.push({ key, map: layoutMap });
    }

    const staleKeys: string[] = [];
    for (const key of publishedKeysRef.current) {
      if (activeKeys.has(key)) continue;
      publishFilteredChildrenMap(null, key);
      publishSyntheticElementsMap(null, key);
      staleKeys.push(key);
    }
    publishLayoutMapsBatch(layoutUpdates, staleKeys);
    publishedKeysRef.current = activeKeys;
  }, [layoutVersion, dimensionKey, layoutInputKey, readinessKey]);
}
