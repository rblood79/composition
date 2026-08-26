# ADR-191 구현 상세 — Tailwind v4 theme.css 단일 원천 팔레트 파생

> 본 문서는 [ADR-191](../191-tailwind-theme-single-source-palette.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문이 정본이고, 여기에는 Phase 분할·파일 변경표·체크리스트만 둔다.

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
- 코드가 참조하는 App.css 고유 변수 19개 (`--color-cyan-100/700`, `--color-indigo-100/700`, `--text-6xl`, `--shadow-*` 5, `--inset-shadow-*` 2, `--drop-shadow-*` 2, `--default-*` 3, `--font-sans/mono`) 는 **전부 theme 레이어에도 존재** → App.css :root 제거 시 소실 변수 0.

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
- 축 일치 리터럴 중복 58건 (`--panel-workspace-gap: 4px` → `var(--spacing-xs)` 류, 수기 29 + generated 29) — 본 ADR 과 무관한 일반 sweep, 후속 작업.

## 1. Phase 분할

| Phase | 내용                                                                                                                                                                                              | Gate  | 산출물                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| 0     | inventory freeze (본 문서 §0) + 참조 19 ⊂ theme 재확인 스크립트                                                                                                                                   | G0    | 본 문서, `scripts/audit-palette-refs.mjs` (일회성, scratch 가능) |
| 1     | 생성기 `generate-palette.ts` + 산출물 2 + drift 테스트 + `build:specs` 연동                                                                                                                       | G1·G3 | 아래 §2 신규 파일 4                                              |
| 2     | CSS 소비 전환: shared `theme.css` 가 생성 CSS import, shared-tokens 팔레트 93 삭제 + 헤더 정정, `index.css` `@layer theme` 선두 선언, `App.css :root` 삭제 + `@theme { --font-sans/--font-mono }` | G2·G4 | 수정 4 파일                                                      |
| 3     | Skia 파생: `colors.ts` 46 항목 → `tailwindPalette` 참조, `neutralToSkiaColors.ts` 57 → 참조; 영향 fixture/snapshot 갱신                                                                           | G1·G2 | 수정 2 파일 + 테스트                                             |
| 4     | live 3자 대칭 검증 (Chrome MCP) + CHANGELOG + README Implemented 승격                                                                                                                             | G2    | CHANGELOG 엔트리                                                 |

각 Phase 는 commit 가능한 상태로 종료 (CLAUDE.md §대규모 작업 phase 분할). Phase 2 와 3 은 독립이라 순서 교체 가능하나, **Phase 2 먼저** 가 안전하다 — 생성 CSS 가 shared-tokens 자리에 들어간 뒤 Skia 가 따라가야 G2 실측이 한 번에 끝난다.

## 2. 파일 변경표

### 신규

| 파일                                                                         | 역할                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/specs/scripts/generate-palette.ts`                                 | `node_modules/tailwindcss/theme.css` 의 `@theme default { … }` 블록 파싱 → `--color-*` (+ 필요 시 spacing/text/radius 는 **본 ADR 범위 밖**, color 만) 추출 → 2 산출물 emit. 결정적 출력 (정렬·포맷 고정) |
| `packages/shared/src/components/styles/theme/generated/tailwind-palette.css` | `@layer shared-tokens { :root { --color-red-50: oklch(…); … } }` — 원문 oklch 그대로 (브라우저 네이티브, Tailwind 파이프라인 불요)                                                                        |
| `packages/specs/src/primitives/generated/tailwindPalette.ts`                 | `export const TAILWIND_PALETTE = { red: { 50: "#fef2f2", … }, … } as const` — oklch→sRGB hex 변환 (수식은 §3)                                                                                             |
| `packages/specs/src/primitives/__tests__/tailwindPalette.drift.test.ts`      | (a) 생성기 재실행 결과 == 커밋된 산출물 byte-diff 0, (b) 변환 정확도 — 고정 샘플 (gray-500 `#6a7282`, blue-500 `#2b7fff`) 일치                                                                            |

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

- [ ] `generate-palette.ts` — `@theme default` 블록 파싱, 다중행 값(`--font-sans:\n …`) 건너뜀, `--color-*` 만 추출
- [ ] 산출물 2 생성 + 커밋
- [ ] drift 테스트 GREEN (byte-diff 0 + 샘플 hex 일치)
- [ ] `pnpm build:specs` 가 생성기 실행 (Stop hook `.spec-rebuild-pending` 경로 포함)

### Phase 2

- [ ] `theme.css` import 추가 → preview.html 에서 `--color-purple-600` 이 `oklch(…)` 로 계산되는지 실측
- [ ] shared-tokens Tailwind 이름 93 (hex 82 + neutral hsl 11; zinc-850 유지) 삭제 후 **Preview/Publish 에서 undefined 팔레트 변수 0** (styleSheets 순회로 `var(--color-*)` 참조 전수 resolve)
- [ ] `index.css` 레이어 순서 실측: `theme` 이 `shared-tokens` 보다 앞
- [ ] `App.css :root` 삭제 후 Builder `--font-sans` = Pretendard, 참조 19 변수 resolve, 렌더 회귀 없음 (스크린샷)
- [ ] 번들: 팔레트 CSS 증가분 측정 (G4)

### Phase 3

- [ ] `colors.ts` 46 항목 참조 전환 — 값 변화 목록 (v3→v4) 을 commit 본문에 기록
- [ ] `neutralToSkiaColors.ts` 57 참조 전환
- [ ] 영향 테스트/스냅샷 갱신 (Skia fixture 에 hex 리터럴이 박힌 곳 grep)

### Phase 4

- [ ] live 3자 대칭 (G2): Builder DOM / Preview / Skia 캔버스에서 Badge(purple-600)·StatusLight(green-600)·InlineAlert(red-600) sRGB Δ≤2 — Chrome MCP canvas 샘플링
- [ ] `/cross-check` Badge · StatusLight · Meter
- [ ] CHANGELOG 엔트리 + README Implemented 승격 (Stop hook 동시 갱신 강제)
