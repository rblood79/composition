---
title: Container Dimension Injection Pattern
impact: CRITICAL
impactDescription: shape 생성기가 레이아웃 엔진 결과를 모르면 우측/중앙/역산 배치 불가 → 시각 렌더링 오류
tags: [spec, catalog, rendering, skia, layout, dimension, pattern]
---

shape 생성기 (`buildCatalogShapes` / `skiaPrimitives` draw module) 가 **레이아웃 엔진 (자체 Rust WASM, ADR-916) 이 계산한 실제 containerWidth/Height** 를 필요로 할 때, `_containerWidth` / `_containerHeight` props 를 주입하는 패턴입니다.

> 2026-10-04 개정: 주입 위치가 옛 `skia/buildSpecNodeData.ts` `CONTAINER_DIMENSION_TAGS` (Phase 4e-9-8 삭제) 에서 catalog rule 실행기 `catalogRuntime/ruleShapes.ts` `BOX_SIZE_TYPES` 로 옮겨졌습니다. 이름 `CONTAINER_DIMENSION_TAGS` 는 specs · shared 의 주석에만 남아 있습니다.

## 문제

shape 생성기는 props/size 만 받으며, 레이아웃 엔진이 계산한 실제 border-box 크기를 알 수 없습니다. `size.height` 는 catalog 고정값 (또는 `0` sentinel) 이고, 실제 레이아웃 결과 (lineHeight + padding + border) 와 다를 수 있습니다.

## 안티패턴 (금지)

```tsx
// ❌ 텍스트 폭 추정 (fontSize * text.length * 0.55) — 실측정과 불일치
// ❌ shape 생성기 안에서 레이아웃 결과를 별도 경로로 조회 — 데이터가 필요한 곳에 직접 전달한다
```

옛 함정 (`publishLayoutMap` useEffect 가 Skia 프레임보다 늦어 `getSharedLayoutMap()` 이 이전 레이아웃을 돌려줌 · `notifyLayoutChange()` / `registryVersion` 강제 증가) 은 catalog Canvas 에서 경로 자체가 없어졌습니다. rule 실행기가 그 프레임의 rect 를 직접 받습니다.

## 올바른 패턴 — 데이터 주입

### 1단계: `BOX_SIZE_TYPES` 등록

`apps/builder/src/builder/catalogRuntime/ruleShapes.ts` 의 `BOX_SIZE_TYPES` Set 에 해당 type 을 추가합니다 (현행: Avatar, Tag, Breadcrumbs, Tabs, TabList, Tab, Toast, ProgressBar(Track), Meter(Track), TextField, TextArea, Input, Select, SelectTrigger, ComboBox, SearchField, NumberField, GridList, Image, Slider(Track), ListBox, ColorField, Skeleton, IllustratedMessage, TagList, CalendarHeader, DateInput, Chart).

### 2단계: rule 실행기가 자동 주입

```tsx
// catalogRuntime/ruleShapes.ts — catalogRuleShapes: 이 노드의 레이아웃 rect 를 그대로 싣는다
if (BOX_SIZE_TYPES.has(type)) {
  props._containerWidth = rect.width;
  props._containerHeight = rect.height;
}
```

### 3단계: shape 생성기에서 소비

```tsx
// packages/specs — skiaPrimitives draw module / buildCatalogShapes / datePickerShapes
const containerWidth =
  typeof props._containerWidth === "number" ? props._containerWidth : 0;

// ✅ 우측 역산 배치 — 텍스트 폭 추정 불필요
const cx =
  containerWidth > 0
    ? containerWidth - borderWidth - paddingRight - iconSize / 2
    : fallbackX; // 미주입 시 fallback

// ✅ 정확한 세로 중앙
const centerY = containerHeight / 2;
```

## 왜 이 패턴이 우월한가

| 기준      | 레이아웃 결과 별도 조회    | 데이터 주입 (이 패턴)        |
| --------- | -------------------------- | ---------------------------- |
| 수정 범위 | 캐시 · 타이밍 경로 여러 곳 | Set 등록 1곳 + 소비 1곳      |
| 정확도    | 조회 시점 의존             | 그 프레임의 rect — 항상 정확 |
| 확장성    | 단일 컴포넌트 한정         | 모든 type 에 동일 적용       |
| 디버깅    | 여러 계층 추적             | props 확인만으로 충분        |

## 적용 대상

1. **절대 좌표 배치**가 필요한 shape (line, rect 등 — text `baseline: "middle"` 과 달리 자동 중앙 배치 없음)
2. **containerWidth/Height 기준 역산**이 필요한 경우 (우측 정렬, 하단 정렬 등)
3. **부모 delegation prop** 변경 시 자식 크기가 달라지는 경우

catalog generic box 경로만으로 충분한 type 은 등록하지 않습니다. 잔존 spec 3개 (Frame · Group · Slot) 는 rule 실행기가 아니라 `canvasBinding.ts` 의 `containerWithAuthoredPaint` binding 이 그리므로 주입 대상이 아닙니다.

## 관련 패턴: 부모 · 자식 동시 편집

부모 prop 이 자식 레이아웃에 영향을 줄 때 두 값을 **같은 step** 에 바꿉니다. step 은 원자적입니다 (consumer 가 던지면 commit 을 되돌림).

```tsx
// ✅ 명령 여러 개를 entry 하나로
workspace.execute(() =>
  composeCommands(graph, "Edit properties", [parentPatch, childPatch]),
);

// ❌ 명령 두 번 — 중간 상태가 화면 · 저장 · 히스토리에 따로 남는다
workspace.execute(parentPatch);
workspace.execute(childPatch);
```

부모 prop 이 자식에 주는 값이 resolver 채널 (template binding · `CATALOG_SIZE_PROPAGATION` · `catalogDerivedProps` · part rules) 로 이미 계산되면 자식에 값을 복사해 쓰지 않습니다 — composition root 가 의존 노드를 다시 계획합니다.

## 관련 파일 체크리스트

- [ ] `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` — `BOX_SIZE_TYPES` 에 type 등록
- [ ] 소비 지점: `packages/specs/src/renderers/skiaPrimitives.ts` draw module 또는 `buildCatalogShapes.ts` 에서 `props._containerWidth` 읽기
- [ ] delegation prop 이 레이아웃에 영향을 주면 [layout-engine.md 「새 레이아웃 키를 추가할 때」](../../../rules/layout-engine.md): `styleOf` (`compositionRoot.ts`) 가 엔진 입력으로 내보내는지, `PAINT_ONLY_VISUAL_KEYS` (`transaction.ts`) 에 잘못 넣지 않았는지
- [ ] Properties 편집이 부모 + 자식 동시 갱신이면 `composeCommands` 하나로

## 참조

- [spec-shape-rendering](spec-shape-rendering.md) — Shape 생성 경로 (catalog + 잔존 spec)
- [spec-value-sync](spec-value-sync.md) — catalog ↔ Canvas ↔ CSS 값 동기화
- `.claude/rules/layout-engine.md` — 레이아웃 재계산 경로 (catalog runtime)
