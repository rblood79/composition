import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  authorStagedFixture,
  buildStagedRoot,
  stagedSnapshot,
} from "./support/stagedLoadFixture";

/**
 * ADR-307 Decision 4 — a fill task's two failure boundaries (G2's error injection, at the root):
 * a failed apply (the engine throws) restores the records, the engine inputs and the fill state,
 * and the root is not retried at the same document revision; a failed delivery (a subscriber
 * throws) keeps the records — the errors are returned and the next tasks go on.
 */
describe("ADR-307 fill failure boundaries", () => {
  let batch: ReturnType<typeof stagedSnapshot>;
  beforeAll(async () => {
    await authorStagedFixture();
    batch = stagedSnapshot(await buildStagedRoot());
  }, 60_000);

  it("an engine error rolls the task back and the root is not retried at this revision", async () => {
    let failing = false;
    const root = await buildStagedRoot({ unitLimit: 3 }, (engine) => ({
      ...engine,
      computeLayout: (...args: Parameters<typeof engine.computeLayout>) => {
        // (Once: the rollback lays the restored records out with the engine again.)
        if (failing) {
          failing = false;
          throw new Error("ENGINE_DOWN");
        }
        return engine.computeLayout(...args);
      },
    }));
    const [rootId, other] = root.pendingFillRoots();
    expect(root.fill(rootId, { deadline: () => true }).status).toBe("partial");
    const before = stagedSnapshot(root);
    let listened = 0;
    root.subscribeFill(() => listened++);

    failing = true;
    const failed = root.fill(rootId, { deadline: () => true });
    expect(failed.status).toBe("failed");
    expect(String(failed.errors[0])).toContain("ENGINE_DOWN");
    // Records, geometry and the pending roots are those before the task.
    expect(stagedSnapshot(root)).toEqual(before);
    // (Left out of the background's list until the document changes; a request still sees it.)
    expect(root.pendingFillRoots()).not.toContain(rootId);
    expect(root.pendingFillRoots({ failed: true })).toContain(rootId);
    expect(listened).toBe(0);
    // Not retried at the same revision — nothing is resolved or applied.
    const skipped = root.fill(rootId);
    expect(skipped).toMatchObject({ status: "failed", units: 0, records: 0 });
    expect(stagedSnapshot(root)).toEqual(before);
    // Another root is unaffected.
    expect(root.fill(other).status).toBe("filled");

    // An explicit retry (a synchronous request) fills it; the end state is the batch build's.
    expect(root.fill(rootId, { retryFailed: true }).status).toBe("filled");
    for (const pending of root.pendingFillRoots()) root.fill(pending);
    expect(stagedSnapshot(root)).toEqual(batch);
  });

  it("a subscriber error keeps the records: the errors are returned and the fill goes on", async () => {
    const root = await buildStagedRoot({ unitLimit: 3 });
    const [rootId] = root.pendingFillRoots();
    const top = root
      .pageRootRecords()
      .find((id) => root.domInputs.get(id)?.sourceId === rootId)!;
    const stop = root.subscribeCanvas(top, () => {
      throw new Error("CANVAS_DOWN");
    });
    const size = root.domInputs.size;
    const report = root.fill(rootId, { deadline: () => true });
    expect(report.status).toBe("partial");
    expect(report.errors.map(String)).toEqual(["Error: CANVAS_DOWN"]);
    expect(root.domInputs.size).toBeGreaterThan(size);
    stop();
    for (const pending of root.pendingFillRoots())
      expect(root.fill(pending).errors).toEqual([]);
    expect(stagedSnapshot(root)).toEqual(batch);
  });
});
