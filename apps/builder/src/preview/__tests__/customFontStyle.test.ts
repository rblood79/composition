// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — Preview iframe 은 Builder 가 폰트 레지스트리를 바꾸면 @font-face 를 다시 싣는다
 * (부팅 때 한 번 읽은 레지스트리를 계속 써, 열린 Preview 에 새 폰트가 빠지고 Canvas 와 갈렸다).
 * Builder 의 `composition:custom-fonts-updated` 는 같은 window 전용이라 iframe 은 storage 이벤트를 받는다.
 */
import { afterEach, describe, expect, it } from "vitest";
import { FONT_REGISTRY_STORAGE_KEY } from "@composition/shared";
import { injectPreviewCustomFonts } from "../customFontStyle";

const registry = (family: string) =>
  JSON.stringify({
    version: 2,
    faces: [
      {
        id: family,
        family,
        source: { kind: "url", url: `https://fonts.test/${family}.woff2` },
        format: "woff2",
      },
    ],
  });

afterEach(() => {
  localStorage.clear();
  document.head.innerHTML = "";
});

describe("Preview custom font style", () => {
  it("re-injects the faces when the Builder changes the registry", () => {
    localStorage.setItem(FONT_REGISTRY_STORAGE_KEY, registry("Alpha"));
    injectPreviewCustomFonts();
    const style = document.getElementById("preview-custom-fonts")!;
    expect(style.textContent).toContain("Alpha");

    const next = registry("Beta");
    localStorage.setItem(FONT_REGISTRY_STORAGE_KEY, next);
    window.dispatchEvent(
      new StorageEvent("storage", { key: FONT_REGISTRY_STORAGE_KEY, newValue: next }),
    );
    expect(style.textContent).toContain("Beta");
    expect(style.textContent).not.toContain("Alpha");
  });
});
