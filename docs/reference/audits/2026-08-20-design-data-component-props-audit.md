# Spectrum design-data 컴포넌트 스키마 감사 — 전 컴포넌트 D2 옵션 / D3 guideline 수치 대조

> 작성: 2026-08-20
> 계기: [Adobe OSS 적용성 지도] 권장 우선순위 1 의 잔여 항목 — `spectrum-design-data` component-schemas 를 D2 감사의 외부 대조군으로 활용. 2026-08-20 Button 시범 감사 (staticColor 채택 29db31bef + sizes.minWidth 신설 cdeb6d91e) 를 전 컴포넌트로 확장한 것.
> 대상: composition 컴포넌트 63종 (하위 부품 포함, 8개 패밀리) ↔ design-data 스키마 93종 (프리페치 전수) + RSP 스냅샷 (`.agents/skills/react-spectrum/references/components`) + RAC 스냅샷 (`.agents/skills/react-aria/references/components`)
> 참조: [2026-08-20 인터랙션 registry 감사](./2026-08-20-interaction-registry-rac-rsp-coverage.md) (이벤트/callback 축 — 본 감사에서 제외), ADR-142 (D3 SSOT = catalog), `.claude/rules/ssot-hierarchy.md`

## 0. 감사 축과 제외 범위

| 축         | 내용                                                                                  | 근거 소스                            |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------ |
| A. D2 옵션 | variant/size/state/boolean 옵션·prop ↔ binding `accepts` + rules table variants/sizes | design-data options + RSP/RAC 스냅샷 |
| B. D3 수치 | documentBlocks guideline 의 수치·규칙성 내용 ↔ rules table 현행 값                    | design-data documentBlocks           |
| 제외       | 이벤트 (`on*`) / controlled prop (selectedKeys 등) accepts 부재                       | 2026-08-20 인터랙션 감사가 기록 완료 |

분류 어휘: **채택후보-D2** / **채택후보-D3수치** / **이미정합** / **근거없음** (design-data·RSP·RAC 전부 부재) / **관찰** (비표준·house-style 가능 — 위반 단정 아님, 판정 보류).

**방법 주의 (함정 ④)**: design-data 스키마는 RSP S2 실제 코드보다 뒤처진다 (Button premium/genai 부재 실측). "스키마에 없음" 단독으로 "RSP 에 없음" 판정하지 않고 RSP/RAC .md 교차 후에만 "근거없음" 확정. 상세: 메모리 `reference-design-data-mcp-installed-query-traps`.

## 1. 결론 — 전 패밀리 통합

### 1-1. 표면 단절·죽은 채널 (구현 존재·배선만 결손 — 최소 수리 성격)

| 컴포넌트          | 발견                                                                                                             | 성격                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Tooltip           | rules table 에 D3 variants 4종 (neutral/info/positive/negative) 존재하나 **binding accepts 에 variant 미선언**   | D2 표면 단절               |
| Toast             | **info variant fill 이 neutral 과 완전 동일값** — informative(blue) 시맨틱 죽음 (Tooltip.info 는 blue 계열 보유) | D3 시맨틱 미배선           |
| Toast             | renderToast 가 `data-position` 을 emit 하나 **받는 CSS 규칙이 없다** (아래 정정 ①)                               | 소비 경로 부재 (수리 보류) |
| Select / ComboBox | renderSelect/renderComboBox 가 `defaultSelectedKey`(uncontrolled) 로 소비 (아래 정정 ②)                          | uncontrolled (수리 보류)   |
| DateRangePicker   | 렌더러 resolvePlaceholder 가 placeholder 를 기소비하는데 accepts 선언 없음 — DatePicker 는 노출 중 (형제 비대칭) | D2 표면 단절               |
| DatePicker        | hourCycle 대신 커스텀 `timeFormat` 을 컴포넌트가 직접 받음 (아래 정정 ③)                                         | 비표준 잔존 (수리 보류)    |
| TextArea          | isQuiet 를 D2 로 받으나 rules table 에 quiet 규칙 없음 (quiet 보유 field 목록에서 TextArea 만 누락)              | dead prop 의심             |
| ToggleButton      | isQuiet 수용 + data-quiet emit 까지 있으나 quiet CSS 규칙 0건 + rules/Skia 미소비                                | dead prop                  |
| ToggleButtonGroup | density 수용하나 소비자 0 (컴포넌트 미읽음, CSS 0건, rules 분기 없음)                                            | dead prop                  |
| Tree              | containerStyles maxHeight 300px 잔존 — ListBox 는 2026-07-29 동일 값을 사용자 결정으로 제거                      | 내부 비일관                |
| DateField         | delegation 에 xs 변수가 있으나 rules sizes 는 sm~xl — 패널 옵션 파생상 xs dead 분기                              | dead 분기 (영향 0 — 아래)  |

#### 정정 — 실측으로 갈린 "기소비" 3건 (2026-08-20 Phase A 착수 시)

초판은 아래 3건을 "렌더러 기소비 → accepts 선언만 하면 동작" 으로 분류했으나, 수리 착수 시 소비 지점을 직접 열어보니 **선언만으로는 dead prop 이 된다**. 인프라 존재와 가동 경로는 다르다 (메모리 `feedback-infra-exists-vs-wired-consumption-path`).

1. **Toast `position`** — `renderToast` 는 `<div role="alert" class="react-aria-Toast">` 에 `data-position` 을 emit 하지만, `Toast.css` 의 position 규칙 6종은 전부 `.react-aria-ToastRegion[data-position]` 셀렉터다. ToastRegion 은 imperative 런타임 컨테이너(`ToastProvider`)의 것이고 canonical Toast element 는 그 클래스를 갖지 않는다 → 매칭되는 규칙이 0건. accepts 에 넣으면 편집은 되지만 시각 변화가 없다. 수리는 "canonical Toast 에 position 을 어떤 축으로 줄 것인가" (런타임 region 위임 vs 자체 규칙 신설) 판정이 선행돼야 한다.
2. **Select / ComboBox `selectedKey`·`inputValue`** — `renderSelect` 는 `defaultSelectedKey={currentSelectedKey}` 로 **uncontrolled** 소비한다 (`SelectionRenderers.tsx:1328`). mount 시점만 읽으므로 패널 편집이 반영되지 않는다. 즉 인터랙션 감사가 "원인 A(accepts 부재)" 로 분류한 이 2종은 실제로 **A + B(렌더러 uncontrolled) 동시 해당**이다. 같은 파일의 collection 경로가 쓰는 key 시그니처 remount 우회 (`SelectionRenderers.tsx:354-367`, Checkbox 의 `remount:true` 와 동형) 를 함께 적용해야 동작한다.
3. **DatePicker `placeholderValue` / `hourCycle`** — `resolvePlaceholder`(`DateRenderers.tsx:86`) 는 `placeholderValue` → `placeholder` 순으로 읽지만 **둘 다 string 을 컴포넌트의 `placeholder` 로 넘긴다**. RSP 의 `placeholderValue` 는 DateValue 타입(포맷 결정용)이라 이름만 같고 의미가 다르므로, 이 채널에 RSP 이름을 붙이는 것은 표준 준수가 아니라 혼동이다. `hourCycle` 도 DatePicker/DateRangePicker 컴포넌트가 커스텀 `timeFormat`("12h"/"24h") 을 받도록 배선돼 있어 (`DateRenderers.tsx:259/361`), accepts 추가 전에 컴포넌트 prop 계약 전환이 필요하다. — 다만 **DateRangePicker 는 `placeholder` 자체가 accepts 에 없어 편집 표면이 통째 결손**이었고, 이는 선언만으로 해소되므로 위 표에 별도 행으로 승격했다.

#### 수리 현황 (2026-08-20~21)

| 항목                        | 조치                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tooltip variant             | **수리 완료** — accepts 선언 + 렌더러 fallback 을 defaultVariant 로 정렬                                                                                                                                |
| DateRangePicker placeholder | **수리 완료** — accepts 선언 (DatePicker 와 형제 대칭)                                                                                                                                                  |
| Toast info 시맨틱           | **수리 완료** — `{color.informative-subtle}`/`{color.informative}` 로 정렬                                                                                                                              |
| Toast 런타임 CSS 충돌       | **수리 완료** — 수동 `Toast.css` 를 `.react-aria-ToastRegion` 스코프로 격리 (아래 발견 참조)                                                                                                            |
| Tree maxHeight              | **수리 완료** — ListBox 2026-07-29 결정의 누락 적용분 제거                                                                                                                                              |
| DateField xs                | **변경 없음** — 패널 옵션이 `Object.keys(sizes)` 파생이라 xs 를 선택할 경로 자체가 없다. 런타임 영향 0 인 타입 넓힘이고, size 스케일 자체는 §2-D 에서 house-style 관찰로 분류돼 있어 과잉 변경을 피했다 |
| ToggleButton quiet          | **수리 완료 (2026-08-21)** — `FillTokenSpec.quiet` 채널 신설로 해소. 아래 "quiet/density 채널 판정" 참조                                                                                                |
| TextArea quiet              | **미수리** — 채널은 생겼으나 field 계열 quiet 은 배경(fill 축) + 밑줄(nested 축) 복합이라 TextField 의 nested 규칙과 함께 설계해야 한다                                                                 |
| ToggleButtonGroup density   | **미수리 — 정책 판정 선행** (아래 참조)                                                                                                                                                                 |

#### quiet / density 채널 판정 (2026-08-21)

**quiet 은 fill 축으로 신설했다.** field 계열의 기존 quiet 이 `containerVariants.quiet.true` 에 있어 그 자리를 쓰려 했으나, containerVariants 의 Skia 소비 경로(`implicitStyles.resolveActiveContainerVariants`)는 **layout 채널이라 색상을 보지 않는다**. 거기에 두면 DOM 만 바뀌고 Skia 는 그대로여서 즉시 비대칭이 난다 — 실제로 field quiet 의 nested 규칙들이 "DOM generated CSS 전용" 으로 기록돼 있던 이유다. 배경은 ADR-908 fill preset 이 SSOT 이므로 `FillTokenSpec.quiet` 로 통합했고, Skia(`buildCatalogShapes` isQuiet 분기)와 DOM(`CSSGenerator` `[data-quiet]` emit)이 같은 데이터를 읽는다. 정의된 경우에만 분기하므로 미정의 컴포넌트는 회귀가 없다.

**density 는 채널을 만들기 전에 "무엇을 density 로 볼 것인가" 판정이 필요하다.** 실측 결과:

| 축               | 실측                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| catalog 표현     | **0건** — 어떤 컴포넌트도 density 를 catalog 에 갖고 있지 않다                                                                                                                |
| 유일한 동작 구현 | Tabs — 그런데 Skia 쪽이 `resolveTabPanelPadding` 에 하드코딩돼 있고(`"tabpanels"` 문자열 식별), 규칙이 "density=regular 이면 **size 를 lg 로 승격**" 이라 **폰트까지 커진다** |
| Spectrum 규칙    | "density 는 폰트를 유지하고 수직 padding·간격만 바꾼다" — 현행 Tabs 구현과 **불일치**                                                                                         |
| 나머지 3종       | ToggleButtonGroup(컴포넌트가 prop 자체를 안 받음) / TableView(렌더러 미전달) / CardView·ColorSwatchPicker — 전부 dead                                                         |
| 의미의 분기      | 탭 패널 padding / 세그먼트 간격 / 행 높이 — 컴포넌트마다 density 가 가리키는 대상이 다르다                                                                                    |

즉 quiet 처럼 "시각 정의가 자명한" 상태가 아니다. 선행 판정 2개: (a) Spectrum 규칙(폰트 유지)을 채택할 것인가, 현행 Tabs 방식(size 승격)을 정본으로 둘 것인가, (b) ToggleButtonGroup 의 density 는 segmented 기하 전체(연결/분리 + 코너 radius + Skia `_groupPosition` 산출)에 종속되므로 gap 만 바꾸면 "떨어졌는데 가운데 코너가 각진" 어중간한 시각이 된다 — 기하까지 함께 설계할 것인가. 채널만 먼저 만드는 것은 dormant foundation 이라 피했다.

#### 추가 발견 — Toast 는 두 세계가 클래스를 공유하고 있었다

Toast info 수리 중 cross-check 에서 드러난 구조 결함이다. imperative 런타임 Toast(`components/Toast.tsx` — ToastProvider/ToastRegion/showToast)와 canonical Toast element(`renderToast`)가 **같은 `.react-aria-Toast` 클래스를 쓰는데 variant 어휘가 다르다** (런타임 `info|success|warning|error` ↔ catalog `info|positive|neutral|negative`). 수동 `Toast.css` 는 unlayered, generated 는 `@layer components` 안이라 cascade layer 규칙상 **수동이 항상 이겨** canonical Toast 가 catalog 대신 런타임 값을 받고 있었다 (DOM=accent 12% mix, Skia=catalog → 비대칭). 수동 규칙 전체를 `.react-aria-ToastRegion` 하위로 스코프해 격리했다. 남은 부채: 런타임 CSS 의 원시 토큰(`--color-green-500`)·하드코딩(`#ff9800`)과 variant 어휘 이원화는 어휘 통일 시 함께 정리.

### 1-2. 반복 gap 3대 축 (다수 컴포넌트 공통 — 스윕 후보)

1. **field 공통 prop 결손**: `labelAlign` / `contextualHelp` (+date 계열은 `form`/`showFormatHelpText`) 가 TextField·TextArea·NumberField·SearchField·CheckboxGroup·RadioGroup·Slider·Select·ComboBox·TagGroup·DatePicker·DateRangePicker·DateField·TimeField 에 일괄 부재. contextualHelp 는 ssot-hierarchy D2 원칙의 명시 채택 예시이고, labelAlign 은 ColorField/Form 에 노출 선례가 있다.

#### 수리 현황 — 축① labelAlign 완료 (2026-08-21)

`labelAlign` 은 "prop 미노출" 이 아니라 **채널 전체가 죽어 있던** 상태였다 (착수 전 실측):

| 층 | 착수 전 |
| --- | --- |
| D2 binding | Form/ColorField 만 (NumberField 는 주석에 "개별 field 미소비" 명시) |
| DOM renderer | Form 만 전달 — field 10종은 `labelPosition` 만 상속 전달하고 labelAlign 은 누락 |
| DOM CSS | `--form-label-align` / `--form-label-width` 를 **정의만** 하고 읽는 rule 0건 |
| Skia | `resolveLabelAlignment` 이 `start`/`end` 를 그대로 실었는데 shape align 은 left/center/right 만 인식 → **end 가 조용히 좌측** |
| 폭 | Skia 는 side 에서 Label 176px 강제, DOM 은 자연폭 → **10종 비대칭** |

수리: catalog `label-position.side` 에 `> .react-aria-Label { width: var(--form-label-width, 11rem); flex-shrink: 0; text-align: var(--form-label-align, start) }` nested rule + `label-align` variant 추가(10종), 컴포넌트 `data-label-align` emit, 렌더러 전달(FormRenderers 4종은 Form 상속 포함), Skia 값 매핑 + nearest-wins 해석.

**제외 판정**: CheckboxGroup/RadioGroup 은 라벨 자연폭이 이미 정본(implicitStyles "width 강제 없음")이라 정렬이 시각적으로 성립하지 않는다. ColorField 는 Skia side 처리 자체가 없어 DOM 만 컬럼을 주면 새 비대칭이 된다.

live: 패널 Label Position=Side / Label Align=End 노출 → 캔버스 라벨이 176px 컬럼 우측 정렬, Compare Mode preview computed(width 176px / text-align end / flex-shrink 0) 동일. 인라인 폭이 없는 라벨도 양 경로 176px 로 일치.

**잔여 관찰**: (a) `labelPosition` 의 Form 상속 범위가 렌더러마다 다르다 — FormRenderers 4종만 상속하고 Date/Selection 6종은 자기 prop 만 쓰며, Skia 는 전 패밀리가 자기 prop 이다. 본 축 밖. (b) `contextualHelp` 는 신규 컴포넌트라 미착수(§3-2).

2. **컬렉션 selectionStyle/quiet/density 결손**: selectionStyle (checkbox/highlight) 이 TableView·GridList·Tree·Menu 공통 부재, quiet 이 Table·GridList 부재, TableView density 는 D2 만 있고 D3 수치 채널 없음.
3. **staticColor 잔여 전개**: Button/Link 는 기채택 (CSS/Skia 대칭 스킴 보유) — ToggleButton·ToggleButtonGroup·ProgressBar·ProgressCircle 에 동일 축 미전개. IconButton 은 root binding 수용·propsSchema 미노출 (노출만 결손).

#### 수리 현황 — 축 ③ 완료 (2026-08-21)

**ToggleButton staticColor 채택 완료.** Skia 는 추가 작업이 없었다 — `buildCatalogShapes` 의 static 블록이 컴포넌트를 식별하지 않고 `staticColor` prop + fill 채널 유무로만 분기하도록 작성돼 있어(주석에 "Link/Button/ToggleButton 공유" 명시), D2 표면과 수동 CSS(고정 흑백은 catalog 토큰으로 표현 불가)만 추가하면 대칭이 성립한다. 라이브 검증: `black` → bg #000/text #fff, `white` → 반대, `auto` → variant 경로 유지.

**잔여 3종 전부 수리 완료** — 각각 선례 이식이 아니라 새 설계였다:

| 대상                 | 선례가 안 통하는 이유                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~ToggleButtonGroup~~ | **수리 완료 (2026-08-21)** — RSP S2 ActionButtonGroup 정의대로 **자식 상속 채널**로 구현 (그룹 자체 fill 은 transparent 라 시각 무변화). DOM = `ToggleButtonGroupStaticColorContext` → 자식 `data-static-color`, Skia = `resolveToggleGroupContext` 주입 (orientation/density 와 같은 경로) — 둘 다 **자식 명시값 우선**. propagation rule(override:true)을 쓰지 않은 이유 = 자식이 지정한 staticColor 를 덮어쓰고 문서를 변형하기 때문. 동반 수리 2건: (a) `renderToggleButton` 이 `isQuiet`/`staticColor` 를 떨어뜨려 **DOM 경로에서만 dead** 였던 결손, (b) `buildCatalogShapes` 가 border-width 채널 없는 컨테이너에도 static 테두리를 그려 Skia 에만 검은 사각형이 생기던 결손. live: 패널 Static Color=Black → 캔버스 3버튼 흑백 + 자식 하나만 white 지정 시 그 버튼만 반전, Preview iframe computed(bg #000/#fff, 그룹 border-width 0) |
| ~~ProgressBar / Circle~~ | **수리 완료 (2026-08-21)** — Button 형 이식이 아니라 value-fill 2채널 스킴 신설: track=static 25% wash / fill·indicator=solid / ProgressBar 텍스트=static. DOM(수동 ProgressBar.css var 재정의 + ProgressCircle.tsx 인라인) ↔ Skia(value_fill_bar/arc static + buildCatalogShapes fillBar-채널 wash + propagation staticColor→Track·텍스트 style.color) 동일 상수 0.25. live: 캔버스 black 60% bar/ring + wash + auto 대조군, DOM computed(--fill-color #000 / --track-color rgb(0 0 0/.25)), 패널 Static Color 노출 실측 |
| ~~IconButton~~       | **수리 완료 (2026-08-21)** — staticColor/isDisabled propsSchema 노출. isQuiet 은 정체성 판정 결과 기각 (§2-A IconButton 행 참조)                       |

**축 ①②는 미착수**: `contextualHelp` 는 RSP 대응 컴포넌트 자체가 없어 신규 컴포넌트 작업이고(§3-2), `labelAlign` 은 14종 각각의 렌더러·컴포넌트 배선이며, 컬렉션 selectionStyle/quiet/density 는 D3 채널 정의가 선행이다.

### 1-3. 형제·패밀리 내 비대칭 (기존 채택 이력과의 불일치)

| 비대칭                                       | 내용                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TextArea vs TextField                        | value/errorMessage/necessityIndicator/입력 힌트 5종/contextualHelp 이 TextField 에만 존재                                                                                                                                                                                                                                                                   |
| ~~RangeCalendar vs Calendar~~                | **수리 완료 (2026-08-21)** — isInvalid/autoFocus/pageBehavior 를 binding + 렌더러 양쪽에 보강. 컴포넌트는 `AriaRangeCalendarProps` spread 라 전달만으로 RAC 에 닿았다                                                                                                                                                                                       |
| TimeField vs DateField                       | minValue/maxValue 가 DateField 에만 존재; TimeField granularity 에 근거 없는 "day" 잔존                                                                                                                                                                                                                                                                     |
| ProgressCircle vs ProgressBar                | minValue/maxValue 가 ProgressBar 에만 존재                                                                                                                                                                                                                                                                                                                  |
| ~~Checkbox(+Group) vs Radio/Switch~~         | **수리 완료 (2026-08-21)** — Checkbox/CheckboxGroup catalog xl + 수동 CSS xl + layout/Skia 배선 (아래 후속 2 참조)                                                                                                                                                                                                                                          |
| ~~Tag itemSchema vs Select/ComboBox itemSchema~~ | **양쪽 수리 완료 (2026-08-21)**: 선례였던 Select/ComboBox 팝오버가 먼저 반쪽이었고(마크업 미emit), 그 수리 후 Tag 는 항목별 icon 채널(`leadingIcon.nameProp`)로 채택. Tag 는 chip 이 fit-content 라 **폭 3지점 동기**(catalog rule / layout 상수 / 수동 CSS)가 핵심이었다 |
| isDisabled (Badge/StatusLight/Avatar)        | rules table `states.disabled` (D3) 는 준비됐으나 binding 노출만 결손                                                                                                                                                                                                                                                                                        |

**잔여 비대칭의 성격 (2026-08-21 실측)**: RangeCalendar 처럼 "선언 + 전달" 로 끝나는 것은 소진됐다. TimeField 의 min/maxValue 는 컴포넌트가 `TimeValue` 객체를 받는데 DateField 계열은 ISO 문자열을 렌더러가 파싱하는 구조라 파싱 배선이 필요하고, ProgressCircle 의 min/maxValue 는 DOM(`(value/100)*circumference`, `aria-valuemax={100}`)과 Skia(`value_fill_arc`)가 **0–100 스케일을 하드코딩**하고 있어 양쪽 스케일 계산을 함께 바꿔야 한다.

**수리 완료 (2026-08-21 후속)**: 위 2건 종결. TimeField — placeholderValue 의 "HH:mm" 파싱을 min/max 로 일반화(`parseTimeString` 공용) + renderTimeField 전달 배선 + binding accepts(DateField 동형 string kind) + granularity "day" 옵션 제거(RAC 3종만). ProgressCircle — DOM(ProgressCircle.tsx)·Skia(value_fill_arc) 양쪽을 `(value-min)/(max-min)` 정규화로 통일(aria-valuemin/max 동반), binding accepts ProgressBar 동형. live: 캔버스 min50/max150/value100 → 반원(180°) + 패널 State 섹션 Min/Max 노출 실측. Checkbox xl 등 잔여 행은 §1-3 표 참조.

**수리 완료 (2026-08-21 후속 2 — toggle 계열 xl 완결)**: Checkbox xl 착수 중 **동일 축 결손 3겹**이 드러나 일괄 수리했다. ① Checkbox/CheckboxGroup catalog xl (fontSize text-xl·gap 12 / gap 20 — Radio·RadioGroup 미러) + Checkbox.css xl 블록 + generated CSS emit. ② Radio/Switch 는 catalog xl 이 **기존재했으나** 수동 CSS xl 블록과 layout `PHANTOM_INDICATOR_CONFIGS` xl 키가 없어 xl 선택 시 md 로 렌더되던 결손 — CSS xl 블록 + config xl + `as "sm"|"md"|"lg"` 캐스트 4곳을 `phantomIndicatorSizeKey()` 로 교체. ③ Skia primitive(checkbox/radio/switch_toggle)는 처음부터 `size.indicator.*` 를 읽도록 작성돼 있었으나 catalog 에 대응 필드 부재로 **전 size 가 md 하드코딩 fallback**(box 20 / track 36×20)으로 고정 렌더 — DOM(16/20/24/30)과의 기존 비대칭. `ComponentRuleSize.indicator` 를 specs `IndicatorSpec` 동형으로 확장하고 Checkbox(boxSize 16~~30)/Radio(+dotSize 6~~14)/Switch(track 32~~52 × 18~~30, thumb 14~24) indicator 를 catalog 에 배선 (ruleSizeToSizeSpec cast passthrough 라 primitive 코드 무변경). live: 캔버스 XL>MD indicator 확대 + 패널 Size S/M/L/XL + publish DOM computed(box 30px·font 20·gap 12 / track 52×30) 실측 — 3 leg 동일 값. 회귀: `toggleIndicatorXlCatalog.test.ts` 11케이스 (catalog↔PHANTOM↔Skia 3자 동치 포함).

### 1-4. 채택후보-D3수치 (Button minWidth 채택과 동형의 수치 하한·규칙)

| 컴포넌트    | guideline 수치                                          | 현행                                            |
| ----------- | ------------------------------------------------------- | ----------------------------------------------- |
| TextField   | min-width = 1.5 × height                                | minWidth 채널 없음 (Button 만 2.25×h 채택 상태) |
| SearchField | min-width = 3 × height                                  | minWidth 채널 없음                              |
| ProgressBar | min-width 48px / max-width 768px                        | 채널 없음 (`width:100%` 만)                     |
| ColorSlider | 최소 길이 80px (desktop) / 100px (mobile)               | 채널 없음                                       |
| Tooltip     | maxWidth 160px (스키마 수치 명시)                       | 채널 없음                                       |
| Separator   | size 축 = 두께 단계 (S/M/L)                             | 전 size `height:1` 동일 — size 축 시각 무력     |
| TableView   | density = 폰트 유지·수직 padding 만 변화                | density 별 행높이/padding 채널 없음             |
| Table (행)  | 행 hover 상시 + selected row 배경 (highlight selection) | TableRow fill 에 hover/selected 키 없음         |
| TextArea    | quiet 시각 규칙 (RSP isQuiet 규정)                      | rules quiet 부재 (1-1 dead prop 과 동일 건)     |
| Toast       | informative = blue 시맨틱                               | info fill 이 neutral 동일값 (1-1 과 동일 건)    |

#### 수리 현황 — 수치 스윕 (2026-08-21, commits 88f57aa95 · bc28daf35 + TableRow hover)

- **채택 완료 6건**: TextField minWidth 1.5×h (xs27~~xl81) / SearchField 3×h (sm66~~xl162) / ProgressBar 48~768 (`sizes.maxWidth` 채널 신설 — 타입 + CSSGenerator emit + generate-css 변환) / Tooltip maxWidth 160 (+ 엔진 tooltip 분기 신설: catalog 값이 DOM 에만 도달하고 엔진 채널이 없던 결손 해소, width:fit-content 로 blockify stretch 발산도 정렬) / Separator 두께 축 S1/M2/L4 (catalog height 가 엔진 L3·Skia divider·generated CSS 3소비처 공용 — 수동 CSS 미러 1/1/2 와 catalog 1/1/1 의 선재 비대칭도 함께 해소, 기본 md 1→2px) / Table 행 hover 배경 (catalog `TableRow.fill.default.hover` + 수동 Table.css `[data-hovered]` 미러 — selected 는 기구현이라 hover 만 결손이었음)
- **기수리 판명 2건 (표가 낡음)**: TableView density (79a9c6740 등 08-21 선행 수리) / Toast info 시맨틱 (854dbf2a0)
- **별도 건 1건**: TextArea quiet — §1-1 의 설계 건 (TextField nested 축과 함께)
- **보류 1건**: ColorSlider 최소 길이 80 — Skia registry 에서 제거된 box-only leaf (ADR-912 ⑥ collapse) + 수동 CSS(skipCSSGeneration) 라 catalog sizes → CSS/엔진 표준 채널이 둘 다 없다. 채택하려면 채널 신설 비용 > 실익 (ColorPicker composite 내부 사용이 지배적). 재개 조건 = standalone ColorSlider 의 사용자 배치 경로가 실사용으로 등장할 때.
- **관찰 (선재 결함, 미수정)**: standalone vertical Separator 는 엔진에서 catalog height 가 두께 축 반대(height 축)로 주입되고 width 채널 부재 — orientation 게이트가 L3 size 축 주입에 없다. Toolbar 내부 vertical 은 명시 style 로 무증상.

### 1-5. default 발산·guideline 충돌 (관찰 — 채택 판정 보류)

- **default 반전 2건**: DisclosureGroup 다중 확장 default true (Spectrum false) / Disclosure 확장 default true (Spectrum collapsed) — 빌더 편집 편의 가능성.
- **default variant 발산**: Button primary (dd accent), Badge accent (RSP neutral), InlineAlert info (양쪽 neutral), Toast info (dd neutral), StatusLight neutral (dd informative), ButtonGroup align end (RSP start), ColorSwatchPicker rounding default (외부 none).
- **guideline 명시 충돌 1건**: Table `striped` variant — Spectrum 은 "Zebra striping adds visual noise" 로 명시 반대. 유일한 정면 충돌 항목.
- **house-style 전면 확장 (관찰)**: xs size 단계 (Button/Select/ComboBox/Tag 등), size 축 자체가 외부 미규정인 컴포넌트 (Tabs/Slider/Link/Tooltip/InlineAlert 등), variant 축 자체 도입 (Toolbar/Nav/Popover/Menu 버튼 스킴 등). 전부 의도 이력 가능 — `feedback-audit-high-can-be-intended-house-style`.

## 2. 패밀리별 상세

### 2-A. 버튼/액션 (Button·IconButton·ToggleButton·ToggleButtonGroup·ButtonGroup·Link·Toolbar)

#### Button (↔ button)

| 축  | 항목                                    | 외부 근거                                | composition 현행                                                                  | 분류                 |
| --- | --------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- | -------------------- |
| A   | staticColor                             | dd white/black + RSP S2 auto/black/white | binding auto/white/black (2026-08-20 채택)                                        | 이미정합             |
| B   | min-width = 2.25×height                 | dd guideline                             | rules sizes.minWidth 45/50/68/95/122 (2026-08-20 채택)                            | 이미정합             |
| A   | variant 집합 (premium/genai 포함 6종)   | dd 4종 + RSP S2 확장 2종                 | rules 6종 전부                                                                    | 이미정합             |
| A   | style ↔ fillStyle (fill/outline)        | dd `style`                               | binding `fillStyle` (이름만 상이)                                                 | 이미정합             |
| A   | isPending/isDisabled/type/autoFocus     | dd + RSP                                 | 전부 수용                                                                         | 이미정합             |
| A   | 기본 variant                            | dd default=accent                        | default=primary                                                                   | 관찰(house-style)    |
| A   | size 집합                               | dd s/m/l/xl 4종                          | xs~xl 5종 (xs 확장)                                                               | 관찰(house 확장)     |
| A   | isLabelHidden + icon                    | dd (icon-only 모드)                      | Button leaf 는 icon 미번들 — IconButton reusable 로 구조 분리 (binding 주석 명시) | 관찰(구조 분리 의도) |
| A   | form/formAction/…/name/value            | RSP Button.md                            | 없음 (type submit/reset 만)                                                       | 채택후보-D2 (낮음)   |
| A   | excludeFromTabOrder/preventFocusOnPress | RSP                                      | 없음                                                                              | 채택후보-D2 (미세)   |
| B   | padding = height 절반                   | dd guideline                             | paddingX 4/8/12/16/24 — 절반 (10/11/15/21/27) 미달, xl 만 근접                    | 관찰                 |
| B   | pending 1초 지연 / 텍스트 wrap          | dd guideline                             | rules 채널 없음 (RAC/CSS 거동 영역)                                               | 관찰                 |

#### IconButton (↔ action-button) — 표면 = reusable propsSchema (label/icon/variant/size 4종)

| 축  | 항목                          | 외부 근거                                | composition 현행                                                                                                                                                                                               | 분류                 |
| --- | ----------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| A   | size / icon                   | dd                                       | propsSchema 정합                                                                                                                                                                                               | 이미정합             |
| A   | hideLabel (icon-only)         | dd + RSP ActionButton 관용구             | 없음 — label Text child 상시 렌더                                                                                                                                                                              | 채택후보-D2          |
| A   | isQuiet                       | dd + RSP ActionButton                    | **기각 (2026-08-21 판정)** — composition IconButton 의 정체성은 Button+icon 조합(binding/catalog 주석 명시 구조 분리 의도)이고 S2 Button 엔 isQuiet 없음. ActionButton 계열을 신설하는 구조 재판정 시에만 재개 | 기각(정체성 유지)    |
| A   | staticColor / isDisabled      | dd + RSP                                 | **수리 완료 (2026-08-21)** — propsSchema 에 노출 (root props passthrough 축, repairOrigin 이 구버전 문서에도 기본값 채움). live: 패널 Static Color/Disabled 필드 + staticColor black → 캔버스 흑백 스킴 실측   | 수리 완료            |
| A   | isSelected/isEmphasized       | dd                                       | selected 축은 ToggleButton 으로 분리                                                                                                                                                                           | 관찰(구조 분리 의도) |
| A   | hasHoldIcon/selectedTextColor | dd 에만 — RSP 없음                       | 없음                                                                                                                                                                                                           | 근거없음             |
| A   | variant (Button variant 상속) | Spectrum ActionButton 은 variant 축 없음 | propsSchema variant 존재                                                                                                                                                                                       | 관찰(house-style)    |
| B   | 텍스트 truncation + tooltip   | dd guideline                             | 채널 없음                                                                                                                                                                                                      | 관찰                 |

#### ToggleButton (↔ action-button + RSP ToggleButton.md)

| 축  | 항목                                                      | 외부 근거                         | composition 현행                                                          | 분류                 |
| --- | --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| A   | isSelected/isEmphasized/isDisabled/isQuiet/autoFocus/size | dd + RSP                          | 전부 수용 (rules selected/emphasizedSelected 보유)                        | 이미정합             |
| A   | staticColor | dd + RSP ToggleButton white/black | **수리 완료 (2026-08-21)** — 수동 ToggleButton.css 흑백 스킴 + buildCatalogShapes static 블록 공유. 후속으로 `renderToggleButton` prop 전달 결손까지 수리(DOM 경로 dead 였음) | 수리 완료 |
| A   | defaultSelected                                           | RSP                               | 없음 (builder 는 isSelected 직접 편집)                                    | 채택후보-D2 (경미)   |
| A   | excludeFromTabOrder/preventFocusOnPress                   | RSP                               | 없음                                                                      | 채택후보-D2 (미세)   |
| A   | hasHoldIcon/selectedTextColor                             | dd 에만                           | 없음                                                                      | 근거없음             |
| A   | isQuiet 시각 소비 | dd quiet=배경 없음 | **수리 완료 (2026-08-21)** — catalog `fill.quiet` preset(base transparent / hover·pressed 만 표시) + generated `[data-quiet]` CSS. renderer prop 전달 결손도 동반 수리 | 수리 완료 |

#### ToggleButtonGroup (↔ action-group + RSP S2 ToggleButtonGroup/ActionButtonGroup.md)

| 축  | 항목                                                                                  | 외부 근거                              | composition 현행                      | 분류                 |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------- | -------------------- |
| A   | orientation/selectionMode/isDisabled/size/isEmphasized/isQuiet/disallowEmptySelection | dd + RSP                               | 전부 수용                             | 이미정합             |
| A   | isJustified                                                                           | dd + RSP S2 양쪽                       | 없음                                  | 채택후보-D2          |
| A   | staticColor | RSP S2 ActionButtonGroup (상속) | **수리 완료 (2026-08-21)** — 자식 상속 채널 (context + Skia 주입, 자식 명시값 우선). §1-2 축③ 표 참조 | 수리 완료 |
| A   | overflowMode (wrap/collapse)                                                          | dd 에만 — RSP S2 없음 (v3 유물)        | 없음                                  | 근거없음             |
| A   | 무선택 그룹 (ActionButtonGroup 대응)                                                  | RSP 는 컴포넌트 분리                   | 선택형만 존재                         | 관찰(커버리지)       |
| A   | density 소비                                                                          | dd + RSP                               | 수용하나 소비자 0 — **dead prop**     | 관찰(소비 경로 부재) |
| B   | compact=connected 규칙                                                                | dd: regular=간격 분리, compact 만 연결 | density 무관 상시 connected segmented | 관찰                 |
| B   | indicatorMode (sliding pill)                                                          | 근거 없음                              | composition 전용                      | 관찰(house-style)    |

#### ButtonGroup (↔ button-group)

| 축  | 항목                                 | 외부 근거              | composition 현행                                        | 분류     |
| --- | ------------------------------------ | ---------------------- | ------------------------------------------------------- | -------- |
| A   | orientation/isDisabled/size/align 값 | dd + RSP               | 전부 수용                                               | 이미정합 |
| A   | align 기본값                         | RSP default start      | default end (dialog 우측 정렬 가이드의 house 기본 가능) | 관찰     |
| A   | overflowMode                         | dd 에만                | 없음                                                    | 근거없음 |
| B   | 공간 부족 시 자동 수직 스택          | dd + RSP Key Behaviors | 자동 전환 채널 없음 (수동 orientation)                  | 관찰     |

#### Link (↔ link) / Toolbar (design-data 없음)

| 축  | 항목                                                                  | 외부 근거                                             | composition 현행                                  | 분류               |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | ------------------ |
| A   | Link variant/isQuiet/staticColor/href/target/rel/isDisabled/autoFocus | dd + S2                                               | 전부 수용 (data-quiet/static-color CSS 소비 확인) | 이미정합           |
| A   | Link hrefLang/download/ping/referrerPolicy                            | RSP                                                   | 없음                                              | 채택후보-D2 (낮음) |
| A   | Link size / isExternal / showExternalIcon                             | 외부 근거 없음 (live consumer 존재)                   | binding 전용                                      | 관찰(house-style)  |
| B   | Link quiet=underline 제거                                             | dd guideline                                          | 정합 (+opacity 0.72 는 house 추가)                | 이미정합/관찰      |
| —   | LinkButton (버튼 외형 링크)                                           | RSP S2 LinkButton.md                                  | 대응 없음 (Button 의 v3 href 표면도 미수용)       | 관찰(커버리지)     |
| A   | Toolbar orientation                                                   | RAC                                                   | 수용                                              | 이미정합           |
| A   | Toolbar variant/size                                                  | 외부 근거 없음 (RAC unstyled·RSP 부재) — D3 자유 영역 | 보유                                              | 관찰(house-style)  |

### 2-B. 텍스트 입력 (TextField·TextArea·NumberField·SearchField·Form·FormField·Field 계열)

#### TextField (↔ text-field)

| 축  | 항목                                                                                                         | 외부 근거                                 | composition 현행                                      | 분류                            |
| --- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| A   | label/value/placeholder/size/labelPosition/isRequired/isDisabled/errorMessage/description/necessityIndicator | 양쪽                                      | 완비                                                  | 이미정합                        |
| A   | contextualHelp                                                                                               | RSP S2                                    | 없음                                                  | 채택후보-D2                     |
| A   | prefix                                                                                                       | RSP S2 신설 (input 앞 비인터랙티브 요소)  | 없음                                                  | 채택후보-D2                     |
| A   | defaultValue                                                                                                 | RSP (uncontrolled)                        | value 단일 채널                                       | 관찰(canonical 모델 house 가능) |
| A   | labelAlign (field-level)                                                                                     | RSP start/end                             | Form binding 에만 존재, 개별 field 미소비             | 관찰                            |
| A   | validate/validationBehavior/form/excludeFromTabOrder                                                         | RSP                                       | 없음                                                  | 관찰(편집 표면 과잉 가능)       |
| A   | hasCharacterCount / showValidIcon                                                                            | dd 만 (RSP S2 .md 근거 없음)              | 없음                                                  | 관찰                            |
| A   | hideLabel                                                                                                    | dd 만 (RSP 는 label 생략+aria-label 패턴) | 없음                                                  | 근거없음                        |
| B   | min-width = 1.5×height                                                                                       | dd guideline                              | minWidth 채널 없음 (Button 선례만 존재)               | 채택후보-D3수치                 |
| B   | default width = field-default-width 토큰                                                                     | dd guideline                              | `width:100%` (2026-06-24 field 패밀리 정본 결정 주석) | 관찰(의도된 house)              |
| B   | size 4단계                                                                                                   | dd + RSP                                  | 5단계 xs~xl                                           | 관찰(house 확장)                |

#### TextArea (↔ text-area) — 패밀리 내 비대칭 최다

| 축  | 항목                                                                                                  | 외부 근거                                             | composition 현행                                              | 분류            |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | --------------- |
| A   | value/defaultValue                                                                                    | dd + RSP                                              | **accepts 에 value 자체 없음** (TextField 는 있음)            | 채택후보-D2     |
| A   | errorMessage / necessityIndicator                                                                     | dd + RSP                                              | **없음** (다른 field 3종은 있음)                              | 채택후보-D2     |
| A   | inputMode/autoComplete/autoCorrect/spellCheck/enterKeyHint                                            | RSP (ADR-915 P1.5-b 가 TextField/SearchField 만 채택) | 없음                                                          | 채택후보-D2     |
| A   | contextualHelp                                                                                        | RSP                                                   | 없음                                                          | 채택후보-D2     |
| A   | inputType                                                                                             | dd 만 — RSP TextArea 에 type 없음                     | 없음                                                          | 근거없음        |
| A   | hideDragIcon / height(resizable)                                                                      | dd 만                                                 | `rows` 로 우회                                                | 관찰            |
| A   | label/description/placeholder/size/labelPosition/isQuiet/state 4종/name/maxLength/minLength/autoFocus | 양쪽                                                  | 완비                                                          | 이미정합        |
| B   | quiet 시각 규칙                                                                                       | RSP isQuiet 규정                                      | **rules table quiet 부재** — D2 수용·D3 무반응 dead prop 의심 | 채택후보-D3수치 |

#### NumberField (↔ number-field)

| 축  | 항목                                                                                  | 외부 근거                                  | composition 현행                                    | 분류               |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------- | ------------------ |
| A   | hideStepper                                                                           | dd + RSP                                   | 없음 — stepper 상시 렌더                            | 채택후보-D2        |
| A   | contextualHelp                                                                        | RSP                                        | 없음                                                | 채택후보-D2        |
| A   | formatOptions                                                                         | RSP                                        | 의도적 미노출 (binding 주석: locale-dependent 후속) | 관찰(의도된 defer) |
| A   | defaultValue / value 타입(number) / labelAlign                                        | RSP                                        | value 단일 (kind string)                            | 관찰               |
| A   | locale                                                                                | RSP/RAC prop 표면 없음 (I18nProvider 표준) | accepts 존재 + DOM live                             | 관찰(비표준 가능)  |
| A   | hideLabel                                                                             | dd 만                                      | 없음                                                | 근거없음           |
| A   | 나머지 표면 (min/max/step/isQuiet/isWheelDisabled/necessityIndicator/errorMessage 등) | 양쪽                                       | 완비 (quiet D3 존재)                                | 이미정합           |
| B   | size 4단계                                                                            | dd                                         | 5단계 xs~xl                                         | 관찰(house 확장)   |

#### SearchField (↔ search-field)

| 축  | 항목                        | 외부 근거                                                                             | composition 현행              | 분류                                    |
| --- | --------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------- |
| A   | icon (custom)               | dd (label 부재 시 필수) + RSP icon                                                    | 없음 (하드코딩)               | 채택후보-D2                             |
| A   | type                        | RSP (default search)                                                                  | 없음 (TextField 는 type 있음) | 채택후보-D2                             |
| A   | contextualHelp / labelAlign | RSP                                                                                   | 없음                          | 채택후보-D2 / 관찰                      |
| A   | error 표면                  | dd guideline "Search fields do not have an error state" vs RSP 코드는 validation 지원 | accepts 존재                  | 관찰(디자인 지침 vs 코드 API 충돌 지점) |
| A   | hideLabel                   | dd 만                                                                                 | 없음                          | 근거없음                                |
| A   | 나머지 표면                 | 양쪽                                                                                  | 완비 (quiet D3 존재)          | 이미정합                                |
| B   | min-width = 3×height        | dd guideline                                                                          | minWidth 채널 없음            | 채택후보-D3수치                         |

#### Form / FormField / Field 계열

| 축  | 항목                                                                        | 외부 근거                                                 | composition 현행                                                                  | 분류                |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------- |
| A   | Form isDisabled/isRequired/isReadOnly/isQuiet/isEmphasized (자식 일괄 상속) | RSP 5종                                                   | 전부 없음 — 상속 hint 는 labelPosition/labelAlign/necessityIndicator 만           | 채택후보-D2         |
| A   | Form validationErrors                                                       | RSP + RAC (server-side `Record<string, ValidationError>`) | 없음                                                                              | 채택후보-D2         |
| A   | Form autoComplete/autoCapitalize / method dialog                            | RSP                                                       | 없음 / get·post 만                                                                | 채택후보-D2         |
| A   | Form variant/size/autoFocus/restoreFocus                                    | RSP 근거 없음                                             | accepts 존재                                                                      | 관찰(비표준 가능)   |
| A   | Form validationBehavior default                                             | RSP v3 aria (RAC native)                                  | native                                                                            | 관찰(RAC 기준 선택) |
| —   | FormField ↔ form-item/field                                                 | dd 는 stub 스키마 (options 없음)                          | layout wrapper 역할 정의 일치                                                     | 이미정합            |
| A   | help-text variant (neutral/negative)                                        | dd                                                        | Description/FieldError 분리로 커버                                                | 이미정합            |
| A   | help-text size 4단계 (s/m/l/xl)                                             | dd                                                        | Description/FieldError sm/md/lg 3단계 (xl 부재), Label 은 xs~xl 5단계 자체 비대칭 | 채택후보-D2         |
| A   | help-text hideIcon / isDisabled                                             | dd                                                        | FieldError 아이콘 채널·Description disabled 표면 없음                             | 관찰                |
| A   | field-label labelPosition/necessityIndicator/isRequired                     | dd                                                        | 부모 field 채널로 흡수 (resolveLabelNecessity)                                    | 이미정합(채널 상이) |
| B   | field-label "small=medium 동일 font (padding 만 상이)"                      | dd guideline                                              | Label sm=12/md=14 — 폰트 상이                                                     | 관찰(house 가능)    |

### 2-C. 선택 입력 (Checkbox·CheckboxGroup·RadioGroup·Radio·Switch·Slider·Select·ComboBox·TagGroup·Tag)

#### Checkbox (↔ checkbox) / CheckboxGroup (↔ checkbox-group)

| 축  | 항목                                              | 외부 근거   | composition 현행                                                                          | 분류                  |
| --- | ------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- | --------------------- |
| A+B | size 4단계 (xl 포함)                              | dd + RSP S2 | **sm/md/lg 3단계 — xl 결손** (Radio/Switch/RadioGroup 은 4단계 — toggle 패밀리 내 비대칭) | 채택후보-D2           |
| A   | isEmphasized                                      | dd + RSP S2 | variant "emphasized" enum 으로 의미 대응 (기본 gray→emphasized accent 취지 정합)          | 이미정합(형식만 상이) |
| A   | description/errorMessage (leaf)                   | RSP S2      | 없음 (Group 레벨만)                                                                       | 채택후보-D2           |
| A   | validationBehavior/form (leaf)                    | RSP S2      | 없음 (ComboBox 채택 선례)                                                                 | 채택후보-D2 (낮음)    |
| A   | defaultSelected                                   | RSP S2      | 없음                                                                                      | 관찰                  |
| A   | Group isEmphasized (자식 전파)                    | RSP         | 없음 — group variants 는 text 색 축일 뿐                                                  | 채택후보-D2           |
| A   | Group labelAlign / contextualHelp / showErrorIcon | RSP         | 없음                                                                                      | 채택후보-D2           |
| A   | Group value/defaultValue (string[])               | RSP         | 자식 isSelected 관리 (canonical children 구조)                                            | 관찰(house 구조)      |

#### RadioGroup (↔ radio-group) / Radio (↔ radio-button)

| 축  | 항목                                                              | 외부 근거                                 | composition 현행                                                                                                                   | 분류                                |
| --- | ----------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A   | Group isEmphasized / labelAlign / contextualHelp                  | dd + RSP S2                               | 없음                                                                                                                               | 채택후보-D2                         |
| A   | Group defaultValue                                                | RSP S2                                    | 없음                                                                                                                               | 관찰                                |
| A   | Group size 4종/value/orientation/labelPosition/necessityIndicator | 양쪽                                      | 완비                                                                                                                               | 이미정합                            |
| A   | Radio description                                                 | RSP S2                                    | 없음                                                                                                                               | 채택후보-D2                         |
| B   | 기본 selected 색                                                  | dd guideline "기본 non-emphasized (gray)" | Radio default selected=accent(blue), gray 는 별도 neutral variant — **Checkbox 와 기본값 방향 반대** + default/accent 값 동일 중복 | 관찰(house 가능·패밀리 비대칭 기록) |
| A   | Radio isSelected 직접 노출 / negative variant                     | RSP/RAC 근거 없음                         | 존재                                                                                                                               | 관찰(builder 편의)                  |

#### Switch (↔ switch)

| 축  | 항목                                           | 외부 근거                                                            | composition 현행 | 분류                        |
| --- | ---------------------------------------------- | -------------------------------------------------------------------- | ---------------- | --------------------------- |
| A   | description                                    | RSP S2                                                               | 없음             | 채택후보-D2                 |
| A   | isInvalid/errorMessage/isRequired              | RSP S2 타입 표면 존재 — 단 guideline 은 "switch 는 error state 없음" | 없음             | 관찰(취지 충돌 — 판정 보류) |
| A   | defaultSelected                                | RSP S2                                                               | 없음             | 관찰                        |
| A+B | 나머지 표면 + 기본 gray selected + radius.full | 양쪽                                                                 | 전부 정합        | 이미정합                    |

#### Slider (↔ slider) — D2 gap 최다 컴포넌트

| 축  | 항목                                                      | 외부 근거                       | composition 현행                                            | 분류               |
| --- | --------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- | ------------------ |
| A   | fill (hasFill/isFilled) / fillStart/fillOffset / gradient | dd + RSP                        | 전부 없음 — track fill 시각 prop 부재                       | 채택후보-D2        |
| A   | 값 포맷 (valueFormat/formatOptions) / contextualHelp      | dd + RSP                        | 없음                                                        | 채택후보-D2        |
| A   | RangeSlider / isRange                                     | RSP RangeSlider.md + dd isRange | **대응 없음** (catalog/renderer 참조 0)                     | 관찰(커버리지)     |
| A   | getValueLabel                                             | RSP (함수 prop)                 | 없음                                                        | 관찰(직렬화 불가)  |
| A   | orientation                                               | RSP                             | 2026-07-16 의도적 패널 제거 (labelPosition 대체, 주석 명시) | 관찰(의도된 house) |
| A   | progressionScale/isEditable                               | dd 만                           | 없음                                                        | 근거없음           |
| A   | size                                                      | dd/RSP 모두 slider size 없음    | sm~xl 4종                                                   | 관찰(house scale)  |
| A   | labelPosition/min/max/step/value/showValueLabel           | RSP                             | 존재                                                        | 이미정합           |

#### Select (↔ picker) / ComboBox (↔ combo-box)

| 축  | 항목                                                                                           | 외부 근거                                        | composition 현행                                                 | 분류                            |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------- |
| A   | Select selectedKey                                                                             | dd value + RSP selectedKey                       | **renderSelect 기소비 — accepts 미노출** (패널 편집 표면만 결손) | 채택후보-D2 (기배선)            |
| A   | ComboBox selectedKey/inputValue                                                                | dd + RSP S2                                      | **renderComboBox 기소비 — accepts 미노출**                       | 채택후보-D2 (기배선)            |
| A   | labelAlign / contextualHelp (양쪽)                                                             | RSP                                              | 없음                                                             | 채택후보-D2                     |
| A   | 메뉴 배치 (align/direction/shouldFlip/menuWidth 등)                                            | RSP                                              | 없음                                                             | 채택후보-D2 (낮음·묶음)         |
| A   | Select isLoading / ComboBox loadingState·formValue                                             | RSP                                              | 없음 (dataBinding 존재로 유의미)                                 | 채택후보-D2 (낮음)              |
| A   | Select selectionMode multiple                                                                  | RSP Picker 는 단일 선택 전용                     | single/multiple 노출                                             | 관찰(RSP 미규정 — D2 재검점)    |
| A   | ComboBox isQuiet                                                                               | RSP S2·dd 모두 없음 (v3 유래; picker 만 isQuiet) | 존재                                                             | 관찰(S2 에서 quiet 소멸 가능성) |
| A   | ComboBox prefix                                                                                | RSP S2 ReactNode                                 | iconName (icon 한정) 부분 대응                                   | 관찰                            |
| A   | ComboBox hasAutocomplete / Select menuContainer                                                | dd 만                                            | 없음                                                             | 근거없음                        |
| A   | size xs                                                                                        | Spectrum 4단계                                   | xs~xl 5종                                                        | 관찰(house 확장)                |
| A   | 나머지 표면 (menuTrigger/allowsCustomValue/validationBehavior/disabledKeys→item isDisabled 등) | 양쪽                                             | 정합                                                             | 이미정합                        |

#### TagGroup (↔ tag-group) / Tag (↔ tag)

| 축  | 항목                                                 | 외부 근거                        | composition 현행                                                                           | 분류          |
| --- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ | ------------- |
| A   | actionLabel                                          | dd + RSP                         | 없음                                                                                       | 채택후보-D2   |
| A   | errorMessage/isInvalid / labelAlign / contextualHelp | RSP                              | description 만 존재                                                                        | 채택후보-D2   |
| A   | Tag avatar/icon 슬롯 | dd hasAvatar + RSP Item children | **수리 완료 (2026-08-21)** — itemSchema `icon` 채택. Skia 는 `leadingIcon.nameProp` 채널 신설(rule 정적 이름 + 행 데이터 합성, `showProp` 동형 게이팅) + `leading_icon` append primitive, DOM 은 chip `.tag-leading-icon`(14px+4px). 폭은 catalog/layout 상수/CSS 3곳 동일값 + 계약 테스트. **avatar 슬롯도 완결 (2026-08-21)** — itemSchema `avatar`(이미지 URL) + catalog `leadingAvatar.srcProp` + `leading_avatar` primitive(원 배경 + 원형 클립 이미지) / DOM `.tag-leading-avatar`(16px). icon 과 같은 좌측 슬롯이라 `resolveLeadingSlot` 단일 판정으로 avatar 우선. 동반 수리: 행 데이터의 이미지 URL 이 icon slot 으로 새던 결함(`getItemIcon`/`getItemAvatar` 분리) | 수리 완료 |
| A   | renderEmptyState / escapeKeyBehavior 등              | RSP                              | 없음                                                                                       | 관찰          |
| A   | Tag isError/isReadOnly                               | dd 만                            | 없음                                                                                       | 관찰          |
| A+B | TagGroup size 3종 / Tag 표면 (allowsRemoving 등)     | dd + RAC                         | 정합 (Tag 만 xs~xl 5종 — 그룹 3 vs 칩 5 비대칭 관찰)                                       | 이미정합/관찰 |

### 2-D. 날짜/시간 (Calendar·RangeCalendar·DatePicker·DateRangePicker·DateField·TimeField)

**소스 공백 주의**: design-data 의 single/double/triple-calendar·date-field·time-field JSON 은 메타만 있고 options/documentBlocks 이 빈 스키마 — 실질 근거는 calendar.json + date-picker.json 2개 (+RSP .md).

| 축  | 컴포넌트        | 항목                                                                              | 외부 근거                                | composition 현행                                                                                          | 분류                      |
| --- | --------------- | --------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------- |
| A   | Calendar        | firstDayOfWeek / selectionAlignment                                               | RSP S2                                   | 없음                                                                                                      | 채택후보-D2               |
| A   | Calendar        | visibleMonths 상한 3                                                              | dd guideline + RSP "(max 3)"             | maxVisibleMonths min:1 만 (max 미제약)                                                                    | 채택후보-D2 (max:3)       |
| A   | Calendar        | isDateUnavailable                                                                 | RSP (함수형)                             | 없음                                                                                                      | 관찰(직렬화 축 별도 판정) |
| A   | Calendar        | variant/size                                                                      | 외부 근거 없음                           | 존재                                                                                                      | 관찰(house-style)         |
| A   | Calendar        | showTimeZone                                                                      | dd 만                                    | 없음                                                                                                      | 근거없음                  |
| B   | Calendar        | unavailable(취소선) vs disabled(회색) 이원 상태 / range 점선 외곽 token           | dd guideline + tokenBindings             | rules 는 disabled opacity 만 — day-cell 상태 값 없음 (skiaPrimitive 내부 미검증)                          | 관찰                      |
| A   | RangeCalendar   | isInvalid/autoFocus/pageBehavior                                                  | RSP                                      | 없음 — **Calendar 는 3종 다 노출 (형제 비대칭)**                                                          | 채택후보-D2               |
| A   | RangeCalendar   | firstDayOfWeek/selectionAlignment/max:3                                           | RSP                                      | 없음                                                                                                      | 채택후보-D2               |
| A   | DatePicker      | hourCycle                                                                         | RSP + dd is24Hour                        | 없음 — 렌더러는 커스텀 `timeFormat` 직접 read (accepts 미등재·RSP 미규정 이름). 형제 3종은 hourCycle 노출 | 채택후보-D2 + 관찰        |
| A   | DatePicker      | placeholderValue                                                                  | RSP                                      | 렌더러 resolvePlaceholder 기소비 — 배선만 없음 (커스텀 `placeholder` string 은 관찰)                      | 채택후보-D2 (기배선)      |
| A   | DatePicker      | shouldFlip/firstDayOfWeek/labelAlign/contextualHelp/showFormatHelpText/form/max:3 | RSP                                      | 없음                                                                                                      | 채택후보-D2               |
| A   | DatePicker      | isQuiet 주석 stale                                                                | —                                        | 주석은 "노출 보류"·accepts 엔 실존 — Skia quiet 대칭 미검증                                               | 관찰(D3 대칭 리스크)      |
| A   | DatePicker      | showCalendarIcon/iconName                                                         | 외부 근거 없음                           | 존재                                                                                                      | 관찰(house-style)         |
| A   | DatePicker      | dateField.hideLabel / timeFields.showStartTime·showEndTime                        | dd 만                                    | granularity 로 대응                                                                                       | 근거없음                  |
| A   | DateRangePicker | placeholderValue                                                                  | RSP                                      | placeholder/placeholderValue **둘 다 부재** — 렌더러 기소비·DatePicker 와도 비대칭                        | 채택후보-D2               |
| A   | DateRangePicker | shouldFlip/firstDayOfWeek/labelAlign/contextualHelp/showFormatHelpText/form/max:3 | RSP                                      | 없음                                                                                                      | 채택후보-D2               |
| A   | DateField       | form/labelAlign/contextualHelp/showFormatHelpText                                 | RSP                                      | 없음                                                                                                      | 채택후보-D2               |
| B   | DateField       | size 스케일                                                                       | —                                        | rules sm~~xl 인데 delegation 에 xs 변수 — xs dead 분기, DatePicker(xs~~xl)와 비대칭                       | 관찰                      |
| A   | TimeField       | minValue/maxValue                                                                 | RSP                                      | 없음 — **DateField 는 노출 (비대칭)**                                                                     | 채택후보-D2               |
| A   | TimeField       | granularity "day"                                                                 | RSP/dd 근거 없음 (hour/minute/second 만) | enum 에 day 포함 (DateField 복제 형태)                                                                    | 관찰(비표준 가능)         |
| A   | TimeField       | form/labelAlign/contextualHelp                                                    | RSP                                      | 없음                                                                                                      | 채택후보-D2               |
| A   | TimeField       | hourCycle 기본값                                                                  | RSP 는 locale 파생                       | default "24" 강제                                                                                         | 관찰(house)               |
| B   | 패밀리 공통     | labelPosition side / 필수 표시 icon                                               | dd                                       | containerVariants side + necessityIndicator 정합                                                          | 이미정합                  |

### 2-E. 컬렉션/오버레이 (Table·TableView·ListBox·GridList·Tree·Menu·Dialog·Modal·Popover·Tooltip·Toast)

| 축  | 컴포넌트        | 항목                                                                         | 외부 근거                                                    | composition 현행                                                                                  | 분류                                    |
| --- | --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| A   | Table           | density / quiet / isSortable / hideHeader                                    | dd + RSP (TableView 는 density·quiet·allowsSorting 보유)     | Table.binding 에 없음 — TableView 와 표면 비대칭                                                  | 채택후보-D2                             |
| A   | Table/TableView | overflowMode truncate·wrap / selectionStyle checkbox·highlight               | RSP TableView                                                | 없음                                                                                              | 채택후보-D2                             |
| A   | Table           | per-column 옵션 (align/showDivider/컬럼별 isSortable/resizing/width/summary) | dd columns.\* + RSP Column                                   | generic columnMapping 만 — 컬럼 단위 표면 없음                                                    | 채택후보-D2                             |
| B   | TableView       | density 별 수직 padding 변화 (폰트 유지)                                     | dd guideline                                                 | accepts 만 있고 rules 에 density 수치 채널 없음                                                   | 채택후보-D3수치                         |
| B   | Table           | 행 hover 상시 / selected row 배경                                            | dd guideline + tokenBindings                                 | TableRow fill 에 hover/selected 키 없음                                                           | 채택후보-D3수치                         |
| A   | Table           | striped variant                                                              | dd guideline **명시 반대** ("zebra striping = visual noise") | 존재                                                                                              | 관찰(guideline 충돌)                    |
| A   | Table           | bordered variant                                                             | 근거 없음                                                    | 존재                                                                                              | 관찰(house)                             |
| B   | Table           | 숫자 컬럼 우측 정렬                                                          | dd guideline (center 금지)                                   | Cell/Column textAlign left 고정                                                                   | 관찰(per-column align 부재와 동일 뿌리) |
| A   | ListBox         | layout stack/grid / orientation                                              | RAC (GridList 는 layout 노출 — ListBox 만 누락)              | 없음                                                                                              | 채택후보-D2                             |
| A   | ListBox         | shouldFocusWrap 등 포커스 boolean                                            | RAC                                                          | 없음                                                                                              | 채택후보-D2 (부차)                      |
| A   | GridList        | isQuiet / overflowMode / selectionStyle                                      | dd + RSP ListView                                            | 없음                                                                                              | 채택후보-D2                             |
| A   | GridList        | item hasChildItems / href                                                    | RSP + RAC (ListBox itemSchema 는 href 보유)                  | 없음                                                                                              | 채택후보-D2                             |
| A   | GridList        | layout 기본값 grid                                                           | RAC default stack                                            | default grid (2026-07-29 사용자 결정 기록)                                                        | 관찰(의도된 house)                      |
| B   | GridList        | non-quiet 컨테이너 시각 (배경·테두리)                                        | dd guideline                                                 | default 가 transparent 단일 — 사실상 quiet 형태만 존재                                            | 관찰                                    |
| A   | Tree            | selectionStyle / selectionBehavior                                           | dd + RSP                                                     | 없음                                                                                              | 채택후보-D2                             |
| A   | Tree            | isDetached/isEmphasized/showDragIcon                                         | dd 만 (RSP 스냅샷 없음)                                      | 없음                                                                                              | 채택후보-D2 (dd 단독 근거)              |
| B   | Tree            | maxHeight 300px 고정                                                         | 근거 없음                                                    | ListBox 는 2026-07-29 제거·Tree 만 잔존                                                           | 관찰(내부 비일관)                       |
| B   | Tree            | TreeItem md=lg 행 메트릭 동일                                                | dd size 4단 위계                                             | 컨테이너 size 축과 행 메트릭 비연동                                                               | 관찰                                    |
| A   | Menu            | disallowEmptySelection                                                       | RSP (형제 컬렉션은 보유 — Menu 만 누락)                      | 없음                                                                                              | 채택후보-D2                             |
| A   | Menu            | selectionStyle checkbox·switch / item isUnavailable                          | dd 만                                                        | 없음                                                                                              | 채택후보-D2 (dd 단독 근거)              |
| A   | Menu            | submenu/isCollapsible/tray container                                         | dd                                                           | submenu 인프라 없음 (flat items+sections)                                                         | 관찰(커버리지)                          |
| A   | Menu            | variants 6종 (Button 스킴 복제)                                              | Spectrum Menu 에 variant 축 없음                             | ADR-151 B7 사용자 결정                                                                            | 관찰(house 의도)                        |
| A   | Dialog          | alert variant (confirmation/…/error)                                         | dd alert-dialog + RSP AlertDialog                            | role 구분만 — 시맨틱 variant 축 없음                                                              | 채택후보-D2                             |
| A+B | Dialog          | size ↔ width 매핑                                                            | dd 3 widths + RSP size S/M/L                                 | sizes 5단이 **padding 스케일** — width 채널 없음                                                  | 관찰 + 채택후보-D3수치                  |
| A   | Dialog          | hero image / takeover                                                        | dd + RSP                                                     | 전용 슬롯·대응 없음                                                                               | 관찰(커버리지)                          |
| A   | Modal           | isDismissable / isKeyboardDismissDisabled                                    | RAC                                                          | 없음 (Dialog 쪽만)                                                                                | 채택후보-D2                             |
| A   | Modal           | trapFocus/autoFocus/size                                                     | RAC 미규정                                                   | 존재                                                                                              | 관찰(house 가능)                        |
| A   | Popover         | placement 어휘 22값                                                          | dd + RAC 전체                                                | enum 8값                                                                                          | 채택후보-D2 (옵션 확대)                 |
| A   | Popover         | hideArrow/offset/crossOffset/containerPadding/shouldFlip                     | dd + RSP/RAC                                                 | 정합                                                                                              | 이미정합                                |
| A   | Popover         | variants 3종                                                                 | 근거 없음                                                    | 존재                                                                                              | 관찰(house 가능)                        |
| A   | Tooltip         | **variant 미노출**                                                           | dd + RSP variant                                             | rules 에 D3 4종 존재·binding accepts 미선언 — 표면 단절                                           | 채택후보-D2                             |
| A   | Tooltip         | showIcon                                                                     | dd hasIcon + RSP (색약 접근성 근거)                          | 없음                                                                                              | 채택후보-D2                             |
| B   | Tooltip         | **maxWidth 160px** (스키마 수치)                                             | dd                                                           | maxWidth 채널 없음                                                                                | 채택후보-D3수치                         |
| A   | Toast           | actionLabel                                                                  | dd + RSP                                                     | 없음                                                                                              | 채택후보-D2                             |
| A   | Toast           | placement                                                                    | RSP + dd                                                     | renderToast 가 data-position 소비 — accepts 미선언 (Modal.isOpen 동형 함정)                       | 채택후보-D2                             |
| B   | Toast           | **info variant 색**                                                          | dd "informative = blue"                                      | info fill = neutral-subtle + border 동일값 — **neutral 과 완전 동일** (Tooltip.info 는 blue 보유) | 채택후보-D3수치                         |
| B   | Toast           | variant 아이콘 + close button                                                | dd (색약 접근성)                                             | box-shell — 렌더 없음 (binding 주석 자체 인지)                                                    | 관찰(커버리지)                          |

### 2-F. 상태/피드백 (Badge·StatusLight·InlineAlert·ProgressBar·ProgressCircle·Meter·Avatar·AvatarGroup)

| 축  | 컴포넌트           | 항목                                                          | 외부 근거                      | composition 현행                                                                                         | 분류                  |
| --- | ------------------ | ------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- | --------------------- |
| A   | Badge              | variant 25종 / style↔fillStyle                                | dd                             | 25종 완전 일치 (info↔informative 명칭 대응)                                                              | 이미정합              |
| A   | Badge              | icon 채널                                                     | dd + RSP 합성                  | children string 만                                                                                       | 채택후보-D2           |
| A   | Badge              | fixed (edge 고정)                                             | dd (S2 스키마 근거)            | 없음                                                                                                     | 채택후보-D2           |
| A   | Badge              | isDisabled                                                    | dd                             | **수리 완료 (2026-08-21)** — accepts 노출 + Badge.tsx data-disabled emit (generated CSS 0.38)            | 수리 완료             |
| A   | Badge              | isDot/isPulsing / xs 단계 / default accent                    | 외부 근거 없음                 | composition 전용                                                                                         | 관찰(house 가능)      |
| A   | StatusLight        | variant 4종 결손 (gray/red/orange/green)                      | dd 23종                        | 19종                                                                                                     | 채택후보-D2           |
| A   | StatusLight        | isDisabled                                                    | RSP                            | **수리 완료 (2026-08-21)** — accepts 노출 + 인라인 dim (generated class 미부여 outlier, Avatar 동형)     | 수리 완료             |
| A   | InlineAlert        | variant accent / style bold·subtle·outline / actionLabel·href | dd                             | 없음                                                                                                     | 채택후보-D2           |
| B   | InlineAlert        | 기본 스타일 = outline                                         | dd guideline                   | subtle 배경 + variant border 혼합형 단일 스킴                                                            | 관찰                  |
| A   | ProgressBar        | staticColor / over background variant                         | dd + RSP                       | **수리 완료 (2026-08-21)** — track 25% wash + fill·텍스트 solid 스킴 (§1-2 축③ 표 참조)                 | 수리 완료             |
| B   | ProgressBar        | **min-width 48 / max-width 768**                              | dd guideline                   | 채널 없음 (`width:100%`)                                                                                 | 채택후보-D3수치       |
| A   | ProgressBar        | accent/neutral variant                                        | 외부 근거 없음                 | composition 전용                                                                                         | 관찰(house 가능)      |
| A   | ProgressCircle     | minValue/maxValue                                             | dd + RSP                       | 없음 — **ProgressBar 는 보유 (형제 비대칭)**                                                             | 채택후보-D2           |
| A   | ProgressCircle     | staticColor/over background                                   | dd + RSP                       | **수리 완료 (2026-08-21)** — ProgressBar 동일 스킴 (propPassthrough outlier)                             | 수리 완료             |
| A   | Meter              | helpText                                                      | dd S2                          | 없음                                                                                                     | 채택후보-D2           |
| A   | Meter              | variant 명명                                                  | dd S2 notice/negative          | warning/critical (RSP v3 명명 — 색 토큰은 S2 색에 기매핑)                                                | 관찰(S2 개명 미반영)  |
| A   | Avatar             | isDisabled / showStroke                                       | dd + RSP                       | isDisabled **수리 완료 (2026-08-21)** — accepts 노출 (컴포넌트 dim 기보유). showStroke 는 채널 없음 유지 | 부분 수리             |
| A   | Avatar/AvatarGroup | size 체계 (numeric/px)                                        | dd 지수 스케일 + RSP custom px | xs~xl 5단계 고정                                                                                         | 관찰(house 크기 체계) |
| B   | AvatarGroup        | 그룹 내 stroke + 겹침(stacking) 규칙                          | dd guideline                   | stroke 채널·겹침 시각 없음 (flex-row 나열)                                                               | 관찰                  |
| A   | 패밀리 공통        | labelPosition/valueLabel/size 단계/default                    | dd + RSP                       | 대체로 정합 (default variant 3건 발산은 §1-5)                                                            | 이미정합              |

### 2-G. 컨테이너/내비 (Card·CardView·Tabs·Breadcrumbs·Disclosure·DisclosureGroup·DropZone·IllustratedMessage·Separator·Nav)

| 축  | 컴포넌트              | 항목                                        | 외부 근거                                 | composition 현행                               | 분류                                |
| --- | --------------------- | ------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| A   | Card                  | variant 4종/size 5단/root clip              | RSP S2                                    | 정합 (density 제외)                            | 이미정합                            |
| A   | Card                  | density compact/regular/spacious            | RSP S2                                    | 없음 — padding 이 size 축에 결합               | 채택후보-D2                         |
| A   | Card                  | textValue                                   | RSP S2                                    | 없음                                           | 채택후보-D2 (저순위)                |
| A   | Card                  | orientation/isSelectable/accentColor        | 근거 없음 (card-horizontal 흡수 수단 등)  | 존재                                           | 관찰(house 가능)                    |
| A   | CardView              | size 5단계                                  | RSP                                       | 3단계                                          | 채택후보-D2                         |
| A   | CardView              | variant (자식 Card 일괄 지정)               | RSP                                       | 전달 채널 없음                                 | 채택후보-D2 (propagation 경로 필요) |
| A   | CardView              | columns/gap                                 | RSP 근거 없음 (자동 배치)                 | 존재                                           | 관찰(house 가능)                    |
| A   | Tabs                  | isQuiet / isEmphasized / keyboardActivation | dd + RSP                                  | 없음                                           | 채택후보-D2                         |
| A   | Tabs                  | disabledKeys/selectedKey                    | RSP                                       | isDisabled(전체) 만                            | 채택후보-D2 (저순위)                |
| A   | Tabs                  | size/showIndicator/variant                  | 외부 근거 없음 (Spectrum 은 density 소관) | 존재                                           | 관찰(house 가능)                    |
| B   | Tabs                  | overflow 시 quiet picker·스크롤             | dd guideline                              | overflow 채널 없음                             | 관찰                                |
| A   | Breadcrumbs           | autoFocusCurrent                            | RSP                                       | 없음                                           | 채택후보-D2                         |
| B   | Breadcrumbs           | 최대 4개 표시 + truncation menu             | dd + RSP                                  | collapse 동작 없음 (전체 나열)                 | 관찰                                |
| A   | Disclosure 계열       | isQuiet                                     | dd + RSP 양쪽                             | 없음                                           | 채택후보-D2                         |
| A   | DisclosureGroup       | 다중 확장 default                           | dd false + RSP "기본 1개"                 | **default true (반전)**                        | 채택후보-D2 (default 정렬)          |
| A   | Disclosure            | isExpanded default                          | RSP collapsed                             | **default true (반전)**                        | 관찰(빌더 편의 가능)                |
| A   | DisclosureGroup       | density                                     | dd 만 (RSP 미규정)                        | 없음                                           | 채택후보-D2 (dd 단독 근거)          |
| A   | DropZone              | isFilled / replaceMessage                   | RSP                                       | 없음                                           | 채택후보-D2                         |
| B   | DropZone              | drag-over 피드백                            | dd guideline                              | data-drop-target 배선 정합                     | 이미정합                            |
| A   | IllustratedMessage    | orientation                                 | dd (RSP 미규정)                           | 세로 고정                                      | 채택후보-D2                         |
| A+B | Separator             | size 축 = 두께 (RSP "Controls thickness")   | dd + RSP                                  | 전 size height:1 동일 — **축 시각 무력**       | 채택후보-D3수치                     |
| A   | Separator             | variant 7종                                 | 근거 없음                                 | 존재                                           | 관찰(house 가능)                    |
| A   | Nav ↔ side-navigation | 컬렉션 모델 (selectionMode/item 옵션)       | dd                                        | 구조 상이 (generic nav 컨테이너) — 대응 명목상 | 관찰                                |

### 2-H. 컬러 (ColorArea·ColorSlider·ColorWheel·ColorField·ColorSwatch·ColorSwatchPicker·ColorPicker)

**공통 전제**: ColorArea/Slider/Wheel/Swatch 는 binding 주석에 **box-only cutover** (2026-06-11 사용자 방침 — 빌더 완성 후 진짜 구현) 명시 — 값·채널 계열 미노출은 의도적 보류 (†). 실구현 재개 시점의 일괄 채택 목록으로 읽을 것.

| 축  | 컴포넌트          | 항목                                            | 외부 근거                                        | composition 현행                                       | 분류                           |
| --- | ----------------- | ----------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ | ------------------------------ |
| A   | ColorArea         | xChannel/yChannel/colorSpace/value/defaultValue | RSP+RAC (+dd)                                    | 미노출                                                 | 채택후보-D2 †                  |
| A   | ColorSlider       | channel/colorSpace/value/defaultValue           | 3소스                                            | 미노출                                                 | 채택후보-D2 †                  |
| A   | ColorSlider       | showValueLabel / contextualHelp                 | RSP                                              | 미노출                                                 | 채택후보-D2                    |
| B   | ColorSlider       | **최소 길이 80px (desktop)**                    | dd guideline                                     | 채널 없음                                              | 채택후보-D3수치                |
| B   | ColorSlider       | 트랙 두께 고정                                  | dd guideline                                     | 크기별 가변 (16/20/24)                                 | 관찰(house 가능)               |
| A   | ColorWheel        | value/defaultValue                              | 3소스                                            | 미노출                                                 | 채택후보-D2 †                  |
| B   | ColorArea/Wheel   | 기본 크기 192px                                 | dd default                                       | md=180 (−12px 패턴)                                    | 관찰                           |
| A   | ColorField        | value/defaultValue / contextualHelp             | RSP+RAC                                          | 미노출 (그 외 표면은 Color 계열 중 최상 정합)          | 채택후보-D2                    |
| A   | ColorSwatch       | rounding / colorName / xs size                  | dd + RSP                                         | 미노출 (D3 radius.full 고정은 ADR-914 Tier1 의도 기록) | 채택후보-D2                    |
| A   | ColorSwatchPicker | size 4단 (xs 포함)                              | dd + RSP                                         | 3단                                                    | 채택후보-D2 (ColorSwatch 연동) |
| A   | ColorSwatchPicker | colorSpace / isDisabled                         | 3소스 모두 부재 (교차 완료)                      | accepts 존재                                           | 근거없음                       |
| A   | ColorSwatchPicker | rounding 기본값                                 | 외부 none                                        | default "default"                                      | 관찰(기본값 발산)              |
| A   | ColorPicker       | size/variant/isDisabled                         | RAC 무·dd options 무 (RSP S2 스냅샷 부재 — 잠정) | 존재                                                   | 근거없음(잠정)                 |
| B   | Color 공통        | 핸들 focus 2배/loupe/checkerboard 부품          | dd 부품 스키마 3종                               | 전 계열 무대응 (box-only 손실 범위)                    | 관찰(커버리지)                 |

## 3. 커버리지 축 — 컴포넌트·노출 결손

### 3-1. binding 존재 + palette 미노출 (노출 결손 후보)

TextArea (인터랙션 감사 기지) · Toast · Meter · Pagination · Color 계열 7종 (ColorArea/ColorField/ColorPicker/ColorSlider/ColorSwatch/ColorSwatchPicker/ColorWheel — box-only 보류와 연동 판단).

### 3-2. 대응 컴포넌트 자체 부재 (외부 근거 있는 것만)

| 외부 컴포넌트                                                                                                                                      | 근거                               | 비고                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| ActionBar                                                                                                                                          | dd + RSP                           | 선택 행 일괄 작업 — 인터랙션 감사 §4 와 동일 지적 (CRUD 삭제 UI 패턴) |
| ContextualHelp                                                                                                                                     | dd + RSP                           | prop 채택후보 (§1-2) 와 별개로 단독 컴포넌트로도 존재                 |
| SegmentedControl                                                                                                                                   | dd + RSP                           |                                                                       |
| Rating / Steplist / CoachMark / AlertBanner / FloatingActionButton / SelectBox / TagField / SegmentedTextField / Tray / TakeoverDialog / Thumbnail | dd                                 | RSP 스냅샷 근거는 SegmentedControl·SelectBoxGroup 만                  |
| LinkButton / ActionMenu / RangeSlider / LabeledValue                                                                                               | RSP                                | LinkButton·RangeSlider 는 §2 에서도 지적                              |
| Autocomplete                                                                                                                                       | RAC 신규 (적용성 지도 Tier A 항목) | binding 0건                                                           |

## 4. Adobe OSS 적용성 지도 — 로드맵 잔여 상태 (2026-08-20 기준)

| 우선순위 | 항목                                              | 상태                                                                                                                                     |
| -------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | design-data skill/MCP 설치                        | **완료** (2026-08-20, user scope — 도구 품질·함정 4종은 메모리 기록)                                                                     |
| P1 잔여  | component-schemas 를 D2 감사 외부 대조군으로 활용 | **본 감사로 완료** — Button 시범 (staticColor·minWidth 채택) → 63종 확장                                                                 |
| P2       | RAC 미활용 컴포넌트 소비                          | 부분 낡음 — Color 계열·Toast·Tree 는 binding 기존재 (지도 서술 갱신 필요). 실제 잔여 = §3 (palette 노출 + Autocomplete 등 부재 컴포넌트) |
| P3       | leonardo 도입 검토                                | 미착수 (사용자 테마 생성 기능 착수 시)                                                                                                   |
| P4       | svg-native-viewer 스펙 기준선                     | 미착수 (SVG/아이콘 Skia 렌더 도입 시)                                                                                                    |

## 5. 재현 방법

1. design-data 스키마 프리페치: `@adobe/design-data-mcp` stdio JSON-RPC (`initialize` → `tools/call design-data-component`) 로 93종 전수 덤프 (스크립트: 세션 job tmp `fetch-design-data.mjs`).
2. composition 표면: `packages/shared/src/catalog/bindings/*.binding.ts` 의 `props.accepts` (D2) + `packages/shared/src/catalog/generated/componentRulesTable.ts` 해당 항목 (D3) + reusable 은 propsSchema (IconButton 등).
3. 외부 교차: `.agents/skills/react-spectrum/references/components/*.md` / `.agents/skills/react-aria/references/components/*.md` 의 API 표 — design-data 스키마 단독 판정 금지 (함정 ④).
4. 이벤트 축 제외 기준: [2026-08-20 인터랙션 registry 감사](./2026-08-20-interaction-registry-rac-rsp-coverage.md) §2 와 중복 기재 금지.

---

**본 감사는 인벤토리 전용이다** — 채택 여부·우선순위 확정은 별도 판정 (ADR 또는 사용자 지시) 을 거친다. §1-1 표면 단절 계열은 버그 성격이라 소규모 수리로 다룰 수 있고, §1-2~1-4 는 패밀리 스윕 단위의 계획 대상이다.
