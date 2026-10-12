import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「TagGroup 프로퍼티 Max Rows 도 정상동작 되지 않고 있다」 → 「Canvas 에도 접힘」):
 * the Canvas collapses a TagGroup's tags past its `maxRows` rows as the Preview does
 * (`useTagMaxRows` — rows counted with every tag laid out, the rest dropped) and lays a
 * "Show all (N)" box after the shown tags. The old TS layout did this (Step 4.5b, 2026-09-21); the
 * catalog runtime had lost it — the Canvas drew every tag.
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:tags" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
// Chocolate 89 · Mint 54 · Strawberry 96 · Vanilla 75 (text + padding 12×2 + border 1×2).
const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function open(maxRows: number, width: number, frames = 0) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tag-rows" as EntryId<"project">,
        name: "Tag rows",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tag-rows-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: GROUP,
          definitionId: "lib:definition:origin-component-taggroup",
          children: [],
          props: { maxRows: set(maxRows) },
          visual: { width: set(width) },
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  if (frames)
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: Array.from(
          { length: frames },
          (_, i) =>
            ({
              kind: "node",
              id: `project:node:frame-${i}` as NodeId,
              definitionId: "lib:definition:type-frame",
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            }) as NodeEntry,
        ),
        rootIds: Array.from(
          { length: frames },
          (_, i) => `project:node:frame-${i}` as NodeId,
        ),
        newId: workspace.newId,
      }),
    );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const target = (id: string) => workspace.positionOfRecord(id)!.target;
  const view = () => {
    const list = of("TagList")[0]!;
    const tags = of("Tag");
    const showAll = root.tagShowAllInputs.get(list.id);
    const rects = root.getGeometry([
      list.id,
      ...tags.map((tag) => tag.id),
      ...(showAll ? [showAll.id] : []),
    ]);
    return {
      shown: tags
        .filter((tag) => !root.tagRowCollapsed(tag.id))
        .map((tag) => rects.get(tag.id)!.y),
      collapsed: tags.filter((tag) => root.tagRowCollapsed(tag.id)).length,
      showAll: showAll && {
        text: showAll.text,
        y: rects.get(showAll.id)!.y,
        height: rects.get(showAll.id)!.height,
      },
      listHeight: rects.get(list.id)!.height,
    };
  };
  const edit = (
    props: Record<string, number>,
    visual?: Record<string, number>,
  ) =>
    workspace.execute(
      setFields({
        targets: [target(of("TagGroup")[0]!.id)],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
        ...(visual
          ? {
              visual: Object.fromEntries(
                Object.entries(visual).map(([key, value]) => [key, set(value)]),
              ),
            }
          : {}),
      }),
    );
  return { root, view, edit, of, workspace, target };
}

describe("TagGroup maxRows — the Canvas collapses as the Preview", () => {
  it("width 140 (one tag a row), maxRows 2: two tags, then Show all (4) on the next row", async () => {
    const { view } = await open(2, 140);
    const state = view();
    expect(state.shown).toEqual([0, 34]);
    expect(state.collapsed).toBe(2);
    expect(state.showAll).toEqual({ text: "Show all (4)", y: 68, height: 30 });
    // (Two tag rows and the Show all row — no room for the dropped tags.)
    expect(state.listHeight).toBe(98);
  });

  it("width 300 (three, then one), maxRows 1: three tags and Show all; maxRows 2 shows every tag", async () => {
    const { view, edit } = await open(1, 300);
    expect(view().shown).toEqual([0, 0, 0]);
    expect(view().showAll?.text).toBe("Show all (4)");
    // An edit re-counts: two rows fit every tag — no Show all.
    edit({ maxRows: 2 });
    expect(view()).toMatchObject({
      shown: [0, 0, 0, 34],
      collapsed: 0,
      showAll: undefined,
      listHeight: 64,
    });
    // Narrower: a row per tag again — two shown and Show all.
    edit({}, { width: 140 });
    expect(view()).toMatchObject({ shown: [0, 34], collapsed: 2 });
  });

  it("maxRows 0 shows every tag", async () => {
    const { view } = await open(0, 140);
    expect(view()).toMatchObject({
      shown: [0, 34, 68, 102],
      collapsed: 0,
      showAll: undefined,
    });
  });
});

describe("TagGroup maxRows — the collapse reads only the TagLists", () => {
  // 2026-10-12 (ratchet `seeds.60.edit` typeOf 1,053 → 2,620): the collapse ran after every layout
  // over every record (a `typeOf` each) — a cost of the document's size on every edit, TagGroup or
  // not. It reads a TagList index now.
  it("an edit's typeOf calls do not grow with the document", async () => {
    const calls = async (frames: number) => {
      const { root, workspace, of, target } = await open(1, 300, frames);
      const group = target(of("TagGroup")[0]!.id);
      const spy = vi.spyOn(root, "typeOf");
      workspace.execute(
        setFields({ targets: [group], props: { maxRows: set(2) } }),
      );
      const n = spy.mock.calls.length;
      spy.mockRestore();
      return n;
    };
    expect(await calls(40)).toBe(await calls(5));
  });

  it("a removed and restored TagGroup (undo · redo) leaves and rejoins the collapse", async () => {
    const { view, workspace, of } = await open(1, 300);
    expect(view().showAll?.text).toBe("Show all (4)");
    workspace.undo();
    expect(of("TagList")).toHaveLength(0);
    workspace.redo();
    expect(view()).toMatchObject({ shown: [0, 0, 0], collapsed: 1 });
    expect(view().showAll?.text).toBe("Show all (4)");
  });
});

describe("TagGroup maxRows — the Canvas paint", () => {
  it("draws the Show all box (accent text) and no collapsed tag; a collapse change rebinds", async () => {
    const { root, edit, of } = await open(2, 140);
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const list = of("TagList")[0]!;
    const showAll = root.tagShowAllInputs.get(list.id)!;
    const box = getSkiaNode(showAll.id)!;
    expect(box.text?.content).toBe("Show all (4)");
    // (The accent text — `.tag-show-all-btn { color: var(--accent) }`.)
    const accent = String(resolveToken("{color.accent}" as TokenRef, "light"));
    expect(
      Array.from(box.text!.color as Float32Array)
        .slice(0, 3)
        .map((channel) => Math.round(channel * 255)),
    ).toEqual([1, 3, 5].map((at) => parseInt(accent.slice(at, at + 2), 16)));
    expect(box.visible).toBe(true);
    const tags = of("Tag");
    expect(tags.map((tag) => getSkiaNode(tag.id)!.visible)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    // Every tag fits two rows at 300: the box goes — the binding rebinds (it is no record).
    edit({ maxRows: 2 }, { width: 300 });
    expect(canvas.update()).toMatchObject({
      status: "rebind-required",
      reason: "tag-rows",
    });
    canvas.dispose();
    const again = bindCatalogCanvas(root, root.pageRootRecords());
    expect(getSkiaNode(showAll.id)).toBeUndefined();
    expect(of("Tag").map((tag) => getSkiaNode(tag.id)!.visible)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    again.dispose();
  });
});
