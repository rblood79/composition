/**
 * ADR-222 §4.1 — Gap 단일 필드가 가리키는 축.
 *
 * 단일 행/열 flex 는 주축 gap 하나만 의미가 있다 (row → columnGap · column → rowGap).
 * 종전 표시는 rowGap 우선이라 가로 레이아웃의 columnGap 편집이 다른 값을 보였다.
 * wrap · grid · block 은 종전 shorthand 계약 (null) 을 그대로 둔다.
 */
export type GapAxisProperty = "rowGap" | "columnGap";

export function resolveGapAxisProperty(
  display: string | undefined,
  flexDirection: string | undefined,
  flexWrap: string | undefined,
): GapAxisProperty | null {
  if (display !== "flex" && display !== "inline-flex") return null;
  if (flexWrap !== undefined && flexWrap !== "" && flexWrap !== "nowrap") {
    return null;
  }
  return String(flexDirection ?? "row").startsWith("column")
    ? "rowGap"
    : "columnGap";
}
