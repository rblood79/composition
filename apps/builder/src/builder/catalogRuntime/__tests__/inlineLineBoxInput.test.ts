import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import {
  CatalogCompositionRoot,
  type CatalogConsumerNode,
  type CatalogTextMeasure,
} from "../compositionRoot";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * A block box's line: Chrome sets an inline-level box on its parent's line box by its first-line
 * baseline (CSS 2.1 §10.8.1), the line holds the parent's strut, and `vertical-align: middle`
 * centres on the baseline + half the parent's x-height. The engine has those inputs
 * (`leafBaseline` · `strutBaseline` · `strutXHeight` · `verticalAlign`); the catalog composition
 * root must send them — without them a Badge beside a Button sat on its bottom edge, 3.75px under
 * the Preview (2026-11-02, Compare Mode: Canvas y 28 / CSS 24.25).
 */
class InputEngine implements LayoutEngineAPI {
  private next = 1;
  isAvailable() {
    return true;
  }
  hasBinaryProtocol() {
    return false;
  }
  buildTreeBatch(json: string) {
    return (JSON.parse(json) as unknown[]).map(() => this.next++);
  }
  buildTreeBatchBinary(): number[] {
    throw new Error("not used");
  }
  createNodeRaw() {
    return this.next++;
  }
  updateStyleRaw() {}
  setChildren() {}
  markDirty() {}
  removeNode() {}
  setViewport() {}
  computeLayout() {}
  getLayoutsBatch() {
    return new Map();
  }
  clear() {}
  nodeCount() {
    return this.next - 1;
  }
}

/** Pretendard-like font box: ascent 0.952 · descent 0.241 · x-height 0.53 of the size. */
const measure: CatalogTextMeasure = Object.assign(
  (text: string, font: { fontSize: number; lineHeight: number }) => {
    const width = text.length * font.fontSize * 0.5;
    const height =
      font.lineHeight > 0 ? font.fontSize * font.lineHeight : font.fontSize;
    return { width, exactWidth: width, minWidth: width, height };
  },
  {
    fontBox: (font: { fontSize: number }) => ({
      ascent: font.fontSize * 0.952,
      descent: font.fontSize * 0.241,
      xHeight: font.fontSize * 0.53,
    }),
  },
);

const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  type: string,
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: catalogTypeDefinitionId(type) as DefinitionId,
  children: [],
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function scene(
  withFontBox: boolean,
  structure: { nodes: NodeEntry[]; parts: NodeEntry[] } = {
    nodes: [
      {
        ...node("button", "Button"),
        children: [id("button-label")],
      },
      node("badge", "Badge", { children: { kind: "set", value: "Badge" } }),
    ],
    parts: [
      node("button-label", "Text", {
        children: { kind: "set", value: "Button" },
      }),
    ],
  },
) {
  const library = await buildCodeCatalogLibrary();
  const projectId = "project:project:line-box" as const;
  const pageId = "project:page:main" as const;
  const { nodes, parts } = structure;
  // A page's content sits in its body node (`createPage` — a block box).
  const body: NodeEntry = {
    ...node("body", "body"),
    children: nodes.map((entry) => entry.id),
  };
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 58,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "line-box",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [body.id],
      },
      ...Object.fromEntries(
        [body, ...nodes, ...parts].map((entry) => [entry.id, entry]),
      ),
    },
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `line-box-${withFontBox}-${nodes.length}`),
  );
  const root = new CatalogCompositionRoot(
    runtime,
    new InputEngine(),
    { width: 1440, height: 900 },
    undefined,
    undefined,
    withFontBox
      ? measure
      : (((text: string, font: { fontSize: number; lineHeight: number }) =>
          measure(text, font as never)) as CatalogTextMeasure),
  );
  const typeOf = (record: CatalogConsumerNode) =>
    record.ruleId ??
    runtime.graph.getDefinition(record.definitionId as DefinitionId)?.name ??
    "";
  const records = [...root.canvasInputs.values()];
  const inputOf = (record: CatalogConsumerNode) =>
    JSON.parse(root.getAppliedLayoutInput(record.id) ?? "{}") as Record<
      string,
      unknown
    >;
  const ofType = (type: string) =>
    records.filter((record) => typeOf(record) === type);
  const recordOf = (sourceId: NodeId) =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === sourceId,
    );
  return { root, records, inputOf, ofType, typeOf, recordOf };
}

describe("inline line box inputs — baseline · strut · middle", () => {
  it("a Badge's text sends its first-line baseline (rounded ascent + half the leading)", async () => {
    const { ofType, inputOf } = await scene(true);
    const [badge] = ofType("Badge");
    expect(badge).toBeDefined();
    const input = inputOf(badge!);
    const size = Number(badge!.visual.fontSize);
    const lineHeight = size * Number(badge!.visual.lineHeight);
    const ascent = Math.round(size * 0.952);
    const descent = Math.round(size * 0.241);
    expect(input.leafBaseline).toBe(
      Math.floor(ascent + (lineHeight - ascent - descent) / 2),
    );
  });

  it("the page body sends its strut: 16px · line height 24 → baseline 17 · x-height 8.48", async () => {
    const { ofType, inputOf } = await scene(true);
    const [body] = ofType("body");
    expect(body).toBeDefined();
    expect(inputOf(body!)).toMatchObject({
      lineHeight: 24,
      strutBaseline: 17,
      strutXHeight: 16 * 0.53,
    });
  });

  it("a Button sends vertical-align: middle (the rule's root box — the generated sheet's value)", async () => {
    const { ofType, inputOf } = await scene(true);
    const [button] = ofType("Button");
    expect(button).toBeDefined();
    expect(inputOf(button!).verticalAlign).toBe("middle");
  });

  it("without a font box the inputs stay absent (the engine's fallbacks)", async () => {
    const { ofType, inputOf } = await scene(false);
    expect(inputOf(ofType("Badge")[0]!).leafBaseline).toBeUndefined();
    expect(inputOf(ofType("body")[0]!).strutBaseline).toBeUndefined();
  });
});

describe("strut font — inherited like CSS font-size", () => {
  // body > outer frame (font-size 24) > inner frame (no size) > Badge: the inner frame's line box
  // holds a 24px strut — CSS font-size is inherited — at the root's 1.5 → 36.
  const nested = () => ({
    nodes: [
      {
        ...node("outer", "frame"),
        visual: { fontSize: { kind: "set" as const, value: 24 } },
        children: [id("inner")],
      },
    ],
    parts: [
      { ...node("inner", "frame"), children: [id("badge")] },
      node("badge", "Badge", { children: { kind: "set", value: "Badge" } }),
    ],
  });

  it("a box without its own font size uses its nearest ancestor's", async () => {
    const { inputOf, recordOf } = await scene(true, nested());
    expect(inputOf(recordOf(id("inner"))!)).toMatchObject({
      lineHeight: 36,
      strutBaseline: Math.floor(
        Math.round(24 * 0.952) +
          (36 - Math.round(24 * 0.952) - Math.round(24 * 0.241)) / 2,
      ),
      strutXHeight: 24 * 0.53,
    });
  });

  it("an ancestor's font size change reaches the descendant's strut", async () => {
    const { root, inputOf, recordOf } = await scene(true, nested());
    root.execute(
      setFields({
        targets: [{ kind: "node", id: id("outer") }],
        visual: { fontSize: { kind: "set", value: 20 } },
      }),
    );
    expect(inputOf(recordOf(id("inner"))!).lineHeight).toBe(30);
  });
});

describe("ADR299 first line review", () => {
  it("a larger second line does not change first-line baseline", async () => {
    const text = node("text", "Text", {
      children: {
        kind: "set",
        value: {
          kind: "text",
          runs: [
            { text: "first\n" },
            { text: "second", marks: { fontSize: 48 } },
          ],
        },
      },
    });
    text.visual = {
      fontSize: { kind: "set", value: 16 },
      lineHeight: { kind: "set", value: 1.5 },
      whiteSpace: { kind: "set", value: "pre-wrap" },
    };
    const s = await scene(true, { nodes: [text], parts: [] });
    const record = s.recordOf(text.id)!;
    const input = s.inputOf(record);
    expect(input.leafBaseline).toBe(17);
  });
});
