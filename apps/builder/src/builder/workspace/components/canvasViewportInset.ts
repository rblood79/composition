/**
 * 캔버스 가시 영역 인셋 — ADR-181 Phase 1 (2026-10-01 떠 있는 chrome 기준으로 갱신)
 *
 * 캔버스는 창 전체를 full-bleed 로 덮고, 앱 헤더 (`.panel-dock-chrome > .header`) 와
 * 좌측 패널 토글 레일 (`.panel-toggle-rail[data-side="left"]`) 이 그 **위에** 떠 있다.
 * 캔버스 로컬 좌상단은 두 chrome 밑이라, 눈금자 스트립 (20px) 을 캔버스 모서리에 그리면
 * 보이기는 해도 누르는 입력을 chrome 이 가져가 가이드를 끌어낼 수 없다 (2026-10-01 실측:
 * 헤더 y 4–44 · 레일 x 4–44 가 스트립 전체를 덮음).
 *
 * 그래서 눈금자는 **헤더 아래 · 레일 오른쪽** 에서 시작한다. 선택자 결합을 이 모듈 밖으로
 * 퍼뜨리지 않는 것이 목적이다. 옛 기준 (`aside.sidebar` 폭, 헤더 아래에서 시작하는 캔버스)
 * 은 떠 있는 패널 작업 공간으로 바뀌며 사라졌다.
 */

const TOP_CHROME_SELECTOR = ".panel-dock-chrome > .header";
const LEFT_CHROME_SELECTOR = '.panel-toggle-rail[data-side="left"]';

export interface CanvasViewportInset {
  /** 가시 영역 좌단 (캔버스 로컬 screen px) */
  left: number;
  /** 가시 영역 상단 (캔버스 로컬 screen px) */
  top: number;
}

export const ZERO_VIEWPORT_INSET: CanvasViewportInset = { left: 0, top: 0 };

function edge(selector: string, side: "right" | "bottom"): number {
  const el = document.querySelector(selector);
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? Math.max(0, Math.round(rect[side]))
    : 0;
}

/** 현재 인셋을 1회 측정한다 (SSR/미마운트 시 0). */
export function measureCanvasViewportInset(): CanvasViewportInset {
  if (typeof document === "undefined") return ZERO_VIEWPORT_INSET;
  return {
    left: edge(LEFT_CHROME_SELECTOR, "right"),
    top: edge(TOP_CHROME_SELECTOR, "bottom"),
  };
}

/**
 * 인셋 변화를 관측한다 — 두 chrome 의 크기 변화와 창 크기 변화. 값이 바뀔 때만 알린다.
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
  let last = measureCanvasViewportInset();
  const check = () => {
    const next = measureCanvasViewportInset();
    if (next.left === last.left && next.top === last.top) return;
    last = next;
    onChange(next);
  };
  const observer = new ResizeObserver(check);
  for (const selector of [TOP_CHROME_SELECTOR, LEFT_CHROME_SELECTOR]) {
    const el = document.querySelector(selector);
    if (el) observer.observe(el);
  }
  window.addEventListener("resize", check);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", check);
  };
}
