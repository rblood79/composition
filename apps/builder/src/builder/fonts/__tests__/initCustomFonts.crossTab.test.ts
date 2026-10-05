// @vitest-environment jsdom
/**
 * 2026-10-05 감사 L4 — 다른 탭이 폰트 레지스트리를 바꾸면 이 탭도 같은 탭 변경과 같은 경로
 * (`composition:custom-fonts-updated`) 로 알린다. CSS 만 다시 주입하고 이벤트를 내지 않아
 * Canvas (Skia 폰트 동기화) 에는 새 폰트가 빠졌다 — Preview 와 갈림.
 */
import { describe, expect, it } from "vitest";
import { FONT_REGISTRY_STORAGE_KEY } from "../customFonts";

await import("../initCustomFonts");

describe("initCustomFonts — 다른 탭 변경", () => {
  it("storage 이벤트가 custom-fonts-updated 를 내보낸다", () => {
    let notified = 0;
    const onUpdate = () => notified++;
    window.addEventListener("composition:custom-fonts-updated", onUpdate);
    window.dispatchEvent(
      new StorageEvent("storage", { key: FONT_REGISTRY_STORAGE_KEY }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    window.removeEventListener("composition:custom-fonts-updated", onUpdate);
    expect(notified).toBe(1);
  });
});
