import { mergeFillSizing } from "@composition/shared";
/**
 * G.1 Instance Resolver
 *
 * Master-Instance 관계에서 Instance의 최종 props를 해석하는 순수 함수.
 * 상태 비종속 — 모든 필요 데이터를 인자로 전달받는다.
 *
 * 우선순위: descendant override > instance override > master props > default
 *
 * @see docs/WASM_DOC_IMPACT_ANALYSIS.md §G.1
 */

import type {
  CanonicalNode,
  DescendantOverride,
  RefNode,
} from "@composition/shared";

// ─────────────────────────────────────────────
// Pure helper — ADR-903 P1 Stage 2
// ─────────────────────────────────────────────

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
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...baseProps, ...overrides };
  const baseStyle = baseProps.style as Record<string, unknown> | undefined;
  const overrideStyle = overrides.style as Record<string, unknown> | undefined;
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

/** patch 값 `null` 을 제거한 새 props (top-level · style 한 단계). 없으면 같은 참조. */
export function stripDeletedPatchValues(
  props: Record<string, unknown>,
): Record<string, unknown> {
  // for-in (own 키만) — Object.entries 배열 할당 없이 (ADR-234 G4: 항목 해석마다 여러 번 불린다).
  let out: Record<string, unknown> | null = null;
  for (const key in props) {
    if (!Object.hasOwn(props, key)) continue;
    if (props[key] === null) {
      out ??= { ...props };
      delete out[key];
    }
  }
  const style = (out ?? props).style;
  if (style && typeof style === "object" && !Array.isArray(style)) {
    const styleRecord = style as Record<string, unknown>;
    let nextStyle: Record<string, unknown> | null = null;
    for (const key in styleRecord) {
      if (!Object.hasOwn(styleRecord, key)) continue;
      if (styleRecord[key] === null) {
        nextStyle ??= { ...styleRecord };
        delete nextStyle[key];
      }
    }
    if (nextStyle) {
      out ??= { ...props };
      out.style = nextStyle;
    }
  }
  return out ?? props;
}

/**
 * ADR-234 — 해석이 끝난 값 (origin · 체인 master 해석 결과) 에 patch 를 적용한다. patch 값 `null`
 * 은 그 키를 지운다 (catalog 기본값으로 돌아감) — 결과에 `null` 이 남지 않아 소비자 (Skia · DOM ·
 * layout) 는 `null` 을 보지 않는다.
 */
export function applyPropsPatch(
  baseProps: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return stripDeletedPatchValues(mergePropsWithStyleDeep(baseProps, patch));
}

// ─────────────────────────────────────────────
// Canonical helpers — ADR-903 P1 Stage 2 / P2 progress
// ─────────────────────────────────────────────

/**
 * @experimental ADR-903 P2 progress — canonical RefNode root merge.
 *
 * master CanonicalNode와 RefNode의 루트 속성을 병합하여 resolved props 산출.
 * style은 심층 병합.
 *
 * P2 resolver가 ref → resolved tree 변환 시 호출.
 * mergePropsWithStyleDeep semantics 사용 — 시각 결과 대칭 보장.
 *
 * **props 계약**: ADR-116 direct cutover 이후 master/ref props source는
 * `CanonicalNode.props` 하나다. `metadata.legacyProps` 는 adapter/export 경계의
 * quarantine payload이며 resolver 입력으로 사용하지 않는다.
 */
export function resolveCanonicalRefProps(
  master: CanonicalNode,
  refNode: RefNode,
): Record<string, unknown> {
  const masterProps = master.props ?? {};
  const refOverrides = refNode.props ?? {};

  return applyPropsPatch(masterProps, refOverrides);
}

/**
 * @experimental ADR-903 P2 progress — canonical descendants mode A 병합.
 *
 * descendants[path]가 mode A (속성 patch — id/type/children 모두 없음)일 때
 * 기존 child 노드 속성과 머지. mode B/C는 P2 resolver의 별도 분기 담당.
 *
 * mergePropsWithStyleDeep 로 style 심층 병합.
 * canonical 형태의 child 노드를 받으므로 CanonicalNode 반환.
 *
 * @throws 호출자가 mode B(type 존재) 또는 mode C(children 존재)를 잘못 전달한 경우 에러.
 */
export function resolveCanonicalDescendantOverride(
  child: CanonicalNode,
  descendants: Record<string, DescendantOverride> | undefined,
  pathKey: string,
): CanonicalNode {
  if (!descendants) return child;
  const override = descendants[pathKey];
  if (!override) return child;

  // mode 판정: type 또는 children **배열** 이 있으면 patch 모드 아님 (caller 책임으로 에러).
  //   ADR-229: `children` 문자열 (Text/Label 본문) 은 props patch 다.
  if ("type" in override || Array.isArray(override.children)) {
    throw new Error(
      `[ADR-903] resolveCanonicalDescendantOverride called with non-patch mode at path "${pathKey}" — caller must dispatch mode B/C separately`,
    );
  }

  const childProps = child.props ?? {};
  const overrideRecord = override as Record<string, unknown>;
  const {
    fills: overrideFills,
    sizing: _sizing,
    responsive: _responsive,
    enabled: overrideEnabled,
    ...overrideProps
  } = overrideRecord;
  const mergedProps = applyPropsPatch(childProps, overrideProps);

  return {
    ...child,
    ...mergeFillSizing(child, overrideRecord),
    props: mergedProps,
    ...(Array.isArray(overrideFills) ? { fills: overrideFills } : {}),
    // ADR-234: `enabled` 는 노드 필드 (props 아님) — 부재 = 상속 · false = 숨김 · true = 표시.
    ...(typeof overrideEnabled === "boolean"
      ? { enabled: overrideEnabled }
      : {}),
  };
}

// ─────────────────────────────────────────────
// ADR-138 A-1 — items fork 감지 (canonical)
// ─────────────────────────────────────────────

/**
 * `TabItem = { id; title }` flat object (`Tabs.spec.ts:20`) 의 구조 동치 비교.
 * 배열 길이 + 각 항목의 1-depth key/value 동일성만 검사한다.
 */
function itemsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((ai, i) => {
    const bi = b[i];
    if (ai === bi) return true;
    if (typeof ai !== "object" || typeof bi !== "object" || !ai || !bi)
      return false;
    const ak = Object.keys(ai as object);
    const bk = Object.keys(bi as object);
    return (
      ak.length === bk.length &&
      ak.every(
        (k) =>
          (ai as Record<string, unknown>)[k] ===
          (bi as Record<string, unknown>)[k],
      )
    );
  });
}

/**
 * instance(`RefNode`) 가 origin(master `CanonicalNode`) 대비 `props.items` 를
 * override(fork) 했는지 판정. ADR-138 A-3 fork 표시 조건 + A-1 시나리오 2/3
 * assert 의 SSOT.
 *
 * - `refNode.props.items === undefined` → override 없음 → not forked.
 * - canonical `RefNode.props` 는 override delta 이므로 `items` 키 존재 자체가
 *   override 후보. master 와 구조 동치면 (no-op write) fork 아님.
 *
 * v1 은 `items` 만 (Tabs 핵심). 다른 prop fork 감지는 후속 ADR (A-4).
 */
export function hasItemsOverride(
  refNode: RefNode,
  master: CanonicalNode,
): boolean {
  const refItems = refNode.props?.items;
  if (refItems === undefined) return false; // override 없음
  return !itemsEqual(refItems, master.props?.items);
}

// ADR-912 후속 cleanup: resolveDescendantOverrides 제거 — ADR-116 G5-B read-through
// fallback 전용이었으나 canonical RefNode.descendants 전환으로 caller 0건.
// 신규 경로는 resolveCanonicalDescendantOverride (위 정의) 사용.
//
// 2026-09-03 leaf cleanup: resolveInstanceProps / resolveInstanceElement 제거 —
// production caller 0. 신규 경로는 resolveInstanceWithSharedCache /
// resolveCanonicalRefProps.
