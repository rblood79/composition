/**
 * @fileoverview ADR-116 Phase 3 G4 — 3-A-impl: diffLegacyRoundtrip
 *
 * shadow write 결과 차이 요약 (3 카테고리 분류). Phase 3-A monitoring 1-2주
 * destructive=0 시그널 검증의 source.
 *
 * **3 카테고리 분류**:
 * - **destructive**: id/parent_id/page_id/layout_id/type/props 무손실 위반.
 *   destructive=0 가 G4 PASS prerequisite (3-B 진입 차단).
 * - **reorder**: order_num 변경 (시각 순서 정합 영향). warn 수준.
 * - **cosmetic**: legacy/canonical 이 동등 의미로 표현하는 차이 (예: 빈 props
 *   `{}` vs `undefined`). ignore.
 *
 * **분류 기준**:
 * - element id 매칭 (Map<id, Element>).
 * - missing/extra (한쪽에만 존재) → destructive.
 * - parent_id / page_id / layout_id / type 변경 → destructive.
 * - props deep-equal 위반 → destructive (단, 동등 의미 nullish 차이는 cosmetic).
 * - order_num 변경 → reorder.
 */

import type { Element } from "@/types/builder/unified.types";

export interface RoundtripDiffEntry {
  /** legacy element id */
  id: string;
  /** 차이 발생 필드명 (예: "parent_id", "props.label", "missing") */
  field: string;
  /** before 값 (legacy export 시점) */
  before: unknown;
  /** after 값 (canonical roundtrip 결과) */
  after: unknown;
}

export interface RoundtripDiff {
  /** id/parent_id/page_id/layout_id/type/props 무손실 위반 — G4 PASS 차단 */
  destructive: RoundtripDiffEntry[];
  /** order_num 변경 — warn 수준 */
  reorder: RoundtripDiffEntry[];
  /** 동등 의미 차이 — ignore */
  cosmetic: RoundtripDiffEntry[];
}

const STRUCTURAL_FIELDS: ReadonlyArray<keyof Element> = [
  "type",
  "parent_id",
  "page_id",
  "layout_id",
];

/**
 * legacy `Element[]` 두 snapshot 간 차이 요약.
 *
 * @param before - 비교 기준 (legacy 직접 저장 결과)
 * @param after - 비교 대상 (canonical 저장 → legacy export 결과)
 * @returns 3 카테고리 분류된 RoundtripDiff
 */
export function diffLegacyRoundtrip(
  before: Element[],
  after: Element[],
): RoundtripDiff {
  const diff: RoundtripDiff = {
    destructive: [],
    reorder: [],
    cosmetic: [],
  };

  const beforeMap = new Map(before.map((el) => [el.id, el]));
  const afterMap = new Map(after.map((el) => [el.id, el]));

  // missing (before 에만 있음) — destructive
  for (const [id, beforeEl] of beforeMap) {
    if (!afterMap.has(id)) {
      diff.destructive.push({
        id,
        field: "missing",
        before: beforeEl,
        after: undefined,
      });
    }
  }

  // extra (after 에만 있음) — destructive
  for (const [id, afterEl] of afterMap) {
    if (!beforeMap.has(id)) {
      diff.destructive.push({
        id,
        field: "extra",
        before: undefined,
        after: afterEl,
      });
    }
  }

  // common — field-by-field 비교
  for (const [id, beforeEl] of beforeMap) {
    const afterEl = afterMap.get(id);
    if (!afterEl) continue;

    // structural fields → destructive 분류
    for (const field of STRUCTURAL_FIELDS) {
      const a = normalizeNullish(beforeEl[field]);
      const b = normalizeNullish(afterEl[field]);
      if (a !== b) {
        diff.destructive.push({
          id,
          field,
          before: beforeEl[field],
          after: afterEl[field],
        });
      }
    }

    // order_num → reorder
    const beforeOrder = beforeEl.order_num ?? 0;
    const afterOrder = afterEl.order_num ?? 0;
    if (beforeOrder !== afterOrder) {
      diff.reorder.push({
        id,
        field: "order_num",
        before: beforeOrder,
        after: afterOrder,
      });
    }

    // props deep-equal — destructive (동등 nullish 는 cosmetic)
    const propsDiff = diffProps(id, beforeEl.props, afterEl.props);
    diff.destructive.push(...propsDiff.destructive);
    diff.cosmetic.push(...propsDiff.cosmetic);
  }

  return diff;
}

/**
 * null vs undefined 동등 처리 (legacy 는 null, canonical 은 undefined 일 수 있음).
 * 그 외 값은 그대로 비교.
 */
function normalizeNullish(value: unknown): unknown {
  return value ?? null;
}

interface PropsDiffResult {
  destructive: RoundtripDiffEntry[];
  cosmetic: RoundtripDiffEntry[];
}

/**
 * props 객체 deep-equal — 동등 nullish ({} vs undefined / null vs missing) 는
 * cosmetic, 실제 값 차이는 destructive.
 */
function diffProps(
  id: string,
  beforeProps: Record<string, unknown> | undefined,
  afterProps: Record<string, unknown> | undefined,
): PropsDiffResult {
  const result: PropsDiffResult = { destructive: [], cosmetic: [] };

  const beforeNorm = beforeProps ?? {};
  const afterNorm = afterProps ?? {};

  const allKeys = new Set([
    ...Object.keys(beforeNorm),
    ...Object.keys(afterNorm),
  ]);

  for (const key of allKeys) {
    const a = beforeNorm[key];
    const b = afterNorm[key];

    if (deepEqual(a, b)) continue;

    // nullish 동등 처리 (null ↔ undefined ↔ missing)
    if (isNullishEquivalent(a, b)) {
      result.cosmetic.push({
        id,
        field: `props.${key}`,
        before: a,
        after: b,
      });
      continue;
    }

    result.destructive.push({
      id,
      field: `props.${key}`,
      before: a,
      after: b,
    });
  }

  return result;
}

function isNullishEquivalent(a: unknown, b: unknown): boolean {
  return (a === null || a === undefined) && (b === null || b === undefined);
}

/**
 * 단순 deep equal — 객체/배열/primitive 만 처리. function/Date/Map/Set 미지원
 * (legacy props 는 JSON-serializable 데이터만 저장).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}
