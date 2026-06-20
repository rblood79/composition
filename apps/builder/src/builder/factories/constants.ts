/**
 * Complex Component Tags — ADR-914 creation facet 의 `complex` mode SSOT.
 *
 * Factory가 자식 Element를 생성하는 컴포넌트 태그. 이 태그들은 자식 유무와 관계없이
 * 항상 _hasChildren=true로 처리되어 자식 삭제 시에도 standalone spec 렌더링으로
 * 돌아가지 않음.
 *
 * **ADR-914 Phase 4-C (creation facet membership SSOT, 2026-06-21)**: 본 set 은
 * entry universe creation facet 의 `complex` mode 권한 source 다. `entry.creation.mode`
 * 가 `complex` 인 것과 본 set membership 은 **양방향 1:1** 이며 (none/reusableOrigin 과
 * disjoint), `entryUniverseContract.test.ts` 가 `creation.mode==="complex" ⟺
 * COMPLEX_COMPONENT_TAGS.has(type)` parity 로 facet 이 이 membership 을 소유함을 증명한다.
 *
 * 사용자 결정 (2026-06-21): Phase 3-A renderFacetDeclaration 처럼 별도 declaration
 * 파일로 역전하지 않는다 — 두 소비처(아래)가 이미 본 set 단일 SSOT 를 공유하고
 * circular import 가 없어, declaration 신설은 surface 만 늘릴 뿐 실질 가치가 없다
 * (collapse 목적 = 손등록 surface 감소). 따라서 본 set 자체를 creation facet 의 SSOT
 * 로 명문화하고, contract 가 facet ⟺ membership 정합을 검증한다.
 *
 * 소비처 (entry.creation.mode==="complex" 와 congruent):
 * - useElementCreator.ts:192 — palette-add 시 createComplexComponent 진입 gate
 *   (reusableOrigin 체크 後, else(none) 분기 前).
 * - entryUniverse.ts:183 — `resolveCreationMode()` 의 complex 판정
 *   (reusableOrigin > complex > none 우선순위).
 * - buildSpecNodeData.ts: SYNTHETIC_CHILD_PROP_MERGE_TAGS 포함 태그에는
 *   `_hasChildren` 주입이 차단되며 자식 props가 부모 spec shapes에 통합된다 (주석 참조만).
 */
export const COMPLEX_COMPONENT_TAGS = new Set([
  // Form Input
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "DateField",
  "TimeField",
  "ColorField",
  // Selection
  "Select",
  "ComboBox",
  "ListBox",
  "GridList",
  // Control
  "Checkbox",
  "Radio",
  "Switch",
  "Slider",
  "ToggleButtonGroup",
  // Group
  "CheckboxGroup",
  "RadioGroup",
  // Layout
  "Card",
  // Navigation
  "Menu",
  "Disclosure",
  "DisclosureGroup",
  "Pagination",
  // Overlay
  "Dialog",
  "Popover",
  "Tooltip",
  // Feedback
  // ADR-912 R-5: Form 은 reusable composite origin(`component-form`) 전환 → COMPLEX 제외.
  //   useElementCreator 가 COMPLEX 분기 前 REUSABLE_COMPOSITE_ORIGINS 체크로 type:"ref" 생성.
  "Toast",
  "InlineAlert",
  // Date & Color
  "DatePicker",
  "DateRangePicker",
  "Calendar",
  "ColorPicker",
  "ColorSwatchPicker",
  // SYNTHETIC_CHILD_PROP_MERGE_TAGS 포함 태그 (synthetic prop 메커니즘 사용).
  // buildSpecNodeData에서 `_hasChildren` 주입이 차단되므로 standalone 분기가 유지되어 안전.
  // useElementCreator의 Factory 경로 분기용.
  "Tabs",
  "Tree",
  "TagGroup",
  "Table",
  // Feedback (Hybrid)
  "ProgressBar",
  "Meter",
  // Phase 4: Advanced Components (ADR-030)
  "CardView",
  "TableView",
  // S2 확장
  "Nav",
  "Navigation",
  "AvatarGroup",
  "ButtonGroup",
  "Breadcrumbs",
  "IllustratedMessage",
  "RangeCalendar",
]);
