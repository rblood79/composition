import type { CSSProperties } from "react";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  CatalogReader,
  NodeEntry,
  NodeId,
  WriteValue,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  LAYOUT_PRESETS,
  PRESET_ORDER,
} from "../panels/properties/editors/LayoutPresetSelector/presetDefinitions";
import {
  PRESET_RESPONSIVE_OWNED_KEYS,
  normalizeFramePresetContainerStyle,
} from "../panels/properties/editors/LayoutPresetSelector/presetStyle";
import type { ResponsiveStyleSet } from "../panels/properties/editors/LayoutPresetSelector/types";
import {
  catalogStyleKeySupported,
  catalogStyleWritesOf,
  type CatalogStyleFieldWrites,
} from "./styleFields";

/**
 * ADR-248 Phase 4e-6-37: the old Layout Preset (Properties of a layout's body) over the catalog
 * document. A layout is a project definition (`usage: "layout"`); its slots are template nodes
 * that declare a slot. Applying a preset is one step: the body takes the preset's container layout
 * (the keys a preset owns are cleared first, so switching presets does not mix them — at the
 * tablet / mobile layers too) and gets one frame per preset slot (declared, with the slot's grid
 * lines / flex size and breakpoint layers). `replace` removes the existing slots (and what they
 * hold) first; `merge` adds only the slots whose name is new.
 */

/** A declared slot of a layout template (the Slots list and the existing-slot dialog). */
export interface CatalogLayoutSlot {
  nodeId: NodeId;
  slotName: string;
  childCount: number;
}

/** The slots under a layout's template root, in template order (an outer slot hides inner ones). */
export function catalogLayoutSlots(
  graph: CatalogReader,
  rootId: NodeId,
): CatalogLayoutSlot[] {
  const out: CatalogLayoutSlot[] = [];
  const visit = (id: NodeId) => {
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    if (node.slot && id !== rootId) {
      out.push({
        nodeId: id,
        slotName: node.slot.name,
        childCount: node.children.length,
      });
      return;
    }
    for (const child of node.children) visit(child);
  };
  visit(rootId);
  return out;
}

/** The preset whose slots the layout has, in the same order (the "applied" mark); else null. */
export function catalogAppliedPreset(
  slots: readonly CatalogLayoutSlot[],
): string | null {
  const names = slots.map((slot) => slot.slotName).join("\n");
  return (
    PRESET_ORDER.find(
      (key) =>
        LAYOUT_PRESETS[key]?.slots.map((slot) => slot.name).join("\n") ===
        names,
    ) ?? null
  );
}

/** Container keys a preset owns at the base (the old `PRESET_OWNED_CONTAINER_KEYS`). */
const OWNED_CONTAINER_KEYS = [
  "display",
  "flexDirection",
  "gridTemplateAreas",
  "gridTemplateColumns",
  "gridTemplateRows",
];
const BREAKPOINTS = ["tablet", "mobile"] as const;

/**
 * A preset style as typed-field CSS: `gridArea` names go (every grid slot also carries its numeric
 * lines, which both consumers read) and `flex: 1` is its longhands.
 */
function presetCss(
  style: CSSProperties | undefined,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    if (value === undefined || key === "gridArea") continue;
    if (key === "flex") {
      const [grow = "1", shrink = "1", basis = "0%"] = String(value)
        .trim()
        .split(/\s+/);
      Object.assign(out, {
        flexGrow: grow,
        flexShrink: shrink,
        flexBasis: basis,
      });
      continue;
    }
    out[key] = value as string | number;
  }
  return out;
}
/** The keys `owned` lists and `styles` does not set, cleared (`""` = remove). */
function cleared(
  owned: Iterable<string>,
  styles: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of owned)
    if (!(key in styles) && catalogStyleKeySupported(key)) out[key] = "";
  return out;
}
/** Only the set writes (a new node has nothing to remove). */
function setOnly<T extends Record<string, WriteValue<unknown> | undefined>>(
  writes: T | undefined,
): T {
  return Object.fromEntries(
    Object.entries(writes ?? {}).filter(([, write]) => write?.kind === "set"),
  ) as T;
}
function layerOf(writes: CatalogStyleFieldWrites) {
  return {
    visual: setOnly(writes.visual),
    layout: setOnly(writes.layout),
    sizing: setOnly(writes.sizing),
  };
}
function slotTitle(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function catalogLayoutPresetCommand(
  graph: CatalogGraph,
  input: {
    rootId: NodeId;
    presetKey: string;
    mode: "replace" | "merge";
    newId: NewId;
  },
): CatalogCommand | undefined {
  const preset = LAYOUT_PRESETS[input.presetKey];
  if (!preset) return undefined;
  const existing = catalogLayoutSlots(graph, input.rootId);
  const names = new Set(existing.map((slot) => slot.slotName));
  const slots =
    input.mode === "merge"
      ? preset.slots.filter((slot) => !names.has(slot.name))
      : preset.slots;
  if (!slots.length) return undefined;
  const root = { kind: "node" as const, id: input.rootId };
  const commands: CatalogCommand[] = [];

  const container = presetCss(
    normalizeFramePresetContainerStyle(preset.containerStyle),
  );
  commands.push(
    setFields({
      targets: [root],
      ...catalogStyleWritesOf({
        ...cleared(OWNED_CONTAINER_KEYS, container),
        ...container,
      }),
    } as Parameters<typeof setFields>[0]),
  );
  const responsive = preset.responsiveContainerStyle as
    ResponsiveStyleSet | undefined;
  for (const breakpoint of BREAKPOINTS) {
    const styles = presetCss(responsive?.[breakpoint]);
    const writes = {
      ...cleared(PRESET_RESPONSIVE_OWNED_KEYS, styles),
      ...styles,
    };
    commands.push(
      setFields({
        targets: [root],
        breakpoint,
        ...catalogStyleWritesOf(writes),
      } as Parameters<typeof setFields>[0]),
    );
  }

  if (input.mode === "replace" && existing.length)
    commands.push(
      removeTargets({
        targets: existing.map((slot) => ({
          kind: "node" as const,
          id: slot.nodeId,
        })),
      }),
    );

  const entries: NodeEntry[] = slots.map((slot) => {
    const layers = Object.fromEntries(
      BREAKPOINTS.flatMap((breakpoint) => {
        const styles = presetCss(slot.responsiveStyle?.[breakpoint]);
        return Object.keys(styles).length
          ? [[breakpoint, layerOf(catalogStyleWritesOf(styles))]]
          : [];
      }),
    );
    return {
      kind: "node",
      id: input.newId("node") as NodeId,
      name: slotTitle(slot.name),
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      ...layerOf(catalogStyleWritesOf(presetCss(slot.defaultStyle))),
      descendantOverrides: [],
      slot: { name: slot.name, required: slot.required },
      ...(Object.keys(layers).length ? { responsive: layers } : {}),
    } as NodeEntry;
  });
  commands.push(
    insertNodes({
      parent: root,
      entries,
      rootIds: entries.map((entry) => entry.id),
      newId: input.newId,
    }),
  );
  // The body stays selected (its Slots list shows the result); the new slots are not selected.
  return () => {
    const plan = composeCommands(graph, "Apply layout preset", commands);
    return { label: plan.label, ops: plan.ops };
  };
}
