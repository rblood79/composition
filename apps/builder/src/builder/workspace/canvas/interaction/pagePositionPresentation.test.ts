import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginPagePositionPresentation,
  cancelPagePositionPresentation,
  finishPagePositionPresentation,
  getPagePositionPresentationSnapshot,
  publishPagePositionPresentation,
  readPageFramePosition,
  readPagePosition,
  resetPagePositionPresentation,
  subscribePagePositionPresentation,
} from "./pagePositionPresentation";

describe("pagePositionPresentation", () => {
  afterEach(() => {
    resetPagePositionPresentation();
  });

  it("keeps the canonical map reference and overrides only the active page", () => {
    const canonical = {
      "page-1": { x: 10, y: 20 },
      "page-2": { x: 100, y: 200 },
    };

    expect(beginPagePositionPresentation(canonical, "page-1", "desktop")).toBe(
      true,
    );
    expect(publishPagePositionPresentation("page-1", { x: 30, y: 40 })).toBe(
      true,
    );

    const current = getPagePositionPresentationSnapshot();
    expect(current.canonical).toBe(canonical);
    expect(readPagePosition("page-1", current)).toEqual({ x: 30, y: 40 });
    expect(readPageFramePosition("page-1", current)).toEqual({
      x: 30,
      y: 40,
    });
    expect(readPagePosition("page-2", current)).toBe(canonical["page-2"]);
  });

  it("publishes only when the active override changes", () => {
    const canonical = { "page-1": { x: 10, y: 20 } };
    const listener = vi.fn();
    const unsubscribe = subscribePagePositionPresentation(listener);

    beginPagePositionPresentation(canonical, "page-1", "desktop");
    publishPagePositionPresentation("page-1", { x: 30, y: 40 });
    publishPagePositionPresentation("page-1", { x: 30, y: 40 });

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("cancel clears the override without replacing the canonical reference", () => {
    const canonical = { "page-1": { x: 10, y: 20 } };
    beginPagePositionPresentation(canonical, "page-1", "desktop");
    publishPagePositionPresentation("page-1", { x: 30, y: 40 });

    cancelPagePositionPresentation();

    const current = getPagePositionPresentationSnapshot();
    expect(current.isActive).toBe(false);
    expect(current.canonical).toBe(canonical);
    expect(readPagePosition("page-1", current)).toBe(canonical["page-1"]);
  });

  it("finish installs the post-commit canonical reference and clears the override", () => {
    const initial = { "page-1": { x: 10, y: 20 } };
    const committed = { "page-1": { x: 30, y: 40 } };
    beginPagePositionPresentation(initial, "page-1", "desktop");
    publishPagePositionPresentation("page-1", { x: 30, y: 40 });

    finishPagePositionPresentation(committed);

    const current = getPagePositionPresentationSnapshot();
    expect(current.isActive).toBe(false);
    expect(current.canonical).toBe(committed);
    expect(readPagePosition("page-1", current)).toBe(committed["page-1"]);
  });
});
