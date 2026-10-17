/**
 * Canvas 메모리 예산 (ADR-273) — 자원별 상한을 한 곳에 둔다. 집행은 자원별이다 (전역 LRU 없음 — ADR-174).
 *
 * Phase 2: GrDirectContext resource cache 한도. Phase 3 에서 picture · 미리 기록 · 이미지 상한을 값 그대로
 * 옮겨 온다.
 */

/**
 * 화면 GrDirectContext 의 resource cache 한도 (바이트) — 사용자 결정 2 (2026-10-18): 384 MiB.
 * 기준 실측 (`adr273-gpu-context-live.mjs`, `app-pages` + 이미지 22 장 · 줌 0.3 ~ 2): canvaskit 0.42.0 의 Skia
 * 기본 한도 256 MiB · 사용 고수위 DPR 1 111 MiB · DPR 2 251 MiB (그중 content surface 두 장 ≈ 145 MiB) —
 * 기본 한도에서는 DPR 2 가 90 % 여유 규칙 (HC4) 을 넘는다. 올린 128 MiB 는 ADR-270 Phase 3a 의 텍스처
 * 이미지 몫이다. 이 값은 보유 상한이지 예약이 아니다 — Skia 는 넘을 때만 퇴거한다.
 */
export const GR_CACHE_LIMIT_BYTES: number | null = 384 * 2 ** 20;
