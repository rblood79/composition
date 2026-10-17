import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ADR-270 Phase 1 (G2): an image that finishes loading records again only the records that looked
 * it up — a dirty seed of the next `sync()`, in the same update as the frame's other changes. The
 * old path bound the whole scene (`rebind("image-loaded")`) and the Canvas then cleared
 * `sceneStale`, absorbing a same-frame edit's patch.
 *
 * The image cache is the real module (its `readImagesOf` scope) with a fake store: `loaded` holds
 * the images that "finished", and the test hands their URL to the scene as the Canvas's load
 * callback does (`scene.imageLoaded(url)` — wiring: `catalogImageLoad.static.test.ts`).
 */
type FakeImage = { width(): number; height(): number };
const loaded = new Map<string, FakeImage>();
vi.mock("../../workspace/canvas/skia/imageCache", async (importOriginal) => {
  const real =
    await importOriginal<
      typeof import("../../workspace/canvas/skia/imageCache")
    >();
  return {
    ...real,
    getSkImage: (url: string) => {
      real.getSkImage(url); // the lookup the binding's scope records
      return loaded.get(url) ?? null;
    },
    loadSkImage: vi.fn(),
  };
});
vi.mock(
  "../../workspace/canvas/skia/initCanvasKit",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../workspace/canvas/skia/initCanvasKit")
    >()),
    isCanvasKitInitialized: () => true,
    getCanvasKit: () => ({
      TileMode: { Clamp: "clamp", Decal: "decal" },
      FilterMode: { Linear: "linear" },
    }),
  }),
);

import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  composeCommands,
  insertNodes,
  removeTargets,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  createCommandReader,
  type RenderCommand,
} from "../../workspace/canvas/skia/renderCommands";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const A = "project:node:a" as NodeId;
const B = "project:node:b" as NodeId;
const C = "project:node:c" as NodeId;
const D = "project:node:d" as NodeId;
const image = (w: number, h: number): FakeImage => ({
  width: () => w,
  height: () => h,
});

const frame = (
  id: NodeId,
  height = 50,
  children: NodeId[] = [],
  visual: Record<string, unknown> = {},
) => ({
  kind: "node" as const,
  id,
  definitionId: "lib:definition:type-frame" as never,
  children,
  props: {},
  visual,
  sizing: {
    width: { kind: "set" as const, value: 100 },
    height: { kind: "set" as const, value: height },
  },
  descendantOverrides: [],
});
const imageFill = (url: string) => [
  {
    id: `fill-${url}`,
    enabled: true,
    opacity: 1,
    blendMode: "normal",
    kind: "image",
    url,
    mode: "fill",
  },
];

/** `scroll`: A (300 tall) sits in D, an `overflow: auto` box 100 tall. */
async function open(
  fills: Partial<Record<NodeId, string>>,
  { scroll = false } = {},
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:img" as EntryId<"project">,
        name: "Img",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr270-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let next = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: scroll
        ? [
            frame(D, 100, [A], { overflow: { kind: "set", value: "auto" } }),
            frame(A, 300),
            frame(B),
            frame(C),
          ]
        : [frame(A), frame(B), frame(C)],
      rootIds: scroll ? [D, B, C] : [A, B, C],
      newId: <K extends EntryKind>(kind: K) =>
        `project:${kind}:img${++next}` as EntryId<K>,
    }),
  );
  const graph = workspace.runtime.graph;
  workspace.execute(() =>
    composeCommands(
      graph,
      "Image fills",
      Object.entries(fills).map(([id, url]) =>
        setWholeField({
          targets: [{ kind: "node", id: id as NodeId }],
          field: "fills",
          value: imageFill(url!) as never,
        }),
      ),
    ),
  );
  const record = (id: NodeId) => workspace.root.recordsOfSource(id)[0]!;
  const scene = new CatalogCanvasScene(workspace.root);
  return { workspace, scene, record };
}

/** The images the stream's self commands draw for `id` (the DRAW copies, not the registry). */
function drawnImages(scene: CatalogCanvasScene, id: string): unknown[] {
  const span = scene.stream.selfSpans.get(id);
  if (!span) return [];
  const at = createCommandReader(scene.stream.commands as RenderCommand[]);
  const found: unknown[] = [];
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 6) return;
    for (const fake of loaded.values()) if (value === fake) found.push(value);
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  for (let index = span.start; index < span.end; index += 1)
    visit(at(index), 0);
  return found;
}

afterEach(() => loaded.clear());

describe("ADR-270 Phase 1 — 이미지 완료 = 소유 요소 dirty seed", () => {
  it("① 완료 → 소유 요소만 patch, DRAW 에 이미지 · 다른 요소 node data 그대로 · 재바인드 0", async () => {
    const { scene, record } = await open({ [A]: "a.png" });
    expect(drawnImages(scene, record(A))).toEqual([]);
    expect(scene.imageOwnersOf("a.png")).toEqual([record(A)]);
    const other = getSkiaNode(record(B));

    loaded.set("a.png", image(200, 100));
    scene.imageLoaded("a.png");
    const synced = scene.sync();

    expect(synced.kind).toBe("patched");
    if (synced.kind !== "patched") return;
    expect(synced.update.rebound).toEqual([record(A)]);
    expect(synced.update.patchRoots).toEqual([record(A)]);
    expect(drawnImages(scene, record(A))).toEqual([loaded.get("a.png")]);
    expect(getSkiaNode(record(B))).toBe(other);
  });

  it("② 같은 프레임의 다른 요소 편집 + 완료 → 둘 다 반영, fresh bind 와 같은 상자", async () => {
    const { workspace, scene, record } = await open({ [A]: "a.png" });
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: B }],
        visual: { fill: { kind: "set", value: "#ff0000" } },
      }),
    );
    loaded.set("a.png", image(200, 100));
    scene.imageLoaded("a.png");
    const synced = scene.sync();

    expect(synced.kind).toBe("patched");
    if (synced.kind !== "patched") return;
    expect([...synced.update.rebound].sort()).toEqual(
      [record(A), record(B)].sort(),
    );
    expect(drawnImages(scene, record(A))).toEqual([loaded.get("a.png")]);
    expect([...(getSkiaNode(record(B))?.box?.fillColor ?? [])]).toEqual([
      1, 0, 0, 1,
    ]);
    const patched = {
      bounds: new Map(scene.stream.boundsMap),
      hit: new Map(scene.stream.hitBoundsMap),
    };
    scene.rebuild();
    expect(new Map(scene.stream.boundsMap)).toEqual(patched.bounds);
    expect(new Map(scene.stream.hitBoundsMap)).toEqual(patched.hit);
    expect(drawnImages(scene, record(A))).toEqual([loaded.get("a.png")]);
  });

  it("③ 같은 프레임에 소유 요소 삭제 + 완료 → seed 0 · 맵에서 빠짐", async () => {
    const { workspace, scene, record } = await open({ [A]: "a.png" });
    const owner = record(A);
    workspace.execute(
      removeTargets({
        targets: [workspace.itemOfRecord(owner)!.target],
      }),
    );
    loaded.set("a.png", image(200, 100));
    scene.imageLoaded("a.png");
    const synced = scene.sync();

    expect(synced.kind).toBe("patched");
    if (synced.kind !== "patched") return;
    expect(synced.update.rebound).not.toContain(owner);
    expect(scene.stream.boundsMap.has(owner)).toBe(false);
    expect(scene.imageOwnersOf("a.png")).toEqual([]);
  });

  it("④ 같은 프레임의 요소 스크롤 + 완료 → 스크롤 위치와 이미지 둘 다 반영", async () => {
    const { scene, record } = await open({ [A]: "a.png" }, { scroll: true });
    const top = () => scene.stream.boundsMap.get(record(A))!.y;
    const before = top();
    expect(scene.scrollBy(record(D), 0, 40)).toBe(true);
    loaded.set("a.png", image(200, 100));
    scene.imageLoaded("a.png");
    const synced = scene.sync();

    expect(synced.kind).toBe("patched");
    if (synced.kind !== "patched") return;
    expect(synced.update.propertyChanged).toEqual([record(D)]);
    expect(synced.update.rebound).toEqual([record(A)]);
    expect(top()).toBe(before - 40);
    expect(drawnImages(scene, record(A))).toEqual([loaded.get("a.png")]);
    // The patched stream is the one a fresh bind makes from the same state.
    const patched = new Map(scene.stream.boundsMap);
    scene.rebuild();
    expect(new Map(scene.stream.boundsMap)).toEqual(patched);
  });

  it("⑤ 두 요소가 같은 URL → 둘 다 splice", async () => {
    const { scene, record } = await open({ [A]: "s.png", [C]: "s.png" });
    expect([...scene.imageOwnersOf("s.png")].sort()).toEqual(
      [record(A), record(C)].sort(),
    );
    loaded.set("s.png", image(64, 64));
    scene.imageLoaded("s.png");
    const synced = scene.sync();

    expect(synced.kind).toBe("patched");
    if (synced.kind !== "patched") return;
    expect([...synced.update.rebound].sort()).toEqual(
      [record(A), record(C)].sort(),
    );
    expect(drawnImages(scene, record(A))).toHaveLength(1);
    expect(drawnImages(scene, record(C))).toHaveLength(1);
  });

  it("⑥ 완료 뒤 sync 전에 scene 이 다시 묶이면 → 그 bind 가 이미지를 읽고 seed 는 남지 않는다", async () => {
    const { scene, record } = await open({ [A]: "a.png" });
    loaded.set("a.png", image(200, 100));
    scene.imageLoaded("a.png");
    scene.refresh(); // a page switch or a drag's start/end binds again
    expect(drawnImages(scene, record(A))).toEqual([loaded.get("a.png")]);
    expect(scene.sync().kind).toBe("unchanged");
  });

  it("⑦ 아무도 조회하지 않은 URL 의 완료 → 변화 없음", async () => {
    const { scene } = await open({ [A]: "a.png" });
    loaded.set("other.png", image(10, 10));
    scene.imageLoaded("other.png");
    expect(scene.sync().kind).toBe("unchanged");
  });

  it("drag 중 (`holdImages`) 완료는 기다렸다가 다음 sync 에 seed 된다", async () => {
    const { scene, record } = await open({ [A]: "a.png" });
    loaded.set("a.png", image(200, 100));
    scene.imageLoaded("a.png");
    expect(scene.sync({ holdImages: true }).kind).toBe("unchanged");
    expect(drawnImages(scene, record(A))).toEqual([]);
    const synced = scene.sync();
    expect(synced.kind).toBe("patched");
    expect(drawnImages(scene, record(A))).toEqual([loaded.get("a.png")]);
  });

  it("편집이 fill 을 바꾸면 맵이 새 URL 로 옮겨 간다", async () => {
    const { workspace, scene, record } = await open({ [A]: "a.png" });
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: A }],
        field: "fills",
        value: imageFill("b.png") as never,
      }),
    );
    scene.sync();
    expect(scene.imageOwnersOf("a.png")).toEqual([]);
    expect(scene.imageOwnersOf("b.png")).toEqual([record(A)]);
  });
});
