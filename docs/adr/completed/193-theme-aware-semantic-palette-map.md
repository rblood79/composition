# ADR-193: 테마별 semantic·named hue 팔레트 단계 매핑 단일 원천화 — dark 모드 Skia↔CSS 대칭 복원

## Status

Implemented — 2026-08-27 (Phase 0~~3 / G0~~G4 당일 종결; Accepted 2026-08-27 review round 1 — MED 1 fixed / LOW 1 deferred; Proposed 2026-08-27)

## Context

### Domain (SSOT 체인 — [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

D3 (시각 스타일). 팔레트 정의는 [ADR-191](191-tailwind-theme-single-source-palette.md) 로 `tailwindcss/theme.css` 단일 원천이 됐고, 그 위의 semantic alias 층도 2026-08-27 후속 (`b785315e8` / `58f5b1f08`) 으로 **light 모드에 한해** Builder(Skia) ↔ Preview/Publish(DOM) 가 같은 (family, step) 을 본다. 남은 결함은 **dark 모드에서 두 소비자가 다른 단계를 고르는 것**이다. D1/D2 무관 — DOM 구조·props 변경 없음.

### 문제 — dark 에서 Skia 는 단계를 바꾸고 CSS 는 안 바꾼다

2026-08-27 실측 (breakdown §0):

- **테마 신호는 이미 하나다.** Skia 는 `resolveSkiaTheme(useThemeConfigStore.darkMode)` (`SkiaCanvas.tsx:405`), Preview 는 같은 값이 `setDarkMode` postMessage → `document.documentElement[data-theme]` (`preview/store/runtimeStore.ts:568`) 로 도달한다. 콘텐츠 dark 모드는 실제 기능이다.
- **Skia**: `colors.ts` `lightColors` ≠ `darkColors` 가 67 토큰 중 63 (white/black/on-negative/transparent 만 같음). named/status hue 는 dark 에서 한 단계 밝게 (positive green-600 → 500, negative red-500 → 400, indigo-700 → 500 …), subtle 은 100 → 900.
- **CSS**: catalog `{color.X}` → `colorTokenToCss.ts` 매핑 37 토큰 중 **12 는 preview-system `[data-theme="dark"]` 가 재정의하는 semantic var** (`--accent/--fg/--bg/--border/--negative` … — 소비 697) 라 dark 에서 바뀌지만, **24 는 `var(--color-*)` 팔레트 var 직접 참조** (소비 212) 라 dark 에서도 light 값 그대로다. 잔존 spec 매핑 `tokenResolver.ts` 의 `-subtle` 25 도 같은 구조. 생성 CSS 에 `data-theme` 분기는 0건 (`generated/*.css` grep).
- 결과: dark 프로젝트에서 Badge/StatusLight/Meter 의 positive·informative·notice 와 named hue 17종 (+subtle) 이 캔버스와 Preview 에서 다른 색이다. **ADR-191 G2 는 light 만 검증했다.**
- **부수 결손 (같은 층)**: `colors.ts` 에 `gray` / `green-named` (+subtle) 항목이 없어 `resolveColor("{color.gray}")` = `undefined` → Badge `gray` variant 가 캔버스에서 **비가시** (live: 81×42 빈 선택 박스). CSS 는 `var(--color-neutral-500)` 로 정상 — dark 여부와 무관한 Skia 단독 결함이나 같은 매핑 테이블 결손이라 본 ADR 이 함께 닫는다. `-hover/-pressed` 는 Skia 가 소비하지 않아 (hover 는 D1/Preview 소관) 결손이어도 무해.

### Generator 지원 선언 (adr-writing 반복 패턴 #2)

현행 생성기는 테마 분기를 emit 하지 않는다: catalog 경로는 `colorTokenToCss()` 가 토큰당 `var(--X)` 한 줄을 돌려주고, 잔존 spec 경로 `CSSGenerator.ts` 는 `tokenToCSSVar()` 로 같은 일을 한다. 컴포넌트별 `[data-theme="dark"]` selector 를 emit 하는 기능은 없고, 본 ADR 은 그것을 **추가하지 않는다** — 테마 분기는 컴포넌트 CSS 가 아니라 **semantic var 정의 층** 에서 한 번만 일어나야 한다 (아래 대안 C).

### Hard Constraints

1. **양 테마 대칭**: light·dark 각각에서 catalog color 토큰 전부 (37 + subtle 25) 의 CSS 최종 팔레트 hex == Skia `lightColors/darkColors` hex, Δ≤1 — `semanticAlias.symmetry.test` 를 dark 로 확장해 기계 판정.
2. **light 렌더 불변**: light 모드 computed 색은 변경 전후 byte-identical (본 ADR 은 dark 만 고친다).
3. **plain CSS**: 산출물은 Tailwind 처리 없이 유효 (publish 는 plain Vite) — ADR-191 과 동일 제약.
4. **ThemeStudio override 훅 유지**: runtime `<style id="runtime-theme-vars">` 가 `:root` / `[data-theme="dark"]` 에 `--color-neutral-N`·`--tint` 를 덮어쓴다 (`BuilderCore.tsx:611`). semantic var 는 팔레트 var 를 **참조**해야 override 가 흘러간다 — hex 를 직접 박으면 훅이 끊긴다. `--negative` 의 `var(--color-invalid, …)` 훅도 보존.
5. **CSS 증가 ≤ 5KB**, Preview/Publish undefined 팔레트·semantic var 0.
6. **변수명 계약**: builder chrome 이 이미 쓰는 `--positive/--informative/--notice/--negative` 는 `[data-context="builder"]` 스코프 정의 (`builder-system.css:92-97`, 500 단계) 가 있다 — 새 `:root` 정의는 그보다 specificity 가 낮아 chrome 색을 바꾸지 않아야 한다.

### Soft Constraints

- 매핑 정본은 사람이 읽고 고치는 표 1개여야 한다 (Spectrum 전용 hue 의 family 선택처럼 취향 조정이 잦다).
- `-hover/-pressed` 의 CSS `color-mix` 파생은 유지 (Skia 미소비, 테이블 확장 불요).

## Alternatives Considered

### 대안 A: Skia 를 CSS 에 맞춤 — darkColors 의 named/status hue 단계 차이를 제거

- 설명: `darkColors.positive = green[600]` 처럼 dark 를 light 와 같게 두어 CSS 의 "안 바뀜" 을 정답으로 삼는다. 코드 변경 최소 (colors.ts 만).
- 근거: 두 소비자 중 한쪽을 기준으로 삼는 가장 싼 길 — 그러나 ssot-hierarchy §1 대칭 원칙 ("한쪽이 기준 아님") 에 어긋나고, Spectrum 2 / Tailwind (`dark:bg-green-500`) / Radix Colors (dark scale 별도) 모두 dark 에서 채도·밝기를 낮춘 단계를 쓰는 관행과 반대다.
- 위험:
  - 기술: L — 표 값 수정뿐
  - 성능: L
  - 유지보수: **H** — dark 가독성 설계를 버리고, `gray`/`green-named` 결손은 그대로. 나중에 dark 단계를 되살리려면 이 ADR 을 다시 연다
  - 마이그레이션: L — dark 캔버스 색만 바뀜

### 대안 B: CSS 를 Skia 에 맞춤 — preview-system 에 semantic alias 를 손으로 추가

- 설명: catalog/tokenResolver 매핑을 `{color.positive}` → `var(--positive)` 처럼 semantic var 로 돌리고, `preview-system.css` light/dark 블록에 `--positive: var(--color-green-600)` / `var(--color-green-500)` 류 정의를 21 + subtle 25 개 손으로 적는다. `semanticAlias.symmetry.test` 가 colors.ts 와 대조.
- 근거: `--negative` 가 이미 이 방식이다 (2026-08-27 정렬). 생성기 변경 없음.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **M** — 단계 매핑이 colors.ts (light+dark) 와 preview-system (light+dark) **두 벌** 로 남고, 묶는 것은 테스트뿐. ADR-191 이 없앤 "손 복사본" 구조가 semantic 층에서 재생산된다
  - 마이그레이션: L

### 대안 C: 테마별 단계 매핑 테이블 1개 + 생성 — colors.ts 와 semantic CSS 가 같은 표에서 파생

- 설명: `packages/specs/src/primitives/semanticPaletteMap.ts` 에 `{ token: { light: [family, step], dark: [family, step], hook?: "--color-invalid" } }` 표를 두고, (a) `lightColors/darkColors` 의 named/status/subtle 항목이 표에서 파생 (`gray`/`green-named` 결손도 표에 추가), (b) ADR-191 생성기를 확장해 `theme/generated/semantic-palette.css` (`@layer shared-tokens { :root { --positive: var(--color-green-600); … } [data-theme="dark"] { --positive: var(--color-green-500); … } }`) 를 emit, (c) catalog/tokenResolver 매핑이 그 semantic var (`--positive`, `--positive-subtle`, `--hue-indigo` …) 를 가리키게 하고 preview-system 의 손 `--negative` 정의는 생성 파일로 이관 (`--negative-pressed` 와 `forced-colors` 재정의는 잔류 — Skia 미소비), (d) drift 테스트 byte-diff 0 + symmetric test light/dark.
- 근거: ADR-191 의 "생성기 + 커밋 산출물 + drift 게이트" 패턴 그대로. Spectrum 2 `@react-spectrum/s2` 는 semantic 색을 colorScheme 별 palette index 로 한 표에서 해석하고, Tailwind v4 도 `@theme` 변수 한 층에 dark 재정의를 두는 구조 — "매핑 표는 하나, 소비자는 여럿".
- 위험:
  - 기술: **M** — 생성기 산출물 1개 추가, `[data-theme="dark"]` selector 가 `@layer shared-tokens` 안에서 preview-system `[data-theme="dark"]` (layer `preview-system`, 더 낮은 층) 와 ThemeStudio runtime `<style>` (unlayered, 최상위) 사이 정확한 우선순위를 가져야 한다 — 캐스케이드 순서는 `index.css` `@layer` 선언으로 이미 확정 (ADR-191 Phase 2)
  - 성능: L — +~3KB plain CSS
  - 유지보수: L — 표 1개, 나머지는 파생. 취향 조정은 표 한 줄
  - 마이그레이션: L — light computed 값 불변 (G1), dark 만 이동. 롤백 = 생성 파일 import 1줄 + 매핑 2 파일 revert

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | L    | H        | L            |     1      |
| B    | L    | L    | M        | L            |     0      |
| C    | M    | L    | L        | L            |     0      |

루프 판정: HIGH 없는 대안이 2개 (B, C) 있으므로 추가 대안 불요. CRITICAL 없음.

## Decision

**대안 C: 테마별 단계 매핑 테이블 1개 + 생성** 을 선택한다.

선택 근거:

1. 남는 위험은 기술 M 하나 — 캐스케이드 층 순서인데, 이는 ADR-191 Phase 2 가 `@layer theme, dashboard, base, preview-system, components, shared-tokens, builder-system, utilities` 로 확정했고 live 로 검증한 사실이다. 생성 semantic CSS 는 `shared-tokens` 층에 두므로 preview-system 의 손 정의보다 위, ThemeStudio runtime (unlayered) 보다 아래 — 원하는 순서 그대로다. G2/G4 가 live 로 재확인한다.
2. 대칭의 근거가 **표 1개** 로 수렴한다. colors.ts 의 dark 단계 (한 단계 밝게 / subtle 900) 는 이미 설계된 값이고, CSS 는 그 표를 처음으로 읽게 된다 — 어느 쪽도 기준이 아니며 둘 다 파생이다.
3. Skia 결손 (`gray`, `green-named`) 이 같은 표의 행 2개로 닫힌다 — 별도 수정 경로가 생기지 않는다.

기각 사유:

- **대안 A 기각**: dark 단계 차이는 결함이 아니라 설계다 (Spectrum/Tailwind/Radix 관행). 지우면 대칭은 얻지만 dark 가독성을 잃고, `gray` 결손은 남는다.
- **대안 B 기각**: 동작은 같지만 매핑이 두 벌이다. ADR-191 이 팔레트 층에서 없앤 손 복사본을 semantic 층에서 다시 만드는 셈이고, 테스트가 RED 를 내도 "어느 쪽을 고칠지" 를 사람이 매번 정해야 한다.

> 구현 상세: [193-theme-aware-semantic-palette-map-breakdown.md](../design/193-theme-aware-semantic-palette-map-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                 | 심각도 | 대응                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 새 `:root` semantic var (`--positive/--informative/--notice`) 가 builder chrome 의 `[data-context="builder"]` 스코프 정의 (`builder-system.css:92-97`) 와 같은 이름 — chrome 안에서는 스코프 정의가 이기지만, chrome 밖 (portal 아닌 dashboard 등) 소비처가 있으면 색이 바뀔 수 있다 |  MED   | Phase 0 에서 `var(--positive\|--informative\|--notice)` 소비 16곳 전수 확인 — 전부 `[data-context="builder"]` 하위 (Toast/header/NodesPanel/monitor/LayoutPresetSelector). G4 live 로 chrome Toast 색 불변 확인 |
| R2  | ThemeStudio runtime var 가 `--color-neutral-N` 을 dark 로 덮을 때 semantic var 가 hex 를 직접 들고 있으면 override 가 끊김                                                                                                                                                           |  MED   | 생성기는 항상 `var(--color-{family}-{step})` 참조만 emit (hex 금지) — drift 테스트가 `#` 문자 0 을 assert. `--negative` 의 `var(--color-invalid, …)` 훅은 표의 `hook` 필드로 보존                               |
| R3  | Skia 는 ThemeStudio 의 `--color-neutral-N` override 를 DOM 에서 읽지 않고 `neutralToSkiaColors` 프리셋을 쓴다 — 본 ADR 범위 밖의 기존 경계 (사용자가 neutral 프리셋을 고르면 양쪽이 같은 프리셋 표를 봄)                                                                             |  LOW   | 범위 밖 명시. 변경 없음                                                                                                                                                                                         |
| R4  | dark 프로젝트의 Preview/Publish 색이 바뀐다 (positive green-600 → 500 등, 24 토큰·소비 212) — 의도된 변화이나 사용자-가시                                                                                                                                                            |  MED   | CHANGELOG 사용자-가시 엔트리 + G2 전/후 스크린샷. light 는 G1 로 불변 보장                                                                                                                                      |
| R5  | `tokenResolver.ts` (잔존 spec 3 경로) 와 `colorTokenToCss.ts` (catalog 경로) 두 매핑 파일이 같은 semantic var 를 가리키도록 유지해야 한다                                                                                                                                            |  LOW   | 기존 symmetric test 의 "두 매핑이 같은 var" 검사를 전 토큰으로 확장                                                                                                                                             |
| R6  | publish 앱은 `data-theme` 을 세팅하는 코드가 없다 (grep 0) — dark 블록이 publish 에서 죽은 코드                                                                                                                                                                                      |  LOW   | 무해 (light 값만 적용). publish dark 지원은 별도 기능 — 본 ADR 은 신호가 있는 곳 (Preview) 만 다룬다                                                                                                            |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                  | 실패 시 대안                                              |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| G0   | Phase 0 종료 | breakdown §0 inventory 커밋 — 토큰 분류 (flip 12 / fixed 24 / subtle 25), Skia 결손 2, chrome 소비 16 전수                                                                                                                                 | inventory 보강 commit (fork 사유 아님)                    |
| G1   | Phase 1·2    | **light 불변**: 변경 전후 preview.html light 모드 computed 색 (catalog 토큰 37 + subtle 25 를 소비하는 Badge/StatusLight/Meter 대표 variant) byte-identical; `lightColors` 스냅샷 diff 0                                                   | 표의 light 열을 현행 값으로 재고정                        |
| G2   | Phase 3      | **dark 대칭**: `semanticAlias.symmetry.test` dark 확장 GREEN (전 토큰) + live: `darkMode=dark` 에서 preview iframe computed vs Skia `darkColors` — Badge positive/negative/indigo/gray, StatusLight notice, Meter positive 6 요소 sRGB Δ≤1 | 캐스케이드 층·selector 점검, 표 재조정                    |
| G3   | Phase 1~3    | 생성 산출물 재실행 byte-diff 0 (`validate:palette` 확장), `build:specs` 연동, hex 리터럴 0                                                                                                                                                 | 생성기 결정성 수정                                        |
| G4   | Phase 3      | CSS 증가 ≤ 5KB, Preview undefined var 0, builder chrome Toast/header 색 불변 (R1), ThemeStudio runtime var 로 `--color-green-600` 을 덮으면 Badge positive 가 따라 바뀜 (R2 훅 생존)                                                       | R1: var 이름에 접두 (`--semantic-*`) 로 분리, R2: 훅 복원 |

## 진행 로그

| 일자       | Phase | commit        | 내용                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | :---: | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-27 |   0   | 4105e21e8     | inventory freeze (breakdown §0) — 테마 신호 2 소비자 / 토큰 FLIP 12·FIXED 24·subtle 25 / Skia 결손 2 / chrome 소비 16 (G0) + review round 1                                                                                                                                                                                                                                                                       |
| 2026-08-27 |   1   | 1eedde7a6     | `semanticPaletteMap.ts` 46 행 (status 8 + named 19×2) + `colors.ts` status/named 항목 표 파생 + `gray`/`green-named`(+subtle) 4 키 + 스냅샷 테스트 5 (light 67 키 byte 불변 · dark 무변경 — G1·G3). live: ZZZF Badge `gray` 캔버스 neutral gray pill 렌더 (Phase 0 빈 박스 → 해소)                                                                                                                                |
| 2026-08-27 |   2   | e7a3b7f10     | 생성기 `renderSemanticCss` → `generated/semantic-palette.css` (4,666B, hex 0, `:root`+`[data-theme="dark"]`) + `theme.css` import + preview-system 손 `--negative` 이관 + 매핑 2 파일 semantic var (`--positive`/`--hue-*`) 전환 + generated 8 파일 재생성 + drift 3·symmetry 46×2 테스트 (G1·G3). live G1: preview light computed 17 probe 전후 diff 0. 범위 밖 발견: publish neutral 자기 참조 (breakdown §0-5) |
| 2026-08-27 |   3   | (종결 commit) | live dark G2 (preview `data-theme=dark` computed vs `darkColors` 11 probe Δ0) + G4 (chrome scoped var 불변, 팔레트 var override 훅 생존) + `Meter.css` fill var semantic 전환 + CHANGELOG + Implemented 종결                                                                                                                                                                                                      |

**Phase 3 G2/G4 실측 (2026-08-27, Chrome MCP, 프로젝트 ZZZF, compare 모드 preview iframe)**:

- **G2 dark** — Theme 패널 dark 토글 (실제 UI 경로: `setDarkMode` → BuilderCore `SET_DARK_MODE` → preview `data-theme="dark"`) 후 preview computed (2D canvas sRGB 환산) vs Skia `darkColors` hex: Badge positive `0,201,80` = `#00c950` · negative `255,100,103` = `#ff6467` · indigo `97,95,255` = `#615fff` · gray `161,161,161` = `#a1a1a1` · StatusLight notice (`--notice`) `255,105,0` = `#ff6900` · Meter positive (`--positive`) `#00c950` · seafoam `#00bba7` · positive-subtle `#0d542b` · purple-subtle `#59168b` · negative-subtle `#82181a` · magenta `#ec003f` — **11 probe Δ0**. live Badge gray 요소도 `161,161,161`. Skia 캔버스: 같은 Badge 가 dark 페이지 위에 밝은 회색 pill (zoom 스크린샷; 픽셀 readback 은 `preserveDrawingBuffer=false` 라 상수 + 스크린샷).
- **G1 light** (Phase 2): 변경 전후 computed 17 probe diff 0.
- **G4** — (R1) builder chrome `.app` 의 `--positive` computed = `oklch(72.3% …)` = green-500 (builder-system 스코프 정의) — `:root` green-600 정의가 chrome 을 덮지 않음. (R2) preview 에 unlayered `<style>` 로 `[data-theme="dark"]{--color-green-500:#ff0000}` 주입 → Badge positive `0,201,80 → 255,0,0` → 제거 후 복원 — semantic var 가 팔레트 var 참조만 들고 있어 ThemeStudio override 가 흘러간다. 생성 CSS 4,666B ≤ 5KB, preview undefined var 0.
- **스토어 접근 함정**: 페이지 컨텍스트 `import('/src/stores/themeConfigStore.ts')` 는 앱과 다른 모듈 인스턴스라 `setDarkMode` 가 무효 — 실제 UI 토글로 exercise (memory `reference-vite-dynamic-import-separate-store-instance`).

## Consequences

### Positive

- dark 모드에서 처음으로 Builder 캔버스 = Preview (positive/informative/notice/named 17 + subtle) — ADR-191 G2 가 light 에 멈춘 지점을 닫는다.
- 단계 매핑 정본이 표 1개 (`semanticPaletteMap.ts`) — Spectrum 전용 hue 의 family 취향 조정, dark 단계 정책 변경이 한 줄 수정 + 재생성으로 끝난다.
- Badge `gray` 캔버스 비가시 결함 해소 (`gray`/`green-named` 행 추가).
- `preview-system.css` 의 손 `--negative` 정의가 생성 파일로 이관돼 status semantic 이 전부 파생.

### Negative

- dark 프로젝트의 Preview/Publish 색 이동 (R4) — CHANGELOG 필수.
- 생성 산출물 1개 추가 (`generated/semantic-palette.css`), `build:specs` 순서 의존 1단계 증가.
- 범위 밖 잔여: Skia 가 ThemeStudio `--color-neutral-N` override 를 읽지 않는 경계 (R3), publish dark 신호 부재 (R6), `-hover/-pressed` 의 CSS `color-mix` 파생 (Skia 미소비라 대칭 대상 아님).
