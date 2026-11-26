/**
 * ADR-318 — Resizable 분할창 (`ResizablePanelGroup > ResizablePanel (ResizableHandle ResizablePanel)*`).
 *
 * 크기 식 하나 (Decision 3 · breakdown §5.2): Panel 의 몫 (`defaultSize`, 안 적으면 남은 비율을 고르게 —
 * 합이 100) 을 Group 해석 때 파생 값 (`_panelGrow`) 으로 싣고, 두 consumer (Canvas `styleOf` · DOM
 * inline style) 가 같은 CSS flex 를 푼다: `flexGrow = 몫` · `flexShrink 1` · `flexBasis 0px` · main 축
 * 최소 · 최대. 손잡이의 px 두께는 flex 가 먼저 뺀다. basis 를 `0%` 로 두지 않는다 — 엔진은 main 축이
 * 확정되지 않은 컨테이너의 `%` basis 를 `content` 로 바꾼다 (`tree.rs` `resolve_flex_basis`). Phase 0 P1
 * (`tests/parity/adr318ResizableFlexShare.browser.test.ts`) 이 이 식을 엔진 = Chrome 으로 고정했다.
 *
 * 크기 단위 (사용자 결정 2, 2026-11-26): `defaultSize` 는 % (숫자), `minSize` · `maxSize` ·
 * `collapsedSize` 는 % 와 px 둘 다 — 숫자 · `"25%"` = %, `"200px"` = px.
 */

export const RESIZABLE_GROUP_TYPE = "ResizablePanelGroup";
export const RESIZABLE_PANEL_TYPE = "ResizablePanel";
export const RESIZABLE_HANDLE_TYPE = "ResizableHandle";

export type ResizableOrientation = "horizontal" | "vertical";

/** A Group's axis — S2 / reui `orientation` (absent = horizontal: panels side by side). */
export function catalogResizableOrientation(
  props: Readonly<Record<string, unknown>> | undefined,
): ResizableOrientation {
  return props?.orientation === "vertical" ? "vertical" : "horizontal";
}

/** A size length as CSS — a number or a unitless / `%` text is a %, `Npx` stays px. Else none. */
export function catalogResizableLength(value: unknown): string | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? `${value}%` : undefined;
  if (typeof value !== "string") return undefined;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(%|px)?\s*$/.exec(value);
  if (!match) return undefined;
  return `${Number(match[1])}${match[2] ?? "%"}`;
}

/** A `defaultSize` as a % number (a `%` text too — reui example 4 writes `"50%"`). */
function sizePercent(value: unknown): number | undefined {
  const length = catalogResizableLength(value);
  return length?.endsWith("%") ? Number.parseFloat(length) : undefined;
}

/**
 * The Panels' shares (sum 100): an authored `defaultSize` is its own, the rest share what remains
 * equally (never below 0). A sum that is not 100 is scaled to 100 — the share is the Panel's current
 * size in %, the same number as its `aria-valuenow` · runtime `size` · variable (review round 1).
 */
export function catalogResizablePanelShares(
  panels: readonly Readonly<Record<string, unknown>>[],
): number[] {
  const authored = panels.map((props) => sizePercent(props.defaultSize));
  const given = authored.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  const open = authored.filter((size) => size === undefined).length;
  const each = open ? Math.max(0, 100 - given) / open : 0;
  const raw = authored.map((size) => size ?? each);
  const total = raw.reduce((sum, size) => sum + size, 0);
  return total > 0
    ? raw.map((size) => (size * 100) / total)
    : raw.map(() => 100 / Math.max(1, raw.length));
}

/** A Panel's derived layout values (`presence.ts` puts them on the Panel record). */
export interface ResizablePanelDerived {
  /** Its drawn flex share (a collapsed Panel's collapsed size — `catalogResizableDisplay`). */
  _panelGrow: number;
  /** Its expanded share (its size when it is not collapsed — the runtime `size`'s start). */
  _panelShare: number;
  /** The Group's flex direction — which box axis the min · max limit. */
  _panelAxis: "row" | "column";
  /** A collapsed Panel's px basis (`collapsedSize` in px — its flex share is 0). */
  _panelBasis?: string;
  _panelCollapsed?: true;
  /** Its `collapsedSize` as CSS (`0%` when collapsible without one) — the Handle's collapse size. */
  _panelCollapsedSize?: string;
  _panelMin?: string;
  _panelMax?: string;
}

/** Phase 3 — whether a Panel collapses at all, and its collapsed size as CSS. */
export function catalogResizableCollapsedSize(
  panel: Readonly<Record<string, unknown>>,
): string | undefined {
  if (panel.collapsible !== true) return undefined;
  return catalogResizableLength(panel.collapsedSize) ?? "0%";
}

/** A Panel's start collapse (`isCollapsed ?? defaultCollapsed` — only a `collapsible` one). */
export function catalogResizableStartCollapsed(
  panel: Readonly<Record<string, unknown>>,
): boolean {
  return (
    panel.collapsible === true &&
    (panel.isCollapsed ?? panel.defaultCollapsed) === true
  );
}

/**
 * Phase 3 — the drawn flex values of a Group's Panels: a collapsed Panel draws its collapsed size
 * (a `%` as its share, a `px` as its basis with no share), the others share what is left in the
 * ratio of their expanded shares — so an expand gives back the layout before the collapse.
 */
export function catalogResizableDisplay(
  shares: readonly number[],
  collapsed: readonly boolean[],
  collapsedSizes: readonly (string | undefined)[],
): { grow: number; basis?: string }[] {
  const percentOf = (i: number) =>
    collapsed[i] && collapsedSizes[i]?.endsWith("%")
      ? Number.parseFloat(collapsedSizes[i]!)
      : 0;
  const taken = shares.reduce((sum, _, i) => sum + percentOf(i), 0);
  const open = shares.reduce(
    (sum, share, i) => sum + (collapsed[i] ? 0 : share),
    0,
  );
  const scale = open > 0 ? Math.max(0, 100 - taken) / open : 0;
  return shares.map((share, i) => {
    if (!collapsed[i]) return { grow: share * scale };
    const size = collapsedSizes[i] ?? "0%";
    return size.endsWith("px")
      ? { grow: 0, basis: size }
      : { grow: Number.parseFloat(size) };
  });
}

export function catalogResizablePanelDerived(
  panel: Readonly<Record<string, unknown>>,
  share: number,
  orientation: ResizableOrientation,
  display: { grow: number; basis?: string } = { grow: share },
  collapsed = false,
): ResizablePanelDerived {
  const min = catalogResizableLength(panel.minSize);
  const max = catalogResizableLength(panel.maxSize);
  const collapsedSize = catalogResizableCollapsedSize(panel);
  return {
    _panelGrow: display.grow,
    _panelShare: share,
    _panelAxis: orientation === "vertical" ? "column" : "row",
    ...(display.basis ? { _panelBasis: display.basis } : {}),
    ...(collapsed ? { _panelCollapsed: true as const } : {}),
    ...(collapsedSize ? { _panelCollapsedSize: collapsedSize } : {}),
    // (A collapsed Panel's min does not apply — breakdown §5.2.)
    ...(min && !collapsed ? { _panelMin: min } : {}),
    ...(max ? { _panelMax: max } : {}),
  };
}

/** The Handle's line thickness (px) — reui `w-px` / `h-px`. */
export const RESIZABLE_HANDLE_THICKNESS = 1;

/**
 * A Group's derived axis (`_resizableDirection`) and a Handle's (`_resizableHandleAxis` + its
 * `orientation` for the DOM's `data-orientation`): the Canvas lays out from the record, not from the
 * rule's `containerVariants` (those reach only the generated sheet) — so the axis-dependent box
 * values are derived values both consumers write (`catalogResizableLayout`).
 */
export function catalogResizableGroupDerived(
  orientation: ResizableOrientation,
): Record<string, string> {
  return { _resizableDirection: orientation === "vertical" ? "column" : "row" };
}
export function catalogResizableHandleDerived(
  orientation: ResizableOrientation,
  /** Its Group is inside another Group's Panel (its grab area goes under the outer line's). */
  nested = false,
): Record<string, string | boolean> {
  return {
    orientation,
    _resizableHandleAxis: orientation === "vertical" ? "column" : "row",
    ...(nested ? { _resizableNested: true } : {}),
  };
}

/**
 * The layout values both consumers write for a Resizable record (Canvas `styleOf` · DOM
 * `catalogDomStyle`): a Group's flex direction, a Handle's line thickness on the Group's axis, a
 * Panel's flex share and its min · max. None for any other record. An authored item layout written
 * after it wins.
 */
export function catalogResizableLayout(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number> {
  if (
    derived?._resizableDirection === "row" ||
    derived?._resizableDirection === "column"
  )
    return { flexDirection: derived._resizableDirection };
  if (
    derived?._resizableHandleAxis === "row" ||
    derived?._resizableHandleAxis === "column"
  )
    return {
      [derived._resizableHandleAxis === "row" ? "width" : "height"]:
        `${RESIZABLE_HANDLE_THICKNESS}px`,
    };
  if (typeof derived?._panelGrow !== "number") return {};
  const row = derived._panelAxis !== "column";
  return {
    flexGrow: derived._panelGrow,
    flexShrink: 1,
    flexBasis:
      typeof derived._panelBasis === "string" ? derived._panelBasis : "0px",
    ...(typeof derived._panelMin === "string"
      ? { [row ? "minWidth" : "minHeight"]: derived._panelMin }
      : {}),
    ...(typeof derived._panelMax === "string"
      ? { [row ? "maxWidth" : "maxHeight"]: derived._panelMax }
      : {}),
  };
}

/**
 * A Panel's DOM id — the Handle's `aria-controls` target: its HTML id (`htmlId` — the author's or the
 * automatic `resizablepanel_N`, which the DOM writes as its `id`), else one stable per record.
 */
export function catalogResizablePanelDomId(record: {
  readonly id: string;
  readonly htmlId?: string;
}): string {
  if (record.htmlId) return record.htmlId;
  const recordId = record.id;
  let hash = 5381;
  for (let i = 0; i < recordId.length; i++)
    hash = ((hash << 5) + hash + recordId.charCodeAt(i)) | 0;
  return `resizable-panel-${(hash >>> 0).toString(36)}`;
}

// ── Phase 5 — the Panels' When (「Resize」 · 「Collapse change」) ──

/** A Panel's rule handlers (`withRuntime` puts them on its element's props). */
export interface ResizablePanelEvents {
  readonly onSizeChange?: (size: number) => void;
  readonly onCollapsedChange?: (isCollapsed: boolean) => void;
}

/**
 * The Panels' handlers by their element: the Panel registers what its rules gave it, the Handle that
 * changed it calls them (a drag's end, a key's step, a collapse) — a Panel has no interaction of its
 * own, so the change that its When follows is its Handles'.
 */
const panelEvents = new WeakMap<Element, ResizablePanelEvents>();

export function catalogRegisterResizablePanelEvents(
  element: Element,
  events: ResizablePanelEvents,
): void {
  panelEvents.set(element, events);
}

export function catalogResizablePanelEvents(
  element: Element | null | undefined,
): ResizablePanelEvents | undefined {
  return element ? panelEvents.get(element) : undefined;
}
