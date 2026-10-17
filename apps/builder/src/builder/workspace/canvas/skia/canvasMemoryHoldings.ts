/**
 * Canvas 메모리 보유량 표 (ADR-273 Phase 3) — 자원별 지금 보유량과 예산 표 (`canvasMemoryBudget.ts`) 의
 * 상한을 나란히 돌려준다. 보고 전용이다 — 자원을 가로지르는 퇴거는 두지 않는다 (ADR-174).
 *
 * 캐시 모듈을 import 하므로 예산 표와 나눈다 (캐시 모듈이 예산 표를 import 한다 — 한 파일이면 순환).
 * surface · GPU 캐시는 renderer 가 `registerRendererMemorySource` 로 알린다.
 */

import {
  CONTENT_PAD_DEVICE_MAX,
  IMAGE_CACHE_BYTE_BUDGET,
  IMAGE_CACHE_MAX_ENTRIES,
  MAX_NODE_PICTURE_BYTES,
  MAX_WARM_NODE_PICTURES,
} from "./canvasMemoryBudget";
import { getImageCacheMemory, getImageCacheSize } from "./imageCache";
import {
  getNodePictureBytes,
  getNodePictureCacheSize,
  getNodePictureCapacity,
  getNodePictureEffectiveCapacity,
} from "./nodePictureCache";
import { getRetainedParagraphCount } from "./retainedParagraph";

export interface RendererMemorySample {
  /** main + content + standby surface 의 w × h × 4 합 (산식). */
  surfaceBytes: number;
  contentPadDevicePx: number;
  /** GrDirectContext resource cache — SW 폴백 · context 소실 중이면 null. */
  gpuUsageBytes: number | null;
  gpuLimitBytes: number | null;
}

export interface MemoryHoldings {
  surfaces: {
    bytes: number;
    contentPadDevicePx: number;
    padDeviceMax: number;
  } | null;
  gpuCache: { usageBytes: number | null; limitBytes: number | null } | null;
  nodePicture: {
    count: number;
    bytes: number;
    /** 지금 적용되는 개수 상한 (미리 기록 하한 포함). */
    capacity: number;
    /** working set 동적 상한 (ADR-266 결정 1). */
    workingSetCapacity: number;
    limitBytes: number;
    warmLimit: number;
  };
  image: {
    count: number;
    estimatedBytes: number;
    limitCount: number;
    budgetBytes: number;
  };
  /** 수명 = 텍스트 노드 (ADR-174) — 상한 없음. */
  paragraph: { count: number };
}

let rendererSource: (() => RendererMemorySample) | null = null;

/** renderer 가 자기 surface · GPU 캐시 읽기를 등록한다. 돌려준 함수로 해제 (자기 등록일 때만 지운다). */
export function registerRendererMemorySource(
  source: () => RendererMemorySample,
): () => void {
  rendererSource = source;
  return () => {
    if (rendererSource === source) rendererSource = null;
  };
}

export function readMemoryHoldings(): MemoryHoldings {
  const renderer = rendererSource?.() ?? null;
  return {
    surfaces: renderer && {
      bytes: renderer.surfaceBytes,
      contentPadDevicePx: renderer.contentPadDevicePx,
      padDeviceMax: CONTENT_PAD_DEVICE_MAX,
    },
    gpuCache:
      renderer && renderer.gpuLimitBytes != null
        ? {
            usageBytes: renderer.gpuUsageBytes,
            limitBytes: renderer.gpuLimitBytes,
          }
        : null,
    nodePicture: {
      count: getNodePictureCacheSize(),
      bytes: getNodePictureBytes(),
      capacity: getNodePictureEffectiveCapacity(),
      workingSetCapacity: getNodePictureCapacity(),
      limitBytes: MAX_NODE_PICTURE_BYTES,
      warmLimit: MAX_WARM_NODE_PICTURES,
    },
    image: {
      count: getImageCacheSize(),
      estimatedBytes: getImageCacheMemory().estimatedBytes,
      limitCount: IMAGE_CACHE_MAX_ENTRIES,
      budgetBytes: IMAGE_CACHE_BYTE_BUDGET,
    },
    paragraph: { count: getRetainedParagraphCount() },
  };
}

// dev 전용 전역 — 하니스 (`perf-baseline.mjs` 부류마다 `memory`) · live 확인이 읽는다.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_MEMORY_BUDGET__ =
    { holdings: readMemoryHoldings };
}
