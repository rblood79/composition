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

import { useEffect, useMemo, useRef } from "react";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { LayoutPublisherInput } from "../renderers";
import {
  publishFilteredChildrenMap,
  publishLayoutMapsBatch,
  publishSyntheticElementsMap,
} from "../layout";
import type { ComputedLayout } from "../layout";
import type { CanvasLayoutNode } from "../layout/layoutNode";
import {
  getCachedPageLayout,
  createPageElementsSignature,
  createPageLayoutSignature,
  buildPageChildrenMap,
  buildChildrenIdMap,
} from "../scene/layoutCache";
import { resolveResponsiveLayoutNode } from "../layout/resolveResponsive";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import { useStore } from "../../../stores";

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
  //
  // ADR-172 Phase 2: 아래 세 키는 전부 **훅 본문에서 매 렌더 조립**되고 있었다.
  // 팬/줌은 rAF 당 1회 리렌더를 유발하므로 그 조립이 프레임마다 돌았고,
  // `layoutInputKey` 는 요소당 `LAYOUT_STYLE_KEYS` 73 + `LAYOUT_PROP_KEYS` 43 을
  // 문자열로 잇는다 (요소당 약 1.4KB — N=9,728 에서 프레임마다 12.8MB).
  //
  // deps 는 `pages`/`framePages` **배열 identity** 다. **`layoutVersion` 단독으로
  // 좁히면 안 된다** — 아래 R1 계약 주석 참조. 그 identity 가 카메라와 무관해진
  // 것은 Phase 1(카메라 dead 필드 제거)과 Phase 3(snapshot core/visibility 분리)의
  // 결과이며, 둘 중 하나라도 되돌아가면 이 memo 는 팬마다 miss 로 복귀한다.
  const dimensionKey = useMemo(
    () =>
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
        .join("|"),
    [framePages, pages],
  );

  // addElement 는 elements/layoutVersion 갱신 후 pageIndex/elementsMap 을 별도
  // commit 으로 rebuild 한다. 두 번째 commit 은 layoutVersion 이 변하지 않으므로
  // page/frame input 구조 자체도 publish trigger 에 포함해야 신규 child 가
  // layoutMap 없이 투명/미등록 상태로 남지 않는다.
  //
  // ADR-172 R1 (HIGH): 그래서 memo deps 가 `[pages, framePages]` 다. 두 번째
  // commit 은 `elementsMap` 을 새로 만들고 그것이 `layoutPublisherInputs` →
  // `pages` 의 identity 를 바꾸므로 이 키가 다시 계산된다. deps 를
  // `layoutVersion` 으로 바꾸면 그 commit 이 통째로 누락된다.
  //
  // ADR-172 Phase 4: 이 memo 는 팬/줌 프레임에 **재실행되지 않는 것이 정상**이다.
  // `observe()` 는 miss 시에만 샘플을 남기므로 정상 동작에서 오버헤드가 0 이고,
  // 샘플 수(`snapshot(...).count`)가 그대로 G2 지표가 된다.
  const layoutInputKey = useMemo(
    () =>
      observe(PERF_LABEL.RENDER_DERIVED_LAYOUT_KEY, () =>
        [...pages, ...framePages]
          .map(({ pageId, input }) => {
            const pageElementsSignature = createPageElementsSignature(
              input.pageElements,
            );
            const pageLayoutSignature = createPageLayoutSignature(
              input.bodyElement,
              input.pageElements,
            );
            return `${pageId}:${input.projectionVersion}:${input.bodyElement?.id ?? "no-body"}:${pageElementsSignature}:${pageLayoutSignature}`;
          })
          .join("||"),
      ),
    [framePages, pages],
  );

  // 새로고침 직후 frame inputs 가 먼저 생성되고 WASM layout 이 아직 pending 이면
  // effect 는 skip 된다. 이후 ready 전환만으로도 layoutMap 을 다시 publish 해야 한다.
  const readinessKey = useMemo(
    () =>
      [...pages, ...framePages]
        .map(
          ({ pageId, input }) =>
            `${pageId}:${input.wasmLayoutReady ? "ready" : "pending"}`,
        )
        .join("||"),
    [framePages, pages],
  );

  useEffect(() => {
    const all = [...pagesRef.current, ...framePagesRef.current];
    // ADR-154: 현재 activeBreakpoint 를 publish 시점에 읽어 resolve 에 사용.
    // activeBreakpoint 변경은 bridge(invalidateLayout)로 layoutVersion 을 bump →
    // 본 effect 가 재실행되고, resolve 된 style 로 시그니처가 달라져 캐시 miss.
    const activeBreakpoint = useStore.getState().activeBreakpoint;
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

      // ADR-154: responsive override resolve (base ⊕ cascade). desktop 은 원본
      // identity 반환이라 기존 경로 비용 0. 시그니처/엔진/children map 모두 resolved
      // 노드로 계산 → activeBreakpoint·override 변경이 자연히 캐시 miss 를 유발.
      const resolvedBody = resolveResponsiveLayoutNode(
        bodyElement,
        activeBreakpoint,
      );
      const sourceElementById = new Map<string, CanvasLayoutNode>();
      for (const [id, node] of elementById) {
        sourceElementById.set(
          id,
          resolveResponsiveLayoutNode(node, activeBreakpoint),
        );
      }
      sourceElementById.set(resolvedBody.id, resolvedBody);
      for (const element of pageElements) {
        sourceElementById.set(
          element.id,
          resolveResponsiveLayoutNode(element, activeBreakpoint),
        );
      }
      const resolvedPageElements = pageElements.map(
        (el) => sourceElementById.get(el.id) ?? el,
      );
      const pageChildrenMap = buildPageChildrenMap({
        bodyElement: resolvedBody,
        elementById: sourceElementById,
        pageElements: resolvedPageElements,
      });
      const pageElementsSignature = createPageElementsSignature(pageElements);
      const freshElements = resolvedPageElements;
      const pageLayoutSignature = createPageLayoutSignature(
        resolvedBody,
        freshElements,
      );
      const childrenIdMap = buildChildrenIdMap(pageChildrenMap);

      const layoutMap = getCachedPageLayout({
        bodyElement: resolvedBody,
        childrenIdMap,
        elementById: sourceElementById,
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
