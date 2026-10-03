import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useCatalogSession } from "../../../catalogRuntime/react";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { CANVAS_VIEWPORT } from "../../canvasBreakpoints";
import { PanelSplitter } from "../../../layout/PanelSplitter";
import { useWorkspaceCompareSplit } from "../../hooks/useWorkspaceCompareSplit";
import { useOptionalI18n } from "../../../../i18n";
import { toProjectVariableDefs, useDataStore } from "../../../stores/data";
import { runAutoPolicyEndpoints } from "../../../panels/datatable/hooks/useExecutionPolicyScheduler";
import { toRuntimeApiEndpoint } from "@composition/shared";
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
 * Builder side of the payload is the workspace's Preview channel (`attachPreview`): the iframe's `PREVIEW_READY` (this
 * frame's window, this origin — the old bootstrap check) sends a snapshot and the editor's page,
 * then each step's delta goes once per frame. A snapshot request is taken only from this frame.
 * The data store's collections, project variables and API endpoints (runtime projection, secret
 * references only) go with the snapshot and on each change (bound rows, `{{ }}` values, FileUpload
 * endpoints — H1).
 */
export function CatalogPreviewFrame({
  workspace,
}: {
  workspace: CatalogWorkspace;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const origin = window.location.origin;
    const channel = workspace.attachPreview({
      post: (message) =>
        frameRef.current?.contentWindow?.postMessage(message, origin),
      schedule: (flush) => requestAnimationFrame(flush),
    });
    const followView = () => {
      const { pageId, breakpoint } = workspace.session.getSnapshot();
      channel.setView(pageId, breakpoint);
    };
    followView();
    const offSession = workspace.session.subscribe(followView);
    let ready = false;
    const sendData = () =>
      frameRef.current?.contentWindow?.postMessage(
        {
          type: "CATALOG_DATA",
          version: CATALOG_PREVIEW_PAYLOAD_VERSION,
          collections: previewCollections(),
          variables: toProjectVariableDefs(useDataStore.getState().variables),
          apiEndpoints: [...useDataStore.getState().apiEndpoints.values()].map(
            toRuntimeApiEndpoint,
          ),
        },
        origin,
      );
    const offData = useDataStore.subscribe(
      (store) =>
        [store.collections, store.variables, store.apiEndpoints] as const,
      () => {
        if (ready) sendData();
      },
      {
        equalityFn: (left, right) =>
          left[0] === right[0] && left[1] === right[1] && left[2] === right[2],
      },
    );
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current?.contentWindow;
      if (!frame || event.source !== frame || event.origin !== origin) return;
      const data = event.data as {
        type?: unknown;
        identity?: unknown;
        sourceId?: unknown;
        additive?: unknown;
      } | null;
      if (data?.type === "PREVIEW_READY") {
        ready = true;
        sendData();
        channel.onReady();
      } else if (data?.type === "CATALOG_SELECT") {
        // A click in the Preview selects the element on the Canvas (⌘ toggles) — the record by
        // identity when the two roots agree, else the first record of its source.
        const identity =
          typeof data.identity === "string" &&
          workspace.root.domInputs.has(data.identity)
            ? data.identity
            : typeof data.sourceId === "string"
              ? workspace.root.recordsOfSource(data.sourceId)[0]
              : undefined;
        if (identity)
          workspace.selectRecords([identity], {
            additive: data.additive === true,
          });
      } else channel.onPreviewMessage(event.data);
    };
    window.addEventListener("message", onMessage);
    // ADR-218 auto policy: Preview opening runs each auto collection's endpoint once (the rows
    // reach the frame through the data subscription above).
    void runAutoPolicyEndpoints();
    return () => {
      window.removeEventListener("message", onMessage);
      offData();
      offSession();
      workspace.detachPreview();
    };
  }, [workspace]);
  // The old compare-mode iframe took the breakpoint's frame width (tablet 768 · mobile 390); the
  // desktop Preview fills the pane as before.
  const breakpoint = useCatalogSession((state) => state.breakpoint);
  const width =
    breakpoint === "desktop"
      ? "100%"
      : `${CANVAS_VIEWPORT[breakpoint].width}px`;
  return (
    <div
      className="catalog-preview-frame"
      data-breakpoint={breakpoint}
      style={{ width }}
    >
      <iframe
        ref={frameRef}
        id="previewFrame"
        src="/preview.html?catalog=1"
        title="composition Preview"
      />
    </div>
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
