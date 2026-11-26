import type { ComponentRule } from "../../types/catalog-style.types";
import { RESIZABLE_CHROME_SELECTORS } from "../document/resizableChrome";

/**
 * ADR-318 — Resizable 분할창의 rule (D3). 크기 몫 · 최소 · 최대는 rule 이 아니라 Panel 의 파생 값
 * (`runtime/resizablePanels.ts` — 두 consumer 가 같은 flex 값을 쓴다) 이고, 여기는 상자 모양만 둔다.
 *
 * - Group: flex 줄 (`orientation` 이 방향 — 파생 없이 자기 prop), 넘치는 내용은 자른다.
 * - Panel: 자유 내용의 세로 flex 상자 · 넘침을 자른다 — overflow hidden 이라 몫보다 넓은 내용이
 *   있어도 자동 최소가 0 이다 (Phase 0 P1 「넓은 내용」 fixture).
 * - Handle: 선 하나 — 두께 1px (reui `w-px` · `bg-border`), Group 축과 직각으로 늘어난다. 두께의 축과
 *   Group 의 방향은 파생 값 (`presence.ts`) 을 두 consumer 가 같이 쓴다 — Canvas 배치는 rule 의
 *   `containerVariants` 를 읽지 않는다 (G1 live 2026-11-26: Handle 폭 Canvas 0 · DOM 1). 색은 S2 Divider S · M 과
 *   같은 토큰 (`Separator` rule). 잡는 영역 · grip · pill · 상태 칠은 Phase 2 · 4.
 */

const NO_PADDING_SIZES = {
  M: {
    height: 0,
    fontSize: "{typography.text-base}",
    borderRadius: "{radius.none}",
  },
} satisfies ComponentRule["sizes"];

const groupBox = {
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  overflow: "hidden",
};

export const RESIZABLE_PANEL_GROUP_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: NO_PADDING_SIZES,
  containerStyles: groupBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: groupBox,
    // (The vertical direction is the Group's derived value — `catalogResizableLayout`, both consumers.)
    composition: { delegation: [] },
  },
};

const panelBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  overflow: "hidden",
};

export const RESIZABLE_PANEL_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: NO_PADDING_SIZES,
  containerStyles: panelBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: panelBox,
    composition: { delegation: [] },
  },
};

/** The keyboard focus ring (the other controls' `{focus.ring.default}`). */
const HANDLE_FOCUS_RING = {
  focusRing: { isFocusVisible: "{focus.ring.default}" },
} as const;

const handleBox = {
  display: "block",
  flexGrow: "0",
  flexShrink: "0",
  alignSelf: "stretch",
};

// (Phase 4 — 사용자 결정 7: one pill. Both variants draw the same line; the pill is the chrome over
//  it — `document/resizableChrome.ts`, the DOM's `::before` and the Canvas's shape.)
const handleLine = {
  paint: { backgroundColor: { default: "{color.neutral-surface-hover}" } },
};

export const RESIZABLE_HANDLE_RULE: ComponentRule = {
  defaultVariant: "line",
  defaultSize: "M",
  variants: { line: handleLine, pill: handleLine },
  sizes: NO_PADDING_SIZES,
  containerStyles: handleBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: handleBox,
    stateStyles: { ...HANDLE_FOCUS_RING },
    // (Its thickness on the Group's axis is a derived value — `catalogResizableLayout`,
    //  `RESIZABLE_HANDLE_THICKNESS` — both consumers.)
    // Phase 2 — DOM-only interaction values (the Canvas draws no hit area and no cursor — breakdown
    //  §5.2): the grab area is wider than the line (a pseudo element out of the layout, 4px each side
    //  — reui `after:w-1`; Phase 0 P3: without it a 1px line's centre can hit the Panel's iframe), the
    //  axis cursor, no touch scrolling or text selection while dragging.
    composition: {
      delegation: [],
      rootSelectors: {
        "&": {
          styles: {
            position: "relative",
            "touch-action": "none",
            "user-select": "none",
          },
        },
        "&::after": {
          styles: { content: '""', position: "absolute", "z-index": "1" },
        },
        // (The axis cursor is the grab area's — a state of the Handle itself goes in the state tree,
        //  ADR-297; the grab area covers the line.)
        '&[data-orientation="horizontal"]::after': {
          styles: { inset: "0 -4px", cursor: "col-resize" },
        },
        '&[data-orientation="vertical"]::after': {
          styles: { inset: "-4px 0", cursor: "row-resize" },
        },
        '&[aria-disabled="true"]::after': { styles: { cursor: "default" } },
        // (A nested Group's Handle meets its outer Handle at a T: there the outer line wins — the
        //  inner grab area goes one layer down. G2 live 2026-11-26: the outer line's centre took the
        //  inner Handle's drag.)
        "&[data-nested]::after": { styles: { "z-index": "0" } },
        ...RESIZABLE_CHROME_SELECTORS,
      },
    },
  },
};
