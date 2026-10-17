// @vitest-environment jsdom
/**
 * Compare Mode's CSS side renders the Preview at the open page's Canvas frame — its size (the
 * breakpoint viewport `CANVAS_VIEWPORT` for a page that does not grow) at the Canvas camera. Desktop included: the frame filled the pane
 * (2026-10-04 user report 「compare 모드에서 css 는 breakpoint 가 미적용」 — desktop CSS 834px beside a
 * 1920px Canvas page).
 */
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
} from "../../../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../../../../catalogRuntime/project";
import { CatalogWorkspaceProvider } from "../../../../catalogRuntime/react";
import { CatalogStorage } from "../../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { CANVAS_VIEWPORT } from "../../../canvasBreakpoints";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "../../viewport/viewportPresentation";
import { CatalogPreviewFrame } from "../CatalogPreviewFrame";

async function previewWorkspace(): Promise<CatalogWorkspace> {
  return new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:frame" as EntryId<"project">,
        name: "Frame",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `preview-frame-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
}

describe("Compare Mode Preview frame", () => {
  it("takes the breakpoint's page width and height at every breakpoint, desktop included", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:frame" as EntryId<"project">,
          name: "Frame",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `preview-frame-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1000, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const view = render(
      <CatalogWorkspaceProvider workspace={workspace}>
        <CatalogPreviewFrame workspace={workspace} />
      </CatalogWorkspaceProvider>,
    );
    const frame = () =>
      view.container.querySelector<HTMLElement>(".catalog-preview-frame")!;
    for (const breakpoint of [
      "desktop",
      "tablet",
      "mobile",
      "desktop",
    ] as const) {
      act(() => workspace.setBreakpoint(breakpoint));
      expect(frame().style.width).toBe(
        `${CANVAS_VIEWPORT[breakpoint].width}px`,
      );
      expect(frame().style.height).toBe(
        `${CANVAS_VIEWPORT[breakpoint].height}px`,
      );
    }
    view.unmount();
    workspace.dispose();
  });

  it("sits where the Canvas draws the open page: its frame size at the Canvas camera", async () => {
    const workspace = await previewWorkspace();
    const view = render(
      <CatalogWorkspaceProvider workspace={workspace}>
        <CatalogPreviewFrame workspace={workspace} />
      </CatalogWorkspaceProvider>,
    );
    const box = () =>
      view.container.querySelector<HTMLElement>(".catalog-preview-frame")!;
    const { pageId } = workspace.session.getSnapshot();
    const page = workspace.runtime.graph.getEntry(pageId!);
    const body = (page?.kind === "page" ? page.children[0] : undefined) as
      | NodeId
      | undefined;
    try {
      // A page taller than the breakpoint viewport: the box follows the Canvas page box.
      act(() => {
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: body! }],
            sizing: { height: { kind: "set", value: 1600 } },
          }),
        );
      });
      const rect = workspace.root.pageFrameRects().get(pageId!)!;
      expect(rect.height).toBe(1600);
      expect(box().style.width).toBe(`${rect.width}px`);
      expect(box().style.height).toBe("1600px");
      // The Canvas camera: screen = world × scale + (x, y).
      act(() => {
        publishViewportPresentation({ x: 40, y: -30, scale: 0.5 });
      });
      expect(box().style.transform).toBe(
        `translate(${40 + rect.x * 0.5}px, ${-30 + rect.y * 0.5}px) scale(0.5)`,
      );
      expect(box().style.width).toBe(`${rect.width}px`);
      // A breakpoint switch replaces the root: the box follows the new page box.
      act(() => workspace.setBreakpoint("mobile"));
      const mobile = workspace.root.pageFrameRects().get(pageId!)!;
      expect(box().style.width).toBe(`${mobile.width}px`);
      expect(box().style.transform).toBe(
        `translate(${40 + mobile.x * 0.5}px, ${-30 + mobile.y * 0.5}px) scale(0.5)`,
      );
    } finally {
      act(() => resetViewportPresentation());
      view.unmount();
      workspace.dispose();
    }
  });
});
