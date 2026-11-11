import { describe, expect, it } from "vitest";
import type { CatalogFillReport } from "../compositionRoot";
import { CatalogFillScheduler, type CatalogFillRoot } from "../fillScheduler";

/**
 * ADR-307 Phase 2 — the fill scheduler's order (current page → pages in view → page order), its
 * one-task-per-idle-period loop, the busy gate, and the synchronous request's cap.
 */
function fakeRoot(
  units: Record<string, number>,
  pages: Record<string, string>,
) {
  const left = new Map(Object.entries(units));
  const calls: { rootId: string; units: number; sync: boolean }[] = [];
  const failing = new Set<string>();
  const root: CatalogFillRoot = {
    pendingFillRoots: (options) =>
      [...left.keys()].filter(
        (rootId) => options?.failed || !failing.has(rootId),
      ),
    pageOfRoot: (rootId) => pages[rootId],
    fill(rootId, options = {}) {
      if (options.retryFailed) failing.delete(rootId);
      let done = 0;
      while ((left.get(rootId) ?? 0) > 0) {
        left.set(rootId, left.get(rootId)! - 1);
        done += 1;
        if (options.deadline?.()) break;
      }
      const remaining = left.get(rootId) ?? 0;
      if (!remaining) left.delete(rootId);
      calls.push({ rootId, units: done, sync: !!options.retryFailed });
      return {
        status: remaining ? "partial" : "filled",
        units: done,
        records: done,
        errors: [],
      } satisfies CatalogFillReport;
    },
  };
  return { root, calls, left, failing };
}
function harness(
  units: Record<string, number>,
  pages: Record<string, string>,
  options: { current?: string; unitMs?: number; input?: () => boolean } = {},
) {
  const fake = fakeRoot(units, pages);
  const queue: (() => void)[] = [];
  let clock = 0;
  let busy = false;
  let delivered = 0;
  const reported: unknown[] = [];
  // Every unit takes `unitMs` of the fake clock.
  const fill = fake.root.fill.bind(fake.root);
  fake.root.fill = (rootId, fillOptions = {}) =>
    fill(rootId, {
      ...fillOptions,
      deadline: fillOptions.deadline
        ? () => {
            clock += options.unitMs ?? 5;
            return fillOptions.deadline!();
          }
        : undefined,
    });
  const scheduler = new CatalogFillScheduler(
    {
      root: () => fake.root,
      currentPage: () => options.current,
      delivered: () => delivered++,
      report: (errors) => reported.push(...errors),
      busy: () => busy,
    },
    {
      schedule: (task) => {
        queue.push(task);
        return () => {
          const at = queue.indexOf(task);
          if (at >= 0) queue.splice(at, 1);
        };
      },
      now: () => clock,
      taskBudget: 8,
      syncBudget: 20,
      ...(options.input ? { inputPending: options.input } : {}),
    },
  );
  const idle = (times = Infinity) => {
    for (let ran = 0; ran < times && queue.length; ran++) queue.shift()!();
  };
  return {
    ...fake,
    scheduler,
    queue,
    idle,
    setBusy: (value: boolean) => (busy = value),
    get delivered() {
      return delivered;
    },
    reported,
  };
}
const PAGES = { a: "page:a", b: "page:b", c: "page:c", d: "page:d" };

describe("ADR-307 fill scheduler", () => {
  it("fills the current page, then the pages in view, then the rest in page order", () => {
    const h = harness({ a: 1, b: 1, c: 1, d: 1 }, PAGES, { current: "page:c" });
    h.scheduler.prioritize(["page:d", "page:b"]);
    h.idle();
    expect(h.calls.map((call) => call.rootId)).toEqual(["c", "d", "b", "a"]);
    expect(h.scheduler.pending).toBe(false);
    expect(h.queue.length).toBe(0);
    expect(h.delivered).toBe(4);
  });

  it("runs one task per idle period and stops a task at its time budget", () => {
    // 5 ms a unit, 8 ms budget: two units a task.
    const h = harness({ a: 5 }, PAGES);
    h.scheduler.restart();
    expect(h.queue.length).toBe(1);
    h.idle(1);
    expect(h.calls).toEqual([{ rootId: "a", units: 2, sync: false }]);
    expect(h.queue.length).toBe(1);
    h.idle();
    expect(h.calls.map((call) => call.units)).toEqual([2, 2, 1]);
  });

  it("ends a task at its next unit when the user's input is waiting", () => {
    let waiting = true;
    // 1 ms a unit: the 8 ms budget alone would take eight units.
    const h = harness({ a: 6 }, PAGES, { unitMs: 1, input: () => waiting });
    h.scheduler.restart();
    h.idle(2);
    expect(h.calls.map((call) => call.units)).toEqual([1, 1]);
    waiting = false;
    h.idle();
    expect(h.calls.map((call) => call.units)).toEqual([1, 1, 4]);
  });

  it("waits while the user drives the Canvas and goes on after", () => {
    const h = harness({ a: 2 }, PAGES, { unitMs: 10 });
    h.setBusy(true);
    h.scheduler.restart();
    h.idle(3);
    expect(h.calls).toEqual([]);
    // (Still scheduled: it asks again each idle period.)
    expect(h.queue.length).toBe(1);
    h.setBusy(false);
    h.idle();
    expect(h.left.size).toBe(0);
  });

  it("a page request fills that page now up to its cap; the rest goes on in the background", () => {
    // 5 ms a unit, 20 ms cap: four units now.
    const h = harness({ a: 3, b: 10 }, PAGES, { current: "page:b" });
    expect(h.scheduler.ensurePage("page:b")).toBe(false);
    expect(h.calls).toEqual([{ rootId: "b", units: 4, sync: true }]);
    expect(h.queue.length).toBe(1);
    // The rest of the requested page (it is the current page) before the other page.
    h.idle();
    expect(h.calls.slice(1).map((call) => call.rootId)).toEqual([
      "b",
      "b",
      "b",
      "a",
      "a",
    ]);
    // A filled page: nothing to do.
    expect(h.scheduler.ensurePage("page:b")).toBe(true);
  });

  it("a whole-page request ignores the cap, and a whole-document request fills every page", () => {
    const h = harness({ a: 30, b: 30, c: 2 }, PAGES);
    expect(h.scheduler.ensurePage("page:a", { whole: true })).toBe(true);
    expect(h.calls).toEqual([{ rootId: "a", units: 30, sync: true }]);
    h.scheduler.ensureAll();
    expect(h.scheduler.pending).toBe(false);
  });

  it("a root that failed is left alone until a request retries it", () => {
    const h = harness({ a: 1, b: 1 }, PAGES);
    h.failing.add("a");
    h.idle();
    h.scheduler.restart();
    h.idle();
    expect(h.calls.map((call) => call.rootId)).toEqual(["b"]);
    expect(h.queue.length).toBe(0);
    // (`pendingFillRoots` leaves a failed root out: a request asks for it with `failed`.)
    expect(h.scheduler.ensurePage("page:a")).toBe(true);
  });

  it("stop drops the scheduled task", () => {
    const h = harness({ a: 4 }, PAGES);
    h.scheduler.restart();
    h.scheduler.stop();
    expect(h.queue.length).toBe(0);
    h.scheduler.prioritize(["page:a"]);
    expect(h.queue.length).toBe(0);
  });
});
