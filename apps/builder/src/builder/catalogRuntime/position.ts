import {
  moveNodes,
  setFields,
  setFillSizing,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  BreakpointName,
  EditTarget,
  LayoutField,
  NodeId,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type { RatioEditError } from "../utils/ratioEditError";
import { catalogBoxModel } from "./boxModel";
import type { CatalogCompositionRoot } from "./compositionRoot";
import {
  CATALOG_CENTER_ALIGN,
  catalogPositionLayoutWrites,
  catalogReadPositionConstraint,
  type CatalogAxisConstraint,
} from "./positionConstraint";
import { CatalogStyleValueError } from "./styleFields";

interface PositionItem {
  target: EditTarget;
  identity: string;
}

/**
 * A placed box (border box) from its containing block's origin, and that containing block: the
 * parent's padding box (absolute), or the page viewport (fixed — ADR-275 Phase 7: the page root's
 * border-box origin, the breakpoint's screen size; `root.viewport`).
 */
export function catalogPlacementFrame(
  root: CatalogCompositionRoot,
  identity: string,
  position: "absolute" | "fixed",
):
  | {
      box: { x: number; y: number; width: number; height: number };
      cb: { width: number; height: number };
    }
  | undefined {
  const record = root.domInputs.get(identity);
  if (!record) return undefined;
  if (position === "fixed") {
    const chain: string[] = [];
    for (
      let cursor = record;
      cursor && root.domInputs.has(cursor.parentId);
      cursor = root.domInputs.get(cursor.parentId)!
    )
      chain.push(cursor.id);
    const geometry = root.getGeometry(chain);
    const own = geometry.get(identity);
    if (!own || chain.some((id) => !geometry.has(id))) return undefined;
    let x = 0;
    let y = 0;
    for (const id of chain) {
      x += geometry.get(id)!.x;
      y += geometry.get(id)!.y;
    }
    return {
      box: { x, y, width: own.width, height: own.height },
      cb: { width: root.viewport.width, height: root.viewport.height },
    };
  }
  const parent = root.domInputs.get(record.parentId);
  const geometry = root.getGeometry(
    parent ? [identity, parent.id] : [identity],
  );
  const rect = geometry.get(identity);
  const parentRect = parent ? geometry.get(parent.id) : undefined;
  if (!rect || !parent || !parentRect) return undefined;
  const border = catalogBoxModel(parent).borderWidth;
  const inset = typeof border === "number" ? border : 0;
  return {
    box: {
      x: rect.x - inset,
      y: rect.y - inset,
      width: rect.width,
      height: rect.height,
    },
    cb: {
      width: parentRect.width - 2 * inset,
      height: parentRect.height - 2 * inset,
    },
  };
}

/**
 * ADR-248 Phase 4e-4d-3: the Position section's absolute toggle (ADR-224 §6.1). On: each
 * selected node keeps where it is drawn — `layout.position: absolute` and the insets of its
 * constraint (ADR-275 — Left · Top unless it already has others) from the parent's padding box,
 * at the current breakpoint — a fill axis becomes its measured px (a placed box does not take part
 * in the parent's flow), and it moves to the front of its siblings. Off: its `position` goes at the
 * current breakpoint (removed on desktop, masked on a breakpoint layer) and its insets stay. One
 * step for the selection; a template position is refused. `position: "fixed"` (Phase 7) places it in
 * the page viewport the same way (`catalogPlacementFrame`).
 */
export function catalogAbsoluteCommand(input: {
  items: readonly PositionItem[];
  on: boolean;
  position?: "absolute" | "fixed";
  breakpoint: BreakpointName;
  root: CatalogCompositionRoot;
  graph: CatalogGraph;
  own: (target: EditTarget) => OwnFields;
  newId: NewId;
}): CatalogCommand | RatioEditError {
  const commands: CatalogCommand[] = [];
  const responsive = input.breakpoint !== "desktop";
  for (const { target, identity } of input.items) {
    if (target.kind !== "node") return "target-missing";
    if (!input.on) {
      // The box goes back to the flow; its offsets stay (inert in flow — they come back with the
      // toggle, and a Relative box reads Left · Top). A Center axis' `unsafe center` goes: in flow
      // it would align the box as a flex · grid item.
      const record = input.root.domInputs.get(identity);
      const clear = responsive
        ? ({ kind: "mask" } as const)
        : ({ kind: "remove" } as const);
      commands.push(
        setFields({
          targets: [target],
          ...(responsive ? { breakpoint: input.breakpoint } : {}),
          layout: {
            position: clear,
            ...(record?.layout.justifySelf === CATALOG_CENTER_ALIGN
              ? { justifySelf: clear }
              : {}),
            ...(record?.layout.alignSelf === CATALOG_CENTER_ALIGN
              ? { alignSelf: clear }
              : {}),
          },
        }),
      );
      continue;
    }
    const record = input.root.domInputs.get(identity);
    const position = input.position ?? "absolute";
    const frame = catalogPlacementFrame(input.root, identity, position);
    if (!frame || !record) return "geometry-missing";
    const rect = frame.box;
    commands.push(
      setFields({
        targets: [target],
        breakpoint: input.breakpoint,
        layout: {
          position: { kind: "set", value: position },
          ...catalogPositionLayoutWrites({
            layout: record.layout,
            constraint: catalogReadPositionConstraint(record.layout),
            box: frame.box,
            cb: frame.cb,
            breakpoint: input.breakpoint,
          }),
        },
      }),
    );
    const fill = input.own(target).fillSizing;
    for (const axis of ["width", "height"] as const) {
      if (!fill?.[axis]) continue;
      commands.push(
        setFillSizing({ targets: [target], axis, value: undefined }),
        setFields({
          targets: [target],
          sizing: { [axis]: { kind: "set", value: Math.round(rect[axis]) } },
        }),
      );
    }
    const owner = input.graph.ownerOf(target.id);
    const ownerEntry = owner ? input.graph.getEntry(owner) : undefined;
    if (
      ownerEntry?.kind === "node" &&
      ownerEntry.children.at(-1) !== target.id &&
      ownerEntry.children.includes(target.id)
    )
      commands.push(
        moveNodes({
          ids: [target.id],
          parent: { kind: "node", id: ownerEntry.id as NodeId },
          newId: input.newId,
        }),
      );
  }
  // Each command plans on the records the earlier ones staged: a move writes its parent's whole
  // child list, so planning every move on the same reader would keep only the last one.
  return () => {
    const plan = composeCommands(
      input.graph,
      input.on ? "Absolute position" : "Flow position",
      commands,
    );
    return { label: plan.label, ops: plan.ops };
  };
}

/**
 * ADR-275 Decision 3 · 4 — one Position section edit:
 * - `constraint`: an axis' pin (Left · Right · Left+Right · Center). The box stays where it is
 *   drawn (Figma): its new insets come from its current box. Left+Right stretches — the axis' own
 *   size goes (width auto); leaving it fixes the drawn size.
 * - `inset`: a value typed in a side field. On a pinned side it sets that side; on an unpinned side
 *   the axis moves to that side (the opposite side is let go — 사용자 결정 「Right 로 바꾸는 쪽」).
 *   On a Center axis the start field is the offset. An empty value lets a Left+Right side go.
 * - `fill`: all four sides 0, both sizes auto.
 * - `relative`: a Relative box's Left · Top offset (`position: relative`).
 * - `sticky` (Phase 6 — 사용자 결정 2026-10-20): the box goes (back) to the flow and sticks at Top 0
 *   in its scroll container; the insets of its past (absolute offsets) and a Center axis' `unsafe
 *   center` go. `stickyInset`: one side's stick distance — each side on its own, empty = auto (that
 *   side does not stick).
 * Writes go to the current breakpoint (a dropped side is masked there, removed on desktop).
 */
export type CatalogPositionChange =
  | { kind: "constraint"; axis: "x" | "y"; constraint: CatalogAxisConstraint }
  | { kind: "inset"; side: "left" | "right" | "top" | "bottom"; value: string }
  | { kind: "fill" }
  | { kind: "relative"; side: "left" | "top"; value: string }
  | { kind: "sticky" }
  | {
      kind: "stickyInset";
      side: "left" | "right" | "top" | "bottom";
      value: string;
    };

const SIDE = {
  left: { axis: "x", key: "insetLeft", end: false },
  right: { axis: "x", key: "insetRight", end: true },
  top: { axis: "y", key: "insetTop", end: false },
  bottom: { axis: "y", key: "insetBottom", end: true },
} as const;
const AXIS_KEYS = {
  x: {
    start: "insetLeft",
    end: "insetRight",
    self: "justifySelf",
    size: "width",
  },
  y: {
    start: "insetTop",
    end: "insetBottom",
    self: "alignSelf",
    size: "height",
  },
} as const;

/** A typed inset as CSS text (`12` → `12px`); undefined when it is not a length or `%`. */
function insetText(raw: string): string | undefined {
  const text = raw.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `${text}px`;
  return /^-?\d+(?:\.\d+)?(px|%)$/.test(text) ? text : undefined;
}
const negate = (text: string) =>
  text.startsWith("-")
    ? text.slice(1)
    : text === "0px" || text === "0%"
      ? text
      : `-${text}`;

export function catalogPositionChangeCommand(input: {
  items: readonly PositionItem[];
  change: CatalogPositionChange;
  breakpoint: BreakpointName;
  root: CatalogCompositionRoot;
}): CatalogCommand | RatioEditError | null {
  const { change, breakpoint } = input;
  const clear: WriteValue<string> =
    breakpoint === "desktop" ? { kind: "remove" } : { kind: "mask" };
  const commands: CatalogCommand[] = [];
  for (const { target, identity } of input.items) {
    if (target.kind !== "node") return "target-missing";
    const record = input.root.domInputs.get(identity);
    if (!record) return "target-missing";
    const layout = record.layout;
    if (change.kind === "sticky") {
      if (layout.position === "sticky") continue;
      const writes: Partial<Record<LayoutField, WriteValue<string>>> = {
        position: { kind: "set", value: "sticky" },
        insetTop: { kind: "set", value: "0px" },
      };
      for (const key of ["insetLeft", "insetRight", "insetBottom"] as const)
        if (layout[key] !== undefined) writes[key] = clear;
      for (const key of ["justifySelf", "alignSelf"] as const)
        if (layout[key] === CATALOG_CENTER_ALIGN) writes[key] = clear;
      commands.push(
        setFields({ targets: [target], breakpoint, layout: writes }),
      );
      continue;
    }
    if (change.kind === "stickyInset") {
      const raw = change.value.trim();
      const value = raw === "" || raw === "auto" ? undefined : insetText(raw);
      if (raw !== "" && raw !== "auto" && !value)
        throw new CatalogStyleValueError(change.side, change.value);
      const key = SIDE[change.side].key;
      if (!value && layout[key] === undefined) continue;
      commands.push(
        setFields({
          targets: [target],
          breakpoint,
          layout: { [key]: value ? { kind: "set", value } : clear },
        }),
      );
      continue;
    }
    if (change.kind === "relative") {
      const value =
        change.value.trim() === "" ? "0px" : insetText(change.value);
      if (!value) throw new CatalogStyleValueError(change.side, change.value);
      // Entering Relative: the insets a flow box kept from an absolute past would come back as
      // offsets — only the typed side is an offset.
      const entering = layout.position !== "relative";
      const stale = entering
        ? Object.fromEntries(
            (["insetLeft", "insetTop", "insetRight", "insetBottom"] as const)
              .filter(
                (key) =>
                  key !== SIDE[change.side].key && layout[key] !== undefined,
              )
              .map((key) => [key, clear]),
          )
        : {};
      commands.push(
        setFields({
          targets: [target],
          breakpoint,
          layout: {
            ...stale,
            ...(entering
              ? { position: { kind: "set", value: "relative" } }
              : {}),
            [SIDE[change.side].key]: { kind: "set", value },
          },
        }),
      );
      continue;
    }
    const frame = catalogPlacementFrame(
      input.root,
      identity,
      layout.position === "fixed" ? "fixed" : "absolute",
    );
    if (!frame) return "geometry-missing";
    const { box, cb } = frame;
    const current = catalogReadPositionConstraint(layout);
    const next: { x: CatalogAxisConstraint; y: CatalogAxisConstraint } = {
      ...current,
    };
    const writes: Partial<Record<LayoutField, WriteValue<string>>> = {};
    const sizing: Partial<
      Record<"width" | "height", WriteValue<number | null>>
    > = {};
    const visual: Partial<Record<"width" | "height", WriteValue<string>>> = {};
    /** Explicit side values typed by the user (over the computed ones). */
    const typed: Partial<Record<LayoutField, string>> = {};
    if (change.kind === "constraint") next[change.axis] = change.constraint;
    else if (change.kind === "fill") {
      next.x = "both";
      next.y = "both";
      for (const key of [
        "insetLeft",
        "insetRight",
        "insetTop",
        "insetBottom",
      ] as const)
        typed[key] = "0px";
    } else {
      const side = SIDE[change.side];
      const axis = side.axis;
      const kind = current[axis];
      const value = change.value.trim();
      if (value === "") {
        // Only a Left+Right side lets go (an axis is never empty).
        if (kind !== "both") continue;
        next[axis] = side.end ? "start" : "end";
      } else {
        const text = insetText(value);
        if (!text) throw new CatalogStyleValueError(change.side, change.value);
        if (kind === "center" && !side.end) {
          typed[AXIS_KEYS[axis].start] = text;
          typed[AXIS_KEYS[axis].end] = negate(text);
        } else if (kind === "both") typed[side.key] = text;
        else {
          next[axis] = side.end ? "end" : "start";
          typed[side.key] = text;
        }
      }
    }
    Object.assign(
      writes,
      catalogPositionLayoutWrites({
        layout,
        constraint: next,
        box,
        cb,
        breakpoint,
      }),
    );
    for (const [key, text] of Object.entries(typed))
      writes[key as LayoutField] = { kind: "set", value: text };
    for (const axis of ["x", "y"] as const) {
      const size = AXIS_KEYS[axis].size;
      if (next[axis] === "both" && current[axis] !== "both") {
        // Decision 4 — a stretched axis has no size of its own (CSS drops the end inset otherwise).
        // A breakpoint layer writes `null` (auto) — sizing takes no mask (`SIZING_MASK_FORBIDDEN`).
        sizing[size] =
          breakpoint === "desktop"
            ? { kind: "remove" }
            : { kind: "set", value: null };
        visual[size] = { kind: "set", value: "auto" };
      } else if (current[axis] === "both" && next[axis] !== "both") {
        sizing[size] = { kind: "set", value: Math.round(box[size]) };
        if (record.visual[size] === "auto") visual[size] = clear;
      }
    }
    commands.push(
      setFields({
        targets: [target],
        breakpoint,
        layout: writes,
        ...(Object.keys(sizing).length ? { sizing } : {}),
        ...(Object.keys(visual).length ? { visual } : {}),
      }),
    );
  }
  // Nothing to write (an already-sticky box · emptying a side that has no value).
  if (!commands.length) return null;
  return (reader) => ({
    label: "Position",
    ops: commands.flatMap((command) => command(reader).ops),
  });
}
