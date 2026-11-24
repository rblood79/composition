import { catalogFrameLayerName } from "../../../../../packages/shared/src/catalog/document/frameElementType";
import { readTargetProp } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type {
  CatalogReader,
  EditTarget,
} from "../../../../../packages/shared/src/catalog/document/types";

/**
 * A frame's shown name without one of its own (ADR-316 Decision 2): its HTML element when that is
 * not a `div`, else 「Frame」. The element is the one in effect at the target — a frame inside an
 * instance takes the instance's patch over its template's value (리뷰 round 1 m1, 2026-11-24: the
 * Layers row and the Design panel title read the declared value and stayed 「Frame」 while the
 * Preview drew a `<header>`). The Layers tree and the panel title read this one function.
 */
export function catalogFrameNameAt(
  graph: CatalogReader,
  target: EditTarget,
): string {
  let elementType: unknown;
  try {
    elementType = readTargetProp(graph, target, "elementType");
  } catch {
    // (A target the graph no longer has — the row goes with the next read.)
    elementType = undefined;
  }
  return catalogFrameLayerName({ elementType });
}

/** The node or template node a target stands for (a layout slot under a page body is a template node). */
export function catalogDeclaredAt(
  graph: CatalogReader,
  target: EditTarget,
): { name?: string; slot?: { name: string } } | undefined {
  const id =
    target.kind === "node" ? target.id : target.address.templatePath.at(-1);
  if (!id) return undefined;
  const node = id.startsWith("lib:")
    ? graph.library.templates.get(id as `lib:template:${string}`)
    : graph.getEntry(id);
  return node && "children" in node
    ? (node as { name?: string; slot?: { name: string } })
    : undefined;
}

/**
 * A row's own name and its slot's role — what comes before its type's name (the Layers order): a
 * node's own name (a template node's only when it is a slot), then the slot's name.
 */
export function catalogNamedAt(
  graph: CatalogReader,
  target: EditTarget,
): string | undefined {
  const node = catalogDeclaredAt(graph, target);
  const own = target.kind === "node" || node?.slot ? node?.name : "";
  return own || node?.slot?.name || undefined;
}

/**
 * The name the group command gives its frame (사용자 결정 2026-11-24). It is a default like 「Frame」,
 * not a name the author chose: an HTML element set on the group shows instead (`catalogFrameShownName`).
 */
export const CATALOG_GROUP_FRAME_NAME = "Group";

/**
 * The name a frame shows (ADR-316 Decision 2): its own name → its slot's role → its HTML element in
 * effect → 「Frame」. One order for the Layers row and the Design panel title (리뷰 round 2 m3,
 * 2026-11-24: the title skipped the slot — a Popover's `content` frame set to `header` read
 * 「content」 in Layers and 「header」 in the title).
 *
 * A group's default name gives way to its element (사용자 보고 2026-11-24: two Buttons grouped, the
 * group set to `nav` — the row stayed 「Group」): 「Group」 says only that the frame is a `div`
 * made by grouping, so it reads like 「Frame」 does. A name the author typed stays over the element.
 */
export function catalogFrameShownName(
  graph: CatalogReader,
  target: EditTarget,
): string {
  const named = catalogNamedAt(graph, target);
  const element = catalogFrameNameAt(graph, target);
  if (named === undefined) return element;
  const node = catalogDeclaredAt(graph, target);
  return named === CATALOG_GROUP_FRAME_NAME &&
    node?.name === CATALOG_GROUP_FRAME_NAME &&
    element !== catalogFrameLayerName({})
    ? element
    : named;
}
