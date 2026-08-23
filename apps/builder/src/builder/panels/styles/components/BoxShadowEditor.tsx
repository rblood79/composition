import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  PropertyColor,
  PropertySelect,
  PropertyUnitInput,
} from "../../../components";
import {
  patchBoxShadowPresentation,
  type BoxShadowPresentationField,
  type BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";

type BoxShadowEditorCancelReason = "escape" | "pointer-cancel";
type BoxShadowNumericField = Exclude<BoxShadowPresentationField, "color">;

export interface BoxShadowEditorProps {
  readonly onCancel: (reason: BoxShadowEditorCancelReason) => void;
  readonly onCommit: (value: BoxShadowPresentationValue) => void;
  readonly onPreview: (value: BoxShadowPresentationValue) => void;
  readonly presentationOwnsFrameScheduling: boolean;
  readonly value: BoxShadowPresentationValue;
}

const NUMERIC_FIELDS: ReadonlyArray<{
  readonly field: BoxShadowNumericField;
  readonly label: string;
  readonly min: number;
}> = [
  { field: "offsetX", label: "Offset X", min: -9999 },
  { field: "offsetY", label: "Offset Y", min: -9999 },
  { field: "blur", label: "Blur", min: 0 },
  { field: "spread", label: "Spread", min: -9999 },
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
}: BoxShadowEditorProps) {
  const initialValueRef = useRef(value);
  const localValueRef = useRef(value);
  const [localValue, setLocalValue] = useState(value);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const layerOptions = useMemo(
    () =>
      localValue.layers.map((layer, index) => ({
        label: `Layer ${index + 1}${layer.inset ? " · inset" : ""}`,
        value: String(index),
      })),
    [localValue.layers],
  );
  const activeLayer = localValue.layers[activeLayerIndex];

  const updateField = useCallback(
    (
      field: BoxShadowPresentationField,
      nextValue: number | string,
      phase: "commit" | "preview",
    ): void => {
      const next = patchBoxShadowPresentation(
        localValueRef.current,
        activeLayerIndex,
        field,
        nextValue,
      );
      if (next === null) return;
      localValueRef.current = next;
      setLocalValue(next);
      if (phase === "preview") onPreview(next);
      else onCommit(next);
    },
    [activeLayerIndex, onCommit, onPreview],
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
      className="box-shadow-editor"
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") cancel("escape");
      }}
      onPointerCancelCapture={() => cancel("pointer-cancel")}
    >
      <PropertySelect
        className="box-shadow-layer"
        label="Shadow Layer"
        value={String(activeLayerIndex)}
        options={layerOptions}
        onChange={(nextIndex) => {
          const parsedIndex = Number(nextIndex);
          if (
            Number.isInteger(parsedIndex) &&
            parsedIndex >= 0 &&
            parsedIndex < localValue.layers.length
          ) {
            setActiveLayerIndex(parsedIndex);
          }
        }}
      />
      <div className="box-shadow-editor-fields">
        {NUMERIC_FIELDS.map(({ field, label, min }) => (
          <PropertyUnitInput
            key={field}
            className={`box-shadow-${field}`}
            label={label}
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
        key={activeLayerIndex}
        className="box-shadow-color"
        label="Shadow Color"
        value={activeLayer.color}
        onPreview={(nextColor) => updateField("color", nextColor, "preview")}
        onChange={(nextColor) => updateField("color", nextColor, "commit")}
        presentationOwnsFrameScheduling={presentationOwnsFrameScheduling}
        onPresentationCancel={cancel}
      />
    </div>
  );
});
