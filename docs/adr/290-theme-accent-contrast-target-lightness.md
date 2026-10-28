# ADR-290: Theme Accent 를 목표 대비로 정하기 — 모드별 명도 계산 · 두 렌더러에 같은 hex

## Status

Proposed — 2026-10-29

- 사용자 요청: `/create-adr` (2026-10-29) — 같은 대화의 Adobe 공개 저장소 분석 검증 뒤.
- 방향을 정한 사용자 원문 (2026-10-28 ~ 29, 같은 대화):
  - 「Leonardo: 는 Theme 의 Accent, Tone 선택 Token 에 자동화 에 영향을 줄수있는지 분석해」 → Accent · Tone 파생 경로 실측과 대비 계산 (Context §현재 · §계산).
  - 「도입할만한건가」 → 권고: Leonardo 패키지는 넣지 않고, 「목표 대비로 명도 정하기」 계산을 테마 resolver 안에 직접 구현. 이 권고 직후 `/create-adr` 입력 — 이 ADR 은 그 방향 (대안 C) 을 채택안으로 쓴다.
- 사용자가 이미 답한 확인 항목: 없음. 시각 결과가 바뀌는 선택은 아래 「사용자 결정 4건」 에 모았다.
- 메모리: `project-theme-accent-contrast-leonardo-analysis-2026-10` (이 ADR 의 실측 원본) · `reference-design-data-mcp-installed-query-traps` · `feedback-design-whole-scope-upfront-no-deferral` (설계는 처음부터 전체 범위) · `feedback-no-document-migration-code-dev-stage` (마이그레이션 코드 금지).

> 구현 상세: [design/290-theme-accent-contrast-breakdown.md](design/290-theme-accent-contrast-breakdown.md)

## Context

### 도메인

**D3 시각 스타일** (theme/tokens root collection — ADR-110 · ADR-227). 테마 resolver 가 만든 색 토큰을 Builder (Skia) 와 Preview · Publish (DOM + CSS) 가 대등하게 소비한다. D1 (RAC DOM · ARIA) · D2 (S2 prop) 는 건드리지 않는다. 문서 스키마 (`ThemeDefinition` · `ThemePreset` · `TokensSnapshot`) 도 바꾸지 않는다. CSS generator (`generate-css.ts`) 확장 아님 — 테마 변수는 runtime 에 `runtime-theme-vars` style 로 실린다.

### 현재 (실측 2026-10-29, main `92b07f182`)

| 사실                                                                                                                                                | 위치                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accent 는 tint 프리셋 10 의 (chroma, hue) 또는 사용자 hex 의 (chroma, hue) 만 쓰고, 명도는 두 모드 모두 55% 고정                                    | `packages/shared/src/catalog/runtime/tintToSkiaColors.ts:86` `LIGHTNESS` · `:131` `createAccentColorTokens` · `resolveThemeSnapshot.ts:108` `tintOf` |
| hover · pressed = accent 에 검정 85% · 75% 혼합, on-accent 고정 (light `#ffffff` · dark `#171717`)                                                  | `tintToSkiaColors.ts:152 ~ 154`                                                                                                                      |
| Tone = Tailwind 회색 5 종 + 고정 단계표 (토큰 13)                                                                                                   | `neutralToSkiaColors.ts` `LIGHT_MAP` · `DARK_MAP`                                                                                                    |
| DOM 은 `--tint` 하나에서 상대 색 문법으로 계산 — `--accent` = `oklch(from var(--tint) 55% c h)` · `--accent-pressed` = **50%**                      | `packages/shared/src/components/styles/theme/preview-system.css:159 ~ 166`                                                                           |
| DOM 의 dark on-accent = 고른 Tone 의 `neutral-900` (Skia 는 `#171717` 고정)                                                                         | `preview-system.css:288` · `packages/rendering/src/primitives/colors.ts:85`                                                                          |
| catalog 의 `{color.accent-pressed}` → DOM `var(--accent-pressed, color-mix(… 75%, black))` — override 슬롯이 preview-system 의 50% 정의로 늘 채워짐 | `packages/shared/src/catalog/resolvers/colorTokenToCss.ts:82 ~ 85` · `componentRulesTable.ts:1145`                                                   |
| resolver 가 DOM 에 직접 싣는 색은 `--tint` · `--accent-subtle` · `--border-hover` 뿐                                                                | `resolveThemeSnapshot.ts:200 ~ 208`                                                                                                                  |
| 명시 색 델타는 light · dark 에 같은 값 — 모드별 값 저장 자리 없음                                                                                   | `resolveThemeSnapshot.ts:226 ~ 234`                                                                                                                  |
| `runtime-theme-vars` 는 layer 없는 `:root` · `[data-theme="dark"]` 블록 — `@layer preview-system` 정의를 이긴다                                     | `packages/shared/src/catalog/runtime/domView.runtime.ts:11 ~ 28` · `preview-system.css:12`                                                           |
| forced-colors 블록은 같은 layer 안에서 `--accent` · `--accent-subtle` · `--fg-on-accent` 를 시스템 색으로 덮는다                                    | `preview-system.css:369 ~ 374`                                                                                                                       |
| Themes 패널 Accent 10 · Tone 5 견본 선택                                                                                                            | `apps/builder/src/builder/panels/themes/ThemesPanel.tsx:318` · `:332`                                                                                |
| 색 피커 Theme 팔레트의 accent 사다리도 같은 고정 명도표                                                                                             | `tintToSkiaColors.ts:107` `resolveAccentLadder` · `ColorPickerPalettes.components.tsx:140`                                                           |
| S2 1.8.1 Button accent fill 의 글자색 = 두 모드 모두 `white` (배경 light `accent-900` · dark `accent-700`)                                          | `node_modules/@react-spectrum/s2/src/Button.tsx:154 ~ 158` · `:236`                                                                                  |

### 계산 (2026-10-29, WCAG 2 상대 휘도 · 이 ADR 의 수치는 코드 공식 그대로 계산 — 화면 측정 아님)

| 항목                                                              | 값                                     | WCAG 기준                                           |
| ----------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------- |
| light accent 대 `#ffffff` (프리셋 10)                             | 4.57 ~ 5.44                            | 일반 글자 4.5 — 10 종 통과, green 경계              |
| dark accent 대 `#171717` (프리셋 10)                              | 3.29 ~ 3.93                            | **10 종 전부 미달**                                 |
| dark accent 대 dark 바탕 `#171717` (비글자 경계)                  | 3.29 ~ 3.93                            | 비글자 3.0 — 통과                                   |
| 사용자 hex `#00A86B` → 55% 로 접힌 `#008a50` 대 흰 글자           | 4.42                                   | 미달                                                |
| 사용자 hex `#FFCC00` → `#996800` · `#1E3A8A` → `#4a6dc1`          | 4.84 · 4.94                            | 통과하지만 브랜드색이 바뀜 (`#1E3A8A` 자체는 10.36) |
| accent-pressed blue: DOM 50% `#294fde` 대 Skia 75% 혼합 `#2948b4` | —                                      | 두 렌더러 결과 다름 (코드상)                        |
| Tone 5 종 글자 (`neutral` · `neutral-subdued` 대 바탕 · layer-1)  | light 7.23 ~ 17.93 · dark 5.56 ~ 16.44 | 전부 통과                                           |

### 문제

1. **dark 모드 accent 버튼 글자가 대비 기준에 못 미친다** — 프리셋 10 종 전부. accent 명도가 두 모드에서 같고 dark 글자만 검정 쪽으로 바뀌기 때문이다.
2. **사용자 hex 는 명도를 버린다** — 대비를 지키려는 목적이 아니라 고정 55% 라서, 이미 통과하는 브랜드색도 바뀌고 (`#1E3A8A`) 접힌 결과가 미달일 수도 있다 (`#00A86B`).
3. **두 렌더러가 다른 공식을 쓰는 자리가 둘** — accent-pressed (DOM 50% · Skia 75% 혼합), dark on-accent (DOM Tone 의 neutral-900 · Skia 고정). D3 대칭 위반 의심이다 (live 미확인 — Phase 0 에서 확인).
4. **forced-colors 에서 테마 값이 시스템 색을 이긴다 (의심)** — resolver 가 `--accent-subtle` · `--border-hover` 를 layer 없는 블록에 직접 실어, 같은 이름을 덮는 layer 안의 forced-colors 블록보다 우선한다.

### 제약

- **hard**: ADR-201 initial 번들 상한 (Builder ≤ 1,390,000 B · Preview ≤ 320,000 B gzip) — resolver 는 Builder · Preview · Publish 가 테마를 설치할 때 **동기로** 부르는 경로라 지연 로드할 수 없다 (`resolveThemeSnapshot` → `applyCatalogPreviewTheme`).
- **hard**: 두 렌더러가 같은 SSOT 에서 같은 시각 결과 (ssot-hierarchy §D3). 계산 결과는 CSS 식으로 표현할 수 없으니 DOM 에는 hex 를 실어야 한다.
- **hard**: 문서 스키마 무변경 · 마이그레이션 코드 금지 — 기존 문서는 다시 열면 새 계산이 적용된다.
- **hard**: WCAG 2.2 — 일반 글자 4.5 (1.4.3) · UI 경계 3.0 (1.4.11).
- **soft**: Leonardo (`@adobe/leonardo-contrast-colors` 1.1.0) 마지막 push 2026-07-08, 의존성 5 (chroma-js · apca-w3 · ciecam02 · hsluv · ciebase).

## Alternatives Considered

### 대안 A: Leonardo 패키지를 resolver 에서 부른다

- 설명: `Theme` · `BackgroundColor` · `Color({ colorKeys, ratios })` 로 모드별 accent 사다리를 만들고 결과 hex 를 Skia 맵 · DOM 변수에 싣는다.
- 외부 근거: Leonardo `contrast-colors` README — 배경과 목표 대비 배열에서 색을 푼다. Adobe Spectrum 팔레트 생성에 쓰인 도구.
- 위험: 기술 LOW (검증된 라이브러리) / 성능 **HIGH** (의존성 5 가 Preview · Publish initial 로 — 지연 로드 불가) / 유지보수 MEDIUM (3 개월 정체 · 우리가 쓰는 것은 명도 탐색 하나) / 마이그레이션 LOW

### 대안 B: Leonardo 를 Themes 패널에서 지연 로드하고 결과를 토큰으로 저장

- 설명: 편집할 때만 패키지를 불러 계산하고, 결과 hex 를 테마 `tokens` 델타로 저장한다. resolver 는 저장값만 읽는다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (Accent · Tone 을 바꿀 때마다 저장값과 preset 이 어긋날 수 있고, 저장 결과가 많은 토큰을 문서에 굳힌다) / 마이그레이션 **HIGH** (모드별 델타 자리가 없어 `TokensSnapshot` 스키마 변경 필요 — `resolveThemeSnapshot.ts:226 ~ 234`)

### 대안 C: resolver 안에 목표 대비 명도 탐색을 직접 구현 (채택)

- 설명: (chroma, hue) 는 그대로 두고, 시작 명도에서 출발해 글자 대비 ≥ 4.5 · 바탕 대비 ≥ 3.0 을 만족하는 **가장 가까운 명도**를 이분 탐색한다. 결과 hex 를 Skia 맵과 DOM override 슬롯에 모드별로 같이 싣는다. 기존 `oklchToHex` · `hexToOklch` 를 쓰고 새 의존성은 없다.
- 외부 근거: Leonardo 의 핵심과 같은 계산 (배경 · 목표 대비 → 명도). S2 Button 은 accent fill 글자를 두 모드 모두 흰색으로 둔다 (`Button.tsx:236`).
- 위험: 기술 LOW (순수 함수 · 단위 테스트로 전수 확인) / 성능 LOW (테마 하나에 모드 2 × 탐색 ≤ 20 회) / 유지보수 LOW (모듈 하나 · 공식 하나) / 마이그레이션 MEDIUM (dark 글자색과 사용자 hex 결과가 바뀐다 — 스키마 변경은 0)

### 대안 D: 공식은 그대로 두고 dark on-accent 만 흰색으로

- 설명: `tintToSkiaColors.ts:154` 와 `preview-system.css:288` 을 흰색으로 바꾼다. 프리셋 10 은 이것만으로 4.57 ~ 5.44 가 된다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM (사용자 hex 미달 `#00A86B` 4.42 와 브랜드 명도 손실이 그대로 · 두 렌더러 공식 차이 자리도 그대로) / 마이그레이션 LOW

### Risk Threshold Check

| 대안 | HIGH+                             | 판정                                                                                         |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| A    | 성능 HIGH                         | 번들 상한 · 동기 경로 제약으로 회피 불가 → 기각                                              |
| B    | 유지보수 HIGH · 마이그레이션 HIGH | 스키마 변경 필요 → 기각                                                                      |
| C    | 없음                              | 채택                                                                                         |
| D    | 없음                              | 문제 2 · 3 · 4 를 남김 → C 의 부분집합으로 흡수 (사용자 결정 1 의 권고안이 D 의 글자색 변경) |

루프 1 회로 HIGH 0 대안 (C) 확보.

## Decision

**대안 C 채택.** 테마 resolver 안에서 accent 를 모드별 목표 대비로 정하고, 그 결과를 두 렌더러에 같은 hex 로 싣는다.

1. **명도 탐색 함수 하나** (`accentContrast.ts`, shared 순수 모듈): 입력 (chroma, hue, 시작 명도, 글자색, 바탕색, 목표 4.5 · 3.0) → 출력 명도. 시작 명도가 이미 두 조건을 만족하면 그대로 둔다 — 그래서 **light 모드 프리셋 10 의 accent 값은 바뀌지 않는다**. 두 조건을 동시에 만족하는 명도가 없으면 글자 대비를 우선하고 `warnings` 에 남긴다.
2. **시작 명도**: 프리셋은 55% (현재 값). 사용자 hex 는 **hex 자신의 명도** — 통과하면 브랜드색 그대로, 아니면 가장 가까운 통과 명도 (사용자 결정 2).
3. **on-accent 정책**: 두 모드 모두 흰색 (S2 와 같음 — 사용자 결정 1 권고안). hover · pressed 는 지금처럼 검정 혼합이다. 흰 글자 위에서는 어두워질수록 대비가 오르므로 별도 탐색이 필요 없다.
4. **DOM 은 override 슬롯으로**: resolver 가 모드별 `--color-highlight-background` · `--color-highlight-background-pressed` · `--color-highlight-foreground` · `--color-highlight-foreground-pressed` 를 싣는다. preview-system 의 `var(--color-highlight-*, 식)` 이 그 값을 읽는다. `--accent` 를 직접 덮지 않으니 forced-colors 블록이 그대로 이긴다. 기존 `--accent-subtle` · `--border-hover` 직접 싣기도 같은 방식 (`--color-highlight-overlay` · `--color-border-hover`) 으로 옮긴다 (문제 4).
5. **Skia 는 같은 값**: `createAccentColorTokens` 가 탐색 결과로 accent · hover · pressed · on-accent 를 만든다. DOM 에 싣는 hex 와 같은 객체에서 나온다.
6. **같은 계산을 쓰는 표면**: 색 피커 Theme 팔레트 (`resolveAccentLadder`) · Themes 패널 미리보기 (`MiniThemePreview`) · 요소별 accent (`resolveAccentColorTokens`).
7. **Tone 은 바꾸지 않는다**: 5 종 모두 글자 대비가 통과한다 (Context §계산). 대비 검사 게이트만 둔다. 브랜드색으로 물든 Tone 은 사용자 결정 4.
8. **chart accent 4 단계 · `--tint-N` 사다리 (link · focus-ring)** 는 대비와 무관한 장식 · DOM 전용 값이라 지금 공식을 유지한다 (`--tint` 는 계속 싣는다).

**위험 수용 근거**: 남는 것은 시각 변화 (dark 글자 · 사용자 hex) 뿐이고 스키마 · 저장은 그대로다. 결과가 마음에 들지 않으면 커밋 하나를 되돌리면 된다. 탐색은 순수 함수라 프리셋 10 × 모드 2 와 hex 표본을 단위 테스트로 전수 확인할 수 있다.

**기각 사유**:

- **A**: 의존성 5 가 Preview · Publish initial 에 들어간다. 동기 경로라 지연 로드할 수 없다. 쓰는 기능은 명도 탐색 하나뿐이다.
- **B**: 모드별 저장 자리가 없어 스키마를 바꿔야 하고, preset 과 저장값이 어긋나는 상태가 생긴다.
- **D**: 프리셋만 고치고 사용자 hex 미달 · 브랜드 명도 손실 · 두 렌더러 공식 차이를 남긴다. 글자색 변경은 C 의 결정 3 으로 들어간다.

### 사용자 결정 4건 (execute-adr 가 그 항목에 닿을 때 묻는다)

1. **dark on-accent 글자색** — (권고) 흰색, S2 와 같음 · accent 명도는 지금 그대로 / 대안: 어두운 글자 유지, 그러면 dark accent 명도가 ~65% 로 올라가 버튼이 밝아지고 hover · pressed 는 밝히는 방향으로 바뀐다.
2. **사용자 hex 의 시작 명도** — (권고) hex 자신의 명도 (통과하면 브랜드색 그대로) / 대안: 지금처럼 55% 에서 출발.
3. **Themes 패널에 대비 표시** — (권고) 넣지 않음 (자동으로 맞추므로 사용자가 판단할 일이 없음) / 대안: Accent 견본 아래 「글자 대비 4.8 : 1」 한 줄.
4. **브랜드색으로 물든 Tone** — (권고) 이 ADR 범위 밖 (Tone 은 결함 없음) / 대안: Tone 에 「Accent 따라감」 견본 추가.

## Risks

| ID  | 위험                                                                                                 | 심각도 | 대응                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------- |
| R1  | dark 모드를 쓰는 모든 프로젝트의 accent 글자색이 바뀐다 (어두운 글자 → 흰색)                         | MEDIUM | 사용자 결정 1 에서 확인 · G4 live 에서 dark 로 Button · Checkbox · Switch · Slider 확인 |
| R2  | 사용자 hex 를 쓰는 테마의 accent 가 바뀐다 (`color.accent` 델타가 있는 테마만)                       | MEDIUM | 사용자 결정 2 · G1 hex 표본 20 결과표를 breakdown 에 기록                               |
| R3  | override 슬롯이 다른 곳에서 이미 쓰이면 값이 겹친다 (`--color-highlight-*` · `--color-border-hover`) | MEDIUM | Phase 0 에서 쓰기 지점 전수 (grep) · 0 이 아니면 그 소비자를 같은 값으로 정렬           |
| R4  | 두 조건을 동시에 만족하는 명도가 없는 hue · chroma (dark 의 고채도 green 계열)                       |  LOW   | 글자 대비 우선 + `warnings` · G1 표본에 극단 hex 포함                                   |
| R5  | forced-colors 경로가 바뀐다 (문제 4 수리)                                                            | MEDIUM | G3 forced-colors 에뮬레이션에서 accent · subtle · border-hover 가 시스템 색인지 확인    |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                           | 실패 시 대안                                                                                   |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| G0   | Phase 0 끝 | RED 5 확인 — dark 대비 미달 · hex `#00A86B` 미달 · accent-pressed DOM ≠ Skia · dark on-accent Tone 의존 · forced-colors 에서 `--accent-subtle` 이 테마 값. pressed 와 on-accent 는 `/cross-check` 로 화면 차이 확인 | 화면 차이가 없으면 해당 RED 를 결함 아님으로 기록하고 그 수리 항목을 범위에서 뺀다 (사후 보고) |
| G1   | Phase 1 끝 | 단위: 프리셋 10 × 모드 2 전부 글자 ≥ 4.5 · 바탕 ≥ 3.0 · light 프리셋 accent hex 가 변경 전과 같음 · hex 표본 20 (극단 포함) 통과 또는 warning                                                                       | 탐색 조건 · 시작 명도 재검토                                                                   |
| G2   | Phase 2 끝 | 단위: snapshot 의 모드별 DOM 변수 hex = Skia 맵 hex (accent · hover · pressed · on-accent) · resolver 가 `--accent` 를 직접 싣지 않음                                                                               | 슬롯 이름 · 순서 재조정                                                                        |
| G3   | Phase 4    | live (Chrome MCP): 프리셋 3 + hex 2 × light · dark 에서 Button accent 기본 · hover · pressed 가 Canvas = Preview (`/cross-check`) · Publish 1 회 · forced-colors 에뮬레이션 1 회                                    | 어긋난 consumer 수리 후 재측정                                                                 |
| G4   | Phase 4    | initial 번들 Δ Builder · Preview ≤ +1 KB gzip · `package.json` 의존성 변화 0 · `resolveThemeSnapshot` 1 회 시간 기록 (B 등급 — 값만)                                                                                | 모듈 축소                                                                                      |
| G5   | 마지막     | 사용자 Builder 확인                                                                                                                                                                                                 | 사용자 지적 반영                                                                               |

측정 5-질문 (`measurement-validity.md` §1):

- **Q1 대상**: 프리셋 10 은 제품 표 그대로. hex 표본 20 은 실재 브랜드색 10 (`#FFCC00` · `#00A86B` · `#E60012` · `#1E3A8A` …) + 극단 10 (순색 원색 · 고채도 green · 무채색 `#808080` · 아주 밝은 · 아주 어두운) — 목록은 Phase 0 에서 고정하고 그 뒤 바꾸지 않는다.
- **Q2 불리 케이스**: dark 모드 · 고채도 green 계열 (두 조건 창이 가장 좁음) · forced-colors · Tone 5 종 전환 (DOM on-accent 가 Tone 을 따르던 자리).
- **Q3 대조군**: 변경 전 값 (light 프리셋 accent hex · 두 렌더러 accent 계열) 을 Phase 0 에 기록하고 G1 · G3 이 그 기록과 비교한다.
- **Q4 소비 경로**: DOM 값은 resolver 출력이 아니라 Preview iframe 의 `getComputedStyle` (Button 배경 · 글자) 로 읽는다 — `runtime-theme-vars` 가 실제로 이기는지까지 확인.
- **Q5 oracle 독립성**: 대비 함수는 WCAG 공식 참조쌍 (흰 · 검 21.0, `#777777` · 흰 4.48) 으로 먼저 검산한다. 화면 값은 위 Q4 의 브라우저 계산값과 Skia 맵을 대조한다 (resolver 가 자기 출력을 채점하지 않게).
- 측정 조건 기록: dev 서버 포트 · `visibilityState` · DPR · 색 모드.

집행: 로컬 vitest (`pnpm -F @composition/shared exec vitest run` · builder 동일) 와 `/cross-check` live — main 직접 push 정책 아래 실행자가 ledger (`pnpm agent:run`) 에 기록한다.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- dark 모드 accent 글자 대비 3.29 ~ 3.93 → 4.57 이상 (프리셋 10 전부).
- 사용자 브랜드색이 통과하면 그대로 보인다.
- accent 계열을 두 렌더러가 같은 hex 객체에서 읽어 공식 차이 자리 2 개가 사라진다.
- forced-colors 에서 테마 값이 시스템 색을 덮던 자리가 닫힌다 (의심 확인 시).
- 새 의존성 0, 문서 스키마 변경 0.

### Negative

- dark 모드 프로젝트의 accent 글자색과 사용자 hex 테마의 accent 가 바뀐다 (R1 · R2).
- DOM accent 가 상대 색 문법 대신 resolver 가 실은 hex 를 읽는다 — `preview-system.css` 만 보고는 최종 값을 알 수 없다 (파일 주석으로 안내).
- 영향 파일: `tintToSkiaColors.ts` · `resolveThemeSnapshot.ts` · `preview-system.css` · `packages/rendering/src/primitives/colors.ts` · 새 `accentContrast.ts` · 테스트 (상세는 breakdown).
