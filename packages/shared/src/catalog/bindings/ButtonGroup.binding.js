/**
 * ButtonGroup — 버튼 묶음 컨테이너 (Cancel/Save 류 Button 자식 묶음). composition 자체 추상.
 * factory(`DisplayComponents.ts::createButtonGroupDefinition`)가 자식 Button×2(Cancel outline /
 * Save accent fill)를 자동 생성한다 → 런타임은 항상 `_hasChildren=true`.
 *
 * **ADR-912 R7 G1-c (container shell catalog cutover, 2026-06-15)**:
 *   구 `ButtonGroup.spec.ts`의 `render.shapes` 는 `_hasChildren=false` 분기에서 컨테이너 box(flex)만
 *   그렸고(투명 — variant default 전부 transparent), `_hasChildren=true` 면 빈 shapes 를 반환했다.
 *   factory 가 자식 Button 을 자동 생성하므로 런타임은 항상 `_hasChildren=true` → standalone box 분기는
 *   dead, 자식 Button 이 시각을 담당한다. AvatarGroup/CardView/TableView/Pagination(R7 G1-a/b/c) box-only
 *   shell 과 동형. generate-css virtual 전환으로 DOM CSS source 를
 *   `COMPONENT_RULES_TABLE.ButtonGroup`(variant default transparent + sizes height/radius)로 이전,
 *   본 catalog 등록으로 Skia 시각도 buildCatalogShapes generic box shell 로 이전하여 spec 의존을 끊는다.
 *
 * **시각 = 투명 generic shell(자식 Button 이 내용 렌더) + factory props.style layout**: ButtonGroup 은
 *   시각적으로 완전 투명한 컨테이너(variant default fill/border 전부 transparent)이므로 buildCatalogShapes
 *   가 투명 box 를 그리고 자식 Button Element 가 시각을 담당한다. container layout(`display:flex` /
 *   `flexDirection:row` / `gap:8`)은 factory `props.style` SSOT(ADR-907 Layer B, Skia/Taffy 직접 read).
 *   catalog rule.sizes 의 gap 은 미소비 — container gap 은 factory `ButtonGroup.props.style.gap` SSOT.
 *
 * **DOM parity = 변화 0**: INTERNAL_RENDERERS 미등록 → CanonicalNodeRenderer generic fallback.
 *   isSpecOrCatalogBacked(spec || isCatalogCutover) 가 catalog 등록 후 true → `react-aria-ButtonGroup`
 *   className + `data-size` 보존 → generated CSS(ButtonGroup.css, virtual diff = size별 gap 제거(factory
 *   props.style SSOT) + 빈 hover/pressed transparent 블록 noise 제거, 시각 손실 0) 매칭 불변.
 *
 * D1: composition `<div>` (internal source, generic DOM). role="group" / aria-orientation 은
 *     D2 prop(factory/renderer 가 부여).
 * D2: size(appearance) + orientation/align(appearance) + isDisabled(state) 편집 surface (자식 제외).
 * D3: 시각(variant transparent + radius)은 theme rule(COMPONENT_RULES_TABLE.ButtonGroup).
 *     Skia generic box shell ↔ DOM `react-aria-ButtonGroup[data-size]` 시각 대칭.
 */
export const buttonGroupBinding = {
    source: {
        kind: "internal",
        // INTERNAL_RENDERERS 미등록 키 → DOM/Skia generic fallback (R7 G1 AvatarGroup 동형, 값 무시).
        // D1 group semantic(role="group"/aria-orientation)은 generated CSS + renderer 가 부여.
        renderer: "div",
    },
    props: {
        accepts: {
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            orientation: {
                kind: "enum",
                label: "Orientation",
                section: "appearance",
                default: "horizontal",
                options: [
                    { value: "horizontal", label: "Horizontal" },
                    { value: "vertical", label: "Vertical" },
                ],
            },
            align: {
                kind: "enum",
                label: "Align",
                section: "appearance",
                default: "end",
                options: [
                    { value: "start", label: "Start" },
                    { value: "center", label: "Center" },
                    { value: "end", label: "End" },
                ],
            },
            isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=ButtonGroup.binding.js.map