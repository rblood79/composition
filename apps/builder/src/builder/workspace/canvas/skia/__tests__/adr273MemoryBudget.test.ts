import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as budget from "../canvasMemoryBudget";
import {
  readMemoryHoldings,
  registerRendererMemorySource,
} from "../canvasMemoryHoldings";
import * as imageCache from "../imageCache";
import * as nodePictureCache from "../nodePictureCache";

/**
 * ADR-273 Phase 3 — 자원별 상한을 `canvasMemoryBudget.ts` 한 곳에 둔다 (값 불변, R4).
 * 보유량은 `canvasMemoryHoldings.ts` 의 `readMemoryHoldings()` 가 표로 돌려준다.
 */
describe("ADR-273 Phase 3 — 예산 표", () => {
  it("표 값 = 옛 상수 (값 불변)", () => {
    expect({
      GR_CACHE_LIMIT_BYTES: budget.GR_CACHE_LIMIT_BYTES,
      CONTENT_PAD_CSS_PX: budget.CONTENT_PAD_CSS_PX,
      CONTENT_PAD_DEVICE_MAX: budget.CONTENT_PAD_DEVICE_MAX,
      MAX_NODE_PICTURE_BYTES: budget.MAX_NODE_PICTURE_BYTES,
      MAX_WARM_NODE_PICTURES: budget.MAX_WARM_NODE_PICTURES,
      IMAGE_CACHE_BYTE_BUDGET: budget.IMAGE_CACHE_BYTE_BUDGET,
      IMAGE_CACHE_MAX_ENTRIES: budget.IMAGE_CACHE_MAX_ENTRIES,
    }).toEqual({
      GR_CACHE_LIMIT_BYTES: 384 * 2 ** 20,
      CONTENT_PAD_CSS_PX: 512,
      CONTENT_PAD_DEVICE_MAX: 768,
      MAX_NODE_PICTURE_BYTES: 64 * 1024 * 1024,
      MAX_WARM_NODE_PICTURES: 4096,
      IMAGE_CACHE_BYTE_BUDGET: 128 * 1024 * 1024,
      IMAGE_CACHE_MAX_ENTRIES: 100,
    });
  });

  it("캐시 모듈의 export 는 표의 값이다 (기존 import 경로 유지)", () => {
    expect(nodePictureCache.MAX_NODE_PICTURE_BYTES).toBe(
      budget.MAX_NODE_PICTURE_BYTES,
    );
    expect(nodePictureCache.MAX_WARM_NODE_PICTURES).toBe(
      budget.MAX_WARM_NODE_PICTURES,
    );
    expect(imageCache.IMAGE_CACHE_BYTE_BUDGET).toBe(
      budget.IMAGE_CACHE_BYTE_BUDGET,
    );
    expect(imageCache.getImageCacheMemory().budgetBytes).toBe(
      budget.IMAGE_CACHE_BYTE_BUDGET,
    );
  });

  it("캐시 모듈은 상한 값을 직접 정의하지 않는다 — 표 한 곳", () => {
    const read = (f: string) =>
      readFileSync(resolve(import.meta.dirname, "..", f), "utf8");
    const picture = read("nodePictureCache.ts");
    expect(picture).not.toMatch(/MAX_NODE_PICTURE_BYTES\s*=/);
    expect(picture).not.toMatch(/MAX_WARM_NODE_PICTURES\s*=/);
    const image = read("imageCache.ts");
    expect(image).not.toMatch(/IMAGE_CACHE_BYTE_BUDGET\s*=/);
    expect(image).not.toMatch(/MAX_CACHE_SIZE\s*=\s*\d/);
  });
});

describe("ADR-273 Phase 3 — readMemoryHoldings", () => {
  let unregister: (() => void) | null = null;
  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  it("키 집합 · 상한은 표의 값 · renderer 가 없으면 surface · GPU 는 null", () => {
    const h = readMemoryHoldings();
    expect(Object.keys(h).sort()).toEqual([
      "gpuCache",
      "image",
      "nodePicture",
      "paragraph",
      "surfaces",
    ]);
    expect(h.surfaces).toBeNull();
    expect(h.gpuCache).toBeNull();
    expect(h.nodePicture).toEqual({
      count: nodePictureCache.getNodePictureCacheSize(),
      bytes: nodePictureCache.getNodePictureBytes(),
      capacity: nodePictureCache.getNodePictureEffectiveCapacity(),
      workingSetCapacity: nodePictureCache.getNodePictureCapacity(),
      limitBytes: budget.MAX_NODE_PICTURE_BYTES,
      warmLimit: budget.MAX_WARM_NODE_PICTURES,
    });
    expect(h.image).toEqual({
      count: imageCache.getImageCacheSize(),
      estimatedBytes: imageCache.getImageCacheMemory().estimatedBytes,
      limitCount: budget.IMAGE_CACHE_MAX_ENTRIES,
      budgetBytes: budget.IMAGE_CACHE_BYTE_BUDGET,
    });
    expect(Object.keys(h.paragraph)).toEqual(["count"]);
  });

  it("renderer 가 등록하면 surface 바이트 · 여백 · GPU 캐시가 표에 실리고 해제하면 빠진다", () => {
    unregister = registerRendererMemorySource(() => ({
      surfaceBytes: 138_590_208,
      contentPadDevicePx: 768,
      gpuUsageBytes: 1_000,
      gpuLimitBytes: budget.GR_CACHE_LIMIT_BYTES,
    }));
    const h = readMemoryHoldings();
    expect(h.surfaces).toEqual({
      bytes: 138_590_208,
      contentPadDevicePx: 768,
      padDeviceMax: budget.CONTENT_PAD_DEVICE_MAX,
    });
    expect(h.gpuCache).toEqual({
      usageBytes: 1_000,
      limitBytes: budget.GR_CACHE_LIMIT_BYTES,
    });
    unregister();
    unregister = null;
    expect(readMemoryHoldings().surfaces).toBeNull();
  });

  it("먼저 등록한 renderer 의 해제가 나중 renderer 를 지우지 않는다", () => {
    const first = registerRendererMemorySource(() => ({
      surfaceBytes: 1,
      contentPadDevicePx: 512,
      gpuUsageBytes: null,
      gpuLimitBytes: null,
    }));
    unregister = registerRendererMemorySource(() => ({
      surfaceBytes: 2,
      contentPadDevicePx: 768,
      gpuUsageBytes: null,
      gpuLimitBytes: null,
    }));
    first();
    expect(readMemoryHoldings().surfaces?.bytes).toBe(2);
    expect(readMemoryHoldings().gpuCache).toBeNull();
  });
});
