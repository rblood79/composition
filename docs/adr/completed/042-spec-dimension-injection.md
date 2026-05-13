# ADR-042: Spec Container Dimension Injection — Spec Shapes 레이아웃 크기 주입 패턴

## Status

Proposed

## Date

2026-03-19

## Decision Makers

composition Team

## Related ADRs

- [ADR-036](completed/036-spec-first-single-source.md): Spec-First Single Source (CSS 자동 생성)
- [ADR-008](completed/008-layout-engine.md): 캔버스 레이아웃 엔진 전환 (Taffy WASM)
- [ADR-012](completed/012-rendering-layout-pipeline-hardening.md): 렌더링/레이아웃 파이프라인 하드닝

---

## Context

### 문제: Spec shapes가 레이아웃 엔진 결과를 모른다

Spec `render.shapes(props, variant, size, state)` 함수는 **4개 인자**만 받으며, Taffy WASM 레이아웃 엔진이 계산한 실제 border-box 크기(`containerWidth`, `containerHeight`)를 알 수 없다.

현재 9개 Spec 컴포넌트에서 **텍스트 폭 추정** 및 **Spec 고정값 기반 좌표 계산**이 사용되고 있어 시각적 오차가 발생한다.

### 부정확한 패턴 (현황)

#### 1. 텍스트 폭 추정 (`fontSize * text.length * 0.55`)

```typescript
// Tag.spec.ts — remove 버튼 X 좌표
const removeX = paddingX + fontSize * text.length * 0.55 + gap;
// 실제 measureTextWidth 결과와 최대 40% 차이 → remove 아이콘이 Tag 끝에 붙음

// Breadcrumbs.spec.ts — crumb 간격
const charWidthFactor = fontSize * 0.55;
const sepEstimate = fontSize * 0.35;

// Tabs.spec.ts — 탭 너비
const charWidth = fontSize * 0.55;
const tabWidth = Math.max(
  48,
  Math.ceil(label.length * charWidth) + paddingX * 2,
);
```

**영향 범위**: Tag, Breadcrumbs, Tabs, StatusLight (4개 컴포넌트)

#### 2. Spec 고정값 기반 세로 중앙 (`size.height / 2`)

```typescript
// Toast.spec.ts
y: size.height / 2;

// Table.spec.ts
y: size.height / 2;

// GridList.spec.ts
y: cellY + cellHeight / 2 - (item.description ? fontSize * 0.6 : 0);
```

**문제**: `size.height`는 Spec 고정값이고, 실제 Taffy 계산 높이(`lineHeight + paddingY*2 + border*2`)와 다르다. 예: Tag sm — `size.height=20`, Taffy height=22 → 1px 세로 치우침.

**영향 범위**: Toast, Table, GridList, Tag, Skeleton (5개 컴포넌트)

### 실패한 접근: 렌더링 파이프라인 수정

Tag `allowsRemoving` 토글 시 width 미반영 버그 해결 과정에서 다음 접근을 시도했으나 **모두 실패**했다:

| 시도 | 방법                                                   | 실패 이유                                 |
| ---- | ------------------------------------------------------ | ----------------------------------------- |
| 1    | `publishLayoutMap`을 useEffect → render 본문 동기 호출 | React render 중 side effect — 성능 리스크 |
| 2    | `notifyLayoutChange()` 강제 호출                       | 전체 Skia 트리 재빌드 — O(전체 노드)      |
| 3    | `registryVersion` 수동 증가                            | command stream 캐시 전체 무효화           |
| 4    | `computedContainerSize` 무조건 override                | 불필요한 re-render 유발                   |
| 5    | `queueMicrotask(invalidateLayout)`                     | 추가 렌더 사이클 발생                     |

**근본 원인**: 렌더링 파이프라인에는 3단계 캐시(`pageLayoutCache`, `PersistentTaffyTree`, `commandStream`)가 있어 타이밍 수정이 연쇄 부작용을 일으킨다.

### 성공한 접근: 데이터 주입

**Spec shapes가 크기를 모르면, 크기를 알려주면 된다.**

`_containerWidth`/`_containerHeight` props를 ElementSprite에서 specProps에 주입하여, Spec shapes가 레이아웃 엔진 결과를 직접 참조하도록 한다.

---

## Decision

### 원칙: "배관을 고치지 말고, 물이 흐르는 경로를 만들어라"

렌더링 파이프라인(캐시, 타이밍, 강제 갱신)을 수정하는 대신, **데이터가 필요한 곳에 직접 전달**한다.

### 패턴: `_containerWidth` / `_containerHeight` Props Injection

#### Phase 1: Tag (완료)

```
ElementSprite (finalWidth/finalHeight)
  → specProps._containerWidth = finalWidth
  → specProps._containerHeight = finalHeight
  → Tag.spec.ts shapes()
    → containerWidth에서 우측 역산 배치
    → containerHeight / 2로 정확한 세로 중앙
```

#### Phase 2: Breadcrumbs, Tabs (P2)

```
ElementSprite (finalWidth)
  → specProps._containerWidth = finalWidth
  → Breadcrumbs.spec.ts shapes()
    → containerWidth 기준 crumb 간격 계산 (0.55 추정 제거)
  → Tabs.spec.ts shapes()
    → containerWidth 기준 탭 너비 분배 (0.55 추정 제거)
```

#### Phase 3: Toast, Table, GridList, Skeleton (P3)

```
ElementSprite (finalHeight)
  → specProps._containerHeight = finalHeight
  → shapes()에서 containerHeight / 2로 정확한 세로 중앙
  → size.height / 2 사용 제거
```

---

## Alternatives

### Alternative A: measureTextWidth를 Spec shapes에 전달 (검토 후 보류)

```typescript
// _measuredTextWidth prop으로 실측 텍스트 폭 전달
specProps._measuredTextWidth = measureTextWidth(text, fontSize, fontFamily);
```

**장점**: 텍스트 폭 추정 완전 제거 가능
**단점**: Spec shapes 호출 전에 measureTextWidth 호출 필요 → 성능 비용 (CanvasKit paragraph 생성)
**결정**: Phase 2에서 필요 시 선택적 적용. containerWidth 우측 역산만으로 대부분 해결 가능.

### Alternative B: specShapeConverter에서 containerWidth/Height 역주입 (기각)

```typescript
// specShapeConverter.ts에서 shapes 후처리로 좌표 보정
for (const shape of shapes) {
  if (shape.type === "line" && shape.x1 < 0) {
    shape.x1 = containerWidth + shape.x1; // 음수 → 우측 역산
  }
}
```

**기각 이유**: Spec shapes의 의도를 specShapeConverter가 추측해야 함. 음수 좌표 컨벤션이 다른 용도(backdrop overlay)와 충돌.

### Alternative C: 파이프라인 타이밍 수정 (기각)

**기각 이유**: 위 "실패한 접근" 참조. 3단계 캐시의 연쇄 무효화로 성능 저하 + 부작용.

---

## Risk Assessment

### Alternative A: `_containerWidth`/`_containerHeight` Props Injection (선택)

| 축           | 위험도 | 설명                                                                          |
| ------------ | ------ | ----------------------------------------------------------------------------- |
| 기술         | **L**  | ElementSprite에서 이미 `finalWidth`/`finalHeight` 보유, props 추가만으로 구현 |
| 성능         | **L**  | 추가 연산 0. 기존 데이터 흐름에 props 1~2개 추가                              |
| 유지보수     | **L**  | Spec마다 `_containerWidth`/`_containerHeight` 사용 여부 선택 가능             |
| 마이그레이션 | **L**  | 기존 Spec 무변경, 필요한 Spec만 점진 적용                                     |

### Alternative C: 파이프라인 수정 (기각)

| 축           | 위험도 | 설명                                                |
| ------------ | ------ | --------------------------------------------------- |
| 기술         | **H**  | 3단계 캐시 타이밍 의존, 연쇄 부작용                 |
| 성능         | **H**  | `notifyLayoutChange()` → 전체 Skia 트리 재빌드 O(N) |
| 유지보수     | **C**  | 새 캐시 레이어 추가 시 매번 타이밍 재검증 필요      |
| 마이그레이션 | **M**  | 5+ 파일 수정, 기존 캐시 로직 변경                   |

---

## Implementation Plan

### Phase 1: Tag (완료) ✅

- [x] `Tag.spec.ts`: `_containerWidth`/`_containerHeight` props, 우측 역산 X 배치, `containerHeight/2` 세로 중앙
- [x] `ElementSprite.tsx`: specProps에 `_containerWidth`/`_containerHeight` 주입
- [x] `TagGroupEditor.tsx`: `updateSelectedPropertiesWithChildren` atomic batch update
- [x] `layoutCache.ts`: `LAYOUT_PROP_KEYS`에 `allowsRemoving` 추가
- [x] `Tag.spec.ts`: `lineHeight` 필드 추가 (CSS line-height 토큰 동기화)

### Phase 2: Breadcrumbs + Tabs (P2) — 적용 권장

**대상 파일**:

- `packages/specs/src/components/Breadcrumbs.spec.ts` — `fontSize * 0.55`, `fontSize * 0.35` 제거
- `packages/specs/src/components/Tabs.spec.ts` — `fontSize * 0.55` 제거

**접근**:

1. `_containerWidth` 주입 (Phase 1과 동일 패턴)
2. Breadcrumbs: containerWidth 기준 crumb 균등 분배 또는 비례 배치
3. Tabs: containerWidth 기준 탭 너비 분배

**예상 규모**: 2파일 수정, ~40줄

### Phase 3: Toast + Table + GridList + Skeleton — 보류 (버그 리포트 시 적용)

**대상 파일**:

- `packages/specs/src/components/Toast.spec.ts` — `size.height / 2` → `_containerHeight / 2`
- `packages/specs/src/components/Table.spec.ts` — `size.height / 2` → `_containerHeight / 2`
- `packages/specs/src/components/GridList.spec.ts` — `fontSize * 0.6/0.8` → `_containerHeight` 기반
- `packages/specs/src/components/Skeleton.spec.ts` — `size.height / 2` → `_containerHeight` 기반

**예상 규모**: 4파일 수정, ~30줄

### StatusLight (utils.ts) — 보류 (별도 접근 필요)

- `apps/builder/src/.../layout/engines/utils.ts` L843 — `text.length * fontSize * 0.6`
- Spec이 아닌 레이아웃 엔진 내부이므로 `_containerWidth` 패턴 적용 불가, 별도 접근 필요

---

## Phase별 ROI 분석

### Tier 1: `_containerWidth` (텍스트 폭 추정 제거) — Breadcrumbs, Tabs

| 기준       | 분석                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| **효과**   | **높음** — `fontSize * 0.55` 추정 제거, 폰트/다국어 정합성 보장                       |
| **리스크** | **M** — 기존 `0.55` 추정과 다른 결과 → 시각적 변화 반드시 발생, 모든 사이즈 검증 필요 |
| **ROI**    | **높음** — CJK/아랍어 등 글자폭이 다른 폰트에서 간격 오류 근본 해결                   |
| **권장**   | **적용**                                                                              |

### Tier 2: `_containerHeight` (세로 중앙) — Toast, Table, GridList, Skeleton

| 기준       | 분석                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| **효과**   | **낮음** — `size.height/2` → `containerHeight/2`는 1~2px(border) 차이, 육안 거의 불가 |
| **리스크** | **L** — 1px 차이라 회귀해도 영향 미미                                                 |
| **ROI**    | **낮음** — 수정 4곳 대비 시각적 개선 미미                                             |
| **권장**   | **보류** — 실제 버그 리포트 시 적용                                                   |

### Tier 3: StatusLight (utils.ts) — 레이아웃 엔진 내부

| 기준       | 분석                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------- |
| **효과**   | 높음 — `0.6` 추정 제거                                                                        |
| **리스크** | **M** — Spec이 아닌 레이아웃 엔진이라 `_containerWidth` 패턴과 다른 접근 필요, 패턴 혼재 위험 |
| **ROI**    | 중간 — TextMeasurer fallback이 이미 존재 (L841-842)                                           |
| **권장**   | **보류** — 별도 설계 필요                                                                     |

### 유틸화 판단

| 기준                    | 분석                                                            |
| ----------------------- | --------------------------------------------------------------- |
| **절대 좌표 역산 필요** | Tag, Breadcrumbs, Tabs — **3곳**뿐                              |
| **단순 centerY**        | Toast, Table, GridList, Skeleton — `ch / 2` 한 줄               |
| **인라인 코드**         | `typeof props._containerWidth === "number" ? ... : 0` — 3줄     |
| **결론**                | **유틸 불필요** — 3곳을 위한 추상화는 과잉. 10곳 이상 시 재검토 |

---

## Performance Comparison

| 기준               | 파이프라인 수정                                     | 데이터 주입 (이 ADR)       |
| ------------------ | --------------------------------------------------- | -------------------------- |
| 추가 연산          | `publishLayoutMap` 동기 호출 + `notifyLayoutChange` | **0** (기존 데이터 전달만) |
| Skia 재렌더링 범위 | 전체 트리 재빌드 O(N)                               | 변경 노드만 O(1)           |
| React 렌더 횟수    | +1~2 사이클 (invalidateLayout)                      | 추가 없음                  |
| 캐시 무효화        | command stream 전체                                 | 해당 노드만                |
| 메모리             | Map 복사 + version 증가                             | props 2개 추가             |

---

## Gates

| Phase | 게이트                                                                      | 시점            | 실패 시 대안                                   |
| ----- | --------------------------------------------------------------------------- | --------------- | ---------------------------------------------- |
| 2     | Breadcrumbs/Tabs 시각적 검증 — 텍스트 폭 추정 제거 후 crumb/tab 간격 정확성 | Phase 2 완료 시 | `_measuredTextWidth` prop 추가 (Alternative A) |
| 3     | 전체 Spec 시각적 회귀 테스트 — 기존 컴포넌트 렌더링 변경 없음 확인          | Phase 3 완료 시 | fallback 값 조정                               |

---

## References

- `.claude/skills/composition-patterns/rules/spec-container-dimension-injection.md` — 코드 패턴 상세
- `.claude/rules/canvas-rendering.md` — Canvas 렌더링 규칙 (Spec Container Dimension Injection 섹션)
- `apps/builder/src/.../sprites/ElementSprite.tsx` — specProps 주입 경로
- `apps/builder/src/.../skia/specShapeConverter.ts` — Shape → SkiaNodeData 변환
- `packages/specs/src/components/Tag.spec.ts` — Phase 1 참조 구현
