import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type {
  CatalogDocument,
  EntryId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../project";
import {
  CATALOG_SYSTEM_SNAPSHOT_LIMIT,
  CATALOG_USER_SNAPSHOT_LIMIT,
  CatalogSnapshotLimitError,
  CatalogSnapshots,
  removeCatalogProjectSnapshots,
  restoreCatalogSnapshot,
} from "../snapshots";

/**
 * ADR-248 Phase 4e-6-32: History snapshots — a user snapshot is a durable copy of the document
 * (limit 10, never dropped), a restore saves the open document as a system snapshot before the
 * stored document is replaced (newest 5 kept), and the project keeps its current name.
 */
const PROJECT = "project:project:snap" as EntryId<"project">;

function doc(name: string): CatalogDocument {
  return newCatalogProjectDocument({ projectId: PROJECT, name });
}
function open(db = `adr248-phase4e-snapshots-${Math.random()}`) {
  let clock = 1000;
  let id = 0;
  return {
    db,
    snapshots: new CatalogSnapshots(
      PROJECT,
      indexedDB,
      db,
      () => (clock += 1),
      () => `snapshot:${(id += 1)}`,
    ),
  };
}
const nameOf = (document: CatalogDocument) => {
  const project = document.entries[document.projectId];
  return project?.kind === "project" ? project.name : undefined;
};

describe("ADR-248 Phase 4e-6-32 History snapshots", () => {
  it("keeps user snapshots durable, newest first, up to the limit", async () => {
    const { db, snapshots } = open();
    const first = await snapshots.create(doc("one"), { kind: "user" });
    const second = await snapshots.create(doc("two"), { kind: "user" });
    expect(snapshots.getSnapshot().map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect([first.ordinal, second.ordinal]).toEqual([1, 2]);
    await snapshots.rename(first.id, "  Before redesign ");
    // A second session reads the same list and documents.
    const reread = new CatalogSnapshots(PROJECT, indexedDB, db);
    await reread.load();
    expect(reread.getSnapshot()).toMatchObject([
      { id: second.id, ordinal: 2 },
      { id: first.id, name: "Before redesign" },
    ]);
    expect(nameOf(await reread.document(first.id))).toBe("one");

    for (let index = 2; index < CATALOG_USER_SNAPSHOT_LIMIT; index += 1)
      await snapshots.create(doc(`n${index}`), { kind: "user" });
    expect(snapshots.canCreateUser()).toBe(false);
    await expect(
      snapshots.create(doc("over"), { kind: "user" }),
    ).rejects.toBeInstanceOf(CatalogSnapshotLimitError);
    // Deleting one makes room; the next ordinal continues past the highest.
    await snapshots.remove(second.id);
    const next = await snapshots.create(doc("again"), { kind: "user" });
    expect(next.ordinal).toBe(CATALOG_USER_SNAPSHOT_LIMIT + 1);
    await expect(snapshots.document(second.id)).rejects.toThrow(
      "SNAPSHOT_NOT_FOUND",
    );
  });

  it("restores: the open document becomes a system snapshot, then the stored one is replaced", async () => {
    const { snapshots } = open();
    const saved = await snapshots.create(doc("saved"), { kind: "user" });
    const replaced: CatalogDocument[] = [];
    const restored = await restoreCatalogSnapshot({
      snapshots,
      id: saved.id,
      current: doc("renamed later"),
      restoredFrom: "Snapshot 1",
      replace: async (document) => {
        replaced.push(document);
      },
    });
    expect(replaced).toEqual([restored]);
    // The project keeps its current name; the rest is the snapshot's document.
    expect(nameOf(restored)).toBe("renamed later");
    const [system] = snapshots.getSnapshot();
    expect(system).toMatchObject({
      kind: "system",
      restoredFrom: "Snapshot 1",
    });
    expect(nameOf(await snapshots.document(system.id))).toBe("renamed later");
    expect(snapshots.restoredId()).toBe(saved.id);

    // Nothing is replaced when the snapshot cannot be read.
    await expect(
      restoreCatalogSnapshot({
        snapshots,
        id: "snapshot:missing",
        current: doc("x"),
        restoredFrom: "?",
        replace: async (document) => {
          replaced.push(document);
        },
      }),
    ).rejects.toThrow("SNAPSHOT_NOT_FOUND");
    expect(replaced).toHaveLength(1);
    expect(snapshots.getSnapshot()).toHaveLength(2);
  });

  it("keeps the newest system snapshots and every user snapshot", async () => {
    const { snapshots } = open();
    const user = await snapshots.create(doc("user"), { kind: "user" });
    for (let index = 0; index < CATALOG_SYSTEM_SNAPSHOT_LIMIT + 2; index += 1)
      await snapshots.create(doc(`s${index}`), {
        kind: "system",
        restoredFrom: `r${index}`,
      });
    const systems = snapshots
      .getSnapshot()
      .filter((item) => item.kind === "system");
    expect(systems.map((item) => item.restoredFrom)).toEqual([
      "r6",
      "r5",
      "r4",
      "r3",
      "r2",
    ]);
    expect(snapshots.getSnapshot().some((item) => item.id === user.id)).toBe(
      true,
    );
  });

  it("deletes a deleted project's snapshots", async () => {
    const { db, snapshots } = open();
    const kept = await snapshots.create(doc("a"), { kind: "user" });
    await removeCatalogProjectSnapshots(PROJECT, indexedDB, db);
    const reread = new CatalogSnapshots(PROJECT, indexedDB, db);
    await reread.load();
    expect(reread.getSnapshot()).toEqual([]);
    await expect(reread.document(kept.id)).rejects.toThrow(
      "SNAPSHOT_NOT_FOUND",
    );
  });
});

describe("ADR-248 Phase 4e-6-32 snapshot host", () => {
  it("snapshots the open document, restores into storage and reopens on the same page", async () => {
    const { CatalogWorkspace } = await import("../workspace");
    const { CatalogGraph } =
      await import("../../../../../../packages/shared/src/catalog/document/graph");
    const { buildCodeCatalogLibrary } =
      await import("../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary");
    const { CatalogStorage } = await import("../storage");
    const { insertNodes } =
      await import("../../../../../../packages/shared/src/catalog/commands");
    const { nodeLayoutEngine } = await import("./support/nodeLayoutEngine");
    const { createCatalogSnapshotHost } =
      await import("../../panels/history/catalogSnapshotHost");
    const workspace = new CatalogWorkspace(
      new CatalogGraph(doc("Host"), await buildCodeCatalogLibrary()),
      new CatalogStorage(indexedDB, `adr248-snap-host-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const { snapshots } = open();
    const replaced: CatalogDocument[] = [];
    const reopened: (string | undefined)[] = [];
    const host = createCatalogSnapshotHost(
      workspace,
      snapshots,
      (pageId) => reopened.push(pageId),
      {
        replace: async (document) => {
          replaced.push(document);
          return 1;
        },
      },
    );
    await host.create();
    const [user] = snapshots.getSnapshot();
    const body = "project:node:home-body";
    const children = (document: CatalogDocument) => {
      const entry = document.entries[body as keyof typeof document.entries];
      return entry?.kind === "node" ? entry.children : [];
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: body as never },
        entries: [
          {
            kind: "node",
            id: "project:node:added" as never,
            definitionId: "lib:definition:type-frame",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:added" as never],
        newId: workspace.newId,
      }),
    );
    const page = workspace.session.getSnapshot().pageId;
    await host.restore(user.id, "Snapshot 1");
    // The stored document is the snapshot's (no added frame); the open one became "Before restore".
    expect(children(replaced[0])).toEqual([]);
    const [system] = snapshots.getSnapshot();
    expect(system).toMatchObject({
      kind: "system",
      restoredFrom: "Snapshot 1",
    });
    expect(children(await snapshots.document(system.id))).toEqual([
      "project:node:added",
    ]);
    expect(reopened).toEqual([page]);
    workspace.dispose();
  });
});

describe("ADR-248 Phase 4e-6-32 snapshot names", () => {
  it("restoring a Before-restore snapshot names the original, not a nested name", async () => {
    const { catalogSnapshotName, catalogSnapshotRestoredFrom } =
      await import("../../panels/history/catalogSnapshotHost");
    const t = (key: string, params?: Record<string, string | number>) =>
      `${key}(${Object.values(params ?? {}).join(",")})`;
    const base = { id: "s", projectId: PROJECT, createdAt: 1, size: 1 };
    const user = { ...base, kind: "user" as const, ordinal: 3 };
    const system = {
      ...base,
      kind: "system" as const,
      restoredFrom: "history.snapshotDefaultName(3)",
    };
    expect(catalogSnapshotName(user, t)).toBe("history.snapshotDefaultName(3)");
    expect(catalogSnapshotName({ ...user, name: "Mine" }, t)).toBe("Mine");
    expect(catalogSnapshotName(system, t)).toBe(
      "history.snapshotBeforeRestore(history.snapshotDefaultName(3))",
    );
    expect(catalogSnapshotRestoredFrom(user, t)).toBe(
      "history.snapshotDefaultName(3)",
    );
    expect(catalogSnapshotRestoredFrom(system, t)).toBe(
      "history.snapshotDefaultName(3)",
    );
  });
});
