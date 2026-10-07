// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Breadcrumb,
  Breadcrumbs,
  Link,
} from "react-aria-components/Breadcrumbs";
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
 * ADR-256 Phase 5a (G2) — a Breadcrumb is the reference's `RACBreadcrumb > (Link + {!isCurrent ⇒
 * ChevronRight})`: the label is a RAC `Link` node and the separator Icon is there while the crumb is
 * not current (`showWhen`), drawn as its node tree.
 */
const BODY = "project:node:home-body" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: string[],
  props: Record<string, unknown> = {},
  extra: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id: id(name),
    definitionId,
    children: children.map(id),
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as unknown as NodeEntry;

async function open(entries: NodeEntry[], rootId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-crumbs" as EntryId<"project">,
        name: "Crumbs",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-crumbs-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  // (`root.execute`: no automatic HTML ids.)
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [id(rootId)],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === id(rootId))!.id,
      ),
    );
  const records = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  return { workspace, root, html, records };
}

/** Decision 11 structure (tag · structural attributes · text); an Icon's `div > svg` is the glyph. */
function structure(html: string): string {
  const host = document.createElement("div");
  host.innerHTML = html;
  for (const icon of [...host.querySelectorAll("div.react-aria-Icon")])
    icon.replaceWith(...icon.childNodes);
  for (const svg of [...host.querySelectorAll("svg")]) svg.innerHTML = "";
  const KEEP = /^(role|aria-current|aria-disabled|aria-hidden)$/;
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter((attribute) => KEEP.test(attribute.name))
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...host.children]
    .filter((element) => element.tagName !== "TEMPLATE")
    .map(walk)
    .join("\n");
}

const palette = () =>
  node("crumbs", "lib:definition:origin-component-breadcrumbs", []);

describe("ADR-256 Phase 5a — Breadcrumbs is RAC Breadcrumb > Link + separator", () => {
  it("has the reference example's structure (the current crumb has no separator)", async () => {
    const { html } = await open([palette()], "crumbs");
    const chevron = () => createElement("svg", { "aria-hidden": "true" });
    const crumb = (text: string, href?: string) => ({ text, href });
    const reference = renderToStaticMarkup(
      createElement(
        Breadcrumbs,
        null,
        ...[
          crumb("Home", "/"),
          crumb("Category", "/category"),
          crumb("Page", "#"),
        ].map(({ text, href }, index) =>
          createElement(Breadcrumb, {
            key: index,
            id: String(index),
            children: ({ isCurrent }: { isCurrent: boolean }) => [
              createElement(Link, { key: "link", href }, text),
              isCurrent ? null : createElement(chevron, { key: "icon" }),
            ],
          }),
        ),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("the label is a Link node with the crumb's href; the Canvas separator follows the current crumb", async () => {
    const { html, records } = await open([palette()], "crumbs");
    const links = records("Link");
    expect(links.map((r) => r.props.children)).toEqual([
      "Home",
      "Category",
      "Page",
    ]);
    expect(
      html()
        .match(/href="[^"]*"/g)
        ?.slice(0, 2),
    ).toEqual(['href="/"', 'href="/category"']);
    const separators = records("Icon").filter(
      (r) => r.props.slot === "separator",
    );
    expect(separators.map((r) => r.hidden === true)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("a crumb added after the last: the former last shows its separator (Canvas and DOM)", async () => {
    const { workspace, html, records } = await open([palette()], "crumbs");
    const crumbsSource = id("crumbs");
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: crumbsSource },
        entries: [
          node(
            "added",
            "lib:definition:origin-component-breadcrumb-item-default",
            [],
            { href: "/more" },
          ),
        ],
        rootIds: [id("added")],
        newId: workspace.newId,
      }),
    );
    const separators = records("Icon").filter(
      (r) => r.props.slot === "separator",
    );
    expect(separators.map((r) => r.hidden === true)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(html().match(/react-aria-Icon/g)).toHaveLength(3);
  });

  it("a free child in a crumb is drawn in its place; an authored separator without a condition always shows", async () => {
    const { html, records } = await open(
      [
        node("crumbs", "lib:definition:type-Breadcrumbs", ["a", "b"]),
        node("a", "lib:definition:type-Breadcrumb", [
          "a-icon",
          "a-link",
          "a-sep",
        ]),
        node("a-icon", "lib:definition:type-Icon", [], { iconName: "home" }),
        node("a-link", "lib:definition:type-Link", [], {
          children: "Home",
          href: "/",
        }),
        node("a-sep", "lib:definition:type-Icon", [], {
          iconName: "chevron-right",
          slot: "separator",
        }),
        node("b", "lib:definition:type-Breadcrumb", ["b-link", "b-sep"]),
        node("b-link", "lib:definition:type-Link", [], { children: "Here" }),
        node("b-sep", "lib:definition:type-Icon", [], {
          iconName: "chevron-right",
          slot: "separator",
        }),
      ],
      "crumbs",
    );
    const markup = html();
    const first = markup.slice(0, markup.indexOf("</li>"));
    expect(first.indexOf(id("a-icon"))).toBeLessThan(
      first.indexOf(id("a-link")),
    );
    // No condition: the current crumb's authored separator shows (the author decides — showWhen).
    expect(markup).toContain(`::${id("b-sep")}"`);
    expect(
      records("Icon").find((r) => r.sourceId === id("b-sep"))!.hidden,
    ).not.toBe(true);
  });

  it("a crumb on its own (the Components page sample) renders in a RAC host and shows its separator", async () => {
    const { workspace } = await open([palette()], "crumbs");
    workspace.showDefinition(
      "lib:definition:origin-component-breadcrumb-item-default" as never,
    );
    // (The Components page is the workspace's view root now.)
    const root = workspace.root;
    const sample = [...root.domInputs.values()].find(
      (r) =>
        root.typeOf(r) === "Breadcrumb" &&
        root.domInputs.get(r.parentId) &&
        root.typeOf(root.domInputs.get(r.parentId)!) !== "Breadcrumbs",
    )!;
    const markup = renderToStaticMarkup(renderCatalogDom(root, sample.id));
    expect(markup).toContain('class="react-aria-Breadcrumbs"');
    expect(markup).toContain("react-aria-Link");
    expect(markup.match(/react-aria-Icon/g)).toHaveLength(1);
  });


  it("an edit of a crumb's href reaches its Link", async () => {
    const { workspace, html } = await open([palette()], "crumbs");
    const firstCrumb = (
      workspace.runtime.graph.getEntry(id("crumbs")) as NodeEntry
    ).definitionId;
    expect(firstCrumb).toBeTruthy();
    const target = [...workspace.root.canvasInputs.values()].find(
      (r) => workspace.root.typeOf(r) === "Breadcrumb",
    )!;
    workspace.root.execute(
      setFields({
        targets: [workspace.positionOfRecord(target.id)!.target],
        props: { href: set("/home") },
      }),
    );
    expect(html()).toContain('href="/home"');
  });
});
