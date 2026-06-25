/**
 * ADR-142 — Button leaf RAC primitive 의 첫 `PrimitiveBinding` (Phase 1 파일럿, M1 #7).
 *
 * 파일럿 발견 (legacy `ButtonSpec` 대비):
 * - **icon 합성 분리**: legacy ButtonSpec 은 `iconName`/`iconPosition`/`iconStrokeWidth`
 *   를 번들했으나, ADR-142 모델에서 "아이콘이 붙은 Button" 은 **reusable 조합 문서**
 *   (설계 §3 line 193). leaf Button primitive 의 `accepts` 는 RAC Button D2 surface
 *   로만 한정 → 조합은 데이터(reusable)로 분리된다는 논지를 검증.
 * - **fillStyle (foundation #2 추가)**: `fillStyle` 은 D3 visual 차원으로, visual-enum
 *   data-* 라우팅 규칙(`kind:"fillStyle"` → `data-fill-style`, camelCase→kebab) 위에서
 *   accepts 에 포함. theme CSS `[data-fill-style="outline"]` 가 styling, Skia 는
 *   `buildCatalogShapes` 가 `fill.outline`/`subtle` 소비.
 *
 * 시각(variant/size 값 집합, 색상)은 theme/tokens 가 `data-*` 규칙으로 적용 — 본 binding 에 없음.
 */
export const buttonBinding = {
    source: {
        kind: "rac",
        package: "react-aria-components",
        importPath: "react-aria-components",
        component: "Button",
    },
    rac: {
        primitive: "Button",
        parts: ["button"],
        slots: [],
        states: [
            "isHovered",
            "isPressed",
            "isFocused",
            "isFocusVisible",
            "isDisabled",
            "isPending",
        ],
        renderProps: [
            "isHovered",
            "isPressed",
            "isFocused",
            "isFocusVisible",
            "isDisabled",
            "isPending",
        ],
        dataAttributes: [
            "data-hovered",
            "data-pressed",
            "data-focused",
            "data-focus-visible",
            "data-disabled",
            "data-pending",
        ],
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Text", section: "content" },
            // 시각 차원 → data-variant / data-size (theme 가 값 집합 제공)
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "primary",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            // visual-enum (fixed options) → data-fill-style 라우팅 (theme/Skia 가 시각 적용)
            fillStyle: {
                kind: "fillStyle",
                label: "Fill Style",
                section: "appearance",
                default: "fill",
                options: [
                    { value: "fill", label: "Fill" },
                    { value: "outline", label: "Outline" },
                ],
            },
            // RAC Button props
            type: {
                kind: "enum",
                label: "Type",
                section: "state",
                default: "button",
                options: [
                    { value: "button", label: "Button" },
                    { value: "submit", label: "Submit" },
                    { value: "reset", label: "Reset" },
                ],
            },
            isPending: { kind: "boolean", label: "Pending", section: "state" },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Button.binding.js.map