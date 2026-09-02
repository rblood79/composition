/**
 * SectionSplitStack 의 순수 레이아웃 규칙과 저장소 접근 — 컴포넌트 파일과 분리해
 * react-refresh 경계를 지키고 단위 테스트가 DOM 없이 규칙을 검증하게 한다.
 */

export const SPLIT_STACK_DEFAULTS = {
  /** 위 섹션 최소 높이 — 헤더 + 트리 2행 */
  minTop: 96,
  /** 아래 섹션에 남겨야 하는 최소 높이 */
  minBottom: 96,
  /** 저장값이 없을 때의 위 섹션 상한 = 컨테이너 높이 × 비율 */
  defaultRatio: 0.5,
} as const;

export interface SplitLayoutInput {
  containerHeight: number;
  userCap: number | null;
  topCollapsed: boolean;
  bottomCollapsed: boolean;
  minTop?: number;
  minBottom?: number;
  defaultRatio?: number;
}

export interface SplitLayout {
  /** 두 섹션이 모두 펼쳐져 있고 컨테이너 높이를 알 때만 구분선을 낸다 */
  showDivider: boolean;
  /** 위 섹션 pane 의 max-height (null = 제한 없음: 접힘 상태 또는 측정 전) */
  topMaxHeight: number | null;
  minValue: number;
  maxValue: number;
  /** 현재 상한 (저장값 또는 기본 비율) — clamp 적용 후 */
  value: number;
}

export function clampSplitValue(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(Math.max(value, min), max);
}

export function resolveSplitLayout(input: SplitLayoutInput): SplitLayout {
  const minTop = input.minTop ?? SPLIT_STACK_DEFAULTS.minTop;
  const minBottom = input.minBottom ?? SPLIT_STACK_DEFAULTS.minBottom;
  const ratio = input.defaultRatio ?? SPLIT_STACK_DEFAULTS.defaultRatio;
  const measured = input.containerHeight > 0;

  if (input.topCollapsed || input.bottomCollapsed || !measured) {
    return {
      showDivider: false,
      topMaxHeight: null,
      minValue: minTop,
      maxValue: minTop,
      value: minTop,
    };
  }

  const maxValue = Math.max(minTop, Math.round(input.containerHeight - minBottom));
  const fallback = Math.round(input.containerHeight * ratio);
  const value = clampSplitValue(Math.round(input.userCap ?? fallback), minTop, maxValue);
  return {
    showDivider: true,
    topMaxHeight: value,
    minValue: minTop,
    maxValue,
    value,
  };
}

export function readSplitCap(storageKey: string): number | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSplitCap(storageKey: string, cap: number | null): void {
  try {
    if (cap === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, String(Math.round(cap)));
    }
  } catch {
    // localStorage 차단 환경 — 세션 내 상태만 유지
  }
}
