/**
 * ADR-318 Phase 2 · 3 — the Resizable Handle's interaction (a lazy chunk: the static renderer draws
 * the same box until it loads — `delegatedDom.runtime.ts` `resizablehandle`).
 *
 * D1 exception (ADR-318 breakdown §4 — the closed list, `.claude/rules/ssot-hierarchy.md` §1 D1): on
 * the Handle element only — `role="separator"` · `aria-orientation` · `aria-valuenow` · `aria-valuemin`
 * · `aria-valuemax` · `aria-controls` · `aria-label` · `aria-disabled` · `tabIndex`; the Group axis's
 * arrows · Home · End · Enter (collapse · expand the front Panel); pointer drag and double click
 * (collapse · expand). The keys of other kinds go on (`continuePropagation`). react-aria `useMove`
 * gives the pointer drag only — its key handler swallows all four arrows (`useMove.mjs:207-232`), so
 * it is left off; `useKeyboard` takes the axis keys. The drag holds the pointer (`setPointerCapture`
 * at pointerdown — Phase 0 P3: without it a drag released over a Panel's iframe never ends).
 *
 * The runtime state is each Panel's `size` (its expanded share) and `isCollapsed` (breakdown §5.3).
 * During a drag that does not change a collapse, the two Panels' `flexGrow` and the Handle's
 * `aria-valuenow` are written to the DOM (no React commit) and the state at the end; a collapse
 * change is written at once (it moves a basis · a min). (ADR-318 G6 — HC5 2026-11-26: a state
 * written each frame cost a whole view render when a named state read it — a variable write
 * re-renders the session view; 4x p95 101 ms · LoAF 1,495 vs the end write's 21.7 ms · 0.)
 */
import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { mergeProps, useFocusRing, useKeyboard, useMove } from "react-aria";
import { useCatalogLocalized } from "./localizedStrings";
import { catalogResizablePanelEvents } from "./resizablePanels";
import {
  catalogResizableLimits,
  catalogResizableMoveCollapsing,
  catalogResizableRange,
  RESIZABLE_KEY_STEP,
  catalogResizableShareValue,
  type ResizableCollapseInfo,
  type ResizableLimits,
} from "./resizableDrag";

export interface CatalogResizablePanelState {
  readonly recordId: string;
  readonly domId: string;
  /** The Panel's derived values (`_panelMin` · `_panelMax`). */
  readonly derived: Readonly<Record<string, unknown>> | undefined;
  /** Its expanded share (the runtime `size`, else its derived share). */
  readonly share: number;
  readonly collapsed: boolean;
  /** Its collapsed size as CSS when it collapses (`collapsible`), else none. */
  readonly collapsedSize: string | undefined;
  /** Its drawn flex values (`catalogResizableDisplay`). */
  readonly display: { readonly grow: number; readonly basis?: string };
}

export interface CatalogResizableHandleProps {
  /** The static renderer's attributes (marker · class · data · style). */
  readonly attrs: Readonly<Record<string, unknown>>;
  readonly axis: "row" | "column";
  /** The Handle's front Panel (its index among the Group's Panels). */
  readonly index: number;
  readonly panels: readonly CatalogResizablePanelState[];
  readonly disabled: boolean;
  /** The author's `aria-label` (else the language's default). */
  readonly label?: string;
  readonly setRuntimeProps: (
    recordId: string,
    patch: Readonly<Record<string, unknown>>,
  ) => void;
  /** Phase 4 — the `withHandle` grip (drawn by the renderer — the static line's same child). */
  readonly children?: ReactNode;
}

/** The Handle's default name (en · ko · ja · zh — the languages the other names ship). */
/**
 * The axis cursor for the whole document while a drag holds the pointer (react-resizable-panels'
 * global cursor). The cursor is the grab area's (`::after` — the Handle rule); the pointer capture's
 * target is the Handle itself, whose own cursor is `auto`, and a pointer past the grab area is over
 * the Panels (2026-11-26 사용자 보고 「드래그 시작시 resizable 커서가 유지되지 않는다」).
 */
let dragCursorSheet: HTMLStyleElement | null = null;
function catalogResizableDragCursor(cursor: string | null): void {
  if (!cursor || cursor === "auto" || cursor === "default") {
    dragCursorSheet?.remove();
    dragCursorSheet = null;
    return;
  }
  dragCursorSheet ??= document.head.appendChild(
    document.createElement("style"),
  );
  dragCursorSheet.textContent = `*, *::before, *::after { cursor: ${cursor} !important; }`;
}

const LABELS: Readonly<Record<string, string>> = {
  en: "Resize panels",
  ko: "패널 크기 조절",
  ja: "パネルのサイズを変更",
  zh: "调整面板大小",
};

/** The Group's main size and the space its Panels share (main less the Handles). */
function measure(
  handle: HTMLElement | null,
  axis: "row" | "column",
): { main: number; space: number } {
  const group = handle?.parentElement;
  if (!group) return { main: 0, space: 0 };
  const along = (el: Element) => {
    const box = el.getBoundingClientRect();
    return axis === "row" ? box.width : box.height;
  };
  const main = along(group);
  let handles = 0;
  for (const child of group.children)
    if (child.getAttribute("data-resizable-handle") !== null)
      handles += along(child);
  return { main, space: Math.max(0, main - handles) };
}

/** A CSS length (`N%` · `Npx`) as share % of the shared space. */
function shareOf(length: string | undefined, space: number): number {
  if (!length) return 0;
  const n = Number.parseFloat(length);
  if (!Number.isFinite(n)) return 0;
  return length.endsWith("px") ? (space > 0 ? (n / space) * 100 : 0) : n;
}

/**
 * The Panels' drawn shares (% of the shared space): a px basis is its px over the space, the others
 * split what is left in the ratio of their flex shares (CSS flex with a 0 basis).
 */
function drawnShares(
  panels: readonly CatalogResizablePanelState[],
  space: number,
): number[] {
  const based = panels.map((panel) =>
    panel.display.basis ? shareOf(panel.display.basis, space) : 0,
  );
  const left = Math.max(0, 100 - based.reduce((sum, v) => sum + v, 0));
  const grows = panels.reduce(
    (sum, panel) => sum + (panel.display.basis ? 0 : panel.display.grow),
    0,
  );
  return panels.map((panel, i) =>
    panel.display.basis
      ? based[i]!
      : grows > 0
        ? (panel.display.grow / grows) * left
        : 0,
  );
}

export default function CatalogResizableHandle(
  props: CatalogResizableHandleProps,
): ReactElement {
  const { axis, index, panels, disabled, setRuntimeProps } = props;
  const ref = useRef<HTMLDivElement>(null);
  const defaultLabel = useCatalogLocalized(LABELS);
  const [geometry, setGeometry] = useState({ main: 0, space: 0 });
  useLayoutEffect(() => {
    const update = () => setGeometry(measure(ref.current, axis));
    update();
    const group = ref.current?.parentElement;
    if (!group || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(group);
    return () => observer.disconnect();
  }, [axis]);
  const limitsOf = (g: { main: number; space: number }): ResizableLimits =>
    catalogResizableLimits(
      panels.map((panel) => panel.derived),
      g.main,
      g.space,
    );
  const infoOf = (space: number): ResizableCollapseInfo => ({
    collapsible: panels.map((panel) => panel.collapsedSize !== undefined),
    collapsedShare: panels.map((panel) => shareOf(panel.collapsedSize, space)),
  });
  const collapsedNow = panels.map((panel) => panel.collapsed);
  const sizes = drawnShares(panels, geometry.space);
  const front = panels[index];
  const back = panels[index + 1];
  // (The separator's range: a collapsible front Panel goes down to its collapsed size, a collapsible
  //  back Panel lets the front take its place.)
  const range = (() => {
    const base = catalogResizableRange(sizes, index, limitsOf(geometry));
    const total = (sizes[index] ?? 0) + (sizes[index + 1] ?? 0);
    return {
      lo: front?.collapsedSize
        ? Math.min(base.lo, shareOf(front.collapsedSize, geometry.space))
        : base.lo,
      hi: back?.collapsedSize
        ? Math.max(base.hi, total - shareOf(back.collapsedSize, geometry.space))
        : base.hi,
    };
  })();

  /** What a write left: each Panel's expanded share and collapse. */
  type Written = {
    readonly shares: readonly number[];
    readonly collapsed: readonly boolean[];
  };
  const fromProps = (): Written => ({
    shares: panels.map((panel) => panel.share),
    collapsed: collapsedNow,
  });
  /**
   * The runtime write: each Panel whose share · collapse differs from `written` (its record — F7).
   * An open Panel's share is its drawn share; a collapsed one keeps the share it expands to.
   * Returns what it left.
   */
  const commit = (
    next: { sizes: readonly number[]; collapsed: readonly boolean[] },
    written: Written,
  ): Written => {
    next.sizes.forEach((size, i) => {
      const panel = panels[i];
      if (!panel) return;
      const patch: Record<string, unknown> = {};
      if (next.collapsed[i] !== written.collapsed[i])
        patch.isCollapsed = next.collapsed[i];
      if (
        !next.collapsed[i] &&
        Math.abs(size - (written.shares[i] ?? 0)) > 1e-6
      )
        patch.size = catalogResizableShareValue(size);
      if (Object.keys(patch).length) setRuntimeProps(panel.recordId, patch);
    });
    return {
      shares: next.sizes.map((size, i) =>
        next.collapsed[i] ? (written.shares[i] ?? 0) : size,
      ),
      collapsed: next.collapsed,
    };
  };

  const drag = useRef<{
    start: readonly number[];
    moved: number;
    geometry: { main: number; space: number };
    /**
     * What this drag last wrote — not the props: a write's re-render can come after the next move
     * (G3 live 2026-11-26: a drag past the collapse middle and back left the front Panel at 87 %).
     */
    written: Written;
    /** Its collapse changed: every later move is written at once (the DOM flex values are stale). */
    collapseChanged: boolean;
    /** The state it started from (its end's When compares with it). */
    started: Written;
  } | null>(null);
  const pending = useRef<{
    sizes: readonly number[];
    collapsed: readonly boolean[];
  } | null>(null);
  const flush = () => {
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    const d = drag.current;
    const before = d?.written ?? fromProps();
    const left = commit(next, before);
    if (d) d.written = left;
    // (A key's step is its own change; a drag's is told at its end — `onMoveEnd`.)
    else emit(before, left);
  };
  /**
   * Phase 5 — the changed Panels' When: 「Collapse change」 for a collapse that flipped, 「Resize」
   * for an open Panel whose share moved (the handlers its rules gave its element).
   */
  const emit = (before: Written, after: Written) => {
    const group = ref.current?.parentElement;
    panels.forEach((panel, i) => {
      const element = group?.querySelector(`#${CSS.escape(panel.domId)}`);
      const events = catalogResizablePanelEvents(element);
      if (!events) return;
      if (after.collapsed[i] !== before.collapsed[i])
        events.onCollapsedChange?.(!!after.collapsed[i]);
      if (
        !after.collapsed[i] &&
        Math.abs((after.shares[i] ?? 0) - (before.shares[i] ?? 0)) > 1e-6
      )
        events.onSizeChange?.(catalogResizableShareValue(after.shares[i] ?? 0));
    });
  };
  /** The drag's DOM write — the two Panels' flex share in the Group's current grow space. */
  const show = (next: readonly number[]) => {
    const group = ref.current?.parentElement;
    for (const i of [index, index + 1]) {
      const panel = panels[i];
      const el =
        panel &&
        group?.querySelector<HTMLElement>(`#${CSS.escape(panel.domId)}`);
      const drawn = sizes[i] ?? 0;
      const factor = drawn > 0 && panel ? panel.display.grow / drawn : 1;
      if (el) el.style.flexGrow = String((next[i] ?? 0) * factor);
    }
    ref.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(next[index] ?? 0)),
    );
  };
  /** A move (a drag's total or a key's step) from `start` — a collapse change is written at once. */
  const move = (
    start: readonly number[],
    delta: number,
    g: { main: number; space: number },
    live: boolean,
  ) => {
    const d = drag.current;
    const before = d?.written.collapsed ?? collapsedNow;
    const next = catalogResizableMoveCollapsing(
      start,
      before,
      index,
      delta,
      limitsOf(g),
      infoOf(g.space),
    );
    const changedCollapse = next.collapsed.some(
      (value, i) => value !== before[i],
    );
    if (d && changedCollapse) d.collapseChanged = true;
    pending.current = next;
    if (!live || d?.collapseChanged) {
      flush();
      return;
    }
    // (the state waits for the drag's end — `onMoveEnd` flushes it)
    show(next.sizes);
  };
  const toggleFront = () => {
    if (!front?.collapsedSize) return;
    setRuntimeProps(front.recordId, { isCollapsed: !front.collapsed });
    const before = fromProps();
    emit(before, {
      shares: before.shares,
      collapsed: before.collapsed.map((value, i) =>
        i === index ? !value : value,
      ),
    });
  };

  const [resizing, setResizing] = useState(false);
  const { moveProps } = useMove({
    onMoveStart() {
      const g = measure(ref.current, axis);
      drag.current = {
        start: drawnShares(panels, g.space),
        moved: 0,
        geometry: g,
        written: fromProps(),
        started: fromProps(),
        collapseChanged: false,
      };
      setResizing(true);
      if (ref.current)
        catalogResizableDragCursor(
          getComputedStyle(ref.current, "::after").cursor,
        );
    },
    onMove(event) {
      const d = drag.current;
      if (!d || event.pointerType === "keyboard" || d.geometry.space <= 0)
        return;
      d.moved += axis === "row" ? event.deltaX : event.deltaY;
      move(d.start, (d.moved / d.geometry.space) * 100, d.geometry, true);
    },
    onMoveEnd() {
      catalogResizableDragCursor(null);
      flush();
      const d = drag.current;
      drag.current = null;
      setResizing(false);
      if (d) emit(d.started, d.written);
    },
  });
  // (A Handle gone mid-drag — a page change — takes its drag cursor along.)
  useLayoutEffect(
    () => () => {
      if (drag.current) catalogResizableDragCursor(null);
    },
    [],
  );
  // (useMove's key handler is left off — see the header.)
  const { onKeyDown: _moveKeys, ...pointerProps } = moveProps;
  const { keyboardProps } = useKeyboard({
    onKeyDown(event) {
      const backKey = axis === "row" ? "ArrowLeft" : "ArrowUp";
      const forwardKey = axis === "row" ? "ArrowRight" : "ArrowDown";
      if (event.key === "Enter") {
        if (!front?.collapsedSize) {
          event.continuePropagation();
          return;
        }
        event.preventDefault();
        toggleFront();
        return;
      }
      let delta: number | undefined;
      if (event.key === backKey) delta = -RESIZABLE_KEY_STEP;
      else if (event.key === forwardKey) delta = RESIZABLE_KEY_STEP;
      else if (event.key === "Home") delta = -100;
      else if (event.key === "End") delta = 100;
      if (delta === undefined) {
        event.continuePropagation();
        return;
      }
      event.preventDefault();
      const g = measure(ref.current, axis);
      move(drawnShares(panels, g.space), delta, g, false);
    },
  });
  const { focusProps, isFocusVisible } = useFocusRing();
  // (Phase 4 — the pill's transition is off for a reader who asks for less motion.)
  const reducedMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 0)
      event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  return (
    <div
      {...props.attrs}
      {...(disabled
        ? {}
        : mergeProps(pointerProps, keyboardProps, focusProps, {
            onPointerDown,
            onDoubleClick: toggleFront,
          }))}
      ref={ref}
      role="separator"
      tabIndex={disabled ? -1 : 0}
      aria-orientation={axis === "row" ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(sizes[index] ?? 0)}
      aria-valuemin={Math.round(range.lo)}
      aria-valuemax={Math.round(range.hi)}
      aria-controls={front?.domId}
      aria-label={props.label || defaultLabel}
      aria-disabled={disabled || undefined}
      data-focus-visible={isFocusVisible || undefined}
      data-resizing={resizing || undefined}
      data-reduced-motion={reducedMotion || undefined}
    >
      {props.children}
    </div>
  );
}
