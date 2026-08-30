/**
 * ADR-198 Phase 0 — 픽셀 정규화 / 해시 / byte 지표 (test-only)
 *
 * vgpu 규율 #4 (`reference/render/perf::pixelDiff`) 의 이식: 지각 거리 하나로
 * 판정하지 않고 byte 단위 `maxByte` / `meanByte` / `changedFraction` 을 함께 낸다.
 * 같은 rasterizer 끼리는 `maxByte = 0` 이 기대값이고, 다른 rasterizer 끼리는
 * 이 수치가 "얼마나 다른가" 의 정본이다 (ADR-198 HC6).
 *
 * 여기엔 blur/resize/shift 가 없다 — 정규화는 좁게 유지한다 (breakdown §3.6).
 */

export interface ByteDiff {
  /** 최대 채널 delta (0-255) */
  maxByte: number;
  /** 평균 채널 delta */
  meanByte: number;
  /** 값이 다른 byte 수 */
  changedBytes: number;
  totalBytes: number;
  /** changedBytes / totalBytes */
  changedFraction: number;
}

/** 두 RGBA 버퍼의 byte 단위 차이. 길이가 다르면 harness error. */
export function byteDiff(a: Uint8Array, b: Uint8Array): ByteDiff {
  if (a.length !== b.length) {
    throw new Error(
      `byteDiff: 길이 불일치 (${a.length} vs ${b.length}) — 같은 크기로 크롭한 뒤 비교할 것`,
    );
  }
  let maxByte = 0;
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > 0) {
      changed++;
      sum += d;
      if (d > maxByte) maxByte = d;
    }
  }
  return {
    maxByte,
    meanByte: a.length === 0 ? 0 : sum / a.length,
    changedBytes: changed,
    totalBytes: a.length,
    changedFraction: a.length === 0 ? 0 : changed / a.length,
  };
}

/**
 * 정규화 RGBA 해시 (FNV-1a 32bit).
 *
 * 결정성 판정용 — PNG 메타데이터가 아니라 raw RGBA 만 먹인다 (HC6).
 * 암호학적 용도 아님.
 */
export function rgbaHash(pixels: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pixels.length; i++) {
    h ^= pixels[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** 프레임 liveness — 채널별 분산 (HC11 의 variance floor 판정 입력). */
export function pixelVariance(pixels: Uint8Array): number {
  if (pixels.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) sum += pixels[i];
  const mean = sum / pixels.length;
  let acc = 0;
  for (let i = 0; i < pixels.length; i++) {
    const d = pixels[i] - mean;
    acc += d * d;
  }
  return acc / pixels.length;
}

/** (x, y) 픽셀의 RGBA 4-튜플. */
export function pixelAt(
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const o = (y * width + x) * 4;
  return [pixels[o], pixels[o + 1], pixels[o + 2], pixels[o + 3]];
}
