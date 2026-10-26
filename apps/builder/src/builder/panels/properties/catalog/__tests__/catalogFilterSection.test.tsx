// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../../../i18n";
import { catalogBindingRef } from "../../../../catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../../catalogRuntime/dataBindingCommand";
import { catalogFilterConnections } from "../../../../catalogRuntime/viewAuthoring";
import { definitionTypeName } from "../../../../../../../../packages/shared/src/catalog/commands/context";
import type { NodeEntry } from "../../../../../../../../packages/shared/src/catalog/document/types";
import { resetCommandRegistry } from "../../../../stores/commandRegistry";
import { useDataStore } from "../../../../stores/data";
import { DesignPanelView } from "../../../design/DesignPanel";
import { useDesignPanelView } from "../../../design/designPanelView";
import { useSectionCollapse } from "../../../styles/hooks/useSectionCollapse";
import {
  nodeIdOf,
  openStylesFixture,
  type StylesFixture,
} from "../../../styles/__tests__/support/catalogStylesFixture";

vi.mock("../../../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: vi.fn(),
}));

/**
 * ADR-284 G3 — the panel entries: a bound list's 「Search · filter」 (「Add search」 → field ·
 * control → Create) and a filter control's 「Filter a list with this control」 make the filter in
 * one step and open its detail as a status (comparison · skip · variable). Measured through the
 * Design panel's Property tab, as an author clicks.
 */
let fixture: StylesFixture;

beforeEach(async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  resetCommandRegistry();
  useDesignPanelView.setState({ view: "property" });
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
  useDataStore.setState({
    collections: new Map([
      [
        "users",
        {
          id: "users",
          name: "Users",
          project_id: "p",
          schema: [
            { id: "f-name", key: "name", type: "string" },
            { id: "f-gender", key: "gender", type: "string" },
          ],
          mockData: [
            { name: "Kim", gender: "male" },
            { name: "Park", gender: "female" },
          ],
          runtimeData: [],
          useMockData: true,
        } as never,
      ],
    ]),
  });
  fixture = await openStylesFixture(
    [
      { id: "radio", type: "RadioGroup" },
      { id: "list", type: "GridList" },
      { id: "table", type: "Table" },
    ],
    {},
  );
  fixture.workspace.execute(
    catalogBindingCommand(
      [
        { kind: "node", id: nodeIdOf("list") },
        { kind: "node", id: nodeIdOf("table") },
      ],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderDesign = () =>
  render(
    <I18nProvider initialLocale="en-US">
      <div data-panel-id="properties" tabIndex={-1}>
        <DesignPanelView />
      </div>
    </I18nProvider>,
    { wrapper: fixture.wrapper },
  );

/** A panel fieldset by its legend (the Collection section's other fields defeat a role-name query in jsdom). */
const groupByLegend = (text: string): HTMLElement => {
  const legend = [...document.querySelectorAll("legend")].find(
    (item) => item.textContent === text,
  );
  if (!legend?.parentElement) throw new Error(`no fieldset ${text}`);
  return legend.parentElement;
};
const buttonByText = (root: HTMLElement, text: string): HTMLElement => {
  const button = [...root.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!button) throw new Error(`no button ${text}`);
  return button;
};

const typeOf = (node: NodeEntry) =>
  definitionTypeName(fixture.workspace.runtime.graph, node.definitionId);

describe("ADR-284 G3 — 「Search · filter」 in the Design panel", () => {
  it("a bound list: Add search → Create makes a SearchField · variable · rule · condition in one step and shows it as a status", () => {
    act(() => fixture.select("list"));
    renderDesign();
    const group = groupByLegend("Search · filter");
    fireEvent.click(buttonByText(group, "Add search"));
    const depth = fixture.workspace.runtime.historyDepth.undo;
    act(() => {
      fireEvent.click(buttonByText(group, "Create"));
    });
    expect(fixture.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    const graph = fixture.workspace.runtime.graph;
    const [connection] = catalogFilterConnections(graph, nodeIdOf("list"));
    expect(connection!.condition).toMatchObject({
      fields: [["data:field:f-name"]],
      op: "contains",
    });
    expect(
      typeOf(graph.getEntry(connection!.controls[0]!.nodeId) as NodeEntry),
    ).toBe("SearchField");
    const status = group.querySelector('[role="status"]')!;
    expect(status.textContent).toContain("Created");
    expect(status.textContent).toContain("nameFilter");
    // (The connection's summary: the field, the comparison by its meaning, the control.)
    expect(
      group.querySelector(".data-view-connection-summary")?.textContent,
    ).toBe("name Contains (any case) · SearchField");
  });

  it("a RadioGroup: Filter a list with this control → Create feeds the list from the placed control (no second control)", () => {
    act(() => fixture.select("radio"));
    renderDesign();
    const group = screen.getByRole("group", { name: "Filter a list" });
    fireEvent.click(
      within(group).getByRole("button", {
        name: "Filter a list with this control",
      }),
    );
    const nodes = () =>
      [...fixture.workspace.runtime.graph.referrersOf(nodeIdOf("radio"))]
        .length;
    void nodes;
    act(() => {
      fireEvent.click(buttonByText(group, "Create"));
    });
    const graph = fixture.workspace.runtime.graph;
    const [connection] = catalogFilterConnections(graph, nodeIdOf("list"));
    expect(connection!.controls.map((control) => control.nodeId)).toEqual([
      nodeIdOf("radio"),
    ]);
    expect(connection!.condition).toMatchObject({
      op: "equals",
      skip: "all",
    });
    expect(within(group).getByRole("status").textContent).toContain(
      "nameFilter",
    );
  });

  it("「Follow sort」 from the GridList: it follows the page's Table — the sort variable, the Table's rule, both views", () => {
    act(() => fixture.select("list"));
    renderDesign();
    const group = groupByLegend("Search · filter");
    fireEvent.click(buttonByText(group, "Follow sort"));
    act(() => {
      fireEvent.click(buttonByText(group, "Create"));
    });
    const graph = fixture.workspace.runtime.graph;
    const list = graph.getEntry(nodeIdOf("list")) as NodeEntry;
    const table = graph.getEntry(nodeIdOf("table")) as NodeEntry;
    const sort = list.binding!.view!.sort as { variableId: string };
    expect(table.binding!.view!.sort).toEqual(sort);
    expect(graph.getEntry(sort.variableId)).toMatchObject({
      name: "tableSort",
    });
    expect(groupByLegend("Search · filter").textContent).toContain(
      "Sorted by variable tableSort",
    );
  });
});
