# ADR-295: D3 값 정렬 — 토큰 값 · 컴포넌트 치수 · 기기 scale 을 S2 style macro 에 맞춘다 (이름은 유지)

## Status

Accepted — 2026-10-30 (사용자 `/execute-adr 295` + [reviews/295.md](reviews/295.md) 최신 round pending 0 · HIGH 전부 fixed)

- 사용자 요청: `/create-adr` (2026-10-30) — 같은 대화의 Design 패널 일관성 감사 ([DESIGN_PANEL_CONSISTENCY_AUDIT_2026-10](../explanation/research/DESIGN_PANEL_CONSISTENCY_AUDIT_2026-10.md)) 와 S2 style macro 대조 뒤.
- 방향을 정한 사용자 원문 (2026-10-30, 같은 대화):
  - 「빌더가 제공하는 스타일규격화가된 RSC 를 하려다가 RAC 자체가 스타일이 빠져있는 headless 컴퍼넌트였고 … RAC 스타터킷 베이스에 RSC 의 스타일과 테마를 따라하다보니 일관되지 않고 있다」 → 세 어휘 공존 진단 (Context §문제).
  - 「저장소의 token 값도 style macro 의 값으로 교체 되어야 components 와 맞아지지않나?」 → 토큰 표 · rule 리터럴 · S2 설치본 세 값의 대조 (Context §코드 사실).
  - 「scale 변수 까지 가져가야 맞아지는것 아닌가?」 → 상수만이 아니라 기기 scale · 글자 식까지 (대안 B 채택).
  - 「XS,SM,LG,XL 등 일반이 보기에 단순하지않아 XS, S, M, L, XL 이런식으로 나눈 것이었다」 → 패널 라벨은 XS · S · M · L · XL, 토큰 원이름은 내부용 (Decision 5).
- 사용자가 이미 답한 확인 항목: 라벨 어휘 (위). 시각 결과가 바뀌는 선택은 아래 「사용자 결정 7건」 에 모았다.
- 이 ADR 은 **값 층** 만 다룬다. 패널 입력기가 노드에 토큰 참조를 저장하는 「토큰 모델 A」 ([시안 docs/design/styles-token-model/](../design/styles-token-model/canvas.json)) 는 후속 ADR 이며 이 ADR 뒤에 온다 — 노드가 토큰을 참조하기 시작한 뒤 토큰 값을 바꾸면 사용자 문서가 같이 바뀌기 때문 (breakdown §1 분리 4 질문).
- 리뷰 round 1 (2026-10-30, codex — [reviews/295.md](reviews/295.md)): HIGH 2 · MEDIUM 1 을 설계에 반영 — H1 축 이름으로 scale 을 가르면 S2 의 높이 상대 padding (`calc(self(height) / 2)`) · 글자 상대 gap (`fontRelative`) 을 놓친다 → **값의 형 4 종** (Decision 3) · H2 radius seed 가 preset 의 `RADIUS_BASE_PX` 로 덮인다 → 한 표에서 파생 + G4 는 최종 snapshot 검사 (Decision 1 · G4) · M3 빌더가 생성 시트 (`builder-components.css`) 를 읽어 `var(--radius-md)` 가 chrome 값 6 으로 풀린다 → 컴포넌트 토큰 변수 네임스페이스 분리 (Decision 8 · 9).
- 리뷰 round 2 (2026-10-30, codex 수리 검증): H2 fixed · H1 · M3 잔여 → 반영 — H1 `{ em }` 한 계수로는 S2 의 기기별 계수 (`text-to-visual` desktop 6/14 em · touch 8/17 em) 를 못 담는다 → 값은 **px · 기준 글자 쌍** + `touch` override (Decision 3) · M3 변수 이름을 갈라도 빌더 root 에 resolver 값 (touch 블록) 을 설치하면 생성 시트를 읽는 빌더 위젯 (`CompactSelect` → generated Select `font-size`) 이 17px 을 받는다 → 빌더 root 는 **chrome 소유 고정 변수 시트** (desktop 만) + 생성 시트 치수 전부 변수 + 커버리지 · 스냅샷 게이트 (Decision 9 · R10). 수리 검증 1 회 끝 — phase 당 판독 1 + 수리 검증 1 (`review-loop-closure.md` §1), 종결은 실행자 선언.
- 리뷰 round 3 (2026-10-30, claude — 사용자 재제기) · round 4 (사용자 판독 — severity 조정): HIGH 1 반영 — Design 패널 preset 이 빌더 root 의 computed value (chrome 값) 를 px 로 commit 해 (`BorderSection.tsx:229` → `cssLengthPx.ts:12` · `PropertyUnitInput.runtime.ts:126-134`) Decision 8 의 chrome 동결이 사용자 문서에 옛 값을 쓰게 한다 → preset 의 표시 · commit 값은 **활성 테마의 resolver snapshot** 에서 (Decision 5) · G5 에 preset 검사. 설계 정리 2 — 토큰 변수 접두를 생성 상태 변수 (`--catalog-hover-*` · `--catalog-selected-*`, `CatalogStates.css`) 와 가르고 (`--catalog-token-*`, Decision 9) 검사 대상을 구분 · 「22 페이지 실문서」 주장 철회 — 그 문서는 생성기 fixture 라 R4 는 unproven (사용자 결정 6 은 그 한계와 함께). 하니스 문구 정정 — `vitest.visual-parity.config.ts` 는 없고 팔레트 전수 픽셀 두 arm 하니스는 Phase 0 산출물 (LOW deferred — 설계 종결 조건 아님, `review-loop-closure.md` §2). 설계 판독 종결 — 실행자 선언 (round 4 반영, [reviews/295.md](reviews/295.md)).
- 메모리: `project-design-panel-consistency-audit-2026-10` · `feedback-panel-scale-labels-xs-s-m-l-xl-not-token-names` · `reference-design-data-mcp-installed-query-traps` (design-data 스키마는 설치본보다 뒤처진다 — 값의 정본은 **설치본**).

> **Phase 0 종결 (2026-10-30, G0)** — S2 추출기 (`adr295-s2-token-extract.mjs` — 설치본 style macro 실행 + probe 페이지 Playwright desktop · touch) 가 oracle JSON 을 만든다. 글자 · 행간 식 = 브라우저 computed 78/78. 발견: (1) S2 control 모서리는 **size 단계 배율** `round(8 × 1.125^단계)` (6 · 7 · 8 · 9 · 10, scale 무관) — Decision 3 의 형이 5 종이 되고, Decision 4 의 「가장 가까운 S2 단으로」 는 이 자리에 쓰지 않는다 (field 7 · 8 · 9 · 10 은 이미 S2) (2) field paddingX 는 높이 × 3/8 (9 · 12 · 15 · 18), Button 은 높이 / 2 (3) rule height 리터럴 389 중 201 이 파생 표지 `0` (4) touch 에뮬레이션은 `hasTouch` 로만 (CDP pointer media 무시). fixture `app-pages` 규모: 노드 3,339 · 명시 높이 0 · 컴포넌트 instance 811 · Text 1,551 (상한, R4 unproven 유지). G1 · G2 하니스 = 신규 `adr295PaletteSymmetry.browser.test.ts` (Phase 1 첫 단계). 대조표 · 깨지는 테스트 목록 · 기준 JSON: breakdown §6.0.

> **사용자 결정 (2026-10-30, Phase 0 대조표 뒤 — `/execute-adr 295` 대화)**: 1 = 「전부 S2 식으로」 (padding · gap 의 형과 값 모두 S2 — field 높이 × 3/8 · Button 높이 / 2 · `text-to-visual` · `text-to-control`) · 2 = 「S2 식 도입」 (행간 식) · 3 = 「본문 + 제목 두 묶음」 (본문 XS ~ XL 12 · 14 · 16 · 18 · 20, 제목 XS ~ XL heading 단계 18 · 20 · 22 · 28 · 36) · 5 = 「xs 2 · 2xl 24 유지, 3xl · 4xl 삭제」 · 6 = 「수용」 (명시 높이 없는 요소가 움직인다 — 변환 없음). Phase 2 착수 때 (같은 날): 4 = 「별도 토글」 (Preview 의 「터치 크기로 미리보기」 — 폭 (breakpoint) 과 무관, S2 처럼 pointer 축) · 7 = 「desktop 고정」 (Canvas 는 터치 벌을 그리지 않는다).

> **Phase 1 종결 (2026-10-30, G1)** — radius 한 표 (S2: md 8 · lg 10 · xl 16 · 2xl 24, `RADIUS_BASE_PX` 는 rendering 표에서 파생) · 글자 크기 = S2 단계 + 식 (본문 2xs 11 · 2xl 22 · 3xl 25 · 4xl 28 · 5xl 36, 제목 묶음 `text-heading-*`) · resolver 가 글자 변수를 전 키 emit (정확한 분수 행간) · 패널 preset = 활성 테마 해석값 (radius · typography · border). **행간 식은 Phase 3 로 이동** (사용자 결정 2026-10-30 — 높이 리터럴이 「줄 20 + 8 + 2 = 30」 과 맞물려 있어 행간만 바꾸면 2px 중간 결함). 글자 토큰을 상자 크기로 쓰던 자리 (Calendar · Radio · Switch · Checkbox) 는 이전 px 로 고정. G1: 247 조합 Canvas ↔ DOM 새 비대칭 0 · 상자 변화는 XS 글자 폭과 AvatarGroup XL 뿐 · live (Canvas · Radius preset L → 10 · Publish 변수) 확인. 상세 breakdown §6.1.

> **Phase 2 종결 (2026-10-30, G2)** — 생성 CSS 가 사용자 컴포넌트 치수 토큰을 `--catalog-token-*` 로 읽는다 (`var(--radius-*)` · `var(--text-*)` 0 — 이름은 `--catalog-token-` + 원 이름, 예 `--catalog-token-text-sm--line-height`). 빌더 root = `builder-catalog-vars.css` (chrome 고정값 · 미디어 쿼리 0), Preview · Publish root = resolver `cssVars` + 기본 시트 `theme-seed.generated.css` (첫 프레임). resolver 가 기기 두 벌 (`scale` 1 / 1.25 · `font.base` 14 / 17 · 글자 단계 · control 높이 5단) 을 만들고 터치 벌은 별도 배열 `touchCssVars` 로 S2 미디어 · Preview 터치 보기 (`:root[data-catalog-touch]`) 에만 싣는다. **record 의 글자 크기도 토큰 출처를 남긴다** (사용자 결정 「토큰 출처를 기억」): resolver 가 토큰에서 푼 값을 기록하고, part rule 컴파일러 · 손 part rule 은 글자 토큰을 참조로 남겨 library 가 토큰 값으로 바꾼다 — DOM 은 그 값을 토큰의 기기 변수로 쓴다 (리터럴 · 사용자 px 는 고정). 게이트: Decision 9 (a) ~ (c) · ADR-293 (a) 를 상태 변수 접두로 · G2 두 arm (desktop 은 Phase 1 대비 상자 변화 0, touch arm 은 Canvas = 터치 맵 · DOM = desktop record + CSS 터치 벌). 알려진 차이: 295 전부터의 24 (두 arm) + touch 만 14 (행간이 다른 단계 토큰의 비율 — Phase 3 행간 식으로 닫음 · ColorSlider Label 경로 미추적). live: Compare Mode 「터치 크기로 미리보기」 on/off (Text 14 → 17 · Label · Input) · 빌더 root 고정값 · Publish 터치 블록. 상세 breakdown §6.2.

> **Phase 3a (2026-10-30)** — 행간이 S2 식 (사용자 결정 2 — 14 → 18 · 16 → 20) 이 되고, 같은 커밋에서 control 상자 (field 입력칸 · DateInput · Button · ToggleButton · Tag · 증감 버튼 · 범위 상자) 의 높이를 S2 control 높이 토큰 `{size.height.<S>}` (20 · 24 · 32 · 40 · 48, 터치 × 1.25) 에 묶었다. 상자의 위아래 padding 은 S2 처럼 줄을 높이 가운데에 두는 식 하나 (`s2ControlPaddingY`) — 생성 CSS 는 그 식을 변수로 (터치 · 빌더 고정값에서 각자 풀림), Canvas 정의는 설치된 맵에서, rule 숫자는 desktop 결과 (생성기가 대조). 토큰 출처 기억을 minHeight · padding · 부품 크기로 넓혀 DOM 이 record 의 desktop px 대신 기기 변수를 쓴다. 행간 px 리터럴 19 → 토큰. G2 두 arm 263/263 (터치 알려진 차이 14 → 2). 남은 것 3b (리터럴 참조화 · ratchet) · 3c (값의 형 · padding · gap) · 3d. 상세 breakdown §6.3.

> 구현 상세: [design/295-d3-token-values-s2-alignment-breakdown.md](design/295-d3-token-values-s2-alignment-breakdown.md)

## Context

**SSOT 3-domain 관계**: **D3 (시각 스타일) 내부 — 값 층**. D3 SSOT 는 catalog `COMPONENT_RULES_TABLE` + theme/tokens (ADR-142 · 110 · 227) 이고, rule 은 토큰을 **이름으로** 참조한다. 이 ADR 은 (1) 그 이름이 가리키는 **값**, (2) rule 이 토큰 대신 들고 있는 **px 리터럴**, (3) 값에 곱해지는 **기기 scale** 을 정한다. 이름 체계 · D2 (S2 1.8.1 고정, ADR 10-09) · D1 은 바꾸지 않는다. 색 값은 ADR-290 · 293 의 영역이라 여기서 제외한다.

### 문제

D2 는 S2 1.8.1 에 고정됐고 (`d2S2Alignment.static.test.ts`), 컴포넌트 rule 은 S2 모양을 따라 만들었는데, 값은 세 출처가 섞여 있다.

| 층                                                       | 출처                              | 예                                                                          |
| -------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| 토큰 표 (`shared-tokens.css`)                            | RAC 스타터킷 = Tailwind v4 스케일 | `--radius-md: 0.375rem` (6) · `--text-2xl: 1.5rem` (24)                     |
| rule 리터럴 (`componentRulesTable.ts`)                   | S2 치수를 눈으로 옮긴 px          | TextField `borderRadius: 8` (S2 default) · `height: 30` (S2 M 32 와 2px 차) |
| S2 설치본 (`@react-spectrum/s2/style/spectrum-theme.ts`) | 식 + 기기 scale                   | 글자 `round(14 × 1.125^단계)` · 높이 `2rem × --s2-scale`                    |

결과는 「S2 같아 보이지만 S2 가 아닌」 컴포넌트다. 같은 저장소 안에서도 TagGroup 은 S 24 · M 32 · L 40 (S2 값) 이고 TextField · Select 는 S 22 · M 30 · L 42 (S2 − 2 / + 2) 다. 터치 기기용 scale 은 어디에도 없다.

### 코드 사실 (2026-10-30, main `2cbb83de9` + 미커밋 작업 트리)

| #   | 사실                                                                                                                                                                                                                                                                                | 경로                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| F1  | rule 의 값 종류 — 토큰 참조: fontSize 419 · borderRadius 347 · lineHeight 98 · borderWidth 56. **px 리터럴**: height 389 · gap 174 · paddingX 167 · paddingY 105 · iconSize 92 · borderRadius 74 · lineHeight 24 · minWidth 13                                                      | `packages/shared/src/catalog/generated/componentRulesTable.ts` (grep `^\s*<key>: [0-9]` vs `"{`)       |
| F2  | 토큰 표 값 — text 10 · 12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48, 행간 16 · 16 · 20 · 24 · 28 · 28 · 32 · 36 · 40 · 48; spacing 1 · 2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48; radius 0 · 2 · 4 · 6 · 8 · 12 · 16 · 24 · 32 · full                                                   | `packages/shared/src/components/styles/theme/shared-tokens.css:28-59, 86-114`                          |
| F3  | Skia 쪽 같은 표가 **정적 상수** — `"text-sm": 14` · `"text-sm--line-height": 20`                                                                                                                                                                                                    | `packages/rendering/src/primitives/typography.ts:14-32`                                                |
| F4  | 테마 설치가 맵 7 개를 통째로 바꾼다 (lightColors · darkColors · typography · radius · borderWidth · lightShadows · darkShadows) — scale · 글자 단계 맵은 없다                                                                                                                       | `packages/shared/src/catalog/runtime/themeMaps.ts:62-68` · `resolveThemeSnapshot.ts:56-72` (출력 모양) |
| F5  | 엔진 입력은 해석된 숫자 (`fontSize: number` · `lineHeight: number`)                                                                                                                                                                                                                 | `packages/shared/src/catalog/runtime/compositionRoot.ts:708-752`                                       |
| F6  | Skia 글자 크기 해석 — 숫자면 그대로, `{…}` 면 `resolveToken`, 그 밖은 px 파싱                                                                                                                                                                                                       | `packages/rendering/src/renderers/utils/resolveSpecFontSize.ts:25-37`                                  |
| F7  | 컴포넌트 높이 — TextField XS 18 · S 22 · M 30 · L 42 · XL 54 · Select 같음 · TagGroup S 24 · M 32 · L 40 · Button `height: 0` (lineHeight + paddingY 로 파생: M = 20 + 8 + 2 = 30)                                                                                                  | `componentRulesTable.ts` 각 `sizes`                                                                    |
| F8  | ADR-227 soft constraint — 「size / spacing 은 density 축이라 이 ADR 밖 — Spectrum 도 density 를 theme 와 분리한다」                                                                                                                                                                 | `docs/adr/completed/227-multi-theme-token-set-collection.md` §Soft constraints                         |
| F9  | 패널 preset 5단 = XS · S · M · L · XL — spacing · radius 는 `var(--…)`, border width 는 리터럴 px                                                                                                                                                                                   | `apps/builder/src/builder/components/property/propertyUnitPresets.ts:21-50`                            |
| F10 | breakpoint 는 폭 기준 desktop · tablet · mobile — pointer 기준 축 없음. 저장소에 `pointer: coarse` · `hover: none` 미디어 쿼리 0건                                                                                                                                                  | `packages/shared/src/catalog/document/types.ts:448` · grep                                             |
| F11 | **S2 설치본 1.8.1** — spacing `[0, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96]` (rem, scale 안 받음) · padding 은 px 고정 (「Spacing uses rems, padding does not」)                                                                                            | `node_modules/@react-spectrum/s2/style/spectrum-theme.ts:353-392`                                      |
| F12 | S2 radius `sm 4 · default 8 · lg 10 · xl 16 · full 9999 · pill` · border `0 · 1 · 2 · 4`                                                                                                                                                                                            | `spectrum-theme.ts:516-523` · `style/dist/spectrum-theme.mjs`                                          |
| F13 | S2 글자 = **단계 번호** (ui-xs −2 · ui-sm −1 · ui 0 · ui-lg 1 · ui-xl 2 · ui-2xl 3 · heading-xs 2 · heading-sm 3 · heading 4 · heading-lg 6 · heading-xl 8 · body-sm 0 · body 1 · body-lg 2) → `font-size: round(var(--s2-font-size-base, 14) × pow(1.125, 단계) / 16 × 1rem, 1px)` | `spectrum-theme.ts:636-676, 701, 978-983` · `dist/private/Button.css`                                  |
| F14 | S2 행간 = 글자 크기의 함수 `round(1em × (1.15 + (1 − (min(32, fs) − 10) / 22) × 0.15), 2px)`                                                                                                                                                                                        | `spectrum-theme.ts:702-706`                                                                            |
| F15 | S2 scale — `:root { --s2-scale: 1; --s2-font-size-base: 14 }` · `@media not ((hover: hover) and (pointer: fine)) { --s2-scale: 1.25; --s2-font-size-base: 17 }` · 높이 · 아이콘 · inset (`size()`) 만 `calc(px/16 rem × --s2-scale)`                                                | `dist/private/Provider.css` · `spectrum-theme.ts:467, 492`                                             |
| F16 | S2 컴포넌트 높이 — TextField `1.25rem · 1.5rem · 2rem · 2.5rem · 3rem × --s2-scale` (XS 20 · S 24 · M 32 · L 40 · XL 48, 터치 25 · 30 · 40 · 50 · 60)                                                                                                                               | `dist/private/TextField.css`                                                                           |

### Hard constraints

- **두 leg 대칭** (ssot-hierarchy §1 D3): 값을 바꿔도 Skia 와 DOM 은 같은 픽셀 — 팔레트 전수 Skia ↔ DOM Δ 0, **desktop (scale 1) 과 터치 (scale 1.25) 두 arm** 모두. 이를 재는 하니스는 지금 없다 (리뷰 round 3 m3 — `vitest.visual-parity.config.ts` 는 실재하지 않고, 실재하는 `vitest.adr248-g3.browser.config.ts` 의 `propAxisCanvasDom` 은 box 1 CSS px 허용 · `paletteBaseCanvas` 는 Canvas old/new) — **Phase 0 산출물** (breakdown Phase 0) 로 만들거나 기존 G3 하니스를 넓힌다.
- **식은 한 곳에서 한 번 평가**: 글자 반올림 · 행간 · scale 곱은 `resolveThemeSnapshot` 에서 숫자로 풀어 두 leg 가 같은 숫자를 받는다. Skia 렌더러 · 엔진에 식을 복제하지 않는다 (ADR-227 의 맵 교체 구조 유지).
- **문서 호환**: 노드 typed field 의 px 값 (`visual.*` · `sizing.*`, style-ssot §1) 은 바뀌지 않는다 — 바뀌는 것은 rule 이 주는 기본값뿐. 마이그레이션 코드 금지 (`feedback-no-document-migration-code-dev-stage`).
- **빌더 chrome 무변경**: `shared-tokens.css` · `builder-system.css` · 패널 CSS 의 값은 바꾸지 않는다 (Decision 8). 값 변경은 resolver seed · specs 맵 · 생성 CSS 에만.
- **전환 비용**: 테마 전환 600 요소 ≤ 25 ms (ADR-227 G2 기준) — 글자 식 평가가 맵 크기 (typography 키 ≈ 20 · size 키 5) 에 비례하므로 설치당 1회.
- **번들**: ADR-201 §initial 상한 (Builder ≤ 1,390,000 · Preview ≤ 320,000 B gz) 안.
- **rule 무변경 원칙의 예외 선언**: ADR-227 은 「rule 값 무변경 · 참조화는 Δ 0」 이었다. 이 ADR 은 **값을 바꾸는 것이 목적**이므로 Δ ≠ 0 이 정상이고, 대신 팔레트 전수 before/after 픽셀을 기록해 사용자 confirm 을 받는다 (G1).

### Soft constraints

- 이름 유지: 토큰 이름 (`--spacing-sm` · `{radius.md}` · `{typography.text-sm}`) 과 패널 라벨 (XS · S · M · L · XL) 은 그대로. 이름 개명은 TokenRef 2,333 + CSS 변수 + Skia 맵 전부라 이득 대비 비용이 크다 (대안 C).
- S2 색 · 그림자 값은 ADR-290 · 293 · 166 이 소유 — 여기서 건드리지 않는다.
- density (compact · regular · spacious) 는 이 ADR 밖 — scale 은 **기기** 축, density 는 **밀도** 축으로 서로 다르다 (ADR-227 F8 과 양립).

## Alternatives Considered

### 대안 A: 상수만 — 데스크톱 S2 값으로 토큰 표 · rule 리터럴 교체

- 설명: radius md 6 → 8 · lg 8 → 10 · xl 12 → 16, 제목 글자 사다리를 S2 desktop 값으로, 높이 리터럴을 S2 desktop 상수 (20 · 24 · 32 · 40 · 48) 로. scale · 식은 들이지 않는다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 MEDIUM (식의 결과를 손으로 옮긴 상수라 S2 가 바뀌면 다시 옮긴다) / 마이그레이션 MEDIUM (rule 기본 높이 ±2px 로 기존 문서 레이아웃이 움직인다)
- 한계: 터치 기기에서 publish 된 사이트가 S2 보다 20% 작다 — 사용자 원문 「scale 변수까지 가져가야 맞아지는 것 아닌가」 에 답하지 못한다.

### 대안 B: 상수 + 기기 scale + 글자 · 행간 식 (채택)

- 설명: A 에 더해 시스템 토큰 2 (`scale` 1 | 1.25 · `font.base` 14 | 17, pointer 미디어로 선택), 글자 토큰을 **단계 번호** 로 두고 식으로 풀며, 행간은 글자 크기의 함수, 높이 · 아이콘 · inset 은 scale 을 받고 padding · gap · radius · border 는 받지 않는다 (F11 · F15 의 분류 그대로). 평가는 `resolveThemeSnapshot` 한 곳.
- 위험: 기술 **HIGH** (Skia 가 CSS `round()` · `pow()` 와 같은 숫자를 내야 한다 — 반올림 경계 1px 차가 전 컴포넌트에 퍼진다) / 성능 LOW (설치당 1회 평가) / 유지보수 LOW (S2 가 바뀌면 단계 · 상수 몇 개만) / 마이그레이션 MEDIUM (A 와 같음 + 행간 식으로 모든 글자 행간이 바뀐다 — 14px 기준 20 → 18)
- 외부 근거: S2 자체가 이 구조 (F13 ~ F16). Figma · Framer 는 기기 scale 이 없고 breakpoint 만 있다 — 빌더 중 S2 를 D2 로 고정한 쪽은 S2 의 구조를 따르는 것이 맞다.

### 대안 C: 값 + 이름까지 S2 로 (`ui-sm` · `heading` · spacing 숫자단 · `default` radius)

- 설명: B 에 더해 토큰 이름과 패널 라벨을 S2 style macro 어휘로 개명.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (TokenRef 2,333 · CSS 변수 전수 · Skia 맵 · 패널 preset · 문서 · 테스트 개명 — 시각 Δ 0 로 해야 하는 개명이라 게이트가 B 보다 하나 더) / 마이그레이션 **HIGH** (테마 델타 키 (`typography.base-font-size` 등) 가 문서에 저장돼 있어 키 개명 = 문서 마이그레이션)
- 사용자 결정 10-30 (라벨 XS · S · M · L · XL) 과 충돌 — S2 어휘 (`ui-sm` · `heading-lg`) 는 일반 사용자에게 단순하지 않다.

### 대안 D: 현행 값 유지 + 「Spectrum 2」 테마 프리셋 추가

- 설명: 기본 토큰 값은 두고 ADR-227 테마 preset seed 에 S2 값 한 벌을 더해 고르게 한다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (rule 리터럴 389 + 167 + … 은 테마가 못 바꾼다 — 프리셋을 골라도 높이 · padding 은 그대로라 「S2 테마」 가 S2 가 아니다) / 마이그레이션 LOW
- scale 은 테마 축이 아니라 (F8) 프리셋으로 못 넣는다.

### 대안 E: DOM leg 에 S2 생성 CSS 를 그대로 쓰기

- 설명: Preview · Publish 가 `@react-spectrum/s2` 의 컴포넌트 CSS 를 직접 싣는다.
- 위험: 기술 **CRITICAL** (Skia leg 가 S2 CSS 를 읽을 수 없어 대칭 불가 — ssot-hierarchy §6 「CSS 가 기준」 금지 패턴) / 성능 MEDIUM (S2 CSS 번들) / 유지보수 HIGH / 마이그레이션 HIGH
- D3 SSOT (catalog) 를 S2 CSS 로 대체하는 것이라 ADR-142 · 063 과 충돌.

### Risk Threshold Check

| 대안  | HIGH+                          | 판정                                         |
| ----- | ------------------------------ | -------------------------------------------- |
| A     | 0                              | 터치 미해결 — 목적 미달                      |
| **B** | 기술 HIGH 1                    | 채택 — HIGH 는 G2 (두 arm 픽셀 대칭) 로 관리 |
| C     | 유지보수 · 마이그레이션 HIGH 2 | 기각                                         |
| D     | 유지보수 HIGH 1                | 기각 — rule 리터럴이 테마 밖                 |
| E     | CRITICAL 1                     | 기각                                         |

루프 1회: B 의 HIGH 는 「식을 한 곳에서 숫자로 풀고 두 leg 가 그 숫자를 받는다」 (Hard constraint) 로 회피 경로가 있어 수용. 2회 루프 불필요.

## Decision

**대안 B.** 위험 수용 근거: Skia · DOM 이 각자 식을 평가하면 반올림이 갈리지만, `resolveThemeSnapshot` 이 desktop · touch 두 벌의 **숫자** 를 만들고 DOM 은 그 숫자를 CSS 변수로 (미디어 쿼리로 두 벌 중 하나), Skia 는 맵으로 받으면 식은 한 곳에만 있다. Phase 0 에서 확정하는 두 arm 하니스 (G0) 가 팔레트 전수를 비교한다.

기각 사유 — A: 터치 기기에서 S2 와 다르다 (목적 미달). C: 이름 개명 비용 · 문서 마이그레이션 · 라벨 결정 충돌. D: rule 리터럴이 테마 밖이라 프리셋으로는 S2 가 되지 않는다. E: Skia 대칭 불가.

### Decision 1 — 토큰 표 값 (desktop, `font.base` 14)

| 축             | 지금                                                                    | 바꾼 뒤 (S2)                                                                                | 근거 |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| radius         | xs 2 · sm 4 · **md 6 · lg 8 · xl 12** · 2xl 16 · 3xl 24 · 4xl 32 · full | xs 2 · sm 4 · **md 8 · lg 10 · xl 16** · 2xl 24 · full (3xl · 4xl 삭제 — 사용자 결정 5)     | F12  |
| spacing        | 1 · 2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48                             | 그대로 (S2 와 동일)                                                                         | F11  |
| border         | none 0 · hairline 0.5 · thin 1 · thick 2                                | 그대로                                                                                      | F12  |
| 본문 글자 (ui) | 2xs 10 · xs 12 · sm 14 · base 16 · lg 18 · xl 20                        | 단계 −2 · −1 · 0 · 1 · 2 · 3 → desktop 11 · 12 · 14 · 16 · 18 · 20 (2xs 10 → 11)            | F13  |
| 제목 글자      | 2xl 24 · 3xl 30 · 4xl 36 · 5xl 48                                       | heading 단계 2 · 3 · 4 · 6 · 8 → desktop 18 · 20 · 22 · 28 · 36 (라벨 매핑은 사용자 결정 3) | F13  |
| 행간           | 글자별 고정 (14 → 20 · 16 → 24)                                         | 식 F14 (14 → 18 · 16 → 20 · 22 → 26) — 사용자 결정 2                                        | F14  |

radius 는 **한 표에서 파생한다** (리뷰 round 1 H2): 지금은 `radiusSeed` (specs 맵) 와 `radiusScaleToSkia.ts` 의 `RADIUS_BASE_PX` (xs 2 · sm 4 · md 6 · lg 8 · xl 12 · 2xl 16 · 3xl 24 · 4xl 32) 가 따로 있고, `resolveThemeSnapshot.ts:179-182` 가 seed 뒤에 `resolveRadiusTokens(preset.radiusScale)` 를 spread 하므로 seed 만 바꾸면 활성 테마 (radiusScale = md) 에서 구값으로 덮인다. 295 는 `RADIUS_BASE_PX` 를 S2 표 (위) 로 바꾸고 seed 는 그 표에서 **파생** (한 상수) · preset 배율 → 명시 델타 우선순위는 그대로 둔다. G4 는 seed 가 아니라 **활성 테마의 최종 snapshot · cssVars** (radiusScale 5 값 × 델타 없음 · 명시 델타 · reset) 를 검사한다.

### Decision 2 — 시스템 토큰 `scale` · `font.base` (기기 축)

- 값: desktop `scale 1 · font.base 14`, touch `scale 1.25 · font.base 17`. 선택 조건은 S2 와 같은 `not ((hover: hover) and (pointer: fine))`.
- 소유: 테마가 아니라 **시스템** (ADR-227 F8 유지). 테마 편집기에 노출하지 않는다.
- Canvas 는 항상 desktop 값으로 그린다 (저작 환경 = fine pointer). Preview · Publish 는 미디어 쿼리로 두 벌 중 하나 — Preview 에 「터치」 보기 토글 (사용자 결정 4).

### Decision 3 — scale 은 축 이름이 아니라 **값의 형** 이 정한다 (리뷰 round 1 H1 반영)

S2 의 치수는 네 형 중 하나이고, 같은 축 (padding) 안에서도 컴포넌트마다 형이 다르다 — Button 의 padding-inline 은 `calc(var(--F, var(--M)) / 2)` (높이 상대 · 높이가 scale 을 받으므로 결과도 받는다), Button (아이콘 + 글자) 의 gap `text-to-visual` 은 `fontRelative(6)` = 6/14 em 이되 touch 는 `fontRelative(8, 17)` = 8/17 em 으로 **계수 자체가 바뀌고** (`spectrum-theme.ts:430-433` · `src/style-utils.ts:308-309`), Switch 의 라벨 gap `text-to-control` 은 10/14 em 으로 기기 무관 (`src/Switch.tsx:91`), 일반 `padding` · `inset` 속성은 고정 px 표, `width` · `height` · `minHeight` 는 `size()` (기기 배율). (`spectrum-theme.ts:416-447, 467, 492, 871-886` · `dist/private/Button.css`)

| 형                             | S2 표현                                                                    | desktop → touch                         | rule 값 표현 (295)                                                                                                         | 평가                            |
| ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 고정 (fixed)                   | `padding: 12` · `inset: 8` (px · rem 표)                                   | 그대로                                  | 숫자 리터럴 (px)                                                                                                           | 없음                            |
| 기기 배율 (system-scale)       | `size(32)` = `2rem × --s2-scale`                                           | × 1.25                                  | `{size.height.M}` · `{size.icon.M}` 토큰 참조                                                                              | 토큰 표 × scale                 |
| 글자 상대 (font-relative)      | `fontRelative(6)` = `6/14 em` · touch 는 `fontRelative(8, 17)` = `8/17 em` | 기준 글자가 바뀌고, 계수도 바뀔 수 있다 | `{ em: [6, 14] }` (px · 기준 글자 쌍 — 반올림한 비율 금지) · touch 계수가 다르면 `{ em: [6, 14], touch: { em: [8, 17] } }` | 그 size 의 fontSize × px ÷ 기준 |
| 컨트롤 상대 (control-relative) | `calc(self(height) × 3/8)` · pill `self(height) / 2`                       | 높이 따라                               | `{ ofHeight: 0.5 }` (높이 비율)                                                                                            | 그 size 의 해석 높이 × 비율     |

- rule 의 치수 값은 이 네 형 중 하나로 **선언** 한다 (Phase 0 추출기가 컴포넌트 · 축마다 S2 의 형을 읽어 표로, codemod 가 그 표대로 바꾼다). 축 allowlist 는 두지 않는다.
- **기기 조건부 값** (리뷰 round 2 H1): S2 의 `touch:` 조건 (style macro Conditions 중 유일하게 가져오는 것 — Decision 2 의 pointer 미디어와 같은 조건) 처럼 어떤 형의 값이든 `touch` override 를 가질 수 있다 — `{ em: [6, 14], touch: { em: [8, 17] } }`. 추출기는 default 식과 touch 식을 **둘 다** 기록하고, resolver 는 desktop 벌을 default 로, touch 벌을 override 가 있으면 override 로 (없으면 default 식을 touch 글자 · scale 로) 평가한다. 한 계수로는 두 조건을 동시에 만족할 수 없다 — 6/14 em 을 글자 17 에 적용하면 7.29 (S2 8) · 8/17 em 을 글자 14 에 적용하면 6.59 (S2 6).
- 평가는 `resolveThemeSnapshot` 이 size 별 (XS ~ XL) × 기기 (desktop · touch) 로 숫자를 만들어 rule 소비자 (Skia · 생성 CSS · 엔진 입력) 에 넘긴다 — 생성 CSS 는 상대 형도 **숫자 변수** 로 받는다 (`calc` 를 두 leg 가 각자 풀지 않는다).
- 글자 크기는 `font.base` 단계식, 행간은 글자 크기의 함수 (Decision 1).
- 사용자가 어떤 축의 값 정렬을 뺀 경우 (사용자 결정 1) 그 축은 「S2 와 다름」 으로 명시한다 — 전체 S2 일치를 주장하지 않는다.

### Decision 4 — rule 리터럴의 참조화 범위

- **높이 축** (height 389 · minHeight 7): S2 component-height 토큰 5단 (`{size.height.XS|S|M|L|XL}` = 20 · 24 · 32 · 40 · 48) 으로 참조화. TextField · Select 22 · 30 · 42 · 54 와 TagGroup 24 · 32 · 40 의 불일치가 이때 사라진다. Button `height: 0` (파생) 은 S2 처럼 `min-height` 토큰으로.
- **아이콘** (iconSize 92): S2 아이콘 크기 단 (`{size.icon.*}`) 으로 참조화.
- **radius 리터럴 74 · lineHeight 리터럴 24**: 토큰 참조로 (값은 Decision 1 의 표에 있으면 그 이름, 없으면 가장 가까운 S2 단 — Phase 0 표).
- **padding · gap 리터럴 (167 + 105 + 174)**: Decision 3 의 형 표대로 선언한다 — Button padding 은 `{ ofHeight: 0.5 }`, text-to-visual gap 은 `{ em: … }`, S2 가 고정 px 인 자리는 숫자 그대로. **값** 을 S2 컴포넌트 치수와 맞출지는 Phase 0 의 컴포넌트별 대조표를 본 뒤 **사용자 결정 1** (형은 바꾸고 값은 두는 선택도 가능).

### Decision 5 — 이름과 라벨은 그대로

토큰 이름 (`xs · sm · md · lg · xl` · `text-sm` · `{radius.md}`) 과 패널 라벨 (XS · S · M · L · XL, 사용자 10-30) 은 바꾸지 않는다. 라벨 → 토큰 → 값 매핑은 `propertyUnitPresets.ts` 가 토큰 표에서 **파생** 하도록 바꿔 (지금은 손으로 적은 값) 세 층이 한 표를 본다.

- **preset 값의 oracle 은 활성 테마의 resolver snapshot 이다** (리뷰 round 3 h1 · round 4 확정). 지금은 preset 의 `var(--radius-md)` 를 **빌더 문서 root 의 computed value** 로 풀어 px 로 commit 한다 — `BorderSection.tsx:227-230` → `resolveCssLengthPx` (`cssLengthPx.ts:6-16`) · `PropertyUnitInput.runtime.ts:126-134` `getCssVariableValue` → `:188-198` `getPresetCommitValue`. Decision 8 · 9 가 빌더 root 를 chrome 값으로 동결하면 이 경로는 사용자 문서에 chrome 값 (radius md 6) 을 쓰고, 같은 요소의 rule 기본 `{radius.md}` 는 8 이 된다 (G5 「chrome 무변경」 은 이를 통과로 읽는다). 그래서 패널의 표시 (메뉴 글자 「M · 8」 · 슬라이더) 와 commit 은 **`resolveToken` 과 같은 맵 (desktop 벌 · 활성 preset 배율 · 명시 델타 반영)** 에서 받는다 — `var(--…)` 분기를 TokenRef 해석 (`specPresetResolver.ts` `resolveToNumber` 의 길) 로 바꾼다. 기대값은 고정 8 이 아니라 **현재 테마의 토큰 해석값** 이다 (테마 전환 · 델타 뒤에도 preset 이 따라간다). Phase 1 · G5 에 「preset commit 값 == 그 토큰의 snapshot 해석값」.

### Decision 6 — 평가 위치와 두 leg

- `resolveThemeSnapshot` 이 `typography` 맵을 단계 → px (desktop · touch 두 벌) 로, `size` 맵 (높이 · 아이콘) 을 px × scale 두 벌로 만든다. Skia 맵 (`themeMaps.ts`) 에 `size` 맵과 `touchTypography` · `touchSize` 가 추가되고, DOM `cssVars` 에 `--scale` · `--font-base` · 글자 · 높이 변수가 두 블록 (`:root` · `@media not (hover and fine)`) 으로 실린다.
- 생성 CSS (`generate-css.ts`) 는 높이 · 아이콘을 `var(--catalog-token-size-height-M)` 처럼 **변수** (이름은 Decision 9) 로 내고, 숫자 리터럴을 내지 않는다.
- 엔진 입력 (`compositionRoot.ts` `styleOf`) 은 지금처럼 숫자 — Canvas 는 desktop 맵만 읽는다.

### Decision 7 — 순서

ADR-293 (색 토큰 단일 생성 — `resolveThemeSnapshot` · `cssVars` 구조) → **이 ADR** → 토큰 모델 A (노드가 토큰 참조를 저장). 293 과는 `resolveThemeSnapshot.ts` · `themeMaps.ts` · `preview-system.css` 가 겹치므로 먼저 가는 쪽이 `cssVars` 의 `kind` · media 구조를 만든다.

### Decision 8 — 빌더 chrome 은 대상이 아니다 (사용자 질문 2026-10-30 「빌더에도 같이 적용되게 되나?」)

- 값이 바뀌는 층은 **사용자 컴포넌트** (Canvas · Preview · Publish) 뿐이다. 빌더 chrome (패널 · 헤더 · 레일 · Design 패널의 28/32 격자, `css-tokens.md` 2티어) 은 S2 scale · S2 치수를 받지 않는다 — 저작 도구는 밀도가 다르고 (사용자 결정 10-28 격자) 기기 scale 도 데스크톱 고정이다.
- 분리는 **지금 구조가 이미 한다**: 테마 resolver 의 `cssVars` (`--radius-*` · `--text-*` · 행간) 는 Preview `THEME_VARS` · Publish root 에만 실리고 (`resolveThemeSnapshot.ts:212, 260`), 빌더 root 는 `shared-tokens.css` 의 정적 값 + `[data-context="builder"]` (`builder-system.css`) 를 쓴다. 그래서 **값은 resolver seed (`radiusSeed` · `typographySeed` · specs 맵) 에서 바꾸고, `shared-tokens.css` 는 chrome 용 정적 값으로 그대로 둔다.** chrome 이 같은 이름 (`--radius-md` 81 곳 · `--text-xs` 175 곳 · `--text-2xs` 92 곳) 을 쓰고 있으므로 파일 값을 바꾸면 패널 모서리 · 글자가 같이 움직인다.
- 결과: 같은 이름 `--radius-md` 가 빌더 root 에서는 6, Preview · Publish root 에서는 8 이다. 이름이 같아도 **스코프가 다르다** — 혼동을 막기 위해 `shared-tokens.css` 머리말에 「chrome 정적 값, 사용자 컴포넌트 값은 resolver seed 가 정본」 을 적고 G4 가 resolver seed 만 S2 와 대조한다.
- Preview iframe 이 `THEME_VARS` 를 받기 전 첫 프레임은 `shared-tokens.css` 값으로 그려진다 — 지금은 seed = 파일 값이라 보이지 않던 깜빡임이 295 뒤에는 생긴다 (R8). Phase 2 에서 Preview · Publish 의 기본 시트에 resolver seed 를 **생성 파일** (`theme-seed.generated.css`) 로 싣는다.
- **생성 시트는 빌더도 읽는다** (리뷰 round 1 M3): `apps/builder/src/main.tsx` 가 `builder-components.css` 를 싣고 그 시트가 generated ToggleButton · Input · TextField · Select · ComboBox CSS 를 import 한다 (Data RowForm 의 reference 입력이 RAC ComboBox). 그래서 생성 CSS 의 `var(--radius-md)` 는 빌더 root 에서 chrome 값 6 으로 풀린다 — `shared-tokens.css` 동결만으로는 chrome 보존도, 컴포넌트 값 전달도 안 된다. 해법은 Decision 9.

- Design 패널 (토큰 모델 A) 이 보이는 칩 · 메뉴 값은 사용자 컴포넌트 층의 값 (S2) 이고, 패널 자신의 간격 · 글자는 chrome 값이다 — 한 화면에 두 값이 있는 것이 맞다.

### Decision 9 — 컴포넌트 토큰 변수는 chrome 변수와 다른 이름 공간 · 빌더 root 는 chrome 소유 고정값 (리뷰 round 1 M3 · round 2 M3 반영)

- 생성 CSS (`generate-css.ts` → `generated/*.css`) 와 resolver `cssVars` 는 사용자 컴포넌트 토큰을 **`--catalog-token-*`** 접두로 낸다 (`--catalog-token-radius-md` · `--catalog-token-font-size-sm` · `--catalog-token-size-height-M` · `--catalog-token-scale` …). chrome 은 지금처럼 `--radius-*` · `--text-*` (`shared-tokens.css`). TokenRef 이름 (`{radius.md}`) 과 패널 라벨은 그대로 — 바뀌는 것은 DOM 변수 이름뿐이고 발행처는 생성기 · resolver 두 곳이다. **접두는 생성 상태 변수와 가른다** (리뷰 round 3 m1): `--catalog-hover-*` · `--catalog-selected-*` · `--catalog-selected-pressed-*` (`generated/CatalogStates.css`, `stateStyles.ts` 생성 — 요소 inline 으로 들어오는 런타임 변수) 가 이미 `--catalog-` 를 쓰므로 토큰 변수는 `--catalog-token-` 세그먼트를 갖는다. 접두 공유 자체가 CSS 값 충돌은 아니고, 문제는 **검사 규칙의 오분류** 다 — ADR-293 게이트 (a) 가 「알려진 런타임 변수 `--catalog-*`」 로 접두 전체를 허용하므로 295 Phase 2 에서 그 허용 목록을 상태 변수 접두 (`CatalogStates.css` 생성 집합) 로 좁히고, `--catalog-token-*` 는 「resolver `cssVars` 출력 ∪ `builder-catalog-vars.css` 선언」 에 있을 때만 통과한다 (R5 겹침 표). 295 의 게이트 (a) 도 `--catalog-token-*` 만 센다.
- **이름 분리는 소비를 분리하지 않는다** (round 2 M3): 빌더 안 RAC 위젯 (`CompactSelect.tsx:31-40` → `react-aria-Select` · `PropertySelect` · Data RowForm 의 ComboBox · Input) 은 생성 시트의 base 블록 (`generated/Select.css:19` `font-size: var(--text-sm)` · radius 8 · gap 6 · icon 18, `data-size` 없음) 을 그대로 읽고 trigger 는 `font-size: inherit` (`form-controls.css:7-20`). 빌더 root 에 resolver 값 — 특히 touch 블록 — 을 설치하면 이 위젯이 pointer: coarse 에서 17px · S2 치수를 받는다. Decision 8 (chrome = desktop 고정 · S2 치수 무적용) 과 충돌하므로 **resolver 값은 빌더 root 에 설치하지 않는다.**
- 빌더 root 는 **chrome 소유 고정 시트** `builder-catalog-vars.css` 가 `--catalog-token-*` 를 선언한다 — desktop 한 벌만 (미디어 쿼리 0), 값은 295 전 생성 시트가 빌더에 주던 값 (radius 8 · 글자 14 · gap 6 · icon 18 …) 을 그대로 고정. `builder-components.css` 가 생성 시트 앞에 싣는다. 같은 이름이 빌더 root 에서는 chrome 고정값, Preview · Publish root 에서는 resolver 값 — Decision 8 의 「이름 같고 스코프 다름」 원칙이 `--catalog-token-*` 에도 적용된다.
- `theme-seed.generated.css` (resolver seed 의 desktop · touch 두 블록, R8) 는 **Preview · Publish 기본 시트에만** 싣고 `THEME_VARS` 가 덮는다. 빌더 root 에는 싣지 않는다.
- 생성 시트의 **치수는 전부 변수** 로 낸다 (고정 형 포함 — `var(--catalog-token-<토큰>)` 또는 상대 형의 size 별 해석 변수). 빌더가 읽는 base 블록에 리터럴이 남으면 사용자 결정 1 (padding · gap 값 정렬) 이 빌더 위젯까지 움직인다. 사용자 결정 1 로 값이 바뀌는 자리는 빌더 고정 시트가 **옛 값** 을 선언하므로 빌더는 그대로다.
- 기각한 대안 — 빌더용 생성 시트 사본 동결 (`builder-generated/`): 20 시트 중복이고 이후 catalog 구조 수리 (ADR-253 부품 등) 가 빌더 위젯에 닿지 않는다. 변수 고정은 **값** 만 가르고 구조는 공유한다.
- 게이트 (`builderCatalogVars.static.test.ts`, Phase 2): (a) 빌더가 import 하는 생성 시트가 참조하는 `--catalog-token-*` 집합 ⊆ `builder-catalog-vars.css` 선언 집합 (커버리지 — 미선언이면 fallback 없이 빈 값) · (b) 빌더 root 시트 (`index.css` 가 싣는 전부) 안 `pointer: fine` · `hover: hover` 쿼리 0 · 치수 리터럴 0 (생성 시트) · (c) **계산값 스냅샷** — 빌더 시트의 변수값으로 생성 시트의 모든 size 블록을 풀어 얻은 치수 == Phase 0 에서 뜬 295 전 기준 JSON (`builder-consumed-generated-baseline.json`). 바뀌어야 하는 자리 (결함 수리) 는 기준 JSON 을 사유와 함께 갱신. chrome CSS (`panel-system.css` · `inspector-layout.css` · `builder-system.css` · 패널 로컬 CSS) 안 `var(--catalog-token-` 0건 (`reservedPrefix.static` 에 `catalog-` 추가) 은 그대로 두되 **보조** 게이트다 — 소비 경계는 (a) ~ (c) 가 만든다.
- G5 에 빌더 위젯 (CompactSelect · PropertySelect · Data RowForm 의 ComboBox · Input · ImportPreview) 스크린샷 before/after Δ 0 을 **desktop 과 pointer: coarse 에뮬레이션 두 조건** 에서 넣는다.

### 사용자 결정 7건 (execute-adr 가 닿을 때 묻는다)

1. padding · gap 리터럴 값을 S2 컴포넌트 치수에 맞출지 — Phase 0 컴포넌트별 대조표 (예: Button M paddingX 12 vs S2 「padding = 높이/2」 16) 를 본 뒤. 맞추면 Button 폭이 바뀐다.
2. 행간 식 도입 — 모든 글자의 행간이 줄어든다 (14px: 20 → 18 · 16px: 24 → 20). 받아들일지, 식 없이 지금 고정 행간을 둘지.
3. 제목 라벨 매핑 — 「제목 XS · S · M · L · XL」 = heading 단계 2 · 3 · 4 · 6 · 8 (18 · 20 · 22 · 28 · 36) 으로 할지, 두 묶음 없이 한 묶음 (본문 XS ~ XL + XXL · XXXL) 으로 할지. Tailwind 제목 사다리 (24 · 30 · 36 · 48) 는 어느 쪽이든 버린다.
4. Preview 「터치」 보기 — 별도 토글인지, mobile breakpoint 를 고르면 자동으로 scale 1.25 인지 (S2 는 폭이 아니라 pointer 로 가르므로 둘은 다른 축).
5. radius `xs 2` · `2xl 24` 유지 여부 — S2 에 2 는 없고 24 는 없다 (`xl 16` 다음이 `full`). 유지하면 S2 밖 값이 토큰 표에 남는다.
6. 기존 문서의 레이아웃 변화 수용 — rule 기본 높이 ±2 ~ 6px · 행간 변화로 명시 값이 없는 요소가 움직인다 (G0 이 22 페이지 문서로 영향 비율을 잰다). 마이그레이션은 없다.
7. Canvas 를 desktop 고정으로 둘지 — 저작 중 터치 치수를 Canvas 에서도 보고 싶으면 Canvas 에도 scale 토글이 필요하다 (권고: Preview 만).

## Risks

| ID  | 위험                                                                                                                                                                                                                                             |  심각도  | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Skia 와 DOM 의 글자 반올림 · 행간 2px 반올림 · scale 곱이 1px 어긋나 전 컴포넌트에 퍼진다 (`resolveSpecFontSize.ts` · `typography.ts` · 생성 CSS `calc`)                                                                                         | **HIGH** | 식은 `resolveThemeSnapshot` 한 곳, 두 leg 는 숫자만 받는다 · G2 두 arm 픽셀 전수                                                                                                                                                                                                                                                                                                                                                                              |
| R2  | rule 치수의 형 (고정 · 배율 · 글자 상대 · 컨트롤 상대) 을 잘못 선언하면 터치에서 S2 와 다르게 커지거나 안 커진다 — 두 leg 가 같은 잘못된 값을 받으면 G2 는 통과한다                                                                              | **HIGH** | 형은 Phase 0 추출기가 S2 소스에서 읽은 표로 codemod (손 분류 금지) · G4 가 컴포넌트별 desktop · touch 결과 (Button padding · Button 아이콘 gap `text-to-visual` (touch 계수) · Switch 라벨 gap `text-to-control` · 일반 inset · TextField 높이) 를 독립 oracle (S2 설치본 CSS computed) 과 대조                                                                                                                                                               |
| R3  | 값 변경이 의도인데 「Δ 0 게이트」 어법을 그대로 쓰면 vacuous — before/after 기록 없이 승격                                                                                                                                                       | **HIGH** | G1: 팔레트 전수 before/after 픽셀 · 치수 표를 breakdown 에 남기고 사용자 confirm                                                                                                                                                                                                                                                                                                                                                                              |
| R4  | 기존 문서 레이아웃이 움직인다 (명시 높이 없는 요소) — 영향 범위 미수식화                                                                                                                                                                         |  MEDIUM  | **unproven** (round 3 m2 · round 4): 「22 페이지 실문서」 는 없다 — 그 문서는 생성기 fixture (`perfAppFixture.mjs` `app-pages`, 사용자 프로젝트에도 같은 생성기로 넣었다 — `CANVAS_RUST_DECISION_2026-10.md:66`) 라 분포 지표 (비율 · 평균 Δpx) 의 근거가 아니다 (measurement-validity Q1). G0 는 fixture 에서 **규모** (영향 요소 수 상한) 만 재고 R4 는 unproven 으로 적어 사용자 결정 6 을 그 한계와 함께 묻는다. 새 실문서 수집은 설계 종결 조건이 아니다 |
| R5  | ADR-293 · 290 과 `resolveThemeSnapshot.ts` · `preview-system.css` 겹침 — 순서 꼬이면 cssVars 구조 두 벌                                                                                                                                          |  MEDIUM  | Decision 7 순서 · breakdown §1 겹침 표                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R6  | S2 가 1.8.x 에서 단계 · 상수를 바꾸면 조용히 갈린다                                                                                                                                                                                              |   LOW    | G4 정적 게이트가 설치본 소스에서 값을 **추출** 해 대조 (손으로 적은 표 금지 — 측정 무결성 Q5)                                                                                                                                                                                                                                                                                                                                                                 |
| R7  | 터치 미디어 쿼리는 DOM 만 — Canvas (desktop) 와 Publish (터치) 가 의도대로 다름을 사용자가 결함으로 볼 수 있다                                                                                                                                   |   LOW    | Preview 터치 보기 (사용자 결정 4) · CHANGELOG 에 명시                                                                                                                                                                                                                                                                                                                                                                                                         |
| R8  | Preview iframe 첫 프레임이 `shared-tokens.css` (chrome 값) 로 그려졌다가 `THEME_VARS` 뒤 S2 값으로 바뀌어 깜빡인다 — 295 전에는 seed = 파일 값이라 없던 현상                                                                                     |  MEDIUM  | Phase 2: resolver seed 를 생성 파일 (`theme-seed.generated.css`) 로 Preview · Publish 기본 시트에 싣는다 · G5 live 에서 첫 프레임 확인                                                                                                                                                                                                                                                                                                                        |
| R9  | radius · 글자 값을 seed 에서만 바꾸고 preset 파생 표 (`RADIUS_BASE_PX`) · reset 경로를 놓치면 활성 테마가 구값으로 덮는다 — seed 만 보는 게이트는 통과                                                                                           | **HIGH** | 한 표 파생 (Decision 1) · G4 는 최종 snapshot · cssVars (preset 5 × 델타 유무 · reset · null) 검사                                                                                                                                                                                                                                                                                                                                                            |
| R10 | 빌더 root 에 resolver 값 (특히 touch 블록) 이 설치되면 생성 시트를 읽는 빌더 위젯 (CompactSelect · PropertySelect · Data RowForm) 이 S2 치수 · 17px 글자를 받는다 — 변수 이름 분리 · chrome CSS 직접 사용 금지 게이트로는 안 잡힌다 (round 2 M3) |  MEDIUM  | Decision 9: 빌더 root 는 chrome 소유 고정 시트 (desktop 만) · 생성 시트 치수 전부 변수 · 커버리지 · pointer 쿼리 0 · 계산값 스냅샷 게이트 · G5 위젯 두 조건 Δ 0                                                                                                                                                                                                                                                                                               |

## Gates

| Gate | 시점                         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                                                                                 |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0                      | **S2 값 추출 스크립트** 가 설치본 (`spectrum-theme.ts` · `dist/private/*.css` · `Provider.css` · 글자 단계 번호는 토큰 패키지 `fontSizeToken` 출처) 에서 spacing · radius · border · 글자 단계 · 행간 식 상수 · scale · 컴포넌트 높이 (TextField · Button · Select · Checkbox · Switch · TagGroup 등 rule 이 있는 가족 전부) 를 뽑아 표로 만든다 (oracle = 설치본, 손 표 금지) · 저장소 토큰 표 · rule 리터럴과 축별 대조표 · 22 페이지 fixture (`perfAppFixture.mjs` `app-pages` — 합성물, **규모 전용**: 명시 높이 없는 요소 수 상한만, 비율 · 평균 Δpx 는 인용하지 않는다 — R4 unproven) · **G1 · G2 하니스 확정** (팔레트 전수 Skia ↔ DOM 픽셀 두 arm — 기존 G3 `propAxisCanvasDom` 확장 또는 신규 파일, 이름 · 위치 · 비교 방식 (DPR 1 · `shot.width === rect.width`) 을 breakdown Phase 0 에 적는다) · RED: 토큰 표 값을 바꾸면 깨지는 기존 테스트 목록 | 설치본에서 값을 못 뽑는 축은 「미확인」 으로 표에 남기고 그 축은 Decision 1 에서 뺀다                                        |
| G1   | Phase 1 (토큰 표 · 행간 식)  | G0 에서 확정한 하니스로 팔레트 전수 **before/after** 픽셀 · 치수 표 (Δ ≠ 0 이 정상) 를 breakdown §6 에 기록 · 패널 preset commit 값 == 그 토큰의 활성 snapshot 해석값 (Decision 5 — radius · spacing 5단, preset radiusScale 두 값) · 사용자 confirm (결정 2 · 3 · 5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Δ 가 결정 범위 밖 (예: 행간 식이 글자를 잘라냄) 이면 그 축을 상수로 되돌리고 기록                                            |
| G2   | Phase 2 (scale · 두 벌 설치) | 같은 하니스 **desktop arm + touch arm (scale 1.25 · base 17)** 팔레트 전수 Skia ↔ DOM Δ 0 · 측정 조건 명시 (DPR 1 · viewport 고정 · `shot.width === rect.width`) · 불리 케이스: 가장 작은 글자 (11) · 가장 큰 높이 (XL 60) · 중첩 field · `builderCatalogVars.static` (a) 커버리지 (`--catalog-token-*` 만) (b) 빌더 root pointer 쿼리 0 · 생성 시트 치수 리터럴 0 (c) 빌더 계산값 == 295 전 기준 JSON · ADR-293 게이트 (a) 허용 목록을 상태 변수 접두로 좁힌 뒤 미선언 `--catalog-token-*` 0                                                                                                                                                                                                                                                                                                                                                                 | 1px 어긋나는 축의 반올림 위치를 snapshot 으로 옮기고 재측정 (렌더러에 식 추가 금지)                                          |
| G3   | Phase 3 (rule 참조화)        | ratchet: height 리터럴 389 → 0 · minHeight 7 → 0 · iconSize 92 → 0 · radius 리터럴 74 → 0 · lineHeight 리터럴 24 → 0 · **형 미선언 치수 0** (padding · gap · inset 의 모든 숫자가 고정 형으로 선언됐거나 상대 형 객체) (`componentRulesTable.static.test`) · 원복 RED (한 리터럴을 되살리면 FAIL)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 참조화 · 형 선언이 불가능한 값은 `INTENTIONAL_LITERAL` 표에 사유와 함께 등재 — 등재 없는 값은 FAIL                           |
| G4   | Phase 3                      | `d3S2Alignment.static.test.ts`: (a) 토큰 표 (radius · spacing · border · 글자 단계 · 행간 상수 · scale · 높이 5단) == G0 추출기 결과 · (b) **활성 테마 최종 snapshot · cssVars** — preset radiusScale 5 값 × (델타 없음 · 명시 델타 · reset) 에서 radius · 글자 맵이 Decision 1 표와 같다 (seed 가 아니라 `resolveThemeSnapshot` 출력) · (c) 컴포넌트별 desktop · touch 결과 (Button padding · Button 아이콘 gap (touch 계수 8/17) · Switch 라벨 gap · track · 일반 inset · TextField 높이) == S2 설치본 computed (G0 브라우저 추출)                                                                                                                                                                                                                                                                                                                          | 설치본 버전이 바뀌어 값이 갈리면 FAIL 이 정상 — 표를 갱신하고 G1 을 다시 잰다                                                |
| G5   | Phase 4 (live)               | Chrome MCP: Canvas (desktop) · Preview desktop · Preview 터치 보기 · Publish 번들을 pointer: coarse 에뮬레이션으로 — TextField M 32 / 40 · Button padding 16 / 20 · 글자 14 / 17 · TagGroup 과 TextField 높이 일치 · **Design 패널 Radius preset M 을 TextField 에 적용 → commit 값 == 활성 테마 `{radius.md}` 해석값** (Decision 5 — 테마를 바꾼 뒤 한 번 더) · **빌더 chrome 무변경** (패널 표면 + 빌더 위젯 CompactSelect · PropertySelect · Data RowForm 스크린샷 before/after Δ 0 — desktop 과 pointer: coarse 에뮬레이션 두 조건 · Data RowForm ComboBox 모서리 8 · 글자 14 유지) · 테마 전환 600 요소 ≤ 25 ms · 번들 Δ (Builder ≤ +2,048 · Preview ≤ +1,024 B gz) · 사용자 confirm                                                                                                                                                                     | 전환 비용 초과면 touch 벌을 지연 생성 (처음 미디어 매칭 때) · chrome Δ 가 있으면 그 변수의 소비처를 Decision 9 게이트에 추가 |
| G6   | 종결                         | `.claude/rules/ssot-hierarchy.md` D3 절 · `css-tokens.md` (2티어 컨트롤 크기와 scale 관계) · `style-ssot.md` · `docs/CHANGELOG.md` · ADR-227 F8 각주 · README 갱신 · `### Live Exercise`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 문서 누락이면 Stop hook 이 승격을 막는다                                                                                     |

측정 무결성 5-질문: Q1 측정 대상은 생성기 fixture (`app-pages`) — **합성물, 규모 전용** (분포 지표 인용 금지 · R4 unproven, round 3 m2) · Q2 불리 케이스 (최소 글자 · 최대 높이 · 중첩) · Q3 before/after 는 같은 하니스 같은 조건 · Q4 소비 경로 = `resolveThemeSnapshot` → 두 leg (G2 가 실제 렌더로 확인) + 패널 preset 쓰기 경로 (Decision 5 — G1 · G5) · Q5 oracle = 설치본 소스 추출 (손 표 · 이 ADR 의 표 모두 oracle 아님).

### Live Exercise

(Implemented 승격 시 기재.)

## Consequences

### Positive

- D2 (S2 prop) 와 D3 (S2 값) 가 같은 정본을 보게 되어 「S2 같아 보이지만 다른」 컴포넌트가 없어진다 — TextField · Select · TagGroup 높이 불일치처럼 저장소 안의 발산도 같이 사라진다.
- 터치 기기에서 publish 결과가 S2 와 같다 (scale 1.25 · 글자 17).
- rule 리터럴 586 (height · minHeight · iconSize · radius · lineHeight) 이 토큰 참조가 되어 테마 · scale 이 닿는다.
- 패널 preset 이 토큰 표에서 파생되어 라벨 · 토큰 · 값 세 층이 한 표 — 후속 「토큰 모델 A」 의 전제가 된다.
- S2 가 바뀌면 정적 게이트 (G4) 가 알려 준다.

### Negative

- 값 변경이라 기존 문서의 레이아웃이 움직인다 (±2 ~ 6px · 행간) — 사용자 결정 6.
- `resolveThemeSnapshot` 이 두 벌 (desktop · touch) 을 만들어 맵 · cssVars 가 약 2배 — 설치당 1회라 비용은 작지만 코드는 늘어난다.
- Canvas 와 Publish 가 터치에서 의도적으로 다르다 — Preview 터치 보기가 없으면 사용자가 결함으로 본다.
- ADR-293 · 290 과 파일이 겹쳐 순서를 지켜야 한다.
