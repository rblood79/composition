# ADR-227 구현 설계: 다중 테마 — 문서 소유 토큰 세트 컬렉션

정본: [ADR-227](../227-multi-theme-token-set-collection.md)

작성일: 2026-09-20. 코드 사실은 이 날짜의 main (`81d96353f`) 실측이다 — 착수 시 Phase 0 에서 재실측한다.

## 1. 전제 lock-in

- base / 응용: ADR-110 (canonical `themes`/`tokens` 필드 · adapter) 과 ADR-143 (`tokens` 델타 저장 · `design_themes` store 폐기) 이 base 이고, 이 ADR 은 그 필드의 **모양** (단일 프리셋 → 이름 있는 토큰 세트 컬렉션) 과 **소유 축** (border 폭 · shadow 를 테마로) 을 더하는 응용이다. catalog rule (ADR-142/912) 의 TokenRef 참조 구조는 바꾸지 않는다.
- schema: `CompositionDocument.themes` 의 타입이 바뀐다 (단일 `ThemeSnapshot` → `ThemesCollection`). `tokens` 필드는 그대로 두되 의미가 "활성 테마의 델타" 에서 "테마 무관 사용자 정의 토큰" 으로 좁아진다 (§3). 1회 hydration migration.
- 의존 방향: 110/143 → 227 한 방향. 227 이 `resolveCanonicalToken` · `themesAdapter` · `themeConfigStore` 를 **확장**하고 새 SSOT 를 만들지 않는다 — 정본은 여전히 canonical document 다.
- fork 아님: 사용자 요구 (2026-09-20 "여러 theme 를 가질 수 있어야 한다 · Components 페이지에서 기본 요소가 theme 따라 보인다") 의 실행 ADR. 요소/페이지 스코프 테마 (대안 C) 는 이 ADR 에서 **유보** — 별도 ADR 이 아니라 재개 조건만 둔다 (Decision 3). "기본 요소" 의 전집화는 [ADR-228](228-palette-wide-reusable-origins-breakdown.md) — 직교, 2026-09-21 사용자 정정으로 초안 Phase 5 (catalog read-only 섹션) 철회.
- sub-phase 분할 없음 (Phase 5 개 — Phase 5 는 검증만, 파일 ≤ 22 — Phase 0 에서 재집계, 1.5× 초과 시 M3 절차로 inventory 보강).

## 2. Phase 0 코드 사실 표 (2026-09-20 실측, `81d96353f`)

| #   | 사실                                                                                                                                                                                                                                                                                                        | 경로:라인                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| F1  | `ThemeSnapshot` 은 단일 객체 — `tint · darkMode · neutral · radiusScale` + `customTokens?` ("향후 확장" 주석). 이름 · id · 목록 없음                                                                                                                                                                        | `packages/shared/src/types/composition-document.types.ts:61-73`                                                   |
| F2  | `TokensSnapshotEntry { type, value, source: "spec-token" \| "user-defined" }` · `TokensSnapshot = Record<string, Entry>`. 문서에는 seed 와 다른 **델타만** 저장 (`buildTokensDelta` / `mergeTokensSnapshot`)                                                                                                | 같은 파일 `:85-101` · `apps/builder/src/adapters/canonical/variablesAdapter.ts:205-240`                           |
| F3  | `resolveCanonicalToken(ref, doc)` = `doc.tokens?.[key]?.value` — 테마 개념 없음, 문서 1 : 값 1                                                                                                                                                                                                              | `variablesAdapter.ts:186-198`                                                                                     |
| F4  | 런타임 테마 = `themeConfigStore` 전역 싱글턴 (`tint · darkMode · neutral · radiusScale · baseTypography` + `themeVersion`). `setTint` → `tintToSkiaColors` (lightColors/darkColors mutation) → `themeVersion+1` → `notifyLayoutChange` → localStorage persist                                               | `apps/builder/src/stores/themeConfigStore.ts:41-47 · 132-138 · 168-200`                                           |
| F5  | 문서 ↔ store 는 `themesAdapter` (`snapshotThemesFromConfig` call-time 직렬화 · `applyCanonicalThemes` DI) 이고, 로드 시 적용은 **env flag `VITE_ADR110_P2_THEMES_WRITE_THROUGH === "true"` 뒤에 있다** — 기본 off 면 정본은 사실상 localStorage                                                             | `apps/builder/src/adapters/canonical/themesAdapter.ts:1-60` · `builder/main/BuilderCore.tsx:640-661`              |
| F6  | catalog rule 은 hex 리터럴 0 · TokenRef 2,333 (`{color.*}` 1,319 · `{typography.*}` 523 · `{radius.*}` 429 · `{focus.*}` 38 · `{spacing.*}` 17 · `{shadow.*}` 7). 색 이름 상위: transparent 224 · neutral 206 · base 134 · neutral-subtle 75 · accent 60 · border 56 · layer-2 52 · layer-1 49              | `packages/shared/src/catalog/generated/componentRulesTable.ts` (grep 집계)                                        |
| F7  | rule 의 숫자 리터럴: `height` 418 · `gap` 189 · `paddingX` 182 · `paddingY` 112 · `iconSize` 110 · **`borderWidth` 43 (0:3 · 1:37 · 2:3)**                                                                                                                                                                  | 같은 파일 (grep 집계)                                                                                             |
| F8  | DOM leg 의 tint 는 CSS 변수 한 줄 `--tint: var(--blue)` (oklch 프리셋 12) + `[data-accent="red"]` **요소 단위 accent override** (Radix 패턴) 가 이미 있다. Skia 는 `data-accent` 를 읽지 않는다 (소비처 = `LayoutRenderers.tsx` renderCard · `Card.binding.ts:84`)                                          | `packages/shared/src/components/styles/theme/preview-system.css:7-45` · `LayoutRenderers.tsx`                     |
| F9  | Publish 는 `applyThemeConfig({tint, neutral, radiusScale})` 로 `--tint` · `--color-neutral-N` alias · radius 를 `<style>` 로 주입 — `document.themes` 를 읽는 유일한 산출물 소비처. neutral 자기 참조 순환 함정 (ADR-193 P2 실측) 기록됨                                                                    | `apps/publish/src/App.tsx:188-215`                                                                                |
| F10 | Themes 패널 = tint 12 · dark · neutral · radius 5 · typography 프리셋 선택 (401 줄). 토큰 값 편집 UI 0 · 테마 목록 0. IndexedDB `design_themes` / ThemeStudio (`themeStore` · `TokenService` · `ThemeService`) 는 ADR-143 P4 (DB_VERSION 19) 에서 dead 로 폐기                                              | `apps/builder/src/builder/panels/themes/ThemesPanel.tsx:239-260` · `lib/db/indexedDB/adapter.ts:253-258`          |
| F11 | Skia 색 정본은 `@composition/specs` 의 `lightColors` / `darkColors` (ResolvedTokenMap) — `tintToSkiaColors` 가 프리셋 oklch → hex 로 **파생** (color-mix black 정합 함수 포함). 사용자가 hex 를 직접 주면 파생 규칙 (hover/pressed 단계 · dark 반전) 을 같이 정해야 한다                                    | `apps/builder/src/utils/theme/tintToSkiaColors.ts:1-60`                                                           |
| F12 | Components 페이지 = 시스템 페이지 `page-components` (`pageRole:"components"`) — 템플릿 origin (ListBoxItem 등, `ensureTemplateOrigins` 시드) + 사용자 reusable origin + 그 instance/slot 저작 자리. 팔레트 66 중 reusable origin 은 5 (Toolbar · Form · IconButton · InlineAlert · Card) — 전집화는 ADR-228 | `apps/builder/src/builder/pages/systemComponentsPage.ts` · `builder/components/reusableCompositeOrigins.ts:40-50` |

## 3. 스키마 (Phase 1)

```ts
// packages/shared/src/types/composition-document.types.ts
export interface ThemeDefinition {
  id: string; // nanoid — 노드 id 와 같은 생성기
  name: string; // 사용자 표시명 ("Default" · "Dark Brand" …)
  preset: ThemeSnapshot; // 현행 4 값 + customTokens 제거 — 생성 시 seed 채움용으로 강등
  tokens: TokensSnapshot; // 이 테마의 델타 (seed(preset) 와 다른 값만) — F2 규칙 그대로
}
export interface ThemesCollection {
  active: string; // ThemeDefinition.id
  items: Record<string, ThemeDefinition>;
  order: string[]; // 패널 표시 순서 (children[] 와 같은 배열 순서 SSOT 관례)
}
// CompositionDocument.themes?: ThemesCollection   (구 ThemeSnapshot 은 hydration 에서만 읽는다)
// CompositionDocument.tokens?: TokensSnapshot     (테마 무관 user-defined 만 — spec-token 델타는 테마로 이동)
```

- 테마 소유 축 = `color.*` · `typography.*` · `radius.*` · `border.width.*` (신설) · `shadow.*` · `focus.*`. **`size` / `spacing` 은 밀도 (density) 축이라 이 ADR 밖** (Decision 3 유보 — Spectrum 의 density 는 theme 가 아니라 별도 축이다).
- 마이그레이션 (1회, hydration): `themes` 가 `tint` 키를 가진 단일 객체면 → `{ active: id0, items: { id0: { name: "Default", preset: 구값, tokens: doc.tokens 의 spec-token 델타 } }, order: [id0] }` · `doc.tokens` 는 user-defined 만 남긴다. `themes` 부재 → `DEFAULT_THEME_SELECTION` 으로 같은 모양. round-trip 테스트: 구 fixture → migrate → serialize → 다시 로드 = 동일.
- BC 수식화: 기존 문서 100% 가 대상 · 재직렬화 = 문서당 필드 1개 (`themes`) + `tokens` 분할. fixture 재직렬화 대상은 Phase 0 에서 `grep -l '"themes"' fixtures` 로 집계.

## 4. Phase 별 작업

### Phase 0 — inventory freeze

- F1~F12 재실측 + fixture `themes` 보유 수 집계 + `resolveCanonicalToken` / `resolveToken` 호출처 전수 (grep) → 표 확정.
- 리터럴 → TokenRef sweep 대상 확정: `borderWidth` 43 → `{border.width.none|thin|thick}` (0/1/2). shadow 7 은 이미 TokenRef.
- **G0**: 표 · 호출처 · sweep 목록이 breakdown 과 일치. 1.5× 초과 시 inventory 보강 commit (M3).

### Phase 1 — 스키마 · migration · adapter (Decision 1)

- `composition-document.types.ts`: §3 타입. `ThemeSnapshot` 은 export 유지 (preset 타입으로).
- `themesAdapter.ts`: `migrateThemesField(doc)` (순수) · `snapshotThemesFromConfig` → 활성 테마 항목만 갱신 · `applyCanonicalThemes` → 활성 테마의 preset + tokens 를 store 에 적용. **env flag 제거 — write-through 가 기본** (F5 의 "정본 = localStorage" 상태 종료). localStorage 는 "마지막으로 연 프로젝트의 활성 테마 id" 캐시로만.
- `variablesAdapter.ts`: `resolveCanonicalToken(ref, doc)` → `doc.themes.items[active].tokens[key] ?? doc.tokens[key] ?? seed`. 호출 시그니처 무변경 (doc 안에서 active 를 찾는다).
- persist: `persistActiveCanonicalDocument` 경로 그대로 (필드 추가뿐). History: 테마 추가/삭제/활성 전환/토큰 편집 4 종을 `canonicalHistoryEvents` 에 등록 (ADR-185 coverage 계약).
- **G1**: fixture round-trip 100% · 구 문서 로드 시 시각 변화 0 (활성 테마 = 구 프리셋).

### Phase 2 — 두 leg resolve 통합 (Decision 2)

- Skia: `tintToSkiaColors` / `neutralToSkiaColors` 를 "프리셋 → ResolvedTokenMap" 생성기로 두고, 그 위에 활성 테마 `tokens` 델타를 덮는 `applyThemeTokensToSkiaColors(tokens)` 추가. 파생 규칙 (hover/pressed 단계 · dark 반전) 은 **토큰 키 단위** 로 유지 — 사용자가 `color.accent` 만 주면 `accent-hover` 등은 기존 파생 함수가 채운다 (F11).
- DOM (builder Preview + publish): 활성 테마의 델타를 `:root { --color-accent: … }` 로 emit 하는 `themeTokensToCssVars(tokens)` 하나 — `useThemeMessenger` 가 Preview iframe 에 보내고, publish `applyThemeConfig` 가 같은 함수를 쓴다 (F9 의 neutral 자기 참조 함정은 함수 안에서 차단).
- 전환 비용: 활성 전환 = `themeVersion+1` + `notifyLayoutChange` 1회 (현행 setTint 와 같은 경로) — 노드별 재resolve 없음.
- **G2 (대칭)**: 팔레트 전수 × 테마 2개 (Default · 사용자 편집 테마) 에서 Skia 픽셀 vs Preview computed style digest 일치 — ADR-198 하니스 재사용, 색 분류는 보라 먼저 (메모리 함정). border 폭 sweep 후 두 leg 픽셀 Δ 0.

### Phase 3 — rule 리터럴 → TokenRef sweep (border 폭)

- `componentRulesTable.ts` `borderWidth: 0|1|2` 43곳 → `{border.width.none|thin|thick}`. seed 토큰 3개 신설 (`primitives/`). `toSkiaStyle` · `toReactStyle` · CSSGenerator (잔존 spec 3) 가 같은 resolve 를 읽는지 확인.
- ratchet: `componentRulesLiteralRatchet.static.test.ts` — `borderWidth` 숫자 리터럴 0 고정 (ADR-223 cohort ratchet 과 같은 형식).
- **G3**: 원복 RED (리터럴 1곳 되돌리면 ratchet 실패) + 두 leg 픽셀 Δ 0 (G2 재실행).

### Phase 4 — Themes 패널 (Decision 1·2 의 사용자 표면)

- `ThemesPanel.tsx` 재구성: 상단 테마 목록 (활성 표시 · 추가 = 현재 복제 · 이름 변경 · 삭제 — 마지막 1개는 삭제 불가) · 하단 토큰 편집 (color 12 그룹 swatch + hex · typography 프리셋 · radius · border 폭 · shadow). 기존 프리셋 선택 UI 는 "프리셋에서 채우기" 로 유지.
- 규격: 컨트롤 28/32 두 티어 · 행 템플릿 `1fr 1fr 28px` · 9px 금지 · 라벨 i18n ko/en (보호 규칙). 쓰기는 `runCanonicalMutation` 경유 (store 직접 mutate 0).
- **G4**: live — 테마 2개 만들고 전환 시 캔버스 (Skia) · Preview · Properties 색 swatch 가 같은 프레임에 바뀜 · 새로고침 후 활성 테마 유지 · Undo 로 전환 복귀.

### Phase 5 — Components 페이지에서 테마 표면 검증 (Decision 4)

- 신규 UI 0. 테마 표면 = Components 페이지의 origin · instance · slot (ADR-228 이 origin 을 전집으로 채우면 그 전수). 이 Phase 는 그 페이지에서 테마 전환이 "노드를 만들지 않고 전수를 바꾸는지" 만 확인한다.
- 228 미착수 시점이면 현행 origin 5 + 템플릿 origin 으로 측정하고, 228 뒤 재측정 (G5 재실행).
- **G5**: live — Components 페이지 전수가 전환 1회에 바뀜 · canonical `children[]` 길이 · history 길이 무변화 · 600 요소 문서에서 전환 프레임 ≤ 25 ms (perf-baseline frame lane).

## 5. 파일 경계 (추정 — Phase 0 에서 확정)

| 영역        | 파일                                                                                                                              |     수 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- | -----: |
| shared 타입 | `composition-document.types.ts` · `state/` 토큰 seed (`border.width.*`)                                                           |      2 |
| adapters    | `themesAdapter.ts` · `variablesAdapter.ts` · `index.ts` · migration 테스트                                                        |      4 |
| store · 색  | `themeConfigStore.ts` · `tintToSkiaColors.ts` · `neutralToSkiaColors.ts` · `themeTokensToCssVars.ts` (신규) · `useThemeMessenger` |      5 |
| catalog     | `componentRulesTable.ts` (borderWidth 43) · `toSkiaStyle` · `toReactStyle` · ratchet 테스트                                       |      4 |
| publish     | `apps/publish/src/App.tsx`                                                                                                        |      1 |
| 패널        | `ThemesPanel.tsx` · `ThemeList.tsx` (신규) · `TokenEditor.tsx` (신규) · i18n ko/en                                                |      4 |
| 하니스      | `adr227-theme-live.mjs` · G2 digest 스크립트                                                                                      |      2 |
| **합계**    |                                                                                                                                   | **22** |

## 6. 유보 항목 (Decision 3 — 재개 조건)

- **요소/페이지 스코프 테마**: DOM 에는 `[data-accent]` subtree override 가 이미 있으나 Skia 소비처 0 (F8). 재개 조건 = 사용자가 "섹션마다 다른 테마" 를 요구할 때. 그때 `resolveCanonicalToken(ref, doc, scope)` + Skia scene 노드별 팔레트가 필요하고 프레임 예산 재측정.
- **size / spacing 밀도 축**: `height` 418 · `gap` 189 · `paddingX` 182 · `paddingY` 112 리터럴은 테마가 아니라 density 프리셋 (compact / regular / spacious) 의 축. 별도 ADR.
- **테마별 dark 세트**: 현행 `darkMode` 는 테마 안의 값 (light/dark/system) — 한 테마가 light/dark 두 토큰 세트를 갖는 Figma 모드 형은 이 ADR 밖 (테마 2개로 표현 가능).
