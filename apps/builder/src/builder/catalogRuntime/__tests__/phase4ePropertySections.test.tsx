import { act, fireEvent, render, screen, within } from "@testing-library/react";
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createPage,
  duplicateNodes,
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { I18nProvider } from "../../../i18n";
import { createCatalogDataUsageSource } from "../../panels/datatable/usage/catalogDataUsageSource";
import { createCatalogQuickConnectHost } from "../../panels/datatable/usage/catalogQuickConnectHost";
import { DataUsageSourceContext } from "../../panels/datatable/usage/dataUsageSource";
import { QuickConnectHostContext } from "../../panels/datatable/usage/quickConnectHost";
import { DesignPanel } from "../../panels/design/DesignPanel";
import { useDesignPanelView } from "../../panels/design/designPanelView";
import { CatalogAttributesSection } from "../../panels/properties/catalog/CatalogAttributesSection";
import { CatalogPageSection } from "../../panels/properties/catalog/CatalogPageSection";
import { CatalogSlotSection } from "../../panels/properties/catalog/CatalogSlotSection";
import { CatalogStateSection } from "../../panels/properties/catalog/CatalogStateSection";
import { catalogHtmlIdCommand, catalogUniqueHtmlId } from "../attributes";
import { catalogComponentCommands } from "../componentActions";
import { catalogEditContract } from "../editContract";
import { catalogPageCommands } from "../pageSettings";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { catalogItemInsertChoices } from "../itemInsert";
import {
  catalogSlotCommands,
  catalogSlotDeclaration,
  catalogSlotInsertOptions,
  catalogSlotPosition,
} from "../slots";
import {
  catalogOwnVariables,
  catalogVariableCommands,
} from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Properties sections: the author DOM id stays unique (a taken id is refused,
 * the check assigns `base_N`); a collection's items are its child nodes or its data binding.
 */
const PROJECT = "project:project:sections" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (name: string, definitionId: string): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Sections" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-sections-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
        node("list", "lib:definition:type-ListBox"),
      ],
      rootIds: [id("a"), id("b"), id("list")],
      newId: (kind) => `project:${kind}:s${++n}` as never,
    }),
  );
  return { workspace };
}

// The Design panel opens on its Property tab (ADR-252 — the tab state is a session store).
beforeEach(() => useDesignPanelView.setState({ view: "property" }));

describe("ADR-248 Phase 4e-4 Properties sections", () => {
  it("an author DOM id stays unique; the check assigns the next free base_N", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    const set = (name: string, value: string) => {
      const edit = catalogHtmlIdCommand(graph, id(name), value);
      if ("command" in edit) workspace.execute(edit.command);
      return edit;
    };
    expect("command" in set("a", "hero")).toBe(true);
    expect(set("b", "hero")).toEqual({ refused: "HTML_ID_TAKEN" });
    // It keeps the id its insert gave it.
    expect(graph.getEntry(id("b"))).toHaveProperty("metadata.htmlId", "text_2");
    expect(catalogUniqueHtmlId(graph, "hero", id("b"))).toBe("hero_1");
    set("b", "hero_1");
    expect(catalogUniqueHtmlId(graph, "hero_1", id("a"))).toBe("hero_2");
    // Its own id is not a conflict; an empty id removes it.
    expect("command" in set("a", "hero")).toBe(true);
    set("a", "");
    expect(graph.getEntry(id("a"))).not.toHaveProperty("metadata.htmlId");
  });

  // The old ID field (idValidation · PropertyCustomId): an HTML id starts with a letter and holds
  // letters, digits, hyphens and underscores — a malformed or taken id shows a message under the
  // field and keeps the stored id.
  it("the ID field refuses a malformed or taken id under the field and keeps the stored one", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    const [item] = workspace.itemsOfNode(id("b"), 1);
    workspace.session.select([item!]);
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogAttributesSection
            target={item!.target}
            identity={item!.identity}
          />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const field = () =>
      screen.getByRole("group", { name: "ID" }).querySelector("input")!;
    const commit = async (value: string) => {
      fireEvent.change(field(), { target: { value } });
      await act(async () => {
        fireEvent.keyDown(field(), { key: "Enter" });
      });
    };
    const stored = () =>
      (graph.getEntry(id("b")) as NodeEntry).metadata?.htmlId;
    expect(stored()).toBe("text_2");
    for (const bad of ["1abc", "a b", "a.b", "제목"]) {
      await commit(bad);
      expect([bad, stored()]).toEqual([bad, "text_2"]);
      expect(screen.getByRole("alert").textContent).toMatch(
        /start with a letter/,
      );
      expect(field().value).toBe("text_2");
    }
    await commit("text_1");
    expect(stored()).toBe("text_2");
    expect(screen.getByRole("alert").textContent).toMatch(/text_1/);
    await commit("hero-1_a");
    expect(stored()).toBe("hero-1_a");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a collection offers no items manager — its items are child nodes or its data binding", async () => {
    // 2026-10-09 (사용자 「slot 방식과 data binding 방식만 사용하는것이 레퍼런스에 맞는 방법」): RAC's
    // static collection is its JSX children (the slot "+"), its dynamic one `items` with a render
    // function (the data binding's rows with the item node as template). The old inline `items`
    // array (no renderer read it since ADR-256) is gone; the items manager stays for Chart data.
    const { workspace } = await open();
    const fields = catalogEditContract(
      workspace.runtime.graph,
      workspace.readModel,
      { kind: "node", id: id("list") },
    ).fields;
    expect(fields.some((field) => field.kind === "items-manager")).toBe(false);
    expect(fields.some((field) => field.kind === "binding")).toBe(true);
  });

  it("the catalog Properties panel shows a Chart's own controls and writes through them", async () => {
    const { workspace } = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("chart", "lib:definition:origin-component-chart")],
        rootIds: [id("chart")],
        newId: (kind) => `project:${kind}:chart1` as never,
      }),
    );
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <DataUsageSourceContext.Provider
            value={createCatalogDataUsageSource(workspace)}
          >
            <QuickConnectHostContext.Provider
              value={createCatalogQuickConnectHost(
                workspace,
                {
                  apply: async () => ({ applied: [], inverse: [] }),
                  collection: () => undefined,
                },
                (name) => name,
              )}
            >
              <DesignPanel />
            </QuickConnectHostContext.Provider>
          </DataUsageSourceContext.Provider>
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    // The Chart editor's authoring controls (not catalog accepts fields) render in the panel.
    expect(screen.getByRole("group", { name: /^Chart type$/ })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /reference line/i }),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Series", {
        selector: ".section-title, .section-title *",
      }).length,
    ).toBeGreaterThan(0);
  });

  it("the State section adds a variable, refuses a name taken on the chain and writes a free one", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    const page = "project:page:home" as EntryId<"page">;
    workspace.execute(
      catalogVariableCommands.add(page, "taken", workspace.newId),
    );
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogStateSection nodeId={id("a")} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    // The page's variable shows as visible from an ancestor.
    expect(
      container.querySelector(".state-ancestor-row")?.textContent,
    ).toContain("taken");
    const add = within(container).getByRole("button", { name: "Add" });
    expect(add.closest(".section-header .section-actions")).not.toBeNull();
    await act(async () => {
      fireEvent.click(
        within(container).getByRole("button", { name: "Collapse section" }),
      );
    });
    expect(container.querySelector(".section-content")).toBeNull();
    await act(async () => {
      fireEvent.click(add);
    });
    const own = () => catalogOwnVariables(graph, id("a"));
    expect(own().map((variable) => variable.name)).toEqual(["state1"]);
    expect(container.querySelector(".state-def-toggle")).toBeNull();
    const nameField = within(container).getByRole("group", { name: "Name" });
    expect(
      nameField.querySelector(".react-aria-control .state-variable-type"),
    ).not.toBeNull();
    expect(nameField.querySelector(".select-chevron")).toBeNull();
    expect(
      within(container)
        .getByRole("button", { name: "Delete" })
        .closest(".fieldset-actions"),
    ).not.toBeNull();
    const revision = graph.revision;
    const input = container.querySelector(
      ".state-variable-row input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "taken" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(container.querySelector(".state-def-error")?.textContent).toContain(
      "taken",
    );
    expect(graph.revision).toBe(revision);
    fireEvent.change(input, { target: { value: "open" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(own().map((variable) => variable.name)).toEqual(["open"]);
    expect(graph.revision).toBe(revision + 1);
    expect(container.querySelector(".state-def-error")).toBeNull();
    // The default field was rendered before the rename; its edit keeps the new name.
    const defaultInput = container.querySelectorAll(
      ".state-variable-row input",
    )[1] as HTMLInputElement;
    fireEvent.change(defaultInput, { target: { value: "hello" } });
    await act(async () => {
      fireEvent.keyDown(defaultInput, { key: "Enter" });
    });
    expect(own()).toMatchObject([{ name: "open", defaultValue: "hello" }]);
    // Changing the embedded type keeps the edited name and resets the default for that type.
    const typeSelect = nameField.querySelector(".state-variable-type select")!;
    await act(async () => {
      fireEvent.change(typeSelect, { target: { value: "number" } });
    });
    expect(own()).toMatchObject([
      { name: "open", valueType: "number", defaultValue: 0 },
    ]);
    expect(nameField.querySelector("button")?.textContent).toBe("number");
  });

  it("the component state commits only changed names and removes or resets in the same field", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    const page = "project:page:home" as EntryId<"page">;
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogStateSection nodeId={id("list")} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const group = () =>
      container.querySelector('[data-group="implicit"]') as HTMLElement;
    expect(group().querySelectorAll("legend")).toHaveLength(1);
    const input = within(group()).getByRole("textbox", {
      name: "Variable name",
    }) as HTMLInputElement;
    const remove = within(group()).getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;
    expect(input.disabled).toBe(false);
    expect(input.value).toBe("selectedKeys");
    expect(remove.disabled).toBe(true);
    expect(remove.closest(".fieldset-actions")).not.toBeNull();
    expect(remove.closest(".react-aria-control")).toBeNull();
    expect(
      within(group()).queryByRole("button", { name: "Use elsewhere" }),
    ).toBeNull();
    const revision = graph.revision;
    await act(async () => {
      input.focus();
      fireEvent.keyDown(input, { key: "Enter" });
    });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(graph.revision).toBe(revision);
    expect(catalogOwnVariables(graph, page)).toEqual([]);
    expect(remove.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "draftName" } });
    expect(remove.disabled).toBe(false);
    // Focusing the reset button must not first commit an unwanted source variable.
    await act(async () => {
      fireEvent.blur(input, { relatedTarget: remove });
      fireEvent.click(remove);
    });
    expect(input.value).toBe("selectedKeys");
    expect(graph.revision).toBe(revision);
    expect(catalogOwnVariables(graph, page)).toEqual([]);
    expect(remove.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "1bad" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(within(group()).getByRole("alert")).toBeTruthy();
    expect(input.disabled).toBe(false);
    expect(graph.revision).toBe(revision);
    fireEvent.change(input, { target: { value: "selectedKeys " } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(input.value).toBe("selectedKeys");
    expect(within(group()).queryByRole("alert")).toBeNull();
    expect(graph.revision).toBe(revision);

    fireEvent.change(input, { target: { value: "picked" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(graph.revision).toBe(revision + 1);
    const variable = catalogOwnVariables(graph, page).find(
      (item) => item.name === "picked",
    );
    expect(variable).toMatchObject({
      valueType: "string[]",
      source: { nodeId: id("list"), prop: "selectedKeys" },
    });
    expect(
      within(group()).getByRole("textbox", { name: "Variable name" }),
    ).toBe(input);
    expect(group().querySelectorAll("input")).toHaveLength(1);
    expect(group().querySelector(".state-def-editor")).toBeNull();
    expect(remove.disabled).toBe(false);
    const savedRevision = graph.revision;
    await act(async () => {
      input.focus();
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(graph.revision).toBe(savedRevision);

    fireEvent.change(input, { target: { value: "chosen" } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(catalogOwnVariables(graph, page)).toMatchObject([
      { id: variable!.id, name: "chosen" },
    ]);
    const beforeRemove = graph.revision;
    fireEvent.change(input, { target: { value: "unsavedName" } });
    await act(async () => {
      fireEvent.blur(input, { relatedTarget: remove });
      fireEvent.click(remove);
    });
    expect(graph.revision).toBe(beforeRemove);
    expect(catalogOwnVariables(graph, page)).toMatchObject([
      { name: "chosen" },
    ]);
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Delete",
        }),
      );
    });
    expect(catalogOwnVariables(graph, page)).toEqual([]);
    expect(input.disabled).toBe(false);
    expect(input.value).toBe("selectedKeys");
    expect(remove.disabled).toBe(true);
    const removedRevision = graph.revision;
    await act(async () => {
      input.focus();
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(graph.revision).toBe(removedRevision);
  });

  it("the page section refuses a malformed route with a message and writes a valid one", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    const page = "project:page:home" as EntryId<"page">;
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogPageSection pageId={page} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const route = container.querySelector(
      ".page-slug-input input",
    ) as HTMLInputElement;
    expect(route.value).toBe("/");
    const revision = graph.revision;
    fireEvent.change(route, { target: { value: "a b" } });
    await act(async () => {
      fireEvent.keyDown(route, { key: "Enter" });
    });
    expect(within(container).getByRole("alert").textContent).toMatch(
      /letters, numbers/,
    );
    expect(graph.revision).toBe(revision);
    fireEvent.change(route, { target: { value: "about" } });
    await act(async () => {
      fireEvent.keyDown(route, { key: "Enter" });
    });
    expect(graph.getEntry(page)).toMatchObject({ route: "/about" });
    expect(within(container).queryByRole("alert")).toBeNull();
  });

  it("the page section shows the route a new parent gives and brings it along in one step", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    const page = (name: string) => `project:page:${name}` as EntryId<"page">;
    for (const [name, route, parentId] of [
      ["docs", "/docs"],
      ["guide", "/guide"],
      ["intro", "/guide/intro", "guide"],
    ] as const)
      workspace.execute(
        createPage({
          page: {
            kind: "page",
            id: page(name),
            route,
            name,
            children: [],
            ...(parentId ? { parentId: page(parentId) } : {}),
          },
        }),
      );
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogPageSection pageId={page("guide")} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const update = () =>
      screen.queryByRole("button", { name: "Update route (incl. children)" });
    // In line (a root page): nothing to offer.
    expect(update()).toBeNull();
    act(() =>
      workspace.execute(
        catalogPageCommands.parent(page("guide"), page("docs")),
      ),
    );
    expect(
      container.querySelector(".page-resolved-url-value")?.textContent,
    ).toBe("/docs/guide");
    // The stored route stays until the user takes the offer.
    expect(graph.getEntry(page("guide"))).toMatchObject({ route: "/guide" });
    await act(async () => {
      fireEvent.click(update()!);
    });
    expect(graph.getEntry(page("guide"))).toMatchObject({
      route: "/docs/guide",
    });
    expect(graph.getEntry(page("intro"))).toMatchObject({
      route: "/docs/guide/intro",
    });
    expect(update()).toBeNull();
  });

  it("a Button origin instance offers Label · Icon (its own props); setting an icon keeps one Label field", async () => {
    const { workspace } = await open();
    const button = id("button");
    // ADR-276: the palette Button is `Button > Icon{icon} + Text{label}` — its words are the
    // instance's `label`, its glyph the `icon` prop (no child fields, no own `children`).
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node("button", "lib:definition:origin-component-button"),
            props: { label: { kind: "set", value: "Save" } },
          },
        ],
        rootIds: [button],
        newId: (kind) => `project:${kind}:btn1` as never,
      }),
    );
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <DesignPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const textInputs = () =>
      [...container.querySelectorAll("input")].filter(
        (input) => (input as HTMLInputElement).value === "Save",
      );
    const labelLegends = () =>
      [...container.querySelectorAll("legend, label")].filter(
        (label) => label.textContent === "Label",
      );
    expect(within(container).getAllByText("Icon").length).toBeGreaterThan(0);
    expect(labelLegends()).toHaveLength(1);
    expect(textInputs()).toHaveLength(1);
    // No field writes the root's own `children` (the words are the Text child's `{label}`).
    expect(
      [...container.querySelectorAll("legend")].some(
        (legend) => legend.textContent === "Children",
      ),
    ).toBe(false);
    await act(async () => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: button }],
          props: { icon: { kind: "set", value: "star" } },
        }),
      );
    });
    expect(labelLegends()).toHaveLength(1);
    expect(textInputs()).toHaveLength(1);
  });

  it("the slot section declares a slot on a template node and restores an instance's slot content", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node("card", "lib:definition:type-frame"),
            children: [id("slotted")],
          },
          node("slotted", "lib:definition:type-frame"),
        ],
        rootIds: [id("card")],
        newId: workspace.newId,
      }),
    );
    // ADR-279: the definition owns "card"; the instance in its place.
    const instance = workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    ).plan.selectAfter![0];
    const declare = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogSlotSection target={{ kind: "node", id: id("slotted") }} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    await act(async () => {
      fireEvent.click(within(declare.container).getByRole("switch"));
    });
    expect(catalogSlotDeclaration(graph, id("slotted"))).toEqual({
      slot: { name: "content", required: false },
    });
    declare.unmount();

    const target = {
      kind: "descendant" as const,
      ownerId: instance,
      address: {
        instances: [instance],
        templatePath: [id("card"), id("slotted")] as TemplateId[],
      },
    };
    workspace.execute(
      catalogSlotCommands.fill(target, "lib:definition:text", workspace.newId),
    );
    const position = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogSlotSection target={target} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    // (What fills the slot is listed by the Layers tree, not here.)
    expect(catalogSlotPosition(graph, target)?.fillIds).toHaveLength(1);
    expect(position.container.querySelector(".list-row")).toBeNull();
    // The restore is the Fill slot row's icon action, not a labelled button under the field.
    const restoreButton = within(position.container).getByRole("button", {
      name: "Restore template content",
    });
    expect(
      restoreButton.closest(".slot-fill-row > .fieldset-actions"),
    ).not.toBeNull();
    expect(restoreButton.textContent).toBe("");
    await act(async () => {
      fireEvent.click(restoreButton);
    });
    expect(catalogSlotPosition(graph, target)?.fillIds).toBe(undefined);
    // Nothing of the instance's own to restore: the action goes.
    expect(
      within(position.container).queryByRole("button", {
        name: "Restore template content",
      }),
    ).toBeNull();
  });

  // The insert list is the Swap picker's (2026-10-21): a project component's row under 「Local」,
  // the Library's under 「Library」, the suggested ones first — and a Local pick fills the slot with
  // an instance of that component.
  // 2026-10-22 user 「slot section 두개가 중복」 · 「항목 목록, 삭제는 layers 트리와 중복」: a placed
  // ListBox's Items slot has one Slot section — the picker (its item types built like the old 「+」 —
  // 「Item 4」 — and the section type) and the restore; the items list and their removal are the
  // Layers tree's.
  it("a placed ListBox has one Slot section: no items list or 「+」 rows; the picker adds an item as the item 「+」 did", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("lb", "lib:definition:origin-component-listbox")],
        rootIds: [id("lb")],
        newId: workspace.newId,
      }),
    );
    const slot = { kind: "node" as const, id: id("lb") };
    // (Three items and the list's empty state IllustratedMessage, 2026-10-23.)
    expect(catalogSlotPosition(graph, slot)?.fillIds).toHaveLength(4);
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <DataUsageSourceContext.Provider
            value={createCatalogDataUsageSource(workspace)}
          >
            <QuickConnectHostContext.Provider
              value={createCatalogQuickConnectHost(
                workspace,
                {
                  apply: async () => ({ applied: [], inverse: [] }),
                  collection: () => undefined,
                },
                (name) => name,
              )}
            >
              <DesignPanel />
            </QuickConnectHostContext.Provider>
          </DataUsageSourceContext.Provider>
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    expect(
      screen.getAllByText("Slot", {
        selector: ".section-title, .section-title *",
      }),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll(".frame-slot-fill .list-row"),
    ).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Insert / })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fill slot" }));
    });
    const options = within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toContain("ListBoxItem");
    expect(options).toContain("ListBoxSection");
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("listbox")).getByRole("option", {
          name: "ListBoxItem",
        }),
      );
    });
    const fills = catalogSlotPosition(graph, slot)!.fillIds!;
    // (The new item goes before the empty state, which stays last.)
    expect(fills).toHaveLength(5);
    expect(JSON.stringify(graph.getEntry(fills[3]))).toContain("Item 4");
  });

  // 2026-10-22 user 「listbox 에 slot - listboxitem 추가해도 instance 객체가 아니다」: a ListBox's item
  // is an instance of the item origin its template uses (ListBoxItem/Default) — with no item left
  // to copy the shape from too, and from the slot list's Library choice (the fill path).
  it("a ListBox item added from the Slot picker is an instance of the template's item origin, with no sibling left too", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("lb", "lib:definition:origin-component-listbox")],
        rootIds: [id("lb")],
        newId: workspace.newId,
      }),
    );
    const slot = { kind: "node" as const, id: id("lb") };
    const origin = (
      graph.getEntry(
        catalogSlotPosition(graph, slot)!.fillIds![0]!,
      ) as NodeEntry
    ).definitionId;
    expect(origin).toBe("lib:definition:origin-component-listbox-item-default");
    // The slot list's Library choice is that origin (a fill is an instance too).
    expect(
      catalogSlotInsertOptions(graph, slot).find(
        (option) => option.type === "ListBoxItem",
      )?.definitionId,
    ).toBe(origin);
    // No item left to copy: the item 「+」 still makes an instance of the origin.
    workspace.execute(
      removeTargets({
        // (Its items — its EmptyState goes only with the list, 2026-10-23.)
        targets: catalogSlotPosition(graph, slot)!
          .fillIds!.filter(
            (fill) =>
              (graph.getEntry(fill) as NodeEntry).definitionId !==
              "lib:definition:origin-component-illustratedmessage",
          )
          .map((fill) => ({
            kind: "node" as const,
            id: fill,
          })),
      }),
    );
    const position = workspace.positionOfRecord(
      workspace.root.recordsOfSource(id("lb"))[0]!,
    )!;
    const choice = catalogItemInsertChoices(
      { graph, readModel: workspace.readModel, newId: workspace.newId },
      position,
    ).find((item) => item.type === "ListBoxItem")!;
    workspace.execute(choice.build());
    // (The new item, then the list's EmptyState that stayed.)
    const added = catalogSlotPosition(graph, slot)!.fillIds!;
    expect(added).toHaveLength(2);
    expect((graph.getEntry(added[0]!) as NodeEntry).definitionId).toBe(origin);
  });

  // 2026-10-22 user 「listboxsection 추가 - slot 에서 listboxitem 추가 — instance 객체가 아닌 요소」: a
  // section holds no template items and no sibling yet — the item is still an instance of the item
  // origin the ListBox family uses.
  it("a new ListBoxSection is the section origin's instance with its header; an item added in it is a ListBoxItem origin instance", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("lb", "lib:definition:origin-component-listbox")],
        rootIds: [id("lb")],
        newId: workspace.newId,
      }),
    );
    const host = {
      graph,
      readModel: workspace.readModel,
      newId: workspace.newId,
    };
    const choiceAt = (record: string, type: string) =>
      catalogItemInsertChoices(host, workspace.positionOfRecord(record)!).find(
        (item) => item.type === type,
      )!;
    const listRecord = workspace.root.recordsOfSource(id("lb"))[0]!;
    const sectionId = workspace.execute(
      choiceAt(listRecord, "ListBoxSection").build(),
    ).plan.selectAfter![0]!;
    // 2026-10-22 user 「섹션도 원본 instance 만 넣고 header 가 포함」: the section is an instance of
    // the ListBoxSection origin, holding its header and items as its own nodes (as placed).
    expect((graph.getEntry(sectionId) as NodeEntry).definitionId).toBe(
      "lib:definition:origin-component-listbox-section",
    );
    const sectionFill = (
      graph.getEntry(sectionId) as NodeEntry
    ).descendantOverrides.find((override) => override.kind === "fillSlot") as
      { childIds: readonly NodeId[] } | undefined;
    expect(
      sectionFill?.childIds.map(
        (child) => (graph.getEntry(child) as NodeEntry).definitionId,
      ),
    ).toEqual([
      "lib:definition:type-Header",
      "lib:definition:origin-component-listbox-item-default",
      "lib:definition:origin-component-listbox-item-default",
    ]);
    const sectionRecord = workspace.root.recordsOfSource(sectionId)[0]!;
    const itemId = workspace.execute(
      choiceAt(sectionRecord, "ListBoxItem").build(),
    ).plan.selectAfter![0]!;
    expect((graph.getEntry(itemId) as NodeEntry).definitionId).toBe(
      "lib:definition:origin-component-listbox-item-default",
    );
  });

  it("the slot section's insert list groups Local and Library components and names a Local fill by its component", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node("card", "lib:definition:type-frame"),
            children: [id("slotted")],
          },
          {
            ...node("slotted", "lib:definition:type-frame"),
            slot: { name: "content", required: false },
          },
          node("body", "lib:definition:type-frame"),
        ],
        rootIds: [id("card"), id("body")],
        newId: workspace.newId,
      }),
    );
    const instance = workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    ).plan.selectAfter![0];
    workspace.execute(
      catalogComponentCommands.create(
        id("body"),
        "Confirm body",
        workspace.newId,
      ),
    );
    const target = {
      kind: "descendant" as const,
      ownerId: instance,
      address: {
        instances: [instance],
        templatePath: [id("card"), id("slotted")] as TemplateId[],
      },
    };
    const section = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogSlotSection target={target} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    await act(async () => {
      fireEvent.click(
        within(section.container).getByRole("button", { name: "Fill slot" }),
      );
    });
    // Groups in order, each with its header; the Local component sits under Local only. (The
    // search field is a group too — the list's sections are read inside the list.)
    const list = screen.getByRole("listbox");
    const groups = within(list)
      .getAllByRole("group")
      .map((group) => ({
        header: group.querySelector("header")?.textContent,
        options: within(group)
          .getAllByRole("option")
          .map((option) => option.textContent),
      }));
    expect(groups.map((group) => group.header)).toEqual(["Local", "Library"]);
    expect(groups[0].options).toEqual(["Confirm body"]);
    expect(groups[1].options).toContain("Text");
    expect(groups[1].options).not.toContain("Confirm body");
    // The list is its own scroller — not the panel Select's popover.
    expect(list.className).toContain("component-swap-list");
    // The search is the Builder SearchField, and the trigger is a panel field (not the name chip).
    expect(
      screen.getByRole("searchbox").closest(".builder-search-field--control"),
    ).not.toBeNull();
    expect(
      section.container.querySelector(
        ".slot-insert-field .react-aria-Group > .slot-fill-trigger",
      ),
    ).not.toBeNull();
    const local = within(within(list).getAllByRole("group")[0]).getByRole(
      "option",
      {
        name: "Confirm body",
      },
    );
    await act(async () => {
      fireEvent.click(local);
    });
    expect(catalogSlotPosition(graph, target)?.fillIds).toHaveLength(1);
    // The fill is an instance of 「Confirm body」 (the Layers tree names it).
    const fill = graph.getEntry(
      catalogSlotPosition(graph, target)!.fillIds![0]!,
    ) as NodeEntry;
    expect(
      (graph.getEntry(fill.definitionId) as { name?: string } | undefined)
        ?.name,
    ).toBe("Confirm body");
    section.unmount();
  });

  // ADR-256 Decision 4: what a position takes is its children kind — the template's `slot` is a name
  // only. A Calendar's header declares no slot, yet its insert list offers the month · year pickers —
  // as a template position and as an owned node (the calendar's month frame filled: its blocks are
  // the document's own nodes then).
  for (const owned of [false, true])
    it(`a free-content position with no slot declared (a Calendar's header${owned ? ", owned" : ""}) has the insert list`, async () => {
      const { workspace } = await open();
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            node("calendar", "lib:definition:origin-component-calendar"),
          ],
          rootIds: [id("calendar")],
          newId: workspace.newId,
        }),
      );
      const root = workspace.root;
      const recordOf = (type: string) =>
        [...root.domInputs.values()].find(
          (record) => root.typeOf(record) === type,
        )!;
      if (owned) {
        const frame = [...root.domInputs.values()].find(
          (record) =>
            root.typeOf(record) === "frame" &&
            root.typeOf(root.domInputs.get(record.parentId)!) === "Calendar",
        )!;
        const at = workspace.positionOfRecord(frame.id)!.target;
        workspace.execute(
          insertNodes({
            parent:
              at.kind === "descendant"
                ? {
                    kind: "descendant",
                    ownerId: at.ownerId,
                    address: at.address,
                  }
                : { kind: "node", id: at.id },
            entries: [node("note", "lib:definition:text")],
            rootIds: [id("note")],
            newId: workspace.newId,
          }),
        );
      }
      const target = workspace.positionOfRecord(
        recordOf("CalendarHeader").id,
      )!.target;
      expect(target.kind).toBe(owned ? "node" : "descendant");
      expect(catalogSlotPosition(workspace.runtime.graph, target)).toBe(
        undefined,
      );
      const section = render(
        <I18nProvider initialLocale="en-US">
          <CatalogWorkspaceProvider workspace={workspace}>
            <CatalogSlotSection target={target} type="CalendarHeader" />
          </CatalogWorkspaceProvider>
        </I18nProvider>,
      );
      // Another part with no slot (the month frame) takes content from the palette: no list
      // computed per selection (ADR-246 select counts).
      const frame = render(
        <I18nProvider initialLocale="en-US">
          <CatalogWorkspaceProvider workspace={workspace}>
            <CatalogSlotSection
              target={workspace.positionOfRecord(recordOf("frame").id)!.target}
              type="frame"
            />
          </CatalogWorkspaceProvider>
        </I18nProvider>,
      );
      expect(frame.container.textContent).toBe("");
      frame.unmount();
      const select = within(section.container).getByRole("button", {
        name: /Add content/,
      });
      await act(async () => {
        fireEvent.click(select);
      });
      // The header's own parts lead the list (not after the 70 general choices).
      const listed = screen
        .getAllByRole("option")
        .map((option) => option.textContent);
      expect(listed.slice(0, 3)).toEqual([
        "CalendarHeading",
        "CalendarMonthPicker",
        "CalendarYearPicker",
      ]);
      const month = screen
        .getAllByRole("option")
        .find((option) => option.textContent === "CalendarMonthPicker");
      expect(month).toBeDefined();
      await act(async () => {
        fireEvent.click(month!);
      });
      // The picker joins the header after its parts (the heading and the nav Buttons stay).
      const header = recordOf("CalendarHeader");
      expect(
        [...root.domInputs.values()]
          .filter((r) => r.parentId === header.id)
          .map((r) => root.typeOf(r)),
      ).toEqual(["Button", "CalendarHeading", "Button", "CalendarMonthPicker"]);
      section.unmount();
    });
});
