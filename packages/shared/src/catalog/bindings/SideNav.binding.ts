import type { PrimitiveBinding } from "../types";
import { ITEM_LINK_PROP_CONTRACTS } from "../document/itemLinks";

/**
 * ADR-300 — the SideNav family: S2 `SideNav` · `SideNavPanel` (`@react-spectrum/s2` 1.8.1) as RAC
 * parts. S2 is the prop surface (D2) and the value source (ADR-295) only — the DOM is the installed
 * RAC (`react-aria-components` 1.22.1 `NavigationTree*` · `Link` · `Button`), the look is the
 * catalog rule (D3).
 *
 * Node tree (the S2 reference's, `SideNav.md`):
 *   SideNavPanel > SideNav + Button[slot=collapse] > Icon
 *   SideNav > (SideNavItem | SideNavSection)…
 *   SideNavSection > SideNavHeader + SideNavItem…
 *   SideNavItem > SideNavItemContent + SideNavItem…
 *   SideNavItemContent > (Icon) + (SideNavItemLink > Text | Text) + Button[slot=chevron] > Icon
 *
 * S2 draws the panel's collapse button and each row's chevron itself; here they are the author's
 * `Button` nodes (the Tree chevron's way — ADR-256 Phase 5h), so both consumers lay them out as
 * nodes. The current-route bar is the row's (its rule — no node).
 */

/** S2 `SideNavPanel` — a `div` (`role="region"` when labelled) whose descendants follow its collapse. */
export const sideNavPanelBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenavpanel" },
  props: {
    accepts: {
      // S2 `SideNavPanelProps` (`isCollapsed` · `defaultCollapsed` · `onCollapsedChange`) — the
      //   Canvas draws `isCollapsed ?? defaultCollapsed`; the Preview runs it (ADR-300 Decision 6).
      isCollapsed: { kind: "boolean", label: "Collapsed", section: "value" },
      defaultCollapsed: {
        kind: "boolean",
        label: "Default collapsed",
        section: "state",
        editorHidden: true,
      },
      "aria-label": {
        kind: "string",
        label: "aria-label",
        section: "content",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};

/** S2 `SideNav` — RAC `NavigationTree` (S2 drops the style props, nothing else). */
export const sideNavBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenav" },
  props: {
    accepts: {
      // RAC `NavigationTreeProps.selectedRoute` — matched against each item's `href`. Unset: the
      //   page being drawn (ADR-300 user decision 1).
      selectedRoute: {
        kind: "string",
        label: "Selected route",
        section: "value",
      },
      "aria-label": {
        kind: "string",
        label: "aria-label",
        section: "content",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};

/** S2 `SideNavItem` — RAC `NavigationTreeItem` (`textValue` required, `hasChildItems`). */
export const sideNavItemBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenavitem" },
  props: {
    accepts: {
      textValue: { kind: "string", label: "Text value", section: "content" },
      // RAC item link — the item is the current route when its `href` is the `selectedRoute`.
      ...ITEM_LINK_PROP_CONTRACTS,
      hasChildItems: {
        kind: "boolean",
        label: "Has child items",
        section: "state",
        editorHidden: true,
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

/** S2 `SideNavItemContent` — RAC `NavigationTreeItemContent` (no element of its own). */
export const sideNavItemContentBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenavitemcontent" },
  props: { accepts: {}, toRacProps: "default" },
};

/** S2 `SideNavItemLink` — RAC `Link` (takes the row's `LinkContext`: `href` · `aria-current`). */
export const sideNavItemLinkBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenavitemlink" },
  props: { accepts: {}, toRacProps: "default" },
};

/** S2 `SideNavSection` — RAC `NavigationTreeSection`. */
export const sideNavSectionBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenavsection" },
  props: {
    accepts: {
      "aria-label": {
        kind: "string",
        label: "aria-label",
        section: "content",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};

/** S2 `SideNavHeader` — RAC `NavigationTreeHeader` (its text is its Text child). */
export const sideNavHeaderBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "sidenavheader" },
  props: { accepts: {}, toRacProps: "default" },
};
