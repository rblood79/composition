/** ADR-248 Phase 4e-7: the instance props merge, split out of the old instance resolver (removed in 4e-13-3). */

/**
 * @internal Reusable props merger with deep-style merging.
 *
 * canonical resolver (Phase 2)의 공통 merge 패턴 추출 — DRY.
 *
 * style 필드는 shallow spread가 아닌 심층 병합(base style + override style).
 * 나머지 필드는 override가 base를 완전히 덮어쓴다.
 *
 * **시각 대칭 보장**: resolveCanonicalRefProps /
 * resolveCanonicalDescendantOverride / resolveInstanceWithSharedCache
 * 모두 이 함수를 경유하므로 style 심층 병합 semantics가 단일 구현으로 통일된다.
 */
export function mergePropsWithStyleDeep(
  baseProps: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...baseProps, ...patch };
  const baseStyle = baseProps.style as Record<string, unknown> | undefined;
  const overrideStyle = patch.style as Record<string, unknown> | undefined;
  // 한쪽만 style 이 있으면 그 객체를 그대로 쓴다 (값은 같다 — 해석 결과 style 은 누구도 제자리 수정하지
  //   않는다). ADR-234 G4: 항목 해석마다 origin style 을 여러 번 복사했다.
  if (overrideStyle) {
    if (baseStyle) merged.style = { ...baseStyle, ...overrideStyle };
  } else if (baseStyle) {
    merged.style = baseStyle;
  }
  return merged;
}

/**
 * ADR-234 — patch 끼리 합성 (descendants 스택 · 체인 중간). patch 값 `null` (= "이 키를 지운다") 을
 * **보존**한다: 뒤 patch 의 `null` 이 앞 값을 덮고, 뒤 값이 앞 `null` 을 덮는다. 합성 결과는 아직
 * patch 이므로 `null` 을 지우면 안 된다 (리뷰 round 2 h1 — 지우면 원본 값이 되살아난다).
 */
export const composePropsPatches = mergePropsWithStyleDeep;
