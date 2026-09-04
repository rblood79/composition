/**
 * 수동 가이드 드래그 훅 — ADR-181 Phase 5
 *
 * 생성(눈금자 스트립에서 끌어냄)과 이동(캔버스의 기존 가이드)이 **같은 세션**을
 * 쓴다. 시작 지점만 다르고 그 뒤 move/up/취소는 전부 같기 때문이다 — 나누면
 * transient publish·commit·cleanup 이 두 벌이 되고 그 중 한 쪽만 고쳐지는
 * 형태로 어긋난다.
 *
 * canonical 은 pointerup 에서 1회만 쓴다 (HC1(c) — 드래그 중 write/히스토리/
 * persist 각 0). `usePageDrag` 의 RAF 스로틀 + window 리스너 어법을 따른다.
 *
 * 삭제는 별도 조작이 아니라 **드래그의 한 결말**이다: 눈금자 스트립 위로
 * 되돌리면 `removing` 이 서고, 놓으면 그대로 삭제된다 (Figma 어법). 그래서
 * 삭제 경로에 별도 확인·단축키가 없다 — 되돌리는 동작 자체가 확인이다.
 */

import { useCallback, useEffect, useRef } from "react";

import { useStore } from "../../../stores";
import {
  beginGuideDrag,
  endGuideDrag,
  getGuideDrag,
  publishGuideDrag,
  type GuideDragState,
} from "../interaction/guidePresentation";
import { isRulerEventTarget } from "../../components/rulerOverlayUtils";
import { guideCursorForAxis } from "../../components/rulerMetrics";
import { resolveTopPageIdAtPoint } from "../interaction/selectionModel";
import { commitGuideDrag } from "../viewport/pageGuideActions";
import {
  GUIDE_HIT_THRESHOLD_SCREEN_PX,
  buildGuideHitTargets,
  resolveGuideHit,
  type GuideHitTarget,
} from "../interaction/guideHitTest";
import { readPageGuides } from "../viewport/pageGuideActions";
import {
  clearGuideSelection,
  getSelectedGuide,
  setHoveredGuide,
  setSelectedGuide,
} from "../interaction/guideEmphasis";

/**
 * 클릭 ↔ 드래그 갈림 (screen px).
 *
 * 이 값 이내로 움직이고 놓으면 **클릭**이라 위치를 건드리지 않는다. 없으면
 * 축소된 화면에서 클릭이 곧 미세 이동이 된다 — 12% 줌에서 1 screen px 은
 * 8.3 scene px 이라, 같은 자리를 눌렀다 떼도 좌표가 달라져 히스토리 entry 가
 * 쌓인다 (2026-08-14 실측). 히트 임계(4px)보다 작게 둬서, 잡을 수 있는 거리
 * 안에서 미세하게 흔들려도 이동으로 읽히지 않는다.
 */
const GUIDE_DRAG_THRESHOLD_PX = 3;

/**
 * 지금 포인터가 가이드 위인가 (가이드 hover 커서가 서 있는가).
 *
 * 커서를 쓰는 곳이 둘이라 필요한 신호다 — 중앙 pointer 핸들러가 이동마다
 * `setCursor("default")` 로 되돌리기 때문에, 가이드 훅이 아무리 세워도
 * 곧바로 덮인다. **우선순위 판정은 `BuilderCanvas.setCursor` 한 곳**에 두고
 * 이 함수는 그 판정의 입력만 준다 (2026-08-14 사용자 보고 — "커서 변화가
 * 없어 불편").
 */
let guideHoverCursor: string | null = null;

export function getGuideHoverCursor(): string | null {
  return guideHoverCursor;
}

interface UseGuideDragOptions {
  screenToCanvasPoint: (point: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  containerRef: React.RefObject<HTMLDivElement | null>;
  pageWidth: number;
  pageHeight: number;
}

export interface UseGuideDragReturn {
  /** 눈금자 스트립에서 시작 — axis 는 스트립 방향이 정한다 */
  startCreate: (
    axis: "x" | "y",
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => void;
  /** 캔버스의 기존 가이드에서 시작 */
  startMove: (
    target: GuideHitTarget,
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => void;
}

export function useGuideDrag({
  screenToCanvasPoint,
  containerRef,
  pageWidth,
  pageHeight,
}: UseGuideDragOptions): UseGuideDragReturn {
  const rafRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const begin = useCallback(
    (
      initial: GuideDragState,
      pointerId: number,
      clientX: number,
      clientY: number,
    ) => {
      cleanupRef.current?.();
      beginGuideDrag(initial);

      let latest: { x: number; y: number } | null = null;
      // 임계를 넘기 전에는 위치를 갱신하지 않는다 — 넘지 않고 놓으면 클릭이다.
      // 이게 없으면 **클릭이 곧 미세 이동**이 된다: 축소된 화면에서는 1 screen
      // px 이 여러 scene px 이라(12% 줌 = 8.3배) 같은 자리를 눌렀다 떼도 좌표가
      // 달라져 히스토리 entry 가 쌓인다 (2026-08-14 실측).
      let moved = false;
      const passedThreshold = (x: number, y: number): boolean => {
        if (moved) return true;
        moved =
          Math.abs(x - clientX) > GUIDE_DRAG_THRESHOLD_PX ||
          Math.abs(y - clientY) > GUIDE_DRAG_THRESHOLD_PX;
        return moved;
      };

      const release = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        cleanupRef.current = null;
        endGuideDrag();
      };

      /**
       * 포인터 위치 → 드래그 상태.
       *
       * 소속 페이지가 있으면 그 페이지-로컬 좌표, 없으면 소속 없음(null).
       * 어느 쪽이든 **커서의 scene 좌표는 항상 채운다** — 드래그는 늘 눈금자
       * 위(=페이지 밖)에서 시작하므로, 그 구간에 미리보기를 그리려면 소속과
       * 무관한 좌표가 필요하다.
       *
       * 눈금자 위의 의미는 드래그 종류마다 다르다:
       * - **move**: 되돌리기 → `removing` (놓으면 삭제)
       * - **create**: 아직 안 끌어냄 → 소속 없음 (놓으면 그냥 취소)
       *
       * create 에서 `removing` 을 세우지 않는 것은 커밋 결과가 같기 때문이다
       * (`commitGuideDrag` — 소속 없는 create 는 어느 쪽이든 아무것도 만들지
       * 않는다). 대신 미리보기가 살아 있어 "끌리고 있다" 가 보인다.
       */
      const resolveAt = (
        clientX: number,
        clientY: number,
        overRuler: boolean,
      ): Partial<
        Pick<
          GuideDragState,
          "pageId" | "position" | "removing" | "scenePosition"
        >
      > => {
        const container = containerRef.current;
        if (!container) return { removing: overRuler };
        const rect = container.getBoundingClientRect();
        const scene = screenToCanvasPoint({
          x: clientX - rect.left,
          y: clientY - rect.top,
        });

        const state = useStore.getState();
        const drag = getGuideDrag();
        const axis = drag?.axis ?? initial.axis;
        // axis "x" = x 를 고정하는 세로선 → scene x 가 그 선의 위치
        const scenePosition = axis === "x" ? scene.x : scene.y;

        if (overRuler) {
          return drag?.kind === "move"
            ? { removing: true, scenePosition }
            : { pageId: null, removing: false, scenePosition };
        }

        // **이동은 소속을 바꾸지 않는다** — 가이드 좌표가 페이지-로컬(C9)이라
        // 페이지를 넘나들면 같은 드래그 안에서 기준계가 갈린다. 포인터가 다른
        // 페이지 위로 가도 원래 페이지 좌표계로 계속 읽는다.
        const pageId =
          drag?.kind === "move"
            ? drag.originPageId
            : resolveTopPageIdAtPoint({
                canvasPoint: scene,
                activePageId: state.currentPageId,
                pageHeight,
                pageWidth,
                pagePositions: state.pagePositions,
                pages: state.pages,
              });
        if (!pageId) return { pageId: null, removing: false, scenePosition };

        const origin = state.pagePositions[pageId];
        if (!origin) return { pageId: null, removing: false, scenePosition };
        const position = Math.round(
          axis === "x" ? scene.x - origin.x : scene.y - origin.y,
        );

        // **페이지 밖으로 끌어내면 삭제**다 — 눈금자로 되돌리는 것과 같은
        // 결말. 남겨 두면 본체는 페이지 클립에 잘려 보이지 않는데 스냅에는
        // 계속 참여하는 "보이지 않는 선" 이 된다 (C10 이 막으려던 바로 그
        // 상태다: 숨기면 원인 추적이 불가능해진다). 2026-08-14 사용자 보고.
        //
        // create 에는 걸지 않는다 — 페이지 밖이면 `resolveTopPageIdAtPoint`
        // 가 이미 pageId 를 주지 않아 아무것도 만들어지지 않는다.
        const extent = axis === "x" ? pageWidth : pageHeight;
        if (drag?.kind === "move" && (position < 0 || position > extent)) {
          return { pageId, position, removing: true, scenePosition };
        }

        return { pageId, position, removing: false, scenePosition };
      };

      const publishAt = (clientX: number, clientY: number) => {
        publishGuideDrag(
          resolveAt(
            clientX,
            clientY,
            isRulerEventTarget(document.elementFromPoint(clientX, clientY)),
          ),
        );
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        if (!passedThreshold(event.clientX, event.clientY)) return;
        latest = { x: event.clientX, y: event.clientY };
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const next = latest;
          latest = null;
          if (next) publishAt(next.x, next.y);
        });
      };

      /**
       * 선택은 **드래그가 끝난 뒤에** 선다 (Figma 어법 — 2026-08-14 사용자 확인).
       *
       * 잡고 있는 동안은 웜 컬러로 남고 놓는 순간 하늘색이 된다. 선택이
       * "무엇을 조작 중인가" 가 아니라 **"무엇을 조작했나"** 의 결과이기
       * 때문이다 — pointerdown 에 붙이면 아직 결과가 없는데 결과 표식이 먼저
       * 선다. 잡고 있다는 신호는 이미 hover 알파와 커서가 준다.
       */
      const applyDragEndSelection = (drag: GuideDragState) => {
        if (drag.removing) {
          // 삭제됐다 — 그 가이드가 선택돼 있었다면 같이 걷는다
          if (getSelectedGuide()?.guideId === drag.guideId) {
            clearGuideSelection();
          }
          return;
        }
        // move 는 소속을 바꾸지 않는다 (C9). create 는 붙은 페이지가 소속이고,
        // 안 붙었으면 아무것도 만들어지지 않았으므로 선택도 건드리지 않는다.
        const pageId = drag.kind === "move" ? drag.originPageId : drag.pageId;
        if (!pageId) return;
        setSelectedGuide({ pageId, guideId: drag.guideId });
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) return;
        // 임계를 못 넘은 pointerup = 클릭. 기존 가이드면 위치를 건드리지 않고
        // 선택만 세우고, 눈금자에서 시작한 생성이면 아무것도 만들지 않는다.
        if (!passedThreshold(event.clientX, event.clientY)) {
          const clicked = getGuideDrag();
          release();
          if (clicked?.kind === "move") applyDragEndSelection(clicked);
          return;
        }
        publishAt(event.clientX, event.clientY);
        const finalDrag = getGuideDrag();
        if (finalDrag) {
          // 커밋 전에 transient 를 걷는다 — 남겨 두면 canonical 갱신과 겹쳐
          // 같은 가이드가 두 번 그려진다
          const breakpoint = useStore.getState().activeBreakpoint;
          const snapshot = { ...finalDrag };
          release();
          commitGuideDrag(snapshot, breakpoint);
          applyDragEndSelection(snapshot);
          return;
        }
        release();
      };

      const onPointerCancel = (event: PointerEvent) => {
        if (event.pointerId === pointerId) release();
      };
      const onBlur = () => release();
      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") release();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          release();
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("blur", onBlur);
      window.addEventListener("keydown", onKeyDown);
      document.addEventListener("visibilitychange", onVisibilityChange);
      cleanupRef.current = release;
      // 시작 즉시 1회 — 스트립에서 놓기만 해도 상태가 맞아야 한다
      publishAt(clientX, clientY);
    },
    [containerRef, pageHeight, pageWidth, screenToCanvasPoint],
  );

  const startCreate = useCallback<UseGuideDragReturn["startCreate"]>(
    (axis, pointerId, clientX, clientY) => {
      begin(
        {
          kind: "create",
          // 문서에 남는 id — 세션 밖에서도 안정적이어야 하므로 랜덤 id
          guideId: `guide-${Math.random().toString(36).slice(2, 10)}`,
          axis,
          pageId: null,
          position: 0,
          removing: false,
          originPageId: null,
          originPosition: 0,
          // 첫 publishAt 이 즉시 채운다 (begin 말미 1회 호출)
          scenePosition: null,
        },
        pointerId,
        clientX,
        clientY,
      );
    },
    [begin],
  );

  const startMove = useCallback<UseGuideDragReturn["startMove"]>(
    (target, pointerId, clientX, clientY) => {
      const origin = useStore.getState().pagePositions[target.pageId];
      if (!origin) return;
      const localPosition =
        target.axis === "x"
          ? target.scenePosition - origin.x
          : target.scenePosition - origin.y;
      begin(
        {
          kind: "move",
          guideId: target.guideId,
          axis: target.axis,
          pageId: target.pageId,
          position: localPosition,
          removing: false,
          originPageId: target.pageId,
          originPosition: localPosition,
          scenePosition: target.scenePosition,
        },
        pointerId,
        clientX,
        clientY,
      );
    },
    [begin],
  );

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  return { startCreate, startMove };
}

/**
 * 가이드 위 hover 커서 — ADR-181 Phase 5.
 *
 * **눈금자가 켜져 있을 때만 리스너를 단다**. 기본값이 OFF 라(C10) 통상
 * 세션에서는 pointermove 리스너가 아예 없고, 그래서 이 기능이 hot path 에
 * 비용을 얹지 않는다. 조작 게이트(`showRulers`)와 같은 조건이라 "커서는
 * 바뀌는데 잡히지 않는" 어긋남도 생기지 않는다.
 *
 * 커서만 바꾼다 — 히트 판정 결과를 캐시하지 않는다. 캐시하면 스크롤·페이지
 * 이동으로 좌표가 바뀔 때 stale 이 되고, 그 갱신 트리거를 또 달아야 한다.
 */
export function useGuideHoverCursor({
  screenToCanvasPoint,
  containerRef,
  pageWidth,
  pageHeight,
  zoom,
}: UseGuideDragOptions & { zoom: number }): void {
  const showRulers = useStore((state) => state.showRulers);

  useEffect(() => {
    const container = containerRef.current;
    if (!showRulers || !container) return;

    let frame: number | null = null;
    let latest: { x: number; y: number } | null = null;
    let applied: string = "";

    const setCursor = (cursor: string) => {
      // 커서 문자열은 여기서 기억만 하고, 실제 적용은 BuilderCanvas 가
      // 우선순위를 판정해서 한다 (같은 프레임에 default 로 덮이는 것을
      // 막으려면 write 지점이 하나여야 한다)
      guideHoverCursor = cursor === "" ? null : cursor;
      if (applied === cursor) return;
      applied = cursor;
      container.style.cursor = cursor;
    };

    /**
     * 히트 결과를 커서와 강조 상태에 **같이** 반영한다.
     *
     * 둘을 따로 세우면 "커서는 잡을 수 있다는데 선은 흐린" 어긋남이 생긴다 —
     * 알파와 커서가 같은 것(=잡을 수 있음)을 말하므로 갱신 지점도 하나여야
     * 한다. 강조 쪽은 값이 바뀔 때만 재렌더 신호를 낸다 (guideEmphasis).
     */
    const applyHit = (hit: GuideHitTarget | null) => {
      setCursor(hit ? guideCursorForAxis(hit.axis) : "");
      setHoveredGuide(
        hit ? { pageId: hit.pageId, guideId: hit.guideId } : null,
      );
    };

    const evaluate = () => {
      const point = latest;
      latest = null;
      if (!point || getGuideDrag()) return;

      const rect = container.getBoundingClientRect();
      const scene = screenToCanvasPoint({
        x: point.x - rect.left,
        y: point.y - rect.top,
      });
      const state = useStore.getState();
      const pageId = resolveTopPageIdAtPoint({
        canvasPoint: scene,
        activePageId: state.currentPageId,
        pageHeight,
        pageWidth,
        pagePositions: state.pagePositions,
        pages: state.pages,
      });
      const origin = pageId ? state.pagePositions[pageId] : null;
      if (!pageId || !origin) {
        applyHit(null);
        return;
      }
      const guides = readPageGuides(pageId, state.activeBreakpoint);
      if (guides.length === 0) {
        applyHit(null);
        return;
      }
      const hit = resolveGuideHit(
        scene,
        buildGuideHitTargets(pageId, guides, origin, {
          width: pageWidth,
          height: pageHeight,
        }),
        GUIDE_HIT_THRESHOLD_SCREEN_PX / (zoom === 0 ? 1 : zoom),
      );
      // 커서는 눈금자 스트립 hover 와 같은 함수를 쓴다 — 두 곳이 갈리면
      // "커서는 좌우인데 끌면 위아래" 같은 어긋남이 생긴다 (rulerMetrics 주석)
      applyHit(hit);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (isRulerEventTarget(event.target)) return;
      latest = { x: event.clientX, y: event.clientY };
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        evaluate();
      });
    };

    // 캔버스를 벗어나면 즉시 정리 — 히트 판정은 RAF 뒤에 도는데, 포인터가
    // 이미 나갔으면 그 프레임이 오지 않을 수 있다 (탭이 가려지면 RAF 자체가
    // 멈춘다). 커서가 마지막 상태로 굳는 것을 막는다.
    const onPointerLeave = () => {
      latest = null;
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      applyHit(null);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    return () => {
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      if (frame !== null) cancelAnimationFrame(frame);
      guideHoverCursor = null;
      // 눈금자를 끄면 hover 도 걷는다 — 히트 판정이 ON 한정이라 남겨 두면
      // "잡을 수 있다" 는 표시만 고정된 채 실제로는 잡히지 않는다
      setHoveredGuide(null);
      container.style.cursor = "";
    };
  }, [
    containerRef,
    pageHeight,
    pageWidth,
    screenToCanvasPoint,
    showRulers,
    zoom,
  ]);
}
