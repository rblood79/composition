import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CatalogCanvasScene } from "../../../catalogRuntime/canvasScene";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { DotBackground } from "../../components/DotBackground";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import { watchContextLoss } from "../skia/createSurface";
import { destroyAllSkiaCaches } from "../skia/disposable";
import { skiaFontManager } from "../skia/fontManager";
import {
  createFrameScheduler,
  subscribeCanvasFrames,
} from "../skia/frameScheduler";
import { getCanvasKit } from "../skia/initCanvasKit";
import { SkiaRenderer } from "../skia/SkiaRenderer";
import { getRegistryVersion } from "../skia/useSkiaNode";
import { ViewportControlBridge } from "../viewport";
import { getViewportController } from "../viewport/ViewportController";
import { computeFitViewport } from "../viewport/viewportActions";
import { viewportState } from "../viewport/viewportState";

export interface CatalogCanvasProps {
  workspace: CatalogWorkspace;
  /** The first frame reached the screen (boot readiness). */
  onFirstFrame?: () => void;
  /** The scene could not follow a step (an explicit binding failure): shown by the host. */
  onError?: (error: unknown) => void;
}

/**
 * ADR-248 Phase 4e-2: the Builder Canvas of one open project. The scene is the workspace's
 * composition root bound into one command stream (`CatalogCanvasScene`); each published step
 * patches it (or binds it again) and invalidates the renderer. The renderer, frame scheduler and
 * viewport controller are the existing CanvasKit ones.
 */
export function CatalogCanvas({
  workspace,
  onFirstFrame,
  onError,
}: CatalogCanvasProps) {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gestureSession] = useState(() => new CanvasGestureSession());
  const callbacks = useRef({ onFirstFrame, onError });
  useLayoutEffect(() => {
    callbacks.current = { onFirstFrame, onError };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerEl) return;
    const ck = getCanvasKit();
    let dpr = window.devicePixelRatio || 1;
    const fit = () => {
      const rect = containerEl.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      return rect;
    };
    const containerRect = fit();
    const renderer = new SkiaRenderer(ck, canvas, dpr);
    let scene: CatalogCanvasScene;
    try {
      scene = new CatalogCanvasScene(workspace.root);
    } catch (error) {
      renderer.dispose();
      callbacks.current.onError?.(error);
      return;
    }
    renderer.setContentNode(
      scene.contentNode(ck, () =>
        skiaFontManager.getFamilies().length > 0
          ? skiaFontManager.getFontMgr()
          : undefined,
      ),
    );

    // Open on the first page frame.
    const [firstPage] = workspace.root.pageFrameRects().values();
    if (firstPage) {
      const fitted = computeFitViewport({
        canvasSize: firstPage,
        containerSize: containerRect,
      });
      getViewportController().setPosition(
        fitted.x - firstPage.x * fitted.scale,
        fitted.y - firstPage.y * fitted.scale,
        fitted.scale,
      );
    }

    let running = true;
    let presented = false;
    let contextLost = false;
    const renderFrame = () => {
      if (!running || contextLost) return;
      const zoom = Math.max(viewportState.zoom, 0.001);
      const camera = { zoom, panX: viewportState.x, panY: viewportState.y };
      const drawn = renderer.render(
        new DOMRect(
          -camera.panX / zoom,
          -camera.panY / zoom,
          canvas.width / dpr / zoom,
          canvas.height / dpr / zoom,
        ),
        getRegistryVersion(),
        camera,
        0,
        0,
      );
      if (drawn && !presented) {
        presented = true;
        callbacks.current.onFirstFrame?.();
      }
      if (renderer.needsAnimationFrame()) scheduler.invalidate();
    };
    const scheduler = createFrameScheduler(renderFrame);
    const unsubscribeFrames = subscribeCanvasFrames(scheduler.invalidate);
    const unsubscribeSteps = workspace.runtime.subscribeSteps(() => {
      try {
        if (scene.sync().kind !== "unchanged") renderer.invalidateContent();
      } catch (error) {
        callbacks.current.onError?.(error);
      }
    });
    const updatePaused = () => {
      scheduler.setPaused(document.hidden || contextLost);
      scheduler.invalidate();
    };
    document.addEventListener("visibilitychange", updatePaused);
    const unwatchContext = watchContextLoss(
      canvas,
      () => {
        contextLost = true;
        updatePaused();
      },
      () => {
        contextLost = false;
        renderer.resize(canvas);
        renderer.invalidateContent();
        renderer.clearFrame();
        updatePaused();
      },
    );
    const resize = new ResizeObserver(() => {
      dpr = window.devicePixelRatio || 1;
      fit();
      renderer.resize(canvas);
      renderer.invalidateContent();
      renderer.clearFrame();
    });
    resize.observe(containerEl);
    renderer.invalidateContent();
    updatePaused();

    return () => {
      running = false;
      resize.disconnect();
      unwatchContext();
      document.removeEventListener("visibilitychange", updatePaused);
      unsubscribeSteps();
      unsubscribeFrames();
      scheduler.dispose();
      scene.dispose();
      renderer.dispose();
    };
  }, [workspace, containerEl]);

  // Module caches (pictures, paints, images) are released when the Canvas leaves.
  useEffect(() => () => destroyAllSkiaCaches(), []);

  return (
    <div
      ref={setContainerEl}
      className="canvas-container"
      data-canvas-container="true"
      data-catalog-canvas="true"
      tabIndex={-1}
    >
      <canvas
        ref={canvasRef}
        data-testid="skia-canvas-unified"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "auto",
        }}
      />
      <DotBackground />
      {containerEl && (
        <ViewportControlBridge
          containerEl={containerEl}
          minZoom={0.1}
          maxZoom={5}
          gestureSession={gestureSession}
        />
      )}
    </div>
  );
}
