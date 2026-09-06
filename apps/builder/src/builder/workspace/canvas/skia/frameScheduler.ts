/** CanvasKit Quickstart의 event-driven RAF. 상태/캐시의 소유권은 생산자에 남긴다. */
const wakeListeners = new Set<() => void>();

export function requestCanvasFrame(): void {
  for (const listener of wakeListeners) listener();
}

export function subscribeCanvasFrames(listener: () => void): () => void {
  wakeListeners.add(listener);
  return () => {
    wakeListeners.delete(listener);
  };
}

export function createFrameScheduler(
  render: () => void,
  request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame,
) {
  let pending: number | null = null;
  let dirty = false;
  let paused = false;
  let disposed = false;
  const schedule = () => {
    if (disposed || paused || !dirty || pending !== null) return;
    pending = request(() => {
      pending = null;
      if (disposed || paused) return;
      dirty = false;
      // render 중 invalidation은 후속 프레임 하나로 합쳐진다.
      render();
    });
  };
  return {
    invalidate() {
      dirty = true;
      schedule();
    },
    setPaused(value: boolean) {
      paused = value;
      if (paused && pending !== null) {
        cancel(pending);
        pending = null;
      }
      if (!paused) schedule();
    },
    dispose() {
      disposed = true;
      if (pending !== null) cancel(pending);
      pending = null;
    },
  };
}
