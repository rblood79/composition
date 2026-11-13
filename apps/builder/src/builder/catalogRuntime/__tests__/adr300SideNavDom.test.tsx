// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { cloneElement, createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "react-aria-components/Button";
import { Link } from "react-aria-components/Link";
import {
  NavigationTree,
  NavigationTreeItem,
  NavigationTreeItemContent,
} from "react-aria-components/NavigationTree";
import {
  catalogSideNavLazy,
  loadCatalogSideNav,
} from "../../../../../../packages/shared/src/catalog/runtime/sideNav.lazy";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { CatalogCurrentRouteContext } from "../../../../../../packages/shared/src/catalog/runtime/sideNavRoute";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:panel" as NodeId;
const cleanups: Array<() => void> = [];
// (The SideNav DOM is a lazy chunk — Decision 7; the static markup needs it loaded.)
beforeAll(() => loadCatalogSideNav());
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const set = <T,>(value: T) => ({ kind: "set" as const, value });

/** The SideNavPanel origin (`component-sidenavpanel`): Home · Guides > Getting started · Settings. */
async function open(props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr300" as EntryId<"project">,
        name: "SideNav",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr300-${Math.random()}`),
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
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, "SideNavPanel"),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as unknown as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const panel = [...root.canvasInputs.values()].find(
    (record) => record.bindingId === "sidenavpanel",
  )!;
  const element = (route?: string) =>
    createElement(
      CatalogCurrentRouteContext.Provider,
      { value: route },
      renderCatalogDom(root, panel.id),
    );
  const html = (route?: string) => renderToStaticMarkup(element(route));
  return { root, panel, element, html };
}

/** The rendered markup's host (SSR also writes RAC's collection template). */
function host(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  for (const template of [...element.querySelectorAll("template")])
    template.remove();
  return element;
}

/**
 * The RAC tree with our known differences collapsed: our Icon is `div.react-aria-Icon > svg` (the
 * reference's glyph is the svg), our label a Text node (a span around the reference's text).
 */
function treeOf(html: string): Element {
  const root = host(html);
  for (const icon of [...root.querySelectorAll("div.react-aria-Icon")])
    icon.replaceWith(...icon.childNodes);
  for (const svg of [...root.querySelectorAll("svg")]) svg.innerHTML = "";
  for (const span of [...root.querySelectorAll("span.react-aria-Text")])
    span.replaceWith(...span.childNodes);
  return root.querySelector("[role=treegrid]")!;
}

/** G2 structure: tag · role · slot · aria (links as positions) · href · text. */
function structure(tree: Element): string {
  const all = [...tree.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "outside" : `#${index}`;
  };
  const LINKS = new Set(["aria-labelledby", "aria-describedby"]);
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          /^(role|slot|href|aria-(?!labelledby|describedby).*)$/.test(
            attribute.name,
          ) || LINKS.has(attribute.name),
      )
      .map((attribute) =>
        LINKS.has(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = (
      element.tagName.toLowerCase() === "svg" ? [] : [...element.childNodes]
    ).map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...tree.children].map(walk).join("");
}

/** The reference's row (RAC `NavigationTreeItem > NavigationTreeItemContent`, S2's parts). */
const item = (
  id: string,
  text: string,
  href: string,
  ...children: ReactElement[]
): ReactElement => row(id, text, href, true, ...children);
const row = (
  id: string,
  text: string,
  href: string,
  icon: boolean,
  ...children: ReactElement[]
): ReactElement =>
  createElement(
    NavigationTreeItem,
    { key: id, id, textValue: text, href } as never,
    createElement(
      NavigationTreeItemContent,
      null,
      ...(icon ? [createElement("svg", { key: "icon", "aria-hidden": "true" })] : []),
      createElement(Link, { key: "link" }, text),
      createElement(
        Button,
        { key: "chevron", slot: "chevron" },
        createElement("svg", { "aria-hidden": "true" }),
      ),
    ),
    ...children,
  );

/** The installed RAC's tree for the origin's items (the G2 oracle — not composition's output). */
const reference = (expandedKeys: string[], selectedRoute?: string) =>
  renderToStaticMarkup(
    createElement(
      NavigationTree,
      { "aria-label": "Navigation", expandedKeys, selectedRoute } as never,
      item("item-1", "Home", "/"),
      item(
        "item-2",
        "Guides",
        "/guides",
        // (The origin's nested row has no icon — its `{icon}` is unfilled.)
        row("item-2-1", "Getting started", "/guides/getting-started", false),
      ),
      item("item-3", "Settings", "/settings"),
    ),
  );

describe("ADR-300 G2 — the SideNav DOM is the installed RAC's", () => {
  it.each([
    ["the stored keys, no route", {}, undefined, ["item-2"], undefined],
    [
      "the shown route marks the current row (user decision 1)",
      {},
      "/guides/getting-started",
      ["item-2"],
      "/guides/getting-started",
    ],
    [
      "a collapsed panel gives RAC no expanded keys (Decision 4)",
      { isCollapsed: true },
      "/guides/getting-started",
      [],
      "/guides/getting-started",
    ],
  ])("%s", async (_name, props, route, keys, selectedRoute) => {
    const { html } = await open(props);
    expect(structure(treeOf(html(route)))).toBe(
      structure(treeOf(reference(keys, selectedRoute))),
    );
  });

  it("the current row is RAC's (`aria-current` on its link, `data-current` on the row)", async () => {
    const { html } = await open();
    const tree = treeOf(html("/settings"));
    const current = [...tree.querySelectorAll("[aria-current=page]")];
    expect(current.map((link) => link.textContent)).toEqual(["Settings"]);
    expect(tree.querySelector("[data-current]")?.getAttribute("data-key")).toBe(
      "item-3",
    );
  });

  it("the panel is S2's: a labelled region, collapsed by its attribute, the author's width off", async () => {
    const open_ = await open();
    const panel = host(open_.html()).firstElementChild as HTMLElement;
    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.hasAttribute("data-side-panel-collapsed")).toBe(false);
    expect(panel.style.width).toBe("240px");
    const shut = await open({ isCollapsed: true });
    const rail = host(shut.html()).firstElementChild as HTMLElement;
    expect(rail.getAttribute("data-side-panel-collapsed")).toBe("true");
    // (The rule's collapsed width — the class sheet — takes over: S2's inline override.)
    expect(rail.style.width).toBe("");
    // The collapse button is the author's Button, named by the panel (S2 `sidepanel.expand`).
    expect(
      rail.querySelector('button[slot="collapse"]')?.getAttribute("aria-label"),
    ).toBe("Expand side panel");
  });

  it("a row's text and icon take the row's type and color; the chevron is the row's sheet box", async () => {
    const { html } = await open();
    const root = host(html());
    const text = root.querySelector<HTMLElement>(
      ".react-aria-SideNavItem .react-aria-Text",
    )!;
    expect(text.style.color).toBe("");
    expect(text.style.fontSize).toBe("");
    expect(text.style.fontWeight).toBe("");
    // (A collapsed panel's `display: none` — an inline display would beat it.)
    expect(text.style.display).toBe("");
    const icon = root.querySelector<HTMLElement>(
      ".react-aria-SideNavItem [role=gridcell] > .react-aria-Icon",
    )!;
    expect(icon.style.color).toBe("inherit");
    const chevron = root.querySelector<HTMLElement>(
      '.react-aria-SideNavItem button[slot="chevron"]',
    )!;
    expect(chevron.className).toBe("react-aria-Button");
    expect(chevron.getAttribute("style") ?? "").not.toMatch(/padding|border-radius/);
    // (Its glyph is S2's `currentColor` — the row's through the button; the Icon sheet's own `--fg`
    //  would win over an inherited color, so the glyph inherits inline — Phase 3 G3.)
    expect(
      chevron.querySelector<HTMLElement>(".react-aria-Icon")!.style.color,
    ).toBe("inherit");
  });

  it("the collapse button collapses and expands the panel (the content after the width)", async () => {
    const { element } = await open();
    const view = render(element());
    const panel = view.container.firstElementChild as HTMLElement;
    const button = panel.querySelector<HTMLElement>('button[slot="collapse"]')!;
    expect(button.getAttribute("aria-label")).toBe("Collapse side panel");
    fireEvent.click(button);
    // Collapsing hides the content in the same render (S2).
    expect(panel.getAttribute("data-side-panel-collapsed")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Expand side panel");
    // (Its parent row is closed while collapsed — Decision 4.)
    expect(
      panel.querySelector('[data-key="item-2"]')?.getAttribute("aria-expanded"),
    ).toBe("false");
    fireEvent.click(button);
    // Expanding brings the content back after the width transition (S2 200 ms + 50).
    expect(panel.getAttribute("data-side-panel-collapsed")).toBe("true");
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(panel.hasAttribute("data-side-panel-collapsed")).toBe(false);
    // (The stored keys come back.)
    expect(
      panel.querySelector('[data-key="item-2"]')?.getAttribute("aria-expanded"),
    ).toBe("true");
  });
});

describe("ADR-300 Decision 7 — the SideNav DOM is a lazy chunk", () => {
  it("the components module is not imported by the initial DOM modules (only its loader)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dir = resolve(
      __dirname,
      "../../../../../../packages/shared/src/catalog/runtime",
    );
    for (const file of [
      "delegatedDom.runtime.ts",
      "domBinding.runtime.ts",
      "domView.components.tsx",
    ]) {
      const source = readFileSync(resolve(dir, file), "utf8");
      // (A type import is erased; a value import would put RAC NavigationTree in the initial chunk.)
      expect(
        source.match(/^import (?!type)[^;]*from "\.\/sideNav\.components";/m),
      ).toBeNull();
    }
  });
});

describe("ADR-300 Phase 2 판독 수리", () => {
  it("the header's S2 `marginBottom: 8` is the Canvas's too (the generated CSS writes it — header → first row 8 + 6)", async () => {
    // (2026-11-13: the generated CSS used to drop the rule's margin and the size block's `padding: 0`
    //  overrode its start padding; the Canvas rule box read neither margin.)
    const library = await buildCodeCatalogLibrary();
    const header = [...library.definitions.values()].find(
      (definition) => definition.id === "lib:definition:type-SideNavHeader",
    )!;
    expect(header.layout).toMatchObject({ marginBottom: "8px" });
  });

  it("RAC's flat rows: the Canvas column gap stays off in the DOM (SideNav · Section · Item)", () => {
    // (RAC draws every row as a sibling and the gridcell as `display: contents` — the column gap the
    //  Canvas's nested items take would add 6px between a row's icon · label · chevron.)
    for (const type of ["SideNav", "SideNavSection", "SideNavItem"]) {
      const rule = COMPONENT_RULES_TABLE[type]!;
      const composition = rule.structure?.composition as {
        rootSelectors?: Record<string, { styles?: Record<string, string> }>;
      };
      expect([type, composition.rootSelectors?.["&"]?.styles?.gap]).toEqual([
        type,
        "0",
      ]);
    }
  });

  it("the lazy boundary passes what the DOM pass puts on it (state styles · rule handlers) to the panel", async () => {
    const onCollapsedChange = vi.fn();
    const boundary = catalogSideNavLazy(
      "panel",
      createElement("div"),
      ({ CatalogSideNavPanel }) =>
        createElement(
          CatalogSideNavPanel,
          {
            attributes: { "data-catalog-id": "panel" },
            style: { width: 240 },
            label: "Side",
            isCollapsed: false,
          },
          createElement(Button, { key: "b", slot: "collapse" }, "x"),
        ),
    );
    // (`withCatalogStateStyles` · `withRuntime` clone the binding's element.)
    const decorated = cloneElement(boundary, {
      "data-catalog-hovered": "background-color",
      style: { "--catalog-hovered-background-color": "red" },
      onCollapsedChange,
    } as never);
    const view = render(decorated);
    const panel = view.container.querySelector<HTMLElement>(
      "[data-catalog-id=panel]",
    )!;
    expect(panel.getAttribute("data-catalog-hovered")).toBe("background-color");
    expect(panel.style.getPropertyValue("--catalog-hovered-background-color")).toBe(
      "red",
    );
    expect(panel.style.width).toBe("240px");
    fireEvent.click(panel.querySelector('button[slot="collapse"]')!);
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });
});
