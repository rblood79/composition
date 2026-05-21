// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";
import { afterEach, describe, expect, it } from "vitest";

import { resolveCanonicalDocument } from "../../resolvers/canonical";
import type { RenderContext } from "../types";
import { CanonicalNodeRenderer } from "./CanonicalNodeRenderer";

function makeRenderContext(): RenderContext {
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    eventEngine: {} as RenderContext["eventEngine"],
    renderElement: () => null,
  };
}

function renderResolved(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
  );
}

function makeTabsDocument(): CompositionDocument {
  const tabOrigin: CanonicalNode = {
    id: "tab-origin",
    type: "Tab",
    reusable: true,
    name: "Tab",
    children: [
      {
        id: "tab-label",
        type: "Text",
        props: { text: "Tab" },
      },
      {
        id: "tab-indicator",
        type: "frame",
        props: { enabled: false },
      },
    ],
  };
  const tabListOrigin: CanonicalNode = {
    id: "tablist-origin",
    type: "TabList",
    reusable: true,
    children: [
      {
        id: "tab-ref-overview",
        type: "ref",
        ref: "tab-origin",
        descendants: {
          "tab-label": { text: "Overview" },
          "tab-indicator": { enabled: true },
        },
      } as RefNode,
      {
        id: "tab-ref-settings",
        type: "ref",
        ref: "tab-origin",
        descendants: {
          "tab-label": { text: "Settings" },
        },
      } as RefNode,
    ],
  };
  const tabsOrigin: CanonicalNode = {
    id: "tabs-origin",
    type: "Tabs",
    reusable: true,
    props: {
      "aria-label": "Sections",
      defaultSelectedKey: "tab-ref-overview",
      orientation: "horizontal",
      showIndicator: true,
    },
    children: [
      {
        id: "tabs-tablist-ref",
        type: "ref",
        ref: "tablist-origin",
      } as RefNode,
      {
        id: "panel-overview",
        type: "TabPanel",
        props: { id: "tab-ref-overview" },
        children: [
          {
            id: "panel-overview-body",
            type: "Text",
            props: { children: "Overview panel content" },
          },
        ],
      },
      {
        id: "panel-settings",
        type: "TabPanel",
        props: { id: "tab-ref-settings" },
        children: [
          {
            id: "panel-settings-body",
            type: "Text",
            props: { children: "Settings panel content" },
          },
        ],
      },
    ],
  };

  return {
    version: "composition-1.0",
    children: [
      tabOrigin,
      tabListOrigin,
      tabsOrigin,
      {
        id: "tabs-instance",
        type: "ref",
        ref: "tabs-origin",
      } as RefNode,
    ],
  };
}

describe("ADR-144 Phase 3 Tabs Preview resolved-tree projection", () => {
  afterEach(cleanup);

  it("renders resolved Tab/TabPanel child owners with canonical markers", () => {
    const resolvedTabs = resolveCanonicalDocument(makeTabsDocument()).find(
      (node) => node.id === "tabs-instance",
    );
    expect(resolvedTabs).toBeDefined();

    const { container } = renderResolved(resolvedTabs!);

    const tabsRoot = container.querySelector(
      "[data-canonical-id='tabs-instance']",
    );
    expect(tabsRoot?.classList.contains("react-aria-Tabs")).toBe(true);

    const overviewTab = screen.getByRole("tab", { name: /Overview/ });
    expect(overviewTab.dataset.canonicalId).toBe("tab-ref-overview");
    expect(within(overviewTab).getByText("Overview").dataset.canonicalId).toBe(
      "tab-label",
    );

    const panel = container.querySelector(
      "[data-canonical-id='panel-overview']",
    );
    expect(panel?.classList.contains("react-aria-TabPanel")).toBe(true);
    expect(
      within(panel as HTMLElement).getByText("Overview panel content").dataset
        .canonicalId,
    ).toBe("panel-overview-body");
  });
});

function makeCollectionCompositeDocument(opts: {
  itemType: string;
  containerType: string;
  containerProps?: Record<string, unknown>;
  refLabels: [string, string, string];
}): CompositionDocument {
  const itemOrigin: CanonicalNode = {
    id: "item-origin",
    type: opts.itemType as CanonicalNode["type"],
    reusable: true,
    name: opts.itemType,
    children: [
      {
        id: "item-label",
        type: "Text",
        props: { text: "Item" },
      },
    ],
  };
  const containerOrigin: CanonicalNode = {
    id: "container-origin",
    type: opts.containerType as CanonicalNode["type"],
    reusable: true,
    name: opts.containerType,
    slot: ["item-origin"],
    props: opts.containerProps ?? {},
    children: opts.refLabels.map(
      (label, index): RefNode => ({
        id: `ref-${index}`,
        type: "ref",
        ref: "item-origin",
        descendants: {
          "item-label": { text: label },
        },
      }),
    ) as unknown as CanonicalNode[],
  };
  return {
    version: "composition-1.0",
    children: [
      itemOrigin,
      containerOrigin,
      {
        id: "container-instance",
        type: "ref",
        ref: "container-origin",
      } as RefNode,
    ],
  };
}

describe("ADR-144 Phase 7 collection Preview marker contract", () => {
  afterEach(cleanup);

  it.each([
    {
      label: "ListBox",
      itemType: "ListBoxItem",
      containerType: "ListBox",
      containerProps: {
        "aria-label": "ListBox",
        selectionMode: "single",
      },
      refLabels: ["Aardvark", "Cat", "Kangaroo"] as [string, string, string],
      racClass: "react-aria-ListBox",
    },
    {
      label: "Menu",
      itemType: "MenuItem",
      containerType: "Menu",
      containerProps: {
        "aria-label": "Menu",
        children: "Menu",
        selectionMode: "none",
      },
      refLabels: ["Profile", "Billing", "Settings"] as [string, string, string],
      // shared MenuButton wraps the canonical root inside a layout div, so the
      // canonical marker stays on the wrapper instead of the RAC primitive.
      racClass: null,
    },
    {
      label: "ComboBox",
      itemType: "ComboBoxItem",
      containerType: "ComboBox",
      containerProps: {
        "aria-label": "Combo Box",
        label: "Combo Box",
        placeholder: "Pick one",
      },
      refLabels: ["Aardvark", "Cat", "Kangaroo"] as [string, string, string],
      racClass: "react-aria-ComboBox",
    },
    {
      label: "Select",
      itemType: "SelectItem",
      containerType: "Select",
      containerProps: {
        "aria-label": "Select",
        label: "Select",
        placeholder: "Pick one",
      },
      refLabels: ["Aardvark", "Cat", "Kangaroo"] as [string, string, string],
      racClass: "react-aria-Select",
    },
  ])(
    "$label root container instance exposes the canonical data-canonical-id marker",
    ({
      itemType,
      containerType,
      containerProps,
      refLabels,
      racClass,
    }: {
      itemType: string;
      containerType: string;
      containerProps: Record<string, unknown>;
      refLabels: [string, string, string];
      racClass: string | null;
    }) => {
      const doc = makeCollectionCompositeDocument({
        itemType,
        containerType,
        containerProps,
        refLabels,
      });
      const resolved = resolveCanonicalDocument(doc).find(
        (node) => node.id === "container-instance",
      );
      expect(resolved).toBeDefined();

      const { container } = renderResolved(resolved!);

      const marker = container.querySelector(
        "[data-canonical-id='container-instance']",
      );
      expect(marker).toBeTruthy();
      if (racClass) {
        expect(marker?.classList.contains(racClass)).toBe(true);
      }
    },
  );
});
