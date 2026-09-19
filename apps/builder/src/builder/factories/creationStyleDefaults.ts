import type { ComponentElementProps } from "../../types/builder/unified.types";

/**
 * 팔레트로 만드는 단순 leaf 의 builder-local 생성 style — catalog 파생 (`deriveDefaultPropsFromCatalog`)
 * 에는 style 키가 없어야 하므로 (defaultPropsDerivation.test "style 키 누출" 게이트) 생성 경로가 합성한다.
 *
 * Text `whiteSpace: pre-wrap` — 새 Text 는 줄바꿈 보존 (Figma · Framer 규약, 사용자 판정 2026-09-20,
 *   ADR-027 후속 5): 편집기 Enter 의 `\n` 을 CSS · Skia 가 같이 그리려면 pre 계열이어야 한다. 패널 Wrap
 *   은 이 값을 "Auto" 로 보인다. 기존 요소 (미지정 = normal) 는 커밋 때 승격 (`resolveCommittedWhiteSpace`).
 */
const CREATION_STYLE_DEFAULTS: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  Text: { whiteSpace: "pre-wrap" },
};

/** 생성 props = catalog 파생 + 생성 style + 호출자 initialProps (initialProps.style 이 이긴다). */
export function composeCreationProps(
  type: string,
  defaults: ComponentElementProps,
  initialProps?: Record<string, unknown>,
): ComponentElementProps {
  const creationStyle = CREATION_STYLE_DEFAULTS[type];
  if (!creationStyle) return { ...defaults, ...initialProps };
  const initialStyle = (initialProps?.style ?? {}) as Record<string, unknown>;
  const defaultStyle = (defaults.style ?? {}) as Record<string, unknown>;
  return {
    ...defaults,
    ...initialProps,
    style: { ...defaultStyle, ...creationStyle, ...initialStyle },
  } as ComponentElementProps;
}
