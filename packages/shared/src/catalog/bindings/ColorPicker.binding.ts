/**
 * ADR-912 — ColorPicker container catalog cutover.
 *
 * Factory children(ColorArea/ColorSlider/ColorField)가 color UI를 소유한다. 컨테이너는 기존
 * preview fallback 과 같은 div shell 로 남기고, Skia 시각은 componentRulesTable generic shell 로
 * 전환한다.
 */

import type { PrimitiveBinding } from "../types";

export const colorPickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "colorpicker",
  },
  props: {
    accepts: {
      defaultValue: {
        kind: "string",
        label: "Default Value",
        section: "content",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
    },
    toRacProps: "default",
  },
};
