import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Plus, Square, Trash2 } from "lucide-react";
import { SquareOff } from "../../../components/icons";
import {
  PropertyColor,
  PropertyRowMenu,
  PropertySelect,
  PropertyUnitInput,
} from "../../../components";
import {
  addBoxShadowPresentationLayer,
  patchBoxShadowPresentation,
  removeBoxShadowPresentationLayer,
  type BoxShadowPresentationField,
  type BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

type BoxShadowEditorCancelReason = "escape" | "pointer-cancel";
type BoxShadowNumericField = Exclude<
  BoxShadowPresentationField,
  "color" | "inset"
>;

export interface BoxShadowEditorProps {
  readonly onCancel: (reason: BoxShadowEditorCancelReason) => void;
  readonly onCommit: (value: BoxShadowPresentationValue) => void;
  /**
   * 레이어 추가 · 제거 · inset 처럼 **topology 가 바뀌는** 커밋. presentation owner 는
   * 이런 값을 거부하므로 (`haveSameBoxShadowPresentationTopology`) 호출측이 canonical
   * commit 으로 보내고, `nextLayerIndex` 를 다음 마운트의 `initialLayerIndex` 로 넘긴다.
   */
  readonly onTopologyCommit: (
    value: BoxShadowPresentationValue,
    nextLayerIndex: number,
  ) => void;
  readonly onPreview: (value: BoxShadowPresentationValue) => void;
  readonly presentationOwnsFrameScheduling: boolean;
  readonly value: BoxShadowPresentationValue;
  /** 마운트 시 선택할 레이어 (호출측이 boxShadow 문자열을 key 로 써 remount 하므로). */
  readonly initialLayerIndex?: number;
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
  onTopologyCommit,
  onPreview,
  presentationOwnsFrameScheduling,
  value,
  initialLayerIndex = 0,
}: BoxShadowEditorProps) {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const initialValueRef = useRef(value);
  const localValueRef = useRef(value);
  const [localValue, setLocalValue] = useState(value);
  const [activeLayerIndex, setActiveLayerIndex] = useState(() =>
    Math.min(Math.max(0, initialLayerIndex), value.layers.length - 1),
  );
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
      nextValue: number | string | boolean,
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

  const handleLayerAction = useCallback(
    (action: string): void => {
      const current = localValueRef.current;
      if (action === "add") {
        const added = addBoxShadowPresentationLayer(current, activeLayerIndex);
        onTopologyCommit(added.value, added.index);
        return;
      }
      if (action === "remove") {
        const removed = removeBoxShadowPresentationLayer(
          current,
          activeLayerIndex,
        );
        if (removed === null) return;
        onTopologyCommit(
          removed,
          Math.min(activeLayerIndex, removed.layers.length - 1),
        );
        return;
      }
      if (action === "inset") {
        const layer = current.layers[activeLayerIndex];
        if (!layer) return;
        const next = patchBoxShadowPresentation(
          current,
          activeLayerIndex,
          "inset",
          !layer.inset,
        );
        if (next === null) return;
        onTopologyCommit(next, activeLayerIndex);
      }
    },
    [activeLayerIndex, onTopologyCommit],
  );

  if (!activeLayer) return null;

  const layerMenuItems = [
    { id: "add", label: localize("Add shadow layer"), icon: Plus },
    {
      id: "inset",
      label: activeLayer.inset
        ? localize("Outer shadow layer")
        : localize("Inset shadow layer"),
      icon: activeLayer.inset ? Square : SquareOff,
    },
    {
      id: "remove",
      label: localize("Remove shadow layer"),
      icon: Trash2,
      isDisabled: localValue.layers.length <= 1,
    },
  ];

  return (
    <div
      className="box-shadow-editor"
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") cancel("escape");
      }}
      onPointerCancelCapture={() => cancel("pointer-cancel")}
    >
      <div className="box-shadow-layer-row">
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
        <div className="fieldset-actions actions-icon">
          <PropertyRowMenu
            label={localize("Shadow layer actions")}
            items={layerMenuItems}
            onAction={handleLayerAction}
          />
        </div>
      </div>
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
