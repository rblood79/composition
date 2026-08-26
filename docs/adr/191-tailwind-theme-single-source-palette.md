# ADR-191: Tailwind v4 theme.css 단일 원천 팔레트 파생 — App.css :root / shared-tokens hex / colors.ts hex 손 복사본 3개 제거

## Status

Accepted — 2026-08-26 (review-adr round 1 승인 — MED 1·LOW 1 fixed, LOW 1 deferred → Phase 3 실측)

## Context

### Domain (SSOT 체인 — [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))

**D3 시각 스타일** — theme/tokens root collection 의 팔레트 층. D1(DOM/ARIA)·D2(Props) 무관. 변수명 `--color-{family}-{step}` 은 불변이므로 catalog `COMPONENT_RULES_TABLE` 과 컴포넌트 CSS 는 무수정.

### 문제 — 팔레트 정의 원천이 3개이고, Builder 와 Preview 가 서로 다른 세대를 본다

2026-08-26 라이브 빌더 + `preview.html` 실측 ([breakdown §0](design/191-tailwind-theme-single-source-palette-breakdown.md)):

| 원천                                                      | 레이어                 | 세대       | Builder DOM    | Preview / Publish DOM |
| --------------------------------------------------------- | ---------------------- | ---------- | -------------- | --------------------- |
| `@import "tailwindcss"` 자동 emit (142)                   | `@layer theme`         | v4 oklch   | 로드 (2위)     | 미로드                |
| `apps/builder/src/App.css:6` `:root` (387)                | **unlayered**          | v4 oklch   | **승자 전부**  | 미로드                |
| `shared-tokens.css` 팔레트 (94 = hex 83 + neutral hsl 11) | `@layer shared-tokens` | **v3 hex** | 패배 (dead 93) | **유일 원천**         |

- `shared-tokens.css` 헤더는 _"DO NOT modify — they follow Tailwind v4 standards"_ 라고 선언하지만 값은 Tailwind **v3** hex — 자기 선언과 모순되는 stale 손 복사본. `App.css :root` 는 Tailwind theme 의 손 복사본(값 동일 120 / 미참조 245 / 실질 override 는 Pretendard 폰트 2줄). `packages/specs/src/primitives/colors.ts` 는 ADR-017 에서 "M3 hex → Tailwind hex" 로 교체된 세 번째 손 복사본 (112 중 46 이 v3 팔레트 정확 일치), `neutralToSkiaColors.ts` 57 hex 도 동일.
- 결과: 같은 `Badge.css` 가 빌더 패널에서는 `oklch(…)`, Preview 에서는 `#9333ea` 로 그려진다. 겹치는 팔레트 82개 중 sRGB 채널 Δ>10 이 27개, 그중 실제 소비 114회 (`--color-purple-600` Δ35 35회, `--color-green-600` Δ22 20회, `--color-red-600` Δ38, `--color-green-400` Δ69).
- 레이어 순서 실측: `index.css:14` 의 `@layer` 선언에 `theme` 이 없어 Tailwind 레이어가 **최상위**에 붙고, 그 위를 unlayered `App.css` 가 다시 덮는다 — 캐스케이드가 우연에 의존.
- Skia(`colors.ts` v3 hex) ≈ Preview(v3 hex) 이므로 D3 Skia↔Preview 대칭 자체는 유지되고, 이탈자는 Builder DOM 이다. 그러나 프로젝트가 선언한 표준은 v4 이고, v3 쪽이 따라오지 못한 것이다 — 정합 방향은 "Builder 를 v3 로 후퇴" 가 아니라 "3자 모두 v4 원천에서 파생" 이어야 한다 (§6 "수동 CSS 가 SSOT 파생 아님" 금지).

**Generator 선언** (adr-writing.md 선차단 #2): 본 ADR 은 spec/catalog Generator 확장이 아니다. 신규 생성기 1개가 Tailwind `theme.css` 의 `@theme default {}` 블록을 파싱해 산출물 2개(plain CSS / TS hex) 를 emit 한다. 자식 selector·variant emit 과 무관.

**Hard Constraints**:

1. **3자 대칭**: Builder DOM / Preview·Publish DOM / Skia 가 같은 팔레트 토큰에서 sRGB 채널 **Δ ≤ 2** (oklch→sRGB 반올림 허용치). 현재 최대 Δ69.
2. **Publish 는 Tailwind 파이프라인 없이 로드** — `apps/publish` 는 plain Vite(`plugins: [react()]`, postcss 없음). Tailwind `theme.css` 는 `@theme` at-rule 이라 브라우저가 무시하므로, 산출물은 **plain CSS** 여야 한다.
3. **`packages/specs` 는 DOM 없는 환경**(vitest node, 레이아웃 엔진) 에서 팔레트 값을 제공해야 한다 — 런타임 `getComputedStyle` 단독 의존 불가.
4. **하위 호환**: `--color-{family}-{step}` 변수명 불변 — 소비 294회 / 22 파일 (shared styles) + builder/preview-system alias 무수정. BC 훼손 0% (문서 재직렬화 없음 — 저장 문서는 토큰 값을 갖지 않는다).
5. **번들**: 초기 < 500KB 유지 — 팔레트 CSS 추가분 ≤ 20KB (288 변수 원문 기준 추정 ~12KB).
6. **결정성**: 생성기 재실행 결과가 커밋된 산출물과 byte-diff 0 (drift 테스트 게이트).

**Soft Constraints**:

- Tailwind `4.3.3` 고정 (업그레이드 시 산출물 재생성 — drift 테스트가 표면화).
- Publish 는 현재 작업 대상이 아님 (빌더 안정화 후 착수 방침) — Publish 빌드 설정 변경을 요구하는 대안은 불리.
- 기존 generated 패턴(`packages/specs/scripts/generate-css.ts` → `styles/generated/*.css`, drift 테스트) 과 같은 규율을 따른다.

## Alternatives Considered

### 대안 A: App.css :root 삭제 + Builder 도 shared-tokens v3 hex 로 통일 (후퇴)

- 설명: `App.css :root` 387 삭제, Pretendard 2줄만 `builder-system` 으로 이전, `index.css` `@layer` 에 `theme` 을 `shared-tokens` 앞에 두어 v3 hex 가 이기게 고정. shared-tokens / colors.ts 는 그대로.
- 근거: 최초 제안. 수정 파일 2, 시각 변화는 빌더 패널 chrome 만 (Preview 와 같아짐).
- 위험:
  - 기술: L — 레이어 순서 선언만으로 확정.
  - 성능: L — 변화 없음.
  - 유지보수: **H** — v3 손 복사본 2개(shared-tokens 93 / colors.ts 46)를 정본으로 영구화. 헤더 "follow v4" 모순 유지. Tailwind 업그레이드마다 같은 발산 재발. ssot-hierarchy §6 "수동 CSS 가 SSOT 파생 아님" 금지 위반 상태를 공식화.
  - 마이그레이션: L — 저장 문서 영향 없음.

### 대안 B: 런타임 파생 — Preview/Publish 에 Tailwind 파이프라인 추가 + Skia 는 DOM 읽기

- 설명: `apps/publish` 에 `@tailwindcss/postcss` 추가, shared `theme.css` 에서 `@import "tailwindcss/theme.css" theme(static)` 으로 전 변수 emit. Skia 는 기존 `getCSSVariable()` (`cssVariableCore.ts:35`) 로 `--color-*` 를 DOM 에서 읽어 hex 로 변환. `colors.ts` 는 fallback 으로 축소.
- 근거: Tailwind 공식 — `theme(static)` 옵션은 참조 여부와 무관하게 모든 theme 변수를 CSS 로 emit ([Tailwind v4 docs · Theme variables › Generating all CSS variables](https://tailwindcss.com/docs/theme#generating-all-css-variables)). 원천 파일을 그대로 소비하므로 "복사" 개념 자체가 사라진다.
- 위험:
  - 기술: M — Skia 색 파서(`colorUtils.ts::cssColorToRgbNumber`, colord names/hwb/lab/mix 플러그인) 가 **oklch 미지원** → DOM 이 주는 `oklch(…)` 문자열을 런타임 변환하는 계층 추가 필요 (`styleConverter.ts::oklchToHex` 는 있으나 Skia fill 경로에 미연결).
  - 성능: M — 첫 프레임 전 CSS 로드 타이밍 의존 + `cssVarCache` 무효화 경로(`invalidateCSSVariableCache`) 확대. 전 변수 emit 으로 CSS +~15KB.
  - 유지보수: M — Publish 빌드 파이프라인 확장 (작업 대상 외 영역), `@theme` 처리 실패 시 팔레트 전체 소실이라는 조용한 실패 모드.
  - 마이그레이션: **H** — 제약 3 위반: `packages/specs` 의 DOM 없는 소비자(테스트·엔진)는 fallback 값이 필요하고 그 fallback 이 곧 지금의 `colors.ts` 손 복사본 → **복사본이 제거되지 않는다**. Publish 빌드 변경 + Skia 색 경로 재설계가 동반.

### 대안 C: 빌드 생성 파생 — 생성기 1 + 산출물 2 (plain CSS + TS hex) + drift 게이트

- 설명: `packages/specs/scripts/generate-palette.ts` 가 `node_modules/tailwindcss/theme.css` 의 `@theme default {}` 블록에서 `--color-*` 288 을 추출해 (1) `packages/shared/src/components/styles/theme/generated/tailwind-palette.css` (`@layer shared-tokens :root`, oklch 원문 — 브라우저 네이티브) (2) `packages/specs/src/primitives/generated/tailwindPalette.ts` (oklch→sRGB hex, Phase 0 canvas 실측으로 검증된 수식) 를 emit. `colors.ts` 46 항목과 `neutralToSkiaColors.ts` 57 은 생성 TS 를 참조. `App.css :root` 삭제, Pretendard 는 `index.css` `@theme { --font-sans }` 로 원천에서 override. `shared-tokens.css` 의 Tailwind 이름 팔레트 93 (hex 82 + neutral hsl 11) 삭제 + 헤더 정정 — Tailwind 에 없는 확장 `--color-zinc-850` (`builder-system.css:133` `--bg-raised` 소비) 은 custom 으로 유지. `index.css` `@layer` 에 `theme` 선두 선언. drift 테스트 = 재생성 byte-diff 0. `build:specs` 에 연동.
- 근거: (a) 프로젝트 기존 규율 — catalog `generated/componentRulesTable.ts`, `styles/generated/*.css` 는 모두 "생성기 + 커밋된 산출물 + drift 테스트" 로 SSOT 파생을 보장 (ADR-142). (b) Tailwind 는 `theme.css` 를 패키지 파일로 배포하므로 파싱 대상이 안정적 (`@theme default { --name: value; }` 단순 선언 목록). (c) 디자인 토큰 업계 표준(Style Dictionary, Tokens Studio) 이 build-time 변환으로 다중 플랫폼(CSS/JS) 산출물을 내는 것과 같은 형태 — 런타임 의존 없이 각 소비자가 자기 포맷을 받는다.
- 위험:
  - 기술: L — 파서는 `--name: value;` 정규식 + 다중행 값 스킵. oklch→sRGB 수식은 canvas 실측 일치 확인 (gray-500 `106,114,130`, blue-500 `43,127,255`, green-400 `5,223,114` clamp).
  - 성능: L — CSS +~12KB (제약 5 게이트), 런타임 비용 0.
  - 유지보수: L — drift 테스트가 stale 을 build 시 실패로 표면화. 손 복사본 3 → 0.
  - 마이그레이션: M — **Preview/Publish 팔레트가 v3 → v4 로 이동** (사용자-가시: Badge/StatusLight/InlineAlert 등 27 토큰 114 참조의 색이 미세~중간 변화). `colors.ts` 46 값 변경으로 Skia fixture/snapshot 갱신 필요. 저장 문서 영향 0%.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | L    | **H**    | L            |     1      |
| B    | M    | M    | M        | **H**        |     1      |
| C    | L    | L    | L        | M            |     0      |

루프 판정: C 가 HIGH 0 → 추가 대안 불요. A·B 의 HIGH 는 각각 "복사본 영구화" / "복사본 미제거 + scope 밖 파이프라인" 으로 본 ADR 의 목적 자체와 충돌하므로 완화 불가.

## Decision

**대안 C: 빌드 생성 파생** 을 선택한다.

선택 근거:

1. **잔존 위험은 마이그레이션 M 하나**이며 그 내용이 "Preview/Publish 가 이미 선언된 v4 표준으로 이동" — 의도된 변화다. 변화 폭은 Phase 0 에서 토큰별 Δ 로 수식화되어 있고(최대 Δ69 green-400, 소비 27 토큰), CHANGELOG 로 기록한다.
2. 제약 2(Publish plain CSS)·3(specs DOM 없음) 을 **동시에** 만족하는 유일한 대안 — 산출물이 소비자별 포맷(CSS / TS) 이라 파이프라인 의존이 없다.
3. 프로젝트가 이미 검증한 규율(생성기 + 커밋 산출물 + drift 게이트) 의 재사용이라 새 메커니즘 도입이 아니다.
4. Skia fixture 갱신은 drift/단위 테스트가 자동 검출하므로 조용한 회귀가 없다.

기각 사유:

- **대안 A 기각**: 표준 선언(v4) 을 stale 복사본(v3) 에 맞춰 후퇴시키는 방향. ssot-hierarchy §6 위반 상태를 공식화하고 헤더 모순을 남긴다. 수정 범위가 작다는 것은 SSOT 근거가 아니다.
- **대안 B 기각**: `packages/specs` 의 DOM 없는 소비자 때문에 fallback 복사본(`colors.ts`) 이 남는다 — "복사본 3개 제거" 라는 목표 미달. Publish 빌드 설정 변경은 현 방침(빌더 안정화 전 Publish 미착수) 과 충돌. Skia 파서의 oklch 미지원으로 런타임 변환 계층이 추가된다.

> 구현 상세: [191-tailwind-theme-single-source-palette-breakdown.md](design/191-tailwind-theme-single-source-palette-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                               | 심각도 | 대응                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Preview/Publish 팔레트 v3→v4 이동으로 기존 프로젝트 화면 색 변화 (Badge/StatusLight/InlineAlert 27 토큰 114 참조)                                                                                                  |  MED   | 의도된 변화. CHANGELOG 사용자-가시 엔트리 + G2 에서 대표 컴포넌트 스크린샷 전/후 비교 기록                                                                          |
| R2  | `App.css :root` 삭제 후 Builder 가 `@layer theme`(참조된 변수만 emit) 에 의존 — 참조되나 emit 안 된 변수 소실                                                                                                      |  MED   | Phase 0 실측: 참조 19 변수 전부 theme 에 존재. 추가로 생성 CSS 가 288 전부를 `shared-tokens` 레이어로 제공하므로 이중 안전. G0 에서 unresolved `var()` 0 확인       |
| R3  | oklch→sRGB 변환 오차로 Skia(hex) ≠ DOM(oklch) — 특히 gamut 밖 값(green-400 등) clamp                                                                                                                               |  LOW   | 수식은 canvas 실측 일치 확인. G1 이 288 전수 Δ≤2 검증. clamp 는 브라우저 sRGB 렌더와 동일 동작                                                                      |
| R4  | Tailwind 업그레이드 시 `theme.css` 변동으로 산출물 stale                                                                                                                                                           |  LOW   | drift 테스트가 `build:specs`·CI 에서 실패로 표면화 (G3). 재생성 1회로 해소                                                                                          |
| R5  | `colors.ts` custom 66 값(S2/Leonardo) 과 `--primary`/`--on-surface` M3 dead path 는 범위 밖으로 남음                                                                                                               |  LOW   | breakdown §0-5 에 범위 밖 명시. 본 ADR 은 Tailwind 복사본만 다룬다 — 별도 정리 시 본 ADR 산출물을 참조 원천으로 사용                                                |
| R6  | 축 일치 리터럴 중복 58건(`--panel-workspace-gap` 류) 은 본 ADR 과 무관한 일반 sweep — 같은 세션 발견이라 scope 혼입 유혹                                                                                           |  LOW   | 범위 밖 고정 (breakdown §0-5). 후속 일반 작업으로 분리 — 별도 ADR 불요                                                                                              |
| R7  | `shared-tokens.css` 에 Tailwind 이름이 아닌 확장 `--color-zinc-850` 이 있고 `builder-system.css:133` `--bg-raised` 가 소비 — 일괄 삭제 시 dark `--bg-raised` 소실                                                  |  MED   | 삭제 set 은 "생성 팔레트에 같은 이름이 있는 것" 으로 한정 (allowlist diff). G4 의 undefined 팔레트 변수 0 검사가 회귀 게이트. zinc-850 은 custom 확장으로 잔존 명시 |
| R8  | Tailwind v3 hex 리터럴이 팔레트 정의 파일 밖에도 잔존 — `LayoutRenderers.tsx:1422` `var(--color-info-600, #2563eb)` 류 fallback, `Table.tsx:562` `#3b82f6`, `dropIndicatorRenderer.ts:19` 등 비-test 12 파일 ~45곳 |  LOW   | 본 ADR 범위는 **팔레트 정의 원천** 3개. fallback 리터럴은 var 미정의 시에만 발현 (G4 로 undefined 0 보장) — breakdown §0-5 에 목록화, 후속 sweep 대상               |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                   | 실패 시 대안                                        |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| G0   | Phase 0 종료 | breakdown §0 inventory 커밋 + Builder 참조 변수 19 ⊂ live `@layer theme` 재확인 + Preview 팔레트 소비 `var()` 전수 목록 확보                                                | inventory 보강 commit (fork 사유 아님 — M3)         |
| G1   | Phase 1 종료 | 생성 TS hex vs 브라우저 canvas 실측 sRGB — 288 전수 Δ≤2; drift 테스트 GREEN                                                                                                 | 변환 수식/파서 교정 후 재생성                       |
| G2   | Phase 2·3·4  | live 3자 대칭: Builder DOM / preview.html / Skia 캔버스에서 `--color-purple-600`·`green-600`·`red-600` 등 상위 소비 6 토큰 sRGB Δ≤2 + Badge·StatusLight `/cross-check` PASS | 레이어 순서·import 순서 점검, Skia 참조 경로 재확인 |
| G3   | Phase 1~4    | `pnpm generate:palette` 재실행 byte-diff 0, `build:specs` 연동, Stop hook rebuild 경로 포함                                                                                 | 생성기 결정성(정렬/포맷) 수정                       |
| G4   | Phase 2 종료 | 팔레트 CSS 증가 ≤ 20KB, 초기 번들 < 500KB 유지, Preview/Publish undefined 팔레트 변수 0                                                                                     | 미참조 family 제외 emit (allowlist) 로 축소         |

## Consequences

### Positive

- 팔레트 **정의 원천** 이 `tailwindcss/theme.css` 하나로 고정 — 정의 복사본 3개(`App.css :root` 387 / `shared-tokens.css` Tailwind 이름 93 / `colors.ts` 46 + `neutralToSkiaColors.ts` 57) 제거, 헤더 모순 해소. (컴포넌트 코드의 fallback hex 리터럴 ~45곳은 R8 — 범위 밖)
- Builder DOM / Preview / Publish / Skia 4 소비자가 같은 값(Δ≤2) — Badge 가 빌더 패널과 Preview 에서 같은 보라색으로 그려진다.
- 캐스케이드가 선언된 `@layer` 순서로 확정 (`theme` 선두) — unlayered 블록 의존 제거.
- Tailwind 업그레이드 절차가 "재생성 1회 + drift 테스트" 로 정형화.

### Negative

- Preview/Publish 의 팔레트 색이 v3 → v4 로 이동 — 기존 프로젝트를 열면 Badge/StatusLight 계열 색이 달라 보인다 (의도된 변화이나 사용자-가시). CHANGELOG 필수.
- 생성 산출물 2개가 저장소에 커밋됨 (기존 generated 패턴과 동일한 유지 부담).
- `colors.ts` 가 생성 모듈에 의존 — `packages/specs` 빌드 순서에 `generate:palette` 가 선행해야 한다.
- 범위 밖 잔여: `colors.ts` custom 66, M3 dead path, 축 일치 리터럴 58건 — 별도 정리 필요.
