# ADR-216: Chart 확장 — 시간축 · 지시자 형식 · 가변 창

## Status

Accepted — 2026-09-12 (Proposed 2026-09-12 → Accepted 2026-09-12: reviews/216.md round 2 승인 가능 · `pending` 0 → `/execute-adr 216` 착수, 사용자 지시 "종료까지"). **round 1 (codex, HIGH 2 · MEDIUM 4 · LOW 1) 반영 2026-09-12** — h1 집계 epoch 보존 (HC8 · R1 · G2) · h2 HC1 범위를 데이터 기하로 한정하고 창 트랙 변경을 명시 · m3 `%y`/폭/달력 정책 정정 · m4 최소 창 = `min(fitEff, n)` · m5 파싱 실패 행 제외 정책 · m6 G5 측정 조건 5-질문 · l7 정렬 서술 정정 ([reviews/216.md](reviews/216.md)). 사용자가 범위 (시간축 + 지시자 형식/파싱 + 가변 창; ReferenceLine · Scatter 는 후속, zoom 제외) 와 제목을 AskUserQuestion 으로 선택 (분리 4질문 lock-in: [breakdown §1](design/216-chart-time-axis-format-window-breakdown.md#1-범위--선행-관계-분리-4질문-lock-in)). 이론 원천: [CHART_TIME_AXIS_BRUSH_PATTERNS_2026-09](../explanation/research/CHART_TIME_AXIS_BRUSH_PATTERNS_2026-09.md) (d3-time · d3-scale · d3-array · d3-brush · d3-time-format 소스 + RSC `vega-spec-builder`).

## Context

차트의 x 축은 항상 **범주 등간격**이다 — 날짜 문자열도 문자열 범주로 취급되어 `2026-01-10` 과 `2026-1-9` 가 별개 범주가 되고 (순서는 **첫 출현 순** — `series.ts:125-134`, 시간 순 정렬 없음), 빠진 날은 자리가 없으며, 눈금은 범주 라벨 그대로다. 대시보드 데이터의 가장 흔한 형태 (시계열) 에서 간격·정렬·눈금이 전부 틀린다. ADR-211 의 창 (window) 은 넘치는 범주를 고정 길이 창으로 넘기지만 사용자가 구간을 넓히거나 좁힐 수 없다.

**SSOT 3-domain 위치**: D1 = 창 컨트롤은 shared RAC `Slider` (thumb 2 는 RAC 지원) — ARIA 작성 0 · D2 = **RSC 참조** (`ScaleType = 'linear' | 'point' | 'time' | 'band'` — line/area `scaleType: "time"`, Axis `granularity` + d3-time-format 지시자 라벨 표 `vega-spec-builder/src/axis/axisLabelUtils.ts:51-65`) — 시간축·형식은 D2 근거 있음. 가변 창은 RSC 에 없으나 **새 prop 이 아니라 211 뷰 상태의 확장** (저장 0) 이라 D2 위반 아님. zoom 은 D2 근거 없음 → 범위 밖 · D3 = catalog `COMPONENT_RULES_TABLE.Chart` 채널 무변경 (색·크기 채널 추가 0). 경계 교차 없음. **Generator 확장 없음** — 새 CSS var 없음 (창 트랙·축 라벨은 기존 `--chart-axis` · `--chart-grid`).

**현행 코드 사실** (Phase 0 에서 재확정):

| 경로                                                             | 사실                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/chart/computeChartScene.ts:451,455`          | x = `bandScale`, y = `linearScale` — 스케일 종류 2개뿐                                                            |
| `packages/specs/src/chart/scales.ts` `tickIncrement/niceTicks`   | d3-array 1·2·5 규칙 이식 (이론만 가져온 선례)                                                                     |
| `packages/specs/src/chart/budget.ts:236,271`                     | `parseIsoStrict` (UTC) · `resolveAxisKind` ordinal — **예산 판정용, 간격 무변경**                                 |
| `packages/specs/src/chart/budget.ts:624` · `layout.ts:171`       | `clampWindowStart` (thumb 1, 창 길이 = fitEff 불변) · 트랙 자리 예약 24px                                         |
| `packages/shared/src/components/chart/windowTrack.tsx`           | RAC `Slider` thumb 1, initial 번들 (lazy 청크가 Slider 를 직접 import 하면 청크 분리 +2.5 KiB — ADR-211 P4)       |
| `packages/shared/src/components/chart/RechartsChart.tsx:618-631` | XAxis/YAxis `hide` + `domain` 명시 + `allowDataOverflow` — 눈금·domain 은 scene 이 정하고 Recharts 는 그리기만    |
| `packages/specs/src/renderers/skiaPrimitives.ts:1676`            | Skia 는 이미 `Intl.DateTimeFormat` 을 다른 곳 (달력) 에 쓴다 — 차트 축에는 쓰지 않는다 (ICU 의존 문제, 원천 §2.3) |

**Hard Constraints**:

1. **기존 문서의 데이터 기하 byte 동일**: `dimensionScale` 미설정 문서는 **데이터 마크 · 축 · 격자 · 범례 · domain · visible 모델** 이 scene byte 동일 — 스냅샷 4 · ADR-210 T10 32 · ADR-211 오라클 18 회귀 0. 자동 시간축 전환 금지 (opt-in 만). **예외 1개 (의도된 사용자-가시 변경)**: 창 모드 & `n > fitEff` 문서의 **창 트랙 마크** 는 thumb 1 → 2 (`marks/windowTrack.ts:34-51` 의 thumb 하나가 `[0, fitEff]` 두 개로) — 시간축과 무관하게 창이 있는 모든 차트에 적용되고, 211 `adr211Window.test.ts` 의 트랙 기대값 갱신 + CHANGELOG 로 기록한다. 스냅샷 4 · T10 32 에 트랙 마크가 포함되는지는 G0 에서 실측해 목록을 나눈다.
2. **두 leg 동일**: 같은 크기 두 leg 에서 눈금 위치 · 라벨 문자열 · 창 초기 상태가 byte 동일. 축 라벨은 **ICU 비의존** (지시자 이식) — publish 열람 브라우저가 달라도 같은 문자열.
3. **외부 의존 0**: `packages/specs/src/chart` 런타임 import 에 d3 계열 0 (ADR-194). d3 는 devDependency 오라클로만 (번들 0).
4. **최소 창 = `min(fitEff, n)`**: 창 `[start, end]` 는 `0 ≤ start < end ≤ n` · `end − start ≥ min(fitEff, n)` — `n ≤ fitEff` 면 창 = `[0, n]` 이고 트랙이 없다 (211 그대로, `budget.ts:656-660` 의 `end = min(n, start + fitEff)` 와 정합). resize 로 fitEff 가 커지면 `end` 를 늘리고 부족하면 `start` 를 줄인다. ADR-211 예산 (마크 ≤ M · 점 ≤ P) 은 창 크기와 무관하게 유지 — 넓힌 창은 극값 재추출.
5. **번들**: Builder initial 순증 ≤ 7 KiB gzip (ADR-211 과 같은 한도, 신규 모듈은 Skia 가 읽어 initial), Preview initial 순증 ≤ 3 KiB. 절대 상한은 ADR-215 승인값 (Builder 1,313,600 / Preview 643,758, 만료 2026-10-10) — **현재 ADR-212 P1 이 +3,149 초과 상태**라 본 ADR G5 는 순증 한도로 판정하고 절대 상한은 사용자 재승인 항목.
6. **성능**: 창 드래그 중 모델 재계산 (극값 재추출) p95 ≤ 20 ms **및** Preview 전체 프레임 p95 가 창 고정 대조군 대비 +4 ms 이내 — 측정 조건은 G5 에 5-질문 (measurement-validity §1) 으로 명시. 초과 시 release 정책 (드래그 중 트랙만 갱신, 릴리즈 ≤ 100 ms 안에 재추출, 그동안 표시 데이터 = 이전 창) 으로 전환하되 그 경우 **릴리즈 지연 ≤ 100 ms** 가 대체 기준이다.
7. **UTC 단일 · 달력 엄격**: 파싱·눈금·라벨 전부 UTC. 로컬 시간대 없음. 사용자 형식 파싱도 ISO 경로와 같이 **달력 넘침을 거부** (`2026-02-30` → 실패 행) — d3 의 정규화 (`03-02`) 를 따르지 않는다 (의도된 차이, G1 오라클은 유효 날짜 한정).
8. **집계 후 시간 좌표 보존**: 시간 스케일의 transformed 점은 라벨과 **분리된 epoch 위치** 를 갖는다 — 창·극값은 원본 epoch, 집계 bucket 은 `[첫 유효 epoch, 끝 유효 epoch]` 범위 + 대표 x = 첫 유효 epoch. 두 leg 일치가 아니라 **손계산 기대 x** 가 G2 의 oracle 이다.

**Soft Constraints**: Recharts 3.10.1 고정 (`Brush` 미채택 유지). shared `Slider.tsx` 변경 0 목표. bar 시간축은 범위 밖 (Recharts · RSC 둘 다 bar 는 band). ADR-212 (Data 패널) 진행 중이라 패널 파일 충돌 주의 — 본 ADR 패널 변경은 `ChartPresentationControls.tsx` 한 파일.

## Alternatives Considered

### 대안 A: 이론 이식 — d3 규칙을 우리 순수 모듈로, 지시자 부분집합, 창 트랙 2-thumb

- 설명: `timeIntervals/timeTicks/timeFormat` 을 `packages/specs/src/chart` 에 직접 쓴다 (원천 §1~§3 규칙, UTC 벌만, 지시자 19 + parse 2). 스케일은 `linearScale` 재사용. 창은 RAC Slider thumb 2 + 최소 창. d3 는 테스트 오라클.
- 근거: ADR-194 (d3-path 통찰만) · `scales.ts` `tickIncrement` (d3-array 이식) 선례. RSC 가 같은 지시자 어법. 엔진 CSS parity 의 differential oracle 패턴 (`project-engine-css-parity-differential-oracle`).
- 위험:
  - 기술: M — 눈금·지시자 규칙 ~350줄 직접 구현, 오라클로 상쇄
  - 성능: M — Builder initial 순증 (실측 전 미확정), 창 드래그 재계산
  - 유지보수: L — 순수 모듈, 의존 0, 오라클이 회귀 감시
  - 마이그레이션: L — opt-in 3 props, 미설정 byte 동일, 구버전은 band 로 그림 (손실 0)

### 대안 B: DOM leg 만 Recharts `scale="time"` + `Brush`, Skia 는 근사

- 설명: Recharts XAxis `type="number" scale="time"` (내장 d3-scale) 과 `Brush` 를 그대로 쓰고 Skia 는 별도 근사 눈금.
- 근거: Recharts 문서 예제 (TimeSeries · Brush).
- 위험:
  - 기술: H — 두 leg 눈금 알고리즘이 다르다 (d3 vs 우리) → 비대칭 상시. `Brush` 는 인덱스 기반·마우스 전용·미니 차트 포함 (원천 §3, ADR-211 기각 사유 유지)
  - 성능: M — `Brush` 드래그마다 전체 차트 재렌더
  - 유지보수: H — "CSS 가 기준, Skia 가 따라간다" 언어 (ssot-hierarchy §6 금지)
  - 마이그레이션: L

### 대안 C: `Intl.DateTimeFormat` 라벨 + 시간 눈금만 이식, 파싱은 ISO 한정, 창은 현행 유지

- 설명: 눈금 규칙만 이식하고 라벨은 Intl, 입력은 `parseIsoStrict` 만, 창 길이 불변 유지.
- 근거: 코드 최소. 처음 리서치 판정 (정정 전).
- 위험:
  - 기술: M — Intl 문자열이 ICU 판마다 다름 (U+202F) → publish·스냅샷 흔들림; 비-ISO 데이터 (`2026/03/05` · epoch) 파싱 불가
  - 성능: L
  - 유지보수: M — 라벨 문자열이 코드 밖 (ICU) 에서 결정
  - 마이그레이션: L
  - (사용자 요구 "brush" 미충족 — 창 길이 불변 유지)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | M    | L        | L            |     0      |
| B    | H    | M    | H        | L            |     2      |
| C    | M    | L    | M        | L            |     0      |

루프 판정: A · C 는 HIGH 0. C 는 요구 (파싱 · 가변 창) 를 충족하지 못하고 ICU 의존이 남는다. 새 대안 불요.

## Decision

**대안 A: 이론 이식 — d3 규칙을 우리 순수 모듈로, 지시자 부분집합, 창 트랙 2-thumb** 를 선택한다.

선택 근거:

1. 두 leg 가 같은 모듈을 읽어야 대칭이 정의된다 — 눈금·라벨·창을 전부 scene 이 내고 Recharts 는 그리기만 하는 현행 구조 (`RechartsChart.tsx:618-631`) 를 그대로 잇는다. 잔존 위험 (직접 구현 ~350줄) 은 d3 devDependency 오라클 (눈금 12 span × 3 count · 지시자 왕복 100) 이 상쇄.
2. D2 참조 (RSC → Vega → d3-time-format 지시자 · granularity 2단 라벨 표) 와 같은 어법이라 prop 이름·라벨 규칙을 새로 짓지 않는다.
3. 기존 문서 byte 동일 (opt-in) + 구버전 손실 0 이라 마이그레이션 위험이 없다.

기각 사유:

- **대안 B 기각**: 두 leg 눈금 알고리즘이 갈려 비대칭이 상시화되고 "Skia 가 따라간다" 언어가 된다 (ssot-hierarchy §6). `Brush` 는 ADR-211 이 이미 기각한 이유 (인덱스 기반 · 창 길이 임의 · 마우스 전용) 가 그대로다.
- **대안 C 기각**: ICU 의존 라벨은 publish 열람 브라우저·Node 스냅샷에서 문자열이 흔들리고, 비-ISO 입력을 못 받으며, 가변 창 요구를 충족하지 못한다.

> 구현 상세: [216-chart-time-axis-format-window-breakdown.md](design/216-chart-time-axis-format-window-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | ADR-211 예산 모델이 범주 index 기준 — 시간 스케일에서 창 index · 극값 bucket · fit 의 뜻이 어긋나고, **집계 (`aggregateBuckets` `budget.ts:376-399`) 는 라벨을 `첫 ~ 끝` 문자열로만 남겨 epoch identity 를 잃는다** (time + `aggregate`, 극값 fallback `budget.ts:735-741` 도 집계 호출) — 두 leg 가 같은 잘못된 x 에 동의할 수 있다 (`:209 resolveFitEff` · `:624 clampWindowStart` · `model.ts:122`) |  HIGH  | transformed 점에 라벨과 분리된 `positions` (epoch) 보존 (HC8): 창·극값 = 원본 epoch, 집계 = bucket `[t0, t1]` + 대표 x = t0. 창 index 는 transformed 점 index 로 고정 (시간 단위 창은 범위 밖). G2 oracle 은 두 leg 일치가 아니라 **손계산 기대 x** (양 끝 timestamp fixture, `overflow=aggregate`, fitEff 2) |
| R2  | 직접 이식한 눈금·지시자가 d3 와 다르게 동작 (경계: 월말 · 윤년 · `%y` 세기 · stop 포함 · 연 단위 1·2·5)                                                                                                                                                                                                                                                                                                |  HIGH  | d3-time · d3-time-format devDependency 오라클 (G1: 12 span × 3 count 눈금 배열 동일 · 지시자 왕복 100 + 문자열 동일). 런타임 import 0 은 정적 가드 (`grep d3-` in `specs/src/chart` = 0)                                                                                                                      |
| R3  | Builder initial 순증 (신규 모듈 ~350줄 + 창 상태) 이 한도를 넘거나, 절대 상한 (215) 이 이미 초과 상태 (212 P1 +3,149)                                                                                                                                                                                                                                                                                  |  HIGH  | G5 순증 한도 (Builder ≤ 7 KiB · Preview ≤ 3 KiB gzip) + 절대 상한 초과는 사용자 재승인 항목으로 분리 보고. `timeFormat` 의 parse 는 모델 단계 (specs) 에만 두어 DOM lazy 청크에 중복 0                                                                                                                        |
| R4  | 창 드래그마다 극값 재추출 (R 20,000 · S 4) 이 프레임을 먹는다                                                                                                                                                                                                                                                                                                                                          |  MED   | G5 p95 ≤ 20 ms; 초과 시 드래그 중에는 `[start, end]` 만 갱신하고 재추출은 `end` 이벤트에서 (RAC Slider `onChangeEnd`)                                                                                                                                                                                         |
| R5  | 자동 감지 힌트 (`resolveAxisKind` ordinal) 가 사용자를 자동 전환으로 오해시키거나, 힌트 자체가 기존 문서 렌더를 바꾼다                                                                                                                                                                                                                                                                                 |  MED   | 힌트는 패널 안내 문자열만 (scene 무변경) — G0 byte 동일 목록에 포함                                                                                                                                                                                                                                           |
| R6  | ADR-212 (Data 패널) 와 패널 파일 충돌                                                                                                                                                                                                                                                                                                                                                                  |  LOW   | 본 ADR 패널 변경은 `ChartPresentationControls.tsx` 한 파일 · 212 가 건드리지 않음 (실측 후 P0 표에 기록)                                                                                                                                                                                                      |

## Gates

| Gate | 시점           | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                                                                                                                                                                                      |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 종료   | inventory freeze: 현행 x 배치 경로 표 · RAC Slider thumb 2 uncontrolled 키 trace 실측 · 번들 baseline (clean worktree · 원래 lockfile) · byte 동일 대상 목록 (스냅샷 4 · T10 32 · 211 오라클 18) — evidence `216-p0-inventory.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Phase 1 열지 않음                                                                                                                                                                                 |
| G1   | Phase 1 종료   | d3 오라클: 눈금 12 span × 3 count 배열 동일 · 지시자 왕복 100 + d3 문자열 동일 · `specs/src/chart` 런타임 d3 import 0 (정적 가드)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 불일치 항목을 이식 결함으로 수리; 규칙 자체가 다르면 (예: stop 포함) 문서화 후 우리 규칙 고정                                                                                                     |
| G2   | Phase 2 종료   | `dimensionScale:"time"` line/area: (a) **손계산 oracle** — 양 끝 timestamp 를 아는 fixture 3종 (window · extrema · aggregate fitEff 2) 의 transformed `positions` 와 마크 x 가 손계산 기대값과 일치 (HC8, R1) (b) 같은 입력 두 leg visible · 눈금 · 라벨 byte 동일 (c) bar/pie 거부 진단 · 파싱 실패 행 제외 + 진단 count · 달력 넘침 거부 (d) 미설정 문서 데이터 기하 byte 동일 (HC1)                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 시간 창 index 규약 재검토 (breakdown §2.3), byte 동일 깨지면 opt-in 경계 수리                                                                                                                     |
| G3   | Phase 3~4 종료 | 두 leg 렌더 parity (같은 크기 눈금 x 좌표 ±0.5px · 2단 라벨 문자열 동일) · props 결선 9 지점 · 패널 live (Chrome MCP 또는 Playwright)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 결선 누락 지점 수리 (ADR-210 `valueFields` 선례)                                                                                                                                                  |
| G4   | Phase 5 종료   | 창 `[start, end]`: 최소 창 불변식 `min(fitEff, n)` (원복 RED, `n = 3 · fitEff = 10` 과 resize 로 fitEff 증가 케이스 포함) · 본체 드래그 길이 보존 · 넓힌 창 극값 재추출 마크 ≤ M · 점 ≤ P · Canvas 초기 창 트랙 (thumb 2) = Preview 초기 창 byte 동일 · reset/clamp 규약 · 211 `adr211Window.test.ts` 트랙 기대값 갱신 diff 가 thumb 추가뿐                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 최소 창 위반이 나오면 `end` 갱신을 강제; 재추출 초과면 211 적응 B 로 축소                                                                                                                         |
| G5   | Phase 6 종료   | 번들: Builder initial 순증 ≤ 7 KiB · Preview ≤ 3 KiB gzip (clean worktree 2개 · 원래 lockfile · `adr209-bundle-closure.mjs`) · 절대 상한 (215) 대비 보고 → 초과분은 **사용자 재승인**. 성능 (5-질문): Q1 fixture = 211 perf fixture (합성 20,000 행 × S 4 — **규모 전용**, 분포 인용 금지) + 사람이 만든 시계열 1개 (~2,000 행) · Q2 불리 케이스 = 창 **이동 + 확대** (가시 집합 변경, 극값 재추출 매 스텝) · cold 첫 드래그 vs warm · Q3 대조군 = 같은 fixture 창 고정 arm, **전체 프레임 p95 A/B** (`adr209-builder-frame-ab.mjs --profile` 방식, Preview iframe rAF) · Q4 결선 = 결선 9 지점 grep + live · Q5 oracle = rAF 실측 (모델 자체 타이머 아님). 조건: headed Chromium · DPR 2 · foreground · CPU throttle 1 (사용자 환경 4x 병기) · 표본 3 회 × 60 스텝. 통과 = 모델 p95 ≤ 20 ms **and** 프레임 p95 Δ ≤ +4 ms. live 하니스 PASS | 순증 초과: parse 를 lazy (Data 패널 형식 검증) 로 이동 · 로케일 ko 표 lazy; 절대 상한은 사용자 결정. 성능 초과: release 정책 (HC6) 으로 전환하고 **릴리즈 지연 ≤ 100 ms** 를 같은 조건으로 재측정 |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 시계열 데이터가 **시간 간격대로** 그려지고 (빈 날은 빈 자리, 정렬은 시간 순), 눈금이 자정·월초 같은 달력 경계에 붙으며, 라벨이 RSC 와 같은 2단 (눈금 + 경계) 으로 읽힌다 — Builder Canvas · Preview · Publish 가 같은 모듈 (`packages/specs/src/chart/time*.ts`) 을 읽는다.
- 비-ISO 날짜 문자열 (`2026/03/05` · `Mar 5, 2026` · epoch) 을 `dimensionFormat` 지시자 하나로 받는다.
- 창을 넓히거나 좁힐 수 있고 (RAC Slider thumb 2, 키보드 포함), 예산 (마크 ≤ M · 점 ≤ P) 은 창 크기와 무관하게 유지된다.
- d3 를 오라클로 두어 이식 규칙의 회귀를 테스트가 잡는다 (번들 0).

### Negative

- `packages/specs/src/chart` 에 시간 모듈 3개 (~350줄) 가 늘고 Builder initial 이 순증한다 (G5 한도 안).
- ADR-211 의 "창 길이 불변" 결정이 개정된다 — 211 본문은 그대로 두고 본 ADR 이 대체 지점을 명시하므로 두 문서를 같이 읽어야 한다 (breakdown §2.4). 창이 있는 **기존** 차트도 트랙 thumb 이 2개로 바뀐다 (HC1 예외, CHANGELOG).
- 파싱에 실패한 행은 그려지지 않는다 (x 가 없으므로 자리도 없다) — 진단 count 로만 보인다.
- bar 는 시간축을 받지 않으므로 "막대 시계열" 은 여전히 범주 등간격이다 (Recharts · RSC 와 같은 제약, 문서화).
- 로컬 시간대를 지원하지 않는다 — UTC 로 저장된 데이터가 아니면 사용자가 `%Z` 로 오프셋을 명시해야 한다.
