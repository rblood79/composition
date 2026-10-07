// @vitest-environment jsdom
/**
 * Disclosure chevron node (2026-10-07, user「Disclosure header 도 switch · checkbox 처럼 indicator 와 label 이
 * 분리」 — the toggle indicator / TreeItemChevron pattern): a Disclosure's header holds its chevron as a
 * `DisclosureChevron` child and its title as a `Text` child (`{title}`), as the reference trigger
 * `<Button slot="trigger"><ChevronRight /><span>{children}</span></Button>`.
 *
 * Oracle: the DOM trigger (`Disclosure.css` — `padding: 8px 12px`, `gap: 4px`, `.disclosure-chevron`
 * 18px, `flex-shrink: 0`): the chevron box at x 12, the title at x 34. Before the nodes the Canvas
 * drew the glyph at cx 43 and the title at 56 (the header's 34px inset and the rule's leading-icon
 * shift both applied), and it never turned the glyph (the header had no expansion value).
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
  catalogTypeDefinitionId,
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
import { catalogDomRendersNode, renderCatalogDom } from "../domBinding";
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

describe("Disclosure chevron node", () => {
  it.each([
    ["sm", 34, 8, 12],
    ["md", 36, 9, 14],
    ["lg", 38.857, 10.429, 16],
  ] as const)(
    "the header holds the chevron and the title Text; the trigger row places them as the DOM (%s)",
    async (size, height, chevronY, fontSize) => {
      const { workspace, root, kids, ofBinding } = await openPalette(
        "Disclosure",
        { size },
      );
      const [header] = ofBinding("disclosureheader");
      const [chevron, title] = kids(header.id);
      expect([chevron.bindingId, title.bindingId]).toEqual([
        "disclosurechevron",
        "text",
      ]);
      expect(title.props.children).toBe("Section Title");
      const geometry = root.getGeometry([header.id, chevron.id, title.id]);
      expect(geometry.get(header.id)!.height).toBeCloseTo(height, 2);
      const box = geometry.get(chevron.id)!;
      expect(box.x).toBe(12);
      expect(box.y).toBeCloseTo(chevronY, 2);
      expect([box.width, box.height]).toEqual([18, 18]);
      expect(geometry.get(title.id)!.x).toBe(34);
      // The title takes the trigger's font (size per Disclosure size, weight 600).
      expect(title.visual).toMatchObject({ fontSize, fontWeight: 600 });
      workspace.dispose();
    },
  );

  it("the DOM absorbs the chevron node and draws the title Text inside the RAC trigger", async () => {
    const { workspace, root, kids, ofBinding } =
      await openPalette("Disclosure");
    const [disclosure] = ofBinding("disclosure");
    const [header] = ofBinding("disclosureheader");
    const [chevron, title] = kids(header.id);
    const html = renderToStaticMarkup(renderCatalogDom(root, disclosure.id));
    expect(html).not.toContain(`data-catalog-id="${chevron.id}"`);
    expect(catalogDomRendersNode(root, chevron.id)).toBe(false);
    const trigger = /<button[^>]*slot="trigger"[^>]*>(.*?)<\/button>/.exec(
      html,
    )?.[1];
    expect(trigger).toMatch(
      new RegExp(
        // (RAC Text in the trigger's context — ADR-256 Decision 4; attribute order is RAC's.)
        `^<svg[^>]*class="disclosure-chevron".*</svg><span (?=[^>]*class="react-aria-Text")(?=[^>]*data-catalog-id="${title.id.replace(/[/:]/g, "\\$&")}")[^>]*>Section Title</span>$`,
      ),
    );
    // The title takes the trigger's color (its hover color too): no inline rest color.
    const span =
      /<span [^>]*data-catalog-id[^>]*>/.exec(trigger ?? "")?.[0] ?? "";
    expect(span).not.toMatch(/[;"]color:/);
    workspace.dispose();
  });

  it("the chevron node paints the header's leading icon in its box; the header paints none; the expansion turns it", async () => {
    const { workspace, root, kids, ofBinding } =
      await openPalette("Disclosure");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const [header] = ofBinding("disclosureheader");
    const [chevron] = kids(header.id);
    const painted = getSkiaNode(chevron.id)!;
    expect(painted.elementId).toBe(chevron.id);
    const [glyph] = glyphs(painted);
    expect(glyph.iconPath).toMatchObject({ cx: 9, cy: 9, size: 18 });
    expect(glyphs(getSkiaNode(header.id))).toHaveLength(0);
    // Expanded (the default) draws the turned glyph; collapsing turns it back on a delta update.
    const expanded = JSON.stringify(glyph.iconPath?.paths);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: OWNER }],
        props: { isExpanded: { kind: "set", value: false } },
      }),
    );
    canvas.update();
    const [collapsed] = glyphs(getSkiaNode(chevron.id));
    expect(JSON.stringify(collapsed.iconPath?.paths)).not.toBe(expanded);
    canvas.dispose();
    workspace.dispose();
  });

  it("a DisclosureGroup's sections carry their own titles and their headers follow the group's expansion", async () => {
    const { workspace, root, kids, ofBinding } =
      await openPalette("DisclosureGroup");
    const headers = ofBinding("disclosureheader");
    expect(headers.map((header) => kids(header.id)[1].props.children)).toEqual([
      "Section 1",
      "Section 2",
    ]);
    const expanded = () =>
      ofBinding("disclosureheader").map(
        (header) => root.canvasInputs.get(header.id)!.derivedProps?.isExpanded,
      );
    const before = expanded();
    expect(before.every((value) => typeof value === "boolean")).toBe(true);
    const disclosures = ofBinding("disclosure");
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(disclosures[1].id)!.target],
        props: { isExpanded: { kind: "set", value: !before[1] } },
      }),
    );
    expect(expanded()[1]).toBe(!before[1]);
    workspace.dispose();
  });

  it("a header with no chevron node (made before it) keeps its own leading icon at the trigger's place", async () => {
    const node = (
      id: string,
      type: string,
      children: string[],
      props: Record<string, unknown> = {},
    ) => nodeEntry(id, catalogTypeDefinitionId(type), children, props);
    const workspace = await openWorkspace(() => [
      node(OWNER, "Disclosure", ["project:node:h", "project:node:c"], {
        title: "Old",
      }),
      node("project:node:h", "DisclosureHeader", [], { children: "Old" }),
      node("project:node:c", "DisclosureContent", [], { children: "Body" }),
    ]);
    const root = workspace.root;
    const header = [...root.layoutInputs.values()].find(
      (entry) => entry.sourceId === "project:node:h",
    )!;
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const painted = getSkiaNode(header.id)!;
    const [glyph] = glyphs(painted);
    expect(glyph.iconPath).toMatchObject({ cx: 21, cy: 18, size: 18 });
    const text = (painted.children ?? []).find(
      (child) => child.type === "text",
    );
    expect(text?.text?.paddingLeft).toBe(34);
    canvas.dispose();
    workspace.dispose();
  });

  it("the chevron position is not removable", async () => {
    const { workspace, kids, ofBinding } = await openPalette("Disclosure");
    const [header] = ofBinding("disclosureheader");
    const [chevron] = kids(header.id);
    let code: unknown;
    try {
      workspace.execute(
        removeTargets({
          targets: [workspace.positionOfRecord(chevron.id)!.target],
        }),
      );
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("OWNER_DRAWN_PART_NOT_REMOVABLE");
    workspace.dispose();
  });
});
