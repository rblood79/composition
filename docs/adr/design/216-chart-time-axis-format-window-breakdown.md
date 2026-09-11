# ADR-216 상세 설계 — Chart 확장: 시간축 · 지시자 형식 · 가변 창

2026-09-12 · **Proposed — round 1 (codex) 반영.** [상위 ADR](../216-chart-time-axis-format-window.md) · 이론 원천 [CHART_TIME_AXIS_BRUSH_PATTERNS_2026-09](../../explanation/research/CHART_TIME_AXIS_BRUSH_PATTERNS_2026-09.md). 아래 함수/필드/파일명은 제안이며 현행 구현으로 인용하지 않는다. 현행 코드 사실은 상위 ADR §Context 표가 정본이다.

## 1. 범위 · 선행 관계 (분리 4질문 lock-in)

- **범위**: (a) line/area 의 x 축을 시간 스케일로 그리는 opt-in (`dimensionScale: "time"`) — 값 간격 = 시간 간격, 눈금 = 달력 경계, 결측 = 빈 자리. (b) 시간 지시자 (d3-time-format 부분집합) 로 축 라벨 형식과 **입력 파싱** (`dimensionFormat`) — Skia · DOM 이 같은 문자열. (c) ADR-211 창 트랙을 `[start, end]` 두 thumb 로 넓힌다 — 창 최소 = `min(fitEff, n)`, 창을 넓히면 그 창 안에서 극값 재추출. 두 leg 는 같은 모델을 소비한다.
- **범위 밖**: bar 의 시간축 (Recharts · RSC 둘 다 bar 는 band — 시간축 opt-in 은 line/area 만 받고 bar 는 validator 가 거부), zoom (휠/핀치 — D2 근거 없음, 가변 창이 같은 요구를 대체), 미니 차트 (Recharts `Brush` 장식 — Skia 대칭 비용), ReferenceLine · Scatter (후속 ADR, 사용자 범위 선택 2026-09-12), 로컬 시간대 (UTC 단일), 실시간 스트리밍.
- **분리 4질문** (adr-writing.md §Fork): (1) base/응용 — ADR-194 (기하 SSOT) · ADR-211 (표시 예산 · 창) 이 base, 본 ADR 은 그 위에 **연속 x 스케일 + 창 길이 가변** 을 얹는 응용. 211 의 "창 길이 불변" 결정을 **개정**하되 211 본문은 건드리지 않고 본 ADR 이 대체 지점을 명시한다 (§2.4). 역방향 의존 없음. (2) schema — 새 저장 props 는 `dimensionScale` · `dimensionFormat` · `dimensionLabelFormat` 3개 (선택적, 미설정 = 현행) 뿐. ADR-210 `seriesConfig` · 211 `budget*` 을 specialization 하지 않는다 (직교). 창 `[start, end]` 는 저장하지 않는 뷰 상태 (211 과 같은 규약). (3) 선행 전제 reverse — 211 의 `resolveAxisKind` "ordinal" 은 **예산 판정용**이고 간격을 바꾸지 않는다 (`budget.ts:271`) — 본 ADR 은 그 판정을 시간 스케일의 **자동 감지 힌트로만** 쓰고 간격 변경은 opt-in prop 이 연다 (기존 문서 byte 동일). 211 의 "Recharts Brush 채택 않음" 은 유지 (우리 트랙을 넓힌다). (4) 3차 리뷰까지 미루지 않음 — round 1 에 낸다. **사용자 confirm**: 2026-09-12 AskUserQuestion 으로 범위 (시간축 + 형식/파싱 + 가변 창, ReferenceLine·Scatter 는 후속) 와 제목을 사용자가 선택.

## 2. 계약

### 2.1 시간 스케일 (line · area)

- 입력: `dimension` 열의 문자열을 `dimensionFormat` (지시자, 기본 = 엄격 ISO `parseIsoStrict` 경로) 로 epoch ms (UTC) 로 파싱. **파싱 실패 행은 제외한다** (x 가 없으므로 자리도 없다 — `series.ts:128-134` 의 범주 push 전에 걸러 categories 에 들어가지 않는다) + 진단 `dimension.parse.failed` (건수) 를 `scene.diagnostics` 에 싣는다 (ADR-210 `presentation` 경로). 이것은 **x 결측** 정책이고, 기존 y 결측 (`values.get(ci) === undefined`, `budget.ts:445-449` gap sentinel · `connectNulls:false`) 규약과 다르다 — y 결측은 그대로 (round 1 m5). 달력 넘침 (`2026-02-30`) 도 실패 행 (HC7).
- **시간 위치 보존 (HC8, round 1 h1)**: `SeriesGrid` 에 `positions?: readonly number[]` (transformed 점 index → epoch) 를 라벨과 **분리** 해 싣는다. 창 · 극값 (`pickCategories`) = 원본 epoch 그대로. 집계 (`aggregateBuckets` `budget.ts:376-399`, 극값 fallback `:735-741` 포함) = bucket 마다 `[t0, t1]` (bucket 안 첫·끝 유효 epoch) 를 `positionRanges` 로, 마크 x = `t0`, 라벨은 현행 `bucketLabel` (`첫 ~ 끝`) 유지. domain = transformed `positions` 의 `[min, max]` (집계는 `t1` 까지) 를 `niceTime` 으로. Recharts 에는 `position` 열이 이미 있다 (`RechartsChart.tsx:621` `dataKey="position"`) — 값만 epoch 로 바뀐다.
- 같은 epoch 행은 현행처럼 합산 (`series.ts` 합산 규약 유지).
- 스케일: `linearScale(epochMin, epochMax)` — 새 스케일 종류 없음. domain 은 `niceTime` (interval.floor/ceil) 로 넓힌다 (값 축 `niceTicks` 와 같은 자리). **손계산 oracle (G2)**: 양 끝 timestamp 를 아는 fixture (예: 2026-01-01 ~ 2026-01-10 일별 10 행, 결측 1) 에 window · extrema · aggregate (fitEff 2) 를 각각 적용해 `positions` 와 마크 x 를 손으로 계산한 표와 대조 — 두 leg 가 같은 값에 동의하는 것은 oracle 이 아니다.
- 눈금: `timeTicks(start, stop, count)` — 18 단 표 + 비율 bisect + 연 단위 1·2·5 재귀 (원천 §1.2). `count` 는 현행 축 눈금 수 규약 (`computeChartScene` 의 값 축 count 와 같은 파생 — px ÷ 최소 라벨 폭).
- 라벨: RSC 2단 표 (secondary 눈금마다 · primary 경계마다, 원천 §2.3 표) 를 `granularity` (눈금 표에서 고른 단위) 로 고른다. `dimensionLabelFormat` 이 있으면 단일 지시자로 대체 (2단 없음).
- bar 는 받지 않는다 — `dimensionScale:"time"` + bar 는 validator 거부 → `presentation.ok=false` + `CHART_INVALID_SETTINGS_TEXT` (ADR-210 경로 재사용). pie/radar/radial 도 동일.

### 2.2 지시자 형식 · 파싱 (`specs/chart/timeFormat.ts`)

- 채택 지시자: `%Y %y %m %d %e %H %I %M %S %L %p %a %A %b %B %j %q %Z %%` + 패딩 수정자 `- _ 0`. parse 는 여기에 `%Q %s` (epoch ms / s). 기각: `%U %W %V %g %G %u %w %f %c %x %X`.
- 로케일 객체 (`periods/days/shortDays/months/shortMonths`) — `en-US` 기본 + `ko-KR`. 축 라벨 로케일은 ADR-210 `valueLocale` 을 **재사용** (새 prop 없음).
- UTC 벌만 (`utcFormat`/`utcParse` 경로). `%y` 두 자리 연도는 d3 `parseYear` 그대로 **`> 68 → 1900대, ≤ 68 → 2000대`** (`68` → 2068, round 1 m3 실측 `utcParse('%y')('68') = 2068-01-01`), 0~99년 `setUTCFullYear` 보정.
- parse 는 전체 일치 강제 (남는 문자 → `null`). 숫자 지시자는 d3 와 같은 **폭 제한** — `%Y` 4 · `%y %m %d %e %H %I %M %S` 2 · `%L %j` 3 · `%q` 1 (`locale.js` `parseFullYear/parseMonthNumber` 의 slice) — 그래서 `%Y%m%d` 가 `20260305` 를 받는다. **달력 검사는 d3 와 다르다**: d3 는 `2026-02-30` 을 `03-02` 로 정규화하지만 우리는 ISO 경로 (`parseIsoStrict` 의 되돌려 검사) 와 같이 **거부** (HC7).
- 오라클: `d3-time-format` · `d3-time` 을 **devDependency** 로 두고 테스트에서만 대조 (round 1 m3 로 정의 정정). (a) **format**: 채택 지시자 × 유효 날짜 100 케이스에서 d3 `utcFormat` 과 문자열 동일. (b) **parse**: 정규형 문자열 (d3 `utcFormat` 출력) 을 `utcParse` 로 되돌린 결과와 우리 parse 가 epoch 동일 — 단 **지시자가 보존하는 성분만** 대조 (`%Y` 만 쓰면 월/일/시각은 1월 1일 0시로 소실되는 것이 정답이라 "항등" 이 아니다), 달력 넘침 입력은 오라클 밖 (우리 = 거부, d3 = 정규화, 의도된 차이 §2.2). (c) **눈금**: span 12 종 (1분 · 1시간 · 1일 · 1주 · 1달 · 1분기 · 1년 · 3년 · 10년 · 50년 · 1초 · 1ms) × count 3 종 에서 d3 `utcTicks` 와 배열 동일. 번들 영향 0 (정적 가드: `specs/src/chart` 런타임 import 에 `d3-` 0).

### 2.3 창 `[start, end]` (211 §2.5 개정 지점)

- 상태: `{ start, end }` (transformed index, 뷰 상태, canonical write 0). 불변식 `0 ≤ start < end ≤ n`, **`end − start ≥ min(fitEff, n)`** (최소 창, round 1 m4 — `n < fitEff` 면 창 = `[0, n]` 이고 211 처럼 트랙이 없다 `layout.ts:172`; resize 로 fitEff 가 `end − start` 를 넘으면 `end += Δ` 를 n 에서 clamp 하고 부족분은 `start −= `). 초기값 `[0, min(fitEff, n)]` (211 의 `start = 0` · `end = min(n, start + fitEff)` `budget.ts:656-660` 과 같은 화면).
- 컨트롤: shared RAC `Slider` **두 thumb** (`value: [start, end]`, `minValue 0 · maxValue n · step 1`, thumb 교차는 RAC 가 막는다). 본체 (트랙 사이) 드래그 = 창 이동 (d3 `MODE_DRAG` — `dx` 를 `[−start, n − end]` 로 clamp 해 길이 보존). 손잡이 = d3 `MODE_HANDLE`. `Slider.tsx` 파일 변경 0 이 목표 — thumb 2 는 RAC 가 이미 지원 (P0 에서 실측).
- 창이 fitEff 보다 넓으면: visible = transformed `[start, end)` 를 **극값 선택 (211 `extrema`)** 으로 fitEff 슬롯에 맞춘다 — 211 §2.4 의 적응 B 그대로, 입력이 `[start, end)` 구간일 뿐. bar (창 모드) 는 극값이 없으므로 `aggregate` (bucket 집계) 로 — 211 지원표의 같은 칸.
- 시간 스케일에서는 창 index 가 **transformed 점의 index** 이고 화면 x 는 그 점의 epoch — 창 경계가 시간 경계와 어긋나는 것은 허용 (시간 단위 창은 범위 밖).
- reset/clamp: 211 §2.5 규약 그대로 (`rowsKey` · 종류 · `dataMode` · overflow 변경 → `[0, min(fitEff, n)]`, `size` 변경 → clamp, 최소 창 위반 → `end = start + min(fitEff, n)` 을 n 에서 clamp 하고 부족분은 `start` 축소).
- Canvas: 항상 `[0, min(fitEff, n)]` 을 정적으로 그린다 (211 과 같음) — 트랙 마크는 `buildWindowTrackMarks` (`marks/windowTrack.ts:34-51`) 의 thumb 1 → **thumb 2** (`track.x` 와 `track.x + track.w`) 로 바뀐다. **이 마크 변경은 시간축 opt-in 과 무관하게 창이 있는 모든 기존 차트에 적용된다** (round 1 h2 — HC1 예외로 상위 ADR 에 명시, `adr211Window.test.ts` 기대값 갱신 + CHANGELOG). 데이터 기하 (마크·축·격자·범례·domain·visible) 는 byte 동일. **parity 캡처 규약**: Preview 를 초기 창에서만 대조하고 창 이동 뒤에는 DOM 만 본다 (메모리 `feedback-parity-judgment-same-state-capture`).

### 2.4 ADR-211 개정 목록 (본 ADR 이 대체)

| 211 결정                                | 본 ADR                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 창 길이 불변 · thumb 1 (`§2.5`)         | `[start, end]` · thumb 2 (기존 창 차트 포함, HC1 예외) · 최소 창 = `min(fitEff, n)` · 넓히면 극값 재추출 |
| `resolveAxisKind` ordinal = 예산 판정만 | + 시간 스케일 자동 감지 **힌트** (패널 안내 "시간축으로 볼 수 있습니다" — 자동 전환 아님)                |
| Soft constraint "Brush 채택 않음"       | 유지                                                                                                     |

### 2.5 props 결선 inventory (ADR-210/211 선례 — 선언만으로 화면에 닿지 않는다)

`dimensionScale` · `dimensionFormat` · `dimensionLabelFormat` 3 키: binding `accepts` (`Chart.binding.ts`) · `propPassthrough` · `toRacProps` · `Chart.tsx` 스칼라 memo · Skia allowlist (`pickChartPresentationProps`) · `presentation.ts` validator · `ChartPresentationControls` (패널 — Series 원천 절 옆) · i18n ko/en (`chart.*`) · `chartVisibleWhen` 오라클 (line/area 조건). 창 `[start, end]` 는 결선 0 (뷰 상태).

## 3. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                     | Gate |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 0     | inventory freeze — (a) 현행 x 배치 경로 표 (`computeChartScene.ts:451` bandScale · `series.ts` 합산 · `layout.ts:171` 트랙) (b) RAC Slider thumb 2 실측 (uncontrolled 키 trace, 211 P0 방식) (c) 번들 baseline (clean worktree · 원래 lockfile · `adr209-bundle-closure.mjs`) (d) 기존 스냅샷 4 · T10 32 · 211 오라클 18 목록 (byte 동일 대상)                                                                           | G0   |
| 1     | `timeIntervals.ts` (UTC 7종) · `timeTicks.ts` · `niceTime` · `timeFormat.ts` (format/parse/locale) — 순수 모듈, Recharts import 0, devDependency 오라클                                                                                                                                                                                                                                                                  | G1   |
| 2     | 시간 스케일 모델 — `resolveChartModel` 에 `dimensionScale:"time"` 분기 (파싱 → epoch → 합산 → domain/눈금/2단 라벨), validator (line/area 만), 진단 `dimension.parse.failed`; scene 이 x 를 epoch 위 `linearScale` 로 낸다                                                                                                                                                                                               | G2   |
| 3     | 두 leg 소비 — Skia (`skiaPrimitives.ts chartScene` 축 라벨 2단 텍스트 마크) · DOM (`RechartsChart.tsx` XAxis `type="number"` domain 명시 + 우리 ticks, 2단 라벨은 `svgDecorations`) · parity (같은 크기 두 leg 눈금·라벨 byte 동일)                                                                                                                                                                                      | G3   |
| 4     | props 결선 inventory (§2.5) + 패널 (Series 원천 옆 "시간축" 토글 · 형식 입력 · ordinal 힌트) + i18n                                                                                                                                                                                                                                                                                                                      | G3   |
| 5     | 가변 창 — `windowTrack.tsx` thumb 2 · `budget.ts` `clampWindowRange` · 극값 재추출 입력 구간화 · Canvas 초기 창 · reset/clamp                                                                                                                                                                                                                                                                                            | G4   |
| 6     | 성능·번들 — Builder initial 순증 실측 (한도는 상위 ADR G5) · 창 드래그 프레임 A/B (round 1 m6: fixture = 211 perf 합성 20,000 행 규모 전용 + 사람 시계열 ~2,000 행 · 불리 = 이동+확대 · cold/warm · 대조군 = 창 고정 arm · 전체 프레임 p95 rAF · headed DPR 2 foreground throttle 1 · 3 회 × 60 스텝) · release 정책이면 릴리즈 지연 ≤ 100 ms 재측정 · Preview/publish live 하니스 (`adr216-chart-time-window-live.mjs`) | G5   |
| 7     | closure — evidence · README · CHANGELOG · `### Live Exercise` · T12 구버전 probe (worktree, 원래 lockfile): 새 props 문서를 구버전이 열면 band 로 그리고 데이터 손실 0                                                                                                                                                                                                                                                   | —    |

## 4. 파일 (예상 · Phase 0 에서 재확정)

| 파일                                                                                                              | 변경                                                                        |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/specs/src/chart/timeIntervals.ts` (신규)                                                                | UTC interval 7종 `floor/offset/field` + `every/range/ceil`                  |
| `packages/specs/src/chart/timeTicks.ts` (신규)                                                                    | 18 단 표 · `tickInterval` · `timeTicks` · `niceTime`                        |
| `packages/specs/src/chart/timeFormat.ts` (신규)                                                                   | 지시자 format/parse · en/ko 로케일 · RSC 2단 표                             |
| `packages/specs/src/chart/marks/windowTrack.ts` · `__tests__/adr211Window.test.ts`                                | 트랙 thumb 2 (`track.x` · `track.x + track.w`) · 211 기대값 갱신 (HC1 예외) |
| `packages/specs/src/chart/model.ts` · `budget.ts` · `scales.ts`                                                   | 시간 분기 · `clampWindowRange` · 극값 입력 구간화                           |
| `packages/specs/src/chart/presentation.ts` · `types.ts`                                                           | 3 props · validator · 진단 키                                               |
| `packages/specs/src/renderers/skiaPrimitives.ts`                                                                  | 2단 축 라벨 · allowlist                                                     |
| `packages/shared/src/components/chart/RechartsChart.tsx` · `svgDecorations.tsx` · `windowTrack.tsx` · `Chart.tsx` | XAxis number/time · 2단 라벨 · thumb 2                                      |
| `packages/shared/src/catalog/bindings/Chart.binding.ts`                                                           | accepts 3 · passthrough                                                     |
| `apps/builder/src/builder/panels/properties/ChartPresentationControls.tsx` · i18n                                 | 패널 · ko/en                                                                |
| `packages/specs/package.json`                                                                                     | devDependency `d3-time` · `d3-time-format` (테스트만)                       |

## 5. 체크리스트

- [x] P0 inventory freeze (2026-09-12, `216-p0-inventory.md` 로컬) (evidence `216-p0-inventory.md`, 로컬) — 번들 baseline · Slider thumb 2 실측 · byte 동일 대상 목록 (스냅샷 4 · T10 32 에 창 트랙 마크 포함 여부를 나눠 기록)
- [x] P1 순수 모듈 + 오라클 (2026-09-12 — `adr216TimeOracle.test.ts` 76: 눈금 12×3 + 임의 60 · format 15 지시자 × 100 · parse 15 × 100 + 경계 15 · HC7 거부 · 정적 가드; d3 `unixDay` 로 일 눈금 정정) (d3 대조 눈금 12 span × 3 count · format 100 · parse 성분 대조 · 달력 넘침 거부)
- [x] P2 모델 분기 + `positions` 보존 + 손계산 oracle 3 fixture + validator + 진단 (파싱 실패 제외) (2026-09-12 — `adr216TimeScale.test.ts` 18: window·extrema·aggregate 손계산 x · 두 leg axes JSON 동일 · bar/pie 거부 · 파싱 실패 3 진단 · HC1 byte 동일; 손계산 정정 1: extrema 는 domain 끝이 transformed max (Jan 9))
- [x] P3 두 leg 소비 + parity byte 동일 (2026-09-12 — Skia allowlist 3 키 · DOM `RechartsChart` position=epoch + `resolveCategoryBand` 공용 + `Chart.tsx` 결선; `adr216TimeScale.browser.test.tsx` 3 (Recharts 꼭짓점 x = scene ±0.5 · 2단 라벨 byte 동일 · category 무변경) · `chartParity.test.tsx` +2 (Skia path d = DOM d))
- [x] P4 props 결선 9 지점 + 패널 + i18n (2026-09-12 — accepts 3 · propPassthrough · toRacProps 투영 테스트 · Chart.tsx · Skia allowlist · validator · `ChartTimeAxisControls.tsx` (신규, dimension 매핑 아래 — ADR 의 `ChartPresentationControls.tsx` 는 실재하지 않는 파일명, 정정) + PropertiesPanel 1 지점 · i18n ko/en 10 키 + labels 맵 · 패널 테스트 2)
- [ ] P5 가변 창 + 최소 창 `min(fitEff, n)` 불변식 (n < fitEff · resize) + 극값 재추출 + 트랙 thumb 2 (211 기대값 갱신)
- [ ] P6 번들·프레임 실측 + live 하니스
- [ ] P7 closure (evidence · README · CHANGELOG · Live Exercise · T12)
