import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { CANVAS_VIEWPORT } from "../../canvasBreakpoints";
import {
  getViewportPresentationSnapshot,
  subscribeViewportPresentation,
} from "../viewport/viewportPresentation";
import { PanelSplitter } from "../../../layout/PanelSplitter";
import { useWorkspaceCompareSplit } from "../../hooks/useWorkspaceCompareSplit";
import { useOptionalI18n } from "../../../../i18n";
import { useDataStore } from "../../../stores/data";
import { runAutoPolicyEndpoints } from "../../../panels/datatable/hooks/useExecutionPolicyScheduler";
import { CATALOG_PREVIEW_PAYLOAD_VERSION } from "../../../../../../../packages/shared/src/catalog/preview/protocol";
import { CATALOG_TOUCH_VIEW_MESSAGE } from "../../../../../../../packages/shared/src/catalog/runtime/themeVarsCss";
import { useCompareModeStore } from "../stores/compareMode";

const PREVIEW_PANE_ID = "workspace-compare-panel-css";

/**
 * Place the Preview box where the Canvas draws the open page: the page frame's size
 * (`root.pageFrameRects` — it grows with the content) at the Canvas camera (`screen = world ×
 * scale + (x, y)`, in the pane). Without a page frame (a definition edit view) the breakpoint
 * viewport at the world origin. Written on the elements, not through React: a pan publishes the
 * camera every frame.
 */
function followCatalogPageFrame(
  workspace: CatalogWorkspace,
  box: HTMLElement,
): () => void {
  const place = () => {
    const { pageId, breakpoint } = workspace.session.getSnapshot();
    const rect = (pageId
      ? workspace.root.pageFrameRects().get(pageId)
      : undefined) ?? { x: 0, y: 0, ...CANVAS_VIEWPORT[breakpoint] };
    const camera = getViewportPresentationSnapshot();
    const width = `${rect.width}px`;
    const height = `${rect.height}px`;
    const transform = `translate(${camera.x + rect.x * camera.scale}px, ${
      camera.y + rect.y * camera.scale
    }px) scale(${camera.scale})`;
    if (box.style.width !== width) box.style.width = width;
    if (box.style.height !== height) box.style.height = height;
    if (box.style.transform !== transform) box.style.transform = transform;
  };
  place();
  // A zoom can move the page grid (`columns: "auto"`) in the Canvas frame after the camera.
  let frame = 0;
  const placeAfterCanvas = () => {
    place();
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        place();
      });
  };
  let offPreviews = workspace.root.subscribePreviews(place);
  const offRoot = workspace.subscribeRoot(() => {
    offPreviews();
    offPreviews = workspace.root.subscribePreviews(place);
    place();
  });
  const offSession = workspace.session.subscribe(place);
  const offSteps = workspace.runtime.subscribeSteps(() => place());
  const offRows = workspace.subscribeRows(place);
  const offCamera = subscribeViewportPresentation(placeAfterCanvas);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    offPreviews();
    offRoot();
    offSession();
    offSteps();
    offRows();
    offCamera();
  };
}

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
    // ADR-286 R7: the definitions reach the Preview as document deltas; this channel carries the
    // API rows only (`runtimeData` — the data store's cache, never the document).
    const sendData = () => {
      const { runtimeRows } = useDataStore.getState();
      frameRef.current?.contentWindow?.postMessage(
        {
          type: "CATALOG_DATA",
          version: CATALOG_PREVIEW_PAYLOAD_VERSION,
          collections: [...runtimeRows].map(([id, runtimeData]) => ({
            id,
            runtimeData,
          })),
        },
        origin,
      );
    };
    // ADR-295 사용자 결정 4: 「터치 크기로 미리보기」 — Preview root 가 터치 벌을 쓴다 (Canvas 는 desktop).
    const sendTouchView = () =>
      frameRef.current?.contentWindow?.postMessage(
        {
          type: CATALOG_TOUCH_VIEW_MESSAGE,
          touch: useCompareModeStore.getState().previewTouch,
        },
        origin,
      );
    const offTouchView = useCompareModeStore.subscribe((state, previous) => {
      if (ready && state.previewTouch !== previous.previewTouch)
        sendTouchView();
    });
    const offData = useDataStore.subscribe(
      (store) => store.runtimeRows,
      () => {
        if (ready) sendData();
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
        sendTouchView();
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
      } else if (data?.type === "CATALOG_STATE_VALUES") {
        // ADR-284 Decision 11: what the running Preview's variables hold (a filter's detail).
        const values = (data as { values?: unknown }).values;
        if (values && typeof values === "object")
          workspace.setPreviewValues(values as Record<string, unknown>);
      } else channel.onPreviewMessage(event.data);
    };
    window.addEventListener("message", onMessage);
    // ADR-218 auto policy: Preview opening runs each auto collection's endpoint once (the rows
    // reach the frame through the data subscription above).
    void runAutoPolicyEndpoints();
    return () => {
      window.removeEventListener("message", onMessage);
      offTouchView();
      offData();
      offSession();
      workspace.detachPreview();
    };
  }, [workspace]);
  // Canvas 가 열린 page 를 그리는 자리 · 크기 · zoom 그대로 Preview 를 놓는다 (pane 기준).
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(
    () => followCatalogPageFrame(workspace, boxRef.current!),
    [workspace],
  );
  return (
    <div ref={boxRef} className="catalog-preview-frame">
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
