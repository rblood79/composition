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
  STATIC_SHELL_SKELETON_ID,
  releaseStaticShell,
  releaseStaticShellOutsideBuilder,
  releaseStaticShellSkeleton,
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
 * 셸 wrapper 속성 — 조작 가능해 보이지 않는다 (HC1 · R2). 쌓임: 셸 (9997) < 패널 골격 (9998) <
 * React 부팅 오버레이 (9999, `.loading-overlay`). 셸과 React 오버레이는 같은 프레임에 공존하지 않는다
 * (첫 commit 에서 교체), 골격은 presented 까지 React 의 숨은 chrome 위에 남는다.
 */
export const STATIC_SHELL_ATTRS = {
  id: STATIC_SHELL_ID,
  hidden: true,
  "aria-busy": "true",
  style: "position:fixed;inset:0;z-index:9997;pointer-events:none",
} as const;

export const SHELL_SNAPSHOT_KEY = "composition-shell-snapshot";
export const PANEL_LAYOUT_STORAGE_KEY = "composition-panel-layout";
/** 빌드 id 를 앱에 알리는 meta — 인라인 script 는 같은 값을 인자로 받는다. */
export const SHELL_BUILD_META = "composition-build";

/** 마지막 presented chrome 의 계산 결과 한 칸 — 사각형은 viewport CSS px, 색 · 모양은 computed 값. */
export interface ShellSnapshotBox {
  x: number;
  y: number;
  w: number;
  h: number;
  bg: string;
  bc: string;
  bw: number;
  r: string;
  sh: string;
}

export interface ShellSnapshot {
  v: 1;
  build: string;
  vw: number;
  vh: number;
  /** 저장된 uiScale (없으면 null — 앱 기본값) */
  scale: number | null;
  theme: "light" | "dark";
  /** `composition-panel-layout` 원문 해시 */
  layout: string;
  boxes: ShellSnapshotBox[];
}

/**
 * 패널 배치 원문 해시 (djb2) — 인라인 script 에도 `toString()` 으로 같은 함수를 넘긴다
 * (값 복제 금지 · 하나의 정의). 모듈 스코프를 참조하지 않는다.
 */
export function hashShellLayout(raw: string): string {
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  return `${raw.length}:${(hash >>> 0).toString(36)}`;
}

/**
 * 인라인 script 본체 — `toString()` 으로 주입되므로 모듈 스코프를 참조하지 않는다 (셸 id 도 리터럴).
 * 동기 1 회 · 네트워크 0 · 전체 try/catch (HC6). 저장값이 없거나 깨졌거나 저장소가 예외를 던지면
 * 테마 `auto` 로 그린다.
 *
 * 테마 · UI 배율 해석은 앱과 같은 규칙이다: `composition-ui` (zustand persist `{ state }`) 의
 * `themeMode` — `auto` 면 `prefers-color-scheme` (BuilderCore 테마 effect), `uiScale` 이 있으면
 * `--ui-scale` (uiStore `onRehydrateStorage`).
 */
export function staticShellBoot(
  builderPathPrefix: string,
  build: string,
  hashLayout: (raw: string) => string,
): void {
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

    // 패널 골격 — 마지막 presented 결과가 지금과 같은 조건일 때만 (R1). 어긋나면 최소 셸.
    try {
      const snap = JSON.parse(
        localStorage.getItem("composition-shell-snapshot") || "null",
      );
      if (
        !snap ||
        snap.v !== 1 ||
        snap.build !== build ||
        snap.vw !== innerWidth ||
        snap.vh !== innerHeight ||
        snap.theme !== (dark ? "dark" : "light") ||
        snap.scale !== scale ||
        snap.layout !==
          hashLayout(localStorage.getItem("composition-panel-layout") || "") ||
        !Array.isArray(snap.boxes)
      ) {
        return;
      }
      const layer = document.createElement("div");
      layer.id = "composition-shell-skeleton";
      layer.setAttribute("aria-hidden", "true");
      layer.style.cssText =
        "position:fixed;inset:0;z-index:9998;pointer-events:none";
      for (const box of snap.boxes) {
        const el = document.createElement("div");
        const style = el.style;
        style.cssText =
          "position:absolute;box-sizing:border-box;border-style:solid";
        style.left = `${box.x}px`;
        style.top = `${box.y}px`;
        style.width = `${box.w}px`;
        style.height = `${box.h}px`;
        style.backgroundColor = box.bg;
        style.borderColor = box.bc;
        style.borderWidth = `${box.bw}px`;
        style.borderRadius = box.r;
        style.boxShadow = box.sh;
        layer.appendChild(el);
      }
      shell.after(layer);
    } catch {
      document.getElementById("composition-shell-skeleton")?.remove();
    }
  } catch {
    shell.remove();
  }
}

/** `index.html` 에 넣을 인라인 script 문자열. `base` 는 Vite `base` (`/composition/` · `/`). */
export function renderStaticShellScript(base: string, build: string): string {
  return `(${staticShellBoot.toString()})(${JSON.stringify(`${base}builder/`)},${JSON.stringify(build)},${hashShellLayout.toString()});`;
}
