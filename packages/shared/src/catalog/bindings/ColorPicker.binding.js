/**
 * ADR-912 — ColorPicker container catalog cutover.
 *
 * Factory children(ColorArea/ColorSlider/ColorField)가 color UI를 소유한다. 컨테이너는 기존
 * preview fallback 과 같은 div shell 로 남기고, Skia 시각은 componentRulesTable generic shell 로
 * 전환한다.
 */
export const colorPickerBinding = {
    source: {
        kind: "internal",
        renderer: "colorpicker",
    },
    props: {
        accepts: {
            label: { kind: "string", label: "Label", section: "content" },
            defaultValue: {
                kind: "string",
                label: "Default Value",
                section: "content",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "default",
            },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=ColorPicker.binding.js.map