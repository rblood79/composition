# ADR-200 구현 상세 — 명령·메뉴 라벨 locale 해소

> 본 문서는 [ADR-200](../200-command-label-locale-resolution.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문이 정본이며 여기에는 phase / 파일 / 게이트만 둔다.

## 1. 분류 lock-in (fork 4 질문)

1. **base / 응용 분류**: ADR-199 는 **표면 노출 축** (항목·순서·가용성) 의 base, 본 ADR 은 **라벨 문자열의 locale 해소** 라는 직교 축의 base 다. 199 의 노출 판정을 바꾸지 않고 라벨 채널만 교체하므로 199 의 응용이 아니라 인접 base.
2. **schema 직교성**: 199 의 `ComponentSemanticsActionDescriptor` 는 `surfaces` / `isAvailable` / `icon` (노출) 과 `label` (문자열) 을 같이 들고 있다. 본 ADR 은 그중 `label` 한 필드만 `labelKey` 로 바꾼다 — 노출 3 필드는 불변.
3. **선행 ADR 전제 reverse 검증**: 199 는 "라벨의 정의 지점이 1개" 를 달성했지만 **그 1개가 locale 을 읽지 않는다** 는 것은 199 의 scope 밖이었다 (199 는 `formatBilingualLabel` 을 표면 어법으로 명시 채택). 의존 방향 반전 아님 — 199 위에 얹는다.
4. **사용자 confirm**: 2026-08-30 세션에서 조사 결과 보고 후 사용자가 "(a) 렌더 시점 번역 으로 신규 ADR 생성" 으로 명시 지시. 대안 선택과 ADR 분리 모두 사용자 결정.

## 2. Phase 0 — 인벤토리 freeze

측정 시점 2026-08-30, 대상 `apps/builder/src`.

### 2-1. 라벨 채널 4개 (같은 것을 4곳이 따로 정의)

| #    | 채널                                                |            정의 수 | 소비 표면                                                                | locale 반응                                               | 근거                                                                                                                                                                                             |
| ---- | --------------------------------------------------- | -----------------: | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `SHORTCUT_DEFINITIONS[id].description` + `.i18n.ko` |                 72 | 명령 팔레트 · ShortcutTooltip · ActionTooltip                            | ❌ `i18n?.ko \|\| description` — locale 무관 항상 ko 우선 | `builder/config/keyboardShortcuts.ts:49`, `builder/components/overlay/CommandPalette.tsx:260`, `builder/components/overlay/ShortcutTooltip.tsx:79`, `builder/components/ui/ActionTooltip.tsx:64` |
| 2    | 컨텍스트 메뉴 병기 리터럴                           |                 16 | 메뉴 3 표면 (`canvas-element` / `canvas-empty` / `layer-item`) + 액션 바 | ❌ 항상 `한국어 / English` 병기                           | `builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts:141,148,155,162,259,271,278,302,314,329,411,433,441,472,473,483`                                                             |
| 3    | 정렬·분배 설명                                      |                  8 | 정렬 서브메뉴                                                            | ❌ 한국어 단독                                            | `builder/stores/utils/elementAlignment.ts:245-256`, `builder/stores/utils/elementDistribution.ts:284-291`                                                                                        |
| 4    | `COMPONENT_SEMANTICS_ACTIONS[].label` → `{en, ko}`  |                  4 | 메뉴 (병기) · 속성 패널 (`.en`) · 액션 바 (병기 상속)                    | ❌ 표면마다 고정 선택                                     | `builder/config/componentSemanticsActions.ts:123,132,142,156,192`                                                                                                                                |
| SSOT | `localizedStrings` (`translations.ts`)              | ko 문자열 leaf 402 | `useI18n().t` 소비 파일 56                                               | ✅ `@react-aria/i18n` formatter                           | `i18n/translations.ts:1331`, `i18n/I18nProvider.tsx:96`                                                                                                                                          |

`contextMenu` 라는 문자열은 `translations.ts` / `types.ts` 에 **0회** 등장 — 메뉴용 키가 애초에 없다.

### 2-2. 신설 키 (총 101)

| 키 묶음             |  수 | 내역                                                                               |
| ------------------- | --: | ---------------------------------------------------------------------------------- |
| `contextMenu.*`     |  25 | 항목 라벨 16 + 정렬 6 + 분배 2 + 메뉴 `aria-label` 1 (`ContextMenuOverlay.tsx:78`) |
| `command.*`         |  72 | `SHORTCUT_DEFINITIONS` 전 항목 (`description` → en, `i18n.ko` → ko)                |
| `commandPalette.*`  |  16 | 카테고리 8 (`CommandPalette.tsx:85-92`) + scope 힌트 8 (`:97-104`)                 |
| `componentAction.*` |   4 | ADR-199 레지스트리 4액션                                                           |

### 2-3. 표면 4개 (같은 라벨을 그리는 곳)

`ContextMenuOverlay.tsx:120,152` (메뉴 · 서브메뉴) · `ContextualActionBar.tsx:72,83,96,128,140,145` (바 · 오버플로 메뉴) · `ComponentSemanticsSection.tsx` (속성 패널) · `CommandPalette.tsx:260` (팔레트).

## 3. Phase 분해

| Phase | 내용                                                                                                |  risk   | Gate      |
| ----: | --------------------------------------------------------------------------------------------------- | :-----: | --------- |
|     0 | 인벤토리 freeze (§2) + 정적 게이트 3종 RED 작성                                                     |   LOW   | G1~G3 RED |
|     1 | 카탈로그: `TranslationKeys` 확장 + ko/en `contextMenu.*` 25 추가                                    |   LOW   | G1        |
|     2 | 메뉴 스키마 + 표시 계층: `label` → `labelKey`, provider 24 전환, Overlay/ActionBar 가 `t()` 로 해소 | **MED** | G1·G2·G4  |
|     3 | 명령 라벨: `command.*` 72 + `commandPalette.*` 16, `ShortcutDefinition.i18n` 제거, 소비 3곳 전환    | **MED** | G3·G4     |
|     4 | ADR-199 레지스트리: `label(): {en,ko}` → `labelKey`, 3 표면 어법 재적용, 199 게이트 재정렬          |   MED   | G4        |
|     5 | 게이트 전수 GREEN + Live Exercise + closure 5단계                                                   |   LOW   | G1~G5     |

Phase 2 는 타입 변경과 표시 계층 전환이 같은 커밋이어야 type-check 가 성립하므로 분리하지 않는다.

## 4. 파일 변경표

### 신규 (4)

| 파일                                                                                      | 용도                                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `docs/adr/evidence/200-label-channel-inventory.md`                                        | Phase 0 freeze 사본                                                          |
| `apps/builder/src/i18n/labelKeyCatalog.static.test.ts`                                    | G1 — 코드가 쓰는 라벨 키 전수가 ko/en 양쪽 카탈로그에 존재                   |
| `apps/builder/src/builder/workspace/canvas/contextMenu/noBilingualLiteral.static.test.ts` | G2 — provider 에 `한글 / English` 병기 리터럴 0                              |
| `apps/builder/src/builder/config/commandLabelLocale.static.test.ts`                       | G3 — `i18n?.ko \|\| description` 패턴 0, `ShortcutDefinition.i18n` 필드 부재 |

### 수정 (14)

| 파일                                                                 | 변경                                                                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `i18n/types.ts`                                                      | `TranslationKeys` 에 `contextMenu` / `command` / `commandPalette` / `componentAction` 블록, `ShortcutDefinition.i18n` 은 `types/keyboard.ts` 에서 제거 |
| `i18n/translations.ts`                                               | ko/en 키 101 추가                                                                                                                                      |
| `builder/types/keyboard.ts`                                          | `i18n?: { ko?, ja?, [locale] }` 필드 제거 (82-88)                                                                                                      |
| `builder/config/keyboardShortcuts.ts`                                | `i18n: { ko: ... }` 72줄 제거 (`description` 은 en 원본으로 카탈로그에 이관 후 유지 여부는 Phase 3 에서 결정)                                          |
| `builder/components/overlay/contextMenu/types.ts`                    | `ContextMenuItem.label: string` → `labelKey: string` + `labelParams?: Record<string, string \| number \| boolean>`                                     |
| `builder/components/overlay/contextMenu/ContextMenuOverlay.tsx`      | `t(item.labelKey)` 해소, 메뉴 `aria-label` 키화                                                                                                        |
| `builder/components/overlay/actionBar/ContextualActionBar.tsx`       | `item.label` → `t(item.labelKey)` (aria-label 6곳)                                                                                                     |
| `builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts` | 병기 리터럴 16 → 키, `actionItem` 시그니처 label→labelKey                                                                                              |
| `builder/stores/utils/elementAlignment.ts`                           | `getAlignmentDescription` → `getAlignmentLabelKey`                                                                                                     |
| `builder/stores/utils/elementDistribution.ts`                        | `getDistributionDescription` → `getDistributionLabelKey`                                                                                               |
| `builder/components/overlay/CommandPalette.tsx`                      | `def.i18n?.ko \|\| def.description` → `t(\`command.${id}\`)`, 카테고리·scope 힌트 키화                                                                 |
| `builder/components/overlay/ShortcutTooltip.tsx`                     | 같은 전환 (79)                                                                                                                                         |
| `builder/components/ui/ActionTooltip.tsx`                            | 같은 전환 (64)                                                                                                                                         |
| `builder/config/componentSemanticsActions.ts`                        | `label(): ActionLabel` → `labelKey()`, `formatBilingualLabel` 제거                                                                                     |
| `builder/panels/properties/ComponentSemanticsSection.tsx`            | `.en` 고정 → `t(labelKey)`                                                                                                                             |

`buildActionBarItems.ts` / `actionBarPolicy.ts` / `buildContextMenuItems.ts` 는 id·순서만 다루므로 **변경 없음** — 라벨 축과 노출 축이 분리되어 있다는 것의 확인이기도 하다.

## 5. 테스트 영향

- 메뉴 라벨 문자열을 assert 하는 기존 테스트: `canvasContextMenuProviders.test.ts` · `buildContextMenuItems.test.ts` · `ContextMenuOverlay.test.tsx` · `componentSemanticsActions.test.ts` — assert 대상을 문자열에서 키로 바꾼다.
- 사용자 프로젝트 파일 재직렬화 **0건** — 라벨은 영속 데이터가 아니다 (canonical document 에 저장되지 않음).
- 스크린리더 텍스트는 바뀐다 (병기 → 단일 언어). 접근성 회귀가 아니라 의도된 변경.

## 6. Live Exercise 계획 (Phase 5)

`en-US` 세션에서: 캔버스 우클릭 → 메뉴 전 항목 영어 · 액션 바 aria-label 영어 · `Cmd+K` 팔레트 영어. `ko-KR` 로 전환 → 같은 3표면 한국어. 정렬 서브메뉴는 2개 이상 선택에서 확인. Chrome MCP 로 실행하고 결과를 ADR 본문 `### Live Exercise` 에 기재한다.
