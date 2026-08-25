/**
 * Builder의 shared symbolic paint resolver 결과를 Specs shape renderer에 주입하는 경계 타입.
 *
 * packages/specs는 @composition/shared를 import하지 않으므로 구조만 독립 선언한다.
 * 상태/우선순위 계산은 이 패키지에서 수행하지 않는다.
 */
export interface CatalogResolvedPaint {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  backgroundAlpha: number;
  staticTrackWash: boolean;
  hasVisibleBoxPaint: boolean;
  hasOpaqueCatalogBackground: boolean;
}
