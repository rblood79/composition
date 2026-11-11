import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  authorStagedFixture,
  buildStagedRoot as build,
  stagedPageIds,
  stagedSnapshot as snapshot,
} from "./support/stagedLoadFixture";

/**
 * ADR-307 G1 — a staged load (page shells first, filled in units) ends in the batch build's state:
 * the same records, the same geometry, the same composed parts · slot chrome · sticky constraints,
 * whatever the order the pages fill in and whatever the unit size.
 */
const ORDERS: Record<string, <T>(roots: T[]) => T[]> = {
  document: (roots) => roots,
  reverse: (roots) => [...roots].reverse(),
  "middle-out": (roots) => {
    const out: typeof roots = [];
    const middle = Math.floor(roots.length / 2);
    for (let step = 0; out.length < roots.length; step++) {
      for (const at of step ? [middle - step, middle + step] : [middle])
        if (roots[at] !== undefined) out.push(roots[at]);
    }
    return out;
  },
};

describe("ADR-307 staged load equivalence (G1)", () => {
  let batch: ReturnType<typeof snapshot>;
  beforeAll(async () => {
    await authorStagedFixture();
    batch = snapshot(await build());
  }, 60_000);

  it("opens with the first page in full and the other fixed-frame pages as shells", async () => {
    const root = await build({});
    const pending = root
      .pendingFillRoots()
      .map((rootId) => root.pageOfRoot(rootId));
    // Home is built; the content-height page cannot be a shell; the rest wait.
    expect(pending).toEqual(
      stagedPageIds.filter(
        (pageId) =>
          pageId !== "project:page:home" && pageId !== "project:page:tall",
      ),
    );
    expect(root.domInputs.size).toBeLessThan(batch.records.length / 2);
    // The page frames are where the batch build puts them, before any fill.
    expect(snapshot(root).frames).toEqual(batch.frames);
    expect(snapshot(root).pageRoots).toEqual(batch.pageRoots);
  });

  for (const [order, arrange] of Object.entries(ORDERS))
    for (const unitLimit of [Infinity, 3])
      it(`filled in ${order} order, unit limit ${unitLimit}, equals the batch build`, async () => {
        const root = await build({ unitLimit });
        const tasks = new Map<string, number>();
        for (const rootId of arrange(root.pendingFillRoots())) {
          const page = root.pageOfRoot(rootId)!;
          for (;;) {
            // One unit per task: every intermediate state is applied and laid out.
            const before = root.domInputs.size;
            const report = root.fill(rootId, { deadline: () => true });
            expect(report.errors).toEqual([]);
            expect(report.status).not.toBe("failed");
            expect(report.units).toBeLessThanOrEqual(1);
            expect(root.domInputs.size).toBeGreaterThanOrEqual(before);
            tasks.set(page, (tasks.get(page) ?? 0) + 1);
            if (report.status !== "partial") break;
          }
        }
        expect(root.pendingFillRoots()).toEqual([]);
        if (unitLimit === Infinity) {
          // A unit is one child position of the page root, whole.
          expect(tasks.get("project:page:flex")).toBe(1);
          expect(tasks.get("project:page:bound")).toBe(3);
          expect(tasks.get("project:page:shelled")).toBe(3);
        } else {
          // Heavy containers are shells of their own: the page takes many units — the layout
          // page too (its template positions, the body in its slot, the body's children).
          expect(tasks.get("project:page:flex")).toBeGreaterThan(8);
          expect(tasks.get("project:page:shelled")).toBeGreaterThan(
            tasks.get("project:page:flex")!,
          );
          expect(tasks.get("project:page:wide")).toBeGreaterThan(12);
        }
        const staged = snapshot(root);
        expect(staged.records.length).toBe(batch.records.length);
        expect(staged.records).toEqual(batch.records);
        expect(staged.geometry).toEqual(batch.geometry);
        expect(staged).toEqual(batch);
      });

  it("a whole page in one task (no deadline) equals the batch build", async () => {
    const root = await build({ unitLimit: 3 });
    for (const rootId of root.pendingFillRoots())
      expect(root.fill(rootId).status).toBe("filled");
    expect(snapshot(root)).toEqual(batch);
  });

  it("tells the fill listeners after each task and when a root is filled", async () => {
    const root = await build({ unitLimit: 3 });
    let calls = 0;
    const stop = root.subscribeFill(() => calls++);
    const [rootId] = root.pendingFillRoots();
    expect(root.fill(rootId, { deadline: () => true }).status).toBe("partial");
    expect(calls).toBe(1);
    expect(root.fill(rootId).status).toBe("filled");
    expect(calls).toBe(2);
    expect(root.fill(rootId).status).toBe("idle");
    expect(calls).toBe(2);
    stop();
  });
});
