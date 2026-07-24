// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadWorkspaceCanvasViewports,
  saveWorkspaceCanvasViewports,
  WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
} from "./workspaceCanvasViewportPersistence";

const VALID_BREAKPOINTS = new Set(["desktop", "tablet", "mobile"]);

describe("workspace canvas viewport persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads valid desktop, tablet, and mobile snapshots", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify({
        desktop: { x: 120, y: 80, scale: 1 },
        tablet: { x: -40, y: 30, scale: 0.8 },
        mobile: { x: 10, y: -20, scale: 1.2 },
      }),
    );

    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(
      new Map([
        ["desktop", { x: 120, y: 80, scale: 1 }],
        ["tablet", { x: -40, y: 30, scale: 0.8 }],
        ["mobile", { x: 10, y: -20, scale: 1.2 }],
      ]),
    );
  });

  it("ignores malformed, partial, out-of-range, and unknown entries", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify({
        desktop: { x: 1, y: 2, scale: 1 },
        tablet: { x: 1, y: 2 },
        mobile: { x: 1, y: 2, scale: 6 },
        laptop: { x: 1, y: 2, scale: 1 },
        invalidNumbers: { x: "1", y: 2, scale: 1 },
      }),
    );

    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(
      new Map([["desktop", { x: 1, y: 2, scale: 1 }]]),
    );
  });

  it("returns an empty map for malformed JSON and unavailable storage", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      "not-json",
    );
    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(new Map());

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(new Map());
  });

  it("saves only valid entries for known breakpoints", () => {
    saveWorkspaceCanvasViewports(
      new Map([
        ["desktop", { x: 120, y: 80, scale: 1 }],
        ["tablet", { x: -40, y: 30, scale: 0.8 }],
        ["laptop", { x: 0, y: 0, scale: 1 }],
      ]),
      VALID_BREAKPOINTS,
    );

    expect(
      JSON.parse(
        window.localStorage.getItem(WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY) ??
          "{}",
      ),
    ).toEqual({
      desktop: { x: 120, y: 80, scale: 1 },
      tablet: { x: -40, y: 30, scale: 0.8 },
    });
  });
});
