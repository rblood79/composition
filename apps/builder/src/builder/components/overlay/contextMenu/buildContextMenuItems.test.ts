import { afterEach, describe, expect, it } from "vitest";
import {
  buildContextMenuItems,
  registerContextMenuProvider,
} from "./buildContextMenuItems";
import type { ContextMenuRequest } from "./types";

const request: ContextMenuRequest = {
  surface: "canvas-element",
  clientX: 10,
  clientY: 20,
  targetElementIds: ["card"],
};

describe("buildContextMenuItems", () => {
  const unregisters: Array<() => void> = [];

  afterEach(() => {
    unregisters.splice(0).forEach((unregister) => unregister());
  });

  it("dispatches by surface through the provider registry", () => {
    const items = [
      {
        kind: "action" as const,
        id: "copy",
        label: "Copy",
        run: () => undefined,
      },
    ];
    unregisters.push(
      registerContextMenuProvider("canvas-element", () => items),
    );

    expect(buildContextMenuItems(request)).toBe(items);
  });

  it("lets a mode override replace the provider result", () => {
    const providerItems = [
      {
        kind: "action" as const,
        id: "provider",
        label: "Provider",
        run: () => undefined,
      },
    ];
    const overrideItems = [
      {
        kind: "action" as const,
        id: "override",
        label: "Override",
        run: () => undefined,
      },
    ];
    unregisters.push(
      registerContextMenuProvider("canvas-element", () => providerItems),
    );

    expect(
      buildContextMenuItems(request, {
        modeOverride: () => overrideItems,
      }),
    ).toBe(overrideItems);
  });

  it("returns an empty list before a surface provider is registered", () => {
    expect(
      buildContextMenuItems({ ...request, surface: "canvas-empty" }),
    ).toEqual([]);
  });
});
