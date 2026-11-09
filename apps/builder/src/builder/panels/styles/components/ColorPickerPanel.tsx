/**
 * ColorPickerPanel - 풀 컬러 피커 패널
 *
 * Color Picker Phase 1: HSB ColorArea + Hue/Alpha Slider + Input Fields
 * - 드래그 최적화: 로컬 상태로 UI 업데이트, onChangeEnd에서 부모 콜백
 * - React Aria parseColor 사용
 *
 * @since 2026-02-10 Color Picker Phase 1
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import {
  ColorPicker as AriaColorPicker,
  parseColor,
  type Color,
} from "react-aria-components/ColorPicker";
import { ColorArea } from "@composition/shared/components/ColorArea";
import { ColorSlider } from "@composition/shared/components/ColorSlider";
import { ColorInputModeSelector } from "./ColorInputModeSelector";
import { ColorInputFields, HexField } from "./ColorInputFields";
import { EyeDropperButton } from "./EyeDropperButton";
import { ColorPickerPalettes } from "./ColorPickerPalettes";
import { parseRacColorOrBlack } from "../utils/colorUtils";
import { useThemeConfigDarkMode } from "../../../../stores/themeConfigStore";
import {
  panelFillColorHex,
  panelTokenRef,
} from "../../../catalogRuntime/panelTokens";
import {
  recordEditorPresentationRawInput,
  recordEditorPresentationTerminalEvent,
} from "../../../performance/editorPresentationPhase0Metrics";

import "./ColorPickerPanel.css";

/** ADR-298 Phase 3 — a theme color token's variable (`var(--accent)`), the panel's token text. */
const isColorToken = (value: string) =>
  !!panelTokenRef(value)?.startsWith("{color.");

interface ColorPickerPanelProps {
  /** "#RRGGBBAA" hex8, or a theme color token's variable (`var(--accent)` — ADR-298 Phase 3). */
  value: string;
  resetKey?: string;
  /**
   * `onChange` previews on the Canvas through the Styles host (catalog): Escape / pointer cancel
   * report `onPresentationCancel` so the preview goes back. The release still commits only a
   * changed value.
   */
  livePreview?: boolean;
  onPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  /** 드래그 중 미리보기 — 없으면 손을 놓을 때 (`onChangeEnd`) 만 알린다. */
  onChange?: (color: string) => void;
  onChangeEnd: (color: string) => void;
}

/**
 * 드래그 중 로컬 상태 관리 — `value` 는 마운트 · `resetKey` 변경 시에만 읽는다 (외부 preview
 * 값으로는 재초기화하지 않는다).
 */
export const ColorPickerPanel = memo(function ColorPickerPanel({
  value: initialValue,
  resetKey,
  livePreview = false,
  onPresentationCancel,
  onChange,
  onChangeEnd,
}: ColorPickerPanelProps) {
  const mode = useThemeConfigDarkMode() === "dark" ? "dark" : "light";
  const [localColor, setLocalColor] = useState<Color>(() =>
    parseRacColorOrBlack(panelFillColorHex(initialValue, mode)),
  );
  // The committed value when it is a theme token (its swatch shows selected); a picked literal clears it.
  const [token, setToken] = useState<string | undefined>(() =>
    isColorToken(initialValue) ? initialValue : undefined,
  );
  const lastSavedRef = useRef<string>(initialValue);
  /**
   * `livePreview`: a drag is under way, and whether Escape / pointer cancel ended it — the rest of
   * that gesture (moves and its release) neither previews nor commits.
   */
  const draggingRef = useRef(false);
  const cancelledRef = useRef(false);

  const lastResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) {
      return;
    }
    lastResetKeyRef.current = resetKey;

    const parsed = parseRacColorOrBlack(panelFillColorHex(initialValue, mode));
    setLocalColor(parsed);
    setToken(isColorToken(initialValue) ? initialValue : undefined);
    lastSavedRef.current = isColorToken(initialValue)
      ? initialValue
      : parsed.toString("hexa");
  }, [initialValue, resetKey, mode]);

  // 드래그 중: 로컬 상태를 즉시 갱신하고 `onChange` 로 미리보기를 넘긴다 (프레임 배칭은
  // Styles host 미리보기 쪽 — `useOptimizedStyleActions`).
  // 색 영역 · 색상 슬라이더가 내는 Color 는 알파를 잃을 수 있다 (RAC ColorArea 의 키보드
  //   onChangeEnd 가 알파 1 인 hsb Color 를 냈다 — 2026-09-15 live). rgb 가 바뀐 이벤트는 로컬
  //   알파를 보존하고, rgb 가 같고 알파만 다른 이벤트 (알파 슬라이더) 만 알파를 받는다.
  const withLocalAlpha = useCallback(
    (color: Color) =>
      color.withChannelValue("alpha", localColor.getChannelValue("alpha")),
    [localColor],
  );
  const reconcileAlpha = useCallback(
    (color: Color) =>
      color.toString("hex") !== localColor.toString("hex")
        ? withLocalAlpha(color)
        : color,
    [localColor, withLocalAlpha],
  );

  const handleChange = useCallback(
    (raw: Color | null) => {
      if (!raw) return;
      if (cancelledRef.current) return;
      draggingRef.current = true;
      const color = reconcileAlpha(raw);
      recordEditorPresentationRawInput();
      setLocalColor(color);
      setToken(undefined);
      onChange?.(color.toString("hexa"));
    },
    [onChange, reconcileAlpha],
  );

  // 드래그 종료: 최종 값 flush + 실제 저장
  const handleChangeEnd = useCallback(
    (color: Color) => {
      recordEditorPresentationTerminalEvent();
      draggingRef.current = false;
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      // 최종 색상으로 로컬 상태 동기화
      setLocalColor(color);
      setToken(undefined);

      const hex = color.toString("hexa");
      if (hex !== lastSavedRef.current) {
        lastSavedRef.current = hex;
        onChangeEnd(hex);
      }
    },
    [onChangeEnd],
  );

  // InputFields에서 직접 hex8 문자열로 변경 · Theme 스와치는 토큰 변수 (ADR-298 Phase 3)
  const handleInputChange = useCallback(
    (hex: string) => {
      if (isColorToken(hex)) {
        setLocalColor(parseRacColorOrBlack(panelFillColorHex(hex, mode)));
        setToken(hex);
        if (lastSavedRef.current !== hex) {
          lastSavedRef.current = hex;
          onChangeEnd(hex);
        }
        return;
      }
      setToken(undefined);
      try {
        const parsed = parseColor(hex);
        setLocalColor(parsed);
        lastSavedRef.current = hex;
        onChangeEnd(hex);
      } catch {
        // 무효한 입력 무시
      }
    },
    [onChangeEnd, mode],
  );

  /** A live drag in progress ends: the picker shows the committed color again. */
  const cancelLiveDrag = () => {
    if (!livePreview || !draggingRef.current) return;
    cancelledRef.current = true;
    setLocalColor(
      parseRacColorOrBlack(panelFillColorHex(lastSavedRef.current, mode)),
    );
  };

  const hexValue = localColor.toString("hexa");

  return (
    <AriaColorPicker value={localColor} onChange={handleChange}>
      <div
        className="color-picker-panel"
        // A new gesture starts afresh (a cancelled one may never report its release).
        onPointerDownCapture={() => {
          cancelledRef.current = false;
        }}
        onKeyDownCapture={(event) => {
          if (event.key !== "Escape" && !draggingRef.current)
            cancelledRef.current = false;
          if (livePreview && event.key === "Escape") {
            cancelLiveDrag();
            onPresentationCancel?.("escape");
          }
        }}
        onPointerCancelCapture={() => {
          if (livePreview) {
            cancelLiveDrag();
            onPresentationCancel?.("pointer-cancel");
          }
        }}
      >
        <ColorArea
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          onChangeEnd={(color) => handleChangeEnd(withLocalAlpha(color))}
        />
        <ColorSlider
          colorSpace="hsb"
          channel="hue"
          onChangeEnd={(color) => handleChangeEnd(withLocalAlpha(color))}
        />
        <ColorSlider channel="alpha" onChangeEnd={handleChangeEnd} />
        {/* 첫 행 「[HEX|RGBA|CSS] [623CEA hex] [스포이드]」 · 둘째 행은 모드별 (RGBA: [R G B] [A],
            CSS: 문자열) — HEX 는 첫 행이 전부 (panel-ui 05 · 17, 대조 B8) */}
        <div className="color-picker-panel__inputs">
          <div className="color-picker-panel__inputs-row">
            <ColorInputModeSelector />
            <HexField value={hexValue} onChange={handleInputChange} />
            <EyeDropperButton onColorPick={handleInputChange} />
          </div>
          <ColorInputFields value={hexValue} onChange={handleInputChange} />
        </div>
        <ColorPickerPalettes
          value={hexValue}
          token={token}
          onSelect={handleInputChange}
        />
      </div>
    </AriaColorPicker>
  );
});
