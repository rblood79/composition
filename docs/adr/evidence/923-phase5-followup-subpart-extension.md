# ADR-923 Phase 5 후속 — read-only sub-part 확장: SelectTrigger 래퍼 · 그룹 Label · picker DateInput (2026-09-03)

> 결정 지점 (3) SSOT 경계 재판정 — 사용자 판정 **A × 2** (2026-09-03): (1) NumberField·Select·ComboBox·SearchField 의 canonical `SelectTrigger` 래퍼 = read-only sub-part, (2) CheckboxGroup·RadioGroup·Meter·ProgressBar·Slider 의 canonical `Label` = read-only sub-part. 앞선 판정 (FieldError 잔여 1 · Label/Input/DateInput 확장) 은 [923-phase5-followup-fielderror-state-projection.md](923-phase5-followup-fielderror-state-projection.md) §10·§12. 이 문서는 Lane B (병렬 lane 2 중 메인 세션 담당) 의 evidence 이며 append 충돌을 피해 새 파일로 둔다.

## 1. 사실 (착수 전 실측)

| #   | 사실                                                                                                                                                                                                                                                                                                                           | 근거                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | DOM 렌더러는 canonical `SelectTrigger` 를 **SelectValue 손자를 찾는 경로로만** 쓰고 그 style·props 는 읽지 않는다. 래퍼 상자는 parent rule delegation 이 그린다.                                                                                                                                                               | `FormRenderers.tsx:393` (SearchField) · `SelectionRenderers.tsx:1141` (Select) · `:1558` (ComboBox) · NumberField 는 읽기 0 · `DateRenderers.tsx` 읽기 0        |
| 2   | delegation `childSelector`: NumberField·DatePicker·DateRangePicker `.react-aria-Group`, ComboBox `.combobox-container`, SearchField `.searchfield-container`, Select 은 trigger 가 Button 자체.                                                                                                                                | `componentRulesTable.ts` delegation 목록 (python 집계)                                                                                                          |
| 3   | factory 가 SelectTrigger 자식을 만드는 parent = NumberField · SearchField · Select · ComboBox · DatePicker · DateRangePicker (6). picker 는 `field > SelectTrigger > DateInput`.                                                                                                                                               | `factories/definitions/{Form,Selection,DateColor}Components.ts`                                                                                                 |
| 4   | 그룹 parent 는 parent `label` prop 으로 RAC Label 을 self-compose. 자식 Label 은 parent `label` 이 undefined 일 때 텍스트만 legacy 폴백 (r17m1). Slider 는 그것도 없이 parent prop 만.                                                                                                                                         | `renderCheckboxGroup :721` · `renderRadioGroup :918` · `renderProgressBar` (Layout :791) · `renderMeter :850` · `renderSlider :1770+30` (`label={props.label}`) |
| 5   | 그룹 parent 5 는 delegation 항목이 없다 → DOM Label 은 Label rule 로 직접 스타일 = Canvas Label rule. 갈리는 것은 자식 인라인뿐.                                                                                                                                                                                               | delegation 집계 (CheckboxGroup·RadioGroup·Meter·ProgressBar·Slider 전부 `[]`)                                                                                   |
| 6   | factory 는 Meter · ProgressBar · Slider 에만 Label 자식을 만든다 (CheckboxGroup·RadioGroup 은 옛 문서만). Meter/ProgressBar Label 인라인 = `width:fit-content` + 숫자 grid line 4 + `gridArea`.                                                                                                                                | `DisplayComponents.ts` · `FormComponents.ts` (Slider Label 은 인라인 없음)                                                                                      |
| 7   | SelectTrigger factory 인라인 = `width:100% · display:flex · flexDirection:row · alignItems:center · gap:4`. implicitStyles 가 같은 값을 `cs.X ?? 기본값` 으로 주입한다 (Select/ComboBox/SearchField/NumberField 분기 + `selecttrigger` 컨테이너 분기). picker 분기는 SelectTrigger 주입이 없었다 (factory 인라인이 유일 채널). | `implicitStyles.ts` 2152 (field 분기) · 2206 (컨테이너) · 2874 (picker — DateInput 만)                                                                          |
| 8   | picker DateInput 인라인 `verticalAlign:"middle"` 은 Skia `datefieldSegments` primitive 가 미지정 시 기본 `middle` 로 두므로 걷어내도 같다.                                                                                                                                                                                     | `skiaPrimitives.ts:1941+53`                                                                                                                                     |
| 9   | 수리 전 browser 실측 (400px): 래퍼 6 은 junk 후에도 상자 불변 (implicit 이 `cs.X ??` 로 junk 를 그대로 태우지만 3.6 delta 가 원본과 같은 키를 버려 batch 에 안 실림) — 그러나 **Meter/ProgressBar 의 clean Label 폭이 54/61 로 DOM 39 와 갈렸다** (아래 §2-3).                                                                 | `adr923WrapperSubpartProjection.browser.test.ts` 첫 실행 로그 (`ADR923WRAP`)                                                                                    |

## 2. 수리

### 2-1. 술어 (`@composition/shared` `resolveDelegatedChildFontSize.ts`)

- `DELEGATED_SUBPART_CHILD_TOKENS` 를 `Record<string, readonly string[]>` 로 — `SelectTrigger: [".react-aria-Group", ".combobox-container", ".searchfield-container", ".react-aria-Button"]` (Select 은 RAC Select 의 trigger 가 Button 자체).
- `SELF_COMPOSED_LABEL_PARENTS` = {CheckboxGroup, RadioGroup, Meter, ProgressBar, Slider} — delegation 없이도 Label 은 sub-part.
- `SUBPART_HOP_WRAPPER_TYPES` = {SelectTrigger} × `SUBPART_HOP_CHILD_TYPES` = {DateInput} — 직계가 래퍼면 **조부모** (field) 로 판정. DatePicker·DateRangePicker 의 DateInput 이 앞선 판정 (`.react-aria-DateInput` 4 parent) 에서 hop 때문에 빠져 있던 것을 메운다. SelectValue (placeholder 텍스트 축을 DOM 이 읽는다) · SelectIcon · Label 은 hop 하지 않는다.
- `resolveDelegatedSubpartOwnerType(child, parent, grandparent?)` 가 owner type (직계 또는 조부모) 을 돌려주고 `isDelegatedSubpartChild` 는 그 위의 boolean.

### 2-2. layout — 투영을 한 함수로 (`layout/engines/readOnlySubpart.ts` 신설)

`projectReadOnlySubpart(el, elementsMap)` 하나를 세 곳이 읽는다: (a) 자식 visit (인라인 → 투영 `display` + FieldError delegation fontSize + field 직계 Input/DateInput `width:100%`) · (b) **implicitStyles 입력 자식** (`rawChildren.map(projectReadOnlySubpart)`) · (c) 3.6 implicit 패치의 delta 기준 (raw 인라인이 아니라 투영값). Why (b): implicit 은 `cs.X ?? 기본값` 으로 주입하므로 raw junk 를 보면 기본값 주입이 막힌다 (래퍼 width 100% · padding, Label gridArea) — 앞선 delta 패치는 "junk 부활" 만 막았지 "기본값 실종" 은 못 막았다. Why (c): 3.6 의 fontSize/fit-content 재측정이 raw `children` 텍스트 ("Storage") 로 폭을 다시 재 propagation 된 텍스트 ("Name" 40 = DOM 39) 로 잰 visit 값을 54 로 덮었다 (§1-9) — sub-part 는 투영 기준이라 재측정을 건너뛴다. overlay margin 보고도 같은 술어 (`isReadOnlySubpart`).

### 2-3. implicitStyles

- `fieldTriggerRowStyle(cs, sideMode)` helper — field 분기와 picker 분기가 같이 쓴다 (row flex · width 100% · gap 4). picker 분기에 SelectTrigger 주입이 없어 인라인을 걷어내자 Canvas 래퍼가 152/271 로 줄었다 (DOM 418) → 주입 추가. ADR-912 Δ11 grep gate (`flexDirection: cs.flexDirection ?? "row"` ≤ 3) 가 4 로 걸려 helper 로 합쳤다 (현재 2).
- progressbar/meter Label 에 숫자 grid line 4 (`gridColumnStart/End 1/2 · gridRowStart/End 1/2`) 주입 — Slider 분기 동형. factory 인라인이 layout 에 실리지 않으므로 read-time 채널이 필요하다 (gridArea 이름은 엔진이 해석하지 않는다, layout-engine.md §Grid area 이름 해석).

### 2-4. Skia · 패널

- `buildSpecNodeData` sub-part 블록이 `resolveDelegatedSubpartOwnerType` 으로 owner (직계 또는 조부모) 를 잡는다 — 인라인 통째 무시는 기존과 같다.
- `panels/delegatedSubpart.ts` — `useSelectedSubpartOwnerType(elementId)` (parent · grandparent 를 store 에서 읽어 owner type). 패널 안내 `{parent}` 가 owner (DatePicker 의 DateInput 을 고르면 "DatePicker").

## 3. 게이트 · 원복 RED

게이트: `adr923WrapperSubpartProjection.browser.test.ts` 3 (junk == clean 9 컴포넌트 · baseline DOM 대조 — 래퍼 컨트롤 h·y + root h, 그룹 Label w·h·y · 래퍼 폭 = root 폭) · bridge `read-only sub-part 확장 (후반)` node 1 (owner 13 조합 + Skia junk == clean + hop 범위 밖 2) · 기존 확장 케이스의 범위 밖 3 갱신.

| 원복                                            | node (bridge 81) | browser (wrapper 3 + field 3)                            |
| ----------------------------------------------- | ---------------- | -------------------------------------------------------- |
| (t) 토큰 표에서 SelectTrigger 제거              | **1 FAIL**       | **1 FAIL** (NumberField junk ≠ clean)                    |
| (u) `SELF_COMPOSED_LABEL_PARENTS` 비움          | **1 FAIL**       | **2 FAIL** (Meter junk ≠ clean · Meter label w 54 vs 39) |
| (v) hop 대상 (`SUBPART_HOP_CHILD_TYPES`) 비움   | **1 FAIL**       | GREEN (DateInput junk 가 래퍼·root 상자를 안 움직인다)   |
| (w) implicit 입력 자식 투영 제거                | GREEN            | **2 FAIL** (TextField · NumberField junk ≠ clean)        |
| (x) 3.6 재측정 기준을 raw 인라인으로            | GREEN            | **2 FAIL** (Meter junk ≠ clean · label w 54 vs 39)       |
| (y) picker 분기 SelectTrigger 주입 제거         | GREEN            | **1 FAIL** (DatePicker 래퍼 폭 152 vs 400)               |
| (z) progressbar/meter Label 숫자 grid line 제거 | GREEN            | GREEN                                                    |

(z) 는 게이트 무반응 — Label 이 첫 grid 자식이라 auto-placement 가 (1,1) 에 놓여 상자가 같다. 주입은 자식 순서가 다른 옛 문서를 위한 방어 (DOM 은 `grid-area` 이름으로 순서 무관) 이며 Slider 분기와 같은 형태. production 재현 시나리오는 없으므로 LOW deferred (review-loop-closure.md §2).

원복은 편집 역적용 (scratchpad 백업 → 복원 · md5 대조), `git checkout` 아님 — 다른 세션의 dirty 파일이 같은 tree 에 있다.

## 4. 검증 · live

- type-check PASS · builder 5204 (657 파일) · shared 971 (Δ11 gate 15 포함) · browser 4 파일 13 (wrapper 3 · field sub-part 3 · FieldError 5 · HC2 3 — 이후 wrapper 폭 assertion 추가로 wrapper 3) · full parity **1078** (기존 FAIL 2 — `catalogComponentBox` GridListItem·Tooltip).
- live (Chrome MCP, localhost:5173, 프로젝트 e16b69c6 Home, 2026-09-03): 팔레트 Select → SelectTrigger 에 `width:50 · height:7 · padding:9 · marginTop:30 · gap:40 · borderRadius:40 · fontSize:30 · borderWidth:6 · borderColor red` 주입 → 래퍼 rect `[0,26,342,30]` · root `[24,409,342,56]` **불변** (주입 전후 동일), 캔버스 확대에서 빨간 테두리·둥근 모서리 없음. 팔레트 Meter → Label 에 `width:50 · height:7 · padding:9 · marginTop:30 · fontSize:30 · fontWeight:900 · color red · gridColumnStart/RowStart 2` 주입 → Label rect `[0,0,51,20]` · root 32 **불변**, "Storage" 가 보통 굵기·색. SelectTrigger / Label 선택 시 Properties "Edited from the parent — SelectTrigger is drawn by Select…" · Styles "Styled by the parent" (Meter 도 같음). 콘솔 에러 0. 생성 요소 정리 (요소 수 52 복원). 다른 세션이 같은 시각에 파일을 편집해 Vite 전체 재로드가 두 번 끼어들었고 (readiness 화면 100% 에서 수 초 정지 후 정상), 두 번째 재로드 뒤 다시 재현했다.

## 5. 범위 밖 (기록만)

- SelectValue 의 placeholder 텍스트 축 (Select 은 자식 우선, ComboBox/SearchField 는 parent 우선) — DOM 이 읽으므로 편집 surface 유지. style 은 DOM 미도달이지만 이번 판정에 넣지 않았다.
- DOM 래퍼 content-box overflow (NumberField·ComboBox·SearchField·DatePicker·DateRangePicker 418 > root 400; Select 은 400) — 기존 기록과 같은 계열, 별도 작업.
- 3.6 재측정이 raw `children` 텍스트를 읽는 것 자체 (비-sub-part Label 에도 해당) — propagation 텍스트를 쓰도록 바꾸는 것은 Label 폭 일반 결함으로 별도.
