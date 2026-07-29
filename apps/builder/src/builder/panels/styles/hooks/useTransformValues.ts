import { useMemo } from "react";
import { useElementStyleContext } from "./useElementStyleContext";
import { useLayoutValue } from "./useLayoutValue";
import {
  resolveSpecPreset,
  type TransformSpecPreset,
} from "../utils/specPresetResolver";
import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";

/**
 * picker(DatePicker/DateRangePicker) 안 DateInput 여부 판정.
 *
 * field-trigger canonical 자식 통일(커밋 97d59f161) 후 picker DateInput 은 SelectTrigger
 * box 안의 콘텐츠 자식(SelectValue 자리)이다. layout(`implicitStyles.ts:1498-1521`,
 * selecttrigger 분기)이 `height: cs.height ?? "100%"` 를 주입해 **부모 SelectTrigger box
 * 높이를 채운다**(콘텐츠). 그러나 catalog `DateInput.sizes.md.height=30` 은 DateField/TimeField
 * 단독(자기 box) 용 값이라, 같은 entry 를 공유하는 패널 specDefault 가 picker DateInput 에도
 * 30(box) 을 표시 → 실제 layout(100%) 과 불일치(사용자 적발 2026-06-23).
 *
 * 판정 조건은 layout selecttrigger 분기(`fieldType === "DatePicker"/"DateRangePicker"`,
 * implicitStyles.ts:1501)와 1:1 정합: DateInput 의 부모(SelectTrigger) → 조부모가 picker.
 * DateField/TimeField 단독 DateInput 은 부모가 DateField/TimeField 라 미해당 → catalog 30 유지(회귀 0).
 */
function useIsPickerDateInput(
  id: string | null,
  type: string | undefined,
): boolean {
  const self = useCanonicalPropertyElement(id ?? "");
  const parentId = self?.parent_id ?? null;
  const parent = useCanonicalPropertyElement(parentId ?? "");
  const grandParentId = parent?.parent_id ?? null;
  const grandParent = useCanonicalPropertyElement(grandParentId ?? "");
  if (type !== "DateInput") return false;
  const gpType = grandParent?.type;
  return gpType === "DatePicker" || gpType === "DateRangePicker";
}

export interface TransformTier {
  inline: string | number | undefined;
  effective: number | undefined;
  /** ADR-082 A2: containerStyles/composition 에서 공급된 string 값 ("100%", "fit-content") 포함 */
  specDefault: number | string | undefined;
}

export interface TransformValuesBundle {
  width: TransformTier;
  height: TransformTier;
  position: TransformTier;
  top: TransformTier;
  left: TransformTier;
  minWidth: TransformTier;
  maxWidth: TransformTier;
  minHeight: TransformTier;
  maxHeight: TransformTier;
  aspectRatio: TransformTier;
  isBody: boolean;
}

export function useTransformValues(
  id: string | null,
): TransformValuesBundle | null {
  const { style, type, size } = useElementStyleContext(id);

  const effWidth = useLayoutValue(id, "width");
  const effHeight = useLayoutValue(id, "height");
  const effLeft = useLayoutValue(id, "x");
  const effTop = useLayoutValue(id, "y");

  const isBody = type?.toLowerCase() === "body";
  const isPickerDateInput = useIsPickerDateInput(id, type);

  const specPreset = useMemo<TransformSpecPreset>(
    () => resolveSpecPreset(type, size),
    [type, size],
  );

  return useMemo(() => {
    if (!id) return null;
    const styleRec = (style ?? {}) as Record<
      string,
      string | number | undefined
    >;
    const presetRec = specPreset as Record<string, number | string | undefined>;

    const tier = (prop: string, effective?: number): TransformTier => ({
      inline: styleRec[prop],
      effective,
      specDefault: presetRec[prop],
    });

    // picker DateInput 의 height specDefault 는 catalog box 높이(30) 대신 "100%"(콘텐츠 fill)로
    //   override — layout selecttrigger 분기(implicitStyles.ts:1518 `height: cs.height ?? "100%"`)
    //   의 실제 주입값과 패널 표시를 일치시킨다. inline 사용자 설정값은 tier 가 우선하므로 보존.
    const heightTier = isPickerDateInput
      ? { inline: styleRec.height, effective: effHeight, specDefault: "100%" }
      : tier("height", effHeight);

    return {
      width: tier("width", effWidth),
      height: heightTier,
      position: tier("position"),
      top: tier("top", effTop),
      left: tier("left", effLeft),
      minWidth: tier("minWidth"),
      maxWidth: tier("maxWidth"),
      minHeight: tier("minHeight"),
      maxHeight: tier("maxHeight"),
      aspectRatio: tier("aspectRatio"),
      isBody,
    };
  }, [
    id,
    style,
    specPreset,
    effWidth,
    effHeight,
    effTop,
    effLeft,
    isBody,
    isPickerDateInput,
  ]);
}
