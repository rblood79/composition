import type { PrimitiveBinding } from "../types";

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
 * **DOM 렌더 = renderButtonGroup self-compose 위임 (2026-06-27)**: factory 가 자식 Button×2 를
 *   자동 생성하므로 ButtonGroup 은 box-only shell(AvatarGroup) 이 아니라 자식을 렌더하는 self-compose
 *   컨테이너다. `renderButtonGroup`(LayoutRenderers)이 `context.childrenByParent` 로 자식 Button 을
 *   `<div role="group">` 안에 렌더한다. 따라서 `renderer:"div"` generic fallback 으로 두면
 *   `DELEGATING_INTERNAL_RENDERERS` 매칭(renderer 기준)을 못 타 generic fall-through 로 빠지고,
 *   flattenNodeChildrenByParent 보강을 못 받아 childrenByParent 가 비어 자식 Button 이 통째 미렌더된다
 *   (Preview 빈 div, Skia 는 자식 직접 렌더 → 비대칭). TableView(2026-06-25)/Card(2026-06-24) 선례와
 *   동형 — 고유 renderer id(`"buttongroup"`) + renderFacetDeclaration delegating-internal 등록으로
 *   renderButtonGroup 위임 경로 활성화.
 *   isSpecOrCatalogBacked + `react-aria-ButtonGroup` className + `data-size` 보존 → generated CSS
 *   (ButtonGroup.css) 매칭 불변.
 *
 * D1: composition `<div>` (internal source, generic DOM). role="group" / aria-orientation 은
 *     D2 prop(factory/renderer 가 부여).
 * D2: size(appearance) + orientation/align(appearance) + isDisabled(state) 편집 surface (자식 제외).
 * D3: 시각(variant transparent + radius)은 theme rule(COMPONENT_RULES_TABLE.ButtonGroup).
 *     Skia generic box shell ↔ DOM `react-aria-ButtonGroup[data-size]` 시각 대칭.
 */
export const buttonGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "buttongroup". ButtonGroup 은 자식 Button×2(factory 자동 생성)를
    //   `context.childrenByParent` 로 받아 `<div role="group">` 안에 렌더하는 self-compose 컨테이너다
    //   (TableView/Card/Nav 동형). renderer:"div" 는 DELEGATING_INTERNAL_RENDERERS 매칭
    //   (binding.source.renderer 기준)을 못 타 generic fall-through 로 빠지고, flattenNodeChildrenByParent
    //   보강을 못 받아 자식 Button 이 통째 미렌더됐다(Preview 빈 div, Skia 는 자식 직접 렌더 → 비대칭).
    //   고유 renderer id + renderFacetDeclaration delegating-internal 등록으로 renderButtonGroup 위임 활성화.
    //   D1 group semantic(role="group"/aria-orientation)은 renderButtonGroup + generated CSS 가 부여.
    renderer: "buttongroup",
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
