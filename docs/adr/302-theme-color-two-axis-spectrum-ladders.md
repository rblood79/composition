# ADR-302: 테마 색 토큰을 accent · tone 두 축의 Spectrum 사다리에서 결정한다 — 초기값 = Spectrum 토큰 값, 축을 바꿔도 Hub 규칙 유지

## Status

Proposed — 2026-11-07

- 사용자 요청: `/create-adr` (2026-11-07) — 같은 대화의 Spectrum Hub 조사 ([SPECTRUM_COVERAGE_GAP_2026-11](../explanation/research/SPECTRUM_COVERAGE_GAP_2026-11.md) §9.6 ~ §9.11) 뒤.
- 방향을 정한 사용자 원문 (2026-11-07, 같은 대화):
  - 「accent 와 tone 으로 theme color token 이 결정되어야 한다」.
  - 「accent (초기값) · tone (초기값) 으로 Spectrum Hub 의 color token 들이 나와야 한다. 이유 → theme 에서 accent · tone 변경만으로 Spectrum Hub 의 규칙을 지키면서 다양한 theme color 를 쉽게 제공하기 위함이다.」
  - 「실제 token 이 존재하는 것은 Spectrum Hub 와 composition 이다. composition 은 S2 를 참고해서 token 화를 한 것이다」 — 비교 · 대조 기준은 Spectrum 토큰 데이터 (design-data 3.8.2 = `@adobe/spectrum-tokens`), S2 style macro 는 그 소비 방식 (§9.8).
  - 「결론은 spectrum hub 의 color 개념 패턴은 그대로 적용이 된건가」 → 「패턴은 그대로, 값은 기본 preset 만 그대로」 로 답했고 이 ADR 이 그 답이다.
- 사용자가 이미 답한 것: 기본 Tone 은 Spectrum gray 13단 (Tailwind neutral 은 기본값이 될 수 없다) · status · named hue 는 초기값에서 Spectrum 단 값 · 축을 바꾸면 Hub 대비 규칙을 지켜야 한다 · 테마 축 (tint · Tone · darkMode) 은 실행 시점 입력으로 유지한다 (§9.6 결정 보강 표).
- 선행 ADR 과의 관계 (fork 아님 — 새 결정): [ADR-290](completed/290-theme-accent-contrast-target-lightness.md) 의 accent 탐색 (`solveAccentRoles`) 은 이 ADR 의 accent 사다리 생성으로 **대체** 된다 (290 은 Superseded in part). [ADR-295](completed/295-d3-token-values-s2-style-macro-scale.md) 의 「값은 S2 설치본, 이름은 저장소」 원칙과 oracle fixture 방식을 색에 확장한다. [ADR-191](completed/191-tailwind-theme-single-source-palette.md) 의 Tailwind 생성 팔레트는 **테마 경로에서만** 빠진다 (팔레트 CSS `--color-{family}-{step}` 자체는 유지). [ADR-227](completed/227-multi-theme-token-set-collection.md) 의 「테마별 light/dark 이중 세트 유보」 는 그대로 — 이 ADR 은 **생성값** 만 두 벌로 만들고 문서 override 스키마는 바꾸지 않는다.
- 리뷰 · 착수는 사용자 요청 때 (`/review-adr 302` → `/execute-adr 302`).

## Context

### 도메인

**D3 시각 스타일** — theme/tokens root collection 의 색 층. rule 의 TokenRef 이름 (`{color.accent}` · `{color.layer-1}` …) 은 바꾸지 않는다. 다만 status 4 는 지금 한 키 (`{color.negative}`) 가 배경 자리 (`backgroundColor` default · isHovered · isPressed) 와 글자 · 선 자리 (`color` outline · subtle · `fillBar`) 에 같이 쓰여 (`componentRulesTable.ts:1473 · :1484`, status 4 합 82 참조) Spectrum 의 background 900|800 · content 900|900 두 alias 를 한 값으로 받을 수 없으므로, **배경 자리 참조만 `{color.<status>-fill}` 계열로 재분류** 한다 (66 참조 — ADR-290 의 accent 48 재분류와 같은 종류, G0 표). 그 밖의 rule 과 생성 CSS 참조는 무수정이고 값을 만드는 resolver 와 seed 가 바뀐다. D1 · D2 무관. Canvas (Skia) 와 Preview · Publish (DOM) 는 같은 snapshot 을 읽는 대등 consumer 로 그대로다. 문서 스키마 (`TokenEntry` · `ThemePreset` · `TokensSnapshotEntry`) 변경 **0**.

### 현재 (실측 2026-11-07 — §9.6 재집계 · §9.11 검사, main `ba85388db`)

- **색 토큰 172 키** (`packages/rendering/src/primitives/colors.ts` `lightColors` :30 · `darkColors` :124) 중 accent · tone 축을 따르는 키는 **38** (accent 만 10 · 둘 다 4 · tone 만 24), 고정이 **134** (status 33 · named hue 76 · chart 8 · 상수 4 · tone 쪽 고정 11 · accent 쪽 고정 2). rule 참조 1183 중 축 486 · 상수 366 · status · hue 285 · 나머지 고정 46. 50 preset (tint 10 × Tone 5) × light · dark 를 `resolveThemeSnapshot` (`packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts:232`) 으로 실행해 판정했다.
- **값의 출처가 셋** — S2 손 hex (`DEFAULT_SURFACE_KEYS` 19, `neutralToSkiaColors.ts:18` — default Tone 에서만 Tailwind 사다리를 덮어씀 :144) · Tailwind 표 (`semanticPaletteMap.ts` 의 (family, step) 좌표 — status 4 · named hue 19 · `border` · `neutral` 글자) · resolver 파생 (ADR-290 `createAccentColorTokens` `tintToSkiaColors.ts:287` — 흰 글자 기준 oklch 탐색, `mixHexWithBlack` :610 의 hover 85 % · pressed 75 %). 어느 출처인지 데이터가 말하지 않는다.
- **light · dark** — `accent` · `accent-hover` · `accent-pressed` · `on-accent` · `on-negative` · chart 12 · `overlay-backdrop` 은 50 preset 전부에서 light = dark 한 값. `accent-fill` 은 tint = blue 만 두 값. Spectrum 은 모든 색이 두 값이다 (accent-900 light `#3b63fb` / dark `#5681ff`).
- **대비 규칙 (Hub colors · grays — 글자 4.5 · 활성 non-text 3:1)** — 같은 WCAG 식이 Spectrum 값은 전부 통과시키고 composition 은 다음을 떨어뜨린다: `on-negative` on `negative` **100 / 100** (3.81 / 2.89) · `negative` · `positive` · `notice` 글자 on 모든 층 50 / 100 (light 전부 — Tailwind 500 ~ 600 단이 Spectrum 900 보다 밝다) · `on-accent` on `selection-accent` dark 50 / 100 (3.51 — dark 에 900 을 썼다, S2 는 800) · 어두운 tint 의 dark `accent` 면 on layer 27 ~ 31 / 100. 통과: neutral 계열 글자 · `on-accent` on `accent` · `focus-ring`.
- **배경 층** — default Tone 만 base · layer-1 · layer-2 · elevated 가 Spectrum 과 같다. `pasteboard` 는 전 preset 없음. 비기본 Tone 4종은 light layer-1 = layer-2 · dark layer-1 = layer-2 = elevated (`LIGHT_MAP` · `DARK_MAP` 이 같은 단을 가리킴 — 40 / 40). `raised` 는 Hub 에 없는 역할이고 Tailwind 고정값.
- **Spectrum 토큰 데이터의 모양** (design-data 3.8.2, 2523건 — §9.9): primitive (`private`, gray 13단 25 ~ 1000 · 18 hue 16단, `color-set` light/dark) → semantic alias (`$ref` 사슬 — `accent-content-color-default` → `accent-color-900` → `blue-900`; `background-layer-1-color` …) → component 토큰. S2 `spectrum-theme.ts` `createTheme` (:757 ~ :822) 가 그 alias 를 역할 이름 → 단으로 고정해 둔 표가 있다 (`accent: accent-900|800` · `base: gray-25` · `layer-1: gray-50` · `layer-2: gray-25|75` · `pasteboard: gray-100|25` · `neutral: gray-800` · `neutral-subdued: gray-700` · `disabled: gray-100 · 400` · `focus-ring: blue-800`). hover · pressed = 같은 사다리 다음 단 (`nextColorStop` :164). design-data light primitive 301 건이 S2 설치본 값과 전부 같다 (§9.10).
- **게이트** — `d3S2Alignment.static.test.ts` 는 치수만 (ADR-295 가 색을 범위 밖으로 둠) · `themeColorParity.browser.test.ts` 는 DOM = Skia 만. 색 값이 Spectrum 과 같은지, 두 축에서 나오는지, 대비를 지키는지 재는 게이트는 없다.
- **소비처** — DOM: `tokenToCSSVar` → `var(--<role>)` (`packages/rendering/src/renderers/utils/tokenResolver.ts:372`, `COLOR_TOKEN_TO_CSS` :159, hover/pressed 의 CSS 쪽 `color-mix` 폴백 :322 ~ :328) · `catalogThemeVarsCss` (`themeVarsCss.ts:21`) · `preview-system.css` 의 `--tint-100 ~ 1600` oklch 상대색 (:74 ~ :119, DOM 전용). Skia: `installThemeMaps` (`themeMaps.ts:95`). 패널: Themes 의 Tone 견본 (`ThemesPanel.tsx:123` `NEUTRAL_PALETTES[...][500]`) · 색 피커 Theme 묶음 (`ColorPickerPalettes.runtime.ts:14` `THEME_PALETTE_GROUPS`).

### 제약

- **Hard**: 초기값 동일 — tint · Tone · darkMode 초기값 (`CATALOG_DEFAULT_THEME_PRESET` blue · neutral · md · light) 의 resolver 출력이 design-data 3.8.2 토큰 값과 역할마다 같다 (상수 white · black · transparent 제외). 사용자 결정의 첫 조건이고 oracle 은 외부 (design-data MCP · `@adobe/spectrum-tokens` JSON) 다.
- **Hard**: 규칙 유지 — tint 10 + 사용자 hex · Tone 5 · light/dark 모든 조합에서 글자 4.5 · 활성 non-text 3 · 배경 층 5 가 서로 다른 단 · hover/pressed = 다음 단. §9.11 의 검사 스크립트가 그대로 게이트가 된다.
- **Hard**: 번들 — Builder initial gz ≤ 1,414,000 (지금 1,411,708, 여유 2,292 B) · Preview ≤ 325,000 (323,910, 여유 1,090 B) (ADR-201 재승인, 만료 2026-11-25). primitive 사다리 표 (gray 13 × 2 + 18 hue × 16 × 2 ≈ 600 hex ≈ 4 KB raw) 는 그대로 initial 에 못 들어간다 — 기본 preset 의 **역할 값** 만 seed 로 싣고 사다리 표는 테마 전환 때 lazy 로 읽거나, 사다리를 역할 값에서 다시 세우지 않고 생성식으로 대체하는 선택이 필요하다 (사용자 결정 8).
- **Hard**: D3 대칭 — Canvas 와 Preview · Publish 가 같은 hex (ADR-290 Decision 3 과 같은 조건). CSS 쪽 `color-mix` 폴백은 없어진다 (hover/pressed 가 snapshot 값이므로).
- **Hard**: 문서 스키마 · 마이그레이션 코드 0 (개발 단계 정책). `TokensSnapshotEntry` 의 모드별 값은 ADR-227 §6 유보 그대로.
- **Soft**: 테마 전환 비용 — resolver 1회 (50 preset 50회 = 681 ms vitest 포함, 1회 ≈ 10 ms 미만) 를 넘지 않는다. 사다리 생성이 들어가면 색 수 (16 × 2 × 24 hue + 13 × 2 × 5) 만큼 oklch → hex 변환이 늘지만 전환 때 1회다.
- **Soft**: ADR-290 의 테스트 (`accentContrast.test.ts` 단위 40 + 사다리) 와 `s2NeutralColors` · `s2SurfaceColors` 는 새 값으로 다시 쓴다.

## Alternatives Considered

### 대안 A: 값만 교체 — 지금 구조에서 Tailwind 좌표 · 고정 hex 를 Spectrum 값으로

- 설명: `semanticPaletteMap` 의 (family, step) 을 S2 hue 사다리로, `DEFAULT_SURFACE_KEYS` 를 모든 Tone 으로, `raised` 를 layer-2 로. resolver · 탐색 · 혼합 파생은 그대로.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 출처 셋이 그대로라 「이 토큰은 어느 축에서 오는가」 를 여전히 데이터가 말하지 않고, 축을 바꾸면 status · hue 는 Spectrum 단 고정값이라 Tone 바탕과의 대비를 아무도 안 잰다; accent 는 여전히 모드별 한 값) / 마이그레이션(L).
- 초기값 동일은 맞출 수 있지만 둘째 조건 (축 변경 시 규칙 유지) 을 구조가 못 받는다.

### 대안 B: S2 style macro 처럼 — `@adobe/spectrum-tokens` 를 설치해 빌드 시 역할 값을 인라인

- 설명: S2 `tokens.ts` → `createTheme` 를 그대로 가져와 역할 값을 빌드 산출물로 굳힌다.
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(**C** — 테마 축이 사라진다. S2 는 brand 축이 Adobe 하나라 tint · Tone 입력이 없다. 사용자 결정 (축 변경으로 다양한 테마) 을 정면으로 어긴다).

### 대안 C: 두 축 파이프라인 — primitive 사다리 (표 + 생성) → alias map → 역할 토큰, 기본값은 design-data 표

- 설명: Tone → gray 13단 (light · dark), accent · status · hue → 16단 (light · dark) 을 **primitive** 로 두고, S2 `createTheme` 의 alias map 을 코드 표로 옮겨 역할 토큰을 만든다. 기본 preset 의 사다리는 design-data 값 그대로 (표), 다른 tint · 사용자 hex · 다른 Tone 은 같은 모양의 사다리를 **생성** 한다 (Hub 의 Leonardo 와 같은 원리 — key color + 단별 목표 대비 → 16단). hover · pressed = 다음 단. `focus-ring` · `selection` · `on-accent` · `raised` · picker · popover 같은 고정 키는 전부 alias 로 바뀐다. 모든 역할이 light · dark 두 값.
- 위험: 기술(M — 생성식이 어두운 tint · dark 모드에서 단별 목표 대비를 못 풀 수 있다 → 다음 단으로 옮기는 규칙 + G3) / 성능(M — 번들 여유 2 KB 안에서 사다리 표 · 생성 코드를 initial 밖으로 둬야 한다) / 유지보수(L — 출처가 「표 또는 생성식」 하나, alias 표 하나) / 마이그레이션(M — 기본 테마도 글자 gray · status 값이 바뀌어 사용자 프로젝트의 외관이 달라진다. 의도된 변화이고 G0 diff 표 · CHANGELOG 로 기록).

### 대안 D: 생성식만 — 기본값까지 Leonardo 식으로 생성, 표 없음

- 설명: C 에서 design-data 표를 빼고 모든 사다리를 생성.
- 위험: 기술(**H** — 생성식이 Spectrum 의 실제 값 (Leonardo 의 보간 · key color 셋) 을 비트 단위로 재현하지 못한다. 초기값 동일 (Hard 1) 을 만족할 수 없고 게이트 ① 이 영구 FAIL) / 성능(L) / 유지보수(L) / 마이그레이션(M).

### 대안 E: C + 문서 토큰을 alias 타입으로 (`TokenEntry` 에 `ref`)

- 설명: C 의 alias map 을 코드가 아니라 문서 토큰 (`{ ref: "gray-800" }`) 으로 저장해 Spectrum 의 데이터 모양까지 따른다.
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(**H** — 저장 스키마 변경 · ADR-227 §6 유보 (모드별 override) 와 얽힌다. 사용자 요청에 없던 스키마 변경이라 이 ADR 범위 밖 — 결정 지점 ④).

### Risk Threshold Check

| 대안 | HIGH+              | 판정                                             |
| ---- | ------------------ | ------------------------------------------------ |
| A    | 1 (유지보수)       | 기각 — 둘째 조건 (규칙 유지) 을 구조가 못 받는다 |
| B    | 1 (마이그레이션 C) | 기각 — 테마 축 소멸                              |
| C    | 0 (MEDIUM 3)       | 채택                                             |
| D    | 1 (기술)           | 기각 — 초기값 동일 불가                          |
| E    | 1 (마이그레이션)   | 범위 밖 — 스키마 변경은 별도 요청 때             |

HIGH 0 인 대안 (C) 이 있어 루프 종료. C 의 MEDIUM 3 (생성식 · 번들 · 외관 변화) 은 Gates G0 · G3 · G4 가 기계적으로 잰다.

## Decision

**대안 C — 두 축 파이프라인.**

1. **primitive 사다리 (데이터)** — Tone 하나 = gray 13단 (25 · 50 · 75 · 100 ~ 1000) × light · dark. hue 하나 = 16단 (100 ~ 1600) × light · dark. accent 는 tint (또는 사용자 hex) 의 hue 사다리, status 4 (negative = red · informative = blue · positive = green · notice = orange) 와 named hue 19 는 hue 고정 사다리. 기본 preset (blue · neutral) 의 사다리는 **design-data 3.8.2 값 그대로** (표 — `@adobe/spectrum-tokens` 의 `gray-N` · `<hue>-N` light/dark). 다른 Tone · 다른 tint · 사용자 hex 는 **같은 모양으로 생성** — 기준 사다리 (gray 또는 blue) 의 단별 명도 · 바탕 (gray-25 light / dark) 대비를 목표로 oklch 에서 풀고 색조 (h) 와 채도 (c) 만 바꾼다. 생성식 상세는 breakdown §3 (사용자 결정 1).
2. **alias map (코드 표 하나)** — S2 `createTheme` 의 역할 → 단 표를 그대로 옮긴다: base 25 · layer-1 50 · layer-2 25|75 · pasteboard 100|25 · elevated 25|75 · neutral(글자) 800 · neutral-subdued 700 · neutral-content 800 · disabled 100 (면) · 400 (글자) · neutral-subtle 100|300 · neutral-fill 800 · **on-neutral = gray-25 (tone 축 — S2 Button neutral fill 의 글자 `gray-25`, `Button.tsx:234`; dark 에서 `#dbdbdb` 면 위 `#111111` 글자 13.6:1. 흰색 상수가 아니다)** · border 300 · border-hover 400 · accent 900|800 · accent-subtle 200|300 · accent-content 900 · selection-accent 900|800 · accent-fill 900|800 · focus-ring 800 · **status 는 역할 둘** — `<status>` (content: 글자 · 선 · fillBar, 900|900 = S2 `color.negative` = `negative-content-color-default`) · `<status>-fill` (background: 면, 900|800 = S2 `backgroundColor.negative`) · status-subtle 200|300 · named hue 900 (yellow 400|1100) · on-accent · on-negative = white (accent 900|800 · status-fill 900|800 위 흰 글자 4.81 / 4.51 — Hub 「흰 글자」 규칙, 사용자 결정 4) · picker · popover · collection-item-focus · field-placeholder · disabled-content 는 gray 단 (breakdown §2 표). **`raised` 삭제** — rule 7 참조를 `layer-2` 로 (사용자 결정 3). hover · pressed = 같은 사다리 **다음 단** (`nextColorStop` 규칙 — index + 1, light 에서는 어두워지고 dark 에서는 밝아진다) — `mixHexWithBlack` 85 / 75 % 와 CSS `color-mix` 폴백 삭제. 배경 층은 Spectrum 표 그대로 **같은 단을 공유** 한다 (light: base = layer-2 = elevated = 25, layer-1 50, pasteboard 100 / dark: base = pasteboard = 25, layer-1 50, layer-2 = elevated = 75) — elevated 는 shadow 토큰으로 구분하고 「층 5 가 다른 색」 을 요구하지 않는다.
3. **역할 토큰 = 출력** — `colors.ts` 의 `lightColors` · `darkColors` 는 손 값이 아니라 기본 preset 의 파이프라인 출력이다 (생성기 또는 빌드 시 고정 + 게이트 ① 이 동일을 잰다). `semanticPaletteMap` 의 (family, step) 좌표 · `DEFAULT_SURFACE_KEYS` · `LIGHT_MAP` · `DARK_MAP` · `solveAccentRoles` · `TINT_PRESETS` 의 oklch (c, h) 는 사다리 생성 입력으로만 남거나 삭제. 모든 역할이 light · dark 두 값 (accent · on-* · chart-accent 포함).
4. **축 판정은 데이터** — 역할마다 `{ axis: "tone" | "accent" | "status" | "hue" | "constant", step }` 이 alias 표에 적혀 있어 정적 게이트 ② 가 「모든 `{color.*}` 가 표에 있고 그 축 함수의 출력」 을 읽는다. 상수는 white · black · transparent · chart-categorical 8 (사용자 결정 6).
5. **consumer 는 그대로** — DOM 은 `--<role>` 변수 (light/dark 두 블록), Skia 는 `installThemeMaps`. rule TokenRef 이름 무변경. `--tint-N` 사다리 (preview-system.css) 는 accent 사다리 16단을 **같은 값으로** 변수화해 DOM · Skia 가 같은 것을 읽게 한다 (지금은 DOM 전용 oklch 상대색).
6. **Themes 패널 · 색 피커** — Tone 견본은 생성 사다리의 500 단, 색 피커 Theme 묶음은 역할 토큰 그대로 (이름 무변경). Tone preset 이름 5 (slate · gray · zinc · neutral · stone) 는 유지하고 값만 생성 (ADR-295 「이름은 저장소」 선례, 사용자 결정 7).

**위험 수용 근거**: 초기값은 표라 생성식 오차가 Hub 값에 닿지 않고 (G1 oracle = design-data, 외부), 생성식의 실패는 G3 (50 preset × 2 mode 전수 대비 · 층 검사) 가 잡으며 실패 시 「바탕과의 대비가 커지는 방향으로 이동」 규칙 (글자 · 면 역할은 바탕에서 멀어지는 단으로, 전경 (on-\*) 은 바탕 밝기에 따라 gray-25 / white · black 선택) 이 있어 FAIL 이 조용히 지나가지 않는다. 기본 preset 의 역할 쌍 (dark `neutral-fill` #dbdbdb + `on-neutral` #111111 · dark `negative-fill` red-800 + white · dark `negative` red-900 글자 on layer-2) 은 설치 S2 값으로 계산해 4.5 이상임을 확인했다 (리뷰 round 1 h2 · h3 반례의 해소). 번들은 기본 preset 역할 값 (지금과 같은 크기) 만 initial 에 두고 사다리 표 · 생성기는 테마 전환 chunk 로 (G4). 외관 변화는 기본 테마의 글자 gray · status · border 로 한정되고 G0 diff 표가 컴포넌트별로 보여 준 뒤 사용자 confirm 을 받는다.

**기각 사유**: A — 축 변경 시 규칙을 아무도 안 재고 accent 가 모드별 한 값으로 남는다 (둘째 조건 미달). B — 테마 축이 사라진다 (사용자 결정 위반). D — 초기값 동일 불가 (Hard 1 · G1 영구 FAIL). E — 저장 스키마 변경은 이 요청에 없다 (결정 지점 ④, 별도 요청 때 C 위에 얹을 수 있다 — `LibraryToken.ref` 가 이미 반쪽 모양).

> 구현 상세: [302-theme-color-two-axis-spectrum-ladders-breakdown.md](design/302-theme-color-two-axis-spectrum-ladders-breakdown.md)

### 사용자 결정 8 건 (execute-adr 가 그 항목에 닿을 때 묻는다 — 4 결정 지점 밖)

1. **비기본 사다리 생성식** — (a) 기준 사다리 (gray / blue) 의 단별 oklch 명도 L 을 유지하고 c · h 만 바꾼 뒤 바탕 대비가 Hub 단별 목표 (blue 1.06 ~ 19.5:1) 에 못 미치면 L 을 조정 (권고 — 기본값과 같은 모양이 보장된다) vs (b) 단별 목표 대비만으로 풀기 (Leonardo 원형, 명도 모양이 hue 마다 달라진다).
2. **status · named hue 가 비기본 Tone 에서** — (a) Spectrum 값 고정 + G3 검사, 실패하면 그 역할만 다음 단으로 이동 (권고 — Hub 「색은 자기 사다리 안」 규칙 유지) vs (b) Tone 바탕에 대해 사다리를 다시 생성.
3. **`raised`** — (a) 삭제, rule 7 참조 → `layer-2` (권고) vs (b) `elevated`.
4. **on-accent · on-negative** — (a) 흰색 고정 + Hub 「yellow · orange · chartreuse · celery 위는 검정」 규칙을 hue 로 판정 (권고) vs (b) `autoStaticColor` (lch 49.44) 자동. (`on-neutral` 은 결정 사항이 아니다 — tone gray-25, Decision 2.)
5. **문서 override 의 모드별 값** — (a) ADR-227 §6 유보 유지, override 한 값 (권고 — 스키마 0) vs (b) 별도 ADR 로 `TokensSnapshotEntry` 에 dark 값 (대안 E).
6. **chart 색** — (a) chart-accent 1 ~ 4 = accent 사다리 단, chart-categorical 8 = Spectrum 상수 유지 (권고) vs (b) 전부 상수.
7. **Tone preset 이름** — (a) slate · gray · zinc · neutral · stone 유지, 값만 생성 (권고) vs (b) Spectrum 이름으로.
8. **번들 배치** — (a) 사다리 표 · 생성기를 테마 전환 lazy chunk 로, initial 은 기본 역할 값만 (권고) vs (b) initial 에 넣고 ADR-201 상한 재승인.

## Risks

| ID  | 위험                                                                                                                                                          |                심각도                 | 대응                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-----------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 기본 테마 외관 변화 — 글자 gray (`#171717` → `#292929`) · status (Tailwind 500 → Spectrum 900) · border (300) · `raised` 삭제가 사용자 프로젝트 전부에 보인다 |                 HIGH                  | G0 diff 표 (172 키 × 2 mode before/after + 컴포넌트별 영향 rule 수) · CHANGELOG · Phase 1 전 사용자 confirm · live G5 에서 기존 프로젝트 1개 열어 확인 |
| R2  | 생성식이 어두운 tint · dark 모드 · 저채도 사용자 hex 에서 단별 목표 대비를 못 풀어 역할 (accent 900                                                           | 800 · on-accent) 이 4.5 / 3 을 놓친다 | HIGH                                                                                                                                                   | Decision 1 「L 조정 + 바탕에서 멀어지는 방향으로 이동」 규칙 (같은 방향 다음 단이 아니다 — dark gray 사다리는 index 가 클수록 밝다) · G3 50 preset + 사용자 hex 7 × 2 mode 전수 · 실패 시 `warnings` 가 아니라 FAIL |
| R3  | DOM · Skia 비대칭 — CSS `color-mix` 폴백 · `--tint-N` 상대색을 지우면서 한쪽만 바뀐다                                                                         |                 HIGH                  | G4 `themeColorParity` 유지 + 원복 RED (폴백 한 줄 되살리면 hover 쌍 RED) · `--tint-N` 변수 = snapshot 사다리 값                                        |
| R4  | 번들 — 사다리 표 ≈ 4 KB raw · 생성기가 initial 공유 chunk 로 새어 Builder 여유 2,292 B · Preview 1,090 B 를 넘는다                                            |                  MED                  | 사용자 결정 8 (a) · G4 `adr201-bundle-gate.mjs` Δ Builder ≤ +512 B · Preview Δ ≤ +256 B (Preview 는 역할 값 블록만 — 지금과 같은 수)                   |
| R5  | 패널 · 피커 소비처 — `NEUTRAL_PALETTES[...][500]` 견본 · `THEME_PALETTE_GROUPS` · ADR-290 Phase 3 의 피커 accent 칸이 삭제된 심볼을 읽는다                    |                  MED                  | breakdown §2 소비처 표 · `docs:stale-symbols` · type-check                                                                                             |
| R6  | ADR-290 테스트 40+ · `s2NeutralColors` · `s2SurfaceColors` · `catalogTokenExists` 가 옛 값 · 옛 함수를 단언                                                   |                  MED                  | Phase 1 에서 oracle 기반으로 다시 쓴다 — 값 단언은 전부 design-data fixture 참조                                                                       |
| R7  | ADR-191 팔레트 CSS (`--color-{family}-{step}`) 와 테마 사다리가 같은 이름을 다른 값으로 — 사용자 색 피커의 Tailwind 팔레트와 테마 사다리가 섞인다             |                  MED                  | 사다리 변수는 `--tint-N` · `--tone-N` 이름 (팔레트 `--color-*` 와 분리) · 피커의 Tailwind 묶음은 ADR-191 그대로 (테마 밖)                              |
| R8  | hover · pressed 의 「다음 단」 이 사다리 끝 (1600 · 1000) 에서 없다                                                                                           |                  LOW                  | S2 와 같은 오류 (「does not support states」) 대신 끝 단 유지 + 정적 게이트가 alias 표의 모든 상태 쌍을 검사                                           |

## Gates

측정 착수 전 5-질문 (measurement-validity §1): 대상 = 50 preset × 2 mode 의 resolver 출력 + 사용자 hex 7 (§9.6 의 5 + `#000000` 근처 · `#ffffff` 근처) · 불리 케이스 = 어두운 tint (red · brown · cinnamon) × dark · 저채도 hex · Tone stone / slate (색조 있는 gray) · 대조군 = HEAD worktree 의 같은 50 × 2 출력 (G0 diff) · 소비 경로 = `cssVars` → Preview `THEME_VARS` · `installThemeMaps` → Canvas (G4 parity · G5 live) · oracle = design-data 3.8.2 토큰 값 (MCP / `@adobe/spectrum-tokens` JSON — 외부) 과 WCAG 2.x 식 (§9.11 스크립트, Spectrum 자체 값을 통과시키는지 먼저 확인).

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 실패 시 대안                                                           |
| ---- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| G0   | Phase 0 | oracle fixture `adr302-spectrum-color-oracle.json` (gray 13 × 2 · hue 18 × 16 × 2 · S2 alias 표 — 생성기 `adr302-spectrum-color-extract.mjs` 로만 갱신, 손 편집 금지) · 172 키 × 2 mode before/after diff 표 + rule 참조 수 · 번들 before · 사용자 결정 1 · 2 · 3 · 4 · 8 · R1 confirm                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 표에 빈 칸이면 Phase 1 착수 금지                                       |
| G1   | Phase 1 | **초기값 동일** — 기본 preset (blue · neutral · light/dark) 의 모든 역할 토큰 (상수 제외) = oracle 의 alias 가 가리키는 단 값 (정적 `adr302SpectrumOracle.static.test.ts`) · 배경 층 매핑 = S2 표 (light base = layer-2 = elevated · dark base = pasteboard · layer-2 = elevated, elevated 는 shadow 토큰을 rule 이 소비) · status 배경 자리 참조 재분류 66 이 G0 표와 일치 (`{color.<status>}` 가 `backgroundColor` 자리에 0) · `pasteboard` 존재 · `raised` 참조 0 · 원복 RED (alias 한 줄을 옛 단으로 바꾸면 RED)                                                                                                                                                                                                                                                                                                                                                                                                                                            | 값 하나라도 다르면 Phase 닫힘 금지 — oracle 쪽을 고치지 않는다         |
| G2   | Phase 2 | **두 축** — 모든 `{color.*}` (rule 참조 전수 + seed 키 전수) 가 alias 표에 있고 축이 적혀 있다 (`adr302TwoAxis.static.test.ts`) · `semanticPaletteMap` (family, step) · `DEFAULT_SURFACE_KEYS` · `solveAccentRoles` · `mixHexWithBlack` · CSS `color-mix` 폴백 참조 0 · hover/pressed = 다음 단 (단위) · 원복 RED (고정 hex 한 줄 넣으면 RED)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 표 밖 키는 삭제 또는 alias 추가 — 예외 목록 금지                       |
| G3   | Phase 2 | **규칙 유지** — 50 preset + hex 7 × 2 mode: 글자 역할 (neutral · subdued · content · accent-content · status 4 content) on 층 5 ≥ 4.5 · 전경 쌍 기본 상태 (on-accent on accent · accent-fill · selection-accent / on-negative on status-fill / on-neutral on neutral-fill) ≥ 4.5, 같은 쌍의 hover · pressed ≥ 3.0 이고 기본 preset 에서는 Spectrum 자체 값과 같다 (S2 dark hover = 다음 단 900 위 흰 글자 3.51 — Spectrum 이 그렇게 두므로 4.5 를 요구하면 G1 과 충돌) · 활성 면 (accent · accent-fill · selection · status-fill · focus-ring) on base · layer-1 · layer-2 ≥ 3 · **배경 층 = 모드별 역할 → 단 매핑과 순서** (light: pasteboard 100 < layer-1 50 < base = layer-2 = elevated 25 — L 은 그 반대 / dark: base = pasteboard 25 < layer-1 50 < layer-2 = elevated 75; 같은 단 공유는 정상, layer-1 ≠ base · layer-1 ≠ layer-2 는 필수) · 모든 역할 light ≠ dark (상수 · 설계상 같은 단 제외) — `adr302HubRules.test.ts`, 결과 수치를 run 폴더에 기록 | 생성식 보강 (L 조정 폭) → 그래도 FAIL 이면 사용자 결정 1 (b) 로 재질문 |
| G4   | Phase 3 | DOM = Skia — `themeColorParity.browser.test.ts` 50 preset 샘플 10 PASS · `--tint-N` 변수 = snapshot 값 · 번들 Builder Δ ≤ +512 B · Preview Δ ≤ +256 B (`adr201-bundle-gate.mjs`, HEAD worktree 대조) · `docs:stale-symbols` 0 · type-check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 공유 chunk 로 새면 사다리 · 생성기를 전환 chunk 로 (결정 8 a)          |
| G5   | Phase 3 | live (별도 dev 서버, Chrome MCP + 사용자 confirm) — 기본 테마에서 Button accent · Badge negative · TextField · Card 가 Spectrum 값 (스포이드) · Themes 에서 Tone stone + tint red + dark 로 바꿔 layer-1 ≠ layer-2 · Button neutral (dark 밝은 면 + 어두운 글자) · Badge negative 글자 · 면 둘 · hover 가 다음 단 · Preview 와 Canvas 같은 hex · 기존 프로젝트 1개 열어 외관 변화 확인 · 콘솔 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | FAIL 은 `/fix` — 증상 수정 금지                                        |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 테마 색이 accent · tone 두 입력에서만 나온다 — 어느 키가 어느 축에서 오는지 alias 표가 말하고, 정적 게이트가 고정 hex 재유입을 막는다.
- 초기값이 Spectrum 토큰 값과 같고 (design-data oracle), 축을 바꿔도 Hub 규칙 (사다리 · alias · 다음 단 · 대비 · 층 5) 이 유지된다 — 「패턴은 그대로, 값은 기본 preset 만 그대로」.
- 파랑 넷 (accent · selection · focus-ring · informative) 이 한 사다리의 단으로 정리되고, `pasteboard` 가 생기며, 비기본 Tone 의 층 붕괴가 사라진다. status 는 글자 · 면 두 역할로 갈려 dark 에서 둘 다 4.5 를 지킨다.
- ADR-290 의 역할별 탐색 · 검정 혼합 · CSS `color-mix` 폴백 · Tailwind 좌표 표 · `DEFAULT_SURFACE_KEYS` 덮어쓰기가 코드에서 빠져 출처가 하나가 된다.

### Negative

- 기본 테마의 외관이 바뀐다 (글자 gray · status · border · `raised`) — 사용자 프로젝트 전부에 보이는 변화 (R1).
- dark 의 hover · pressed 면 (accent-900 · red-900 dark) 위 흰 글자는 Spectrum 값 그대로 3.51 이다 — Hub 의 4.5 는 기본 상태 기준으로 지키고 상태 진행은 Spectrum 의 선택 (다음 단) 을 따른다. 더 올리려면 Spectrum 과 달라진다.
- rule 의 status 배경 자리 참조 66 이 `{color.<status>-fill}` 계열로 바뀐다 (이름 체계 안의 재분류 — 생성 CSS 재생성).
- ADR-290 의 accent 탐색은 대체된다 (Superseded in part) — 그 테스트 40+ 를 다시 쓴다.
- 사다리 표 (≈ 600 hex) 가 생겨 테마 전환 chunk 가 늘고, 생성식이라는 새 코드가 들어온다 (Hub 는 Leonardo 를 쓰지만 우리는 oklch 자체 구현).
- 문서 override 는 여전히 모드별 한 값 (ADR-227 §6 유보) — 생성값만 두 벌이라 override 한 키는 light · dark 가 같아진다 (지금과 같은 한계).
- Tone 5 · tint 10 의 비기본 값은 Hub 에 없는 조합이라 「Spectrum 값」 이 아니라 「Spectrum 모양」 이다 — 외부 oracle 이 없고 규칙 검사 (G3) 만 있다.
