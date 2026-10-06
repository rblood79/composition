# ADR-253 breakdown — 기본 UI 원본의 재사용

> 본문: [ADR-253](../253-base-ui-origin-reuse.md) (Proposed 2026-10-06). 대안 A 기준. 줄 번호는 main `468c6d41f` 기준이며 G0 에서 다시 확인한다.

경로 약어: `S/` = `packages/shared/src/` · `D/` = `S/catalog/document/` · `X/` = `S/catalog/runtime/` · `R/` = `apps/builder/src/builder/catalogRuntime/` · `P/` = `apps/builder/src/builder/panels/` · `T` = `S/catalog/generated/componentRulesTable.ts` · `L` = `D/generated/reusableOriginLibrary.ts`

## 1. 전제 점검

1. **base / 응용**: ADR-248 (catalog 문서 모델 · library contract · 원본 override) 이 base 이고, ADR-234 · 237 ~ 241 (항목 = 원본의 instance · slot 채움) 이 같은 개념의 앞선 적용이다. ADR-253 은 그 개념을 부품 · 안에 넣는 컴포넌트 · 바탕으로 넓히는 응용이다. 253 → 248 · 234 의존.
2. **schema 직교성**: 문서 schema 변경 0 (`CATALOG_SCHEMA_VERSION` 그대로). 바뀌는 것은 library 내용 · 값 해석 순서 · `LIBRARY_CONTRACT_VERSION` 이다. Phase 4 가 library 타입 (`LibraryTemplateNode`) 에 slot 채움 표현을 더하고 Phase 5 가 그것을 쓴다 (리뷰 round 1 h1).
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
- 상태별 값은 기본 스타일과 길이 다르다. 지금은 template 루트를 투영한 뒤에 바깥 노드에만 적용한다 (`resolver.ts:681` 전달 → `:710` 상태 적용, 중첩 경로 `:1135` · `:1234` 도 같은 순서). 그래서 키 전달만 늘려서는 닿지 않는다 — 원본 override 의 상태별 값을 template 루트 · 중첩 루트의 상태 적용 단계에 넣는다. 우선순위: 원본 정의의 상태 규칙 → 원본 override 의 상태별 값 → instance 가 쓴 상태별 값.
- 값 순서를 본문 Decision 4 로 맞춘다. 배치 키 · 모양 키 목록 (G0 ③) 으로 부모 partRule 이 덮을 수 있는 범위를 정한다.
- unit: Button 원본에 padding · 배경을 쓰면 놓인 Button · Toolbar · ButtonGroup · Pagination 의 Button record 에 보인다. instance 가 직접 쓴 값은 그 위에 남는다. 원복 RED.
- unit (상태): Button 원본의 hover · pressed · disabled 값을 고친 뒤 그 상태로 해석하면 **그려지는 template 루트** 가 새 값을 갖는다 (리뷰 반례: hover fill 을 `#123456` 으로 써도 루트는 `#c3c3c3` 그대로). 놓인 instance · 중첩 instance · instance 가 같은 상태 값을 쓴 경우 셋 다. 원복 RED.
- live: Preview 에서 실제 hover · press 한 Button 의 computed style 이 원본 편집을 따른다.
- 이 Phase 는 template 을 바꾸지 않는다 (contract 2 유지). 단독으로 main 에 병합할 수 있다 — 현행 결함 (F7) 의 수리이기도 하다.

### Phase 2 — 수직 절단: Label × TextField (G2)

- Label 원본 등록 (`S/catalog/componentCatalog.ts` 팔레트 밖 원본 목록 · `L` 에 정의 + template). Components page 에 Label 카드가 나온다.
- TextField template 의 `__1` (`L:3315`) 을 Label 원본의 instance 로 바꾸고 `{label}` 자리표시가 Label 텍스트로 내려가게 한다 (Label 원본이 `children` 을 받는다고 선언).
- `T:13516` TextField 의 Label delegation 에서 모양 선언을 걷어내고 Label rule 이 정하게 한다. Label 의 크기는 부모 size 를 따른다 (`D/sizePropagation.ts`).
- DOM: textfield binding 이 Label 자식을 `renderChild` 로 그린다. Label 은 RAC `Label` 로 그려 TextField 의 context (`id` · `htmlFor`) 를 받는다. `S/components/TextField.tsx` 는 children 을 받으면 그대로 넘기고, 없으면 지금 방식으로 조립한다 (전환 중 다른 호출처 보호 — Phase 3 끝에 정리).
- `LIBRARY_CONTRACT_VERSION` 3 은 이 Phase 에서 올린다. 뒤 Phase 에서 template 구조가 다시 바뀌는 병합마다 한 번씩 더 올린다 (본문 Decision 9).
- 통과하지 못하면 여기서 멈추고 대안 B 로 물러난다 (본문 G2).

### Phase 3 — field 계열 전체 (G3)

- 부품 순서: Label (나머지 10 부모 + root 변수 4) → FieldError · Description → Input · DateInput → Group · Button.
- 부모마다: template 자리를 instance 로 · delegation 의 모양 선언 제거 · 달라야 하는 값은 template patch (`descendantPatches`) · DOM binding 을 자식 렌더로.
- 부품은 RAC 컴포넌트로 그려 부모의 context 를 받는다 (본문 Decision 5 ① ~ ④, 리뷰 round 1 h2 · m1):
  - FieldError binding (`X/domBinding.tsx:473` — 지금은 `span role="alert"`) 을 field 안에서는 RAC `FieldError` 로 바꾼다. 부모 `errorMessage` 는 그 children 으로 넘긴다. 표시 여부는 RAC 의 validation 상태가 정한다.
  - Button binding (`X/domBinding.tsx:485-504`) 이 `slot` 을 넘기고, `isDisabled` · `autoFocus` 는 문서가 쓴 값일 때만 넘긴다. Button 원본 기본값 `isDisabled: false` (`L:2981`) 는 「쓰지 않음」 으로 다룬다.
  - RAC 가 이름을 정한 slot 은 template 자리에 적는다: NumberField 증감 = `decrement` · `increment` (`S/components/NumberField.tsx:93`), DateRangePicker DateInput = `start` · `end`. Select · ComboBox · DatePicker 의 버튼과 SearchField 의 지우기 버튼은 RAC 가 context 로 연결하므로 slot 이름이 없다.
  - `slot` 은 Button · DateInput 정의가 받는 내부 운반 값이다 (편집 surface 에 내지 않음).
- FieldButton 원본 등록 (Button 원본의 instance + 모양 patch) — ComboBox · DatePicker · DateRangePicker 가 쓴다. NumberField 증감 · Select trigger 는 Button 원본 (secondary) 의 instance (§2-2 7번).
- 상자를 칠하는 주체를 §2-2 5 · 6번대로 옮긴다 (ComboBox · NumberField · SearchField · DatePicker). DOM 구조는 그대로이고 칠하는 요소만 바뀐다.
- quiet 변형의 반복 (§2-1) 은 부품 원본의 quiet 상태로 모은다.
- 내부 부품 판정을 텍스트 축 · 스타일 축으로 나누고 소비처 (§2-5) 를 고친다. 패널 안내는 텍스트 축에만.
- 정적 테스트: 부모 delegation 중 부품 selector 를 가진 것은 배치 키만 가진다 (허용 목록 ratchet).
- `S/components/*` 의 props 조립 폴백 정리 (호출처가 남지 않은 것만).

### Phase 4 — Select · ComboBox 안의 ListBox (G4)

- **선행 — library 의 slot 채움 표현** (리뷰 round 1 h1): template 노드가 「원본의 instance + 그 원본 template 의 slot 자리를 채우는 항목 목록」 을 가질 수 있게 `LibraryTemplateNode` 를 넓힌다 (`D/types.ts:661-680` · 검증 `D/library.ts:276-330` · 해석 `resolver.ts:1118-1164` · `:1182-1233`). 지금 `children` 으로 적으면 ListBox 의 기본 항목 3개가 루트 안에 남고 Select 의 항목 4개는 루트 밖에 붙는다. unit: ListBox 루트 안 = Select 의 항목 4개 · 루트 밖 항목 0 · ListBox 기본 항목 0. 프로젝트 쪽의 `fillSlot` (`resolver.ts:1223-1233`) 과 같은 뜻이어야 한다 — instance 가 다시 채우면 library 의 채움을 대신한다.
- Select · ComboBox template 의 항목 자식을 위 표현으로 ListBox 원본 instance 의 slot 채움으로 옮긴다 (`L:3852` · `L:4041`). 항목 추가 (「+」) 의 삽입 위치를 그 ListBox 로 (`S/catalog/commands/collections.ts`).
- Canvas: 닫힌 상태에서 ListBox 를 숨기는 규칙은 이미 있다 (`X/presence.ts:30`).
- DOM: select · combobox binding 이 ListBox instance 의 항목을 선택 목록으로 넘긴다 (`X/domBinding.tsx:509-543`). `S/components/Select.tsx:148-160` 의 `items` 경로는 데이터 바인딩용으로 남는다.
- Menu (루트가 Menu 이고 항목이 직접 자식) 는 이미 slot 형태라 대상이 아니다.

### Phase 5 — 바탕 사슬 (G5 통과 시)

- Phase 4 가 만든 slot 채움 표현을 쓴다. Phase 4 를 미루면 이 Phase 도 미룬다.
- 공용 바탕 원본 (제목 · 내용 · 버튼 줄 slot) 을 정하고 Dialog · Popover 를 그 instance 로 다시 적는다 (`L:5205` · `L:5322`). Card 와 합칠지는 G5 에서 정한다 — Card 는 Preview · Header · Content · Footer 네 영역이라 모양이 다르다.
- Modal 원본 (`LEGACY_ONLY_REUSABLE_ORIGIN_TYPES`) 은 건드리지 않는다.

### Phase 6 — 정리

- `.claude/rules/ssot-hierarchy.md` 의 「D3 read-only sub-part」 절 · `docs/adr/evidence/923-phase5-followup-subpart-extension.md` 에 이 ADR 표기.
- G3 승인 기록 (`apps/builder/tests/adr248-g3/approvedDifferences.ts`) 을 새 구조로.
- CHANGELOG · README.

## 4. 검증

- **unit**: 값 순서 표 · override 전파 (놓인 instance · 중첩 instance · 상태별 값) · 자리표시 전달 · library 검증 (slot 채움 포함) · contract 2 거부. 각 Gate 의 핵심 행은 원복 RED 로 확인한다 (편집 역적용 — `git checkout` 금지).
- **DOM 구조 대조**: 전환 전 빌드와 전환 후 빌드에서 같은 문서를 Preview 로 열어 부모 root 아래의 요소 · class · ARIA 속성 · 순서를 비교한다. 조합: 부모 × size 5 × labelPosition 2 × (기본 · invalid · description 있음 · label 없음 · required · disabled · readOnly).
- **동작** (실제 브라우저, 전환 전 빌드와 대조 — 리뷰 round 1 h2 · m1): ① NumberField `defaultValue = maxValue` 에서 증가 버튼 disabled · `minValue` 에서 감소 버튼 disabled · 부모 disabled 에서 둘 다 disabled · 증감 클릭이 값을 바꾼다 ② Select · ComboBox · DatePicker 버튼이 목록 · 달력을 연다 · SearchField 지우기가 값을 비운다 ③ TextField 에 required · `type="email"` · `pattern` 을 주고 입력 → blur · submit → 오류가 보인다 → 고치면 사라진다 → 입력의 `aria-describedby` 가 가리키는 id 의 요소가 DOM 에 있다 ([React Aria Forms](https://react-aria.adobe.com/forms) 의 validation 동작).
- **시각**: ADR-248 G3 하니스 (`paletteBaseCanvas` · `propAxisCanvasDom`) 전 case. 승인 차이는 G0 목록과 같아야 한다.
- **성능**: `pnpm gate:perf-ratchet` · `pnpm perf:baseline -- --lane frame --fixed-inputs --call-counts` 로 `scene.build` Δ (전환 전 빌드와 교대 3쌍). 불리한 경우 = field 가 많은 Form 을 반복한 600 요소 seed.
- **live** (실제 Builder + Preview): Components page 에서 Label 굵기 · Input 테두리 · Button 반경을 고친다 → page 의 TextField · Select · NumberField · Toolbar 가 Builder 와 Preview 에서 같이 바뀐다 → undo 로 돌아온다.

## 5. 사용자 확인 기록 (2026-10-06)

1. 범위: 「지금은 한 ADR 안에 단계로 두어도 문제가 발생하지 않는다면 그대로 진행」 — Phase 4 · 5 를 이 ADR 에 둔다.
2. 값 차이: 「RAC 레퍼런스 값 기준으로」 · 「RAC starter 보다 https://react-aria.adobe.com 레퍼런스 사이트에서」 — §2-2.
3. contract 2 프로젝트 거부: 「상관없다. 개발단계인데 무시해도된다」.
4. 레퍼런스 값의 위치: 「레퍼런스는 스타일 일뿐이고 default theme값일 뿐이다」 — 기본값으로 그대로 쓰고 항목별 예외를 두지 않는다 (§2-2 아래 단락).

## 6. 실행 기록

### 2026-10-06 — Phase 0 (일부) · Phase 1

기준 HEAD `5ca00a312`. 작업은 main checkout 에서 했다 (Phase 1 은 template 을 바꾸지 않는다 — 구조 전환 Phase 부터 worktree).

**Phase 0 (G0) — 한 것과 남은 것**

| G0 항목                                                                      | 상태                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ④ live 재현 — 원본 스타일 편집이 instance 에 안 닿음 (F7)                    | 확인. 수정을 되돌린 빌드에서 Button 원본의 배경 · padding 을 고치면 page 의 Button 과 Toolbar 안 Button 3개가 Canvas record · Preview computed style 모두 그대로다 (`apps/builder/scripts/adr253-p1-live.mjs` — `instances-follow` FAIL) |
| ④ live 재현 — Preview Select 목록 (F11)                                      | 미확인. Compare Mode 의 Preview 에서 Select 가 Enter 로 열리지 않았다 (`aria-expanded="false"`). Canvas 의 항목은 4개. Phase 4 착수 때 다시 확인한다                                                                                     |
| ① 변화 목록의 px 전개 · ③ 배치 키 · 모양 키 목록 · ⑤ 레퍼런스에 없는 값 확인 | Phase 2 · 3 착수 전에 한다 (Phase 1 은 이 목록을 쓰지 않는다 — 아래 「값 순서」)                                                                                                                                                         |
| ② 자식을 그리지 않는 DOM binding 전수                                        | §2-3 그대로 (줄 번호 재확인은 Phase 2 착수 때)                                                                                                                                                                                           |

조사에서 나온 사실 (본문 F7 보충):

- Components page 의 sample 이 편집을 보여 주던 것은 채널이 아니라 우회였다 — sample 노드가 override 의 값을 자기 값으로 다시 싣는다 (`R/componentsPage.ts` 의 sample 생성부).
- consumer 가 그리는 record 는 instance 가 접히는 가장 안쪽 template 루트다 (`X/compositionRoot.ts` `collapseLayers` · `consumerRecord`). 그래서 바깥 record 에만 닿은 값은 Canvas 에도 DOM 에도 보이지 않는다.
- 원본 override 의 prop 기본값 (`defaults`) 은 원본이 받는다고 선언한 키만 쓸 수 있다 (`PROP_NOT_ACCEPTED`). 그 키는 자리표시로 이미 template 에 닿는다. Phase 1 의 대상은 스타일 (`visual` · `stateRules`) 이다.
- 문서의 상태별 값 (`stateRules`) 은 library 137곳 중 1곳 (ListBoxItem 의 selected) 만 쓰고, 쓰는 편집 UI 가 없으며, Preview DOM 은 읽지 않는다. Canvas 는 `displayState` 가 있는 노드 (Components page 의 상태 칸) 에서만 읽는다.

**Phase 1 — 구현** (`S/catalog/resolution/resolver.ts`)

- template 루트를 투영할 때 그 루트가 속한 원본 (`InstanceRoot.origin`) 의 프로젝트 override 를 싣는다. 놓인 instance (`resolveOwned`) 와 다른 template 안의 instance (`projectTemplate` 의 중첩 호출) 둘 다 원본 id 를 넘긴다.
- 값 순서 (루트 한 곳): 루트의 type 정의 → type override → prop 규칙 · 부모 partRule → template 루트 자신의 값 → **원본 override** → 바깥 template 의 patch → instance 자리 · instance 가 쓴 값. 본문 Decision 4 와 같다. 부모 partRule 은 원본 override 보다 아래이고, 키를 배치 · 모양으로 나누는 처리는 필요하지 않았다 (override 가 없으면 결과가 수정 전과 같다).
- 상태별 값: 루트의 상태 적용 단계에 「원본 정의의 상태 규칙 → 원본 override 의 상태별 값 → instance 자리 · instance 가 쓴 상태별 값」 을 넣었다 (`receivedStateRules`). 중첩 루트로는 받은 층을 그대로 넘긴다.
- 중첩 루트로 내려가는 키에 「위에서 받은 값」 (바깥 instance 가 쓴 값 · 원본 override) 을 더했다 — 상태 변형 원본처럼 루트가 다시 다른 원본의 instance 인 경우 가장 안쪽 루트까지 닿는다.

**검증**

- unit `R/__tests__/adr253OriginOverrideChannel.test.ts` 4건 — 대상은 팔레트 원본의 실제 instance (Button · Toolbar · ButtonGroup · Pagination · Checkbox · CheckboxGroup · Card · CardView · Button 의 hover 상태 변형).
  - 기본 스타일: 놓인 Button 과 Toolbar · ButtonGroup · Pagination 안 Button 의 그려지는 record · Canvas 입력 · DOM 입력.
  - instance 가 쓴 값이 override 위에 남는다.
  - 값 순서: CheckboxGroup 의 rule 이 Checkbox 에 주는 `minHeight` 20 → Checkbox 원본 override 41 이 이긴다. CardView template 이 Card 자리에 적은 `width` 200 은 Card 원본 override 300 위에 남는다.
  - 상태: hover 에서 놓인 instance · Toolbar 안 instance · hover 상태 변형의 루트가 `#123456`. instance 가 쓴 hover 값은 남는다. 쉬는 상태 · pressed 는 그대로.
- 원복 RED (편집 역적용 4종): override 줄 제거 → 3건 RED · 상태 적용 제거 → 1건 RED · override 를 instance 값 뒤로 → 2건 RED · 중첩 호출의 원본 id 제거 → 3건 RED.
- 회귀: `pnpm type-check` 통과 · shared 1,492 · builder 4,134 통과.
- 시각 하니스 (`vitest.adr248-g3.browser.config.ts`): 수정 전후 출력이 같다 (70건 중 통과 67 · 실패 3 — 실패 3건은 수정 전 HEAD 에서도 같은 내용: `paletteBaseCanvas` 의 CardView 외 1 · `propAxisCanvasDom` 의 NumberField-top · NumberField-side). 이 ADR 이전부터 있던 실패다. CardView: Card 원본의 slot 선언 (`01d59d525`, Footer 자리 높이 8) 으로 Card 높이가 구 캡처와 달라졌고 승인 기록이 갱신되지 않았다 (Canvas ↔ DOM 은 차이 0). NumberField: 증감 버튼 아이콘이 Canvas 18×18 · DOM 16×16 이고 x 가 21px 다르다 (`lib:template:component-numberfield__2_3`) — Phase 3 에서 증감 버튼을 Button instance 로 바꿀 때 같이 본다. 하니스는 실행할 때 `docs/adr/design/248-phase3-palette-base-canvas.json` 을 고쳐 쓰므로 실행 뒤 되돌렸다.
- live (실제 Builder + Compare Mode Preview, headed Chrome · DPR 1 · `visibilityState` visible, `adr253-p1-live.mjs`):
  - Button · Toolbar 를 팔레트로 놓고 Components page 에서 Button 원본의 배경 `#ff0000` · padding-top 20 을 쓴다 → page 의 Button 과 Toolbar 안 Button 3개가 Canvas record (`#ff0000` · 20) 와 Preview computed style (`rgb(255, 0, 0)` · `20px`) 에서 같이 바뀐다 → undo 로 전부 돌아온다. 콘솔 오류 0.
  - 같은 스크립트를 수정을 되돌린 빌드로 돌리면 `instances-follow` · `state-canvas` 가 FAIL 이다.
  - 상태: 원본의 hover 배경을 `#123456` 으로 쓰면 Components page 의 Hover 칸 3개 (variant 3종) 만 `#123456` 이 된다.
  - **통과하지 못한 것**: Preview 에서 Button 에 hover 를 줘도 (`data-hovered` 확인) 배경은 그대로다 — 위 「조사에서 나온 사실」 의 마지막 항목.
  - 한계: Components page 열기와 값 쓰기는 패널 조작이 아니라 패널이 내는 것과 같은 호출 (`showDefinition` · `setFields` → `workspace.execute`) 로 했다. Preview 의 hover 는 Builder 의 편집 overlay 가 pointer 를 가져가 Preview 문서에 pointer 이벤트를 직접 줬다.
- G6 (ratchet): 게이트가 dirty 트리에서는 HEAD 를 재므로 커밋 뒤 pre-push 에서 잰다.

**남긴 것**

- G1 의 Preview 상태 항목 — 사용자 판정 대기 (본문 Status).
- 원본을 처음 고칠 때 뜨는 영향 안내가 「1 instance」 로 센다 (page 에 놓은 것만). 이제는 다른 원본 안의 instance (Toolbar 의 Button 3개) 도 같이 바뀐다 — 세는 범위를 Phase 3 에서 맞춘다.

### 2026-10-06 — Phase 1 보완 · Phase 2 (worktree `.worktrees/adr-253` · 브랜치 `adr-253`)

**Phase 1 보완** (`05b75c019`): override 가 이미 있는 원본을 한 번 더 고치면 (value-only step) page 에 놓은 instance 의 record 만 다시 계산되고, 다른 원본 template 안의 instance 는 옛 값으로 남았다 — Phase 2 의 Label 테스트에서 드러났다 (해석 결과는 800 · 화면 record 는 600). 그 자리는 template 위치라 graph 색인에 없다. `X/compositionRoot.ts` 의 `overrideDependents` 가 override 대상 정의를 그리는 record (자기 정의 또는 접힌 층의 정의가 대상인 것) 를 모두 다시 계산한다. 테스트: 두 번째 편집 · undo 뒤 Canvas · DOM record 8개 (수정 전 `[88,77,77,77,…]`). Phase 1 커밋 (`12df3757a`) 은 main 에 있고 이 보완은 브랜치에만 있다 — 병합 때 같이 들어간다.

**Phase 2 — 구현**

- library (`9bfe05f6a`): `origin-component-label` 정의와 template 루트 (`component-label`, type Label, `children: "{children}"`). TextField template 의 `__1` 이 Label 원본의 instance. 팔레트 밖 원본 목록에 Label. `LIBRARY_CONTRACT_VERSION` 3 (테스트 fixture 26 파일의 리터럴 갱신).
- DOM (`7f2e04799`): textfield binding 이 Label 자식을 `renderChild` 로 그린다 (RAC `Label`, TextField 의 context 안 — `for` 연결 유지). Input · description · FieldError 는 binding 이 RAC 요소로 같이 넘긴다 (Phase 3 에서 노드로). shared `TextField` 는 `children` 이 있으면 그대로 넘기고 없으면 종전처럼 조립한다 (Builder 화면 자체가 쓰는 호출처 3곳). Label 노드는 field 가 붙이는 necessity 표시를 같이 그리고 field 값이 바뀌면 다시 그린다 (`CATALOG_LABEL_NODE_FIELDS` · `catalogFieldLabelNecessity`).
- Components page: 기본 부품 원본 (`BASE_PART_ORIGIN_TYPES` — Label) 을 팔레트 원본 앞에 그린다.

**구현하면서 정한 것**

- Label 노드의 DOM 스타일은 그 record 의 해석 값 전체가 inline style 로 나간다 (지금 page 에 놓은 Label 이 그려지는 방식과 같다 — text leaf binding). 그래서 Label 의 글자 크기 · 굵기 · 색은 Canvas 가 읽는 record 와 DOM 이 같은 값이고, Label 원본의 override 는 추가 채널 없이 DOM 에 닿는다. 본문 Decision 5 의 「같은 노드를 그린다」 가 값까지 포함하게 된다.
- **부모 delegation 정리는 Phase 3 으로 옮긴다** (이 절 Phase 2 의 「`T:13516` 에서 모양 선언을 걷어낸다」). TextArea 의 DOM root 가 `react-aria-TextField` class 를 쓰고 자기 CSS 가 없어 TextField 의 생성 CSS (Label bridge 포함) 를 같이 쓴다 (`S/components/TextArea.tsx` 머리말 · `S/catalog/resolvers/resolveDelegatedChildFontSize.ts:47-52`). TextField 의 Label delegation 만 지우면 TextArea 의 Label 이 md 밖 크기에서 Canvas 와 갈린다. TextArea 의 Label 을 노드로 바꾸는 것과 같이 지운다. G2 는 이 정리 없이 통과한다 — 원본 override 가 부모 partRule 위에 있다 (Phase 1 의 값 순서).
- Label 굵기 600 → 500 (§2-2 1번) 은 Phase 3 의 Label 단계에서 전 Label 에 한 번에 한다. 글자 폭이 바뀌어 old/new 비교의 geometry 승인 기록을 type 마다 고쳐야 하고, 부모마다 굵기 bridge 가 남아 있는 동안 부분 적용하면 Canvas 와 DOM 이 갈린다.
- TextField 는 size 를 Label 에 넘기지 않는다 (`D/sizePropagation.ts` 에 없다) — Label 의 글자 크기는 아직 TextField 의 partRule 이 준다. delegation 정리 때 size 전달로 바꾼다. 그때 md 밖 크기에서 Label 의 줄 높이가 Label rule 값으로 바뀐다 (예: xl 25.7 → 28px) — 변화 목록에 넣는다.

**검증 (G2)**

- unit `R/__tests__/adr253LabelOrigin.test.ts` 16건: 원본 등록과 접힘 (`collapsedSourceIds`) · Components page 의 Label 카드 · `label` prop 과 field size → Label · Label 원본의 스타일 → Label 의 Canvas · DOM record · DOM 구조 대조 11가지 · Label 요소의 inline style.
- DOM 구조 대조: 기본 · required · necessity `label` (required · optional) · label 없음 · description · invalid + errorMessage · side · xl · disabled · readOnly. oracle 은 shared `TextField` 가 props 로 자기 Label 을 조립한 문서 (전환 전 DOM). 요소 · class · ARIA 속성 · 순서가 같다 (생성 id · `data-catalog-id` · inline style 제외).
- 회귀: `pnpm type-check` · shared 1,492 · builder 4,151 통과.
- 시각 하니스: 전환 전과 출력이 같다 (기존 실패 3건 그대로, TextField-top · TextField-side 통과).
- live (`apps/builder/scripts/adr253-p2-live.mjs`, worktree 빌드 5175 · headed Chrome · DPR 1 · visible) 6/6:
  - 놓은 TextField 의 Label: Canvas record 는 Label 원본의 루트로 접히고, Preview 의 `label` 은 Label 노드의 것이며 `for` 가 input 을 가리킨다. Label 상자 Canvas 62.5 × 20 · DOM 62.6 × 20.
  - Components page 의 Label 원본에 색 `#ff0000` · 굵기 800 · 글자 20 → TextField 의 Label 이 Canvas record 와 Preview computed style 에서 같이 바뀐다 (상자 92.5 × 28.6 양쪽 같음).
  - TextField 의 `label` 을 「Email」 로, `isRequired` 를 켜면 Preview 는 「Email*」 · Canvas 접미 「 *」.
  - 원본을 한 번 더 고친 값 (`#0000ff`) 도 page 에서 바로 보이고, undo 3번으로 처음 값에 돌아온다. 콘솔 오류 0.
  - 한계: Components page 열기와 값 쓰기는 패널이 내는 것과 같은 호출로 했다 (Phase 1 과 같다).
- G6: ratchet 통과 (A등급 증가 0, worktree 빌드). `scene.build` Δ 와 initial 번들은 재지 않았다 — 구조 변경이 가장 큰 Phase 3 끝에서 전환 전 빌드와 교대로 잰다.

### 2026-10-06 — Phase 3 (1) Label (worktree `.worktrees/adr-253` · 브랜치 `adr-253`)

**Phase 0 의 남은 항목 중 Label 에 해당하는 것**

- 변화 목록 (px): 전환 전 빌드에서 17 부모 × size 5 × labelPosition 2 의 resolved record 를 떠서 전환 후와 대조했다. Label record 만 바뀐다 — 글자 크기는 전 부모가 Label rule 의 단계와 이미 같았고 (xs 10 · sm 12 · md 14 · lg 16 · xl 18), 바뀌는 것은 굵기 600 → 500 과 md 밖 줄 높이 (Label rule 의 token 값: xs · sm 16 · lg 24 · xl 28px. 전에는 Canvas 가 글자 크기 × 20/14, DOM 이 20px 고정 — DatePicker 2종 · 그룹의 sm · lg 는 이미 token 값) 다. 다른 record 의 값 변화 0.
- Checkbox · Radio · Switch 의 글자 (type Label 노드): Label 원본의 instance 로 바꾸지 않는다 — 레퍼런스에서 Form 의 Label 이 아닌 요소다. Label rule 을 같이 읽으므로 굵기 500 은 Checkbox · Radio 에도 적용된다 (§2-2 1번 「전 Label」). Switch 의 글자는 400 그대로 (자기 규칙).
- Slider · TagGroup 의 Label 을 범위에 넣었다 (§3 의 「10 부모 + root 변수 4」 밖). 레퍼런스 예제가 둘 다 Form 의 Label 을 쓰고, 빼면 Label 원본을 고쳐도 따라오지 않는 Label 이 남는다. 대상 17 부모.

**구현**

- library: 17 부모 template 의 `__1` 이 Label 원본의 instance (`size: "md"` 리터럴 제거 — field 의 size 가 내려간다). TagGroup `__1` 의 `fontWeight: 600` 제거. `LIBRARY_CONTRACT_VERSION` 4.
- 값: `CATALOG_SIZE_PROPAGATION` 에 field · 그룹 → Label. `T` 의 Label delegation 11개 · root 의 `--label-*` 변수 (CheckboxGroup · RadioGroup · Meter · ProgressBar) · `manualBoxRules` 의 그룹 Label 글자 규칙 3개 · `rulePartRules` 의 Label 변수 소비 표 제거. Label rule `textWeight` 500, `base.css` · `Label.css` 의 기본 굵기 500.
- DOM: field 의 binding 이 Label 노드의 요소를 shared 컴포넌트의 `label` 로 넘긴다 (`fieldLabel` · `catalogFieldLabelNode`). shared 컴포넌트 16개의 Label 조립부는 `renderFieldLabel` 하나 — 요소를 받으면 그대로 놓고, 글자를 받으면 종전처럼 조립한다 (Builder 화면 자체의 호출처). 자식을 그리지 않는 binding (Select · ComboBox · DatePicker · DateRangePicker) 도 Label 만은 노드에서 받는다. necessity 표시는 Label 노드가 그리고, field 마다 종전 방식 그대로다 (`CATALOG_LABEL_NODE_FIELDS` — 자기 값 · 가까운 Form · 기본 표시 · 없음).
- 내부 부품 판정: Label 은 텍스트 축만 부모 소유 (`TEXT_ONLY_SUBPART_PARENTS`). Properties 는 부모 안내, Styles · AI 의 style 편집은 Label 자신. 소비처 (§2-5) 는 이미 두 축으로 나뉘어 있어 술어만 고쳤다.

**구현하면서 정한 것**

- DOM 구조 대조의 oracle 은 전환 전 빌드의 출력이다 (`fixtures/adr253-field-dom.json` — main `1d66260dd` 에서 같은 테스트로 기록). Phase 2 의 「shared 컴포넌트가 props 로 조립한 문서」 는 binding 마다 넘기는 props 를 테스트가 다시 적어야 해서 부모 17종으로 넓히지 않았다. 이 fixture 는 Phase 3 의 뒤 단계 (FieldError · Input · Group · Button) 에서도 같은 oracle 이다.
- 부모 rule 의 delegation 을 지우면 props 로 조립하는 Label (Builder 화면 자체) 은 field size 와 무관하게 md 글꼴이 된다. Builder 화면에서 shared field 를 쓰는 곳은 8 파일이고 Label 을 가진 md 밖 크기 사용은 찾지 못했다.
- DOM 의 necessity 표시 방식이 field 마다 다르다 (Select · ComboBox · picker 2종은 Form 의 값을 받지 않고 자기 `necessityIndicator` 도 넘기지 않는다 · 그룹은 Form 의 값을 받지 않는다 · TagGroup 은 표시가 없다). Canvas 는 규칙 하나 (`catalogLabelSuffix` — 자기 값 또는 가까운 Form) 라서 그 조합에서는 전환 전부터 Canvas 와 DOM 이 다르다. 이번에는 DOM 을 전환 전과 같게 두었다 (G3 의 DOM 구조 대조). 하나로 맞추는 일은 남긴다.

**검증**

- unit `R/__tests__/adr253FieldPartsDom.test.ts` 272건: DOM 구조 대조 17 부모 × 13 조합 (기본 · required · necessity `label` 2종 · label 없음 · description · invalid · side · sm · xl · disabled · readOnly · quiet — field 가 받지 않는 prop 의 조합은 없음) · Label 요소가 Label 노드이고 inline style 이 record 값 · field size → Label (lg 16 / 24 · 500) · Label 원본 편집 2회 → Canvas · DOM · 자기 스타일은 그 위에 남음 · 판정 두 축.
- 정적 `S/catalog/__tests__/adr253PartShapeOwner.static.test.ts`: `.react-aria-Label` delegation 0 · `--label-*` 0 · Label 에 닿는 nested selector 는 배치 키만.
- 원복 RED: size 전달 제거 (2건) · DOM 이 글자를 넘김 (24건) · ComboBox 자리를 type 노드로 (2건) · Label 굵기 600 (34건) · rule 표를 되돌림 (정적 2건).
- 회귀: `pnpm type-check` · shared 1,495 · builder 4,406 · publish 11 통과. 고친 기대값: `adr251ItemsNode` 의 xl `topY` 45.71 → 48 (그룹 Label 줄 높이 28) · `phase4eSubpart` 의 Label style 축.
- 시각 하니스: Canvas ↔ DOM 은 전 항목 전환 전과 같은 수준 (최대 0.73px — Form). old/new 비교에서 Label 폭이 1px 넘게 준 6종 (Checkbox · ComboBox · Select · TagGroup · TextField · TimeField, −1.0 ~ −1.8px) 을 `label-weight-500` 으로 승인 기록에 넣었다. 남은 실패는 전환 전과 같은 3건 (CardView · NumberField 2).
- live (`apps/builder/scripts/adr253-p3-live.mjs`, worktree 빌드 5175 · headed Chrome · DPR 1 · visible) 5/5: 팔레트 클릭으로 17종을 놓음 → Label 의 Canvas record 와 Preview computed style · 상자가 같다 (md 14/20 · 500) → 각 field 를 가장 큰 size 로 (xl 18/28, TagGroup lg) → Label 원본에 색 `#ff0000` · 굵기 800 → 17종 전부 양쪽에서 바뀜 → Select 의 Label 에만 색을 쓰면 그것만 바뀜 → undo 로 처음 값. 콘솔 오류 0. 한계: Components page 열기 · 값 쓰기 · size 변경은 패널이 내는 것과 같은 호출로 했다.

**남긴 것**

- `.claude/rules/ssot-hierarchy.md` 의 「D3 read-only sub-part」 절은 Label 을 아직 부모 소유로 적는다 — Phase 6.
- Canvas 와 DOM 의 necessity 표시 규칙 통일 (위).
- `CATALOG_LABEL_NODE_FIELDS` 는 Phase 2 의 TextField 방식 (children 전체를 넘김) 과 이번 방식 (`label` 로 요소를 넘김) 을 같이 쓴다. Input 단계에서 하나로 정리한다.

### 2026-10-06 — Phase 3 (2) FieldError · Description (브랜치 `adr-253`)

**착수 때 확인한 사실** (본문 F5 · F6 보충)

- Canvas 는 field 의 도움말과 오류 문구를 그리지 않고 있었다. FieldError 노드는 5 부모 (TextField · TextArea · NumberField · DateField · TimeField) 의 template 에만 있고 `display: none` 고정이었으며, Description 노드는 어느 field 에도 없었다. DOM 만 `description` · `errorMessage` 로 조립했다.
- Preview 의 Select · ComboBox binding 은 `description` · `errorMessage` 를, 그룹 binding 은 `description` 을 넘기지 않았다 — 속성 패널에서 적어도 Preview 에 나오지 않았다.
- binding 이 `isInvalid: false` 를 명시로 넘겨 RAC 의 자체 validation 이 항상 「유효」 였다. `<FieldError>{""}</FieldError>` 의 빈 글자도 RAC 의 문구를 가렸다. 그래서 required · email · pattern 오류는 Preview 에 나온 적이 없다 (대조군: main 빌드에서 같은 입력 순서 — 표시 없음).
- side 라벨의 들여쓰기 (`margin-inline-start: calc(라벨 폭 + gap)`) 가 읽는 크기별 gap 변수 (`variables: "auto"` 선언) 를 Canvas 쪽 partRule 컴파일이 몰랐다. Canvas 가 문구를 그리지 않아 드러나지 않던 빈틈이다.

**구현**

- library: Description · FieldError 원본 (`origin-component-description` · `-fielderror`, 팔레트 밖 · Components page 의 부품 칸). 13 부모 template 에 도움말 자리 (`__description`) 와 오류 문구 자리 (있던 5 부모는 `__3` 그대로, 나머지는 `__error`) 를 control 뒤에 둔다. 원본이 `description` · `errorMessage` 를 받아 자리표시로 내려 준다. contract 는 이 Phase 의 4 그대로 (병합 한 번에 한 번).
- 값: FieldError · Description rule 에 xs · xl 단계 추가 (§2-2 2 · 3번). field · 그룹 → 두 부품으로 size 전달. 부모 rule 의 FieldError delegation 10 · description delegation 12 (DropZone 의 것은 자기 내용이라 남김) · `--*-hint-size` 변수 제거. side 들여쓰기의 gap 선언 (`:is(.react-aria-FieldError, [slot="description"])` · `variables: "auto"`) 은 배치라 남기고, partRule 컴파일이 생성기와 같은 함수 (`deriveAutoDelegationVariables`) 로 읽는다.
- 표시 (`X/presence.ts` `catalogFieldHintShown`): 도움말은 `description` 이 있을 때, 오류 문구는 `isInvalid` 이고 `errorMessage` 가 있을 때. field 의 값이 바뀌면 다시 판정한다 (presence scope).
- DOM: field 의 binding 이 두 노드의 요소를 `description` · `errorMessage` 로 넘긴다 (`renderFieldDescription` · `renderFieldError` — Label 과 같은 방식). field 안 FieldError 노드는 RAC `FieldError` 다 (`fieldErrorBinding`): 문구가 있으면 그 글자, 없으면 children 을 비워 RAC 의 validation 문구가 나온다. `isInvalid` 는 문서가 invalid 일 때만 넘긴다 (`authoredInvalid` — 본문 Decision 5 ③ 과 같은 계약).
- text leaf 의 inline style 은 margin 을 0 으로 되돌린 뒤 부모 rule 이 준 배치 margin 을 다시 쓴다 (네 변으로 — shorthand 와 섞으면 React 가 경고). 안 그러면 reset 이 부모 stylesheet 의 들여쓰기를 이긴다.
- 판정: FieldError · Description 도 텍스트 축만 부모 소유 (`TEXT_ONLY_SUBPART_PARENTS`).

**구현하면서 정한 것**

- Canvas 의 오류 문구 표시는 「invalid + 문구 있음」 이다. 문구 없이 invalid 인 문서는 Canvas 에 문구 상자가 없고, Preview 도 정적으로는 없다 (RAC 가 실행 중에 낸 오류는 Preview 의 실행 상태 — 본문 Decision 5 ④).
- TagGroup 의 도움말 · Meter 등은 범위 밖이다 (delegation 목록에 없고 TagGroup 은 `errorMessage` 를 받지 않는다).
- side 라벨에서 ColorField 와 그룹 2종은 들여쓰기 규칙이 없다 (rule 에 선언 없음 — 전환 전 DOM 도 같다). Canvas 와 DOM 은 서로 같다.

**검증**

- unit `adr253FieldPartsDom.test.ts` 295건 (Label 단계 272 + 23): DOM 구조 대조는 215 조합이 전환 전 빌드와 같고, 6 조합 (select · combobox 의 description · invalid, 그룹 2종의 description) 은 「문구 요소가 그 부품 노드이고 control 의 `aria-describedby` 가 가리킨다」 로 단언한다. 13 부모: 원본 instance · 쉬는 상태 숨김 · `description` → 표시 · invalid 만으로는 숨김 · 문구 → 표시 · size md 12 / lg 14 · 원본 편집 2회 → Canvas · DOM · 판정 두 축 · DOM inline 색. side 들여쓰기 10 부모 (176 + 부모의 md gap: 180 · 182 · 184px).
- 정적: 부모 rule 의 FieldError · description 선언 0 · `--error-*` 0 (직전 rule 표로 3건 RED).
- 원복 RED: presence 제거 (13) · 오류 문구를 글자로 (16) · size 전달 제거 (13) · gap 변수 파생 제거 (10) · DOM margin 되쓰기 제거 (10).
- 회귀: `pnpm type-check` · shared 1,497 · builder 4,446 · publish 11 · rendering 1,379 통과. 고친 기대값: 그룹의 자식 목록 (`adr251ItemsNode` · `phase4eItemInsert` — 도움말 · 오류 문구 자리 추가).
- 시각 하니스: Canvas ↔ DOM · old/new geometry 수치는 Label 단계와 같다. 쉬는 상태에서 숨는 FieldError 의 old 쪽 짝 없음 (5 부모 + Form) 을 `field-error-hidden-at-rest` 로 승인 기록에 넣었다. 남은 실패는 전환 전과 같은 3건.
- live `adr253-p3-live.mjs` 9/9 (5175 · headed Chrome · DPR 1 · visible): 쉬는 상태 — 13 부모 모두 양쪽에 문구 없음 → `description` · invalid · `errorMessage` → Label · Description · FieldError 의 상자 (field 기준 x · y · 폭 · 높이) · 글꼴 · field 높이가 Canvas 와 Preview 에서 같다 (≤ 1px) → side 라벨 → 같다 → 가장 큰 size → 같다. 동적: required + email TextField 에 「abc」 입력 후 Tab → 브라우저의 오류 문구가 FieldError 노드 요소에 나오고 input 의 `aria-describedby` 가 가리킨다 → 「a@b.co」 → 문구 없음 → 비움 → required 문구 → `errorMessage` 를 쓰면 그 글자. 콘솔 오류 0.
- 대조군: 같은 스크립트를 main 빌드 (5173) 에 돌리면 동적 단계에서 문구가 나오지 않는다 (`error: null` 3번).
- 한계: 값 쓰기는 패널이 내는 것과 같은 호출로 했다. submit 으로 생기는 오류 · NumberField 의 min/max · Select · ComboBox 의 required 는 이 단계에서 재지 않았다 (Group · Button 단계의 동작 검사에서 같이).

**남긴 것**

- TagGroup 의 도움말.
- ColorField · 그룹 2종의 side 들여쓰기 (rule 에 선언이 없다 — 전환 전부터).
- Phase 2 의 TextField 방식 (children 전체) 과 prop 으로 요소를 넘기는 방식의 통일 (Input 단계).
