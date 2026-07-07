---
title: Container Dimension Injection Pattern
impact: CRITICAL
impactDescription: shape 생성기가 레이아웃 엔진 결과를 모르면 우측/중앙/역산 배치 불가 → 시각 렌더링 오류
tags: [spec, catalog, rendering, skia, layout, dimension, pattern]
---

shape 생성기(`buildCatalogShapes` / `skiaPrimitives` draw module / 잔존 spec `render.shapes`)가 **레이아웃 엔진(Taffy)이 계산한 실제 containerWidth/Height** 를 필요로 할 때, `_containerWidth`/`_containerHeight` props 를 주입하는 패턴입니다.

## 문제

shape 생성기는 props/size 만 받으며, 레이아웃 엔진이 계산한 실제 border-box 크기를 알 수 없습니다. `size.height` 는 catalog 고정값(또는 `0` sentinel)이고, 실제 Taffy 결과(lineHeight + padding + border)와 다를 수 있습니다.

**파이프라인 타이밍 함정**: `publishLayoutMap`(useEffect)은 Skia 프레임 루프(`requestAnimationFrame`)보다 늦게 실행될 수 있어, `getSharedLayoutMap()` 이 이전 레이아웃을 반환합니다. 렌더링 파이프라인을 수정하는 것은 부작용이 크고 불안정합니다.

## 안티패턴 — 파이프라인 수정 (금지)

```tsx
// ❌ publishLayoutMap 을 render 본문에서 동기 호출 — 성능 리스크, 부작용
if (bodyElement) {
  publishLayoutMap(fullTreeLayoutMap, bodyElement.page_id); // render 중 side effect
}

// ❌ notifyLayoutChange() 강제 호출 — 해킹, 무한 루프 위험
// ❌ registryVersion 강제 증가 — 전체 Skia 재렌더링 유발
// ❌ 텍스트 폭 추정(fontSize * text.length * 0.55) — 실측정과 불일치
```

## 올바른 패턴 — 데이터 주입

### 1단계: CONTAINER_DIMENSION_TAGS 등록

`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:96` 의 `CONTAINER_DIMENSION_TAGS` Set 에 해당 type 추가 (현행 등록: Tag, Breadcrumbs, Tabs, TabList, Tab, Toast, ProgressBar, TextField, Select, ComboBox, Slider, ListBox, TagList 등).

### 2단계: buildSpecNodeData 가 자동 주입

```tsx
// buildSpecNodeData.ts (~:1416) — 등록된 type 에 Taffy 결과 주입
if (CONTAINER_DIMENSION_TAGS.has(type)) {
  specProps = {
    ...specProps,
    _containerWidth: w, // Taffy 결과
    _containerHeight: h, // Taffy 결과
  };
}
```

### 3단계: shape 생성기에서 소비

```tsx
// catalog cutover type — skiaPrimitives draw module / buildCatalogShapes
// (실사용: buildCatalogShapes.ts:407, skiaPrimitives.ts:184, datePickerShapes.ts:124)
const containerWidth =
  typeof props._containerWidth === "number" ? props._containerWidth : 0;

// ✅ 우측 역산 배치 — 텍스트 폭 추정 불필요
const cx =
  containerWidth > 0
    ? containerWidth - borderWidth - paddingRight - iconSize / 2
    : fallbackX; // 미주입 시 fallback (layout width 등)

// ✅ 정확한 세로 중앙
const centerY = containerHeight / 2;
```

## 왜 이 패턴이 우월한가

| 기준      | 파이프라인 수정                   | 데이터 주입 (이 패턴)     |
| --------- | --------------------------------- | ------------------------- |
| 수정 범위 | 5+ 파일 (cache, effect, pipeline) | Set 등록 1곳 + 소비 1곳   |
| 부작용    | publishLayoutMap 타이밍, 성능     | 없음                      |
| 정확도    | 캐시 레이어 간 타이밍 의존        | 직접 값 전달 — 항상 정확  |
| 확장성    | 단일 컴포넌트 한정                | 모든 type 에 동일 적용    |
| 디버깅    | 여러 캐시 레이어 추적             | props 확인만으로 충분     |
| 원칙      | 시스템 동작을 비틈                | 데이터가 필요한 곳에 전달 |

## 적용 대상

다음 조건을 만족하는 shape 생성에 적용합니다:

1. **절대 좌표 배치**가 필요한 shape (line, rect 등 — text `baseline: "middle"` 과 달리 자동 중앙 배치 없음)
2. **containerWidth/Height 기준 역산**이 필요한 경우 (우측 정렬, 하단 정렬 등)
3. **부모 delegation prop** 변경 시 자식 크기가 달라지는 경우

catalog generic box 경로만으로 충분한 type(layout.width 직접 사용)은 등록 불필요 — Set 주석의 제외 이력(ColorSlider 등) 참조.

## 관련 패턴: 부모 Delegation Prop 의 Atomic Batch Update

부모 prop 이 자식 레이아웃에 영향을 줄 때 (inspectorActions.ts:433):

```tsx
// ✅ updateSelectedPropertiesWithChildren — 단일 set() 로 atomic 업데이트
updateSelectedPropertiesWithChildren(
  { allowsRemoving: checked }, // 부모 props
  childUpdates, // 자식 props — [{elementId, props}]
);

// ❌ 별도 set() 호출 — 중간 렌더에서 불일치 상태 발생
updateProp("allowsRemoving", checked); // 1st set()
updateElementProps(childId, { allowsRemoving: true }); // 2nd set()
```

## 관련 파일 체크리스트

- [ ] `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:96` — `CONTAINER_DIMENSION_TAGS` 에 type 등록
- [ ] 소비 지점 분기:
  - catalog cutover type → `packages/specs/src/renderers/skiaPrimitives.ts` draw module 또는 `buildCatalogShapes.ts` 에서 `props._containerWidth` 읽기
  - 잔존 spec (Frame/Group/Slot) → 해당 `*.spec.ts` 의 `render.shapes()` 에서 읽기
- [ ] `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — `calculateContentWidth` / `parseBoxModel` (폭 계산 근거 정합)
- [ ] `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:112` — delegation prop 이 layout 에 영향 주면 `LAYOUT_PROP_KEYS` 에 추가
- [ ] Properties 편집이 부모+자식 동시 갱신이면 `updateSelectedPropertiesWithChildren` 사용 (inspectorActions.ts)

## 참조

- [spec-shape-rendering](spec-shape-rendering.md) — Shape 생성 경로 (catalog + 잔존 spec)
- [spec-value-sync](spec-value-sync.md) — catalog ↔ layout engine 값 동기화
- `.claude/rules/layout-engine.md` — layoutVersion 계약 / LAYOUT_PROP_KEYS 3-심볼 체인
