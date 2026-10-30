# ADR-290: Theme Accent 를 목표 대비로 정하기 — 역할별 accent 토큰 · 모드별 명도 계산 · 두 렌더러에 같은 hex

## Status

Implemented — 2026-10-30 (G5 — 사용자 「확인했다」, 5173 Builder). Accepted 같은 날 (리뷰 [reviews/290.md](../reviews/290.md) round 2 pending 0 · CRITICAL/HIGH 전부 fixed + 사용자 `/execute-adr 290`).

- 사용자 결정 4건 (2026-10-30, 전부 권고안): 1 dark on-accent = 흰색 · 2 사용자 hex 는 자기 명도에서 · 3 대비 표시 넣지 않음 · 4 브랜드 Tone 범위 밖.

> **Phase 0 (2026-10-30)**: accent 참조 48 곳 분류 (본문 43 은 hover · pressed 키 누락 — breakdown §5). RED a ~ d 는 계산으로 확인 (dark 배경 역할 3.29 ~ 3.93 · dark 바탕 위 · light green/turquoise 글자 · `#00A86B` 4.42). **RED e · f 는 [ADR-293](293-theme-color-single-source-resolver-to-dom.md) 이 이미 닫았다** — DOM accent-pressed 가 resolver 값을 읽고 (preview-system 50% 식 삭제) 색 변수가 forced-colors media 안에 있다. Decision 5 의 남은 몫은 새 변수 2 개의 forced-colors 시스템 색뿐. 본문이 적은 `--fg-on-accent-pressed` 토큰은 없다 (forced-colors 블록의 DOM 변수만).
> **Phase 1 (2026-10-30)**: `accentContrast.ts` (WCAG 대비 · `solveLightness`) · `createAccentColorTokens` 역할별 탐색 · resolver 순서 (Tone → 명시 색 델타 → accent 탐색 → 명시 accent 계열 덮기) · 사용자 hex 는 자기 명도 · 통과하면 hex 그대로. G1 단위 40 + 사다리 1 PASS (breakdown §6 결과표).
> **Phase 2 (2026-10-30)**: 토큰 `accent-content` · `accent-content-hover` (rendering 표 · seed · 타입) · rule 재분류 27 + DOM 상태 선택자 14 · Slider thumb 생성식 · show-all · Menu 글리프 · forced-colors `LinkText`. 생성 CSS 16 파일 재생성. G2 정적 (`adr290AccentRoles.static.test.ts` — 분류표 oracle 48 + 바탕 유도 27) PASS · 변이 RED 4/4.
> **Phase 3 (2026-10-30)**: 색 피커 Theme 사다리에 탐색된 accent · accent-content 칸 (Tone 변경에 다시 계산). `MiniThemePreview` 는 accent 를 그리지 않고 `resolveAccentColorTokens` 는 production 소비처가 없어 (테스트만) 바꿀 것 없음. 결정 3 (대비 표시) 은 넣지 않음.
> **Phase 4 (2026-10-30)**: G3 live 14/14 PASS · Canvas 설치 맵 4/4 · Publish 1 · forced-colors 1 (아래 `### Live Exercise`). **G4 미달** — Builder initial JS gzip +1,253 B (게이트 +1 KB, 경고 문구 축소 뒤 값), Preview +64 B. 절대 상한 (1,390,000 B) 안 (1,363,539). G5 확인 요청에 함께 보고했고 사용자는 「확인했다」 로 답했다 — 별도 축소 지시 없이 수용으로 기록한다.
> **G5 (2026-10-30)**: 사용자 「확인했다」 — 5173 Builder (이 작업 트리의 dev 서버) 에서 dark accent 버튼 · Link · Badge 확인.

- 사용자 요청: `/create-adr` (2026-10-29) — 같은 대화의 Adobe 공개 저장소 분석 검증 뒤.
- 방향을 정한 사용자 원문 (2026-10-28 ~ 29, 같은 대화):
  - 「Leonardo: 는 Theme 의 Accent, Tone 선택 Token 에 자동화 에 영향을 줄수있는지 분석해」 → Accent · Tone 파생 경로 실측과 대비 계산 (Context §현재 · §계산).
  - 「도입할만한건가」 → 권고: Leonardo 패키지는 넣지 않고, 「목표 대비로 명도 정하기」 계산을 테마 resolver 안에 직접 구현. 이 권고 직후 `/create-adr` 입력 — 이 ADR 은 그 방향 (대안 C) 을 채택안으로 쓴다.
- 사용자가 이미 답한 확인 항목: 없음. 시각 결과가 바뀌는 선택은 아래 「사용자 결정 4건」 에 모았다.
- 리뷰 round 1 (2026-10-29, codex — [reviews/290.md](../reviews/290.md)): HIGH 1 · MEDIUM 2 를 설계에 반영 — H1 accent 하나를 배경과 글자에 같이 쓰면 dark 에서 대비를 만족하는 명도가 없다 → **역할별 토큰 둘** (Decision 1) · M2 탐색의 바탕 입력이 실제 인접 surface 와 연결되지 않음 → Tone · 명시 델타를 반영한 뒤 역할별 인접 surface 목록으로 탐색 (Decision 2) · M3 명시 색 델타도 layer 없는 변수로 forced-colors 를 이김 → 테마 색 변수 전체를 `@media not (forced-colors: active)` 안에 (Decision 5). 판독이 지적하지 않은 같은 계열 두 건도 같이 반영 — accent 를 글자로 쓰는 곳은 Button outline 외에 Link · Badge · DropZone 도 있고, light 에서도 green 계열 글자가 layer-1 위 4.37 로 미달.
- 리뷰 round 2 (2026-10-29, codex 수리 검증): round 1 세 수리는 fixed 로 인정, HIGH 1 — `accent-content` 의 대비 대상에 Badge subtle 의 실제 바탕 `accent-subtle` 이 빠짐 (light blue `#3660f0` 대 `#daeeff` 4.32 · green 4.15 · turquoise 4.14). 수리: 대비 대상을 고정 목록 대신 **catalog rule 에서 유도한 실제 바탕 집합**으로 (Decision 2) — `accent-subtle` 은 파생 · 명시 델타를 탐색 전에 해석. 같은 계열로 ProgressBar 채움 (accent) 이 `accent-subtle` track 위에 놓이는 것도 실행자 확인 (`componentRulesTable.ts` `ProgressBarTrack`). 수리 검증 HIGH 는 실행자가 반영으로 닫는다 (`review-loop-closure.md` §1 — 라운드 재개 없음).
- 메모리: `project-theme-accent-contrast-leonardo-analysis-2026-10` (이 ADR 의 실측 원본) · `reference-design-data-mcp-installed-query-traps` · `feedback-design-whole-scope-upfront-no-deferral` (설계는 처음부터 전체 범위) · `feedback-no-document-migration-code-dev-stage` (마이그레이션 코드 금지).

> 구현 상세: [design/290-theme-accent-contrast-breakdown.md](../design/290-theme-accent-contrast-breakdown.md)

## Context

### 도메인

**D3 시각 스타일** (theme/tokens root collection — ADR-110 · ADR-227 · catalog `COMPONENT_RULES_TABLE`). 테마 resolver 가 만든 색 토큰을 Builder (Skia) 와 Preview · Publish (DOM + CSS) 가 대등하게 소비한다. 새 색 토큰 키 (`accent-content` · `accent-content-hover`) 는 D3 토큰이고 prop 이 아니다 — D1 (RAC DOM · ARIA) · D2 (S2 prop) 는 건드리지 않는다. 문서 스키마 (`ThemeDefinition` · `ThemePreset` · `TokensSnapshot`) 는 바꾸지 않는다. 생성 CSS 는 catalog rule 의 `{color.<key>}` 를 `colorTokenToCss` 표로 옮기므로 새 키는 그 표에 한 줄씩이면 generator 가 그대로 낸다 (선택자 · variant 확장 아님).

### 현재 (실측 2026-10-29, main `92b07f182`)

| 사실                                                                                                                                                                                                                                                                                                                                      | 위치                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accent 는 tint 프리셋 10 의 (chroma, hue) 또는 사용자 hex 의 (chroma, hue) 만 쓰고, 명도는 두 모드 모두 55% 고정                                                                                                                                                                                                                          | `packages/shared/src/catalog/runtime/tintToSkiaColors.ts:86` `LIGHTNESS` · `:131` `createAccentColorTokens` · `resolveThemeSnapshot.ts:108` `tintOf`                                       |
| hover · pressed = accent 에 검정 85% · 75% 혼합, on-accent 고정 (light `#ffffff` · dark `#171717`)                                                                                                                                                                                                                                        | `tintToSkiaColors.ts:152 ~ 154`                                                                                                                                                            |
| **accent 토큰 하나가 세 역할을 한다** — catalog rule 의 `{color.accent}` 43 곳: 배경 (`base` 6 · `hover` 3 · `pressed` 3 · `selected` 5), 바탕 위 글자 (`text` 2 · `outlineText` 2 · `textHover` 2 · `subtleText` 1), 선 · 표시 (`border` 7 · `selectedBorder` 6). 생성 CSS 에서 글자로 쓰는 곳: Button outline · Link · Badge · DropZone | `packages/shared/src/catalog/generated/componentRulesTable.ts` · `packages/shared/src/components/styles/generated/Button.css:55 ~ 58` · `Link.css:29` · `Badge.css:53` · `DropZone.css:41` |
| Tone = Tailwind 회색 5 종 + 고정 단계표 (토큰 13)                                                                                                                                                                                                                                                                                         | `neutralToSkiaColors.ts` `LIGHT_MAP` · `DARK_MAP`                                                                                                                                          |
| accent 파생은 Tone · 명시 surface 델타보다 **먼저** 계산된다 (바탕을 모른 채)                                                                                                                                                                                                                                                             | `resolveThemeSnapshot.ts:162 ~ 177` (seed) → `:220 ~ 240` (명시 델타)                                                                                                                      |
| DOM 은 `--tint` 하나에서 상대 색 문법으로 계산 — `--accent` = `oklch(from var(--tint) 55% c h)` · `--accent-pressed` = **50%**                                                                                                                                                                                                            | `packages/shared/src/components/styles/theme/preview-system.css:159 ~ 166`                                                                                                                 |
| DOM 의 dark on-accent = 고른 Tone 의 `neutral-900` (Skia 는 `#171717` 고정)                                                                                                                                                                                                                                                               | `preview-system.css:288` · `packages/rendering/src/primitives/colors.ts:85`                                                                                                                |
| catalog 의 `{color.accent-pressed}` → DOM `var(--accent-pressed, color-mix(… 75%, black))` — preview-system 이 `--accent-pressed` 를 50% 식으로 정의해 두어 Skia 75% 혼합과 다르다                                                                                                                                                        | `packages/shared/src/catalog/resolvers/colorTokenToCss.ts:82 ~ 85`                                                                                                                         |
| resolver 가 DOM 에 직접 싣는 색: seed 의 `--tint` · `--accent-subtle` · `--border-hover` (`:200 ~ 208`) **와 명시 색 델타 전부** (`:234` `both(colorTokenCssVarName(key), value)` — `--fg-muted` · `--bg-muted` · `--accent-subtle` 같은 의미 변수 이름 그대로)                                                                           | `resolveThemeSnapshot.ts`                                                                                                                                                                  |
| 명시 색 델타는 light · dark 에 같은 값 — 모드별 값 저장 자리 없음                                                                                                                                                                                                                                                                         | `resolveThemeSnapshot.ts:226 ~ 234`                                                                                                                                                        |
| DOM 설치는 한 곳 — `runtime-theme-vars` style 에 layer 없는 `:root` · `[data-theme="dark"]` 블록. Preview 와 Publish 가 같은 함수를 쓴다                                                                                                                                                                                                  | `packages/shared/src/catalog/runtime/domView.runtime.ts:11 ~ 28` · `apps/publish/src/catalogSession.ts:3` · `:20`                                                                          |
| forced-colors 블록은 `@layer preview-system` 안에서 `--accent` · `--accent-subtle` · `--border-hover` · `--fg-on-accent` 등을 시스템 색으로 덮는다 — layer 없는 runtime 블록이 이기므로 resolver 가 실은 변수는 forced-colors 에서도 테마 값으로 남는다                                                                                   | `preview-system.css:12` · `:364 ~ 374`                                                                                                                                                     |
| Themes 패널 Accent 10 · Tone 5 견본 선택                                                                                                                                                                                                                                                                                                  | `apps/builder/src/builder/panels/themes/ThemesPanel.tsx:318` · `:332`                                                                                                                      |
| 색 피커 Theme 팔레트의 accent 사다리도 같은 고정 명도표                                                                                                                                                                                                                                                                                   | `tintToSkiaColors.ts:107` `resolveAccentLadder` · `ColorPickerPalettes.components.tsx:140`                                                                                                 |
| S2 1.8.1 은 역할을 나눈다 — Button accent fill 글자는 두 모드 모두 `white` (배경 light `accent-900` · dark `accent-700`), 바탕 위 글자는 `accent-content-color-*` 토큰 계열                                                                                                                                                               | `node_modules/@react-spectrum/s2/src/Button.tsx:154 ~ 158` · `:236` · design-data `color-aliases.tokens.json` `accent-content-color-default`                                               |

### 계산 (2026-10-29, WCAG 2 상대 휘도 · 코드 공식 그대로 계산 — 화면 측정 아님)

| 항목                                                                                                                                 | 값                                                                                                                    | WCAG 기준                                           |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| light accent 대 `#ffffff` (프리셋 10, 배경 역할)                                                                                     | 4.57 ~ 5.44                                                                                                           | 일반 글자 4.5 — 통과                                |
| light accent 대 layer-1 `#fafafa` (글자 역할, green · turquoise)                                                                     | 4.37 · 4.49                                                                                                           | **미달**                                            |
| dark accent 대 `#171717` 글자 (프리셋 10, 배경 역할)                                                                                 | 3.29 ~ 3.93                                                                                                           | **10 종 전부 미달**                                 |
| dark accent 를 바탕 `#171717` 위 글자로 (Button outline · Link, 같은 값)                                                             | 3.29 ~ 3.93                                                                                                           | **미달**                                            |
| dark blue accent 대 layer-1 `#262626` · neutral-subtle `#404040` (Slider · Meter track)                                              | 2.95 · 2.02                                                                                                           | 비글자 3.0 — **미달**                               |
| dark 에서 한 색으로 두 역할: 흰 글자 4.5 를 얹을 수 있는 명도 상한 vs 바탕 위 글자 4.5 의 명도 하한 (blue · green · yellow · indigo) | 상한 0.580 · 0.555 · 0.570 · 0.600 vs 하한 0.615 · 0.585 · 0.605 · 0.640 (layer-1 이면 0.670 · 0.630 · 0.650 · 0.690) | **겹치는 구간 없음**                                |
| dark hover · pressed (검정 85% · 75%) 대 바탕 `#171717`                                                                              | 2.58 ~ 3.03 · 2.18 ~ 2.54                                                                                             | 기본 상태 3.29 ~ 3.93                               |
| 사용자 hex `#00A86B` → 55% 로 접힌 `#008a50` 대 흰 글자                                                                              | 4.42                                                                                                                  | 미달                                                |
| 사용자 hex `#FFCC00` → `#996800` · `#1E3A8A` → `#4a6dc1`                                                                             | 4.84 · 4.94                                                                                                           | 통과하지만 브랜드색이 바뀜 (`#1E3A8A` 자체는 10.36) |
| accent-pressed blue: DOM 50% `#294fde` 대 Skia 75% 혼합 `#2948b4`                                                                    | —                                                                                                                     | 두 렌더러 결과 다름 (코드상)                        |
| Tone 5 종 글자 (`neutral` · `neutral-subdued` 대 바탕 · layer-1)                                                                     | light 7.23 ~ 17.93 · dark 5.56 ~ 16.44                                                                                | 전부 통과                                           |

### 문제

1. **accent 하나가 배경 · 글자 · 표시 세 역할을 하고, dark 에서는 셋을 동시에 만족하는 명도가 없다.** 흰 글자를 얹는 배경은 어두워야 하고, 어두운 바탕 위 글자 · 표시는 밝아야 한다 (§계산 「겹치는 구간 없음」). 지금 값은 dark 배경 역할 (글자 `#171717`) 도, 바탕 위 글자 역할도 미달이다. light 에서도 green 계열 글자가 layer-1 위에서 미달이다.
2. **명도를 정할 때 실제 인접 surface 를 모른다** — accent 가 Tone · 명시 surface 델타보다 먼저 계산되고, 인접 surface 는 역할마다 다르다 (글자 = base · layer-1 · layer-2 · elevated, track 위 채움 = neutral-subtle).
3. **사용자 hex 는 명도를 버린다** — 고정 55% 라서 이미 통과하는 브랜드색도 바뀌고 (`#1E3A8A`) 접힌 결과가 미달일 수도 있다 (`#00A86B`).
4. **두 렌더러가 다른 공식을 쓰는 자리가 둘** — accent-pressed (DOM 50% · Skia 75% 혼합), dark on-accent (DOM Tone 의 neutral-900 · Skia 고정). D3 대칭 위반 의심 (live 미확인 — Phase 0 에서 확인).
5. **forced-colors 에서 테마 값이 시스템 색을 이긴다 (의심)** — seed 의 두 변수와 명시 색 델타 전부가 layer 없는 블록에 실려, layer 안의 forced-colors 덮어쓰기보다 우선한다.

### 제약

- **hard**: ADR-201 initial 번들 상한 (Builder ≤ 1,390,000 B · Preview ≤ 320,000 B gzip) — resolver 는 Builder · Preview · Publish 가 테마를 설치할 때 **동기로** 부르는 경로라 지연 로드할 수 없다 (`resolveThemeSnapshot` → `applyCatalogPreviewTheme`).
- **hard**: 두 렌더러가 같은 SSOT 에서 같은 시각 결과 (ssot-hierarchy §D3). 계산 결과는 CSS 식으로 표현할 수 없으니 DOM 에는 hex 를 실어야 한다.
- **hard**: 문서 스키마 무변경 · 마이그레이션 코드 금지 — 기존 문서는 다시 열면 새 계산이 적용된다.
- **hard**: WCAG 2.2 — 일반 글자 4.5 (1.4.3) · UI 구성요소 식별에 필요한 시각 정보 3.0 (1.4.11).
- **soft**: Leonardo (`@adobe/leonardo-contrast-colors` 1.1.0) 마지막 push 2026-07-08, 의존성 5 (chroma-js · apca-w3 · ciecam02 · hsluv · ciebase).

## Alternatives Considered

### 대안 A: Leonardo 패키지를 resolver 에서 부른다

- 설명: `Theme` · `BackgroundColor` · `Color({ colorKeys, ratios })` 로 모드별 accent 사다리를 만들고 결과 hex 를 Skia 맵 · DOM 변수에 싣는다.
- 외부 근거: Leonardo `contrast-colors` README — 배경과 목표 대비 배열에서 색을 푼다. Adobe Spectrum 팔레트 생성에 쓰인 도구.
- 위험: 기술 LOW (검증된 라이브러리) / 성능 **HIGH** (의존성 5 가 Preview · Publish initial 로 — 지연 로드 불가) / 유지보수 MEDIUM (3 개월 정체 · 우리가 쓰는 것은 명도 탐색 하나) / 마이그레이션 LOW. 역할 분리 문제 (문제 1) 는 이 대안도 따로 풀어야 한다.

### 대안 B: Leonardo 를 Themes 패널에서 지연 로드하고 결과를 토큰으로 저장

- 설명: 편집할 때만 패키지를 불러 계산하고, 결과 hex 를 테마 `tokens` 델타로 저장한다. resolver 는 저장값만 읽는다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (Accent · Tone 을 바꿀 때마다 저장값과 preset 이 어긋날 수 있다) / 마이그레이션 **HIGH** (모드별 델타 자리가 없어 `TokensSnapshot` 스키마 변경 필요 — `resolveThemeSnapshot.ts:226 ~ 234`)

### 대안 C0: accent 하나를 그대로 두고 resolver 안에서 명도만 탐색

- 설명: 토큰은 지금처럼 하나, 모든 역할의 조건을 한 번에 만족하는 명도를 찾는다.
- 위험: 기술 **CRITICAL** — dark 에서 조건을 동시에 만족하는 명도 구간이 없다 (§계산). 어느 한 역할은 반드시 미달로 남는다.

### 대안 C: 역할별 accent 토큰 둘 + resolver 안 목표 대비 명도 탐색 (채택)

- 설명: accent 를 **배경 역할 `accent`** (위에 on-accent 글자 · 아이콘을 얹는 면) 과 **바탕 위 역할 `accent-content`** (surface 위에 바로 놓이는 글자 · 선 · 표시 막대) 로 나눈다. 각 역할을 Tone 과 명시 델타가 반영된 인접 surface 에 대해 목표 대비가 나올 때까지 명도 탐색한다. (chroma, hue) 는 그대로, 결과 hex 를 Skia 맵과 DOM 변수에 모드별로 같이 싣는다. 새 의존성 0.
- 외부 근거: S2 의 `accent-background-color-*` 와 `accent-content-color-*` 분리 (design-data `color-aliases.tokens.json`) · S2 Button fill 글자 `white` (`Button.tsx:236`). Leonardo 의 핵심과 같은 계산 (배경 · 목표 대비 → 명도).
- 위험: 기술 LOW (순수 함수 · 단위 테스트로 전수 확인) / 성능 LOW (테마 하나에 모드 2 × 역할 2 × 탐색 ≤ 20 회) / 유지보수 MEDIUM (catalog rule 43 곳의 역할 분류 — 한 번 정하면 규칙 하나로 유지) / 마이그레이션 MEDIUM (dark 글자색 · 바탕 위 accent 색 · 사용자 hex 결과가 바뀐다 — 스키마 변경 0)

### 대안 D: 공식은 그대로 두고 dark on-accent 만 흰색으로

- 설명: `tintToSkiaColors.ts:154` 와 `preview-system.css:288` 을 흰색으로 바꾼다. 프리셋 10 의 배경 역할은 이것만으로 4.57 ~ 5.44.
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (문제 1 의 글자 · 표시 역할 미달 · 사용자 hex · 공식 차이 · forced-colors 가 전부 남는다) / 마이그레이션 LOW

### Risk Threshold Check

| 대안 | HIGH+                             | 판정                                                            |
| ---- | --------------------------------- | --------------------------------------------------------------- |
| A    | 성능 HIGH                         | 번들 상한 · 동기 경로 제약으로 회피 불가 → 기각                 |
| B    | 유지보수 HIGH · 마이그레이션 HIGH | 스키마 변경 필요 → 기각                                         |
| C0   | 기술 CRITICAL                     | 근본적으로 다른 접근 필요 → 역할 분리 (C) 추가                  |
| C    | 없음                              | 채택                                                            |
| D    | 유지보수 HIGH                     | 문제 대부분을 남김 → 기각 (글자색 변경은 C 의 결정 3 으로 흡수) |

루프 2 회 (C0 CRITICAL → C) 로 HIGH 0 대안 확보.

## Decision

**대안 C 채택.** accent 를 역할 둘로 나누고, 테마 resolver 안에서 각 역할을 실제 인접 surface 에 대한 목표 대비로 정해, 그 결과를 두 렌더러에 같은 hex 로 싣는다.

1. **역할별 토큰** — 분류 규칙 하나: **같은 상태에서 그 면 위에 다른 색 (on-accent) 을 얹으면 `accent`, surface 위에 바로 놓이면 `accent-content`.**
   - `accent` · `accent-hover` · `accent-pressed` (배경): rule 의 `base` · `hover` · `pressed` · `selected`, 그리고 같은 상태에서 배경이 accent 인 자리의 `border` (Button accent fill 의 테두리 = 배경색).
   - `accent-content` · `accent-content-hover` (바탕 위): `text` · `outlineText` · `subtleText` · `textHover`, 배경이 accent 가 아닌 자리의 `border` · `selectedBorder` (Input focus · Card 선택 · ColorSwatch), track 위 채움 (ProgressBar · Slider · Meter).
   - 43 곳 전수 분류표는 Phase 0 에서 만들고 breakdown 에 둔다. 생성 CSS 는 rule 에서 나오므로 rule 을 고치면 같이 바뀐다. `colorTokenToCss` 에 `accent-content` · `accent-content-hover` 두 줄을 더한다.
2. **실제 바탕을 알고 탐색** — resolver 순서를 바꾼다: Tone (neutral) → 명시 surface 델타 (`color.base` 등) → `accent-subtle` (파생 또는 명시 델타) → **accent 탐색** → 명시 accent 계열 델타 (있으면 탐색 결과를 덮음). 대비 대상은 손으로 정한 목록이 아니라 **catalog rule 에서 유도한 바탕 집합**이다 — `accent-content` 를 쓰는 모든 rule 자리 (글자 · 테두리 · track 채움) 에 대해, 같은 컴포넌트 · 같은 상태에서 그 아래에 칠해지는 배경 토큰을 모은다 (Phase 0 표, 정적 테스트가 rule 변경 때 다시 유도). 현재 코드에서 아는 원소: `base` · `layer-1` · `layer-2` · `elevated` · `neutral-subtle` · `accent-subtle` (Badge subtle 바탕 · ProgressBar track · 선택 행). 역할별 조건:
   - `accent`: on-accent 글자 ≥ 4.5 (기본 · hover · pressed 전부 — 흰 글자 위에서 검정 혼합은 대비를 올린다) · 기본 상태가 `base` 와 ≥ 3.0.
   - `accent-content`: 유도한 바탕 집합에서 글자가 놓이는 바탕 전부와 ≥ 4.5, 글자 없이 선 · 채움만 놓이는 바탕 (track 등) 과 ≥ 3.0. 한 바탕에 글자와 채움이 둘 다 놓이면 4.5.
   - `accent-content-hover`: 같은 바탕 집합에 대해 4.5 + 1.0 목표로 탐색 — 바탕에서 멀어지는 방향이 모드에 따라 자동으로 정해진다 (light 는 어둡게, dark 는 밝게).
   - 탐색 함수 하나 (`accentContrast.ts`): 시작 명도가 조건을 만족하면 그대로 두고, 아니면 통과 구간에서 시작 명도에 가장 가까운 끝값. 구간이 비면 글자 조건만으로 풀고 `warnings` 에 남긴다.
3. **on-accent 와 상태색** — on-accent 는 두 모드 모두 흰색 (S2 와 같음 — 사용자 결정 1 권고안). `accent-hover` · `accent-pressed` 는 지금처럼 검정 85% · 75% 혼합. 이 둘의 `base` 대비 (dark 2.18 ~ 3.03) 는 조건으로 두지 않는다 — 1.4.11 은 구성요소를 **식별하는** 시각 정보를 요구하고, 누르는 동안의 상태 차이는 기본 상태 경계 (≥ 3.0) 와 글자 (≥ 4.5) 가 이미 보장한 위에 얹힌다. S2 도 dark hover 에서 배경을 바꾼다 (`Button.tsx:156`). 이 판단은 R7 로 기록한다.
4. **시작 명도** — 프리셋은 55% (현재 값). 그래서 **light 프리셋의 `accent` (배경) 값은 바뀌지 않는다** (10 종 모두 흰 글자 4.57 이상 · 바탕 3.0 이상). `accent-content` 는 같은 55% 에서 출발해 미달일 때만 움직인다 (light 는 green · turquoise 만, dark 는 전부). 사용자 hex 는 **hex 자신의 명도**에서 출발 (사용자 결정 2).
5. **DOM 설치와 forced-colors** — resolver 가 모드별 `--accent` · `--accent-hover` · `--accent-pressed` · `--fg-on-accent` · `--fg-on-accent-pressed` · `--accent-content` · `--accent-content-hover` 를 Skia 맵과 같은 객체에서 싣는다. `ThemeCssVar` 에 색 여부를 표시하고, `applyCatalogPreviewTheme` (Preview · Publish 공용 설치 한 곳) 은 **색 변수 블록 전체를 `@media not (forced-colors: active)` 안에** 둔다. seed 와 명시 델타가 같은 경로라 둘 다 forced-colors 에서 layer 안 시스템 색에 양보한다. 반경 · 글꼴 · 테두리 폭 변수는 media 밖에 남긴다. (설치 범위를 테마 색 전체로 넓히는 것은 [ADR-293](293-theme-color-single-source-resolver-to-dom.md) — 이 7 변수는 그 부분집합. 2026-10-30)
6. **같은 계산을 쓰는 표면** — 색 피커 Theme 팔레트 (`resolveAccentLadder`) · Themes 패널 미리보기 (`MiniThemePreview`) · 요소별 accent (`resolveAccentColorTokens`).
7. **Tone 은 바꾸지 않는다** — 5 종 모두 글자 대비가 통과한다. accent 탐색의 입력 (surface) 으로만 쓴다. 브랜드색으로 물든 Tone 은 사용자 결정 4.
8. **chart accent 4 단계 · `--tint-N` 사다리 (DOM 전용 link · focus-ring)** 는 지금 공식을 유지한다 (`--tint` 는 계속 싣는다). chart 는 장식 단계이고, link · focus-ring 은 catalog rule 이 쓰지 않는 DOM 전용 변수다.

**위험 수용 근거**: 남는 것은 시각 변화 (dark 글자 · 바탕 위 accent · 사용자 hex) 와 rule 43 곳의 분류 정확성이다. 스키마 · 저장은 그대로라 결과가 마음에 들지 않으면 커밋을 되돌리면 된다. 탐색은 순수 함수라 프리셋 10 × 모드 2 × 역할 2 × Tone 5 와 hex 표본을 단위 테스트로 전수 확인한다. 분류는 규칙 하나로 정하고 정적 테스트가 지킨다.

**기각 사유**:

- **A**: 의존성 5 가 Preview · Publish initial 에 들어간다. 동기 경로라 지연 로드할 수 없다. 쓰는 기능은 명도 탐색 하나뿐이다.
- **B**: 모드별 저장 자리가 없어 스키마를 바꿔야 하고, preset 과 저장값이 어긋나는 상태가 생긴다.
- **C0**: dark 에서 배경 역할과 바탕 위 역할을 동시에 만족하는 명도가 없다.
- **D**: 배경 역할 하나만 고치고 글자 · 표시 역할 미달과 나머지 문제를 남긴다.

### 사용자 결정 4건 (execute-adr 가 그 항목에 닿을 때 묻는다)

1. **dark on-accent 글자색** — (권고) 흰색, S2 와 같음 · `accent` 명도는 지금 그대로 / 대안: 어두운 글자 유지, 그러면 dark `accent` 명도가 ~65% 로 올라가 버튼 배경이 밝아지고 hover · pressed 는 밝히는 방향으로 바뀐다.
2. **사용자 hex 의 시작 명도** — (권고) hex 자신의 명도 (통과하면 브랜드색 그대로) / 대안: 지금처럼 55% 에서 출발.
3. **Themes 패널에 대비 표시** — (권고) 넣지 않음 (자동으로 맞추므로 사용자가 판단할 일이 없음) / 대안: Accent 견본 아래 「글자 대비 4.8 : 1」 한 줄.
4. **브랜드색으로 물든 Tone** — (권고) 이 ADR 범위 밖 (Tone 은 결함 없음) / 대안: Tone 에 「Accent 따라감」 견본 추가.

## Risks

| ID  | 위험                                                                                                                                        | 심각도 | 대응                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------- |
| R1  | dark 모드를 쓰는 모든 프로젝트의 accent 배경 위 글자색이 바뀐다 (어두운 글자 → 흰색)                                                        | MEDIUM | 사용자 결정 1 · G3 live 에서 dark 로 Button · Checkbox · Switch · ToggleButton 확인                                     |
| R2  | 바탕 위 accent (Link · outline Button · Badge · focus 테두리 · track 채움) 가 dark 에서 밝아지고 light green · turquoise 는 조금 어두워진다 | MEDIUM | G1 결과표 (프리셋 × 모드 × 역할) 를 breakdown 에 기록 · G3 live                                                         |
| R3  | rule 43 곳 분류가 틀리면 그 자리만 다른 역할 색을 쓴다                                                                                      | MEDIUM | Phase 0 분류표 + 정적 테스트 (같은 상태 배경이 accent 인 rule 의 글자 · 테두리 판정) · G3 에서 분류별 대표 1 컴포넌트씩 |
| R4  | 사용자 hex 를 쓰는 테마의 accent 가 바뀐다 (`color.accent` 델타가 있는 테마만)                                                              | MEDIUM | 사용자 결정 2 · G1 hex 표본 20 결과표                                                                                   |
| R5  | forced-colors 에서 테마 색이 빠진다 (의도 — 시스템 색이 이긴다). 반경 · 글꼴이 같이 빠지면 결함                                             | MEDIUM | 색 변수만 media 안 · G3 forced-colors 에뮬레이션에서 accent · subtle · 명시 델타 1 이 시스템 색이고 반경은 테마 값      |
| R6  | 두 조건을 동시에 만족하는 명도가 없는 hue · chroma (dark 고채도 green 의 `accent`)                                                          |  LOW   | 글자 대비 우선 + `warnings` · G1 표본에 극단 hex 포함                                                                   |
| R7  | dark `accent-hover` · `accent-pressed` 의 바탕 대비가 2.18 ~ 3.03 (기본 3.29 이상)                                                          |  LOW   | Decision 3 의 판단 기록 · 사용자가 다르게 판정하면 상태색도 경계 조건으로 탐색 (함수는 같다)                            |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                         | 실패 시 대안                                                                                   |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| G0   | Phase 0 끝 | 분류표 43 곳 완료 · RED 6 확인 — dark 배경 역할 대비 미달 · dark 바탕 위 역할 미달 (outline · Link) · light green 글자 layer-1 미달 · hex `#00A86B` 미달 · accent-pressed DOM ≠ Skia · forced-colors 에서 명시 델타 1 이 테마 값. pressed 와 dark on-accent 는 `/cross-check` 로 화면 차이 확인                                                                                                                   | 화면 차이가 없으면 해당 RED 를 결함 아님으로 기록하고 그 수리 항목을 범위에서 뺀다 (사후 보고) |
| G1   | Phase 1 끝 | 단위: 프리셋 10 × 모드 2 × Tone 5 에서 `accent` (흰 글자 ≥ 4.5 · base ≥ 3.0) · `accent-content` (유도한 바탕 집합 — 글자 바탕 ≥ 4.5 · 선 · 채움 바탕 ≥ 3.0, `accent-subtle` 포함) 전부 통과 · 명시 `color.accent-subtle` 테마에서 탐색이 그 값을 씀 · light 프리셋 `accent` hex 가 변경 전과 같음 · 명시 surface 델타 (`color.base` 를 바꾼 테마) 에서 탐색이 그 값을 바탕으로 씀 · hex 표본 20 통과 또는 warning | 탐색 조건 · 시작 명도 재검토                                                                   |
| G2   | Phase 2 끝 | 단위: snapshot 의 모드별 DOM 색 변수 hex = Skia 맵 hex (7 키) · 설치 style 의 색 변수가 전부 forced-colors media 안 · 정적: rule 의 `{color.accent}` · `{color.accent-content}` 가 분류표와 일치 · `accent-content` 자리의 바탕 토큰이 전부 탐색의 대비 대상에 있음 (새 rule 이 새 바탕을 들이면 RED)                                                                                                             | 슬롯 · 분류 재조정                                                                             |
| G3   | Phase 4    | live (Chrome MCP): 프리셋 blue · yellow · green + hex 2 × light · dark 에서 Button accent fill (기본 · hover · pressed) · outline · Link · Badge subtle · Input focus · ProgressBar 를 Canvas = Preview (`/cross-check`) · Publish 1 회 · forced-colors 에뮬레이션 1 회 · Tone 5 종 전환                                                                                                                          | 어긋난 consumer 수리 후 재측정                                                                 |
| G4   | Phase 4    | initial 번들 Δ Builder · Preview ≤ +1 KB gzip · `package.json` 의존성 변화 0 · `resolveThemeSnapshot` 1 회 시간 기록 (B 등급 — 값만)                                                                                                                                                                                                                                                                              | 모듈 축소                                                                                      |
| G5   | 마지막     | 사용자 Builder 확인                                                                                                                                                                                                                                                                                                                                                                                               | 사용자 지적 반영                                                                               |

측정 5-질문 (`measurement-validity.md` §1):

- **Q1 대상**: 프리셋 10 · Tone 5 는 제품 표 그대로. hex 표본 20 은 실재 브랜드색 10 (`#FFCC00` · `#00A86B` · `#E60012` · `#1E3A8A` …) + 극단 10 (순색 원색 · 고채도 green · 무채색 `#808080` · 아주 밝은 · 아주 어두운) — 목록은 Phase 0 에서 고정하고 그 뒤 바꾸지 않는다.
- **Q2 불리 케이스**: dark 모드 · 고채도 green 계열 · layer-1 · neutral-subtle · accent-subtle 같은 가장 가까운 바탕 · 명시 surface 델타 · forced-colors · Tone 5 종 전환.
- **Q3 대조군**: 변경 전 값 (light 프리셋 accent hex · 두 렌더러 accent 계열) 을 Phase 0 에 기록하고 G1 · G3 이 그 기록과 비교한다.
- **Q4 소비 경로**: DOM 값은 resolver 출력이 아니라 Preview iframe 의 `getComputedStyle` (Button 배경 · 글자, Link 글자, Input focus 테두리) 로 읽는다 — `runtime-theme-vars` 가 실제로 이기는지까지 확인.
- **Q5 oracle 독립성**: 대비 함수는 WCAG 공식 참조쌍 (흰 · 검 21.0, `#777777` · 흰 4.48) 으로 먼저 검산한다. 화면 값은 Q4 의 브라우저 계산값과 Skia 맵을 대조한다 (resolver 가 자기 출력을 채점하지 않게).
- 측정 조건 기록: dev 서버 포트 · `visibilityState` · DPR · 색 모드.

집행: 로컬 vitest (`pnpm -F @composition/shared exec vitest run` · builder 동일) 와 `/cross-check` live — main 직접 push 정책 아래 실행자가 ledger (`pnpm agent:run`) 에 기록한다.

### Live Exercise

2026-10-30 · 별도 dev 서버 5178 (사용자 5173 무관) · headless Playwright (Chromium, DPR 1) · `visibilityState` visible · 콘솔 오류 0.

- **G3 Preview (Compare Mode iframe, `getComputedStyle`)**: 새 프로젝트에 Button accent fill · Button accent outline · Link · Badge accent subtle · TextField · ProgressBar 60 을 심고, Themes host (`setActiveThemePreset` · `setThemeToken` — 패널이 쓰는 같은 명령) 로 프리셋 blue · yellow · green × light · dark, hex `#FFCC00` · `#1E3A8A` × light · dark, green dark × Tone slate · gray · zinc · stone 을 바꿔 가며 10 값 (fill 배경 · 글자, hover · pressed 배경, outline 글자, Link, Badge 배경 · 글자, Input focus 테두리, ProgressBar 채움) 을 resolver 기대값 (= Skia 맵, node 에서 따로 계산) 과 대조 — **14/14 조합 PASS** (140 값).
- **Canvas**: 앱과 같은 모듈 인스턴스의 설치 토큰 맵 (`lightColors` · `darkColors`) 을 green light · dark, yellow dark, blue dark 에서 읽어 accent · accent-content · -hover · on-accent 가 기대값과 같음 — 4/4.
- **Publish 1 회** (상단 Preview → `/publish?project=blob:…`, blue dark): `#runtime-theme-vars` 에 `--accent-content` · forced-colors media 있음, Fill 버튼 `#3660f0` 위 흰 글자, Link · Badge · ProgressBar `#5587ff`.
- **forced-colors 에뮬레이션 1 회**: `--accent` = Highlight · `--accent-content` = LinkText · `--radius-md` = 6px (테마 값 유지) · Link 시스템 색.
- 사용자 Builder 확인 (G5): 「확인했다」 (2026-10-30, 5173).

## Consequences

### Positive

- dark 모드 accent 배경 위 글자 대비 3.29 ~ 3.93 → 4.57 이상, 바탕 위 accent 글자 · 표시도 기준 통과 (프리셋 10 전부).
- 토큰 역할이 S2 와 같은 두 갈래가 되어, 컴포넌트를 더할 때 어느 accent 를 쓸지 규칙 하나로 정해진다.
- 사용자 브랜드색이 통과하면 그대로 보인다.
- accent 계열을 두 렌더러가 같은 hex 객체에서 읽어 공식 차이 자리 2 개가 사라진다.
- forced-colors 에서 테마 색이 시스템 색을 덮던 경로가 seed · 명시 델타 모두 닫힌다.
- 새 의존성 0, 문서 스키마 변경 0.

### Negative

- dark 모드 프로젝트의 accent 글자 · 바탕 위 accent 색, 사용자 hex 테마의 accent 가 바뀐다 (R1 · R2 · R4).
- catalog rule 43 곳의 accent 참조를 다시 분류한다 (R3).
- DOM accent 가 상대 색 문법 대신 resolver 가 실은 hex 를 읽는다 — `preview-system.css` 만 보고는 최종 값을 알 수 없다 (파일 주석으로 안내).
- 영향 파일: `accentContrast.ts` (새) · `tintToSkiaColors.ts` · `resolveThemeSnapshot.ts` · `domView.runtime.ts` · `colorTokenToCss.ts` · `componentRulesTable.ts` · `preview-system.css` · `packages/rendering/src/primitives/colors.ts` · 테스트 (상세는 breakdown).
