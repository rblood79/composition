/// <reference lib="dom" />
/**
 * ADR-247 — cold entry 정적 셸.
 *
 * 빌더 URL 로 곧장 들어오면 initial JS 가 실행되기 전까지 문서가 아무것도 칠하지 않는다 (흰 화면,
 * 다크 테마면 흰색 → 어두운 화면). `index.html` 에 셸 마크업과 인라인 script 를 넣어 CSS 가 도착한
 * 첫 paint 부터 부팅 화면 (캔버스 배경 + 진행 막대) 을 그리고, React 첫 commit 이 같은 자리에서
 * 이어받는다.
 *
 * 셸은 **앱과 같은 class** (`.app` · `.canvas-container` · `.loading-*`) 로 그린다 — 색 · 크기 ·
 * UI 배율 (`.app { zoom }`) 은 render-blocking stylesheet 인 main CSS 가 앱과 똑같이 준다. 값을
 * 옮겨 적지 않는다 (HC4). 점 배경은 그리지 않는다 — 점 격자는 캔버스 pan/zoom 에서 나오는 값이라
 * 셸이 알 수 없고 (`dotBackgroundMetrics.ts`), 틀린 격자가 움직이는 것보다 첫 commit 에서 나타나는
 * 편이 덜 튄다.
 *
 * vite.config.ts `staticShellPlugin()` 이 이 파일로 `index.html` (→ `404.html`) 에 주입한다.
 */

import { STATIC_SHELL_ID } from "./staticShellRelease";

export {
  STATIC_SHELL_ID,
  releaseStaticShell,
  releaseStaticShellOutsideBuilder,
} from "./staticShellRelease";

/** 셸 노드 — `hidden` 으로 시작하고 builder 경로에서만 인라인 script 가 푼다. */
export const STATIC_SHELL_MARKUP =
  '<div class="app builder-booting" data-context="builder">' +
  '<div class="canvas-container"></div>' +
  '<div class="loading-overlay"><div class="loading-content"><div class="loading-status">' +
  '<div class="loading-progress"></div>' +
  "</div></div></div>" +
  "</div>";

/**
 * 셸 wrapper 속성 — 조작 가능해 보이지 않는다 (HC1 · R2). 쌓임: 셸 (9997) < React 부팅 오버레이
 * (9999, `.loading-overlay`). 둘은 같은 프레임에 공존하지 않는다 (첫 commit 에서 교체).
 *
 * 패널 골격 (마지막 presented chrome 스냅샷) 은 두지 않는다 — 2026-09-29 사용자 결정으로 제거.
 * 새로고침도 대시보드 → 프로젝트 이동과 같게, chrome 은 presented 순간에 한 번에 드러난다.
 */
export const STATIC_SHELL_ATTRS = {
  id: STATIC_SHELL_ID,
  hidden: true,
  "aria-busy": "true",
  style: "position:fixed;inset:0;z-index:9997;pointer-events:none",
} as const;

/**
 * 인라인 script 본체 — `toString()` 으로 주입되므로 모듈 스코프를 참조하지 않는다 (셸 id 도 리터럴).
 * 동기 1 회 · 네트워크 0 · 전체 try/catch (HC6). 저장값이 없거나 깨졌거나 저장소가 예외를 던지면
 * 테마 `auto` 로 그린다.
 *
 * 테마 · UI 배율 해석은 앱과 같은 규칙이다: `composition-ui` (zustand persist `{ state }`) 의
 * `themeMode` — `auto` 면 `prefers-color-scheme` (BuilderCore 테마 effect), `uiScale` 이 있으면
 * `--ui-scale` (uiStore `onRehydrateStorage`).
 */
export function staticShellBoot(builderPathPrefix: string): void {
  const shell = document.getElementById("composition-shell");
  if (!shell) return;
  try {
    if (location.pathname.indexOf(builderPathPrefix) !== 0) {
      shell.remove();
      return;
    }
    let state: { themeMode?: unknown; uiScale?: unknown } = {};
    try {
      const raw = localStorage.getItem("composition-ui");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.state === "object" && parsed.state) {
        state = parsed.state;
      }
    } catch {
      state = {};
    }
    const mode = state.themeMode;
    const dark =
      mode === "dark" ||
      (mode !== "light" &&
        typeof matchMedia === "function" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    const html = document.documentElement;
    html.setAttribute("data-builder-theme", dark ? "dark" : "light");
    const scale =
      typeof state.uiScale === "number" && state.uiScale > 0
        ? state.uiScale
        : null;
    if (scale !== null) html.style.setProperty("--ui-scale", String(scale));
    shell.hidden = false;
  } catch {
    shell.remove();
  }
}

/** `index.html` 에 넣을 인라인 script 문자열. `base` 는 Vite `base` (`/composition/` · `/`). */
export function renderStaticShellScript(base: string): string {
  return `(${staticShellBoot.toString()})(${JSON.stringify(`${base}builder/`)});`;
}
