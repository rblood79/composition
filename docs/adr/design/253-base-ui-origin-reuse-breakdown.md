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

### Phase 3 (3) Input · DateInput — 착수 전 확인 (2026-10-06)

Label · FieldError · Description 과 구조가 다르다. 세 부품은 상태가 없어 「노드의 해석 값 전체를 inline style 로」 내는 것으로 Canvas 와 DOM 이 같은 값을 읽었다. Input 은 그렇게 할 수 없다.

- field 안 Input 의 DOM 모양은 세 곳에서 온다: `base.css` 의 `.react-aria-Input` (테두리 · 모서리 · padding 변수) · `utilities.css` 의 `.inset` (hover · focus · invalid · disabled — 부모가 `--inset-*` 로 조정) · 부모 delegation (`T` TextField 의 `:is(.react-aria-Input, .react-aria-TextArea)` — 크기별 변수와 상태 selector 5개).
- Input rule (`T` `Input:`) 에는 `structure` 가 없어 생성 CSS 가 없다. 지금 page 에 단독으로 놓은 Input 은 해석 값 전체가 inline 으로 나간다 (`authoredStyle` 의 `noSheet`).
- field 안 Input 을 inline 전체로 그리면 inline 의 테두리 색 · 배경이 stylesheet 의 hover · focus · invalid 색을 이긴다 — 상태 표시가 사라진다.
- 그래서 이 단계는 Input rule 이 자기 stylesheet (크기 단계 + 상태) 를 내는 정본이 되고, 부모 delegation · `.inset` 의 부모별 조정은 걷어내며, 노드는 `data-size` 와 직접 쓴 값 (원본 override 포함) 만 inline 으로 내는 형태가 된다. 생성 Input CSS 를 불러오면 Builder 화면 자체의 입력칸 (`.react-aria-Input`) 에도 닿으므로 범위를 확인해야 한다.
- 원본 override 로 쓴 테두리 색 · 배경은 inline 이라 상태 색을 덮는다. G1 에서 남긴 「Preview 의 상태별 값」 판정 (본문 Status) 과 같은 채널 문제다 — Input · Button 에서 처음 눈에 보이게 된다.
- 크기별 정적 값은 md 에서 Input rule 과 TextField delegation 이 같다 (padding 4 · 12 · 글자 14 · 모서리 6). 나머지 크기와 부모별 차이 (§2-2 5 · 6번) 는 레퍼런스 예제를 다시 받아 px 로 전개한 뒤 시작한다.
- ComboBox · NumberField · SearchField · Select · picker 2종은 control 이 `SelectTrigger > SelectValue + SelectIcon` 노드다. Input · Group · Button 노드로 다시 짜는 일은 (4) Group · Button 과 한 묶음이다.

### 2026-10-06 — Phase 3 (3a) Input (브랜치 `adr-253`)

대상은 control 이 Input 노드인 field 셋이다: TextField · TextArea · ColorField. ComboBox · NumberField · SearchField 는 control 이 아직 `SelectTrigger > SelectValue` 라 Group · Button 단계에서 같이 바꾼다 (위 「착수 전 확인」 마지막 항목).

**변화 목록 (G0 ① — px)**

전환 전 빌드에서 field 11종 × size 5 × labelPosition 2 의 Canvas record 를 떠서 전환 후와 대조했다. 바뀌는 record 는 세 field 의 Input 뿐이고 (22건, md 는 0건), 바뀌는 값은 둘이다.

| 항목                                                 | 전                                                                 | 후                                                            | 근거                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Input 의 모서리 (Canvas · Preview)                   | 전 크기 6px                                                        | Input rule 의 크기 단계 — xs 2 · sm 4 · md 6 · lg 8 · xl 12px | 레퍼런스에 없는 크기 단계는 부품 rule 값 (본문 제약). Button 과 같은 단계다       |
| ColorField 입력칸의 모서리 (Preview)                 | 4px (`radius-sm`)                                                  | TextField 와 같다 (md 6px)                                    | §2-2 5번                                                                          |
| ColorField 입력칸의 상태 (Preview)                   | hover · focus · invalid 표시 없음 (focus 는 브라우저 기본 outline) | TextField 와 같다                                             | §2-2 5번 — 「ColorField 는 덧붙이는 것이 없다」                                   |
| ColorField 입력칸의 placeholder (Preview)            | 없음                                                               | 노드의 값 (`#000000`)                                         | Canvas 는 이미 그렸다 — 같은 노드를 그린다 (Decision 5)                           |
| disabled 인 TextField · TextArea 의 입력칸 (Preview) | field root 0.38 × 입력칸 0.38 × 글자 38% 로 겹쳐 흐림              | field root 0.38 한 번                                         | Canvas 는 root 한 번만 흐렸다. 입력칸이 자기 모양을 한 번 더 바꾸면 DOM 만 겹친다 |

padding · 글자 크기 · 줄 높이 · 테두리 굵기 · 폭 · TextArea 의 rows 높이는 전 크기에서 전과 같다 (TextField 의 delegation 값과 Input rule 값이 같았다).

**구현**

- 값 (`T` Input rule): 크기 단계에 줄 높이 · 테두리 굵기를 적고 고정 `height` 를 뺐다 — 높이는 내용 (줄 높이 + padding + border, md 20 + 8 + 2 = 30) 이라 같은 정의가 TextArea 의 `<textarea>` 에도 맞는다. `structure` 를 선언해 자기 stylesheet (`generated/Input.css`) 를 낸다: 크기 단계 (`[data-size]`) · hover · focus · invalid. `base.css` 의 입력칸 블록 · TextField 의 `:is(.react-aria-Input, .react-aria-TextArea)` delegation (크기 변수 + 상태 5종) · ColorField 의 모양 bridge 를 지웠다. ColorField 에는 배치 (`max-width` · `box-sizing`) 만 남는다.
- 생성기: `structure.classAliases` — 한 rule 의 sheet 가 다른 RAC class 를 root 로 같이 그린다. Input rule 은 `["TextArea"]` 이고 selector 가 `:is(.react-aria-Input, .react-aria-TextArea)` 로 나간다 (특이도는 class 하나 그대로). 본문의 「새 emit 기능을 요구하지 않는다」 는 자식 selector 에 대한 선언이었고, 이 옵션은 그 밖의 작은 추가다 (출력 문자열 치환 한 곳 — `CSSGenerator.ts` `generateCSS` 끝).
- library: `origin-component-input` (팔레트 밖 · Components page 의 부품 칸 — `placeholder` · `type` 을 받는다) 과 세 field 의 `__2` 자리. `size: "md"` 리터럴을 지우고 field 의 size 가 내려간다 (`CATALOG_SIZE_PROPAGATION`). contract 는 이 Phase 의 4 그대로.
- Canvas: `manualBoxRules` 의 Input (수동 `base.css` 를 옮겨 적은 것) 과 `CONSUMED_VARIABLES` 의 `--input-*` 를 지웠다 — 상자는 rule 의 일반 경로 (`resolveCatalogRuleCanvasBox`) 가 낸다. TextArea 의 rows 높이는 Input rule 의 줄 높이에서 계산한다 (`catalogTextAreaInputHeight`).
- DOM: field 의 binding 이 Input 노드의 요소를 shared 컴포넌트의 `inputElement` 로 넘긴다 (`fieldInput` · `catalogFieldInputNode`). 노드는 RAC `Input` (TextArea 는 RAC `TextArea`) 이고 `data-size` 와 문서가 쓴 값 (원본 override · 자기 값) 만 inline 으로 낸다 (`fieldInputBinding`). field 의 context 가 주는 것 (id · value · disabled · invalid) 은 넘기지 않는다 (Decision 5 ③). TextField 도 다른 field 처럼 부품을 prop 으로 받는다 — Phase 2 의 children 방식은 없앴다 (Label 단계에서 남긴 통일).
- 판정: Input 은 텍스트 축 (`placeholder` · `type`) 만 부모 소유 (`TEXT_ONLY_SUBPART_PARENTS`). `DELEGATED_SUBPART_CHILD_TOKENS` 의 Input 은 지웠다.
- Builder 화면 자체: Builder 문서는 `builder-components.css` 를 싣는다 — 거기에 `generated/Input.css` 를 넣었다 (종전 `foundation` 의 `base.css` 블록 자리). 속성 패널 (`form-controls.css`) 은 `--input-*` 변수 대신 테두리 · padding 을 직접 선언한다.

**구현하면서 정한 것**

- 입력칸의 disabled 는 자기 모양을 바꾸지 않는다 (`states.disabled.opacity: 1`, 색 선언 없음). RAC 는 field 의 disabled 를 입력칸에도 `data-disabled` 로 주므로 입력칸 sheet 가 흐리면 field root 의 흐림과 겹친다 — DOM 만. 처음에는 색만 남겼는데, 그 선언이 ComboBox · NumberField 안의 입력칸 글자색까지 바꿨다 (대조군 비교에서 드러남) — 지웠다.
- placeholder 색은 선언하지 않았다 (전환 전 TextField 는 브라우저 기본색). `.inset` 의 placeholder 색은 그 utility 를 쓰는 요소에만 있다.
- 빈 입력칸의 높이: Canvas 는 글자 (값 · placeholder) 가 없으면 줄 상자를 재지 않아 Input 이 10px (padding + border) 였다 — DOM `<input>` 은 30px. Components page 의 Input 카드에서 드러났다 (TextField 의 placeholder 를 비워도 같다 — 전환 전부터). 글자 없는 Input 도 한 줄 높이를 갖게 했다 (`compositionRoot.ts` `emptyLine`).
- Components page 의 Input 카드는 field 와 같은 고정 폭 칸 (240) 을 쓴다 — `width: 100%` 인 leaf 가 fit-content 칸에서 접힌다.
- quiet 변형은 그대로 부모 rule 에 있다 (TextField · ColorField 의 `containerVariants.quiet.true.nested` — `.react-aria-Input` 의 모양). §3 의 quiet 항목에서 모은다. 그 selector 는 `<textarea>` 에 닿지 않아 TextArea 의 quiet 는 Preview 에서 상자가 남는다 — 전환 전부터 같다 (대조군 확인).

**검증**

- unit `adr253FieldPartsDom.test.ts` 300건 (+5): DOM 구조 대조 221 조합 — 세 field 의 39 조합은 control 의 `data-size` 를 구조에서 빼고 비교하며 (Input rule 의 sheet 가 읽는 크기 표지), ColorField 는 노드의 placeholder 가 더 있음을 따로 단언한다. 세 field: 원본 instance · 요소가 그 노드 · inline 에 해석 상자 없음 · field size → Input (lg 8 / 16 · 16px · 줄 24 · 모서리 8) · 원본 편집 2회 → Canvas · DOM · 자기 스타일은 그 위에 · 판정 두 축. TextArea 의 rows → 높이 · `rows`. 빈 placeholder 의 높이 30.
- 정적 `adr253PartShapeOwner.static.test.ts`: 세 field 의 delegation 이 Input 에 주는 것은 배치 키뿐이고 상태 선언이 없다.
- 원복 RED 6종: size 전달 제거 (1) · DOM 이 자기 Input 을 조립 (16) · inline 에 해석 상자 (57) · TextField 자리를 type 노드로 (1) · ColorField 에 모서리 bridge (정적 1) · 텍스트 축 판정 제거 (3). 빈 입력칸 높이는 수리 전 RED (10 ≠ 30).
- 회귀: `pnpm type-check` · shared 1,498 · rendering 1,379 · builder 4,451 · publish 11 통과. 고친 기대값: 생성 CSS 개수 96 → 97 · 로드 인벤토리 (index 75 · 미로드 24) · `phase4eSubpart` 의 Input style 축 · `resolveDelegatedChildMaxWidth` (ColorField bridge 에 글자 크기 없음) · `domClassMatchesRuleKey` (계산식의 입력 = Input 의 줄 높이).
- 시각 하니스: 전환 전과 같다 (70건 중 67 통과 · 실패 3건은 같은 내용 — CardView 외 1 · NumberField 2).
- live `apps/builder/scripts/adr253-p3-input-live.mjs` 10/10 (worktree 빌드 5175 · headed Chrome · DPR 1 · visible): 팔레트 클릭으로 6종을 놓음 → 세 field 의 Input 이 Canvas 와 Preview 에서 같은 상자 (field 기준 x · y · 폭 · 높이 ≤ 1px) · padding · 글꼴 · 모서리 — md · xl · sm · side 라벨 → Preview 의 hover (테두리색) · focus (2px outline + 테두리색) · invalid · disabled (root 0.38 · 입력칸 1) → quiet → Preview 에서 글자를 넣으면 값이 들어간다 → Components page 의 Input 원본에 테두리색 · 모서리 0 을 두 번 쓰면 세 field 가 양쪽에서 바뀐다 → TextField 의 Input 에만 쓰면 그것만 → undo 로 처음 값. 콘솔 오류 0.
- 대조군: 같은 스크립트를 main 빌드 (5173) 에 돌려 Preview 의 computed style 을 비교했다. 다른 것은 위 변화 목록의 항목과, 컨테이너가 상자를 그리는 세 field 의 안쪽 입력칸 focus `outline-offset` (0 → −1px, outline 이 `none` 이라 보이지 않음) 뿐이다. quiet 는 세 field 모두 같다.
- Builder 화면 자체: 두 빌드에서 세 화면 상태의 입력칸 computed style 을 비교했다 — TextField 를 선택한 Builder (Components 검색 · AI 입력 · Design 패널, 14개) · Data · Data Editor · Interactions 패널을 연 뒤 (14개) · 새 프로젝트 대화상자 (2개) · 속성 패널 입력칸의 focus 상태. 차이 0. (처음에는 `base.css` 블록만 지워 패널 입력칸의 폭 · 모서리가 달라졌고, 이 비교에서 잡았다.)
- G6: `pnpm gate:perf-ratchet` 통과 (커밋 `57f5df660`, 시드 60 · 600 — A등급 증가 0). `scene.build` Δ 와 initial 번들은 Phase 3 끝에서 전환 전 빌드와 교대로 잰다.
- 한계: Components page 열기 · 값 쓰기 · size 변경은 패널이 내는 것과 같은 호출로 했다. Preview 의 hover 는 Preview 문서 안 PointerEvent 로 줬다. Builder 화면의 비교는 위 세 상태에서 보이는 입력칸까지다. 나머지는 코드로 확인했다: 로그인 화면 · Builder 검색칸 · 필드 템플릿 입력은 자기 CSS 가 테두리 · padding · outline 을 직접 정하고 (`builder-system` layer), 글꼴 · 아이콘 선택기 · 캔버스 간격 입력은 자기 class 를 써서 `.react-aria-Input` 에 걸리지 않는다.

**남긴 것**

- Preview 에서 원본 override 로 쓴 테두리색 · 배경은 inline 이라 hover · focus · invalid 색을 덮는다 (G1 의 「Preview 상태별 값」 판정과 같은 채널 문제 — 본문 Status).
- quiet 변형 (위) · TextArea 의 quiet.
- ComboBox · NumberField · SearchField 의 delegation 은 지금 아무도 읽지 않는 `--input-*` bridge 를 아직 적고 있다 (직접 선언이 같이 있어 화면은 같다). Group · Button 단계에서 delegation 과 함께 지운다.

### Phase 3 (3b) DateInput — Group · Button 단계로 옮김 (2026-10-06)

DateInput 은 DateField · TimeField 만 먼저 바꾸지 않고, picker 2종 (DatePicker · DateRangePicker) 의 Group · Button 과 한 번에 바꾼다. 순서만 바뀌고 Phase 3 의 범위는 그대로다.

- DateInput rule 이 자기 stylesheet 를 내면 selector 는 `.react-aria-DateInput` 이고, picker 안의 DateInput (shared `DatePicker.tsx` · `DateRangePicker.tsx` 가 조립하는 요소 — `data-size` 없음) 에도 닿는다. 두 picker 의 delegation 은 그 요소에 padding · border · background · font-size 만 적는다 (`T` DatePicker · DateRangePicker 의 `.react-aria-DateInput` bridge). 적지 않은 것이 새로 걸린다: 줄 높이 (지금은 Group 의 것을 물려받는다 — md 밖 크기에서 높이가 바뀐다) · hover 배경 (`[data-hovered]:not(…)` 의 특이도가 picker 의 `background: transparent` 보다 높다) · DateRangePicker 의 `display` (지금 block).
- Canvas 도 같다: picker 의 DateInput 노드는 지금 rule 상자를 쓰지 않는다 (`manualBoxRules` 의 DateInput `replace`). rule 이 상자를 내면 picker 의 DateInput record 에 줄 높이가 생기고, partRule 컴파일은 `inherit` 을 옮기지 못한다.
- 그래서 DateField · TimeField 만 바꾸려면 두 picker rule 에 「새 규칙을 되돌리는」 선언과 Canvas 특례를 임시로 넣어야 하고, 그것은 다음 단계에서 picker 의 delegation · template 을 다시 쓸 때 전부 지운다. Phase 2 에서 TextField 의 delegation 정리를 TextArea 와 같이 하려고 미룬 것과 같은 판단이다.
- 같이 옮기는 것: DateSegment (4 부모가 각자 적는 조각 모양 — DateInput 의 내부 조각이고 Canvas 가 부모 delegation 에서 읽는다) · `.inset` utility (지금 쓰는 곳은 DateField · TimeField 의 DateInput 과 `Field.tsx` 의 Input 뿐 — DateInput 이 자기 sheet 를 가지면 utility 를 지울 수 있다) · DateInput 과 Input 의 hover 차이 (DateInput 은 `.inset` 이라 배경도 바뀌고, Input 은 테두리색만 — 지금 화면 그대로 두었다. 하나로 모을 때 변화 목록에 적는다).

### 2026-10-06 — Phase 3 (4a) NumberField: Group · Input · Button (브랜치 `adr-253`)

(4) 는 부모마다 나눠 커밋한다 — NumberField → ComboBox → SearchField → Select → 날짜 4종 (DateInput). 이 절은 첫 부모와, 뒤 부모들이 같이 쓰는 기반이다.

**구현하면서 정한 것 (뒤 부모 공통)**

- **wrapper 노드의 type 은 그대로 `SelectTrigger`** 다. field 의 RAC Group (ComboBox · SearchField 는 container `div`) 자리이고, shared 컴포넌트가 그 요소를 계속 만든다. catalog 의 `Group` type 은 팔레트에 놓는 ARIA Group (label · role · orientation 을 명시로 넘기는 binding) 이라 field 안 Group 에 쓰면 DOM 구조와 RAC context 가 달라진다. wrapper 는 배치만 한다: `SelectTrigger` rule 에 `plain` variant (칠 · padding · border 0) 를 두고 전환한 부모의 template 이 그것을 쓴다. wrapper 의 편집은 계속 부모로 돌린다 (2026-09-03 판정 유지 — §2-2 8번 「배치는 부모에 남긴다」). type 이름 정리는 Phase 6 후보.
- **wrapper 안이 부품 instance** 다: 입력칸 = Input 원본 · 버튼 = Button 원본 (자식으로 Icon 노드). 크기는 field → wrapper → 부품으로 내려간다 (`CATALOG_SIZE_PROPAGATION`).
- **합성 자리의 자식은 접히는 루트의 규칙을 받는다** (`resolver.ts` `projectTemplate`). template 의 Button instance 자리에 Icon 을 자식으로 적으면 consumer tree 에서는 Button 루트의 자식이 되는데 (`collapsedChildren`), 규칙의 부모는 합성 정의로 남아 Button 의 자식 규칙 (Icon 크기 · 색) 이 닿지 않았다. 루트가 자식을 갖지 않는 원본 (Button) 에는 이것으로 충분하다. 기본 자식이 있는 원본 (ListBox) 을 「채우는」 표현은 Phase 4 그대로다.
- **Button 의 색은 sheet 가 그린다.** Button 노드는 해석 값 전체를 inline 으로 냈고, 그 배경 · 테두리색 · 글자색이 sheet 의 hover · pressed 색을 덮고 있었다 — Preview 의 모든 Button 이 hover 에서 배경이 바뀌지 않았다 (page 에 놓은 Button 포함, live 확인). 증감 버튼이 Button instance 가 되면 그 표시를 잃으므로 같이 고쳤다: 세 색은 문서가 쓴 값 (원본 override · 자기 값) 일 때만 inline 이다. 문서가 disabled 로 둔 Button 은 종전대로 쉬는 색을 inline 으로 둔다 — Canvas 는 disabled Button 을 쉬는 색 × 0.38 로 그리고, 공용 `.button-base` sheet 는 색도 바꾼다 (수동 CSS — Builder 화면이 같이 쓴다). disabled field 안의 Button 은 field root 가 한 번 흐리므로 다시 흐리지 않는다 (입력칸과 같은 처리).
- Button 의 Canvas 레이아웃에 `justifyContent: center` (생성 sheet 는 이미 가운데 — 내용보다 넓은 Button 의 자식 위치가 달랐다). Button 안 Icon 의 DOM 상자는 glyph 크기 (`utilities.css` — Icon sheet 의 기본 높이 24px 가 Button 이 정한 glyph 크기와 무관하게 남아 있었다).
- 모서리 radius 와 모서리별 radius 를 같이 inline 으로 내면 React 가 다시 그릴 때 shorthand 가 longhand 를 덮는다 (증감 버튼의 각진 모서리가 둥글어졌다 — live 에서 드러남). 네 모서리 longhand 로 낸다.

**변화 목록 (G0 ① — px, 전환 전 빌드 5173 과 Preview 대조)**

| 항목                                | 전                                                                                     | 후                                                                                                                                                              | 근거                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 상자를 칠하는 주체                  | Group (테두리 · 배경 · padding 4 4 4 12 — md)                                          | 입력칸 (Input 원본 — padding 4 12 · 테두리 · 배경). Group 은 칠 · padding 없음                                                                                  | §2-2 5번                                 |
| 입력칸의 모서리                     | Group 6px (전 크기)                                                                    | 왼쪽 = Input rule 의 크기 단계 (xs 2 · sm 4 · md 6 · lg 8 · xl 12), 버튼 쪽 0                                                                                   | §2-2 5번 「버튼 쪽 모서리 0」            |
| 증감 버튼                           | 상자 안의 작은 버튼 (md 18 × 18 · 배경 `bg-overlay` · 그림자 · 테두리 없음 · 모서리 2) | Button secondary — control 높이의 정사각형 (xs 20 · sm 22 · md 30 · lg 42 · xl 54), 테두리 1px, 이웃과 1px 겹침. 감소 버튼 모서리 0 · 증가 버튼 바깥쪽만 둥글다 | §2-2 7번                                 |
| 증감 glyph                          | md 16px (자체 단계 10 · 12 · 16 · 18 · 22)                                             | Button 의 glyph 단계 (14 · 16 · 18 · 24 · 28)                                                                                                                   | Button 원본의 instance                   |
| focus 표시                          | Group 둘레 outline                                                                     | 입력칸 자신의 outline (Input sheet) · 버튼은 Button 의 focus 표시                                                                                               | 부품이 자기 상태를 그린다                |
| hover                               | Group 테두리 · 배경                                                                    | 입력칸의 테두리색 (Input sheet) · 버튼의 배경 (Button sheet)                                                                                                    | 같음                                     |
| disabled field                      | root 0.38 × Group 0.38                                                                 | root 0.38 한 번                                                                                                                                                 | Canvas 와 같다 (입력칸 단계와 같은 수리) |
| Preview 의 placeholder              | 없음                                                                                   | `0` (노드의 값 — Canvas 는 이미 그렸다)                                                                                                                         | 같은 노드를 그린다                       |
| Preview 의 Button hover (전 Button) | 배경이 바뀌지 않음                                                                     | sheet 의 hover · pressed 색                                                                                                                                     | 위 「Button 의 색」                      |

field 높이 (md 56) · control 높이 (20 · 22 · 30 · 42 · 54) · side 라벨 배치는 전과 같다.

**구현**

- library: NumberField `__2` (wrapper, `variant: plain`) 아래 `__2_1` = Input instance (`placeholder: "0"` · 버튼 쪽 모서리 0), `__2_2` · `__2_3` = Button instance (`slot` · `variant: secondary` · `children: ""` · padding 0 · 모서리) 와 그 Icon 자식 (`__2_2_1` · `__2_3_1`). contract 는 이 Phase 의 4 그대로.
- 값 (`T`): NumberField 의 delegation 은 배치만 — Group `display · width`, Input `flex · min-width`, Button `flex · width · height (크기별 변수) · min-width · margin-inline-start −1px`. Group 의 칠 · 상태 6종 · disabled 변형 · `--nf-group-*` · `--nf-input-*` · 죽은 `--input-*` bridge 를 지웠다. quiet 는 TextField 와 같은 입력칸 모양.
- Canvas: `SUBPART_TOKENS` 의 NumberField 는 wrapper 만 — Input · Button 은 자기 class token 으로 wrapper 를 거쳐 (`via`) 닿는다.
- DOM: `numberfield` binding 이 wrapper 안 부품 노드의 요소를 shared 컴포넌트의 `controlElements` 로 넘긴다 (Group 은 컴포넌트가 만든다). Button binding 은 `slot` 을 넘기고 `isDisabled` · `autoFocus` 는 문서가 쓴 값일 때만 넘긴다 (본문 Decision 5 ② ③ · R10).
- 판정: 입력칸은 텍스트 축만 field 소유 (wrapper 를 건너 판정). 증감 버튼은 자기 것 (Toolbar 안 Button 과 같다). wrapper 는 field 소유.
- Builder 화면 자체: 속성 패널의 숫자 입력칸 (`form-controls.css`) 이 테두리 · 모서리 · padding 을 직접 정한다 — 종전에는 NumberField sheet 가 안쪽 입력칸의 상자를 없앴다.

**검증**

- unit `adr253FieldPartsDom.test.ts` 302건 (+2): DOM 구조 대조 13 조합은 전환 전 빌드와 같다 — Button 노드의 표지 (`button-base` · `data-variant` · `data-size` …) 와 glyph 마크업 (Icon 노드 ↔ 컴포넌트가 그리던 svg) · 입력칸의 placeholder 는 명시한 차이. wrapper 가 칠하지 않음 · 부품이 원본 instance · Canvas 상자 (입력칸이 Group 을 채움 · 버튼 30 × 30 · 1px 겹침 · glyph 가운데) · DOM 의 Group 자식이 그 노드들 · 값 0 (= 최솟값) 에서 감소만 disabled · 최솟값을 내리면 둘 다 enabled · disabled field 에서 둘 다 disabled 이고 쉬는 색 + 흐림 없음 · size xl → 54 · glyph 28 · Button 원본 / Input 원본 편집 → Canvas · DOM · 판정 축. Button 의 inline 색 (쉬는 상태 · secondary · outline 은 없음 · disabled 는 있음 · 원본 override 만 inline).
- 정적: NumberField 의 delegation 은 배치 키만 · 상태 선언 0 · disabled 변형 0.
- 원복 RED 11종: 합성 자리 자식의 규칙 부모 · `isDisabled: false` 명시 (12) · `slot` 누락 (12) · wrapper → 부품 size 전달 · Button `justifyContent` · DOM 이 control 을 자기가 조립 (12) · wrapper 의 `plain` · 모서리 longhand · Button 색 항상 inline (2) · disabled field 구분 · conditional 규칙을 authored 로 셈.
- 회귀: `pnpm type-check` · shared 1,499 · rendering 1,379 · builder 4,453 · publish 11 통과. 고친 기대값: `borderWidthLiteral` (outline 17 → 13) · `resolveCatalogPaint.shadow` (variant +1 → 8,460) · `phase4eOriginView` (증감 glyph 단계) · `phase4e11PreviewFollow` (Group padding → 배치 전용) · `phase4AuthoredPaint` (모서리 longhand).
- 시각 하니스: 70건 중 69 통과. **NumberField-top · NumberField-side 가 통과한다** (전환 전부터 있던 실패 — 증감 glyph 가 Canvas 18 · DOM 16 이고 x 가 21px 달랐다. 이제 같은 Icon 노드다, Canvas ↔ DOM 최대 0.01px). 남은 실패 1건은 CardView (이 ADR 과 무관, 전과 같다). old/new 비교의 NumberField 는 `numberfield-input-and-stepper-parts` · `numberfield-stepper-glyph-node` 로 승인 기록에 넣었다.
- live `apps/builder/scripts/adr253-p3-control-live.mjs` 10/10 (worktree 빌드 5175 · headed Chrome · DPR 1 · visible): 팔레트 클릭으로 NumberField · TextField · Button 을 놓음 → wrapper · 입력칸 · 버튼 2 · glyph 2 의 상자 (field 기준 ≤ 1px) · 모서리 네 곳 · 테두리 · 배경이 Canvas 와 Preview 에서 같다 — md · xl · xs · sm · lg · side 라벨 → Preview 에서 증가 2번 (0 → 1 → 2) · 감소 (→ 1) · 값 0 에서 감소 disabled · disabled field (둘 다 disabled · root 0.38 · 버튼 흐림 1 · 쉬는 색) · readOnly (값 그대로) · 버튼 hover (배경이 바뀜 — page 의 Button 도) · 입력칸 focus (2px outline) → Components page 에서 Button 원본의 배경 · 테두리색, Input 원본의 테두리색을 쓰면 증감 버튼 2 · 입력칸이 양쪽에서 바뀜 → undo 로 처음 값. 콘솔 오류 0.
- 대조군: 같은 스크립트를 `BEFORE=1` 로 main 빌드 (5173) 에 돌려 Preview 의 수치를 떴다 (위 변화 목록). Builder 화면 자체: 두 빌드에서 Design 패널의 RAC NumberField 8개 (NumberField · TextField · Slider 를 선택했을 때) 의 root · group · input computed style — 차이 0 (`form-controls.css` 를 고치기 전에는 테두리 1px · 모서리 6 · padding-right 12 · 높이 16 → 18 로 달라졌고 이 비교에서 잡았다).
- 한계: Components page 열기 · 값 쓰기 · size 변경은 패널이 내는 것과 같은 호출로 했다. Preview 의 클릭 · hover 는 Preview 문서 안의 이벤트로 줬다.

**남긴 것**

- 값 한계 · readOnly 로 RAC 가 disabled 로 만든 증감 버튼은 Preview 의 실행 상태다 (sheet 의 disabled 색). Canvas 는 쉬는 모습을 그린다 — 전환 전에도 같았다 (Canvas 는 glyph 를 쉬는 색으로 그렸다).
- xs 에서 입력칸의 모서리 (Input rule 2px) 와 증가 버튼의 모서리 (Button rule 4px) 가 다르다 — 두 rule 의 xs 값 차이다.
- 증감 버튼만 놓고 쓰는 Button (Icon 만 있는 Button instance) 을 늘여 놓으면 (stretch) Canvas 가 자식을 다시 가운데에 두지 않았다 (1px). 버튼에 높이를 명시해 피했다 — 엔진 쪽 확인이 남는다 (재현: flex row 의 stretch 된 inline-flex 자식 + `alignItems: center` 자식).
- 원본을 고칠 때의 영향 안내가 여전히 page 의 instance 만 센다 (「1 instance」 — 증감 버튼 2개는 세지 않음).
- 문서 노드 쪽 (page 에 놓은 instance 가 직접 가진 자식) 의 규칙 부모는 그대로다 — 이번에 고친 것은 library template 의 합성 자리다.

### 2026-10-06 — Phase 3 (4b) ComboBox: container · Input · FieldButton (브랜치 `adr-253`)

**구현하면서 정한 것**

- **FieldButton 원본** (`origin-component-fieldbutton`): template 루트가 Button 원본의 instance (`variant: secondary`) 이고 그 자리에 모양을 적는다 — 배경 `var(--accent-subtle)` · 테두리 0 · 모서리 4 · padding 0. 자식은 Icon 하나 (`{icon}` — 기본 `chevron-down`). 동명 primitive 가 없는 원본이라 `BASE_PART_DERIVED_ORIGINS` 로 따로 적고 Components page 의 부품 칸에 같이 그린다. Button 원본을 고치면 FieldButton 에도 닿고 (FieldButton 이 적은 값이 그 위), FieldButton 을 고치면 그 instance 전부가 바뀐다.
- **문서가 쓴 Button 색은 sheet 의 변수로 낸다.** FieldButton 의 배경처럼 template · 원본 override 가 쓴 색을 `background-color` 로 inline 에 내면 hover · pressed 색을 덮는다 (입력칸 단계에서 남긴 문제와 같다). `.button-base` 는 `--button-color` · `--button-border` · `--button-text` 를 읽고 hover · pressed 를 그 값에서 만든다 (`color-mix`). 그래서 문서가 쓴 배경 · 테두리색 · 글자색을 그 변수로 내고 variant 가 명시한 hover / pressed 변수는 푼다 (`initial`). 원본 override 로 Button 의 배경을 바꿔도 hover 가 그 색에서 나온다. outline Button 의 배경과 fill layer 는 종전대로 property 다 (sheet 가 변수를 읽지 않는 자리). 본문 Status 의 「Preview 상태별 값」 판정 (문서가 쓴 상태별 값의 채널) 과는 다른 일이다 — 여기는 쉬는 색에서 상태 색이 나오게 한 것이다.
- 버튼은 입력칸 위에 겹친다: 입력칸이 container 를 다 채우고 (끝 쪽 padding = 자기 padding + 버튼 폭), 버튼은 음수 margin 으로 그 자리에 놓인다 (레퍼런스의 배치). 버튼 크기와 padding 은 크기별 변수다 (xs 16 · sm 18 · md 22 · lg 34 · xl 46 — control 안쪽 2px (xs · sm) / 4px).
- field 의 `placeholder` · `iconName` 은 template 자리표시로 부품에 내려간다 (ComboBox 원본이 두 키를 받는다고 선언). 종전에는 SelectValue 의 literal 과 presence 의 파생 값이었다.
- Preview 의 ComboBox 는 항목이 없어 열리지 않는다 (F11 — 이 빌드와 전환 전 빌드 모두 `aria-expanded` 가 `false` 로 남는다). 버튼의 연결 (`aria-haspopup` · context 의 press) 은 unit 으로 확인했고, 여는 동작은 Phase 4 에서 항목이 생긴 뒤 본다.

**변화 목록 (G0 ① — px, 전환 전 빌드 5173 과 Preview 대조)**

| 항목               | 전                                                                                 | 후                                                                                                   | 근거                      |
| ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| 상자를 칠하는 주체 | container (테두리 · 배경 · padding 4 4 4 12 — md)                                  | 입력칸 (padding 4 34 4 12 — md · xl 12 70 12 24). container 는 칠 · padding 없음                     | §2-2 5번                  |
| 상자의 모서리      | 6px (전 크기)                                                                      | Input rule 의 크기 단계 (xs 2 · sm 4 · md 6 · lg 8 · xl 12)                                          | §2-2 5번                  |
| 버튼               | md 18 × 18 · 배경 `bg-overlay` · 그림자 · 모서리 6 (xs 10 · sm 14 · lg 22 · xl 28) | FieldButton — md 22 × 22 · 옅은 강조색 배경 · 그림자 없음 · 모서리 4 (xs 16 · sm 18 · lg 34 · xl 46) | §2-2 7번                  |
| glyph              | 버튼 크기와 같다 (xs 10 · sm 14 · md 18 · lg 22 · xl 28)                           | Button 의 glyph 단계 (14 · 16 · 18 · 24 · 28)                                                        | Button 원본의 instance    |
| focus · hover      | container 의 outline · 테두리                                                      | 입력칸 자신 (Input sheet) · 버튼은 자기 배경에서 나온 hover 색                                       | 부품이 자기 상태를 그린다 |
| disabled field     | root 0.38 × container 0.38                                                         | root 0.38 한 번                                                                                      | Canvas 와 같다            |

**구현**

- library: `origin-component-fieldbutton` (+ template 2) · ComboBox `__2` (wrapper `plain`) 아래 `__2_1` = Input instance (`placeholder: "{placeholder}"`), `__2_2` = FieldButton instance (`icon: "{iconName}"`). ComboBox 원본의 `accepts` 에 `placeholder` · `iconName`.
- 값 (`T`): ComboBox 의 delegation 은 배치만 — container `display · align-items · width`, Input `min-width · padding-right (크기별)`, Button `flex · width · height · min-width · margin-inline-start (크기별)`. container 의 칠 · 상태 7종 · `--combo-container-*` · `--combo-input-*` · 버튼의 칠 · 상태 4종을 지웠다. quiet 는 입력칸 모양.
- DOM: `combobox` binding 이 wrapper 안 부품 노드의 요소를 `controlElements` 로 넘긴다. Button 의 테두리를 문서가 없앤 경우 (`borderWidth: 0`) inline 으로 낸다 (sheet 가 모든 Button 에 테두리를 준다).
- Builder 화면 자체: 속성 패널의 단위 입력 (`.react-aria-UnitComboBox` — RAC ComboBox 를 직접 조립) 이 생성 ComboBox.css 의 container 배치 · 입력칸 상자 제거 · 버튼 모양에 기대고 있었다. 그 값을 `form-controls.css` 에 직접 적었다.

**검증**

- unit `adr253FieldPartsDom.test.ts` 303건 (+1): ComboBox 의 DOM 구조 대조 13 조합은 전환 전 빌드와 같다 (Button 표지 · glyph 마크업은 명시한 차이). 부품이 원본 instance (FieldButton 은 두 층으로 접힘) · Canvas 상자 (입력칸이 container 를 채움 · 버튼 22 × 22 · 끝에서 4px · glyph 가운데) · `placeholder` / `iconName` → 부품 · DOM 의 container 자식이 그 노드들 (`role=combobox` · `aria-haspopup`) · 버튼의 배경이 변수 (`--button-color` · hover 는 `initial`) 이고 테두리 0 · size xl · FieldButton 원본 편집과 Button 원본 편집 (FieldButton 이 적지 않은 글자색) → Canvas · DOM · 판정 축.
- 정적: ComboBox 의 delegation 은 배치 키만 (`align-items` · `padding-right` 추가) · 상태 선언 0.
- 원복 RED 6종: 문서가 쓴 배경을 property 로 (2) · DOM 이 control 을 자기가 조립 · 입력칸 placeholder 자리표시 · 테두리 0 미출력 · FieldButton 루트를 type 노드로 · size 전달.
- 회귀: `pnpm type-check` · shared 1,499 · rendering 1,379 · builder 4,454 · publish 11 통과. 고친 기대값: `borderWidthLiteral` (outline 13 → 9) · `phase4eOriginView` (ComboBox glyph 는 FieldButton 안 Icon) · `phase4e11PreviewFollow` (버튼 `min-width: 0` · glyph 노드).
- 시각 하니스: 70건 중 69 통과 (남은 1건 CardView — 무관). ComboBox 의 Canvas ↔ DOM 최대 0.014px. old/new 비교는 `combobox-input-and-field-button-parts` · `field-button-glyph-node` 로 승인 기록에 넣고, 쓰는 곳이 없어진 `field-button-size` 를 지웠다.
- live `adr253-p3-control-live.mjs` 11/11 (`PALETTE="combo box,number field,button" TYPES=ComboBox,NumberField`, 5175 · headed Chrome · DPR 1 · visible): 두 field 의 wrapper · 입력칸 · 버튼 · glyph 상자 · 모서리 · 테두리 · 배경 (theme 변수는 Preview 가 계산한 색으로 비교) 이 Canvas 와 Preview 에서 같다 — 5 크기 · side 라벨 → ComboBox: 버튼 hover (배경이 바뀜) · 입력칸 focus (2px outline) · disabled field (버튼 disabled · root 0.38 · 버튼 흐림 1 · 쉬는 색) · required (전환 전과 같다 — blur 만으로는 오류 문구 없음) → Components page 에서 FieldButton · Button · Input 원본을 고치면 ComboBox 의 버튼 · NumberField 의 버튼 2 · 두 입력칸이 양쪽에서 바뀜 → undo. 콘솔 오류 0.
- 대조군: `BEFORE=1` 로 main 빌드 (5173) 의 Preview 수치와 ComboBox 동작 (열기 · required) 을 떴다 — 열기 · required 결과는 두 빌드가 같다. Builder 화면 자체: Design 패널의 Property · Layout · Style · Text 탭에서 RAC NumberField · UnitComboBox 의 root · container · input · button · glyph computed style 157건 — 차이 0 (`form-controls.css` 를 고치기 전에는 46건이 달랐다).
- G6: `pnpm gate:perf-ratchet` (커밋 `0f903794f`, NumberField 단계) 판정 pass — A등급 증가 0. B등급 경고 1 (`seeds.600.edit.B.cdp.LayoutCount` 20 → 25, 한도 22). `scene.build` Δ 와 initial 번들은 Phase 3 끝에서 잰다.

**남긴 것**

- ComboBox 의 여는 동작 (항목이 생기는 Phase 4).
- xl 에서 버튼의 모서리 (4px 고정) 와 입력칸의 모서리 (12px) — FieldButton 의 모서리는 크기를 따르지 않는다 (레퍼런스는 한 크기).
- `SelectTrigger` 의 칠하는 variant (`default` · `accent` · `negative`) 와 `SelectValue` · `SelectIcon` 은 아직 SearchField · Select · picker 2종이 쓴다 — 그 부모들을 바꾼 뒤 정리한다.

### 2026-10-06 — Phase 3 (4c) SearchField: container · glyph · Input · Button (브랜치 `adr-253`)

**구현하면서 정한 것**

- container (`SelectTrigger` 노드 `plain`) 안이 **검색 glyph (Icon 노드) · Input 원본의 instance · Button 원본의 instance (지우기 버튼)** 다. 상자는 입력칸이 그리고 (container 를 채운 알약 모양 — 레퍼런스의 SearchField), glyph 와 지우기 버튼은 입력칸 위에 겹친다: glyph 는 음수 margin 으로 입력칸 시작 안쪽에 놓이고 `zIndex: 1` 로 위에 그려진다 (입력칸의 시작 쪽 padding = glyph 자리), 지우기 버튼은 끝 안쪽의 원이다 (ComboBox 버튼과 같은 배치).
- 지우기 버튼은 FieldButton 이 아니라 Button 원본의 instance 에 자리에서 모양을 적는다 (`variant: primary` · 배경 `var(--fg-muted)` · 테두리 0 · 원 · padding 0 · glyph 12px). 레퍼런스의 지우기 버튼은 다른 field 버튼과 모양이 다른 한 벌이라 원본을 따로 두지 않았다. Button 원본의 배경을 고쳐도 이 자리가 적은 배경이 위다 (테두리색 · 글자색처럼 적지 않은 값은 원본을 따른다).
- **빈 값이면 지우기 버튼이 없다** — Canvas 는 presence (`SearchField > SelectTrigger > Button` · field 의 `value` 가 비었을 때 hidden), DOM 은 RAC 의 `data-empty` 와 부모 rule 의 `empty` 변형 (`display: none`). 그 Button 은 `display` 를 inline 으로 내지 않는다 (inline 값이 sheet 의 `display: none` 을 덮는다 — live 에서 실행 중 비웠을 때 버튼이 남는 것으로 드러났다).
- **Canvas 가 field 의 값을 입력칸에 그린다.** SearchField 의 `value` 는 입력칸의 처음 값이다 (renderer 의 `defaultValue`). Canvas 의 Input 은 `placeholder` 만 그리므로 값이 있으면 그 값을 파생 값으로 준다 (`catalogDerivedProps`). 전환 전에는 값이 있으면 Canvas 가 입력칸을 비워 그렸다.
- **Canvas 의 Input 글자는 문서가 쓴 좌우 padding 안에 놓인다.** rule 노드의 글자 x 는 rule 크기의 `paddingX` 만 읽고 있었다 — 부모 rule 이 준 `padding-left` (glyph 자리) 가 상자에는 들어가고 글자에는 닿지 않아 glyph 와 글자가 겹쳤다 (live 확대 화면에서 발견). `catalogRulePaint` 가 문서가 쓴 `paddingLeft` · `paddingRight` 를 양쪽 다 풀어 넘긴다. ComboBox 의 끝 쪽 padding 도 같은 수정으로 글자 폭에 닿는다 (글자가 버튼 밑으로 들어가지 않는다).
- **`var(--fg-muted)` 같은 CSS 변수 색을 Canvas 가 푼다.** template 이 쓴 `var(--name)` 색은 이름이 같은 색 token 으로만 풀렸다 (`--accent-subtle`). 변수와 token 의 이름이 다른 색 (`--fg-muted` ← `neutral-subdued`) 은 `colorTokenOfCssVar` 로 token 을 찾는다 (live 의 Canvas 오류 `CATALOG_CSS_VAR_COLOR_UNRESOLVED` 로 드러났다).
- 입력칸의 `type` 은 TextField 일 때만 문서 값을 넘긴다 — 다른 field 는 RAC context 가 정한다 (SearchField 의 `search`).
- field 의 `placeholder` 는 template 자리표시로 입력칸에 내려간다 (SearchField 원본이 받는다고 선언). SearchField 의 rule 에는 xs 크기가 없다 (종전과 같다).

**변화 목록 (G0 ① — px, 전환 전 빌드 5173 과 Preview 대조 · md)**

| 항목                | 전                                                         | 후                                                                                   | 근거                      |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| 상자를 칠하는 주체  | container (테두리 · 배경 · padding 4 4 4 12 · 모서리 6)    | 입력칸 (container 를 채움 · padding 4 32 · 모서리 9999). container 는 칠 · padding 0 | §2-2 (레퍼런스 알약 모양) |
| 글자 시작 x         | 33                                                         | 33 (테두리 1 + padding 32)                                                           | 같다                      |
| 지우기 버튼         | 18 × 18 · 배경 `bg-overlay` · 그림자 · 모서리 6 · glyph 16 | 16 × 16 원 · 배경 옅은 글자색 (`fg-muted`) · 그림자 없음 · glyph 12 (흰색)           | 레퍼런스                  |
| 지우기 버튼 (빈 값) | 양쪽 다 없음 (Canvas presence · DOM `data-empty`)          | 같다 — 판정 대상만 Button 노드로 바뀜                                                | RAC `data-empty`          |
| 값이 있을 때 Canvas | 입력칸이 비어 보임                                         | 값을 그림                                                                            | DOM 과 같다               |
| focus · hover       | container 의 outline · 테두리                              | 입력칸 자신 (Input sheet) · 버튼은 자기 배경에서 나온 hover 색                       | 부품이 자기 상태를 그린다 |
| disabled field      | root 0.38 × container 0.38                                 | root 0.38 한 번                                                                      | Canvas 와 같다            |

**구현**

- library: SearchField `__2` (wrapper `plain`) 아래 `__2_1` = Icon (`search` · 색 `var(--fg-muted)` · `zIndex: 1`), `__2_2` = Input instance (`placeholder: "{placeholder}"` · 모서리 9999), `__2_3` = Button instance (지우기 — 자리에서 적은 모양) + 자식 Icon `x` (12px). SearchField 원본의 `accepts` 에 `placeholder`.
- 값 (`T`): SearchField 의 delegation 은 배치만 — container `display · align-items · width`, glyph `flex · margin (크기별 자리)` 와 svg 크기, Input `min-width · padding-left · padding-right (크기별)`, Button `flex · width · height · min-width · margin-inline-start (크기별)`. container 의 칠 · 상태 선언과 `.search-icon` · 버튼의 칠을 지웠다. quiet 는 입력칸 모양. `empty` 변형 (버튼 숨김) 은 남는다.
- 판정 · 전달: `SUBPART_TOKENS.SearchField` (container · glyph 2 selector) · 크기 전달 `WRAPPED_FIELD_PARTS` · presence (지우기 버튼 · 값 파생) · `CATALOG_WRAPPED_CONTROL_FIELDS` 에 `searchfield`.
- DOM: `searchfield` 가 wrapper 안 부품 노드의 요소를 `controlElements` 로 넘긴다 (shared `SearchField` 가 container 안에 그린다). 지우기 버튼은 RAC context 의 Button 이다 (label · press 로 비우기).
- Builder 화면 자체: Builder 의 검색칸은 전부 자체 class 다 (`builder-search-field` · `icon-picker-search`) — 생성 SearchField.css 의 selector (`.react-aria-SearchField …`) 가 닿지 않는다 (코드로 확인, 고칠 곳 없음).

**검증**

- unit `adr253FieldPartsDom.test.ts` 304건 (+1): SearchField 의 DOM 구조 대조 13 조합은 전환 전 빌드와 같다 (glyph 마크업 · Button 표지는 명시한 차이). 부품 type [Icon · Input · Button] · 원본 instance · Canvas 상자 (입력칸이 container 를 채움 · glyph 8,7 16 × 16 · `zIndex 1`) · 글자 위치 (x 32 · 끝 padding 32 — ComboBox 는 x 12 · 끝 34) · 빈 값이면 지우기 버튼 hidden, 값이 있으면 16 × 16 원 (끝에서 8px) · 값 파생 (넣기 → 비우기 → 넣기) · `placeholder` 전달 · DOM (container 자식이 그 노드 · `type=search` · `value` · 버튼 배경 변수 · inline `display` 없음 · glyph `z-index: 1`) · `var(--fg-muted)` 가 light / dark 에서 풀림 · size xl · Input / Button 원본 전파 · 판정 축.
- 정적: SearchField 의 delegation 은 배치 키만 (`padding-left` 추가) · 상태 선언 0.
- 원복 RED 9종: 지우기 버튼 presence · 값 파생 · 좌우 padding 의 글자 위치 · CSS 변수 색 token · 버튼 inline `display` · 입력칸 `type` · size 전달 · glyph selector · control 조립.
- 회귀: `pnpm type-check` · shared 1,499 · rendering 1,379 · builder 4,455 · publish 11 통과. 고친 기대값: `borderWidthLiteral` (outline 9 → 7).
- 시각 하니스: 70건 중 69 통과 (남은 1건 CardView — 무관). old/new 비교는 `searchfield-glyph-input-and-clear-parts` 로 승인 기록에 넣고 (`searchfield-icon-clear` 를 대체), `field-button-glyph-node` 에 SearchField 를 더했다.
- live `adr253-p3-control-live.mjs` 12/12 (`PALETTE="search field,combo box,number field,button" TYPES=SearchField,ComboBox,NumberField`, 5175 · headed Chrome · DPR 1 · visible): 세 field 의 wrapper · glyph · 입력칸 · 버튼 상자 · 모서리 · 테두리 · 배경이 Canvas 와 Preview 에서 같다 — 4 크기 (SearchField 는 xs 없음) · side 라벨 → SearchField: 값 「abc」 로 시작 (`type=search` · glyph 가 입력칸 안 · 위) → 지우기 버튼 hover (배경이 바뀜) → 누르면 비워지고 버튼이 사라짐 → 입력하면 다시 나타남 → 입력칸 focus (2px outline) → disabled field (버튼 disabled · root 0.38 · 버튼 흐림 1) → 문서 값을 비우고 Preview 를 다시 mount 하면 양쪽 다 버튼 없음 → Components page 에서 Button · Input 원본을 고치면 세 field 가 양쪽에서 바뀜 (SearchField 지우기 버튼은 테두리색만 — 배경은 자리가 적은 값) → undo. 콘솔 오류 0. 확대 화면 (`CLOSEUP=1`, mobile viewport 107%) 에서 Canvas 의 glyph · 값 글자 · 지우기 버튼이 겹치지 않는 것을 눈으로 확인했다.
- 대조군: `BEFORE=1` 로 main 빌드 (5173) 의 Preview 수치와 동작을 떴다 — control 의 바깥 상자 (0,28 1920 × 30) 와 글자 시작 x 는 같고, 나머지는 위 변화 목록이다.

**남긴 것**

- Canvas 가 값을 그리는 것은 SearchField 만이다. NumberField 의 `value` 등 다른 field 의 값 표시는 종전과 같다 (placeholder 를 그린다).
- 지우기 버튼의 크기 단계 (sm 14 · md 16 · lg 20 · xl 24) 는 부모 rule 의 배치 값이다 — Button 원본의 크기 단계를 쓰지 않는다 (ComboBox 버튼과 같다).
- `SelectTrigger` 의 칠하는 variant 와 `SelectValue` · `SelectIcon` 은 아직 Select · picker 2종이 쓴다 — 그 부모들을 바꾼 뒤 정리한다.

### 2026-10-07 — Phase 3 (4d) Select: trigger = Button instance (브랜치 `adr-253`)

**구현하면서 정한 것**

- **trigger 노드가 Button 원본 (secondary) 의 instance 다 — wrapper 가 없다.** RAC Select 의 trigger 는 Button 자체라 (`<Button><SelectValue/>glyph</Button>`) NumberField · ComboBox · SearchField 처럼 container 노드를 두지 않는다. template 의 `__2` 가 Button instance 이고 그 자리의 자식이 `SelectValue` (Select 의 자기 sub-part — type 노드 그대로) 와 Icon (`{iconName}`) 이다. 합성 자리의 자식은 (4a) 의 resolver 수정대로 가장 안쪽 루트 (Button type) 를 규칙 부모로 받는다.
- 칠 · 테두리 · 글자 · 상태 (hover · pressed · focus · disabled) 는 Button rule 의 것이다. Select rule 은 trigger 를 배치만 한다: `width 100%` · `min-width 0` · 끝 쪽 padding (크기별 — glyph 옆은 Button 자기 padding 보다 좁다, md 8 = 레퍼런스) · 값 ↔ glyph 간격 4 (사용자 결정 2026-09-29 — 지운 선언에 있던 값이라 배치 선언으로 남겼다).
- **부모 rule → wrapper 를 건넌 자식** 의 일반화: partRule 의 `via` 는 `SelectTrigger` 고정이었다. 부모별 wrapper (`SUBPART_WRAPPERS` — Select 는 Button) 로 바꿔 Select rule 의 `.react-aria-SelectValue` 선언이 `Select > Button > SelectValue` 에 닿는다. side 라벨의 control 자리 (`> :not(.react-aria-Label, …)`) 에 Button 을 더했다.
- **값 글자 (`SelectValue`)**: DOM 은 RAC `SelectValue` 를 그 노드에서 그린다 (RAC 가 고른 항목 글자 또는 Select 의 placeholder 를 쓴다). 색은 inline 으로 내지 않는다 — trigger 의 글자색을 상속하고 placeholder 는 부모 sheet (`[data-placeholder]`) 가 칠한다. 굵기는 400 을 Select rule 에 선언했다 — 선언이 없으면 Preview 만 Button 의 500 을 상속한다 (live 에서 Canvas 400 ↔ Preview 500 으로 드러났다. 전환 전 DOM 도 400).
- glyph 는 상자 없는 Icon 이다 (레퍼런스의 `ChevronDown`). 전에는 배경 · 그림자가 있는 chevron 상자였다. 크기는 Button rule 의 glyph 단계 (14 · 16 · 18 · 24 · 28 — lg 만 22 → 24).
- disabled field: RAC 가 trigger 를 disabled 로 만든다 (context). root 가 한 번 흐리고 (0.38) trigger 는 쉬는 색 그대로다 — 전에는 root 0.38 × trigger 0.38 · 다른 색.
- field 의 `placeholder` · `iconName` 은 template 자리표시로 내려간다 (Select 원본이 받는다고 선언). `iconName` 의 presence 파생 (SelectIcon) 은 picker 2종만 쓴다.
- quiet 변형 선언은 그대로 두었다 (Preview 의 select binding 이 `isQuiet` 를 넘기지 않아 닿지 않는다 — Phase 3 끝의 quiet 정리에서 다룬다).

**변화 목록 (G0 ① — px, 전환 전 빌드 5173 과 Preview 대조)**

| 항목            | 전                                                           | 후                                                                               | 근거                       |
| --------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------- |
| trigger 의 모양 | 입력 상자 (`bg-inset` · 테두리 · 모서리 6 고정)              | Button secondary (같은 배경 · 테두리색 — 모서리는 크기 단계 xs 4 · md 6 · xl 12) | §2-2 7번                   |
| 끝 쪽 padding   | xs 1 · md 4 · xl 12                                          | xs 2 · sm 4 · md 8 · lg 12 · xl 16                                               | 레퍼런스 md 8              |
| 바깥 상자       | md 1920 × 30 · xl 54 · xs 20                                 | 같다                                                                             | —                          |
| 값 글자         | x 13 · 굵기 400 · placeholder 는 `fg-muted` × 0.6            | 같다 (폭은 끝 쪽 padding 만큼 달라진다)                                          | —                          |
| glyph           | 상자 (배경 · 그림자 · 모서리 2) 18 × 18 안의 svg — md x 1897 | 상자 없는 Icon 18 × 18 — md x 1893 (lg 22 → 24)                                  | 레퍼런스 · Button instance |
| hover           | 테두리색만 바뀜                                              | Button secondary 의 hover (배경 · 테두리색)                                      | 부품이 자기 상태를 그린다  |
| pressed · focus | accent 2px outline                                           | Button 의 pressed 색 · focus ring                                                | 부품이 자기 상태를 그린다  |
| disabled field  | root 0.38 × trigger 0.38 · 흐린 배경                         | root 0.38 한 번                                                                  | Canvas 와 같다             |

**구현**

- library: Select `__2` = Button instance (`variant: secondary`) · 자식 `__2_1` SelectValue (`placeholder` · `children` = `{placeholder}`) · `__2_2` Icon (`{iconName}`). Select 원본의 `accepts` 에 `placeholder` · `iconName`.
- 값 (`T`): Select 의 delegation — Button 은 배치 (`width · min-width · padding-right · gap`), SelectValue 는 자기 sub-part 선언 (글자 크기 · 굵기 · `flex 1` · 말줄임 · placeholder 색). trigger 의 칠 · 상태 4종 · `--select-btn-padding/-font-size/-line-height` · chevron 상자 (`.select-chevron`) · `disabled` 변형을 지웠다.
- 판정 · 전달: `SUBPART_TOKENS.Select` (SelectValue 만) · `SUBPART_WRAPPERS` · `FIELD_CONTROL_TYPES` 에 Button · `TRIGGER_GLYPH_OWNERS` 에서 Select 제거 · 크기 전달 `Select → Button` · 중첩 규칙 (Select 의 자식 Button) · style 축 판정의 hop wrapper 에 Button (SelectValue 의 style 은 Select 소유 — 종전 판정 그대로).
- DOM: `select` 가 trigger Button 노드의 요소를 `controlElements` 로 넘긴다 (shared `Select` 가 그 자리에 그린다). `selectvalue` binding (RAC `SelectValue`). disabled field 안 Button 의 흐림 1 처리를 Select 의 직계 Button 에도 적용.
- **Builder 화면 자체**: RAC Select 를 직접 조립하는 3곳 (PropertySelect · CompactSelect · 데이터 바인딩) 이 생성 Select.css 의 trigger 선언 (상자 · 상태 · chevron 상자) 에 기대고 있었다. 그 값을 `form-controls.css` 의 맨 앞에 `:where()` 특이도 0 으로 옮겼다 — 종전 (components layer) 처럼 builder-system layer 의 다른 규칙이 전부 이긴다.

**검증**

- unit `adr253FieldPartsDom.test.ts` 305건 (+1): Select 의 DOM 구조 대조 10 조합은 전환 전 빌드와 같다 (Button 표지 · glyph 마크업은 명시한 차이). trigger 가 Button instance · 자식 [SelectValue · Icon] · Canvas 상자 (trigger 가 field 를 채움 · 값 x 13 · glyph 끝에서 9px) · 끝 padding 8 · gap 4 · 값 굵기 400 · `placeholder` / `iconName` 전달 · DOM (trigger 가 그 노드 · `aria-haspopup=listbox` · RAC SelectValue 의 `data-placeholder` · 값의 inline 색 없음 · trigger 의 inline 배경 없음) · disabled field (RAC disabled · 흐림 1) · size xl · Button 원본 편집 → Canvas · DOM · 판정 축.
- 원복 RED 9종: control 조립 · 값 inline 색 · disabled 흐림 · wrapper 경유 partRule · size 전달 · 값 굵기 · 끝 padding · gap 4 · placeholder 자리표시.
- 회귀: `pnpm type-check` · shared 1,498 · rendering 1,379 · builder 4,456 · publish 11 통과. 고친 기대값: `borderWidthLiteral` (outline 7 → 5) · `triggerIconSizeScale` (Select 는 chevron 변수가 없다) · `phase4eOriginView` (Select glyph 는 Button 안 Icon) · `useResetStyles` (Select 의 trigger 는 Button).
- 시각 하니스: 70건 중 69 통과 (남은 1건 CardView — 무관). old/new 비교는 `select-trigger-button-instance` 로 승인 기록에 넣었다 (glyph x 4px).
- live `adr253-p3-control-live.mjs` 13/13 (`PALETTE="select,search field,combo box,number field,button" TYPES=Select,SearchField,ComboBox,NumberField`, 5175 · headed Chrome · DPR 1 · visible): Select 의 trigger · 값 · glyph 상자 · 모서리 · 테두리 · 배경이 Canvas 와 Preview 에서 같다 — 5 크기 · side 라벨 → trigger hover (배경이 바뀜) → 누르기 (항목이 없어 `aria-expanded` 는 `false` — 전환 전과 같다, F11) → disabled field (trigger disabled · root 0.38 · 흐림 1 · 쉬는 색) → placeholder 를 바꾸면 값 글자가 바뀜 → 값 글자 굵기 Canvas 400 = Preview 400 → Components page 에서 Button 원본을 고치면 trigger 가 양쪽에서 바뀜 → undo. 콘솔 오류 0. 확대 화면에서 Canvas 의 trigger 모양을 눈으로 확인했다.
- Builder 화면 자체 (전환 전 빌드 5173 과 대조): Design 패널의 Select 308건 차이 0 (옮기기 전 84건). 패널 밖 Select 는 같은 마크업 (root class 4종 × root disabled × placeholder × 쉬는 · hover · pressed · focus · disabled) 을 두 빌드에 주입해 37 속성을 쟀다 — 14,800건 차이 0.

**남긴 것**

- Preview 의 Select 열기 (항목이 생기는 Phase 4).
- Canvas 는 placeholder 를 trigger 의 글자색 그대로 그린다 (Preview 는 `fg-muted` × 0.6) — 전환 전부터 있던 차이다.
- trigger 안 Icon 의 색은 Icon 자신의 값이다 (Button 원본의 글자색을 고쳐도 glyph 는 따라가지 않는다 — NumberField · ComboBox 의 버튼 glyph 와 같다).
- `SelectTrigger` 의 칠하는 variant 와 `SelectIcon` 은 picker 2종이 아직 쓴다. `SelectValue` 는 Select 의 sub-part 로 남는다.

### 2026-10-07 — Phase 3 (4e) 날짜 4종: DateInput 원본 · picker 의 Group · FieldButton (브랜치 `adr-253`)

**구현하면서 정한 것**

- **DateInput 원본** (`origin-component-dateinput` — `BASE_PART_ORIGIN_TYPES`, Components page 의 부품 칸): 날짜 field 의 입력 상자 부품이다. DateInput rule 이 자기 stylesheet 를 낸다 (`structure` — 생성 `DateInput.css`): 상자 · 크기 단계 · 상태 (hover · focus-within · invalid · disabled) 와 그 안의 RAC 조각 (`DateSegment`). 크기 단계는 Input rule 과 같다 (padding · 글자 · 줄 높이 · 모서리 — 한 form 안의 입력 상자가 같은 모양). 높이는 내용이다 (고정 높이 없음).
- **DateSegment 는 DateInput 의 내부 조각이다.** 4 부모가 각자 적던 조각 선언 (padding · 색 · placeholder · focus · invalid · disabled) 을 DateInput rule 한 곳으로 모았다. Canvas 가 조각의 padding · placeholder 칠을 읽는 출처도 부모 rule 에서 DateInput rule 로 바뀌었다. placeholder 는 색만 다르다 (`fg-muted` × 0.6) — DateField 만 있던 italic 은 없앴다 (레퍼런스 · 나머지 3 부모와 같다).
- **상태 표시는 Input 과 같다**: hover 는 테두리색만, focus 는 2px outline + 테두리색. 종전 DateField · TimeField 는 `.inset` utility 로 hover · focus 에 배경도 바뀌었다 ((3b) 에서 남긴 「Input ↔ DateInput hover 차이」 를 Input 쪽으로 모았다).
- **DateField · TimeField**: `__2` 가 DateInput instance 다. field 는 배치만 한다 (폭 100% · 크기별 최소 폭).
- **DatePicker**: Group (wrapper `plain` — 배치만) 안이 DateInput instance (상자 — Group 을 채운다, 끝 쪽 padding 이 버튼 자리) 와 FieldButton instance (`icon: {iconName}` — 끝 안쪽 정사각형, 음수 margin 으로 겹친다) 다. ComboBox 와 같은 배치 · 같은 수치다. §2-2 6번대로 상자를 칠하는 주체가 Group 에서 DateInput 으로 바뀌었다.
- **DateRangePicker**: Group (wrapper) 이 상자다 (§2-2 6번). 그 안이 **start DateInput · 구분자 · end DateInput · FieldButton** 이다. 종전에는 DateInput 노드 하나가 RAC 의 start/end 쌍을 대신했다 (Canvas 가 쌍과 구분자를 한 노드 안에 그리고 DOM 상자는 둘의 합). 이제 RAC 의 slot (`start` · `end`) 을 template 자리에 적은 instance 2개이고 (본문 Decision 5), template 이 그 자리의 상자를 지운다 (투명 배경 · 테두리 0 · padding 0). 구분자는 Text 노드 (`–`) 다. end 가 남는 폭을 차지한다 (`.react-aria-DateInput[slot="end"] { flex: 1 }` — partRule 이 selector 의 `slot` 조건을 자식 prop 조건으로 컴파일한다).
  - Group 의 padding 은 버튼이 내용 높이를 정하도록 다시 잡았다 (md 3 3 3 12 — 버튼 22 + 6 + 테두리 2 = 30). 모서리는 Input · DateInput 과 같은 크기 단계다 (종전 6px 고정 — Canvas 는 이미 크기 단계였다).
  - 안쪽 DateInput 의 focus outline 은 부모 rule 이 끈다 (Group 이 focus 표시를 그린다) — 부모 rule 에 남긴 유일한 부품 상태 선언이고 정적 테스트에 예외로 적었다.
- **Canvas 의 DateInput 은 어느 부모 안에서든 자기 노드 값으로 상자를 그린다.** 종전 primitive 는 picker 안이면 글자만 그렸다 (`_parentTag` 분기) — 분기를 없앴다. 테두리 0 인 자리는 테두리를 그리지 않는다.
- **DateInput 은 「부모 소유 sub-part」 판정에서 빠진다** (`DELEGATED_SUBPART_CHILD_TOKENS` · hop 대상). 원본의 instance 라 style 은 노드 자신이 정본이다 — Styles 패널 편집이 부모로 귀속되지 않는다 (unit 이 잡았다). 패널의 picker DateInput 높이 특례 (`100%`) 도 없앴다 — 높이는 어느 부모 안에서든 내용이다.
- `showCalendarIcon: false` 면 버튼이 양쪽에서 없다 (Canvas presence · DOM 은 그 노드를 그리지 않는다). 종전에는 DOM 만 숨겼다.
- picker 의 `iconName` 은 template 자리표시로 FieldButton 에 내려간다 (picker 원본이 받는다고 선언).

**변화 목록 (G0 ① — px, 전환 전 빌드 5173 과 Preview 대조)**

| 항목                          | 전                                                                  | 후                                                                                                 | 근거                     |
| ----------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| 바깥 상자 (4종)               | md 1920 × 30 · xl 54                                                | 같다                                                                                               | —                        |
| DateField · TimeField 의 상자 | padding md 4 12 · 모서리 6 고정 · hover / focus 에 배경도 바뀜      | padding 같다 · 모서리는 크기 단계 (xl 12) · hover 는 테두리색만 · focus 는 outline + 테두리색      | §2-2 6번 · Input 과 같다 |
| DateField 의 빈 조각          | italic                                                              | italic 없음 (색 `fg-muted` × 0.6 은 같다)                                                          | 한 정의 (레퍼런스)       |
| DatePicker 의 상자            | Group (padding 4 4 4 12 · 모서리 6) 안에 글자만 있는 DateInput      | DateInput (Group 을 채움 · padding 4 34 4 12 · 모서리 크기 단계). Group 은 칠 없음                 | §2-2 6번                 |
| picker 의 버튼                | 18 × 18 · 투명 · `fg-muted` glyph (xl 28)                           | FieldButton — md 22 × 22 · 옅은 강조색 배경 · 모서리 4 (xl 46) · glyph 는 Button 단계 (18 · xl 28) | §2-2 7번                 |
| DateRangePicker 의 Group      | padding 4 4 4 12 · 모서리 6 고정                                    | padding 3 3 3 12 (xl 3 3 3 24) · 모서리 크기 단계                                                  | 버튼이 내용 높이         |
| range 의 구분자               | 글자색 · padding 0 (선언한 selector 가 DOM 에 맞지 않았다) — 폭 6.6 | `fg-muted` · padding 0 4 — 폭 14.6 (end 가 8px 뒤로)                                               | 선언대로 (Text 노드)     |
| disabled field                | root 0.38 × Group 0.38                                              | root 0.38 한 번                                                                                    | Canvas 와 같다           |
| popup 의 시간 입력칸          | 꾸밈 없는 글자 (16px · 상자 없음)                                   | DateInput 상자 (md — 30px · 테두리 · 배경 · 14px)                                                  | DateInput 한 정의        |

마지막 줄: picker 의 popup 은 컴포넌트가 직접 조립하는 RAC TimeField > DateInput 을 쓴다 (노드가 아니다). 종전에는 어느 sheet 도 닿지 않았고 이제 DateInput sheet 의 기본 (md) 이 닿는다 — 같은 마크업을 두 빌드의 Preview 에 주입해 확인했다.

**구현**

- library: `origin-component-dateinput` (+ template) · DateField / TimeField `__2` = DateInput instance · DatePicker `__2` (wrapper `plain`) 아래 `__2_1` DateInput instance · `__2_2` FieldButton instance (`icon: "{iconName}"`) · DateRangePicker `__2` (wrapper — 상자) 아래 `__2_1` DateInput (`slot: start` · 상자 없음) · `__2_sep` Text (`–` · `fg-muted`) · `__2_end` DateInput (`slot: end`) · `__2_2` FieldButton. picker 원본의 `accepts` 에 `iconName`.
- 값 (`T`): DateInput rule 에 크기 단계 · `structure` · DateSegment 선언. DateField · TimeField · DatePicker 의 delegation 은 배치만. DateRangePicker 는 Group 의 상자 (종전 값 + padding · 모서리 단계) 와 부품 배치. 4 부모의 DateSegment 블록 · DatePicker 의 Group 칠 · 상태 · picker 2종의 버튼 칠 · 상태를 지웠다. DatePicker 의 quiet 는 DateInput 모양.
- 판정 · 전달: `SUBPART_TOKENS` (picker 2종) · `ATTRIBUTE_PROPS.slot` · `WRAPPED_BY_TRIGGER` 에 Text · 크기 전달 (DateField / TimeField → DateInput, picker → wrapper → DateInput · Button · Text) · presence (`catalogPickerOfButton`) · `SUBPART_UNION` 비움 · `TRIGGER_GLYPH_OWNERS` · `catalogDateRangeEndGrow` 삭제 · DateInput binding 의 `slot` (편집 surface 에 내지 않음).
- DOM: DateInput 노드는 RAC `DateInput` (+ `DateSegment`) 을 field 의 RAC context 안에서 그린다 (`fieldDateInputBinding` — `data-size` · `slot` · 문서가 쓴 값만 inline). DateField · TimeField 는 `inputElement`, picker 2종은 Group 안 `controlElements` 로 받는다.
- Canvas: `datefield_segments` primitive 의 picker 분기 제거 · range 쌍 측정 제거 (`segmentText.range`).
- Builder 화면 자체: RAC DateField · DatePicker · DateInput 을 직접 쓰는 곳이 없다 (코드로 확인) — 옮길 값 없음.

**검증**

- unit `adr253FieldPartsDom.test.ts` 306건 (+1): 날짜 4종의 DOM 구조 대조 52 조합은 전환 전 빌드와 같다 (명시한 차이: DateInput 의 `data-size` · `inset` class 없음 · 버튼 표지 · glyph 마크업 · range 구분자). 부품 테스트: DateField / TimeField 의 DateInput instance (Canvas 상자 · DOM 이 그 노드 · sheet 가 상자 · size · 원본 편집 · style 축 자기 소유) · DatePicker (Group 배치만 · DateInput 이 Group 을 채움 · 끝 padding 34 · FieldButton 22 × 22 · `iconName` · `showCalendarIcon` 양쪽) · DateRangePicker (Group 이 상자 · [DateInput, Text, DateInput, Button] · slot · 상자 없는 자리 · end 가 남는 폭 · 버튼 위치 · DOM · size xl). 구조 대조의 날짜는 fixture 작성일로 고정했다 (DateField 가 오늘 날짜를 보여 다른 날에는 깨지던 것 — 10-07 에 드러났다).
- 정적: 날짜 field 의 delegation 은 DateInput · 버튼을 배치만 한다 (DateSegment 선언 0 · 예외 1 — range 쌍의 focus outline 끄기).
- 원복 RED 11종: DateInput 노드 binding · field 가 노드를 그림 · size 전달 · 달력 버튼 presence · DOM · slot 조건 컴파일 · style 축 판정 · range 버튼 크기 · picker 끝 padding · range 쌍의 slot · Group padding.
- 회귀: `pnpm type-check` · shared 1,500 · rendering 1,379 · builder 4,457 · publish 11 통과. 고친 기대값: `borderWidthLiteral` (outline 5 → 3) · `triggerIconSizeScale` (FieldButton 상자 단계 3 부모 일치로 바꿈) · `generatedCssLoadInventory` (생성 100 · index 76) · `catalogCss` (98) · `skiaPrimitives.dateInput` (picker 분기) · `phase3Presence` (4건 — range 쌍 · italic · picker 글자 위치) · `phase4e10FileUpload` (end grow) · `phase4e11PreviewFollow` · `phase4eOriginView` (picker glyph = FieldButton 안 Icon) · `useTransformValues` (높이 특례 제거).
- 시각 하니스: 70건 중 69 통과 (남은 1건 CardView — 무관). old/new 비교는 `date-picker-dateinput-and-field-button-parts` · `daterangepicker-end-and-button-nodes` 로 승인 기록에 넣고 `field-button-glyph-node` 에 picker 2종을 더했다.
- live `adr253-p3-control-live.mjs` 13/13 (`LOCALE=en-US PALETTE="date field,time field,date picker,date range picker,button" TYPES=DateField,TimeField,DatePicker,DateRangePicker`, 5175 · headed Chrome · DPR 1 · visible — 앞 단계의 4 field 까지 8 type 을 한 번에 돌린 것도 17/17): 4 field 의 DateInput · Group · 구분자 · 버튼 · glyph 상자 · 모서리 · 테두리 · 배경이 Canvas 와 Preview 에서 같다 — 크기 단계 (DateField · TimeField 는 xs 없음) · side 라벨 → field 별: hover (테두리색) · 조각 focus (상자의 2px outline — range 는 Group 이 그리고 안쪽 쌍은 outline 없음) · picker 는 버튼 hover (배경이 바뀜) · 누르면 popup 이 열리고 (`aria-expanded` · dialog) Escape 로 닫힘 · disabled (버튼 disabled · root 0.38 · 버튼 흐림 1) → Components page 에서 DateInput · FieldButton 원본을 고치면 4 field 가 양쪽에서 바뀜 → undo. 콘솔 오류 0. 확대 화면에서 Canvas 의 4 field 모양을 눈으로 확인했다.
- 대조군: `BEFORE=1` 로 main 빌드 (5173) 의 Preview 수치를 떴다 (위 변화 목록). popup 의 시간 입력칸은 같은 마크업을 두 빌드에 주입해 쟀다.

**찾은 것 (전환 전부터 — 이 단계 범위 밖)**

- **locale 을 쓰지 않은 날짜 field 를 Canvas 는 Builder 문서의 locale (이 환경 ko-KR — 「연도. 월. 일.」) 로, Preview 는 en-US (`mm/dd/yyyy`) 로 그린다.** main 빌드 (5173) 도 같다. 상자 폭이 내용에 달린 곳 (range 의 start) 에서 12.8px 차이로 드러났다 — live 는 브라우저 locale 을 en-US 로 맞춰 (`LOCALE`) 기하를 대조했다. 원인 (Preview 의 RAC locale 결정) 은 따로 봐야 한다.

**남긴 것**

- `.inset` utility: 날짜 field 는 더 쓰지 않는다. 남은 사용처는 `Field.tsx` 의 `Input` wrapper 하나 (`renderers/FormRenderers` 의 옛 경로) — 그 경로를 정리할 때 같이 지운다 (Phase 6).
- DateField · TimeField 의 quiet 변형 (`.inset` 기준 선언) 은 Phase 3 끝의 quiet 정리에서 DateInput 기준으로 옮긴다.
- `SelectTrigger` 의 칠하는 variant 는 이제 DateRangePicker 의 Group 만 쓴다. `SelectIcon` · presence 의 `iconName` 파생은 쓰는 template 이 없다 — Phase 3 끝 정리 대상.
- Canvas 의 날짜 값 표시 (DateField 의 기본값 — Preview 는 오늘 날짜, Canvas 는 빈 조각) 는 종전과 같다.

### 2026-10-07 — Phase 3 끝: quiet 한 정의 · 판정 정리 · 측정 (G3 · G6, 브랜치 `adr-253`)

**구현하면서 정한 것**

- quiet (`isQuiet`) 는 field 의 **상자 부품이 자기 상태로** 그린다 — Input · DateInput rule 의 `&[data-quiet]` (쉬는 상태 · hover · focus · invalid 네 줄) 한 정의. 요소의 `data-quiet` 는 quiet field 의 상자 부품에 파생 값 (`derivedProps.isQuiet`) 으로 실린다. 부모 root 의 `data-quiet` 를 조상 selector 로 읽는 방식은 쓰지 않았다 — Card 도 `data-quiet` 를 내서 quiet Card 안의 입력칸이 같이 바뀐다.
- 상자 부품 = field 의 Input / DateInput instance (직계, 또는 칠하지 않는 wrapper 안). DateRangePicker 는 Group 이 상자라 그 쌍은 받지 않는다 (판정은 type 목록이 아니라 wrapper 의 `variant` — `plain` 이면 부품이 상자).
- quiet 동안에는 quiet 상태가 그리는 값 (배경 · 테두리색 · 모서리 · 그림자) 을 inline 으로 내지 않는다. 문서가 쓴 쉬는 값 (SearchField 입력칸의 pill 모서리) 이 inline 으로 sheet 를 덮어 밑줄 양끝이 휘었다 (live 에서 발견) — Button 의 상태 칠과 같은 처리다.
- Select 의 trigger · DateRangePicker 의 Group 의 quiet 블록은 그 field rule 에 남는다 (그 field 만의 상자다).
- Select 의 값 (SelectValue) 은 style 축이 노드 자신의 것이다 — DOM 이 그 노드를 직접 그리므로 (4d) 노드에 쓴 style 이 Canvas 와 DOM 에 같이 닿는다. 글자 축만 Select 소유 (`placeholder` · 선택 항목). 「style 축만 부모 소유」 인 부품은 이제 없다.
- 미룬 것: `SelectIcon` type · `SelectTrigger` 의 칠하는 variant · shared 컴포넌트의 props 조립 fallback 은 Phase 6 (정리) 으로 옮긴다. `SelectIcon` 은 template 이 쓰지 않지만 참조 파일이 38개이고 (binding 파일 삭제 포함), fallback 은 호출처가 옛 `renderers/*` 뿐인데 그 디렉터리 자체가 import 되지 않는다 — 둘 다 파일 삭제가 따르므로 사용자 승인을 받고 한 번에 한다.

**변화 목록 (Preview — main 빌드 5173 과 대조, quiet field)**

| 대상                               | 전환 전 (main)                                                          | 전환 후                                     |
| ---------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| TextField · ColorField             | 쉬는 상태 · focus · invalid 같다. hover 는 변화 없음                    | hover 에 밑줄이 `border-hover` 색           |
| DateField · TimeField              | 네 상태 모두 같다                                                       | 같다                                        |
| NumberField · SearchField          | 밑줄 (container 가 그림)                                                | 밑줄 (Input 이 그림 — SearchField 모서리 0) |
| TextArea                           | 상자 그대로 (`isQuiet` 가 닿지 않음 — selector 가 `<textarea>` 에 없음) | 밑줄                                        |
| ComboBox · DatePicker              | 상자 그대로 (root 가 `data-quiet` 를 내지 않음)                         | 밑줄                                        |
| Select · DateRangePicker           | 상자 그대로 (root 가 `data-quiet` 를 내지 않음)                         | 그대로 — 아래 「찾은 것」                   |
| Styles 패널 — Select 의 값 선택 시 | 「부모 (Select) 에서 편집」 안내                                        | 노드를 그대로 편집                          |

**구현**

- 값 (`T`): Input · DateInput rule 의 `rootSelectors` 에 quiet 네 줄. 8 부모 (ColorField · ComboBox · DateField · DatePicker · NumberField · SearchField · TextField · TimeField) 의 `containerVariants.quiet` 삭제 (256줄) · 읽는 곳이 없던 `--tf-border` · `--tf-bg` 삭제.
- 파생 (`X/presence.ts`): `fieldBoxOfQuietField` → `catalogDerivedProps` 가 `isQuiet: true` · field 가 바뀌면 그 Input 들이 다시 계산된다 (`fieldSubparts`).
- DOM (`X/domBinding.tsx`): Input · DateInput 노드 요소에 `data-quiet` · quiet 동안 `QUIET_STATE_KEYS` 를 inline 에서 뺀다. shared 컴포넌트의 fallback 입력칸 8곳도 `data-quiet` 를 받는다.
- 판정 (`S/catalog/resolvers/resolveDelegatedChildFontSize.ts`): `STYLE_ONLY_SUBPART_PARENTS` 비움 · `TEXT_ONLY_SUBPART_PARENTS.SelectValue = ["Select"]` · `SelectTrigger` 토큰에서 `.react-aria-Button` 제거 (Select 에는 wrapper 가 없다).
- 규칙 문서: `.claude/rules/ssot-hierarchy.md` 의 sub-part 절을 이 구조로 다시 적었다 (종전 절은 「DOM 이 부모 props 로 self-compose 하고 자식을 읽지 않는다」 — 더는 사실이 아니다).
- 하니스: `perf-baseline.mjs` 에 `--fixture-kind fields` (palette field instance 격자) — 종전 조합 fixture (`form-refs` 등) 는 옛 앱 전용이라 catalog runtime 에서 돌지 않았다.

**검증**

- unit `adr253FieldPartsDom.test.ts` 316건 (+10): quiet 10 type — 상자 부품이 `data-quiet` 를 갖고 field 의 prop 을 따라 다시 그려진다 · range picker 의 쌍은 받지 않는다 · SearchField 의 pill 모서리가 quiet 동안 inline 에 없다. Select 의 값: style 축 판정 null · 글자 축 Select · 노드에 쓴 글자 크기가 Canvas record 와 DOM inline 에 닿는다. 구조 대조는 control 의 `data-quiet` 를 구조에서 뺀다 (`data-size` 와 같다).
- 정적 `adr253PartShapeOwner.static.test.ts` 9건 (+1): 어느 field rule 도 quiet 블록에서 Input · DateInput 을 다시 선언하지 않는다 · 두 부품 rule 이 quiet 상태를 갖는다.
- 원복 RED 10종: 파생 값 (9건 RED) · Input 의 `data-quiet` (6) · DateInput 의 `data-quiet` (3) · 다시 계산 대상 (5) · 칠하는 wrapper 예외 (1) · quiet inline 키 (1) · SelectValue style 축 (1) · 글자 축 (1) · 부모가 quiet 를 다시 선언 (정적 1) · 부품의 quiet 상태 없음 (정적 1). 편집 → 테스트 → 바이트 복원, 끝에 트리 일치 확인.
- 회귀: `pnpm type-check` · shared 1,501 · rendering 1,379 · builder 4,467 · publish 11 통과. 고친 기대값: `borderWidthLiteral` (border-bottom 10 → 4).
- 시각 하니스: 70건 중 69 통과 (남은 1건 CardView — Phase 1 기록과 같은 내용, 이 ADR 밖).
- live `apps/builder/scripts/adr253-p3-quiet-live.mjs` 7/7 (5175 · headed Chrome · DPR 1 · visible · locale en-US): 팔레트로 9 field 를 놓고 `isQuiet` 를 켠다 → Preview 의 상자 부품이 배경 없음 · 위 / 옆 테두리 투명 · 밑줄 1px · 모서리 0 → 마우스를 올리면 밑줄이 `border-hover` 색 (`data-hovered` 확인) → focus 하면 outline 없이 밑줄이 강조색 (`data-focused` · `data-focus-within` 확인) → `isInvalid` 면 밑줄이 negative 색 → 끄면 켜기 전 computed style 과 같다. 콘솔 오류 0. 대조군: 같은 스크립트를 `BEFORE=1` 로 main 빌드 (5173) 에 돌려 위 변화 목록을 만들었다.
  - 한계: hover 는 Builder 의 편집 overlay 가 pointer 를 가져가 Preview 문서의 요소에 pointer 이벤트를 직접 줬다. `isQuiet` 는 패널 조작이 아니라 패널이 내는 것과 같은 호출 (`setFields`) 로 썼다.

**G3 판정 (Phase 3 전체)**

| 조건                                             | 결과                                                                                                                                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 부모 delegation 에 부품 모양 선언 0              | 통과 — 정적 9건 (Label · FieldError · Description · Input · wrapper 안 부품 · 날짜 field · part 변수 · nested selector · quiet)                                                                                                                    |
| DOM 구조 대조                                    | 통과 — 17 부모 × 13 조합, 차이는 테스트에 적은 것뿐 (control 의 `data-size` · `data-quiet` · 버튼 표지 · glyph 마크업 · range 구분자 · 전에 그리지 않던 도움말 / 오류 문구)                                                                        |
| 시각 하니스                                      | 70건 중 69. 남은 1건 CardView 는 Phase 1 착수 전부터 실패하던 것이다 (Card 원본의 slot 선언 뒤 승인 기록 미갱신 — Canvas ↔ DOM 차이 0). field 계열 case 는 전부 통과하고 승인 차이는 단계별 변화 목록과 같다                                       |
| 동작 ① 증감 · disabled 경계 · 열기 · 지우기      | NumberField 증감 · 값 한계 · disabled (4a) · SearchField 지우기 (4c) · DatePicker / DateRangePicker popup 열기 · 닫기 (4e) 통과. **Select · ComboBox 는 Preview 에서 열리지 않는다** — 항목이 없다 (F11, 전환 전과 같다). Phase 4 (G4) 의 대상이다 |
| 동작 ② validation 오류 표시 · `aria-describedby` | 통과 — (2) 의 live                                                                                                                                                                                                                                 |

G3 은 Select · ComboBox 열기 한 항목을 빼고 통과다. 그 항목은 이 Phase 가 만든 문제가 아니고 (main 빌드도 같다) Phase 4 가 다룬다 — Gate 표의 「통과한 부모만 반영하고 나머지는 다음 phase 로」 에 따라 Phase 3 을 main 에 병합한다.

**G6 (Phase 3 전체 — 전환 전 = main `1d66260dd`)**

- ratchet: `pnpm gate:perf-ratchet` 판정 pass (커밋 `da6be1995`, 시드 60 · 600 — A등급 증가 0). 이 게이트의 시드는 Text / frame 격자라 field 의 비용은 재지 않는다 — 아래가 그 몫이다.
- 프레임 비용 (`perf-baseline.mjs --lane frame --fixed-inputs --fixture-kind fields --seed-count 100`: field 6종 × 100 instance · 2 page · dev 빌드 · headless Chrome 154 · 1440×900 · DPR 1 · visible · Apple M4 Pro, 전환 전 5173 ↔ 전환 후 5175 교대 3쌍의 중앙값). catalog runtime 에는 `scene.build` label 이 없어 같은 자리의 `record.content` 로 쟀다.

  | 부류   | 지표                    | 전환 전 (3회)         | 전환 후 (3회)         | Δ (중앙값) |
  | ------ | ----------------------- | --------------------- | --------------------- | ---------- |
  | edit   | `record.content` p50 ms | 3.9 · 4.1 · 4.2       | 4.4 · 4.6 · 4.7       | +0.5       |
  | edit   | `record.content` p95 ms | 4.5 · 4.7 · 7.1       | 6.9 · 5.6 · 5.7       | +1.0       |
  | edit   | main thread task ms     | 279 · 290 · 320       | 341 · 360 · 357       | +67 (+23%) |
  | edit   | 할당 MB/s               | 5.8 · 5.8 · 5.8       | 7.2 · 7.2 · 7.2       | +1.4       |
  | edit   | callback gap p95 ms     | 17.6 · 17.6 · 18.0    | 17.8 · 17.7 · 17.8    | +0.2       |
  | pan    | `record.content` p50 ms | 4.1 · 5.4 · 6.3       | 7.5 · 7.3 · 7.8       | +2.1       |
  | pan    | `record.content` p95 ms | 6.3 · 8.6 · 7.8       | 7.7 · 7.9 · 9.3       | +0.1       |
  | pan    | main thread task ms     | 550 · 729 · 915       | 735 · 924 · 878       | 노이즈 폭  |
  | select | main thread task ms     | 1,225 · 1,181 · 1,256 | 1,194 · 1,206 · 1,221 | −19        |

  읽기: 편집 한 번의 그리기 준비가 0.5 ms (p50) 늘었고 프레임 간격은 같다 (gap p95 17.6 → 17.8 · 25 ms 초과 비율은 양쪽 모두 0 ~ 0.5%). field 하나가 그리는 노드가 늘어난 값이다 (버튼 · glyph · 도움말 · 오류 문구가 노드가 됐다). pan 의 p50 은 전환 전 3회가 4.1 ~ 6.3 으로 흩어져 +2.1 을 그대로 믿기 어렵다 (p95 는 같다). 합성 격자이므로 규모만 본다 — 분포는 근거가 아니다. ADR-234 G4 가 기록한 +2 ms 대 안이다.

- initial 번들 (production 빌드 두 벌 · `adr209-bundle-closure.mjs`): Builder JS gzip 1,228,488 → 1,226,609 (−1,879) · CSS gzip 76,355 → 73,810 (−2,545). Preview JS gzip 290,169 → 287,048 (−3,121) · CSS gzip 47,312 → 44,212 (−3,100). 상한 (Builder 1,421,000 · Preview 623,000) 안이고 둘 다 줄었다.

G6 통과.

**찾은 것 (전환 전부터 — 이 Phase 범위 밖)**

- **Canvas 는 field 의 quiet 모양을 그리지 않는다.** `isQuiet` 를 켜도 Canvas 의 상자는 그대로이고 (live: Canvas record 의 테두리 1 · 모서리 6) Preview 만 밑줄이 된다. main 빌드도 같다. 이번에 ComboBox · DatePicker · TextArea 가 Preview 에서 quiet 를 그리게 되면서 이 차이가 6 type → 9 type 으로 넓어졌다. 부품에 `isQuiet` 파생 값이 실리므로 Canvas 쪽은 부품 rule 의 quiet 값을 읽는 일만 남는다 (한쪽 테두리를 rule 노드가 그리는 경로가 필요하다).
- **Select · DateRangePicker 의 `isQuiet` 는 Preview 에 닿지 않는다** — binding 이 root 에 `data-quiet` 를 내지 않는다. Canvas 도 그리지 않으므로 양쪽에서 효과가 없는 prop 이다.

**남긴 것**

- Phase 6 (정리) 으로: `SelectIcon` type 과 presence 의 `iconName` 파생 · `SelectTrigger` 의 칠하는 variant 중 쓰지 않는 것 · shared 컴포넌트의 props 조립 fallback 과 옛 `renderers/*` · `.inset` utility (파일 삭제는 사용자 승인 뒤).
- ratchet 의 「하향 가능 5」 는 기록하지 않았다 (상한은 최적화 커밋에서 내린다).

### 2026-10-07 — Phase 4: library 의 slot 채움 · Select · ComboBox 의 ListBox (G4, 브랜치 `adr-253`)

**무엇이 바뀌었나**

- **library 의 slot 채움 표현** (`D/types.ts` `LibrarySlotFill` · `LibraryTemplateNode.slotFills`): 합성 정의를 instance 로 쓰는 template 노드가 자기 `children` 가운데 일부를 그 합성 template 의 slot 자리에 세운다 — `{ templatePath (합성 template 루트부터), childIds }`. 뜻은 instance 의 `fillSlot` 을 중첩 루트 주소 `{ instances: [..., 그 노드], templatePath }` 에 쓴 것과 같고, instance 가 그 자리를 직접 채우면 그것이 library 의 채움을 대신한다. 채움 자식은 그 노드의 children 에 그대로 있어 주소 (`[…, 노드, 항목]`) 가 종전 template 자리와 같은 꼴이다.
  - 검증: 모양 (`validation.ts` `validateLibraryTemplate` — 빈 경로 · 같은 경로 두 번) · 뜻 (`library.ts` `INVALID_SLOT_FILL` — 합성 instance 가 아님 · 경로가 그 template 의 것이 아님 · 대상에 `slot` 선언 없음 · 자식이 그 노드의 것이 아님 · 한 자식이 두 자리).
  - 해석 (`resolver.ts` `projectTemplate`): 채움 자식은 합성 루트 뒤가 아니라 slot 자리 아래에 투영되고 그 자리의 기본 자식은 나오지 않는다. 그 뒤 instance 의 `fillSlot` 이 있으면 종전대로 그것으로 바뀐다. 데이터 행 반복 (`rowSet`) 은 채움 자식에서도 같다.
  - Layers 행 (`positions.ts` `childPositions`): 해석과 같은 모양 — slot 자리 아래에 채움 자식.
  - 명령: 「자리의 자식 목록」 을 한 곳에서 정한다 (`commands/context.ts` `listParent`) — 루트 slot 을 채우는 template 자리 (Select 의 ListBox) 의 목록은 중첩 루트의 slot 주소다. 첫 구조 편집 (`ensureChildList`) 은 library 의 채움 자식을 owned 노드로 복사해 그 주소의 `fillSlot` 으로 적는다. 자리 전체가 복사될 때 (detach) 는 채움이 사본 instance 의 `fillSlot` 이 된다 (`materialize.ts`).
- **Select · ComboBox** (`L` `component-select__listbox` · `component-combobox__listbox`): 항목 4개가 루트 직계에서 **ListBox 원본 instance 의 slot 채움**으로 옮겨 갔다. `LIBRARY_CONTRACT_VERSION` 4 → 5.
  - 「+」: ListBox 자리가 항목 · section 을 받는다 (ListBox 가족 그대로 — `COLLECTION_FAMILIES` 의 Select · ComboBox 행 삭제). picker 를 고른 채 누르는 「+」 는 그 ListBox 로 넘긴다 (`itemInsert.ts` — 닫힌 목록은 Canvas 에서 고를 수 없다).
  - 중첩 규칙: picker 의 직계 자식은 Label · trigger · 도움말 · 오류 문구 · ListBox 다 (항목은 ListBox 안).
  - 바인딩 행 템플릿 (`rowTemplate.ts`): 루트 직계에 항목이 없으면 한 단계 아래 (ListBox 안) 의 첫 항목.
- **DOM** (F11 의 수리): select · combobox binding 이 ListBox 노드의 요소를 shared 컴포넌트의 `listElement` 로 넘기고, 컴포넌트는 그것을 Popover 안에 둔다 (없으면 종전처럼 `items` · children 으로 조립). picker 안의 ListBox 는 RAC `ListBox` 그대로 그린다 — 이름 · 선택 · focus 는 RAC 의 Select · ComboBox context 가 정하고 (`aria-label` 을 따로 적지 않는다) `data-size` 는 picker 의 size 다. ListBoxItem 은 label 부품의 글자를 `textValue` 로 받는다 (ComboBox 의 입력값 · 걸러내기, type-ahead, 숨은 native select 가 읽는다).
- Canvas: 닫힌 picker 의 ListBox 는 종전 규칙 (`presence.ts` `TRIGGER_OVERLAY_CHILDREN`) 으로 숨고 항목은 그 아래라 같이 숨는다.

**검증**

- unit `adr253SlotFill.test.ts` 14건 (shared — 실제 code library + 최소 library): ListBox 루트 안 = picker 의 항목 4개 · 루트 뒤 항목 0 · ListBox 원본의 기본 항목 0 · Layers 행 = consumer tree · 항목 추가 → `fillSlot` 이 중첩 루트 주소 하나 · 사본이 template 항목과 같은 글자 · 바인딩 행 3개가 ListBox 안에서 반복 · 삭제 (자리 끄기) · detach 뒤에도 ListBox 가 항목을 가짐 · library 검증 거부 6종.
- unit `adr253PickerListBox.test.ts` 12건 (builder — workspace · Canvas / DOM record · 실제 마운트): 양쪽 record 가 같은 구조 · picker 와 ListBox 양쪽에서 「+」 · 한 history step · undo · 항목 글자 편집과 삭제 · ListBox 원본의 배경색이 picker 의 목록 record 에 · 바인딩 행 템플릿 · **Preview 의 picker 를 마운트해 trigger 를 누르면 목록이 열리고 option = 항목 노드 (text · `data-catalog-id`), 고르면 Select 의 값 · ComboBox 의 입력값이 된다**.
- 고친 기대값: `adr253FieldPartsDom` 의 Select 구조 대조 — 숨은 native select 에 항목 option 4개가 생겼다 (따로 단언). `phase3Presence` — 숨는 것은 ListBox 이고 항목은 그 아래 (상자 넓이 0).
- 원복 RED 15행 (편집 → 테스트 → 바이트 복원, 끝에 트리 일치 확인): 채움을 slot 에 투영하지 않음 (9건 RED) · 채움 자식이 루트 뒤에도 나옴 (9) · 행이 채움을 무시 (4) · 목록 부모 정규화 없음 (2) · 첫 편집이 루트의 기본 항목을 복사 (2) · detach 가 채움을 버림 (2) · slot 없는 자리의 채움 허용 (1) · 남의 자식 허용 (1) · Select 가 목록 요소를 받지 않음 (1) · `textValue` 없음 (1) · picker 목록을 단독 ListBox 로 그림 (2) · 「+」 위임 없음 (4) · 행 템플릿을 루트 직계에서만 찾음 (2) · 행 템플릿 판정을 주소 자리로 (2) · library 에서 `slotFills` 를 뺌 (4).
- 회귀: `pnpm type-check` · shared 1,515 · builder 4,479 · publish 11 통과. 시각 하니스 70건 중 69 (남은 1건 CardView — 종전과 같다).
- initial 번들 (production 빌드 · `adr209-bundle-closure.mjs`, Phase 3 끝 `dfbdba22d` 대비): Builder JS gzip 1,226,609 → 1,227,683 (+1,074) · Preview JS gzip 287,048 → 287,042 (−6) · CSS 는 둘 다 같다. 상한 (Builder 1,421,000 · Preview 623,000) 안.
- live `apps/builder/scripts/adr253-p4-live.mjs` 8/8 (5175 · headed Chrome · DPR 1 · visible · locale en-US): 팔레트로 ListBox · ComboBox · Select 를 놓고 Compare Mode → Preview 의 Select trigger 를 누르면 열리고 (`aria-expanded` true) option 4개 = Canvas 의 항목 (글자 · 노드 id), 목록 요소 = ListBox 노드, Popover 폭 = field 폭 · 「Dog」 를 고르면 값이 된다 → ComboBox 를 버튼으로 열면 같은 4개, 「ca」 를 치면 「Cat」 만 남고 고르면 입력값이 「Cat」 → Select 를 고르고 Design 패널의 「+」 → 양쪽 5개 (`Item 5`), 문서에는 중첩 루트 주소의 `fillSlot` 하나 → 둘째 항목 글자를 바꾸고 셋째를 지움 → 양쪽 같은 4개 → ListBox 원본의 배경색을 두 번 바꿈 → Select · ComboBox 의 목록과 단독 ListBox 가 Canvas record 와 Preview computed style 에서 같이 바뀜 → undo 로 처음 4개. 콘솔 오류 0. 화면에서 열린 목록 (선택 ✓ · 원본 배경색) 을 눈으로 확인했다.
  - 한계: 항목 글자 편집 · 삭제 · 원본 편집은 패널 조작이 아니라 패널이 내는 것과 같은 명령 (`setFields` · `removeTargets` · `setLibraryDefault`) 으로 썼다. 「+」 는 실제 패널 버튼이다.

**G4 판정**

| 조건                                                                                                    | 결과                                                 |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| slot 채움 표현: 타입 · 검증 · 해석 unit — 루트 안 = Select 의 항목 · 루트 밖 0 · 기본 항목 0 (원복 RED) | 통과 — `adr253SlotFill` 14건 · RED 1 · 2 · 15행      |
| Preview 의 선택 목록 = Canvas 의 항목 (추가 · 삭제 · 텍스트 변경이 양쪽에)                              | 통과 — unit (마운트) · live                          |
| ListBox 원본의 스타일 편집이 Select 의 목록에 닿는다                                                    | 통과 — unit (record) · live (Preview computed style) |
| G3 잔여: Select · ComboBox 가 Preview 에서 열린다                                                       | 통과 — unit (마운트) · live                          |

G4 통과. Phase 3 의 G3 표에서 남았던 「Select · ComboBox 열기」 도 이것으로 닫힌다.

**찾은 것 (이 Phase 범위 밖)**

- **Preview 채널: 한 delta 사이에 만들어졌다 지워진 노드.** live 스크립트가 undo 를 한 프레임에 몰아 실행했을 때 (삭제의 undo → 삽입의 undo) Preview 가 delta 를 거부하고 (`ENTRY_NOT_FOUND` — replica 가 가진 적 없는 id 의 삭제) snapshot 을 다시 받았다. 화면은 복구되고 콘솔에 오류 한 줄이 남는다. ADR-248 의 delta 구성 (`previewChannel.ts` 가 프레임마다 모은 id 를 「있으면 put · 없으면 remove」 로 보낸다) 에서 나오는 것으로 이 Phase 의 변경과 무관하다. 스크립트는 undo 를 delta 마다 한 번씩 하도록 했다.
- picker 목록의 항목은 단독 ListBox 의 항목과 같은 모양이다 (같은 원본 `ListBoxItem` — label 부품의 글자 굵기 포함). picker 에서만 다르게 하려면 항목 원본의 변형이나 picker template 의 patch 를 정해야 한다 — 이번에는 정하지 않았다.

**남긴 것**

- Select · ComboBox 의 `selectedKey` · `defaultSelectedKey` 는 여전히 DOM 에 닿지 않는다 (binding 이 넘기지 않는다 — 전환 전과 같다). Preview 의 선택은 실행 상태다.
- `S/catalog/slotRoles.ts` `STATIC_LIST_FAMILY_BY_OWNER` 는 읽는 곳이 없다 (Select · ComboBox 행이 옛 구조를 적고 있다) — Phase 6 정리 대상.

**판독 (1회) — HIGH 0 · MEDIUM 0, Phase 4 닫힘**

판독자가 resolver 의 fill 조회 (두 겹 중첩 주소) · 행 반복 · `listParent` 의 호출처 · materialize · shared Select / ComboBox 의 `listElement` 를 코드로 따라가 종전 경로와 같음을 확인했다. 수리할 것이 없어 수리 검증 라운드는 열지 않는다. LOW deferred:

- `materialize.ts` 의 fill 분기가 사본이 생긴 항목 아래의 소비되지 않은 override 를 owner 에 남긴다 (resolver 가 그 주소를 지나지 않아 화면 영향 0).
- `listParent` 는 루트 slot 채움만 정규화한다 (resolver · positions 는 임의 깊이). library 데이터가 루트 slot 만 쓰는 동안은 재현되지 않는다 — 깊은 slot 을 채우는 데이터를 넣을 때 (Phase 5 에서 필요하면) 같이 고친다.
- instance 가 `fillSlot` 으로 ListBox 루트를 채웠을 때도 library fill 을 먼저 투영하고 버린다 (결과는 같고 투영 비용만 든다).
- Select · ComboBox 의 허용 자식에 `ListBox` 가 있어 두 번째 ListBox 를 넣을 수 있다 (DOM 은 첫 ListBox 만 그린다 — 일부러 만들어야 하는 상태).
- 두 겹 중첩 (사용자 컴포넌트 안의 Select) 은 코드 추적으로만 확인했다.

판독자의 미확인 3건은 실행자가 확인했다: `STATIC_LIST_FAMILY_BY_OWNER` 는 읽는 곳이 없고 (위 「남긴 것」), ListBox · ListBoxItem 의 생성 CSS 에 `data-size` 선택자가 없어 picker 의 size 로 항목 모양이 갈리지 않으며, picker 목록 판정의 노드 동일성은 마운트 unit · live 가 통과한다.
