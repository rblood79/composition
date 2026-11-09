# ADR-305: 빌더 chrome 과 사용자 컴포넌트 CSS 완전 분리 — 생성 · 공유 수동 · 테마 시트를 빌더와 Preview · Publish 가 따로 소유

## Status

Proposed — 2026-11-09

- 사용자 요청: `/create-adr` (2026-11-09).
- 방향을 정한 사용자 원문 — Design 패널 토글 그룹 회귀 (`d07e097be`) 의 원인 보고 뒤: 「빌더의 css는 catalog의 생성 css의 영향을 받지않아야 하지않나? 빌더와 제공되는 컴퍼넌트는 분리되어야 맞지않나」 → 「1번을 먼저 하고 2번을 ADR 로 이어가는 순서」.
- **사용자 결정 2건 — 구현 전 확정 (2026-11-09)**: 「구현 전에 정한다. 사용자 결정 2건 - #1. 수동 시트도 이번에 나눠 완전한 분리를 해야한다, #2. 경로를 전체 페이지 이동으로 바꿔 (권고)」. 초안 (생성 시트 43장만) 의 범위를 이 결정으로 넓혔다 — 아래 Decision 이 확정본이다.
- 이미 끝난 것: 즉시 복구는 ADR 밖에서 끝났다 (`d07e097be` — ToggleButton `min-width` · 그룹 `gap` 고정 · 게이트 예외를 선언 단위로). 이 ADR 은 그 고정 방식 자체를 없앤다.
- 관계: [ADR-295](completed/295-d3-token-values-s2-style-macro-scale.md) Decision 8 (빌더 chrome 은 S2 값 적용 대상이 아니다) 은 유지한다. Decision 9 의 빌더 쪽 기구 (`builder-catalog-vars.css` · `builder-catalog-pins.css` · 게이트 (c)) 를 이 ADR 이 대체한다 — Implemented 때 295 본문에 대체 포인터 한 줄을 남긴다. [ADR-028](completed/028-builder-css-scope-isolation.md) (`[data-context="builder"]` 변수 스코프) 의 다음 단계다 — 변수만이 아니라 시트 단위로 나눈다.

## Context

### SSOT domain

**D3 consumer 경계** 다. D3 (catalog `COMPONENT_RULES_TABLE` + theme/tokens) 의 consumer 는 Canvas (Skia) 와 Preview · Publish (DOM + CSS) 둘이다 ([ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) §1 D3). 빌더 chrome (패널 · 헤더 · 대시보드 · 로그인 · 오버레이 위젯) 은 D3 consumer 가 아니라 builder-system layer 다 ([css-tokens.md](../../.claude/rules/css-tokens.md) §빌더 chrome 기하 — 「이 2티어는 빌더 chrome 의 크기다 — 사용자 컴포넌트의 크기와 무관하다」 · [panel-structure.md](../../.claude/rules/panel-structure.md)). CSS 적용 경로는 그 경계를 따르지 않는다. D1 (RAC DOM) · D2 (prop) 는 바뀌지 않는다.

### 문제

빌더 위젯은 사용자 컴포넌트와 같은 RAC 컴포넌트이고 같은 기본 class (`.react-aria-*`) 를 단다. 빌더 문서와 Preview · Publish 문서는 같은 시트를 대량으로 같이 싣는다 — 생성 시트, 손으로 쓴 컴포넌트 시트, 테마 시트. 그래서 한쪽을 고치면 다른 쪽이 바뀐다.

- **생성 시트 → 빌더** (2026-11-09 사례): ToggleButton rule 에 S2 최소 폭 (`min-width: {size.height}`, `5cf91844f`) 이 들어가자 Design 패널 버튼이 20 → 30 px 가 되어, 84 px 그룹의 세 번째 버튼이 칸 밖으로 밀리고 Layout 줄 1열이 `114px 84px` 로 넓어졌다. 그룹 기본 `gap: 8px` (`3ca03f661`) 도 같은 경로로 들어왔다. 되돌리는 게이트는 같은 날 블록 단위 예외 (`8ccd0c9a8`) 로 두 선언을 통과시켰다. 복구 = `d07e097be`.
- **되돌리기 비용**: ADR-295 (2026-10-30) 이후 고정 파일 · 게이트 커밋 25건, 그중 `2207c6768` 한 건이 「게이트 (c) 변화 98건 정리」 (고정 파일 +187 줄).
- **공유 수동 시트 → 양쪽**: 한 파일 안에서 빌더 규칙과 사용자 규칙을 `[data-catalog-id]` 유무로 가른 곳이 19장 · 154곳이다 — 결합을 파일 안에서 손으로 관리하고 있다.
- **반대 방향**: 빌더 문서가 Preview 테마 시트 (`preview-system.css` — `:root` 변수) 를 싣고, Preview 문서가 빌더 테마 시트 (`builder-system.css`) 를 싣는다. `/publish` 문서는 빌더 `index.html` 이라 빌더 CSS 를 eager 로 싣고, 그것을 막으려고 고정 시트 선택자마다 `:not(:where(.publish-app *))` 가 붙어 있다.

### 코드 사실 (2026-11-09, main `d07e097be`)

| 사실                                                                                                                                                                                                                                                                                              | 근거                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빌더 문서는 `builder-components.css` 의 `@import` 79 (생성 43 · 수동 36) + `index.css` → `theme.css` 를 싣는다                                                                                                                                                                                    | `apps/builder/src/main.tsx:39,43` · `apps/builder/src/index.css:27`                                                                                                                                                                                                         |
| 생성 시트 43장 = raw 367,508 B · gzip 27,218 B. 같은 파일 머리말은 「builder 는 leaf 생성 CSS 를 싣지 않는다」 (낡음)                                                                                                                                                                             | `packages/shared/src/components/styles/builder-components.css:9-12`                                                                                                                                                                                                         |
| 빌더와 Preview 가 **같이** 싣는 수동 시트 = 43장 (foundation 의 base · forms · overlays · utilities · animations · Chat · Event 계열 포함) · 8,866 줄 · gzip 54,536 B. 빌더 전용 수동 = 6 (ColorArea · ColorSlider · ColorWheel · builder-listbox-section + 고정 시트 2)                          | `builder-components.css` · `foundation.css:15-39` ∩ `styles/index.css` (Preview — `apps/builder/src/preview/index.tsx:11`)                                                                                                                                                  |
| 공유 수동 시트 안 `data-catalog-id` 분기 = 19장 · 154곳 (Table 31 · Tree 22 · utilities 19 · ListBox 16 · Popover 7 …)                                                                                                                                                                            | 같은 파일들 grep                                                                                                                                                                                                                                                            |
| `theme.css` 는 양쪽이 싣는다 — 안에 `preview-system.css` (`:root` 179 줄) · `shared-tokens.css` · 팔레트 생성 3 · `builder-system.css` (`:root` · `.app` · `[data-builder-theme]` 245 줄)                                                                                                         | `packages/shared/src/components/theme.css:30-35` · `styles/index.css:32`                                                                                                                                                                                                    |
| 빌더 root 고정 · 되돌리기 시트 = 216 + 689 줄 (`--catalog-token-*` 165 선언)                                                                                                                                                                                                                      | `builder-catalog-vars.css` (`@layer shared-tokens`, `:root:not(:has(.publish-app))`) · `builder-catalog-pins.css` (`@layer components`)                                                                                                                                     |
| 그 대조 기준 = 295 전 생성 시트 치수 1,193 항목 (이미 없는 `DisclosureGroup.css` 포함)                                                                                                                                                                                                            | `apps/builder/src/builder/catalogRuntime/__tests__/fixtures/adr295-builder-consumed-generated-baseline.json` · `builderCatalogVars.static.test.ts`                                                                                                                          |
| 생성 43장 중 빌더 위젯에 class 가 닿는 것 = 13 가족 (ActionButton · ActionButtonGroup · Slider · ToggleButton · ToggleButtonGroup · Input · TextField · NumberField · Select · ComboBox · Menu · Dialog + SearchField 안 Input). 나머지 30 은 소비 0 이거나 모든 사용처가 `className` 으로 덮는다 | `PropertySelect.components.tsx:289` (소비 58 파일) · `FieldValueInput.tsx:384` · `PropertySlider.tsx:146` · `components/ui/ActionButton.tsx` (`ActionIconButton` 33 파일) · shared `ToggleButton.tsx:74-75` · `ConfirmDialog.tsx:55-56` (Dialog 시트를 피하려고 class 지정) |
| 빌더 문서에 사용자 컴포넌트 DOM 은 없다 — Canvas 는 Skia `<canvas>` 하나, Preview · Compare Mode 는 iframe                                                                                                                                                                                        | `CatalogCanvas.tsx:1915` · `CatalogPreviewFrame.tsx:206-210`                                                                                                                                                                                                                |
| `/publish` 는 새 탭에서 전체 문서로 열리지만 그 문서는 빌더 `index.html` (eager 빌더 CSS) 이고, route `/publish/*` 의 lazy chunk 가 `styles/index.css` 를 다시 싣는다                                                                                                                             | `openCatalogPublish.ts:9,19-21` (`location.replace`) · `main.tsx:50,109-122` · `apps/publish/src/App.tsx:39,274` (`.publish-app`)                                                                                                                                           |
| 빌드 진입은 `index.html` · `preview.html` 둘 (multi-page). 배포 = gh-pages · Vercel 정적 출력 `apps/builder/dist`                                                                                                                                                                                 | `apps/builder/vite.config.ts:336-339` · `.github/workflows/deploy.yml:96-120` · `vercel.json`                                                                                                                                                                               |
| 빌더 chrome CSS 는 이미 `builder-system` layer 에서 `.react-aria-*` 를 다시 칠한다 (생성 Select 값을 손으로 옮긴 사례 포함)                                                                                                                                                                       | `apps/builder/src/builder/components/styles/form-controls.css:1-3` (선택자 80) · layer 순서 `apps/builder/src/index.css:15`                                                                                                                                                 |

### Hard constraints

- **빌더 chrome 시각 Δ 0**: 분리 전후 빌더 화면 (Design · Data · 헤더 · 대시보드 · 로그인 · 오버레이) 의 위젯 computed style 이 상태별로 같다. 지금 화면이 정본이고, 모양을 고치는 일은 이 ADR 밖이다.
- **Preview · Publish 시각 Δ 0**: 팔레트 전 컴포넌트 × 상태의 computed style 이 Preview iframe · Publish 에서 같다. 생성기 · 생성 CSS 는 바꾸지 않는다 (`pnpm validate:sync` diff 0). 공유 수동 시트에서 빌더 규칙을 빼는 변경은 이 조건 아래서만.
- **번들**: ADR-201 상한 (Builder ≤ 1,414,000 · Preview ≤ 327,000 B gz, 만료 2026-11-25) 안. `/publish` 진입 분리로 JS 진입이 하나 늘어난다 — 그 진입도 같은 측정 (`adr209-bundle-closure.mjs`) 에 넣는다.
- **D1 무변경**: RAC DOM · ARIA 그대로. class 를 바꾸더라도 RAC `className` prop 으로만.
- **배포**: `/publish?project=…` URL 이 그대로 열려야 한다 (gh-pages · Vercel 정적 호스팅 — 서버 rewrite 없음).

### Soft constraints

- 빌더 위젯 소비 파일이 넓다 (`@composition/shared/components` 32 · `react-aria-components` 103 파일). 파일마다 손대는 방식은 비용이 크다.
- 공유 수동 시트에는 양쪽이 모두 쓰는 규칙 (예: 기본 `.react-aria-Popover`) 이 있다. 나누면 같은 규칙이 두 벌 생긴다.

## Alternatives Considered

외부 패턴: 노코드 · 디자인 도구는 편집기 UI 와 사용자 산출물의 CSS 를 문서 경계로 가른다 — Webflow Designer · Framer · Plasmic Studio 는 사용자 사이트를 iframe 캔버스에 그리고 편집기 UI 는 자기 디자인 시스템을 쓴다. Storybook 도 manager UI 와 preview iframe 의 CSS 를 섞지 않는다. composition 은 Preview 가 이미 iframe 이고 Canvas 는 Skia 라, 남은 결합은 「두 문서가 같은 시트를 싣는다」 하나다.

### 대안 A: 현행 유지 + 게이트 강화

- 설명: 공유를 그대로 두고, 새 선언은 고정 시트로 되돌린다. 게이트 (c) 예외를 선언 단위로만 (`d07e097be`).
- 위험: 기술 LOW / 성능 LOW / 유지보수 **HIGH** (catalog 변경마다 고정 파일 · 게이트 커밋 — 10일 25건, 놓치면 사용자 보고로 발견. 수동 시트 · 테마 결합은 그대로) / 마이그레이션 LOW

### 대안 B: 사용자 시트를 사용자 DOM 범위로 가둔다

- 설명: 생성기 · 수동 시트의 모든 선택자를 사용자 DOM 표지 (`[data-catalog-id]` 와 그 자손) 안으로 좁힌다. 양쪽이 시트를 같이 싣더라도 chrome 에 닿지 않는다.
- 위험: 기술 **HIGH** (RAC 내부 요소 · portal · Toast region 처럼 catalog 노드가 아닌 DOM 이 표지 밖에 있을 수 있다 — 하나라도 빠지면 Preview · Publish 가 깨지고 대상이 생성 131 + 수동 43장) / 성능 MEDIUM / 유지보수 MEDIUM (빌더 → 사용자 방향 (`builder-system` · 빌더 chrome 시트가 Preview · `/publish` 에 닿음) 은 그대로) / 마이그레이션 **HIGH** (Preview · Publish cascade 전면 변경)

### 대안 C: 문서마다 자기 시트만 싣는다 — 빌더 chrome 시트 · 사용자 시트를 나누고 `/publish` 를 별도 진입으로 (채택)

- 설명:
  - **빌더 문서**: 생성 시트 0 · 공유 수동 시트 0 · `preview-system.css` 0. 빌더 위젯이 그 시트에서 받던 값 (지금 화면) 은 빌더 chrome 시트로 옮긴다 (`builder-system` layer · chrome 토큰).
  - **Preview · Publish 문서**: 생성 시트 + 사용자 쪽 수동 시트. `builder-system.css` 와 수동 시트 안의 빌더 전용 규칙 (`data-catalog-id` 분기의 빌더 쪽 · 빌더 패널 전용 시트) 을 뺀다.
  - **양쪽 공유 허용**: 선택자 없이 `:root` 원시 변수만 선언하는 시트 (팔레트 · 원시 스케일) 뿐 — Phase 0 이 시트마다 판정한다.
  - **`/publish`**: 빌더 `index.html` 의 route 가 아니라 Preview 처럼 자기 HTML 진입 (`publish/index.html`) 으로 — 빌더 CSS 를 싣지 않는다. 빌더에서 가는 길은 전체 문서 이동.
  - 고정 시트 2 · 게이트 (c) · 기준 fixture 삭제.
- 위험: 기술 MEDIUM (빌더 13 가족 + 공유 수동 시트의 빌더 몫을 정확히 옮겨야 한다 — computed style 스냅샷이 oracle) / 성능 LOW (빌더 CSS 감소 · Preview CSS 감소 · `/publish` 는 빌더 JS · CSS 를 싣지 않는다) / 유지보수 LOW (한쪽 변경이 다른 쪽에 닿을 경로가 없다 — 두 벌이 된 규칙은 각자 바뀐다) / 마이그레이션 MEDIUM (양쪽 시각 회귀 가능 — 두 스냅샷 Δ 0 게이트, 롤백은 import 목록 복원)

### 대안 D: 빌더 위젯 class 이름을 전부 빌더 것으로

- 설명: 빌더의 모든 RAC 사용처가 `className` 으로 `builder-*` 를 달아, 어떤 사용자 시트가 실려도 맞지 않게 한다.
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 MEDIUM (사용자 → 빌더 방향만 막는다 — 테마 시트 · `/publish` 의 빌더 CSS 는 그대로) / 마이그레이션 **HIGH** (114 파일 · 하드코딩 `react-aria-*` 사용처 Popover 19 · Input 15 · Group 22 · Dialog 7 · Select 5 파일, 테스트 쿼리 · builder CSS 43 파일의 선택자)

### Risk Threshold Check

| 대안 | HIGH+                         | 판정                                                                 |
| ---- | ----------------------------- | -------------------------------------------------------------------- |
| A    | 유지보수 HIGH                 | 결합이 남는다 — 사용자 결정 #1 (「완전한 분리」) 과 어긋남           |
| B    | 기술 HIGH · 마이그레이션 HIGH | 사용자 산출물 전체의 cascade 를 바꾸고도 빌더 → 사용자 방향이 남는다 |
| C    | 없음                          | 채택 후보                                                            |
| D    | 마이그레이션 HIGH             | 한 방향만 막는 데 가장 큰 변경                                       |

HIGH 없는 대안 (C) 이 있으므로 루프 종료.

## Decision

**대안 C 를 채택한다.** 빌더 문서와 Preview · Publish 문서는 컴포넌트 CSS 를 공유하지 않는다.

1. **경계 — 문서마다 자기 시트**: 빌더 문서 (`index.html` 진입) 가 싣는 시트 중 Preview · Publish 도 싣는 것은 「선택자 없는 `:root` 원시 변수 시트」 뿐이다. 그 밖의 시트 (컴포넌트 · 요소 선택자, context 테마 `preview-system.css` · `builder-system.css`) 는 한쪽 것이다. 판정은 시트 단위 (Phase 0 분류표), 집행은 import 목록 정적 게이트.
2. **빌더 쪽 값의 출처**: 빌더 chrome 시트의 값은 **분리 직전 빌더 화면** (computed style 스냅샷) 이다. 295 전 값 · S2 값 · 생성 식을 다시 계산하지 않는다. chrome 토큰 (`--control-size` · `--radius-*` · `--text-*` · `--bg-*` …) 으로 쓰고, 토큰에 없는 값은 리터럴 + 주석. `--catalog-token-*` 는 읽지 않는다.
3. **빌더 쪽 위치 · 순서**: 빌더 chrome 시트는 `builder-system` layer (`components` 보다 뒤) · `[data-context="builder"]` 범위. 그래서 옛 시트를 빼기 **전에** 빌더 값이 이긴 상태로 스냅샷 Δ 0 을 먼저 증명하고, 그다음 옛 import 를 지운다.
4. **Preview · Publish 쪽**: 지금 시트가 정본이다. 빼는 것은 빌더를 위한 것 — `builder-system.css`, 수동 시트 안 `data-catalog-id` 분기의 빌더 쪽 규칙, 빌더 패널 전용 시트 (Chat · Event 계열 등 Phase 0 이 소비 0 으로 확인한 것) — 뿐이고, 그때마다 Preview · Publish 스냅샷 Δ 0. 사용자 쪽 규칙 · 생성 시트는 무변경. catalog rule 의 `[data-catalog-id]` 범위 좁히기 (생성 9 rule) 는 Preview cascade 를 바꾸므로 건드리지 않는다.
5. **두 벌이 되는 규칙**: 양쪽이 같이 쓰던 수동 규칙은 빌더 chrome 시트에 사본을 둔다 (빌더 값 = 빌더 스냅샷). 이후 두 사본은 서로를 따라가지 않는다 — 그것이 분리의 뜻이다.
6. **`/publish` = 별도 진입 · 전체 문서 이동** (사용자 결정 #2): `apps/builder` 에 Preview 와 같은 방식의 HTML 진입 `publish/index.html` 을 더한다 (정적 호스팅에서 `/publish?project=…` 가 그대로 그 파일). 이 진입은 publish 앱과 `styles/index.css` 만 싣는다. 빌더 `main.tsx` 의 `/publish/*` route 를 지우고, 빌더에서 `/publish` 로 가는 길 (`openCatalogPublish`) 은 전체 문서 이동 (지금의 `location.replace` — 같은 URL, 다른 HTML) 이다. `.publish-app` 을 빌더 시트에서 빼는 선택자 (`:not(:where(.publish-app *))` · `:root:not(:has(.publish-app))`) 는 할 일이 없어지므로 고정 시트와 함께 사라진다.
7. **삭제**: `builder-catalog-vars.css` · `builder-catalog-pins.css` · 게이트 (c) · 기준 fixture · 「Builder's own pickers load this sheet too」 류 주석.
8. **class 는 유지**: 빌더 위젯의 `.react-aria-*` 기본 class 를 바꾸지 않는다 — 빌더 문서에는 사용자 시트가 없으므로 맞을 상대가 없다 (대안 D 기각).

위험 수용 근거: 남는 위험은 값 옮김의 정확도와 Preview 쪽 빼기의 정확도 둘이다. 둘 다 「옛 시트가 실린 채 새 시트가 이긴다 → Δ 0 → 옛 import 삭제 → Δ 0」 순서로 바꾸고, oracle 은 지금 화면 (두 문서 각각) 이다. 롤백은 import 목록 복원 커밋 하나씩.

기각 사유:

- **A**: 사용자 결정 #1 과 어긋난다. catalog 를 고칠 때마다 빌더 회귀 가능성이 남고, 수동 · 테마 시트 결합은 손대지 않는다.
- **B**: 빌더를 지키려고 사용자 산출물 174장의 cascade 를 바꾸고, 빌더 → 사용자 방향 (`builder-system` · `/publish` 의 빌더 CSS) 은 그대로 남는다.
- **D**: 사용자 → 빌더 한 방향만 막는 데 114 파일을 바꾼다.

> 구현 상세: [305-builder-chrome-component-css-separation-breakdown.md](design/305-builder-chrome-component-css-separation-breakdown.md)

### 사용자 결정 — 확정 (2026-11-09)

1. 공유 수동 시트도 이번에 나눈다 — 완전한 분리 (Decision 1 · 4 · 5).
2. `/publish` 는 전체 페이지 이동 (Decision 6 — 별도 HTML 진입).

남은 사용자 판정 0건. 구현 중 범위 밖 차이 (예: 빌더 패널 모양을 이참에 고치기) 가 보이면 이 ADR 이 아니라 후속으로 보고한다.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                            | 심각도 | 대응                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------ |
| R1  | 빌더 위젯 상태 (hover · pressed · selected · disabled · focus-visible · invalid · 열린 Popover · Menu) 중 스냅샷이 덮지 않은 곳에서 chrome 값이 달라진다                                                                                                                                                                                        |  HIGH  | G1 · G2 — 상태 행렬 고정 (Phase 0), 옛 시트 실린 채 Δ 0 → 뺀 뒤 Δ 0                                                      |
| R2  | Preview · Publish 에서 빌더 규칙을 빼다 사용자 DOM 이 쓰던 규칙까지 뺀다 (`:not([data-catalog-id])` 가 catalog 노드가 아닌 RAC 내부 요소 · portal 에도 맞는다)                                                                                                                                                                                  |  HIGH  | G3 — 팔레트 전 컴포넌트 × 상태 스냅샷 (Preview · Publish) Δ 0 을 시트 하나 뺄 때마다                                     |
| R3  | 분류가 틀려 「빌더 소비 0」 시트 · 「원시 변수 시트」 에 실제 소비가 있다                                                                                                                                                                                                                                                                       | MEDIUM | G0 — 정적 분류 + CSSOM live 계수 (두 문서에서 규칙마다 매치 요소 수)                                                     |
| R4  | `/publish` 진입 분리로 정적 호스팅 경로 · dev 서버 · 번들 측정 · 자산 URL (`assetUrlResolver.ts` 가 「같은 탭의 `/publish/*` route」 를 전제) 이 어긋난다                                                                                                                                                                                       | MEDIUM | G4 — gh-pages 형태 `dist` 정적 서빙에서 `/publish?project=…` live · `adr209-bundle-closure` 에 진입 추가 · 자산 URL 확인 |
| R5  | 옛 import 집합을 전제한 테스트 · 스크립트 (`builderCatalogVars.static.test.ts` · `packages/shared/src/components/styles/__tests__/generatedCssLoadInventory.static.test.ts` · `s2MissingComponents.test.tsx:96` · `apps/builder/tests/parity/adr297*` · `apps/builder/scripts/adr295BuilderGeneratedSheets.mjs`) 가 의미를 잃거나 거짓 통과한다 | MEDIUM | 해당 Phase 에서 지우거나 새 경계 게이트로 바꾼다 — 목록은 breakdown §2.4                                                 |
| R6  | 두 벌이 된 규칙의 한쪽만 고쳐야 할 결함 (접근성 focus 표시 등) 이 다른 쪽에 남는다                                                                                                                                                                                                                                                              |  LOW   | 의도된 결과 — 결함 수정은 양쪽 판정을 따로 (CHANGELOG 에 어느 쪽인지)                                                    |
| R7  | 규칙 문서 (`css-tokens.md` · `ssot-hierarchy.md` · `panel-structure.md` · `componentRulesTable.ts` 주석 · `builder-components.css` 머리말) 가 옛 기구를 현재처럼 인용한다                                                                                                                                                                       |  LOW   | 마지막 Phase + `pnpm docs:stale-symbols`                                                                                 |

## Gates

측정 조건 (G0 ~ G3 공통): 실제 화면 (합성 문서 아님 — 빌더는 실제 패널, Preview 는 팔레트 전 컴포넌트를 놓은 프로젝트) · Chrome · DPR 2 · `visibilityState: visible` · 빌더 패널 폭 2 (기본 387 · 좁은 228 — 열 최소 폭이 갈리는 쪽) · 빌더 chrome light · dark · Preview 테마 기본 preset light · dark. 대조군 = 같은 하니스 두 번 실행 Δ 0 (하니스 흔들림 0). oracle = 분리 직전 화면 (두 문서 각각) — 설계자가 정한 값이 아니라 현재 렌더 결과.

| Gate | 시점                        | 통과 조건                                                                                                                                                                                                                                                                          | 실패 시 대안                                            |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G0   | Phase 0                     | 시트 분류표 (빌더 전용 · 사용자 전용 · 양쪽 규칙 포함 · 원시 변수 공유) 고정 · 두 스냅샷 하니스 기준값 저장 · CSSOM 계수로 분류 확인 (빌더 화면에서 생성 규칙 매치는 13 가족 밖 0, Preview 에서 빌더 전용으로 분류한 규칙 매치 0)                                                  | 분류 보강 (inventory — 사후 보고)                       |
| G1   | 빌더 chrome 시트 Phase 마다 | 옛 시트가 실린 채 빌더 스냅샷 Δ 0 · 빌더 chrome 시트에 `--catalog-token-*` 0 · 미디어 쿼리 0 (정적)                                                                                                                                                                                | 다른 항목을 가족 단위로 고쳐 Δ 0 까지                   |
| G2   | 빌더 import 삭제 Phase      | 생성 43 · 공유 수동 43 · `preview-system.css` · 고정 시트 2 를 빌더 문서에서 뺀 뒤 빌더 스냅샷 Δ 0 · 정적 게이트: 빌더 진입이 싣는 시트 ∩ Preview 진입이 싣는 시트 = 원시 변수 시트만 (push 전 `pnpm codex:preflight` unit project)                                                | 원인 가족을 G1 단계로 되돌려 보강                       |
| G3   | Preview 쪽 빼기 Phase       | 시트 · 분기를 뺄 때마다 Preview · Publish 팔레트 스냅샷 Δ 0 · `pnpm validate:sync` diff 0 (생성 CSS 무변경)                                                                                                                                                                        | 그 규칙을 사용자 쪽으로 재분류 (빼지 않음)              |
| G4   | `/publish` Phase            | `dist` 를 정적 서버로 띄워 `/publish?project=…` 가 `publish/index.html` 로 열림 · 그 문서에 빌더 시트 0 · 빌더 → Publish 전체 문서 이동 · Publish 스냅샷 Δ 0 · 번들 측정 3 진입 (builder · preview · publish) 상한 안                                                              | 진입 경로를 `publish.html` + 빌더 쪽 이동 URL 로 바꾼다 |
| G5   | 마지막 Phase (live)         | Chrome MCP: 빌더 (Design 패널 Layout · Style · Text · Data RowForm · PropertySelect 열린 목록 · Canvas 간격 입력 · Grid track 메뉴 · 헤더 · 대시보드 · Sign-in) · Preview · Compare Mode · Publish 새 탭 스크린샷 before/after · console 오류 0 · CSS 크기 Δ 기록 · 사용자 confirm | 차이 항목을 해당 Phase 로                               |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- catalog rule · 사용자 쪽 수동 시트 · Preview 테마를 고쳐도 빌더 chrome 은 바뀌지 않고, 빌더 chrome 을 고쳐도 Preview · Publish 는 바뀌지 않는다 — 양방향 회귀 경로가 없다.
- 고정 시트 2 (905 줄) · 게이트 (c) · 1,193 항목 fixture · `data-catalog-id` 분기 154곳의 빌더 쪽 · `.publish-app` 예외 선택자가 사라진다.
- 빌더 문서 CSS 감소 (생성 gzip 27 KB + 공유 수동의 빌더 미사용분), `/publish` 는 빌더 JS · CSS 를 싣지 않는다.
- ADR-295 Decision 8 「빌더 chrome 은 대상이 아니다」 가 import 목록으로 강제된다.

### Negative

- 양쪽이 쓰던 규칙이 두 벌이 된다 — 같은 결함을 양쪽에서 따로 고칠 수 있다 (R6).
- 빌더 위젯 모양을 빌더가 따로 유지한다 — S2 정렬이 빌더에 자동으로 오지 않는다 (Decision 8 과 같은 방향).
- 진입이 셋 (builder · preview · publish) 이 되어 빌드 · 배포 · 번들 측정 구성이 하나 늘어난다.
- 구현 기간 동안 스냅샷 하니스 둘을 유지한다 (Phase 0 산출물).
