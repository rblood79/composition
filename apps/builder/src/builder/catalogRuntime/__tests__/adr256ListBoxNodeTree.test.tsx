// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListBox, ListBoxItem, Text } from "react-aria-components/ListBox";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5c (G2) — a ListBox is the reference's (example 1): `ListBox > ListBoxItem >
 * (icon + Text[label] + Text[description])` and `ListBoxSection > Header + items`. An item's empty
 * description is not there (Decision 7 `presentWhen`).
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(definitionId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-listbox" as EntryId<"project">,
        name: "ListBox",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-listbox-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: LIST,
          definitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === LIST)!.id,
      ),
    );
  return { workspace, root, html };
}

/** Decision 11 structure: tag · role · slot · aria links as positions · text; a glyph is one svg. */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  for (const icon of [...host.querySelectorAll("div.react-aria-Icon")])
    icon.replaceWith(...icon.childNodes);
  for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
  const all = [...host.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "missing" : `#${index}`;
  };
  const LINKS = new Set(["aria-labelledby", "aria-describedby"]);
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          /^(role|slot|aria-selected)$/.test(attribute.name) ||
          LINKS.has(attribute.name),
      )
      .filter(
        (attribute) => attribute.name !== "slot" || attribute.value !== "icon",
      )
      .map((attribute) =>
        LINKS.has(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...host.children]
    .filter((element) => !["TEMPLATE", "SPAN"].includes(element.tagName))
    .map(walk)
    .join("\n");
}

const icon = () => createElement("svg", { "aria-hidden": "true" });

describe("ADR-256 Phase 5c — ListBox items are the reference's (example 1)", () => {
  it("items: icon + Text[label] + Text[description], labelled and described by them", async () => {
    const { html } = await open("lib:definition:origin-component-listbox");
    const rows = [
      ["inbox", "Inbox", "Unread messages"],
      ["starred", "Starred", "Marked as important"],
      ["archive", "Archive", "Stored for later"],
    ];
    const reference = renderToStaticMarkup(
      createElement(
        ListBox,
        { "aria-label": "List", selectionMode: "single" },
        ...rows.map(([id, label, description]) =>
          createElement(
            ListBoxItem,
            { key: id, id, textValue: label },
            createElement(icon),
            createElement(Text, { slot: "label" }, label),
            createElement(Text, { slot: "description" }, description),
          ),
        ),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("a section: Header + items (reference ListBoxSection)", async () => {
    const { workspace, html } = await open("lib:definition:type-ListBox");
    const section = workspace.newId("node");
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: LIST },
        entries: [
          {
            kind: "node",
            id: section,
            definitionId: "lib:definition:origin-component-listbox-section",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [section],
        newId: workspace.newId,
      }),
    );
    const markup = html();
    expect(markup).toContain('class="react-aria-ListBoxSection"');
    expect(markup).toMatch(
      /<header[^>]*class="react-aria-Header"[^>]*>Section<\/header>/,
    );
    expect(markup.match(/role="option"/g)?.length).toBe(2);
  });

  it("an item's empty description is not there (Canvas and DOM); text fills it again", async () => {
    const { workspace, root, html } = await open(
      "lib:definition:origin-component-listbox",
    );
    const description = () =>
      [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "Text" && r.props.slot === "description",
      )!;
    const target = workspace.positionOfRecord(description().id)!.target;
    workspace.root.execute(
      setFields({ targets: [target], props: { children: set("") } }),
    );
    expect(description().hidden).toBe(true);
    expect(html().match(/slot="description"/g)?.length).toBe(2);
    workspace.root.execute(
      setFields({ targets: [target], props: { children: set("Back") } }),
    );
    expect(description().hidden).not.toBe(true);
    expect(html().match(/slot="description"/g)?.length).toBe(3);
  });
});
