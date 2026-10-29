# ADR-290 breakdown — Theme Accent 역할별 토큰 · 목표 대비 명도

> 본문: [ADR-290](../290-theme-accent-contrast-target-lightness.md). 이 문서는 phase · 파일 · 테스트 목록만 둔다. 결정 · 대안 · 위험은 본문이 정본이다.

## §1 전제 lock-in

- 새 ADR 이고 기존 ADR 의 분리 · fork 가 아니다. 선행: ADR-021 (tint · neutral 프리셋) · ADR-110 (theme/tokens root collection) · ADR-227 (`resolveThemeSnapshot` · 테마 컬렉션) · ADR-912 (`componentRulesTable.ts` 직접 편집 정본). 이 ADR 은 resolver 의 accent 파생과 rule 의 accent 참조만 바꾸고 의존 방향은 그대로.
- 스키마 변경 0 · 마이그레이션 코드 0.
- 리뷰 round 1 반영 (2026-10-29): 역할 분리 · 인접 surface 입력 · 색 변수 forced-colors media. round 2 반영: 대비 대상 = rule 에서 유도한 실제 바탕 집합 (`accent-subtle` 포함).

## §2 Phase

### Phase 0 — 기록 · 분류 · RED 6 (제품 코드 변경 0)

1. **대조군 기록**: 프리셋 10 × 모드 2 × Tone 5 의 현재 Skia accent 계열 (accent · accent-hover · accent-pressed · on-accent) 과 DOM 계산값 (Preview iframe `getComputedStyle` — Button accent fill 배경 · 글자, outline 글자, Link 글자, Input focus 테두리) 을 `.agent/runs/<날짜>-adr290/baseline.json` 에 둔다.
2. **hex 표본 20 고정** (본문 Gates Q1) — 같은 파일에.
3. **역할 분류표**: `componentRulesTable.ts` 의 `{color.accent}` 43 곳 (`{color.accent-hover}` · `{color.accent-pressed}` 포함) 을 컴포넌트 · 상태 · 칸 · 역할 (`accent` / `accent-content`) 로 표에 적는다. 규칙 (본문 Decision 1): 같은 상태에서 그 면 위에 on-accent 를 얹으면 `accent`, surface 위에 바로 놓이면 `accent-content`. 같은 상태 배경이 accent 인 자리의 `border` 는 `accent`. 표는 이 문서 §5 에 둔다. 생성 CSS 의 accent 글자 사용처 (Button outline · Link · Badge · DropZone) 가 표의 어느 rule 에서 나오는지 같이 적는다.
   - 분류표에 열 하나를 더한다 — **그 자리 아래 바탕 토큰** (같은 컴포넌트 · 같은 상태의 배경 칸, 상태별로). `accent-content` 자리의 바탕을 모은 집합이 Phase 1 탐색의 대비 대상이다 (글자 바탕 4.5 · 선 · 채움만 놓이는 바탕 3.0). 현재 아는 원소: `base` · `layer-1` · `layer-2` · `elevated` · `neutral-subtle` · `accent-subtle` (Badge subtle `componentRulesTable.ts:312 ~ 322` · `ProgressBarTrack` · 선택 행).
4. **forced-colors 경로 전수**: `ThemeCssVar` 를 소비하는 곳 (`domView.runtime.ts` · `apps/publish/src/catalogSession.ts`) 과 색 아닌 변수 (`--radius-*` · `--border-width-*` · 글꼴) 목록.
5. **RED 6** (새 테스트 — 실패해야 정상):
   - a. dark 프리셋 10 의 accent 대 on-accent ≥ 4.5 — 10 실패
   - b. dark 바탕 위 accent (outline · Link 글자 값) 대 base ≥ 4.5 — 10 실패
   - c. light green · turquoise 의 accent 대 layer-1 ≥ 4.5 — 2 실패, light blue · green · turquoise 의 Badge subtle 글자 대 `accent-subtle` ≥ 4.5 — 3 실패 (4.32 · 4.15 · 4.14)
   - d. hex `#00A86B` 의 light accent 대 흰 글자 ≥ 4.5 — 실패 (4.42)
   - e. snapshot 의 DOM accent-pressed 값 = Skia `accent-pressed` — 실패 (DOM 변수 없음 → preview-system 50% 식)
   - f. forced-colors 에서 명시 델타 `color.neutral-subtle` 이 시스템 색 — 실패 (browser 테스트 또는 live 에뮬레이션)
6. **화면 확인**: e 와 dark on-accent Tone 의존을 `/cross-check` 로 (Button accent pressed · dark 글자). 차이가 안 보이면 본문 G0 대로 범위에서 빼고 사후 보고.

### Phase 1 — 탐색 함수 · resolver 순서

- 새 `packages/shared/src/catalog/runtime/accentContrast.ts`:
  - `relativeLuminance(hex)` · `contrastRatio(a, b)` (WCAG 2 공식, 참조쌍으로 검산)
  - `solveLightness({ c, h, startL, constraints: [{ against: hex, min }] })` → `{ l, ok }` — 시작 명도가 전부 만족하면 그대로, 아니면 모든 조건의 통과 구간을 이분 탐색 (≤ 20 회) 해 시작 명도에 가장 가까운 끝값. 구간이 비면 글자 조건 (min ≥ 4.5) 만으로 풀고 `ok: false`.
- `tintToSkiaColors.ts` `createAccentColorTokens(c, h, mode, surfaces, startL?)`:
  - `accent`: 조건 = on-accent 대 4.5 · `surfaces.base` 대 3.0. hover · pressed 는 검정 85% · 75% 혼합. on-accent = 사용자 결정 1 결과 (권고 흰색).
  - `accent-content`: 조건 = Phase 0 에서 유도한 바탕 집합 — 글자가 놓이는 바탕 대 4.5, 선 · 채움만 놓이는 바탕 대 3.0 (`accent-subtle` 포함). 바탕 집합은 rule 표에서 계산하는 상수 (`ACCENT_CONTENT_BACKDROPS`) 로 두고 정적 테스트가 rule 과 대조한다.
  - `accent-content-hover`: 같은 surface 대 5.5.
  - `accent-subtle` · chart 4 단계는 지금 공식.
- `resolveThemeSnapshot.ts`:
  - 순서: neutral 토큰 → 명시 색 델타 중 바탕 키 (`base` · `layer-1` · `layer-2` · `elevated` · `neutral-subtle` · `accent-subtle`) 반영 → `accent-subtle` 파생 (명시 없을 때) → accent 탐색 (그 surface 값을 입력) → 나머지 명시 색 델타 (accent 계열 명시는 탐색 결과를 덮음).
  - `tintOf`: 사용자 hex 면 hex 의 명도를 `startL` 로 (사용자 결정 2 결과).
- 단위 (G1): 프리셋 10 × 모드 2 × Tone 5 × 역할 · light 프리셋 `accent` hex = baseline · 명시 `color.base` 테마 · hex 표본 20 · 참조쌍 · `ok: false` 시 `warnings` 1 건.

### Phase 2 — 두 렌더러에 같은 hex · rule 분류 · forced-colors

- `resolveThemeSnapshot.ts`: 모드별 `put()` 으로 `--accent` · `--accent-hover` · `--accent-pressed` · `--fg-on-accent` · `--fg-on-accent-pressed` · `--accent-content` · `--accent-content-hover` 를 Skia 맵과 같은 객체에서. `ThemeCssVar` 에 `color: boolean` (seed · 명시 델타 모두 표시).
- `domView.runtime.ts` `applyCatalogPreviewTheme`: 색 변수 블록을 `@media not (forced-colors: active) { :root { … } [data-theme="dark"] { … } }` 안에, 색 아닌 변수는 지금처럼 media 밖에.
- `colorTokenToCss.ts`: `accent-content` → `var(--accent-content)` · `accent-content-hover` → `var(--accent-content-hover)`.
- `preview-system.css`: `--accent-content: var(--accent)` · `--accent-content-hover` 기본 정의 (runtime 변수가 없을 때), forced-colors 블록에 `--accent-content: LinkText` 계열 추가 (Link 와 같은 시스템 색 — Phase 0 에서 기존 `--link: LinkText` 와 맞춘다). 파일 머리 주석에 「accent 계열 최종 값은 resolver 가 싣는다」 한 줄.
- `componentRulesTable.ts`: §5 분류표대로 `{color.accent}` → `{color.accent-content}` (텍스트 · 비배경 테두리 · track 채움), `{color.accent-hover}` 의 `textHover` → `{color.accent-content-hover}`. 생성 CSS 재생성 (`pnpm build:specs`).
- `packages/rendering/src/primitives/colors.ts`: light · dark seed 에 `accent-content` · `accent-content-hover`, dark `on-accent` 를 결정 1 결과로 (seed 와 resolver 출력이 같게).
- 단위 · 정적 (G2): 모드별 DOM 색 변수 hex = Skia 맵 hex (7 키) · 설치 style 의 색 변수가 전부 media 안 · rule 의 accent 참조가 분류표와 일치 (정적 테스트가 표를 oracle 로) · `accent-content` 자리의 바탕 토큰이 전부 `ACCENT_CONTENT_BACKDROPS` 안 (새 rule 이 새 바탕을 들이면 RED).

### Phase 3 — 같은 계산을 쓰는 Builder 표면

- `resolveAccentLadder` (색 피커 Theme 팔레트) — 사다리에 탐색된 `accent` · `accent-content` 두 칸.
- `MiniThemePreview` · `TintSwatch` — 미리보기가 snapshot 값을 읽는지 확인, 고정 식이면 snapshot 으로.
- `resolveAccentColorTokens` (요소별 accent) — 활성 테마 surface 를 넘겨 `createAccentColorTokens` 를 그대로 탄다.
- 사용자 결정 3 이 「표시」 면 Themes 패널 Accent 절 아래 대비 한 줄 (i18n 키 추가).

### Phase 4 — live · 번들 · 문서

- G3 live (Chrome MCP, 사용자 5173 이 아닌 별도 포트 · 새 탭은 tabId 명시): 프리셋 blue · yellow · green + hex `#FFCC00` · `#1E3A8A` × light · dark — Button accent fill (기본 · hover · pressed) · outline · Link · Badge subtle · Input focus · ProgressBar 를 Canvas = Preview (`/cross-check`) · Publish 1 회 · forced-colors 에뮬레이션 1 회 (accent · subtle · 명시 델타 1 이 시스템 색, 반경은 테마 값) · Tone 5 종 전환.
- G4 번들: before/after initial gzip (Builder · Preview) · `package.json` diff 0 · `resolveThemeSnapshot` 1 회 시간 (값만).
- 문서: CHANGELOG (사용자-가시 — dark accent 글자색 · 바탕 위 accent · 사용자 hex 결과) · ADR README.
- G5 사용자 Builder 확인.

## §3 파일 변경표 (추정)

| 파일                                                                                                                                                  | 변경                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `packages/shared/src/catalog/runtime/accentContrast.ts`                                                                                               | 새 모듈                                         |
| `packages/shared/src/catalog/runtime/tintToSkiaColors.ts`                                                                                             | 역할 둘 탐색 · on-accent 정책 · 사다리          |
| `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts`                                                                                         | 순서 · 시작 명도 · DOM 색 변수 7 · `color` 표시 |
| `packages/shared/src/catalog/runtime/domView.runtime.ts`                                                                                              | 색 변수 forced-colors media                     |
| `packages/shared/src/catalog/resolvers/colorTokenToCss.ts`                                                                                            | 키 2                                            |
| `packages/shared/src/catalog/generated/componentRulesTable.ts`                                                                                        | accent 참조 재분류 (43 곳 중 바탕 위 역할)      |
| `packages/shared/src/components/styles/generated/*.css`                                                                                               | 재생성 결과                                     |
| `packages/shared/src/components/styles/theme/preview-system.css`                                                                                      | `--accent-content` 기본 · forced-colors · 주석  |
| `packages/rendering/src/primitives/colors.ts`                                                                                                         | seed 키 2 · dark on-accent                      |
| `apps/builder/src/builder/panels/themes/MiniThemePreview.tsx` · `ThemesPanel.tsx`                                                                     | 확인 · 결정 3                                   |
| 테스트: `accentContrast.test.ts` (새) · `tintToSkiaColors.test.ts` · `resolveThemeSnapshot.test.ts` · rule 분류 정적 1 (새) · browser forced-colors 1 | RED 6 → GREEN                                   |

추정 ~13 파일 (생성 CSS · 테스트 제외). 실측이 1.5 배를 넘으면 Phase 0 기록에 흡수하고 사후 보고.

## §4 사용자 결정이 닿는 phase

| 결정                    | phase                                                 |
| ----------------------- | ----------------------------------------------------- |
| 1 dark on-accent 글자색 | Phase 1 (on-accent 정책) · Phase 2 (seed)             |
| 2 사용자 hex 시작 명도  | Phase 1 (`tintOf`)                                    |
| 3 대비 표시             | Phase 3                                               |
| 4 브랜드 Tone           | 범위 밖 권고 — 「포함」 이면 Phase 3 뒤 Phase 3b 추가 |

## §5 역할 분류표

(Phase 0 에서 채운다 — 컴포넌트 · 상태 · 칸 · 현재 키 · 역할 · 근거)
