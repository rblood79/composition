// @vitest-environment jsdom
/**
 * A Text's HTML tag (사용자 결정 2026-11-25 「Text 컴포넌트 프러퍼티에 Tag 옵션」): RAC `Text` draws its
 * `elementType`, so a page heading is a Text tagged `h1`~`h6` — not one more component. The Canvas
 * draws it as the browser does: an `h` takes the h rule's scale of its parent's font and bold, a `p`
 * the parent's font.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { textBinding } from "../../../../../../packages/shared/src/catalog/bindings/Text.binding";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  CATALOG_TEXT_ELEMENT_TYPES,
  catalogTextElementType,
} from "../../../../../../packages/shared/src/catalog/document/textElementType";
import type {
  DefinitionId,
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const WORDS = "project:node:tagged-words" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(elementType?: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:text-element" as EntryId<"project">,
        name: "Text element",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `text-element-${Math.random()}`),
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
          id: WORDS,
          definitionId: "lib:definition:text" as DefinitionId,
          children: [],
          props: {
            children: set("Tagged words"),
            ...(elementType ? { elementType: set(elementType) } : {}),
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [WORDS],
      newId: workspace.newId,
    }),
  );
  const record = () =>
    [...workspace.root.canvasInputs.values()].find(
      (item) => item.sourceId === WORDS,
    )!;
  const font = () => ({
    size: Number(record().derivedProps?.fontSize ?? record().visual.fontSize),
    weight: Number(
      record().derivedProps?.fontWeight ?? record().visual.fontWeight,
    ),
  });
  const tag = (value: string) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: WORDS }],
        props: { elementType: set(value) },
        label: "Edit properties",
      }),
    );
  const markup = () =>
    renderToStaticMarkup(renderCatalogDom(workspace.root, record().id));
  return { workspace, font, tag, markup };
}

describe("Text HTML tag", () => {
  it("offers span · p · h1~h6, shown as span when unset, for a Text with no slot role", () => {
    const field = textBinding.props.accepts.elementType!;
    expect(CATALOG_TEXT_ELEMENT_TYPES).toEqual([
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]);
    // (Shown as `span` when unset — no `default`, which every Text's resolved props would carry.)
    expect(field.default).toBeUndefined();
    expect(field.defaultWhen).toEqual([
      { when: { key: "elementType", truthy: false }, value: "span" },
    ]);
    // (A part Text — a label · description slot — is its owner's to tag.)
    expect(field.visibleWhen).toEqual({ key: "slot", truthy: false });
    expect(catalogTextElementType({ elementType: "script" })).toBe("span");
  });

  it("draws the tag in the DOM (RAC `Text` `elementType`)", async () => {
    const plain = await open();
    expect(plain.markup()).toMatch(/^<span[^>]*class="react-aria-Text"/);
    const heading = await open("h2");
    expect(heading.markup()).toMatch(/^<h2[^>]*class="react-aria-Text"/);
    const paragraph = await open("p");
    expect(paragraph.markup()).toMatch(/^<p[^>]*class="react-aria-Text"/);
  });

  it("an h tag is the browser's h on the Canvas — the parent's 16 × 1.5, bold", async () => {
    const { font } = await open("h2");
    expect(font()).toEqual({ size: 24, weight: 700 });
  });

  it("follows a tag edit and its undo", async () => {
    const { workspace, font, tag, markup } = await open();
    expect(font()).toEqual({ size: 16, weight: 400 });
    tag("h1");
    expect(font()).toEqual({ size: 32, weight: 700 });
    expect(markup()).toMatch(/^<h1/);
    tag("p");
    expect(font()).toEqual({ size: 16, weight: 400 });
    workspace.undo();
    expect(font()).toEqual({ size: 32, weight: 700 });
  });

  it("keeps the author's own font size and weight over the h rule", async () => {
    const { workspace, font } = await open("h1");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: WORDS }],
        visual: { fontSize: set(12), fontWeight: set(400) },
      }),
    );
    expect(font()).toEqual({ size: 12, weight: 400 });
  });
});
