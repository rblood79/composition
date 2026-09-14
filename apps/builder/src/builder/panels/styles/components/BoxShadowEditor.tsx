/**
 * BoxShadowEditor — 그림자 레이어 **하나**의 편집기 (팝오버 안: X · Y · Blur · Spread · Color)
 *
 * 레이어 목록 · 추가 · inset · 제거는 Effect 절의 행 (`BoxShadowLayerRow`) 이 맡는다 —
 * 종전엔 이 편집기가 레이어 Select + ⋮ 메뉴까지 들고 있었다 (panel-ui 02, 2026-09-14).
 * 값 편집은 local draft + ADR-187 presentation preview/commit, Escape · pointer-cancel 은
 * presentation cancel. 호출측이 boxShadow 문자열을 key 로 써 remount 한다.
 */

import { memo, useCallback, useRef, useState } from "react";
import { PropertyColor, PropertyUnitInput } from "../../../components";
import {
  patchBoxShadowPresentation,
  type BoxShadowPresentationField,
  type BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";

type BoxShadowEditorCancelReason = "escape" | "pointer-cancel";
type BoxShadowNumericField = Exclude<
  BoxShadowPresentationField,
  "color" | "inset"
>;

export interface BoxShadowEditorProps {
  readonly onCancel: (reason: BoxShadowEditorCancelReason) => void;
  readonly onCommit: (value: BoxShadowPresentationValue) => void;
  readonly onPreview: (value: BoxShadowPresentationValue) => void;
  readonly presentationOwnsFrameScheduling: boolean;
  readonly value: BoxShadowPresentationValue;
  /** 편집 대상 레이어 (행이 정한다). */
  readonly layerIndex: number;
}

const NUMERIC_FIELDS: ReadonlyArray<{
  readonly field: BoxShadowNumericField;
  readonly label: string;
  readonly suffixLabel: string;
  readonly min: number;
}> = [
  { field: "offsetX", label: "Offset X", suffixLabel: "X", min: -9999 },
  { field: "offsetY", label: "Offset Y", suffixLabel: "Y", min: -9999 },
  { field: "blur", label: "Blur", suffixLabel: "BLUR", min: 0 },
  { field: "spread", label: "Spread", suffixLabel: "SPREAD", min: -9999 },
];

function parsePixelValue(value: string): number | null {
  const match = value.trim().match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))px$/i);
  if (!match) return null;
  const numericValue = Number(match[1]);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toPixelValue(value: number): string {
  return `${value}px`;
}

export const BoxShadowEditor = memo(function BoxShadowEditor({
  onCancel,
  onCommit,
  onPreview,
  presentationOwnsFrameScheduling,
  value,
  layerIndex,
}: BoxShadowEditorProps) {
  const initialValueRef = useRef(value);
  const localValueRef = useRef(value);
  const [localValue, setLocalValue] = useState(value);
  const activeLayer = localValue.layers[layerIndex];

  const updateField = useCallback(
    (
      field: BoxShadowPresentationField,
      nextValue: number | string | boolean,
      phase: "commit" | "preview",
    ): void => {
      const next = patchBoxShadowPresentation(
        localValueRef.current,
        layerIndex,
        field,
        nextValue,
      );
      if (next === null) return;
      localValueRef.current = next;
      setLocalValue(next);
      if (phase === "preview") onPreview(next);
      else onCommit(next);
    },
    [layerIndex, onCommit, onPreview],
  );

  const updateNumericField = useCallback(
    (
      field: BoxShadowNumericField,
      nextValue: string,
      phase: "commit" | "preview",
    ): void => {
      const numericValue = parsePixelValue(nextValue);
      if (numericValue === null) return;
      updateField(field, numericValue, phase);
    },
    [updateField],
  );

  const cancel = useCallback(
    (reason: BoxShadowEditorCancelReason): void => {
      localValueRef.current = initialValueRef.current;
      setLocalValue(initialValueRef.current);
      onCancel(reason);
    },
    [onCancel],
  );

  if (!activeLayer) return null;

  return (
    <div
      // `section` 은 form-controls 의 컨트롤 규칙 스코프 (팝오버는 패널 밖 portal)
      className="box-shadow-editor section"
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") cancel("escape");
      }}
      onPointerCancelCapture={() => cancel("pointer-cancel")}
    >
      <div className="box-shadow-editor-fields">
        {NUMERIC_FIELDS.map(({ field, label, suffixLabel, min }) => (
          <PropertyUnitInput
            key={field}
            className={`box-shadow-${field}`}
            label={label}
            labelMode="suffix"
            suffixLabel={suffixLabel}
            value={toPixelValue(activeLayer[field])}
            units={["px"]}
            defaultUnit="px"
            allowKeywords={false}
            min={min}
            max={9999}
            onDrag={(nextValue) =>
              updateNumericField(field, nextValue, "preview")
            }
            onChange={(nextValue) =>
              updateNumericField(field, nextValue, "commit")
            }
          />
        ))}
      </div>
      <PropertyColor
        className="box-shadow-color"
        label="Shadow Color"
        showValue
        value={activeLayer.color}
        onPreview={(nextColor) => updateField("color", nextColor, "preview")}
        onChange={(nextColor) => updateField("color", nextColor, "commit")}
        presentationOwnsFrameScheduling={presentationOwnsFrameScheduling}
        onPresentationCancel={cancel}
      />
    </div>
  );
});
