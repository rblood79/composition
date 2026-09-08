/**
 * 토스트가 contextual action bar 를 덮지 않도록 필요한 만큼만 띄우는 여유값.
 *
 * Why: 둘 다 캔버스 우하단에 떠 있고 토스트는 되돌리기 때문에 12초까지 머문다
 * (`nestingNotice.ts`). 기본 배치에서는 CSS 의 고정 offset 으로 충분하지만, 바는
 * 사용자가 끌어다 놓을 수 있어 (ADR-192) 토스트 자리로 들어올 수 있다. 그때만
 * 바 위로 올린다 — 겹치지 않으면 0 이라 평소 위치는 CSS 가 그대로 소유한다.
 *
 * 바의 위치는 store 가 아니라 인라인 style 로 산출되므로 (`placement.style`) DOM 을
 * 읽는다. 드래그 중에도 따라가도록 style 변경과 창 크기 변경을 같이 관찰한다.
 */
import { useEffect, useRef, useState, type RefObject } from "react";

const ACTION_BAR_SELECTOR = ".contextual-action-bar";
/** 바와 토스트 사이 최소 간격 — chrome island 끼리의 시각 분리. */
const GAP = 8;

/**
 * 지금 필요한 **절대** 여유값을 돌려준다. 증분이 아니라 절대값이라 바가 물러나면
 * 0 으로 돌아온다 (증분 누적은 한 번 올라간 토스트가 영영 안 내려온다).
 *
 * @param appliedClearance 지금 rect 에 이미 반영돼 있는 값 — 기준선을 되돌리는 데 쓴다.
 */
export function measureClearance(
  container: HTMLElement | null,
  appliedClearance: number,
): number {
  if (!container) return 0;
  const bar = document.querySelector(ACTION_BAR_SELECTOR);
  if (!(bar instanceof HTMLElement)) return 0;

  const barRect = bar.getBoundingClientRect();
  if (barRect.width === 0 || barRect.height === 0) return 0;

  const toastRect = container.getBoundingClientRect();
  if (toastRect.width === 0) return 0;

  // 가로로 안 겹치면 세로를 건드릴 이유가 없다.
  if (barRect.right <= toastRect.left || barRect.left >= toastRect.right) {
    return 0;
  }

  // CSS 기본 위치 기준으로 환산한 뒤, 바 윗선까지 올리는 데 필요한 값을 낸다.
  const baseBottomGap =
    window.innerHeight - toastRect.bottom - appliedClearance;
  const neededBottomGap = window.innerHeight - barRect.top + GAP;
  return Math.max(0, Math.round(neededBottomGap - baseBottomGap));
}

/**
 * @param containerRef 토스트 컨테이너
 * @param active 토스트가 떠 있는 동안만 관찰한다
 * @returns CSS `bottom` 에 더할 px. 0 이면 CSS 기본값 그대로.
 */
export function useActionBarClearance(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
): number {
  const [clearance, setClearance] = useState(0);
  /** 현재 DOM 에 반영된 값 — measure 가 기준선을 되돌릴 때 읽는다. */
  const appliedRef = useRef(0);

  useEffect(() => {
    appliedRef.current = clearance;
  }, [clearance]);

  useEffect(() => {
    if (!active) {
      appliedRef.current = 0;
      setClearance(0);
      return;
    }

    let frame = 0;
    const update = (): void => {
      cancelAnimationFrame(frame);
      // 방금 올린 값이 반영된 rect 를 보도록 한 프레임 뒤에 읽는다.
      frame = requestAnimationFrame(() => {
        const next = measureClearance(containerRef.current, appliedRef.current);
        setClearance((prev) => (Math.abs(next - prev) < 1 ? prev : next));
      });
    };

    update();
    window.addEventListener("resize", update);

    const bar = document.querySelector(ACTION_BAR_SELECTOR);
    const observer = new MutationObserver(update);
    if (bar) {
      // 바의 위치는 인라인 style 로 바뀐다 (드래그 · page anchor 갱신 둘 다).
      observer.observe(bar, { attributes: true, attributeFilter: ["style"] });
    } else {
      // 아직 없으면 (선택 없음) 나타나는 시점에 다시 잰다.
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [active, containerRef]);

  return clearance;
}
