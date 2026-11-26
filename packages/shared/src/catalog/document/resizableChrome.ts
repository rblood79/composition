/**
 * ADR-318 Phase 4 — a Resizable Handle's pill and grip (사용자 결정 7, 2026-11-26: one pill). The DOM
 * (the Handle rule's `rootSelectors` — the pill is its `::before`, the grip its child `span`) and the
 * Canvas (`ruleShapes.ts` `resizableHandleShapes`) read these values (the Sheet handle's way —
 * `sheetChrome.ts`). reui examples 5 · 8: a capsule on the line's middle, 24 long at rest, longer on
 * hover, longest and thicker and accent while dragged.
 *
 * The pill is 6 × 48 at its largest and scaled down per state (a `transform` — the compositor animates
 * it, no layout); the Canvas draws each state's resting shape (`같은 상태에서 같은 모양`, R8).
 */

export type ResizableChromeState = "rest" | "hover" | "pressed";

export const RESIZABLE_PILL = {
  /** The largest pill (the pressed one) — the other states scale it. */
  thickness: 6,
  length: 48,
  states: {
    rest: { thickness: 4, length: 24, color: "var(--border)" },
    hover: { thickness: 4, length: 40, color: "var(--border-hover)" },
    pressed: { thickness: 6, length: 48, color: "var(--accent)" },
  },
  /** ms — reui `duration-300` with its ease. */
  duration: 300,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** shadcn / reui `withHandle`: a small box with a grip glyph on the line's middle. */
export const RESIZABLE_GRIP = {
  /** Across × along the line (a horizontal Group's line is vertical: 12 wide, 16 tall). */
  across: 12,
  along: 16,
  radius: 4,
  color: "var(--border)",
  glyphSize: 10,
  glyphColor: "var(--neutral-content)",
} as const;

/** The grip glyph per Group axis (the box turns with the line — no rotation, the matching glyph). */
export function catalogResizableGripGlyph(groupAxis: "row" | "column"): string {
  return groupAxis === "row" ? "grip-vertical" : "grip-horizontal";
}

/**
 * The pill's box in the Handle's box (its middle), for a Group axis and a state — the Canvas's
 * shape. A row Group's line is vertical: the pill is `thickness` wide and `length` tall.
 */
export function catalogResizablePillRect(
  groupAxis: "row" | "column",
  state: ResizableChromeState,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const { thickness, length } = RESIZABLE_PILL.states[state];
  const w = groupAxis === "row" ? thickness : length;
  const h = groupAxis === "row" ? length : thickness;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/** The grip's box in the Handle's box (its middle). */
export function catalogResizableGripRect(
  groupAxis: "row" | "column",
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const w = groupAxis === "row" ? RESIZABLE_GRIP.across : RESIZABLE_GRIP.along;
  const h = groupAxis === "row" ? RESIZABLE_GRIP.along : RESIZABLE_GRIP.across;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

const scale = (state: ResizableChromeState, groupAxis: "row" | "column") => {
  const { thickness, length } = RESIZABLE_PILL.states[state];
  const across = thickness / RESIZABLE_PILL.thickness;
  const along = length / RESIZABLE_PILL.length;
  return groupAxis === "row"
    ? `translate(-50%, -50%) scale(${across}, ${along})`
    : `translate(-50%, -50%) scale(${along}, ${across})`;
};

/** The DOM's pill · grip rules (the Handle rule's `rootSelectors` — pseudo element and child only). */
const chromeStyles: Record<string, Record<string, string>> = {
  '&[data-variant="pill"]::before': {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "50%",
    "border-radius": "999px",
    "pointer-events": "none",
    "z-index": "2",
    background: RESIZABLE_PILL.states.rest.color,
    transition: `transform ${RESIZABLE_PILL.duration}ms ${RESIZABLE_PILL.easing}, background-color ${RESIZABLE_PILL.duration}ms ${RESIZABLE_PILL.easing}`,
  },
  '&[data-orientation="horizontal"][data-variant="pill"]::before': {
    width: `${RESIZABLE_PILL.thickness}px`,
    height: `${RESIZABLE_PILL.length}px`,
    transform: scale("rest", "row"),
  },
  '&[data-orientation="vertical"][data-variant="pill"]::before': {
    width: `${RESIZABLE_PILL.length}px`,
    height: `${RESIZABLE_PILL.thickness}px`,
    transform: scale("rest", "column"),
  },
  '&[data-orientation="horizontal"][data-variant="pill"]:not([aria-disabled="true"]):hover::before':
    {
      transform: scale("hover", "row"),
      background: RESIZABLE_PILL.states.hover.color,
    },
  '&[data-orientation="vertical"][data-variant="pill"]:not([aria-disabled="true"]):hover::before':
    {
      transform: scale("hover", "column"),
      background: RESIZABLE_PILL.states.hover.color,
    },
  '&[data-orientation="horizontal"][data-variant="pill"][data-resizing]:not([aria-disabled="true"])::before':
    {
      transform: scale("pressed", "row"),
      background: RESIZABLE_PILL.states.pressed.color,
    },
  '&[data-orientation="vertical"][data-variant="pill"][data-resizing]:not([aria-disabled="true"])::before':
    {
      transform: scale("pressed", "column"),
      background: RESIZABLE_PILL.states.pressed.color,
    },
  // (The pressed blocks weigh what the hover blocks weigh and come after them — the pointer is over
  //  the Handle while it drags. G4 live 2026-11-26.)
  // (prefers-reduced-motion — the running Handle marks it; the generated sheet has no media block
  //  for a pseudo element.)
  "&[data-reduced-motion]::before": { transition: "none" },
  "& > .resizable-grip": {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "border-radius": `${RESIZABLE_GRIP.radius}px`,
    background: RESIZABLE_GRIP.color,
    color: RESIZABLE_GRIP.glyphColor,
    "pointer-events": "none",
    "z-index": "2",
  },
  '&[data-orientation="horizontal"] > .resizable-grip': {
    width: `${RESIZABLE_GRIP.across}px`,
    height: `${RESIZABLE_GRIP.along}px`,
  },
  '&[data-orientation="vertical"] > .resizable-grip': {
    width: `${RESIZABLE_GRIP.along}px`,
    height: `${RESIZABLE_GRIP.across}px`,
  },
  "& > .resizable-grip svg": {
    width: `${RESIZABLE_GRIP.glyphSize}px`,
    height: `${RESIZABLE_GRIP.glyphSize}px`,
  },
};

export const RESIZABLE_CHROME_SELECTORS = Object.fromEntries(
  Object.entries(chromeStyles).map(([selector, styles]) => [
    selector,
    { styles },
  ]),
);
