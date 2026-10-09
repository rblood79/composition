// @vitest-environment jsdom
/**
 * S2 1.8.0 Disclosure `isQuiet` · `density` (2026-10-10 사용자 결정 「S2 처럼 기본 Disclosure 에 위아래
 * 테두리를 넣고, isQuiet 로 없애게」): a Disclosure has a 1px top and bottom border, none when quiet;
 * inside a DisclosureGroup only the last item keeps its bottom border (S2 `isInGroup` ·
 * `:last-child`). The trigger is square (rounded when quiet) and its height follows the density
 * (S2 `minHeight` — S 18 · 24 · 32, M 24 · 32 · 40, L 32 · 40 · 48: a `min-height` and the vertical
 * padding that centers one line in it). DOM: the root's `data-quiet` · `data-density` · `data-in-group` and the generated
 * sheet; Canvas: the same rule declarations (`catalogDisclosureBorders`, the part rules).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const SHEET = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated/Disclosure.css",
);
const set = <T>(value: T) => ({ kind: "set" as const, value });

type Painted = {
  box?: { strokeWidths?: number[]; strokeColor?: Record<string, number> };
};

async function workspace() {
  const library = await buildCodeCatalogLibrary();
  const space = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:disclosure-s2" as const,
        name: "Disclosure S2",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `disclosure-s2-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const insert = (
    parent: NodeId,
    id: NodeId,
    definitionId: string,
    props: Record<string, unknown> = {},
  ) =>
    space.execute(
      insertNodes({
        parent: { kind: "node", id: parent },
        entries: [
          {
            kind: "node",
            id,
            definitionId,
            children: [],
            props: Object.fromEntries(
              Object.entries(props).map(([key, value]) => [key, set(value)]),
            ),
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id],
        newId: space.newId,
      }),
    );
  const root = space.root;
  const records = () => [...root.canvasInputs.values()];
  const recordOf = (id: NodeId) => records().find((r) => r.sourceId === id)!;
  /** What both consumers show for a placed Disclosure (and its trigger). */
  const read = (id: NodeId) => {
    const disclosure = recordOf(id);
    const trigger = records().find(
      (r) =>
        root.typeOf(r) === "Button" &&
        r.props.slot === "trigger" &&
        root.canvasInputs.get(r.parentId)?.parentId === disclosure.id,
    )!;
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const painted = getSkiaNode(disclosure.id) as unknown as Painted;
    const height = (record: { id: string }) =>
      (root.getGeometry([record.id]).get(record.id) as { height: number })
        .height;
    const out = {
      strokes: painted.box?.strokeWidths ?? [0, 0, 0, 0],
      height: height(disclosure),
      trigger: {
        // (the box model's top padding: a side value wins over the axis one — `catalogBoxModel`)
        paddingY: trigger.visual.paddingTop ?? trigger.visual.paddingY,
        radius: trigger.visual.radius,
        height: height(trigger),
      },
      tag:
        /<div[^>]*class="react-aria-Disclosure"[^>]*>/.exec(
          renderToStaticMarkup(
            renderCatalogDom(
              root,
              [...root.domInputs.values()].find((r) => r.sourceId === id)!.id,
            ),
          ),
        )?.[0] ?? "",
    };
    canvas.dispose();
    return out;
  };
  const write = (id: NodeId, props: Record<string, string | boolean>) =>
    space.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { library, insert, read, write, root, recordOf };
}

describe("S2 Disclosure isQuiet · density", () => {
  it("the Design panel offers Density and Quiet", async () => {
    const { library } = await workspace();
    const contracts = catalogSemanticContracts(
      catalogPaletteDefinitionId(library, "Disclosure"),
      "Disclosure",
    );
    expect(contracts.isQuiet).toMatchObject({ kind: "boolean" });
    expect(contracts.density).toMatchObject({ kind: "enum" });
  });

  it("default: a top and bottom border on both sides · a square regular trigger", async () => {
    const { library, insert, read } = await workspace();
    const id = "project:node:disclosure" as NodeId;
    insert(BODY, id, catalogPaletteDefinitionId(library, "Disclosure"));
    const shown = read(id);
    expect(shown.tag).not.toContain("data-quiet");
    expect(shown.tag).not.toContain("data-in-group");
    expect(shown.strokes).toEqual([1, 0, 1, 0]);
    expect(shown.trigger).toMatchObject({ paddingY: 6, radius: 0 });
    // (The border is laid out: the box is 2px taller than its content.)
    expect(shown.height).toBeGreaterThan(shown.trigger.height + 2);
  });

  it("quiet: no border on either side · a rounded trigger", async () => {
    const { library, insert, read, write } = await workspace();
    const id = "project:node:disclosure" as NodeId;
    insert(BODY, id, catalogPaletteDefinitionId(library, "Disclosure"));
    const plain = read(id);
    write(id, { isQuiet: true });
    const quiet = read(id);
    expect(quiet.tag).toContain('data-quiet="true"');
    expect(quiet.strokes).toEqual([0, 0, 0, 0]);
    expect(quiet.height).toBe(plain.height - 2);
    expect(quiet.trigger.radius).toBeGreaterThan(0);
  });

  it("density: the trigger's S2 height per size (compact · regular · spacious)", async () => {
    const { library, insert, read, write } = await workspace();
    const id = "project:node:disclosure" as NodeId;
    insert(BODY, id, catalogPaletteDefinitionId(library, "Disclosure"));
    const heights: Record<string, Record<string, number>> = {
      S: { compact: 18, regular: 24, spacious: 32 },
      M: { compact: 24, regular: 32, spacious: 40 },
      L: { compact: 32, regular: 40, spacious: 48 },
    };
    const padding: Record<string, Record<string, number>> = {
      S: { compact: 0, regular: 3, spacious: 7 },
      M: { compact: 2, regular: 6, spacious: 10 },
      L: { compact: 4, regular: 8, spacious: 12 },
    };
    for (const [size, densities] of Object.entries(heights))
      for (const [density, height] of Object.entries(densities)) {
        write(id, { size, density });
        const shown = read(id);
        expect(shown.trigger.height, `${size} ${density}`).toBe(height);
        expect(shown.trigger.paddingY, `${size} ${density}`).toBe(
          padding[size]![density],
        );
        expect(shown.tag).toContain(`data-density="${density}"`);
      }
  });

  it("in a DisclosureGroup only the last item keeps its bottom border — also after an insert", async () => {
    const { library, insert, read } = await workspace();
    const group = "project:node:group" as NodeId;
    insert(BODY, group, "lib:definition:type-DisclosureGroup");
    const disclosure = catalogPaletteDefinitionId(library, "Disclosure");
    const first = "project:node:first" as NodeId;
    const second = "project:node:second" as NodeId;
    insert(group, first, disclosure);
    expect(read(first).strokes).toEqual([1, 0, 1, 0]);
    insert(group, second, disclosure);
    expect(read(first).strokes).toEqual([1, 0, 0, 0]);
    expect(read(second).strokes).toEqual([1, 0, 1, 0]);
    expect(read(first).tag).toContain('data-in-group="true"');
  });

  it("the sheet declares the same borders, trigger heights and quiet corners", () => {
    const sheet = readFileSync(SHEET, "utf8");
    expect(sheet).toMatch(
      /\.react-aria-Disclosure \{[^}]*border-top: 1px solid var\(--border\);\s*border-bottom: 1px solid var\(--border\);/,
    );
    expect(sheet).toMatch(
      /\.react-aria-Disclosure\[data-quiet="true"\] \{\s*border-top-width: 0;\s*border-bottom-width: 0;/,
    );
    expect(sheet).toMatch(
      /\.react-aria-Disclosure\[data-in-group\]:not\(:last-child\) \{\s*border-bottom-width: 0;/,
    );
    expect(sheet).toMatch(
      /\.react-aria-Disclosure\[data-size="M"\] \{\s*--disclosure-trigger-h: 32px;\s*--disclosure-trigger-py: 6px;\s*--disclosure-trigger-h-compact: 24px;\s*--disclosure-trigger-py-compact: 2px;\s*--disclosure-trigger-h-spacious: 40px;\s*--disclosure-trigger-py-spacious: 10px;/,
    );
    expect(sheet).toMatch(
      /\.react-aria-Disclosure\[data-quiet="true"\] \.react-aria-Button\[slot='trigger'\] \{\s*border-radius: var\(--radius-md\);/,
    );
    expect(sheet).toMatch(
      /\.react-aria-Disclosure \.react-aria-Button\[slot='trigger'\] \{[^}]*min-height: var\(--disclosure-trigger-h\);\s*padding: var\(--disclosure-trigger-py\) var\(--spacing-md\);\s*border-radius: 0;/,
    );
  });
});
