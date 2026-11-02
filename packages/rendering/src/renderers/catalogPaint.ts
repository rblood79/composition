/**
 * Builder의 shared symbolic paint resolver 결과를 Specs shape renderer에 주입하는 경계 타입.
 *
 * packages/rendering은 @composition/shared를 import하지 않으므로 구조만 독립 선언한다.
 * 상태/우선순위 계산은 이 패키지에서 수행하지 않는다.
 */
export interface CatalogResolvedPaint {
  backgroundColor?: string;
  /** 바탕색 위 그라데이션 — CSS 모서리 방향 · [색, 위치 %] 정지점 (shared `PaintLinearGradient` 와 같은 모양). */
  backgroundImage?: {
    readonly to: "bottom right";
    readonly stops: readonly (readonly [color: string, percent: number])[];
  };
  color?: string;
  borderColor?: string;
  backgroundAlpha: number;
  staticTrackWash: boolean;
  hasVisibleBoxPaint: boolean;
  hasOpaqueCatalogBackground: boolean;
}
