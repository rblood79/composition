import type { InteractionConcept } from "./types";

/**
 * ADR-300 Phase 4 — S2 `SideNavPanel` collapse (`SideNav.md` · installed `@react-spectrum/s2` 1.8.1
 * `SideNavPanel.d.ts`): `isCollapsed` / `defaultCollapsed` / `onCollapsedChange`. RAC has no panel —
 * S2 builds it on a `div` and a RAC `Button` — so the names are S2's, mirrored here (`packages/shared`
 * does not depend on S2; the D2 gate `d2S2Alignment.static.test.ts` checks the binding against the
 * installed types).
 */
export interface S2SideNavPanelCollapseProps {
  isCollapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
}

export const sidePanelCollapse = {
  id: "collapse",
  racDoc: "S2 SideNav.md — SideNavPanel",
  racType: "S2 SideNavPanelProps",
  events: ["onCollapsedChange"],
  args: { onCollapsedChange: ["isCollapsed"] },
  state: {
    prop: "isCollapsed",
    defaultProp: "defaultCollapsed",
    callback: "onCollapsedChange",
    valueType: "boolean",
  },
  conditions: [],
  capabilities: {
    collapse: { labelKey: "capabilities.collapse", value: true },
    expand: { labelKey: "capabilities.expand", value: false },
    toggleCollapse: {
      labelKey: "capabilities.toggleCollapse",
      value: "!self",
    },
  },
} as const satisfies InteractionConcept;
