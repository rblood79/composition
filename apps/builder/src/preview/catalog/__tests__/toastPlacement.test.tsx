import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { useToast } from "@composition/shared/components";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setToastPlacement } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogToastProvider } from "../../../../../../packages/shared/src/catalog/runtime/domView";
import { CatalogPreviewChannel } from "../../../builder/catalogRuntime/previewChannel";
import { NullLayoutEngine } from "../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../builder/catalogRuntime/storage";
import { CatalogWorkspace } from "../../../builder/catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../builder/catalogRuntime/__tests__/support/nodeLayoutEngine";
import { CatalogPreviewSession } from "../catalogPreviewSession";

/**
 * S2 1.8.0 `ToastContainer` `placement` (`top` · `top end` · `bottom` · `bottom end`): where the
 * app's toasts show — one region per app. Ours: the project's `toastPlacement` (Settings), read by
 * the Preview's · Publish's toast region; absent = `bottom end` (the region's place before).
 */
const HOME = "project:page:home" as EntryId<"page">;

/** A toast shown in the region (the region draws nothing without one). */
function Toasted() {
  const { addToast } = useToast();
  useEffect(() => {
    addToast({ title: "Saved", timeout: 0 });
  }, [addToast]);
  return null;
}

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toast" as EntryId<"project">,
        name: "Toast placement",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `toast-placement-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const flushes: (() => void)[] = [];
  const session: CatalogPreviewSession = new CatalogPreviewSession(library, {
    requestSnapshot: (request) =>
      channel.onPreviewMessage(structuredClone(request)),
    engine: () => new NullLayoutEngine(),
    viewport: { width: 1000, height: 800 },
    stateStorage: null,
  });
  const channel = new CatalogPreviewChannel(workspace.runtime, {
    post: (message) => session.receive(structuredClone(message)),
    schedule: (flush) => flushes.push(flush),
  });
  const flush = () => act(() => flushes.splice(0).forEach((run) => run()));
  channel.setView(HOME);
  channel.onReady();
  const view = render(
    <CatalogToastProvider session={session}>
      <Toasted />
    </CatalogToastProvider>,
  );
  const region = () =>
    view.container.ownerDocument.querySelector(".react-aria-ToastRegion");
  return { workspace, flush, region };
}

describe("S2 toast placement — the project's toast region", () => {
  it("a new project's toasts show at the bottom end (the region's place before)", async () => {
    const { region } = await open();
    expect(region()?.getAttribute("data-position")).toBe("bottom-right");
  });

  it.each([
    ["top", "top-center"],
    ["top end", "top-right"],
    ["bottom", "bottom-center"],
    ["bottom end", "bottom-right"],
  ] as const)(
    "placement %s → the region at %s in the Preview",
    async (placement, position) => {
      const { workspace, flush, region } = await open();
      workspace.execute(setToastPlacement({ placement }));
      await flush();
      expect(region()?.getAttribute("data-position")).toBe(position);
    },
  );

  it("an edit is one history step — undo brings the region back", async () => {
    const { workspace, flush, region } = await open();
    workspace.execute(setToastPlacement({ placement: "top" }));
    await flush();
    expect(region()?.getAttribute("data-position")).toBe("top-center");
    workspace.undo();
    await flush();
    expect(region()?.getAttribute("data-position")).toBe("bottom-right");
  });

  it("a placement S2 does not name is refused", async () => {
    const { workspace } = await open();
    let code: unknown;
    try {
      workspace.execute(setToastPlacement({ placement: "left" as never }));
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("INVALID_TOAST_PLACEMENT");
  });
});
