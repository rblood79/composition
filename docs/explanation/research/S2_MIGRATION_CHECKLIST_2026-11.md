# RAC → S2 마이그레이션 체크리스트 (2026-11-14)

팔레트 정렬 목록 `PALETTE_ORDER`의 85종을 S2 (`@react-spectrum/s2` 1.8.2 설치본) 기준으로 대조한 진행 상태와 잔여 목록. Toast는 Library 전용이며 이 85종에 포함한다.

**현재 코드 재점검: 2026-11-14, HEAD `1a8e000ad`.** 기존 11-14/11-15 live 기록의 날짜는 원기록을 보존했다. 이번 갱신은 레퍼런스·코드·단위 테스트 대조이며 live를 다시 수행하지 않았다.

## 0. 방법과 한계

| 축               | 근거                                                                                                  | 이번 확인 범위                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 구조 (노드 트리) | 최초 `.agent/task-state.json`의 S2 DOM 대조표                                                         | 기존 61종의 전수 DOM 판정은 재실행하지 않음. Tabs·field 조립 경로와 Image 정의 등 갱신한 항목은 현재 코드에서 재확인   |
| 스타일 값        | `d3S2Alignment.static.test.ts` · `componentRulesTable.static.test.ts`                                 | 설치본을 읽는 기존 게이트 재실행. 73개 값 검사의 통과가 모든 상태·배치·motion의 일치를 뜻하지는 않음                   |
| 프로퍼티 이름·값 | 설치본 S2 타입 · binding `accepts` · rule-only 계약·문서 정의                                         | 팔레트 루트 및 등록 부품의 누락 키, 선언된 enum 옵션의 빠진 값, 레퍼런스 API 표에 명시된 기본값 대조. 결과는 부록 A~C  |
| 레퍼런스 범위    | `.claude/skills/react-spectrum/references/components/*.md` 71개 파일의 제목·기능 절·API 표 118개 구획 | ActionMenu·Provider·Image와 중첩 부품/변형을 포함. `forms`·`collections`·`selection`·`dnd` 가이드의 공통 기능은 부록 D |

- 로컬 `react-spectrum` 레퍼런스는 2026-10-15 스냅샷이다. 현재 웹 전체의 최신성 검증이나 S2 버전 변경은 하지 않았다. 문서와 다르면 **설치된 S2 1.8.2 타입·소스**를 우선했다.
- 구조 분류는 최초 대조의 이력이다. **구조 일치 = 해당 컴포넌트 전체 마이그레이션 완료가 아니다.** field 공통 잔여·부품·값·기본값·동작 검증은 따로 남는다.
- binding에 키가 없어도 자식 노드·문서 정의·metadata·runtime에서 처리할 수 있다. 이 경로를 확인한 항목은 부록 A.2로 분리했다. 반대로 키가 있다는 사실만으로 전달·저장·동작까지 완료로 판정하지 않는다.
- `d2S2Alignment`는 **보이는 binding 키와 선언된 옵션이 허용되는지** 검사한다. S2의 모든 키·옵션·기본값을 구현했는지, 숨김 키·rule-only 타입을 전부 지원하는지는 보장하지 않는다.
- Builder·Preview·Publish live, 기존 프로젝트 마이그레이션, 전체 parity 스위트는 이번 갱신에서 `UNVERIFIED`다. 과거 live PASS는 해당 기록의 시나리오에만 적용한다.

## 1. 집계

| 분류              | 수  |
| ----------------- | --- |
| 구조 일치         | 30  |
| 구조 잔여         | 31  |
| S2 고유 대응 없음 | 15  |
| 구조 미대조       | 9   |
| 합계              | 85  |

축별 상태:

- **스타일 값**: 기존 값 대조 게이트 `d3S2Alignment` 73 통과. 전체 레퍼런스 기능의 잔여 0을 뜻하지 않는다 (§4.1·부록 C·D). rule 리터럴 분류 게이트는 1건 실패 — `TabPanel.structure.containerStyles.minHeight = 0` 미분류 (Tabs 커밋 `7f76a6ee8` 에 들어감).
- **프로퍼티 이름·값**: `d2S2Alignment` **4 통과·1 실패** — `Tabs.items`가 S2 Tabs의 prop이 아니며 `d2Provenance.ts`에도 없다. S2 예제는 `TabList.items`와 `Collection.items`에 데이터를 준다. composition의 루트 저작 모델을 출처로 명시하는 작업이 남는다. 역방향 키 대조는 부록 A·B, 옵션·기본값 차이는 부록 C.
- **구조**: 최초 대조한 61종 가운데 30종 일치·31종 잔여/부분 완료. Tabs의 `TabPanels` 제거는 완료됐으나 Icon 포함 구조는 이번에 닫지 않아 분류 수는 유지했다.

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

프로퍼티 후보 요약 (상세·추가 항목·다른 저작 경로는 부록 A~C):

| 묶음   | 후보                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| field  | `validationBehavior` (TextField · TextArea · NumberField · SearchField) · `prefix` 4종은 자식 노드로 구현됨 (A.2) · NumberField `commitBehavior` |
| picker | `disabledKeys` (둘 다) · Select `validationBehavior` · ComboBox `prefix`는 자식 노드로 구현됨 (A.2)                                              |
| toggle | `validationBehavior` (넷 다)                                                                                                                     |
| 버튼   | 일반 Button form/focus 결정 대기는 §7; 추가 후보는 A                                                                                             |
| 기타   | AvatarGroup `label` · Card `density` · Accordion `density` · `isQuiet` · Tree `disabledKeys` · Popover `hideArrow` · `padding`                   |

## 3. 구조 잔여 — 31

| 완료 | 컴포넌트                             | 구조 잔여                                                                                                                                                      | 프로퍼티 후보                                                              |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [ ]  | Dialog                               | 본문 frame → S2 Content · 액션 = ButtonGroup > Button · 닫기 Button 자리 (S2 Dialog.tsx:201-254)                                                               | `isDismissible` · `isKeyboardDismissDisabled`                              |
| [ ]  | DatePicker · DateRangePicker         | Popover > Dialog > Calendar (S2 CalendarPopover) · Popover 를 HelpText 앞으로                                                                                  | `maxVisibleMonths`                                                         |
| [ ]  | Calendar · RangeCalendar             | 월마다 [header + grid] → 헤더 줄 하나 + grid 줄 하나                                                                                                           | `visibleMonths` (지금은 RAC `visibleDuration`) · `selectionAlignment`      |
| [ ]  | Tooltip                              | OverlayArrow 뒤 frame + Description 두 겹 → 글자가 Tooltip 직계 (S2 Tooltip.tsx:215-226)                                                                       | –                                                                          |
| [ ]  | InlineAlert                          | Content > Description → Content 안 글자 직접                                                                                                                   | –                                                                          |
| [ ]  | IllustratedMessage                   | Description → Content                                                                                                                                          | –                                                                          |
| [ ]  | Toast                                | body div · ToastContent (Icon + Text[slot=title]) 래퍼                                                                                                         | –                                                                          |
| [ ]  | ContextualHelp                       | 트리거 Button → ActionButton · Popover 안 padding 래퍼 · Footer 간격 (S2 marginTop 16 vs gap 8)                                                                | `placement` · `offset` · `crossOffset` · `containerPadding` · `shouldFlip` |
| [ ]  | LabeledValue                         | 라벨 Text → FieldLabel > Label                                                                                                                                 | –                                                                          |
| [ ]  | ProgressCircle                       | 루트 div[role=progressbar] → RAC ProgressBar                                                                                                                   | –                                                                          |
| [ ]  | StatusLight                          | 점 span → svg circle                                                                                                                                           | –                                                                          |
| [ ]  | Meter · ProgressBar                  | FieldLabel 래퍼 · value 표시 조건 (확인 필요)                                                                                                                  | –                                                                          |
| [ ]  | Slider · RangeSlider                 | labelContainer · fieldInput 래퍼 · upperTrack > Fill · side 일 때 Output 을 track 뒤로                                                                         | –                                                                          |
| [ ]  | ColorWheel · ColorArea · ColorSlider | ColorWheel inner ring div · ColorArea / ColorSlider thumb inner div · Loupe                                                                                    | –                                                                          |
| [ ]  | ColorSwatchPicker                    | 선택 ring `::after` → div                                                                                                                                      | `density` · `rounding`                                                     |
| [ ]  | DropZone                             | 내용 (아이콘 · 글자) 을 노드로 (S2 children = IllustratedMessage)                                                                                              | –                                                                          |
| [ ]  | Menu                                 | Keyboard 를 description 뒤로 · Section Header > Heading + Text · Section 뒤 Divider · 빈 상태 글자 · selection 부품 marginRight 4 → item gap                   | `disabledKeys` · `disallowEmptySelection`                                  |
| [ ]  | GridList                             | item 에 selection Checkbox · Icon · chevron / link-out 부품 · S2 에 없는 GridListSection                                                                       | `disabledKeys` · `disabledBehavior`                                        |
| [ ]  | Table                                | selection Checkbox 열 · 셀 (S2 는 selectionMode 로 자동)                                                                                                       | `disabledKeys` · `sortDescriptor` · `treeColumn`                           |
| [ ]  | Tabs                                 | `TabPanels` 제거·TabPanel 직계 배치는 `7f76a6ee8`에서 완료. 기본 Tab은 Indicator → Text. Icon 삽입 시 Indicator → Icon → Text 순서·숨김 label 조합은 추가 확인 | –                                                                          |
| [ ]  | TagGroup                             | Tag 내용 div · TagList 감싸는 div · show all ActionGroup                                                                                                       | `disabledKeys` · `selectionBehavior` · `groupActionLabel`                  |
| [ ]  | CardView                             | Card 안 SelectionIndicator · CardCheckbox                                                                                                                      | `density` · `selectionStyle` · `disabledKeys`                              |
| [ ]  | Disclosure                           | Heading 을 감싸는 DisclosureHeader                                                                                                                             | –                                                                          |
| [ ]  | SideNav · SideNavPanel               | Icon 을 SideNavItemLink 안으로 · SideNavPanel content / footer div · 접기 = ActionButton                                                                       | SideNav `disabledKeys` · `expandedKeys`                                    |

여러 컴포넌트에 걸친 잔여:

- [ ] field 공통 — FieldLabel div 늘 · invalid 아이콘 (FieldErrorIcon) · 필수 표시 구조

## 4. S2 고유 대응 없음 — 15 (가까운 패턴은 §4.1)

Toolbar · Sheet · PreviewTrigger · FileUpload · FileTrigger · ListBox · Nav · Pagination · Autocomplete · Chart · TokenField · Icon · frame · Section · Slot

- FileTrigger · Autocomplete 는 S2 가 RAC 것을 다시 내보낼 뿐 S2 고유 구조 · 스타일이 없다.
- Section 은 RAC 전용, frame · Slot 은 composition 의 레이아웃 노드, Icon 은 composition 타입이다.

### 4.1 가장 가까운 S2 패턴에 맞추기 (2026-11-14 사용자 지시)

같은 이름의 S2 컴포넌트가 없어도 가장 가까운 S2 패턴의 구조 · 값 · prop 을 따른다. 게이트: `apps/builder/src/builder/catalogRuntime/__tests__/s2PatternNoCounterpart.static.test.ts`.

| 컴포넌트       | 가까운 S2 패턴                                                                          | 현재 반영된 것                                                                                                                                                                                                                             | 남은 것                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toolbar        | `ActionButtonGroup` (S2 `Toolbar.tsx` 는 스타일 없는 래퍼)                              | 크기 5단 · 간격 4 / 8 · 상자 padding · 상태 칠 · ToggleButton 폭 고정 삭제 · 기본 자식 ActionButton · Separator 작성 크기 삭제 · `density` · `isQuiet` · `isJustified` · `staticColor` · `isDisabled` + ActionButton 으로 전달 · live PASS | –                                                                                                                                                                                                                                                                                                                                                                                          |
| Pagination     | quiet ActionButton + ToggleButtonGroup (단일 선택 = 현재 page)                          | 크기 5단 · 간격 4 / 8 · 옛 `.pagination-*` · `--btn-*` · 상태 칠 삭제 · 기본 구조 `이전 + page 번호 ToggleButtonGroup + 다음` · 크기를 다섯 버튼에 전달 · live PASS                                                                        | 이전·다음을 아이콘 버튼으로 바꾸면서 이름을 보존할 경로 확인. 일반 노드는 Accessibility의 `metadata.ariaLabel` 편집·DOM 전달이 이미 있음. Pagination 원본 내부 template는 metadata 편집 대상이 아니므로 원본 버튼의 이름 지정은 별도 확인 (A.2)                                                                                                                                            |
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

| 완료 | 컴포넌트                                      | 상태                                                                                                                                                         |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ ]  | Text · Keyboard · Skeleton                    | 11-14 대조표에 없음                                                                                                                                          |
| [ ]  | ActionBar · SelectBoxGroup · SegmentedControl | 11-07 에 slot · 상속 패턴 감사 · 수리 완료. 구조 대조표에는 없음                                                                                             |
| [ ]  | Avatar · Link                                 | 구조 판정 없음. initials · 외부 아이콘은 S2 에 없는 확장으로만 기록 (§7 결정 대기 1)                                                                         |
| [ ]  | Image                                         | 팔레트 진입은 overlay이나 rule-only `type-Image`가 있음 (`itemLinks.ts`: `src`·`alt`·`slot`). S2 조건부 source·오류·loading·ImageCoordinator는 잔여 (부록 D) |

## 6. 구현·커밋·검증 (HEAD `1a8e000ad` 기준)

- [x] Tabs — `7f76a6ee8` 커밋. rule 리터럴 분류 게이트의 `TabPanel.structure.containerStyles.minHeight = 0` 미분류 1건은 남아 있다
- [x] Separator — S2 Divider 정렬 `7f76a6ee8` 커밋
- [x] Toolbar·Pagination·Nav — S2 패턴 값·조립·상속 `6635cd9b4` 커밋 (§4.1)
- [x] ActionButton Avatar · Badge (`Badge.value`) — `9ef5e0669`. S2 와 같게: Avatar 가 Icon 자리를 대신함 · 비활성 버튼은 Badge 숨김 · staticColor 버튼의 Badge 는 그 색 바탕 + 대비 글자. live (verify-ab-1114): Canvas · Preview 위치 · 크기 같음, console 오류 0
- [x] ActionButton form · focus prop 10개 (`editorHidden`) + Type · Auto focus 패널 숨김 — `9ef5e0669`
- [x] Text 기본 width · height fit-content — `9ef5e0669`
- [x] Pagination width · height fit-content — `9ef5e0669`
- [x] Illustration strokeWidth 기본 1 — `9ef5e0669`
- [x] Canvas 말줄임 1/64px 허용 (float32 한 단위 차이로 「Acti…」 로 잘리던 문제) — `9ef5e0669`
- [x] SearchField Group padding-right 0 — `59496c6cf`
- [x] staticColor `auto` 를 S2 방식으로 — `87d355074` (§8)
- [x] toggle 3종 (Checkbox · Radio · Switch) 배치 S2 정렬 — `59432472d` 구현·`1a8e000ad` 정리 커밋. 아래 live는 당시 기록이며 이번 재점검은 단위 10 통과. ① 도움말 라벨 열 시작 (Radio · 그룹 안 Checkbox) ② 버튼 ↔ 도움말 거리 (field 높이 − 줄 높이 / 1 · 1 · 2 · 2) ③ indicator 첫 줄 — 구현 · 테스트 7 · RED 5 · live (verify-static-auto-1115, 폭 220 frame): Canvas = Preview — 단독 Checkbox 도움말 버튼 아래 14 · Switch 14 · Radio / 그룹 안 Checkbox 도움말 x +26 · 1 아래 · indicator 위 1, console 오류 0. 이어서 ⓐ Switch `paddingY` 4 → 0 · ⓑ 긴 라벨 줄바꿈 (template `whiteSpace: normal` · Canvas 한 줄 판정 · 엔진 세로 flex 자식 fit-content 수정 · indicator `flex-shrink: 0`) — live: 폭 220 frame 에서 Canvas = Preview 22 값 (Checkbox 라벨 178 × 36 두 줄 · indicator 첫 줄), console 오류 0

현재 재실행 (2026-11-14, 위 HEAD):

| 검사                                                               | 결과                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `d2S2Alignment`                                                    | 4 통과·1 실패 (`Tabs.items` 출처)                                  |
| `d3S2Alignment`                                                    | 73 통과                                                            |
| `s2PatternNoCounterpart`                                           | 13 통과                                                            |
| `adr256TabsNodeTree` · `tabsDynamicCollection`                     | 8 + 2 통과 (직계 패널·추가/삭제·저장/로드 등)                      |
| `staticColorAuto` · `toggleS2Layout`                               | 7 + 10 통과                                                        |
| `adr259FieldPrefix` · `adr259ContextualHelp`                       | 65 + 48 통과                                                       |
| `toolbarActionGroup` · `navCurrentRoute` · `paginationActionGroup` | 3 + 4 + 3 통과                                                     |
| shared `componentRulesTable`                                       | 19 통과·1 실패 (`TabPanel` minHeight 리터럴 미분류)                |
| shared `designDataSurfaceGaps`                                     | 12 통과·1 실패 (Toast runtime에 `catalog-toast-shaped` scope 없음) |

합계 **14개 파일·271 통과·3 실패**. 제품 코드는 이번 점검에서 수정하지 않았다. 로그는 로컬 `.agent/runs/s2-migration-checklist-review-20261114/{builder-current,shared-current}.log`에 있다.

검증 잔여:

- [ ] `Tabs.items` D2 출처 등록·게이트 복구 (이번 재현)
- [ ] field · picker FieldGroup 커밋 (`33b1133b8`) live (Canvas · Preview) 확인
- [ ] parity 기존 실패 (작업 상태 기록, 이 문서에서 다시 실행하지 않음) — `s2FieldText` SearchField · ComboBox 32건 · `s2InlineLabel` icon 필수 표시 52건 · `themeColorParity` 100건 · `s2SelectionStates` · `selectValueSize` 의 isSelected · `adr248CatalogRealDom` combobox
- [ ] shared `designDataSurfaceGaps` Toast 수동 CSS 실패 (`b77ecb88d` 이후 기록, 이번 재현)

## 7. 결정 대기

1. S2 에 없는 확장 유지 여부 — Avatar initials · Link 외부 아이콘.
2. 세로 flex 에서 눌림 — Tree (overflow auto) · Table (min-height 40 + overflow auto) · Chart (고유 최소 높이 없음) · SideNav / SideNavPanel (S2 minHeight 0).
3. 프로퍼티 후보 (§2 · §3 · 부록 A) 가운데 무엇을 Property 탭에 낼지.
4. 일반 Button에도 S2 form·focus prop 10개 (`name`·`value`·`form*`·`excludeFromTabOrder`·`preventFocusOnPress`)를 넣을지.
5. 부록 C의 기본값 차이를 S2로 통일할지, 삽입 프리셋/기존 문서 호환 차이로 유지할지. 옵션 누락은 같은 부록에서 별도 추적.
6. 부록 D의 별도 S2 컴포넌트·변형을 새 팔레트 항목으로 제공할지, 기존 조합으로 제공할지. 문서 추가는 신규 구현 승인이나 완료 판정이 아니다.

결정됨: ActionButton 의 Type · Auto focus 는 패널에서 숨김 (사용자 11-14 「숨겨」). toggle 3종 배치 차이는 S2 대로 맞춤 (사용자 11-15 「진행해」 — §6).

## 8. staticColor `auto` — S2 방식 (사용자 11-14 진행 지시)

S2 1.8.2 `style/tokens.ts` `autoStaticColor`: 놓인 바탕 (`--s2-container-bg`, Card · Modal · ActionBar · CoachMark 가 자기 배경으로 설정) 의 LCH 밝기를 49.44 와 비교해 밝으면 검정 · 어두우면 흰색 계열로 칠한다 (`lch(from bg calc((49.44 - l) * infinity) 0 0 / α)`). S2 기본값은 값 없음 (테마 색).

현재 (`87d355074` 이후): **미지정/None = 테마 색**, `auto` = 바탕 밝기에 따른 흑/백 스킴, `white`·`black` = 고정 스킴. 변경 전에는 `auto`가 테마 색 의미였지만 이제는 다르다.

- [x] 값의 뜻 분리 — 기본값 「없음」 (패널 None = `""`), `auto` = 바탕 밝기로 흑 / 백. 원본 template 의 `staticColor: "auto"` 10 곳 삭제 · shared 컴포넌트의 `"auto"` 기본값 삭제
- [x] 판정 한 곳 — `packages/shared/src/catalog/runtime/staticBackdrop.ts` (`catalogAutoStaticTone` · `catalogStaticBackdropTone`) 을 composition root 파생 단계가 불러 `derivedProps.staticColor` 에 싣는다 (CSS 상대 색 대신 — Skia 가 `lch(from …)` 를 못 읽고, ADR-297 「두 번째 파생식 금지」)
- [x] 바탕 = 가장 가까운 조상의 흑 / 백 static 스킴 → 불투명 단색 칠 (사용자 결정 「칠한 단색 바탕도 포함」) → 층 컨테이너 → 페이지 `{color.base}`. `auto` 조상은 건너뛴다 (S2 `staticColor()` 는 흑 / 백만 `--s2-container-bg` 를 쓴다)
- [x] Canvas — 파생 스킴을 조건 칠이 읽고 (`catalogDerivedConditionalVisual`), `auto` Button 이 글자 · 아이콘의 glyph owner (`catalogToggleButtonGlyphOwner`)
- [x] DOM — `catalogEffectiveStaticColor` 하나를 domBinding · delegatedDom 이 읽어 `data-static-color` 를 낸다
- [x] 바탕 편집 → 아래 auto 노드 · 부품 재파생 (`catalogStaticAutoDependents`)
- [x] emphasized ActionBar 의 흑 / 백도 같은 LCH 규칙 (그전 WCAG 대비)
- [x] live (2026-11-15, 새 프로젝트 verify-static-auto-1115) — #111111 바탕: auto Button · ProgressCircle = 흰 스킴 (DOM `data-static-color=white` · 바탕 rgba(255,255,255,.85) · 글자 검정), None Button = 테마 (#292929 · 흰 글자), Canvas 같음. 바탕을 #f5f5f5 로 바꾸자 auto 둘 다 검정 스킴 (Canvas · Preview). 패널 Static color 칸 None · Auto · ○ · ● — Auto / None 클릭이 반영. console 오류 0

## 부록 A. 루트 prop 역방향 대조

### A.1 binding에 없는 키 — 구현 여부는 소유 경로와 함께 판정

S2 설치 타입의 상속 prop까지 수집해 **숨김 키를 포함한** binding `accepts`와 비교했다. 기존 표에서 빠졌던 `ActionBar`·`StatusLight`·`ToggleButton`·`Disclosure`·`DropZone`도 확인했다. 아래는 자식 조립으로 확인된 `prefix`·`contextualHelp`와 공통 DOM/이벤트/함수 항목을 분리한 후보다. `role`·form 자동 완성처럼 사용자 기능에 영향이 있는 항목은 생략하지 않았다.

| 컴포넌트                                       | 루트 binding 미선언 키                                                                                                                                                                                   | 현재 코드 판정                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Text · Keyboard                                | `isHidden`                                                                                                                                                                                               | S2 prop 미선언. composition의 표시 조건과 의미·접근성 비교 필요                                            |
| StatusLight                                    | `role` (`status`)                                                                                                                                                                                        | 레퍼런스의 동적 상태 알림 기능. 점 모양 이외의 누락 후보                                                   |
| AvatarGroup                                    | `label`                                                                                                                                                                                                  | 미선언                                                                                                     |
| LabeledValue · RangeSlider                     | `contextualHelp`                                                                                                                                                                                         | 기존 16종 contextualHelp 편집 대상에 없음 (A.2)                                                            |
| Card                                           | `density` · `allowsArrowNavigation` · `focusMode` · `textValue`                                                                                                                                          | 미선언                                                                                                     |
| CardView                                       | `density` · `selectionStyle` · `disabledKeys` · `disabledBehavior` · `disallowEmptySelection` · `disallowTypeAhead` · `escapeKeyBehavior` · `shouldSelectOnPressUp` · **`orientation` · `loadingState`** | 마지막 두 키는 기존 표 누락. orientation은 상속된 컬렉션 진행 방향이며 `layout`의 grid/waterfall과 다른 축 |
| Accordion                                      | `density` · `isQuiet`                                                                                                                                                                                    | 미선언. 구조 분류와 별개                                                                                   |
| SideNav                                        | `disabledKeys` · `expandedKeys` · `defaultExpandedKeys`                                                                                                                                                  | 확장 키 둘은 문서 정의에서 추가됨 (`ruleDefinition.ts`); Property binding 미선언과 runtime 미지원은 다름   |
| Menu                                           | `disabledKeys` · `disallowEmptySelection` · `escapeKeyBehavior` · `shouldCloseOnSelect` · `shouldFocusWrap` · **`isVirtualized`**                                                                        | 가상화는 설치본 `MenuProps`에 명시. 기존 부록에서 누락                                                     |
| TextField · TextArea · SearchField             | `validationBehavior`                                                                                                                                                                                     | Form에는 존재하므로 필드별 override와 Form 상속을 구분                                                     |
| NumberField                                    | `validationBehavior` · `commitBehavior` · `incrementAriaLabel` · `decrementAriaLabel`                                                                                                                    | 미선언                                                                                                     |
| ColorSwatchPicker                              | `density` · `rounding`                                                                                                                                                                                   | 미선언                                                                                                     |
| Checkbox · Switch · CheckboxGroup · RadioGroup | `validationBehavior`                                                                                                                                                                                     | Form 상속 및 필드별 override 비교 필요                                                                     |
| Select                                         | `validationBehavior` · `disabledKeys` · `shouldCloseOnSelect` · `shouldFlip` · **`autoComplete`**                                                                                                        | `shouldFlip`은 자식 Popover에 있음; 루트 전달과 자식 편집을 구분                                           |
| ComboBox                                       | `disabledKeys` · `shouldFlip` · `shouldFocusWrap` · `formValue`                                                                                                                                          | prefix는 A.2에서 구현 확인. `defaultItems`는 컬렉션 모델 차이 (A.3)                                        |
| Form                                           | `validationErrors` · **`autoComplete` · `autoCapitalize` · `role`**                                                                                                                                      | validationErrors는 서버/동적 검증 경로와 연결해 확인 (D.3)                                                 |
| Table                                          | `disabledKeys` · `disabledBehavior` · `sortDescriptor` · `treeColumn` · `expandedKeys` · **`defaultExpandedKeys`** · `escapeKeyBehavior` · `keyboardNavigationBehavior` · `shouldSelectOnPressUp`        | sortDescriptor는 session/DOM의 정렬 경로가 있음 (A.2). 나머지는 binding 후보                               |
| GridList                                       | `disabledKeys` · `disabledBehavior` · `disallowTypeAhead` · `escapeKeyBehavior` · `keyboardNavigationBehavior` · `shouldSelectOnPressUp`                                                                 | 미선언                                                                                                     |
| Tree                                           | `disabledKeys` · `disabledBehavior` · `escapeKeyBehavior` · `keyboardNavigationBehavior` · `shouldSelectOnPressUp`                                                                                       | 미선언                                                                                                     |
| TagGroup                                       | `disabledKeys` · `selectionBehavior` · `groupActionLabel` · `escapeKeyBehavior` · `shouldSelectOnPressUp`                                                                                                | 미선언                                                                                                     |
| Calendar · RangeCalendar                       | `visibleMonths` · `selectionAlignment` · `focusedValue` · `defaultFocusedValue` · (Range) `commitBehavior`                                                                                               | visibleMonths는 현재 RAC `visibleDuration`과 대응시키는 정책 필요                                          |
| DatePicker · DateRangePicker                   | `maxVisibleMonths` · `shouldFlip` · (Range) `commitBehavior` · **(DatePicker) `autoComplete`**                                                                                                           | 자식 Popover에 shouldFlip은 있음                                                                           |
| DateField                                      | **`autoComplete`**                                                                                                                                                                                       | 기존 부록이 form/DOM 속성으로 제외했던 기능                                                                |
| Dialog                                         | `isDismissible` · `isKeyboardDismissDisabled`                                                                                                                                                            | 닫기 버튼 구조와 overlay dismiss 경로를 같이 비교해야 함                                                   |
| Popover                                        | `hideArrow` · `padding` · `isNonModal` · **`role`**                                                                                                                                                      | OverlayArrow 노드 존재와 hideArrow prop 지원은 별개                                                        |
| ContextualHelp                                 | `placement` · `offset` · `crossOffset` · `containerPadding` · `shouldFlip`                                                                                                                               | 자식 Popover에는 같은 배치 계약이 있음. 부모 편집 노출·전달의 차이                                         |

위 필터와 A.2·A.3의 제외/대응을 적용한 **추가 루트 키 후보 없음**: Separator · Badge · ProgressBar · Meter · Skeleton · Avatar · ActionBar · SelectBoxGroup · InlineAlert · ProgressCircle · IllustratedMessage · Tabs · Breadcrumbs · Link · SideNavPanel · Disclosure · Button · LinkButton · ActionButton · ActionButtonGroup · ToggleButton · ToggleButtonGroup · ButtonGroup · ColorField · ColorArea · ColorSlider · ColorWheel · ColorSwatch · Slider · SegmentedControl · DropZone · TimeField · Tooltip. 이것은 전체 기능 완료 목록이 아니다. 특히 Tabs의 역방향 후보 없음과 `Tabs.items` 정방향 D2 실패는 동시에 성립한다.

### A.2 다른 저작 경로로 구현된 항목

| S2 기능                      | 현재 코드 경로                                                                                                                                            | 상태·범위                                                                                                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefix` 5종                 | `catalog/runtime/fieldPrefix.ts`의 TextField·TextArea·NumberField·ComboBox·ColorField → `fieldPrefixCommand.ts` → control Group의 Text/Icon `slot=prefix` | 단위 65 통과. 루트 prop 누락으로 다시 구현할 대상이 아님                                                                                                                                                                           |
| `contextualHelp` 16종        | `domain/componentTraits.ts`의 `CATALOG_CONTEXTUAL_HELP_FIELDS` → `contextualHelpCommand.ts` → FieldLabel > Label + ContextualHelp                         | TextField·TextArea·NumberField·ComboBox·Select·ColorField·ColorSlider·DateField·DatePicker·DateRangePicker·TimeField·SearchField·CheckboxGroup·RadioGroup·Slider·TagGroup. 단위 48 통과. LabeledValue·RangeSlider는 이 집합에 없음 |
| Image `src`·`alt`            | `catalog/document/itemLinks.ts`의 `RULE_TYPE_PROP_CONTRACTS.Image` → `ruleTypeDefinition` → `lib:definition:type-Image`                                   | primitive binding 파일이 없어도 문서 정의가 있음. 조건부 source 배열·오류/로딩은 별도 잔여                                                                                                                                         |
| SideNav 확장 키              | `ruleDefinition.ts`의 `COLLECTION_KEY_ACCEPTS.SideNav`                                                                                                    | `expandedKeys`·`defaultExpandedKeys`가 문서 정의에는 있음. 패널 및 참조 동작의 전체 parity는 미검증                                                                                                                                |
| `aria-label`·HTML id         | `CatalogAccessibilitySection.tsx` → `setNodeAttribute` → `metadata.ariaLabel`/`htmlId` → DOM                                                              | 일반 node 대상 편집이 이미 있음. template descendant는 이 metadata 편집 대상이 아니므로 Pagination 원본 버튼 등은 별도 확인                                                                                                        |
| Table `sortDescriptor`       | `catalogPreviewSession.ts`의 sort/서버 query 경로 + `domBinding.runtime.ts`의 RAC `onSortChange`                                                          | 정렬 runtime이 존재. 루트 Property 편집 제공 여부와 구분                                                                                                                                                                           |
| collection `items`·`columns` | 자식 노드·Items slot·`dataBinding`·collection 명령                                                                                                        | S2 함수 children/Iterable을 그대로 저장하지 않는 저작 모델. Tabs는 별도로 루트 `items` 편집을 추가했으므로 출처 선언이 필요                                                                                                        |
| `dragAndDropHooks`·이벤트    | `catalogDragAndDrop.components.tsx`·`collectionDragState.ts` 및 문서 interaction 규칙                                                                     | hooks/콜백이 root accepts에 없다는 이유로 기능 없음 판정 금지. 개별 동작 커버리지는 D.3                                                                                                                                            |

### A.3 비교에서 분리한 범위

- 이벤트 `on*`, ARIA/DOM metadata, ref, `styles`·`UNSAFE_*`는 독립적인 접근성·스타일·interaction 경로와 비교한다. 루트 Property 목록을 그대로 복제하지 않는다. 단, `StatusLight.role`, `autoComplete` 등 기능상 의미가 있는 후보는 A.1에 남겼다.
- `defaultSelected`→`isSelected`, `defaultExpanded`→`isExpanded`, Select의 selection key→`value`, ComboBox input/default input 값 등은 저작 상태와 runtime override 모델의 대응을 먼저 확인한다.
- `items`·`defaultItems`·`dependencies`·함수 children은 컬렉션 모델 차이로 분리했다. 동적 추가/삭제·캐시 갱신·empty/loading·키 안정성 검증까지 생략하는 뜻은 아니다.
- `createCalendar`·`isDateUnavailable`·`validate`·`filter`·`renderValue`·`renderEmptyState`·`renderActionBar`·`getDropOperation` 등 함수 prop은 그 이름의 입력 칸을 추가하는 대상이 아니다. 대응 사용자 기능은 D.3에서 추적한다.
- `isEntering`·`UNSTABLE_focusOnEntry` 같은 overlay lifecycle, ref, microdata·hydration용 DOM 속성은 일반 저작 prop 후보에서 제외했다. `isVirtualized`·`loadingState`는 설치본 공개 prop이므로 단순 내부 상태로 제외하지 않았다.
- Button의 form/focus 10개는 §7의 명시적 결정 대기다. ActionButton은 숨김 계약으로 이미 선언돼 있다.

## 부록 B. 루트 밖 부품에서 빠졌던 확인 항목

binding과 `RULE_TYPE_PROP_CONTRACTS`를 함께 확인했다. 아래는 **편집 계약의 미선언/다른 경로 후보**이며 모든 runtime 부재를 뜻하지 않는다. 특히 `textValue` 자동 파생·isDisabled 상속·HTML `role`은 전달 경로를 추가 확인해야 한다.

| 부품                                | 누락 후보·확인할 차이                                                                               | 근거                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| MenuSection                         | `selectionMode`·`selectedKeys`·`defaultSelectedKeys`·`disallowEmptySelection`·`shouldCloseOnSelect` | `Menu.md` Section-level selection/API. 현재 `MenuSection.binding.ts` accepts는 비어 있음                      |
| MenuItem                            | `isDisabled`·`shouldCloseOnSelect`·`textValue`                                                      | rule-only 계약은 link·id·size 중심 (`itemLinks.ts`). 자동 텍스트/상속 경로와 구분                             |
| MenuTrigger                         | `shouldFlip`; `trigger=contextMenu` 옵션                                                            | 현재 options는 press·longPress. S2 설치본·`Menu.md`의 context menu 예제와 대조                                |
| TooltipTrigger                      | `shouldCloseOnPress`                                                                                | binding 미선언이며 shared `TooltipTrigger.tsx`도 전달하지 않음. Tooltip 루트 비교만으로 발견되지 않음         |
| Column                              | `menuItems`·`showDivider`·`allowsArrowNavigation`·`focusMode`·`textValue`                           | `TableView.md`와 설치본 ColumnProps. Cell의 showDivider 지원과 Column의 지원을 혼동하지 않음                  |
| Cell                                | `isSticky`·`allowsArrowNavigation`·`focusMode`·`textValue`                                          | 설치 타입에 존재. isSticky는 S2 내부 selection 열에서도 사용하므로 일반 저작 API로 제공할지 확인              |
| Row · ListBoxItem                   | `textValue`                                                                                         | 복합 자식·아이콘만 있는 항목의 텍스트 자동 파생/override 비교                                                 |
| GridListItem · TreeItem             | `hasChildItems`·`allowsArrowNavigation`·`focusMode`·`textValue`                                     | S2 ListViewItem/TreeViewItem API. Tree의 자식으로 확장을 파생하는 경로와 구분                                 |
| SideNavItem                         | `focusMode`                                                                                         | S2 SideNavItem API                                                                                            |
| Tag                                 | `label`·`textValue`                                                                                 | S2 Tag API. Tag의 자식 텍스트와 제거 버튼의 접근 가능한 이름 비교                                             |
| DisclosurePanel                     | `label`·`labelElementType`·`role`                                                                   | `Disclosure.md` API. 현재 부품 accepts 비어 있음                                                              |
| Heading · Header · Content · Footer | `isHidden`                                                                                          | S2 content primitive API. Text·Keyboard는 A.1                                                                 |
| body (Provider 대응)                | `background`·`elementType`·`locale`·`router`                                                        | Page/site/theme 설정과 별도 대응. `body.binding`에 없다는 이유로 locale/routing 전체 미지원으로 판정하지 않음 |

## 부록 C. 옵션·기본값 — 기존 D2 게이트가 증명하지 않는 범위

### C.1 선언된 enum의 빠진 값

- [ ] MenuTrigger `trigger`: S2 설치 타입의 `contextMenu`가 현재 press·longPress 목록에 없음. `Menu.md` Context menu 예제 기준으로 마우스/키보드 경로를 확인해야 함.
- [ ] ColorArea `xChannel`·`yChannel`: 설치 타입의 `alpha`가 현재 옵션에 없음. 상속 타입 허용과 실제 S2 source/Canvas 축 구현을 대조한 뒤 지원 범위를 정해야 함.
- Link·LinkButton `referrerPolicy`의 빈 문자열은 미지정 값으로 분리했으며 기능 누락으로 세지 않았다.
- 위 결과는 **명시적인 options가 있는 계약만** 비교했다. size preset, 자유 문자열·숫자 범위, 합성 prop 값의 전체 조합은 별도 검증이다.

### C.2 레퍼런스 API 표에 명시된 기본값과 binding 기본값 차이

| 컴포넌트·prop                             | S2 reference | 현재 binding | 판정                                                                 |
| ----------------------------------------- | ------------ | ------------ | -------------------------------------------------------------------- |
| Badge `variant`                           | neutral      | accent       | 설치본 `Badge.tsx` 기본 neutral도 확인. 기본 외형 차이               |
| InlineAlert `variant`                     | neutral      | informative  | 설치본 기본 neutral도 확인                                           |
| ButtonGroup `align`                       | start        | end          | 설치본 기본 start도 확인. 배치 차이                                  |
| Tree `selectionStyle`                     | checkbox     | highlight    | 설치본 `TreeView.tsx` 기본 checkbox도 확인. 선택 표시·상호작용 차이  |
| DatePicker·DateRangePicker `hideTimeZone` | false        | true         | S2는 해당 prop을 RAC에 전달. zoned 값에서 시간대 표시 차이 확인 필요 |
| Meter `value`                             | 0            | 75           | 삽입 예시값/초기 프리셋 성격일 수 있음. S2 API 기본값과 구분         |
| ProgressBar `value`                       | 0            | 50           | 삽입 예시값/초기 프리셋 성격일 수 있음. S2 API 기본값과 구분         |

**8개 컴포넌트·prop 쌍**이다 (DatePicker 두 종을 한 행으로 묶음). 명시된 기본값이 있는 API 표와 binding을 기계 대조한 결과이며, 문서에서 생략한 기본값·origin template override·기존 문서 저장값까지 일치한다는 판정은 아니다. 기존 `staticColor auto` 기본값 문제는 §8에서 해소됐다.

## 부록 D. 레퍼런스 기능 범위에서 빠졌던 항목

### D.1 팔레트 85종 밖의 S2 컴포넌트·조합

`components` 71개 문서의 기능 절·API 이름과 설치 export, catalog 문서 정의를 대조했다. 이름이 다른 조합과 새 컴포넌트를 같은 누락으로 세지 않는다. 이 목록은 §1의 85종 집계에 더하지 않는다.

| S2 reference                                                          | 현재 대응                                                                         | 남은 확인                                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ActionMenu                                                            | 별도 타입 없음. 현재 Menu origin은 MenuTrigger + ActionButton + Popover/Menu 조립 | 같은 기능 범위를 충족하는지 확인. 별도 팔레트 타입 필요 여부                                                                |
| Provider                                                              | body의 theme/form 상속 + site/page runtime                                        | locale·routing·background·elementType 대응 (B)                                                                              |
| AccordionItem/Header/Title/Panel                                      | S2 설치본이 Disclosure 계열에 위임하는 wrapper. composition은 Disclosure 조합     | Accordion 구조 일치 기록과 별개로 DisclosureHeader 잔여는 §3                                                                |
| ComboBoxItem/Section                                                  | composition은 ListBoxItem/Section 공유                                            | PickerItem 별칭 기준뿐 아니라 ComboBox 문맥의 slot/선택/스타일 대조                                                         |
| NotificationBadge                                                     | `Badge.value`와 ActionButton 부품 조합 (`9ef5e0669`)                              | 별도 타입 부재를 기능 부재로 세지 않음                                                                                      |
| DisclosureTitle·CenterBaseline·ContextualHelpPopover·Collection       | Heading/버튼·Icon wrapper·Popover·문서 collection 조립 등이 현재 대응 후보        | 래퍼 이름 동일화 대신 실제 구조/동작을 대조. CenterBaseline 불필요 노드 추가 결정은 되돌려진 상태                           |
| AlertDialog·CustomDialog·FullscreenDialog·DialogContainer·CloseButton | 별도 S2 이름의 catalog 정의 없음. 일반 Dialog/Modal·Button 조립은 존재            | 경고 버튼 의미·전체 화면·명령형 dialog·닫기 버튼 계약 비교. `Dialog.md`의 변형이 기존 체크리스트에 없었음                   |
| AssetCard·UserCard·ProductCard·CollectionCardPreview                  | 별도 catalog 정의 없음. 일반 Card/CardPreview 존재                                | `Card.md`의 asset/user/product/collection/gallery 패턴 대응                                                                 |
| ImageCoordinator·SkeletonCollection                                   | 별도 catalog 정의 없음                                                            | 이미지 묶음 공개 시점·컬렉션 loading placeholder 계약                                                                       |
| UnavailableMenuItemTrigger                                            | 별도 catalog 정의 없음                                                            | 비활성 이유 팝오버 (`Menu.md` Unavailable items)                                                                            |
| EditableCell·TableFooter                                              | 별도 catalog 정의 없음                                                            | 편집 셀·footer 행 조립 (`TableView.md`)                                                                                     |
| TreeViewLoadMoreItem                                                  | 별도 catalog 정의 없음                                                            | Tree 비동기 자식 loading/load-more 부품                                                                                     |
| ToastContainer                                                        | ToastRegion 등 알림 runtime으로 대응                                              | 앱 수준 queue·action·timeout·포커스·CSS scope 검증. 팔레트 Toast만으로 전체 완료 판정 금지                                  |
| DragPreview                                                           | 문서 drag 규칙·runtime hooks 경로는 있음                                          | 커스텀 preview 기능의 대응은 미확인                                                                                         |
| icons·illustrations                                                   | Icon은 §4.1의 명시적 적용 제외. Illustration은 별도 부품                          | S2 asset 전체 도입을 새 필수 작업으로 추정하지 않음. Components 패널 SVG 썸네일 작업은 사용자 문서 Illustration과 다른 범위 |

### D.2 Image — “대조 불가”에서 기능별 잔여로 정정

- [x] `src`·`alt`·`slot`: rule-only 계약과 문서 정의에서 확인. primitive binding 파일이 없다는 이유로 전부 미구현으로 판정하지 않는다.
- [ ] `src`의 조건부 source 배열 (`media`·`type`·`colorScheme` 등): 현재 계약은 string.
- [ ] 오류 fallback `renderError`, 로딩 skeleton, `ImageCoordinator`/`group`: 저작 조립 모델과 runtime 대응 확인.
- [ ] `crossOrigin`·`decoding`·`fetchPriority`·`loading`·`referrerPolicy`, intrinsic `width`·`height`: binding/rule-only 계약에는 없음. Canvas layout 크기와 HTML intrinsic 치수를 구분해 확인.

### D.3 공통 가이드·상태·동작의 완료 조건

아래는 기존 root prop 제외 목록 때문에 추적되지 않던 범위다. **구현 경로가 있는 것과 레퍼런스의 모든 시나리오가 검증된 것은 다르다.** 이번에는 단위 재실행한 경로만 PASS로 기록했다.

| reference                     | 현재 근거                                                             | 추가 검증 체크리스트                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `guides/forms.md`             | Form binding의 validationBehavior·HTML form 계약, 각 field의 RAC 소비 | [ ] native/aria 상속·필드 override [ ] submit/reset·서버 validationErrors·사용자 validation 규칙 [ ] 오류/도움말/required 연결                             |
| `guides/collections.md`       | 자식 노드·dataBinding·collection 명령; Tabs 동적 편집 단위 10 통과    | [ ] empty/loading/load-more·키 보존·필터·sort [ ] ref 함수 renderEmptyState의 저작 slot 대응 [ ] 각 collection의 저장/로드                                 |
| `guides/selection.md`         | selectedKeys/defaultSelectedKeys 및 session override 경로             | [ ] 단일/복수/전체 선택·disabledKeys·삭제 후 선택·controlled/uncontrolled [ ] CardView/Table/Tree의 ActionBar 자동 연동 (`renderActionBar`)                |
| `guides/dnd.md`               | `catalogDragAndDrop.components.tsx`의 useDragAndDrop·문서 규칙        | [ ] 허용 operation·on/between/root drop·재정렬·외부 파일·키보드/스크린리더·drag preview                                                                    |
| Menu·Tooltip·Dialog reference | RAC overlay/trigger 경로                                              | [ ] context menu [ ] unavailable item [ ] press/Escape/outside dismiss [ ] focus 복귀·오버레이 충돌                                                        |
| Calendar·Date/Time reference  | locale·calendarSystem·min/max·focused state 관련 계약                 | [ ] `isDateUnavailable`/`createCalendar`의 저작 규칙 대응 [ ] 날짜 범위·비연속 선택·시간대·달력 체계·주 시작일 [ ] focus와 selection 구분                  |
| Picker·ComboBox reference     | Select 값·Input·자식 ListBox·dataBinding 경로                         | [ ] `renderValue`의 선택값 표시 조립 [ ] `filter`·custom value·입력과 선택의 관계 [ ] async loading·disabled·다중 선택                                     |
| Popover·Provider reference    | 기존 overlay 배치·theme/page 설정 경로                                | [ ] `getTargetRect`/triggerRef 대신 anchor를 지정하는 저작 방식 [ ] 스크롤·화면 경계 flip [ ] locale·RTL·라우팅·Provider 상속                              |
| 컴포넌트 상태·시각            | d3 값 게이트, 기존 Canvas/Preview 경로                                | [ ] light/dark·touch·RTL·긴 텍스트·focus/disabled/invalid/pending [ ] indeterminate·selection indicator 등 motion·reduced-motion [ ] Publish의 실제 동일성 |

## 관련

- 레퍼런스 정본: [react-spectrum skill](../../../.claude/skills/react-spectrum/SKILL.md) · [로컬 문서 목록](../../../.claude/skills/react-spectrum/references/MANIFEST.md). 위 `*.md` 이름은 해당 skill의 `references/components/`, 가이드는 `references/guides/` 기준이다.
- 정본 규칙: `.claude/rules/ssot-hierarchy.md` (D1·D2·D3) · `.claude/rules/catalog-subparts.md` (부품 노드).
- 게이트: `apps/builder/src/builder/catalogRuntime/__tests__/{d2S2Alignment,d3S2Alignment}.static.test.ts` · `packages/shared/src/catalog/__tests__/componentRulesTable.static.test.ts`.
- 앞선 조사: [SPECTRUM_COVERAGE_GAP_2026-11.md](SPECTRUM_COVERAGE_GAP_2026-11.md) · [S2_PROP_ALIGNMENT_2026-10.md](S2_PROP_ALIGNMENT_2026-10.md). 과거 조사 상태를 현재 구현의 미지원 근거로 그대로 재사용하지 않는다.
