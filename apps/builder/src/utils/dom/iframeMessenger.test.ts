// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { IframeMessenger } from "./iframeMessenger";

function createIframe(): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  return iframe;
}

function dispatchIframeMessage(
  iframe: HTMLIFrameElement,
  data: Record<string, unknown>,
): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin: window.location.origin,
      source: iframe.contentWindow,
    }),
  );
}

describe("IframeMessenger", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps the original pending promise when a queued message is flushed", async () => {
    vi.useFakeTimers();

    const iframe = createIframe();
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    const messenger = new IframeMessenger(iframe);

    const pending = messenger.sendMessage("UPDATE_ELEMENT_PROPS", {
      elementId: "element-1",
    });

    expect(postMessage).not.toHaveBeenCalled();

    iframe.dispatchEvent(new Event("load"));

    expect(postMessage).toHaveBeenCalledTimes(1);
    const message = postMessage.mock.calls[0]?.[0] as { id: string };

    dispatchIframeMessage(iframe, {
      id: message.id,
      success: true,
      timestamp: Date.now(),
    });

    await expect(pending).resolves.toMatchObject({
      id: message.id,
      success: true,
    });

    messenger.destroy();
  });

  it("ignores responses from the wrong source even when the id matches", async () => {
    vi.useFakeTimers();

    const iframe = createIframe();
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
    const messenger = new IframeMessenger(iframe);

    iframe.dispatchEvent(new Event("load"));

    const pending = messenger.sendMessage("PING", {}, 100);
    const message = postMessage.mock.calls[0]?.[0] as { id: string };

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          id: message.id,
          success: true,
          timestamp: Date.now(),
        },
        origin: window.location.origin,
        source: window,
      }),
    );

    const rejection = expect(pending).rejects.toThrow("Message timeout: PING");
    await vi.advanceTimersByTimeAsync(100);
    await rejection;

    messenger.destroy();
  });

  it("removes its window listener on destroy", () => {
    const iframe = createIframe();
    const messenger = new IframeMessenger(iframe);
    const handler = vi.fn();

    messenger.registerHandler("CUSTOM_EVENT", handler);
    messenger.destroy();

    dispatchIframeMessage(iframe, {
      id: "message-1",
      type: "CUSTOM_EVENT",
      timestamp: Date.now(),
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
