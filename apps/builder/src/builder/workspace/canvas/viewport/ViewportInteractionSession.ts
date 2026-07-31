import {
  type ViewportController,
  type ViewportState,
} from "./ViewportController";

export type ViewportInteractionKind =
  | "drag"
  | "minimap"
  | "scrollbar"
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
  onControllerApply?(state: ViewportState): void;
  onFrame?(timestamp: number): void;
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
 * drag, wheel, external command adapter가 이 class를 통해 동일한 scheduling path를 공유한다.
 */
export class ViewportInteractionSession {
  private activeKind: ViewportInteractionKind | null = null;
  private pendingOperations: ViewportOperation[] = [];
  private rafHandle: number | null = null;

  private commitMirror: (state: ViewportState) => void;
  private readonly controller: ViewportController;
  private onControllerApply: ((state: ViewportState) => void) | undefined;
  private onFrame: ((timestamp: number) => void) | undefined;
  private readMirror: () => ViewportState;
  private readonly scheduler: ViewportFrameScheduler;

  constructor(options: ViewportInteractionSessionOptions) {
    this.commitMirror = options.commitMirror;
    this.controller = options.controller;
    this.onControllerApply = options.onControllerApply;
    this.onFrame = options.onFrame;
    this.readMirror = options.readMirror;
    this.scheduler = options.scheduler ?? browserFrameScheduler;
  }

  updateBridge(
    options: Pick<
      ViewportInteractionSessionOptions,
      "commitMirror" | "onControllerApply" | "onFrame" | "readMirror"
    >,
  ): void {
    this.commitMirror = options.commitMirror;
    if (options.onControllerApply) {
      this.onControllerApply = options.onControllerApply;
    }
    if (options.onFrame) {
      this.onFrame = options.onFrame;
    }
    this.readMirror = options.readMirror;
  }

  usesController(controller: ViewportController): boolean {
    return this.controller === controller;
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

  isActiveKind(kind: ViewportInteractionKind): boolean {
    return this.activeKind === kind;
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
    const changed = this.controller.setPosition(
      nextState.x,
      nextState.y,
      nextState.scale,
    );
    if (changed) {
      this.onControllerApply?.(this.controller.getState());
    }
    return changed;
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
      this.onControllerApply?.(this.controller.getState());
    }
    this.commitCurrentStateIfChanged("discrete");
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
    this.rafHandle = this.scheduler.request((timestamp) => {
      this.rafHandle = null;
      this.onFrame?.(timestamp);
      this.flushFrame();
    });
  }
}

let viewportInteractionSession: ViewportInteractionSession | null = null;

/**
 * workspace 수명 동안 drag, wheel, command adapter가 공유하는 session을 반환한다.
 * controller가 교체되면 진행 중 interaction을 종료한 뒤 새 session으로 교체한다.
 */
export function getViewportInteractionSession(
  options: ViewportInteractionSessionOptions,
): ViewportInteractionSession {
  if (!viewportInteractionSession) {
    viewportInteractionSession = new ViewportInteractionSession(options);
    return viewportInteractionSession;
  }

  if (!viewportInteractionSession.usesController(options.controller)) {
    viewportInteractionSession.finish("interrupted");
    viewportInteractionSession = new ViewportInteractionSession(options);
    return viewportInteractionSession;
  }

  viewportInteractionSession.updateBridge(options);
  return viewportInteractionSession;
}

export function resetViewportInteractionSession(): void {
  viewportInteractionSession?.finish("interrupted");
  viewportInteractionSession = null;
}

export function finishActiveViewportInteraction(
  reason: ViewportInteractionFinishReason = "interrupted",
): void {
  viewportInteractionSession?.finish(reason);
}
