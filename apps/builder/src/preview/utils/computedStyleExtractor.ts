/**
 * CSS Property Name Conversion
 *
 * camelCase ↔ kebab-case 변환 헬퍼.
 *
 * NOTE: 과거 computedStyle 추출 함수 군(extractFullComputedStyle /
 * extractComputedStyleSubset / extractComputedStyleAsync / diffComputedStyle /
 * createSelectionBundle / COMPUTED_STYLE_WHITELIST)은 ADR-122 canonical-only
 * 전환으로 호출처가 끊겨 제거됨. preview 선택 경로는 App.tsx 의 자체
 * collectComputedStyle 을 사용한다. camelToKebab 만 live 잔존.
 */

/**
 * camelCase → kebab-case 변환
 * 예: marginTop → margin-top
 */
export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
