import { describe, expect, it, beforeEach } from "vitest";
import { MessageService } from "./messaging";

describe("MessageService iframe cache", () => {
  beforeEach(() => {
    MessageService.clearIframeCache();
    document.body.innerHTML = "";
  });

  it("detached iframe를 재사용하지 않고 현재 Preview iframe을 찾는다", () => {
    const previousIframe = document.createElement("iframe");
    const currentIframe = document.createElement("iframe");
    previousIframe.id = "previewFrame";
    currentIframe.id = "previewFrame";
    document.body.append(previousIframe);

    expect(MessageService.getIframe()).toBe(previousIframe);

    previousIframe.remove();
    document.body.append(currentIframe);

    expect(MessageService.getIframe()).toBe(currentIframe);
  });
});
