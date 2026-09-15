/**
 * Aria Label 필드를 보일지 — RAC 가 접근 가능한 이름을 스스로 만들지 못하는 경우만 (D1 —
 * 이름은 RAC 가 label/콘텐츠에서 계산하고, 빌더는 그 빈자리만 채운다. 2026-09-15 사용자 판정).
 *
 * 1. 시각 `label` prop 이 있는 타입 (field 가족 · Slider · Meter · ProgressBar · CheckboxGroup …,
 *    편집 계약에 `label` 필드) — label 이 비었을 때만.
 * 2. 항목·헤딩에서 이름이 오지 않는 컬렉션·그룹 (aria-label 없으면 RAC 가 경고) — 항상.
 * 3. 압박 요소 (Button · ToggleButton · Link) — 텍스트가 없는 아이콘 전용일 때만.
 * 그 외 (텍스트 콘텐츠 · 장식 · 레이아웃) 는 숨긴다.
 */

const ALWAYS_NEEDS_NAME: ReadonlySet<string> = new Set([
  "ListBox",
  "GridList",
  "Table",
  "TableView",
  "Tree",
  "Tabs",
  "Toolbar",
  "Breadcrumbs",
  "Nav",
  "Pagination",
  "ToggleButtonGroup",
  "CardView",
  "Group",
  "ProgressCircle",
]);

const PRESSABLE_CONTENT_NAMED: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
  "Link",
]);

export interface AriaLabelNeedInput {
  type: string;
  props: Record<string, unknown> | undefined | null;
  /** 편집 계약에 `label` 필드가 있는가 (시각 label prop) */
  hasLabelField: boolean;
  /** canonical 자식 (Text 자식 = 압박 요소의 이름) */
  children: ReadonlyArray<{ type: string; deleted?: boolean }>;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function needsAuthoredAriaLabel({
  type,
  props,
  hasLabelField,
  children,
}: AriaLabelNeedInput): boolean {
  if (hasLabelField) return !isNonEmptyString(props?.label);
  if (ALWAYS_NEEDS_NAME.has(type)) return true;
  if (PRESSABLE_CONTENT_NAMED.has(type)) {
    const hasTextChild = children.some(
      (child) => child.type === "Text" && !child.deleted,
    );
    return !hasTextChild && !isNonEmptyString(props?.children);
  }
  return false;
}
