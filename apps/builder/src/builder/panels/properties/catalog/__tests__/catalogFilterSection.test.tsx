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
import { translations } from "../../../../../i18n/translations";
import {
  catalogFilterCommand,
  catalogFilterConnections,
  catalogOrFilterCondition,
  catalogRemoveFilterCondition,
  catalogSharedViewOf,
  catalogShareView,
} from "../../../../catalogRuntime/viewAuthoring";
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
const i18nEn = Object.fromEntries(
  Object.entries(translations["en-US"].dataView).map(([key, value]) => [
    `dataView.${key}`,
    value,
  ]),
) as Record<string, string>;

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

  it("a shared view says how many read it and offers 「This list only」; a hand-made variable no list reads is named with 「Connect」", () => {
    const w = fixture.workspace;
    const gender = { id: "f-gender", key: "gender", type: "string" };
    // (A filter on the GridList, shared with the Table.)
    const made = catalogFilterCommand(
      w.runtime.graph,
      {
        listId: nodeIdOf("list"),
        field: gender,
        kind: "radio",
        control: { nodeId: nodeIdOf("radio") },
        values: ["male", "female"],
        allLabel: "All",
      },
      w.newId,
    );
    w.execute(made.command);
    w.execute(
      catalogShareView(
        w.runtime.graph,
        {
          listId: nodeIdOf("list"),
          name: "People",
          otherIds: [nodeIdOf("table")],
        },
        w.newId,
      ),
    );
    act(() => fixture.select("table"));
    const view = renderDesign();
    const group = groupByLegend("Search · filter");
    expect(group.textContent).toContain('Shared view "People" — read by 2');
    act(() => {
      fireEvent.click(buttonByText(group, "This list only"));
    });
    expect(
      catalogSharedViewOf(w.runtime.graph, nodeIdOf("table")),
    ).toBeUndefined();
    view.unmount();
    // (The B habit: the condition goes, the RadioGroup's variable and rule stay — nothing reads it.)
    // (Both the shared view and the Table's copy drop the condition.)
    for (const id of ["list", "table"])
      w.execute(
        catalogRemoveFilterCondition(
          w.runtime.graph,
          nodeIdOf(id),
          made.created.conditionId,
        ),
      );
    act(() => fixture.select("list"));
    renderDesign();
    const listGroup = groupByLegend("Search · filter");
    expect(listGroup.querySelector('[role="note"]')?.textContent).toContain(
      "No list reads the variable genderFilter that RadioGroup sets",
    );
    fireEvent.click(
      buttonByText(listGroup, "Connect as this list's condition"),
    );
    act(() => {
      fireEvent.click(buttonByText(listGroup, "Create"));
    });
    const [connection] = catalogFilterConnections(
      w.runtime.graph,
      nodeIdOf("list"),
    );
    expect(connection!.variable!.id).toBe(made.created.variableId);
    expect(connection!.controls).toEqual([
      { nodeId: nodeIdOf("radio"), ruleId: made.created.ruleId },
    ]);
  });

  it("a connection's detail: 「Not running」 and the default, then the Preview's value — each local row's verdict from the evaluator", () => {
    const w = fixture.workspace;
    const made = catalogFilterCommand(
      w.runtime.graph,
      {
        listId: nodeIdOf("list"),
        field: { id: "f-gender", key: "gender", type: "string" },
        kind: "radio",
        control: { nodeId: nodeIdOf("radio") },
        values: ["male", "female"],
        allLabel: "All",
      },
      w.newId,
    );
    w.execute(made.command);
    act(() => fixture.select("list"));
    renderDesign();
    const group = groupByLegend("Search · filter");
    fireEvent.click(buttonByText(group, "gender Equals · RadioGroup"));
    const run = () => group.querySelector(".data-view-run")!;
    expect(run().textContent).toContain("Not running — default all");
    // (「all」 skips: both rows shown, the condition skipped.)
    expect(
      [...run().querySelectorAll("li")].map((li) => li.textContent),
    ).toEqual([
      "Kim — this condition: skipped · shown",
      "Park — this condition: skipped · shown",
    ]);
    act(() => {
      w.setPreviewValues({ [made.created.variableId]: "female" });
    });
    expect(run().textContent).toContain("Current value (Preview): female");
    expect(
      [...run().querySelectorAll("li")].map((li) => li.textContent),
    ).toEqual([
      "Kim — this condition: no match · hidden",
      "Park — this condition: match · shown",
    ]);
  });

  it("an API collection's detail shows the request it sends and what it cannot carry — no reason for rows the server left out", () => {
    const w = fixture.workspace;
    const store = useDataStore.getState();
    const users = store.collections.get("users")!;
    useDataStore.setState({
      collections: new Map([["users", { ...users, useMockData: false }]]),
      apiEndpoints: new Map([
        [
          "list",
          {
            id: "list",
            name: "list",
            method: "GET",
            baseUrl: "https://api.test",
            path: "/users",
            headers: [],
            queryParams: [],
            bodyType: "none",
            responseMapping: { dataPath: "items" },
            targetCollectionId: "users",
            querySerialization: { kind: "suffix" },
          } as never,
        ],
      ]),
    });
    const made = catalogFilterCommand(
      w.runtime.graph,
      {
        listId: nodeIdOf("list"),
        field: { id: "f-name", key: "name", type: "string" },
        kind: "text",
        control: { insert: true },
        values: [],
        allLabel: "All",
      },
      w.newId,
    );
    w.execute(made.command);
    act(() => fixture.select("list"));
    renderDesign();
    const group = groupByLegend("Search · filter");
    fireEvent.click(group.querySelector(".data-view-connection-summary")!);
    act(() => {
      w.setPreviewValues({ [made.created.variableId]: "pa" });
    });
    const run = group.querySelector(".data-view-run")!;
    expect(run.textContent).toContain("Request sent: ?name_like=pa");
    expect(run.textContent).toContain(
      "Why the server left a row out cannot be told here.",
    );
    expect(run.querySelectorAll("li")).toHaveLength(0);
  });

  it("walkthrough §9.3 ③ ⑦ ⑩ — names carry their meaning; an `or` the API cannot send is named in the condition's own detail", () => {
    const w = fixture.workspace;
    const store = useDataStore.getState();
    const users = store.collections.get("users")!;
    useDataStore.setState({
      collections: new Map([["users", { ...users, useMockData: false }]]),
      apiEndpoints: new Map([
        [
          "list",
          {
            id: "list",
            name: "list",
            method: "GET",
            baseUrl: "https://api.test",
            path: "/users",
            headers: [],
            queryParams: [],
            bodyType: "none",
            responseMapping: { dataPath: "items" },
            targetCollectionId: "users",
            querySerialization: { kind: "suffix" },
          } as never,
        ],
      ]),
    });
    const made = catalogFilterCommand(
      w.runtime.graph,
      {
        listId: nodeIdOf("list"),
        field: { id: "f-gender", key: "gender", type: "string" },
        kind: "radio",
        control: { nodeId: nodeIdOf("radio") },
        values: ["male", "female"],
        allLabel: "All",
      },
      w.newId,
    );
    w.execute(made.command);
    // ③ 「또는 조건 추가」 wraps the condition (the root stays `and`).
    w.execute(
      catalogOrFilterCondition(
        w.runtime.graph,
        nodeIdOf("list"),
        made.created.conditionId,
        "second",
      ),
    );
    act(() => fixture.select("list"));
    renderDesign();
    const group = groupByLegend("Search · filter");
    fireEvent.click(group.querySelector(".data-view-connection-summary")!);
    // ⑦ at authoring time: the `or` the suffix format cannot carry.
    expect(
      group.querySelector('[aria-label="Conditions the request cannot carry"]')
        ?.textContent,
    ).toContain("or-group — cannot be parameters");
    // ③ ⑩ the comparison names say what they mean (less than ≠ at most · any ≠ all · ends).
    const options = (key: string) => i18nEn[`dataView.op_${key}`];
    expect([
      options("lt"),
      options("lte"),
      options("containsAny"),
      options("containsAll"),
      options("between"),
    ]).toEqual([
      "Less than",
      "At most",
      "Contains any of",
      "Contains all of",
      "Between (ends included)",
    ]);
  });
});

describe("ADR-284 G4 — derived views in the Design panel", () => {
  const graph = () => fixture.workspace.runtime.graph;
  const pageNodes = () =>
    Object.values(graph().exportDocument().entries).filter(
      (entry): entry is NodeEntry => entry.kind === "node",
    );

  it("「Show result count」: one step — the list's view promoted, a count view, a Text reading its row", () => {
    act(() => fixture.select("list"));
    renderDesign();
    const depth = fixture.workspace.runtime.historyDepth.undo;
    act(() => {
      fireEvent.click(
        buttonByText(groupByLegend("Search · filter"), "Show result count"),
      );
    });
    expect(fixture.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    const list = graph().getEntry(nodeIdOf("list")) as NodeEntry;
    expect(list.binding!.viewId).toBeTruthy();
    const text = pageNodes().find(
      (node) => typeOf(node) === "Text" && node.binding?.key === "row-1",
    )!;
    expect(text.props.children).toMatchObject({ value: "Results: {count}" });
    const count = graph().getEntry(text.binding!.viewId!) as {
      source: { viewId: string };
      aggregates: unknown;
    };
    expect(count.source.viewId).toBe(list.binding!.viewId);
    expect(count.aggregates).toEqual([{ fn: "count", as: "count" }]);
  });

  it("「Group into columns」 → field → Create: a column per value with its list and heading", () => {
    act(() => fixture.select("list"));
    renderDesign();
    fireEvent.click(
      buttonByText(groupByLegend("Search · filter"), "Group into columns"),
    );
    act(() => {
      fireEvent.click(buttonByText(groupByLegend("Search · filter"), "Create"));
    });
    // (The first field — name: Kim · Park, one column each.)
    const lists = pageNodes().filter(
      (node) => typeOf(node) === "GridList" && node.id !== nodeIdOf("list"),
    );
    expect(lists).toHaveLength(2);
    const headings = pageNodes().filter(
      (node) => typeOf(node) === "Text" && node.binding?.key,
    );
    expect(headings.map((node) => node.binding!.key)).toEqual(["Kim", "Park"]);
  });
});
