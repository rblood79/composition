import type { PrimitiveBinding } from "../types";

/**
 * ProgressBarValue — ProgressBar compound 의 현재 값 텍스트 leaf ([[MeterValue]] 동형).
 *
 * **글자 = template 바인딩**: ProgressBar origin template 이 `children: "{valueText}"` 로
 *   ProgressBar 의 값 글자에 묶는다. DOM 은 RAC `<ProgressBar>` 의 자식으로 `span.value`
 *   (`domBinding.tsx` `progressbarvalue` — `progressPart`).
 *
 * **Canvas = text leaf**: children 을 rule.variants(text color) + sizes(fontSize/lineHeight) 로
 *   그림. 순수 text leaf (value_fill_* escape 없음).
 *   variant 는 "default" 단일 (Meter 의 4색과 달리 ProgressBar 는 accent 단색).
 */
export const progressBarValueBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "progressbarvalue" },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      children: {
        kind: "string",
        label: "Value",
        section: "content",
        default: "",
      },
    },
    toRacProps: "default",
  },
};
