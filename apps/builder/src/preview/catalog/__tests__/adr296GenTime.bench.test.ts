import { writeFileSync } from "node:fs";
import { describe, it, vi } from "vitest";
import { createPage } from "../../../../../../packages/shared/src/catalog/commands";
import { addCollection } from "../../../../../../packages/shared/src/catalog/commands/data";
import { setNodeInteractions } from "../../../../../../packages/shared/src/catalog/commands/project";
import type {
  DataCollectionId,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
import { catalogCodeViewData } from "../../../builder/catalogRuntime/codeView";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr296 } from "./support/adr296Harness";

/**
 * ADR-296 G0 · G5 (R5) — the code view's generation time (run with `ADR296_BENCH=1`; `ADR296_OUT`
 * writes the JSON). The document is a scale fixture (measurement-validity Q1 — synthetic, so its
 * numbers are sizes, not distributions): the CMS shape of 2026-10-21 (22 pages · 17 collections ×
 * 1,000 rows) — each page a header, nested frames of Text · Button · TextField and two lists bound
 * to collections, a rule per button. The number is the largest page's `generateCodeView` (median of
 * 5 after a warm run); the tree's file list, once it exists (Phase 2), is timed beside it.
 */
const RUN = !!process.env.ADR296_BENCH;
const PAGES = 22;
const COLLECTIONS = 17;
const ROWS = 1000;
const SECTIONS = Number(process.env.ADR296_SECTIONS ?? 12);

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe.runIf(RUN)("ADR-296 generation time (bench)", () => {
  it("the largest page of a 22-page CMS-shaped document", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const collectionId = (index: number) =>
      `data:collection:c${index}` as DataCollectionId;
    for (let c = 0; c < COLLECTIONS; c += 1)
      h.run(
        addCollection({
          entry: {
            kind: "collection",
            id: collectionId(c),
            name: `table${c}`,
            schema: [
              { id: `c${c}-id`, key: "id", type: "string" },
              { id: `c${c}-name`, key: "name", type: "string" },
              { id: `c${c}-age`, key: "age", type: "number" },
            ],
            mockData: Array.from({ length: ROWS }, (_, i) => ({
              id: `r${i}`,
              name: `Row ${i}`,
              age: i % 90,
            })),
            useMockData: true,
          },
        }),
      );
    const def = (type: string) => catalogPaletteDefinitionId(h.library, type);
    let serial = 0;
    const node = (
      type: string,
      children: NodeId[] = [],
      props: Record<string, unknown> = {},
    ): NodeEntry => ({
      kind: "node",
      id: `project:node:g${(serial += 1)}` as NodeId,
      definitionId: def(type),
      children,
      props: catalogCreationProps(h.library, def(type), type, props as never),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const pageIds: EntryId<"page">[] = [];
    const buttons: NodeId[] = [];
    for (let p = 0; p < PAGES; p += 1) {
      const entries: NodeEntry[] = [];
      const keep = (entry: NodeEntry) => (entries.push(entry), entry.id);
      const sections: NodeId[] = [];
      for (let s = 0; s < SECTIONS; s += 1) {
        const button = keep(node("Button", [], { label: `Go ${s}` }));
        buttons.push(button);
        const row = keep(
          node("frame", [
            keep(node("Text", [], { children: `Title ${p}.${s}` })),
            keep(node("TextField", [], { label: `Field ${s}` })),
            button,
          ]),
        );
        sections.push(keep(node("frame", [row])));
      }
      const listA = node("ListBox");
      const listB = node("GridList");
      for (const [list, c] of [
        [listA, (p * 2) % COLLECTIONS],
        [listB, (p * 2 + 1) % COLLECTIONS],
      ] as const)
        (list as { binding?: unknown }).binding = {
          collectionId: collectionId(c),
          fieldMap: { label: `data:field:c${c}-name` },
        };
      keep(listA);
      keep(listB);
      const body = {
        ...node("frame", []),
        definitionId: "lib:definition:type-body",
        props: {},
      } as NodeEntry;
      (body as unknown as { children: NodeId[] }).children = [
        keep(node("Heading", [], { children: `Page ${p}` })),
        ...sections,
        listA.id,
        listB.id,
      ];
      const pageId = `project:page:p${p}` as EntryId<"page">;
      pageIds.push(pageId);
      h.run(
        createPage({
          page: {
            kind: "page",
            id: pageId,
            route: `/p${p}`,
            name: `Page ${p}`,
            children: [body.id],
          },
          entries: [...entries, body],
        }),
      );
    }
    for (const button of buttons)
      h.run(
        setNodeInteractions({
          ownerId: button,
          entries: [
            {
              kind: "interaction",
              id: h.workspace.newId("interaction") as EntryId<"interaction">,
              ownerId: button,
              trigger: "onPress",
              actions: [{ opcode: "toast", message: "go" }],
            } as InteractionEntry,
          ],
          label: "Rule",
        }),
      );
    const reader = h.graph();
    const data = catalogCodeViewData(reader);
    const time = (pageId: EntryId<"page">) => {
      const start = performance.now();
      const result = generateCodeView({ reader, pageId, ...data });
      return { ms: performance.now() - start, bytes: result.code.length };
    };
    for (const pageId of pageIds) time(pageId); // warm
    const pages = pageIds.map((pageId) => {
      const runs = Array.from({ length: 5 }, () => time(pageId));
      return {
        pageId,
        ms: median(runs.map((run) => run.ms)),
        bytes: runs[0]!.bytes,
      };
    });
    const largest = pages.reduce((a, b) => (b.bytes > a.bytes ? b : a));
    const slowest = pages.reduce((a, b) => (b.ms > a.ms ? b : a));
    const result = {
      document: {
        pages: PAGES,
        nodesPerPage: SECTIONS * 6 + 4,
        collections: COLLECTIONS,
        rows: ROWS,
        rules: buttons.length,
      },
      largest,
      slowest,
      medianOfPages: median(pages.map((page) => page.ms)),
      node: process.version,
    };
    console.log(JSON.stringify(result, null, 2));
    if (process.env.ADR296_OUT)
      writeFileSync(process.env.ADR296_OUT, JSON.stringify(result, null, 2));
  }, 120_000);
});
