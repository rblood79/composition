# ADR-193 구현 상세 — 테마별 semantic·named hue 팔레트 단계 매핑 단일 원천화

> 본 문서는 [ADR-193](../193-theme-aware-semantic-palette-map.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문이 정본이고, 여기에는 Phase 분할·파일 변경표·체크리스트만 둔다.

## 0. Phase 0 inventory (2026-08-27 실측 freeze)

### 0-1. 테마 신호 (양 소비자 동일 원천)

| 소비자               | 결정 경로                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Builder Skia         | `SkiaCanvas.tsx:405` `getTheme: () => resolveSkiaTheme(useThemeConfigStore.getState().darkMode)` → `resolveToken(ref, theme)`                                                                                                     |
| Preview (iframe)     | builder → `setDarkMode(isDark)` postMessage (`preview/messaging/messageHandler.ts:328`) → `runtimeStore.ts:568` `document.documentElement[data-theme]` + `applyThemeVars()` 재적용                                                |
| Publish              | `data-theme` 세팅 코드 없음 (grep 0) — dark 블록은 죽은 코드 (R6)                                                                                                                                                                 |
| ThemeStudio override | `BuilderCore.tsx:595-635` `themeVars[{name, value, isDark}]` → preview `<style id="runtime-theme-vars">` `:root {…} [data-theme="dark"] {…}` (unlayered → 모든 layer 위). 현재 `--tint`, `--color-neutral-N` (dark), spacing 계열 |

### 0-2. CSS 쪽 catalog color 토큰 분류 (`colorTokenToCss.ts` 37 키)

| 분류                                                   | 개수 | 토큰                                                                                                                                                                                                     | catalog 소비 |
| ------------------------------------------------------ | :--: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| FLIP — preview-system `[data-theme="dark"]` 재정의 var |  12  | accent, on-accent, accent-subtle, neutral, neutral-subdued, neutral-subtle, negative, base, raised, layer-1, layer-2, border                                                                             |     697      |
| FIXED — `var(--color-*)` 직접 (dark 불변)              |  24  | white, purple, informative, positive, notice, yellow, indigo, cyan, pink, turquoise, fuchsia, magenta, celery, chartreuse, seafoam, cinnamon, brown, silver, gray, red, orange, blue, on-negative, black |     212      |
| 기타                                                   |  1   | transparent                                                                                                                                                                                              |     216      |

FIXED 24 중 white/black/on-negative 3 은 Skia 도 테마 불변 → **dark 비대칭 = 21 토큰**. 잔존 spec 매핑 `tokenResolver.ts` 는 77 키, 그중 `-subtle` 25 (accent/neutral/negative 3 은 FLIP var 경유, 나머지 22 는 `--color-*-100` 고정 → dark 비대칭).

### 0-3. Skia 쪽

- `colors.ts` light 67 키, `lightColors ≠ darkColors` 63 (같은 것: on-negative, transparent, white, black).
- dark 규칙 (기존 설계): 본색 한 단계 밝게 (600→500, 700→500, red-500→400), subtle 100→900, neutral 반전.
- **결손**: catalog 키 중 `gray` (소비 6, Badge `gray` variant) 와 tokenResolver 키 `green-named`/`green-named-subtle`/`gray-subtle` 이 `colors.ts` 에 없음 → `resolveColor()` = `undefined` → **Badge gray 캔버스 비가시** (live 실측 2026-08-27, ZZZF: 81×42 빈 선택 박스). `purple-hover`/`purple-pressed` 등 `-hover/-pressed` 는 Skia 미소비 (hover 는 Preview D1) — 무해.

### 0-4. 이름 충돌 점검 (R1)

`var(--positive|--informative|--notice)` 소비 16곳 전수: `PerformanceDashboard.css` 2, `monitor-panel.css` 2, `NodesPanel.css` 2, `LayoutPresetSelector/styles.css` 3, `Toast.css` 6, `header.css` 3 — 전부 builder chrome (`[data-context="builder"]` 하위, `builder-system.css:92-97` 500 단계 정의가 specificity 로 이김). `--negative` 121 소비는 이미 preview-system `:root` 정의 경유.

### 0-5. 범위 밖 (기록만)

- Skia 가 ThemeStudio `--color-neutral-N` override 를 DOM 에서 읽지 않음 (`neutralToSkiaColors` 프리셋) — 기존 경계 (R3).
- publish dark 신호 부재 (R6).
- `-hover/-pressed` CSS `color-mix` 파생 — Skia 미소비.
- 생성기가 컴포넌트별 `[data-theme]` selector 를 emit 하는 기능 — 본 ADR 은 semantic var 층 1곳에서만 분기하므로 불요.

## 1. Phase 분할

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Gate  | 산출물                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------- |
| 0     | inventory freeze (본 문서 §0)                                                                                                                                                                                                                                                                                                                                                                                                                           | G0    | 본 문서                                  |
| 1     | 매핑 표 `semanticPaletteMap.ts` (status 4 + named 18 + subtle 22 + gray/green-named, light/dark, `hook`) + `colors.ts` 해당 항목을 표에서 파생 + `lightColors` 스냅샷 테스트 (light 값 불변) + `darkColors` 는 표 값으로 정렬                                                                                                                                                                                                                           | G1·G3 | 표 1, colors.ts, 스냅샷 테스트           |
| 2     | 생성기 확장: `generate-palette.ts` 가 `theme/generated/semantic-palette.css` emit (`@layer shared-tokens` `:root` + `[data-theme="dark"]`, `var(--color-*)` 참조만, `hook` 은 `var(--hook, var(--color-*))`), `theme.css` import, preview-system 손 `--negative` 이관 (`--negative-pressed` 는 잔류 — Skia 미소비, colors.ts 값 custom `#b33333`), `colorTokenToCss.ts`/`tokenResolver.ts` 매핑 → semantic var, generated CSS 재생성, drift 테스트 확장 | G1·G3 | 생성 CSS 1, 매핑 2 파일, generated/*.css |
| 3     | `semanticAlias.symmetry.test` dark 확장 (전 토큰) + live G2/G4 (darkMode=dark 3자 대칭, chrome 불변, ThemeStudio 훅 생존) + CHANGELOG + Implemented 승격                                                                                                                                                                                                                                                                                                | G2·G4 | 테스트, CHANGELOG                        |

각 Phase 는 commit 가능한 상태로 종료. Phase 1 은 CSS 무변경 (Skia 만 정렬 — light 불변이므로 캔버스도 light 에서 불변), Phase 2 가 CSS 전환.

## 2. 파일 변경표

### 신규

| 파일                                                                          | 내용                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/primitives/semanticPaletteMap.ts`                         | `SEMANTIC_PALETTE_MAP: Record<Token, { light: [Family, Step]; dark: [Family, Step]; cssVar: string; hook?: string }>` + `resolveSemanticHex(token, theme)` |
| `packages/shared/src/components/styles/theme/generated/semantic-palette.css`  | 생성 — `:root` / `[data-theme="dark"]` semantic var 정의 (참조만)                                                                                          |
| `packages/specs/src/primitives/__tests__/semanticPaletteMap.snapshot.test.ts` | `lightColors` 전 키 hex 스냅샷 (Phase 1 착수 시점 고정) — light 불변 게이트                                                                                |

### 수정

| 파일                                                                     | 변경                                                                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/src/primitives/colors.ts`                                | status/named/subtle 항목 → `resolveSemanticHex()` 파생, `gray`/`green-named`(+subtle) 추가                                                                        |
| `packages/specs/src/types/token.types.ts`                                | `ColorTokens` 에 `gray`, `gray-subtle`, `green-named`, `green-named-subtle`                                                                                       |
| `packages/specs/scripts/paletteGenerator.ts` / `generate-palette.ts`     | `renderSemanticCss()` + 산출물 3번째 등록, `--check` 포함                                                                                                         |
| `packages/shared/src/components/theme.css`                               | `generated/semantic-palette.css` import (tailwind-palette 다음)                                                                                                   |
| `packages/shared/src/components/styles/theme/preview-system.css`         | `--negative` light·dark 손 정의 제거 (생성 파일로 이관, `--color-invalid` 훅 유지). `--negative-pressed` 와 `forced-colors` 블록의 `--negative: LinkText` 는 잔류 |
| `packages/shared/src/catalog/resolvers/colorTokenToCss.ts`               | FIXED 21 → semantic var (`var(--positive)`, `var(--hue-indigo)` …)                                                                                                |
| `packages/specs/src/renderers/utils/tokenResolver.ts`                    | 동일 + `-subtle` 22 → `var(--positive-subtle)` 류                                                                                                                 |
| `packages/shared/src/components/styles/generated/*.css`                  | 재생성 (Badge/StatusLight/Meter/InlineAlert/TagGroup …)                                                                                                           |
| `packages/specs/src/primitives/__tests__/semanticAlias.symmetry.test.ts` | dark 열 검증 + 생성 semantic CSS 파싱                                                                                                                             |
| `docs/CHANGELOG.md`                                                      | 사용자-가시: dark Preview 색 이동 + Badge gray 캔버스 복구                                                                                                        |

### 삭제 없음

## 3. 변수 명명

| 토큰 종류        | semantic var           | 예                                                                                                                                |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| status           | `--{token}`            | `--positive`, `--informative`, `--notice`, `--negative` (기존 이름 유지 — R1 점검 완료)                                           |
| status subtle    | `--{token}-subtle`     | `--positive-subtle`                                                                                                               |
| named hue        | `--hue-{token}`        | `--hue-indigo`, `--hue-gray`, `--hue-green` (green-named) — `--indigo` 는 preview-system tint preset 이 이미 점유하므로 접두 필수 |
| named hue subtle | `--hue-{token}-subtle` | `--hue-indigo-subtle`                                                                                                             |

## 4. 체크리스트

### Phase 0

- [x] 테마 신호 경로 2 소비자 실측 (§0-1)
- [x] 토큰 분류 FLIP 12 / FIXED 24 / subtle 25 + 소비 수 (§0-2)
- [x] Skia 결손 `gray`/`green-named` live 실측 (§0-3)
- [x] R1 이름 충돌 소비 16 전수 (§0-4)

### Phase 1

- [ ] `semanticPaletteMap.ts` — light 열은 현행 `lightColors` 와 동일, dark 열은 현행 `darkColors` 와 동일 (변경 0) + `gray`(neutral 500/400), `green-named`(green 600/500), subtle 행
- [ ] `lightColors` 스냅샷 테스트 GREEN (light 불변)
- [ ] `colors.ts` 파생 후 `darkColors` 도 스냅샷 diff 0 (표가 현행 값을 그대로 옮겼는지)
- [ ] type-check / specs vitest / build:specs

### Phase 2

- [ ] 생성 CSS: `#` 0, `var(--color-` 참조만, `[data-theme="dark"]` 블록 1개, 크기 ≤ 5KB
- [ ] `theme.css` import 순서: tailwind-palette → semantic-palette → builder-system
- [ ] preview-system 손 `--negative` 제거 (`--negative-pressed`·forced-colors 잔류) 후 computed `--negative` light/dark 값 불변
- [ ] 매핑 2 파일 전환 + generated/*.css 재생성 + `validate:sync` 0 errors
- [ ] live light: Badge positive/negative/indigo/gray, StatusLight notice, Meter positive computed 색 변경 전후 동일 (G1)

### Phase 3

- [ ] `semanticAlias.symmetry.test` dark 확장 GREEN
- [ ] live dark (`darkMode=dark`): preview computed vs `darkColors` 6 요소 Δ≤1, Skia zoom 스크린샷 (G2)
- [ ] chrome Toast/header 색 불변, ThemeStudio runtime var 로 `--color-green-600` 덮어쓰기 → Badge positive 추종 (G4)
- [ ] CHANGELOG + README Implemented + closure 5단계
