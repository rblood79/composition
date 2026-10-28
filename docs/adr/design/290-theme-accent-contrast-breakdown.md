# ADR-290 breakdown — Theme Accent 목표 대비 명도

> 본문: [ADR-290](../290-theme-accent-contrast-target-lightness.md). 이 문서는 phase · 파일 · 테스트 목록만 둔다. 결정 · 대안 · 위험은 본문이 정본이다.

## §1 전제 lock-in

- 새 ADR 이고 기존 ADR 의 분리 · fork 가 아니다. 선행: ADR-021 (tint · neutral 프리셋) · ADR-110 (theme/tokens root collection) · ADR-227 (`resolveThemeSnapshot` · 테마 컬렉션). 이 ADR 은 그 resolver 의 accent 파생 한 단계만 바꾸고 의존 방향은 그대로 (응용 → base 없음).
- 스키마 변경 0 · 마이그레이션 코드 0.

## §2 Phase

### Phase 0 — 기록 · RED 5 (제품 코드 변경 0)

1. **대조군 기록**: 프리셋 10 × 모드 2 의 현재 Skia accent 계열 (accent · accent-hover · accent-pressed · on-accent) 과 DOM 계산값 (Preview iframe `getComputedStyle`) 을 `.agent/runs/<날짜>-adr290/baseline.json` 에 둔다.
2. **hex 표본 20 고정** (본문 Gates Q1) — 같은 파일에.
3. **override 슬롯 쓰기 지점 전수** (R3): `--color-highlight-background` · `--color-highlight-background-pressed` · `--color-highlight-foreground` · `--color-highlight-foreground-pressed` · `--color-highlight-overlay` · `--color-border-hover` 를 `packages` · `apps` 에서 grep. 쓰는 곳이 resolver 밖에 있으면 목록으로 남긴다.
4. **RED 5** (새 테스트 — 실패해야 정상):
   - a. dark 프리셋 10 의 accent 대 on-accent ≥ 4.5 — 10 실패
   - b. hex `#00A86B` 의 light accent 대 흰 글자 ≥ 4.5 — 실패 (4.42)
   - c. snapshot 의 DOM accent-pressed 값 = Skia `accent-pressed` — 실패 (DOM 변수 없음 → preview-system 50% 식)
   - d. dark on-accent DOM 값이 Tone 과 무관 — 실패 (Tone 마다 neutral-900)
   - e. forced-colors 에서 `--accent-subtle` 이 시스템 색 — 실패 의심 (browser 테스트 또는 live 에뮬레이션)
5. **화면 확인**: c · d 를 `/cross-check` 로 (Button accent pressed · dark 글자). 차이가 안 보이면 본문 G0 대로 범위에서 빼고 사후 보고.

### Phase 1 — 명도 탐색

- 새 `packages/shared/src/catalog/runtime/accentContrast.ts`:
  - `relativeLuminance(hex)` · `contrastRatio(a, b)` (WCAG 2 공식, 참조쌍으로 검산)
  - `solveAccentLightness({ c, h, startL, fg, bg, textMin: 4.5, edgeMin: 3.0 })` → `{ l, ok }` — 시작 명도가 통과하면 그대로, 아니면 두 조건의 통과 구간을 이분 탐색 (≤ 20 회) 해 시작 명도에 가장 가까운 끝값. 구간이 비면 글자 조건만으로 풀고 `ok: false`.
- `tintToSkiaColors.ts` `createAccentColorTokens(c, h, mode, startL?)`: 탐색 결과 명도로 accent, 거기서 hover 85% · pressed 75% 검정 혼합 (현재 공식), on-accent = 사용자 결정 1 결과 (권고 흰색).
- `resolveThemeSnapshot.ts` `tintOf`: 사용자 hex 면 hex 의 명도를 `startL` 로 (사용자 결정 2 결과).
- 단위 (G1): 프리셋 10 × 모드 2 · light 프리셋 hex = baseline · hex 표본 20 · 참조쌍 · `ok: false` 시 `warnings` 1 건.

### Phase 2 — 두 렌더러에 같은 hex

- `resolveThemeSnapshot.ts`: 모드별 `put()` 으로 `--color-highlight-background` · `--color-highlight-background-pressed` · `--color-highlight-foreground` · `--color-highlight-foreground-pressed` 를 Skia 맵과 같은 객체에서. 기존 `--accent-subtle` · `--border-hover` 직접 싣기 (`:203 ~ 206`) → `--color-highlight-overlay` · `--color-border-hover`.
- `preview-system.css`: `--color-highlight-overlay` 슬롯의 값 형태 확인 (현재 식이 `/ 15%` alpha — resolver 가 싣는 `accent-subtle` 은 불투명 hex 라 의미가 같은지 Phase 0 baseline 과 대조). 파일 머리 주석에 「accent 계열 최종 값은 resolver 가 슬롯으로 싣는다」 한 줄.
- `packages/rendering/src/primitives/colors.ts:85`: dark `on-accent` seed 를 결정 1 결과로 (seed 와 resolver 출력이 같게).
- 단위 (G2): 모드별 DOM 슬롯 hex = Skia 맵 hex · `--accent` · `--fg-on-accent` 를 resolver 가 직접 싣지 않음.

### Phase 3 — 같은 계산을 쓰는 Builder 표면

- `resolveAccentLadder` (색 피커 Theme 팔레트) — 사다리의 55% 칸을 탐색 결과로.
- `MiniThemePreview` · `TintSwatch` — 미리보기 accent 가 snapshot 값을 읽는지 확인, 고정 식이면 snapshot 으로.
- `resolveAccentColorTokens` (요소별 accent) — `createAccentColorTokens` 를 그대로 타므로 테스트만 갱신.
- 사용자 결정 3 이 「표시」 면 Themes 패널 Accent 절 아래 대비 한 줄 (i18n 키 추가).

### Phase 4 — live · 번들 · 문서

- G3 live (Chrome MCP, 사용자 5173 이 아닌 별도 포트): 프리셋 blue · yellow · green + hex `#FFCC00` · `#1E3A8A` × light · dark — Button accent 기본 · hover · pressed 를 Canvas = Preview (`/cross-check`) · Publish 1 회 · forced-colors 에뮬레이션 1 회 · Tone 5 종 전환에서 dark 글자 불변.
- G4 번들: before/after initial gzip (Builder · Preview) · `package.json` diff 0 · `resolveThemeSnapshot` 1 회 시간 (값만).
- 문서: CHANGELOG (사용자-가시 — dark accent 글자색 · 사용자 hex 결과) · ADR README · `ssot-hierarchy` 변경 없음.
- G5 사용자 Builder 확인.

## §3 파일 변경표 (추정)

| 파일                                                                                                                          | 변경                                |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `packages/shared/src/catalog/runtime/accentContrast.ts`                                                                       | 새 모듈                             |
| `packages/shared/src/catalog/runtime/tintToSkiaColors.ts`                                                                     | 탐색 사용 · on-accent 정책 · 사다리 |
| `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts`                                                                 | 시작 명도 · DOM 슬롯 6              |
| `packages/shared/src/components/styles/theme/preview-system.css`                                                              | 주석 · (필요 시) dark 슬롯 기본값   |
| `packages/rendering/src/primitives/colors.ts`                                                                                 | dark on-accent seed                 |
| `apps/builder/src/builder/panels/themes/MiniThemePreview.tsx` · `ThemesPanel.tsx`                                             | 확인 · 결정 3                       |
| 테스트: `accentContrast.test.ts` (새) · `tintToSkiaColors.test.ts` · `resolveThemeSnapshot.test.ts` · browser forced-colors 1 | RED 5 → GREEN                       |

추정 ~9 파일 (테스트 포함). 실측이 1.5 배를 넘으면 Phase 0 기록에 흡수하고 사후 보고.

## §4 사용자 결정이 닿는 phase

| 결정                    | phase                                                 |
| ----------------------- | ----------------------------------------------------- |
| 1 dark on-accent 글자색 | Phase 1 (on-accent 정책) · Phase 2 (seed)             |
| 2 사용자 hex 시작 명도  | Phase 1 (`tintOf`)                                    |
| 3 대비 표시             | Phase 3                                               |
| 4 브랜드 Tone           | 범위 밖 권고 — 「포함」 이면 Phase 3 뒤 Phase 3b 추가 |
