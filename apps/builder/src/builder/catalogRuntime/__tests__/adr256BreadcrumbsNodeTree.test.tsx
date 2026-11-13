// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Breadcrumb,
  Breadcrumbs,
  Link,
} from "react-aria-components/Breadcrumbs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogTextMetrics } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5a (G2) → S2 structure (2026-11-13): a Breadcrumb is S2's `Breadcrumb` — its content
 * (a Text node) inside a RAC `Link` with the crumb's `href` while not current (then the separator
 * Icon, `showWhen` !isCurrent — composition keeps it an editable node where S2 draws its chevron),
 * and inside a `div` when current (S2 `currentStyles` — no link).
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
  // (A Text node is the crumb's content — S2's `children`.)
  for (const text of [...host.querySelectorAll("span.react-aria-Text")])
    text.replaceWith(...text.childNodes);
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

describe("Breadcrumbs is S2's — RAC Breadcrumb > Link(content) + separator · current > div(content)", () => {
  it("has S2's structure (the current crumb is no link and has no separator)", async () => {
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
          // S2 `Breadcrumb`: `isCurrent ? <div>{children}</div> : <><Link>{children}</Link><Chevron/></>`.
          createElement(Breadcrumb, {
            key: index,
            id: String(index),
            children: ({ isCurrent }: { isCurrent: boolean }) =>
              isCurrent
                ? createElement("div", null, text)
                : [
                    createElement(Link, { key: "link", href }, text),
                    createElement(chevron, { key: "icon" }),
                  ],
          }),
        ),
      ),
    );
    expect(structure(html())).toBe(structure(reference));
  });

  it("the label is a Text node, the crumb's href its RAC Link's; the Canvas separator follows the current crumb", async () => {
    const { html, records } = await open([palette()], "crumbs");
    expect(records("Link")).toEqual([]);
    const labels = records("Text");
    expect(labels.map((r) => r.props.children)).toEqual([
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

  it("a free child in a crumb is drawn in its place (an authored Link is the crumb's link — no second link); an authored separator without a condition always shows", async () => {
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
    expect(first).not.toContain("breadcrumb-link");
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
    expect(markup).toContain("breadcrumb-link");
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

  it("the current crumb's label is S2 `currentStyles` — neutral bold on the Canvas and in the DOM (after an edit too)", async () => {
    const { workspace, root, html, records } = await open([palette()], "crumbs");
    // (An edit rebuilds the records: the label is judged by id, not by the record object.)
    workspace.root.execute(
      setFields({
        targets: [
          workspace.positionOfRecord(records("Breadcrumbs")[0]!.id)!.target,
        ],
        props: { size: set("L") },
      }),
    );
    const labels = records("Text");
    expect(labels.map((r) => r.derivedProps?._isLast)).toEqual([
      false,
      false,
      true,
    ]);
    const page = labels[2]!;
    const metrics = catalogTextMetrics(page, root.canvasInputs.get(page.parentId));
    expect([metrics.fontWeight, metrics.color]).toEqual([700, "var(--fg)"]);
    expect(html()).toMatch(/color:var\(--fg\);font-weight:700[^"]*">Page</);
  });

  it("a disabled Breadcrumbs: the links' labels take S2 `disabled`, the current crumb stays neutral (no opacity)", async () => {
    const { workspace, root, html, records } = await open([palette()], "crumbs");
    workspace.root.execute(
      setFields({
        targets: [
          workspace.positionOfRecord(records("Breadcrumbs")[0]!.id)!.target,
        ],
        props: { isDisabled: set(true) },
      }),
    );
    const colors = records("Text").map(
      (label) =>
        catalogTextMetrics(label, root.canvasInputs.get(label.parentId)).color,
    );
    expect(colors).toEqual([
      "var(--fg-disabled)",
      "var(--fg-disabled)",
      "var(--fg)",
    ]);
    expect(html()).toMatch(/color:var\(--fg-disabled\)[^"]*">Home</);
    expect(html()).not.toContain("opacity");
  });

  it("S2 wrapper `marginStart` (M 6 · L 9): the Canvas root's start margin, the DOM's device length", async () => {
    const { workspace, html, records } = await open([palette()], "crumbs");
    expect(records("Breadcrumbs")[0]!.layout.marginLeft).toBe("6px");
    workspace.root.execute(
      setFields({
        targets: [
          workspace.positionOfRecord(records("Breadcrumbs")[0]!.id)!.target,
        ],
        props: { size: set("L") },
      }),
    );
    expect(records("Breadcrumbs")[0]!.layout.marginLeft).toBe("9px");
    expect(html()).toMatch(/<ol[^>]*margin-left:calc\(var\(--catalog-token-size-unit/);
  });

  it("the separator chevron is S2 Chevron M — 10 on the Canvas, `10 × --s2-scale` in the DOM", async () => {
    const { html, records } = await open([palette()], "crumbs");
    const separator = records("Icon").find((r) => r.props.slot === "separator")!;
    expect([separator.visual.iconSize, separator.visual.width]).toEqual([10, 10]);
    const icon = html().match(/<div style="([^"]*)" class="react-aria-Icon"/)![1]!;
    expect(icon).toContain("--catalog-token-size-unit");
    expect(icon).not.toMatch(/width:10px/);
  });
});

/**
 * S2 `CollapsingCollection` (`breadcrumbsCollapse.ts`): crumbs past four, or that do not fit, go to a
 * folder menu after the first crumb — the Canvas (`settleBreadcrumbs`) and the DOM (`BreadcrumbsRun`)
 * judge the same boxes the same way.
 */
describe("Breadcrumbs collapse (S2 folder menu)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });
  const withCrumbs = async (labels: string[]) => {
    const opened = await open([palette()], "crumbs");
    opened.workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: id("crumbs") },
        entries: labels.map((label) =>
          node(
            `extra-${label}`,
            "lib:definition:origin-component-breadcrumb-item-default",
            [],
            { href: `/${label}` },
          ),
        ),
        rootIds: labels.map((label) => id(`extra-${label}`)),
        newId: opened.workspace.newId,
      }),
    );
    return opened;
  };
  const crumbsOf = (opened: Awaited<ReturnType<typeof open>>) =>
    opened.records("Breadcrumb");

  it("three crumbs that fit: no folder", async () => {
    const opened = await open([palette()], "crumbs");
    expect([...opened.root.breadcrumbMenuInputs.keys()]).toEqual([]);
  });

  it("five crumbs (past S2's four): the first, the folder, the last two — on the Canvas", async () => {
    const opened = await withCrumbs(["d", "e"]);
    const crumbs = crumbsOf(opened);
    const list = opened.records("Breadcrumbs")[0]!;
    const menu = opened.root.breadcrumbMenuInputs.get(list.id)!;
    expect(menu).toBeDefined();
    expect(crumbs.map((crumb) => opened.root.breadcrumbCollapsed(crumb.id))).toEqual(
      [false, true, true, false, false],
    );
    const rects = opened.root.getGeometry([crumbs[0]!.id, menu.id, crumbs[3]!.id]);
    const first = rects.get(crumbs[0]!.id)!;
    const box = rects.get(menu.id)!;
    // (S2: the list gap 6, the menu crumb's start margin −6 — the button follows the first crumb.)
    expect(box.x).toBeCloseTo(first.x + first.width, 3);
    expect([box.width, box.height]).toEqual([42, 32]);
    expect(rects.get(crumbs[3]!.id)!.x).toBeCloseTo(box.x + box.width + 6, 3);
    expect(menu.separator.iconName).toBe("s2-chevron");
  });

  it("the folder box stays drawn when an edit elsewhere restructures its region (user report 2026-11-13)", async () => {
    const opened = await withCrumbs(["d", "e"]);
    const list = opened.records("Breadcrumbs")[0]!;
    const menu = opened.root.breadcrumbMenuInputs.get(list.id)!;
    const canvas = bindCatalogCanvas(
      opened.root,
      opened.root.pageRootRecords(),
    );
    expect(getSkiaNode(menu.id)).toBeDefined();
    // (A node added beside the Breadcrumbs: the body's children change — a structural region.)
    opened.workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("other", "lib:definition:type-frame", []),
        ],
        rootIds: [id("other")],
        newId: opened.workspace.newId,
      }),
    );
    expect(canvas.update().status).not.toBe("rebind-required");
    expect(getSkiaNode(menu.id)).toBeDefined();
    canvas.dispose();
  });

  it("a deleted Breadcrumbs leaves no folder box behind", async () => {
    const opened = await withCrumbs(["d", "e"]);
    const list = opened.records("Breadcrumbs")[0]!;
    expect(opened.root.breadcrumbMenuInputs.has(list.id)).toBe(true);
    opened.workspace.root.execute(
      removeTargets({
        targets: [opened.workspace.positionOfRecord(list.id)!.target],
      }),
    );
    expect([...opened.root.breadcrumbMenuInputs.keys()]).toEqual([]);
  });

  it("the Breadcrumbs' menuIcon is the folder button's glyph (Canvas)", async () => {
    const opened = await withCrumbs(["d", "e"]);
    const list = opened.records("Breadcrumbs")[0]!;
    expect(opened.root.breadcrumbMenuInputs.get(list.id)!.icon).toBe(
      "s2-folder-breadcrumb",
    );
    opened.workspace.root.execute(
      setFields({
        targets: [opened.workspace.positionOfRecord(list.id)!.target],
        props: { menuIcon: set("minus") },
      }),
    );
    expect(opened.root.breadcrumbMenuInputs.get(list.id)!.icon).toBe("minus");
  });

  it("a narrow list: only the first and the last crumb stay, and the folder opens it again when it widens", async () => {
    const opened = await open([palette()], "crumbs");
    const list = opened.records("Breadcrumbs")[0]!;
    const width = (value: number) =>
      opened.workspace.root.execute(
        setFields({
          targets: [opened.workspace.positionOfRecord(list.id)!.target],
          sizing: { width: set(value) },
        }),
      );
    width(40);
    const crumbs = crumbsOf(opened);
    expect(crumbs.map((crumb) => opened.root.breadcrumbCollapsed(crumb.id))).toEqual(
      [false, true, false],
    );
    width(800);
    expect([...opened.root.breadcrumbMenuInputs.keys()]).toEqual([]);
  });

  it("the DOM renders the same collapse: the folder menu crumb (RAC Breadcrumb) between the first and the last two", async () => {
    const opened = await withCrumbs(["d", "e"]);
    // (jsdom has no layout: the crumbs 60 wide in a 1200 list, as on the Canvas they fit.)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const width = this.tagName === "OL" ? 1200 : 60;
        return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: 32, width, height: 32, toJSON: () => ({}) } as DOMRect;
      },
    );
    const host = document.createElement("div");
    document.body.append(host);
    const reactRoot = createRoot(host);
    const list = opened.records("Breadcrumbs")[0]!;
    await act(async () =>
      reactRoot.render(renderCatalogDom(opened.root, list.id)),
    );
    const items = [...host.querySelectorAll("ol > li")];
    expect(items).toHaveLength(4);
    const menu = items[1]!;
    expect(menu.classList.contains("breadcrumb-menu")).toBe(true);
    expect(menu.querySelector("button")!.getAttribute("aria-label")).toBe(
      "More items",
    );
    // (S2 `S2_Icon_FolderBreadcrumb_20_N`, then the first crumb's separator — S2's Chevron.)
    expect(menu.querySelector("button svg")?.getAttribute("viewBox")).toBe(
      "0 0 20 20",
    );
    expect(menu.querySelector(":scope > .react-aria-Icon svg")?.getAttribute("viewBox")).toBe(
      "0 0 10 10",
    );
    const crumbs = crumbsOf(opened);
    const shown = items.map((item) => item.getAttribute("data-catalog-id"));
    expect(shown).toEqual([crumbs[0]!.id, null, crumbs[3]!.id, crumbs[4]!.id]);
    expect(items[3]!.getAttribute("data-current")).toBe("true");
    await act(async () => reactRoot.unmount());
  });
});

/**
 * The separator at the Breadcrumbs (user decision 2026-11-13): its `separatorIcon` is every crumb's
 * separator glyph — a crumb whose separator Icon the author changed keeps its own.
 */
describe("Breadcrumbs separatorIcon — the list's separator, a crumb's own change wins", () => {
  const separators = (opened: Awaited<ReturnType<typeof open>>) =>
    opened.records("Icon").filter((r) => r.props.slot === "separator");
  const drawn = (opened: Awaited<ReturnType<typeof open>>) =>
    separators(opened).map(
      (r) => r.derivedProps?._ownerIconName ?? r.props.iconName,
    );
  const domIcons = (opened: Awaited<ReturnType<typeof open>>) =>
    [...opened.html().matchAll(/data-icon="([^"]*)" slot="separator"/g)].map(
      (m) => m[1],
    );
  const setOn = (
    opened: Awaited<ReturnType<typeof open>>,
    recordId: string,
    props: Record<string, string>,
  ) =>
    opened.workspace.root.execute(
      setFields({
        targets: [opened.workspace.positionOfRecord(recordId)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );

  it("a Breadcrumbs separatorIcon reaches every crumb's separator (Canvas and DOM)", async () => {
    const opened = await open([palette()], "crumbs");
    setOn(opened, opened.records("Breadcrumbs")[0]!.id, { separatorIcon: "slash" });
    expect(drawn(opened)).toEqual(["slash", "slash", "slash"]);
    expect(domIcons(opened)).toEqual(["slash", "slash"]);
  });

  it("a crumb whose separator the author changed keeps its own", async () => {
    const opened = await open([palette()], "crumbs");
    setOn(opened, separators(opened)[1]!.id, { iconName: "minus" });
    setOn(opened, opened.records("Breadcrumbs")[0]!.id, { separatorIcon: "slash" });
    expect(drawn(opened)).toEqual(["slash", "minus", "slash"]);
    expect(domIcons(opened)).toEqual(["slash", "minus"]);
  });
});
