import type { PrimitiveBinding } from "../types";

/**
 * ADR-318 — Resizable 분할창: reui `ResizablePanelGroup` · `ResizablePanel` · `ResizableHandle`
 * (`react-resizable-panels` 의 어휘). RAC 1.22.1 · S2 1.8.2 · design-data · v3 어디에도 분할창이 없어
 * 세 type 모두 composition 확장이다 (D2 정본 순서 4 — `d2Provenance.ts` `CATALOG_D2_COMPOSITION_TYPES`).
 *
 * Node tree: `ResizablePanelGroup > ResizablePanel (ResizableHandle ResizablePanel)*` — the Handle is a
 * node (a part is a node, its look its own rule). D1: Group · Panel are plain `div`s (no role); the
 * Handle's `role="separator"` and its keys · pointer are the closed D1 exception (ADR-318 breakdown §4 —
 * Phase 2). D3: `rule/resizable.ts`.
 *
 * Size (Decision 3 · `runtime/resizablePanels.ts`): a Panel's share is its `defaultSize` (%), the rest
 * share what remains; `minSize` · `maxSize` take % or px (사용자 결정 2, 2026-11-26 — a number or
 * `"25%"` is a %, `"200px"` px).
 */
export const resizablePanelGroupBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "resizablepanelgroup" },
  props: {
    accepts: {
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      // (Phase 2: none of its Handles drags — reui / react-resizable-panels `disabled`.)
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // Phase 5 (사용자 결정 5) — a Publish app keeps its Panels' sizes · collapses in that browser
      //   (react-resizable-panels `autoSaveId`; Table 「Remember state」 의 방식 — the session's
      //   storage). The Builder's Preview never keeps them.
      rememberSizes: {
        kind: "boolean",
        label: "Remember sizes",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};

export const resizablePanelBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "resizablepanel" },
  props: {
    accepts: {
      // (Absent = an equal part of what the other Panels leave — no default, so it stays absent.)
      // The three sizes are edited in the Layout tab's Size fields on the Group's axis (Width · Min W
      //   · Max W, a vertical Group's Height ones) and by the Canvas size handle — one store, not a
      //   second set of fields here (사용자 2026-11-26 「Layout 탭 size 와 동기화」).
      defaultSize: {
        kind: "number",
        label: "Default size",
        section: "appearance",
        editorHidden: true,
      },
      minSize: {
        kind: "string",
        label: "Min size",
        section: "appearance",
        editorHidden: true,
      },
      maxSize: {
        kind: "string",
        label: "Max size",
        section: "appearance",
        editorHidden: true,
      },
      // Phase 3 — collapse (react-resizable-panels `collapsible` · `collapsedSize`; the state is S2
      //   SideNavPanel's names — `isCollapsed` · `defaultCollapsed` · the `collapse` concept): the
      //   Canvas draws the start state, the Preview runs it (Enter · double click · a drag past the
      //   middle of min and collapsed size · Do 「Collapse · Expand · Toggle collapse」).
      collapsible: { kind: "boolean", label: "Collapsible", section: "state" },
      collapsedSize: {
        kind: "string",
        label: "Collapsed size",
        section: "appearance",
        visibleWhen: { key: "collapsible", truthy: true },
      },
      isCollapsed: {
        kind: "boolean",
        label: "Collapsed",
        section: "value",
        visibleWhen: { key: "collapsible", truthy: true },
      },
      defaultCollapsed: {
        kind: "boolean",
        label: "Default collapsed",
        section: "state",
        editorHidden: true,
      },
      // (Phase 2: its Handles do not move it.)
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};

export const resizableHandleBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "resizablehandle" },
  props: {
    accepts: {
      // Phase 4 — reui's pill (사용자 결정 7: one) · `withHandle` grip (shadcn / reui name).
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "line",
      },
      withHandle: {
        kind: "boolean",
        label: "With handle",
        section: "appearance",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // (The separator's name — absent = the language's 「Resize panels」. The Design panel does not
      //  offer ARIA attributes (사용자 결정 2026-11-11); a rule · the code view can set it.)
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
