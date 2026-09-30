import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setHtmlId,
  setNodeAttribute,
} from "../../../../../../packages/shared/src/catalog/commands";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-6 the author's DOM attributes: class names and accessible name live in the node's
 * `metadata` beside its DOM id (every element — no definition accepts them as props), and the DOM
 * binding puts all three on the element, after its own classes (a RAC component keeps its
 * `react-aria-*` class). A composite instance's attributes are the instance node's.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:attrs" as EntryId<"project">,
        name: "Attrs",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e6-attrs-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
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
  const entries = [
    node("box", "lib:definition:type-frame"),
    node("title", catalogPaletteDefinitionId(library, "Heading")),
    node("go", catalogPaletteDefinitionId(library, "Button")),
  ];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: entries.map((entry) => entry.id),
      newId: workspace.newId,
    }),
  );
  return { workspace };
}

describe("ADR-248 4e-6 author DOM attributes", () => {
  it("class and accessible name are node metadata; empty clears; blank values are refused", async () => {
    const { workspace } = await open();
    workspace.execute(
      setNodeAttribute({
        id: id("box"),
        field: "className",
        value: " hero wide ",
      }),
    );
    workspace.execute(
      setNodeAttribute({ id: id("box"), field: "ariaLabel", value: "Banner" }),
    );
    const metadata = () => {
      const entry = workspace.runtime.graph.getEntry(id("box"));
      return entry?.kind === "node" ? entry.metadata : undefined;
    };
    expect(metadata()).toEqual({ className: "hero wide", ariaLabel: "Banner" });
    workspace.execute(
      setNodeAttribute({ id: id("box"), field: "ariaLabel", value: "  " }),
    );
    expect(metadata()).toEqual({ className: "hero wide" });
    const document = workspace.runtime.graph.exportDocument();
    const code = (value: unknown) => {
      try {
        new CatalogGraph(
          {
            ...document,
            entries: {
              ...document.entries,
              [id("box")]: {
                ...(document.entries[id("box")] as NodeEntry),
                metadata: value,
              },
            },
          } as never,
          workspace.runtime.graph.library,
        );
        return "ok";
      } catch (error) {
        return (error as { code?: string }).code;
      }
    };
    expect(code({ className: " " })).toBe("INVALID_METADATA");
    expect(code({ title: "x" })).not.toBe("ok");
    expect(code({ className: "a", ariaLabel: "b", htmlId: "c" })).toBe("ok");
  });

  it("the DOM carries id, aria-label and classes after the element's own; an instance's are its own; undo removes them", async () => {
    const { workspace } = await open();
    for (const [name, className] of [
      ["box", "hero"],
      ["title", "headline"],
      ["go", "cta"],
    ] as const)
      workspace.execute(
        setNodeAttribute({
          id: id(name),
          field: "className",
          value: className,
        }),
      );
    workspace.execute(setHtmlId({ id: id("go"), htmlId: "buy" }));
    workspace.execute(
      setNodeAttribute({ id: id("go"), field: "ariaLabel", value: "Buy now" }),
    );
    // A new root (a breakpoint switch) assembles the instance's record from scratch.
    workspace.setBreakpoint("tablet");
    workspace.setBreakpoint("desktop");
    expect(
      workspace.root.domInputs.get(
        workspace.root.recordsOfSource(id("go"))[0]!,
      ),
    ).toMatchObject({ htmlId: "buy", className: "cta", ariaLabel: "Buy now" });
    const body = workspace.root.recordsOfSource(BODY)[0]!;
    const view = render(
      renderCatalogDom(workspace.root, body, { slotMode: "page" }),
    );
    expect(view.container.querySelector(".hero")?.tagName).toBe("DIV");
    expect(
      view.container
        .querySelector(".headline")
        ?.classList.contains("react-aria-Heading"),
    ).toBe(true);
    const button = view.container.querySelector("#buy")!;
    expect(button.tagName).toBe("BUTTON");
    expect(button.classList.contains("cta")).toBe(true);
    expect(button.classList.contains("react-aria-Button")).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Buy now");
    act(() => {
      workspace.undo();
      workspace.undo();
    });
    // (RAC keeps the first DOM id it was given — `useId` — so the id check is on the record.)
    const record = workspace.root.domInputs.get(
      workspace.root.recordsOfSource(id("go"))[0]!,
    );
    expect(record?.htmlId).toBeUndefined();
    expect(view.container.querySelector('[aria-label="Buy now"]')).toBeNull();
    expect(view.container.querySelector(".cta")).not.toBeNull();
    act(() => workspace.undo());
    expect(view.container.querySelector(".cta")).toBeNull();
    expect(
      view.container
        .querySelector("button")
        ?.classList.contains("react-aria-Button"),
    ).toBe(true);
    view.unmount();
  });
});
