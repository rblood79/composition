import {
  type ViewportController,
  type ViewportState,
} from "./ViewportController";

export type ViewportInteractionKind =
  | "drag"
  | "wheel-pan"
  | "wheel-zoom"
  | "discrete"
  | "programmatic";

export type ViewportInteractionFinishReason =
  | "pointerup"
  | "idle"
  | "discrete"
  | "interrupted";

export interface ViewportFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

interface PanOperation {
  delta: { x: number; y: number };
  type: "pan";
}

interface ZoomOperation {
  anchor: { x: number; y: number };
  delta: number;
  type: "zoom";
}

type ViewportOperation = PanOperation | ZoomOperation;

export interface ViewportInteractionSessionOptions {
  commitMirror(state: ViewportState): void;
  controller: ViewportController;
  readMirror(): ViewportState;
  scheduler?: ViewportFrameScheduler;
}

const browserFrameScheduler: ViewportFrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

function isViewportStateEqual(
  left: ViewportState,
  right: ViewportState,
): boolean {
  return left.x === right.x && left.y === right.y && left.scale === right.scale;
}

/**
 * 연속 viewport input의 transient controller 적용과 canonical mirror commit을 분리한다.
 *
 * Phase 1에서는 adapter를 이관하지 않는다. 이 class의 contract test가 이후 drag/wheel과
 * external command가 공유할 단일 scheduling path를 고정한다.
 */
export class ViewportInteractionSession {
  private activeKind: ViewportInteractionKind | null = null;
  private pendingOperations: ViewportOperation[] = [];
  private rafHandle: number | null = null;

  private readonly commitMirror: (state: ViewportState) => void;
  private readonly controller: ViewportController;
  private readonly readMirror: () => ViewportState;
  private readonly scheduler: ViewportFrameScheduler;

  constructor(options: ViewportInteractionSessionOptions) {
    this.commitMirror = options.commitMirror;
    this.controller = options.controller;
    this.readMirror = options.readMirror;
    this.scheduler = options.scheduler ?? browserFrameScheduler;
  }

  begin(kind: ViewportInteractionKind): void {
    if (this.activeKind && this.activeKind !== kind) {
      this.finish("interrupted");
    }
    this.activeKind = kind;
  }

  isActive(): boolean {
    return this.activeKind !== null;
  }

  queuePan(delta: { x: number; y: number }): void {
    this.assertActive();
    this.pendingOperations.push({ delta, type: "pan" });
    this.scheduleFrame();
  }

  queueZoomAt(input: {
    anchor: { x: number; y: number };
    delta: number;
  }): void {
    this.assertActive();
    this.pendingOperations.push({ ...input, type: "zoom" });
    this.scheduleFrame();
  }

  flushFrame(): boolean {
    this.cancelScheduledFrame();
    if (this.pendingOperations.length === 0) return false;

    const operations = this.pendingOperations;
    this.pendingOperations = [];
    const nextState = this.applyOperations(
      this.controller.getState(),
      operations,
    );
    return this.controller.setPosition(
      nextState.x,
      nextState.y,
      nextState.scale,
    );
  }

  finish(reason: ViewportInteractionFinishReason): void {
    if (!this.activeKind) return;

    this.flushFrame();
    this.activeKind = null;
    this.commitCurrentStateIfChanged(reason);
  }

  runCommand(command: (state: ViewportState) => ViewportState): void {
    if (this.activeKind) {
      this.finish("interrupted");
    }

    const nextState = command(this.controller.getState());
    const changed = this.controller.setPosition(
      nextState.x,
      nextState.y,
      nextState.scale,
    );
    if (changed) {
      this.commitCurrentStateIfChanged("discrete");
    }
  }

  private applyOperations(
    initialState: ViewportState,
    operations: ViewportOperation[],
  ): ViewportState {
    let state = initialState;

    for (const operation of operations) {
      if (operation.type === "pan") {
        state = {
          ...state,
          x: state.x + operation.delta.x,
          y: state.y + operation.delta.y,
        };
        continue;
      }

      const nextScale = this.controller.clampZoom(
        state.scale * (1 + operation.delta),
      );
      if (nextScale === state.scale) continue;

      const zoomRatio = nextScale / state.scale;
      state = {
        scale: nextScale,
        x: operation.anchor.x - (operation.anchor.x - state.x) * zoomRatio,
        y: operation.anchor.y - (operation.anchor.y - state.y) * zoomRatio,
      };
    }

    return state;
  }

  private assertActive(): void {
    if (!this.activeKind) {
      throw new Error("Viewport interaction session has not begun");
    }
  }

  private cancelScheduledFrame(): void {
    if (this.rafHandle === null) return;
    this.scheduler.cancel(this.rafHandle);
    this.rafHandle = null;
  }

  private commitCurrentStateIfChanged(
    _reason: ViewportInteractionFinishReason,
  ): void {
    const current = this.controller.getState();
    if (isViewportStateEqual(current, this.readMirror())) return;
    this.commitMirror(current);
  }

  private scheduleFrame(): void {
    if (this.rafHandle !== null) return;
    this.rafHandle = this.scheduler.request(() => {
      this.rafHandle = null;
      this.flushFrame();
    });
  }
}
