import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import {
  docCounters,
  resetDocCounters,
  snapshotDocCounters,
} from "../../../../../../packages/shared/src/catalog/docCounters";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { applyTextRunMarks } from "../../../../../../packages/shared/src/catalog/document/textRuns";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogCanvasNodeData } from "../canvasBinding";
import {
  catalogAuthoredVisual,
  catalogDerivedConditionalVisual,
  catalogLibraryVisual,
  catalogWithoutPaintMemo,
} from "../libraryVisual";
import { CatalogCanvasScene } from "../canvasScene";
import type {
  CatalogCompositionRoot,
  CatalogTextMeasure,
} from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-319 Phase 0 — the Canvas size preview's cost and its independent oracles, at HEAD (before
 * any memo · batching · paragraph reuse).
 *
 * - Counts (measurement-validity §5): one drag of a Frame holding N wrapping texts — the paint
 *   resolution (`catalogLibraryVisual` · `paintedNodeData`), the engine rect reads (wasm calls ·
 *   handles), the applied style parses, the measure cache's key serializations and source calls.
 *   Fixed here as the RED the later phases lower (G1 · G2 · G3).
 * - Paint oracle: every registered `SkiaNodeData` = `catalogCanvasNodeData` (the paint computed
 *   again, outside the binding's update — Phase 1 makes it bypass the memo). A changed background
 *   it must tell apart (the review's F8a: the command signature does not).
 * - Line oracle: the wrapped heights · first baselines · rects of every text at each step, against
 *   the values this code gives (the snapshot) — a parent's line height previewed and put back,
 *   several virtual grids, a calendar, a RichText, a text kept on one line.
 */
const BODY = "project:node:home-body" as NodeId;
const WRAP = "project:node:wrap" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const words = [
  "주간",
  "매출은",
  "모든",
  "지역에서",
  "증가했다",
  "Weekly",
  "revenue",
  "increased",
  "in",
  "every",
  "region",
  "order",
  "status",
  "shipped",
  "데이터",
  "목록",
  "검색",
];
const sentence = (seed: number, length: number) =>
  Array.from(
    { length },
    (_, i) => words[(seed * 7 + i * 3) % words.length],
  ).join(" ");

/**
 * A deterministic stand-in for the CanvasKit measure: half an em per character, lines broken
 * greedily between words (CSS `overflow-wrap: normal` — a long word overflows on its own line).
 */
const measure: CatalogTextMeasure = (text, font, maxWidth) => {
  const unit = font.fontSize * 0.5;
  const lineHeight =
    font.fontSize * (font.lineHeight > 0 ? font.lineHeight : 1.2);
  const parts = text.split(/\s+/).filter(Boolean);
  const exact = text.length * unit;
  const min = Math.max(0, ...parts.map((part) => part.length * unit));
  const firstBaseline = lineHeight * 0.75;
  if (maxWidth === undefined)
    return {
      width: Math.ceil(exact),
      exactWidth: exact,
      minWidth: min,
      height: lineHeight,
      firstBaseline,
    };
  let lines = 1;
  let used = 0;
  for (const part of parts) {
    const width = part.length * unit;
    if (used > 0 && used + unit + width > maxWidth) {
      lines += 1;
      used = width;
    } else used += (used > 0 ? unit : 0) + width;
  }
  return { width: maxWidth, height: lines * lineHeight, firstBaseline };
};

const textEntry = (
  id: NodeId,
  children: unknown,
  extra: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: set(children) },
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as unknown as NodeEntry;

async function open(
  entries: NodeEntry[],
  wrapChildren: NodeId[],
  wrap: Partial<NodeEntry> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr319" as EntryId<"project">,
        name: "ADR-319",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr319-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1600, height: 1200 },
      autosaveSchedule: () => {},
      textMeasure: measure,
      locale: "en-US",
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: WRAP,
          definitionId: "lib:definition:type-frame",
          children: wrapChildren,
          props: {},
          visual: {},
          sizing: { width: set(600) },
          descendantOverrides: [],
          ...wrap,
        } as unknown as NodeEntry,
        ...entries,
      ],
      rootIds: [WRAP],
      newId: workspace.newId,
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  scene.sync();
  return { workspace, library, scene };
}

const recordOf = (root: CatalogCompositionRoot, source: NodeId) =>
  root.recordsOfSource(source)[0]!;
/** The records under `id` (itself included). */
const subtree = (root: CatalogCompositionRoot, id: string): string[] => [
  id,
  ...(root.canvasInputs.get(id)?.children ?? []).flatMap((child) =>
    subtree(root, child),
  ),
];
const round = (value: number | undefined) =>
  value === undefined ? undefined : Math.round(value * 100) / 100;
/** Every text leaf's wrap height · first baseline · rect under the Frame. */
function lineState(root: CatalogCompositionRoot) {
  const wraps = root as unknown as {
    wrapHeights: Map<string, number>;
    wrapBaselines: Map<string, number>;
  };
  const ids = subtree(root, recordOf(root, WRAP));
  const geometry = root.getGeometry(ids);
  return ids.map((id) => {
    const rect = geometry.get(id);
    return [
      root.typeOf(root.canvasInputs.get(id)!),
      round(wraps.wrapHeights.get(id)),
      round(wraps.wrapBaselines.get(id)),
      rect && [rect.x, rect.y, rect.width, rect.height].map(round).join(","),
    ].join("|");
  });
}
/** Registered paint = the paint computed again outside the update, for every record under the Frame. */
function paintMismatches(root: CatalogCompositionRoot): string[] {
  const out: string[] = [];
  for (const id of subtree(root, recordOf(root, WRAP))) {
    const registered = getSkiaNode(id);
    if (!registered) continue;
    try {
      expect(registered).toEqual(catalogCanvasNodeData(root, id));
    } catch {
      out.push(id);
    }
  }
  return out;
}

const DRAG = [560, 520, 480, 440, 480, 520, 560, 600, 640, 600];
function drag(
  workspace: CatalogWorkspace,
  scene: CatalogCanvasScene,
  check?: () => void,
) {
  const frame = recordOf(workspace.root, WRAP);
  for (const width of DRAG) {
    workspace.root.previewRecord(frame, { sizing: { width } });
    scene.sync();
    check?.();
  }
  workspace.root.previewRecord(frame);
  scene.sync();
  check?.();
}

let env: string | undefined;
beforeEach(() => {
  env = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
});
afterEach(() => {
  process.env.NODE_ENV = env;
});

const N = 60;
const texts = (distinct: boolean) =>
  Array.from({ length: N }, (_, i) =>
    textEntry(
      `project:node:t${i}` as NodeId,
      distinct ? `${i} ${sentence(i, 24)}` : sentence(1, 24),
    ),
  );

describe("ADR-319 Phase 0 — one drag's counts (RED the later phases lower)", () => {
  const PICKED = [
    "libraryVisualCalls",
    "paintedNodeCalls",
    "layoutQueryCalls",
    "layoutQueryHandles",
    "appliedStyleParses",
    "measureKeySerializations",
    "measureSourceCalls",
  ] as const;
  /** One drag's counts on a fresh workspace (its measure cache cold). */
  async function countDrag(distinct: boolean) {
    const entries = texts(distinct);
    const { workspace, scene } = await open(
      entries,
      entries.map((entry) => entry.id),
    );
    resetDocCounters();
    drag(workspace, scene);
    const counts = snapshotDocCounters();
    scene.dispose();
    workspace.dispose();
    return Object.fromEntries(PICKED.map((key) => [key, counts[key]]));
  }
  /**
   * HEAD `c0d76012d` (before ADR-319 — counters only) and the ceilings after Phases 1 · 2: the
   * pre-change code exceeds every lowered ceiling (RED). `paintedNodeCalls` · `layoutQueryHandles`
   * · `measureSourceCalls` stay: every moved box registers again, each candidate's rect is read
   * once, a new width measures anew (Phase 3 makes that source call lay out a held paragraph).
   */
  const BEFORE = {
    same: {
      appliedStyleParses: 682,
      layoutQueryCalls: 702,
      layoutQueryHandles: 1292,
      libraryVisualCalls: 2465,
      measureKeySerializations: 1440,
      measureSourceCalls: 5,
      paintedNodeCalls: 613,
    },
    distinct: {
      appliedStyleParses: 682,
      layoutQueryCalls: 702,
      layoutQueryHandles: 1292,
      libraryVisualCalls: 2475,
      measureKeySerializations: 1440,
      measureSourceCalls: 300,
      paintedNodeCalls: 615,
    },
  };
  const CEILING = {
    same: {
      ...BEFORE.same,
      appliedStyleParses: 190,
      layoutQueryCalls: 53,
      libraryVisualCalls: 30,
      measureKeySerializations: 120,
    },
    distinct: {
      ...BEFORE.distinct,
      appliedStyleParses: 190,
      layoutQueryCalls: 53,
      libraryVisualCalls: 30,
      measureKeySerializations: 120,
    },
  };
  for (const distinct of [false, true])
    it(`${N} ${distinct ? "distinct" : "same"} texts, ${DRAG.length} widths + release`, async () => {
      const picked = await countDrag(distinct);
      // (A second fresh workspace gives the same counts — grade A.)
      expect(await countDrag(distinct)).toEqual(picked);
      const kind = distinct ? "distinct" : "same";
      for (const [key, ceiling] of Object.entries(CEILING[kind]))
        expect([key, picked[key]! <= ceiling]).toEqual([key, true]);
      // (Lowered where the phases cut: paint resolution · rect reads · parses · key serializations.)
      expect(picked.libraryVisualCalls! * 10).toBeLessThan(
        BEFORE[kind].libraryVisualCalls,
      );
      expect(picked.layoutQueryCalls! * 10).toBeLessThan(
        BEFORE[kind].layoutQueryCalls,
      );
    });
  it("the counters are dev-only: NODE_ENV production counts nothing", async () => {
    const entries = texts(true).slice(0, 4);
    const { workspace, scene } = await open(
      entries,
      entries.map((entry) => entry.id),
    );
    process.env.NODE_ENV = "production";
    resetDocCounters();
    drag(workspace, scene);
    expect(docCounters.paintedNodeCalls + docCounters.layoutQueryCalls).toBe(0);
    scene.dispose();
    workspace.dispose();
  });
});

describe("ADR-319 Phase 0 — paint oracle (registered = computed again)", () => {
  it("holds at every drag step, and tells a changed background apart", async () => {
    const entries = texts(true).slice(0, 12);
    const { workspace, scene } = await open(
      entries,
      entries.map((entry) => entry.id),
    );
    const root = workspace.root;
    expect(paintMismatches(root)).toEqual([]);
    drag(workspace, scene, () =>
      expect(paintMismatches(workspace.root)).toEqual([]),
    );
    // The comparison sees a paint value (the signature of F8a does not): a background preview.
    const frame = recordOf(root, WRAP);
    const before = catalogCanvasNodeData(root, frame);
    root.previewRecord(frame, { visual: { backgroundColor: "#ff0000" } });
    scene.sync();
    expect(paintMismatches(root)).toEqual([]);
    expect(catalogCanvasNodeData(root, frame)).not.toEqual(before);
    expect(getSkiaNode(frame)).not.toEqual(before);
    root.previewRecord(frame);
    scene.sync();
    expect(getSkiaNode(frame)).toEqual(before);
    scene.dispose();
    workspace.dispose();
  });
});

describe("ADR-319 Phase 0 — line oracle (the values this code gives)", () => {
  it("texts · a parent's line height previewed and put back · RichText · one-line text", async () => {
    const runs = applyTextRunMarks(sentence(3, 20), 4, 16, {
      fontWeight: 700,
      fontSize: 28,
    });
    const entries = [
      ...texts(true).slice(0, 6),
      textEntry("project:node:rich" as NodeId, runs),
      textEntry("project:node:nowrap" as NodeId, sentence(5, 30), {
        visual: { whiteSpace: set("nowrap") },
      } as Partial<NodeEntry>),
    ];
    const { workspace, scene } = await open(
      entries,
      entries.map((entry) => entry.id),
      {
        visual: { lineHeight: set(1.5) },
      } as Partial<NodeEntry>,
    );
    const root = workspace.root;
    const frame = recordOf(root, WRAP);
    const trace: string[][] = [lineState(root)];
    drag(workspace, scene, () => trace.push(lineState(workspace.root)));
    // The parent's line height (an ancestor input the texts' records do not carry — F4a).
    root.previewRecord(frame, { visual: { lineHeight: 3 } });
    scene.sync();
    trace.push(lineState(root));
    root.previewRecord(frame, {
      visual: { lineHeight: 3 },
      sizing: { width: 450 },
    });
    scene.sync();
    trace.push(lineState(root));
    root.previewRecord(frame);
    scene.sync();
    trace.push(lineState(root));
    expect(trace[trace.length - 1]).toEqual(trace[0]);
    expect(trace).toMatchSnapshot();
    scene.dispose();
    workspace.dispose();
  });
  it("several virtual grids and a calendar at the Frame's width", async () => {
    const library = await buildCodeCatalogLibrary();
    const grid = (id: string, type: "CardView" | "GridList") =>
      ({
        kind: "node",
        id: `project:node:${id}`,
        definitionId: catalogPaletteDefinitionId(library, type),
        children: [],
        props: type === "GridList" ? { layout: set("grid") } : {},
        visual: { width: set("100%") },
        sizing: { height: set(300) },
        descendantOverrides: [],
      }) as unknown as NodeEntry;
    const calendar = {
      kind: "node",
      id: "project:node:calendar",
      definitionId: catalogPaletteDefinitionId(library, "Calendar"),
      children: [],
      props: {},
      visual: { width: set("100%") },
      sizing: {},
      descendantOverrides: [],
    } as unknown as NodeEntry;
    const entries = [
      grid("g1", "CardView"),
      grid("g2", "GridList"),
      grid("g3", "CardView"),
      calendar,
    ];
    const { workspace, scene } = await open(
      entries,
      entries.map((entry) => entry.id as NodeId),
      {
        sizing: { width: set(900) },
      } as Partial<NodeEntry>,
    );
    for (const id of ["g1", "g2", "g3"])
      workspace.execute(
        setRowDisplay(`project:node:${id}` as NodeId, { mode: "virtual" }),
      );
    scene.sync();
    const trace: string[][] = [lineState(workspace.root)];
    resetDocCounters();
    const frame = recordOf(workspace.root, WRAP);
    for (const width of [880, 700, 520, 700, 900]) {
      workspace.root.previewRecord(frame, { sizing: { width } });
      scene.sync();
      trace.push(lineState(workspace.root));
    }
    const counts = snapshotDocCounters();
    workspace.root.previewRecord(frame);
    scene.sync();
    trace.push(lineState(workspace.root));
    expect(trace[trace.length - 1]).toEqual(trace[0]);
    expect(trace).toMatchSnapshot();
    // (The rect reads of these steps — G2: a segment per virtual grid (it lays out mid-loop), each
    //  candidate's rect once. HEAD read a rect per candidate: 350 calls, the same 1,435 handles —
    //  the handle total does not grow with the grids, K(K+1)/2 · review M2.)
    expect(counts.layoutQueryCalls).toBeLessThanOrEqual(225);
    expect(counts.layoutQueryHandles).toBeLessThanOrEqual(1435);
    scene.dispose();
    workspace.dispose();
  });
});

describe("ADR-319 G1 — the paint memo's key (memo = computed without it)", () => {
  it("an ancestor's previewed locale reaches a Label's locale line height (its record unchanged)", async () => {
    const label = {
      kind: "node",
      id: "project:node:label",
      definitionId: "lib:definition:origin-component-label",
      children: [],
      props: { children: set("이름 Name") },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    } as unknown as NodeEntry;
    const { workspace, scene } = await open([label], [label.id], {
      props: { locale: set("en-US") },
    } as Partial<NodeEntry>);
    const root = workspace.root;
    const frame = recordOf(root, WRAP);
    const record = () =>
      root.canvasInputs.get(recordOf(root, "project:node:label" as NodeId))!;
    const memo = () => ({
      library: catalogLibraryVisual(root, record()),
      authored: catalogAuthoredVisual(root, record()),
      derived: catalogDerivedConditionalVisual(root, record()),
    });
    const direct = () => catalogWithoutPaintMemo(memo);
    const english = memo();
    expect(english).toEqual(direct());
    const before = record();
    root.previewRecord(frame, { props: { locale: "ko-KR" } });
    scene.sync();
    // (The Label's record is the same object — only the frame's was replaced.)
    expect(record()).toBe(before);
    const korean = memo();
    expect(korean).toEqual(direct());
    expect(korean.library.lineHeight).toBe(1.5);
    expect(korean.library).not.toEqual(english.library);
    root.previewRecord(frame);
    scene.sync();
    expect(memo()).toEqual(direct());
    scene.dispose();
    workspace.dispose();
  });
  it("a document edit (revision) reads the definition again for a record it kept", async () => {
    const entries = texts(true).slice(0, 3);
    const { workspace, scene } = await open(
      entries,
      entries.map((entry) => entry.id),
    );
    const root = workspace.root;
    const kept = root.canvasInputs.get(recordOf(root, entries[0]!.id))!;
    const before = catalogLibraryVisual(root, kept);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: entries[1]!.id }],
        visual: { fontSize: set(30) },
      }),
    );
    scene.sync();
    // (Another record's edit: this one's values are read again under the new revision, equal.)
    expect(catalogLibraryVisual(root, kept)).toEqual(
      catalogWithoutPaintMemo(() => catalogLibraryVisual(root, kept)),
    );
    expect(catalogLibraryVisual(root, kept)).toEqual(before);
    scene.dispose();
    workspace.dispose();
  });
});
