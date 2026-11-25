import type { CatalogConsumerNode } from "./compositionRoot";
import { componentTypeSet } from "../../domain/componentTraits";

/** Menu item triggers RAC draws as a `SubmenuTrigger` (the traits table's `submenuTrigger` family). */
export const CATALOG_SUBMENU_TRIGGER_TYPES: ReadonlySet<string> =
  componentTypeSet("submenuTrigger");

export type OverlayLookup = (id: string) => CatalogConsumerNode | undefined;
export type OverlayTypeOf = (node: CatalogConsumerNode) => string;

/** Open은 trigger/picker의 상태이며 Menu·ListBox·Calendar는 본문이다. */
export const OVERLAY_OPEN_OWNERS: ReadonlySet<string> = new Set([
  "DialogTrigger",
  "MenuTrigger",
  "TooltipTrigger",
  "ContextualHelp",
  "PreviewTrigger",
  "SheetTrigger",
  "Select",
  "ComboBox",
  "DatePicker",
  "DateRangePicker",
]);
export const OVERLAY_BODY_TYPES: ReadonlySet<string> = new Set([
  "Modal",
  "Popover",
  "Tooltip",
  "SheetOverlay",
]);

export function catalogOverlayOwner(
  node: CatalogConsumerNode,
  get: OverlayLookup,
  typeOf: OverlayTypeOf,
): CatalogConsumerNode | undefined {
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    if (
      OVERLAY_OPEN_OWNERS.has(typeOf(parent)) ||
      // (S2 체크리스트 §9.3: an unavailable item's help Popover — RAC's SubmenuTrigger too.)
      CATALOG_SUBMENU_TRIGGER_TYPES.has(typeOf(parent))
    )
      return parent;
    if (OVERLAY_BODY_TYPES.has(typeOf(parent))) return undefined;
  }
  return undefined;
}

export function catalogAuthoredOpen(node: CatalogConsumerNode): boolean {
  return Boolean(
    node.props.isOpen ?? node.props.defaultOpen ?? node.displayState === "open",
  );
}

/** 본문에 직접 작성한 값은 RAC와 같이 trigger context보다 우선한다. */
export function catalogOverlayOpen(
  node: CatalogConsumerNode,
  get: OverlayLookup,
  typeOf: OverlayTypeOf,
): boolean {
  if (node.props.isOpen !== undefined || node.props.defaultOpen !== undefined)
    return catalogAuthoredOpen(node);
  const owner = catalogOverlayOwner(node, get, typeOf);
  return catalogAuthoredOpen(owner ?? node);
}
