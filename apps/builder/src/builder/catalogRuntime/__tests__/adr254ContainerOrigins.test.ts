import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogConsumerNode } from "../compositionRoot";
import {
  catalogBoundTextCommand,
  catalogTextCommand,
  catalogTextKey,
} from "../canvasText";
import { catalogSubpartOwnerType } from "../subpart";
import { catalogTextBinding } from "../textBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-254 Phase 2: the five containers' titles and descriptions are instances of the Heading ·
 * Description origins (G1), a Dialog is named by its title (G2), and a text the template binds to
 * its container's prop is written there — from the Properties panel's owner and from the Canvas's
 * inline edit (Decision 5; a field's Label, ADR-253, the same).
 */
const BODY = "project:node:home-body" as NodeId;
const CONTAINER = "project:node:container" as NodeId;
const HEADING_ORIGIN =
  "lib:definition:origin-component-heading" as LibraryDefinitionId;
const DESCRIPTION_ORIGIN =
  "lib:definition:origin-component-description" as LibraryDefinitionId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const CONTAINERS = ["dialog", "popover", "card", "inline-alert", "tooltip"];

async function place(definitionId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr254-origins" as EntryId<"project">,
        name: "ADR-254 origins",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr254-origins-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: CONTAINER,
          definitionId: definitionId as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [CONTAINER],
      newId: workspace.newId,
    }),
  );
  const records = workspace.root.domInputs;
  const root = () =>
    [...records.values()].find((record) => record.sourceId === CONTAINER)!;
  /** The container's records of `binding` (title `heading` · `description`), in tree order. */
  const parts = (binding: string) => {
    const found: CatalogConsumerNode[] = [];
    const walk = (record: CatalogConsumerNode) => {
      if (record.bindingId === binding) found.push(record);
      for (const id of record.children) walk(records.get(id)!);
    };
    walk(root());
    return found;
  };
  return { workspace, root, parts };
}
const origin = (type: string) => `lib:definition:origin-component-${type}`;
const originColor = (
  workspace: CatalogWorkspace,
  definitionId: LibraryDefinitionId,
  color: string,
) =>
  workspace.execute(
    setLibraryDefault({
      definitionId,
      scope: "visual",
      key: "color",
      write: set(color),
      newId: workspace.newId,
    }),
  );
/** The markup of the record that renders DOM for the container (a Dialog: its section). */
const markupOf = (
  workspace: CatalogWorkspace,
  root: CatalogConsumerNode,
  type: string,
) => {
  const id = type === "dialog" ? dialogOf(workspace, root) : root.id;
  return renderToStaticMarkup(renderCatalogDom(workspace.root, id));
};
/** The placed Dialog origin's Dialog — in its Modal (ADR-256 Phase 8b). */
const dialogOf = (workspace: CatalogWorkspace, root: CatalogConsumerNode) => {
  const records = workspace.root.domInputs;
  const modal = root.children.find(
    (child) => records.get(child)?.bindingId === "modal",
  )!;
  return records
    .get(modal)!
    .children.find((child) => records.get(child)?.bindingId === "dialog")!;
};

describe("ADR-254 Phase 2 — the containers' parts are origin instances", () => {
  /**
   * G1: an edit of the Heading origin reaches the four titles, of the Description origin the five
   * descriptions — on the Canvas record and, for the containers that render DOM (an open Dialog ·
   * Card · InlineAlert), inline in the DOM. A second edit as well (a value-only step). The Card's
   * description keeps its own color (the position's patch over the origin's).
   */
  for (const type of CONTAINERS)
    it(`${type} — follows the Heading · Description origins`, async () => {
      const { workspace, root, parts } = await place(origin(type));
      const titles = () => parts("heading");
      const descriptions = () => parts("description");
      expect(titles().length).toBe(type === "tooltip" ? 0 : 1);
      expect(descriptions().length).toBe(1);
      for (const record of [...titles(), ...descriptions()])
        expect(record.collapsedSourceIds).toEqual([
          record.bindingId === "heading"
            ? "lib:template:component-heading"
            : "lib:template:component-description",
        ]);
      const dom = type !== "popover" && type !== "tooltip";
      for (const color of ["#ff0000", "#0000ff"]) {
        originColor(workspace, HEADING_ORIGIN, color);
        originColor(workspace, DESCRIPTION_ORIGIN, "#00aa00");
        for (const title of titles()) {
          expect(title.visual.color).toBe(color);
          if (dom)
            expect(markupOf(workspace, root(), type)).toMatch(
              new RegExp(
                `<h[23] [^>]*color:${color}[^>]*>${title.props.children}<`,
              ),
            );
        }
        for (const description of descriptions()) {
          const expected = type === "card" ? "#49454f" : "#00aa00";
          expect(description.visual.color).toBe(expected);
          if (dom)
            expect(markupOf(workspace, root(), type)).toContain(
              `color:${expected}`,
            );
        }
      }
    });

  /** G2: RAC names the open Dialog by its title (a real mount — RAC links them in an effect). */
  it("names the Dialog by its title, and falls back without one", async () => {
    const { workspace, root } = await place(origin("dialog"));
    const dialogId = dialogOf(workspace, root());
    const host = document.createElement("div");
    document.body.append(host);
    const mount = createRoot(host);
    await act(async () =>
      mount.render(renderCatalogDom(workspace.root, dialogId)),
    );
    const dialog = host.querySelector('[role="dialog"]')!;
    const title = host.querySelector("h2.react-aria-Heading")!;
    expect(dialog.hasAttribute("aria-label")).toBe(false);
    expect(title.id).not.toBe("");
    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
    expect(title.textContent).toBe("Dialog Title");
    await act(async () => mount.unmount());

    // A Dialog without a title keeps the fallback name.
    const bare = await place("lib:definition:type-Dialog");
    const html = renderToStaticMarkup(
      renderCatalogDom(bare.workspace.root, bare.root().id),
    );
    expect(html).toMatch(/<section [^>]*aria-label="Dialog"/);
    expect(html).not.toContain("aria-labelledby");
  });
});

describe("ADR-254 Decision 5 — a bound text has one source", () => {
  /** The bound part of each case: the container, the part's binding, the container's prop. */
  const CASES = [
    { type: "card", binding: "heading", prop: "title" },
    { type: "card", binding: "description", prop: "description" },
    { type: "inline-alert", binding: "heading", prop: "title" },
    { type: "inline-alert", binding: "description", prop: "description" },
    { type: "textfield", binding: "label", prop: "label" },
  ] as const;

  for (const { type, binding, prop } of CASES)
    it(`${type} ${binding} — owned by the ${prop} prop: Properties and inline edit`, async () => {
      const { workspace, root, parts } = await place(origin(type));
      const part = () => parts(binding)[0]!;
      const graph = workspace.runtime.graph;
      const key = catalogTextKey(part())!;
      expect(key).toBe("children");
      // Found through the container's wrappers (a Card's CardHeader · CardContent).
      const found = catalogTextBinding(
        graph.library,
        workspace.root.domInputs,
        part(),
        key,
      )!;
      expect(found.source.id).toBe(root().id);
      expect(found.prop).toBe(prop);
      // The Properties panel's owner.
      expect(
        catalogSubpartOwnerType(
          graph,
          workspace.root.domInputs,
          part().id,
          "all",
        ),
      ).toBe(
        { card: "Card", "inline-alert": "InlineAlert", textfield: "TextField" }[
          type
        ],
      );
      const edit = (before: string, after: string) =>
        workspace.execute(
          catalogBoundTextCommand(
            graph,
            workspace.itemOfRecord(part().id)!,
            key,
            {
              target: workspace.itemOfRecord(found.source.id)!.target,
              prop,
            },
            before,
            after,
          )!,
        );
      const writeParent = (value: string) =>
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: CONTAINER }],
            props: { [prop]: set(value) },
          }),
        );
      // (The prop lives on the instance node — a Card's record is its `Card` root, which does not
      // take `title`.)
      const shown = () => [
        part().props.children,
        (
          graph.getEntry(CONTAINER) as {
            props: Record<string, { value?: unknown } | undefined>;
          }
        ).props[prop]?.value,
      ];
      const initial = String(part().props.children);
      // Parent prop → the part's inline edit → the parent prop again: one source throughout.
      writeParent("Parent one");
      expect(shown()).toEqual(["Parent one", "Parent one"]);
      edit("Parent one", "Child edit");
      expect(shown()).toEqual(["Child edit", "Child edit"]);
      writeParent("Parent two");
      expect(shown()).toEqual(["Parent two", "Parent two"]);
      workspace.undo();
      expect(shown()).toEqual(["Child edit", "Child edit"]);
      workspace.undo();
      expect(shown()).toEqual(["Parent one", "Parent one"]);

      // A text the position wrote itself before (the old inline edit) is removed by the next edit.
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(part().id)!.target],
          props: { [key]: set("Stale own") },
        }),
      );
      expect(part().props.children).toBe("Stale own");
      edit("Stale own", "Fresh");
      expect(shown()).toEqual(["Fresh", "Fresh"]);
      writeParent("After");
      expect(shown()).toEqual(["After", "After"]);
      expect(initial).not.toBe("");
    });

  /** A text that is not bound (a Dialog's title) stays the position's own. */
  it("leaves an unbound text to its own node", async () => {
    const { workspace, parts } = await place(origin("dialog"));
    const title = () => parts("heading")[0]!;
    const graph = workspace.runtime.graph;
    expect(
      catalogTextBinding(
        graph.library,
        workspace.root.domInputs,
        title(),
        "children",
      ),
    ).toBeUndefined();
    expect(
      catalogSubpartOwnerType(
        graph,
        workspace.root.domInputs,
        title().id,
        "all",
      ),
    ).toBeNull();
    workspace.execute(
      catalogTextCommand(
        workspace.itemOfRecord(title().id)!,
        "children",
        "Dialog Title",
        "Renamed",
      )!,
    );
    expect(title().props.children).toBe("Renamed");
  });
});
