import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  moveNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { scrollNodeOf } from "../../workspace/canvas/skia/propertyNodes";
import { CatalogCanvasScene, catalogSyncDamage } from "../canvasScene";
import { renderDebug } from "../../workspace/canvas/skia/renderCounters";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e: overflow on the catalog Canvas binding — every overflow but `visible` clips
 * (a rule-backed node too), a scroll/auto box carries its scrollbar, and an edit that changes the
 * scroll range redraws the box's scrollbar through the patch path.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const sized = (
  name: string,
  definitionId: string,
  width: number,
  height: number,
  children: NodeId[] = [],
  visual: NodeEntry["visual"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual,
  sizing: {
    width: { kind: "set", value: width },
    height: { kind: "set", value: height },
  },
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:o${++next}` as EntryId<K>;
};

async function open(overflow: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:overflow" as EntryId<"project">,
        name: "Overflow",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-overflow-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        sized("box", "lib:definition:type-frame", 200, 100, [id("tall")], {
          overflow: { kind: "set", value: overflow },
        }),
        sized("tall", "lib:definition:type-frame", 150, 300),
        sized("list", "lib:definition:type-ListBox", 200, 120),
      ],
      rootIds: [id("box"), id("list")],
      newId: allocator(),
    }),
  );
  const scene = new CatalogCanvasScene(workspace.root);
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  return { workspace, scene, record };
}

/**
 * ADR-269: the scrollbar the executor draws at the box's children end — the box's property node,
 * not its node data or a command.
 */
const scrollbarOf = (record: string) => scrollNodeOf(record)?.bar?.scrollbar;
const scrollOffsetOf = (record: string) => {
  const node = scrollNodeOf(record);
  return node && { scrollTop: node.scrollTop, scrollLeft: node.scrollLeft };
};

describe("ADR-248 Phase 4e catalog Canvas overflow binding", () => {
  it("removing overflowing content inside a fixed inner box refreshes the scroll ancestor without a scene rebind", async () => {
    const { workspace, scene, record } = await open("auto");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("box") },
        entries: [sized("inner", "lib:definition:type-frame", 150, 50)],
        rootIds: [id("inner")],
        newId: allocator(),
      }),
    );
    scene.sync();
    workspace.execute(
      moveNodes({
        ids: [id("tall")],
        parent: { kind: "node", id: id("inner") },
        newId: allocator(),
      }),
    );
    scene.sync();
    expect(scrollbarOf(record("box"))).toBeDefined();
    workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: id("tall") }] }),
    );
    expect(scene.sync().kind).toBe("patched");
    expect(scrollbarOf(record("box"))).toBeUndefined();
    scene.dispose();
  });
  it("clips for clip / scroll / auto as for hidden, and not for visible", async () => {
    for (const overflow of ["hidden", "clip", "scroll", "auto", "visible"]) {
      const { record } = await open(overflow);
      expect([overflow, getSkiaNode(record("box"))?.clipChildren]).toEqual([
        overflow,
        overflow !== "visible",
      ]);
    }
  });

  it("clips a rule-backed node by its definition's overflow (ListBox)", async () => {
    const { workspace, record } = await open("visible");
    const overflow = workspace.root.canvasInputs.get(record("list"))?.visual
      .overflow;
    expect(overflow).toBe("auto");
    expect(getSkiaNode(record("list"))?.clipChildren).toBe(true);
  });

  it("gives a scroll/auto box the scrollbar of its overflowing content, and redraws it on a range edit", async () => {
    const { workspace, scene, record } = await open("auto");
    // 300 px of content in a 100 px box: thumb = 100 / 300 of the track.
    expect(scrollbarOf(record("box"))).toEqual({
      vertical: {
        trackHeight: 100,
        thumbHeight: expect.closeTo(100 / 3, 6),
        thumbY: 0,
      },
    });
    expect(scrollbarOf(record("box"))?.horizontal).toBeUndefined();
    // The child shrinks inside the box: no scrollbar (the box itself did not change).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("tall") }],
        sizing: { height: { kind: "set", value: 50 } },
      }),
    );
    scene.sync();
    expect(scrollbarOf(record("box"))).toBeUndefined();
    // hidden clips but does not scroll.
    const hidden = await open("hidden");
    expect(scrollbarOf(hidden.record("box"))).toBeUndefined();
  });

  it("scrolls a scroll/auto box by the wheel: children and scrollbar move, clamped, kept across a rebind", async () => {
    const { workspace, scene, record } = await open("auto");
    const box = record("box");
    const tallTop = () => scene.stream.boundsMap.get(record("tall"))!.y;
    const before = tallTop();
    expect(scene.scrollable(box)).toBe(true);
    expect(scene.scrollable(record("tall"))).toBe(false);
    // Range = 300 − 100 = 200; a wheel past the end stops at it.
    expect(scene.scrollBy(box, 0, 150)).toBe(true);
    scene.sync();
    expect(scrollOffsetOf(box)).toEqual({
      scrollTop: 150,
      scrollLeft: 0,
    });
    expect(tallTop()).toBe(before - 150);
    expect(scrollbarOf(box)?.vertical?.thumbY).toBeCloseTo(
      (150 / 200) * (100 - 100 / 3),
    );
    expect(scene.scrollBy(box, 0, 500)).toBe(true);
    scene.sync();
    expect(scrollOffsetOf(box)?.scrollTop).toBe(200);
    expect(scene.scrollBy(box, 0, 10)).toBe(false);
    // A rebind keeps the position.
    scene.refresh();
    expect(scrollOffsetOf(box)?.scrollTop).toBe(200);
    expect(tallTop()).toBe(before - 200);
    // The content shrinks: the position is clamped into the new range (300 → 150: range 50).
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("tall") }],
        sizing: { height: { kind: "set", value: 150 } },
      }),
    );
    scene.sync();
    expect(scrollOffsetOf(box)?.scrollTop).toBe(50);
    expect(tallTop()).toBe(before - 50);
    // hidden clips but does not scroll.
    const hidden = await open("hidden");
    expect(hidden.scene.scrollable(hidden.record("box"))).toBe(false);
  });
});

describe("ADR-263 Phase 4 — 스크롤 범위 증분 (binding)", () => {
  it("무작위 편집 300 회 동안 scroll 상자가 들고 있는 extent 는 매번 전체 재계산과 같다", async () => {
    const { workspace, scene, record } = await open("auto");
    const binding = () =>
      (
        scene as unknown as {
          binding: {
            scrollExtentCheck(id: string): {
              kept: { right: number; bottom: number } | null;
              fresh: { right: number; bottom: number };
            };
          };
        }
      ).binding;
    let seed = 263;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const names: string[] = ["tall"];
    let made = 0;
    let kept = 0;
    for (let step = 0; step < 300; step += 1) {
      const pick = names[Math.floor(random() * names.length)]!;
      const roll = random();
      if (roll < 0.25) {
        const name = `r${made++}`;
        const parent = random() < 0.5 ? "box" : pick;
        workspace.execute(
          insertNodes({
            parent: { kind: "node", id: id(parent) },
            entries: [
              sized(
                name,
                "lib:definition:type-frame",
                10 + Math.floor(random() * 300),
                10 + Math.floor(random() * 300),
              ),
            ],
            rootIds: [id(name)],
            newId: allocator(),
          }),
        );
        names.push(name);
      } else if (roll < 0.35 && names.length > 2) {
        const index = 1 + Math.floor(random() * (names.length - 1));
        const [gone] = names.splice(index, 1);
        workspace.execute(
          removeTargets({ targets: [{ kind: "node", id: id(gone!) }] }),
        );
        // its descendants went with it
        for (let i = names.length - 1; i >= 0; i -= 1)
          if (!workspace.root.recordsOfSource(id(names[i]!)).length)
            names.splice(i, 1);
      } else if (roll < 0.45) {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: id(pick) }],
            visual: {
              overflow: {
                kind: "set",
                value: random() < 0.5 ? "hidden" : "visible",
              },
            },
          }),
        );
      } else {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: id(pick) }],
            sizing: {
              [random() < 0.5 ? "width" : "height"]: {
                kind: "set",
                value: 5 + Math.floor(random() * 500),
              },
            },
          }),
        );
      }
      scene.sync();
      const check = binding().scrollExtentCheck(record("box"));
      if (check.kept) {
        kept += 1;
        expect([step, check.kept]).toEqual([step, check.fresh]);
      }
    }
    expect(kept).toBeGreaterThan(150);
    scene.dispose();
  });
});

// ADR-269 Phase 1 (r1 H2): a scroll writes no command, yet the scene must report it through
// `sync()` — the Canvas invalidates content · overlay · cells only for a sync that is not
// `unchanged` (`CatalogCanvas.tsx` reads `synced.kind` and `catalogSyncDamage`).
describe("ADR-269 Phase 1 — 스크롤은 명령을 쓰지 않고 sync 로 발행한다", () => {
  const commandsOf = (scene: CatalogCanvasScene) =>
    Array.from(
      { length: scene.stream.commands.length },
      (_, i) => scene.stream.commands[i],
    );
  const plain = <T>(map: ReadonlyMap<string, T>) =>
    Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));
  /** The stream's maps and commands — compared with a fresh bind of the same state. */
  const snapshot = (scene: CatalogCanvasScene) => ({
    commands: commandsOf(scene),
    bounds: plain(scene.stream.boundsMap),
    hit: plain(scene.stream.hitBoundsMap),
    clip: plain(scene.stream.clipContextByElement),
  });

  it("스크롤만: sync 가 patched · propertyChanged · damage, 명령 0, 다음 sync 는 unchanged", async () => {
    const { scene, record } = await open("auto");
    const box = record("box");
    const before = commandsOf(scene);
    expect(scene.scrollBy(box, 0, 50)).toBe(true);
    const synced = scene.sync();
    expect(synced.kind).toBe("patched");
    if (synced.kind !== "patched") throw new Error("unreachable");
    expect(synced.update.propertyChanged).toEqual([box]);
    expect(synced.update.patchRoots).toEqual([]);
    expect(synced.update.commandWrites).toBe(0);
    // The owner's box (its scrollbar and children) draws again — a part, not in full.
    expect(catalogSyncDamage(synced)).toEqual(
      scene.stream.hitBoundsMap.get(box),
    );
    expect(commandsOf(scene)).toEqual(before);
    expect(scene.sync().kind).toBe("unchanged");
    scene.dispose();
  });

  it("한 프레임의 wheel 3 회는 update 1 회에 합산된다 · 결과는 같은 상태를 처음부터 묶은 것과 같다", async () => {
    const { scene, record } = await open("auto");
    const box = record("box");
    for (const delta of [30, 40, 25]) scene.scrollBy(box, 0, delta);
    const synced = scene.sync();
    if (synced.kind !== "patched") throw new Error(synced.kind);
    expect(synced.update.propertyChanged).toEqual([box]);
    expect(scrollOffsetOf(box)?.scrollTop).toBe(95);
    const placed = snapshot(scene);
    scene.rebuild();
    expect(placed).toEqual(snapshot(scene));
    scene.dispose();
  });

  it("같은 프레임의 문서 편집 + 스크롤: 둘 다 반영되고 이중 적용이 없다", async () => {
    const { workspace, scene, record } = await open("auto");
    const box = record("box");
    scene.scrollBy(box, 0, 60);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("tall") }],
        sizing: { width: { kind: "set", value: 120 } },
      }),
    );
    const synced = scene.sync();
    if (synced.kind !== "patched") throw new Error(synced.kind);
    expect(synced.update.propertyChanged).toEqual([box]);
    expect(synced.update.patchRoots.length).toBeGreaterThan(0);
    expect(scene.stream.boundsMap.get(record("tall"))?.width).toBe(120);
    const placed = snapshot(scene);
    scene.rebuild();
    expect(placed).toEqual(snapshot(scene));
    scene.dispose();
  });

  it("자식이 hit 영역 밖으로 칠하면 full 이 우선한다 (damage 없음)", async () => {
    const { workspace, scene, record } = await open("auto");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("tall") }],
        visual: { transform: { kind: "set", value: "rotate(5deg)" } },
      }),
    );
    scene.sync();
    expect(scene.stream.damageUnsafeElementIds.has(record("tall"))).toBe(true);
    scene.scrollBy(record("box"), 0, 40);
    const synced = scene.sync();
    expect(synced.kind).toBe("patched");
    expect(catalogSyncDamage(synced)).toBeUndefined();
    scene.dispose();
  });

  it("off 스위치 (옛 길 — 소유자 서브트리 재기록) 와 같은 결과", async () => {
    const placedRun = await open("auto");
    const recordedRun = await open("auto");
    const scrollEach = (run: typeof placedRun) => {
      for (const delta of [70, -20, 90]) {
        run.scene.scrollBy(run.record("box"), 0, delta);
        run.scene.sync();
      }
      return snapshot(run.scene);
    };
    const placed = scrollEach(placedRun);
    renderDebug.propertyNodesOff = true;
    try {
      const recorded = scrollEach(recordedRun);
      // Same document, two workspaces: compare by record position, not by id.
      expect(Object.values(placed.bounds)).toEqual(
        Object.values(recorded.bounds),
      );
      expect(Object.values(placed.hit)).toEqual(Object.values(recorded.hit));
    } finally {
      renderDebug.propertyNodesOff = false;
    }
    placedRun.scene.dispose();
    recordedRun.scene.dispose();
  });

  it("스크롤 뒤 무관한 편집은 소유자를 다시 기록하지 않는다 (scrollbar 판정 키 = 범위)", async () => {
    const { workspace, scene, record } = await open("auto");
    const box = record("box");
    scene.scrollBy(box, 0, 80);
    scene.sync();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("list") }],
        sizing: { width: { kind: "set", value: 210 } },
      }),
    );
    const synced = scene.sync();
    if (synced.kind !== "patched") throw new Error(synced.kind);
    expect(synced.update.rebound).not.toContain(box);
    expect(scrollOffsetOf(box)?.scrollTop).toBe(80);
    scene.dispose();
  });

  it("sticky 머리가 있는 ListBox: 머리를 담은 자식만 다시 기록하고 나머지는 옮긴다 · 결과는 처음부터 묶은 것과 같다", async () => {
    const { workspace, scene, record } = await open("visible");
    const list = id("sticky-list");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...sized(
              "sticky-list",
              "lib:definition:type-ListBox",
              220,
              200,
              [0, 1, 2].map((k) => id(`sticky-section-${k}`)),
            ),
          },
          ...[0, 1, 2].map((k): NodeEntry => ({
            kind: "node",
            id: id(`sticky-section-${k}`),
            definitionId:
              "lib:definition:origin-component-listbox-section" as NodeEntry["definitionId"],
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          })),
        ],
        rootIds: [list],
        newId: allocator(),
      }),
    );
    scene.sync();
    const owner = record("sticky-list");
    expect(scene.scrollable(owner)).toBe(true);
    expect(scene.scrollBy(owner, 0, 60)).toBe(true);
    const synced = scene.sync();
    if (synced.kind !== "patched") throw new Error(synced.kind);
    expect(synced.update.propertyChanged).toEqual([owner]);
    // The sections hold the sticky headers (placed by this owner's position): recorded again.
    const stickyIds = [...scene.stream.boundsMap.keys()].filter(
      (record) => getSkiaNode(record)?.sticky?.owner === owner,
    );
    expect(stickyIds.length).toBeGreaterThan(0);
    expect(synced.update.patchRoots.length).toBeGreaterThan(0);
    const placed = snapshot(scene);
    scene.rebuild();
    expect(placed).toEqual(snapshot(scene));
    scene.dispose();
  });
});
