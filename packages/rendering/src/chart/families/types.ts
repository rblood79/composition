/**
 * ADR-306 — family 계약 (breakdown §4.2). family 모듈 하나가 자기 종류의 입력 검증 · 모델 · scene ·
 * sample 을 가진 순수 함수 묶음이고 chunk 하나다 (`registry.ts` 의 dynamic import).
 */
import type {
  ChartFamilyId,
  ChartMetrics,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartSize,
  FamilyChartType,
} from "../types";

export interface ChartFamily {
  id: ChartFamilyId;
  /**
   * 순수 · 동기. 원본 행을 직접 읽는다 — `resolveChartModel` 의 시리즈 격자를 지나지 않는다.
   * 단계: 검증 → 모델 (크기 독립) → 예산 → 기하 (크기 의존).
   */
  buildScene(
    props: ChartProps,
    rows: readonly ChartRow[],
    size: ChartSize,
    metrics: ChartMetrics,
  ): ChartScene;
  /** 새 차트의 기본 행 (생성 경로가 명령 실행 전에 채운다). */
  sample(type: FamilyChartType): readonly ChartRow[];
  /** 새 차트의 기본 역할 · 옵션 (sample 행의 필드 이름). */
  sampleProps(type: FamilyChartType): Partial<ChartProps>;
}
