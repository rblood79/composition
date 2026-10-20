import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EditTarget,
  LayoutWrites,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-275 test fixture: an authored absolute box is `layout.position: absolute` + insets. These
 * helpers write a Left · Top box and read it back as `{ kind, x, y }` (what the node `placement`
 * field held before contract 42).
 */
const set = (value: string) => ({ kind: "set" as const, value });

export const absoluteLayout = (x: number, y: number): LayoutWrites => ({
  position: set("absolute"),
  insetLeft: set(`${x}px`),
  insetTop: set(`${y}px`),
});

export const placeAbsolute = (target: EditTarget, x: number, y: number) =>
  setFields({ targets: [target], layout: absoluteLayout(x, y) });

/** A Left · Top absolute node's offsets; undefined when it is not absolute. */
export function absolutePlacementOf(
  entry: unknown,
): { kind: "absolute"; x: number; y: number } | undefined {
  const node = entry as NodeEntry | undefined;
  if (node?.kind !== "node") return undefined;
  const layout = node.layout ?? {};
  const text = (key: keyof LayoutWrites) => {
    const write = layout[key];
    return write?.kind === "set" ? write.value : undefined;
  };
  if (text("position") !== "absolute") return undefined;
  return {
    kind: "absolute",
    x: parseFloat(text("insetLeft") ?? "0"),
    y: parseFloat(text("insetTop") ?? "0"),
  };
}
