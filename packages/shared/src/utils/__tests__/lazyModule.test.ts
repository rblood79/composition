import { describe, expect, it, vi } from "vitest";
import { createLazyModule } from "../lazyModule";

describe("createLazyModule", () => {
  it("defers imports, shares concurrent loads and exposes the value before notifying", async () => {
    const value = { ready: true };
    let resolve!: (result: typeof value) => void;
    const importer = vi.fn(
      () =>
        new Promise<typeof value>((done) => {
          resolve = done;
        }),
    );
    const module = createLazyModule(importer);
    const snapshots: unknown[] = [];
    module.subscribe(() => snapshots.push(module.getSnapshot()));
    expect(module.getSnapshot()).toBeUndefined();
    expect(importer).not.toHaveBeenCalled();

    const first = module.load();
    expect(module.load()).toBe(first);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(snapshots).toEqual([]);
    resolve(value);
    expect(await first).toBe(value);
    expect(snapshots).toEqual([value]);
    expect(await module.load()).toBe(value);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(snapshots).toEqual([value]);
  });

  it("cancels pending listeners and immediately notifies late subscribers once", async () => {
    const module = createLazyModule(() => Promise.resolve({ ready: true }));
    const cancelled = vi.fn();
    const listener = vi.fn();
    const unsubscribe = module.subscribe(cancelled);
    module.subscribe(listener);
    unsubscribe();
    unsubscribe();
    await module.load();
    expect(cancelled).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);

    const late = vi.fn();
    module.subscribe(late)();
    expect(late).toHaveBeenCalledTimes(1);
    await module.load();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("keeps independent modules isolated", async () => {
    const first = createLazyModule(() => Promise.resolve({ name: "first" }));
    const secondImport = vi.fn(() => Promise.resolve({ name: "second" }));
    const second = createLazyModule(secondImport);
    const listener = vi.fn();
    second.subscribe(listener);
    await first.load();
    expect(second.getSnapshot()).toBeUndefined();
    expect(secondImport).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("preserves import rejection without publishing a ready value or retrying", async () => {
    const error = new Error("import failed");
    const importer = vi.fn(() => Promise.reject(error));
    const module = createLazyModule(importer);
    const listener = vi.fn();
    module.subscribe(listener);
    const loading = module.load();
    await expect(loading).rejects.toBe(error);
    expect(module.load()).toBe(loading);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(module.getSnapshot()).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });
});
