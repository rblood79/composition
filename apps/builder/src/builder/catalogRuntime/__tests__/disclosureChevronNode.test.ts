// @vitest-environment jsdom
/**
 * Disclosure chevron (ADR-256 Phase 8c — rewritten from the 2026-10-07 DisclosureChevron node): the
 * chevron is the trigger's Icon node, the reference `<Button slot="trigger"><ChevronRight />
 * <span>{children}</span></Button>` (the Tree chevron's way, Phase 5h). The Canvas paints the glyph in
 * the Icon's own box (18px, the trigger's `--icon-size`) in the trigger's text color — the DOM glyph's
 * `currentColor` (the old header rule painted it `neutral-subdued`) — and turns it with the
 * expansion; the Heading and the trigger Button paint no glyph of their own.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  buildCodeCatalogLibrary,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

const OWNER = "project:node:owner" as NodeId;

/** A node entry of `definitionId` with set props. */
const nodeEntry = (
  id: string,
  definitionId: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

/** A workspace whose home body holds `entries` (roots: the first). */
async function openWorkspace(
  entries: (library: CatalogLibrary) => NodeEntry[],
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:disclosure-chevron" as const,
        name: "Disclosure chevron",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `disclosure-chevron-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: entries(library),
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

async function openPalette(type: string, props: Record<string, unknown> = {}) {
  const workspace = await openWorkspace((library) => [
    nodeEntry(OWNER, catalogPaletteDefinitionId(library, type), [], props),
  ]);
  const root = workspace.root;
  const record = (id: string) => root.layoutInputs.get(id)!;
  const kids = (id: string) => record(id).children.map(record);
  const ofBinding = (binding: string) =>
    [...root.layoutInputs.values()].filter(
      (entry) => entry.bindingId === binding,
    );
  return { workspace, root, record, kids, ofBinding };
}

/** Icon glyph shapes under painted node data. */
function glyphs(data: SkiaNodeData | undefined): SkiaNodeData[] {
  if (!data) return [];
  return [
    ...(data.type === "icon_path" ? [data] : []),
    ...(data.children ?? []).flatMap(glyphs),
  ];
}

/** The trigger parts of the first Disclosure: its Heading, trigger Button, chevron Icon, title Text. */
function triggerOf(
  root: Awaited<ReturnType<typeof openPalette>>["root"],
  ofBinding: (binding: string) => ReturnType<
    Awaited<ReturnType<typeof openPalette>>["ofBinding"]
  >,
  index = 0,
) {
  const heading = ofBinding("heading")[index]!;
  const trigger = root.layoutInputs.get(heading.children[0]!)!;
  const [chevron, title] = trigger.children.map(
    (id) => root.layoutInputs.get(id)!,
  );
  return { heading, trigger, chevron, title };
}

describe("Disclosure chevron (the trigger's Icon node)", () => {
  it("the Icon paints the glyph in its own 18px box in the trigger's text color; the header and trigger paint none", async () => {
    const { workspace, root, ofBinding } = await openPalette("Disclosure");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const { heading, trigger, chevron, title } = triggerOf(root, ofBinding);
    const [glyph] = glyphs(getSkiaNode(chevron.id));
    expect(glyph.iconPath).toMatchObject({ cx: 9, cy: 9, size: 18 });
    // (The trigger's text color — the title's: the DOM glyph is `currentColor`.)
    const hex = String(title.visual.color);
    expect(
      [...glyph.iconPath!.strokeColor].slice(0, 3).map((c) => Math.round(c * 255)),
    ).toEqual([1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)));
    expect(glyphs(getSkiaNode(heading.id))).toHaveLength(0);
    expect(glyphs(getSkiaNode(trigger.id))).toHaveLength(0);
    canvas.dispose();
    workspace.dispose();
  });

  it("the expansion turns the glyph (a delta update)", async () => {
    const { workspace, root, ofBinding } = await openPalette("Disclosure");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const { chevron } = triggerOf(root, ofBinding);
    const expanded = JSON.stringify(glyphs(getSkiaNode(chevron.id))[0].iconPath?.paths);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { isExpanded: { kind: "set", value: false } },
      }),
    );
    canvas.update();
    const collapsed = JSON.stringify(glyphs(getSkiaNode(chevron.id))[0].iconPath?.paths);
    expect(collapsed).not.toBe(expanded);
    canvas.dispose();
    workspace.dispose();
  });

  it("a DisclosureGroup's chevrons follow the group's expansion", async () => {
    const { workspace, root, ofBinding } = await openPalette("DisclosureGroup");
    const turned = () =>
      [0, 1].map(
        (index) =>
          root.canvasInputs.get(triggerOf(root, ofBinding, index).chevron.id)!
            .derivedProps?.iconName === "chevron-down",
      );
    const before = turned();
    const disclosures = ofBinding("disclosure");
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(disclosures[1].id)!.target],
        props: { isExpanded: { kind: "set", value: !before[1] } },
      }),
    );
    expect(turned()[1]).toBe(!before[1]);
    workspace.dispose();
  });

  it("the chevron is the author's content: removing it removes the glyph from both consumers", async () => {
    const { workspace, root, ofBinding } = await openPalette("Disclosure");
    const { trigger, chevron } = triggerOf(root, ofBinding);
    workspace.execute(
      removeTargets({ targets: [workspace.positionOfRecord(chevron.id)!.target] }),
    );
    expect(root.layoutInputs.get(trigger.id)!.children).toHaveLength(1);
    const html = renderToStaticMarkup(
      renderCatalogDom(root, ofBinding("disclosure")[0]!.id),
    );
    expect(html).not.toContain("react-aria-Icon");
    expect(html).toContain("Section Title");
    workspace.dispose();
  });
});
