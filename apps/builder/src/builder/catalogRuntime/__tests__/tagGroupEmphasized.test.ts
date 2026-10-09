// @vitest-environment jsdom
/**
 * S2 1.8.0 TagGroup `isEmphasized` (2026-10-10, 조사 문서 목록 D): a selected Tag is neutral
 * (S2 `baseColor('neutral')`, text `gray-25`), accent when the group is emphasized (S2
 * `accent-900`, text white) — the Checkbox · Switch · Slider pair. DOM: the TagGroup's
 * `data-emphasized` (`TagGroup.css`); Canvas: the Tag rule's `selected` · `selectedEmphasized`
 * paint (the Tag's `_emphasized`, derived from its TagGroup).
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
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const GROUP = "project:node:tags" as NodeId;
const DEFINITION = "lib:definition:origin-component-taggroup";
const SHEET = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/TagGroup.css",
);
const set = <T>(value: T) => ({ kind: "set" as const, value });

type Painted = {
  type?: string;
  box?: { fillColor?: Record<string, number> };
  text?: { color?: Record<string, number> };
  children?: Painted[];
};
const rgb = (color: Record<string, number>) =>
  [color[0], color[1], color[2]].map((value) => Math.round(value * 255));
const isNeutral = ([r, g, b]: number[]) =>
  Math.max(r, g, b) - Math.min(r, g, b) <= 8;
/** The first text color painted in a node's subtree. */
const textColor = (node: Painted | undefined): number[] | undefined => {
  if (!node) return undefined;
  if (node.text?.color) return rgb(node.text.color);
  for (const child of node.children ?? []) {
    const found = textColor(child);
    if (found) return found;
  }
  return undefined;
};

async function open(groupProps: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tag-emphasized" as const,
        name: "Tag emphasized",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tag-emphasized-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: GROUP,
          definitionId: DEFINITION,
          children: [],
          props: Object.fromEntries(
            Object.entries({
              selectionMode: "multiple",
              ...groupProps,
            }).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const tags = () =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === "Tag");
  workspace.execute(
    setFields({
      targets: [workspace.positionOfRecord(tags()[0]!.id)!.target],
      props: { isSelected: set(true) },
    }),
  );
  const group = [...root.domInputs.values()].find((r) => r.sourceId === GROUP)!;
  const html = renderToStaticMarkup(renderCatalogDom(root, group.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const paint = (index: number) => {
    const tag = tags()[index]!;
    const node = getSkiaNode(tag.id) as unknown as Painted;
    // (its label is the Text node in it — the Tag's color, `catalogRuleTextColor`)
    const label = tag.children.find(
      (id) => root.typeOf(root.canvasInputs.get(id)!) === "Text",
    )!;
    return {
      fill: rgb(node.box!.fillColor!),
      text: textColor(getSkiaNode(label) as unknown as Painted),
    };
  };
  const painted = { selected: paint(0), plain: paint(1) };
  canvas.dispose();
  return { html, painted };
}

describe("S2 TagGroup isEmphasized", () => {
  it("the Design panel offers Emphasized", () => {
    expect(
      catalogSemanticContracts(DEFINITION as never, "TagGroup").isEmphasized,
    ).toMatchObject({ kind: "boolean" });
  });

  it("default: a selected Tag is neutral on the Canvas · no emphasis in the DOM", async () => {
    const { html, painted } = await open({});
    expect(html).not.toContain("data-emphasized");
    expect(isNeutral(painted.selected.fill)).toBe(true);
    expect(painted.selected.fill).not.toEqual(painted.plain.fill);
    // (its label: the inverse of the fill — light on the dark chip)
    expect(painted.selected.text).toBeDefined();
    expect(painted.selected.text![0]).toBeGreaterThan(200);
  });

  it("emphasized: a selected Tag is accent on the Canvas · the group's data-emphasized", async () => {
    const plain = await open({});
    const { html, painted } = await open({ isEmphasized: true });
    expect(html).toContain('data-emphasized="true"');
    expect(isNeutral(painted.selected.fill)).toBe(false);
    expect(painted.selected.fill).not.toEqual(plain.painted.selected.fill);
    // (an unselected Tag is the same either way)
    expect(painted.plain.fill).toEqual(plain.painted.plain.fill);
  });

  it("the sheet paints the same pair: selected --fg · emphasized selected --accent", () => {
    const sheet = readFileSync(SHEET, "utf8");
    expect(sheet).toMatch(
      /&\[data-selected\] \{\s*--tag-color: var\(--fg\);\s*--tag-text: var\(--bg\);\s*--tag-border: var\(--fg\);/,
    );
    expect(sheet).toMatch(
      /\.react-aria-TagGroup\[data-emphasized\] \.react-aria-Tag\[data-selected\] \{\s*--tag-color: var\(--accent\);\s*--tag-text: var\(--fg-on-accent\);\s*--tag-border: var\(--accent\);/,
    );
  });
});
