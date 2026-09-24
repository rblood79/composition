// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadWorkspaceCanvasViewports,
  saveWorkspaceCanvasViewports,
  WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
} from "./workspaceCanvasViewportPersistence";

const VALID_BREAKPOINTS = new Set(["desktop", "tablet", "mobile"]);
const PROJECT_A = "project-a";
const PROJECT_B = "project-b";

describe("workspace canvas viewport persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads valid desktop, tablet, and mobile snapshots", () => {
    window.localStorage.setItem(
      `${WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY}:${PROJECT_A}`,
      JSON.stringify({
        desktop: { x: 120, y: 80, scale: 1 },
        tablet: { x: -40, y: 30, scale: 0.8 },
        mobile: { x: 10, y: -20, scale: 1.2 },
      }),
    );

    expect(loadWorkspaceCanvasViewports(PROJECT_A, VALID_BREAKPOINTS)).toEqual(
      new Map([
        ["desktop", { x: 120, y: 80, scale: 1 }],
        ["tablet", { x: -40, y: 30, scale: 0.8 }],
        ["mobile", { x: 10, y: -20, scale: 1.2 }],
      ]),
    );
  });

  it("ignores malformed, partial, out-of-range, and unknown entries", () => {
    window.localStorage.setItem(
      `${WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY}:${PROJECT_A}`,
      JSON.stringify({
        desktop: { x: 1, y: 2, scale: 1 },
        tablet: { x: 1, y: 2 },
        mobile: { x: 1, y: 2, scale: 6 },
        laptop: { x: 1, y: 2, scale: 1 },
        invalidNumbers: { x: "1", y: 2, scale: 1 },
      }),
    );

    expect(loadWorkspaceCanvasViewports(PROJECT_A, VALID_BREAKPOINTS)).toEqual(
      new Map([["desktop", { x: 1, y: 2, scale: 1 }]]),
    );
  });

  it("returns an empty map for malformed JSON and unavailable storage", () => {
    window.localStorage.setItem(
      `${WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY}:${PROJECT_A}`,
      "not-json",
    );
    expect(loadWorkspaceCanvasViewports(PROJECT_A, VALID_BREAKPOINTS)).toEqual(
      new Map(),
    );

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(loadWorkspaceCanvasViewports(PROJECT_A, VALID_BREAKPOINTS)).toEqual(
      new Map(),
    );
  });

  it("does not restore another project's or the old global camera", () => {
    const offscreen = JSON.stringify({
      desktop: { x: -9000, y: -9000, scale: 1 },
    });
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      offscreen,
    );
    window.localStorage.setItem(
      `${WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY}:${PROJECT_A}`,
      offscreen,
    );

    expect(loadWorkspaceCanvasViewports(PROJECT_B, VALID_BREAKPOINTS)).toEqual(
      new Map(),
    );
  });

  it("saves only valid entries for known breakpoints", () => {
    saveWorkspaceCanvasViewports(
      PROJECT_A,
      new Map([
        ["desktop", { x: 120, y: 80, scale: 1 }],
        ["tablet", { x: -40, y: 30, scale: 0.8 }],
        ["laptop", { x: 0, y: 0, scale: 1 }],
      ]),
      VALID_BREAKPOINTS,
    );

    expect(
      JSON.parse(
        window.localStorage.getItem(
          `${WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY}:${PROJECT_A}`,
        ) ?? "{}",
      ),
    ).toEqual({
      desktop: { x: 120, y: 80, scale: 1 },
      tablet: { x: -40, y: 30, scale: 0.8 },
    });
  });

  it("keeps each project's breakpoint cameras independent", () => {
    saveWorkspaceCanvasViewports(
      PROJECT_A,
      new Map([["desktop", { x: -9000, y: 0, scale: 1 }]]),
      VALID_BREAKPOINTS,
    );
    saveWorkspaceCanvasViewports(
      PROJECT_B,
      new Map([["desktop", { x: 120, y: 80, scale: 1 }]]),
      VALID_BREAKPOINTS,
    );

    expect(
      loadWorkspaceCanvasViewports(PROJECT_A, VALID_BREAKPOINTS).get("desktop"),
    ).toEqual({
      x: -9000,
      y: 0,
      scale: 1,
    });
    expect(
      loadWorkspaceCanvasViewports(PROJECT_B, VALID_BREAKPOINTS).get("desktop"),
    ).toEqual({
      x: 120,
      y: 80,
      scale: 1,
    });
  });
});
