// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogLayoutValue } from "./useLayoutValue";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";

type Rect = { width: number; height: number; x: number; y: number };

/** The parts of a workspace the hook reads: geometry, the step / root subscriptions, the revision. */
function fakeWorkspace(initial: Record<string, Rect>) {
  let rects = new Map(Object.entries(initial));
  let revision = 0;
  const steps = new Set<() => void>();
  const roots = new Set<() => void>();
  const workspace = {
    runtime: {
      graph: {
        get revision() {
          return revision;
        },
      },
      subscribeSteps(listener: () => void) {
        steps.add(listener);
        return () => steps.delete(listener);
      },
    },
    root: {
      breakpoint: "desktop",
      getGeometry(ids: Iterable<string>) {
        const out = new Map<string, Rect>();
        for (const id of ids) {
          const rect = rects.get(id);
          if (rect) out.set(id, rect);
        }
        return out;
      },
    },
    subscribeRoot(listener: () => void) {
      roots.add(listener);
      return () => roots.delete(listener);
    },
  };
  return {
    workspace: workspace as unknown as CatalogWorkspace,
    step(next: Record<string, Rect>) {
      rects = new Map(Object.entries(next));
      revision += 1;
      steps.forEach((listener) => listener());
    },
    listenerCount: () => steps.size + roots.size,
  };
}

describe("useCatalogLayoutValue", () => {
  it("reads the record's laid-out width from the composition root", () => {
    const { workspace } = fakeWorkspace({
      "rec-1": { width: 120, height: 32, x: 10, y: 20 },
    });
    const { result } = renderHook(() =>
      useCatalogLayoutValue(workspace, "rec-1", "width"),
    );
    expect(result.current).toBe(120);
  });

  it("returns undefined for an unknown record or no id", () => {
    const { workspace } = fakeWorkspace({});
    expect(
      renderHook(() => useCatalogLayoutValue(workspace, "nope", "width")).result
        .current,
    ).toBeUndefined();
    expect(
      renderHook(() => useCatalogLayoutValue(workspace, null, "width")).result
        .current,
    ).toBeUndefined();
  });

  it("re-reads after a published step", () => {
    const fake = fakeWorkspace({
      "rec-1": { width: 120, height: 32, x: 10, y: 20 },
    });
    const { result } = renderHook(() =>
      useCatalogLayoutValue(fake.workspace, "rec-1", "height"),
    );
    expect(result.current).toBe(32);
    act(() => fake.step({ "rec-1": { width: 120, height: 48, x: 10, y: 20 } }));
    expect(result.current).toBe(48);
  });

  it("unsubscribes on unmount", () => {
    const fake = fakeWorkspace({});
    const { unmount } = renderHook(() =>
      useCatalogLayoutValue(fake.workspace, "rec-1", "width"),
    );
    expect(fake.listenerCount()).toBe(2);
    unmount();
    expect(fake.listenerCount()).toBe(0);
  });
});
