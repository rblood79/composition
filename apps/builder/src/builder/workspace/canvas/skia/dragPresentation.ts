/**
 * Element drag presentation lane.
 *
 * Drag start에서 command stream은 대상 subtree를 tail top-layer로 한 번 분리한다.
 * content surface에는 그 앞의 정적 배경만 기록하고, 대상 subtree는 root별
 * SkPicture로 한 번 retain한다. 이후 pointermove는 picture translate만 바꾼다.
 */
import type {
  Canvas,
  CanvasKit,
  FontMgr,
  Image as SkImage,
  SkPicture,
} from "canvaskit-wasm";
import type { SkiaRenderable } from "./types";
import {
  DRAG_ELEMENT_ALPHA,
  executeRenderCommands,
  type RenderCommand,
  type RenderCommandStream,
} from "./renderCommands";
import {
  getDragVisualOffset,
  setDragPresentationRetained,
} from "./nodeRendererTree";
import { getSkImage } from "./imageCache";
import {
  clearDragSubtreePictureCache,
  ensureNodePictureFontGeneration,
  getCachedDragSubtreePicture,
  prepareDragSubtreePictureCache,
  storeDragSubtreePicture,
} from "./nodePictureCache";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { incrementDrawCall } from "./drawStats";
import {
  getPagePositionPresentationSnapshot,
  type PagePositionPresentationSnapshot,
} from "../interaction/pagePositionPresentation";

const RECORD_EXTENT = 1_000_000_000;
const RECORD_BOUNDS = {
  x: -RECORD_EXTENT,
  y: -RECORD_EXTENT,
  width: RECORD_EXTENT * 2,
  height: RECORD_EXTENT * 2,
} as DOMRect;

export interface DragPresentationRoot {
  elementId: string;
  start: number;
  end: number;
}

export interface DragPresentationPlan {
  stream: RenderCommandStream;
  registryVersion: number;
  /** 정적 content가 실행할 command tail(exclusive). */
  backgroundCommandEnd: number;
  roots: readonly DragPresentationRoot[];
}

/**
 * 현재 drag target의 top-layer spans가 command tail을 연속으로 이루는지 검증한다.
 * 불변식이 깨지면 null로 반환해 기존 full-content 경로로 안전하게 폴백한다.
 */
export function buildDragPresentationPlan(
  stream: RenderCommandStream,
  registryVersion: number,
): DragPresentationPlan | null {
  const drag = getDragVisualOffset();
  if (!drag) {
    setDragPresentationRetained(false);
    clearDragSubtreePictureCache();
    return null;
  }

  const roots: DragPresentationRoot[] = [];
  for (const elementId of drag.elementIds) {
    const span = stream.subtreeSpans.get(elementId);
    if (!span || !stream.topLayerElementIds.has(elementId)) continue;
    const parentId =
      stream.subtreeBuildContextByElement.get(elementId)?.parentElementId ??
      null;
    if (parentId && stream.topLayerElementIds.has(parentId)) continue;
    roots.push({ elementId, start: span.start, end: span.end });
  }
  roots.sort((left, right) => left.start - right.start);
  if (roots.length === 0) {
    setDragPresentationRetained(false);
    clearDragSubtreePictureCache();
    return null;
  }

  let cursor = roots[0]!.start;
  for (const root of roots) {
    if (root.start !== cursor || root.end <= root.start) {
      setDragPresentationRetained(false);
      clearDragSubtreePictureCache();
      return null;
    }
    cursor = root.end;
  }
  if (cursor !== stream.commands.length) {
    setDragPresentationRetained(false);
    clearDragSubtreePictureCache();
    return null;
  }

  setDragPresentationRetained(true);
  return {
    stream,
    registryVersion,
    backgroundCommandEnd: roots[0]!.start,
    roots,
  };
}

export function collectDragPictureDependencies(
  commands: RenderCommand[],
  start: number,
  end: number,
  resolveImage: (url: string) => SkImage | null = getSkImage,
): { imageRefs: SkImage[] | null; elementIds: ReadonlySet<string> } {
  let refs: Set<SkImage> | null = null;
  const elementIds = new Set<string>();
  for (let index = start; index < end; index += 1) {
    const command = commands[index];
    if ("elementId" in command && command.elementId) {
      elementIds.add(command.elementId);
    }
    if ("skiaData" in command) {
      const image = command.skiaData.image?.skImage;
      if (image) (refs ??= new Set()).add(image);
    }
    if (
      "maskImage" in command &&
      command.maskImage?.type === "image" &&
      command.maskImage.imageUrl
    ) {
      const maskImage = resolveImage(command.maskImage.imageUrl);
      if (maskImage) (refs ??= new Set()).add(maskImage);
    }
  }
  return { imageRefs: refs ? [...refs] : null, elementIds };
}

function recordRootPicture(
  ck: CanvasKit,
  plan: DragPresentationPlan,
  root: DragPresentationRoot,
  fontMgr: FontMgr | undefined,
  pageRootPageIds: ReadonlyMap<string, string>,
  pagePositionSnapshot: PagePositionPresentationSnapshot,
): SkPicture | null {
  const recorder = new ck.PictureRecorder();
  try {
    const canvas = recorder.beginRecording(
      ck.LTRBRect(-RECORD_EXTENT, -RECORD_EXTENT, RECORD_EXTENT, RECORD_EXTENT),
    );
    executeRenderCommands(
      ck,
      canvas,
      plan.stream.commands,
      RECORD_BOUNDS,
      fontMgr,
      undefined,
      pageRootPageIds,
      pagePositionSnapshot,
      {
        start: root.start,
        end: root.end,
        dragPresentationOverride: { dx: 0, dy: 0, applyAlpha: false },
      },
    );
    return recorder.finishRecordingAsPicture() ?? null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[dragPresentation] subtree picture record 실패 — direct draw 폴백:",
        root.elementId,
        error,
      );
    }
    return null;
  } finally {
    recorder.delete();
  }
}

function drawRetainedRoot(
  ck: CanvasKit,
  canvas: Canvas,
  picture: SkPicture,
  dx: number,
  dy: number,
  applyAlpha: boolean,
): void {
  canvas.save();
  canvas.translate(dx, dy);
  if (applyAlpha) {
    const paint = acquirePooledPaint(ck);
    paint.setAlphaf(DRAG_ELEMENT_ALPHA);
    canvas.saveLayer(paint);
    releasePooledPaint(paint);
  }
  canvas.drawPicture(picture);
  if (process.env.NODE_ENV === "development") incrementDrawCall();
  if (applyAlpha) canvas.restore();
  canvas.restore();
}

/** drag subtree를 regular chrome보다 먼저 그리는 overlay node를 만든다. */
export function buildDragPresentationNode(
  ck: CanvasKit,
  plan: DragPresentationPlan,
  fontMgr: FontMgr | undefined,
  pageRootPageIds: ReadonlyMap<string, string>,
): SkiaRenderable {
  const activeElementIds = getDragVisualOffset()?.elementIds;
  prepareDragSubtreePictureCache(
    plan.stream,
    plan.registryVersion,
    activeElementIds ?? new Set<string>(),
  );
  return {
    renderSkia(canvas, cullingBounds) {
      ensureNodePictureFontGeneration(fontMgr ?? null);
      const drag = getDragVisualOffset();
      const pagePositionSnapshot = getPagePositionPresentationSnapshot();

      for (const root of plan.roots) {
        const active = drag?.elementIds.has(root.elementId) ?? false;
        let picture = getCachedDragSubtreePicture(
          root.elementId,
          plan.stream,
          plan.registryVersion,
        );
        if (!picture) {
          picture = recordRootPicture(
            ck,
            plan,
            root,
            fontMgr,
            pageRootPageIds,
            pagePositionSnapshot,
          );
          if (picture) {
            const dependencies = collectDragPictureDependencies(
              plan.stream.commands,
              root.start,
              root.end,
            );
            storeDragSubtreePicture(
              root.elementId,
              plan.stream,
              plan.registryVersion,
              picture,
              dependencies.imageRefs,
              dependencies.elementIds,
            );
          }
        }

        if (picture) {
          drawRetainedRoot(
            ck,
            canvas,
            picture,
            active ? (drag?.dx ?? 0) : 0,
            active ? (drag?.dy ?? 0) : 0,
            active,
          );
          continue;
        }

        // PictureRecorder 실패 시 정확성을 우선해 기존 direct subtree 실행으로 수렴.
        executeRenderCommands(
          ck,
          canvas,
          plan.stream.commands,
          cullingBounds,
          fontMgr,
          undefined,
          pageRootPageIds,
          pagePositionSnapshot,
          { start: root.start, end: root.end },
        );
      }
    },
  };
}
