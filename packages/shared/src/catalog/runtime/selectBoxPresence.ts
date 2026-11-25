import {
  catalogSelectBoxContentBlocks,
  catalogSelectBoxOrientationStyles,
} from "../document/rulePartRules";
import type { CatalogConsumerNode } from "./compositionRoot";
import { parseGridTemplate } from "./gridStyleAdapter";

export function selectBoxDescriptionHidden(
  slot: unknown,
  orientation: unknown,
): boolean {
  return slot === "description" && orientation !== "horizontal";
}

/** S2 vertical cards keep descriptions authored while neither consumer displays them. */
export function catalogSelectBoxDescriptionHidden(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  if (typeOf(node) !== "Text" || node.props.slot !== "description")
    return false;
  let item = get(node.parentId);
  while (item && typeOf(item) === "frame") item = get(item.parentId);
  const group =
    item && typeOf(item) === "SelectBox" ? get(item.parentId) : undefined;
  return (
    !!group &&
    typeOf(group) === "SelectBoxGroup" &&
    selectBoxDescriptionHidden(node.props.slot, group.props.orientation)
  );
}

/**
 * S2 `selectBoxStyles` (`SelectBoxGroup.tsx:96-97`) picks a box's grid by the parts it holds — label
 * only, no illustration (`:has` blocks the DOM sheet matches). For the Canvas, the box and its slotted
 * parts carry what the box shows: `<orientation>|<slot> …` — its children that are present (not
 * hidden: an empty description · a glyph-less illustration are absent from the DOM too).
 */
export function catalogSelectBoxShown(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): string | undefined {
  const parent = get(node.parentId);
  const box =
    typeOf(node) === "SelectBox"
      ? node
      : typeof node.props.slot === "string" &&
          parent &&
          typeOf(parent) === "SelectBox"
        ? parent
        : undefined;
  const group = box && get(box.parentId);
  if (!box || !group || typeOf(group) !== "SelectBoxGroup") return undefined;
  const slots = box.children
    .map((id) => get(id))
    .filter(
      (child) => child && !child.hidden && typeof child.props.slot === "string",
    )
    .map((child) => String(child!.props.slot));
  return `${String(group.props.orientation ?? "vertical")}|${slots.join(" ")}`;
}

/**
 * The engine input of the S2 `:has` blocks that hold for a box (`_selectBoxShown`) or its slotted
 * part (`_selectBoxPartOf`): the rule's entries (`catalogSelectBoxContentBlocks`), the box's base
 * `grid-auto-rows` with them (S2 `gridAutoRows: 1fr` — the implicit row a description takes with no
 * illustration).
 */
export function catalogSelectBoxContentStyle(
  node: CatalogConsumerNode,
): Record<string, unknown> {
  const derived = node.derivedProps;
  const shown = derived?._selectBoxShown ?? derived?._selectBoxPartOf;
  if (typeof shown !== "string") return {};
  const [orientation = "", list = ""] = shown.split("|");
  const slots = new Set(list.split(" ").filter(Boolean));
  const target =
    derived?._selectBoxShown === undefined
      ? String(node.props.slot)
      : undefined;
  const out: Record<string, unknown> = {};
  const apply = (styles: Readonly<Record<string, string>>) => {
    for (const [key, value] of Object.entries(styles)) {
      if (key === "grid-template-rows")
        out.gridTemplateRows = parseGridTemplate(value);
      else if (key === "grid-auto-rows")
        out.gridAutoRows = parseGridTemplate(value);
      else if (key === "grid-row") {
        const [start, end] = value.split("/").map((part) => part.trim());
        out.gridRowStart = start;
        if (end) out.gridRowEnd = end;
      }
    }
  };
  if (target === undefined) {
    const autoRows =
      catalogSelectBoxOrientationStyles(orientation)["grid-auto-rows"];
    if (autoRows) apply({ "grid-auto-rows": autoRows });
  }
  for (const block of catalogSelectBoxContentBlocks(orientation))
    if (
      block.target === target &&
      block.present.every((slot) => slots.has(slot)) &&
      block.absent.every((slot) => !slots.has(slot))
    )
      apply(block.styles);
  return out;
}
