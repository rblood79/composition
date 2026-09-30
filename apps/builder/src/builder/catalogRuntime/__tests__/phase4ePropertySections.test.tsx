import "fake-indexeddb/auto";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "../../../i18n";
import { FieldValueSourceContext } from "../../panels/properties/generic/fieldValueSource";
import { GenericFieldRenderer } from "../../panels/properties/generic/GenericFieldRenderer";
import { ItemsSourceContext } from "../../panels/properties/generic/itemsSource";
import { CATALOG_FIELD_VALUE_SOURCE } from "../../panels/properties/catalog/catalogFieldValueSource";
import { CATALOG_ITEMS_SOURCE } from "../../panels/properties/catalog/catalogItemsSource";
import { CatalogPropertiesPanel } from "../../panels/properties/catalog/CatalogPropertiesPanel";
import { CatalogPageSection } from "../../panels/properties/catalog/CatalogPageSection";
import { CatalogSlotSection } from "../../panels/properties/catalog/CatalogSlotSection";
import { CatalogStateSection } from "../../panels/properties/catalog/CatalogStateSection";
import { catalogHtmlIdCommand, catalogUniqueHtmlId } from "../attributes";
import { catalogButtonChildCommands } from "../buttonChildren";
import { catalogComponentCommands } from "../componentActions";
import {
  catalogSlotCommands,
  catalogSlotDeclaration,
  catalogSlotPosition,
} from "../slots";
import { catalogEditContract } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import {
  catalogOwnVariables,
  catalogVariableCommands,
} from "../stateVariables";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Properties sections: the author DOM id stays unique (a taken id is refused,
 * the check assigns `base_N`); the shared items manager edits a collection's items through
 * `editItems` (one step per edit) when the catalog items source is provided.
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
    expect(graph.getEntry(id("b"))).not.toHaveProperty("metadata.htmlId");
    expect(catalogUniqueHtmlId(graph, "hero", id("b"))).toBe("hero_1");
    set("b", "hero_1");
    expect(catalogUniqueHtmlId(graph, "hero_1", id("a"))).toBe("hero_2");
    // Its own id is not a conflict; an empty id removes it.
    expect("command" in set("a", "hero")).toBe(true);
    set("a", "");
    expect(graph.getEntry(id("a"))).not.toHaveProperty("metadata.htmlId");
  });

  it("the shared items manager edits a collection's items through editItems", async () => {
    const { workspace } = await open();
    const target = { kind: "node", id: id("list") } as const;
    const record = workspace.root.recordsOfSource(id("list"))[0];
    const fields = catalogEditContract(
      workspace.runtime.graph,
      workspace.readModel,
      target,
    ).fields.filter((field) => field.kind === "items-manager");
    expect(fields.length).toBeGreaterThan(0);
    const items = () =>
      workspace.readModel.propSource(target, fields[0].key).value as
        { id: string; type?: string; label?: string }[] | undefined;
    const before = items()?.length ?? 0;
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <FieldValueSourceContext.Provider value={CATALOG_FIELD_VALUE_SOURCE}>
            <ItemsSourceContext.Provider value={CATALOG_ITEMS_SOURCE}>
              <GenericFieldRenderer
                fields={fields}
                onSemanticUpdate={() => {}}
                onStyleUpdate={() => {}}
                elementId={record}
              />
            </ItemsSourceContext.Provider>
          </FieldValueSourceContext.Provider>
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const revision = workspace.runtime.graph.revision;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Add ListBoxItem/ }));
    });
    expect(items()).toHaveLength(before + 1);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(items()!.at(-1)).toMatchObject({ label: expect.any(String) });
    const added = items()!.at(-1)!.id;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Add Section/ }));
    });
    expect(items()!.at(-1)).toMatchObject({ type: "section", items: [] });
    await act(async () => {
      workspace.undo();
      workspace.undo();
    });
    expect(items()?.length ?? 0).toBe(before);
    expect(items()?.some((item) => item.id === added) ?? false).toBe(false);
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
          <CatalogPropertiesPanel />
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
    await act(async () => {
      fireEvent.click(within(container).getByText("Add"));
    });
    const own = () => catalogOwnVariables(graph, id("a"));
    expect(own().map((variable) => variable.name)).toEqual(["state1"]);
    const revision = graph.revision;
    const input = container.querySelector(
      ".state-def-editor input",
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
      ".state-def-editor input",
    )[1] as HTMLInputElement;
    fireEvent.change(defaultInput, { target: { value: "hello" } });
    await act(async () => {
      fireEvent.keyDown(defaultInput, { key: "Enter" });
    });
    expect(own()).toMatchObject([{ name: "open", defaultValue: "hello" }]);
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

  it("a Button shows the Icon picker; with an icon its label is the Text child's field only", async () => {
    const { workspace } = await open();
    const button = id("button");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...node("button", "lib:definition:type-Button"),
            props: { children: { kind: "set", value: "Save" } },
          },
        ],
        rootIds: [button],
        newId: (kind) => `project:${kind}:btn1` as never,
      }),
    );
    const { container } = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogPropertiesPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const textInputs = () =>
      [...container.querySelectorAll("input")].filter(
        (input) => (input as HTMLInputElement).value === "Save",
      );
    expect(within(container).getAllByText("Icon").length).toBeGreaterThan(0);
    expect(textInputs()).toHaveLength(1);
    await act(async () => {
      workspace.execute(
        catalogButtonChildCommands.setIcon(button, "star", workspace.newId),
      );
    });
    // The Button's own label field is gone; the Text child's field shows the moved label.
    const textLegends = [...container.querySelectorAll("legend, label")].filter(
      (label) => label.textContent === "Text",
    );
    expect(textLegends).toHaveLength(1);
    expect(textInputs()).toHaveLength(1);
    expect(textInputs()[0].closest(".fieldset-row")?.textContent).toContain(
      "Text",
    );
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
    const { plan } = workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    );
    const instance = plan.selectAfter![0];
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
    expect(
      position.container.querySelectorAll(".frame-slot-fill .list-row"),
    ).toHaveLength(1);
    await act(async () => {
      fireEvent.click(
        within(position.container).getByRole("button", {
          name: "Restore template content",
        }),
      );
    });
    expect(catalogSlotPosition(graph, target)?.fillIds).toBe(undefined);
    expect(
      position.container.querySelectorAll(".frame-slot-fill .list-row"),
    ).toHaveLength(0);
  });
});
