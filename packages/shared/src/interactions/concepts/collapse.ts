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

/**
 * ADR-318 Phase 3 — a Resizable Panel's collapse. react-resizable-panels names the behaviour
 * (`collapsible` · `collapsedSize` · `collapse()` · `expand()`); the state takes S2 SideNavPanel's
 * names above (`isCollapsed` · `defaultCollapsed` · `onCollapsedChange`) — no S2 · RAC type has a
 * split-view panel. A Do on a Panel that does not collapse is refused (`collapsible`, constraints).
 * Its When (「Collapse change」) comes with Phase 5 (state connection) — none offered here.
 */
export interface ResizablePanelCollapseProps {
  isCollapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  collapsible?: boolean;
  /** Phase 5 — its size (% of the Group less its Handles) and the change a drag's end · a key gives. */
  size?: number;
  onSizeChange?: (size: number) => void;
}

export const resizablePanelCollapse = {
  id: "collapse",
  racDoc:
    "ADR-318 — Resizable panel collapse (react-resizable-panels behaviour, S2 SideNavPanel names)",
  racType: "ResizablePanelCollapseProps",
  // (Phase 5: 「Collapse change」 — the Handle's Enter · double click · a drag past the middle; a Do's
  //  write does not call it, as RAC calls a change callback for the user's change only.)
  events: ["onCollapsedChange"],
  args: { onCollapsedChange: ["isCollapsed"] },
  state: {
    prop: "isCollapsed",
    defaultProp: "defaultCollapsed",
    callback: "onCollapsedChange",
    valueType: "boolean",
  },
  conditions: ["collapsible"],
  capabilities: {
    collapse: { labelKey: "capabilities.collapse", value: true },
    expand: { labelKey: "capabilities.expand", value: false },
    toggleCollapse: {
      labelKey: "capabilities.toggleCollapse",
      value: "!self",
    },
  },
} as const satisfies InteractionConcept;

/**
 * ADR-318 Phase 5 (사용자 결정 1: a number per Panel) — a Resizable Panel's size: the % of its Group
 * less the Handles (its expanded share while collapsed — `isCollapsed` says that). When 「Resize」 =
 * a drag's end and a key's step (react-resizable-panels `onResize` — named `onSizeChange`: `onResize` is a retired DOM alias, `capabilityRegistry.test.ts`). No Do — the Handles move it.
 */
export const resizablePanelSize = {
  id: "resize",
  racDoc: "ADR-318 — Resizable panel size (react-resizable-panels `onResize`)",
  racType: "ResizablePanelCollapseProps",
  events: ["onSizeChange"],
  args: { onSizeChange: ["size"] },
  state: {
    prop: "size",
    callback: "onSizeChange",
    valueType: "number",
  },
  conditions: [],
} as const satisfies InteractionConcept;
