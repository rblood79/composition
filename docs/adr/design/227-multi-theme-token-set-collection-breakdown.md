# ADR-227 구현 설계: 다중 테마 — 문서 소유 토큰 세트 컬렉션

정본: [ADR-227](../227-multi-theme-token-set-collection.md)

작성일: 2026-09-20. 코드 사실은 이 날짜의 main (`81d96353f`) 실측이다 — 착수 시 Phase 0 에서 재실측한다.

## 1. 전제 lock-in

- base / 응용: ADR-110 (canonical `themes`/`tokens` 필드 · adapter) 과 ADR-143 (`tokens` 델타 저장 · `design_themes` store 폐기) 이 base 이고, 이 ADR 은 그 필드의 **모양** (단일 프리셋 → 이름 있는 토큰 세트 컬렉션) 과 **소유 축** (border 폭 · shadow 를 테마로) 을 더하는 응용이다. catalog rule (ADR-142/912) 의 TokenRef 참조 구조는 바꾸지 않는다.
- schema: `CompositionDocument.themes` 의 타입이 바뀐다 (단일 `ThemeSnapshot` → `ThemesCollection`). `tokens` 필드는 그대로 두되 의미가 "활성 테마의 델타" 에서 "테마 무관 사용자 정의 토큰" 으로 좁아진다 (§3). 1회 hydration migration.
- 의존 방향: 110/143 → 227 한 방향. 227 이 `resolveCanonicalToken` · `themesAdapter` · `themeConfigStore` 를 **확장**하고 새 SSOT 를 만들지 않는다 — 정본은 여전히 canonical document 다.
- fork 아님: 사용자 요구 (2026-09-20 "여러 theme 를 가질 수 있어야 한다 · Components 페이지에서 기본 요소가 theme 따라 보인다") 의 실행 ADR. 요소/페이지 스코프 테마 (대안 C) 는 이 ADR 에서 **유보** — 별도 ADR 이 아니라 재개 조건만 둔다 (Decision 3). "기본 요소" 의 전집화는 [ADR-228](228-palette-wide-reusable-origins-breakdown.md) — 직교, 2026-09-21 사용자 정정으로 초안 Phase 5 (catalog read-only 섹션) 철회.
- sub-phase 분할 없음 (Phase 0~5, Phase 5 는 검증만). 리뷰 수리로 누락된 generator·layout·migration·history 소비자를 §5에 포함했다. 과거 22/25파일 추정은 폐기하고 Phase 0에서 실제 경로를 중복 제거해 확정한다.

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

## 3. 스키마 · migration · resolve 계약

2026-09-21 리뷰 수리 기준 HEAD `a7c85b70f`. §2는 최초 조사 기록이며 아래 소비 경로 보완과 함께 Phase 0에서 재확인한다.

### 3.1 저장 모양

```ts
export interface ThemeDefinition {
  id: string;
  name: string;
  preset: Omit<ThemeSnapshot, "customTokens">; // 매 resolve 때 seed 생성 입력
  tokens: TokensSnapshot; // seed(preset)와 다른 명시 값만
}
export interface ThemesCollection {
  active: string;
  items: Record<string, ThemeDefinition>;
  order: string[];
}
// CompositionDocument.themes?: ThemesCollection
// CompositionDocument.tokens?: TokensSnapshot // 테마 무관 user-defined만
```

preset은 최초 생성 후 버리는 값이 아니라 델타를 복원하는 seed 생성 입력이다. 전환마다 새 seed에서 시작하므로 A에만 있던 override가 B에 남으면 안 된다. id는 기존 프로젝트의 ID 생성기를 재사용하고, active/items/order 참조 무결성을 hydration에서 검사한다.

소유 축은 color/typography/radius/border.width/shadow/focus다. size/spacing은 density 축으로 유보한다. 기존 `TokensSnapshotEntry.value`의 scalar 모양을 유지한다. shadow는 CSS shadow 문자열, focus는 color 및 폭/offset scalar로 표현한다. 합성 `{focus.ring.default|inset}`는 이 scalar를 읽는 recipe이며 객체를 TokensSnapshot에 저장하지 않는다.

### 3.2 최초 migration과 기존 실효값 보존 (H3)

순수 함수의 입력은 `migrateThemesField(doc, { legacyConfig, legacyWriteThrough, source })`다. caller가 **같은 projectId**의 기존 localStorage를 읽어 전달한다. source는 local-project/import를 구분하며 import에는 이 기기의 legacyConfig를 섞지 않는다.

| 입력 상태                                                | 최초 실효값 선택                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 유효한 ThemesCollection                                  | 문서만 사용. localStorage 및 구 flag 무시                                                                                         |
| 구 문서 + legacy write-through off                       | 유효한 프로젝트별 legacy 필드 → DEFAULT_THEME_SELECTION. 구 document.themes는 현행에서 적용되지 않으므로 stale 값으로 덮지 않는다 |
| 구 문서 + legacy write-through on + 유효한 ThemeSnapshot | 구 document.themes 4필드 우선. baseTypography는 legacy → DEFAULT_BASE_TYPOGRAPHY                                                  |
| 구 문서 + legacy write-through on + themes 부재/무효     | legacy 필드 → 기본값                                                                                                              |
| 외부 import, legacy 입력 없음                            | 유효한 구 document.themes → 기본값                                                                                                |

`legacyWriteThrough`는 제거 전 기존 부팅 정책의 입력이다. old default-off 세션에서 실제로 보이던 값이 우선이며, 최초 이관 뒤에는 flag를 사용하지 않는다. 없는 필드마다 fallback하고 유효하지 않은 값은 보고한다.

- 기존 spec-token 델타를 Default 테마 tokens로 옮기고 user-defined는 root에 남긴다. legacy baseTypography는 `typography.base-font-family`(string), `typography.base-font-size`(px number), `typography.base-line-height`(unitless number)의 seed 대비 델타로 승계한다. 같은 키의 구 명시 델타는 보존하고 충돌 사례를 fixture로 고정한다.
- 유효한 구 `customTokens`가 발견되면 알려진 키는 델타로 정규화한다. 미지원 값은 조용히 버리지 않고 보존 또는 명시 migration 오류로 남긴다. Phase 0에서 실제 저장 fixture 여부를 조사한다.
- canonical 문서를 DB에 **성공적으로 저장한 뒤** 컬렉션 모양 자체를 migration 완료 표식으로 삼는다. 실패 시 완료 처리 및 legacy 축소 금지, 기존 설정으로 재시도 가능해야 한다.
- 저장 성공 이후 localStorage는 projectId별 활성 id 캐시만 담는다. 새 컬렉션 로드는 항상 문서 우선이다. migration은 History를 만들지 않는다.
- BC 범위: 구 문서 100%에 themes 타입 검사, themes 컬렉션화와 tokens 분할이 필요하다. 로컬 실효값·import 출처별 fixture 수를 Phase 0에서 집계한다. rollback은 사전 문서와 legacy 설정 백업 복원으로 정의한다. 새 다중 테마를 preset 4값으로 줄이는 역변환은 손실이 있어 무손실 rollback으로 부르지 않는다.

### 3.3 production 소비 계약 (H1)

`resolveCanonicalToken`은 현재 production renderer 호출자가 없다. 이 함수만 바꾸는 것으로 완료하지 않는다. 문서에서 파생한 활성 snapshot을 원자적으로 설치하고 기존 production `resolveToken` 및 각 geometry/focus 소비자가 **같은 snapshot**을 읽도록 연결한다. 파생 snapshot은 쓰기 정본이 아니다.

| 축           | 값·단위                                                                   | Skia/레이아웃 소비                                              | DOM/Publish 소비                                                                         |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| color        | 유효한 CSS 색, Skia는 동일 색으로 정규화                                  | `resolveToken` color 및 paint                                   | 기존 의미 매핑: accent → `--accent`, neutral → `--fg`, layer-1 → `--bg-overlay`          |
| typography   | text 크기/line-height px, base-line-height만 unitless, font-family string | typography resolver + text 측정/캐시 + 기존 baseTypography 경로 | `--text-*`/line-height 변수 및 기존 body font-family/font-size/line-height 적용          |
| radius       | 유한한 비음수 px                                                          | radius resolver + shape/layout                                  | `--radius-*`, px 직렬화                                                                  |
| border.width | 유한한 비음수 px                                                          | border resolver + implicitStyles/크기 산식 + paint              | `--border-width-none                                                                     | thin | thick`, px 직렬화 |
| shadow       | CSS shadow 문자열                                                         | theme별 shadow resolver + 기존 shadow parser/paint              | `--shadow-*`                                                                             |
| focus        | color + width px + offset px(음수 허용)                                   | ring recipe 및 focus paint                                      | `--focus-ring`, `--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-inset-offset` |

CSS 매핑은 `tokenResolver.ts::tokenToCSSVar`와 `colorTokenToCss.ts`의 실제 이름을 공유/대조한다. 미등록 키를 임의 변수명으로 emit하지 않는다. `toReactStyle`은 base CSS 생성기가 아닌 override 전용이므로 base 배선은 CSSGenerator와 generated CSS를 통해 검증한다. shared/specs 의존 방향을 지키고 공유 순수 해석·CSS helper는 하위 패키지에 둔다.

해석 순서: preset seed → root user-defined fallback → 활성 테마 명시 델타 → **미명시 파생 키** 계산. 명시 hover/pressed 값은 파생보다 우선한다. accent만 편집하면 hover=85% black mix, pressed=75% black mix 등 기존 파생 규칙을 같은 함수로 계산한다. default light/dark preset 파생 후 명시 델타를 적용하며, 별도 dark 델타 세트는 만들지 않는다.

현재 hover/pressed CSS는 `color-mix(...)` 표현식을 직접 쓴다. 명시 파생 키 편집을 지원하도록 generator와 inline color mapper를 `var(--accent-hover, color-mix(...))` 같은 override 슬롯으로 연결한다. 기존 기본 시각은 유지하며 사용자가 입력한 파생값은 두 leg에서 우선한다. delta 삭제·테마 변경 시 이전 슬롯을 제거/교체한다.

한 번의 commit은 snapshot 설치 → typography/layout/paint 캐시 무효화 → themeVersion 및 notifyLayoutChange 각 1회 → Preview 동기화 순서다. **노드별 snapshot 생성은 없지만 필요한 노드 재해석·재레이아웃은 허용**하며 총비용을 측정한다. Preview ready/reload에 최신 snapshot을 재전송하고 이전 테마 CSS를 완전히 교체한다. Publish 초기 로드도 동일 helper·snapshot을 사용한다.

### 3.4 border 참조화의 전체 경로 (H2)

현행 `spec.types.ts:997`는 number, `CSSGenerator.ts:777-785,1003-1004`는 무조건 px, `tokenResolver.ts:35-55`는 border 미지원이다. layout `implicitStyles.ts:443`와 `utils.ts:3333,3528`도 숫자만 읽는다.

- spec/catalog size 타입에 number 또는 BorderWidthTokenRef를 허용한다. token.types의 category/StrictTokenRef/validation과 border seed(0/1/2)를 함께 확장한다.
- CSSGenerator의 border shorthand와 border-width 모든 채널을 number→px, TokenRef→CSS var로 분기한다. `{border.width.thin}px` 출력은 금지한다.
- `resolveToken`, `toSkiaStyle`, implicitStyles, size별 contentHeight 산식 등 모든 소비자는 계산 전에 같은 활성 snapshot에서 px를 구한다. 비숫자→1 fallback으로 새 토큰을 숨기지 않는다.
- Phase 0에서 숫자 43곳뿐 아니라 문자열 "1px", shorthand, 조건부 border 채널도 목록화한다. 동등한 폭은 같은 토큰으로 연결하고 의도적 예외는 위치·사유를 gate에 명시한다. 임의 rule 시각 재설계는 하지 않는다.
- G3은 seed 상태의 변경 전후 Δ0에 더해 thin=3, thick=4에서 paint/외곽/content box를 대조한다. 생성 CSS parse 및 border 토큰 resolve를 검사한다.

## 4. Phase 별 작업

### Phase 0 — inventory freeze

- F1~F12 및 §3 소비 경로 재실측. production resolveToken·CSS mapper·focus·text 측정·layout·publish caller, 구 설정 출처와 fixture 수를 기록한다.
- border 숫자/문자열/shorthand inventory와 변경 파일 집합을 중복 제거해 확정한다. 추정 대비 증가 시 같은 ADR의 inventory를 보강한다.
- **G0**: caller 배선 표·migration 행렬·sweep/예외 목록·변경 파일 수 확정. 미연결 소비자 0.

### Phase 1 — 스키마 · migration · adapter

- §3.1~3.2 구현. BuilderCore에서 legacy 입력을 캡처하고 저장 성공 후 기본 write-through로 전환한다.
- themesAdapter/variablesAdapter는 snapshot의 활성 항목을 다루고 persist는 기존 canonical 저장 경로를 사용한다.
- 추가/삭제/이름 변경/활성 전환/토큰 편집은 runCanonicalMutation 및 history event/replay에 연결한다. snapshot 재생도 동일 적용 경로를 쓴다.
- **G1**: migration 표 모든 경우 + 비기본 typography + doc/legacy 충돌 + 저장 실패/재시도 + reload 멱등 + 백업 복원. 기존 실효 시각 Δ0, 미편집 테마 tokens={}.

### Phase 2 — 카테고리별 resolve · DOM/Publish 배선

- §3.3의 snapshot, token mapping, 파생값 우선순위, 이전 델타 제거, Preview ready 및 publish 초기 적용을 구현한다.
- **G2**: 전수 Default/사용자 테마 + color/typography/radius/shadow/focus 각각의 비기본값 및 reset, light/dark, 명시 hover/pressed 우선순위. Skia/Preview/Publish 결과를 ADR-198 실제 브라우저 oracle로 대조한다. border 편집 검증은 Phase 3 G3에서 수행한다.

### Phase 3 — border 전체 소비자 확장과 sweep

- §3.4 타입·seed·validator·CSSGenerator·paint·implicit layout·size 산식을 먼저 연결하고 rule을 참조화한다.
- **G3**: 숫자 리터럴 0 ratchet(확정 예외는 별도 명시) + 원복 RED + 유효 CSS + seed 전후 Δ0 + thin=3/thick=4 외곽/content box 일치. G2 회귀 확인.

### Phase 4 — Themes 패널과 사용자 History

- 목록/복제/이름/삭제/활성 + color·typography·radius·border·shadow·focus 편집, 프리셋 채우기 및 reset. 마지막 테마 삭제 금지.
- 28/32 두 티어, `1fr 1fr 28px`, i18n ko/en. 쓰기는 runCanonicalMutation.
- **G4**: live 생성→전환→편집→reset→reload→Undo/Redo. Canvas·Preview·Properties 반영, 사용자 전환 History entry 1건. 600요소 총 전환 프레임 ≤25ms.

### Phase 5 — Components 페이지의 테마 표면

- 신규 UI 없이 origin/instance/slot을 검증한다. 228 전에는 기존 reusable 5 + template origin, 228 뒤에는 그 확정 eligible 집합으로 G5 재실행.
- **G5**: 전환으로 canonical children 구조 무변화, 사용자 전환 entry 1건, 파생 렌더/페이지 처리의 **추가 entry 0건**. 같은 테마 재선택은 no-op 0건. Undo/Redo 후 올바른 테마 복귀, 600요소 총 전환 프레임 ≤25ms.

## 5. 파일 경계 (리뷰 보강 — Phase 0에서 실제 경로/수 확정)

| 영역              | 포함할 경로·책임                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| schema/migration  | shared composition-document types, themesAdapter/variablesAdapter/index, BuilderCore, legacy 설정 read 및 DB 저장 성공 처리, migration fixture |
| 토큰 runtime      | specs token.types/spec.types, primitives border/focus/typography/radius/shadows, tokenResolver, 공통 snapshot/해석/CSS helper                  |
| Skia/layout       | toSkiaStyle, implicitStyles, engines/utils size 산식, text 측정 및 캐시 invalidation, focus/shadow paint                                       |
| DOM               | CSSGenerator, colorTokenToCss, 생성 CSS 명령, 기존 baseTypography 적용, useThemeMessenger와 수신/ready 경로                                    |
| canonical/history | themeConfigStore, mutation action, canonicalHistoryEvents, historyActions replay, persist 연결                                                 |
| UI/publish        | ThemesPanel/ThemeList/TokenEditor, ko/en, publish App 및 theme 적용                                                                            |
| 검증              | category resolve·CSS·layout·migration·history 인접 테스트, literal ratchet, ADR-198 및 live/perf 하니스                                        |

초기 22/25파일 추정은 위 누락 경계를 포함하지 못했다. 확정 수는 G0 산출물이며 이전 숫자를 승인 상한처럼 재사용하지 않는다. 생성물은 직접 편집하지 않고 source 변경 뒤 재생성한다.

## 6. 유보 항목

- 요소/페이지 스코프: 사용자 요구 시 재개. 노드별 scope resolve 및 frame 비용을 별도로 검증한다.
- size/spacing density: 이번 color/typography/radius/border/shadow/focus 변경과 분리한다.
- 테마별 light/dark 이중 델타: 유보. darkMode는 현재 테마 preset 안의 값이며 같은 명시 델타를 양 모드에 적용한다.

## 7. 리뷰 수리 상태

2026-09-21: round 1 H1/H2/H3/M4를 §3~~5와 본문 Gates에 반영했다. 이는 설계 수리이며 구현 G0~~G5는 UNVERIFIED, Proposed 유지.
