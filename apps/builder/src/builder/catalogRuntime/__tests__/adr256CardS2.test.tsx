// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  canNest,
  catalogChildKind,
} from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { predictRacSlot } from "../../../../../../packages/shared/src/catalog/runtime/racSlot";
import { catalogTextCommand } from "../canvasText";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { catalogSlotCommands, catalogSlotInsertOptions } from "../slots";
import { CatalogStorage } from "../storage";
import { catalogTextBinding } from "../textBinding";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 10a (G2) — the S2 Card (사용자 결정 2026-10-11 「S2 그대로」 · 「범용 Content · Footer」):
 * `Card > CardPreview + Content (Text[slot=title] + Text[slot=description] + free content) + Footer`
 * — the reference `@react-spectrum/s2` Card (react-spectrum.adobe.com/Card.md, G0 example 13). No
 * CardHeader, no `title` · `description` props: the Content's Text nodes hold the text, styled by
 * the Card's `TextContext` slots (the Card rule's `[slot]` selectors — S2 `Card.tsx` title ·
 * description · content values). Content · Footer are the shared S2 types; an InlineAlert's body is
 * a Content too (`InlineAlert > Heading + Content`).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const CARD_CSS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated/Card.css",
);

async function place(origin: string, props: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p10a" as EntryId<"project">,
        name: "Phase 10a",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-p10a-${Math.random()}`),
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
          id: PLACED,
          definitionId:
            `lib:definition:origin-component-${origin}` as LibraryDefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ) as never,
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const placed = () =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === PLACED,
    )!;
  const part = (name: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === name,
    )!;
  const kids = (id: string) =>
    root.canvasInputs
      .get(id)!
      .children.map((child) => root.canvasInputs.get(child)!);
  const slotText = (slot: string) =>
    kids(part("Content").id).find(
      (record) => root.typeOf(record) === "Text" && record.props.slot === slot,
    )!;
  return { workspace, root, placed, part, kids, slotText };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});
async function mount(element: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  unmount = async () => act(async () => root.unmount());
  return host;
}

/** An element's tree: tag.class[slot] > children (text nodes left out). */
function shape(element: Element): string {
  const className = [...element.classList]
    .filter((name) => name.startsWith("react-aria-"))
    .join(".");
  const slot = element.getAttribute("slot");
  const own = `${element.tagName.toLowerCase()}${className ? `.${className}` : ""}${slot ? `[slot=${slot}]` : ""}`;
  const children = [...element.children].map(shape);
  return children.length ? `${own}(${children.join(" + ")})` : own;
}

/** S2 `Card.tsx` per size (desktop): title · description font size, the Content's row gap. */
const S2_CARD_TEXT: Record<
  string,
  { title: number; description: number; gap: number }
> = {
  XS: { title: 12, description: 11, gap: 4 },
  S: { title: 12, description: 11, gap: 4 },
  M: { title: 14, description: 12, gap: 6 },
  L: { title: 16, description: 14, gap: 6 },
  XL: { title: 18, description: 16, gap: 8 },
};

describe("ADR-256 Phase 10a — the S2 Card", () => {
  it("is the S2 tree: CardPreview + Content (Text[title] + Text[description]) + Footer", async () => {
    const { workspace, root, placed, kids, slotText } = await place("card");
    expect(kids(placed().id).map((record) => root.typeOf(record))).toEqual([
      "CardPreview",
      "Content",
      "Footer",
    ]);
    expect(slotText("title").props.children).toBe("Card Title");
    expect(slotText("description").props.children).toBe(
      "Card description text goes here.",
    );
    // No title · description props: S2 Card has none.
    const definition = workspace.runtime.graph.library.definitions.get(
      "lib:definition:origin-component-card" as never,
    )!;
    expect(Object.keys(definition.accepts).sort()).toEqual(["size", "variant"]);
  });

  it("the Preview DOM has the reference structure, the Text nodes in the Card's title · description slots", async () => {
    const { workspace, placed } = await place("card");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const card = host.querySelector(".react-aria-Card")!;
    // The reference (S2 `Card > CardPreview > Image + Content > Text[slot=title] +
    // Text[slot=description] + Footer`), each S2 section a `div`, S2 `Text` a `span`. (The template's
    // Image has no source yet — the Image binding draws its placeholder box, not an `img`.)
    expect(shape(card)).toBe(
      "div.react-aria-Card(div.react-aria-CardPreview(div.react-aria-Image) + div.react-aria-Content(span.react-aria-Text[slot=title] + span.react-aria-Text[slot=description]) + div.react-aria-Footer)",
    );
  });

  it("styles the title · description per size from the Card rule — the Canvas records and the sheet hold the same values", async () => {
    const css = readFileSync(CARD_CSS, "utf8");
    for (const [size, expected] of Object.entries(S2_CARD_TEXT)) {
      const { part, slotText } = await place("card", { size });
      expect(slotText("title").visual.fontSize, size).toBe(expected.title);
      expect(Number(slotText("title").visual.fontWeight)).toBe(700);
      expect(slotText("description").visual.fontSize, size).toBe(
        expected.description,
      );
      expect(part("Content").visual.gap, size).toBe(expected.gap);
      // The Preview's sheet (generated from the same rule).
      expect(css).toMatch(
        new RegExp(
          `\\.react-aria-Card\\[data-size="${size}"\\] \\.react-aria-Text\\[slot="title"\\] \\{\\s*font-size: ${expected.title}px;`,
        ),
      );
      expect(css).toMatch(
        new RegExp(
          `\\.react-aria-Card\\[data-size="${size}"\\] > \\.react-aria-Content \\{\\s*gap: ${expected.gap}px;`,
        ),
      );
    }
  });

  // 판독 M1: the Card arranges its own sections only — a Content deeper in it (an InlineAlert's in
  // the Card's Content) keeps its own arrangement on both sides (the sheet's `>` · the Canvas part
  // rules reach the Card's children only).
  it("arranges only its own Content: an InlineAlert's Content inside the Card takes no Card gap", async () => {
    const css = readFileSync(CARD_CSS, "utf8");
    expect(css).not.toMatch(
      /\.react-aria-Card(\[[^\]]*\])? \.react-aria-(Content|Footer)/,
    );
    const { workspace, root, part, kids } = await place("card");
    const content = workspace.itemOfRecord(part("Content").id)!.target;
    const options = catalogSlotInsertOptions(
      workspace.runtime.graph,
      content as never,
    );
    const alert = options.find((option) => /inline ?alert/i.test(option.label));
    expect(alert, options.map((option) => option.label).join()).toBeDefined();
    workspace.execute(
      catalogSlotCommands.fill(
        content as never,
        alert!.definitionId,
        workspace.newId,
      ),
    );
    const inner = [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === "Content",
    );
    expect(inner.length).toBe(2);
    const nested = inner.find((record) => record.id !== part("Content").id)!;
    expect(nested.visual.gap).toBeUndefined();
    expect(kids(part("Content").id).map((r) => root.typeOf(r))).toEqual([
      "Text",
      "Text",
      "InlineAlert",
    ]);
  });

  it("Properties predicts the slots the Card names (S2 TextContext), and none outside a Card", () => {
    expect(predictRacSlot("Text", ["Content", "Card"], "title")).toMatchObject({
      kind: "named",
      slot: "title",
      provider: "Card",
    });
    expect(
      predictRacSlot("Text", ["Content", "Card"], "description"),
    ).toMatchObject({ kind: "named", slot: "description" });
    expect(predictRacSlot("Text", ["Content", "Card"], undefined).kind).toBe(
      "default",
    );
    expect(predictRacSlot("Text", ["frame"], "title").kind).toBe("none");
  });

  it("the Content takes free content from the instance: a Button goes in after the texts, which stay", async () => {
    const { workspace, root, part, kids, slotText, placed } =
      await place("card");
    const content = workspace.itemOfRecord(part("Content").id)!.target;
    expect(content.kind).toBe("descendant");
    const options = catalogSlotInsertOptions(
      workspace.runtime.graph,
      content as never,
    );
    const button = options.find((option) => option.label === "Button");
    expect(button, options.map((option) => option.label).join()).toBeDefined();
    workspace.execute(
      catalogSlotCommands.fill(
        content as never,
        button!.definitionId,
        workspace.newId,
      ),
    );
    expect(
      kids(part("Content").id).map((record) => root.typeOf(record)),
    ).toEqual(["Text", "Text", "Button"]);
    expect(slotText("title").props.children).toBe("Card Title");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(shape(host.querySelector(".react-aria-Content")!)).toBe(
      "div.react-aria-Content(span.react-aria-Text[slot=title] + span.react-aria-Text[slot=description] + button.react-aria-Button)",
    );
  });

  it("the title is its own node's text — no Card prop owns it", async () => {
    const { workspace, root, slotText, placed } = await place("card");
    expect(
      catalogTextBinding(
        workspace.runtime.graph.library,
        root.domInputs,
        slotText("title"),
        "children",
      ),
    ).toBeUndefined();
    workspace.execute(
      catalogTextCommand(
        workspace.itemOfRecord(slotText("title").id)!,
        "children",
        "Card Title",
        "Command + R",
      )!,
    );
    expect(slotText("title").props.children).toBe("Command + R");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(host.querySelector('[slot="title"]')!.textContent).toBe(
      "Command + R",
    );
  });

  it("an InlineAlert is Heading + Content (S2), its description still one size step above", async () => {
    const { workspace, root, placed, kids, part } = await place(
      "inline-alert",
      {},
    );
    expect(kids(placed().id).map((record) => root.typeOf(record))).toEqual([
      "Heading",
      "Content",
    ]);
    expect(
      kids(part("Content").id).map((record) => root.typeOf(record)),
    ).toEqual(["Description"]);
    // The alert's size (M) reaches the description through the Content (`CATALOG_SIZE_STEP` L).
    expect(part("Description").props.size).toBe("L");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(shape(host.querySelector(".react-aria-InlineAlert")!)).toBe(
      "div.react-aria-InlineAlert(h3.react-aria-Heading + div.react-aria-Content(span.react-aria-Text[slot=description]))",
    );
  });
});

/**
 * ADR-256 Phase 10b (G2) — the S2 groups. CardView is S2's RAC GridList of its Cards
 * (`@react-spectrum/s2/src/CardView.tsx` — each Card a GridListItem, named by its title); its
 * selection is RAC's. ButtonGroup · AvatarGroup take free content (G0 ② — their limit rows are gone;
 * the Preview draws every child in order), never their own kind.
 */
describe("ADR-256 Phase 10b — CardView · ButtonGroup · AvatarGroup", () => {
  it("a CardView is a RAC GridList whose rows are its Cards, named by their titles", async () => {
    const { workspace, root, placed, kids } = await place("cardview");
    expect(catalogChildKind("CardView")).toEqual({
      kind: "items",
      items: ["Card"],
    });
    expect(kids(placed().id).map((record) => root.typeOf(record))).toEqual([
      "Card",
      "Card",
      "Card",
    ]);
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const grid = host.querySelector(".react-aria-CardView")!;
    expect(grid.getAttribute("role")).toBe("grid");
    const rows = [...grid.children];
    expect(
      rows.map((row) => [row.getAttribute("role"), row.className]),
    ).toEqual([
      ["row", "react-aria-Card"],
      ["row", "react-aria-Card"],
      ["row", "react-aria-Card"],
    ]);
    // (RAC's gridcell holds the S2 sections — `display: contents`, the Card's flex column stays.)
    expect(
      shape(rows[0]!.querySelector('[role="gridcell"]')!).replace(
        /^div/,
        "cell",
      ),
    ).toBe(
      "cell(div.react-aria-CardPreview(div.react-aria-Image) + div.react-aria-Content(span.react-aria-Text[slot=title] + span.react-aria-Text[slot=description]) + div.react-aria-Footer)",
    );
    expect(
      (rows[0]!.querySelector('[role="gridcell"]') as HTMLElement).style
        .display,
    ).toBe("contents");
  });

  it("selects as RAC does: a Card's isSelected starts the view's selection only while it selects (Canvas = DOM)", async () => {
    const { workspace, root, placed, kids } = await place("cardview");
    const first = () => kids(placed().id)[0]!;
    const set = (target: unknown, props: Record<string, unknown>) =>
      workspace.execute(
        setFields({
          targets: [target as never],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ) as never,
        }),
      );
    set(workspace.itemOfRecord(first().id)!.target, { isSelected: true });
    // selectionMode none: neither side selects.
    expect(first().derivedProps?._isSelected).toBe(false);
    let host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(
      host.querySelectorAll('.react-aria-Card[aria-selected="true"]').length,
    ).toBe(0);
    await unmount?.();
    unmount = undefined;
    set({ kind: "node", id: PLACED }, { selectionMode: "multiple" });
    expect(first().derivedProps?._isSelected).toBe(true);
    host = await mount(renderCatalogDom(workspace.root, placed().id));
    const selected = [
      ...host.querySelectorAll('.react-aria-Card[aria-selected="true"]'),
    ];
    expect(selected.length).toBe(1);
    expect(selected[0]!.hasAttribute("data-selected")).toBe(true);
  });

  it("ButtonGroup · AvatarGroup take free content (drawn by both consumers), never their own kind", async () => {
    expect(catalogChildKind("ButtonGroup").kind).toBe("free");
    expect(catalogChildKind("AvatarGroup").kind).toBe("free");
    const { workspace, root, placed, kids } = await place("buttongroup");
    const note = workspace.newId("node") as NodeId;
    workspace.execute(
      insertNodes({
        parent: workspace.itemOfRecord(placed().id)!.target as never,
        entries: [
          {
            kind: "node",
            id: note,
            definitionId: "lib:definition:text" as LibraryDefinitionId,
            children: [],
            props: { children: { kind: "set", value: "Note" } } as never,
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [note],
        newId: workspace.newId,
      }),
    );
    expect(kids(placed().id).map((record) => root.typeOf(record))).toEqual([
      "Button",
      "Button",
      "Text",
    ]);
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(host.querySelector('[role="group"]')!.textContent).toContain("Note");
    expect(canNest("ButtonGroup", "ButtonGroup", ["ButtonGroup", "body"])).toBe(
      false,
    );
    expect(canNest("AvatarGroup", "Text", ["AvatarGroup", "body"])).toBe(true);
  });
});
