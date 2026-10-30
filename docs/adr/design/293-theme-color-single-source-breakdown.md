# ADR-293 breakdown — 테마 색 토큰 단일 생성

> 본문: [ADR-293](../completed/293-theme-color-single-source-resolver-to-dom.md). 이 문서는 phase · 파일 · 테스트 · 실측 표만 둔다. 결정 · 대안 · 위험은 본문이 정본이다. 리뷰 round 1 (2026-10-30) 반영: 출력 시점 (최종 맵) · 변환표 하나 · 삭제 목록 정밀화 · `/` 랜딩 scope · `color: boolean`.

## §1 전제 lock-in (fork 4 질문 — `adr-writing.md` §4 질문)

1. **base / 응용**: ADR-293 이 base (resolver → DOM 설치 메커니즘, 테마 색 전체). ADR-290 Decision 5 (accent 7 변수 설치) 는 이 메커니즘의 응용 — 293 뒤에는 290 Phase 2 가 「키 7 개가 집합에 들어 있다」 확인으로 줄어든다. 290 의 나머지 (대비 탐색 · 역할 토큰 · rule 분류) 는 293 과 독립.
2. **schema 직교성**: 둘 다 스키마 변경 0. `ThemeCssVar` 의 새 필드는 두 ADR 모두 **`color: boolean`** (290 breakdown Phase 2 와 같은 이름 — 리뷰 M1).
3. **선행 ADR 전제 reverse 검증**: 290 은 「DOM 설치는 resolver 가, 같은 객체에서」 를 accent 에 대해 전제했고, 293 은 그 전제를 넓힌다 — 방향 반전 없음. 290 이 293 에 의존하지 않는다 (290 혼자서도 7 변수를 실을 수 있다). 293 도 290 에 의존하지 않는다 (지금 Skia 값으로도 통일 가능). **권장 순서 293 → 290**: 293 이 작고 (파일 ~10), 290 Phase 2 가 같은 함수를 고치기 전에 구조 (`color: boolean` · media 블록) 를 먼저 만들어 두면 290 은 키만 더한다. 290 이 먼저 가면 293 은 290 이 만든 구조에 키를 더한다 — 어느 쪽이든 뒤에 가는 ADR 이 구조를 다시 만들지 않는다.
4. **판독에 전제 검증을 미루지 않음**: 위 1 ~ 3 은 사용자 `/create-adr` (2026-10-30) 이 confirm. 리뷰는 본문 정합만 본다.

- 마이그레이션 코드 0 (사용자 지시 2026-10-14). 사용자 문서는 테마 키 · 델타만 저장하므로 바뀌는 것은 해석 결과다.
- 범위 밖: builder chrome 의 **값** (`builder-system.css`) · `--tint-N` 사다리 · link · focus-ring · chart (ADR-290 결정 8) · 생성기 (`CSSGenerator.ts`) · 변환표 폴백 문자열 제거 (후속) · DOM 전용 색 변수의 Skia 대응 (후속).

## §2 Phase

### Phase 0 — 기록 · RED (제품 코드 변경 0)

- 비교 스크립트: 프리셋 10 × Tone 5 × 모드 2 에 대해 `resolveThemeSnapshot` 의 `colors` (Skia) 와, 지금 `preview-system.css` + 생성 CSS 를 `file://` 로 로드한 문서의 `getComputedStyle` 값 (DOM) 을 catalog 색 참조 89 종 전부에 대해 비교. 결과를 §5 표에 고정 (before). 2026-10-30 blue · neutral 실측은 scratchpad 의 `component-colors.json` · `token-compare.json` 이 원본이라 Phase 0 에서 저장소 안 테스트 fixture 로 옮긴다. **명시 델타 표본** (리뷰 H2 반례) 도 같이 — `color.negative=#ff0000` (hover · pressed 미명시) · `color.purple-subtle=#123456` · `color.raised=#eeeeee` · 독립 델타 (round 2) `color.on-negative=#123456` · `color.elevated=#fafafa` · `color.disabled=#cccccc` 를 하나씩 — 다른 토큰 (`white` · Tone `neutral-200`) 값이 그대로인지.
- 변환표 대조: `tokenResolver.ts` `tokenToCSSVar` 의 색 키 ↔ `colorTokenToCss.ts` 의 키 — 한쪽에만 있는 키 · 같은 키의 다른 문자열 목록 (알려진 것: named hue `-subtle` 17 종이 shared 표에 없음 → `colorTokenCssVarName("purple-subtle")` = `--purple-subtle` ≠ `Badge.css:370` `--hue-purple-subtle`).
- RED ①: 생성 CSS 미정의 변수 정적 테스트 — `packages/shared/src/components/styles/generated/*.css` 의 폴백 없는 `var(--X)` 를 모아 theme CSS (`preview-system.css` · `semantic-palette.css`) · resolver `cssVars` · 허용 런타임 변수 (`--catalog-*` · `--trigger-width` · `--button-*` · `--indicator-*` · `--inset-*`) 에 없는 것을 나열. 지금 코드에서 6 개를 잡아야 RED 가 맞다.
- RED ②: `cssVars` 색 키 집합 = `colors.light` 키 집합 (지금은 `--tint` · `--accent-subtle` · `--border-hover` 뿐이라 RED) + 모든 키의 변수 이름 = `tokenToCSSVar` 가 내는 이름 (named hue subtle 에서 RED). · 이름 충돌 (서로 다른 토큰 → 같은 변수: 지금 `on-negative` · `elevated` · `white` → `--color-white`, `disabled` → `--color-neutral-200` = Tone seed 와 겹침 — RED).
- RED ③: browser — 위 비교를 테스트로 (지금 10 건 이상 다름 · 델타 표본 포함).
- 전수 (R3 · R6): `preview-system.css` 를 resolver snapshot 없이 쓰는 소비자 —
  - 테스트: `theme.css` import 경로 · browser 테스트 (`chartPalette` · `chartTheme` · `adr210Presentation` — chart 식은 유지 대상이라 영향 0 예상 · `shadowCssParity` — 그림자만) · G3 하니스 (`switchDomPaint` · `paletteBaseCanvas` 는 `cssVars` 를 직접 설치하므로 자동으로 전체를 받는다 — 나머지 3 파일 확인).
  - production: Builder 메인 문서 (`apps/builder/src/index.css:27`) 에서 `data-context="builder"` 밖에 있는 DOM — 알려진 것 `/` 랜딩 (`main.tsx:90` `App` · `hero.css:4-9` `--accent` · `--bg-raised` · 제목 · 설명 변수). `builder-system.css` 가 덮지 않는 변수 (`--accent-negative` · `--bg-inset-pressed` · `--fg-field` · `--fg-on-accent-pressed` · `--negative-pressed` · `--link*` · chart · 그림자 · `--tint*`) 를 Builder CSS 가 쓰는지 (2026-10-30 grep: 색 5 종은 0 파일).
- **S2 설치본 대조** (사용자 지시 2026-10-30 「S2 설치본 대조 … 는 Phase 0 항목으로」): 정본은 웹 문서가 아니라 설치된 `@react-spectrum/s2` 1.8.1 — `apps/builder/node_modules/@react-spectrum/s2/style/spectrum-theme.ts` (색 역할 토큰 `colorToken(…)` 매핑 · `nextColorStop` 한 단 이동 규칙 `:162-172` · `baseColor` 상태 토큰 `:227-248`) · `src/Button.tsx:148-170` (accent light `900 → hover 1000` · dark `700 → 600`, negative · neutral 같은 규칙) · Badge · ToggleButton 등 catalog 가 쓰는 컴포넌트의 상태별 단. 우리 토큰 이름 (`accent` · `accent-content` · `accent-hover` · `neutral-*` · `negative-*` · `raised` · `on-accent`) 과 1:1 로 대조한 표를 §6 에 둔다 — 열: 우리 토큰 · S2 역할 토큰 · S2 상태 규칙 (단 이동 방향) · 우리 규칙 · 차이. 읽는 곳: 사용자 결정 2 (negative hover/pressed 식 — S2 는 한 단 이동, 우리는 검정 혼합) · ADR-290 Decision 3 (hover 방향이 dark 에서 반대). 대조 결과가 ADR-290 Decision 3 변경을 요구하면 **구현하지 않고 보고** — 290 은 리뷰가 닫힌 ADR 이라 변경은 사용자 결정. S2 의 **값**은 가져오지 않는다 (D3 정본은 catalog — `ssot-hierarchy.md` §1).
- 산출: 이 문서 §5 표 · §6 S2 대조표 · 변환표 차이 목록 · RED 3 · 소비자 목록. G0.

### Phase 1 — 변환표 하나 · resolver 출력

- 변환표 통일: `colorTokenToCss.ts` 를 정본으로 두고 `tokenResolver.ts` 의 `tokenToCSSVar` 색 부분이 그것을 import (rendering → shared 방향은 이미 `semanticPaletteMap` 로 열려 있는지 확인; 반대면 shared 표를 rendering 으로 옮기고 shared 가 re-export). named hue `-subtle` 17 종이 표에 들어온다. `catalogTokenExists` 7/7 · `semanticAlias.symmetry` 유지.
- 토큰 ↔ 변수 1:1 (리뷰 round 2): `on-negative → var(--fg-on-negative)` · `elevated → var(--bg-elevated)` (shared 표에 항목 추가) · `disabled → var(--bg-disabled)`. 남는 팔레트 참조는 `white → --color-white` · `black → --color-black` 둘. `pnpm generate:css` 로 생성 CSS 재출력 — 바뀌는 줄은 이 세 토큰에서 온 `var(--color-white)` · `var(--color-neutral-200)` 뿐이어야 한다 (diff 를 G1 증거로). builder chrome 이 이 생성 CSS 를 공유하는 시트 (`ListBox.css` 등 — 메모리 `reference-manual-collection-sheets-shared-with-builder-chrome`) 가 새 변수를 읽으면 `builder-system.css` 에도 같은 이름을 선언한다 (Phase 0 전수).
- `resolveThemeSnapshot.ts`: 파생 재계산 블록 (`:313-326`) **뒤**, `return` 직전에 `for (const key of Object.keys(light)) put(colorTokenCssVarName(key), light[key], false)` · dark 동일. seed 의 `--accent-subtle` · `--border-hover` · 명시 델타 `put` 은 그대로 (같은 `put` 이라 마지막 값이 남는다). `ThemeCssVar` 에 `color: boolean`. 사용자 결정 1 · 2 에 따라 `raised` · `negative-hover` · `negative-pressed` 의 값 출처를 정한다 (`colors.ts` 손값 → resolver 계산으로 옮길지).
- RED ② GREEN. G1.

### Phase 2 — DOM 설치 · CSS 정리 · 랜딩 scope

- `domView.runtime.ts` `applyCatalogPreviewTheme`: `color` 블록을 `@media not (forced-colors: active)` 안에, 나머지 밖에. (290 이 먼저 갔으면 이미 있음 — 확인만.)
- `preview-system.css`: light · dark 블록에서 **Phase 1 의 resolver 출력 집합에 있는 이름의 선언만** 제거 — 실행 시 집합을 덤프해 목록으로 작업한다. 지금 알려진 대상: `--bg` · `--bg-raised` · `--bg-overlay` · `--bg-muted` · `--bg-inset` · `--fg` · `--fg-base` · `--fg-muted` · `--fg-on-accent` · `--border` · `--border-hover` · `--border-disabled` · `--accent` · `--accent-pressed` · `--accent-subtle` · `--negative-pressed` (+ `--negative*` 등 semantic-palette 가 아닌 것). **남기는 것**: `--bg-emphasis` · `--fg-emphasis` · `--fg-disabled` · `--border-pressed` · `--bg-inset-pressed` · `--fg-field` · `--fg-on-accent-pressed` · `--accent-negative` · `--tint` · `--tint-N` · `--link*` · `--focus-ring*` · `--chart-accent-N` · 그림자 · 타이포 · forced-colors 블록 (`:348-376`). 머리말 (`:1-30`) 을 「`--tint` 는 `--tint-N` 사다리 입력, 테마 색은 resolver 가 싣는다」 로 고친다.
- `semantic-palette.css` (generated) 가 정의하는 `--negative` · `--hue-*` 는 resolver 도 같은 표 (`semanticPaletteMap`) 에서 내므로 값이 같다 — 중복 선언이지만 생성 파일이라 이번에는 두고 (`tailwindPalette.drift` 게이트 영향 0), 후속에서 생성기 출력을 줄인다.
- 결정 3 이 「폴백 남김」 이면 제거 대신 `var(--X, <지금 식>)` 로 바꾸고 R3 소비자가 그걸 쓴다는 사실을 적는다.
- `/` 랜딩: `App` 루트 (또는 `hero.css` 가 거는 `:root[data-theme]` 대신 랜딩 컨테이너) 에 `data-context="builder"` — Signin · Dashboard 와 같은 처리. `hero.css:4-9` 의 `:root[data-theme]` 배경은 컨테이너 선택자로 옮긴다 (`:root` 는 scope 밖).
- RED ① GREEN · `preview-system.css` 에 출력 집합 이름 0 · Builder 메인 문서 scope 밖 테마 색 소비 0. G2.

### Phase 3 — 값 대칭 · 번들

- RED ③ GREEN: 10 × 5 × 2 + 델타 표본 전부 Δ 0. 다른 값이 나오면 resolver 식을 고친다 (CSS 로 돌아가지 않음).
- 변환표의 `var(--X-hover, color-mix(…))` 폴백 문자열은 그대로 (본문 Decision 5).
- `pnpm generate:css` 재실행 — 변환표 통일로 생성 CSS 문자열이 바뀌는지 확인 (이름만 같으면 diff 0 예상; 바뀌면 그 diff 가 H1 의 수리 증거).
- 번들: `adr201-bundle-gate.mjs` Preview · Builder Δ. G3 · G4.

### Phase 4 — live · 문서

- Chrome MCP, 별도 dev 서버 (사용자 5173 아님): 새 프로젝트 → Preview 에서 Button primary · accent · negative 의 hover · pressed (`#d4d4d4` 류 — Canvas 와 같은 색을 색 피커로 확인) · Popover/Select 목록 raised · Badge subtle (purple 등 named hue) · dark 전환 · Tone 전환 (neutral → slate 등) · 테마 델타로 negative hex 지정 뒤 hover · Publish 내보내기 결과 같은 항목 · DevTools forced-colors 에뮬레이션에서 시스템 색 적용 · 새 탭에서 `/` 직접 진입 (배경 · 제목 색) · 콘솔 오류 0.
- 문서: `css-tokens.md` §Tint Color System · §S2 TokenRef 표의 `color-mix(…)` 행 (실제 변수명으로) · `resolveThemeSnapshot.ts` 머리말 · CHANGELOG (사용자-가시: Preview neutral hover · pressed 등). ADR-290 본문 Decision 5 의 한 줄은 이미 있다.
- G5 → 사용자 확인 → Implemented (`### Live Exercise` 기재).

## §3 파일 변경표 (추정 ~10)

| 파일                                                                                            | Phase | 변경                                                                 |
| ----------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| `packages/shared/src/catalog/resolvers/colorTokenToCss.ts`                                      | 1     | named hue `-subtle` 17 종 · 정본 표                                  |
| `packages/rendering/src/renderers/utils/tokenResolver.ts`                                       | 1     | 색 표를 shared 에서 import (또는 역방향)                             |
| `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts`                                   | 1     | 최종 맵 전체를 `cssVars` 로 (함수 끝) · `ThemeCssVar.color` · 머리말 |
| `packages/shared/src/catalog/runtime/domView.runtime.ts`                                        | 2     | 색 블록 `@media not (forced-colors: active)`                         |
| `packages/shared/src/components/styles/theme/preview-system.css`                                | 2     | 출력 집합 이름의 선언 제거 · 머리말                                  |
| `apps/builder/src/App.tsx` (랜딩 루트) · `apps/builder/src/hero.css`                            | 2     | `data-context="builder"` · `:root[data-theme]` 배경을 컨테이너로     |
| `packages/rendering/src/primitives/colors.ts`                                                   | 1     | 결정 1 · 2 에 따라 `raised` · `negative-*` 값 (또는 무변경)          |
| `packages/shared/src/catalog/__tests__/generatedCssVarsDeclared.static.test.ts` (신규)          | 0 → 2 | RED ①                                                                |
| `packages/shared/src/catalog/__tests__/themeCssVarsCoverSkia.static.test.ts` (신규)             | 0 → 1 | RED ② (키 집합 + 이름 일치)                                          |
| `packages/shared/src/components/styles/theme/__tests__/themeColorParity.browser.test.ts` (신규) | 0 → 3 | RED ③ (10 × 5 × 2 + 델타 표본)                                       |
| `.claude/rules/css-tokens.md` · `docs/CHANGELOG.md`                                             | 4     | 문서                                                                 |

## §4 사용자 결정이 닿는 phase

| 결정                               | phase | 묻는 시점                                                                          |
| ---------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| 1 `raised` 값                      | 1     | resolver seed 에 raised 를 넣을 때                                                 |
| 2 `negative-hover` · `-pressed` 식 | 1     | 같은 때                                                                            |
| 3 CSS 폴백 잔존                    | 2     | `preview-system.css` 를 고치기 직전 — Phase 0 의 R3 소비자 목록을 보여 주고 묻는다 |

## §5 Skia ↔ DOM 값 표 (before)

2026-10-30 실측 — blue · neutral 프리셋, 현재 코드. 전 프리셋 10 × Tone 5 × 모드 2 와 델타 표본은 Phase 0 에서 채운다. DOM 값은 생성 CSS + `preview-system.css` 를 `file://` 로 로드한 문서의 계산값 (`component-colors.json`).

| 토큰 · 자리                                                                          | 모드         | Skia                  | DOM                                                              | 갈린 이유                                                                         |
| ------------------------------------------------------------------------------------ | ------------ | --------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `accent-pressed`                                                                     | light · dark | `#2948b4`             | `#294fde`                                                        | 검정 75% 혼합 vs L 50%                                                            |
| `neutral-hover`                                                                      | light        | `#d4d4d4`             | `#c3c3c3`                                                        | Tone 300 vs 변수 미정의 → 폴백 혼합                                               |
| `neutral-hover`                                                                      | dark         | `#525252`             | `#363636`                                                        | Tone 600 vs 폴백 혼합                                                             |
| Button primary `[data-hovered]` 배경 (생성 CSS)                                      | light        | `#d4d4d4`             | `#141414`                                                        | `--neutral-hover` 미정의 → `.button-base` 가 `--button-color`(= `--fg`) 를 어둡게 |
| Button primary `[data-hovered]` 배경 (생성 CSS)                                      | dark         | `#525252`             | `#d0d0d0`                                                        | 같음                                                                              |
| `negative-pressed`                                                                   | light        | `#b33333`             | `#e7000b`                                                        | 손값 vs `--color-error-600`                                                       |
| `raised`                                                                             | light        | `#f9fafb`             | `#ffffff`                                                        | gray-50 vs white                                                                  |
| `raised`                                                                             | dark         | `#202023`             | `#171717`                                                        | zinc-850 vs neutral-900                                                           |
| `on-accent`                                                                          | dark (slate) | `#171717`             | `#0f172b`                                                        | 고정 vs `--color-neutral-900` — ADR-290 결정 1 (흰색) 로 해소                     |
| `accent-hover` · `purple-hover` · `purple-pressed`                                   | 둘 다        | 혼합 85 · 75          | 폴백 혼합 85 · 75                                                | **값은 우연히 같음** — 변수는 미정의 (RED ① 대상)                                 |
| 델타 `color.negative=#ff0000` → `negative-hover` / `-pressed` (리뷰 H2, 메모리 모사) | light        | `#d90000` / `#bf0000` | `#cb3a3a` / `#b33333` (seed 직후 출력 시)                        | 파생 재계산 (`:313-326`) 이 Skia 맵만 — 출력을 함수 끝으로 옮기면 Δ 0             |
| 델타 `color.on-negative=#123456` → negative 버튼 글자 (리뷰 round 2, 설계 모델)      | light        | `#123456`             | `#ffffff` (전체 출력 시 `white` 가 같은 `--color-white` 를 덮음) | 토큰 여럿 → 변수 하나 — 1:1 로 Δ 0                                                |

생성 CSS 의 폴백 없는 미정의 변수 6: `--accent-hover` · `--neutral-hover` · `--neutral-pressed` · `--negative-hover` · `--purple-hover` · `--purple-pressed` (`Button.css:49,64-65,92,107-108,122-123` · `ToggleButton.css:48-49`).

## §6 S2 설치본 대조 (Phase 0 에서 채운다)

| 우리 토큰                                    | S2 역할 토큰 (`spectrum-theme.ts`)                            | S2 상태 규칙                                                                                           | 우리 규칙                                         | 차이                                         |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------- |
| `accent` / `accent-hover` / `accent-pressed` | `accent-background-color-default` (`:757`)                    | Button light `accent-900 → 1000`, dark `700 → 600` (`Button.tsx:155-157`) — 한 단 이동, dark 는 밝아짐 | 검정 85 · 75 % 혼합, 두 모드 같은 방향            | 방향 (dark) · 크기 — ADR-290 Decision 3 · R7 |
| `accent-content`                             | `accent-content-color-default` (`:743`)                       | 〃                                                                                                     | ADR-290 탐색                                      | Phase 0                                      |
| `neutral-hover` / `neutral-pressed`          | `baseColor('neutral')` (`Button.tsx:152`) → `neutral:hovered` | `nextColorStop` 한 단                                                                                  | Tone 단계 300 / 400 (light) · 600 / 500 (dark)    | Phase 0                                      |
| `negative-hover` / `negative-pressed`        | `negative-900 → 1000` / `700 → 600` (`Button.tsx:161-164`)    | 한 단 이동                                                                                             | 손값 (`colors.ts:46-47`)                          | 사용자 결정 2 입력                           |
| `on-accent`                                  | `white` (`Button.tsx:236-237`, accent · negative 글자)        | 고정                                                                                                   | light 흰색 · dark `#171717` → ADR-290 결정 1 흰색 | 290 이 해소                                  |
| `raised` · `base` · `layer-1` · `layer-2`    | `background-layer-*` · `background-base` 계열                 | —                                                                                                      | gray-50 / zinc-850 …                              | 사용자 결정 1 입력                           |

(나머지 행 · 실제 단 번호 · hex 는 Phase 0 에서 설치본을 읽어 채운다. 웹 문서 인용 금지 — 설치본과 다르면 설치본.)

**Phase 0 대조 결과 (2026-10-30, 설치본 1.8.1)**:

- 상태 규칙 정본은 `style/spectrum-theme.ts:162-185` `nextColorStop` — `:hovered` · `:pressed` · `:focused` 는 같은 척도 (`gray` · `accent-color` · `negative-color` …, `:72-117`) 에서 **다음 단 하나**. light · dark 각각 자기 척도에서 한 단이라 「배경에서 한 단 더 먼 쪽」 이다 (light 는 진하게, S2 의 dark 척도는 반전돼 있어 밝게). 단 값 (hex) 은 설치본이 컴파일된 dist 만 있고 `@adobe/spectrum-tokens` json 이 설치돼 있지 않아 (`tokens.ts:16` import 대상 부재) 규칙만 대조했다.
- Button (`src/Button.tsx:148-170`): primary = `baseColor('neutral')` (`neutral-background-color-default`, `:759`) → hover 한 단 · accent light `900 → 1000` · dark `700 → 600` · negative 같은 모양 · 글자 accent · negative = `white`, primary = `gray-25`.
- **차이 1 (새로 발견 — 사용자 결정 4)**: 우리 `neutral-hover` · `neutral-pressed` 는 Tone 300 · 400 (dark 600 · 500) — `neutral-subtle` (200 / dark 700) 바탕의 다음 단이라 ToggleButton · GridListItem · Code · Kbd (`componentRulesTable.ts:2343,5468,6471,12855,12869`) 에는 S2 규칙과 같다. 그러나 Button primary 는 바탕이 `{color.neutral}` (light neutral-900 · 글자 `{color.base}` 흰색) 인데 hover · pressed · borderHover 에 같은 토큰을 쓴다 (`:1164-1172`). Canvas 는 hover 를 그리지 않아 지금은 안 보이고, Preview 는 `--neutral-hover` 미정의로 `.button-base` 폴백 (fg 를 검정 혼합 — `#141414`) 이 그려 우연히 S2 방향이다. 통일하면 Preview primary hover 가 `#d4d4d4` 바탕에 흰 글자 (대비 ≈ 1.5) 가 된다 — R1 의 「neutral 버튼 hover `#141414` → `#d4d4d4`」 는 값 변화가 아니라 **대비 회귀**다.
- 차이 2: negative hover · pressed — S2 는 한 단 (`negative-900 → 1000`), 우리 권고 (결정 2) 는 검정 85 · 75 % 혼합. accent 가 혼합이라 (ADR-290 Decision 3 범위) 규칙 하나로 맞추는 권고는 그대로. ADR-290 Decision 3 변경을 요구하는 대조 결과는 없다 (방향 차이는 이미 290 R7).
- `raised` · `elevated` · `base` · `layer-*`: S2 `background-base-color` · `background-layer-1/2-color` · `background-elevated-color` (`:809-813`) — 우리 이름과 1:1. `raised` 는 S2 에 없는 이름 (popover 바탕은 S2 가 `elevated` 계열) — 결정 1 은 값만 정한다.

## §7 기록

### Phase 0 — 2026-10-30 (G0)

- **RED ①** `packages/shared/src/catalog/__tests__/generatedCssVarsDeclared.static.test.ts`: 미정의 7 — 설계가 예고한 6 (`--accent-hover` · `--neutral-hover` · `--neutral-pressed` · `--negative-hover` · `--purple-hover` · `--purple-pressed`) + `--font-sans` (생성 CSS 32 장이 폴백 없이 읽는데 Preview · Publish 문서에는 선언이 없다 — Builder 문서만 Tailwind `@theme` 가 준다. 타이포 축이라 이 ADR 범위 밖, 결과는 body 의 base 글꼴 상속이라 지금 화면은 같다 — 후속 항목. 테스트는 Phase 2 에서 이 1 건을 사유와 함께 허용 목록에 둔다).
- **RED ②** `themeCssVarsCoverSkia.static.test.ts`: 58 fail — 이름 불일치 22 (named hue `-subtle` 18 · `green-named` · `green-named-subtle` · `elevated → --color-white` · `disabled → --color-neutral-200`), 충돌 `--color-white ← on-negative · elevated · white` · 팔레트 변수 3, 프리셋 50 조합 전부 Skia 색 키 272 개가 cssVars 에 없음, 델타 6 전부.
- **RED ③** `apps/builder/tests/parity/themeColorParity.browser.test.ts` (breakdown §3 의 `packages/shared/…/theme/__tests__/` 는 browser project 가 없어 parity project 로 옮김): 112/112 fail. catalog 색 참조 88 (transparent 제외) × 프리셋 10 × Tone 5 × 모드 2 + 델타 6 × 2. 원본 로그 `.agent/runs/2026-10-30-adr293/phase0/red3-before.log` (로컬).
  - 전 조합에서 갈림: `accent-pressed` · `negative-hover/-pressed` · `neutral-hover/-pressed` · named hue hover · pressed 7 쌍 (생성 CSS 가 폴백 없이 읽는 슬롯은 DOM 미정의 → 검정/무효) · `raised` (110).
  - Tone 이 DOM 에만 새는 곳 (새로 발견): `gray` (80 — 비 neutral Tone 4 × 10 × 2) — `semantic-palette.css` `--hue-gray: var(--color-neutral-400)` 를 Tone seed 가 덮는다. Skia `gray` 는 Tone 무관. 통일 뒤 DOM 도 Tone 무관 (Badge gray 가 slate 등에서 바뀐다 — §5 표에 추가).
  - dark `on-accent` (40) — Tone 별 `--color-neutral-900` vs Skia `#171717` (ADR-290 결정 1 범위).
  - ±1/255 반올림 (oklch ↔ hex): `notice` · `orange` · `positive-subtle` · `green-named-subtle` (56) · pink `accent` · `chart-accent-2` (10) — resolver 가 hex 를 싣는 순간 사라진다.
  - 리뷰 지적의 브라우저 재현: `purple-subtle` 델타가 DOM 에 안 닿음 (H1) · `negative=#ff0000` 의 pressed Skia `#bf0000` / DOM `#e7000b` (H2) · **`on-negative=#123456` 이 `white` 뿐 아니라 `base` · `raised` 까지 `#123456` 으로** (round 2 — `--bg` · `--bg-raised` 가 `var(--color-white)` 폴백을 쓴다, 범위가 설계보다 넓음) · `elevated` 델타 DOM 미도달 · `disabled` 델타 DOM 미도달.
- **변환표 차이**: rendering 표 (`tokenResolver.ts`) 가 shared 표 (`colorTokenToCss.ts`) 의 상위집합. shared 에만 있는 키 0. shared 에 없는 키 — named hue `-subtle` 18 · `green-named(-subtle)` · status `-subtle` 4 (이름 우연 일치) · `elevated` · `disabled` · `border-hover` · `border-disabled` (우연 일치) · chart 12 (우연 일치). 의존 방향: shared → rendering (`colorTokenToCss.ts:18` 이 `SEMANTIC_PALETTE_MAP` 을 import) 이라 **정본은 rendering 표**, shared 는 그것을 쓴다 (Decision 1 의 「역방향」).
- **snapshot 없이 `preview-system.css` 를 쓰는 소비자**:
  - 테스트: chart browser 3 (`chartPalette` · `chartTheme` · `adr210Presentation` — chart 변수만, 유지 대상) · `shadowCssParity` (그림자만) · `catalogTokenExists` DOM 단언 (theme CSS 선언 ∪ snapshot cssVars — 제거 뒤에도 snapshot 이 공급). G3 하니스 `propAxisCanvasDom` · `paletteBaseCanvas` 는 `cssVars` 의 light 만 `:root` 에 설치 — 전체 출력 뒤 자동으로 같은 값 (G3 고정 캡처의 DOM leg 값은 `raised` 등에서 바뀔 수 있음 → Phase 3 에서 재실행). `switchDomPaint` 는 테마 변수 미설치 (Switch 기하만 봄).
  - production (Builder 메인 문서, `data-context` 밖 `:root` · `html` · `body`): `hero.css:4-9` (`--accent` · `--bg-raised`) — 설계대로. `panel-btn.css:2-14` 의 `:root { --panel-btn-bg: var(--bg-raised) … }` 도 걸리지만 `.panel-btn` 소비처 0 (dead) — 영향 0. Auth · Dashboard 는 `data-context="builder"`.
- **S2 대조**: §6 아래 「Phase 0 대조 결과」.
- 사용자 결정 1 · 2 · 3 + 새 결정 4 (Button primary hover) 를 Phase 1 착수 전에 묻는다. → **전부 권고안** (2026-10-30): 1 Canvas 값 · 2 검정 85 · 75 % 혼합 · 3 폴백 제거 · 4 S2 한 단 (`neutral-fill-hover` · `-pressed`).

### Phase 1 — 2026-10-30 (G1)

- 변환표 하나: `tokenResolver.ts` 에 `colorTokenCssValue` · `colorTokenCssNames` (rendering 루트에서 export), `colorTokenToCss.ts` 의 복제 표 삭제 — 읽기만. `semanticAlias.symmetry` R5 를 「shared 는 표를 복제하지 않는다」 로.
- 1:1: `on-negative → var(--fg-on-negative)` · `elevated → var(--bg-elevated)` · `disabled → var(--bg-disabled)`. `pnpm generate:css` diff = 4 줄 (`Badge.css` · `Button.css` 의 `--color-white` → `--fg-on-negative` 2 · Button primary `--button-color-hover/-pressed` 2). Builder chrome 은 Badge · Button 생성 시트를 싣지 않아 `builder-system.css` 무변경.
- 결정 4: 토큰 `neutral-fill-hover` · `neutral-fill-pressed` (`ColorTokens` · `colors.ts` · `neutralToSkiaColors.ts` light 950 / dark 50) · `componentRulesTable.ts` Button primary 의 hover · pressed · borderHover.
- 결정 2: `colors.ts` 의 negative 손값 삭제 → `resolveSemanticStateColors` 혼합. 정적 seed 의 `neutral-hover/-pressed` 도 Tone 단계 값으로 (resolver 가 늘 덮던 값 — `semanticPaletteMap.snapshot` 갱신).
- resolver: `ThemeCssVar.color` · seed 의 색 put 2 · 델타의 색 put 제거 → 함수 끝에서 최종 맵 전체 (`PALETTE_CONSTANT_COLOR_TOKENS` white · black 제외). `colorTokenCssVarName` 은 키워드 (`transparent`) 에 null. **발견 (수리)**: 명시 델타 뒤 파생이 `<x>-hover` 를 `<x>` 에서 혼합해 `color.neutral` 델타가 `neutral-hover` (밝은 바탕의 hover) 를 글자색 기반 거의 검정으로 — DOM 에 실리면 ToggleButton hover 회귀. `DERIVED_STATE_KEYS` (neutral → fill, neutral-subtle → hover) 로 짝을 고침, RED ② · ③ 에 `neutral` · `neutral-subtle` 델타 표본 추가.
- RED ② GREEN 61/61. rendering 1320/1320 · shared 정적 · builder `utils/theme` 15/15.

### Phase 2 — 2026-10-30 (G2)

- `themeVarsCss.ts` `catalogThemeVarsCss` (색 블록 `@media not (forced-colors: active)`) — `applyCatalogPreviewTheme` (Preview · Publish) 과 browser 하니스가 같은 텍스트를 쓴다 (`domView.runtime` 은 import 사슬이 무거워 하니스용으로 분리).
- `preview-system.css`: 출력 집합 ∩ 선언 20 중 `--chart-accent-1~4` (Decision 3 유지 — snapshot 없는 chart 테스트용, Preview 에선 layer 없는 resolver 값이 이김) · `--negative` (forced-colors 블록에만) 제외 15 이름 × light · dark = 28 선언 제거, 머리말 교체. G2 단언 `generatedCssVarsDeclared.static.test.ts` (출력 이름 선언 0). RED ① 은 `--font-sans` 를 사유와 함께 허용 목록 (`KNOWN_UNDECLARED`).
- `/` 랜딩: `App.tsx` `main` 에 `data-context="builder"` + 랜딩 토글이 `data-builder-theme` 도 세움 (unmount 때 지움) · `hero.css` 의 `:root[data-theme]` 배경 → `.main` / `[data-builder-theme="dark"] .main`.

### Phase 3 — 2026-10-30 (G3 · G4)

- RED ③ GREEN 117/117 (100 + 델타 8 × 2 + 수집 1).
- 회귀 대조 (HEAD `2c2ce9baa` detached worktree vs HEAD + 이 ADR 패치만 — 병렬 세션 미커밋 제외): parity + chart before 실패 3 (chartInteraction 2 · GeometryDelta 1) = after 실패 3. 중간에 깨졌던 snapshot 없는 하니스 3 종 — chart mono series 5 (`--fg-muted`) · `switchDomPaint` 16 (트랙 `border: … var(--border)` 무효 → 테두리 0) · `adr248CatalogRealDom` ComboBox Group 높이 2 px — 는 결정 3 이 의도한 「값이 빠지면 깨짐」 이라 하니스가 Preview 와 같은 설치를 거치게 고침 (`parityTest.setupFiles` += `setupPreviewThemeVars.ts`, chart 상속 · `switchDomPaint` beforeAll). G3 하니스 (`vitest.adr248-g3`) after: propAxisCanvasDom 5 = HEAD 기준선과 같음. builder unit 실패 5 는 전부 이 ADR 밖 (ADR-294 병렬 세션 `emit` · contract 52 / 전체 실행 timeout 2 / `chromeIsland` HEAD 기준선).
- G4 번들 (`adr209-bundle-closure.mjs`, 같은 worktree 쌍): Builder initial JS gz 1,362,562 → 1,362,286 (**−276**) · CSS −225 · Preview initial JS 312,167 → 311,700 (**−467**) · CSS −176. 의존성 추가 0.

### Phase 4 — 2026-10-30 (G5 — 사용자 확인 「확인했다」 → Implemented)

- live: 본문 `### Live Exercise`. 문서: `css-tokens.md` (§테마 색은 resolver 한 곳 · TokenRef 표 · Tint 사다리 · Hover/Pressed) · resolver · `preview-system.css` 머리말 · CHANGELOG.
- **G5 사용자 확인 항목**: Preview/Publish 에서 바뀐 값 — Button primary hover · pressed (light `#141414` → `#0a0a0a`, dark `#d0d0d0` → neutral-50), `raised` (light white → gray-50, dark neutral-900 → zinc-850), negative hover · pressed (혼합), named hue hover · pressed (±1/255), Badge `gray` (비 neutral Tone 에서 Tone 무관으로), dark 랜딩 배경 (파랑 → builder zinc-200).
- 후속 (범위 밖, 보고만): Preview · Publish 의 `--font-sans` 미선언 · builder chrome 의 `ToggleButton.css` 가 `--neutral-hover` 를 폴백 없이 읽는데 `builder-system.css` 에 선언 없음 (지금은 `.button-base` 폴백) · `.panel-btn` (`panel-btn.css`) 소비처 0 · 변환표 `var(--X-hover, color-mix(…))` 폴백 문자열 (Decision 5) · DOM 전용 색의 Skia 대응.
