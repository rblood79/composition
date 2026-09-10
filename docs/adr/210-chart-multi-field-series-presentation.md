# ADR-210: 차트의 다중 수치 컬럼 매핑과 시리즈 표시 계약

## Status

Proposed — 2026-09-10. 사용자 “설계 구체화 해서 진행해”에 따른 ADR·상세 설계 작성. 구현 및 P0 실증은 미착수다. 코드 기준 `baf535258`(제품 조사 `305e4c4f7` 이후 문서 변경). round 1 문서 수정 반영, 수리 재리뷰 및 P0 미실행. 수리 검증과 P0 결과를 반영하기 전 Accepted/Implemented로 취급하지 않는다.

## Context

[사전 조사 E01–E24](../explanation/research/CHART_EXTENSION_SCOPE_RESEARCH_2026-09.md)에서 차트의 누적·프리셋·범례·라벨은 이미 존재하지만, 여러 수치 컬럼의 직접 매핑과 시리즈별 표시 설정은 없는 것을 확인했다. 현재 `ChartProps.metric`은 문자열 하나이고 `buildSeriesGrid`는 범주와 그룹에 따라 그 값만 합산한다. 사용자가 `{month, desktop, mobile}` 테이블을 그대로 연결해 두 시리즈를 비교하려면 별도 데이터 변형이 필요하다.

[shadcn Chart](https://ui.shadcn.com/docs/components/base/chart)는 행 데이터와 표시 config를 구분하고 Recharts dataKey로 시리즈를 구성한다. [Recharts Tooltip](https://recharts.github.io/en-US/api/Tooltip/) 및 [XAxis](https://recharts.github.io/en-US/api/XAxis/)의 formatter 계열은 표시와 값의 분리를 지원한다. Composition은 함수/React 요소를 저장하지 않으므로 이를 직렬화 가능한 제한된 설정으로 제공해야 한다. 설치 버전은 Recharts 3.10.1이며 온라인 최신 기능을 자동 채택하지 않는다.

**영역:** D2는 새 chart 설정과 소비용 데이터 모델, D3는 이름·토큰 색·문자열을 Canvas/DOM에 대칭 전달, D1은 기존 RAC 기반 Properties 및 Recharts runtime 접근성을 유지한다. chart 기하 모듈은 유지하되 DOM/ARIA나 임의 색상 CSS의 정본으로 확장하지 않는다.

**선행 관계 확인 (분리 4질문).** (1) ADR-209는 기본 저작/runtime 기반이고 본 ADR은 그 응용 확장이다. (2) 새 props는 Chart leaf의 specialization이며 canonical core/collection schema의 새 기반이 아니다. (3) ADR-209가 본 ADR 없이 완료된 사실을 유지한다. ADR-152의 collection 식별자 전환을 역으로 선행 필수화하지 않고 현행 공급 계약을 소비한다. (4) 이 방향을 설계 초기에 확정했으며 구현 후 재분류하지 않는다. 사용자는 별도 ADR 방향과 사전 조사 후 설계 작성을 요청했다. 제목은 사전 조사에서 제안한 제목을 사용한다.

**현재 근거:** `packages/specs/src/chart/types.ts:66`, `series.ts:47`, `runtimeData.ts:16`, `scales.ts:148`; `packages/shared/src/catalog/outputs/toRacProps.ts:81`; `apps/builder/src/builder/panels/properties/chartFieldOptions.ts:42`; `packages/shared/src/components/chart/RechartsChart.tsx:236`. 이 경로들이 각각 타입/집계/투영/format/allowlist/실제 옵션 생산/tooltip의 변경 경계다. 새 기능을 현재 코드에 존재한다고 주장하지 않는다.

**Hard Constraints**

- 기존 6종 group 모드의 기하·기본 문자열·`color:""` override·collection 공급을 보존한다. 미편집 기존 문서 강제 재직렬화 0, 기존 파일당 자동 migration write 0.
- 새 columns 모드는 Bar/Line/Area/Radar 4종. Pie/Radial에서 임의로 링/호 해석을 추가하지 않는다. 혼합 단위·교차곱·날짜축·필터/선택은 제외한다.
- 원본 행을 wide↔long으로 저장 변환하지 않는다. raw, plot, 표시 문자열을 구분하고 formatter가 기하/집계를 바꾸지 않는다.
- 공통 semantic write/history 경로를 사용한다. Preview/Publish 렌더·hover·locale 해소에 의한 canonical write 0, Builder에서 Recharts 요청 0.
- production columns 200범주×4필드=800 유효 셀(W800), 지원 4종 static p95≤100ms. 기존 6-chart 각 50범주×4시리즈=200셀(W200) 장면의 Builder frame p95 Δ≤1ms, initial 증가≤10 KiB gzip, lazy 증가≤200 KiB gzip. 8/16시리즈와 5000행은 별도 비용 보고 대상이며 무조건 합격을 주장하지 않는다.
- 전체 initial <500,000 B가 기본이다. ADR-209 B 예외는 initial 영향 변경 시 만료되므로 최종 revision에서 전체 예산 재판정과 필요한 명시적 승인이 있어야 종결한다.

**Soft Constraints:** 동적 Properties와 기존 필드/토큰 UI를 재사용한다. 일반 Inspector kind·CSS selector generator의 새 체계를 만들지 않는다. 기존 enum/string/string-array/items-manager로 선언하고, 구조화 시리즈 편집은 Chart 전용 컨트롤에만 둔다. 새 variant/자식 selector emit은 요구하지 않는다. 토큰을 인스턴스에서 해소하는 실제 두 소비 경로는 P0에서 확인한다.

## Alternatives Considered

| 대안                                   | 내용·근거                                                                                           | 기술                                | 성능                    | 유지보수                                | 마이그레이션                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------- | --------------------------------------- | ------------------------------ |
| A. 공통 데이터 변환 후 기존 Chart 사용 | source를 long으로 변환하면 현행 grid 재사용 가능. Recharts dataKey는 원본 변환을 강제하지 않음      | HIGH: 다른 collection 소비자에 영향 | MEDIUM: 변환/복제 비용  | HIGH: chart 요구가 데이터 레이어로 침투 | HIGH: 원본/참조 변경           |
| B. 명시 모드와 소비용 공통 모델        | 원본 보존, 4종 wide/기존6종 group, 제한된 표시 설정. shadcn config 분리를 Composition 방식으로 적용 | MEDIUM: 모드/identity를 정의해야 함 | MEDIUM: 필드 수에 비례  | MEDIUM: 공통 모델과 두 renderer 결선    | HIGH: ref·구버전·모드 전환     |
| C. Recharts 전체 API 편집기            | formatter 함수·shape·축 조합을 직접 노출. 공개 API 유연성 활용                                      | HIGH: Canvas 재현/직렬화 경계 확대  | HIGH: runtime 종속 확대 | HIGH: 라이브러리 API 추종               | HIGH: 저장 포맷·실행 코드 호환 |
| D. 단일 metric의 숫자 포맷만 추가      | 기존 구조에 제한된 표시 옵션만 추가. formatter API의 일부 활용                                      | LOW                                 | LOW                     | LOW                                     | MEDIUM: 기본값 호환            |

### Risk Threshold Check

A/B/C는 HIGH가 있고 D는 HIGH가 없다. 위험 회피 대안 D까지 비교했으므로 모든 대안 HIGH 조건은 해소됐다. CRITICAL은 없다. B의 호환 위험은 R1/R2와 G0/G1/G2에서 반증하며 자동으로 수용 완료 처리하지 않는다. 실패 시 D로 조용히 축소하지 않고 범위 변경안을 리뷰에 제출한다.

## Decision

**대안 B를 제안한다.** 소비용 공통 모델에 컬럼 모드·표시 메타데이터·숫자 format을 추가한다. 기존 데이터 공급, Chart leaf, Canvas/Recharts 분리는 유지한다. source key와 표시명은 별개이며 내부 순번은 영속 identity가 아니다.

첫 범위는 E01–E08 및 E23/E24다. 기존 group 설정을 보존하는 명시 모드, 선택 필드 순서, 이름/토큰색/시리즈 순서, decimal/currency/percent와 en-US/ko-KR 명시 locale를 포함한다. formatter의 자동 기본값은 기존 문자열을 유지한다. 새 설정의 값 라벨·축·tooltip 결선은 포함하지만 레이아웃 옵션 확장은 제외한다.

위험 수용 근거는 기존 문서에 기본값을 쓰지 않는 opt-in 전환, 배열 override의 명시적 전체 교체, 소비 모델 한 곳의 의미 처리, 구버전 한계 고지 및 P0 실증이다. ADR-209처럼 예산 예외를 자동 승계하지 않는다.

A는 원본 데이터와 다른 소비자에 미치는 영향, C는 Canvas/직렬화 범위 확대 때문에 기각한다. D는 다중 컬럼 비교라는 핵심 사용자 요구를 해결하지 않아 첫 선택으로 기각한다. Pie/Radial의 새 범주 config, 날짜축, tooltip/legend 배치, 자유 formatter, 필터/선택/템플릿은 별도 후속이다.

> 구현 상세: [ADR-210 breakdown](design/210-chart-multi-field-series-presentation-breakdown.md)

## Risks

| ID  | 위험                                                                               | 심각도 | 대응                                                                                   |
| --- | ---------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| R1  | 새 props가 allowlist/정규화/ref 경로에서 사라지거나 배열 일부 수정이 origin을 오염 | HIGH   | G0 저장/투영 spike, G2 실제 inspector/history/ref 검사                                 |
| R2  | 구 버전이 columns 설정을 무시하고 legacy metric으로 잘못 표시                      | HIGH   | G1 downgrade probe. 새 설정 문서의 무손실 rollback 미지원 명시, 원본 백업으로 rollback |
| R3  | 소스 key/표시명/순번 혼동으로 색·집계 identity 변동                                | HIGH   | G1 손계산·특수키·행 재정렬·동일 표시명 검사                                            |
| R4  | 정규화 25를 2500%로 출력하거나 UI locale와 publish 결과 불일치                     | HIGH   | G1 raw/plot 포맷 오라클, G3 독립 publish 검사                                          |
| R5  | 필드 추가로 마크 수 증가, initial 예산 예외가 만료                                 | HIGH   | G4 동일 작업량 비교 및 전체/순증 분리 재판정                                           |
| R6  | 긴 이름/통화 문자열·새 색 설정이 한 renderer에만 적용                              | HIGH   | G3 기하·문자열·theme·padding 비교                                                      |
| R7  | 공통 Inspector/collection schema를 불필요하게 확대                                 | MEDIUM | 기존 kind 재사용, source 타입은 읽기 전용 안내, G0 경계 inventory                      |

### 위험별 현재 코드 경로

아래는 위험이 걸리는 현행 경계이며 새 기능의 실패가 실측됐다는 뜻은 아니다. 경로 기준은 `baf535258`이다.

| 위험 | 관련 경계 (파일:라인)                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | `packages/shared/src/catalog/outputs/toRacProps.ts:88`; `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx:187`; `apps/builder/src/builder/stores/utils/instanceActions.ts:912`                                    |
| R2   | `packages/shared/src/catalog/outputs/toRacProps.ts:88`; `packages/specs/src/chart/series.ts:80`; `packages/shared/src/components/Chart.tsx:199` — 구 경로는 새 mode를 해석하지 않고 단일 metric/color를 소비                    |
| R3   | `packages/specs/src/chart/series.ts:68`; `packages/specs/src/chart/marks/bar.ts:214`; `packages/shared/src/components/chart/RechartsChart.tsx:128`                                                                              |
| R4   | `packages/specs/src/chart/scales.ts:148`; `packages/specs/src/chart/marks/bar.ts:196`; `packages/shared/src/components/chart/RechartsChart.tsx:138`                                                                             |
| R5   | `packages/shared/src/components/Chart.tsx:136`; `packages/specs/src/chart/marks/bar.ts:214`; `packages/shared/src/components/chart/RechartsChart.tsx:91` — lazy 경계·시리즈별 비용·memo 의존성. 예산 정책은 ADR-209 Status 참조 |
| R6   | `packages/specs/src/chart/legend.ts:72`; `packages/shared/src/components/chart/svgDecorations.tsx:4`; `packages/shared/src/components/chart/RechartsChart.tsx:138`                                                              |

추가 MEDIUM 위험은 같은 배열 재적용의 history/animation 잡음(m2), columns 적용 후 colorBy 변경 도달(m3)이다. 상세 §2.2/§2.3과 G0에서 검증한다. R3에는 순서 변경의 stack/dodge 기하 영향(m4)도 포함한다.

HIGH 위험은 단계 분리만으로 줄었다고 판단하지 않는다. 매핑·identity·표시는 하나의 데이터 계약이므로 본 ADR에 묶고, 축/상호작용의 독립 후속을 분리했다. 예상 파일 수 증가 자체는 새 ADR 분리의 근거가 아니다.

## Gates

| Gate | 시점 | 통과 조건                                                                                                                                         | 실패 시 대안                                   |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| G0   | P0   | pinned Recharts wide4종 spike, 저장/투영/token·배열 동일성·disabled Select·Color By 경계 검증, 현행 expand raw 라벨 오라클, h1/m1/m4/m5 수정 정합 | 계약 보정 후 리뷰, 구현 확대 보류              |
| G1   | P1   | R2/R3/R4의 손계산·모드·기본값·format·구버전 probe                                                                                                 | data 계약 수리, 원본 변환 우회 금지            |
| G2   | P2   | R1 실제 Properties→semantic write→ref/history→reload, legacy6종 보존                                                                              | UI 단계 미종결                                 |
| G3   | P3   | R4/R6 실제 Canvas/Preview/Publish 값·색·기하·문자열/접근성 정합                                                                                   | 불일치 fixture를 고정하고 수리                 |
| G4   | P4   | G4-engineering: R5 성능/순증/network PASS. G4-policy: 전체 기본 예산 충족 또는 초과 시 사용자 예외 재승인. 두 판정 별도 기록                      | 최적화 또는 명시적 예산 재승인; 자동 PASS 금지 |
| G5   | P5   | 회귀·preflight·live·호환 제한·문서 정합, 열린 필수 조건 0                                                                                         | Proposed/Accepted 상태에 맞게 미완료 기록      |

## 실행 기록

- 2026-09-10 P0: pinned Recharts 3.10.1 wide(columns) spike Chromium **10/10 PASS** (Bar dodged/horizontal/stacked/expand · Line · Area/expand · Radar, max Δ 0.94px — 기존 `computeChartScene` grid 모델과 일치, 새 기하 없음) · 현행 expand raw 값 라벨 오라클 **6/6 PASS** (h1 first nail) · catalog/semantic/ref/token/배열 동일성/disabled Select/Color By 결선 inventory 완료 (새 CSS·generator·공통 kind 변경 0 으로 가능) · before 기준선 `baf535258` + lock hash 고정 · shadcn 대표 예제 4건 revision/screenshot 고정. 테스트: `packages/shared/src/components/chart/rechartsWideSpike.browser.test.tsx`, `packages/specs/src/chart/__tests__/adr210ExpandLabelOracle.test.ts`. 근거 [P0 evidence](evidence/210-p0-wide-spike-and-wiring-inventory.md) (로컬). 제품 코드 변경 0. **G0 PASS — P1 착수 가능.** 성능·live·구버전 probe 는 미실행 (P1/P4).
- 2026-09-10 P1: `packages/specs/src/chart/presentation.ts` (validator·identity·팔레트 토큰·`formatChartNumber` raw/normalizedPercent) + `buildSeriesGrid` columns 분기·`seriesConfig` 순서/이름/색 + `computeChartScene`·`resolveChartData` 가 같은 정규화 결과를 소비 (축 `tickText`·값 `formatValue`·도넛 합계) + 설정 오류 scene (`CHART_INVALID_SETTINGS_TEXT`, `scene.diagnostics`). 순수 모듈 (Recharts import 0), `CHART_DEFAULT_PROPS` 무변경, 기존 스냅샷 4건 무변경. 테스트 `adr210Presentation.test.ts` (20) · `adr210ColumnsModel.test.ts` (26) — T01–T05/T08 PASS; specs chart 274/274 · chart 브라우저 180/180 · type-check PASS. **T12 구버전 probe** 별도 worktree `305e4c4f7` (원래 lockfile): 기존 export 3종 scene byte 동일 · 새 columns export 는 구버전에서 빈 차트 또는 legacy metric 단일 시리즈 (R2 실측, 데이터 손실 0 — 무손실 rollback 미지원 명시). `/review` 1회 HIGH 0 (MEDIUM 1·LOW 1 수리, LOW 2 P3 이관). 근거 [P1 evidence](evidence/210-p1-model-format-diagnostics.md) (로컬). **G1 PASS — P2 착수 가능.**
- 2026-09-10 P2: catalog `Chart.binding.ts` accepts 8키 (`editorHidden`, `propPassthrough`) + `metric`/`color`/`colorBy` `visibleWhen` · Chart 전용 컨트롤 `ChartDataMappingControls`/`ChartSeriesControls`/`ChartNumberFormatControls` + `chartPresentationPatch` (배열 의미 비교, write 0) · `PropertySelect.disabledKeys` · `Chart.tsx`/`RechartsChart.tsx`/`skiaPrimitives` 8키 전달 · 프리셋 `VisualPatch` Omit · i18n 39키. 테스트 `ChartPresentationControls.test.tsx` (15) · `adr210ChartPresentationStore.test.ts` (9) · `chartPresentationProjection.test.ts` (3) — T06/T07/T09 PASS, l4 descendant 반증 실패 (가설 유지 → 종결). builder unit 714 files/5,685 · type-check PASS. **Live 6/6** (`apps/builder/scripts/adr210-chart-p2-live.mjs`): 패널 mount → 값 컬럼 Apply 단일 patch (Skia purple 7,262 → 0) → Undo 1회 → 통화 묶음 → reload 보존. `/review` 1회 HIGH 1·MEDIUM 3·LOW 2 수리, LOW 1 deferred. 근거 [P2 evidence](evidence/210-p2-properties-semantic-write.md) (로컬). **G2 PASS — P3 착수 가능.** Preview 문자열 결선 (축 눈금·툴팁 이름) · 접근성 · publish · 성능은 P3/P4.
- 2026-09-10 P3: DOM(Recharts) leg 가 P1 정규화 결과를 실제 소비 — `RechartsChart` 축 `tickText` · tooltip/합계 `formatValue` · 시리즈 `name`/tooltip `seriesLabel` · `presentation.ok=false` → `role=status` `CHART_INVALID_SETTINGS_TEXT` + `data-chart-diagnostics` (데이터 보존) · `resolveChartLayout` `presentation` 필수 인자 (P1 LOW 2 종결). Skia 변경 0 (scene 소비). 테스트 `adr210Presentation.browser.test.tsx` (32, Chromium + dark/reduced-motion 대조군) — T10 (4종 wide × stack × 크기 × 긴 한글/KRW, 문자열·좌표 ≤1px·색, light/dark 실제 CSS ↔ Skia 토큰, padding) · T11 (`lang` ≠ `valueLocale`: `$`/`US$`, 키보드 tooltip 표시 이름+raw 형식, frozen props write 0) · T08 DOM · legacy 6종 문자열 보존 PASS; 원복 RED 24/32. chart Chromium 212/212 · specs 274 · shared 1,174 · type-check PASS. **Live 7/7** (`apps/builder/scripts/adr210-chart-p3-live.mjs`): 실제 패널 (값 컬럼 → 표시 이름 → `--chart-series-5` → USD) → Skia 주색 변화 → Themes dark 스위치 → Compare Mode Preview 문자열/fill = Skia (light `[206,38,116]`·dark `[206,6,59]`) → hover/키보드 tooltip write 0 → 메뉴 Export → 독립 publish 3001 같은 문자열·fill. `/review` 1회 HIGH 0 (LOW 2 수리 · LOW 1 deferred: warning 진단은 Canvas scene 전용, DOM 은 error 만 — 시각 동일). 근거 [P3 evidence](evidence/210-p3-consumers-preview-publish.md) (로컬). **G3 PASS — P4 착수 가능.** 성능 T13 (W800, before `baf535258` 별도 worktree) · 예산 재판정은 P4.

## Consequences

### Positive

원본 테이블을 변형하지 않고 여러 수치 컬럼을 비교할 수 있다. 이름·색·숫자 형식의 의미를 후속 tooltip/legend 확장의 공통 입력으로 재사용한다.

### Negative

새 설정은 구 버전이 동일하게 렌더하지 못한다. ref의 시리즈 배열 override는 전체 목록을 고정하며 origin의 이후 목록 추가가 자동 합쳐지지 않는다. 날짜·혼합 단위·Pie/Radial wide는 지원 범위 밖이며 성능은 행 수뿐 아니라 시리즈 수에도 좌우된다.
