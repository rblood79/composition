# ADR-912 컴포넌트 Prop Parity 감사 — binding.accepts ↔ RAC/React Spectrum 공식 대조

> **목적**: ADR-912 spec→catalog cutover 이후 "컴포넌트 프로퍼티 대량 소실" 보고에 대한 전수 진단.
> 각 컴포넌트의 현재 편집 surface(`*.binding.ts`의 `props.accepts`)를 React Aria Components(RAC, D1 DOM 정본) + React Spectrum(RSP/S2, D2 props 참조) 공식 prop과 대조한다.
>
> **상태**: 감사 문서 (코드 미반영). 반영 우선순위는 §7 참조.
> **작성일**: 2026-06-25
> **방법**: 115개 binding 전수 추출(현재 상태) × 5개 패밀리 병렬 공식 문서 대조(react-aria.adobe.com + react-spectrum.adobe.com). 추측 0 — 공식 표 미확인 항목은 ⚠️.

---

## 0. 판정 범례

| 기호       | 의미                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| ✅유지     | 현재 노출이 공식과 정합, 또는 composition D3 시각 prop으로 정당              |
| ❌누락     | 공식 표준 prop이며 노코드 빌더에서 편집 가치 있는데 미노출                   |
| ➖제외정당 | 런타임 핸들러(onXxx)/ref/DOM passthrough/스타일 패널 별도 처리 → 미노출 정당 |
| ⚠️재검토   | 공식 미확인 / RSP 미규정 custom(D2 정책 판단 필요) / 명칭·위치 불일치        |

---

## 1. 진단 요약 — "대량 소실"의 두 층위

ADR-912 cutover 후 프로퍼티 소실은 **두 개의 독립된 층위**로 나뉜다. 혼동하면 안 된다.

### 층위 A — field kind 렌더러 누락 (이미 복원 완료)

`InspectorFieldKind` 11종 중 `binding`/`items-manager` 2종이 generic Inspector 렌더러(`GenericFieldRenderer.tsx` / `CatalogInspectorFields.tsx`)의 switch에서 누락 → 정의는 됐으나 화면에 안 그려짐.

- `1419a5773` — `kind:"binding"` (collection Data 바인딩 UI) 복원
- `24f38b75b` — `kind:"items-manager"` (정적 items 추가/제거 UI) 복원 + 타입 확장 + 6개 binding 정의

**현 상태**: 정의 11종 ↔ 처리 11종 **완전 일치. 추가 누락 kind 없음.** (검증: 두 렌더러 switch 전수 대조)

### 층위 B — binding.accepts 자체의 prop 누락 (본 감사 대상, 미해결)

field kind는 _정의된_ prop을 렌더할 뿐이다. **`accepts`에 애초에 선언 안 된 prop**은 kind 검사로 안 잡힌다. 이게 본 감사가 발견한 실질적 "소실" — spec(124파일)→binding(115파일) 이전 과정에서 각 컴포넌트의 편집 가능 prop 집합이 **공식 대비 축소**됐다.

본 문서 §2~§6은 층위 B를 다룬다.

---

## 1.6. 중복 점검 — prop 중복 선언 / cross-binding 불일치 / universal 이중 노출 (2026-06-25)

> 층위 B(누락)와 **직교하는 별도 축**: 누락이 아니라 **중복·불일치**. 115 binding 전수 AST 스캔(`scratchpad/dup-check.mjs` + `cross-def.mjs`). cutover 과정에서 같은 prop이 컴포넌트마다 제각각 정의되거나 보편 시각 키와 겹쳐 패널에 두 번 노출되는 사례를 식별.

### 1.6-A. 한 binding 내부 동일 키 중복 선언 → **0건 ✅**

JS 객체 리터럴이라 중복 키는 마지막 선언이 이김(silent 손실). 115 binding 전수 0건 — 위험 없음.

### 1.6-B. 같은 prop 키, binding 간 kind 불일치

| 키        | 불일치                                                           | 판정                                                                                                                                                  |
| --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`   | `Input`/`Radio`=string vs `Meter`/`ProgressBar`/`Slider*`=number | ➖ **정당** — 의미가 다름(텍스트 입력값 vs 수치). RAC 도 Input.value=string / Meter.value=number. (단 Radio.value 는 §3 live consumer 건과 동일 선상) |
| `variant` | `Input`=enum vs 나머지 46개=variant                              | ❌ **불일치 → P0**. Input 만 `kind:"enum"`. variant kind 는 theme `data-*` 라우팅(D3), enum 은 React prop 통과 → Input variant 가 시각 변형 경로 이탈 |

### 1.6-C. 같은 prop 키, kind 동일하나 label 표기 흔들림

대부분 ➖정당(맥락별 라벨). 사소한 표기 흔들림만 선택적 정정 대상:

- ➖ 정당(맥락별): `children`("Text"/"Month/Year"/"Description" 등 canonical children 맥락 라벨), `label`("Label" vs ColorPicker "Trigger Label")
- ⚠️ 표기 흔들림(기능 영향 없음, 선택적 정정): `minValue`/`maxValue`(Slider "Min/Max" vs NumberField "Min Value/Max Value"), `href`("Href"/"Link"/"URL"), `type`("Type" vs "Input Type"), `iconName`("Icon" vs "Calendar Icon")

### 1.6-D. `accepts` ∩ `UNIVERSAL_STYLE_CONTRACTS` 이중 노출 → **4건 (구조)**

`resolveEditContract`는 (A) semantic 루프(`accepts`, origin:"semantic") + (B) style 루프(`UNIVERSAL_STYLE_CONTRACTS`, origin:"style")를 **dedup 없이** 각각 push한다(`resolveEditContract.ts:216-264`). 두 집합에 같은 키가 있으면 **같은 키가 두 필드로** 패널에 노출.

| 충돌 키 | binding accepts                                           | UNIVERSAL                            | 위험                                                                                                                                                    |
| ------- | --------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color` | `ColorSwatch`/`TailSwatch`: string "Color Value"(content) | string "Text Color"(typography)      | ❌ Properties뷰 "Color Value" + Style뷰 "Text Color" 두 필드. write target 분리(props.color vs props.style.color)라 corruption 아니나 **같은 색 두 칸** |
| `step`  | `NumberField`/`Slider`: number "Step"(content, min:0)     | number "Step"(appearance, step:0.01) | ❌ "Step" 필드 2개. NumberField.step=RAC 동작 prop, universal.step=시각 채널 — **의미 다른데 같은 키**                                                  |

> dead 아님 — origin 분리로 store write 는 안 섞이나, **사용자 패널에 동명 필드 2회 노출**. 정정 방향: (1) `resolveEditContract`에서 accepts 키가 universal 과 겹치면 semantic 우선 + style 제외(dedup), 또는 (2) binding 에서 universal 중복 키 제거. P0 에 기록.

---

## 2. 패밀리별 ❌누락 prop — 우선순위 정렬 비교표

### 2-1. 입력/폼 패밀리

| 컴포넌트                   | ❌누락 prop                                              |      RAC       | RSP | 빌더 편집 가치 근거                                                                                                                                   |
| -------------------------- | -------------------------------------------------------- | :------------: | :-: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **공통 (대부분)**          | `value`/`defaultValue`(또는 `defaultSelected`)           |       ✅       | ✅  | 폼 프리필(미리 채운 폼)은 노코드 빌더 일반 편집 행위. 현재 controlled `isSelected`만 있어 "기본값/기본 체크" 표현 불가                                |
| **공통 (대부분)**          | `name`                                                   |       ✅       | ✅  | 폼 제출 시 필드 식별자. 없으면 폼으로서 동작 불완전                                                                                                   |
| **공통 (필드류)**          | `errorMessage`                                           | ✅(FieldError) | ✅  | label·description은 노출하면서 검증 메시지만 빠진 비대칭 → 검증 UI 완성 불가                                                                          |
| TextField / TextArea       | `maxLength` `minLength` `pattern`                        |       ✅       | ✅  | 글자 수 제한·형식 검증(이메일/전화)은 코드 없이 거는 표준 폼 제약                                                                                     |
| NumberField                | `formatOptions`                                          |       ✅       | ✅  | `$1,000`/`50%`/소수 표시 형식 — 숫자 필드 핵심. (`hideStepper`는 이 repo Adobe 패키지 타입·wrapper 에 없음 → §3 ⚠️재검토 강등, codex 리뷰 2026-06-25) |
| Slider                     | `formatOptions` `isFilled`/`fillOffset` `showValueLabel` |       ✅       | ✅  | 값 라벨 형식 + 채움 막대 표시/기준점 + 값 라벨 on/off                                                                                                 |
| Checkbox                   | `value` `defaultSelected`                                |       ✅       | ✅  | `value` 없으면 CheckboxGroup 제출 시 선택 항목 식별 불가                                                                                              |
| CheckboxGroup / RadioGroup | `value`/`defaultValue` `name` `errorMessage`             |       ✅       | ✅  | 그룹 기본 선택 + 제출 키 + 그룹 검증 메시지                                                                                                           |
| Switch / ToggleButton      | `defaultSelected`                                        |       ✅       | ✅  | 기본 on/off 상태 프리필                                                                                                                               |
| ToggleButtonGroup          | `defaultSelectedKeys` `disallowEmptySelection`           |       ✅       | ⚠️  | 그룹 기본 선택 + 최소 1개 선택 강제                                                                                                                   |
| Button / ToggleButton      | `staticColor`                                            |       ✗        | ✅  | 컬러/이미지 배경 위 버튼 대비 확보                                                                                                                    |
| Form                       | `isQuiet`/`isEmphasized` `isDisabled`                    |       ✗        | ✅  | 폼 전체 필드 스타일/비활성 일괄 제어(자식 상속)                                                                                                       |

### 2-2. 선택/날짜/색상 패밀리

| 컴포넌트                        | ❌누락 prop                                                              | RAC | RSP | 빌더 편집 가치 근거                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------ | :-: | :-: | ------------------------------------------------------------------------------------------------------------------------------ |
| **Date 4종 전부**               | `granularity`                                                            | ✅  | ✅  | "날짜만 vs 시각 포함" 결정 — Date 컴포넌트의 가장 본질적 형식 prop. DateField/TimeField/DatePicker/DateRangePicker 전부 미노출 |
| **Date 4종 전부**               | `minValue`/`maxValue`                                                    | ✅  | ✅  | 선택 가능 날짜/시각 범위 제한 (폼 제약)                                                                                        |
| DateField/TimeField/DatePicker  | `placeholderValue` `hourCycle`                                           | ✅  | ✅  | 빈 상태 형식 기준 + 12/24시간제                                                                                                |
| Calendar / RangeCalendar        | `visibleDuration`/`visibleMonths` `firstDayOfWeek` `minValue`/`maxValue` | ✅  | ✅  | 동시 표시 월 수(직접적 시각 변화) + 주 시작 요일(격자 시각) + 범위                                                             |
| RangeCalendar / DateRangePicker | `allowsNonContiguousRanges`                                              | ✅  | ✅  | 불가용 날짜 포함 비연속 범위 허용 — Range 고유 핵심 동작                                                                       |
| Select                          | `isRequired` `isInvalid` `labelPosition`                                 | ✅  | ✅  | 다른 필드는 노출 중인데 Select만 누락(비대칭)                                                                                  |
| ComboBox                        | `allowsCustomValue` `menuTrigger` `isReadOnly` `isRequired` `isInvalid`  | ✅  | ✅  | `allowsCustomValue`/`menuTrigger`는 ComboBox를 Select와 구분짓는 핵심 동작 prop                                                |
| ColorField                      | `channel` `colorSpace`                                                   | ✅  | ✅  | hex 전체 vs 단일 채널 편집 결정                                                                                                |
| ColorArea                       | `xChannel` `yChannel` `colorSpace`                                       | ✅  | ✅  | 2D 영역이 어떤 채널을 편집하는지 정의 (현재 `isDisabled` 하나만 노출)                                                          |
| ColorSlider                     | `channel` `colorSpace` `orientation`                                     | ✅  | ✅  | 조작 채널 + 색공간 + 방향 (현재 `label`+`isDisabled`만)                                                                        |

### 2-3. 컬렉션 패밀리 (ADR-912 cutover 핵심 영역)

| 컴포넌트                                | ❌누락 prop                                                                                                                                 | RAC  |   RSP    | 빌더 편집 가치 근거                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | :--: | :------: | ----------------------------------------------------------- |
| **거의 전 컬렉션**                      | `disabledKeys`                                                                                                                              |  ✅  |    ✅    | 특정 항목 초기 비활성 지정 (초기 상태)                      |
| **거의 전 컬렉션**                      | `disallowEmptySelection`                                                                                                                    |  ✅  |    ✅    | 빈 선택 금지 정적 설정                                      |
| **거의 전 컬렉션**                      | `defaultSelectedKeys`                                                                                                                       |  ✅  |    ✅    | 초기 선택 항목                                              |
| ListBox/GridList/Table/TagGroup/Tree    | `selectionBehavior` (toggle/replace)                                                                                                        |  ✅  |    ✅    | 다중선택 시 토글 vs 교체 동작                               |
| GridList/Table/TableView/Tree           | `disabledBehavior` (all/selection)                                                                                                          |  ✅  |    ✅    | 비활성 항목이 모든 상호작용 차단인지 선택만인지             |
| GridList(ListView)/Table/TableView/Tree | `selectionStyle` (checkbox/highlight)                                                                                                       |  ✗   |    ✅    | 체크박스 vs 하이라이트 선택 표시 — v3 규정 시각             |
| ListBox / GridList                      | `layout` (stack/grid) `orientation`                                                                                                         |  ✅  |    ✗     | stack/grid 배치 + 가로/세로 방향 (핵심 시각 구조)           |
| Menu                                    | `disabledKeys` `disallowEmptySelection` `defaultSelectedKeys` `shouldCloseOnSelect`                                                         |  ✅  |    ✅    | 메뉴 항목 비활성 + 선택형 메뉴 초기 상태 + 선택 시 닫힘     |
| Table                                   | `density` `overflowMode` `allowsSorting`(Column)                                                                                            |  ✗   |    ✅    | 행 밀도 + 셀 넘침 처리(truncate/wrap)                       |
| TableView                               | `selectionStyle` `overflowMode` + disabled/selection 계열                                                                                   |  ✗   |    ✅    | 핵심 시각 prop 다수 누락                                    |
| Tabs                                    | `keyboardActivation` `defaultSelectedKey` `disabledKeys`                                                                                    |  ✅  |    ✅    | 자동/수동 활성 + 초기 선택 탭 + 탭 비활성                   |
| TagGroup                                | `labelAlign` `selectionBehavior` `disabledKeys` `disallowEmptySelection` `defaultSelectedKeys` `maxRows`                                    | 혼합 |    ✅    | 라벨 정렬 + 다중선택 동작 + 초기 표시 행 제한(접기/더보기)  |
| Tree                                    | `selectionBehavior` `selectionStyle` `disabledKeys` `disabledBehavior` `disallowEmptySelection` `defaultSelectedKeys` `defaultExpandedKeys` |  ✅  |    ✅    | `defaultExpandedKeys`(초기 펼침 노드)는 Tree 핵심 초기 상태 |
| CardView                                | `disabledKeys` `disallowEmptySelection` `defaultSelectedKeys`                                                                               |  ✗   | ✅(상속) | GridListProps 상속 — 초기 선택/비활성                       |

### 2-4. 오버레이/네비/피드백 패밀리

| 컴포넌트            | ❌누락 prop                                 |       RAC        |      RSP      | 빌더 편집 가치 근거                                                   |
| ------------------- | ------------------------------------------- | :--------------: | :-----------: | --------------------------------------------------------------------- |
| Popover             | `placement` `offset`                        |        ✅        |      ✅       | 팝오버 방향(top/bottom/left/right) + 트리거 간격 — 빌더 핵심          |
| Modal               | `isDismissable` `isKeyboardDismissDisabled` | ✅(ModalOverlay) |      ✅       | 바깥 클릭/Escape 닫기 제어 (현재 `trapFocus`는 ➖제외정당 — RAC 자동) |
| Tooltip             | `placement` `delay` `isDisabled`            |        ✅        |      ✅       | 툴팁 방향 + 표시 지연(ms) + 비활성                                    |
| Dialog              | `role` (dialog/alertdialog)                 |        ✅        |      ✅       | alertdialog 시맨틱 전환(파괴적 확인 다이얼로그)                       |
| Disclosure          | `defaultExpanded` `isDisabled`              |        ✅        |      ✅       | 초기 확장 상태 + 비활성                                               |
| DisclosureGroup     | `isDisabled`                                |        ✅        | ✅(Accordion) | 그룹 전체 비활성                                                      |
| ProgressBar / Meter | `formatOptions` `valueLabel`                |        ✅        |      ✅       | % vs 절대값 포맷 + 값 라벨 오버라이드                                 |
| StatusLight         | `isDisabled`                                |        ✗         |      ✅       | 비활성 토글                                                           |
| Card                | `density`                                   |        ✗         |    ✅(S2)     | 카드 내부 밀도                                                        |
| Toast               | `actionLabel`                               |        ⚠️        |      ✅       | 액션 버튼 라벨                                                        |
| DropZone            | `isDisabled`                                |        ✅        |      ⚠️       | DropZone의 유일한 실표준 편집 prop(드롭 비활성)                       |
| FileTrigger         | `acceptedFileTypes`                         |        ✅        |      ⚠️       | 허용 파일 mime 타입(`image/png` 등) — 핵심                            |

### 2-5. 타이포/미디어/구조 & 서브파트 패밀리

| 컴포넌트    | ❌누락 prop     |    RAC     |   RSP   | 빌더 편집 가치 근거                                                                                                                                                                              |
| ----------- | --------------- | :--------: | :-----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Heading** | `level` (h1~h6) | ✅(기본 3) | ✅(1~6) | **이 패밀리 최대 누락.** 시각 size와 의미 level은 직교(SEO/문서 아웃라인/스크린리더). 빌더 factory가 이미 `headingLevel:3` 내부 사용 중(`NavigationComponents.ts:237`)인데 편집 surface에만 없음 |

> 그 외 타이포 leaf(Text/Paragraph/Body/Label/Description/Code/Kbd/FieldError)와 서브파트 27종은 children+size로 충분 → ✅유지/➖제외정당. (상세 §5)

---

## 3. ⚠️재검토 — D2 정책 판단 필요 항목 (RSP 미규정 custom prop)

SSOT 체인 D2(Props/API) 규칙상 **RSP 미규정 prop 임의 도입은 금지**(ADR-062 Field variant 제거 선례). 아래는 RAC/RSP 공식에 없는 현재 노출 prop — 제거 대상인지 composition D3 정당 prop인지 별도 판정 필요.

| 항목                                                                                               | 현재 노출 | 공식 상태                                 | 쟁점                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`variant` 문자열** (Checkbox/CheckboxGroup/Radio/RadioGroup/Switch/Form)                         | ✅        | RSP는 boolean `isEmphasized`              | ADR-062 패턴과 동일 — `variant` 문자열이 D2 위반 소지. `isEmphasized`로 정렬 검토                                                                                                                                                 |
| **Radio `isSelected`**                                                                             | ✅        | RAC/RSP Radio엔 없음(그룹 value로 선택)   | **live consumer 있음** — `FormRenderers.tsx` 가 `defaultSelected={Boolean(props.isSelected)}` 로 "초기 선택" 의미로 소비. dead 아님 → 단순 제거 시 회귀. 제거 대상 아니라 "live consumer 대체 설계 없으면 보류"(codex 2026-06-25) |
| **`variant`/`size`** (Calendar/RangeCalendar/Tree/ListBox/GridList/Menu/Table/Tabs/ColorPicker 등) | ✅        | RAC unstyled라 없음, v3는 density/isQuiet | composition D3 시각 prop이면 정당(Spec 영역). RSP 미규정이므로 D2 정책 확인 필요                                                                                                                                                  |
| **TableView `allowsResizingColumns`**                                                              | ✅        | 공식은 Column `allowsResizing`            | 빌더 루트 추상화는 가능하나 명칭 비공식 — 정정 권장                                                                                                                                                                               |
| **TableView `allowsSorting`**                                                                      | ✅        | 공식은 Column 레벨                        | 루트 "전체 정렬 허용" 추상화로 정당화 가능                                                                                                                                                                                        |
| **TagGroup `allowsRemoving`**                                                                      | ✅        | 공식은 `onRemove` 핸들러만                | 삭제-가능 토글 custom 추상화 — 정당화 가능                                                                                                                                                                                        |
| **Pagination 전체** (variant/size/totalPages/currentPage)                                          | ✅        | RAC/RSP **컴포넌트 미존재**               | 완전 D2 custom — 대조 기준 없음. `currentPage`는 controlled, `defaultPage` 초기값 분리 검토                                                                                                                                       |
| **CardView `columns`/`gap`**                                                                       | ✅        | S2는 size×density 내부 파생               | 명시적 prop 없음 — composition custom                                                                                                                                                                                             |
| **InlineAlert `variant` 값**                                                                       | ✅        | 공식은 `info`                             | 빌더가 `informative` 사용 시 → **`info`로 정정 필요**                                                                                                                                                                             |
| **MeterTrack `isIndeterminate`**                                                                   | ✅        | RAC Meter엔 없음(ProgressBar 전용)        | **live consumer 있음** — `skiaPrimitives.ts` 정적 indeterminate 막대 렌더 + `buildSpecNodeData.ts` parent propagation 소비. dead 아님 → 제거 시 indeterminate 시각 깨짐. "보류"(codex 2026-06-25)                                 |
| **NumberField `hideStepper`**                                                                      | ✗         | 이 repo Adobe 타입·wrapper 에 없음        | 감사 1차 ❌누락 오분류(false positive). `react-stately`/`react-aria` NumberField 타입에 `hideStepper` 부재 + wrapper 가 stepper 항상 렌더. composition 신규 도입이면 D3/custom proposal (codex 2026-06-25)                        |
| **Tab `title`**                                                                                    | ✅        | RAC 공식은 `children`                     | projection 명명 불일치 — `children` 정렬 검토                                                                                                                                                                                     |
| **DatePicker `placeholder`(문자열)**                                                               | ✅        | RAC는 `placeholderValue`(날짜 객체)만     | 비표준 — 정리 검토                                                                                                                                                                                                                |

---

## 4. 공식에 없는 컴포넌트 (RAC 비표준 / RSP-only / 완전 custom)

대조 시 기준 자체가 없거나 한쪽만 있는 컴포넌트 — 판정 시 명시 필요.

| 분류                              | 컴포넌트                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **RAC 비표준, RSP 존재**          | Badge, StatusLight, Avatar, AvatarGroup, Card, CardView, ProgressCircle, InlineAlert, ButtonGroup, IllustratedMessage, Toast(queue API) |
| **RAC 존재, RSP 없음/비공개**     | Toolbar(RAC만), DropZone, FileTrigger(상태 prop은 자식 Button 소속)                                                                     |
| **양쪽 모두 없음 (완전 custom)**  | Pagination, Nav                                                                                                                         |
| **RAC 비표준 leaf (타이포/구조)** | Heading, Text, Paragraph, Body, Label, Description, Code, Kbd, Icon, Skeleton, Section                                                  |

---

## 5. ✅유지 / ➖제외정당 (정합 — 조치 불필요)

- **타이포 leaf** (Text/Paragraph/Body/Label/Description/Code/Kbd/FieldError): children+size로 충분. 검증/필수표시는 부모 field 책임(dispatch 변형), 측정/시각은 theme rule 커버.
- **서브파트 27종** (TableHeader/TableBody/Row/Cell/Column/SliderThumb/SliderOutput/MeterValue/ProgressBarValue/SelectValue/SelectTrigger/SelectIcon/TabList/TagList/GridListItem/ListBoxItem/TreeItem/DisclosureContent/DisclosureHeader/CardContent/CardHeader/CardFooter/CardPreview/DialogFooter/FormField 등): 부모 RAC가 self-compose하거나 projection 전용 → RAC 표준 컬렉션 prop(`id`/`textValue`/`href`)은 부모 items[]·projection 메커니즘이 담당, 개별 노출 불필요.
- **Separator**: RAC상 orientation만 공식이나 variant/size는 RSP `Divider`(`size:S/M/L`)가 뒷받침 → 정합.
- **Input**: value/type/상태가 RAC상 부모 TextField 소속이나 RAC `Input`이 context slot 자동 소비 → 평탄화 노출 정당, 명명도 RAC 컨벤션 일치.
- **Modal `trapFocus`**: RAC가 항상 자동 포커스 트랩 → 토글 무의미 (➖).
- **ColorPicker/ColorWheel value**: controlled 런타임 상태 → defaultValue로 충분 (➖).
- **런타임 핸들러** (onChange/onPress/onSelectionChange 등): 전 컴포넌트 ➖제외정당.

---

## 6. 명명 기록 (판정 무관, 정합성 추적용)

RAC 표준 export가 아닌 composition-specific 별칭:

- **DisclosureContent/DisclosureHeader**: RAC 콘텐츠=`DisclosurePanel`, 헤더=`Heading`+`Button slot="trigger"`
- **SelectTrigger/SelectIcon**: RAC 트리거=`Button`+`SelectValue`, 아이콘=raw Lucide
- **ProgressBarTrack/Value, MeterTrack/Value**: RAC ProgressBar/Meter는 render-prop+CSS class(`track`/`fill`/`value`), named export 아님

---

## 7. 반영 우선순위 (제안 — 사용자 승인 전 미반영)

> 본 표는 우선순위 제안일 뿐, **코드 반영은 사용자 승인 후**. accepts에 prop을 추가하려면 (1) binding.accepts 항목 추가 (2) 적절한 `kind` 지정 (3) toRacProps 전달 확인 (4) Skia/CSS 양 경로 소비 확인이 필요.

### P1 — 폼 기능 결손 (폼으로서 동작 불완전)

- 입력 공통: `value`/`defaultValue`/`defaultSelected`, `name`, `errorMessage`
- TextField/TextArea: `maxLength`/`minLength`/`pattern`
- NumberField: `formatOptions` (⚠️ object 값 — 기존 InspectorFieldKind 에 object editor 없음. accepts-only 범위 초과 시 runtime work 분리, ADR-915 Gate G3)
- Date 4종: `granularity`, `minValue`/`maxValue`, **`errorMessage`** (Date renderer 가 이미 errorMessage 소비 — `DateRenderers.tsx`. 입력 공통 errorMessage 와 동일 패턴이므로 Date 도 P1 포함, codex 2026-06-25)

### P2 — 컴포넌트 정체성 핵심 동작

- ComboBox: `allowsCustomValue`, `menuTrigger`
- 컬렉션: `defaultSelectedKeys`, `disabledKeys`, `disallowEmptySelection`, `selectionBehavior`
- Tree: `defaultExpandedKeys`
- Color: `channel`/`colorSpace`/`xChannel`/`yChannel`
- Heading: `level`
- Popover/Tooltip: `placement`

### P3 — 비대칭 해소 / 시각 옵션

- Select/DatePicker 등: `isRequired`/`isInvalid`/`labelPosition` 비대칭 채우기
- Slider: `showValueLabel`/`isFilled`
- 컬렉션: `selectionStyle`(checkbox/highlight), `density`
- Modal/DropZone/FileTrigger: `isDismissable`/`isDisabled`/`acceptedFileTypes`

### P0 — 정정(추가 아님, 오류 수정)

> **주의 (codex 2026-06-25)**: P0 는 "안전한 단순 제거"가 아니다. 아래 일부 항목은 live consumer 가 있어 **제거 시 회귀**. P0 phase 의 단위는 "제거"가 아니라 "live consumer 확인 → 대체 설계 있으면 정정, 없으면 보류".

- InlineAlert variant `informative` → `info` (안전 — 값 정정, consumer 무관)
- TableView `allowsResizingColumns` → `allowsResizing`(또는 명칭 의도 확정)
- Radio `isSelected` — **live consumer 있음**(`FormRenderers.tsx` `defaultSelected` 소비). 제거 아니라 "초기 선택" 의미 유지 + 명명/문서 정합 검토. 대체 설계 없으면 보류
- MeterTrack `isIndeterminate` — **live consumer 있음**(`skiaPrimitives.ts` 정적 막대 + propagation). 제거 시 indeterminate 시각 깨짐. 보류
- `variant` 문자열(폼 컨트롤) → `isEmphasized` 정렬 (D2 정책 — 개별 사용자 확인, D3 시각 variant 정당 시 보류)

**중복 정정 (§1.6 발견 — 누락이 아니라 중복/불일치)**:

- `Input.variant` kind `enum` → `variant` (§1.6-B). 나머지 46개 binding 과 정합. enum 이면 theme `data-*` 시각 라우팅 이탈 → React prop 통과. 안전(값 아닌 kind 정정, consumer 영향은 data-variant emit 경로 1회 확인)
- `color`/`step` 이중 노출 4건(§1.6-D) — `resolveEditContract` dedup(accepts ∩ universal 시 semantic 우선) 또는 binding 중복 키 제거. **구조 변경이라 live behavior 게이트 필수**(패널에서 동명 필드 2개 → 1개 확인). dead 아님이라 보류 가능, 정정 시 ADR-915 Gate G1 동일 적용
- label 표기 흔들림(`minValue`/`maxValue`/`href`/`type`/`iconName`, §1.6-C) — 기능 영향 없음. P3 이하 선택적, 본 ADR scope 밖 가능

---

## 8. 조사 한계

- **RAC 문서 이전**: `react-spectrum.adobe.com/react-aria/*.html` → `react-aria.adobe.com/*` (301). 일부 페이지(CheckboxGroup 등)가 S2 스타일 API를 노출 → 해당 항목 ⚠️ 병기.
- **S2 docs 서버 렌더 shell**: ToggleButtonGroup 등 일부 S2 전용 컴포넌트 Props 추출 실패 → RAC 기준으로만 판정, ⚠️.
- **Pagination/Nav**: 공식 컴포넌트 미존재 → 대조 기준 없음(완전 D2 custom).

---

## 9. spec 기준 누락 — 공식 대조 사각지대 (2026-06-25, 사용자 지적)

> **§2~§6 의 한계**: §2~§6 은 **RAC/RSP 공식 prop** 만 비교 기준으로 썼다. 그러나 "레퍼런스에는 없지만 spec 에 있던 custom prop"(예: `contextualHelp`, `necessityIndicator`, Card `accentColor`)은 공식 대조로는 **검출 자체가 안 됐다**(§4 "공식에 없는 컴포넌트" 로 분류 제외되며 누락 추적에서 빠짐). **정확한 비교 기준은 cutover 로 삭제된 spec 파일이다.**
>
> **방법**: cutover 로 물리 삭제된 132 spec 을 git 복원(`git show {삭제커밋}^:...`)하여 각 `interface {Name}Props` 키 ↔ 현재 `binding.accepts` 키를 전수 diff(`scratchpad/spec-binding-diff.sh`). 누락 prop 을 5 패밀리 병렬 에이전트가 **삭제 spec 원본 타입 + 현재 live consumer grep** 으로 4분류 판정(추측 0, grep 증거 기반).

### 9-0. 분류 기준

| 분류                  | 의미                                                                                           | 조치                  |
| --------------------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| **[노이즈]**          | RAC 내부 render-state / 서브파트 부모 전파 / children 흡수 / **폐기 컴포넌트** / 렌더러 미소비 | 제외 정당             |
| **[P0-정정]**         | 이미 accepts 에 존재(추출 false positive) / 명명·kind 불일치                                   | 정정 (추가 아님)      |
| **[복원-폼기능]**     | 폼·컬렉션 동작 필수(value/name/errorMessage/selection core)                                    | P1 (이미 다수 포착됨) |
| **[복원-RSP custom]** | 공식 RAC 엔 없으나 RSP 표준/composition custom — **본 사각지대의 핵심**                        | P1.5 (신규 우선순위)  |

### 9-1. 핵심 발견 — "live consumer 있는데 accepts 누락" (편집 UI 결손)

가장 시급. **렌더러는 이미 `element.props.{x}` 를 소비하는데 binding.accepts 에 선언이 없어 패널 편집이 불가능**한 상태. 복원 시 즉시 동작(회귀 위험 낮음 — wiring 이미 존재).

| 컴포넌트                                                                            | 누락 prop (live consumer 위치)                                                                                     | 분류                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| CheckboxGroup/RadioGroup/TextField/TextArea/NumberField/SearchField/Select/TagGroup | `labelAlign`·`necessityIndicator`·`validationBehavior`·`locale` (`FormRenderers.tsx`)                              | 복원-RSP custom / 폼기능  |
| NumberField/Slider                                                                  | `formatOptions` (`FormRenderers.tsx:204`/`Slider.tsx:88`, object — P1-c G3)                                        | 복원-RSP custom           |
| Form                                                                                | `action`·`method`·`encType`·`target`·`autoFocus`·`restoreFocus`·`isDisabled` (`FormRenderers.tsx:96-114`)          | 복원-폼기능               |
| FileTrigger                                                                         | `acceptedFileTypes`·`defaultCamera` (`FormRenderers.tsx:872-877`)                                                  | 복원-폼기능               |
| Dialog                                                                              | `role`(`"dialog"\|"alertdialog"`, `LayoutRenderers.tsx:630`)                                                       | 복원-폼기능               |
| Card                                                                                | `accentColor`(`LayoutRenderers.tsx:254`)·`asset`·`assetSrc`·`preview`(Card.tsx)                                    | P0-정정 / 복원-RSP custom |
| Image                                                                               | `src`·`alt`·`objectFit` (`LayoutRenderers.tsx:1825-1828` + Skia) — **Image 는 catalog 미등록 → binding 자체 없음** | 복원-폼기능               |
| Link                                                                                | `showExternalIcon`(`LayoutRenderers.tsx:1030`)                                                                     | 복원-RSP custom           |
| Tabs                                                                                | `density`·`isQuiet`·`showIndicator`(`LayoutRenderers.tsx:142-171`)                                                 | 복원-RSP custom           |
| ColorField                                                                          | `channel`·`colorSpace`·`necessityIndicator`(`ColorRenderers` renderColorField)                                     | 복원-RSP custom           |
| Date/Time 4종                                                                       | `locale`·`calendar`·`granularity`·`name`·`maxVisibleMonths`·`calendarSystem` (`DateRenderers.tsx`)                 | 복원-RSP custom / 폼기능  |

### 9-2. `contextualHelp` 전멸 (RSP 표준)

`contextualHelp` 는 **12 컴포넌트 spec 에 있었으나 현재 binding 0개** (CheckboxGroup/RadioGroup/NumberField/SearchField/Slider/TextArea/TextField/ColorField/ComboBox/Select/TagGroup/Date 계열). RSP 표준 prop. 현재 live consumer 0(전멸) → 복원 시 accepts + 렌더러 wiring 양쪽 필요. **[복원-RSP custom]** 우선순위.

### 9-3. [노이즈] — 제외 정당 (복원 금지)

- **폐기 컴포넌트** (binding/factory/renderer 0건 → prop 전부 무의미): `List`·`SegmentedControl`·`SegmentedControlItem`·`SelectBoxGroup`·`SelectBoxItem`·`Switcher`·`ActionButtonGroup`·`ActionMenu`·`Autocomplete`·`ContextualHelp`(컴포넌트)·`MaskedFrame`·`ScrollBox`·`FancyButton`(PixiJS 제거)·`Panel`·`DateSegment`(2026-06-09 폐기)
- **children 흡수**: 타이포 leaf(Heading/Text/Paragraph/Code/Kbd/Label/Link/ToggleButton)의 `text`/`label` — canonical `children`(kind:string) 단일 진입점으로 정본화
- **서브파트 부모 전파**: CalendarGrid/CalendarHeader/MeterTrack/ProgressBarTrack `isDisabled`, SliderThumb/SliderTrack 상태, ToggleButton `isFirst`/`isLast`/`isOnly`/`orientation`(`_groupPosition` synthetic 주입)
- **RAC 내부 render-state**: `isOpen`/`isLoading`/`isDropTarget`/`isFilled`/`isDragging`/`isFocused`/`isLiteral`/`segmentType`/`shouldForceMount`

### 9-4. [P0-정정] — 추출 false positive 또는 명명 불일치

- **이미 accepts 에 존재**(추출 들여쓰기 휴리스틱이 놓침): Breadcrumbs 5개 전부, ComboBox/ListBox/Menu/Select/TagGroup 의 `items`/`label`/`description`/`placeholder`/`isDisabled`/`selectionMode` 다수 → **실제 누락 아님**
- **명명 불일치**: Popover `showArrow`(binding 은 반전형 `hideArrow`, skia 는 `props.showArrow` 읽음 — §1.6 와 동류), Calendar `visibleMonths`→`maxVisibleMonths`(렌더러는 후자만 소비), TableView `isQuiet`→`variant:"quiet"` 흡수, Toast `position`(`data-position` live 인데 accepts 누락)
- **deprecated alias**: ListBox `selectedIndex`/`selectedIndices`→`selectedKey(s)` 변환, TreeItem `label`/`title`→children alias

### 9-5. 함정 (grep false positive 주의 — 에이전트 검증 사례)

- ComboBox `selectedText`: grep 8 hit 이지만 전부 **VariantSpec 색상 토큰** 동명이의, prop 미소비 → [노이즈]
- Table `columns`/`rows`: dataBinding 에 흡수 안 됨 — `getTableProjectionRows(props.rows)`/canvasSceneNode 가 **별개 fallback 데이터 소스**로 live 소비 → [복원-폼기능]
- staticColor(Meter/ProgressBar/ProgressCircle): RSP 표준이나 현재 해당 경로 live consumer 0(grep hit 은 전부 Link 전용) → [복원-RSP custom] 분류하되 소비처 없음 명시

### 9-6. ADR-915 scope 반영

- **§9-1 의 "live consumer 있는데 accepts 누락"** = ADR-915 **P1 핵심** (즉시 동작, 회귀 낮음). 기존 P1(value/name/errorMessage)에 `labelAlign`/`necessityIndicator`/`validationBehavior`/`locale`/Form submit 계열/Dialog `role`/FileTrigger/Image/Card 추가.
- **§9-2 `contextualHelp` + RSP custom 계열** = 신규 **P1.5 [복원-RSP custom]** — accepts + 렌더러 wiring 양쪽 필요. P1 보다 후순위(wiring 비용).
- **§9-3 노이즈** = 복원 금지 (audit 에 "제외 정당" 명시).
- **Popover/Tooltip placement 계열**(P2 기보류) + Heading `level`(P2) + Color 채널(P2) = scope 유지.
