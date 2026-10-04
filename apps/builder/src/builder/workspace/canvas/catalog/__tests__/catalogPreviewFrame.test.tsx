// @vitest-environment jsdom
/**
 * Compare Mode's CSS side renders the Preview at the editor's breakpoint width — the width the
 * Canvas draws the page at (`CANVAS_VIEWPORT`). Desktop included: the frame filled the pane
 * (2026-10-04 user report 「compare 모드에서 css 는 breakpoint 가 미적용」 — desktop CSS 834px beside a
 * 1920px Canvas page).
 */
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../../../../catalogRuntime/project";
import { CatalogWorkspaceProvider } from "../../../../catalogRuntime/react";
import { CatalogStorage } from "../../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { CANVAS_VIEWPORT } from "../../../canvasBreakpoints";
import { CatalogPreviewFrame } from "../CatalogPreviewFrame";

describe("Compare Mode Preview frame", () => {
  it("takes the breakpoint's page width at every breakpoint, desktop included", async () => {
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
    }
    view.unmount();
    workspace.dispose();
  });
});
