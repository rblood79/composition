# ADR-200 Phase 0 — 라벨 채널 인벤토리 freeze

측정 2026-08-30, 대상 `apps/builder/src`. 착수 기준 수치의 정본. 이후 phase 의 Gate 판정은 이 표의 값을 기준선으로 쓴다.

## 1. 라벨 채널 4개

| #    | 채널                                                |            정의 수 | 소비 표면                                          | locale 반응                                          | 근거                                                                                                                          |
| ---- | --------------------------------------------------- | -----------------: | -------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | `SHORTCUT_DEFINITIONS[id].description` + `.i18n.ko` |            72 / 72 | 명령 팔레트 · ShortcutTooltip · ActionTooltip      | ❌ `i18n?.ko \|\| description` — locale 무관 ko 우선 | `builder/config/keyboardShortcuts.ts:49` 외 72 · `CommandPalette.tsx:260` · `ShortcutTooltip.tsx:79` · `ActionTooltip.tsx:64` |
| 2    | 컨텍스트 메뉴 병기 리터럴                           |                 16 | 메뉴 3 표면 + 액션 바                              | ❌ 항상 `한국어 / English`                           | `canvasContextMenuProviders.ts:141,148,155,162,259,271,278,302,314,329,411,433,441,472,473,483`                               |
| 3    | 정렬·분배 설명                                      |              6 + 2 | 정렬 서브메뉴                                      | ❌ 한국어 단독                                       | `elementAlignment.ts:245-256` · `elementDistribution.ts:284-291`                                                              |
| 4    | `COMPONENT_SEMANTICS_ACTIONS[].label` → `{en, ko}`  |                  4 | 메뉴(병기) · 속성 패널(`.en`) · 액션 바(병기 상속) | ❌ 표면마다 고정                                     | `componentSemanticsActions.ts:123,132,142,156` · `formatBilingualLabel:192`                                                   |
| SSOT | `localizedStrings`                                  | ko 문자열 leaf 402 | `useI18n` 소비 파일 56                             | ✅ `@react-aria/i18n` formatter                      | `translations.ts:1331` · `I18nProvider.tsx:90-100`                                                                            |

## 2. 표면 4개

`ContextMenuOverlay.tsx:121,164` (항목) · `:134` (서브메뉴 `aria-label`) · `:81` (메뉴 `aria-label`) / `ContextualActionBar.tsx:72,83,96,128,140,145` / `ComponentSemanticsSection.tsx` / `CommandPalette.tsx:260`.

provider 는 3 표면 (`canvas-element` / `canvas-empty` / `layer-item`) 에 같은 함수로 등록된다 — `canvasContextMenuProviders.ts:510,514,515`.

## 3. Gate RED 기준선 (2026-08-30 실측)

| Gate   | 측정                                              |                                                              RED 값 | 목표                              |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------: | --------------------------------- |
| G1     | `localizedStrings` 의 `contextMenu` 접두 키       |                                                               **0** | 코드가 참조하는 라벨 키 전수 존재 |
| G2 (a) | `canvasContextMenuProviders.ts` 병기 리터럴       |                                                              **16** | 0                                 |
| G2 (b) | 표시 계층이 `labelKey` 를 `t()` 없이 렌더하는 JSX |                                            (Phase 2 이후 측정 대상) | 0                                 |
| G3     | `i18n?.ko \|\|` 소비 지점                         | **3** (`CommandPalette` · `ShortcutTooltip` · `ActionTooltip` 각 1) | 0                                 |
| G3     | `ShortcutDefinition.i18n` 필드 / 정의 사용        |                                                          **1 / 72** | 0 / 0                             |

## 4. provider 래핑 선행 전환 (R7)

### 4-1. Phase 0 이 잡은 3파일 (기준: `label` 참조)

| 파일                                 | `render(` | `rerender(` |
| ------------------------------------ | --------: | ----------: |
| `ContextMenuOverlay.test.tsx`        |         4 |           0 |
| `ComponentSemanticsSection.test.tsx` |        20 |           0 |
| `CommandPalette.test.tsx`            |        10 |           2 |

### 4-2. Phase 2 에서 드러난 4파일 — 기준 정정

**기준은 `label` 참조가 아니라 표시 계층 _마운트_ 다.** 아래 4파일은 라벨 문자열을 전혀 읽지 않지만 오버레이·패널을 마운트해서 훅 요구가 생겼고, Phase 2 에서 `useI18n must be used within an I18nProvider` 로 9건이 깨진 뒤에야 드러났다.

| 파일                                      | `render(` | 무엇을 마운트하나                            |
| ----------------------------------------- | --------: | -------------------------------------------- |
| `contextMenu/useContextMenu.test.tsx`     |         4 | `ContextMenuProvider` → `ContextMenuOverlay` |
| `LayerTree/LayerTreeItemContent.test.tsx` |         1 | 행 → 공유 T1 메뉴                            |
| `LayerTree/useLayerTreeData.test.tsx`     |         1 | 트리 렌더 1건                                |
| `properties/FrameSlotSection.test.tsx`    |         8 | Component 섹션 공존 케이스                   |

합 **7파일 47 렌더**. 전환 후 전수 PASS. `ContextualActionBar` 는 이미 `useI18n` (`:164`, `:206`) 을 쓰고 그 테스트가 감싸져 있어 처음부터 대상 밖이었다.

**교훈**: 훅 도입의 영향 범위는 "그 값을 읽는 파일" 이 아니라 "그 컴포넌트를 마운트하는 파일" 로 센다. 전자는 grep 한 번이라 싸고 후자는 import 체인을 타야 해서, 싼 쪽 기준이 그대로 인벤토리가 됐다.

## 5. 진행 중 판단 (in-flight judgment)

**정적 게이트 3종의 커밋 시점을 Phase 0 → 각 게이트가 GREEN 되는 phase 로 옮긴다** (G1 → Phase 1, G2 → Phase 2, G3 → Phase 3). breakdown §3 은 Phase 0 에 "게이트 3종 RED 작성" 을 뒀으나, RED 테스트를 main 에 커밋하면 이후 phase 동안 전체 스위트가 빨간 상태로 남는다. RED 사실은 위 §3 의 실측 기준선으로 대체 기록한다 — 게이트가 무엇을 0 으로 만들어야 하는지와 지금 값이 얼마인지가 둘 다 남으므로 증거 가치는 동일하고, main 은 항상 초록으로 유지된다.
