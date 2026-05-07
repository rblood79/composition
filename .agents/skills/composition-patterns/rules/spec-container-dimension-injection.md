---
title: Spec Container Dimension Injection Pattern
impact: CRITICAL
impactDescription: Spec shapes가 레이아웃 엔진 결과를 모르면 요소 위치/크기 계산 불가 → 시각적 렌더링 오류
tags: [spec, rendering, skia, layout, dimension, pattern]
---

Spec shapes 함수가 **레이아웃 엔진(Taffy)이 계산한 실제 containerWidth/Height**를 필요로 할 때, `_containerWidth`/`_containerHeight` props를 주입하는 패턴.

## 문제

Spec `render.shapes(props, variant, size, state)` 함수는 4개 인자만 받으며, 레이아웃 엔진이 계산한 실제 border-box 크기를 알 수 없다. `size.height`는 Spec 고정값이고, 실제 Taffy 결과(lineHeight + padding + border)와 다를 수 있다.

**파이프라인 타이밍 함정**: `publishLayoutMap`(useEffect)은 Skia 프레임 루프(`requestAnimationFrame`)보다 늦게 실행될 수 있어, `getSharedLayoutMap()`이 이전 레이아웃을 반환한다. 렌더링 파이프라인을 수정하는 것은 부작용이 크고 불안정하다.

## 안티패턴 — 파이프라인 수정 (금지)

```tsx
// ❌ publishLayoutMap을 render 본문에서 동기 호출 — 성능 리스크, 부작용
if (bodyElement) {
  publishLayoutMap(fullTreeLayoutMap, bodyElement.page_id); // render 중 side effect
}

// ❌ notifyLayoutChange() 강제 호출 — 해킹, 무한 루프 위험
useLayoutEffect(() => {
  if (element.type === "Tag") notifyLayoutChange();
}, [computedW]);

// ❌ registryVersion 강제 증가 — 전체 Skia 재렌더링 유발
// ❌ 텍스트 폭 추정(fontSize * text.length * 0.55) — measureTextWidth와 불일치
```

## 올바른 패턴 — 데이터 주입

### 1단계: Spec Props에 dimension 필드 추가

```tsx
// Tag.spec.ts
export interface TagProps {
  children?: string;
  allowsRemoving?: boolean;
  style?: Record<string, string | number | undefined>;
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  /** ElementSprite 주입: 엔진 계산 최종 높이 */
  _containerHeight?: number;
}
```

### 2단계: ElementSprite에서 주입

```tsx
// ElementSprite.tsx — specProps에 최종 크기 주입
if (finalWidth > 0 || finalHeight > 0) {
  specProps = {
    ...specProps,
    _containerWidth: finalWidth, // Taffy 결과
    _containerHeight: finalHeight, // Taffy 결과
    style: {
      ...existingStyle,
      width: resolvedWidth,
      height:
        existingStyle.height ?? (finalHeight > 0 ? finalHeight : undefined),
    },
  };
}
```

### 3단계: Spec shapes에서 사용

```tsx
// Tag.spec.ts — render.shapes()
shapes: (props, variant, size, state) => {
  // 레이아웃 엔진 결과 우선, 없으면 Spec 고정값 + border 보정
  const containerWidth =
    typeof props._containerWidth === "number" ? props._containerWidth : 0;
  const containerHeight =
    typeof props._containerHeight === "number"
      ? props._containerHeight
      : size.height + 2; // border(1)*2 보정

  // ✅ 우측 역산 배치 — 텍스트 폭 추정 불필요
  const cx =
    containerWidth > 0
      ? containerWidth - borderWidth - paddingRight - removePad - iconSize / 2
      : fallbackX; // containerWidth 미주입 시 fallback

  // ✅ 정확한 세로 중앙
  const centerY = containerHeight / 2;
};
```

## 왜 이 패턴이 우월한가

| 기준      | 파이프라인 수정                   | 데이터 주입 (이 패턴)          |
| --------- | --------------------------------- | ------------------------------ |
| 수정 범위 | 5+ 파일 (cache, effect, pipeline) | Spec props 1곳 + 주입 1곳      |
| 부작용    | publishLayoutMap 타이밍, 성능     | 없음                           |
| 정확도    | 캐시 레이어 간 타이밍 의존        | 직접 값 전달 — 항상 정확       |
| 확장성    | Tag에만 적용                      | 모든 Spec 컴포넌트에 동일 적용 |
| 디버깅    | 여러 캐시 레이어 추적             | props 확인만으로 충분          |
| 원칙      | 시스템 동작을 비틈                | 데이터가 필요한 곳에 전달      |

## 적용 대상

이 패턴은 다음 조건을 모두 만족하는 Spec shapes에 적용한다:

1. **절대 좌표 배치**가 필요한 shape (line, rect 등 — text baseline="middle"과 달리 자동 중앙 배치 없음)
2. **containerWidth/Height 기준 역산**이 필요한 경우 (우측 정렬, 하단 정렬 등)
3. **부모 delegation prop**(allowsRemoving, size 등) 변경 시 자식 크기가 달라지는 경우

## 관련 패턴: 부모 Delegation Prop의 Atomic Batch Update

TagGroup의 `allowsRemoving` 같은 부모 prop이 자식(Tag) 레이아웃에 영향을 줄 때:

```tsx
// ✅ updateSelectedPropertiesWithChildren — 단일 set()로 atomic 업데이트
updateSelectedPropertiesWithChildren(
  { allowsRemoving: checked }, // 부모(TagGroup) props
  childUpdates, // 자식(Tag) props — [{elementId, props}]
);

// ❌ 별도 set() 호출 — 중간 렌더에서 불일치 상태 발생
updateProp("allowsRemoving", checked); // 1st set()
updateElementProps(childId, { allowsRemoving: true }); // 2nd set()
```

## 관련 파일 체크리스트

- [ ] `packages/specs/src/components/{Component}.spec.ts` — `_containerWidth`/`_containerHeight` props 추가
- [ ] `apps/builder/src/.../sprites/ElementSprite.tsx` — specProps에 dimension 주입
- [ ] `apps/builder/src/.../layout/engines/utils.ts` — `calculateContentWidth`, `parseBoxModel`
- [ ] `apps/builder/src/.../scene/layoutCache.ts` — `LAYOUT_PROP_KEYS`에 delegation prop 추가
- [ ] `apps/builder/src/.../panels/properties/editors/{Component}Editor.tsx` — `updateSelectedPropertiesWithChildren` 사용

## 참조

- `spec-shape-rendering.md` — Shape 기반 렌더링 패턴
- `spec-value-sync.md` — Spec↔CSS 값 동기화
- `domain-async-pipeline.md` — 비동기 파이프라인 순서
