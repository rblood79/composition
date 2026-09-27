/**
 * ADR-247 Phase 2 — 마지막 presented chrome 의 계산 결과를 다음 cold entry 의 패널 골격으로 남긴다.
 *
 * 저장하는 값은 solver · 토큰을 다시 계산한 값이 아니라 **브라우저가 그린 결과** 다
 * (`getBoundingClientRect` · `getComputedStyle`, HC4). 인라인 script (`staticShell.ts`
 * `staticShellBoot`) 가 빌드 id · viewport · UI 배율 · 테마 · 패널 배치 원문이 모두 같을 때만 이 값을
 * 그린다 — 하나라도 다르면 최소 셸 (R1).
 *
 * 기록 시점: presented 직후 idle 1 회뿐. presented 순간의 chrome 은 **영속 상태 (배치 · 배율 · 테마)
 * 와 viewport 만으로** 정해진다 — 다음 진입이 같은 조건이면 같은 geometry 다. 세션 중이나 떠나는
 * 순간에 쓰면 저장되지 않는 상태 (Compare Mode 등) 가 섞인다: 2026-09-27 하니스에서 Compare Mode 를
 * 켠 채 떠난 스냅샷이 다음 진입 헤더 섬 폭과 36 px 어긋났다. 배치 · viewport 를 바꾼 뒤 첫 진입은
 * 일치 키가 달라 최소 셸이고, 그 진입의 presented 가 새 스냅샷을 쓴다.
 */
import {
  PANEL_LAYOUT_STORAGE_KEY,
  SHELL_BUILD_META,
  SHELL_SNAPSHOT_KEY,
  hashShellLayout,
  type ShellSnapshot,
  type ShellSnapshotBox,
} from "./staticShell";

/**
 * 골격으로 옮길 chrome 루트 — 부팅 중 `visibility:hidden` 인 헤더 · 패널 dock (error-loading.css).
 * 루트 아래에서 **가장 바깥의 칠해진 상자** (배경 · 테두리 · 그림자가 있는 요소) 만 옮기고 그 안으로는
 * 내려가지 않는다 — 헤더 섬 · 레일 · 패널 frame 이 되고, 안의 버튼 · 입력 모양은 그리지 않는다 (R2).
 */
export const SHELL_SKELETON_ROOTS = [".header", ".panel-dock-stage"];
const SHELL_SKELETON_MAX_DEPTH = 10;
const SHELL_SKELETON_MAX_BOXES = 40;

/** 스냅샷 상한 — 넘으면 쓰지 않고 지운다 (인라인 script 파싱 비용 · 저장소 여유). */
export const SHELL_SNAPSHOT_MAX_BYTES = 8 * 1024;

const round = (value: number) => Math.round(value * 100) / 100;

function readBuildId(): string | null {
  return (
    document
      .querySelector<HTMLMetaElement>(`meta[name="${SHELL_BUILD_META}"]`)
      ?.getAttribute("content") ?? null
  );
}

function readStoredUiScale(): number | null {
  try {
    const parsed = JSON.parse(localStorage.getItem("composition-ui") ?? "null");
    const scale = parsed?.state?.uiScale;
    return typeof scale === "number" && scale > 0 ? scale : null;
  } catch {
    return null;
  }
}

const TRANSPARENT = new Set(["rgba(0, 0, 0, 0)", "transparent"]);

/** 보이고 칠해진 상자면 그 값, 보이지만 칠해지지 않았으면 "descend", 안 보이면 null. */
function toBox(element: Element): ShellSnapshotBox | "descend" | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility !== "visible") return null;
  const hasBorder =
    style.borderTopStyle !== "none" &&
    style.borderTopStyle !== "hidden" &&
    parseFloat(style.borderTopWidth) > 0;
  const painted =
    !TRANSPARENT.has(style.backgroundColor) ||
    hasBorder ||
    (style.boxShadow !== "" && style.boxShadow !== "none");
  if (!painted) return "descend";
  return {
    x: round(rect.x),
    y: round(rect.y),
    w: round(rect.width),
    h: round(rect.height),
    bg: style.backgroundColor,
    bc: style.borderTopColor,
    bw: hasBorder ? parseFloat(style.borderTopWidth) : 0,
    r: style.borderRadius,
    sh: style.boxShadow,
  };
}

/** presented 된 builder chrome 을 읽는다. 부팅 중이거나 빌드 id 가 없으면 null. */
export function captureShellSnapshot(): ShellSnapshot | null {
  const build = readBuildId();
  if (!build) return null;
  const app = document.querySelector("#root .app:not(.builder-booting)");
  const theme = document.documentElement.getAttribute("data-builder-theme");
  if (!app || (theme !== "light" && theme !== "dark")) return null;
  const boxes: ShellSnapshotBox[] = [];
  const visit = (element: Element, depth: number): void => {
    if (boxes.length >= SHELL_SKELETON_MAX_BOXES) return;
    const box = toBox(element);
    if (box === null) return;
    if (box !== "descend") {
      boxes.push(box);
      return;
    }
    if (depth >= SHELL_SKELETON_MAX_DEPTH) return;
    for (const child of element.children) visit(child, depth + 1);
  };
  for (const selector of SHELL_SKELETON_ROOTS) {
    for (const root of app.querySelectorAll(selector)) visit(root, 0);
  }
  return {
    v: 1,
    build,
    vw: window.innerWidth,
    vh: window.innerHeight,
    scale: readStoredUiScale(),
    theme,
    layout: hashShellLayout(
      localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY) ?? "",
    ),
    boxes,
  };
}

/** 스냅샷을 쓴다. 못 읽거나 상한을 넘으면 지난 값을 지워 틀린 골격이 남지 않게 한다. */
export function writeShellSnapshot(): void {
  try {
    const snapshot = captureShellSnapshot();
    const json = snapshot ? JSON.stringify(snapshot) : null;
    if (!json || json.length > SHELL_SNAPSHOT_MAX_BYTES) {
      localStorage.removeItem(SHELL_SNAPSHOT_KEY);
      return;
    }
    localStorage.setItem(SHELL_SNAPSHOT_KEY, json);
  } catch {
    // 저장소 예외 (용량 · 사생활 모드) — 다음 진입은 최소 셸이다 (HC6).
  }
}
