import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createPencilFixtureLibrary } from "../../../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import { applyTextRunMarks } from "../../../../../../packages/shared/src/catalog/document/textRuns";
import type {
  CatalogDocument,
  NodeEntry,
  RichText,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import { catalogTextOf } from "../canvasText";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { alignTextRuns } from "../../workspace/canvas/utils/textRunAlign";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspace } from "../workspace";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * ADR-299 Phase 1 — a record of range-formatted text: `props.children` is the plain text (every
 * reader that does `String(children)` keeps working), `textRuns` the runs it draws (templates
 * resolved per run, marks kept), `templateProps` the written runs. A mark-only change is a changed
 * record.
 */
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const BOLD = { fontWeight: 700 } as const;

async function scene(
  children: RichText | string,
  textPatch: Partial<NodeEntry> = {},
  frameVisual?: NodeEntry["visual"],
) {
  const projectId = "project:project:adr299" as const;
  const text: NodeEntry = {
    kind: "node",
    id: "project:node:t",
    definitionId: "lib:definition:text",
    children: [],
    props: { children: set(children) },
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...textPatch,
  };
  const frame: NodeEntry | undefined = frameVisual
    ? {
        kind: "node",
        id: "project:node:f",
        definitionId: "lib:definition:frame",
        children: [text.id],
        props: {},
        visual: frameVisual,
        sizing: {},
        descendantOverrides: [],
      }
    : undefined;
  const variable: StateVariableEntry = {
    kind: "stateVariable",
    id: "project:stateVariable:name" as StateVariableEntry["id"],
    ownerId: "project:page:main" as StateVariableEntry["ownerId"],
    name: "userName",
    valueType: "string",
    defaultValue: "guest",
  };
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 56,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "adr299",
        pageIds: ["project:page:main"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [variable.id],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:main": {
        kind: "page",
        id: "project:page:main",
        name: "Main",
        route: "/",
        children: [frame?.id ?? text.id],
      },
      ...(frame ? { [frame.id]: frame } : {}),
      [text.id]: text,
      [variable.id]: variable,
    },
  };
  const graph = new CatalogGraph(document, createPencilFixtureLibrary());
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr299-${Math.random()}`),
  );
  const root = new CatalogCompositionRoot(runtime, await nodeLayoutEngine(), {
    width: 800,
    height: 600,
  });
  const record = () =>
    [...root.canvasInputs.values()].find((item) => item.sourceId === text.id)!;
  return { root, runtime, record, frame };
}

describe("ADR-299 Phase 1 record of range-formatted text", () => {
  it("plain children · resolved runs · written runs", async () => {
    const value = applyTextRunMarks(
      "Hello {{ userName }}!",
      8,
      12,
      BOLD,
    ) as RichText;
    const { record } = await scene(value);
    expect(record().props.children).toBe("Hello guest!");
    expect(record().textRuns).toEqual([
      { text: "Hello " },
      { text: "guest", marks: BOLD },
      { text: "!" },
    ]);
    expect(record().templateProps?.children).toEqual(value);
    // The inline editor (textarea until Phase 3) edits the written text as plain.
    expect(catalogTextOf(record(), "children")).toBe("Hello {{ userName }}!");
  });

  it("a text without templates still splits; a plain string has no runs", async () => {
    const value = applyTextRunMarks("ab", 0, 1, BOLD) as RichText;
    expect((await scene(value)).record()).toMatchObject({
      props: { children: "ab" },
      textRuns: [{ text: "a", marks: BOLD }, { text: "b" }],
    });
    const plain = (await scene("ab")).record();
    expect(plain.props.children).toBe("ab");
    expect(plain.textRuns).toBeUndefined();
  });

  it("a mark-only edit reaches the record (same plain text)", async () => {
    const { root, runtime, record } = await scene(
      applyTextRunMarks("ab", 0, 1, BOLD) as RichText,
    );
    const before = record();
    root.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:t" as never }],
        props: {
          children: set(applyTextRunMarks("ab", 0, 1, { color: "#ff0000" })),
        },
      }),
    );
    expect(runtime.graph.revision).toBeGreaterThan(0);
    expect(record()).not.toBe(before);
    expect(record().props.children).toBe("ab");
    expect(record().textRuns).toEqual([
      { text: "a", marks: { color: "#ff0000" } },
      { text: "b" },
    ]);
  });
});

describe("ADR-299 — a text written back to a string drops its runs (live 2026-11-02 ⌘Z)", () => {
  it("the incremental rebuild does not keep the old record's runs", async () => {
    const { root, record } = await scene(
      applyTextRunMarks("Text", 3, 4, { fontWeight: 700 }) as RichText,
    );
    expect(record().textRuns).toHaveLength(2);
    root.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:t" as never }],
        props: { children: set("Text") },
      }),
    );
    expect(record().props.children).toBe("Text");
    expect(record().textRuns).toBeUndefined();
  });
});

describe("ADR-299 Phase 2 consumers", () => {
  it("aligns runs through folded white space and inserted break hints", () => {
    const runs = [
      { start: 0, end: 3, tag: "a" },
      { start: 3, end: 9, tag: "b" },
    ];
    // "ab \n  c d" → folded "ab c d"
    expect(alignTextRuns("ab \n  c d", runs, "ab c d")).toEqual([
      { start: 0, end: 3, tag: "a" },
      { start: 3, end: 6, tag: "b" },
    ]);
    // a hint replacing a space, and a zero-width break inserted
    expect(alignTextRuns("ab cd", runs, "ab\ncd")).toEqual([
      { start: 0, end: 3, tag: "a" },
      { start: 3, end: 5, tag: "b" },
    ]);
    expect(
      alignTextRuns(
        "abcd",
        [
          { start: 0, end: 2, tag: "a" },
          { start: 2, end: 4, tag: "b" },
        ],
        "a\u200Bb\u200Bc\u200Bd",
      ),
    ).toEqual([
      { start: 0, end: 4, tag: "a" },
      { start: 4, end: 7, tag: "b" },
    ]);
  });

  it("the DOM writes a span per run (marks only) and moves the node's decoration onto them", async () => {
    const value = applyTextRunMarks(
      applyTextRunMarks("Hello world", 6, 11, {
        fontWeight: 700,
        color: "#ff0000",
      }) as RichText,
      0,
      5,
      { textDecoration: "none" },
    ) as RichText;
    const { root, record } = await scene(value, {
      visual: { textDecoration: set("underline") },
    });
    const host = document.createElement("div");
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(renderCatalogDom(root, record().id)),
    );
    const element = host.querySelector<HTMLElement>(
      `[data-catalog-id="${record().id}"]`,
    )!;
    expect(element.textContent).toBe("Hello world");
    expect(element.style.textDecoration).toBe("");
    const spans = [...element.querySelectorAll<HTMLElement>("[data-text-run]")];
    expect(spans.map((span) => span.textContent)).toEqual([
      "Hello",
      " ",
      "world",
    ]);
    expect(spans.map((span) => span.style.textDecoration)).toEqual([
      "none",
      "underline",
      "underline",
    ]);
    expect(spans[2]!.style.fontWeight).toBe("700");
    expect(spans[2]!.style.color).toBe("rgb(255, 0, 0)");
    expect(spans[0]!.style.fontWeight).toBe("");
    expect(element.querySelector("strong, em")).toBeNull();
    await act(async () => reactRoot.unmount());
  });

  it("the Canvas text carries the runs (own decoration on each run) and the inherited line", async () => {
    const value = applyTextRunMarks("ab", 1, 2, {
      fontSize: 24,
      textDecoration: "none",
    }) as RichText;
    const { root, record, frame } = await scene(
      value,
      {},
      { textDecoration: set("underline"), color: set("#0000ff") },
    );
    const frameRecord = [...root.canvasInputs.values()].find(
      (item) => item.sourceId === frame!.id,
    )!;
    const canvas = bindCatalogCanvas(root, [frameRecord.id]);
    const text = getSkiaNode(record().id)!.text!;
    expect(text.content).toBe("ab");
    expect(text.decoration).toBeUndefined();
    expect(text.runs).toMatchObject([
      { start: 0, end: 1 },
      { start: 1, end: 2, fontSize: 24, decoration: 0 },
    ]);
    // (The inherited line is the element's — drawn in the text's own color and size, as the DOM
    //  writes it on the text element, ADR-299 Phase 2 실측.)
    expect(text.ancestorDecoration).toEqual({ decoration: 1 });
    canvas.dispose();
  });

  it("a plain text keeps its one-style Canvas data (no runs)", async () => {
    const { root, record } = await scene("ab", {
      visual: { textDecoration: set("underline") },
    });
    const canvas = bindCatalogCanvas(root, [record().id]);
    const text = getSkiaNode(record().id)!.text!;
    expect(text.runs).toBeUndefined();
    expect(text.decoration).toBe(1);
    canvas.dispose();
  });
});

describe("ADR-299 사용자 결정 3 — the panel writing a range-formatted text as a whole", () => {
  it("sets the node's value and clears that axis from the runs (one step); other axes stay", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:adr299-mixed" as const,
          name: "Mixed",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr299-mixed-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const value = applyTextRunMarks(
      applyTextRunMarks("Hello world", 0, 5, { fontWeight: 700 }) as RichText,
      6,
      11,
      { color: "#ff0000" },
    ) as RichText;
    const id = "project:node:mixed-text";
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as never },
        entries: [
          {
            kind: "node",
            id,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: set(value) },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id as never],
        newId: workspace.newId,
      }),
    );
    const [record] = workspace.root.recordsOfSource(id);
    workspace.selectRecords([record!]);
    const host = createCatalogStylesHost(workspace);
    const depth = workspace.runtime.historyDepth.undo;
    host.updateStyle("fontWeight", "300");
    const node = workspace.runtime.graph.getEntry(id) as NodeEntry;
    expect(node.visual.fontWeight).toEqual(set(300));
    expect(node.props.children).toEqual(
      set({
        kind: "text",
        runs: [
          { text: "Hello " },
          { text: "world", marks: { color: "#ff0000" } },
        ],
      }),
    );
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
  });

  it("the Typography reset takes the runs' values back too: the text is a plain string again", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:adr299-reset" as const,
          name: "Reset",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr299-reset-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const value = applyTextRunMarks("Hello world", 6, 11, {
      color: "#ff0000",
      fontWeight: 700,
    }) as RichText;
    const id = "project:node:reset-text";
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as never },
        entries: [
          {
            kind: "node",
            id,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: set(value) },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id as never],
        newId: workspace.newId,
      }),
    );
    const [record] = workspace.root.recordsOfSource(id);
    workspace.selectRecords([record!]);
    const host = createCatalogStylesHost(workspace);
    // Only the runs carry the axes (the node has no own value) — the reset still takes them.
    host.resetStyles(["color", "fontWeight", "fontSize"]);
    const node = workspace.runtime.graph.getEntry(id) as NodeEntry;
    expect(node.props.children).toEqual(set("Hello world"));
    expect(workspace.root.domInputs.get(record!)?.textRuns).toBeUndefined();
  });
});
