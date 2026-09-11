# Chart 시리즈 팔레트 리서치 — Adobe · Pinterest · Apple · Figma (2026-09-11)

> 목적: Chart 의 시리즈 색 (`--chart-series-1..8`, rule `chart.series`) 을 바꾸기 전에 레퍼런스가 **무엇을 어떻게** 정했는지 실측. 시안 캔버스는 `docs/design/chart-series-palette/` (gitignore, artifact `9188da6c`). 판정·ADR 은 이 문서 뒤.

## 0. 현재 값 (실측)

`packages/shared/src/catalog/generated/componentRulesTable.ts:11717` `chart.series` = `{color.blue, purple, green-named, orange, magenta, cyan, yellow, indigo}` → `semanticPaletteMap.ts` → Tailwind

| theme | 1       | 2       | 3       | 4       | 5       | 6       | 7       | 8       |
| ----- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| light | #155dfc | #9810fa | #00a63e | #f54900 | #c6005c | #0092b8 | #f0b100 | #432dd7 |
| dark  | #2b7fff | #ad46ff | #00c950 | #ff6900 | #ec003f | #00b8db | #fdc700 | #615fff |

문제: 전부 최대 채도 · 같은 명도 · 청색 사분면 4개 (1·2·6·8) · yellow 대비 부족. shadcn 값이 아니라 Tailwind 600 나열이다.

## 1. 출처별 실측

### Adobe — react-spectrum-charts (`packages/themes/src/`)

- `categoricalColorPalette.ts`: `categorical6/12/16` (Spectrum 1) · `s2Categorical6/12/16/20` (Spectrum 2). 값은 `spectrumColors.ts` / `spectrum2Colors.ts` 의 `categorical-100..` 행. **light = dark 동일값**.
- `spectrum2Theme.ts:87` — Spectrum 2 theme 의 기본 `range.category` 도 **`categorical16` (S1 값)** 이다. S2 categorical 은 옵션.
- Chart `colors` prop: 팔레트 이름 또는 Spectrum 색 이름 배열 (색 이름은 light/dark 반응).
- S1 categorical 1~8: `#0fb5ae #4046ca #f68511 #de3d82 #7e84fa #72e06a #147af3 #7326d3` (teal · indigo · orange · pink · periwinkle · green · blue · purple — 색상환을 번갈아 뛰고 명도 교차).
- S2 categorical 1~8: `#5424db #d92361 #e86a00 #5d89ff #9a47e2 #f24cb8 #0ba286 #9c28af` — 보라·분홍 계열 5/8.
- sequential (viridis/magma/rose/cerulean/forest) · diverging (orangeYellowSeafoam/redYellowBlue/redBlue) 5/9/15~16 단계 별도 제공.
- Spectrum 사이트 "Color for data visualization" 페이지는 JS 렌더라 fetch 불가 — 값은 소스에서.

### Pinterest — Gestalt (`packages/gestalt-design-tokens/tokens/vr-theme/sema/color/{light,dark}/default.json`)

- `sema.color.dataviz.01..12` — **light/dark 값이 다르다** (다크는 밝고 채도 낮춤).
- 01~08 light: `#003c96 #11a69c #924af7 #d17711 #0081fe #ff5383 #00ab55 #400387` / dark: `#005fcb #75e4d5 #b190ff #fda600 #75bfff #de2c62 #a4f9ac #812ae7`.
- 원칙 (`docs/pages/foundations/data_visualization/color/usage.tsx`): "2색 이상이면 **팔레트 순서 그대로** 적용 — 인접 대비 최대" · `data-visualization-primary` (= 05, blue) 를 **단일 시리즈/합계** 에 · success/error 는 별도 semantic (텍스트용은 한 단계 어둡게) · `DO_NOT_PAIR_COLORS` 10쌍 · 색 위 텍스트 명암 표.

### Apple — HIG Charts + Swift Charts

- HIG (`/design/human-interface-guidelines/charts`): 팔레트를 명시하지 않는다. 원칙만 — "색만으로 구분하지 말 것 (모양·패턴 병행)" · "인접 색 면 사이 시각 분리" · "브랜드를 드러내는 색" · 접근성 라벨에 색 이름 넣지 말 것.
- Swift Charts 기본 색: 문서 미명시. 렌더 관찰상 system `blue · green · orange · purple · red · cyan · yellow (· pink)` 순 — light `#007aff #34c759 #ff9500 #af52de #ff3b30 #32ade6 #ffcc00 #ff2d55` / dark `#0a84ff #30d158 #ff9f0a #bf5af2 #ff453a #64d2ff #ffd60a #ff375f`. Health/Fitness 등 자사 앱은 **단일 tint (accent) 계열** 차트가 주류.

### Figma

- 공개 data-viz 팔레트 없음. 커뮤니티 킷 (r19 Data Visualization Kit 등) 뿐이라 레퍼런스로 삼지 않는다.

## 2. 공통 원칙 (4곳 교집합)

1. **순서가 정본** — 팔레트는 "색 집합" 이 아니라 "인접 대비를 최대로 한 배열". 사용자가 시리즈 색을 고를 때도 그 배열 안에서.
2. **단일 시리즈 = primary/accent** — Pinterest `primary`, Apple tint. categorical 1번이 아니라 브랜드 색.
3. **light/dark** — Adobe 는 공용 중명도 값 1벌, Pinterest·Apple 은 2벌. 중명도 1벌이 유지가 쉽고, 2벌이 다크 대비가 낫다.
4. **상태색은 팔레트 밖** — success/error (값 기준 색) 은 별도 semantic 토큰.
5. **색만으로 구분 금지** — 모양·패턴·라벨 병행 (접근성). 팔레트 결정과 별개 후속.
6. 개수: Adobe 6/12/16(/20) · Pinterest 12 · Apple ~7. 8 은 무난.

## 3. 판정 재료 → 제안 (→ 결정: [ADR-215](../../adr/215-chart-series-palette.md) — A categorical + C mono, B 제외 · 사용자 2026-09-11 "리서치 후 제안 대로 착수")

- **`categorical` (기본)**: Adobe Spectrum 1 categorical 1~8 — RSC 의 S2 theme 도 이걸 기본으로 쓰는 것이 결정적 근거. light = dark 1벌 (theme 행 8개 `viz-categorical-1..8`).
- **`mono`**: accent 명도 4단 + neutral 4단 — Pinterest primary · Apple tint 관행. accent 단계 행 신설 필요 (`accent` 계열은 현재 4 토큰뿐).
- **B (Tailwind 재조합)** 은 어느 레퍼런스에도 대응물이 없다 — 토큰 신설 0 이라는 이점뿐. 제공 여부는 사용자 판정.
- 현재 Tailwind 무지개는 대체 (유지 사유 없음).
- 후속 (팔레트와 별개): 값 기준 색 (success/error) · 색 외 구분 (모양/패턴).
