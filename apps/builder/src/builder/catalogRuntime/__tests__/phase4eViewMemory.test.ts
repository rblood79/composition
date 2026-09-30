// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakpointName } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  bindCatalogCamera,
  openCatalogCameraMemory,
  readRememberedBreakpoint,
  rememberBreakpoint,
} from "../../workspace/canvas/catalog/catalogViewMemory";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e: the Builder view survives a reload and reopening a project — the breakpoint (one
 * Builder-wide choice) and the Canvas camera (per project and breakpoint), in the old app's keys.
 */
describe("ADR-248 4e view memory", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("remembers the breakpoint; an unknown value falls back to desktop", () => {
    expect(readRememberedBreakpoint()).toBe("desktop");
    rememberBreakpoint("mobile");
    expect(readRememberedBreakpoint()).toBe("mobile");
    window.localStorage.setItem("builder-breakpoint", "watch");
    expect(readRememberedBreakpoint()).toBe("desktop");
  });

  it("a workspace opened on a remembered breakpoint shows it in the session", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:view" as EntryId<"project">,
          name: "View",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-4e-view-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
        root: { breakpoint: "tablet" },
      },
    );
    expect(workspace.root.breakpoint).toBe("tablet");
    expect(workspace.session.getSnapshot().breakpoint).toBe("tablet");
    workspace.dispose();
  });

  it("opens on the remembered camera, keeps one per breakpoint and per project", () => {
    vi.useFakeTimers();
    let breakpoint: BreakpointName = "desktop";
    let current = { x: 0, y: 0, scale: 1 };
    const fits: string[] = [];
    const bind = (projectId: string) =>
      bindCatalogCamera({
        memory: openCatalogCameraMemory(projectId),
        breakpoint: () => breakpoint,
        camera: () => current,
        setCamera: (camera) => (current = { ...camera }),
        fit: () => {
          fits.push(breakpoint);
          current = { x: 1, y: 1, scale: 0.5 };
        },
      });
    const size = { width: 800, height: 600 };

    // First open: nothing remembered → fit; a pan is remembered after the delay.
    let camera = bind("p1");
    camera.show(size);
    expect(fits).toEqual(["desktop"]);
    current = { x: 120, y: -40, scale: 0.75 };
    camera.changed();
    vi.advanceTimersByTime(150);

    // A theme change (same breakpoint) keeps the camera.
    camera.rootReplaced(size);
    expect(current).toEqual({ x: 120, y: -40, scale: 0.75 });

    // A switch to mobile: nothing remembered there → fit; back to desktop → its camera.
    breakpoint = "mobile";
    camera.rootReplaced(size);
    expect(fits).toEqual(["desktop", "mobile"]);
    current = { x: 5, y: 6, scale: 2 };
    camera.changed();
    breakpoint = "desktop";
    camera.rootReplaced(size);
    expect(current).toEqual({ x: 120, y: -40, scale: 0.75 });

    // Reopen (reload / back from the dashboard): each breakpoint's camera; another project fits.
    camera = bind("p1");
    camera.show(size);
    expect(current).toEqual({ x: 120, y: -40, scale: 0.75 });
    breakpoint = "mobile";
    camera = bind("p1");
    camera.show(size);
    expect(current).toEqual({ x: 5, y: 6, scale: 2 });
    camera = bind("p2");
    camera.show(size);
    expect(fits).toEqual(["desktop", "mobile", "mobile"]);
  });

  it("flush writes a pending camera now (a reload inside the delay)", () => {
    vi.useFakeTimers();
    let current = { x: 0, y: 0, scale: 1 };
    const options = {
      breakpoint: (): BreakpointName => "desktop",
      camera: () => current,
      setCamera: (camera: typeof current) => (current = { ...camera }),
      fit: () => {},
    };
    const camera = bindCatalogCamera({
      ...options,
      memory: openCatalogCameraMemory("p1"),
    });
    camera.show({ width: 1, height: 1 });
    current = { x: 9, y: 9, scale: 3 };
    camera.changed();
    camera.flush();
    current = { x: 0, y: 0, scale: 1 };
    bindCatalogCamera({
      ...options,
      memory: openCatalogCameraMemory("p1"),
    }).show({ width: 1, height: 1 });
    expect(current).toEqual({ x: 9, y: 9, scale: 3 });
  });
});
