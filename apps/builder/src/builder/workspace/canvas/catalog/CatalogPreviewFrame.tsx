import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { CatalogPreviewChannel } from "../../../catalogRuntime/previewChannel";
import { PanelSplitter } from "../../../layout/PanelSplitter";
import { useWorkspaceCompareSplit } from "../../hooks/useWorkspaceCompareSplit";
import { useOptionalI18n } from "../../../../i18n";
import { useDataStore } from "../../../stores/data";
import { CATALOG_PREVIEW_PAYLOAD_VERSION } from "../../../../../../../packages/shared/src/catalog/preview/protocol";

/** The collections as the Preview reads them (the old Preview channel's projection). */
function previewCollections() {
  return [...useDataStore.getState().collections.values()].map((table) => ({
    id: table.id,
    name: table.name,
    schema: table.schema,
    mockData: table.mockData ?? [],
    runtimeData: table.runtimeData,
    useMockData: table.useMockData,
  }));
}

const PREVIEW_PANE_ID = "workspace-compare-panel-css";

/**
 * ADR-248 4e-6: the Preview iframe of the open catalog project (`preview.html?catalog=1`). The
 * Builder side of the payload is `CatalogPreviewChannel`: the iframe's `PREVIEW_READY` (this
 * frame's window, this origin — the old bootstrap check) sends a snapshot and the editor's page,
 * then each step's delta goes once per frame. A snapshot request is taken only from this frame.
 * The data store's collections go with the snapshot and on each change (bound rows, H1).
 */
export function CatalogPreviewFrame({
  workspace,
}: {
  workspace: CatalogWorkspace;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const origin = window.location.origin;
    const channel = new CatalogPreviewChannel(workspace.runtime, {
      post: (message) =>
        frameRef.current?.contentWindow?.postMessage(message, origin),
      schedule: (flush) => requestAnimationFrame(flush),
    });
    const followPage = () =>
      channel.setPage(workspace.session.getSnapshot().pageId);
    followPage();
    const offSession = workspace.session.subscribe(followPage);
    let ready = false;
    const sendData = () =>
      frameRef.current?.contentWindow?.postMessage(
        {
          type: "CATALOG_DATA",
          version: CATALOG_PREVIEW_PAYLOAD_VERSION,
          collections: previewCollections(),
        },
        origin,
      );
    const offData = useDataStore.subscribe(
      (store) => store.collections,
      () => {
        if (ready) sendData();
      },
    );
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== origin) return;
      if ((event.data as { type?: unknown } | null)?.type === "PREVIEW_READY") {
        ready = true;
        sendData();
        channel.onReady();
      } else channel.onPreviewMessage(event.data);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      offData();
      offSession();
      channel.dispose();
    };
  }, [workspace]);
  return (
    <iframe
      ref={frameRef}
      id="previewFrame"
      src="/preview.html?catalog=1"
      title="composition Preview"
    />
  );
}

/** Compare Mode: the Preview (left) and the Canvas (right), split as the old Workspace did. */
export function CatalogCompareLayout({
  workspace,
  canvas,
}: {
  workspace: CatalogWorkspace;
  canvas: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    compareSplit,
    splitter,
    handleResizeStart,
    handleResize,
    handleResizeEnd,
  } = useWorkspaceCompareSplit({ containerRef });
  const i18n = useOptionalI18n();
  return (
    <div
      ref={containerRef}
      className="workspace-mode-content workspace--compare-mode"
      style={{ "--compare-split": `${compareSplit}%` } as CSSProperties}
    >
      <div
        id={PREVIEW_PANE_ID}
        className="workspace-compare-panel workspace-compare-panel--left"
      >
        <div className="workspace-compare-label">CSS</div>
        <div className="workspace-compare-content">
          <CatalogPreviewFrame workspace={workspace} />
        </div>
      </div>
      <div className="workspace-compare-resizer">
        <PanelSplitter
          edge="right"
          label={
            i18n
              ? i18n.t("workspace.resizeCompare")
              : "Resize the CSS / Canvas compare split"
          }
          controls={PREVIEW_PANE_ID}
          value={splitter.value}
          minValue={splitter.minValue}
          maxValue={splitter.maxValue}
          className="workspace-compare-splitter"
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
        />
      </div>
      <div className="workspace-compare-panel workspace-compare-panel--right">
        <div className="workspace-compare-label">Canvas</div>
        <div className="workspace-compare-content">{canvas}</div>
      </div>
    </div>
  );
}
