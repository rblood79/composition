/**
 * ADR-205 — 텍스트 시각 축의 computed 단일 seam.
 *
 * Builder(Skia) 와 Preview(DOM/CSS) 는 D3 의 대등 consumer 인데, Skia 쪽에는 브라우저
 * cascade 가 없어 축마다 사람이 경로를 써야 했다. 그 결과 같은 축이 표면마다 다른 규칙으로
 * 해소되고, 빠뜨리면 "Preview 에만 반영" 이 조용히 생겼다 (letterSpacing 이 그 사례 —
 * `docs/adr/evidence/205-text-axis-gap-matrix.md`).
 *
 * 이 모듈이 그 해소를 한 곳으로 모은다. 규칙은 기존 선례
 * (`resolveTextLeafWhiteSpace` · `calculateContentWidth` 의 폭 leg) 와 같다:
 *
 *   인라인 style → computed(상속) → CSS 초기값
 *
 * `computed` 는 **선택 인자**다. 레이아웃은 이미 손에 쥔 `_computedStyle` 을 넘기고,
 * Skia scene build 는 그것을 가진 적이 없어(ADR-205 F20) 넘기지 않는다 — 그쪽은 인라인만
 * 해소한다. cascade 를 scene build 로 끌어오는 작업은 ADR-205 Phase 5 다.
 *
 * 소비 축은 Phase 1 의 `letterSpacing`, Phase 4 의 `fontSize` 다. 축을 늘릴 때는 이 파일과
 * `docs/adr/evidence/205-text-axis-gap-matrix.md` 의 격차표가 같이 움직인다.
 *
 * **초기값을 만드는 축과 만들지 않는 축이 있다.** `letterSpacing` 은 CSS 초기값 0 이 모든
 * 소비자에게 같아서 seam 이 끝까지 해소한다. `fontSize` 는 그렇지 않다 — 소비 지점마다
 * 기본이 catalog rule / spec / 리터럴 14·16 으로 갈리므로 (ADR-205 Phase 4 인벤토리)
 * seam 은 **인라인·상속 두 채널까지만** 해소하고 나머지는 호출부에 남긴다. seam 이 임의의
 * 초기값을 고르면 21곳의 서로 다른 기본이 조용히 하나로 뭉개진다.
 */

import { parsePxOnlyValue } from "@composition/specs";

/**
 * 텍스트 축 숫자 파싱 (px, number 만 허용).
 *
 * rem/em/%/calc 는 **인라인으로 치지 않는다** — 해소 지점이 폰트 컨텍스트를 모르기 때문이며,
 * 이는 폭 leg 이 이미 쓰던 규칙이다 (동작 무변경).
 *
 * 규칙 자체는 `@composition/specs` 의 `parsePxOnlyValue` 가 소유한다 (ADR-907 Layer A) —
 * Skia leg 의 `resolveSpecFontSize` 가 같은 함수를 쓰므로 두 leg 이 같은 문자열을 같게
 * 읽는다. 규칙을 축마다 복제하면 그 순간 한쪽만 px 문자열을 버린다 (ADR-205 Phase 4).
 */
export function parseTextAxisNumber(value: unknown): number | undefined {
  return parsePxOnlyValue(value, undefined);
}

/** 어느 채널이 값을 공급했는가 — 소비자가 "덮어쓸지" 를 판정하는 데 쓴다. */
export type TextAxisSource = "inline" | "computed" | "initial";

/** seam 이 넘겨받는 computed 조각 (`ComputedStyle` 의 구조적 부분집합). */
export interface TextRenderComputedInput {
  letterSpacing?: number;
  fontSize?: number;
}

/** seam 의 산출 — letterSpacing (Phase 1) · fontSize (Phase 4). */
export interface TextRenderStyle {
  letterSpacing: number;
  letterSpacingSource: TextAxisSource;
  /**
   * 인라인 또는 상속이 준 값. 두 채널 모두 없으면 `undefined` 이며, 그때의 기본은
   * 호출부가 정한다 (catalog rule / spec / 리터럴 — 지점마다 다르다).
   */
  fontSize?: number;
  /** 값을 준 채널. `undefined` = 두 채널 모두 침묵 (= 호출부 기본 차례). */
  fontSizeSource?: Exclude<TextAxisSource, "initial">;
}

/**
 * 인라인 style + computed 로부터 텍스트 렌더 축을 해소한다.
 *
 * @param style 요소의 인라인 style (`element.props.style`)
 * @param computed 레이아웃이 이미 해소한 `ComputedStyle` — 없으면 인라인만 해소
 */
export function resolveTextRenderStyle(
  style?: Record<string, unknown> | null,
  computed?: TextRenderComputedInput | null,
): TextRenderStyle {
  const inlineFontSize = parseTextAxisNumber(style?.fontSize);
  const fontSize =
    inlineFontSize !== undefined
      ? { fontSize: inlineFontSize, fontSizeSource: "inline" as const }
      : computed?.fontSize !== undefined
        ? { fontSize: computed.fontSize, fontSizeSource: "computed" as const }
        : {};

  const inlineLetterSpacing = parseTextAxisNumber(style?.letterSpacing);
  if (inlineLetterSpacing !== undefined) {
    return {
      letterSpacing: inlineLetterSpacing,
      letterSpacingSource: "inline",
      ...fontSize,
    };
  }
  if (computed?.letterSpacing !== undefined) {
    return {
      letterSpacing: computed.letterSpacing,
      letterSpacingSource: "computed",
      ...fontSize,
    };
  }
  return { letterSpacing: 0, letterSpacingSource: "initial", ...fontSize };
}
