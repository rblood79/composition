/**
 * 🚀 Phase 19: 성능 최적화 타이밍 상수
 *
 * 명시적인 타이밍 상수를 사용하여 예측 가능하고 테스트 용이한 성능 최적화 구현
 *
 * @since 2025-12-23
 */

export const TIMING = {
  /** 인스펙터 디바운스: 선택 변경 후 인스펙터 업데이트 지연 (ms) */
  INSPECTOR_DEBOUNCE: 100,

  /** 입력 디바운스: 입력 필드 → store 업데이트 지연 (ms) */
  INPUT_DEBOUNCE: 150,

  /** 드래그 스로틀: 60Hz 호환성 기준 프레임 간격 (ms) */
  DRAG_THROTTLE: 1000 / 60,

  /** 레이아웃 계산 청크 크기: 한 번에 계산할 요소 수 */
  LAYOUT_CHUNK_SIZE: 50,

  /** 유휴 콜백 타임아웃 (ms) */
  IDLE_CALLBACK_TIMEOUT: 50,
} as const;

export type TimingKey = keyof typeof TIMING;
