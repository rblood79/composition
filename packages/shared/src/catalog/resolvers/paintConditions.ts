import type { ConditionSet } from "../rule/conditionTree";
import type { CatalogInteractionState } from "./resolveCatalogPaint";

/**
 * ADR-297 — the conditions a variant's paint tree is evaluated with: the record's state props and
 * the interaction state. One builder for every reader of the tree's resting or live paint
 * (`resolveCatalogPaint` · ADR-303 container layer), so a branch a rule adds is read the same way.
 */
export function catalogPaintConditions(
  props: Readonly<Record<string, unknown>>,
  interactionState: CatalogInteractionState = "default",
): ConditionSet {
  return {
    isHovered: interactionState === "hover",
    isExpanded: props._overlayOpen === true,
    isPicker: props._pickerTrigger === true,
    isSearchFieldPart: props._searchFieldPart === true,
    isPressed: interactionState === "pressed",
    isFocused: props._isFocused === true,
    isFocusVisible: props._isFocusVisible === true,
    inPopover: props._inPopover === true,
    isSelected: props.isSelected === true,
    isEmphasized: props.isEmphasized === true,
    isInvalid: props.isInvalid === true,
    isQuiet: props.isQuiet === true,
    // ADR-297 3h #7 — S2 disabled is a color (`Button.tsx` `isDisabled: 'disabled'`), not opacity; the
    //   record's `isDisabled` (own · inherited — `presence.ts`) is the DOM's `data-disabled`.
    isDisabled: props.isDisabled === true,
    // ADR-300: an S2 SideNav row's current mark · its panel's collapse (`catalogSideNavDerived`).
    // (2026-11-14: and a Nav's current Link — `navRoute.ts`.)
    isCurrent: props._sideNavCurrent === true || props._navCurrent === true,
    isCollapsed: props._sideNavCollapsed === true,
    ...(typeof props.size === "string" ? { size: props.size } : {}),
    ...(typeof props.fillStyle === "string"
      ? { fillStyle: props.fillStyle }
      : {}),
  };
}

/** The static color scheme a record paints with (`staticColor` black · white — the tree's branch). */
export function catalogPaintStaticTone(
  props: Readonly<Record<string, unknown>>,
): "black" | "white" | undefined {
  const staticColor = props.staticColor;
  return staticColor === "black" || staticColor === "white"
    ? staticColor
    : undefined;
}
