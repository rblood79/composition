# ADR-293: 테마 색 토큰 단일 생성 — resolver 가 두 렌더러에 같은 값을 싣는다

## Status

Proposed — 2026-10-30

- 사용자 요청: `/create-adr` (2026-10-30) — 같은 대화의 테마 토큰 ↔ 컴포넌트 연결 조사 (Skia · DOM 값 불일치 10 · 생성 CSS 의 미정의 변수 6) 뒤.
- 방향을 정한 사용자 원문 (2026-10-30, 같은 대화):
  - 「theme의 token color들이 components library들에 정확히 연결이 되어있나?」 → 이름은 전부 있으나 값은 두 렌더러가 따로 만든다 (Context §현재).
  - 「테마 accent color + tone 조합으로 토큰을 다양하게 생성해 내야 한다 그 생성된 token을 catalog 에서 소비하고, 컴퍼넌트에서 catalog에 color token을 사용함. flow가 이런데 구멍이 몇개 있다는 거고」 → 흐름은 맞고, 구멍의 원인은 「토큰 생성」 이 resolver 와 `preview-system.css` 두 곳이라는 점.
  - 「accent + tone ─ resolver (tintToSkiaColors 등) → Skia 맵 → Canvas / └→ preview → DOM 이렇게는 안되나」 → 된다 (대안 C). 이 답 직후 `/create-adr` 입력 — 이 ADR 은 그 구조를 채택안으로 쓴다.
- ADR-290 과의 관계: ADR-290 Decision 5 는 accent 계열 7 변수를 resolver 가 DOM 에 싣기로 했다. 이 ADR 은 그 설치 경로를 **테마 색 전체**로 넓힌다 — 7 변수는 부분집합이고 ADR-290 의 대비 · 역할 결정은 바꾸지 않는다. 별도 ADR 로 쓰는 이유: ADR-290 은 리뷰 round 2 가 닫힌 (pending 0) 전제 확정 상태라 본문 scope 를 넓히면 결정 지점 ④ 다. 사용자가 「별도 ADR」 로 `/create-adr` 를 입력했으므로 그 요청이 분리 confirm 이다 (breakdown §1 에 4 질문 lock-in).
- 사용자 지시 (2026-10-30, 리뷰 round 1 뒤): 「S2 설치본 대조 (spectrum-theme.ts 의 한 단 이동 규칙 · 역할 토큰) 는 Phase 0 항목으로」 — breakdown Phase 0 · §6. 대조는 **파생 규칙**의 참조이고 S2 의 값을 가져오는 것이 아니다 (D3 정본은 catalog). 사용자 원문 (같은 날): 「RAC를 core 컴퍼넌트로 사용하지만 기본 스타일은 RSC 를 따르고 있다. 기본이되는 theme와 components library의 정본은 … style-macro 를 먼저 체크해보는것은 어떤가」 → 설치본 (`@react-spectrum/s2` 1.8.1) 이 참조 정본, 웹 문서는 보조.
- 사용자가 이미 답한 확인 항목: 없음. 값이 갈리는 10 건 중 사용자가 골라야 하는 것은 아래 「사용자 결정 3건」 에 모았다.
- 리뷰 round 1 (2026-10-30, codex — [reviews/293.md](reviews/293.md), 사용자 「리뷰부터 해야하지않나」): HIGH 4 · MEDIUM 1 · LOW 1 — 실행자가 코드로 확인한 뒤 전부 설계에 반영 (pending 0).
  - H1 변환표가 둘 (`tokenResolver.ts` · `colorTokenToCss.ts`) 이고 shared 표에 named hue 의 `-subtle` 이 없어 `colorTokenCssVarName("purple-subtle")` 이 `--purple-subtle` 을 내는데 Badge 생성 CSS 는 `--hue-purple-subtle` 을 읽는다 → **변환표를 하나로** (Decision 1 · 5, 정적 게이트 G1).
  - H2 명시 델타 뒤의 hover · pressed 파생 (`resolveThemeSnapshot.ts:313-326`) 이 Skia 맵만 고친다 → 전체 출력은 **최종 맵에서, 함수 끝에서** (Decision 1).
  - H3 breakdown Phase 2 삭제 목록 (`--bg*` · `--fg*` · `--border*`) 이 resolver 가 싣지 않는 DOM 전용 변수 (`--fg-emphasis` · `--bg-emphasis` · `--border-pressed` · `--fg-disabled` …) 까지 지운다 — Table 선택 글자 · Switch pressed 가 값을 잃는다 → 삭제는 **resolver 출력 집합에 있는 이름만** (Decision 3).
  - H4 Builder `/` 랜딩 (`main.tsx:90` `App` · `hero.css:4-9`) 은 builder scope 도 resolver 설치도 없이 `--accent` · `--bg-raised` 를 쓴다 → 랜딩을 builder chrome 으로 (`data-context="builder"`, Signin · Dashboard 와 같은 처리) — Decision 7 · R6 MED.
  - M1 `ThemeCssVar` 필드가 290 breakdown 은 `color: boolean`, 이 문서는 `kind` → **`color: boolean`** 으로 통일.
  - L1 (deferred) 정적 게이트의 자동 집행은 vitest `unit` project 다 — pre-push 는 성능 검사만 돈다. 저장소의 다른 정적 게이트와 같은 수단이라 이 ADR 에서 바꾸지 않는다.
- 리뷰 round 2 (2026-10-30, codex 수리 검증 — 사용자가 판독을 붙여 넣음): round 1 반영 5 건은 fixed 로 인정, **HIGH 1** — 전체 출력이 명시 델타를 덮는다. `on-negative` 와 `white` 가 같은 변수 `--color-white` 로 나가 (`colorTokenToCss.ts:31,47`) `color.on-negative=#123456` 이 뒤의 `white=#ffffff` 에 덮인다 → negative 버튼 글자 Canvas `#123456` · DOM 흰색. 실행자 확인으로 범위가 더 넓다: `tokenResolver.ts` 에서는 `elevated` 도 `--color-white` 를 쓰고 (`:192` 근처, shared 표에는 `elevated` 항목 자체가 없음), `disabled` 는 Tone seed 가 내는 팔레트 변수 `--color-neutral-200` 을 그대로 가리킨다 — `disabled` 델타가 Tone 단계를 덮는다. 수리: **토큰 ↔ 변수 1:1** (Decision 1) — 독립적으로 델타 가능한 토큰은 고유 의미 변수 (`on-negative → --fg-on-negative` · `elevated → --bg-elevated` · `disabled → --bg-disabled`), 팔레트 변수 (`--color-*`) 를 가리키는 토큰은 고정 상수 `white` · `black` 뿐. G1 에 이름 충돌 검사, G3 에 독립 델타 표본. 수리 검증 HIGH 는 실행자가 반영으로 닫는다 (`review-loop-closure.md` §1).
- 메모리: `project-theme-accent-contrast-leonardo-analysis-2026-10` (ADR-290 실측) · `feedback-fallback-equals-default-masks-dropped-channel` (폴백이 기본값과 같으면 끊긴 채널이 안 보인다) · `feedback-infra-exists-vs-wired-consumption-path` (기반이 있다 ≠ 소비 경로가 연결됐다) · `feedback-design-whole-scope-upfront-no-deferral`.

> 구현 상세: [design/293-theme-color-single-source-breakdown.md](design/293-theme-color-single-source-breakdown.md)

## Context

**Domain**: D3 (시각 스타일). theme/tokens 가 만든 색이 catalog rule 의 `{color.X}` 참조를 거쳐 Builder (Skia) 와 Preview/Publish (DOM) 에 닿는 경로. D1 · D2 는 건드리지 않는다. 생성기 (`CSSGenerator.ts`) 는 바꾸지 않고, 생성기가 이미 내는 변수에 값을 공급한다.

### 현재 — 토큰 생성이 두 곳

사용자가 그린 흐름 「accent + tone → 토큰 → catalog → 컴포넌트」 에서 첫 단계가 둘이다.

| 소비자                | 토큰 값을 만드는 곳                                                                                                                                                                                             | 근거                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Builder (Skia)        | `resolveThemeSnapshot` → `colors.light` / `colors.dark` → `installThemeMaps`                                                                                                                                    | `packages/shared/src/catalog/runtime/themeMaps.ts:56-68`                                                                             |
| Preview/Publish (DOM) | resolver 는 `--tint` · `--accent-subtle` · `--border-hover` · `--color-neutral-N` · 반경 · 테두리 폭만 보낸다 (`resolveThemeSnapshot.ts:200-215`). 나머지 색은 `preview-system.css` 가 CSS 식으로 다시 계산한다 | `preview-system.css:159-166` (`oklch(from var(--tint) 55% c h)` · pressed 50%) · `:122` · `:140` · `:191` · `:271` · `:288` · `:312` |

resolver 머리말은 「DOM 은 `--tint` 하나면 `oklch(from var(--tint) …)` 가 같은 식이라 대칭」 이라고 적었다 (`resolveThemeSnapshot.ts:14-15`). accent 기본값 하나는 맞고, 그 밖의 파생은 식이 다르다.

**값이 갈리는 곳 (blue · neutral 프리셋, 2026-10-30 실측 — 전 프리셋 표는 breakdown §5)**

| 토큰                                              | Skia                                       | DOM                   | Skia 식                                              | DOM 식                                                                                                |
| ------------------------------------------------- | ------------------------------------------ | --------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `accent-pressed`                                  | `#2948b4`                                  | `#294fde`             | 검정 75% 혼합 (`tintToSkiaColors.ts:153`)            | L 50% (`preview-system.css:163-166`)                                                                  |
| `neutral-hover` light / dark                      | `#d4d4d4` / `#525252`                      | `#c3c3c3` / `#363636` | Tone 단계 300 / 600 (`neutralToSkiaColors.ts:40,57`) | 변수 미정의 → `.button-base` 폴백 `color-mix(var(--button-color) 85%, black)` (`utilities.css:24-28`) |
| Button primary hover (실제 생성 CSS) light / dark | `#d4d4d4` / `#525252`                      | `#141414` / `#d0d0d0` | 같음                                                 | `--button-color` 가 `--fg` 라 글자색을 어둡게 한 값                                                   |
| `negative-pressed`                                | `#b33333` (손값, `colors.ts:47`)           | `#e7000b`             | 손값                                                 | `--color-error-600` (`preview-system.css:191`)                                                        |
| `raised` light / dark                             | `#f9fafb` / `#202023` (`colors.ts:57,107`) | `#ffffff` / `#171717` | gray-50 / zinc-850                                   | `--color-white` / `--color-neutral-900` (`preview-system.css:122,271`)                                |
| dark `on-accent` (slate)                          | `#171717` (`tintToSkiaColors.ts:154`)      | `#0f172b`             | 고정                                                 | `--color-neutral-900` (`preview-system.css:288`) — ADR-290 결정 1 (흰색) 이 해소                      |

**연결이 끊긴 곳** — 생성 CSS 는 variant 의 hover · pressed 토큰을 `--button-color-hover: var(--neutral-hover);` 처럼 폴백 없이 낸다 (`CSSGenerator.ts:951-967`, `Button.css:49,64-65,92,107-108,122-123` · `ToggleButton.css:48-49`). 변수 6 개 (`--accent-hover` · `--neutral-hover` · `--neutral-pressed` · `--negative-hover` · `--purple-hover` · `--purple-pressed`) 는 DOM 어디에도 선언이 없다 — 생성기 주석이 「테마가 명시할 자리 (override slot)」 라고 적은 대로 비워 둔 것인데, resolver 가 그 자리를 채우지 않는다. 기존 게이트 `catalogTokenExists.static.test.ts:237` 는 변환표 `tokenToCSSVar` 의 문자열 (폴백 포함, `tokenResolver.ts:139-160`) 을 검사하므로 생성 CSS 의 폴백 없는 변수를 잡지 못한다.

**변환표가 둘 (리뷰 H1)** — 토큰 → CSS 변수 이름 표가 `packages/rendering/src/renderers/utils/tokenResolver.ts` (`tokenToCSSVar`, 생성기가 쓴다) 와 `packages/shared/src/catalog/resolvers/colorTokenToCss.ts` (`colorTokenToCss`, resolver · rulePaint 가 쓴다) 두 벌이다. 둘은 「같은 규칙」 이라고 주석에 적혀 있지만 (`colorTokenToCss.ts:72`) named hue 의 `-subtle` 이 shared 표에 없다 — `tokenResolver.ts:204` 는 `purple-subtle → var(--hue-purple-subtle)`, shared 는 항목이 없어 `colorTokenCssVarName("purple-subtle")` (`resolveThemeSnapshot.ts:128-133`) 이 `--purple-subtle` 을 낸다. Badge 생성 CSS 는 `--hue-purple-subtle` 을 읽는다 (`Badge.css:370`). 이 상태에서 resolver 가 전체 키를 내보내면 named hue subtle 은 이름이 어긋나 DOM 에 닿지 않는다.

**토큰 여럿이 변수 하나를 쓴다 (리뷰 round 2)** — 같은 표 안에서 `on-negative` · `white` (shared · rendering) 와 `elevated` (rendering 만) 가 `var(--color-white)` 를, `disabled` 가 `var(--color-neutral-200)` 을 가리킨다 (`colorTokenToCss.ts:31,47` · `tokenResolver.ts:161,192`). 한 변수는 값 하나만 가질 수 있으므로, 이 토큰들을 따로 델타하면 마지막으로 쓴 값만 남는다. `--color-neutral-200` 은 Tone seed 가 이미 내는 팔레트 단계라 (`resolveThemeSnapshot.ts:208-209`) `disabled` 를 바꾸면 Tone 이 같이 바뀐다. 지금은 resolver 가 명시 델타만 싣기 때문에 드러나지 않았다.

**resolver 안의 파생 순서 (리뷰 H2)** — 명시 델타 처리 뒤 `resolveThemeSnapshot.ts:313-326` 이 「`<x>` 가 명시되고 `<x>-hover` 가 명시되지 않았으면」 Skia 맵의 hover · pressed 를 base 에서 다시 혼합한다. DOM 쪽은 지금 `color-mix` 폴백이 base 변수를 따라가므로 이 블록은 Skia 맵만 고친다. seed 직후에 전체를 내보내면 이 재계산이 DOM 에 빠진다.

**DOM 전용 색 변수 (리뷰 H3)** — `preview-system.css` 에는 Skia 맵에 대응이 없는 색 변수가 있다: `--bg-emphasis` · `--fg-emphasis` · `--fg-disabled` · `--border-pressed` · `--bg-inset-pressed` · `--fg-field` · `--fg-on-accent-pressed` · `--accent-negative` · `--link*` · `--focus-ring`. 손 CSS 가 쓴다 (`Table.css:568,572` `--fg-emphasis` · `Switch.css:69` `--bg-emphasis`). 이들은 Tone 단계의 별칭 (`var(--color-neutral-N)`) 이라 식이 아니고, resolver 가 싣지 않으므로 이 ADR 의 삭제 대상이 아니다. DOM 에만 있는 색이라는 사실 자체는 D3 대칭의 빈 자리지만 catalog rule 이 참조하지 않아 (`{color.X}` 89 종 밖) 이 ADR 범위 밖 — 후속 항목.

**snapshot 없이 `preview-system.css` 를 쓰는 production 문서 (리뷰 H4)** — Builder 메인 문서는 `apps/builder/src/index.css:27` 로 공용 `theme.css` 를 로드하고, `applyCatalogPreviewTheme` 은 Preview iframe (`catalogPreviewApp.ts:73`) 과 Publish (`catalogSession.ts:20`) 에서만 부른다. 편집 화면 (`BuilderViewport.tsx:14`) · Signin (`Signin.tsx:122`) · Dashboard (`dashboard/index.tsx:615`) · portal (`builder-system.css:75-76`) 은 `data-context="builder"` 로 `builder-system.css` 값을 받는다. **`/` 랜딩 (`main.tsx:90` → `App`) 만 scope 가 없고** `hero.css:4-9` 가 `:root[data-theme]` 배경에 `--accent` · `--bg-raised` 를 쓴다 — 지금은 `preview-system.css` 의 식이 채우고 있다.

**생성기 지원 선언**: `CSSGenerator.ts` 는 hover · pressed 변수를 이미 emit 한다. 이 ADR 은 생성기를 확장하지 않는다 — 값 공급자 (resolver) · 변수 이름 표 (하나로) · 소비 CSS (`preview-system.css`) 를 바꾼다.

### Hard constraints

- D3 대칭: 두 렌더러가 **같은 SSOT 에서 같은 시각 결과** (`ssot-hierarchy.md` §1 D3). 지금은 SSOT 가 같아도 파생 식이 둘이라 결과가 다르다.
- Preview initial 번들 ≤ 320,000 B gz · Builder ≤ 1,390,000 (ADR-201 상한, `adr201-bundle-gate.mjs`). resolver 출력이 늘어나는 양은 변수 ~50 × 2 모드 문자열 — 번들이 아니라 런타임 `<style>` 텍스트.
- 테마 적용은 Publish 첫 그림 전 동기 경로 (`apps/publish/src/catalogSession.ts:20` `applyTheme: applyCatalogPreviewTheme`). 비동기 로드 금지.
- 스키마 변경 0 · 마이그레이션 코드 0 (사용자 지시 2026-10-14).
- WCAG 글자 4.5 · 비글자 3.0 (ADR-290 이 accent 에 대해 보장 — 이 ADR 은 그 값을 그대로 DOM 에 옮기므로 대비를 깨지 않는다).
- forced-colors: 테마 색 변수가 layer 없는 `:root` 에 놓이면 `preview-system.css:348-376` 의 시스템 색을 이긴다 (ADR-290 리뷰 M3). 설치 범위를 넓히면 이 문제도 같이 넓어진다.

### Soft constraints

- Builder 자체 chrome (`[data-context="builder"]`, `builder-system.css:79-210`) 은 별도 무채색 테마라 값은 범위 밖. 다만 `/` 랜딩이 그 scope 밖에 있다 (위 H4) — 이 ADR 이 scope 안으로 넣는다.
- `--tint-N` 사다리 · `--link` · `--focus-ring` · chart accent 4 단계는 DOM 전용 변수고 ADR-290 결정 8 이 유지한다. `--tint` 는 계속 싣는다.
- 하위 영역에서 `--tint` 를 덮어 재착색하는 소비자는 현재 없다 (`s2PropAlignment.ts:111` — Card 의 `data-accent` 재착색은 제거됨). Themes 패널 미리보기 (`MiniThemePreview.tsx:20-41`, 자기 `--mp-*` 변수) 와 색 피커 사다리 (`resolveAccentLadder`, TS) 도 CSS 식을 쓰지 않는다.

## Alternatives Considered

### 대안 A: 현행 유지 + 게이트만 추가

- 설명: 생성 CSS 의 폴백 없는 미정의 변수를 잡는 정적 테스트와, Skia ↔ DOM 값을 비교하는 browser 테스트만 추가한다. 값은 고치지 않는다.
- 위험: 기술(L) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)
  - 유지보수 H: 두 식이 그대로라 테스트가 빨간 채로 남거나, 통과시키려면 양쪽 식을 손으로 맞춰야 한다 — 매 토큰 추가마다 반복.

### 대안 B: 두 식을 손으로 맞춘다 (CSS 식을 Skia 식에 정렬)

- 설명: `preview-system.css` 의 `oklch(from var(--tint) …)` 를 Skia 와 같은 `color-mix` 로 바꾸고, 생성기가 hover · pressed 변수에 폴백 식을 붙인다. neutral · negative · raised 도 CSS 쪽 식을 Skia 값과 같게 고친다. ADR-290 의 accent 결과만 resolver 가 싣는 혼합도 기술적으로는 가능하다 (리뷰 round 1 지적).
- 위험: 기술(M) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)
  - 기술 M: Tone 단계 (`neutral-hover` = neutral-300) 는 CSS 에서 `var(--color-neutral-300)` 로 쓸 수 있지만, ADR-290 의 **대비 탐색 결과** (명도가 프리셋 · 모드마다 달라짐) 는 CSS 식으로 재현할 수 없다 — ADR-290 이 Decision 5 에서 resolver 설치를 택한 이유.
  - 유지보수 H: 생성 식이 두 벌로 남아 ADR-290 뒤에는 accent 는 resolver, 나머지는 CSS 라는 세 번째 상태가 된다. 명시 델타 뒤 파생 (`:313-326`) 같은 규칙을 CSS 식에도 복제해야 한다.

### 대안 C: resolver 가 테마 색 전체를 DOM 변수로 싣고, CSS 의 색 계산식을 없앤다 (채택)

- 설명: `resolveThemeSnapshot` 이 모든 델타 · 파생 계산이 끝난 **최종** `colors.light` / `colors.dark` 의 모든 키를 `cssVars` 로도 내보낸다. 변수 이름은 생성기가 쓰는 표와 **같은 표 하나**에서 나온다. `applyCatalogPreviewTheme` 은 색 변수 블록을 `@media not (forced-colors: active)` 안에 쓴다 (ADR-290 Decision 5 와 같은 방식, 대상만 전체). `preview-system.css` 에서 resolver 가 싣는 이름의 선언만 제거한다. 생성기는 그대로 — 지금 비어 있던 override slot 이 채워진다. snapshot 없는 Builder 랜딩은 builder chrome scope 로 넣는다.
- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(**M**)
  - 마이그레이션 M: Preview/Publish 의 보이는 값이 바뀐다 (neutral 버튼 hover · pressed, raised 표면, negative pressed). 스키마는 그대로라 되돌리기는 커밋 revert 한 번.
  - 기술 L: 연결 (`cssVars` → `applyCatalogPreviewTheme`) 은 이미 있다. 늘어나는 것은 키 목록과 표 통일.

### 대안 D: DOM 의 식을 Skia 로 옮긴다 (Skia 가 CSS relative color 를 흉내)

- 설명: Skia 쪽에서 `oklch(from …)` · `color-mix` 를 그대로 계산해 CSS 와 같은 값을 만든다 (`oklchToHex.ts` 가 일부 이미 함).
- 위험: 기술(M) / 성능(L) / 유지보수(**H**) / 마이그레이션(L)
  - 유지보수 H: 정본이 CSS 파일이 된다 — 「CSS 가 기준, Skia 가 따라간다」 는 D3 금지 언어 (`ssot-hierarchy.md` §6). ADR-290 의 탐색은 CSS 로 못 쓰므로 이 방향은 ADR-290 과 양립하지 않는다.

### Risk Threshold Check

| 대안 | HIGH+                 | 판정 |
| ---- | --------------------- | ---- |
| A    | 유지보수 H            | 기각 |
| B    | 유지보수 H            | 기각 |
| C    | 없음 (마이그레이션 M) | 채택 |
| D    | 유지보수 H            | 기각 |

HIGH 없는 대안이 있어 루프 종료.

## Decision

**대안 C 채택.** 토큰 생성은 resolver 한 곳이다. Skia 맵에 들어가는 색 객체 (`colors.light` / `colors.dark`) 가 그대로 DOM 변수가 된다. `preview-system.css` 는 테마 색을 계산하지 않는다.

1. **resolver 출력** — 모든 명시 델타와 파생 재계산 (`resolveThemeSnapshot.ts:313-326`) 이 끝난 뒤, 함수 끝에서 `colors.light` / `colors.dark` 의 모든 키를 `cssVars` 로 싣는다 (seed 직후가 아니다 — 리뷰 H2). 변수 이름은 **생성기와 같은 표**에서 — 토큰 → CSS 변수 표를 하나로 합쳐 (`colorTokenToCss.ts` 를 정본으로 두고 `tokenResolver.ts` 의 `tokenToCSSVar` 가 그것을 import 하거나, 역방향 — breakdown Phase 1 이 정한다) `colorTokenCssVarName` 이 생성 CSS 가 읽는 이름을 내게 한다 (리뷰 H1 — named hue `-subtle` 이 shared 표에 빠져 있었다). `ThemeCssVar` 에 `color: boolean` (ADR-290 breakdown 과 같은 필드 — 리뷰 M1). **토큰 ↔ 변수는 1:1 이다** (리뷰 round 2): 독립적으로 델타할 수 있는 토큰은 저마다 의미 변수를 갖는다 — `on-negative → --fg-on-negative` · `elevated → --bg-elevated` · `disabled → --bg-disabled` (이름은 `css-tokens.md` 의 `--bg-*` · `--fg-*` 범주). 팔레트 변수 (`--color-*`) 를 가리키는 토큰은 고정 상수 `white` · `black` 둘뿐이고, 그 둘과 Tone 의 `--color-neutral-N` 은 resolver 가 테마 색으로 덮지 않는다. 생성 CSS 의 해당 참조 (`var(--color-white)` · `var(--color-neutral-200)` 중 이 토큰에서 온 것) 는 표를 바꾸고 `pnpm generate:css` 로 다시 낸다.
2. **DOM 설치** — `applyCatalogPreviewTheme` (`domView.runtime.ts:11-28`, Preview · Publish 공용) 은 `color` 변수를 `@media not (forced-colors: active) { :root {…} [data-theme="dark"] {…} }` 안에, 반경 · 글꼴 · 테두리 폭은 밖에 쓴다. ADR-290 Decision 5 가 정한 방식이고 대상만 전체다 — 두 ADR 이 같은 함수를 고치므로 먼저 들어가는 쪽이 구조를 만들고 뒤는 키만 더한다 (breakdown §1).
3. **CSS 정리** — `preview-system.css` 에서 **resolver 출력 집합에 있는 이름의 선언만** 제거한다 (light · dark 블록 양쪽, 계산식 · 폴백 체인 포함). 그 밖의 변수 — DOM 전용 색 (`--bg-emphasis` · `--fg-emphasis` · `--fg-disabled` · `--border-pressed` · `--bg-inset-pressed` · `--fg-field` · `--fg-on-accent-pressed` · `--accent-negative`) · `--tint` 입력 · `--tint-N` 사다리 · `--link*` · `--focus-ring` · `--chart-accent-N` (ADR-290 결정 8) · forced-colors 블록 · 그림자 · 타이포 — 는 그대로 둔다 (리뷰 H3). 제거하는 이름에는 **폴백을 남기지 않는다** — 값이 빠지면 화면이 깨져 보여야 끊긴 채널이 드러난다 (메모리 `feedback-fallback-equals-default-masks-dropped-channel`). 이 점은 사용자 결정 3.
4. **값의 정본** — 통일하면 Skia 값이 DOM 에도 간다. 갈리는 10 건 중 accent 계열 · dark on-accent 는 ADR-290 이 정했다 (결정 3 · 결정 1). neutral hover · pressed 는 Tone 단계 (`neutralToSkiaColors.ts`) — Tone 을 바꾸면 따라 움직이는 쪽이 맞다. `raised` 와 `negative` 는 사용자 결정 1 · 2.
5. **생성기 무변경 · 변환표는 하나로** — `CSSGenerator.ts` 의 override slot 은 그대로. 변환표는 Decision 1 대로 한 벌이 되고, 그 안의 `var(--X-hover, color-mix(…))` 폴백 문자열은 이번에 지우지 않는다 — resolver 가 값을 싣는 순간 죽은 가지가 되지만, snapshot 없이 CSS 만 로드하는 테스트 (`shadowCssParity` · chart browser 테스트) 가 있어 후속 정리로 둔다.
6. **게이트** — 정적 테스트: (a) 생성 CSS 전체를 훑어 폴백 없는 `var(--X)` 가 resolver 출력 · theme CSS · 알려진 런타임 변수 (`--catalog-*` · `--trigger-width` · `--button-*` · `--indicator-*` · `--inset-*`) 어디에도 없으면 실패. (b) resolver `cssVars` 의 색 키 집합 = `colors.light` 키 집합 = `colors.dark` 키 집합, 그리고 모든 키의 변수 이름이 생성기 표와 같다 (표가 하나면 자명 — 둘로 남는 과도기엔 비교). (c) 이름 충돌 — 표 안에서 서로 다른 토큰이 같은 변수를 가리키면 실패 · `white` · `black` 밖의 토큰이 `--color-*` 를 가리키면 실패 · resolver 가 내는 테마 색 변수가 Tone seed 의 `--color-neutral-N` 과 겹치면 실패. browser 테스트: 프리셋 10 × Tone 5 × 모드 2 **와 명시 델타 표본** (리뷰 H2 반례 `color.negative=#ff0000` · `color.purple-subtle=#123456` · `color.raised` 등, 그리고 round 2 반례 — `color.on-negative=#123456` · `color.elevated` · `color.disabled` 를 **하나씩 따로** 지정해 다른 토큰 값이 그대로인지) 에 대해 catalog 가 참조하는 색 토큰 전부의 DOM 계산값 (`getComputedStyle`) 과 Skia 맵 hex 가 같다. 이 browser 테스트가 증명하는 것은 **직렬화 · 설치 · cascade 의 연결**이다 — resolver 식 자체가 맞는지 (대비 · 사용자 의도) 는 ADR-290 의 단위 테스트와 G5 사용자 확인의 몫.
7. **snapshot 없는 Builder 문서** — `/` 랜딩 (`App` · `hero.css`) 에 `data-context="builder"` 를 준다 (Signin · Dashboard 가 이미 같은 이유로 그렇게 한다 — `Signin.tsx:121` 주석). Builder 메인 문서에서 `preview-system.css` 의 테마 색을 직접 읽는 자리는 그것으로 0 이 된다 (Phase 0 전수가 확인 — 리뷰 H4).

**위험 수용 근거**: 남는 것은 Preview/Publish 의 시각 변화 (neutral hover · pressed · raised · negative pressed) 와 ADR-290 과의 파일 겹침이다. 스키마 · 저장 · 생성기는 그대로라 revert 한 번으로 돌아간다. 변화하는 값은 전부 breakdown §5 표에 before/after 로 적고 G5 에서 사용자가 본다.

**기각 사유**:

- **A**: 테스트는 구멍을 보여 주지만 막지 못한다. 두 식이 남는 한 토큰을 더할 때마다 다시 벌어진다.
- **B**: ADR-290 의 탐색 결과는 CSS 식으로 못 쓴다. accent 만 resolver, 나머지만 CSS 라는 세 번째 상태를 만들고, 명시 델타 뒤 파생 규칙을 CSS 에 한 번 더 써야 한다.
- **D**: CSS 가 정본이 되는 방향 — D3 대칭 원칙과 ADR-290 에 어긋난다.

### 사용자 결정 3건 (execute-adr 가 그 항목에 닿을 때 묻는다)

1. **`raised` (popover · dropdown 바탕)** — (권고) Skia 값 gray-50 / zinc-850 (`css-tokens.md` §Surface Elevation 이 적은 값과 같음 — DOM 의 white / neutral-900 이 문서와 어긋난 쪽) / 대안: DOM 값 유지 (resolver 의 raised 를 white · neutral-900 으로).
2. **`negative-hover` · `negative-pressed`** — (권고) accent 와 같은 규칙 (검정 85% · 75% 혼합) 을 resolver 가 `negative` 에서 계산 — hover · pressed 파생 규칙이 하나가 된다 / 대안: `colors.ts:46-47,96-97` 의 손값 유지 (light `#cb3a3a` · `#b33333`).
3. **CSS 폴백 잔존** — (권고) 제거 — resolver 값이 빠지면 보이게 / 대안: `preview-system.css` 에 지금 식을 폴백으로 남김 (snapshot 없는 테스트 · 옛 fixture 호환, 대신 끊긴 채널이 다시 숨는다).

## Risks

| ID  | 위험                                                                                                                                                                                             | 심각도 | 대응                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Preview/Publish 의 보이는 값이 바뀐다 — neutral 버튼 hover · pressed (light `#141414` → `#d4d4d4`), raised, negative pressed. 사용자가 지금 모양에 익숙하면 회귀로 보일 수 있다                  |  HIGH  | breakdown §5 before/after 표 · G5 사용자 확인 · 결정 1 · 2                                                                                                    |
| R2  | ADR-290 과 같은 파일 (`resolveThemeSnapshot.ts` · `domView.runtime.ts` · `preview-system.css`) 을 고친다 — 순서가 어긋나면 한쪽이 다른 쪽을 덮어쓴다                                             |  MED   | breakdown §1 순서 lock-in: 먼저 들어가는 ADR 이 `color: boolean` · media 구조를 만들고, 뒤는 키만 더한다                                                      |
| R3  | resolver snapshot 없이 CSS 만 로드하는 경로 (테마 상태 없는 테스트 · 옛 fixture) 가 색을 잃는다                                                                                                  |  MED   | Phase 0 에서 `preview-system.css` 를 snapshot 없이 쓰는 소비자 전수 (grep + 테스트 실행) · 결정 3                                                             |
| R4  | 색 변수를 media 안에 넣으면 forced-colors 에서 catalog 색이 전부 시스템 색으로 간다 — 의도이지만 Badge 등 상태색 구분이 사라질 수 있다                                                           |  LOW   | ADR-290 리뷰 M3 가 이미 요구한 방향. G5 forced-colors 시나리오 1                                                                                              |
| R5  | `<style>` 텍스트가 변수 ~50 × 2 만큼 늘어 Preview 첫 적용이 느려진다                                                                                                                             |  LOW   | 문자열 수 KB · 동기 한 번. G4 로 Preview 번들 Δ 확인 (런타임 텍스트는 번들 밖)                                                                                |
| R6  | snapshot 도 builder scope 도 없는 production 문서 — Builder `/` 랜딩 (`hero.css:4-9`) — 가 CSS 제거 뒤 배경 · 제목 색을 잃는다 (리뷰 H4)                                                         |  MED   | Decision 7 (`data-context="builder"`) · Phase 0 전수에 「Builder 메인 문서에서 `preview-system.css` 테마 색을 직접 읽는 자리 0」 포함 · G5 에 `/` 직접 진입 1 |
| R7  | 변환표 둘이 다시 벌어진다 — 한쪽에만 키를 더하면 resolver 이름과 생성 CSS 이름이 어긋나 DOM 에 닿지 않는다 (리뷰 H1)                                                                             |  MED   | Decision 1 표 하나로 · G1 (b) 이름 일치 정적 검사                                                                                                             |
| R8  | 토큰 여럿이 변수 하나를 써서 한 토큰의 델타가 다른 토큰 (또는 Tone 팔레트) 을 덮는다 — `on-negative` · `elevated` · `white` → `--color-white`, `disabled` → `--color-neutral-200` (리뷰 round 2) |  HIGH  | Decision 1 토큰 ↔ 변수 1:1 · G1 (c) 충돌 검사 · G3 독립 델타 표본                                                                                             |

## Gates

| Gate | 시점       | 통과 조건                                                                                                                                                                                                                                                                                                                                                    | 실패 시 대안                                                     |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| G0   | Phase 0 끝 | 프리셋 10 × Tone 5 × 모드 2 의 Skia ↔ DOM 값 표 (breakdown §5) 고정 · 생성 CSS 미정의 변수 RED 테스트가 지금 코드에서 6 개를 잡는다 · snapshot 없는 CSS 소비자 목록 (테스트 + production 문서 — `/` 랜딩 포함) · 변환표 두 벌의 키 차이 목록 (named hue `-subtle` 등) · S2 설치본 대조표 (breakdown §6 — 토큰별 S2 역할 토큰 · 상태 규칙 · 우리 규칙 · 차이) | 표가 안 나오면 비교 스크립트부터 고친다                          |
| G1   | Phase 1 끝 | 정적: `cssVars` 색 키 = `colors.light` 키 = `colors.dark` 키 · 모든 키의 변수 이름 = 생성기가 쓰는 이름 · 표 안 이름 충돌 0 (서로 다른 토큰 → 같은 변수 0 · `white` · `black` 밖 `--color-*` 0 · Tone seed 와 겹침 0) · 기존 `catalogTokenExists` 7/7 유지 · `semanticAlias.symmetry` 유지                                                                   | 빠진 키를 표 · seed 에 더한다                                    |
| G2   | Phase 2 끝 | 정적: 생성 CSS 의 폴백 없는 `var(--X)` 전부가 선언돼 있다 (RED → GREEN) · `preview-system.css` 에 resolver 출력 이름의 선언 0 · DOM 전용 변수 목록 (Decision 3) 은 그대로 · Builder 메인 문서에 `data-context` 밖 테마 색 소비 0                                                                                                                             | 남은 선언은 사유를 적거나 지운다                                 |
| G3   | Phase 3 끝 | browser: 10 × 5 × 2 + 명시 델타 표본 (독립 델타 — 한 토큰만 바꾸고 나머지 토큰 값 불변 포함) 에서 catalog 색 참조 전부 DOM 계산값 = Skia hex (Δ 0)                                                                                                                                                                                                           | 다른 값은 resolver 식 결함 — 식을 고친다, CSS 로 돌아가지 않는다 |
| G4   | Phase 3 끝 | Preview initial Δ ≤ +1,024 B gz · Builder Δ ≤ +1,024 · 의존성 추가 0                                                                                                                                                                                                                                                                                         | 초과분의 모듈을 찾아 lazy 경계 뒤로                              |
| G5   | Phase 4    | live (Chrome MCP, 별도 dev 서버): Preview · Publish 에서 Button primary/accent/negative hover · pressed · Popover raised · Badge (named hue subtle 포함) · dark 전환 · Tone 전환 · 명시 델타 (negative hex) · forced-colors 에뮬레이션 · Builder `/` 직접 진입 — Canvas 와 같은 색 · 콘솔 오류 0 → 사용자 확인 (R1)                                          | 사용자가 특정 값을 거절하면 그 토큰만 결정 1 · 2 의 대안으로     |

정적 게이트의 집행은 저장소의 다른 `*.static.test.ts` 와 같이 vitest `unit` project 다 (pre-push 는 성능 검사만 돈다 — 리뷰 L1, deferred).

### Live Exercise

(Implemented 승격 시 기재.)

## Consequences

### Positive

- 토큰 생성이 한 곳 — Skia 맵과 DOM 변수가 같은 객체에서 나온다. 앞으로 토큰을 더하면 두 렌더러에 한 번에 닿는다.
- 변환표가 하나 — named hue `-subtle` 같은 누락이 생기지 않는다.
- 생성 CSS 의 hover · pressed override slot 6 개가 채워져 `.button-base` 폴백으로 떨어지지 않는다 (Button primary hover 가 글자색을 어둡게 한 값에서 Tone 단계로).
- ADR-290 Phase 2 「DOM 색 변수 7」 이 이 ADR 의 부분집합이 되어 ADR-290 은 탐색 · 분류에 집중한다.
- 게이트가 변환표가 아니라 **생성 CSS 와 계산값**을 본다.

### Negative

- Preview/Publish 의 몇 가지 색이 바뀐다 (R1). CHANGELOG 에 적는다.
- `preview-system.css` 가 테마 색을 설명하지 않게 된다 — 「`--tint` 하나로 전체 전환」 머리말 (`:7`) 과 `css-tokens.md` §Tint Color System 을 고친다.
- 변환표의 color-mix 폴백 문자열이 죽은 가지로 남는다 (Decision 5) — 후속 정리 항목. DOM 전용 색 변수 (Decision 3 목록) 가 Skia 에 대응이 없다는 사실도 후속 항목으로 남는다.
