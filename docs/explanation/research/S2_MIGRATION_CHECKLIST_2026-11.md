# RAC → S2 마이그레이션 체크리스트 (2026-11-14)

컴포넌트 패널에 등록된 85종을 S2 (`@react-spectrum/s2` 1.8.2 설치본) 기준으로 세 축에서 대조한 진행 상태와 잔여 목록.

## 0. 방법과 한계

| 축                 | 패널               | 근거                                                                                                               |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 구조 (노드 트리)   | Layout 탭 · Layers | 2026-11-14 `.agent/task-state.json` `next` 에 기록된 S2 DOM 대조표를 옮김. 이 문서를 만들면서 다시 대조하지 않았다 |
| 스타일 값          | Style · Layout 탭  | `d3S2Alignment.static.test.ts` · `componentRulesTable.static.test.ts` 실행 결과 (2026-11-14)                       |
| 프로퍼티 이름 · 값 | Property 탭        | `d2S2Alignment.static.test.ts` 실행 결과 + S2 타입과 루트 binding `accepts` 의 기계 대조 (부록 A)                  |

- 대상 목록은 `apps/builder/src/builder/panels/components/paletteItems.ts` 의 `PALETTE_ORDER` 85종이다 (Chart 는 종류별 항목이 여럿이지만 타입 하나로 센다).
- 프로퍼티 후보는 **루트 binding 만** 본 기계 대조다. 부품 (Popover · Label …) 에 이미 있는 prop 과 자식 노드로 조립하는 것 (`contextualHelp`) 은 걸러지지 않으므로 누락 판정이 아니라 확인할 목록이다.
- live (Builder · Preview · Publish) 확인은 이 문서 범위 밖이다.

## 1. 집계

| 분류                     | 수  |
| ------------------------ | --- |
| 구조 일치                | 30  |
| 구조 잔여                | 31  |
| S2 대응 없음 (대상 아님) | 15  |
| 구조 미대조              | 9   |
| 합계                     | 85  |

축별 상태:

- **스타일 값**: 값 대조 대기 0. `d3S2Alignment` 73 통과. rule 리터럴 분류 게이트는 1건 실패 — `TabPanel.structure.containerStyles.minHeight = 0` 미분류 (Tabs 커밋 `7f76a6ee8` 에 들어감).
- **프로퍼티 이름 · 값**: `d2S2Alignment` 5 통과. S2 에 없는 키는 전부 `d2Provenance.ts` 에 출처가 있다. S2 가 선언하는데 루트 binding 에 없는 키는 부록 A.
- **구조**: 대조한 61종 가운데 30종 일치.

## 2. 구조 일치 — 30

- [x] field (7): TextField · TextArea · NumberField · SearchField · ColorField · DateField · TimeField
- [x] picker (2): Select · ComboBox
- [x] toggle (4): Checkbox · CheckboxGroup · RadioGroup · Switch
- [x] 버튼 (7): Button · LinkButton · ActionButton · ToggleButton · ButtonGroup · ActionButtonGroup · ToggleButtonGroup
- [x] 기타 (10): Badge · AvatarGroup · ColorSwatch · Form · Popover · Breadcrumbs · Tree · Card · Accordion · Separator

이름만 다른 것 (`d2S2Alignment` 의 `S2_ALIAS`):

| composition    | S2            | 비고                |
| -------------- | ------------- | ------------------- |
| Select         | Picker        |                     |
| Tree           | TreeView      |                     |
| Separator      | Divider       |                     |
| GridList       | ListView      | 구조 잔여 있음 (§3) |
| Table          | TableView     | 구조 잔여 있음 (§3) |
| ListBoxItem    | PickerItem    | 부품                |
| ListBoxSection | PickerSection | 부품                |
| body           | Provider      | page root           |

프로퍼티 후보 (루트 binding 기준):

| 묶음   | 후보                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| field  | `validationBehavior` (TextField · TextArea · NumberField · SearchField) · `prefix` (TextField · TextArea · NumberField · ColorField) · NumberField `commitBehavior` |
| picker | `disabledKeys` (둘 다) · Select `validationBehavior` · ComboBox `prefix`                                                                                            |
| toggle | `validationBehavior` (넷 다)                                                                                                                                        |
| 버튼   | 없음                                                                                                                                                                |
| 기타   | AvatarGroup `label` · Card `density` · Accordion `density` · `isQuiet` · Tree `disabledKeys` · Popover `hideArrow` · `padding`                                      |

## 3. 구조 잔여 — 31

| 완료 | 컴포넌트                             | 구조 잔여                                                                                                                                    | 프로퍼티 후보                                                              |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [ ]  | Dialog                               | 본문 frame → S2 Content · 액션 = ButtonGroup > Button · 닫기 Button 자리 (S2 Dialog.tsx:201-254)                                             | `isDismissible` · `isKeyboardDismissDisabled`                              |
| [ ]  | DatePicker · DateRangePicker         | Popover > Dialog > Calendar (S2 CalendarPopover) · Popover 를 HelpText 앞으로                                                                | `maxVisibleMonths`                                                         |
| [ ]  | Calendar · RangeCalendar             | 월마다 [header + grid] → 헤더 줄 하나 + grid 줄 하나                                                                                         | `visibleMonths` (지금은 RAC `visibleDuration`) · `selectionAlignment`      |
| [ ]  | Tooltip                              | OverlayArrow 뒤 frame + Description 두 겹 → 글자가 Tooltip 직계 (S2 Tooltip.tsx:215-226)                                                     | –                                                                          |
| [ ]  | InlineAlert                          | Content > Description → Content 안 글자 직접                                                                                                 | –                                                                          |
| [ ]  | IllustratedMessage                   | Description → Content                                                                                                                        | –                                                                          |
| [ ]  | Toast                                | body div · ToastContent (Icon + Text[slot=title]) 래퍼                                                                                       | –                                                                          |
| [ ]  | ContextualHelp                       | 트리거 Button → ActionButton · Popover 안 padding 래퍼 · Footer 간격 (S2 marginTop 16 vs gap 8)                                              | `placement` · `offset` · `crossOffset` · `containerPadding` · `shouldFlip` |
| [ ]  | LabeledValue                         | 라벨 Text → FieldLabel > Label                                                                                                               | –                                                                          |
| [ ]  | ProgressCircle                       | 루트 div[role=progressbar] → RAC ProgressBar                                                                                                 | –                                                                          |
| [ ]  | StatusLight                          | 점 span → svg circle                                                                                                                         | –                                                                          |
| [ ]  | Meter · ProgressBar                  | FieldLabel 래퍼 · value 표시 조건 (확인 필요)                                                                                                | –                                                                          |
| [ ]  | Slider · RangeSlider                 | labelContainer · fieldInput 래퍼 · upperTrack > Fill · side 일 때 Output 을 track 뒤로                                                       | –                                                                          |
| [ ]  | ColorWheel · ColorArea · ColorSlider | ColorWheel inner ring div · ColorArea / ColorSlider thumb inner div · Loupe                                                                  | –                                                                          |
| [ ]  | ColorSwatchPicker                    | 선택 ring `::after` → div                                                                                                                    | `density` · `rounding`                                                     |
| [ ]  | DropZone                             | 내용 (아이콘 · 글자) 을 노드로 (S2 children = IllustratedMessage)                                                                            | –                                                                          |
| [ ]  | Menu                                 | Keyboard 를 description 뒤로 · Section Header > Heading + Text · Section 뒤 Divider · 빈 상태 글자 · selection 부품 marginRight 4 → item gap | `disabledKeys` · `disallowEmptySelection`                                  |
| [ ]  | GridList                             | item 에 selection Checkbox · Icon · chevron / link-out 부품 · S2 에 없는 GridListSection                                                     | `disabledKeys` · `disabledBehavior`                                        |
| [ ]  | Table                                | selection Checkbox 열 · 셀 (S2 는 selectionMode 로 자동)                                                                                     | `disabledKeys` · `sortDescriptor` · `treeColumn`                           |
| [ ]  | Tabs                                 | TabPanels 래퍼 삭제 · Tab 안 Indicator → Icon → Text 순서 (다른 세션 진행 중)                                                                | –                                                                          |
| [ ]  | TagGroup                             | Tag 내용 div · TagList 감싸는 div · show all ActionGroup                                                                                     | `disabledKeys` · `selectionBehavior` · `groupActionLabel`                  |
| [ ]  | CardView                             | Card 안 SelectionIndicator · CardCheckbox                                                                                                    | `density` · `selectionStyle` · `disabledKeys`                              |
| [ ]  | Disclosure                           | Heading 을 감싸는 DisclosureHeader                                                                                                           | –                                                                          |
| [ ]  | SideNav · SideNavPanel               | Icon 을 SideNavItemLink 안으로 · SideNavPanel content / footer div · 접기 = ActionButton                                                     | SideNav `disabledKeys` · `expandedKeys`                                    |

여러 컴포넌트에 걸친 잔여:

- [ ] field 공통 — FieldLabel div 늘 · invalid 아이콘 (FieldErrorIcon) · 필수 표시 구조

## 4. S2 대응 없음 — 15 (대상 아님)

Toolbar · Sheet · PreviewTrigger · FileUpload · FileTrigger · ListBox · Nav · Pagination · Autocomplete · Chart · TokenField · Icon · frame · Section · Slot

- FileTrigger · Autocomplete 는 S2 가 RAC 것을 다시 내보낼 뿐 S2 고유 구조 · 스타일이 없다.
- Section 은 RAC 전용, frame · Slot 은 composition 의 레이아웃 노드, Icon 은 composition 타입이다.

### 4.1 가장 가까운 S2 패턴에 맞추기 (2026-11-14 사용자 지시)

같은 이름의 S2 컴포넌트가 없어도 가장 가까운 S2 패턴의 구조 · 값 · prop 을 따른다. 게이트: `apps/builder/src/builder/catalogRuntime/__tests__/s2PatternNoCounterpart.static.test.ts`.

| 컴포넌트       | 가까운 S2 패턴                                                                          | 끝난 것 (미커밋)                                                                                                                                                                                                                           | 남은 것                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toolbar        | `ActionButtonGroup` (S2 `Toolbar.tsx` 는 스타일 없는 래퍼)                              | 크기 5단 · 간격 4 / 8 · 상자 padding · 상태 칠 · ToggleButton 폭 고정 삭제 · 기본 자식 ActionButton · Separator 작성 크기 삭제 · `density` · `isQuiet` · `isJustified` · `staticColor` · `isDisabled` + ActionButton 으로 전달 · live PASS | –                                                                                                                                                                                                                                                                                                                                                                                          |
| Pagination     | quiet ActionButton + ToggleButtonGroup (단일 선택 = 현재 page)                          | 크기 5단 · 간격 4 / 8 · 옛 `.pagination-*` · `--btn-*` · 상태 칠 삭제 · 기본 구조 `이전 + page 번호 ToggleButtonGroup + 다음` · 크기를 다섯 버튼에 전달 · live PASS                                                                        | 이전 · 다음을 아이콘 버튼으로 (지금은 글자 화살표 — ActionButton 원본에 `aria-label` 이 없어 아이콘만 두면 이름이 없다) · `aria-label` 편집                                                                                                                                                                                                                                                |
| Nav            | 칠하지 않는 컨테이너 + standalone Link                                                  | 바탕 투명 · 고정 높이 · padding · 상태 칠 삭제 · 가로 줄 배치를 rule 로 · 기본 Link standalone · quiet · secondary · 크기를 Link 에 전달 · `selectedRoute` (현재 Link 굵기 700 · `aria-current`) · live PASS                               | –                                                                                                                                                                                                                                                                                                                                                                                          |
| Icon           | 적용 대상 아님 (사용자 결정 2026-11-14 — 아이콘 자체가 S2 와 다르다)                    | –                                                                                                                                                                                                                                          | –                                                                                                                                                                                                                                                                                                                                                                                          |
| FileUpload     | DropZone > IllustratedMessage + ProgressBar + InlineAlert                               | 진행 막대의 삭제된 `variant` 제거                                                                                                                                                                                                          | 업로드 목록 행 · 썸네일 · 오류 표시 규칙 · 자식 버튼 비활성 전달 · S2 조립 (DropZone 구조 잔여 §3 뒤)                                                                                                                                                                                                                                                                                      |
| FileTrigger    | RAC FileTrigger + S2 Button 자식                                                        | –                                                                                                                                                                                                                                          | `FileTrigger > Button` 구조 · rule `display: contents` · 글자 · size · isDisabled 를 Button 으로                                                                                                                                                                                                                                                                                           |
| Sheet          | 상자 = `Modal` · 안쪽 = `Dialog`                                                        | 값 대조 — 배경 · backdrop · 모서리 16 일치 (모서리는 Dialog 와 같은 이유로 숫자 유지)                                                                                                                                                      | 안쪽 여백 24 (S2 32) · 닫기 버튼을 Footer 로 — Dialog 구조 잔여 (§3) 와 같이 정한다 (선례 Dialog 가 여백 40 · 자체 Footer 구조) · backdrop fade 250 / 130 · 폭 360 (S2 Modal 400 / 480)                                                                                                                                                                                                    |
| PreviewTrigger | `Popover` + `TooltipTrigger` 지연                                                       | 값 대조 — 일치 · 본체의 작성 폭 240 삭제 (Popover rule 의 S2 크기별 폭 336 · 416 · 576)                                                                                                                                                    | –                                                                                                                                                                                                                                                                                                                                                                                          |
| ListBox        | Picker · ComboBox 의 `listbox` · `listboxItem`                                          | 팝오버 안 목록은 이미 일치                                                                                                                                                                                                                 | 사용자 결정 (2026-11-14): 단독 목록의 상자 · 선택 채움은 유지하고 세부만 — picker 안 description 글자 단계 (지금 12 고정 → 크기별 ui-xs · ui-sm · ui · ui-lg) · 색 neutral-subdued · label ↔ description 간격 1 · check 크기 · section Divider. Canvas 는 `manualBoxRules.ts` `listBoxItemParts` 가 label 14 · description 12 를 크기와 무관하게 적고 있어 두 consumer 를 같이 고쳐야 한다 |
| Autocomplete   | S2 예제 `SearchField + Menu`                                                            | –                                                                                                                                                                                                                                          | SearchField 보이는 label 비우기 · 목록 위 간격 8                                                                                                                                                                                                                                                                                                                                           |
| TokenField     | `TextArea` (FieldLabel + FieldGroup + HelpText)                                         | –                                                                                                                                                                                                                                          | 상자 값 · 상태 트리 · size 4단 · labelPosition · labelAlign · control Group 구조 · Form 상속 · Token 모양                                                                                                                                                                                                                                                                                  |
| Chart          | 없음 (글자 단계 · Tooltip 값만)                                                         | –                                                                                                                                                                                                                                          | 툴팁 radius · padding 을 rule 로 · 축 글자 11 을 토큰으로 (ADR-306 size 삭제 뒤)                                                                                                                                                                                                                                                                                                           |
| Section        | 적용 대상 아님 (레이아웃 상자 — S2 section 은 `ListBoxSection` · `MenuSection` 이 대응) | –                                                                                                                                                                                                                                          | –                                                                                                                                                                                                                                                                                                                                                                                          |
| frame · Slot   | 적용 대상 아님 (레이아웃 노드 · 편집 전용 자리)                                         | –                                                                                                                                                                                                                                          | –                                                                                                                                                                                                                                                                                                                                                                                          |

live 확인 (2026-11-14, 새 프로젝트 verify-s2pattern-1114): Toolbar 390×56 · Nav 367×18 이 Canvas 와 Preview DOM 에서 같고, DOM 값은 Toolbar · Pagination gap 8 · padding 0 · 투명, Nav gap 12 · padding 0 · 투명, Toolbar Size 칸 XS ~ XL, console 오류 0.

Toolbar 2단계 live 확인 (새 프로젝트 verify-toolbar-1114): Size L · Compact 에서 Canvas 273×40 = Preview DOM 273.4×40, 간격 2 · 이어진 모서리 · 버튼 높이 40, Quiet 를 켜면 버튼 세 개가 `data-quiet` · 투명 바탕, 구분선 2×40, console 오류 0.

Nav 2단계 live 확인 (같은 프로젝트): Selected route `/about` 에서 About 이 Canvas · Preview 모두 굵게 (DOM font-weight 700 · `aria-current="page"`, 나머지 500), Nav 390×18, 새로고침 뒤에도 유지, console 오류 0. 처음에는 두 화면 모두 굵기가 500 으로 남는 것을 live 에서 발견해 고쳤다 — Canvas 는 rule 변형 굵기 (standalone 500) 가 파생 굵기를 덮었고, DOM 은 수동 `Link.css` 의 standalone 블록이 이겼다.

Pagination 2단계 live 확인 (같은 프로젝트): Canvas 202×32 = Preview DOM 202.4×32, 버튼 다섯 개 높이 32 · 모서리 8 · quiet, page 1 만 선택 칠 (두 화면 같음), `<nav aria-label="Pagination">` 안 ToggleButtonGroup `role=radiogroup`, console 오류 0.

## 5. 구조 미대조 — 9

| 완료 | 컴포넌트                                      | 상태                                                                                 |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| [ ]  | Text · Keyboard · Skeleton                    | 11-14 대조표에 없음                                                                  |
| [ ]  | ActionBar · SelectBoxGroup · SegmentedControl | 11-07 에 slot · 상속 패턴 감사 · 수리 완료. 구조 대조표에는 없음                     |
| [ ]  | Avatar · Link                                 | 구조 판정 없음. initials · 외부 아이콘은 S2 에 없는 확장으로만 기록 (§7 결정 대기 2) |
| [ ]  | Image                                         | catalog 미등록 (팔레트 전용 항목) — S2 Image 와 prop 대조 불가                       |

## 6. 진행 중 · 커밋 (2026-11-14 기준)

- [x] Tabs — `7f76a6ee8` 커밋. rule 리터럴 분류 게이트의 `TabPanel.structure.containerStyles.minHeight = 0` 미분류 1건은 남아 있다
- [x] Separator — S2 Divider 정렬 `7f76a6ee8` 커밋
- [x] ActionButton Avatar · Badge (`Badge.value`) — `9ef5e0669`. S2 와 같게: Avatar 가 Icon 자리를 대신함 · 비활성 버튼은 Badge 숨김 · staticColor 버튼의 Badge 는 그 색 바탕 + 대비 글자. live (verify-ab-1114): Canvas · Preview 위치 · 크기 같음, console 오류 0
- [x] ActionButton form · focus prop 10개 (`editorHidden`) + Type · Auto focus 패널 숨김 — `9ef5e0669`
- [x] Text 기본 width · height fit-content — `9ef5e0669`
- [x] Pagination width · height fit-content — `9ef5e0669`
- [x] Illustration strokeWidth 기본 1 — `9ef5e0669`
- [x] Canvas 말줄임 1/64px 허용 (float32 한 단위 차이로 「Acti…」 로 잘리던 문제) — `9ef5e0669`
- [x] SearchField Group padding-right 0 — `59496c6cf`
- [ ] staticColor `auto` 를 S2 방식으로 — 진행 중 (§8)

검증 잔여:

- [ ] field · picker FieldGroup 커밋 (`33b1133b8`) live (Canvas · Preview) 확인
- [ ] parity 기존 실패 (작업 상태 기록, 이 문서에서 다시 실행하지 않음) — `s2FieldText` SearchField · ComboBox 32건 · `s2InlineLabel` icon 필수 표시 52건 · `themeColorParity` 100건 · `s2SelectionStates` · `selectValueSize` 의 isSelected · `adr248CatalogRealDom` combobox
- [ ] shared `designDataSurfaceGaps` Toast 수동 CSS 실패 (`b77ecb88d` 이후)

## 7. 결정 대기

1. toggle 3종 (Checkbox · Radio · Switch) 의 배치 차이 — 도움말 들여쓰기 (S2 는 글자 열에서 시작) · 버튼과 도움말 간격 · 여러 줄 라벨에서 indicator 정렬 (S2 baseline).
2. S2 에 없는 확장 유지 여부 — Avatar initials · Link 외부 아이콘.
3. 세로 flex 에서 눌림 — Tree (overflow auto) · Table (min-height 40 + overflow auto) · Chart (고유 최소 높이 없음) · SideNav / SideNavPanel (S2 minHeight 0).
4. 프로퍼티 후보 (§2 · §3 · 부록 A) 가운데 무엇을 Property 탭에 낼지.
5. 일반 Button 에도 S2 form · focus prop 10개 (`name` · `value` · `form*` · `excludeFromTabOrder` · `preventFocusOnPress`) 를 넣을지.

결정됨: ActionButton 의 Type · Auto focus 는 패널에서 숨김 (사용자 11-14 「숨겨」).

## 8. staticColor `auto` — S2 방식 (사용자 11-14 진행 지시)

S2 1.8.2 `style/tokens.ts` `autoStaticColor`: 놓인 바탕 (`--s2-container-bg`, Card · Modal · ActionBar · CoachMark 가 자기 배경으로 설정) 의 LCH 밝기를 49.44 와 비교해 밝으면 검정 · 어두우면 흰색 계열로 칠한다 (`lch(from bg calc((49.44 - l) * infinity) 0 0 / α)`). S2 기본값은 값 없음 (테마 색).

지금 우리: 기본값 `auto` = 테마 색 (S2 의 「값 없음」). `white` · `black` 만 고정 흑백.

- [x] 값의 뜻 분리 — 기본값 「없음」 (패널 None = `""`), `auto` = 바탕 밝기로 흑 / 백. 원본 template 의 `staticColor: "auto"` 10 곳 삭제 · shared 컴포넌트의 `"auto"` 기본값 삭제
- [x] 판정 한 곳 — `packages/shared/src/catalog/runtime/staticBackdrop.ts` (`catalogAutoStaticTone` · `catalogStaticBackdropTone`) 을 composition root 파생 단계가 불러 `derivedProps.staticColor` 에 싣는다 (CSS 상대 색 대신 — Skia 가 `lch(from …)` 를 못 읽고, ADR-297 「두 번째 파생식 금지」)
- [x] 바탕 = 가장 가까운 조상의 흑 / 백 static 스킴 → 불투명 단색 칠 (사용자 결정 「칠한 단색 바탕도 포함」) → 층 컨테이너 → 페이지 `{color.base}`. `auto` 조상은 건너뛴다 (S2 `staticColor()` 는 흑 / 백만 `--s2-container-bg` 를 쓴다)
- [x] Canvas — 파생 스킴을 조건 칠이 읽고 (`catalogDerivedConditionalVisual`), `auto` Button 이 글자 · 아이콘의 glyph owner (`catalogToggleButtonGlyphOwner`)
- [x] DOM — `catalogEffectiveStaticColor` 하나를 domBinding · delegatedDom 이 읽어 `data-static-color` 를 낸다
- [x] 바탕 편집 → 아래 auto 노드 · 부품 재파생 (`catalogStaticAutoDependents`)
- [x] emphasized ActionBar 의 흑 / 백도 같은 LCH 규칙 (그전 WCAG 대비)
- [x] live (2026-11-15, 새 프로젝트 verify-static-auto-1115) — #111111 바탕: auto Button · ProgressCircle = 흰 스킴 (DOM `data-static-color=white` · 바탕 rgba(255,255,255,.85) · 글자 검정), None Button = 테마 (#292929 · 흰 글자), Canvas 같음. 바탕을 #f5f5f5 로 바꾸자 auto 둘 다 검정 스킴 (Canvas · Preview). 패널 Static color 칸 None · Auto · ○ · ● — Auto / None 클릭이 반영. console 오류 0

## 부록 A. 루트 binding 에 없는 S2 prop (기계 대조)

`d2S2Alignment.static.test.ts` 와 같은 방식으로 설치본 S2 타입의 prop 키를 뽑아 루트 binding `accepts` (숨김 키 포함) 와 비교했다. 이벤트 · ARIA · DOM 전달 · form · link 기본 속성은 뺐다.

저작 대상이 아닌 것 (함수 · ref · 런타임 상태) 은 아래 표에서도 뺐다: `createCalendar` · `isDateUnavailable` · `dragAndDropHooks` · `renderActionBar` · `renderEmptyState` · `renderValue` · `scrollRef` · `triggerRef` · `getTargetRect` · `inputRef` · `filter` · `getDropOperation` · `isEntering` · `UNSTABLE_focusOnEntry`.

저작 모델이 달라 이름만 다른 것: `defaultSelected` (→ `isSelected`) · `defaultExpanded` (→ `isExpanded`) · `selectedKey` / `defaultSelectedKey` (Select 는 `value`) · `inputValue` / `defaultInputValue`.

| 컴포넌트                     | S2 가 선언하고 루트 binding 에 없는 키                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AvatarGroup                  | `label`                                                                                                                                                               |
| LabeledValue                 | `contextualHelp` (자식 노드)                                                                                                                                          |
| Card                         | `density` · `allowsArrowNavigation` · `focusMode` · `textValue`                                                                                                       |
| CardView                     | `density` · `selectionStyle` · `disabledKeys` · `disabledBehavior` · `disallowEmptySelection` · `disallowTypeAhead` · `escapeKeyBehavior` · `shouldSelectOnPressUp`   |
| Accordion                    | `density` · `isQuiet`                                                                                                                                                 |
| SideNav                      | `disabledKeys` · `expandedKeys` · `defaultExpandedKeys`                                                                                                               |
| Menu                         | `disabledKeys` · `disallowEmptySelection` · `escapeKeyBehavior` · `shouldCloseOnSelect` · `shouldFocusWrap`                                                           |
| TextField · TextArea         | `validationBehavior` · `prefix` · `contextualHelp` (자식 노드)                                                                                                        |
| NumberField                  | `validationBehavior` · `prefix` · `commitBehavior` · `incrementAriaLabel` · `decrementAriaLabel` · `contextualHelp`                                                   |
| SearchField                  | `validationBehavior` · `contextualHelp`                                                                                                                               |
| ColorField                   | `prefix` · `contextualHelp`                                                                                                                                           |
| ColorSlider                  | `contextualHelp`                                                                                                                                                      |
| ColorSwatchPicker            | `density` · `rounding`                                                                                                                                                |
| Checkbox · Switch            | `validationBehavior`                                                                                                                                                  |
| CheckboxGroup · RadioGroup   | `validationBehavior` · `contextualHelp`                                                                                                                               |
| Select                       | `validationBehavior` · `disabledKeys` · `shouldCloseOnSelect` · `shouldFlip` · `contextualHelp`                                                                       |
| ComboBox                     | `disabledKeys` · `prefix` · `shouldFlip` · `shouldFocusWrap` · `formValue` · `contextualHelp`                                                                         |
| Slider · RangeSlider         | `contextualHelp`                                                                                                                                                      |
| Form                         | `validationErrors`                                                                                                                                                    |
| Table                        | `disabledKeys` · `disabledBehavior` · `sortDescriptor` · `treeColumn` · `expandedKeys` · `escapeKeyBehavior` · `keyboardNavigationBehavior` · `shouldSelectOnPressUp` |
| GridList                     | `disabledKeys` · `disabledBehavior` · `disallowTypeAhead` · `escapeKeyBehavior` · `keyboardNavigationBehavior` · `shouldSelectOnPressUp`                              |
| Tree                         | `disabledKeys` · `disabledBehavior` · `escapeKeyBehavior` · `keyboardNavigationBehavior` · `shouldSelectOnPressUp`                                                    |
| TagGroup                     | `disabledKeys` · `selectionBehavior` · `groupActionLabel` · `escapeKeyBehavior` · `shouldSelectOnPressUp` · `contextualHelp`                                          |
| Calendar · RangeCalendar     | `visibleMonths` · `selectionAlignment` · `focusedValue` · `defaultFocusedValue` · (Range) `commitBehavior`                                                            |
| DatePicker · DateRangePicker | `maxVisibleMonths` · `shouldFlip` · `contextualHelp` · (Range) `commitBehavior`                                                                                       |
| DateField · TimeField        | `contextualHelp`                                                                                                                                                      |
| Dialog                       | `isDismissible` · `isKeyboardDismissDisabled`                                                                                                                         |
| Popover                      | `hideArrow` · `padding` · `isNonModal`                                                                                                                                |
| ContextualHelp               | `placement` · `offset` · `crossOffset` · `containerPadding` · `shouldFlip`                                                                                            |

차이가 없는 타입 (S2 대응이 있는 것 가운데): Text · Keyboard · Separator · Badge · ProgressBar · Meter · Skeleton · Avatar · SelectBoxGroup · InlineAlert · ProgressCircle · IllustratedMessage · Tabs · Breadcrumbs · Link · SideNavPanel · Button · LinkButton · ActionButton · ActionButtonGroup · ToggleButtonGroup · ButtonGroup · ColorArea · ColorWheel · ColorSwatch · SegmentedControl · Tooltip.

## 관련

- 정본 규칙: `.claude/rules/ssot-hierarchy.md` (D2 · D3) · `.claude/rules/catalog-subparts.md` (부품 노드)
- 게이트: `apps/builder/src/builder/catalogRuntime/__tests__/{d2S2Alignment,d3S2Alignment}.static.test.ts` · `packages/shared/src/catalog/__tests__/componentRulesTable.static.test.ts`
- 앞선 조사: `SPECTRUM_COVERAGE_GAP_2026-11.md` · `S2_PROP_ALIGNMENT_2026-10.md`
