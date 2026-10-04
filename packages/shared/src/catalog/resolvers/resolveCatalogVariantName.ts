import type { ComponentRule } from "../../types/catalog-style.types";

/** 선택 상태 — 목록 owner 선택 (`_isSelected`) 또는 상태 변형 origin 의 강제 상태 (`isSelected`). */
function isSelectedProps(props: Readonly<Record<string, unknown>>): boolean {
  return props._isSelected === true || props.isSelected === true;
}

/**
 * 그릴 catalog 변형 이름 — 작성자 `variant` 가 우선이고, 없으면 선택 상태는 rule 의 `selected` 변형 (있을 때 —
 * Tag), 아니면 rule 기본 변형. DOM `.react-aria-Tag[data-selected]` 가 색 변수를 accent 로 바꾸는 것과 같은
 * 결과 (사용자 지적 2026-09-24 — 선택 Tag 가 Canvas 에서 비선택과 같았다).
 */
export function resolveCatalogVariantName(
  rule: ComponentRule | undefined,
  props: Readonly<Record<string, unknown>>,
): string | undefined {
  const explicit = props.variant;
  if (typeof explicit === "string" && explicit) return explicit;
  if (isSelectedProps(props) && rule?.variants.selected) return "selected";
  return rule?.defaultVariant;
}
