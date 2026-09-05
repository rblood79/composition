/**
 * CSS value parser SSOT — ADR-907 Layer A
 *
 * collection/self-render container 의 element.props.style 에서
 * padding / gap / border-width 를 수치로 정규화하는 단일 parser.
 *
 * 기존 call-site 전수 교체 대상:
 * - apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
 * - packages/specs/src/components/*.spec.ts (ad-hoc parseFloat 패턴)
 * - packages/shared/src/renderers/** (Preview post-process)
 *
 * 숫자/문자열/undefined 3 형태를 모두 수용하며 fallback 으로 기존 default 를 보존한다.
 */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 단일 값 파싱. 숫자/숫자 문자열/px 단위 문자열 수용.
 * undefined/null/빈 문자열/파싱 실패 시 fallback 반환.
 *
 * Fallback 은 **generic** — number 외에 TokenRef (`"{radius.sm}"` 등) 도 그대로
 * 통과시킬 수 있다. Spec shapes 의 `borderRadius`/`radius` 필드는 TokenRef 를
 * 다운스트림 Skia pipeline 이 `resolveToken` 으로 해석하므로, parser 레벨에서는
 * fallback 을 형식 무관하게 passthrough 한다. 결과 타입은 `number | F` — 호출자
 * 는 숫자만 필요하면 F=number 로 호출해 좁힐 수 있다.
 */
export function parsePxValue<F = number>(
  value: unknown,
  fallback: F,
): number | F {
  if (isFiniteNumber(value)) return value;
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  if (trimmed === "") return fallback;

  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 엄격 단위 파싱 — **px 또는 단위 없는 숫자만** 수용한다.
 *
 * `parsePxValue` 와 갈리는 지점은 상대 단위다. `parsePxValue` 는 `parseFloat` 라
 * `"2em"` 을 2 로, `"50%"` 를 50 으로 읽는다. 길이가 "그 자리의 폰트·부모 크기에 대한
 * 배수" 인 축(font-size, letter-spacing)에서는 그 해석이 틀린 값을 만든다 — 해소 지점이
 * 폰트 컨텍스트를 모르기 때문이다.
 *
 * 그래서 레이아웃 경로(`parseNumericValue`)와 ADR-205 seam 은 예전부터 px/숫자만
 * 받아들였다. 이 함수가 그 규칙의 SSOT 다 — 축마다 따로 쓰면 Skia 와 레이아웃이 같은
 * 문자열을 다르게 읽는다 (ADR-205 Phase 4 실측: Skia 만 px 문자열을 통째로 버렸다).
 */
export function parsePxOnlyValue<F = undefined>(
  value: unknown,
  fallback: F = undefined as F,
): number | F {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?(px)?$/.test(trimmed)) return fallback;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * CSS padding shorthand 를 1/2/3/4 값으로 분해.
 * 예: "8px 16px" → { top: 8, right: 16, bottom: 8, left: 16 }
 * 파싱 실패 부위는 0 으로 채움.
 */
function parseShorthand4(value: unknown): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} | null {
  if (isFiniteNumber(value)) {
    return { top: value, right: value, bottom: value, left: value };
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const tokens = trimmed.split(/\s+/);
  const parsed = tokens.map((t) => {
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  });

  switch (parsed.length) {
    case 1:
      return {
        top: parsed[0],
        right: parsed[0],
        bottom: parsed[0],
        left: parsed[0],
      };
    case 2:
      return {
        top: parsed[0],
        right: parsed[1],
        bottom: parsed[0],
        left: parsed[1],
      };
    case 3:
      return {
        top: parsed[0],
        right: parsed[1],
        bottom: parsed[2],
        left: parsed[1],
      };
    case 4:
      return {
        top: parsed[0],
        right: parsed[1],
        bottom: parsed[2],
        left: parsed[3],
      };
    default:
      return null;
  }
}

/**
 * CSS padding 4-way 정규화. longhand 가 shorthand override.
 */
export function parsePadding4Way(style?: {
  padding?: unknown;
  paddingTop?: unknown;
  paddingRight?: unknown;
  paddingBottom?: unknown;
  paddingLeft?: unknown;
}): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (!style) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const base = parseShorthand4(style.padding) ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  return {
    top:
      style.paddingTop !== undefined
        ? parsePxValue(style.paddingTop, base.top)
        : base.top,
    right:
      style.paddingRight !== undefined
        ? parsePxValue(style.paddingRight, base.right)
        : base.right,
    bottom:
      style.paddingBottom !== undefined
        ? parsePxValue(style.paddingBottom, base.bottom)
        : base.bottom,
    left:
      style.paddingLeft !== undefined
        ? parsePxValue(style.paddingLeft, base.left)
        : base.left,
  };
}

/**
 * border-width 정규화. keyword (thin/medium/thick) 미지원 — 숫자/px 만.
 */
export function parseBorderWidth(value: unknown, fallback: number = 0): number {
  return parsePxValue(value, fallback);
}

/**
 * CSS gap 정규화. row/column 2값 shorthand 또는 longhand.
 */
export function parseGapValue(
  style?: {
    gap?: unknown;
    rowGap?: unknown;
    columnGap?: unknown;
  },
  fallback: number = 0,
): { row: number; column: number } {
  if (!style) {
    return { row: fallback, column: fallback };
  }

  let baseRow = fallback;
  let baseColumn = fallback;

  if (style.gap !== undefined) {
    if (isFiniteNumber(style.gap)) {
      baseRow = style.gap;
      baseColumn = style.gap;
    } else if (typeof style.gap === "string") {
      const trimmed = style.gap.trim();
      if (trimmed !== "") {
        const tokens = trimmed.split(/\s+/);
        const parsed = tokens.map((t) => {
          const n = parseFloat(t);
          return Number.isFinite(n) ? n : null;
        });
        if (parsed.length === 1 && parsed[0] !== null) {
          baseRow = parsed[0];
          baseColumn = parsed[0];
        } else if (
          parsed.length === 2 &&
          parsed[0] !== null &&
          parsed[1] !== null
        ) {
          baseRow = parsed[0];
          baseColumn = parsed[1];
        }
      }
    }
  }

  return {
    row:
      style.rowGap !== undefined
        ? parsePxValue(style.rowGap, baseRow)
        : baseRow,
    column:
      style.columnGap !== undefined
        ? parsePxValue(style.columnGap, baseColumn)
        : baseColumn,
  };
}
