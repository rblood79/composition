/**
 * Canvas 메모리 예산 (ADR-273) — 자원별 상한을 한 곳에 둔다. 집행은 자원별이다 (전역 LRU 없음 — ADR-174).
 *
 * 값은 이 표가 정본이고 각 캐시 모듈은 여기서 import 한다 (Phase 3 — 옮기며 값 불변). 지금 보유량은
 * `canvasMemoryHoldings.ts` 의 `readMemoryHoldings()` (캐시 모듈을 import 하므로 이 표와 나눠 순환을 피한다).
 */

/**
 * 화면 GrDirectContext 의 resource cache 한도 (바이트) — 사용자 결정 2 (2026-10-18): 384 MiB.
 * 기준 실측 (`adr273-gpu-context-live.mjs`, `app-pages` + 이미지 22 장 · 줌 0.3 ~ 2): canvaskit 0.42.0 의 Skia
 * 기본 한도 256 MiB · 사용 고수위 DPR 1 111 MiB · DPR 2 251 MiB (그중 content surface 두 장 ≈ 145 MiB) —
 * 기본 한도에서는 DPR 2 가 90 % 여유 규칙 (HC4) 을 넘는다. 올린 128 MiB 는 ADR-270 Phase 3a 의 텍스처
 * 이미지 몫이다. 이 값은 보유 상한이지 예약이 아니다 — Skia 는 넘을 때만 퇴거한다.
 */
export const GR_CACHE_LIMIT_BYTES: number | null = 384 * 2 ** 20;

/**
 * content surface 여백 (팬 합성용 — ADR-263). 기준은 CSS px 이고 device px 로 상한을 둔다 (ADR-273 Phase 1).
 * surface 규격 = main + 여백 × 2 (device px), ping-pong 두 장.
 */
export const CONTENT_PAD_CSS_PX = 512;

/**
 * 여백 상한 (device px) — 사용자 결정 1 (2026-10-18): 768. DPR 1 은 512 그대로, DPR 2 는 1,024 → 768.
 * 근거 (headless `app-pages` 팬, DPR 2): surface 합 1440 × 900 164.5 → 132.2 MiB · 2560 × 1440 325.8 →
 * 280.5 MiB / 여백 이탈 재기록 보통 팬 4 → 9 · 빠른 팬 27 → 35 (1 회 기록 p95 0.8 ~ 2 ms · 표시 간격 p99 불변).
 * 이탈은 그 프레임 안에서 다시 그려 화면이 비지 않는다 — 이 값은 메모리 ↔ 재기록 빈도의 교환이다.
 */
export const CONTENT_PAD_DEVICE_MAX = 768;

/** DPR 에서 content 여백 (device px). `deviceMax` 는 dev 대조용 (기본 = `CONTENT_PAD_DEVICE_MAX`). */
export function contentPaddingDevicePx(
  dpr: number,
  deviceMax: number = CONTENT_PAD_DEVICE_MAX,
): number {
  return Math.round(Math.min(CONTENT_PAD_CSS_PX * dpr, deviceMax));
}

/**
 * picture 캐시 보유 바이트 상한 — working set 동적 상한 (`nodePictureCache.ts`) 과 무관하게 이 합을 넘으면
 * 퇴거한다. ADR-266 사용자 결정 1 (64 MB).
 */
export const MAX_NODE_PICTURE_BYTES = 64 * 1024 * 1024;

/**
 * 미리 기록 (`nodePictureWarmup`) 이 채우는 picture 수의 상한 — ADR-266 Phase 4 (사용자 결정 2 「idle 미리
 * 기록」). `app-pages` 22 페이지 전체 3,961 개 ≈ 0.99 MB.
 */
export const MAX_WARM_NODE_PICTURES = 4096;

/** 이미지 캐시 엔트리 수 상한 (`imageCache.ts` LRU — 참조 중 엔트리는 퇴거하지 않는다). */
export const IMAGE_CACHE_MAX_ENTRIES = 100;

/** 이미지 캐시 RGBA 디코딩 바이트 추정 상한 (soft). GPU 전체 사용량이나 강제 live-set 상한은 아니다. */
export const IMAGE_CACHE_BYTE_BUDGET = 128 * 1024 * 1024;
