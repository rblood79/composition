// ADR-318 — the Resizable split view's origin (breakdown §5.1): `Group > Panel · Handle · Panel`, 50 / 50
// (the Panels' shares are equal parts — no `defaultSize`). The Group fills its parent's width at a fixed
// height so its main axis is definite either way (HC8 — a vertical Group's main axis is that height).
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

export const RESIZABLE_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-resizablepanelgroup",
    name: "ResizablePanelGroup",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-resizablepanelgroup",
  },
];

export const RESIZABLE_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-resizablepanelgroup",
    definitionId: "lib:definition:type-ResizablePanelGroup",
    // (Its Panels and Handles are its items — the Group is a strict collection of them; the item
    //  「+」 that keeps the Panel · Handle pairs is Phase 6's command.)
    slot: { name: "Panels", required: false },
    children: [
      "lib:template:component-resizablepanelgroup__panel-1",
      "lib:template:component-resizablepanelgroup__handle-1",
      "lib:template:component-resizablepanelgroup__panel-2",
    ],
    props: { orientation: "horizontal" },
    visual: { width: "100%", height: 200 },
  },
  {
    id: "lib:template:component-resizablepanelgroup__panel-1",
    definitionId: "lib:definition:type-ResizablePanel",
    children: [],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-resizablepanelgroup__handle-1",
    definitionId: "lib:definition:type-ResizableHandle",
    children: [],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-resizablepanelgroup__panel-2",
    definitionId: "lib:definition:type-ResizablePanel",
    children: [],
    props: {},
    visual: {},
  },
];
