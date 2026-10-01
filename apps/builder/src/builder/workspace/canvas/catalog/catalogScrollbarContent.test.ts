import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../../../catalogRuntime/project";
import { CatalogStorage } from "../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { catalogScrollbarContent } from "./catalogScrollbarContent";

describe("ADR-248 Phase 4e catalog Canvas scrollbar range", () => {
  it("covers the laid-out page frames and follows a step and a breakpoint switch", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:scroll" as EntryId<"project">,
          name: "Scroll",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-scrollbar-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const content = catalogScrollbarContent(workspace);
    expect(content.rects()).toEqual([
      ...workspace.root.pageFrameRects().values(),
    ]);
    expect(content.rects().length).toBeGreaterThan(0);
    const notify = vi.fn();
    const off = content.subscribe(notify);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:home-body" as NodeId }],
        visual: { padding: { kind: "set", value: 4 } },
      }),
    );
    expect(notify).toHaveBeenCalled();
    notify.mockClear();
    const desktop = content.rects()[0];
    workspace.setBreakpoint("mobile");
    expect(notify).toHaveBeenCalled();
    expect(content.rects()[0].width).toBeLessThan(desktop.width);
    off();
    notify.mockClear();
    workspace.setBreakpoint("desktop");
    expect(notify).not.toHaveBeenCalled();
  });
});
