import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  EntryKind,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogCommand } from "../../../../../../packages/shared/src/catalog/commands/compose";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogAutosave } from "../autosave";
import { CatalogRuntime } from "../controller";
import { importCatalogFolder, importCatalogJson } from "../exchange";
import { createCatalogProject } from "../project";
import { CatalogStorage, type CatalogCommit } from "../storage";

/**
 * ADR-248 Phase 4d storage connection (G4 independent path): a new project starts in the new
 * namespace, is listed and removed there, and autosave shows `saved` only after the durable
 * commit of the current revision — never for a failed, conflicting or other project's save.
 * Old documents (the old app's real folder export included) fail with UNSUPPORTED_PROJECT_FORMAT.
 */
const HOME = "project:page:home" as EntryId<"page">;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:s${++next}` as EntryId<K>;
};
const text = (name: string, value: string) =>
  ({
    kind: "node",
    id: `project:node:${name}`,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

let library: CatalogLibrary | undefined;
async function setup(
  hooks: ConstructorParameters<typeof CatalogStorage>[2] = {},
) {
  library ??= await buildCodeCatalogLibrary();
  const name = `adr248-phase4d-storage-${Math.random()}`;
  const storage = new CatalogStorage(indexedDB, name, hooks);
  const graph = await createCatalogProject(storage, library, {
    projectId: "project:project:alpha" as EntryId<"project">,
    name: "Alpha",
  });
  const runtime = new CatalogRuntime(graph, storage);
  const queued: (() => void)[] = [];
  const autosave = new CatalogAutosave(runtime, {
    schedule: (run) => queued.push(run),
  });
  const newId = allocator();
  const run = (command: CatalogCommand) => {
    const plan = command(runtime.graph);
    runtime.dispatch(plan.label, plan.ops);
    return plan;
  };
  const insert = (name: string) =>
    run(
      insertNodes({
        parent: { kind: "page", id: HOME },
        entries: [text(name, name)],
        rootIds: [`project:node:${name}` as NodeEntry["id"]],
        newId,
      }),
    );
  /** Run the queued autosave and wait for it. */
  const settle = async () => {
    while (queued.length) queued.shift()!();
    await runtime.save().catch(() => undefined);
    await Promise.resolve();
  };
  return { name, storage, runtime, autosave, queued, run, insert, settle };
}

describe("ADR-248 Phase 4d storage connection", () => {
  it("new project → edit → autosave → reopen from the new namespace → list → remove", async () => {
    const { name, storage, runtime, autosave, insert, settle } = await setup();
    expect(await storage.list()).toEqual([
      {
        projectId: "project:project:alpha",
        revision: 0,
        name: "Alpha",
        supported: true,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      },
    ]);
    expect(autosave.getSnapshot().state).toBe("saved");
    insert("a");
    insert("b");
    expect(autosave.getSnapshot()).toMatchObject({
      state: "unsaved",
      revision: 2,
      durableRevision: 0,
    });
    await settle();
    expect(autosave.getSnapshot()).toMatchObject({
      state: "saved",
      revision: 2,
      durableRevision: 2,
    });
    // Refresh: a fresh storage over the same namespace loads the same graph.
    const reopened = new CatalogStorage(indexedDB, name);
    const document = await reopened.load(runtime.graph.projectId, library!);
    expect(document.entries).toEqual(runtime.graph.exportDocument().entries);
    expect((await reopened.list())[0]).toMatchObject({
      revision: 2,
      name: "Alpha",
    });
    await reopened.remove(runtime.graph.projectId);
    expect(await reopened.list()).toEqual([]);
    await expect(
      reopened.load(runtime.graph.projectId, library!),
    ).rejects.toThrow("PROJECT_NOT_FOUND");
    await expect(reopened.remove(runtime.graph.projectId)).rejects.toThrow(
      "PROJECT_NOT_FOUND",
    );
    // No entry record outlives its project: the same id starts clean.
    const again = await createCatalogProject(reopened, library!, {
      projectId: runtime.graph.projectId,
      name: "Again",
    });
    expect(
      (await reopened.load(runtime.graph.projectId, library!)).entries,
    ).toEqual(again.exportDocument().entries);
  });

  it("a failed save is never shown as saved; the next attempt saves the pending revisions in order", async () => {
    let fail = true;
    const commits: number[] = [];
    const { runtime, autosave, insert, settle } = await setup({
      beforeTransaction: (commit: CatalogCommit) => {
        if (fail) throw new Error("disk full");
        commits.push(commit.revision);
      },
    });
    insert("a");
    await settle();
    expect(autosave.getSnapshot()).toMatchObject({
      state: "failed",
      revision: 1,
      durableRevision: 0,
    });
    fail = false;
    insert("b");
    expect(autosave.getSnapshot().state).toBe("unsaved");
    await settle();
    expect(autosave.getSnapshot()).toMatchObject({
      state: "saved",
      durableRevision: 2,
    });
    expect(commits).toEqual([1, 2]);
    expect(runtime.durableRevision).toBe(2);
  });

  it("another tab moving the stored revision stops autosave at conflict", async () => {
    const commits: number[] = [];
    const { name, runtime, autosave, insert, settle } = await setup({
      beforeTransaction: (commit: CatalogCommit) => {
        commits.push(commit.revision);
      },
    });
    const otherStorage = new CatalogStorage(indexedDB, name);
    const other = new CatalogRuntime(
      new CatalogGraph(
        await otherStorage.load(runtime.graph.projectId, library!),
        library!,
      ),
      otherStorage,
    );
    other.dispatch(
      "other tab",
      insertNodes({
        parent: { kind: "page", id: HOME },
        entries: [text("x", "x")],
        rootIds: ["project:node:x" as NodeEntry["id"]],
        newId: allocator(),
      })(other.graph).ops,
    );
    await other.save();
    insert("a");
    await settle();
    expect(autosave.getSnapshot()).toMatchObject({
      state: "conflict",
      durableRevision: 0,
    });
    const attempts = commits.length;
    insert("b");
    await settle();
    // settle() itself calls runtime.save once more; autosave scheduled nothing.
    expect(autosave.getSnapshot().state).toBe("conflict");
    expect(commits.length - attempts).toBeLessThanOrEqual(1);
  });

  it("a save that finishes after a project switch marks the project it saved, not the active one", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let hold = true;
    const { storage, runtime, autosave, queued, insert } = await setup({
      beforeTransaction: async () => {
        if (hold) await gate;
      },
    });
    const beta = await createCatalogProject(storage, library!, {
      projectId: "project:project:beta" as EntryId<"project">,
      name: "Beta",
    });
    insert("a");
    queued.shift()!();
    expect(autosave.getSnapshot().state).toBe("saving");
    runtime.addProject(beta);
    runtime.switchProject(beta.projectId);
    autosave.onProjectSwitched();
    expect(autosave.getSnapshot()).toMatchObject({
      projectId: "project:project:beta",
      state: "saved",
    });
    insert("b");
    expect(autosave.getSnapshot()).toMatchObject({
      projectId: "project:project:beta",
      state: "unsaved",
    });
    hold = false;
    release();
    await runtime.save("project:project:alpha" as EntryId<"project">);
    await Promise.resolve();
    expect(autosave.getSnapshot()).toMatchObject({
      projectId: "project:project:beta",
      state: "unsaved",
      durableRevision: 0,
    });
    runtime.switchProject("project:project:alpha" as EntryId<"project">);
    autosave.onProjectSwitched();
    expect(autosave.getSnapshot()).toMatchObject({
      state: "saved",
      durableRevision: 1,
    });
  });

  it("old formats fail visibly: an old IDB head, the old app's JSON, and publish", async () => {
    const { name, storage } = await setup();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onsuccess = () => {
        const transaction = request.result.transaction("heads", "readwrite");
        transaction.objectStore("heads").put({
          projectId: "project:project:old",
          format: "composition-canonical",
          schemaVersion: 1,
          libraryContractVersion: 24,
          rootId: "project:project:old",
          revision: 3,
        });
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    expect(
      (await storage.list()).find(
        (item) => item.projectId === "project:project:old",
      ),
    ).toMatchObject({ supported: false, name: undefined });
    await expect(
      storage.load("project:project:old" as EntryId<"project">, library!),
    ).rejects.toThrow("UNSUPPORTED_PROJECT_FORMAT");
  });

  const OLD_EXPORT = join(
    __dirname,
    "../../../../../../docs/adr/design/248-baseline/storage-surface/oracle/old-export.composition.zip",
  );
  it.skipIf(!existsSync(OLD_EXPORT))(
    "the old app's real folder export (G0 storage-surface) is refused as a folder and as JSON",
    async () => {
      library ??= await buildCodeCatalogLibrary();
      const listing = execFileSync("unzip", ["-Z1", OLD_EXPORT], {
        encoding: "utf8",
      })
        .split("\n")
        .filter((path) => path && !path.endsWith("/"));
      const files = Object.fromEntries(
        listing.map((path) => [
          path,
          execFileSync("unzip", ["-p", OLD_EXPORT, path], { encoding: "utf8" }),
        ]),
      );
      expect(JSON.parse(files["manifest.json"]).formatVersion).toBe("2.0.0");
      await expect(importCatalogFolder(files, library)).rejects.toThrow(
        "UNSUPPORTED_PROJECT_FORMAT",
      );
      const documentPath = JSON.parse(files["manifest.json"]).parts.document
        .path as string;
      expect(() => importCatalogJson(files[documentPath], library!)).toThrow(
        "UNSUPPORTED_PROJECT_FORMAT",
      );
    },
  );

  it("the runtime source reads no old document store or old storage module", () => {
    const dir = join(__dirname, "..");
    const offenders = readdirSync(dir)
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => {
        const source = readFileSync(join(dir, file), "utf8");
        return (
          /lib\/db\/|incrementalDocuments|documentPersist|["'](documents|document_heads|document_parts|documents_backup|projects)["']/.test(
            source,
          ) || /indexedDB\.open\(\s*["']composition["']/.test(source)
        );
      });
    expect(offenders).toEqual([]);
  });
});
