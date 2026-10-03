import {
  moveNodes,
  setFields,
  setFillSizing,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type {
  EditTarget,
  NodeId,
  NodePlacement,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type { RatioEditError } from "../utils/ratioEditError";
import { catalogBoxModel } from "./boxModel";
import type { CatalogCompositionRoot } from "./compositionRoot";
import { CatalogStyleValueError, cssPx } from "./styleFields";

/** A node's absolute placement as the CSS the Position section reads. */
export function catalogPlacementStyle(
  placement: NodePlacement | undefined,
): Record<string, string> {
  return placement?.kind === "absolute"
    ? {
        position: "absolute",
        left: `${placement.x}px`,
        top: `${placement.y}px`,
      }
    : {};
}

interface PositionItem {
  target: EditTarget;
  identity: string;
}

/**
 * ADR-248 Phase 4e-4d-3: the Position section's absolute toggle (ADR-224 §6.1). On: each
 * selected node keeps where it is drawn — its box offset from the parent's padding-box origin
 * becomes `placement` — a fill axis becomes its measured px (a placed box does not take part in
 * the parent's flow), and it moves to the front of its siblings. Off: the placement goes. One step
 * for the selection; a template position (no own placement) is refused.
 */
export function catalogAbsoluteCommand(input: {
  items: readonly PositionItem[];
  on: boolean;
  root: CatalogCompositionRoot;
  graph: CatalogGraph;
  own: (target: EditTarget) => OwnFields;
  newId: NewId;
}): CatalogCommand | RatioEditError {
  const commands: CatalogCommand[] = [];
  for (const { target, identity } of input.items) {
    if (target.kind !== "node") return "target-missing";
    if (!input.on) {
      commands.push(
        setWholeField({
          targets: [target],
          field: "placement",
          value: undefined,
        }),
      );
      continue;
    }
    const rect = input.root.getGeometry([identity]).get(identity);
    if (!rect) return "geometry-missing";
    const record = input.root.domInputs.get(identity);
    const parent = record
      ? input.root.domInputs.get(record.parentId)
      : undefined;
    const border = parent ? catalogBoxModel(parent).borderWidth : undefined;
    const inset = typeof border === "number" ? border : 0;
    commands.push(
      setWholeField({
        targets: [target],
        field: "placement",
        value: {
          kind: "absolute",
          x: Math.round(rect.x - inset),
          y: Math.round(rect.y - inset),
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
  return (reader) => ({
    label: input.on ? "Absolute position" : "Flow position",
    ops: commands.flatMap((command) => command(reader).ops),
  });
}

/**
 * Left / Top edits of absolutely placed nodes: px offsets of their `placement` (each node keeps
 * its other axis). Anything but px is refused — the placement holds pixel offsets.
 */
export function catalogPlacementEditCommand(input: {
  targets: readonly EditTarget[];
  own: (target: EditTarget) => OwnFields;
  left?: string;
  top?: string;
}): CatalogCommand {
  const offset = (key: "left" | "top", raw: string | undefined) => {
    if (raw === undefined) return undefined;
    if (raw.trim() === "") return 0;
    const px = cssPx(raw);
    if (px === undefined) throw new CatalogStyleValueError(key, raw);
    return Math.round(px);
  };
  const x = offset("left", input.left);
  const y = offset("top", input.top);
  const commands = input.targets.flatMap((target) => {
    const placement = input.own(target).placement;
    if (placement?.kind !== "absolute") return [];
    return [
      setWholeField({
        targets: [target],
        field: "placement",
        value: { kind: "absolute", x: x ?? placement.x, y: y ?? placement.y },
      }),
    ];
  });
  return (reader) => ({
    label: "Position",
    ops: commands.flatMap((command) => command(reader).ops),
  });
}
