/**
 * Slug Validator Utility
 *
 * Nested Routes & Slug System을 위한 Slug 생성 유틸리티
 */

/**
 * 제목에서 Slug 자동 생성
 *
 * Title을 URL-friendly한 slug로 변환합니다.
 *
 * @param title - 변환할 제목
 * @returns 생성된 slug (앞에 '/'가 붙지 않음)
 *
 * @example
 * generateSlugFromTitle('Nike Shoes')
 * // → 'nike-shoes'
 *
 * generateSlugFromTitle('Summer  Sale  2024!!!')
 * // → 'summer-sale-2024'
 *
 * generateSlugFromTitle('제품 상세')
 * // → '' (한글은 제거됨)
 */
export function generateSlugFromTitle(
  title: string | undefined | null,
): string {
  if (!title) return "";

  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // 특수문자 제거
    .replace(/\s+/g, "-") // 공백 → 하이픈
    .replace(/-+/g, "-") // 연속 하이픈 제거
    .replace(/^-|-$/g, ""); // 앞뒤 하이픈 제거
}
