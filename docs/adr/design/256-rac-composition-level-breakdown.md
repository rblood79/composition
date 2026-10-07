# ADR-256 breakdown — RAC 수준의 조립

> 본문: [ADR-256](../256-rac-composition-level.md). 이 문서는 Phase · 파일 경계 · 순서 · 시작 인벤토리를 둔다. 결정은 본문이 정본이다.

경로 약어: `S/` = `packages/shared/src/` · `D/` = `S/catalog/document/` · `X/` = `S/catalog/runtime/` · `R/` = `apps/builder/src/builder/catalogRuntime/` · `N` = `S/catalog/nesting/nestingRules.ts`

## 1. 전제 점검 (ADR 작성 규칙 4 질문)

1. **base / 응용**: 이 ADR 은 ADR-253 (부품 = 원본 instance, 부품을 자기 binding 으로 RAC context 안에 그림) 의 응용이 아니라 그 일반화다. 253 이 field 부품의 「그리기」 를 노드로 옮겼고, 이 ADR 은 「배치 · 넣기 판정」 까지 노드 트리로 옮긴다. 253 의 결정은 그대로 유효하다 (뒤집지 않는다).
2. **schema 직교성**: 새 저장 필드는 둘 — type 특성 표의 children 종류 (코드 표, 문서 스키마 아님) · 노드 `showWhen` (문서 스키마, 사용자 확인 2). 기존 `slot` 선언 · `slotFills` · `descendantOverrides` 와 직교한다.
3. **선행 전제 재검증**: ADR-240 의 「영역별 새 type 기각」 은 영역별 renderer 비용이 근거였다 — Decision 2 로 그 비용이 사라지므로 Card 에서 뒤집는다 (본문 Decision 9). ADR-251 의 RadioItems · CheckboxItems 묶음 노드는 RAC 구조 밖 (`div.radio-items`) 이다 — 레퍼런스 예제에는 없으므로 Phase 3 에서 판정한다 (유지 · 제거 둘 다 열어 둠, G0 ⑦ 에 추가).
4. **판독 시점**: Phase 0 인벤토리 고정 뒤 판독 1회 (전제 · 범위), 각 Phase 는 판독 1 + 수리 검증 1 (`.claude/rules/review-loop-closure.md`).

## 2. 시작 인벤토리 (2026-10-07, G0 에서 확정)

### 2-1. Preview 위임 renderer (`X/delegatedDom.tsx:560-1922`)

| 방식                                        | 수  | renderer                                                                                                                                                                                                                                                       |
| ------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 자식을 순서대로 다 그림                     | 21  | tableview · filetrigger · checkbox · togglebutton · buttongroup · avatargroup · card · cardpreview · cardheader · cardfooter · cardcontent · cardview · pagination · nav · toast · disclosurecontent · disclosuregroup · colorpicker · field · form · treeitem |
| 특정 type 만 고름                           | 8   | tabs · listbox · gridlist · breadcrumbs · menu · tree · togglebuttongroup · colorswatchpicker                                                                                                                                                                  |
| 부품을 props 로 shared 합성 컴포넌트에 넘김 | 15  | textfield · textarea · numberfield · searchfield · datefield · timefield · colorfield · slider · progressbar · meter · taggroup · checkboxgroup · radiogroup · disclosure · fileupload                                                                         |
| 자식 무시                                   | 3   | switch · calendar · rangecalendar                                                                                                                                                                                                                              |

shared 합성 컴포넌트의 Builder UI 사용 (테스트 제외): Checkbox (`apps/builder/src/builder/components/property/PropertyCheckbox.tsx`) · ToggleButton · ToggleButtonGroup (`apps/builder/src/builder/layout/PanelToggleGroup.tsx`). 나머지 30개는 Preview 전용.

### 2-2. 부모 rule 이 노드 없이 그리는 것 (Canvas)

| 부품                                 | 지금 그리는 곳                                                   | 처리 (Decision 6)                                                           |
| ------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| ListBoxItem · GridListItem 선택 표시 | `listbox_item` · `gridlist_card`                                 | 노드 — `SelectionIndicator` 또는 `showWhen: isSelected` 아이콘              |
| Tab 선택 막대                        | `tab_indicator`                                                  | 노드 — `SelectionIndicator` (RAC 예제 방식)                                 |
| Tag 지우기 X                         | `packages/rendering/src/renderers/buildCatalogShapes.ts:537-548` | 노드 — `Button slot="remove"`                                               |
| Slider 채움 · thumb                  | track 의 `slider_fill_bar`                                       | 노드 — `SliderFill` · thumb 는 이미 노드 (자기 rule 로)                     |
| ProgressBar · Meter 채움             | `value_fill_bar`                                                 | 노드 — fill part (레퍼런스 예제의 `.fill`)                                  |
| Tooltip · Popover 화살표             | `tooltip_arrow` · `popover_arrow`                                | 노드 — `OverlayArrow`                                                       |
| TreeItem 선택 checkbox               | `selection_checkbox`                                             | 노드 — `Checkbox slot="selection"`                                          |
| StatusLight 점 · Badge 점            | `status_light` · `dot`                                           | S2 내부 — 그대로                                                            |
| CalendarHeader chevron · 제목        | `inline_icon_text`                                               | 노드 — RAC 예제 `Button slot="previous"` · `Heading` · `Button slot="next"` |
| CalendarGrid 칸 · DateInput 조각     | `calendar_month_grid` · `datefield_segments`                     | RAC 가 스스로 만드는 내부 — 그대로                                          |
| Checkbox · Radio · Switch indicator  | owner-drawn part (`OWNER_DRAWN_PART_OWNERS`)                     | 노드 유지 — 모양은 자기 rule 로 옮길지 G0 에서 판정                         |

### 2-3. 중첩 규칙의 renderer 한계 표 (`N:119-187`)

`SELF_COMPOSED_CONTAINER_CHILD_TYPES` 30행. Phase 1 에서 「미전환 family 제한」 으로 이름을 바꾸고, 각 family Phase 가 자기 행을 지운다. 끝에 0행 → 표 삭제.

### 2-4. slot 선언 25자리 (`D/generated/reusableOriginLibrary.ts`)

원본 루트 12 (F4) · 하위 부품 13. Phase 1 뒤 slot 선언은 Components page 의 이름 표시만 맡는다.

## 3. Phase

각 Phase = worktree 1개 · Gate 통과 뒤 main 병합 · template 이 바뀌면 contract +1. family Phase 는 실패 시 그 family 만 옛 renderer 로 두고 다음으로 간다 (G2 후퇴안).

| Phase | 범위                                                                                                                                                                                                                                                                                                                             | 주 파일                                                                                                                                                                   | Gate    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | 인벤토리 고정 (G0 ① ~ ⑦) · 완료 판정 예제 세트 · 사용자 확인 3건                                                                                                                                                                                                                                                                 | 이 문서 §2 갱신 · `docs/adr/evidence/256-g0-inventory.md`                                                                                                                 | G0      |
| 1     | 판정 하나 — `componentTraits.ts` 에 children 종류 (`items: [...]` · `free`) · 중첩 규칙 · Properties 넣기 목록 (`CatalogSlotSection.tsx` · `slotFillNodes.ts` 삭제) · Components page 빈 slot 표시가 같은 함수를 읽음 · 미전환 family 제한 표 · 원본 루트 slot 을 instance 에서 채움 (`R/slots.ts`) · 넣기 목록에 기본 원본 포함 | `S/domain/componentTraits.ts` · `N` · `R/slots.ts` · `apps/builder/src/builder/panels/properties/catalog/CatalogSlotSection.tsx` · AI tool preflight                      | G1 · G4 |
| 2     | field 7종 — `TextField > Label + Input + Text[description] + FieldError` · NumberField · SearchField 의 `Group` · ColorField · DateField · TimeField. 조건부 부품 (빈 label · necessity) 을 노드 표시 조건으로                                                                                                                   | `X/delegatedDom.tsx` (field 7 renderer 삭제) · `X/domBinding.tsx` · 원본 template · `S/components/{TextField,…}.tsx` 의 Preview 사용 제거                                 | G2 · G4 |
| 3     | toggle — `CheckboxField > CheckboxButton` · `SwitchField > SwitchButton` · Radio · CheckboxGroup · RadioGroup · ToggleButtonGroup (RadioItems · CheckboxItems 판정 포함)                                                                                                                                                         | 같은 층 + 새 binding 4 (CheckboxField · CheckboxButton · SwitchField · SwitchButton)                                                                                      | G2 · G4 |
| 4     | 상태별 표시 — 노드 `showWhen` · Preview render props · Canvas 유효 상태 판정                                                                                                                                                                                                                                                     | `D/types.ts` · `D/validation.ts` · `X/presence.ts` · `R/canvasBinding.ts` · Design 패널 표시 조건 UI                                                                      | G3 · G4 |
| 5     | collection — ListBox · GridList · Menu (+ SubmenuTrigger · Keyboard) · Tree · TagGroup (+ Tag remove) · Breadcrumbs · Tabs (+ SelectionIndicator) · Table · TableView · ColorSwatchPicker. 항목 안 자유 내용 · 선택 표시 노드                                                                                                    | `X/delegatedDom.tsx` (선별 8 → RAC 요구 값만) · `X/rulePaint.ts` (`CHILD_PROP_MERGE_TYPES`) · `packages/rendering/src/renderers/skiaPrimitives.ts`                        | G2 · G4 |
| 6     | picker — Select · ComboBox · DatePicker · DateRangePicker · Autocomplete (새)                                                                                                                                                                                                                                                    | 같은 층 · 새 binding Autocomplete                                                                                                                                         | G2 · G4 |
| 7     | range · progress — Slider (+ SliderFill) · Meter · ProgressBar                                                                                                                                                                                                                                                                   | 같은 층 · `slider_fill_bar` · `value_fill_bar` 분해                                                                                                                       | G2 · G4 |
| 8     | overlay · disclosure — Dialog · Modal · Popover · Tooltip (+ OverlayArrow) · Disclosure · DisclosureGroup                                                                                                                                                                                                                        | 같은 층 · `SHELL_ONLY_TYPES`                                                                                                                                              | G2 · G4 |
| 9     | calendar — Calendar · RangeCalendar 의 header 를 RAC 예제 조립으로 (grid 내부는 그대로)                                                                                                                                                                                                                                          | 같은 층 · `inline_icon_text`                                                                                                                                              | G2 · G4 |
| 10    | S2 — Card (`CardPreview` · `Content` · `Footer`, CardHeader 삭제) · CardView · AvatarGroup · ButtonGroup · InlineAlert · Badge                                                                                                                                                                                                   | `S/catalog/bindings/Card*.binding.ts` (CardHeader 삭제) · `componentTraits.ts` · `componentRulesTable.ts` Card* rule · 원본 template · `R/canvasPick.ts` · `R/subpart.ts` | G2 · G4 |
| 11    | 종결 — 미전환 family 제한 표 0행 · 예제 세트 live · 문서                                                                                                                                                                                                                                                                         | ADR README · CHANGELOG · `.claude/rules/ssot-hierarchy.md` (D3 sub-part 절 · toggle indicator 절 갱신)                                                                    | G5      |

순서 근거: Phase 2 는 ADR-253 이 부품 그리기를 이미 옮긴 곳이라 배치만 옮기면 된다 (가장 작은 위험으로 경로 검증). Phase 4 (상태별 표시) 는 Phase 5 의 선택 표시가 쓰므로 그 앞이다. S2 는 RAC family 가 끝난 뒤 같은 경로를 쓴다.

## 4. 완료 판정 예제 세트 (G0 ⑥ 후보 — Phase 0 에서 확정)

react-aria.adobe.com 문서의 예제에서 고른다. 기준값 = 예제 코드를 설치 RAC 로 마운트한 DOM (본문 G5).

| #   | 예제                                                                                | 확인하는 것                        |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | ListBox — 항목에 아이콘 + `Text slot="label"` + `Text slot="description"` · Section | 항목 안 자유 내용 · 이름 붙은 자리 |
| 2   | Menu — `Keyboard` 단축키 · SubmenuTrigger · Separator                               | collection 의 항목 종류 · 새 부품  |
| 3   | Select — trigger 안 `SelectValue` + 아이콘 · ListBox Section                        | 필수 짝 · picker                   |
| 4   | ComboBox / Autocomplete — Popover 안 SearchField + Menu                             | context 조립                       |
| 5   | TextField — Label · Input · description · FieldError + 앞 아이콘                    | field 안 자유 자식                 |
| 6   | NumberField — Group 안 증감 Button                                                  | `slot` context                     |
| 7   | Checkbox — `CheckboxField > CheckboxButton` + description · indeterminate 표시      | 상태별 표시                        |
| 8   | Tabs — TabList + `SelectionIndicator` · TabPanel 안 Form                            | 선택 표시 노드 · 자유 패널         |
| 9   | Dialog — Modal > Dialog > Heading slot=title + Form + `Button slot="close"`         | overlay context                    |
| 10  | GridList — 항목 안 Checkbox slot=selection + Button                                 | 항목 안 상호작용 부품              |
| 11  | Table — Cell 안 Link · Checkbox 열                                                  | collection 2단                     |
| 12  | Slider — SliderOutput · SliderTrack > SliderFill + SliderThumb                      | 채움 노드                          |
| 13  | (S2) Card — CardPreview Image · Content (title · description) · Footer Button       | S2 구조                            |

## 5. 기록

(Phase 진행 시 날짜 · 커밋 · 실측을 여기에 적는다)
