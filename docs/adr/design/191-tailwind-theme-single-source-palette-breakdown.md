# ADR-191 구현 상세 — Tailwind v4 theme.css 단일 원천 팔레트 파생

> 본 문서는 [ADR-191](../completed/191-tailwind-theme-single-source-palette.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문이 정본이고, 여기에는 Phase 분할·파일 변경표·체크리스트만 둔다.

## 0. Phase 0 inventory (2026-08-26 실측 freeze)

라이브 빌더 (`/builder/{id}`) + `preview.html` 에서 `document.styleSheets` 순회 + `getComputedStyle(documentElement)` 로 실측. 수치는 본 ADR 의 기준선이며, 구현 중 gap 이 나오면 **이 표를 보강하는 commit** 으로 흡수한다 (adr-writing.md M3 — fork 사유 아님).

### 0-1. 팔레트 정의 원천 3개

| 원천                                                            | 레이어                 | 세대     |                 개수 | Builder DOM   | Preview DOM   | Publish                |
| --------------------------------------------------------------- | ---------------------- | -------- | -------------------: | ------------- | ------------- | ---------------------- |
| `@import "tailwindcss"` 자동 emit                               | `@layer theme`         | v4 oklch |                  142 | 로드 (2위)    | 미로드        | 미로드 (Tailwind 없음) |
| `apps/builder/src/App.css:6` `:root` (unlayered)                | 없음                   | v4 oklch |                  387 | **승자 전부** | 미로드        | 미로드                 |
| `packages/shared/src/components/styles/theme/shared-tokens.css` | `@layer shared-tokens` | v3 hex   | 94 (hex 83 + hsl 11) | 패배 (dead)   | **유일 원천** | **유일 원천**          |

- 레이어 순서 실측: `dashboard < base < preview-system < components < shared-tokens < builder-system < utilities < theme` — `apps/builder/src/index.css:14` `@layer` 선언에 `theme` 이 없어 Tailwind 레이어가 맨 뒤(최상위)에 붙음.
- `App.css :root` 387 중 theme 레이어와 값 동일 120, 표기만 다름 20 (neutral `0 none`↔`0 0`, shadow `rgb()`↔`#hex`, `150ms`↔`0.15s`), **실질 override 는 `--font-sans`/`--font-mono` (Pretendard) 2개**. 나머지 245 는 어디서도 미참조.
- 코드가 참조하는 App.css 고유 변수 19개 (`--color-cyan-100/700`, `--color-indigo-100/700`, `--text-6xl`, `--shadow-*` 5, `--inset-shadow-sm`, `--default-transition-*` 2, `--font-sans/mono` = 15) 는 **live `@layer theme` 에 존재** (G0 재확인 2026-08-26, 142 변수 순회). 나머지 4 중 `--drop-shadow-sm/md`·`--inset-shadow-xs` 는 `preview-system.css:255-266` 이 자체 fallback 포함으로 정의 (App.css unlayered 가 우연히 덮고 있던 것 — 제거 시 의도된 preview-system 값으로 복귀, `--inset-shadow-xs` 값 동일), `--default-font-feature-settings` 는 소비처 0. → App.css :root 제거 시 소실 변수 0 (정정: 초기 "19 전부 theme" 은 과대 — G0 가 잡음).
- **G0 allowlist diff**: shared-tokens `--color-*` 중 theme.css 에 같은 이름이 있는 것 = 93 (hex 82 + neutral hsl 11) — 삭제 set. 이름 없는 것 = semantic 61 (`error/info/primary/success/tertiary/warning` 계열) + `--color-zinc-850` — **유지**. 참조 이름 134 중 theme.css·shared-tokens 어디에도 없는 `--color-danger-*`·`--color-secondary-*` 9곳 (`DataTablePanel.css` 4, `AddPageDialog.css` 3, `SelectionMemory.css` 2) 은 **기존 undefined** — 본 ADR 무관 (§0-5).

### 0-2. Builder(v4 oklch) ↔ Preview(v3 hex) 색 차이

겹치는 팔레트 82개의 sRGB 최대 채널 Δ (python oklch→sRGB, canvas 실측으로 검증: gray-500 `106,114,130`, blue-500 `43,127,255` 일치):

| Δ 0-2 | 3-5 | 6-10 | 11-20 | >20 |
| ----: | --: | ---: | ----: | --: |
|    38 |   7 |   10 |    13 |  14 |

소비되는 Δ>10 토큰 27개 / 114회 참조 (`packages/shared/src/components/styles` + `apps/builder/src/builder`):

| 토큰                 |   Δ | 참조 | 소비 파일                              |
| -------------------- | --: | ---: | -------------------------------------- |
| `--color-purple-600` |  35 |   35 | Badge, Button, ColorPicker, Label      |
| `--color-green-600`  |  22 |   20 | Badge, InlineAlert, Meter, StatusLight |
| `--color-blue-600`   |  17 |    8 | Badge, Workspace                       |
| `--color-red-600`    |  38 |    7 | Badge                                  |
| `--color-orange-600` |  15 |    7 | Badge                                  |
| `--color-blue-400`   |  15 |    4 | builder-system                         |
| `--color-green-400`  |  69 |    2 | builder-system                         |
| `--color-orange-400` |  56 |    2 | builder-system                         |

### 0-3. Skia 측 손 복사본

| 파일                                                  | hex 수 | Tailwind 팔레트 정확 일치 | 비고                                                                  |
| ----------------------------------------------------- | -----: | ------------------------: | --------------------------------------------------------------------- |
| `packages/specs/src/primitives/colors.ts`             |    112 |                        46 | 나머지 66 은 S2/Leonardo custom — **파생 대상 아님**                  |
| `apps/builder/src/utils/theme/neutralToSkiaColors.ts` |     57 |            23 (gray 계열) | 5 팔레트 × 11 단계 + 2 — 전부 Tailwind 이름·단계 구조, 전부 파생 대상 |

Skia 가 DOM 에서 읽는 semantic 토큰(`--border`, `--fg-muted`, `--accent`, `--focus-ring`) 은 neutral 계열(Δ≤2) 또는 `oklch(from …)` 상대색이라 팔레트 세대 차이가 캔버스에는 실질 미전파 — 즉 **현재 Skia ≈ Preview (v3), 이탈자는 Builder DOM (App.css)**.

### 0-4. 소비 경로 (변경 불필요 — 변수명 불변)

- `var(--color-{family}-{step})` 참조: shared styles 294회 / 22 파일 (Badge, Button, StatusLight, Meter, InlineAlert, Label, ColorPicker, Workspace …) + builder-system/preview-system alias.
- Publish: `apps/publish/src/styles/index.css:11` → `packages/shared/src/components/index.css` → `theme.css` → `shared-tokens.css`. Tailwind postcss 없음 (`apps/publish/vite.config.ts` plugins `[react()]` 만).

### 0-5. 범위 밖 (기록만)

- `cssComponentColors.ts` / `useThemeColors.ts` 가 읽는 M3 토큰 (`--primary`, `--on-surface` …) 은 어디에도 정의 없음 → 상시 fallback (dead path). 별도 정리.
- `colors.ts` custom 66 값 (S2/Leonardo) — Tailwind 복사본이 아니므로 유지.
- **v3 hex 리터럴 잔존 (팔레트 정의 파일 밖)**: 비-test 12 파일 ~45곳 — `packages/shared/src/renderers/LayoutRenderers.tsx` 14 (`var(--color-info-600, #2563eb)` 류 fallback), `Table.tsx` 6, `TailSwatch.tsx` 3, `IllustratedMessage.tsx` 3, `skia/workflowRenderer.ts` 3, `PropertyColorPicker.tsx` 3, `FormRenderers.tsx` 2, `tokenToCss.ts` 2, `WorkflowCanvasToggles.tsx` 2, `styleConverter.ts` 2, `skia/dropIndicatorRenderer.ts` 2, `devProfiler.ts` 4 (로그 색). fallback 은 var 미정의 시에만 발현 — G4 가 undefined 0 을 보장하므로 본 ADR 에서는 목록만 고정, 후속 sweep (ADR R8).
- `colors.ts` 리터럴 41 중 indigo/cyan/pink/fuchsia/lime 계열 ~24 는 Tailwind v3 hex 로 추정되나 **in-repo v3 원천이 없어** 이름 매핑을 grep 근거로 확정 못 함 (nearest-Δ 는 v3→v4 이동 때문에 오배정 위험: `#db2777` 은 v3 pink-600 인데 v4 최근접은 pink-500). v3 원천 확보 시 별도 정리 — 본 ADR 은 근거 있는 71 만 파생.
- `--color-danger-*` / `--color-secondary-*` 참조 9곳은 어떤 원천에도 정의가 없는 기존 undefined (fallback 없이 `var()` 만) — 별도 정리.
- 축 일치 리터럴 중복 58건 (`--panel-workspace-gap: 4px` → `var(--spacing-xs)` 류, 수기 29 + generated 29) — 본 ADR 과 무관한 일반 sweep, 후속 작업.

## 1. Phase 분할

| Phase                       | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Gate  | 산출물                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| 0 ✅ 2026-08-26 (ab5234e92) | inventory freeze (본 문서 §0) + 참조 19 분류 재확인 (15 theme / 3 preview-system / 1 미소비)                                                                                                                                                                                                                                                                                                                                                                                            | G0    | 본 문서, `scripts/audit-palette-refs.mjs` (일회성, scratch 가능) |
| 1 ✅ 2026-08-26 (b56fb4031) | 생성기 `generate-palette.ts` + 산출물 2 + drift 테스트 + `build:specs` 연동                                                                                                                                                                                                                                                                                                                                                                                                             | G1·G3 | 아래 §2 신규 파일 4                                              |
| 2 ✅ 2026-08-26 (34e284a77) | CSS 소비 전환: shared `theme.css` 가 생성 CSS import, shared-tokens 팔레트 93 삭제 + 헤더 정정, `index.css` `@layer theme` 선두 선언, `App.css :root` 삭제 + `@theme { --font-sans/--font-mono }`                                                                                                                                                                                                                                                                                       | G2·G4 | 수정 4 파일                                                      |
| 3 ✅ 2026-08-26             | Skia 파생: `colors.ts` 46 항목 → `tailwindPalette` 참조, `neutralToSkiaColors.ts` 57 → 참조; 영향 fixture/snapshot 갱신. **추가 (Phase 2 발견)**: `utils/cssVariableCore.ts::cssColorToHex` 는 colord(oklch 미지원) 경유라 DOM 에서 읽는 `--border`/`--fg-muted` 등 oklch 토큰이 **상시 fallback** (App.css 시절부터 기존 결함 — `skiaOverlayBuilder.ts:257` 등 8 파일). `styleConversion/styleConverter.ts::cssColorToHex` (oklch 지원) 로 위임해 Skia 가 SSOT 형식을 실제로 읽게 한다 | G1·G2 | 수정 2 파일 + 테스트                                             |
| 4 ✅ 2026-08-26             | live 3자 대칭 검증 (Chrome MCP) + CHANGELOG + README Implemented 승격                                                                                                                                                                                                                                                                                                                                                                                                                   | G2    | CHANGELOG 엔트리                                                 |

각 Phase 는 commit 가능한 상태로 종료 (CLAUDE.md §대규모 작업 phase 분할). Phase 2 와 3 은 독립이라 순서 교체 가능하나, **Phase 2 먼저** 가 안전하다 — 생성 CSS 가 shared-tokens 자리에 들어간 뒤 Skia 가 따라가야 G2 실측이 한 번에 끝난다.

## 2. 파일 변경표

### 신규

| 파일                                                                         | 역할                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/scripts/generate-palette.ts`                                 | `node_modules/tailwindcss/theme.css` 의 `@theme default { … }` 블록 파싱 → `--color-{family}-{step}` 286 (26 family × 11 step; spacing/text/radius 는 **본 ADR 범위 밖**) 추출 → 2 산출물 emit. 결정적 출력 (정렬·포맷 고정) |
| `packages/shared/src/components/styles/theme/generated/tailwind-palette.css` | `@layer shared-tokens { :root { --color-red-50: oklch(…); … } }` — 원문 oklch 그대로 (브라우저 네이티브, Tailwind 파이프라인 불요)                                                                                           |
| `packages/specs/src/primitives/generated/tailwindPalette.ts`                 | `export const TAILWIND_PALETTE = { red: { 50: "#fef2f2", … }, … } as const` — oklch→sRGB hex 변환 (수식은 §3)                                                                                                                |
| `packages/specs/src/primitives/__tests__/tailwindPalette.drift.test.ts`      | (a) 생성기 재실행 결과 == 커밋된 산출물 byte-diff 0, (b) 변환 정확도 — 고정 샘플 (gray-500 `#6a7282`, blue-500 `#2b7fff`) 일치                                                                                               |

### 수정

| 파일                                                            | 변경                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/package.json`                                   | `"generate:palette": "tsx scripts/generate-palette.ts"`, `build` 에 `&& pnpm generate:palette` 추가                                                                                                                                                                                                                                                                                                                                                                                                            |
| `package.json` (root)                                           | `"generate:palette"` 위임 스크립트                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `packages/shared/src/components/theme.css`                      | `@import "./styles/theme/generated/tailwind-palette.css";` 를 `shared-tokens.css` 직후에 추가                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/shared/src/components/styles/theme/shared-tokens.css` | Tailwind 이름 팔레트 93 = hex 82 (`--color-red-50` ~ `--color-zinc-950`, L276~~345 중 `--color-zinc-850` **제외** — Tailwind 에 없는 custom 확장이며 `builder-system.css:133` `--bg-raised` 가 소비) + `--color-neutral-*` hsl 11 (L180~~190) 삭제. 삭제 set 은 "생성 팔레트에 같은 이름이 존재하는 선언" 으로 기계 산출 (allowlist diff). 헤더 주석 "follow Tailwind v4 standards" 를 실제 상태로 정정 (팔레트는 generated 파일이 정본). semantic 계열(`primary/error/info/success/warning/tertiary`) 은 유지 |
| `apps/builder/src/index.css`                                    | L14 `@layer theme, dashboard, base, preview-system, components, shared-tokens, builder-system, utilities;` — theme 을 선두로. `@theme { --font-sans: "Pretendard", system-ui; --font-mono: "Pretendard", monospace; }` 추가                                                                                                                                                                                                                                                                                    |
| `apps/builder/src/App.css`                                      | L6~398 `:root { … }` 블록 삭제 (L1 헤더 주석 정정). `@layer base` 이하는 유지                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `packages/specs/src/primitives/colors.ts`                       | Tailwind 복사 46 항목을 `TAILWIND_PALETTE.{family}[step]` 참조로 교체 (주석의 `// blue-600` 이 매핑 근거). custom 66 은 그대로                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/builder/src/utils/theme/neutralToSkiaColors.ts`           | `NEUTRAL_PALETTES` 5 팔레트를 `TAILWIND_PALETTE.slate/gray/zinc/neutral/stone` 참조로 교체. `@see App.css` 주석 → generated 참조로 정정                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/CHANGELOG.md`                                             | Phase 4 — "Preview/Publish 팔레트 v3 hex → v4 oklch 이동 (Badge/StatusLight 등)" 사용자-가시 변경 기록                                                                                                                                                                                                                                                                                                                                                                                                         |

### 삭제 없음

원본 파일 삭제는 없다 (블록 삭제만). `App.css` 는 `@layer base/components/@utility` 가 남아 파일 유지.

## 3. oklch → sRGB 변환 (생성기 내장)

Phase 0 에서 canvas 실측과 일치 확인한 수식 (OKLab → linear sRGB → gamma):

```
a = C·cos(H), b = C·sin(H)
l' = L + 0.3963377774a + 0.2158037573b
m' = L − 0.1055613458a − 0.0638541728b
s' = L − 0.0894841775a − 1.2914855480b
(l,m,s) = (l'^3, m'^3, s'^3)
R = +4.0767416621l − 3.3077115913m + 0.2309699292s
G = −1.2684380046l + 2.6097574011m − 0.3413193965s
B = −0.0041960863l − 0.7034186147m + 1.7076147010s
gamma: x ≤ 0.0031308 ? 12.92x : 1.055x^(1/2.4) − 0.055, clamp [0,1], round(×255)
```

- `H = none` (neutral 계열) 은 `H = 0` 으로 처리 (C = 0 이라 결과 동일).
- gamut 밖 값(green-400 등 P3 전용)은 clamp — 브라우저 sRGB 렌더와 같은 결과 (canvas 실측 `5,223,114` 일치).

## 4. 체크리스트

### Phase 0

- [ ] §0 표 커밋 (본 문서)
- [ ] 참조 19 변수 ⊂ live theme 레이어 재확인 (Chrome MCP, `CSSLayerBlockRule` 순회)

### Phase 1

- [x] `generate-palette.ts` — `@theme default` 블록 파싱, 다중행 값 건너뜀, `--color-{family}-{step}` 만 추출 (순수 로직 `paletteGenerator.ts` 분리)
- [x] 산출물 2 생성 + 커밋 (CSS 14,457B / TS 14,867B, prettier --check 통과)
- [x] drift 테스트 GREEN 5/5 (byte-diff 0 + 샘플 hex + 26×11 구조 + plain CSS) · G1 live: builder 탭 canvas 286/286 maxΔ1
- [x] `pnpm build:specs` 가 생성기 실행 (`build` = tsup && generate:palette && generate:css) + `validate:palette` (`--check`) 추가

### Phase 2

- [x] `theme.css` import 추가 → preview.html `--color-purple-600` = `oklch(55.8% 0.288 302.321)`, generated 로드 확인 (mauve-500 존재)
- [x] shared-tokens Tailwind 이름 93 삭제 (allowlist diff 스크립트, zinc-850 + semantic 61 유지) → Preview 참조 109 중 undefined **0**; Builder 참조 131 중 undefined 5 = 기존 `--color-danger-*`/`secondary-*` (§0-5, 본 ADR 무관)
- [x] `index.css` 레이어 순서 실측: `theme, dashboard, base, preview-system, components, shared-tokens, builder-system, utilities`
- [x] `App.css :root` 삭제 (L6~398, 393줄) 후 Builder `--font-sans`/`--default-font-family` = `"Pretendard", system-ui` (`index.css @theme`), `--inset-shadow-xs` 는 preview-system 값으로 복귀, dark `--bg-raised` 해석 정상, 빌더 스크린샷 회귀 없음
- [x] 번들 (G4): `pnpm -F @composition/builder build` main.css 266,951 → 273,454 (**+6.5KB**), components.css +0.7KB — ≤ 20KB 통과
- [x] **Skia 파서 회귀 수정**: theme.css 무채색 `oklch(L% 0 none)` 이 Builder DOM 에 처음 도달 → `styleConverter.ts::parseColorFuncArgs` 가 `none` 을 NaN 처리해 fallback 으로 떨어지던 것을 `none → 0` 으로 수정 + 회귀 테스트 `styleConverter.oklchNone.test.ts` 3/3

### Phase 3

- [x] `colors.ts` **71** 항목 → `TAILWIND_PALETTE` 참조 (v3 정확 일치 46 + 주석 명명 neutral 17 + Δ≤2 unambiguous 8) — 값 v3→v4 이동 (accent `#2563eb`→`#155dfc`, positive `#16a34a`→`#00a63e` 등). 리터럴 잔존 41 = S2/Leonardo custom + `#202023` zinc-850 + indigo/cyan/pink/fuchsia/lime 계열 (in-repo v3 원천 없음 — §0-5)
- [x] `neutralToSkiaColors.ts` `NEUTRAL_PALETTES` 5 팔레트 55 hex → `{ ...TAILWIND_PALETTE.{slate|gray|zinc|neutral|stone} }` (LIGHT/DARK_MAP 의 `#ffffff` 2 는 고정 base 유지)
- [x] 영향 테스트: builder 관련 7 파일 42/42, specs 2 파일 24/24 — hex 리터럴 fixture 갱신 0건 (Phase 0 grep 0 과 일치, ADR:75 서술은 과대였음)
- [x] **Skia DOM 토큰 파서 oklch 지원** (`utils/cssVariableCore.ts::cssColorToHex` — `utils/theme/oklchToHex` 순수 util 사용, styleConverter 위임은 `layout/engines/{cssValueParser,utils}.ts → cssVariableCore` 역참조로 cycle 이라 회피) + 회귀 테스트 `cssVariableCore.oklch.test.ts` 4/4. `--border: oklch(87% 0 none)` → `#d4d4d4` (기존엔 상시 fallback)
- [x] `@composition/specs` root/primitives 에서 `TAILWIND_PALETTE` + 타입 export, `pnpm build:specs` 로 dist 재생성 (builder 는 dist 를 본다)
- [x] live: builder 탭에서 `/@fs` 로 `specs/dist/index.js` import → `lightColors.accent=#155dfc`, `positive=#00a63e`, `darkColors.raised=#202023`, `TAILWIND_PALETTE` 26 family; 캔버스 렌더 스크린샷 회귀 없음

### Phase 4

- [x] live 3자 대칭 (G2, 2026-08-26 프로젝트 ZZZF): 토큰 6종 (`--color-{purple,green,red,blue,orange,gray}-600`) Builder DOM computed = `preview.html` DOM computed = Skia `TAILWIND_PALETTE` hex, Δ0 (orange-600 Δ1 반올림). 요소 단위: Badge `red` → preview `oklch(0.577 0.245 27.325)` ↔ Skia `#e7000b` red pill; StatusLight `purple` → preview dot `oklch(0.558 0.288 302.321)` ↔ Skia `#9810fa` dot; positive 는 기본 variant 초록 dot + Δ0. **정정**: InlineAlert `negative` 는 `--color-red-600` 이 아니라 semantic `var(--negative)` 소비 — red-600 은 Badge `red` variant 로 측정. Skia 픽셀 readback 은 `preserveDrawingBuffer=false` 라 불가 — 페인트 상수 + zoom 스크린샷으로 대체
- [x] `/cross-check` Badge · StatusLight · Meter — catalog 경로 3종, 팔레트 토큰 `{color.purple/positive/red}` ↔ `--color-purple-600/green-600/red-600` 동일 원천 (Δ≤1), Meter positive `--fill-color: var(--color-green-600)` ↔ `{color.positive}`. CRITICAL/HIGH 0. 잔존 (범위 밖·기존): semantic alias — `negative` CSS `--negative`(error-400 hsl `#f15b5b`) vs Skia red[500] `#fb2c36`, `informative` CSS `--color-info-600` hsl vs Skia blue[600] `#155dfc` (ADR 본문 §진행 로그)
- [x] G3 재확인: `pnpm validate:palette` ✅ in sync (tailwindcss@4.3.3, 286), `validate:sync` 0 errors
- [x] CHANGELOG 엔트리 + README Implemented 승격 + 본문 `completed/` 이동 (closure 5단계)
