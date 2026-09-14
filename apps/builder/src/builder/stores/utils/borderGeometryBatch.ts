/**
 * ADR-219 — border 기하 축의 **배치 편집 연산** (HC3, breakdown §2.2)
 *
 * 사후 정규화 (저장된 형태만 보고 접기/펼치기) 는 편집 의도를 잃는다 — 코너 `[8,4,2,6]`
 * 에 shorthand 12 를 쓰면 기존 longhand 가 남고, 카탈로그 base 8 · 빈 style 에서 TL 만
 * 12 로 쓰면 미편집 코너가 0 이 된다. 그래서 store 는 border 축 키 10 (shorthand 2 +
 * longhand 8) 을 항목별이 아니라 **배치 하나로** 받아 축마다 고정 우선순위로 한 번 적용한다:
 *
 *   0. `next = effective` — 편집 전 유효 4값 (longhand ?? shorthand ?? catalog base ?? 0)
 *   1. shorthand — 값이면 4칸 전부, 지우기면 base 4값 + 축 키 5 삭제 예약
 *   2. longhand — 키 이름 순서 고정 (TL·TR·BR·BL / T·R·B·L), 값은 그 칸 · 지우기는 base.
 *      shorthand 뒤라 **longhand 가 shorthand 를 이긴다** (`{TL:12, borderRadius:4}` 는
 *      두 순서 모두 `[12,4,4,4]`)
 *   3. 접기/펼치기 — 4값 같으면 shorthand 하나 · 다르면 longhand 4. 지우기만 있는 배치
 *      (reset) 는 축 키 5 를 지우고 base 를 다시 쓰지 않는다
 *
 * 불변식: 배치 뒤 각 축은 「override 키 0」·「shorthand 1 · longhand 0」·「shorthand 0 ·
 * longhand 4」 중 하나 (부분 longhand 0). 배치에 없는 축은 건드리지 않는다. 순서 독립은
 * 입력 순서를 읽지 않는 규칙에서 나온다.
 */

import {
  BORDER_RADIUS_LONGHANDS,
  BORDER_WIDTH_LONGHANDS,
  isBorderGeometryProp,
  resolveBorderGeometry,
  type BorderGeometryBase,
} from "../../workspace/canvas/styleConversion/borderGeometry";
import { toStyleNumericValue } from "./responsiveWriteRouting";

type Axis = {
  shorthand: "borderRadius" | "borderWidth";
  longhands: readonly [string, string, string, string];
};

const RADIUS_AXIS: Axis = {
  shorthand: "borderRadius",
  longhands: BORDER_RADIUS_LONGHANDS,
};
const WIDTH_AXIS: Axis = {
  shorthand: "borderWidth",
  longhands: BORDER_WIDTH_LONGHANDS,
};

export type StyleEntryValue = string | number | null | undefined;

const isClearing = (v: StyleEntryValue): boolean =>
  v === "" || v === null || v === undefined;

export interface BorderGeometryBatchResult {
  /** 반경 축을 건드렸는가 (값 쓰기 또는 reset) */
  radiusTouched: boolean;
  /** 폭 축을 건드렸는가 */
  widthTouched: boolean;
  /** 폭 축에 **값** 을 썼는가 — companion 트리거 (reset 만이면 false) */
  widthWritten: boolean;
}

function applyAxis(
  style: Record<string, unknown>,
  axis: Axis,
  entries: Map<string, StyleEntryValue>,
  effective: readonly [number, number, number, number],
  base: number,
): { touched: boolean; written: boolean } {
  const shorthandEntry = entries.has(axis.shorthand)
    ? entries.get(axis.shorthand)
    : undefined;
  const hasShorthand = entries.has(axis.shorthand);
  const longhandEntries = axis.longhands.map((key) =>
    entries.has(key) ? { key, value: entries.get(key) } : null,
  );
  if (!hasShorthand && longhandEntries.every((e) => e === null)) {
    return { touched: false, written: false };
  }

  const anyValue =
    (hasShorthand && !isClearing(shorthandEntry)) ||
    longhandEntries.some((e) => e !== null && !isClearing(e.value));

  const deleteAxisKeys = () => {
    delete style[axis.shorthand];
    for (const key of axis.longhands) delete style[key];
  };

  // reset = shorthand 지우기 + 값 항목 0 (longhand 지우기가 같이 와도) — 축 키 5 삭제,
  //   base 를 다시 쓰지 않는다. longhand 지우기만 있는 배치는 reset 이 아니라 "그 칸을
  //   base 로" 편집이다 (시나리오 ⑤).
  if (hasShorthand && !anyValue) {
    deleteAxisKeys();
    return { touched: true, written: false };
  }

  const toNumber = (key: string, value: StyleEntryValue): number => {
    const n = toStyleNumericValue(key, String(value));
    const num = typeof n === "number" ? n : parseFloat(String(n));
    return Number.isFinite(num) && num > 0 ? num : 0;
  };

  // 0. 편집 전 유효값에서 시작
  const next: [number, number, number, number] = [
    effective[0],
    effective[1],
    effective[2],
    effective[3],
  ];

  // 1. shorthand
  if (hasShorthand) {
    if (isClearing(shorthandEntry)) {
      next[0] = next[1] = next[2] = next[3] = base;
    } else {
      const v = toNumber(axis.shorthand, shorthandEntry);
      next[0] = next[1] = next[2] = next[3] = v;
    }
  }

  // 2. longhand — 키 이름 순서 고정, shorthand 를 이긴다
  for (let i = 0; i < 4; i++) {
    const e = longhandEntries[i];
    if (!e) continue;
    next[i] = isClearing(e.value) ? base : toNumber(e.key, e.value);
  }

  // 3. 접기/펼치기 — 한 번
  deleteAxisKeys();
  if (next[0] === next[1] && next[1] === next[2] && next[2] === next[3]) {
    style[axis.shorthand] = next[0];
  } else {
    for (let i = 0; i < 4; i++) style[axis.longhands[i]] = next[i];
  }
  return { touched: true, written: true };
}

/**
 * border 축 항목들을 `style` 에 한 번에 반영한다 (in place). 축 키가 아닌 항목은 무시한다
 * — 호출측이 `isBorderGeometryProp` 으로 갈라 넘긴다.
 *
 * `base` 는 카탈로그 base 단일값 (`resolveAppearanceSpecPreset(type, size)`) — 미편집
 * 칸과 지우기의 복귀값. `effective` 는 이 함수가 `style` (편집 전) 과 `base` 로 읽는다.
 */
export function applyBorderGeometryBatch(
  style: Record<string, unknown>,
  entries: Iterable<readonly [string, StyleEntryValue]>,
  base?: BorderGeometryBase | null,
): BorderGeometryBatchResult {
  const map = new Map<string, StyleEntryValue>();
  for (const [key, value] of entries) {
    if (isBorderGeometryProp(key)) map.set(key, value);
  }
  if (map.size === 0) {
    return { radiusTouched: false, widthTouched: false, widthWritten: false };
  }

  // 편집 전 snapshot 에서 유효값·base 를 한 번 읽는다 (항목마다 다시 읽지 않는다 — round 2 h1)
  const effective = resolveBorderGeometry(style, base);
  const baseGeometry = resolveBorderGeometry(undefined, base);

  const radius = applyAxis(
    style,
    RADIUS_AXIS,
    map,
    effective.radii,
    baseGeometry.radii[0],
  );
  const width = applyAxis(
    style,
    WIDTH_AXIS,
    map,
    effective.widths,
    baseGeometry.widths[0],
  );

  return {
    radiusTouched: radius.touched,
    widthTouched: width.touched,
    widthWritten: width.written,
  };
}

/**
 * HC3 불변식 — 축마다 shorthand 와 longhand 가 동시에 있지 않고, longhand 는 0 또는 4.
 * 위반 축 이름을 돌려준다 (없으면 빈 배열).
 */
export function findBorderGeometryInvariantViolations(
  style: Record<string, unknown> | undefined | null,
): string[] {
  if (!style) return [];
  const violations: string[] = [];
  for (const axis of [RADIUS_AXIS, WIDTH_AXIS]) {
    const hasShort = style[axis.shorthand] != null;
    const longCount = axis.longhands.filter((k) => style[k] != null).length;
    if (hasShort && longCount > 0)
      violations.push(`${axis.shorthand}+longhand`);
    else if (longCount !== 0 && longCount !== 4)
      violations.push(`${axis.shorthand}:partial-longhand(${longCount})`);
  }
  return violations;
}
