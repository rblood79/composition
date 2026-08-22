import { Element, ComponentElementProps } from "../types/core/store.types";
// 통합 메시징 유틸리티
export class MessageService {
  private static iframe: HTMLIFrameElement | null = null;

  static getIframe(): HTMLIFrameElement | null {
    // ✅ FIX: Stale 참조 체크 - contentWindow가 없으면 다시 가져오기
    if (
      this.iframe &&
      (!this.iframe.isConnected || !this.iframe.contentWindow)
    ) {
      this.iframe = null;
    }

    if (!this.iframe) {
      this.iframe = document.getElementById(
        "previewFrame",
      ) as HTMLIFrameElement;
    }
    return this.iframe;
  }

  /**
   * Clear cached iframe reference (call when iframe is removed from DOM)
   */
  static clearIframeCache(): void {
    this.iframe = null;
  }

  static sendToIframe(type: string, payload: Record<string, unknown>) {
    const iframe = this.getIframe();
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        { type, payload },
        window.location.origin,
      );
    }
  }

  static sendToWindow(type: string, payload: Record<string, unknown>) {
    window.postMessage({ type, payload }, window.location.origin);
  }

  static clearOverlay() {
    this.sendToWindow("CLEAR_OVERLAY", {});
  }

  static handleMessage(
    event: MessageEvent,
    handlers: {
      projectId: string;
      setElements: (elements: Element[]) => void;
      setSelectedElement: (
        elementId: string | null,
        props?: ComponentElementProps,
      ) => void;
      addElement: (element: Element) => void;
      updateElementProps: (
        elementId: string,
        props: ComponentElementProps,
      ) => void;
      removeElement: (elementId: string) => void;
      setError: (error: string | null) => void;
      setIsLoading: (loading: boolean) => void;
    },
  ) {
    try {
      const { type, payload } = event.data;

      switch (type) {
        case "ELEMENT_SELECTED":
          if (payload?.elementId) {
            handlers.setSelectedElement(payload.elementId, payload.props);
          }
          break;

        case "ELEMENT_ADDED":
          if (payload?.element) {
            handlers.addElement(payload.element);
          }
          break;

        case "ELEMENT_UPDATED":
          if (payload?.elementId && payload?.props) {
            handlers.updateElementProps(payload.elementId, payload.props);
          }
          break;

        case "ELEMENT_REMOVED":
          if (payload?.elementId) {
            handlers.removeElement(payload.elementId);
          }
          break;

        case "ELEMENTS_LOADED":
          if (payload?.elements) {
            handlers.setElements(payload.elements);
          }
          break;

        case "ERROR":
          if (payload?.message) {
            handlers.setError(payload.message);
          }
          break;

        case "LOADING":
          if (typeof payload?.loading === "boolean") {
            handlers.setIsLoading(payload.loading);
          }
          break;

        default:
          // 알 수 없는 메시지 타입은 무시
          break;
      }
    } catch (error) {
      console.error("Message handling error:", error);
    }
  }
}
