# ADR-308 breakdown — 선택은 그룹이 저장한다

> 본문: [ADR-308](../308-group-owned-selection-item-ids.md). 이 문서는 구현 순서 · 파일 · 검증을 담는다. 줄 번호는 main `ea02e5f33` 기준이고 Phase 0 에서 다시 잰다.

## 1. 범위

- **안**: 선택 (`selectedKey` · `selectedKeys` · `value`) 과 펼침 (`expandedKeys`) 의 저장 자리 · 항목 key · 그것을 읽는 Canvas · DOM · dispatcher · 패널 · Code 보기 · Library 원본 · 넣기 명령.
- **밖**: 단독 ToggleButton · Checkbox · Switch · Card 의 `isSelected` · Disclosure 단독 `isExpanded` · 열림 (`isOpen`) · 날짜 계열의 값 칸 (`date` 칸 종류 — 이 ADR 과 독립, 같은 날 사용자가 따로 요청) · 데이터 행 선택의 Preview 실행 상태 (ADR-280 그대로).
- fork 4 질문: 해당 없음 (분리가 아닌 새 결정 — 본문 Status).

## 2. 그룹 × 속성 × 항목 key (G0 에서 설치 타입으로 확정)

| 그룹              | 저장 속성 (패널에 보임) | 받기만 하는 쌍둥이    | 항목 · key                   | 지금 저장 자리                     |
| ----------------- | ----------------------- | --------------------- | ---------------------------- | ---------------------------------- |
| Tabs              | `defaultSelectedKey`    | `selectedKey`         | Tab `id` (TabPanel `itemId`) | Tab `isSelected`                   |
| SegmentedControl  | `defaultSelectedKey`    | `selectedKey`         | SegmentedControlItem `id`    | 그룹 (완료)                        |
| ComboBox          | `defaultSelectedKey`    | `selectedKey`         | ListBoxItem `id`             | ListBoxItem `isSelected`           |
| Select            | `value` (S2 Picker)     | `defaultValue`        | ListBoxItem `id`             | ListBoxItem `isSelected`           |
| ListBox           | `defaultSelectedKeys`   | `selectedKeys`        | ListBoxItem `id`             | ListBoxItem `isSelected`           |
| GridList          | `defaultSelectedKeys`   | `selectedKeys`        | GridListItem `id`            | GridListItem `isSelected`          |
| Table             | `defaultSelectedKeys`   | `selectedKeys`        | Row `id`                     | Row `isSelected`                   |
| Tree              | `defaultSelectedKeys`   | `selectedKeys`        | TreeItem `id`                | TreeItem `isSelected`              |
| TagGroup          | `defaultSelectedKeys`   | `selectedKeys`        | Tag `id`                     | Tag `isSelected`                   |
| Menu              | `defaultSelectedKeys`   | `selectedKeys`        | MenuItem `id`                | MenuItem `isSelected`              |
| CardView          | `defaultSelectedKeys`   | `selectedKeys`        | Card `id`                    | Card `isSelected`                  |
| ToggleButtonGroup | `defaultSelectedKeys`   | `selectedKeys`        | ToggleButton `id`            | ToggleButton `isSelected`          |
| SelectBoxGroup    | `defaultSelectedKeys`   | `selectedKeys`        | SelectBox `id`               | 그룹 우선 + SelectBox `isSelected` |
| RadioGroup        | `value`                 | `defaultValue`        | Radio `value`                | 양쪽 (Radio `isSelected` 가 이김)  |
| CheckboxGroup     | `value` (배열)          | `defaultValue`        | Checkbox `value`             | Checkbox `isSelected`              |
| Tree · Table      | `expandedKeys` (펼침)   | `defaultExpandedKeys` | TreeItem · Row `id`          | Tree 는 그룹 (`treeItemKey`)       |
| Accordion         | `expandedKeys` (펼침)   | `defaultExpandedKeys` | Disclosure `id`              | Disclosure `isExpanded` 집계 (F21) |

- 「저장 속성」 의 선택 (default 쪽 · controlled 쪽) 은 가족의 기존 관례다 — 빌더에서는 둘 다 「처음 상태」 로만 쓰이므로 (ADR-280: Preview 는 첫 render 부터 controlled 로 넘긴다) 한 칸만 낸다 (`ea02e5f33` 「한 개념 한 칸」).
- Select 의 `value` 는 S2 Picker 표면이다. 설치 RAC `Select` 의 이름과 다르면 binding 의 `toRacProps` 가 옮긴다 — G0 에서 설치 타입으로 확인.

## 3. Phase

### Phase 0 — 인벤토리 · 기준선 (동작 변화 0)

1. TS checker 로 설치 `@react-spectrum/s2` · `react-aria-components` 타입에서 §2 표를 다시 뽑는다 (`d2S2Alignment.static.test.ts` 의 방식). 다르면 §2 를 고친다.
2. 항목 `isSelected` 읽기 · 쓰기 자리 목록 확정 (§4 — 조사 결과를 줄 단위로 다시 대조).
3. 정적 항목과 데이터 행이 섞인 그룹의 현행 key 동작 기록 (R4).
4. Table 펼침의 현행 저장 자리 확인 (Accordion 은 판독 round 1 로 확인 — 자식 `isExpanded` 집계, F21).
5. key 출처 대조 (F19): 그룹 DOM 이 RAC 에 넘기는 항목 `id` 와 항목 key 목록을 그룹 16 type 마다 표로 — `resolveStaticItemKey` 가 아닌 출처 (HTML id · record id) 를 전부 찾는다.
6. 번들 기준선 (`pnpm perf:build-dist` → initial gzip) 기록.

- G0: 본문 Gates.

### Phase 1 — 항목 key 보장 · 그룹이 속성을 받는다 (동작 변화 0)

| 파일                                                                                                                                                                  | 변경                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`                                                                                             | Tabs (Tab `id` + TabPanel `itemId`) · TagGroup · Menu · ToggleButtonGroup · CardView · Accordion 의 template 항목에 작성 `id`                                                                                                                                                              |
| `packages/shared/src/catalog/document/selectionCompositesOrigins.ts`                                                                                                  | 변경 없음 (SelectBox 는 `id` 있음) — 확인만                                                                                                                                                                                                                                                |
| `packages/shared/src/catalog/bindings/{ListBox,GridList,Table,Tree,TagGroup,Menu,CardView,ToggleButtonGroup,ComboBox,Select,CheckboxGroup,Tabs,Accordion}.binding.ts` | §2 의 속성을 `accepts` 에 (`section: "value"`, 이 Phase 에서는 `editorHidden`)                                                                                                                                                                                                             |
| 항목 binding (`Tab` · `Tag` · `Card` · `ToggleButton` · `MenuItem` · `Row` …)                                                                                         | `id` 를 받지 않는 항목에 `id` 계약 (`editorHidden` — 사용자 결정 2 는 Phase 2)                                                                                                                                                                                                             |
| `packages/shared/src/catalog/document/ruleDefinition.ts`                                                                                                              | `staticCollectionItem` 밖의 항목 (ToggleButton · Card) 이 `id` 를 받게                                                                                                                                                                                                                     |
| `packages/shared/src/catalog/commands/collections.ts` `insertGroupItem`                                                                                               | 그룹 안 ToggleButton 에 `id`, Radio · Checkbox 에 겹치지 않는 `value`                                                                                                                                                                                                                      |
| `packages/shared/src/catalog/commands/collections.ts` `catalogCopiesWithFreshKeys` (`:209-301`) · `KEYED_TYPES` · `KEY_HOST_TYPES`                                    | 충돌 개명을 `COLLECTION_FAMILIES` 밖의 선택 · 펼침 그룹 (CardView · Table · ToggleButtonGroup · Accordion · SegmentedControl) 과 그룹 안 Radio · Checkbox 의 `value` 로 넓힌다 (Decision 7 · R4). 원본 항목에 id 를 넣는 것과 같은 커밋 — 넣고 나면 같은 그룹 안 복제가 중복 key 를 만든다 |
| 새 정적 테스트 `selectionItemKeys.static.test.ts`                                                                                                                     | 선택 · 펼침 그룹의 Library 원본 항목이 모두 key 를 갖고 그룹 안에서 겹치지 않는다. 새 명령 테스트: 16 가족에서 같은 그룹 안 복제 · 붙여넣기 뒤 key 중복 0 (G1 b)                                                                                                                           |

- 읽는 쪽은 그대로 — 그룹 값은 여전히 항목에서 모은다. 그래서 선택 동작 변화 0. 바뀌는 것은 복제 · 붙여넣기의 key 개명 범위뿐 (중복 key 를 막는 수리).
- Library template 의 prop 추가는 주소를 바꾸지 않는다 (계약 번호 무관 — Phase 0 에서 `adr282` 계열 테스트로 확인).
- G1: 본문 Gates.

### Phase 2 — 전환 (읽기 · 쓰기 한 커밋)

**판정 함수** (새 파일 `packages/shared/src/catalog/runtime/groupSelection.ts`):

- `catalogGroupSelection(owner, get, typeOf)` → 그룹의 선택 값 (key 배열 · `"all"` · 단일 key · `null`). 순서: controlled 속성 → default 속성 → 그룹 종류의 RAC 기본.
- `catalogItemKey(item)` → 작성 `id` (Radio · Checkbox 는 `value`), 없으면 지금의 대체값 (`resolveStaticItemKey`). **key 의 유일한 출처** — DOM 이 RAC 에 넘기는 항목 `id`, 그룹 DOM 의 항목 key 목록 · remount key, Canvas 판정, 상태 frame 의 선택 검사가 모두 이 함수다 (Decision 1 · R9). Row 의 HTML id 는 key 가 아니다.
- `catalogGroupExpansion(owner, …)` · `catalogItemExpanded(item, …)` → 펼침 (Tree · Table · Accordion) 의 같은 짝. Accordion 은 단일 펼침이면 그룹 값의 첫 key (RAC `useDisclosureGroupState` 와 같게).
- `catalogItemSelected(item, get, typeOf)` → 가장 가까운 그룹의 값에 이 항목 key 가 있는가.
- `segmentedSelection.ts` · `selectBoxSelection.ts` · `catalogTabsSelection` 의 선택 부분 · `pickerSelection.ts` · `utils/accordionExpansion.ts` 는 이 함수로 합친다.

| 층         | 파일                                                                                                                                                                                                                                                                                                                               | 변경                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| runtime    | `runtime/delegatedDom.runtime.ts` `catalogStateSourceValue` (`:4124-4273`) · `catalogCollectionSelectedKeys` (`:547-577`)                                                                                                                                                                                                          | 항목 집계 가지 → `catalogGroupSelection`                                                                                                                                      |
| runtime    | `document/collectionItems.ts` `catalogItemStartsSelected` (`:88-97`)                                                                                                                                                                                                                                                               | 삭제 (호출자를 판정 함수로)                                                                                                                                                   |
| Canvas     | `runtime/presence.ts` `catalogCollectionItemSelected` (`:514-549`) · Table select-all (`:662-676`) · `catalogRadioGroupValue` (`:3910-3920`) · `catalogStateValue` `isSelected` (`:3954-3974`)                                                                                                                                     | `catalogItemSelected`. 그룹 안 Checkbox · ToggleButton 의 그룹 조회 추가                                                                                                      |
| Canvas     | `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` (`:1038-1039`) · `runtime/compositionRoot.ts` 의존 전파                                                                                                                                                                                                                 | 그룹의 선택 속성 변경 → 그 그룹의 항목 dirty (R2)                                                                                                                             |
| DOM        | `runtime/delegatedDom.runtime.ts` 그룹 렌더 (tabs `:1776` · selectboxgroup `:1906` · listbox `:2018` · checkboxgroup `:3108` · radiogroup `:3160` · togglebuttongroup `:3326` · cardview `:3550`) · `domBinding.runtime.ts` Table (`:2930`) · `delegatedDom.components.tsx` TagGroupRun (`:264`) · `GroupToggleFrame` (`:112-134`) | 시작 값은 runtime state 그대로 (출처만 그룹), 항목 prop fallback 삭제, 선택 때문에 둔 `watchesChildren` 삭제                                                                  |
| key 출처   | `runtime/domBinding.runtime.ts` Row (`:3030-3036`) · `withHtmlId` (`:4576-4586`) · `runtime/delegatedDom.runtime.ts` 항목 key 목록 (`:592-600`) · 그룹 안 ToggleButton (`:3232-3238`) · Accordion Disclosure key · `id` (`:3694-3699`) · `runtime/delegatedDom.components.tsx` `GroupToggleFrame` (`:124-132`)                     | 전부 `catalogItemKey`. `withHtmlId` 는 선택 그룹의 항목 (Row 포함) 에 `id` 를 덮지 않는다. 상태 frame 식별자 (record id) 는 key 와 따로 (R9)                                  |
| DOM 펼침   | `runtime/delegatedDom.runtime.ts` Accordion 렌더 (`:3694-3778`) · `runtime/presence.ts` `catalogDisclosureExpanded` (`:245-252`)                                                                                                                                                                                                   | 그룹 `expandedKeys` 를 읽고, 클릭은 그룹 runtime 값에만 쓴다 (자식 `isExpanded` 쓰기 삭제)                                                                                    |
| dispatcher | `runtime/catalogPreviewInteractions.ts` `stateOwnerOf` (`:617-625`) · `packages/shared/src/interactions/dispatcher.ts` (`:781` 수신자 · `:829-832` 쓰기)                                                                                                                                                                           | 그룹 안 항목 대상 선택 · 펼침 Do 는 수신자 = 그룹, 값 = 항목 boolean → 그룹 값의 그 key 넣기 · 빼기 (단일은 교체). 수신자만 바꾸면 그룹에 `isSelected` 가 기록된다 (F20 · R5) |
| Builder    | `apps/builder/src/builder/catalogRuntime/singleSelection.ts`                                                                                                                                                                                                                                                                       | 「항목에 대신 쓰기 · 다른 항목 끄기」 삭제. 남는 것: 그룹 칸의 선택지 읽기 (`catalogTabsSelectedTab` → 일반화)                                                                |
| Builder    | `panels/properties/catalog/CatalogPropertiesPanel.components.tsx` (`:335-374,414-454`) · `catalogFieldValueSource.ts`                                                                                                                                                                                                              | 그룹 칸은 그룹 prop 을 그대로 쓴다. 항목 `id` 를 고치면 같은 명령에서 그룹 선택 · 펼침 값의 key 와 짝 TabPanel `itemId` 를 따라 고친다 (Decision 7 · R10)                     |
| Builder    | `panels/properties/generic/GenericFieldRenderer.tsx`                                                                                                                                                                                                                                                                               | 칸 종류: 단일 = 항목 드롭다운, 다중 = 항목 체크 목록 (`selection-keys` 확장 — 사용자 결정 3)                                                                                  |
| Builder    | `catalogRuntime/viewAuthoring.ts` (`:604-672`) · `ownerDecidedProps.ts` (`:56,116-119`)                                                                                                                                                                                                                                            | 필터 자동 생성 항목의 선택 → 그룹 값                                                                                                                                          |
| 명령       | `commands/materialize.ts` `withDisplayState` (`:820-838`) · `:252-259`                                                                                                                                                                                                                                                             | 표시 상태 `selected` 는 Components page 표본 전용으로 남기고 그룹 선택으로 쓰지 않는다                                                                                        |
| 명령       | `commands/collections.ts` `catalogCopiesWithFreshKeys` · 항목 삭제                                                                                                                                                                                                                                                                 | 개명 · 삭제된 key 를 그룹 선택 · 펼침 값에서 같이 정리                                                                                                                        |
| 원본       | `document/selectionCompositesOrigins.ts` (`:225-233`)                                                                                                                                                                                                                                                                              | SelectBoxGroup `__one` 의 `isSelected: true` → 그룹 `defaultSelectedKeys: ["one"]`                                                                                            |
| binding    | 그룹 binding 12                                                                                                                                                                                                                                                                                                                    | Phase 1 의 `editorHidden` 해제 (저장 속성만). 항목의 Selected 는 `editorHidden`                                                                                               |

- 테스트 (판독 round 1 추가): `groupSelectionDispatch.test.ts` (G2 e — 항목 대상 Do 행렬) · `tabIdRename.test.ts` (G2 f) · G2 a 행렬에 HTML id 를 단 Row · 그룹 안 ToggleButton · Accordion 단일 펼침 (`expandedKeys=["second"]`).
- 테스트: `singleSelection.test.tsx` · `collectionItemSelection.test.tsx` · `tagGroupSelection.test.tsx` · `groupCheckboxValueDom.test.ts` · `phase3Presence.test.ts` · `adr256ShowWhen.test.tsx` · `selectPicker.test.tsx` · `ownerDecidedProps.test.ts` · `adr256GroupWrappedToggles.test.tsx` · `catalogPreviewSession.test.tsx` · `selectionCompositesRuntime.test.tsx` · `adr280Phase0.test.ts` · `selectionBindings.test.ts` — 저장 자리를 그룹으로 고쳐 쓴다. 새 테스트 `groupSelection.test.ts` (G2 a 행렬) · `groupSelectionIncremental.test.ts` (G2 b) · `groupSelection.static.test.ts` (G2 c).
- 원복 RED: 판정 함수를 항목 prop 읽기로 되돌림 · dirty 확장 제거 · dispatcher 값 변환 제거 (수신자만 변경) · Row 에 `withHtmlId` 덮기 복원 · TabPanel `itemId` 갱신 제거 — 각각 새 테스트가 실패하는지.
- live (G2 d): Tabs · ListBox (다중) · Select · CheckboxGroup · ToggleButtonGroup · Tree (선택 + 펼침) · Accordion · HTML id 를 단 Row 의 Table — 패널에서 고름 → Canvas → Preview → 새로고침.
- 사용자 결정 2 · 3 · 4 를 이 Phase 착수 때 묻는다.

### Phase 3 — 삭제 · 정리

| 파일                                                                              | 변경                                                                                          |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `document/itemLinks.ts` `ITEM_SELECTED_PROP_CONTRACT` · 항목 binding 8            | 계약 삭제. `d2Provenance.ts` 의 해당 항목 삭제                                                |
| `bindings/{ToggleButton,Checkbox,Radio,Card}.binding.ts`                          | 단독 state 로만 남긴다 (Radio 는 삭제 — RAC Radio 에 `isSelected` 없음)                       |
| `interactions/referenceCapabilities.ts` `OWNER_STATE_PROPS` (`:54-63`)            | 항목 `isSelected` 숨김 목록 정리                                                              |
| `codeView/generate.ts` (`:3311-3312`) · `codeViewEdit.ts` (`:1846-1873`)          | 항목 type 은 HTML id 를 `id=` 로 내지 않는다 (R6). 그룹 값 · 항목 `id` 왕복                   |
| `document/types.ts` 계약 번호                                                     | 사용자 결정 1 (a) 면 올린다 (ADR-306 과 순서 조정)                                            |
| `catalog/__tests__/propSectionConsistency.test.ts`                                | 「선택은 그룹의 Value」 검사 추가, 항목 `isSelected` 는 단독 state type 만                    |
| `docs/CHANGELOG.md` · `.claude/rules/state-management.md` · `catalog-subparts.md` | 저장 자리 · 옛 문서 처리 · 판정 함수 기록. 낡은 서술 (항목 Selected · `singleSelection`) 정리 |

- `pnpm docs:stale-symbols` (삭제 · 개명 뒤).
- G3: 본문 Gates. live 는 새 프로젝트에서 (Library page 는 처음 열 때 저장된다 — 메모리 `reference-library-page-persisted-card-code-change-needs-new-project`).

## 4. 항목 `isSelected` 읽기 · 쓰기 자리 (2026-11-12 조사, Phase 0 에서 재대조)

- **읽기 — runtime**: `runtime/delegatedDom.runtime.ts:4150-4161,4163-4194,4229-4238,4250-4268` · `:547-577` · `document/collectionItems.ts:88-97` · `runtime/pickerSelection.ts:71-85`
- **읽기 — Canvas**: `runtime/presence.ts:487,514-549,662-676,3910-3920,3954-3974` · `runtime/rulePaint.ts:304,322-330` (owner 파생 `_isSelected` 가 덮는 구조는 유지)
- **읽기 — DOM**: `runtime/delegatedDom.components.tsx:112-134` (fallback) · `packages/shared/src/components/SelectBoxGroup.tsx:74-98` (Library 전용 — catalog Preview 는 안 씀, 확인만)
- **쓰기**: `apps/builder/src/builder/catalogRuntime/singleSelection.ts:40-62,260-315` · `viewAuthoring.ts:604-672` · `commands/collections.ts` `insertGroupItem` (형제 `isSelected` 지우기) · `commands/materialize.ts:252-259,820-838` · `document/selectionCompositesOrigins.ts:61,68,231`
- **key 출처 (판독 round 1)**: `runtime/delegatedDom.runtime.ts:592-600,3232-3238,3694-3699` · `runtime/domBinding.runtime.ts:3030-3036,4576-4586` · `runtime/delegatedDom.components.tsx:124-132`
- **펼침 (판독 round 1)**: 읽기 `runtime/presence.ts:245-252` → `utils/accordionExpansion.ts:41-70` · 쓰기 `runtime/delegatedDom.runtime.ts:3772-3778`
- **Do**: `interactions/dispatcher.ts:781,829-832` · `interactions/concepts/toggle.ts:20-25` · `runtime/catalogPreviewInteractions.ts:617-625`
- **계약**: `document/itemLinks.ts:43-47,91` · binding 12 (본문 F5)
- **남는 것 (단독 state)**: Switch `delegatedDom.runtime.ts:2898-2908` · Checkbox `:3029-3063` · ToggleButton `:3195-3207` · Card `:3496` · 그룹 밖 Radio host `:2953`

## 5. 추정

- 소스 ≈ 50 파일 (Phase 1 ≈ 20 · Phase 2 ≈ 25 · Phase 3 ≈ 12, 겹침 있음) · 테스트 ≈ 19 파일 (고침 13 + 새 5 ~ 6). 판독 round 1 로 Phase 1 +2 (Accordion binding · 개명 범위) · Phase 2 +5 (key 출처 · Accordion 펼침 · dispatcher).
- 추정과 실측이 1.5 배 이상 벌어지면 Phase 0 인벤토리를 고쳐 흡수한다 (새 ADR 사유 아님 — `adr-writing.md` M3).
