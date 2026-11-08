/**
 * MiniThemePreview - CSS 변수 기반 경량 미니 프리뷰 (ADR-021 Phase B)
 *
 * tint/neutral/radius 변경을 CSS 변수 인라인 오버라이드로 즉시 반영.
 * Builder DOM의 CSS 변수에 의존하지 않고, 활성 테마 preset (Themes host) 에서 직접 계산.
 * Tone 단은 역할 색과 같은 생성 사다리 (ADR-302 — `useToneLadders`, Spectrum gray 13 단 모양).
 */

import { memo, useMemo } from "react";
import type { NeutralPreset } from "../../../utils/theme/neutralToSkiaColors";
import { useThemesHost } from "./themesHost";
import { useToneLadders } from "./useToneLadders";

/** 견본 단 — Spectrum gray 의 층 · 면 · 테두리 · 글자 단 (ADR-302 G2 단 범위). */
const SWATCH_STEPS = [50, 200, 400, 600, 800, 1000] as const;

export const MiniThemePreview = memo(function MiniThemePreview() {
  const preset = useThemesHost().useActivePreset();
  const neutral = preset.neutral as NeutralPreset;
  const radiusScale = preset.radiusScale;
  const palette = useToneLadders()[neutral];

  const vars = useMemo(() => {
    const radiusMap: Record<string, number> = {
      none: 0,
      sm: 0.5,
      md: 1,
      lg: 1.5,
      xl: 2,
    };
    const rf = radiusMap[radiusScale];
    const radius = `${6 * rf}px`;

    return {
      "--mp-bg": palette?.[50],
      "--mp-bg-200": palette?.[200],
      "--mp-border": palette?.[300],
      "--mp-radius": radius,
    } as React.CSSProperties;
  }, [palette, radiusScale]);

  return (
    <div className="mini-preview" style={vars}>
      {/* Neutral 스와치 — tone 차이 시각 확인용 */}
      <div className="mini-preview__swatches">
        {SWATCH_STEPS.map((step) => (
          <div
            key={step}
            className="mini-preview__swatch"
            style={{ background: palette?.[step] }}
            title={`${neutral}-${step}`}
          />
        ))}
      </div>
    </div>
  );
});
