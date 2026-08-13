/**
 * 캔버스 가시 영역 인셋 — ADR-181 Phase 1
 *
 * 캔버스 엘리먼트는 workspace 전체를 full-bleed 로 덮고(`main.workspace` 가
 * `position: fixed`, x=0), 좌측 패널 영역(`aside.sidebar`)이 그 **위에** 겹쳐
 * 그려진다. 그래서 캔버스 로컬 x=0 은 화면에 보이지 않는다 — 2026-08-13 실측:
 * 사이드바 폭이 접힘 48px / 패널 열림 281px 이라, 눈금자 세로 스트립(20px)을
 * 캔버스 좌단에 그리면 **통째로 가려진다**.
 *
 * 화면 고정 chrome 은 캔버스 좌단이 아니라 **보이는 영역의 좌단** 에 붙어야
 * 하므로, 그 오프셋을 여기서 한 곳으로 모아 관측한다. 선택자 결합을 이
 * 모듈 밖으로 퍼뜨리지 않는 것이 목적이다.
 *
 * 상단은 인셋이 0 이다 — 캔버스가 앱 헤더 **아래**에서 시작해(y=48) 로컬
 * y=0 이 이미 보이는 첫 줄이다. 우/하단은 눈금자가 닿지 않으므로 대상 아님
 * (가로 스트립의 우측 끝이 우패널 아래로 들어가지만 보이지 않을 뿐이다).
 */

/** 좌측 패널 영역 landmark — 폭이 곧 가시 영역의 좌단 오프셋 */
const LEFT_CHROME_SELECTOR = "aside.sidebar";

export interface CanvasViewportInset {
  /** 가시 영역 좌단 (캔버스 로컬 screen px) */
  left: number;
  /** 가시 영역 상단 (캔버스 로컬 screen px) */
  top: number;
}

export const ZERO_VIEWPORT_INSET: CanvasViewportInset = { left: 0, top: 0 };

/** 현재 인셋을 1회 측정한다 (SSR/미마운트 시 0). */
export function measureCanvasViewportInset(): CanvasViewportInset {
  if (typeof document === "undefined") return ZERO_VIEWPORT_INSET;
  const el = document.querySelector(LEFT_CHROME_SELECTOR);
  if (!el) return ZERO_VIEWPORT_INSET;
  return { left: Math.round(el.getBoundingClientRect().width), top: 0 };
}

/**
 * 인셋 변화를 관측한다. 값이 **바뀔 때만** 콜백한다 (패널 개폐/리사이즈).
 *
 * @returns 관측 해제 함수
 */
export function observeCanvasViewportInset(
  onChange: (inset: CanvasViewportInset) => void,
): () => void {
  if (
    typeof document === "undefined" ||
    typeof ResizeObserver === "undefined"
  ) {
    return () => {};
  }
  const el = document.querySelector(LEFT_CHROME_SELECTOR);
  if (!el) return () => {};

  let last = -1;
  const observer = new ResizeObserver(() => {
    const next = Math.round(el.getBoundingClientRect().width);
    if (next === last) return;
    last = next;
    onChange({ left: next, top: 0 });
  });
  observer.observe(el);
  return () => observer.disconnect();
}
