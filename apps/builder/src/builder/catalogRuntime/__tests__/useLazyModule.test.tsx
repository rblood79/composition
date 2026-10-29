import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createLazyModule } from "../../../../../../packages/shared/src/utils/lazyModule";
import { useLazyModule } from "../../../../../../packages/shared/src/hooks/useLazyModule";

describe("useLazyModule", () => {
  it("loads only when wanted, rerenders all consumers and reuses a warm module", async () => {
    const value = { ready: true };
    let resolve!: (result: typeof value) => void;
    const importer = vi.fn(
      () =>
        new Promise<typeof value>((done) => {
          resolve = done;
        }),
    );
    const module = createLazyModule(importer);
    const first = renderHook(({ wanted }) => useLazyModule(module, wanted), {
      initialProps: { wanted: false },
      wrapper: StrictMode,
    });
    const second = renderHook(() => useLazyModule(module, false));
    expect(importer).not.toHaveBeenCalled();
    expect(first.result.current).toBeUndefined();
    first.rerender({ wanted: true });
    expect(importer).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(value);
      await module.load();
    });
    expect(first.result.current).toBe(value);
    expect(second.result.current).toBe(value);
    first.unmount();
    const warm = renderHook(() => useLazyModule(module, false));
    expect(warm.result.current).toBe(value);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("shares the import across StrictMode effects and ignores unmounted consumers", async () => {
    const value = { ready: true };
    let resolve!: (result: typeof value) => void;
    const importer = vi.fn(
      () =>
        new Promise<typeof value>((done) => {
          resolve = done;
        }),
    );
    const module = createLazyModule(importer);
    const first = renderHook(() => useLazyModule(module), {
      wrapper: StrictMode,
    });
    const second = renderHook(() => useLazyModule(module));
    expect(importer).toHaveBeenCalledTimes(1);
    first.unmount();
    await act(async () => {
      resolve(value);
      await module.load();
    });
    expect(second.result.current).toBe(value);
  });
});
