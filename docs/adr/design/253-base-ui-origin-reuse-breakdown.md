# ADR-253 breakdown — 기본 UI 원본의 재사용

> 본문: [ADR-253](../253-base-ui-origin-reuse.md) (Proposed 2026-10-06). 대안 A 기준. 줄 번호는 main `468c6d41f` 기준이며 G0 에서 다시 확인한다.

경로 약어: `S/` = `packages/shared/src/` · `D/` = `S/catalog/document/` · `X/` = `S/catalog/runtime/` · `R/` = `apps/builder/src/builder/catalogRuntime/` · `P/` = `apps/builder/src/builder/panels/` · `T` = `S/catalog/generated/componentRulesTable.ts` · `L` = `D/generated/reusableOriginLibrary.ts`

## 1. 전제 점검

1. **base / 응용**: ADR-248 (catalog 문서 모델 · library contract · 원본 override) 이 base 이고, ADR-234 · 237 ~ 241 (항목 = 원본의 instance · slot 채움) 이 같은 개념의 앞선 적용이다. ADR-253 은 그 개념을 부품 · 안에 넣는 컴포넌트 · 바탕으로 넓히는 응용이다. 253 → 248 · 234 의존.
2. **schema 직교성**: 문서 schema 변경 0 (`CATALOG_SCHEMA_VERSION` 그대로). 바뀌는 것은 library 내용 · 값 해석 순서 · `LIBRARY_CONTRACT_VERSION` 이다. Phase 5 만 library 타입 (`LibraryTemplateNode`) 확장을 요구한다 — G5 에서 따로 판정.
3. **선행 전제 검증**: ADR-248 의 「보존할 프로젝트 0 · 구 포맷 거부 · 자동 재해석 금지」 를 쓴다 — 사용자 확인 2026-10-06 「상관없다. 개발단계인데 무시해도된다」. ADR-923 Phase 5 후속의 「DOM 이 자식을 읽지 않으므로 편집을 부모로」 전제는 승계하지 않는다 — 이 ADR 이 그 원인을 없앤다. owner 가 그리는 부품 (2026-10-04 판정) 은 그대로 둔다.
4. **범위 confirm**: 사용자 `/create-adr` (2026-10-06) + 같은 날 대화의 방향 3문장 (본문 Status). Phase 4 · 5 는 이 ADR 안의 Phase 로 둔다 (사용자 확인 2026-10-06).

## 2. 인벤토리 (G0 에서 고정)

### 2-1. 부모 rule 이 부품의 모양을 정하는 곳

`T` 의 `structure.composition.delegation[]` 을 `childSelector` 로 센 것 (2026-10-06).

| 부품 selector                                    | 부모 (`T` 줄)                                                                                                                                                                                       | 모양 선언                                                                                  | 배치 선언                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| `.react-aria-Label` (11)                         | ColorField 2407 · ComboBox 3088 · DateField 3510 · DatePicker 3994 · DateRangePicker 4512 · NumberField 8247 · SearchField 9855 · Select 10502 · TextArea 13283 · TextField 13516 · TimeField 13829 | font-size · weight 600 (TextArea 는 weight 없음) · line-height (DatePicker 2종 · TextArea) | margin (값 4종 · 소비처 없음) |
| Label root 변수 채널 (4)                         | CheckboxGroup 2083 · RadioGroup 9483 · Meter 7532 · ProgressBar 8887                                                                                                                                | font-size (sm/md/lg)                                                                       | —                             |
| `.react-aria-Input` · `:is(Input, TextArea)` (5) | ColorField 2433 · ComboBox 3191 · NumberField 8340 · SearchField 9881 · TextField 13554                                                                                                             | padding · font-size · line-height · border · radius · 배경 · 상태 5종 (TextField)          | flex · min-width · max-width  |
| `.react-aria-Button` (6)                         | ComboBox 3237 · DatePicker 4185 · DateRangePicker 4716 · NumberField 8381 · SearchField 9985 · Select 10528                                                                                         | 배경 · color · border · radius · shadow · height · padding · 상태                          | position · flex · width       |
| `.react-aria-FieldError` (10)                    | ColorField 2477 · ComboBox 3289 · DateField 3653 · DatePicker 4243 · DateRangePicker 4768 · NumberField 8447 · SearchField 9918 · Select 10667 · TextField 13613 · TimeField 13978                  | font-size (SearchField 는 color 도)                                                        | margin (소비처 없음)          |
| `[slot="description"]` (13)                      | 위 10 부모 + CheckboxGroup 2143 · RadioGroup 9543 · DropZone 5489                                                                                                                                   | font-size · color fg-muted                                                                 | DropZone text-align           |
| `.react-aria-Group` (3)                          | DatePicker 4025 · DateRangePicker 4543 · NumberField 8273                                                                                                                                           | padding · border · radius · 배경 · 상태                                                    | display · gap · width         |
| `.react-aria-DateInput` (4)                      | DateField 3536 · DatePicker 4104 · DateRangePicker 4621 · TimeField 13855                                                                                                                           | padding · 배경 · border · radius · font-size                                               | display · width · min-width   |

그 밖의 출처:

- quiet 변형의 자식 모양이 `containerVariants.quiet.true.nested` 에 부모마다 9번 반복된다 (`T:2379` · `2951` · `3482` · `3928` · `4440` · `8172` · `10411` · `13488` · `13801`).
- 옆 라벨 배치가 `containerVariants["label-position"].side.nested` 에 10번 반복된다 — 배치이므로 부모에 남는다.
- `D/manualBoxRules.ts:76-84` · `:544-565` 가 CheckboxGroup · RadioGroup 의 Label 크기를 표와 따로 적는다.
- `--label-margin` · `--error-margin` 은 읽는 곳이 주석 처리돼 있다 (`S/components/styles/base.css:36` · `:42`) — 걷어낼 때 화면 변화 0.

### 2-2. 부모끼리 값이 다른 곳 — react-aria.adobe.com 레퍼런스 기준 (사용자 결정 2026-10-06)

기준 출처: `https://react-aria.adobe.com/<Component>.md` 의 Vanilla CSS 예제 (2026-10-06 조회 — Form · TextField · ColorField · SearchField · NumberField · ComboBox · Select · DateField · TimeField · DatePicker · DateRangePicker · Button). 2026-09-29 까지 저장소에 있던 스냅샷 (`279f59f95^:packages/react-aria-starter/src`) 과 대조했고 부품 값은 같다 (차이: 따옴표 표기 · Label `cursor: default` · ComboBox root 의 flex column · DatePicker Group 의 모서리 clip · FieldButton 의 오른쪽 margin).

레퍼런스의 구조: `Form` 모듈이 Label · FieldError · Description · FieldButton 을 한 번 정의한다. Input · TextArea 는 `TextField.css`, DateInput 은 `DateField.css` 한 곳이다. field 상자의 칠은 `inset` 정의 하나다. 레퍼런스는 크기가 하나 (높이 32px · 글자 14px) 이고 우리 md 에 해당한다.

| #   | 부품            | 레퍼런스                                                                                                                                                                                                                             | 지금                                                                                                                        | 처리                                                                                                                                    | 바뀌는 화면                                                                                                                                                                                                      |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Label           | 한 정의. 글자 14px · 굵기 500                                                                                                                                                                                                        | 11 부모가 따로. md 14px 로 같다. 굵기 600 (TextArea 만 미지정 — 600 폴백). line-height 는 3곳만                             | Label rule 한 정의. 크기 단계는 Label rule (`T:6801-6830`). 굵기는 레퍼런스 값 500                                                      | 전 Label 의 굵기 600→500                                                                                                                                                                                         |
| 2   | FieldError      | 한 정의. 12px — 본문 글자의 한 단계 아래                                                                                                                                                                                             | md: TextField 14 · 나머지 12. xl: DatePicker 2종 14 · ComboBox 등 16 · TextField 18. sm: ColorField · Select 10 · 나머지 12 | FieldError rule 한 정의. md = text-xs (레퍼런스와 같다). 단계 = xs 2xs · sm xs · md xs · lg sm · xl base (`T:5550-5576` + 다수 부모 값) | TextField md 14→12 · lg 16→14 · xl 18→16. ColorField · Select sm 10→12. DatePicker · DateRangePicker xl 14→16                                                                                                    |
| 3   | Description     | FieldError 와 같은 크기                                                                                                                                                                                                              | 부모의 hint-size 변수를 FieldError 와 같이 쓴다. CheckboxGroup · RadioGroup 은 12 고정                                      | FieldError 와 같은 단계. 색 `fg-muted` 는 그대로                                                                                        | 2번과 같은 부모에서 같은 변화. CheckboxGroup · RadioGroup lg 12→14                                                                                                                                               |
| 4   | field 상자의 칠 | `inset` 한 정의를 Input · TextArea · DateInput · DateRangePicker 의 Group 이 쓴다                                                                                                                                                    | Input (`base.css`) · DateInput · Group · 컨테이너가 각자 정의                                                               | 한 정의를 넷이 읽는다                                                                                                                   | 5 ~ 7 에 포함                                                                                                                                                                                                    |
| 5   | Input           | 한 정의. ColorField 는 덧붙이는 것이 없다. ComboBox = 같은 Input + 버튼 자리 padding. NumberField = 같은 Input + 버튼 쪽 모서리 0. SearchField = 같은 Input + 둥근 모서리                                                            | ColorField 만 radius-sm. ComboBox · NumberField · SearchField 는 컨테이너가 상자를 칠하고 Input 은 테두리 · 배경이 없다     | Input 이 상자를 칠한다. 부모는 명시 patch 만 (padding · 모서리). 컨테이너는 배치만                                                      | ColorField 모서리가 TextField 와 같아진다. ComboBox · NumberField · SearchField 는 상자를 칠하는 주체가 컨테이너에서 Input 으로 바뀐다 (focus 표시 위치 포함). SearchField 는 둥근 모서리                        |
| 6   | DateInput       | 한 정의 (상자). DatePicker = 같은 DateInput + 배치. DateRangePicker 는 Group 이 상자이고 DateInput 둘이 그 안에 있다                                                                                                                 | DateField · TimeField 는 DateInput 이 상자. picker 2종은 Group 이 상자                                                      | DateField · TimeField · DatePicker = DateInput 이 상자. DateRangePicker = Group 이 상자                                                 | DatePicker 의 상자를 칠하는 주체가 Group 에서 DateInput 으로 바뀐다                                                                                                                                              |
| 7   | field 안 버튼   | FieldButton 한 정의 (옅은 강조색 배경 · 작은 모서리 · 테두리 없음) 를 ComboBox · DatePicker · DateRangePicker 가 쓴다. NumberField 증감 = Button secondary. Select trigger = Button (회색). SearchField 지우기 = 작은 원형 전용 버튼 | ComboBox · NumberField · SearchField: `bg-overlay` + 그림자. DatePicker 2종: 투명 + `fg-muted`. Select: `bg-inset` + 테두리 | 레퍼런스의 구분대로                                                                                                                     | ComboBox · DatePicker 2종의 버튼이 강조색 배경이 된다. NumberField 증감이 Button secondary 모양이 된다. Select trigger 가 입력 상자 모양에서 Button secondary 모양이 된다. SearchField 지우기 버튼이 원형이 된다 |
| 8   | Group           | 공용 모양이 없다. NumberField 는 모서리 + 그림자, DatePicker 는 배치 + 모서리 clip, DateRangePicker 는 `inset`                                                                                                                       | 3 부모가 각자 상자를 칠한다                                                                                                 | 배치는 부모에 남긴다. 칠은 4번 정의                                                                                                     | 5 ~ 7 에 포함                                                                                                                                                                                                    |
| 9   | quiet 변형      | 없다 (`isQuiet` 는 RSP 에서 받은 우리 prop)                                                                                                                                                                                          | 부모마다 9번 반복                                                                                                           | 부품의 quiet 상태 한 정의. 값은 지금 값                                                                                                 | 없음                                                                                                                                                                                                             |

레퍼런스 값의 위치 (사용자 2026-10-06 「레퍼런스는 스타일 일뿐이고 default theme값일 뿐이다」): 레퍼런스 값은 부품의 기본 theme 값이다. 권위가 아니고, 사용자가 원본에서 고치면 전체가 바뀐다. 그래서 부품의 기본값은 레퍼런스 값을 그대로 쓰고 항목별 예외를 두지 않는다 (Label 굵기 500 · Select trigger 의 Button 모양 포함). 값은 우리 token 으로 적는다 — token 자체의 수치 (색 · 반경 px) 는 theme 이 정하고 이 ADR 이 바꾸지 않는다. 레퍼런스에 없는 것 (크기 xs · sm · lg · xl 단계 · quiet 변형) 은 부품 rule 의 지금 값을 쓴다.

### 2-3. 자식 노드를 그리지 않는 DOM 경로

- `X/delegatedDom.tsx` 의 `ownsChild: ownsAll` — textfield 752 · textarea 772 · numberfield 791 · searchfield 810 · datefield 837 · timefield 873 · colorfield 907 · slider 923 · progressbar 945 · meter 967 · switch 987 (그 밖에 colorswatchpicker 1516 · calendar 1597 · rangecalendar 1628 — 이 ADR 범위 밖).
- `X/domBinding.tsx:555-562` `CATALOG_DOM_CHILD_OWNING_BINDINGS` — select · combobox · datepicker · daterangepicker · table.
- 텍스트만 폴백으로 읽는 곳: `X/delegatedDom.tsx:172-185` `propagatedText` (SearchField · DateField · TimeField · ProgressBar · Meter · CheckboxGroup · RadioGroup).
- 이미 자식 노드를 그리는 선례: Dialog (`S/components/Dialog.tsx:22-57`) · Card (`X/delegatedDom.tsx:1248-1277`) · Toolbar 안 Button (`X/domBinding.tsx:485-504`).

### 2-4. 값이 내려가는 지점 (`S/catalog/resolution/resolver.ts`)

| 지점                        | 줄                     | 지금                                                                                |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| override 조회               | 507-510 `findOverride` | library 정의면 프로젝트 override 를 읽는다                                          |
| 놓인 노드                   | 620-633                | 정의 → override → prop 규칙 → typed 규칙 (부모 partRule) → 노드 값                  |
| template 자리               | 983-996                | 정의 → override (그 자리의 정의 id 기준) → template 값 → library patch → 자리표시   |
| instance 루트로 내려가는 값 | 512-533 · 680-697      | instance 가 직접 쓴 키 + 원본 `accepts` 키뿐 — **원본 override 의 스타일이 빠진다** |
| 중첩 원본                   | 1118-1164              | 깊이 제한 없이 재귀                                                                 |
| 자리표시                    | 259-274 · 534-555      | 원본 `accepts` 키만 바인딩 · 바깥 바인딩은 안쪽 원본에 닿지 않는다                  |

### 2-5. 내부 부품 판정을 읽는 곳

`S/catalog/resolvers/resolveDelegatedChildFontSize.ts` (`DELEGATED_SUBPART_CHILD_TOKENS` 115-138 · `SELF_COMPOSED_LABEL_PARENTS` 148-154 · `resolveDelegatedSubpartOwnerType` 236-251 · `resolveSubpartStyleOwnerType` 258-280) → 소비처: `R/subpart.ts:19-41` · `P/properties/catalog/CatalogPropertiesPanel.tsx:88-97` · `P/styles/catalog/catalogStylesHost.ts:787-793` · `P/styles/StylesPanel.tsx:103-117` · `apps/builder/src/services/ai/tools/updateElement.ts:26-43` · `D/rulePartRules.ts:817`. `OWNER_DRAWN_PART_OWNERS` (162-167) 는 범위 밖이다.

## 3. Phase

각 Phase 는 worktree 에서 커밋하고 Gate 통과 뒤 main 에 병합한다. Phase 2 ~ 4 는 template 과 DOM 이 같이 바뀌어야 하므로 Phase 단위로 한 번에 병합한다 (template 만 바뀌면 DOM 이 옛 방식으로 조립해 값이 어긋난다).

### Phase 0 — 인벤토리 · live 재현 (G0)

- §2 의 다섯 표를 grep 으로 다시 세고 고정.
- §2-2 를 부모 × size 5 의 px 값으로 전개해 변화 목록을 고정한다 (기준은 확정 — 레퍼런스 예제).
- live 재현 (실제 Builder): ① Components page 에서 Button 원본의 배경을 바꿈 → Toolbar 카드와 page 에 놓은 Button 이 안 바뀜 ② Select 를 놓고 Preview 에서 목록을 엶 → 항목 수 기록.
- 레퍼런스 예제를 다시 받아 §2-2 와 대조한다 (조회일 기록).
- Checkbox · Radio · Switch 안의 Label 이 field 의 Label 과 같은 원본인지 정한다. 레퍼런스에서는 다른 요소다 (Checkbox 의 글자는 `Form` 의 Label 이 아니다) — 같은 원본으로 두면 굵기 500 이 같이 적용된다.
- 대조군 준비: 전환 전 빌드를 별도 worktree 에 둔다 (G3 · G6 의 비교 기준).

### Phase 1 — 채널 수리 (G1)

- 원본 override 의 `visual` · `stateRules` 가 instance 루트 record 까지 내려가게 한다 (§2-4 「instance 루트로 내려가는 값」). 대상은 놓인 instance 와 다른 원본 template 안의 instance 둘 다.
- 값 순서를 본문 Decision 4 로 맞춘다. 배치 키 · 모양 키 목록 (G0 ③) 으로 부모 partRule 이 덮을 수 있는 범위를 정한다.
- unit: Button 원본에 padding · 배경을 쓰면 놓인 Button · Toolbar · ButtonGroup · Pagination 의 Button record 에 보인다. instance 가 직접 쓴 값은 그 위에 남는다. 원복 RED.
- 이 Phase 는 template 을 바꾸지 않는다 (contract 2 유지). 단독으로 main 에 병합할 수 있다 — 현행 결함 (F7) 의 수리이기도 하다.

### Phase 2 — 수직 절단: Label × TextField (G2)

- Label 원본 등록 (`S/catalog/componentCatalog.ts` 팔레트 밖 원본 목록 · `L` 에 정의 + template). Components page 에 Label 카드가 나온다.
- TextField template 의 `__1` (`L:3315`) 을 Label 원본의 instance 로 바꾸고 `{label}` 자리표시가 Label 텍스트로 내려가게 한다 (Label 원본이 `children` 을 받는다고 선언).
- `T:13516` TextField 의 Label delegation 에서 모양 선언을 걷어내고 Label rule 이 정하게 한다. Label 의 크기는 부모 size 를 따른다 (`D/sizePropagation.ts`).
- DOM: textfield binding 이 Label 자식을 `renderChild` 로 그린다. `S/components/TextField.tsx` 는 children 을 받으면 그대로 넘기고, 없으면 지금 방식으로 조립한다 (전환 중 다른 호출처 보호 — Phase 3 끝에 정리).
- `LIBRARY_CONTRACT_VERSION` 3 은 이 Phase 에서 올린다. 뒤 Phase 에서 template 구조가 다시 바뀌는 병합마다 한 번씩 더 올린다 (본문 Decision 9).
- 통과하지 못하면 여기서 멈추고 대안 B 로 물러난다 (본문 G2).

### Phase 3 — field 계열 전체 (G3)

- 부품 순서: Label (나머지 10 부모 + root 변수 4) → FieldError · Description → Input · DateInput → Group · Button.
- 부모마다: template 자리를 instance 로 · delegation 의 모양 선언 제거 · 달라야 하는 값은 template patch (`descendantPatches`) · DOM binding 을 자식 렌더로.
- FieldButton 원본 등록 (Button 원본의 instance + 모양 patch) — ComboBox · DatePicker · DateRangePicker 가 쓴다. NumberField 증감 · Select trigger 는 Button 원본 (secondary) 의 instance (§2-2 7번).
- 상자를 칠하는 주체를 §2-2 5 · 6번대로 옮긴다 (ComboBox · NumberField · SearchField · DatePicker). DOM 구조는 그대로이고 칠하는 요소만 바뀐다.
- quiet 변형의 반복 (§2-1) 은 부품 원본의 quiet 상태로 모은다.
- 내부 부품 판정을 텍스트 축 · 스타일 축으로 나누고 소비처 (§2-5) 를 고친다. 패널 안내는 텍스트 축에만.
- 정적 테스트: 부모 delegation 중 부품 selector 를 가진 것은 배치 키만 가진다 (허용 목록 ratchet).
- `S/components/*` 의 props 조립 폴백 정리 (호출처가 남지 않은 것만).

### Phase 4 — Select · ComboBox 안의 ListBox (G4)

- Select · ComboBox template 의 항목 자식을 ListBox 원본 instance 의 slot 채움으로 옮긴다 (`L:3852` · `L:4041`). 항목 추가 (「+」) 의 삽입 위치를 그 ListBox 로 (`S/catalog/commands/collections.ts`).
- Canvas: 닫힌 상태에서 ListBox 를 숨기는 규칙은 이미 있다 (`X/presence.ts:30`).
- DOM: select · combobox binding 이 ListBox instance 의 항목을 선택 목록으로 넘긴다 (`X/domBinding.tsx:509-543`). `S/components/Select.tsx:148-160` 의 `items` 경로는 데이터 바인딩용으로 남는다.
- Menu (루트가 Menu 이고 항목이 직접 자식) 는 이미 slot 형태라 대상이 아니다.

### Phase 5 — 바탕 사슬 (G5 통과 시)

- library template 이 「원본의 instance + slot 채움」 을 표현하도록 `LibraryTemplateNode` 를 넓힌다 (`D/types.ts:661-680` · 검증 `D/library.ts:276-330` · 해석 `resolver.ts:942-944` · `1182-1233`).
- 공용 바탕 원본 (제목 · 내용 · 버튼 줄 slot) 을 정하고 Dialog · Popover 를 그 instance 로 다시 적는다 (`L:5205` · `L:5322`). Card 와 합칠지는 G5 에서 정한다 — Card 는 Preview · Header · Content · Footer 네 영역이라 모양이 다르다.
- Modal 원본 (`LEGACY_ONLY_REUSABLE_ORIGIN_TYPES`) 은 건드리지 않는다.

### Phase 6 — 정리

- `.claude/rules/ssot-hierarchy.md` 의 「D3 read-only sub-part」 절 · `docs/adr/evidence/923-phase5-followup-subpart-extension.md` 에 이 ADR 표기.
- G3 승인 기록 (`apps/builder/tests/adr248-g3/approvedDifferences.ts`) 을 새 구조로.
- CHANGELOG · README.

## 4. 검증

- **unit**: 값 순서 표 · override 전파 (놓인 instance · 중첩 instance) · 자리표시 전달 · library 검증 · contract 2 거부. 각 Gate 의 핵심 행은 원복 RED 로 확인한다 (편집 역적용 — `git checkout` 금지).
- **DOM 구조 대조**: 전환 전 빌드와 전환 후 빌드에서 같은 문서를 Preview 로 열어 부모 root 아래의 요소 · class · ARIA 속성 · 순서를 비교한다. 조합: 부모 × size 5 × labelPosition 2 × (기본 · invalid · description 있음 · label 없음 · required).
- **시각**: ADR-248 G3 하니스 (`paletteBaseCanvas` · `propAxisCanvasDom`) 전 case. 승인 차이는 G0 목록과 같아야 한다.
- **성능**: `pnpm gate:perf-ratchet` · `pnpm perf:baseline -- --lane frame --fixed-inputs --call-counts` 로 `scene.build` Δ (전환 전 빌드와 교대 3쌍). 불리한 경우 = field 가 많은 Form 을 반복한 600 요소 seed.
- **live** (실제 Builder + Preview): Components page 에서 Label 굵기 · Input 테두리 · Button 반경을 고친다 → page 의 TextField · Select · NumberField · Toolbar 가 Builder 와 Preview 에서 같이 바뀐다 → undo 로 돌아온다.

## 5. 사용자 확인 기록 (2026-10-06)

1. 범위: 「지금은 한 ADR 안에 단계로 두어도 문제가 발생하지 않는다면 그대로 진행」 — Phase 4 · 5 를 이 ADR 에 둔다.
2. 값 차이: 「RAC 레퍼런스 값 기준으로」 · 「RAC starter 보다 https://react-aria.adobe.com 레퍼런스 사이트에서」 — §2-2.
3. contract 2 프로젝트 거부: 「상관없다. 개발단계인데 무시해도된다」.
4. 레퍼런스 값의 위치: 「레퍼런스는 스타일 일뿐이고 default theme값일 뿐이다」 — 기본값으로 그대로 쓰고 항목별 예외를 두지 않는다 (§2-2 아래 단락).

## 6. 실행 기록

(착수 뒤 기재)
