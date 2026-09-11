# ADR-215: Chart 시리즈 팔레트 — categorical (Spectrum) · mono (accent) 선택 축

## Status

Proposed — 2026-09-11

## Context

Chart 의 시리즈 색 8개는 rule `Chart.chart.series` 가 named hue 토큰 8개 (`blue purple green-named orange magenta cyan yellow indigo`) 를 나열한 것이고, 그 값은 `semanticPaletteMap.ts` 를 거쳐 Tailwind 600 단계로 해소된다 (light `#155dfc #9810fa #00a63e #f54900 #c6005c #0092b8 #f0b100 #432dd7`). 결과는 최대 채도 · 같은 명도의 무지개 나열이다 — 청색 사분면이 4개 (1·2·6·8) 라 시리즈 구분이 안 되고 yellow 는 흰 바탕 대비가 부족하다 (사용자 지적 2026-09-11 "shadcn 의 컬러 대비 색감이 촌스럽다" — 실측하면 shadcn 값도 아니다). 팔레트는 1개뿐이라 단일 시리즈 차트도 categorical 1번 색을 쓴다.

레퍼런스 실측 ([CHART_PALETTE_RESEARCH_2026-09](../explanation/research/CHART_PALETTE_RESEARCH_2026-09.md)): Adobe react-spectrum-charts 는 팔레트 이름 (`categorical6/12/16`, sequential, diverging) 을 `Chart.colors` 로 고르고 Spectrum 2 theme 도 기본 category 는 Spectrum 1 categorical 값 (light = dark 1벌) 이다. Pinterest Gestalt 는 순서 고정 12색 + `primary` (단일 시리즈용) + success/error 별도, Apple 은 팔레트 대신 "색만으로 구분 금지 · 브랜드 tint" 원칙이고 자사 앱은 단일 tint 차트가 주류다. 교집합 — ① 순서가 정본 ② 단일 시리즈 = primary/accent ③ 상태색은 팔레트 밖 ④ 개수 6~16.

**3-Domain**: D3 (시각) 가 본체 — 토큰 원천 추가 + rule 채널 확장. D2 는 `palette` prop 1개 (RSC `colors` 참조). D1 무변경.

**Hard Constraints**:

1. **대칭**: 팔레트 2 × 테마 2 × 시리즈 8 전부에서 Skia hex 와 Preview `getComputedStyle` 해소값이 같은 토큰 → 같은 값 (accent 사다리는 CSS `oklch(from var(--tint) …)` 와 Skia `oklchToHex` 가 같은 (L, chroma 계수) 표 — 채널당 ±1/255 허용, 기존 `--accent` 경로와 같은 기준).
2. **저장 형식 무변경**: `seriesConfig[].colorToken` 은 `--chart-series-N` 그대로 (ADR-210). 기존 프로젝트 재직렬화 0.
3. **번들**: initial Builder ≤ 1,304,030 / Preview ≤ 636,268 (ADR-211 상한, 만료 2026-10-10) — 본 ADR 순증은 토큰 12 + CSS 블록 1 + enum 1 로 ≤ 2 KiB.
4. **Generator 지원**: `CSSGenerator.generateChartVariables` 는 현재 팔레트 1개만 emit — `[data-palette="id"]` 블록 emit 을 **본 ADR 이 추가**한다 (SSOT debt 없이 생성 경로로).

**Soft Constraints**:

- ADR-193 "생성 CSS 는 팔레트 var 참조만 (hex 금지)" 은 ThemeStudio 의 `--color-*` override 를 흘리기 위한 규칙 — categorical 리터럴은 `--chart-categorical-N` 자체가 override 훅이라 목적을 해치지 않는다. 예외 1건으로 명시.
- 색 견본 (swatch) · 값 기준 색 (success/error) · 색 외 구분 (모양/패턴) 은 범위 밖 후속.

## Alternatives Considered

### 대안 A: 팔레트 2 (`categorical` = Spectrum 리터럴 8 · `mono` = accent 명도 4단 + neutral 4단) + `palette` prop

- 설명: `chartPaletteMap.ts` 에 Spectrum categorical hex 8 (테마 공용) 과 accent 사다리 (L, chroma 계수) 4 를 두고, rule `chart.series` = categorical 토큰 8, `chart.palettes.mono` = accent 4 + 기존 neutral 4. binding `palette` enum (기본 `categorical`), CSS 는 `[data-palette="mono"]` 블록, Skia 는 `resolveChartPalette(channel, props.palette)`.
- 근거: RSC `colors` 팔레트 이름 · RSC S2 theme 기본값 = S1 categorical · Pinterest `primary` / Apple tint 의 단일 시리즈 관행.
- 위험:
  - 기술: M — accent 사다리 대칭 (CSS relative color 의 gamut 매핑 vs `oklchToHex` clamp). 기존 `--accent` 가 같은 구조로 이미 대칭 통과 (`tintToSkiaColors.ts` · `preview-system.css:200`).
  - 성능: L — 토큰 12 · CSS 8줄 · enum 1.
  - 유지보수: M — 토큰 원천이 표 2개 (semanticPaletteMap + chartPaletteMap). 생성기 · colors.ts · tokenResolver 가 같은 표를 읽어 손 복사 0.
  - 마이그레이션: M — 모든 기존 Chart 요소 (100%) 의 색이 바뀐다 (값 변화만, 재직렬화 0). 롤백은 rule 배열 + 표 되돌리기.

### 대안 B: Tailwind 단계로 근사 — `semanticPaletteMap` 행 8 교체만, 팔레트 1개 유지

- 설명: Spectrum 값을 가장 가까운 Tailwind 단계 (teal-500 · indigo-700 · orange-400 · pink-600 · indigo-400 · green-400 · blue-500 · purple-700) 로 옮겨 기존 표 안에서 해결. 토큰 신설 0, prop 신설 0.
- 근거: ADR-191/193 체인 무손상 (팔레트 정의 원천 = tailwind theme.css 하나).
- 위험:
  - 기술: L.
  - 성능: L.
  - 유지보수: L.
  - 마이그레이션: **H** — OKLab ΔE 0.02~0.05 (실측: indigo-700 0.046 · green-400 0.046 · pink-600 0.043) 만큼 채도가 올라가 "Tailwind 무지개" 로 되돌아간다 — 리서치가 지적한 문제를 반만 고친다. 단일 시리즈 accent 관행 (원칙 ②) 미충족.

### 대안 C: 팔레트 값만 교체 (A 의 categorical) · `palette` prop 없음

- 설명: rule `chart.series` 를 Spectrum 리터럴 토큰으로 바꾸고 mono · prop 은 두지 않는다.
- 근거: 최소 변경 — 사용자 지적 (색감) 만 해소.
- 위험:
  - 기술: L.
  - 성능: L.
  - 유지보수: L.
  - 마이그레이션: M — 색 변화 100% (A 와 같음).
  - (기능) 단일 시리즈 = accent 관행 미충족, 대시보드 단색 차트 표현 불가 — 리서치 원칙 ② 위반. 4축 밖이라 표에는 M 으로 두되 Decision 에서 기각 사유로 다룬다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | M            |     0      |
| B    | L    | L    | L        | H            |     1      |
| C    | L    | L    | L        | M            |     0      |

루프 판정: HIGH 0 대안이 둘 (A · C) — 새 대안 추가 불필요. CRITICAL 없음. (검토 후 제외: 런타임 파생 — categorical 을 CSS relative color 로만 만들면 Skia 가 브라우저 계산을 못 읽어 대칭 CRITICAL.)

## Decision

**대안 A** 를 선택한다.

선택 근거:

1. 기술 M (accent 사다리 대칭) 은 기존 `--accent` 와 같은 구조 (`oklch(from var(--tint) L c h)` ↔ `oklchToHex`) 라 이미 통과한 경로의 단계 추가다 — G1 대칭 테스트로 관리.
2. 유지보수 M (표 2개) 은 표의 성격이 다르기 때문이다 — Tailwind 좌표 (semantic) 와 리터럴/공식 (chart). 하나로 합치면 `semanticAlias.symmetry` 의 "전 토큰 light ≠ dark" 불변식이 깨진다. 두 표 모두 생성기 · colors.ts · tokenResolver 가 같은 원천을 읽는다.
3. 마이그레이션 M (색 변화 100%) 은 본 ADR 의 목적 자체다 — 저장 형식은 무변경이고 CHANGELOG 에 사용자-가시 엔트리로 고지한다.

기각 사유:

- **대안 B 기각**: 값이 Tailwind 채도로 되돌아가 (ΔE 최대 0.046) 문제를 반만 고치고, 단일 시리즈 accent 관행을 담을 자리가 없다.
- **대안 C 기각**: 팔레트 선택 축이 없으면 리서치 원칙 ② (단일 시리즈 = primary/accent) 와 대시보드 단색 어법을 표현할 수 없다. 사용자 판정 2026-09-11 "ABC 제공, C 는 accent 기준" — B 는 리서치 후 대응물 없음으로 제외 (사용자 동의 "리서치 후 제안 대로 착수해").

> 구현 상세: [215-chart-series-palette-breakdown.md](design/215-chart-series-palette-breakdown.md)

## Risks

| ID  | 위험                                                                                                             | 심각도 | 대응                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------- |
| R1  | accent 사다리의 CSS relative color gamut 매핑과 Skia `oklchToHex` clamp 가 고명도 단계 (L 0.85, c×0.5) 에서 갈림 |  MED   | G1 — 팔레트 2 × 테마 2 × tint 2 (blue · pink) 로 `getComputedStyle` vs Skia hex 대조, 채널 ±1/255         |
| R2  | 기존 프로젝트 차트 색 100% 변화 — 사용자가 "고장" 으로 인지                                                      |  MED   | CHANGELOG 사용자-가시 엔트리 · 저장 무변경이라 롤백은 rule 되돌리기 1 커밋                                |
| R3  | 생성 CSS 예외 (hex 리터럴) 가 선례가 되어 ADR-193 규칙이 느슨해짐                                                |  LOW   | 예외를 `chartPaletteMap.ts` 한 파일로 격리, 생성기 주석에 사유 · 정적 테스트 (semantic 블록엔 hex 0 유지) |
| R4  | 번들 상한 (ADR-211) 초과                                                                                         |  LOW   | G2 — build 후 initial 계측                                                                                |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                | 실패 시 대안                                                          |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| G1   | Phase 2 종료 | browser 테스트: 팔레트 2 × 테마 2 × 시리즈 8 에서 Preview `--chart-series-N` 해소 hex == Skia `seriesToken` 해소 hex (±1/255) · tint 변경 시 mono 4 추종 | 갈리는 단계의 chroma 계수를 gamut 안으로 낮추고 표 갱신 (공식은 유지) |
| G2   | Phase 4      | initial Builder ≤ 1,304,030 · Preview ≤ 636,268 (ADR-211)                                                                                                | enum/토큰 외 원인 조사 — 본 ADR 순증 ≤ 2 KiB 가 아니면 중단           |
| G3   | Phase 3      | 정적: `palettes.*` 길이 == `series` 길이 · 토큰 12 가 `ColorTokens` · tokenResolver · colors.ts 에 전부 존재 · Appearance 섹션 아이콘 중복 0             | 누락 보강                                                             |
| G4   | Implemented  | live (Chrome MCP): bar · pie · line 에서 `palette` 전환이 Skia 픽셀 + Preview 양 leg 에 반영, light/dark, tint pink 에서 mono 추종                       | 원인 leg 수리 후 재실행                                               |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- Chart 색이 Spectrum categorical 로 바뀌어 8 시리즈 구분 · 다크 대비가 레퍼런스 수준이 된다 (`Chart.css` · Skia 동시).
- `palette: mono` 로 단일 시리즈 / 대시보드 단색 차트가 accent (`--tint`) 를 따라간다 — ThemeStudio tint 변경에 차트도 응답.
- 팔레트 이름 축이 생겨 후속 (sequential · diverging · 사용자 정의) 을 rule `chart.palettes` 에 추가하는 것으로 확장 가능.

### Negative

- 토큰 원천이 표 2개 (`semanticPaletteMap.ts` · `chartPaletteMap.ts`) — 생성 CSS 의 hex 예외 1건.
- 기존 프로젝트의 차트 색이 전부 바뀐다 (저장 무변경, 값만).
- `ColorTokens` 키 12 증가 — 스냅샷 테스트 갱신.
