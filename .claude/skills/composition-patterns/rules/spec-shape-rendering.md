---
title: Shape-based Rendering Pattern (Catalog 기반)
impact: HIGH
impactDescription: DOM/CSS ↔ Skia 시각 대칭 — catalog 단일 소스에서 파생된 Shape 계약
tags: [spec, catalog, shape, rendering, skia]
---

Skia 렌더러는 **플랫폼 독립적 도형(`Shape[]`)** 을 그립니다 (ADR-900 Unified Skia Engine — PixiJS/ElementSprite 삭제 완료). Shape 생성 경로는 두 갈래뿐입니다:

| 경로                    | 대상                                               | 생성기                                                            |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| **catalog 경로 (기본)** | `isCatalogCutover(type)` = true 인 모든 컴포넌트   | `buildCatalogShapes()` (generic box+text) + `skiaPrimitives` 모듈 |
| **잔존 spec 경로**      | catalog 미등록 native 3종 — `frame`/`Group`/`Slot` | `spec.render.shapes()`                                            |

시각 규칙(D3)의 SSOT 는 catalog `COMPONENT_RULES_TABLE` 이며 컴포넌트별 spec 파일이 아닙니다. → [spec-single-source-truth](spec-single-source-truth.md)

## 1. Shape 타입 계약

`packages/specs/src/types/shape.types.ts` 의 `Shape` 유니온 (12종):

| 타입        | 용도                                                              |
| ----------- | ----------------------------------------------------------------- |
| `rect`      | 사각형                                                            |
| `roundRect` | 둥근 모서리 사각형 — `radius: number \| [tl, tr, br, bl]`         |
| `circle`    | 원 (`stroke`/`strokeWidth` 링 표현 지원)                          |
| `arc`       | 부분 원호 — 원형 진행률 등 (`startAngle`/`sweepAngle`, degree)    |
| `text`      | 텍스트 (`maxWidth`/`verticalAlign`/`textDecoration`/`whiteSpace`) |
| `line`      | 선분 (`x1/y1/x2/y2`, `"auto"` 허용)                               |
| `shadow`    | 그림자 — `target` id 지정 또는 직전 shape 에 적용                 |
| `border`    | 테두리 — `target` id 지정 또는 직전 shape 에 적용                 |
| `container` | 자식 Shape 그룹 (`layout` 설정 포함)                              |
| `gradient`  | linear/radial/conic 그라디언트                                    |
| `image`     | 이미지 (`fit`/`radius`)                                           |
| `icon_font` | Lucide SVG path 아이콘 (`iconName` → CanvasKit Path)              |

계약:

- 배경 box 의 `width`/`height` 는 `"auto"` — 변환기가 layout 결과(containerWidth/Height)로 대체
- 색상 값(`fill`/`stroke`/`color`)은 `ColorValue = TokenRef | string | number` — TokenRef 는 런타임 해소 (→ [spec-token-usage](spec-token-usage.md))

## 2. Catalog 경로 — buildCatalogShapes + skiaPrimitives

dispatch: `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` (`usesGeneric = isCatalogCutover(type)`)

```
COMPONENT_RULES_TABLE      packages/shared/src/catalog/generated/componentRulesTable.ts
  → resolveComponentRule()   packages/shared/src/catalog/resolvers/resolveComponentRule.ts
  → resolveSkiaVisualRule() / ruleVariantToVisual()
                             apps/builder/src/builder/workspace/canvas/skia/resolveSkiaVisualRule.ts
  → buildCatalogShapes(visual, props, size, state, textDecoration)
                             packages/specs/src/renderers/buildCatalogShapes.ts:110
  (+ binding.skiaPrimitive draw module → composeCatalogShapes(base, prepend, append))
  → specShapesToSkia()       apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts:144
  → SkiaNodeData → nodeRenderers
```

- **buildCatalogShapes** 는 모든 frame 이 공유하는 **보편 box+text** (bg roundRect + border + text)만 그립니다. 색/크기는 `visual.fill`(ADR-908 `FillTokenSpec`) + `sizes[size]` + `props.style` 우선 오버라이드에서 읽습니다. 패키지 경계(`specs ← shared`)상 rule 테이블은 builder(`buildSpecNodeData`)가 해소하여 `visual` 인자로 주입합니다.
- **비-DOM-trivial primitive**(원/선/아이콘/arc 등)는 `PrimitiveBinding.skiaPrimitive` 키(`packages/shared/src/catalog/types.ts:111`) → `packages/specs/src/renderers/skiaPrimitives.ts` 의 `SKIA_PRIMITIVES` draw module 이 담당. 합성 모드: `replace` / `prepend`(base 아래 레이어) / `append`(base 위 레이어). draw fn 이 `null` 반환 = "이 props 에는 미적용" → generic box+text fallback.

### 금지 — 컴포넌트 식별 분기 인라인

```tsx
// ❌ buildCatalogShapes / skiaPrimitives 함수 안에 컴포넌트 식별 분기 — 컴포넌트 N++ 복제
if (type === "Badge") { ... }
if (props.isDot) { /* Badge 전용 circle 을 generic 함수에 인라인 */ }

// ✅ binding 데이터(skiaPrimitive 키)로 표현 — 적용 조건은 draw fn 의 null 반환으로 처리
// packages/shared/src/catalog/bindings/{Component}.binding.ts
skiaPrimitive: "dot",
// packages/specs/src/renderers/skiaPrimitives.ts
const dot: SkiaPrimitiveDrawFn = ({ props }) =>
  props.isDot === true ? [/* circle shapes */] : null; // null → generic fallback
```

데이터 키 유무 분기(`_treeLevel` / `_groupPosition`)는 허용 — 컴포넌트 식별이 아닙니다 (`resolveTreeIndent` / `resolveSegmentedRadius`, buildCatalogShapes.ts).

## 3. 잔존 spec (Frame/Group/Slot) shapes 규약

`packages/specs/src/components/{Frame,Group,Slot}.spec.ts` 3개만 `spec.render.shapes()` 경로에 도달합니다 (buildSpecNodeData 게이트 — catalog 미등록 type 전용).

- `_hasChildren` 주입 시 실렌더 shape 반환 금지 — Frame 은 빈 배열 반환, Group 은 투명 처리 (Child Composition). 3-branch 주입 규칙: `.claude/rules/canvas-rendering.md` §2.5
- Frame = D3 layout container (`skipCSSGeneration: true`, ARIA role 없음) / Group = RAC ARIA semantic (D1) — Group 에 시각 책임 추가 금지 (ADR-130)
- **신규 컴포넌트에 `render.shapes()` spec 신설 금지** — catalog 등록(binding + `COMPONENT_RULES_TABLE` rule)이 정본 경로

## 4. Fill 접근 — resolveFillTokens 경유 (ADR-908)

```tsx
// ❌ 금지 — legacy background 필드는 타입에서 삭제됨 (compile error)
const bg = state === "hover" ? variant.backgroundHover : variant.background;

// ✅ 단일 진입점 — packages/specs/src/utils/fillTokens.ts:26
import { resolveFillTokens } from "../utils/fillTokens";
const fill = resolveFillTokens(variant); // → variant.fill (FillTokenSpec)
const bg =
  state === "hover"
    ? (fill.default.hover ?? fill.default.base)
    : state === "pressed"
      ? (fill.default.pressed ?? fill.default.base)
      : fill.default.base; // hover/pressed 는 optional → base fallback 필수
```

buildCatalogShapes 는 주입받은 `visual.fill` 에서 동일 구조를 소비합니다 — `fillStyle` prop(`outline`/`subtle`) × state 2축 + `isSelected`/`isEmphasized` 직교축. indicator 는 `resolveIndicatorFill(im)` (fillTokens.ts:33).

## 5. specShapeConverter 생존 규칙

`specShapesToSkia()` (specShapeConverter.ts:144) 가 Shape[] → SkiaNodeData 로 변환합니다. text shape 의 **maxWidth 자동 축소** (`maxWidth` 미지정 + `x > 0` 시):

| 조건                       | maxWidth                                    |
| -------------------------- | ------------------------------------------- |
| `align: "right"` + `x > 0` | `shape.x` (x 를 우측 경계로 해석)           |
| `align: "center"`          | `containerWidth - x * 2` (양쪽 대칭 여백)   |
| 그 외                      | `containerWidth - x`                        |
| 결과 < 1                   | `containerWidth` 로 클램프 (padding=0 안전) |

- 배경 box 에 border 가 있으면 텍스트 maxWidth 에서 `bgBorderWidth * 2` 추가 차감
- **shape.x ↔ 레이아웃 폭 정합**: text shape 의 `x`(인디케이터 폭 + gap)와 layout engine 이 계산한 컴포넌트 폭의 근거 값이 어긋나면 자동 축소가 잘못된 기준으로 동작 → 오발 줄바꿈. 양쪽 모두 같은 catalog rule sizes 에서 파생해야 합니다 (→ [spec-value-sync](spec-value-sync.md))
- TokenRef radius(segmented four-corner 배열 요소 포함)는 변환기가 런타임 해소 — 생성기에서 number 로 강제 게이트하면 TokenRef 케이스가 skip 됩니다 (2026-06-27 segmented radius 버그)
- `resolveNum()` / `resolveColor()` (TokenRef → number/색상) 구현 위치도 specShapeConverter.ts

## 6. Column layout / dimension 주입

- `rearrangeShapesForColumn()` (`apps/builder/src/builder/workspace/canvas/skia/specBuildHelpers.ts:25`) — Checkbox/Radio/Switch 류 indicator↔label 수직 재배치. shapes 는 항상 row 좌표로 생성하고 column 방향은 이 변환으로 처리 (호출: buildSpecNodeData.ts:1499)
- 레이아웃 결과 폭/높이가 필요한 shape(우측 역산 배치 등)는 `_containerWidth`/`_containerHeight` props 주입 — `CONTAINER_DIMENSION_TAGS` (buildSpecNodeData.ts:96). 상세: [spec-container-dimension-injection](spec-container-dimension-injection.md)

## 삭제된 지침 — 참조/부활 금지

- 컴포넌트별 spec shapes 지침 (Card/Slider/Select/ComboBox/Tabs/TagGroup 등) — 해당 spec 파일은 ADR-912 로 전부 삭제됨. 시각 수정은 catalog rule + skiaPrimitives 에서
- `_hasLabelChild` / `SELF_PADDING_TAGS` / `DropflowBlockEngine` / `isYogaSizedContainer` — 심볼 0건 (grep 확증 2026-07-07)
- `ElementSprite.tsx` / `Pixi*.tsx` (PixiButton 등) — ADR-900 으로 물리 삭제 (역사적 주석만 잔존)

## 참조

- `packages/specs/src/types/shape.types.ts` — Shape 타입 정의
- `packages/specs/src/renderers/buildCatalogShapes.ts` / `skiaPrimitives.ts` / `composeCatalogShapes.ts`
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — dispatch + props 주입
- `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts` — Shape[] → SkiaNodeData
- `.claude/rules/canvas-rendering.md` — `_hasChildren` 3-branch / Fill Spec Schema SSOT
- `docs/adr/completed/900-unified-skia-rendering-engine.md` — Unified Skia Engine
