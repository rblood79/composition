# ADR-215 Design Breakdown: Chart 시리즈 팔레트 — categorical (Spectrum) · mono (accent) 선택 축

> 본문: [215-chart-series-palette.md](../completed/215-chart-series-palette.md) · 리서치 정본: [CHART_PALETTE_RESEARCH_2026-09](../../explanation/research/CHART_PALETTE_RESEARCH_2026-09.md) · 시안: `docs/design/chart-series-palette/` (artifact `9188da6c` — 아트보드 "4안 한눈에" · "레퍼런스 실측" · Current · OptionA · OptionC)

## 1. 전제 (완전 신규 주제 — fork 아님)

- ADR-194 (차트 기하 SSOT · `--chart-series-N` 채널 · Skia `channel.series[i]`) 의 **소비 계약은 무변경**. 바뀌는 것은 배열의 **값 원천**과 **어느 배열을 읽을지** (팔레트 선택) 뿐이다.
- ADR-193 (semantic 팔레트 표 — "생성 CSS 는 팔레트 var 참조만, hex 금지") 의 **명시적 예외 1건**: categorical 8 은 Tailwind 단계에 없는 Spectrum 리터럴이라 `--chart-categorical-N: #hex` 로 낸다 (테마 공용 `:root` 1회). ThemeStudio 는 이 var 자체를 덮는다.
- ADR-210 `seriesConfig[].colorToken` (`--chart-series-N`) 저장 형식 **무변경** — 순번은 그대로고 팔레트가 순번의 값을 정한다.
- D2: `palette` prop 의 참조는 Adobe React Spectrum Charts `Chart.colors` (팔레트 이름 `categorical6/12/16` · `sequential…` 또는 배열). composition 은 이름 2개 (`categorical` · `mono`) 로 시작한다. `variant` (상자 default/quiet) 와 `colorBy` (데이터→색 매핑, bar 전용) 는 그대로 — 세 축은 서로 다른 것을 가리킨다 (2026-09-11 대화 판정).

## 2. 현행 인벤토리 (2026-09-11 실측)

| 표면        | 파일                                                                                                                                                                                                                                                                                        | 현재                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| rule 채널   | `packages/shared/src/catalog/generated/componentRulesTable.ts:11717` `Chart.chart.series` 8 = `{color.blue, purple, green-named, orange, magenta, cyan, yellow, indigo}` · `composition-document.types.ts:493` `ComponentRuleChart.series: string[]`                                        | Tailwind 600 무지개 (light `#155dfc #9810fa #00a63e #f54900 #c6005c #0092b8 #f0b100 #432dd7`) |
| CSS emit    | `packages/specs/src/renderers/CSSGenerator.ts:1032-1040` `generateChartVariables` → `.react-aria-Chart { --chart-series-N }` · 산출 `packages/shared/src/components/styles/generated/Chart.css:61-68`                                                                                       | 팔레트 1개, 선택 축 없음                                                                      |
| Skia        | `packages/specs/src/renderers/skiaPrimitives.ts:3448-3455` `seriesToken(index)` = `channel.series[index % length]` · 주입 `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:1779-1782` `_chartRule`                                                                      | 팔레트 1개                                                                                    |
| DOM         | `packages/shared/src/components/Chart.tsx:372` `data-variant` · `chart/svgDecorations.tsx:9` `var(--chart-series-N, currentColor)`                                                                                                                                                          | `data-palette` 없음                                                                           |
| 토큰 표     | `packages/specs/src/primitives/semanticPaletteMap.ts` (Tailwind 좌표만) · `colors.ts` · `types/token.types.ts ColorTokens` · `renderers/utils/tokenResolver.ts`                                                                                                                             | Spectrum 리터럴 · accent 사다리 없음                                                          |
| accent 파생 | `preview-system.css:200-215` `--accent: oklch(from var(--tint) 55% c h)` · `apps/builder/src/utils/theme/tintToSkiaColors.ts` `createAccentColorTokens` (ACCENT_KEYS 5)                                                                                                                     | chart 단계 없음                                                                               |
| 패널        | `apps/builder/src/builder/panels/properties/ChartSeriesControls.tsx:138-146` 색 Select = `seriesTokenName(i)` × `paletteLength` · `PropertiesPanel.tsx:387` `resolveComponentRule("Chart").chart.series.length`                                                                             | 팔레트 이름 무관, 길이만                                                                      |
| binding     | `packages/shared/src/catalog/bindings/Chart.binding.ts` `accepts` 46 키 (`variant` `colorBy` 있음, `palette` 없음) · `propPassthrough`                                                                                                                                                      | —                                                                                             |
| 테스트      | `packages/specs/src/primitives/__tests__/semanticPaletteMap.snapshot.test.ts` (colors.ts 전 키 스냅샷) · `semanticAlias.symmetry.test.ts` (SEMANTIC_PALETTE_MAP 전 토큰 light≠dark) · `packages/shared/src/components/__tests__/chartParity.test.tsx` · `chart/chartTheme.browser.test.tsx` | 신규 키 추가 시 스냅샷 갱신 필요; symmetry 는 SEMANTIC 표만 순회하므로 별도 표는 영향 0       |

## 3. 설계

```ts
// packages/specs/src/primitives/chartPaletteMap.ts (신규 — Phase 1 작성됨)
CHART_CATEGORICAL_HEX = ["#0fb5ae","#4046ca","#f68511","#de3d82","#7e84fa","#72e06a","#147af3","#7326d3"] // RSC spectrumColors categorical-100..800
CHART_ACCENT_STEPS   = [{L:.40,f:1},{L:.55,f:1},{L:.70,f:.85},{L:.85,f:.5}]                                // oklch(from --tint L calc(c×f) h)
// 토큰: {color.chart-categorical-1..8} · {color.chart-accent-1..4}  (ColorTokens · tokenResolver · colors.ts)
// CSS: generated/chart-palette.css :root --chart-categorical-N: #hex  ·  preview-system.css --chart-accent-N: oklch(from var(--tint) …)
// Skia: tintToSkiaColors ACCENT_KEYS += chart-accent-1..4 (같은 (L,f) 표)

// rule (componentRulesTable Chart.chart)
series:   [chart-categorical-1..8]                       // 기본 팔레트 = categorical (순번 계약 유지)
palettes: { mono: [chart-accent-1..4, neutral-subdued, gray, silver, border] }   // 대안 팔레트 (id → 배열)

// binding: palette { kind:"enum", section:"appearance", default:"categorical", options: categorical | mono } + propPassthrough
// CSS gen: .react-aria-Chart[data-palette="mono"] { --chart-series-N: … }   (palettes 마다 1 블록)
// DOM:     Chart.tsx data-palette={palette !== "categorical" ? palette : undefined}
// Skia:    seriesToken → resolveChartPalette(channel, props.palette)[index % length]
// 공용:    packages/specs/src/chart/presentation.ts resolveChartPalette(channel, id) — Skia · 패널 · CSS gen 이 같이 읽는다
```

- `palette` 기본값 `categorical` 은 저장 안 함 (기본값 생략 규약) → 기존 프로젝트는 값 변화만 (색 8개 교체), 재직렬화 0.
- mono 5~8 은 기존 neutral 토큰 재사용 (`neutral-subdued` neutral-700/400 · `gray` neutral-500/400 · `silver` gray-400/500 · `border` neutral-300/700) — 신설 0.
- Series 섹션 색 Select 는 선택된 팔레트 길이 (둘 다 8) 로 순번 목록 — 라벨 `Series N` 유지, 색 견본은 범위 밖.

## 4. Phase 계획

### Phase 0 — Inventory (완료 2026-09-11, §2)

### Phase 1 — 토큰 원천 (완료 2026-09-11)

- [x] `chartPaletteMap.ts` · `primitives/index.ts` · `specs/index.ts` export
- [x] `ColorTokens` 12 키 · `colors.ts` 스프레드 · `tokenResolver.ts` 12 매핑
- [x] `paletteGenerator.renderChartPaletteCss` → 생성 `theme/generated/chart-palette.css` (semantic-palette.css 의 hex 0 불변식은 그대로 — 예외를 파일로 격리, R3) + `theme.css` import
- [x] `preview-system.css` `--chart-accent-1..4` · `tintToSkiaColors` ACCENT_KEYS + 계산
- [x] 테스트: 스냅샷 12 키 추가 · `chartPaletteMap.test.ts` (생성 CSS == 표 · colors.ts == 표 · tokenResolver 12) · `tintToSkiaColors.test.ts` (기본 tint 공식 == `CHART_ACCENT_DEFAULT_HEX` · pink 추종 · light == dark)

### Phase 2 — rule · 생성기 · 두 leg · binding (완료 `478108af6`, G1 PASS)

- [x] `ComponentRuleChart.palettes?: Record<string, string[]>` · rules table `series` 교체 + `palettes.mono`
- [x] `resolveChartPalette(channel, id)` (`chart/presentation.ts`) + 단위 테스트 (미지 id → series, 길이 0 → accent 폴백)
- [x] `CSSGenerator.generateChartVariables` `[data-palette="id"]` 블록 · `pnpm generate:css` → `Chart.css`
- [x] `skiaPrimitives.ts` `seriesToken` 팔레트 선택 · `CHART_PRESENTATION_KEYS`/scene 입력에 `palette`
- [x] `Chart.tsx` `data-palette` · `Chart.binding.ts` `palette` enum + `propPassthrough`
- [x] `chartTheme.browser.test.tsx` / `chartParity.test.tsx` 팔레트 2 × 테마 2 대조 (G1)

### Phase 3 — 패널 (완료 `478108af6`, G3 PASS)

- [x] `propertyFieldIcons.ts` `COMPONENT_KEY_ICONS.Chart.palette` (Appearance 안 중복 0 가드) · i18n 라벨 (`chart.palette` · 옵션 2)
- [x] `PropertiesPanel.tsx` `chartPaletteLength` → 선택 팔레트 길이 · `ChartSeriesControls` 무변경 확인

### Phase 4 — 종결 (G4 PASS 7/7 · G2 PASS — 절대 상한 사용자 재승인 2026-09-11)

- [x] 번들 delta — worktree 2개 (`926c44a07` → `9049698c7`): Builder +1,398 JS / +274 CSS · Preview +642 / +329 B gzip (본 ADR ≤ 2 KiB PASS). 절대 상한 (1,304,030 / 636,268) 은 착수 전 이미 1,312,202 / 643,116 — 152 P6 · 213 · 214 순증, 사용자 재승인 대기
- [x] live: `adr215-chart-palette-live.mjs` 7/7 (bar · Skia 픽셀 + Preview fill · mono · tint Pink 추종 · dark categorical) — ADR `### Live Exercise`
- [x] CHANGELOG · 리서치 문서 §3 → 결정 링크 · `docs/design/README.md` · ADR `### Live Exercise` — Implemented 2026-09-11
