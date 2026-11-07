import { createContext, useContext } from "react";
import { Input } from "react-aria-components/Input";
import { NumberField } from "react-aria-components/NumberField";
import { useI18n } from "../../../../i18n";
import "./glyphSizeAction.css";

/**
 * 2026-11-07 (사용자 「Size 의 단계가 XS–XL 뿐이라 액션 칸의 리셋 버튼 대신 숫자 입력 (리셋 버튼과 같은
 * 크기)」): a glyph's (Icon · Illustration) Size row holds its drawn px in the row's action cell — the
 * one size the Text tab's Font Size and the Layout Width · Height show (`catalogRuntime/glyphSize.ts`).
 * The step is re-picked on the seg itself, so the cell has no reset.
 */
export interface GlyphSizeSource {
  /** The drawn square in px. */
  value: number | undefined;
  /** Sized off its step (an authored box or font size) — the seg shows no step. */
  custom: boolean;
  commit(px: number): void;
}

export const GlyphSizeContext = createContext<GlyphSizeSource | null>(null);

export function useGlyphSize(): GlyphSizeSource | null {
  return useContext(GlyphSizeContext);
}

export function GlyphSizeAction({ source }: { source: GlyphSizeSource }) {
  const { t } = useI18n();
  const shown = source.value === undefined ? NaN : Math.round(source.value);
  // (RAC keeps the typed text until Enter · blur, then reports the number once.)
  return (
    <div className="fieldset-actions actions-glyph-size">
      <NumberField
        aria-label={t("propertiesPanel.glyphSize")}
        value={shown}
        minValue={1}
        step={1}
        formatOptions={{ maximumFractionDigits: 0, useGrouping: false }}
        onChange={(next) => {
          if (!Number.isFinite(next) || next < 1 || next === shown) return;
          source.commit(next);
        }}
      >
        <Input className="react-aria-Input glyph-size-input" />
      </NumberField>
    </div>
  );
}
