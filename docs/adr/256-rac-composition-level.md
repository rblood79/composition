# ADR-256: RAC 수준의 조립 — 노드 트리를 RAC 부품 그대로 그리고, 넣는 자리를 레퍼런스에서 가져온다

## Status

Proposed — 2026-10-07

사용자 요청: `/create-adr` (2026-10-07). 방향은 같은 날 대화에서 사용자가 정했다.

- 「components tab 내에 각컴퍼넌트별로 slot 에 등록할수있는 항목 이 현재는 지정되어있는데 이것이 RAC ,RSC 개념에 맞는것인지? … pen.dev처럼 자유도가 높게 되어있는 것도아니고 RAC ,RSC 처럼 정확한 개념 대로 정해진 것도 아니고 컴퍼넌트별로 모두 체크 해야한다」
- 「https://react-aria.adobe.com 레퍼런스 기준으로」 · 「RSC는 https://react-spectrum.adobe.com 기준으로 봐야한다」
- 「RAC 수준이 되지 않는다면 빌더를 하는 의미가 없다」 — 이 ADR 의 목표 문장이다.

**사용자 확인 (2026-10-07)** — 세 항목 모두 답을 받았다.

1. 저장 포맷: 「거부해도 된다」 — template 구조가 바뀌는 병합마다 `LIBRARY_CONTRACT_VERSION` 을 올리고 옛 개발용 프로젝트를 거부한다 (변환 0, 보존 대상 프로젝트 0).
2. 상태별 표시: 「showWhen 필드로」 — 노드 필드 `showWhen` 을 문서 스키마에 추가한다 (Decision 7).
3. 레퍼런스 밖 컴포넌트: 「지금 구조 유지」 — Nav · Pagination · FileUpload · Chart 는 이 ADR 범위 밖이고 노드 트리 그리기 경로만 공통으로 쓴다 (Decision 1).

남은 것: 리뷰 round 1 → Accepted.

## Context

### 목표

react-aria.adobe.com 예제 코드로 만들 수 있는 구조를 빌더에서 같은 노드 트리로 만들 수 있어야 한다. Canvas 와 Preview 는 그 트리를 같게 그린다. RAC 에 없는 S2 컴포넌트는 react-spectrum.adobe.com 예제가 기준이다.

### 지금 되는 것과 안 되는 것 (2026-10-07 실측 · main `23bbcfc2d`)

경로 약어: `S/` = `packages/shared/src/` · `D/` = `S/catalog/document/` · `X/` = `S/catalog/runtime/` · `R/` = `apps/builder/src/builder/catalogRuntime/` · `N` = `S/catalog/nesting/nestingRules.ts`

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                                                  | 근거                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | slot 은 원본 template 마다 손으로 고른 25자리다. 같은 종류의 컴포넌트도 다르다 — ListBox 에는 있고 Menu · ColorSwatchPicker · Dialog · Popover · Tooltip · TabPanel · Disclosure 패널 · Cell 에는 없다                                                                                                                                                                                                                                | `D/generated/reusableOriginLibrary.ts` 의 `"slot": {` 25건                                                                                                                                                            |
| F2  | slot 에 넣을 수 있는 목록은 모든 slot 에 같다 — 프로젝트 컴포넌트 + Text · Image · Icon · Separator · Frame. Button · Heading · Tab · Checkbox 같은 기본 원본은 목록에 없다                                                                                                                                                                                                                                                           | `apps/builder/src/builder/components/slotFillNodes.ts:2-8` · `apps/builder/src/builder/panels/properties/catalog/CatalogSlotSection.tsx:198-216`                                                                      |
| F3  | 목록과 실제 허용이 다르다. 임시 시험 (2026-10-07, 삭제함) 에서 5종을 slot 마다 넣으면 — Tabs (Tabs · Panels) · Table · TableView (Columns · Rows) · CheckboxGroup · RadioGroup (Options) · TagGroup (Tags) 는 5종 모두 `NESTING_NOT_ALLOWED`. Card Header · Content 는 `POSITION_HAS_TEMPLATE_BINDING`. Card Preview · Footer 는 5종만 들어가고 Button 은 고를 수 없다                                                                | `S/catalog/commands/context.ts:169-184` (`assertNestable`) · `S/catalog/commands/materialize.ts:251-252`                                                                                                              |
| F4  | slot 이 원본 루트에 걸린 12자리 (ListBox · GridList · Toolbar · Form · AvatarGroup · Breadcrumbs · Nav · DisclosureGroup · CardView · ToggleButtonGroup · ButtonGroup · Tree) 는 놓은 instance 에서 slot 섹션이 나오지 않는다                                                                                                                                                                                                         | `R/slots.ts:71-84` (`catalogSlotPosition` 은 `descendant` 만)                                                                                                                                                         |
| F5  | Preview 의 위임 renderer 47개 중 RAC 처럼 자식을 순서대로 다 그리는 것은 21개다. 특정 type 만 고르는 것 8 (Tabs · ListBox · GridList · Breadcrumbs · Menu · Tree · ToggleButtonGroup · ColorSwatchPicker), 부품을 shared 합성 컴포넌트의 props 로 넘기는 것 15 (field 7종 · Slider · Meter · ProgressBar · TagGroup · CheckboxGroup · RadioGroup · Disclosure · FileUpload), 자식을 무시하는 것 3 (Switch · Calendar · RangeCalendar) | `X/delegatedDom.tsx:560-1922` — 예: `textfield` `:982-1004` 가 label · description · errorMessage · inputElement 만 넘기고 `S/components/TextField.tsx:112-122` 가 순서를 정한다                                      |
| F6  | 그래서 중첩 규칙이 Preview 가 그리지 못하는 자식을 미리 막는다. TextField 는 Label · Input · Description · FieldError 만, Checkbox 는 indicator · Label · Text · Icon 만, ButtonGroup 은 Button 만, Row 는 Cell 만 받는다. 규칙의 근거가 RAC 가 아니라 우리 renderer 다                                                                                                                                                               | `N:119-187` (`SELF_COMPOSED_CONTAINER_CHILD_TYPES` — 주석 「DOM 은 이마저 props 로 self-compose」) · `N:380-391`                                                                                                      |
| F7  | RAC 의 같은 부품은 자식이 자유 내용이다 (`ChildrenOrFunction`). TextField · NumberField · DatePicker · Slider · SliderTrack · CheckboxField 의 `children` 이 모두 그렇다. 항목만 받는 것은 collection (ListBox · GridList · Menu · Tree · TagList · TabList · TabPanels · TableHeader · TableBody · Row · Breadcrumbs) 뿐이다                                                                                                         | react-aria.adobe.com `<Component>.md` API 표 (2026-10-07 조회) · 설치 RAC 1.21.0                                                                                                                                      |
| F8  | 레퍼런스 예제의 구조가 우리 template 과 다르다. 예: 설치 RAC 1.21.0 의 Checkbox 예제는 `CheckboxField > CheckboxButton (indicator + children) + Description + FieldError` 이고 Slider 는 `SliderFill` 을 쓴다. 우리 Checkbox 는 indicator + Label 뿐이고 Slider 의 채움은 track rule 이 그린다                                                                                                                                        | react-aria.adobe.com `Checkbox.md` · `Slider.md` · RAC `dist/exports/Checkbox.mjs` (`CheckboxField` · `CheckboxButton`) · `Slider.mjs` (`SliderFill`)                                                                 |
| F9  | Canvas 는 RAC 에서 조립 가능한 여러 부품을 노드 없이 부모 rule 로 그린다 — ListBoxItem 의 선택 표시, Tab 의 선택 막대, Tag 의 지우기 X, Slider thumb (track 이 그림), ProgressBar · Meter 채움, Tooltip · Popover 화살표, TreeItem 선택 checkbox, StatusLight 점. 반면 Calendar 칸 · DateInput 조각은 RAC 가 스스로 만드는 내부라 노드가 없는 것이 맞다                                                                               | `packages/rendering/src/renderers/skiaPrimitives.ts` (`listbox_item` · `tab_indicator` · `slider_fill_bar` · `value_fill_bar` · `tooltip_arrow` · `popover_arrow` · `status_light`) · `buildCatalogShapes.ts:537-548` |
| F10 | Canvas 는 몇 type 을 「자식을 합치는 type」 으로 다뤄 셸이 되지 않게 한다 (Select · ComboBox · Tabs · Toolbar · Tree …). 자유 자식을 받으려면 이 분류가 바뀐다                                                                                                                                                                                                                                                                        | `X/rulePaint.ts:20-51` (`SHELL_ONLY_TYPES` · `CHILD_PROP_MERGE_TYPES`) · `R/ruleShapes.ts:206-214`                                                                                                                    |
| F11 | 설치 RAC 에 있지만 catalog 에 없는 부품: Autocomplete · Group · OverlayArrow · SelectionIndicator · SubmenuTrigger · SliderFill · CheckboxField / CheckboxButton · SwitchField / SwitchButton · TokenField · NavigationTree · PreviewTrigger                                                                                                                                                                                          | RAC `dist/exports/*.mjs` · `S/catalog/bindings/` 목록                                                                                                                                                                 |
| F12 | 상태에 따라 바뀌는 것은 style 뿐이다 (`stateRules`). RAC render props 처럼 「선택되면 체크 표시를 보인다」 같은 내용 전환은 표현할 수 없다                                                                                                                                                                                                                                                                                            | `D/types.ts` (`stateRules` · `displayState`) — 내용 전환 필드 0                                                                                                                                                       |
| F13 | shared 합성 컴포넌트를 Builder UI 가 쓰는 곳은 Checkbox · ToggleButton · ToggleButtonGroup 셋뿐이다 (테스트 제외). 나머지 30개는 Preview renderer 만 쓴다                                                                                                                                                                                                                                                                             | `apps/builder/src/builder/components/property/PropertyCheckbox.tsx` · `apps/builder/src/builder/layout/PanelToggleGroup.tsx`                                                                                          |
| F14 | template 구조가 바뀌면 contract 를 올리고 옛 문서를 거부한다. 변환 코드는 없다 (contract 7)                                                                                                                                                                                                                                                                                                                                           | `D/types.ts:5-20` · `X/storage.ts:172-180` · `D/graph.ts:250-254`                                                                                                                                                     |

요약: slot 의 불일치 (F1 ~ F4) 는 증상이다. 원인은 Preview 의 18개 renderer 가 자식을 그리지 않거나 정해진 부품만 props 로 넘기고 (F5), 중첩 규칙이 그 한계를 사용자에게 옮긴 것 (F6) 이다. RAC 는 같은 부품의 자식을 자유롭게 받는다 (F7).

### 레퍼런스

| 무엇            | 기준                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RAC 컴포넌트    | react-aria.adobe.com 의 예제와 API 표. D1 정본은 설치된 패키지다 — 예제가 설치본에 없는 부품을 쓰면 설치본을 따른다                                                                                                                             |
| S2 전용         | react-spectrum.adobe.com — Card (`CardPreview` · `Content` 안의 `Text slot="title"` · `Text slot="description"` · `Footer`) · CardView · AvatarGroup · ButtonGroup · Badge · StatusLight · InlineAlert (`Heading` + `Content`) · ProgressCircle |
| 두 곳 모두      | 구조는 RAC 를 따른다 (D1). S2 는 이름 붙은 자리 (MenuItem 의 `label` · `description` · `Keyboard` · `avatar`) 와 props (D2) 만 참고한다. 예: S2 Tabs 는 TabPanels 가 없고 S2 TagGroup 은 TagList 가 없지만 우리는 RAC 구조를 쓴다               |
| 두 곳 모두 없음 | Nav · Pagination · FileUpload · Chart — 지금 구조 (사용자 확인 3)                                                                                                                                                                               |

외부 빌더의 slot:

- **Plasmic**: code component 의 slot prop 에 `allowedComponents` 로 허용 목록을 적는다 ([문서](https://docs.plasmic.app/learn/registering-code-components)). 허용 목록이 컴포넌트 작성자의 선언이다.
- **Webflow**: Component Slot 이 처음에는 컴포넌트만 받다가 2025 년에 모든 요소를 받게 바뀌었다 ([변경 기록](https://releases.sh/release/rel_NPLtElsFfOtyLT42-FCDu-component-slots-open-to-any-element-type)). 자유도를 넓히는 방향이다.
- **pen.dev**: 원본의 frame 을 slot 으로 지정하면 instance 가 그 자리를 아무 내용으로 채운다.
- **RAC**: 「slot」 은 넣는 구멍이 아니라 context 가 알아보는 이름 붙은 자리다 (`slot="title"` · `slot="description"` · `slot="increment"`). 넣을 수 있는 것은 부품의 `children` 종류가 정한다 — collection 은 항목만, 나머지는 자유 내용.

### Domain (SSOT 3-domain)

- **D1 DOM/접근성 (본체)**: Preview 가 RAC 부품을 노드 트리대로 조립한다. RAC 의 DOM · ARIA · 키보드는 그대로이고, 우리 renderer 가 끼어들어 구조를 정하던 것을 걷어낸다. 넣을 수 있는 자식의 판정을 「우리 renderer 가 그릴 수 있는가」 (F6) 에서 「RAC 부품의 `children` 종류」 로 바꾼다 (결정 지점 ③ — 사용자 지시가 근거).
- **D2 Props/API**: 새 prop 0. Card 의 S2 구조 전환은 D2 참조 원천 (RSP) 을 따르는 것이다. 상태별 표시 (Decision 7) 는 prop 이 아니라 노드의 표시 조건이다.
- **D3 시각 스타일**: 정본은 catalog 그대로다. 부모 rule 이 그리던 부품 (F9) 을 노드로 만들 때 모양 선언을 그 부품의 rule 로 옮긴다 (ADR-253 · DisclosureChevron 과 같은 방식). Generator 선언 (ADR 작성 규칙 #2): 생성기는 자식 selector 를 이미 낸다 (`packages/rendering/src/renderers/CSSGenerator.ts` `generateCompositionCSS`). 새 부품 type 은 rule 하나씩 추가한다.

### 제약

- **hard — 시각 계약**: ADR-248 G3 수치. Canvas ↔ DOM geometry ≤ 1 CSS px, 비텍스트 픽셀 차이 ≤ 0.001. 레퍼런스 구조로 바뀌어 달라지는 화면은 G0 목록에 고정하고 목록 밖 변화 0.
- **hard — 저장 포맷 (BC 수식)**: template 구조를 바꾸는 병합마다 contract +1 (7 → 8 …). 옛 개발용 프로젝트는 **전부** 열리지 않는다. 변환 0 파일. 보존 대상 프로젝트 0 이 전제다 (사용자 확인 1).
- **hard — 성능**: ADR-246 ratchet A등급 증가 0. 부품 노드가 늘어 `scene.build` 가 는다 — 컴포넌트 100개 격자에서 편집 한 번의 증가를 G6 에서 잰다.
- **hard — 번들**: Builder initial ≤ 1,421,000 · Preview ≤ 623,000 (ADR-201 재승인, 만료 2026-10-25 — 만료 뒤에는 그때의 상한). shared 합성 컴포넌트 30개를 Preview 경로에서 빼면 줄어드는 쪽이다.
- **hard — 접근성**: 조립을 자유롭게 열어도 RAC 가 요구하는 짝 (Select 의 Button + Popover > ListBox, ComboBox 의 Input, collection 의 항목) 이 없으면 RAC 가 오류를 내거나 이름이 사라진다. 필수 부품은 지울 수 없어야 한다.
- **soft**: Skia 전용 시각 효과 0. family 단위 worktree · phase 별 커밋 · Gate 통과 뒤 main 병합 (ADR-251 Decision 7).

## Alternatives Considered

### 대안 A: slot 만 레퍼런스에 맞춘다

- 설명: slot 25자리를 레퍼런스의 자식 종류로 다시 정하고 (collection → 항목, 그 밖 → 자유 내용), 넣을 수 있는 목록을 그 종류에서 만든다. Preview renderer 와 중첩 규칙 F6 은 그대로 둔다.
- 위험: 기술 L / 성능 L / 유지보수 H (자유 내용이라 선언해도 F5 의 18개 renderer 가 그리지 않으므로 F6 가 다시 막는다 — 선언과 실제가 갈린 채 남는다) / 마이그레이션 L
- 목표 판정: **미달**. field · Slider · Switch · Calendar 안의 조립, context 조립 (F11), 상태별 내용 (F12) 이 안 된다.

### 대안 B: 노드 트리를 RAC 부품 그대로 그린다 + 넣는 자리를 RAC 의 children 종류에서 가져온다

- 설명: ① Preview 가 노드 하나를 RAC 부품 하나로, 자식 순서대로, 부모의 RAC context 안에 그린다. 합성 renderer (F5 의 props 15 · 선별 8 · 무시 3) 를 RAC 부품의 노드 트리로 바꾼다. ② 원본 template 을 레퍼런스 예제의 조립으로 다시 쓴다. ③ 부품마다 받는 자식 종류 (항목 목록 / 자유 내용) 를 RAC API 에서 가져와 중첩 규칙 · 넣을 수 있는 목록 · slot 표시가 같은 판정을 쓴다. ④ 부모 rule 이 그리던 조립 가능 부품 (F9) 을 노드로 만든다. ⑤ catalog 에 없는 RAC 부품 (F11) 을 추가한다. ⑥ 상태별 표시를 노드에 둔다.
- 위험: 기술 H (RAC 의 context 조립을 일반 경로로 — 조건부 부품 · 필수 짝 · collection 내부 규칙) / 성능 M (노드 수 증가 · 해석 비용) / 유지보수 L (그리기 경로가 하나 — 컴포넌트별 renderer 가 준다) / 마이그레이션 H (원본 template 대부분 · G3 승인 기록 · 테스트 경로)

### 대안 C: pen.dev 식 자유 slot

- 설명: 모든 frame 성 부품을 slot 으로 열고 무엇이든 넣게 한다. Preview 는 지금 renderer 를 유지하고, 그리지 못하는 자식은 renderer 옆에 덧붙여 그린다.
- 위험: 기술 H (RAC 부품 밖에 덧붙인 요소는 context 를 받지 못한다 — 예: TextField 옆에 붙인 Button 은 field 의 disabled 를 모른다) / 성능 L / 유지보수 H (renderer 47개마다 덧붙임 규칙) / 마이그레이션 L
- 목표 판정: **미달**. 자유도는 넓지만 RAC 의 조립이 아니다 (D1 침범 — 접근성 연결이 끊긴다).

### 대안 D: shared 합성 컴포넌트에 slot prop 을 추가 (Plasmic 식)

- 설명: 지금 renderer 를 두고, 각 합성 컴포넌트에 `prefix` · `suffix` · `footer` 같은 ReactNode slot prop 을 더해 허용 목록을 선언한다.
- 위험: 기술 M / 성능 L / 유지보수 H (컴포넌트마다 slot prop 설계 · RSP 에 없는 prop — D2 위반) / 마이그레이션 M
- 목표 판정: **미달**. 우리가 정한 자리만 열린다. RAC 예제의 임의 조립은 여전히 안 된다.

### Risk Threshold Check

| 대안 | HIGH+                   | 목표 (RAC 예제 재현) |
| ---- | ----------------------- | -------------------- |
| A    | 유지보수 H              | 미달                 |
| B    | 기술 H · 마이그레이션 H | 충족                 |
| C    | 기술 H · 유지보수 H     | 미달                 |
| D    | 유지보수 H              | 미달                 |

모든 대안이 HIGH 1개 이상이다. 1차 루프: 목표를 충족하는 것은 B 뿐이므로 B 의 HIGH 를 줄이는 방법을 찾았다 — family 단위로 나눠 각 family 가 자기 Gate 와 후퇴안 (그 family 만 옛 renderer 유지) 을 갖게 하면 기술 위험이 한 family 범위로 묶인다. 마이그레이션 H 는 줄지 않는다 — 보존 대상 프로젝트 0 (F14 · 사용자 확인 1) 이 수용 근거다. 2차 루프에서 다른 대안 (A 를 먼저 하고 B 를 나중에) 을 따졌으나 A 의 slot 선언은 B 에서 다시 쓰이므로 이중 작업이다 — Phase 순서로 흡수한다 (breakdown).

## Decision

**대안 B** 를 선택한다. 사용자 원칙 「RAC 수준이 되지 않는다면 빌더를 하는 의미가 없다」 를 충족하는 유일한 대안이다.

1. **기준**: RAC 컴포넌트는 react-aria.adobe.com 예제와 API, D1 정본은 설치된 RAC. RAC 에 없는 S2 컴포넌트는 react-spectrum.adobe.com. 두 곳 모두 있으면 구조는 RAC, 이름 붙은 자리 · props 만 S2 참고. 두 곳 모두 없는 Nav · Pagination · FileUpload · Chart 는 지금 구조 (사용자 확인 3).
2. **Preview 는 노드 트리를 그린다**: 노드 하나 = RAC 부품 하나 (또는 RAC 가 요소를 주지 않는 자리의 plain 요소), 자식 순서대로, 부모의 RAC context 안에서. 컴포넌트별 위임 renderer 는 RAC 가 요구하는 것만 남긴다 — collection 의 `id` · `textValue`, Select · ComboBox 의 Popover 연결, 펼침 · 선택 같은 실행 값 (ADR-250). shared 합성 컴포넌트는 Builder UI 가 쓰는 3개 (F13) 만 남기고 Preview 경로에서 뺀다.
3. **원본 template = 레퍼런스 예제의 조립**: 예) TextField = `TextField > Label + Input + Text[slot=description] + FieldError` · Checkbox = `CheckboxField > CheckboxButton (indicator + 글자) + Description + FieldError` (F8) · NumberField = `NumberField > Label + Group > (Button[slot=decrement] + Input + Button[slot=increment])`. 지금의 wrapper type (`SelectTrigger` 등) 은 RAC 의 `Group` 으로 바꾼다. 예제의 CSS class 가 아니라 우리 catalog rule 이 모양의 정본이다 (D3 무변경).
4. **넣는 자리 = 부품의 children 종류**: 부품마다 `항목 목록 (받는 항목 type)` 또는 `자유 내용` 을 type 특성 표 (`S/domain/componentTraits.ts`) 에 둔다. 중첩 규칙 · Properties 의 「넣기」 목록 · Components page 의 빈 slot 표시가 이 하나를 읽는다. `SELF_COMPOSED_CONTAINER_CHILD_TYPES` (F6) 는 「아직 전환하지 않은 family 의 제한」 으로 뜻을 바꿔 판정에 교집합으로만 남기고, family 가 전환될 때마다 그 행을 지워 끝에 없앤다. template 의 `slot` 선언은 이름 (Components page 표시) 만 남고, 넣을 수 있는지는 종류가 정한다. 컴포넌트 자신에 걸린 자리 (F4) 도 instance 에서 채울 수 있다.
5. **필수 부품**: RAC 가 동작에 요구하는 부품 (Select 의 trigger Button · Popover · ListBox, ComboBox 의 Input, Slider 의 Track · Thumb, Calendar 의 Grid …) 은 지울 수 없고 옮길 수 없다. 그 밖의 부품 (Label · Description · FieldError · 아이콘 …) 은 지우고 · 옮기고 · 다른 것을 끼울 수 있다. 목록은 RAC 소스 (`useContext` 가 요구하는 짝) 로 G0 에서 고정한다.
6. **조립 가능한데 부모 rule 이 그리던 부품을 노드로 (F9)**: 선택 표시 (`SelectionIndicator`) · Tag 지우기 (`Button slot="remove"`) · Slider 채움 (`SliderFill`) · overlay 화살표 (`OverlayArrow`) · ProgressBar · Meter 채움 · TreeItem 선택 checkbox. Canvas 는 그 노드를 자기 rule 로 그린다 (DisclosureChevron 선례). RAC 가 스스로 만드는 내부 (Calendar 칸 · DateInput 조각) 는 그대로 부모가 그린다.
7. **상태별 표시**: 노드가 「어느 상태에서 보이는가」 (`showWhen` — 예: `isSelected` · `isExpanded` · `isIndeterminate` · `isInvalid`) 를 가진다. Preview 는 RAC render props 로, Canvas 는 그 노드의 유효 상태 (displayState · 파생 값) 로 판정한다. 내용 전환은 「상태마다 다른 노드를 보인다」 로 표현하고 다른 표현식은 두지 않는다 (사용자 확인 2).
8. **catalog 에 없는 RAC 부품 (F11)** 을 레퍼런스 예제가 쓰는 만큼 추가한다 — Autocomplete · Group · OverlayArrow · SelectionIndicator · SubmenuTrigger · SliderFill · CheckboxField · CheckboxButton · SwitchField · SwitchButton. TokenField · NavigationTree · PreviewTrigger 는 G0 목록에서 쓰임이 확인될 때만.
9. **Card 를 S2 구조로**: `Card > CardPreview + Content (Text[slot=title] + Text[slot=description] + 자유 내용) + Footer (자유 내용)`. CardHeader 를 없앤다 (사용자 결정 2026-09-29 「ADR-248 완료 뒤」 — ADR-248 은 2026-10-05 Implemented). ADR-240 이 「영역별 새 type (RSP 식)」 을 유지보수 부담으로 기각했으나, 그 부담의 근거였던 영역별 renderer 가 Decision 2 로 사라지므로 이 ADR 이 그 기각을 뒤집는다.
10. **저장 포맷**: template 이 바뀌는 병합마다 contract +1, 옛 문서 거부, 변환 0 (ADR-253 Decision 9 와 같다 — 사용자 확인 1).
11. **완료 판정 = 레퍼런스 예제 재현**: G0 에서 고르는 react-aria.adobe.com · react-spectrum.adobe.com 예제 세트를 Builder 의 UI 만으로 만들고, Preview DOM 의 role · aria 트리가 예제와 같고 Canvas 가 Preview 와 G3 수치 안에서 같다.

> 구현 상세: [256-rac-composition-level-breakdown.md](design/256-rac-composition-level-breakdown.md)

**위험 수용 근거**: 기술 H 는 family 단위 Phase 와 Phase 별 후퇴안 (그 family 만 옛 renderer) 으로 한 family 범위로 묶는다. ADR-253 이 field 부품에서 같은 전환 (부품을 자기 binding 으로 RAC context 안에 그림) 을 이미 했으므로 경로는 검증돼 있다 — 남은 것은 배치를 shared 컴포넌트에서 노드 순서로 옮기는 것이다. 마이그레이션 H 는 보존 대상 프로젝트 0 이 전제다.

**기각 사유**

- A: slot 을 「자유 내용」 이라 선언해도 Preview 가 그리지 않으면 중첩 규칙이 다시 막는다 (F5 · F6). 목표 미달이고, 그 선언은 B 에서 그대로 다시 쓰이므로 먼저 할 이유가 없다.
- C: 덧붙인 요소가 RAC context 밖이라 접근성 · 상태 연결이 끊긴다 (D1). 자유도는 RAC 조립이 아니다.
- D: 우리가 고른 자리만 열리고 RSP 에 없는 prop 이 생긴다 (D2 위반). Plasmic 의 `allowedComponents` 는 code component 작성자가 자기 컴포넌트를 선언하는 방식이라, RAC 부품 자체를 조립하는 우리 목표와 다르다.

## Risks

| ID  | 위험                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------- |
| R1  | DOM · 동작이 달라짐 — shared 합성 컴포넌트가 하던 조건부 부품 (label 이 비면 Label 없음 · necessity 표시 · 빈 description) 과 RAC prop 전달 (`X/delegatedDom.tsx:982-1004` 등) 을 노드 트리에서 다시 해야 한다                    |  HIGH  | family 마다 전환 전후 role · aria 트리 대조 + 동작 시험 (G2)                                        |
| R2  | 필수 짝이 깨지면 RAC 가 throw — 예: collection 밖 ListBoxItem, Select 안 Popover 없음. 자유 조립을 열면 사용자가 그런 트리를 만들 수 있다                                                                                         |  HIGH  | Decision 5 의 필수 부품 고정 + 중첩 규칙이 RAC 의 짝을 읽음 + Preview 의 부품별 오류 경계 (G1 · G2) |
| R3  | Canvas 비대칭 — 자유 자식을 받게 된 부품 (field · Checkbox · Slider …) 을 Skia 가 Preview 와 같은 배치로 그려야 한다. 셸 분류 (`X/rulePaint.ts:20-51`) 와 부모 rule primitive 가 자식 자리를 차지한다 (`R/ruleShapes.ts:198-232`) |  HIGH  | family 마다 G3 하니스 + 자유 자식 1개 이상 넣은 fixture (G2)                                        |
| R4  | 의도하지 않은 화면 변화 — 레퍼런스 구조로 바꾸며 부품이 늘고 배치가 바뀐다 (Checkbox 의 Description · FieldError 등)                                                                                                              |  MED   | G0 에 바뀌는 목록 고정 · 목록 밖 변화 0                                                             |
| R5  | 해석 · 그리기 비용 — 부품 노드가 늘어 `scene.build` 와 Preview delta 가 는다                                                                                                                                                      |  MED   | G6 (컴포넌트 100개 격자 · ratchet)                                                                  |
| R6  | contract 거부 · G3 승인 기록 · 테스트의 template 경로가 대량으로 바뀐다                                                                                                                                                           |  MED   | 병합마다 contract +1 · 경로는 그 병합에서 갱신 (ADR-255 방식)                                       |
| R7  | 상태별 표시의 Canvas 판정 — Canvas 는 실제 상호작용이 없어 displayState · 파생 값 (`X/presence.ts` `derivedProps`) 으로만 판정한다. 파생 값이 없는 상태는 Canvas 에서 보일 수 없다                                                |  MED   | G0 에 상태 × 파생 값 표 · 없는 상태는 Components page 상태 칸에서만 확인                            |
| R8  | 범위 — 위임 renderer 26개 (props 15 · 선별 8 · 무시 3) · 원본 template 대부분 · 새 부품 type 10개 이상                                                                                                                            |  HIGH  | family 단위 Phase · Phase 마다 Gate 와 후퇴안 · 추정 대비 1.5배 이상이면 사후 보고 (ADR 작성 규칙)  |
| R9  | 패널 · AI 도구가 옛 판정을 읽는다 — `TEXT_ONLY_SUBPART_PARENTS` · `SELF_COMPOSED_CONTAINER_CHILD_TYPES` · AI tool 의 preflight                                                                                                    |  MED   | 판정 함수를 하나로 (Decision 4) · 정적 테스트로 옛 표 참조 0                                        |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                            | 실패 시 대안                                         |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| G0   | 착수 전      | 인벤토리 고정: ① 컴포넌트 × 레퍼런스 예제 구조 × 지금 template 의 차이 ② 부품별 children 종류 · 필수 부품 (RAC 소스 근거) ③ 부모 rule 이 그리는 부품 중 노드로 만들 것 / 내부로 둘 것 ④ 상태 × 파생 값 표 ⑤ 바뀌는 화면 목록 ⑥ 완료 판정용 예제 세트 (Decision 11) ⑦ 사용자 확인 1 · 2 · 3 의 답                     | 확인이 안 되면 Accepted 로 올리지 않는다             |
| G1   | Phase 1      | 판정 하나: 중첩 규칙 · 넣기 목록 · slot 표시가 같은 children 종류를 읽는다 (정적 테스트 — 판정 함수 밖의 옛 표 참조 0). F3 의 시험을 다시 돌려 「목록에 뜨는 것은 전부 들어간다 / 항목 목록에는 항목만」 (원복 RED) (R2 · R9)                                                                                        | 판정 전환을 미루고 옛 표 유지 (family 전환과 독립)   |
| G2   | family 마다  | 그 family 의 Preview 가 노드 트리대로 그린다: 위임 renderer 삭제 또는 RAC 요구 값만 남음 · role · aria 트리가 레퍼런스 예제와 같다 · 자유 자식 1개 이상 넣은 fixture 가 Canvas · Preview 에서 같다 (G3 하니스) · 필수 부품은 지울 수 없다 · 동작 시험 (선택 · 펼침 · validation · disabled 전파) 통과 (R1 · R2 · R3) | 그 family 만 옛 renderer 로 두고 다음 family 로 진행 |
| G3   | Phase 상태별 | 상태별 표시: 선택 표시 · 펼침 아이콘 · indeterminate 가 Preview (render props) 와 Canvas (displayState) 에서 같은 상태에 보인다 (R7)                                                                                                                                                                                 | 상태별 표시만 미룬다 (사용자 판정)                   |
| G4   | 각 Phase 끝  | ADR-246 ratchet A등급 증가 0 · `scene.build` Δ 기록 — 대상: 컴포넌트 100개 격자 (합성물 = 규모 전용), 불리한 조작 = 편집 한 번 · 페이지 전환, 대조군 = 전환 전 빌드와 교대 3쌍 중앙값, 조건 = headed Chrome · visible 탭 · CPU 4x · initial 번들 상한 안 (R5)                                                        | 그 Phase 의 병합 보류                                |
| G5   | 종결         | Decision 11 의 예제 세트를 실제 Builder UI 만으로 만들어 Compare Mode 에서 같고, Preview 의 role · aria 트리가 예제와 같다 (live) · 사용자 확인. 기준값은 우리 출력이 아니라 레퍼런스 예제 코드를 설치 RAC 로 그대로 마운트한 DOM 이다 (oracle 독립)                                                                 | 통과하지 못한 예제를 목록으로 남기고 사용자 판정     |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 빌더로 만들 수 있는 구조가 RAC 예제와 같아진다 — field 안의 아이콘 · 버튼, 항목 안의 두 줄 글자와 Avatar, Popover 안의 Autocomplete, Dialog 의 닫기 버튼 slot.
- 「넣을 수 있는가」 의 판정이 하나가 된다 — slot 25자리 손 지정 · 5종 목록 · renderer 한계 표가 RAC children 종류 하나로.
- Preview 의 컴포넌트별 renderer 가 준다 — 그리기 경로가 하나라 새 RAC 부품 추가 비용이 binding 과 rule 하나다.
- Card 가 S2 구조가 되고 CardHeader 가 사라진다.

### Negative

- template 대부분과 G3 승인 기록 · 테스트 경로를 다시 쓴다. 옛 개발용 프로젝트는 열리지 않는다.
- 노드 수가 늘어 해석 비용이 는다 (G4 에서 상한 관리).
- 자유 조립을 열면 사용자가 RAC 가 의도하지 않은 조합도 만들 수 있다 — 필수 부품 외의 조합은 RAC 와 같이 허용한다 (RAC 도 막지 않는다).
