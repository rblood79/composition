/**
 * Theme Watcher Service (ADR-035 Phase 6)
 *
 * 빌더 테마 변경(data-builder-theme 속성 + OS 다크모드)을 감지하여
 * Skia 콘텐츠 캐시 무효화를 트리거한다.
 *
 * 배경색 hex 판독(1px 캔버스 픽셀 readback)은 제거됨 — ADR-109 D4 로
 * renderer 가 background color 를 보유하지 않게 된 뒤 유일 소비자
 * (SkiaCanvas)가 hex 를 버리고 invalidation 만 수행했다.
 *
 * SkiaOverlay에서 추출된 독립 서비스.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.7
 */

/**
 * CSS hex → [r, g, b] (0..1) 변환
 */
export function hexToColor4fChannels(hex: number): [number, number, number] {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return [r, g, b];
}

export interface ThemeWatcherCallbacks {
  onThemeChange: () => void;
}

export interface ThemeWatcherHandle {
  disconnect: () => void;
}

/**
 * 빌더 테마 변경 감지를 설정한다.
 *
 * @param callbacks - 테마 변경 시 호출할 콜백
 * @returns disconnect 핸들
 */
export function setupThemeWatcher(
  callbacks: ThemeWatcherCallbacks,
): ThemeWatcherHandle {
  // rAF 로 미뤄 새 테마의 CSS 변수가 적용된 뒤 재렌더가 읽게 한다
  const notifyThemeChange = () => {
    requestAnimationFrame(() => callbacks.onThemeChange());
  };

  // data-builder-theme 속성 변경 감지
  const themeObserver = new MutationObserver(notifyThemeChange);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-builder-theme"],
  });

  // OS 다크모드 전환 감지 (빌더 테마 "system" 모드)
  const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  darkModeQuery.addEventListener("change", notifyThemeChange);

  return {
    disconnect: () => {
      themeObserver.disconnect();
      darkModeQuery.removeEventListener("change", notifyThemeChange);
    },
  };
}
