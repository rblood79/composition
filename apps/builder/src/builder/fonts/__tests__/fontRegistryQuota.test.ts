/**
 * ADR-235 Phase 0 (d) — 폰트 레지스트리 localStorage 한도 초과 재현.
 *
 * FONT_LIMITS.MAX_FILE_SIZE (5MB) 안의 4MB 폰트 1개가 base64 (1.33 배) 로
 * localStorage 한도 (origin 당 약 5MB) 를 넘는다. Phase 2 에서 레지스트리가
 * 자산 참조만 들게 되면 이 저장이 성공해야 한다 (G2).
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  FONT_LIMITS,
  FONT_REGISTRY_STORAGE_KEY,
  saveFontRegistry,
  type FontRegistryV2,
} from "@composition/shared";

function fontFaceWithDataUrl(bytes: number): FontRegistryV2 {
  const base64Length = Math.ceil(bytes / 3) * 4;
  return {
    version: 2,
    faces: [
      {
        id: "quota-face",
        family: "QuotaFont",
        source: {
          type: "data-url-temp",
          url: `data:font/woff2;base64,${"A".repeat(base64Length)}`,
          byteSize: bytes,
        },
        createdAt: "2026-09-26T00:00:00.000Z",
        updatedAt: "2026-09-26T00:00:00.000Z",
      },
    ],
  };
}

describe("font registry localStorage quota (ADR-235 G0 d)", () => {
  afterEach(() => localStorage.removeItem(FONT_REGISTRY_STORAGE_KEY));

  it("4MB 폰트는 허용 한도 안이다", () => {
    expect(4 * 1024 * 1024).toBeLessThan(FONT_LIMITS.MAX_FILE_SIZE);
  });

  it("4MB 폰트 1개 저장이 실패한다 (현재 결함 재현)", () => {
    expect(() =>
      saveFontRegistry(fontFaceWithDataUrl(4 * 1024 * 1024)),
    ).toThrow();
  });
});
