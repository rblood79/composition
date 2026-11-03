import { isRTL } from "@react-aria/i18n";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogPartParent, type CatalogOriginBodyOpen } from "./presence";

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/** RAC SheetOverlay's viewport portal, excluding Library/Local body editing samples. */
export function catalogSheetViewport(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  originBodyOpen: CatalogOriginBodyOpen,
  editingOrigins: boolean,
): boolean {
  if (editingOrigins || typeOf(node) !== "SheetOverlay") return false;
  const trigger = catalogPartParent(node, get, typeOf);
  return !(trigger && originBodyOpen(trigger));
}

/** RAC Sheet's settled stage alignment (Sheet.tsx POSITION_ALIGNMENT). */
export function catalogSheetPosition(value: unknown, locale: string): string {
  const position = String(value || "bottom");
  if (position === "start" || position === "end")
    return (position === "start") !== isRTL(locale) ? "left" : "right";
  return position;
}

/** Layout inputs for the existing engine; no document fields or DOM styles are rewritten. */
export function catalogSheetPartLayout(
  node: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  locale: string,
): Record<string, unknown> | undefined {
  if (node.hidden) return undefined;
  const type = typeOf(node);
  if (type === "SheetOverlay" && node.derivedProps?._sheetViewport === true) {
    const position = catalogSheetPosition(node.props.position, locale);
    return {
      position: "fixed",
      insetLeft: "0px",
      insetTop: "0px",
      width: "100vw",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems:
        position === "left"
          ? "flex-start"
          : position === "right"
            ? "flex-end"
            : "center",
      justifyContent:
        position === "top"
          ? "flex-start"
          : position === "bottom"
            ? "flex-end"
            : "center",
      overflowX: "hidden",
      overflowY: "hidden",
    };
  }
  if (type !== "Sheet" && type !== "SheetBackdrop" && type !== "SheetContent")
    return undefined;
  const parent = catalogPartParent(node, get, typeOf);
  const overlay =
    type === "SheetContent" && parent
      ? catalogPartParent(parent, get, typeOf)
      : parent;
  if (overlay?.derivedProps?._sheetViewport !== true) return undefined;
  if (type === "SheetContent") return { width: "100%", height: "100%" };
  if (type === "SheetBackdrop")
    return {
      position: "absolute",
      insetLeft: "0px",
      insetTop: "0px",
      width: "100%",
      height: "100%",
    };
  return { flexShrink: 0 };
}
