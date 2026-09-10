# ADR-210 상세 설계 — 다중 수치 컬럼과 시리즈 표시

2026-09-10 · **round 2 수리 검증 승인 · P0/G0 · P1/G1 · P2/G2 · P3/G3 PASS · P4 이후 미실행**. [상위 ADR](../210-chart-multi-field-series-presentation.md), [대상 조사](../../explanation/research/CHART_EXTENSION_SCOPE_RESEARCH_2026-09.md). 아래 함수/새 필드/파일명은 제안이며 현행 구현으로 인용하지 않는다.

## 1. 범위·선행 관계

- ADR-209=기반, ADR-210=응용 확장. Chart props specialization이며 canonical core/collection schema의 선행 기반을 다시 정의하지 않는다.
- ADR-209 완료는 본 ADR에 의존하지 않는다. ADR-152의 미래 식별자 전환에 chart 전용 resolver를 선행 도입하지 않는다.
- 사용자는 별도 ADR 사전 조사 완료 후 “설계 구체화 해서 진행해”로 작성을 요청했다. 새 ADR 작성과 제품 구현 승인은 구분한다.
- 첫 scope: E01–E08/E23/E24. wide Bar/Line/Area/Radar, 기존 group 6종, 공통 숫자 format 6종. 범주별 메타데이터/날짜축/교차곱/이중 축/상호작용/템플릿 제외.

## 2. 저장 props 제안

기존 `dimension/metric/color/data/dataBinding` 및 시각 props는 유지한다. 신규 필드는 모두 선택적이며 catalog `accepts`와 순서/숨김 선언, shared Chart props, normalize/resolver, runtime memo dependencies에 함께 등록한다. catalog default는 투영/편집 화면의 읽기 기본값으로만 선언하고 canonical에는 쓰지 않는다. `CHART_DEFAULT_PROPS`에는 새 키를 추가하지 않는다. `isOverridden`은 입력 props에 키가 있는지를 뜻하며 ref override map의 소유권 증거로 사용하지 않는다. 원본 따르기 표시는 실제 ref override map을 확인한다.

| 키                    | 타입·의미                                           | 미설정 의미/편집 규칙                                                                                                         |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `dataMode`            | `group` 또는 `columns` enum                         | 미설정=기존 group. 명시 group은 ref origin의 columns를 override                                                               |
| `valueFields`         | 원본 필드 key 문자열 배열                           | columns에서 유효 필드 순서. 중복 key 금지. 빈 배열은 미완성 설정이며 legacy metric으로 자동 fallback 금지                     |
| `seriesConfig`        | `{key:string, label?:string, colorToken?:string}[]` | 미설정=기존 기본 동작. 명시 `[]`=origin 목록 override 후 자동 기본값. 배열 순서가 설정된 시리즈의 표시 순서                   |
| `valueFormat`         | `auto/decimal/currency/percent` enum                | auto/미설정은 기존 formatTick과 문자열 동작 유지. opt-in 설정에서만 새 표시 규칙                                              |
| `valueLocale`         | `en-US/ko-KR` enum                                  | 새 format에서 미설정은 en-US. Settings UI 언어를 자동으로 저장/적용하지 않음                                                  |
| `valueFractionDigits` | 정수 0–6                                            | 새 decimal/percent 기본 minimum 0·maximum 2, currency 기본은 통화별 Intl 기본. 명시값은 minimum=maximum                       |
| `valueCurrency`       | 통화 코드 문자열                                    | currency 선택 UI는 코드를 함께 선택해야 함. USD/KRW/EUR 등의 Intl 지원 코드 후보. 미설정 currency는 진단, 임의 통화 추정 금지 |
| `valuePercentUnit`    | `ratio/percentagePoints` enum                       | percent 선택 UI에서 명시 선택. 미설정 raw percent는 진단, 값 크기로 자동 추론하지 않음                                        |

`seriesConfig.key`는 JSON 문자열 `JSON.stringify(["group", legacyGroupKey])` 또는 `JSON.stringify(["field", sourceFieldKey])`다. 단일 그룹 키는 빈 문자열이므로 `["group",""]`다. 원본 필드 `series0`, `reset`, 쉼표/따옴표와 충돌하지 않는다. 사용자 label은 원본 key/identity를 대체하지 않는다. 현재 group의 문자열 변환 의미(숫자1/문자열"1"의 합침 포함)는 그대로 두고 암묵적으로 타입 identity를 변경하지 않는다.

`seriesConfig` 편집 UI는 현재 보이는 시리즈와 휴면 설정을 분리해서 표시한다. 지정 목록에 있는 현재 시리즈를 배열 순서대로, 미지정 시리즈는 group=기존 출현 순서/columns=valueFields 순서로 뒤에 둔다. 이 순서는 `grid.series` 순서로서 stack 누적, dodge 슬롯, legend, tooltip 모두에 적용한다. 순서 편집은 기하 변경이며 위치 인덱스와 팔레트 인덱스를 분리한다. 필드 삭제/모드 변경으로 보이지 않는 config는 보존하며 사용자가 명시 제거할 수 있다. 재등장하면 동일 key의 이름/색/순서를 회복한다. label 빈 문자열은 명시적 빈 이름, 라벨 초기화는 로컬 entry의 label 속성 제거다.

색은 임의 CSS 코드 대신 기존 chart palette의 **토큰 이름**을 선택한다(예: `--chart-series-1`). 허용 후보는 catalog chart 채널의 팔레트 목록에서 읽는다. 사용자가 지정한 토큰은 행 순서와 무관하게 유지되고 light/dark에서 각 소비자가 해소한다. 미지정 색은 config 정렬 전의 group 출현 순서 또는 columns valueFields 순서로 팔레트 인덱스를 배정한다. config만 재정렬하면 색은 유지하며, 원본 행 출현 순서나 valueFields를 바꾸면 미지정 색은 달라질 수 있다. 키로 해시한 새 기본 팔레트를 기존 차트에 자동 적용하지 않는다. colorToken 초기화는 해당 entry의 속성 제거다.

### 2.1 읽기·쓰기·ref

- 현재 authoring `props.dataBinding`과 legacy extension의 읽기 우선순위는 기존 계약 그대로다. 새 필드는 Chart props에만 저장한다.
- semantic update 한 번이 사용자 동작 한 번이다. 여러 props를 바꾸는 모드/format 전환은 단일 patch/단일 history event로 저장한다. UI의 deferred selection 대신 현재 selection 경로를 사용한다.
- `seriesConfig`/`valueFields`는 **배열 전체 교체**다. ref 편집은 effective 값의 배열을 복사해 인스턴스 override로 기록하고 origin을 변경하지 않는다. 이후 origin 배열 추가를 자동 병합하지 않는다. 다른 prop은 계속 origin을 따른다.
- 명시 `dataMode:"group"`, `seriesConfig:[]`, `valueFormat:"auto"`는 삭제가 아니라 override다. “원본 설정 따르기”는 기존 `resetInstanceOverrideField` (`apps/builder/src/builder/stores/utils/instanceActions.ts:912`) 경로로 해당 prop override를 제거하는 별도 동작이다. 배열 항목 초기화와 원본 따르기를 혼동하지 않는다.
- resolver는 원본 node를 고치지 않고 `{normalized, diagnostics}`를 반환한다. 중복 valueFields는 소비에서 첫 항목만 인정하되 진단을 남기고 저장 원본은 보존한다. 중복 config key도 first-wins+진단. 잘못된 타입/format이면 chart 설정 오류 상태를 보여주고 조용히 다른 의미로 렌더하지 않는다.
- 알 수 없는 필드는 source 재연결/컬럼 삭제 시 UI에서 누락 표시하고 원본 key를 보존한다. 미지정/default hydration으로 고치지 않는다.

### 2.2 배열 동일성과 재전송

Chart 전용 patch 생산자는 배열의 순서와 각 entry의 key/label/colorToken 및 속성 존재 여부를 비교한다. 동일한 명시 배열 재적용은 write/history 0이다. ref에서 상속 배열과 같은 값을 **명시 override로 고정**하는 사용자 동작은 예외로 1회 저장하며, 일반 Apply와 구분한다. 객체 참조나 object key 나열 순서는 의미 비교 기준이 아니다. Preview에서 같은 의미의 배열을 재전송해도 모델·animation이 재시작되지 않도록 Chart 경계의 안정화된 의미 의존성을 사용한다. 실제 값/순서 변경은 모델을 갱신한다. 공통 패널 전체에 deep comparison을 추가하지 않는다. G0에서 같은 배열 재적용·동일 메시지 재전송·실제 변경 대조를 검증한다.

### 2.3 모드·종류 변경

1. group→columns: 값 필드를 선택하기 전까지 기존 모드를 유지하는 편집 popover. Apply에서 dataMode+valueFields를 한 번에 저장한다. 취소는 write 0. 이미 columns이며 마지막 필드를 제거하면 빈 설정 상태를 보여준다.
2. columns→group: dataMode만 group으로 설정한다. 기존 metric/color와 휴면 valueFields/config는 보존한다. 유효하지 않은 legacy 필드는 진단하며 임의 첫 컬럼으로 덮어쓰지 않는다.
3. columns 차트의 종류 변경 메뉴에서 Pie/Radial은 지원 사유와 함께 비활성화한다. 현재 PropertySelect는 항목별 disabled를 지원하지 않으므로 opt-in disabled key와 사유 전달을 필요한 최소 확장으로 inventory에 포함한다. 기존 Select의 reset/literal/키보드 계약은 보존한다. group으로 전환한 뒤 종류를 변경할 수 있다. import/외부 patch로 columns+Pie/Radial이 들어오면 unsupported 상태, 데이터 보존, 임의 fallback 0.
4. 사용자 preset은 시각 patch만 적용한다. mode/fields/config/format을 덮어쓰지 않는다. 새 preset/template 저장은 범위 밖이다.

## 3. 데이터 모델과 숫자 표시

제안 helper: `resolveChartModel(rows, props, metrics)`를 중심으로 기존 grid/stack/ticks를 확장한다. Canvas와 Recharts는 **같은 값을 계산한 모델**을 소비하되 좌표를 한 renderer에서 복사하지 않는다. 기존 `resolveChartData`, `buildSeriesGrid`, `computeChartScene` 간 중복 집계를 피한다. 정적 Canvas snapshot의 기존 행 주입/샘플 정책과 전체 runtime 행 정책은 바꾸지 않는다.

모델의 시리즈: `{id, sourceKey, label, paint, values}`. paint는 기존 index 또는 검증된 token 참조. `series0` 등 Recharts 내부 dataKey는 소비 시점에 생성하며 영속 저장하지 않는다. `valueFields`와 metric key는 top-level literal key이다. 점/대괄호가 포함된 필드를 Recharts path 문법으로 해석하지 않고 내부 dataKey로 전달한다.

- group: 현행 범주/그룹 문자열화와 단일 metric sum, 결측 처리 유지.
- columns: dimension으로 범주를 만들고 선택 필드마다 독립적인 값을 합산한다. 기존 `toFiniteNumber`를 재사용한다. 비수치·null은 결측, 실제0은 0. 범주만 있고 유효값이 없으면 empty data 상태다.
- 계산 비용: group O(rows), columns O(rows × fields). 원본 rows를 영속 long 배열로 복제하지 않는다. 기존 stack 계산은 범주×시리즈 값을 입력받는다.
- group의 기존 category 색 Bar 및 Pie/단일 Radial: seriesConfig의 이름/색을 범주 legend에 적용하지 않는다. 이 경우 시리즈 설정 컨트롤은 사유와 함께 미노출/읽기 안내하며 저장한 config는 휴면 보존한다. columns Bar에서는 colorBy=category와의 조합을 지원하지 않는다. 모드 적용 시 사용자에게 series 색 사용을 표시하고 colorBy=series를 같은 patch로 저장한다(기존 값 변경과 Undo를 명시). columns에서는 Appearance의 Color By를 숨기며, 외부 입력의 columns+category는 설정 오류로 진단한다. 조용히 series로 바꾸지 않고 사용자의 복구 동작으로만 patch한다.

### 3.1 raw/plot/display 단위

`raw`는 집계값, `plot`은 누적·정규화 결과, `display`는 formatter 출력이다. 숫자 포맷은 raw/plot을 수정하지 않는다. formatter 제안 signature는 `formatChartNumber(value, config, context)`이며 context가 `raw`인지 `normalizedPercent`인지 필수로 전달된다.

| 상황                               | 값 원천                  | 새 설정의 표시                                                            |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| 일반/stacked 축                    | 원본 수치 단위의 축 눈금 | raw 단위의 decimal/currency/percent                                       |
| 값 라벨 (일반/stacked/expand 모두) | raw 개별 시리즈 집계값   | raw context로 지정 format. 누적 끝점이나 정규화 비중으로 바꾸지 않음      |
| tooltip (모든 stack 모드)          | raw 개별 시리즈 집계값   | raw context로 지정 format                                                 |
| expand 축                          | 0–100 normalizedPercent  | opt-in이면 항상 percent. currency나 raw percent 입력 단위를 적용하지 않음 |
| 범주 라벨                          | 원본 문자열              | 숫자 formatter 미적용                                                     |
| auto/미설정                        | 기존 경로                | 기존 문자열 보존. expand 축에도 %를 소급하지 않음                         |

현행 근거는 `packages/specs/src/chart/marks/bar.ts:196-210` 및 `packages/shared/src/components/chart/RechartsChart.tsx:138`이다. raw 120/80의 expand 차트는 기하가 60/40이어도 값 라벨은 120/80이다. 새 decimal도 이를 유지하고 currency는 원본 120/80에 적용한다. 비중 라벨을 새로 제공하는 것은 범위 밖이다.

새 percent raw는 ratio 0.25→25%, percentagePoints 25→25%. normalizedPercent25는 valuePercentUnit과 무관하게25%. locale와 fractionDigits는 표시 옵션이다. 새 currency의 후보/허용 코드는 P0에서 사용 가능한 Intl 코드 목록과 유효성 처리를 고정하며, 지원하지 않는 코드/locale가 import되면 진단과 원본 보존. 통화를 수치 변환하거나 자동 환전하지 않는다.

동일 차트에서 서로 다른 단위의 컬럼 비교는 첫 UI에서 “같은 단위의 값을 선택” 안내를 둔다. schema에 단위 메타데이터가 없으면 자동 판정하지 않는다. per-series 단위/format·이중 축은 제외한다. valueFormat은 차트 공통이다.

Settings의 ko/en는 **컨트롤 번역**이다. valueLocale는 문서의 **숫자 표시**이며 자동 연동하지 않는다. 독립 publish도 저장된 명시 locale 또는 en-US 기본을 사용한다. 날짜/시간대/브라우저 locale 자동 추종은 이번 범위 밖이다.

## 4. Properties와 렌더링 결선

### 4.1 사용자 흐름

Content의 실제 순서는 기존 contentExtras의 Chart 전용 컨트롤(종류/프리셋/모드) → 기존 자동 생성 필드(Data/Category 등)의 현행 순서다. 필드 사이 삽입을 가정하지 않는다. G0에서 실제 mount 순서를 확인한다. group이면 Value/Series/None 유지. columns이면 Value Fields 목록(추가/삭제/위·아래 이동; drag 없이 키보드 가능), 현재 컬럼 타입/누락 표시. 값/그룹 key를 번역하지 않는다.

Series: 현재 시리즈 목록과 표시명·팔레트 토큰 선택·위/아래 이동·항목 초기화. 기존 값/이름으로 preview를 보여주고 행 개별 source 값을 수정하는 도구로 오해시키지 않는다. 미지원 범주색 모드에서 비활성 사유 표시. 휴면 설정은 별도 펼침으로 제거할 수 있다.

Number Format: Auto/Decimal/Currency/Percent, 명시 locale, 소수 자리. Currency는 통화 필드, Percent는 입력 단위가 동적으로 나타난다. Auto는 나머지 편집 옵션 숨김, 저장된 휴면 설정 보존. format 전환 popover에서 필요한 값까지 묶어 Apply한다. label blur/Enter 및 swatch 선택은 기존 debounce/save 정책을 재사용하고 각각 Undo 단위를 정한다.

타입 후보: schema의 수치형/문자형/불명을 표시한다. 미지 타입은 선택을 허용하고 실제 값의 처리 정책을 안내한다. 명시 비수치 schema 필드도 저장된 현재 값은 제거하지 않는다. 선택 차단 정책은 새 수치 선택에만 적용하며 기존 값에는 오류 표시+교체 선택을 제공한다. 단순 첫 행 추론으로 수치형을 확정하지 않는다.

### 4.2 생산·저장·소비 경계

| 현재 경로                                                                                                            | 필요한 결선                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/catalog/bindings/Chart.binding.ts`                                                              | 새 props accepts 등록. dataMode enum/valueFields string-array/seriesConfig items-manager와 format의 기존 kind 사용. 복합 전용 UI 필드는 editorHidden으로 중복 제거                               |
| `apps/builder/src/builder/panels/properties/chartFieldOptions.ts`                                                    | 기존 None/literal 옵션 계약 보존. 타입 안내용 chart 전용 후보 helper 추가, 공통 문자열 컬럼 hook의 반환 타입을 전역 변경하지 않음                                                                |
| `ChartAuthoringControls.tsx`, `PropertiesPanel.tsx`                                                                  | 실제 contentExtras/semantic editor에 mode/series/format 컨트롤 연결. 제안 신규 `ChartDataMappingControls.tsx`, `ChartSeriesControls.tsx`, `ChartNumberFormatControls.tsx`는 실제 mount 검증 필수 |
| `apps/builder/src/builder/stores/inspectorActions.ts`                                                                | 기존 updateSelectedProperties/semantic dispatch를 호출, 신규 저장 lane 추가 안 함. 실제 store/ref/history 테스트                                                                                 |
| `packages/shared/src/catalog/outputs/toRacProps.ts`, `resolvers/resolveEditContract.ts`                              | 새 accepts가 투영되는지 검사. 공통 resolver가 새 chart 의미를 소유하지 않음                                                                                                                      |
| `apps/builder/src/resolvers/canonical/extractCanonicalProps.ts`                                                      | dataBinding 소비 투영 보존, 신규 props 유실 0                                                                                                                                                    |
| `packages/specs/src/chart/types.ts`, `series.ts`, `runtimeData.ts`, `computeChartScene.ts`, `legend.ts`, `scales.ts` | 타입·집계·identity·표시 해소. 제안 `presentation.ts`에 직렬화 설정 validator/formatter; 이름만 선언하고 소비 누락 금지                                                                           |
| `packages/shared/src/components/Chart.tsx`, `chart/RechartsChart.tsx`, `chart/svgDecorations.tsx`                    | lazy props 전달 및 memo deps, 실제 series label/token/raw tooltip/axis/value label 적용                                                                                                          |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts` 및 chart scene paint 소비자                     | 기존 rows 공급 유지, 새 props/style 변경으로 scene invalidate. resolved paint/token 실제 Skia 소비                                                                                               |
| 기존 chart unit/browser/live 테스트                                                                                  | 새 모델 테스트+실제 producer/store+6종 호환+4종 wide+독립 publish                                                                                                                                |

P0에서 실제 paint 소비자 경로·필요 파일을 확정한다. 공통 kind 추가나 token generator 변경이 필요해지면 즉시 범위/대안을 재검토한다. 읽기 타입/숫자 formatter가 Recharts를 정적으로 import하여 Builder initial에 유입되지 않도록 순수 모듈을 유지한다.

## 5. 검증 fixture와 판정

| ID  | fixture                                                                    | 독립 기대값/검사                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T01 | wide Jan120/80, Feb40/10 + 동등 long4행                                    | 원시 표 손계산: desktop120/40, mobile80/10, 총200/50. 두 입력의 grid/marks 의미 동일                                                                                                 |
| T02 | 중복100+20, null, 비수치, 0, 음수                                          | sum120, 결측은0으로 바뀌지 않음. 지원 4종·stacked/expand/dodged                                                                                                                      |
| T03 | `reset`, `series0`, `a.b`, 빈 이름, 따옴표·같은 표시명, 숫자1/문자열1 그룹 | 원본 key/identity 손실0; legacy group 문자열화 유지; internal dataKey 충돌0                                                                                                          |
| T04 | 행 순서 뒤집기, 필드 삭제/재추가, group/columns 왕복                       | 지정 label/token 유지, 순서 변경은 stack/dodge/legend/tooltip 모두 반영; config만 정렬하면 기본 색 유지. 휴면 설정 회복, 원본 rows write0                                            |
| T05 | raw0.25 ratio, raw25 points, expand25;1234.5 통화                          | 기본 자릿수에서 25%/25%/25%; 명시 2자리면 25.00%. raw 120/80 expand의 라벨은 120/80, 기하 60/40. currency 라벨/tooltip은 raw, 축은 %. 기존 computeChartScene 결과로 먼저 오라클 고정 |
| T06 | props에 binding / extension에만 binding, schema0/unknown/누락 key          | 실제 Properties 생산자를 통해 후보/타입/None 유지, fallback·키유실0                                                                                                                  |
| T07 | legacy 6종·신규 4종·ref/origin                                             | 실제 semantic action→canonical→DB→reload, Undo/Redo, parent 배열 추가 시 override 계약, origin write0                                                                                |
| T08 | source 재연결, columns 빈 배열, unsupported Pie/Radial import              | 설정 진단 및 데이터 보존; 다른 metric으로 몰래 fallback0                                                                                                                             |
| T09 | 같은 source Chart와 ListBox                                                | Chart의 모드/format 변경 뒤 ListBox 데이터/컬렉션 원본불변                                                                                                                           |
| T10 | light/dark, 작은/큰크기, 긴 한글 이름/통화, padding/resize                 | 토큰 결과·문자열 동일, 주요 좌표/곡선 중간점≤1px, legend/label overflow 정책 확인                                                                                                    |
| T11 | 실제 Settings ko/en, chart locale en/ko, export 독립 publish               | UI 언어와 값 locale 분리, 후자가 영속, 렌더/hover/키보드 canonical write0                                                                                                            |
| T12 | 구 버전305e4c4f7에 새 export, 기존 미편집 export                           | 기존 문서 호환, 새 설정의 구 버전 무손실 미지원 여부 실측·명시                                                                                                                       |
| T13 | 같은 rows·같은 series·같은 viewport·같은 marks workload A/B                | §7 성능; 의도치않은 표본 절삭으로 PASS 금지                                                                                                                                          |

매핑 fixture의 model 결과만 양쪽에 주입하는 browser test는 실제 옵션 생산/저장 경로를 대신하지 않는다. T06/T07은 각각 실제 producer 및 실제 inspector action을 통과한다. UI 생성 helper만 실행하고 팔레트/패널 wiring을 확인하지 않는 테스트로 완료하지 않는다.

## 6. 단계·산출물

| Phase | 작업과 완료 산출물                                                                                                                                                | Gate              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| P0    | 공식 대표 shadcn multiple/format 예제 source revision과 screenshot 고정, pinned Recharts4종 spike, catalog/semantic/ref/token 결선 inventory, 기존 group baseline | G0 **PASS** (2026-09-10, ADR 실행 기록) |
| P1    | 신규 optional props validator·공통 model·identity·format·정규화·diagnostics. T01–05/T08/T12                                                                       | G1 **PASS** (2026-09-10, ADR 실행 기록) |
| P2    | 실제 Properties mode/fields/series/format, 타입 안내, semantic patch/Undo/ref/hydration. T06/T07/T09                                                              | G2 **PASS** (2026-09-10, ADR 실행 기록) |
| P3    | Canvas/Preview/Publish 소비·메모 의존성·theme/label/tooltip·locale·accessibility. T10/T11 및4종wide+6종legacy                                                     | G3 **PASS** (2026-09-10, ADR 실행 기록) |
| P4    | 최종clean revision 번들/성능/production network. T13; 전체 예산 정책 재판정                                                                                       | G4                |
| P5    | focused suite/preflight/live/review·rollback 제한·ADR/README/CHANGELOG 정합                                                                                       | G5                |

P0 결과가 제안 schema나 4종 범위를 부정하면 Decision을 수정하고 리뷰한다. 제품 구현은 설계 리뷰 및 P0 경계 확인 후 진행한다. 이 문서의 phase 표가 실행 증거는 아니다.

## 7. 측정 계획·5질문

작업량 W200은 50범주×4시리즈=200개 유효 수치 셀이다(group 200행, columns 50행×4필드). W800은 200범주×4시리즈=800셀이다(group 800행, columns 200행×4필드). **신규 static ≤100ms 기준은 W800의 지원 4종**에 적용하며 W200은 ADR-209와 비교하는 회귀 대조군이다. line/area/radar는 셀 수가 SVG path 수와 같지 않으므로 실제 path/point 수를 따로 기록한다. Builder 비교는 기존 6종 각 W200 장면을 고정하고 wide 4종 W800 비용을 별도 보고한다. 아래 200행×4시리즈는 columns W800을 뜻한다.

before SHA는 `baf535258`으로 고정한다. P0에서 전체 SHA와 lock hash를 기록하고 P4까지 보존한다. 다른 baseline이 필요하면 이유와 비교 범위를 명시하며 조용히 교체하지 않는다.

1. **무엇을 재나:** final build 초기/lazy 전이 closure gzip, 입력에서 마지막 SVG 기하 변경까지 시간(추가2안정 frame 분리), Builder inclusive render.frame p95, canonical write 수.
2. **source/오라클:** pinned 공식 Recharts 예제+손계산 데이터값, 실제 DOM 좌표·Skia 주요점. 공통 helper 출력끼리만 비교하지 않는다. 모든 shadcn 예제의 외관 달성률을 임의 점수로 만들지 않는다.
3. **불리 조건:** 200행 × 4시리즈 기본 외 8/16시리즈, 5000행, 결측/음수/expand, 긴 label·통화, mode/fields 재정렬·resize·다크. 입력 row/series/mark 수 및 실제 소비 수를 기록한다.
4. **대조군·환경:** before는 위에서 고정한 baf535258과 원래 lockfile의 별도 clean worktree. after도 최종 코드/lockfile 고정. 같은 기기·headed Chromium·viewport 1440×900·DPR 1·visible·CPU throttle 1, 로그인된 실제 populated 프로젝트. 초기 데이터 100개만 잘라 기준 200행 PASS 금지.
5. **실패 시:** static 200행 × 4시리즈 p95>100ms 또는 Builder 5쌍 어느 Δ>1ms이면 fail. 표본/animation duration을 빼서 통과시키지 않는다. 정책 예외는 최종 측정 후 명시적 승인, 과거 ADR 수치로 대체 금지.

runtime은 종류별 warmup 3회 + 측정 12회, 5000행은 최소 3표본. Builder는 차트 6개·각 W200 장면에서 select/edit/resize/zoom 최소 5쌍 순서교대. wide 4종 기능비용은 group으로 표현 가능한 **동등 데이터/같은 마크 수**와 별도 비교한다. 추가된 마크를 숨겨 baseline을 맞추지 않는다.

manifest는 SHA/lock hash/dirty/도구·브라우저·기기/entry 정적·dynamic graph/입력 hash/표본/실패·heap·longtask/visibility를 포함한다. production 로그인된 chart 포함 Builder boot/편집0, no-chart Preview/Publish0, 첫 chart runtime의 전이graph만 요청, warm 재다운로드 0. formatter만 쓰는 공통 모듈이 Recharts initial import를 만들지 않는지 검사한다.

전체 initial 예산은 Builder/Preview/Publish 각각 따로 판정한다. ADR-209의 이전 예외 상한을 자동으로 새 baseline으로 승인하지 않는다. initial 영향이 있는 이 구현의 최종 후보에 전체 기준 초과가 남으면 축소 또는 사용자 예외 재승인이 필요하다. 동일 before 대비 initial 순증 ≤10 KiB와 chart lazy 전이 그래프 순증 ≤200 KiB는 별도로 판정한다. lazy 그래프의 전체 크기도 함께 기록한다.

## 8. 마이그레이션·rollback 비용

- opt-in하지 않은 기존 프로젝트: 의도된 사용자 영향 0%, 자동 재직렬화 문서 0. 실제 사용자 분포는 미측정이며 전수 통과로 추정하지 않는다.
- opt-in하면 수정한 chart 수 k에 대해서만 기존 저장 경로가 쓰인다. 원본 collection 행 변경 0. 저장비용은 기존 문서 저장 단위에 따르며 “k개파일만쓰기”라고 가정하지 않는다.
- rollback probe는 별도 worktree와 해당 commit 원래 lockfile을 사용한다. 현재 작업 디렉터리 checkout 및 의존성 shim은 금지한다.
- 구 버전은 알 수 없는props를 무시할 수 있어 새 columns 또는custom format 문서의 동일 렌더를 보장하지 않는다. 지원되는rollback은 **업데이트 전 원본 export/DB 백업 복원**이다. 새 설정 export를 구 버전에 넣는 경로는 호환 미지원으로 기록한다. wide→long 자동 export adapter는 범위 밖이다.
- 새 클라이언트에서 format/mode를 기존 group/auto로 명시 전환하면 보존된 legacy metric/color로 돌아갈 수 있지만 새 시리즈 표현을 보존하는 downgrade가 아니다. 구 버전 importer/행공급/기하를 P0/P1 probe로 확인하고 제한을 release note에 기재한다.

## 9. 문서 자체 점검 및 미검증

- Risk-First 순서·4대안/4축·Threshold·R1–R6 HIGH gate 대응·기각 사유·분리 4질문·하위 호환 비용 명시.
- 생성기 새 selector/variant 확장0. 기존 catalog kind 및 token 전달 가능성은 P0 검증 대상.
- 현재 코드 근거는 상위 ADR/조사 문서에, 신규 필드/파일은 이 문서에서 제안으로 구분.
- 기능/성능/P0 gate는 모두 미실행. 외부 독립 ADR round 1은 완료됐으며 수정 후 재리뷰는 미실행이다. 문서 format/link/preflight만 별도 실행 기록으로 남긴다.

## 10. Round 1 반영과 남은 검증

원본 [리뷰 로그](../reviews/210.md)의 판정과 내용은 보존한다. preflight의 Prettier가 로그의 표/공백 형식도 정리했다. 다음은 설계 수정 기록이며 독립 리뷰의 종결 판정이 아니다.

| 항목     | 반영                                                        | 남은 확인                                              |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| h1       | §3.1 값 라벨 raw 유지, T05 독립 기대값                      | G0 현행 expand 라벨 probe; P1 수리 검증                |
| m1       | §7 W200/W800·셀/마크 구분                                   | P0 workload inventory, P4 실측                         |
| m2       | §2.2 의미 동일성·명시 ref 고정 예외                         | G0 write 0/animation 재시작 0                          |
| m3       | §2.3·§3 Color By 및 disabled Select 경계                    | G0 UI wiring/공통 Select 회귀 범위                     |
| m4       | §2 순서=grid 기하 순서, 기본 색 분리                        | T04 stack/dodge 실제 기대값                            |
| m5       | 상위 ADR Risks별 경로 연결                                  | 수리 재리뷰                                            |
| l1/l2/l3 | default 비저장·isOverridden 한계·최소0/최대2·현행 주입 순서 | G0/P1 실제 소비                                        |
| l4       | T07에 descendant ref 선택→편집→reset→Undo→reload 추가       | P2 종결: 반증 실패 (origin·형제 불변, `adr210ChartPresentationStore.test.ts`) |
| l5/l6    | before SHA·분리 worktree·G4 공학/정책 분리                  | P4 측정 및 필요한 사용자 결정                          |

P1 진입 전 h1/m1/m4/m5에 대한 수리 검증 1회가 필요하다. P0·제품 테스트·build·live는 이번 문서 반영에서 실행하지 않았다.
