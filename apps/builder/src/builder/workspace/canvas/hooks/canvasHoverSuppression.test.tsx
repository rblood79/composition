// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { MutableRefObject, RefObject } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import type { BoundingBox } from "../selection/types";
import {
  DEFAULT_MINIMAP_CONFIG,
  type MinimapConfig,
} from "../skia/workflowMinimap";
import type { PageFrame } from "../skia/workflowRenderer";
import {
  useElementHoverInteraction,
  type ElementHoverState,
} from "./useElementHoverInteraction";
import {
  useWorkflowInteraction,
  type WorkflowHoverState,
} from "./useWorkflowInteraction";
import type { CachedEdgeGeometry } from "../skia/workflowHitTest";

function mutableRef<T>(current: T): MutableRefObject<T> {
  return { current } as MutableRefObject<T>;
}

function readOnlyRef<T>(current: T): RefObject<T> {
  return { current } as RefObject<T>;
}

afterEach(() => {
  cleanup();
});

describe("canvas hover suppression", () => {
  it("Space keydown만으로 element hover를 즉시 비운다", () => {
    const gestureSession = new CanvasGestureSession();
    const hoverStateRef = mutableRef<ElementHoverState>({
      hoveredElementId: "button-1",
      hoveredLeafIds: ["button-1"],
      isGroupHover: false,
    });
    const overlayVersionRef = mutableRef(0);

    renderHook(() =>
      useElementHoverInteraction({
        containerEl: document.createElement("div"),
        gestureSession,
        getHoverElementsMap: () => new Map<string, CanvasInteractionNode>(),
        getHoverChildrenMap: () =>
          new Map<string, ReadonlyArray<{ id: string }>>(),
        hoverStateRef,
        overlayVersionRef,
        hitBoundsMapRef: readOnlyRef(new Map<string, BoundingBox>()),
      }),
    );

    act(() => {
      gestureSession.setSpacePressed(true);
    });

    expect(hoverStateRef.current).toEqual({
      hoveredElementId: null,
      hoveredLeafIds: [],
      isGroupHover: false,
    });
    expect(overlayVersionRef.current).toBe(1);
  });

  it("Space keydown만으로 workflow edge hover를 즉시 비운다", () => {
    const gestureSession = new CanvasGestureSession();
    const hoverStateRef = mutableRef<WorkflowHoverState>({
      hoveredEdgeId: "edge-1",
    });
    const overlayVersionRef = mutableRef(0);

    renderHook(() =>
      useWorkflowInteraction({
        containerEl: document.createElement("div"),
        gestureSession,
        edgeGeometryCacheRef: readOnlyRef([] as CachedEdgeGeometry[]),
        pageFrameMapRef: readOnlyRef(new Map<string, PageFrame>()),
        hoverStateRef,
        overlayVersionRef,
        minimapConfigRef: readOnlyRef(DEFAULT_MINIMAP_CONFIG as MinimapConfig),
      }),
    );

    act(() => {
      gestureSession.setSpacePressed(true);
    });

    expect(hoverStateRef.current).toEqual({ hoveredEdgeId: null });
    expect(overlayVersionRef.current).toBe(1);
  });
});
