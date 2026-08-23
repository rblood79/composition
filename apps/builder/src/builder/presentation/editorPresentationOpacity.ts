/**
 * ADR-187 Phase 5 opacity presentation의 단일 입력 정규화.
 * CSS opacity는 0..1 범위의 unitless 값만 연속 paint lane에 허용한다.
 */
export function parsePresentationOpacity(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
  return parsed;
}
