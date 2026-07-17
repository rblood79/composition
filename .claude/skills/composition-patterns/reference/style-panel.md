# Style Panel — Zustand 단독 아키텍처 (현행)

> **정본 분리**: Store longhand 정책·PropertyUnitInput commit 계약·dirty 판정 배열은 [style-ssot.md](../../../rules/style-ssot.md) 정본 (ADR-909). 본 문서는 **현행 파일 구조와 데이터 흐름**만 담는다.
>
> **역사적 맥락 (1구획)**: 구 문서의 Zustand→Jotai Bridge (`useZustandJotaiBridge` / `styleAtoms` / `selectAtom`) 와 `SyntheticComputedStyle`/`computeSyntheticStyle`/`computedStyleService` 는 전부 소멸했다 — jotai 는 monorepo 어느 package.json 에도 없고 (grep 0건), atoms 디렉토리도 없다. preset 계산은 catalog 기반 `specPresetResolver` 가 대체한다.

## 1. 아키텍처 개요 — 읽기/쓰기 흐름

```
읽기 (Zustand canonical → 훅 체인):
  useCanonicalPropertyElementsMap
    → useElementStyleContext(id)            — style/type/size/fills/props (ref-origin 해석 포함)
      → use{Typography,Layout,Transform,Appearance,Fill}Values
         + specPresetResolver (catalog preset)     — inline 부재 시 fallback 값 합성
        → sections (Transform/Layout/Typography/Appearance/Fill/ModifiedStyles)
          → PropertyUnitInput (숫자+단위 입력)

쓰기:
  PropertyUnitInput onChange
    → useStyleActions (즉시) / useOptimizedStyleActions (RAF/Idle/Preview/Transition)
      → useStore.getState().updateSelectedStyle[s] / updateSelectedStylePreview
        → inspectorActions: distributeShorthand (gap/padding/margin → longhand 분배)
          → Memory → Index → History → DB → Preview (state-management.md 파이프라인)
```

핵심 파일 (전부 실존 확증, 2026-07-07):

| 파일                                                                                          | 역할                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `panels/styles/hooks/useElementStyleContext.ts`                                               | canonical 단일 read 경계 — `PanelNode` 에서 style/type/size 추출, `type:"ref"` 는 origin element 로 해석                                                                                                                                   |
| `panels/styles/hooks/useStyleValues.ts`                                                       | `getStyleValue()` 우선순위 해석 + 참조 안정성 memo                                                                                                                                                                                         |
| `panels/styles/hooks/useTypographyValues.ts` 외 `use{Layout,Transform,Appearance,Fill}Values` | 섹션별 값 훅                                                                                                                                                                                                                               |
| `panels/styles/utils/specPresetResolver.ts`                                                   | **catalog 기반 preset** — `resolveComponentRule` / `resolveCatalogContainerBase` / `resolveCatalogContainerVariants` 로 sizes + containerStyles 를 preset 객체로 합성 (ADR-912 Phase 4: builder-local spec 직독 → catalog 단일 entry 전환) |
| `panels/styles/hooks/useStyleActions.ts`                                                      | 즉시 커밋 액션 — `getState()` 만 사용 (구독 없음)                                                                                                                                                                                          |
| `panels/styles/hooks/useOptimizedStyleActions.ts`                                             | `updateStyleImmediate` / `updateStyleRAF` (드래그·슬라이더) / `updateStyleIdle` (타이핑) / `updateStylePreview` (히스토리·DB 없이 캔버스만) + `useTransition`                                                                              |
| `components/property/PropertyUnitInput.tsx`                                                   | 숫자+단위 입력 — commit 보호 패턴 구현체                                                                                                                                                                                                   |
| `panels/styles/hooks/useResetStyles.ts` + `StylesPanel.tsx` 의 `useHasDirtyStyles`            | 섹션 reset 버튼 활성/초기화                                                                                                                                                                                                                |
| `stores/inspectorActions.ts`                                                                  | `updateSelectedStyle`(`:721` 근방) / `updateSelectedStyles` / `updateSelectedStylePreview` — 3곳 모두 `distributeShorthand`(`:75`) 경유                                                                                                    |

## 2. 값 우선순위 — 4단계

`useStyleValues.getStyleValue()` 기준:

1. **inline style** — `element.props.style` (사용자 명시값)
2. **computed style** — 브라우저 실측값. Preview iframe 이 postMessage 로 전달 → `hooks/useIframeMessenger.ts:876` `updateSelectedComputedStyle` (메모리 전용, DB 저장 없음). 단 `INLINE_ONLY_PROPERTIES` (width/height/top/left/right/bottom) 는 computed 를 건너뛴다 — 미설정이어도 항상 px 실측값이 나와 "명시 안 함" 상태를 가리기 때문
3. **catalog preset** — `specPresetResolver` 가 `COMPONENT_RULES_TABLE` entry(sizes[size], containerStyles, containerVariants)에서 합성. TokenRef 는 `resolveToken`/`tokenToCSSVar` 로 해석
4. **global default** — 훅별 하드코딩 fallback

구 개념 대응: `SyntheticComputedStyle` (tag+size preset) 의 등가물이 3번 catalog preset 이다. size/variant 미전달 시 md fallback 문제는 `useElementStyleContext` 가 props 에서 `size` 를 직접 추출해 preset resolver 에 전달하는 구조로 흡수됐다.

gap/padding 표시 는 longhand 우선: `useLayoutValues.ts:67` — `firstDefined(s.rowGap ?? s.columnGap ?? s.gap, ...)` (정본: style-ssot.md).

## 3. Preview mutate ↔ commit 경합 보호

계약 정본은 style-ssot.md §PropertyUnitInput commit 조건. 구현 위치 (`components/property/PropertyUnitInput.tsx`):

- `lastSavedValueRef` (`:116`) — commit 판정은 **이전 commit 결과 기준 단독** (`:289` 등). `value` prop diff 로 판정 금지 — preview 경로가 elementsMap 을 mutate 하면 value prop 이 편집값으로 선반영되어 commit skip → DB 미저장.
- `focusedElementIdRef` (`:117`) — focus 시점 selectedElementId 캡처. blur 시 현재 선택과 다르면 onChange skip (`:230-231`) — mousedown→blur 순서로 blur 시점엔 이미 새 요소가 선택되어 있어, 보호 없으면 이전 요소 입력값이 새 요소에 적용된다.
- value prop 변경 시 ref/inputValue 리셋 useEffect 는 **같은 요소에 focus 중이면 skip** — preview 유발 value 변경이 사용자 편집 세션을 끊지 않도록.

동일 이유로 `updateStyleImmediate` 는 호출 시점의 `selectedElementId` 로 동작하므로, 선택 전환 보호는 항상 입력 컴포넌트 층(PropertyUnitInput)에서 수행한다.

## 4. 쓰기 경로 세부

- **shorthand → longhand 분배**: `inspectorActions.ts` 의 `distributeShorthand(:75)` 가 gap→rowGap+columnGap, padding/margin→4way 로 분배하고 shorthand 키는 삭제. `updateSelectedStyle`/`updateSelectedStylePreview`/`updateSelectedStyles` 3 진입점 모두 경유 (`:721/:783/:873`). store 는 longhand only (정본: style-ssot.md).
- **fills**: `useFillValues`/`useFillActions` → `updateSelectedFills` (커밋) / `updateSelectedFillsPreview` / `updateSelectedFillsPreviewLightweight` (드래그 전용, CSS 변환 생략) — inspectorActions 에 3단 제공. `fillDerivedStyleProps.ts` 의 sanitize 가 fills 파생 style 키 오염을 차단.
- **preview vs commit**: `updateSelectedStylePreview` 는 히스토리/DB 없이 캔버스만 갱신 — 드래그 중 사용, 종료 시 Immediate 로 커밋.
- **reset/dirty**: `useHasDirtyStyles` 의 검사 배열은 longhand 전체 포함 필수 (정본: style-ssot.md §Inspector "dirty" 판정 배열).

## 5. 새 스타일 속성 추가 시 체크리스트

1. 해당 섹션 값 훅 (`use{Section}Values.ts`) 에 필드 추가 — inline → computed → preset → default 체인 준수
2. preset 이 필요하면 `specPresetResolver.ts` 의 해당 Preset 인터페이스 + 추출 로직 확장 (source 는 catalog — spec 직독 금지)
3. shorthand 성 속성이면 `distributeShorthand` 분배 대상인지 판정 (store longhand 정책)
4. dirty/reset 배열에 longhand 포함
5. layout 영향 속성이면 layout-engine.md 의 **5-심볼 2계층 체인** 점검 — Style 패널이 쓰는 키는 대개 **style 축**이므로 계층 B 는 `LAYOUT_PROP_KEYS` 가 아니라 **`LAYOUT_STYLE_KEYS`** 다 (props 축과 배열이 다름)
