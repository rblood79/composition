# Style Panel — StylesHost 경계 + catalog 구현 (현행)

> **정본 분리**: 저장 모델 (typed field · shorthand 분해 · gap 축) · 읽기 우선순위 · dirty 판정 배열 · PropertyUnitInput commit 계약은 [style-ssot.md](../../../rules/style-ssot.md) 정본. 편집 파이프라인은 [state-management.md](../../../rules/state-management.md) §2 · §7. 본 문서는 **현행 파일 구조와 데이터 흐름**만 담는다.
>
> **역사적 맥락**: Zustand→Jotai Bridge (`styleAtoms`) · `SyntheticComputedStyle` 은 그 전에 소멸했고, ADR-248 Phase 4 (2026-10-03) 에서 옛 store 쓰기 경로 (`inspectorActions.updateSelectedStyle[s]` · `distributeShorthand` · `useCanonicalPropertyElementsMap` · `useStyleValues.ts` · Preview computed style 채널 `updateSelectedComputedStyle`) 가 삭제됐다. ADR-252 (2026-10-04) 로 Styles 는 Design 패널의 탭 4개 (Layout · Style · Text · Screen) 가 됐다.

## 1. 구조 — 섹션 훅은 host 만 본다

```
Design 패널 (panels/design/DesignPanel.tsx)
  → CatalogStylesHostProvider (panels/styles/catalog/CatalogStylesPanel.tsx)
    → createCatalogStylesHost(workspace) (panels/styles/catalog/catalogStylesHost.ts)
      = StylesHost 인터페이스 구현 (panels/styles/stylesHostContext.ts)

섹션 훅 (useStylesHost() 경유):
  읽기: host.useElementStyleContext(id)
          → use{Layout,Transform,Typography,Appearance,Fill}Values + specPresetResolver
          → sections → PropertyUnitInput
  쓰기: useStyleActions / useOptimizedStyleActions
          → host.updateStyle[s] / previewStyle / updateFills / previewFills / resetStyles
```

| 파일                                                                                          | 역할                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panels/styles/stylesHostContext.ts`                                                          | `StylesHost` 인터페이스 — 패널이 문서에 닿는 유일한 경계. `presentation` (옛 Canvas 편집 채널, ADR-187) 은 옛 store 전용이라 catalog 에는 없다                                          |
| `panels/styles/stylesHost.ts`                                                                 | `useStylesHost()` — provider 없으면 throw (옛 store 테스트용 fallback 만 남음)                                                                                                          |
| `panels/styles/catalog/catalogStylesHost.ts`                                                  | catalog 구현 — 읽기 (`useOwnFieldsOf` · `useMasterFieldsOf` → `catalogStyleView`), 쓰기 (`styleCommandOf` → `workspace.execute`), 미리보기 (`previewRecord`), dirty · reset             |
| `panels/styles/hooks/useElementStyleContext.ts`                                               | host 위임                                                                                                                                                                               |
| `panels/styles/hooks/useTypographyValues.ts` 외 `use{Layout,Transform,Appearance,Fill}Values` | 섹션별 값 훅                                                                                                                                                                            |
| `panels/styles/utils/specPresetResolver.ts`                                                   | **catalog 기반 preset** — `resolveComponentRule` / `resolveCatalogContainerBase` / `resolveCatalogContainerVariants` 로 sizes + containerStyles 를 preset 객체로 합성 (ADR-912 Phase 4) |
| `panels/styles/hooks/useStyleActions.ts`                                                      | 즉시 커밋 액션 — host 메서드 호출, 구독 없음                                                                                                                                            |
| `panels/styles/hooks/useOptimizedStyleActions.ts`                                             | `updateStyleImmediate` / `updateStyleRAF` (드래그·슬라이더) / `updateStyleIdle` (타이핑) / `updateStylePreview` (미리보기) + `useTransition`                                            |
| `components/property/PropertyUnitInput.tsx`                                                   | 숫자+단위 입력 — commit 보호 패턴 구현체                                                                                                                                                |
| `panels/styles/hooks/useResetStyles.ts` (`useHasDirtyStyles` · `useDirtyStyleProps`)          | 섹션 reset 버튼 · 탭 dot — host `useDirtyStyleProps` (= `catalogDirtyStyleProps`, `catalogRuntime/styleDirty.ts`)                                                                       |
| `panels/styles/sections/styleSectionProps.ts`                                                 | 섹션별 dirty 키 목록 (longhand 전체 포함 — style-ssot.md §4)                                                                                                                            |

## 2. 값 우선순위 — 3단계

1. **authored typed field** — 활성 breakpoint 레이어를 합친 값. instance 는 component (master) 값 위에 own 값을 덮는다 (`catalogStylesHost.ts` `useElementStyleContext` — `view(master)` 뒤 `view(own)`). 절대 배치는 `catalogPlacementStyle`.
2. **catalog preset** — `specPresetResolver` 가 `COMPONENT_RULES_TABLE` entry (sizes[size], containerStyles, containerVariants) 에서 합성. TokenRef 는 `resolveToken` / `tokenToCSSVar` 로 해석.
3. **훅 기본값** — 훅별 하드코딩 fallback.

- 옛 2단계였던 **Preview computed style** (브라우저 실측값, `INLINE_ONLY_PROPERTIES`) 는 없다. 실측 상자가 필요한 필드 (W/H/X/Y) 는 `host.useLayoutValue(id, key)` 가 레이아웃 결과를 읽는다.
- size 는 `useElementStyleContext` 가 edit contract 의 props 에서 꺼내 preset resolver 에 넘긴다.
- Gap 표시: `useLayoutValues.ts` — `firstDefined(axisGap ?? s.rowGap ?? s.columnGap ?? s.gap, specPreset.gap, …)` (longhand 우선 — 엔진 입력과 같은 순서, style-ssot.md §3).

## 3. 선택 전환 ↔ commit 경합 보호

계약 정본은 [state-management.md](../../../rules/state-management.md) §7 · style-ssot.md §5. 구현 위치 (`components/property/PropertyUnitInput.tsx`):

- `lastSavedValueRef` — commit 판정은 **이전 commit 결과 기준 단독**. `value` prop diff 로 판정 금지.
- `focusedElementIdRef` — focus 시점 선택 id 를 잡고, blur 시 `selection.readSelectedId()` (host `readSelectedId`) 와 비교해 다르면 onChange 를 건너뛴다. mousedown→blur 순서라 blur 시점엔 이미 새 요소가 선택돼 있어, 보호가 없으면 이전 요소 입력값이 새 요소에 적용된다.
- value prop 동기화 `useEffect` 는 **같은 요소에 focus 중이면 skip** (`document.activeElement` 비교 + `syncAfterPresetRef` 예외).
- catalog 미리보기는 문서를 쓰지 않으므로 value prop 이 commit 값에 머문다 — 화살표 키 증감은 표시값 (`inputValue`) 에서 시작한다.

## 4. 쓰기 경로 세부

| 동작                  | 경로                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 값 commit             | `host.updateStyle(s)` → `styleCommandOf` → `catalogStyleWritesOf` + `setFields` (활성 breakpoint) → `workspace.execute` 한 step. 절대 배치 left/top 은 `catalogPlacementEditCommand` |
| Props + style 한 step | `updatePropertiesWithStyles` — props 명령과 style 명령을 함께 실행                                                                                                                   |
| 미리보기              | `previewStyle` → `workspace.root.previewRecord` — 레이아웃까지 반영, 문서·히스토리 쓰기 0. 손을 놓을 때 commit 한 번. 취소는 `cancelPreview`                                         |
| Fills                 | commit `updateFills` → `setWholeField("fills")` + fill 파생 visual 제거 (`FILL_DERIVED_STYLE_PROPS`) · 미리보기 `previewFills` · 초기화 `resetFills`                                 |
| Reset                 | `resetStyles` → `catalogResetStyleWrites` (authored 값만, 없으면 step 0)                                                                                                             |
| 값 오류               | typed field 가 담지 못하는 값은 `CatalogStyleValueError` → toast                                                                                                                     |

## 5. 새 스타일 속성 추가 시 체크리스트

1. `catalogRuntime/styleFields.ts` 키 집합에 넣어 typed field 를 정한다 (style-ssot.md §6).
2. 해당 섹션 값 훅 (`use{Section}Values.ts`) 에 필드 추가 — authored → preset → default 체인.
3. preset 이 필요하면 `specPresetResolver.ts` 의 Preset 인터페이스 + 추출 로직 확장 (source 는 catalog — spec 직독 금지).
4. `styleSectionProps.ts` dirty 키 목록에 longhand 포함.
5. 레이아웃 영향 속성이면 [layout-engine.md](../../../rules/layout-engine.md) 「새 레이아웃 키를 추가할 때」 — `styleOf` 가 엔진 입력으로 내보내는지, `PAINT_ONLY_VISUAL_KEYS` 에 잘못 넣지 않았는지.
