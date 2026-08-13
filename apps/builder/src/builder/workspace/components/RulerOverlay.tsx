/**
 * 눈금자 오버레이 — ADR-181 Phase 1 (축 2 = A-DOM)
 *
 * 상단(가로)·좌측(세로) 눈금 스트립을 캔버스 **위** DOM 레이어로 그린다.
 * Skia 프레임 예산을 전혀 쓰지 않는다 — 1차 Skia 구현이 최적화 4단계 후에도
 * 예산의 4.9% 를 썼고 잔여분이 래스터화라 더 줄지 않았다 (ADR-181 축 2 실측).
 *
 * **기법은 `DotBackground` 승계** (ADR-902 축 1 채택분):
 * - 눈금선 = 한 주기짜리 `linear-gradient` + `background-repeat` 타일링,
 *   팬은 `background-position` 위상 이동 → 리페인트 없이 컴포지터 처리
 * - 카메라는 `subscribeViewportPresentation` 구독 — Skia 가 읽는
 *   `viewportState` 와 **같은 동기 블록**에서 갱신되므로 값이 갈릴 수 없다
 *   (`ViewportController.notifyUpdateListeners`, ADR-181 HC6)
 * - `will-change` 는 팬 중에만, idle 200ms 후 해제 (ADR-047 상시 금지)
 *
 * 도트 배경에 없는 것은 **라벨**뿐이다 — 값이 팬에 따라 바뀌어 배경 트릭이
 * 통하지 않으므로 span 풀을 재사용해 `textContent`/`transform` 만 갱신한다.
 *
 * z-index 는 3 (ADR-902 `:41` 스택 — skia canvas = 2 위).
 */

import { useEffect, useRef } from "react";

import { useStore } from "../../stores";
import {
  getViewportPresentationSnapshot,
  subscribeViewportPresentation,
} from "../canvas/viewport/viewportPresentation";
import {
  RULER_SIZE_PX,
  calculateRulerAxisMetrics,
  collectRulerLabels,
  type RulerLabel,
} from "./rulerMetrics";
import {
  ZERO_VIEWPORT_INSET,
  measureCanvasViewportInset,
  observeCanvasViewportInset,
  type CanvasViewportInset,
} from "./canvasViewportInset";

/** ADR-047: 상시 will-change 금지 — 팬 중에만 합성 레이어 힌트 */
const WILL_CHANGE_IDLE_MS = 200;

/** 눈금 길이 (screen px) */
const MAJOR_TICK_LEN_PX = 8;
const MINOR_TICK_LEN_PX = 4;

/** 라벨을 눈금선에서 띄우는 여백 (screen px) */
const LABEL_GAP_PX = 3;

/** 눈금자 DOM 식별자 — pointer 가드가 이 속성으로 소속을 판정한다 */
export const RULER_OVERLAY_ATTR = "data-ruler-overlay";

/**
 * 이벤트 타깃이 눈금자 안인가 (ADR-181 R1 — 소속 조기 반환).
 *
 * 캡처 리스너가 `.canvas-container` 에 붙어 있어(`BuilderCanvas.tsx:1155`)
 * 조상 캡처가 스트립 자신의 핸들러보다 먼저 실행되고, hover 는 `window` 라
 * DOM z-order 로는 막히지 않는다. 선택자를 이 함수 하나에 가둔다.
 */
export function isRulerEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${RULER_OVERLAY_ATTR}]`) !== null;
}

function setAxisVars(
  el: HTMLElement,
  metrics: ReturnType<typeof calculateRulerAxisMetrics>,
): void {
  el.style.setProperty("--ruler-major-gap", `${metrics.majorGapPx}px`);
  el.style.setProperty("--ruler-major-phase", `${metrics.majorPhasePx}px`);
  el.style.setProperty("--ruler-major-len", `${MAJOR_TICK_LEN_PX}px`);
  // 보조 눈금 생략 시 길이를 0 으로 — 레이어가 그려지지 않는다 (gap 은 0 금지)
  const hasMinor = metrics.minorGapPx > 0;
  el.style.setProperty(
    "--ruler-minor-gap",
    `${hasMinor ? metrics.minorGapPx : metrics.majorGapPx}px`,
  );
  el.style.setProperty(
    "--ruler-minor-phase",
    `${hasMinor ? metrics.minorPhasePx : 0}px`,
  );
  el.style.setProperty(
    "--ruler-minor-len",
    `${hasMinor ? MINOR_TICK_LEN_PX : 0}px`,
  );
}

/** span 풀 재사용 — 개수가 바뀔 때만 DOM 을 만들고 지운다 */
function syncLabels(
  host: HTMLElement,
  pool: HTMLSpanElement[],
  labels: readonly RulerLabel[],
  axis: "x" | "y",
): void {
  while (pool.length < labels.length) {
    const span = document.createElement("span");
    span.className = `ruler-label ruler-label--${axis}`;
    host.appendChild(span);
    pool.push(span);
  }
  while (pool.length > labels.length) {
    pool.pop()?.remove();
  }
  for (let i = 0; i < labels.length; i++) {
    const el = pool[i];
    const { text, pos } = labels[i];
    if (el.textContent !== text) el.textContent = text;
    el.style.transform =
      axis === "x"
        ? `translateX(${pos + LABEL_GAP_PX}px)`
        : `translateY(${pos + LABEL_GAP_PX}px)`;
  }
}

export interface RulerOverlayProps {
  /**
   * 눈금자 스트립 드래그로 가이드를 만든다 (ADR-181 Phase 5).
   * axis 는 스트립 방향이 정한다 — 가로 자에서 끌면 세로 가이드("x").
   */
  onStartGuideCreate?: (
    axis: "x" | "y",
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => void;
}

export function RulerOverlay({ onStartGuideCreate }: RulerOverlayProps = {}) {
  const showRulers = useStore((state) => state.showRulers);

  const rootRef = useRef<HTMLDivElement>(null);
  const hStripRef = useRef<HTMLDivElement>(null);
  const vStripRef = useRef<HTMLDivElement>(null);
  const hLabelsRef = useRef<HTMLDivElement>(null);
  const vLabelsRef = useRef<HTMLDivElement>(null);

  const hPoolRef = useRef<HTMLSpanElement[]>([]);
  const vPoolRef = useRef<HTMLSpanElement[]>([]);
  const insetRef = useRef<CanvasViewportInset>(ZERO_VIEWPORT_INSET);
  const sizeRef = useRef({ width: 0, height: 0 });
  const willChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWillChangeActiveRef = useRef(false);

  useEffect(() => {
    if (!showRulers) return;
    const root = rootRef.current;
    const hStrip = hStripRef.current;
    const vStrip = vStripRef.current;
    const hLabels = hLabelsRef.current;
    const vLabels = vLabelsRef.current;
    if (!root || !hStrip || !vStrip || !hLabels || !vLabels) return;

    const strips = [hStrip, vStrip];

    const apply = () => {
      const { x, y, scale } = getViewportPresentationSnapshot();
      const inset = insetRef.current;
      const { width, height } = sizeRef.current;

      root.style.setProperty("--ruler-inset-left", `${inset.left}px`);
      root.style.setProperty("--ruler-inset-top", `${inset.top}px`);
      root.style.setProperty("--ruler-size", `${RULER_SIZE_PX}px`);

      // 가로 자: 스트립 로컬 원점 = 가시 영역 좌단
      const xAxis = { pan: x, zoom: scale, origin: inset.left };
      // 세로 자: 코너 아래에서 시작 — 원점이 스트립 두께만큼 내려간다
      const yAxis = {
        pan: y,
        zoom: scale,
        origin: inset.top + RULER_SIZE_PX,
      };

      setAxisVars(hStrip, calculateRulerAxisMetrics(xAxis));
      setAxisVars(vStrip, calculateRulerAxisMetrics(yAxis));

      const hLength = Math.max(0, width - inset.left);
      const vLength = Math.max(0, height - inset.top - RULER_SIZE_PX);
      // 가로 자의 앞 RULER_SIZE_PX 는 코너에 가려지므로 라벨을 만들지 않는다
      syncLabels(
        hLabels,
        hPoolRef.current,
        collectRulerLabels(xAxis, hLength, RULER_SIZE_PX),
        "x",
      );
      syncLabels(
        vLabels,
        vPoolRef.current,
        collectRulerLabels(yAxis, vLength),
        "y",
      );

      if (!isWillChangeActiveRef.current) {
        for (const el of strips) el.style.willChange = "background-position";
        isWillChangeActiveRef.current = true;
      }
      if (willChangeTimerRef.current !== null) {
        clearTimeout(willChangeTimerRef.current);
      }
      willChangeTimerRef.current = setTimeout(() => {
        for (const el of strips) el.style.willChange = "";
        isWillChangeActiveRef.current = false;
        willChangeTimerRef.current = null;
      }, WILL_CHANGE_IDLE_MS);
    };

    // 크기는 ResizeObserver 로 캐시 — apply 에서 레이아웃을 읽으면 팬마다
    // 강제 리플로가 걸린다
    const syncSize = () => {
      const rect = root.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
    };
    syncSize();
    const sizeObserver = new ResizeObserver(() => {
      syncSize();
      apply();
    });
    sizeObserver.observe(root);

    insetRef.current = measureCanvasViewportInset();
    const stopInset = observeCanvasViewportInset((next) => {
      insetRef.current = next;
      apply();
    });

    apply();
    const unsubscribe = subscribeViewportPresentation(apply);

    return () => {
      unsubscribe();
      stopInset();
      sizeObserver.disconnect();
      if (willChangeTimerRef.current !== null) {
        clearTimeout(willChangeTimerRef.current);
        willChangeTimerRef.current = null;
      }
      isWillChangeActiveRef.current = false;
      for (const pool of [hPoolRef.current, vPoolRef.current]) {
        for (const el of pool) el.remove();
        pool.length = 0;
      }
    };
  }, [showRulers]);

  if (!showRulers) return null;

  // 가로 자에서 끌어내면 **세로** 가이드다 (자가 재는 축과 만드는 선이 직교).
  // pointer capture 는 걸지 않는다 — 세션이 window 리스너로 이어지고, capture
  // 를 걸면 캔버스 위에서 `elementFromPoint` 대신 캡처 대상이 잡혀 되돌리기
  // 판정이 죽는다.
  const startCreate = (axis: "x" | "y") => (event: React.PointerEvent) => {
    if (event.button !== 0 || !onStartGuideCreate) return;
    event.preventDefault();
    onStartGuideCreate(axis, event.pointerId, event.clientX, event.clientY);
  };

  return (
    <div
      className="ruler-overlay"
      ref={rootRef}
      {...{ [RULER_OVERLAY_ATTR]: "" }}
    >
      <div
        className="ruler-strip ruler-strip--h"
        ref={hStripRef}
        onPointerDown={startCreate("x")}
      >
        <div className="ruler-labels" ref={hLabelsRef} />
      </div>
      <div
        className="ruler-strip ruler-strip--v"
        ref={vStripRef}
        onPointerDown={startCreate("y")}
      >
        <div className="ruler-labels" ref={vLabelsRef} />
      </div>
      <div className="ruler-corner" />
    </div>
  );
}
