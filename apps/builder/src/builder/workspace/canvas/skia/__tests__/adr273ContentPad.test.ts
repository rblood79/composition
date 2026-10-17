import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTENT_PAD_CSS_PX,
  CONTENT_PAD_DEVICE_MAX,
  contentPaddingDevicePx,
} from "../canvasMemoryBudget";

/**
 * ADR-273 Phase 1 — content 여백은 `512 CSS × dpr` 를 device 상한 768 (사용자 결정 1) 로 자른다.
 * DPR 1 은 그대로 512, DPR 2 이상은 768.
 */
describe("ADR-273 Phase 1 — content 여백 (device px)", () => {
  it("값: CSS 512 · device 상한 768", () => {
    expect(CONTENT_PAD_CSS_PX).toBe(512);
    expect(CONTENT_PAD_DEVICE_MAX).toBe(768);
  });

  it("DPR 1 → 512 · 1.25 → 640 · 1.5 → 768 · 2 → 768 · 3 → 768", () => {
    expect(contentPaddingDevicePx(1)).toBe(512);
    expect(contentPaddingDevicePx(1.25)).toBe(640);
    expect(contentPaddingDevicePx(1.5)).toBe(768);
    expect(contentPaddingDevicePx(2)).toBe(768);
    expect(contentPaddingDevicePx(3)).toBe(768);
  });

  it("dev 대조: 상한 Infinity = 옛 식 (DPR 2 → 1,024) · 512 = Pen 값", () => {
    expect(contentPaddingDevicePx(2, Infinity)).toBe(1024);
    expect(contentPaddingDevicePx(2, 512)).toBe(512);
    expect(contentPaddingDevicePx(1, 512)).toBe(512);
  });

  it("renderer 의 두 대입 (생성 · resize) 이 helper 를 지난다 — CSS × dpr 를 직접 쓰지 않는다", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../SkiaRenderer.ts"),
      "utf8",
    );
    const assignments = src.match(/this\.contentPaddingDevicePx = [^;]+;/g);
    expect(assignments).toHaveLength(3); // 생성 · dev 스위치 · resize
    for (const a of assignments!)
      expect(a).toBe(
        "this.contentPaddingDevicePx = this.resolveContentPaddingDevicePx();",
      );
    expect(src).toMatch(/contentPaddingDevicePx\(this\.dpr\)/);
  });
});
