import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginPagePositionPresentation,
  cancelPagePositionPresentation,
  finishPagePositionPresentation,
  getPagePositionPresentationSnapshot,
  publishPagePositionPresentation,
  readPagePosition,
  readPagePositionForInteraction,
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

    expect(
      beginPagePositionPresentation(canonical, ["page-1"], "desktop"),
    ).toBe(true);
    expect(
      publishPagePositionPresentation([
        { pageId: "page-1", position: { x: 30, y: 40 } },
      ]),
    ).toBe(true);

    const current = getPagePositionPresentationSnapshot();
    expect(current.canonical).toBe(canonical);
    expect(readPagePosition("page-1", current)).toEqual({ x: 30, y: 40 });
    expect(readPagePosition("page-2", current)).toBe(canonical["page-2"]);
  });

  it("publishes only when the active override changes", () => {
    const canonical = { "page-1": { x: 10, y: 20 } };
    const listener = vi.fn();
    const unsubscribe = subscribePagePositionPresentation(listener);

    beginPagePositionPresentation(canonical, ["page-1"], "desktop");
    publishPagePositionPresentation([
      { pageId: "page-1", position: { x: 30, y: 40 } },
    ]);
    publishPagePositionPresentation([
      { pageId: "page-1", position: { x: 30, y: 40 } },
    ]);

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("cancel clears the override without replacing the canonical reference", () => {
    const canonical = { "page-1": { x: 10, y: 20 } };
    beginPagePositionPresentation(canonical, ["page-1"], "desktop");
    publishPagePositionPresentation([
      { pageId: "page-1", position: { x: 30, y: 40 } },
    ]);

    cancelPagePositionPresentation();

    const current = getPagePositionPresentationSnapshot();
    expect(current.isActive).toBe(false);
    expect(current.canonical).toBe(canonical);
    expect(readPagePosition("page-1", current)).toBe(canonical["page-1"]);
  });

  it("finish installs the post-commit canonical reference and clears the override", () => {
    const initial = { "page-1": { x: 10, y: 20 } };
    const committed = { "page-1": { x: 30, y: 40 } };
    beginPagePositionPresentation(initial, ["page-1"], "desktop");
    publishPagePositionPresentation([
      { pageId: "page-1", position: { x: 30, y: 40 } },
    ]);

    finishPagePositionPresentation(committed);

    const current = getPagePositionPresentationSnapshot();
    expect(current.isActive).toBe(false);
    expect(current.canonical).toBe(committed);
    expect(readPagePosition("page-1", current)).toBe(committed["page-1"]);
  });

  it("uses the current breakpoint canonical map for inactive interaction reads", () => {
    const desktop = { "page-1": { x: 10, y: 20 } };
    const tablet = { "page-1": { x: 110, y: 120 } };
    beginPagePositionPresentation(desktop, ["page-1"], "desktop");
    finishPagePositionPresentation(desktop);

    expect(
      readPagePositionForInteraction(
        "page-1",
        tablet,
        getPagePositionPresentationSnapshot(),
      ),
    ).toBe(tablet["page-1"]);
  });

  it("keeps active drag overrides authoritative for interaction reads", () => {
    const desktop = {
      "page-1": { x: 10, y: 20 },
      "page-2": { x: 100, y: 200 },
    };
    const tablet = {
      "page-1": { x: 110, y: 120 },
      "page-2": { x: 210, y: 220 },
    };
    beginPagePositionPresentation(desktop, ["page-1"], "desktop");
    publishPagePositionPresentation([
      { pageId: "page-1", position: { x: 30, y: 40 } },
    ]);
    const current = getPagePositionPresentationSnapshot();

    expect(readPagePositionForInteraction("page-1", tablet, current)).toEqual({
      x: 30,
      y: 40,
    });
    expect(readPagePositionForInteraction("page-2", tablet, current)).toBe(
      desktop["page-2"],
    );
  });
});

describe("다중 페이지 드래그 override (ADR-178 Phase 2)", () => {
  beforeEach(() => {
    resetPagePositionPresentation();
  });

  it("begin은 canonical 위치가 있는 대상만 override 소집합에 담는다", () => {
    const canonical = {
      "page-1": { x: 10, y: 20 },
      "page-2": { x: 100, y: 200 },
    };

    expect(
      beginPagePositionPresentation(
        canonical,
        ["page-1", "page-2", "page-missing"],
        "desktop",
      ),
    ).toBe(true);

    const current = getPagePositionPresentationSnapshot();
    expect(current.activeOverrides?.size).toBe(2);
    expect(current.canonical).toBe(canonical);
  });

  it("publish 1회로 전 대상이 갱신되고, 무변경 항목만 있으면 false", () => {
    const canonical = {
      "page-1": { x: 10, y: 20 },
      "page-2": { x: 100, y: 200 },
    };
    beginPagePositionPresentation(canonical, ["page-1", "page-2"], "desktop");

    expect(
      publishPagePositionPresentation([
        { pageId: "page-1", position: { x: 40, y: 70 } },
        { pageId: "page-2", position: { x: 130, y: 250 } },
      ]),
    ).toBe(true);

    const current = getPagePositionPresentationSnapshot();
    expect(readPagePosition("page-1", current)).toEqual({ x: 40, y: 70 });
    expect(readPagePosition("page-2", current)).toEqual({ x: 130, y: 250 });

    expect(
      publishPagePositionPresentation([
        { pageId: "page-1", position: { x: 40, y: 70 } },
        { pageId: "page-2", position: { x: 130, y: 250 } },
      ]),
    ).toBe(false);
  });

  it("begin 에 없던 pageId 의 publish 는 무시된다 (드래그 집합 밖)", () => {
    const canonical = {
      "page-1": { x: 10, y: 20 },
      "page-2": { x: 100, y: 200 },
    };
    beginPagePositionPresentation(canonical, ["page-1"], "desktop");

    expect(
      publishPagePositionPresentation([
        { pageId: "page-2", position: { x: 1, y: 2 } },
      ]),
    ).toBe(false);
    expect(
      readPagePosition("page-2", getPagePositionPresentationSnapshot()),
    ).toBe(canonical["page-2"]);
  });
});
