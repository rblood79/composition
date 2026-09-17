/** ADR-224: CSS 크기값은 그대로 두고 Fill의 축별 의도만 보존한다. */
export type SizeAxis = "width" | "height";
export interface FillIntent {
  factor: number;
}
/** null은 ref/tier에서 상속한 Fill을 명시적으로 해제한다. */
export type FillAxes = Partial<Record<SizeAxis, FillIntent | null>>;
