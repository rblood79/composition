// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
import { CARD_PROPS_SCHEMA } from "../../components/reusablePropsSchemas";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「Card href 진행해」): an S2 standalone Card with an `href` is a RAC `Link`
 * (`@react-spectrum/s2/src/Card.tsx` — "Standalone Card that has an href should be rendered as a
 * Link"), the rest a `div`. The placed Card (the `component-card` origin) edits `href` · `target`
 * (root passthrough to the Card's own accepts).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(props: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:card-href" as EntryId<"project">,
        name: "Card href",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `card-href-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, "Card"),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const card = () =>
    [...root.domInputs.values()].find((r) => root.typeOf(r) === "Card")!;
  const render = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, card().id)));
    const el = host.querySelector<HTMLElement>(
      `[data-catalog-id="${card().id}"]`,
    )!;
    const html = {
      tag: el.tagName,
      className: el.className,
      href: el.getAttribute("href"),
      target: el.getAttribute("target"),
      role: el.getAttribute("role"),
      tabIndex: el.getAttribute("tabindex"),
      rac: el.hasAttribute("data-rac"),
      text: el.textContent,
    };
    await act(async () => reactRoot.unmount());
    host.remove();
    return html;
  };
  return { workspace, card, render };
}

describe("Card href — S2 standalone link card", () => {
  it("the placed Card edits href · target (the origin's contract)", () => {
    expect(Object.keys(CARD_PROPS_SCHEMA)).toEqual(
      expect.arrayContaining(["href", "target"]),
    );
  });

  it("without href: a div", async () => {
    const { render } = await open();
    const html = await render();
    expect(html.tag).toBe("DIV");
    expect(html.href).toBeNull();
  });

  it("with href: RAC Link (`a` with the href · target, RAC's own focus — no hand-written role)", async () => {
    const { render } = await open({
      href: "https://example.com",
      target: "_blank",
    });
    const html = await render();
    expect(html.tag).toBe("A");
    expect(html.className).toContain("react-aria-Card");
    expect([html.href, html.target]).toEqual(["https://example.com", "_blank"]);
    expect(html.rac).toBe(true);
    expect(html.role).toBeNull();
    expect(html.text).toContain("Card Title");
  });

  it("an href edit on the placed Card turns it into the link (and back)", async () => {
    const { workspace, card, render } = await open();
    const edit = (value: string) =>
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(card().id)!.target],
          props: { href: set(value) },
        }),
      );
    edit("/about");
    expect((await render()).tag).toBe("A");
    edit("");
    expect((await render()).tag).toBe("DIV");
  });
});
