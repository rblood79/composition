/**
 * Container spacing primitive — ADR-907 Layer B
 *
 * collection/self-render container 의 padding/gap/border-width/fontSize 를
 * element.props.style 우선, 없으면 defaults 로 resolve 하는 공통 entry point.
 *
 * 호출자:
 *  - Preview renderer post-process
 *  - Skia spec render.shapes()
 *  - Layout engine calculateContentHeight()
 *
 * Layer A (parsePxValue / parsePadding4Way / parseGapValue / parseBorderWidth)
 * 를 조립하여 컴포넌트-specific 확장 (numCols / cardPaddingX 등) 직전까지
 * 공통 형태를 생성한다.
 */

import {
  parsePxValue,
  parsePadding4Way,
  parseGapValue,
  parseBorderWidth,
} from "./cssValueParser";

export interface ContainerSpacing {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  borderWidth: number;
  fontSize: number;
}

export interface ContainerSpacingDefaults {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  rowGap?: number;
  columnGap?: number;
  borderWidth?: number;
  fontSize?: number;
}

export interface ContainerSpacingInput {
  style?: Record<string, unknown>;
  defaults: ContainerSpacingDefaults;
}

export function resolveContainerSpacing(
  input: ContainerSpacingInput,
): ContainerSpacing {
  const { style, defaults } = input;

  // --- padding ---
  // style 에 padding 계열 키가 하나라도 있으면 Layer A 로 위임 (longhand override shorthand).
  // 하나도 없으면 defaults 우선.
  const hasAnyPadding =
    style !== undefined &&
    (style.padding !== undefined ||
      style.paddingTop !== undefined ||
      style.paddingRight !== undefined ||
      style.paddingBottom !== undefined ||
      style.paddingLeft !== undefined);

  let paddingTop: number;
  let paddingRight: number;
  let paddingBottom: number;
  let paddingLeft: number;

  if (hasAnyPadding) {
    const parsed = parsePadding4Way({
      padding: style!.padding,
      paddingTop: style!.paddingTop,
      paddingRight: style!.paddingRight,
      paddingBottom: style!.paddingBottom,
      paddingLeft: style!.paddingLeft,
    });
    paddingTop = parsed.top;
    paddingRight = parsed.right;
    paddingBottom = parsed.bottom;
    paddingLeft = parsed.left;
  } else {
    paddingTop = defaults.paddingTop ?? 0;
    paddingRight = defaults.paddingRight ?? 0;
    paddingBottom = defaults.paddingBottom ?? 0;
    paddingLeft = defaults.paddingLeft ?? 0;
  }

  // --- gap ---
  // style 에 gap 계열 키가 있으면 Layer A 위임.
  // gap shorthand 가 있으면 row/column 모두 영향, longhand 는 각자 독립적으로 override.
  const hasGap = style !== undefined && style.gap !== undefined;
  const hasRowGap = style !== undefined && style.rowGap !== undefined;
  const hasColumnGap = style !== undefined && style.columnGap !== undefined;

  let rowGap: number;
  let columnGap: number;

  if (hasGap || hasRowGap || hasColumnGap) {
    const parsed = parseGapValue(
      {
        gap: style!.gap,
        rowGap: style!.rowGap,
        columnGap: style!.columnGap,
      },
      defaults.rowGap ?? 0,
    );
    // gap shorthand 는 row/column 모두 설정. longhand 는 각자.
    // hasGap 이면서 longhand 없으면 parsed 그대로.
    // longhand 가 있으면 Layer A 가 이미 override 처리함.
    rowGap = hasRowGap || hasGap ? parsed.row : (defaults.rowGap ?? 0);
    columnGap =
      hasColumnGap || hasGap
        ? parsed.column
        : (defaults.columnGap ?? defaults.rowGap ?? 0);
  } else {
    rowGap = defaults.rowGap ?? 0;
    columnGap = defaults.columnGap ?? defaults.rowGap ?? 0;
  }

  // --- borderWidth ---
  const borderWidth = parseBorderWidth(
    style?.borderWidth,
    defaults.borderWidth ?? 0,
  );

  // --- fontSize ---
  // style 에 fontSize 가 명시적으로 있으면 파싱, 없으면 defaults.
  const hasFontSize = style !== undefined && style.fontSize !== undefined;
  const fontSize = hasFontSize
    ? parsePxValue(style!.fontSize, defaults.fontSize ?? 14)
    : (defaults.fontSize ?? 14);

  return {
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    rowGap,
    columnGap,
    borderWidth,
    fontSize,
  };
}
