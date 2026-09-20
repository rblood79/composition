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
}
