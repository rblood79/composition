import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * 트리거 아이콘 **glyph** 크기 (px) — DOM/Skia 공통 SSOT.
 *
 * Skia 는 `SelectIcon` 자식을 `icon_font` primitive 로 그리며 glyph 크기로
 * `SelectIcon.sizes[size].iconSize` 를 쓴다. DOM wrapper(DatePicker/DateRangePicker) 도
 * **같은 값**을 읽어야 시각이 대칭이다.
 *
 * **왜 CSS 변수로 못 하나**: `Icon` 컴포넌트가 크기를 svg 의 `width`/`height` **속성**으로
 * 굳히기 때문에(`Icon.tsx`) `var(--dp-btn-width)` 같은 CSS 변수는 도달하지 못한다. 그래서
 * wrapper 가 size prop → px 숫자를 **JS 단에서** 해소해 넘긴다.
 *
 * (`--dp-btn-width/height` 는 아이콘을 감싸는 **버튼 박스**(hit target) 이며 glyph 가 아니다.
 *  둘은 같은 아이콘 스케일 14/16/18/22/28 을 공유하지만 서로 다른 축이다.)
 *
 * 2026-07-14: wrapper 가 `fontSize: 16` 하드코딩이라 size 를 바꿔도 DOM glyph 가 16 고정이었다.
 */
export function resolveTriggerIconSize(size: string | undefined): number {
  const sizes = (COMPONENT_RULES_TABLE.SelectIcon?.sizes ?? {}) as Record<
    string,
    { iconSize?: number } | undefined
  >;
  const defaultSize = COMPONENT_RULES_TABLE.SelectIcon?.defaultSize ?? "md";
  const iconSize =
    sizes[size ?? defaultSize]?.iconSize ?? sizes[defaultSize]?.iconSize;
  return iconSize ?? 18;
}
