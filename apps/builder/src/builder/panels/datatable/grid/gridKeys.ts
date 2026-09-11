/**
 * 격자 키 라우팅 — ADR-212 Phase 2 R1 (충돌 매트릭스).
 *
 * RAC Table 은 `keyboardNavigationBehavior="tab"` 에서 Arrow · Home/End (셀 이동) · Tab (격자
 * 밖으로 — 단일 tab stop) · Esc (선택 해제) 를 갖는다. 셀 편집기는 그 위에 자기 키 (Enter · F2 ·
 * 타이핑 → 진입, Enter/Tab → commit + 이동, Esc → 취소) 를 얹는데, 두 층이 같은 키를 다르게 읽는
 * 조합을 여기 한 표로 고정한다. 컴포넌트는 결과 action 만 실행한다:
 *
 * - `pass`  — 아무것도 안 함 (RAC · 전역 단축키가 처리)
 * - `stop`  — `stopPropagation` 만 (input 의 caret · 타이핑은 살리고 RAC 셀 이동은 막는다)
 * - 나머지 — `preventDefault` + `stopPropagation` + 편집기 동작
 */
export interface GridKeyInput {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export interface GridKeyContext {
  /** 셀 편집 input 이 열려 있고 그 안에 포커스가 있다 */
  editing: boolean;
  /** keydown target 이 `role=gridcell` 자체다 (자식 버튼 · 툴바가 아니다) */
  targetIsCell: boolean;
}

export type GridKeyAction =
  | { type: "pass" }
  | { type: "stop" }
  | { type: "start-edit"; initialDraft?: string }
  | { type: "clear-cell" }
  | { type: "commit"; move: "down" | "up" | "right" | "left" }
  | { type: "cancel" }
  | { type: "revert-draft" };

const RAC_NAVIGATION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

function isPrintable(input: GridKeyInput): boolean {
  return (
    input.key.length === 1 &&
    input.key !== " " &&
    !input.metaKey &&
    !input.ctrlKey &&
    !input.altKey
  );
}

function isCommand(input: GridKeyInput): boolean {
  return input.metaKey || input.ctrlKey;
}

export function resolveGridKey(
  input: GridKeyInput,
  ctx: GridKeyContext,
): GridKeyAction {
  if (ctx.editing) {
    if (isCommand(input)) {
      if (input.key.toLowerCase() === "z" && !input.altKey) {
        return input.shiftKey ? { type: "stop" } : { type: "revert-draft" };
      }
      // ⌘C · ⌘V · ⌘A … — input 기본 동작. 전역 registry 는 input 을 존중한다.
      return { type: "pass" };
    }
    switch (input.key) {
      case "Enter":
        return { type: "commit", move: input.shiftKey ? "up" : "down" };
      case "Tab":
        return { type: "commit", move: input.shiftKey ? "left" : "right" };
      case "Escape":
        return { type: "cancel" };
      default:
        // Arrow · Home/End (caret) · 타이핑 · Delete · Space · F2 — input 이 갖고 RAC 는 못 본다
        return { type: "stop" };
    }
  }

  if (!ctx.targetIsCell) return { type: "pass" };
  if (isCommand(input) || input.altKey) return { type: "pass" };
  if (RAC_NAVIGATION_KEYS.has(input.key)) return { type: "pass" };

  switch (input.key) {
    case "Enter":
    case "F2":
      return { type: "start-edit" };
    case "Delete":
    case "Backspace":
      return { type: "clear-cell" };
    case "Tab":
    case "Escape":
    case " ":
      return { type: "pass" };
    default:
      return isPrintable(input)
        ? { type: "start-edit", initialDraft: input.key }
        : { type: "pass" };
  }
}
