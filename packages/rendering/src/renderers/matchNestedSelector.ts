/**
 * ADR-108 P1 — `containerVariants.nested[].selector` mini-matcher
 *
 * Canvas/Panel consumer 가 `containerVariants` 의 nested rule 을 element tree 에
 * 적용하기 위해 selector 를 런타임 평가한다. CSSGenerator 는 selector 문자열을
 * 그대로 CSS 로 append 하지만, Canvas 는 구조적 매칭이 필요하다.
 *
 * ## 지원 selector 문법 (whitelist — 16 spec P1 audit 기반)
 *
 * **직접 매칭**:
 * - `> .react-aria-X`                       — 직접 자식 중 `type === "X"`
 * - `> :not(.react-aria-X)`                 — 직접 자식 중 `type !== "X"`
 * - `.react-aria-X`                         — 깊이 무관 `type === "X"`
 *
 * **미지원 (CSS emit 은 유지, Canvas matcher 는 skip)**:
 * - `:where(...)`, `:has(...)`, `:not(...)` pseudo — state/attr 기반은 Canvas 에서 CSS 렌더 잔존
 * - `[data-*]`, `[data-*="v"]` attribute selector — 상태 표현은 CSS 경로에 위임
 * - `&` prefix + descendant, multi-class, 복합 chain — compound layout 영향 외
 * - 비표준 compound class (`.searchfield-container`, `.combobox-container`, `.radio-items`, `.checkbox-items`, `.fill`, `.react-aria-*-time-field` 등)
 *
 * 미지원 selector 는 `false` 반환 (레이아웃 미주입). Preview CSS 는 정상 emit
 * 되므로 상태 시각 표현은 보존된다.
 *
 * @see docs/adr/108-container-runtime-derived-styles.md R1 (selector mini-matcher 표현력)
 */

export interface NestedSelectorChild {
  /** Spec type (예: `Label`, `Input`, `Group`). PascalCase. */
  type: string;
}

/**
 * @param selector `containerVariants.nested[].selector` 문자열
 * @param child    매칭 대상 자식 element
 * @param isDirectChild 부모 컨테이너의 직접 자식 여부 (descendant 매칭 시 false 가능)
 */
export function matchNestedSelector(
  selector: string,
  child: NestedSelectorChild,
  isDirectChild: boolean,
): boolean {
  const trimmed = selector.trim();
  if (trimmed.length === 0) return false;

  const directPositive = DIRECT_CHILD_POSITIVE.exec(trimmed);
  if (directPositive) {
    return isDirectChild && child.type === directPositive[1];
  }

  const directNegative = DIRECT_CHILD_NEGATIVE.exec(trimmed);
  if (directNegative) {
    return isDirectChild && child.type !== directNegative[1];
  }

  const anyDescendant = ANY_DESCENDANT.exec(trimmed);
  if (anyDescendant) {
    return child.type === anyDescendant[1];
  }

  return false;
}

/**
 * selector 가 whitelist 에 속하는지 판별 (audit / test 용).
 */
export function isSupportedNestedSelector(selector: string): boolean {
  const trimmed = selector.trim();
  return (
    DIRECT_CHILD_POSITIVE.test(trimmed) ||
    DIRECT_CHILD_NEGATIVE.test(trimmed) ||
    ANY_DESCENDANT.test(trimmed)
  );
}

// ─── Whitelist patterns ─────────────────────────────────────────────────────

/** `> .react-aria-X` — 직접 자식, 특정 type */
const DIRECT_CHILD_POSITIVE = /^>\s*\.react-aria-([A-Z][A-Za-z0-9]+)$/;

/** `> :not(.react-aria-X)` — 직접 자식, 특정 type 제외 */
const DIRECT_CHILD_NEGATIVE =
  /^>\s*:not\(\s*\.react-aria-([A-Z][A-Za-z0-9]+)\s*\)$/;

/** `.react-aria-X` — 깊이 무관 type 매칭 */
const ANY_DESCENDANT = /^\.react-aria-([A-Z][A-Za-z0-9]+)$/;
