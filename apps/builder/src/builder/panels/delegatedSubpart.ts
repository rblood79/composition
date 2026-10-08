/**
 * ADR-923 Phase 5 후속 잔여 1 (2026-09-03, 판정 A) — **read-only sub-part** 판정.
 *
 * DOM (Preview·publish 공통 catalog runtime `delegatedDom.tsx`) 은 parent props 만으로 self-compose 하고 canonical
 * 자식을 읽지 않는다. 다음 자식은 read-only sub-part 다 — 자식에 준 인라인 style 은 어떤 채널로도 DOM 에
 * 닿지 않는다 (2026-09-03 판정 A × 4):
 *   - parent rule delegation 이 class 토큰을 가진 자식 — FieldError · Label · Input · DateInput · field 의 control Group
 *     (NumberField·DatePicker·DateRangePicker `.react-aria-Group`, ComboBox `.combobox-container`, SearchField
 *     `.searchfield-container`, Select `.react-aria-Button`).
 *   - parent 가 `label` prop 으로 RAC Label 을 self-compose 하는 그룹 (CheckboxGroup·RadioGroup·Meter·ProgressBar·
 *     Slider) 의 Label — 자식 텍스트는 parent `label` 이 비어 있을 때의 legacy 폴백뿐.
 *   - 직계가 field 의 control Group 이면 조부모 (field) 로 판정 — DatePicker·DateRangePicker 의 DateInput.
 * 자식은 canonical 에 남되 (Canvas 구조 정본 — DatePicker 선례, Skia projection 우회 금지) 편집 surface 는
 * **owner** (직계 parent 또는 조부모 field) 로 귀속한다: Properties · Styles 패널은 owner 가 있으면 안내만 띄우고,
 * catalog runtime 판정은 `catalogRuntime/subpart.ts` `catalogSubpartOwnerType` 이 같은 shared 술어로 한다
 * (옛 Canvas read 경로 — fullTreeLayout · buildSpecNodeData — 는 삭제됨).
 */

/** 정본은 shared 의 토큰 표 + 그룹 목록 (`resolveDelegatedSubpartOwnerType`). */
export function isDelegatedSubpart(
  type: string | null | undefined,
  ownerType: string | null | undefined,
): boolean {
  return !!type && !!ownerType;
}
