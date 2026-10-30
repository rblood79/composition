/** Compare iframe과 Builder가 공유하는 휠 입력 계약. 좌표는 iframe viewport 기준이다. */
export const CATALOG_PREVIEW_WHEEL = "CATALOG_PREVIEW_WHEEL";
export const COMPARE_VIEWPORT_WHEEL = "composition:compare-viewport-wheel";

export interface ViewportWheelInput {
  clientX: number;
  clientY: number;
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

interface PreviewWheelMessage extends ViewportWheelInput {
  type: typeof CATALOG_PREVIEW_WHEEL;
  viewportWidth: number;
  viewportHeight: number;
}

export function readPreviewWheelMessage(
  value: unknown,
): PreviewWheelMessage | undefined {
  if (!value || typeof value !== "object") return;
  const data = value as Record<string, unknown>;
  if (data.type !== CATALOG_PREVIEW_WHEEL) return;
  for (const key of [
    "clientX",
    "clientY",
    "deltaX",
    "deltaY",
    "viewportWidth",
    "viewportHeight",
  ]) {
    if (typeof data[key] !== "number" || !Number.isFinite(data[key])) return;
  }
  for (const key of ["ctrlKey", "metaKey", "shiftKey"]) {
    if (typeof data[key] !== "boolean") return;
  }
  if (
    (data.viewportWidth as number) <= 0 ||
    (data.viewportHeight as number) <= 0
  )
    return;
  return value as PreviewWheelMessage;
}

/** source/origin 검증을 통과한 메시지만 호출한다. 페이지 줌은 좌표에만 적용한다. */
export function forwardPreviewWheel(
  frame: HTMLIFrameElement,
  input: PreviewWheelMessage,
): void {
  const rect = frame.getBoundingClientRect();
  frame.dispatchEvent(
    new CustomEvent<ViewportWheelInput>(COMPARE_VIEWPORT_WHEEL, {
      bubbles: true,
      detail: {
        ...input,
        clientX: rect.left + (input.clientX * rect.width) / input.viewportWidth,
        clientY:
          rect.top + (input.clientY * rect.height) / input.viewportHeight,
      },
    }),
  );
}

/** 독립 Preview에서는 브라우저/컴포넌트의 기본 휠 동작을 유지한다. */
export function registerCatalogPreviewWheel(
  target: Window = window,
): () => void {
  if (
    target.parent === target ||
    new URLSearchParams(target.location.search).get("compare") !== "1"
  )
    return () => {};
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const message: PreviewWheelMessage = {
      type: CATALOG_PREVIEW_WHEEL,
      clientX: event.clientX,
      clientY: event.clientY,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      viewportWidth: target.innerWidth,
      viewportHeight: target.innerHeight,
    };
    target.parent.postMessage(message, target.location.origin);
  };
  target.addEventListener("wheel", onWheel, { capture: true, passive: false });
  const style = target.document.documentElement.style;
  const previous = style.getPropertyValue("overscroll-behavior-x");
  style.setProperty("overscroll-behavior-x", "none");
  return () => {
    target.removeEventListener("wheel", onWheel, { capture: true });
    if (previous) style.setProperty("overscroll-behavior-x", previous);
    else style.removeProperty("overscroll-behavior-x");
  };
}
