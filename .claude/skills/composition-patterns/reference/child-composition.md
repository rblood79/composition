# Child Composition — 자식 합성 구현 상세 (현행)

> **정본 분리**: `_hasChildren` 3-branch 원칙·판정 알고리즘·금지 패턴은 [canvas-rendering.md](../../../rules/canvas-rendering.md) §2.5 정본. 텍스트 측정 원칙 (3곳 동기화, Layout 보정 금지) 은 같은 파일 §3 정본. 본 문서는 **코드 레벨 부연**만 담는다.
>
> **역사적 맥락**: "Child Spec 등록 표" · per-child `TAG_SPEC_MAP` 등록은 ADR-912 로, `useSyncChildProp` 훅은 그 전에 소멸했다. ADR-248 Phase 4 (2026-10-03) 에서 factory 자식 생성 · `buildSpecNodeData.ts` · `StoreRenderBridge.ts` · `entryUniverse.ts` · `PropertiesPanel.tsx` 의 `updateSelectedPropertiesWithChildren` 경로가 삭제됐다. 구 문서의 "`Math.ceil()+2` 텍스트 폭 보정 필수" 는 Layout 보정 금지 원칙과 모순이었고 코드에서도 제거됐다 — 교정은 렌더링 단 post-layout 에서 한다 (§4).

## 1. 현행 자식 합성 흐름

```
palette 삽입
  → insertNodes — 노드 1개 (합성이면 reusable origin instance)
  → resolver 가 정의 템플릿 (templateRootId) 을 펼쳐 자식 위치를 만든다
  → CatalogConsumerNode 트리 (composition root)
     DOM (Preview)  — domBinding.tsx 가 RAC 합성
     Canvas         — canvasBinding.ts binding / ruleShapes.ts rule 실행기
                      + rulePaint.ts 의 _hasChildren 3-branch 로 부모/자식 렌더 분담 결정
```

자식 type (SelectValue, SelectIcon, CalendarGrid 등) 도 독립 catalog entry (`COMPONENT_RULES_TABLE` + binding) 로 시각이 정의된다. 템플릿 구조와 생성 경로는 [compositional-architecture.md](compositional-architecture.md) §1–§2.

## 2. `_hasChildren` 3-branch — rulePaint.ts 구현

위치: `apps/builder/src/builder/catalogRuntime/rulePaint.ts` (옛 `buildSpecNodeData.ts` 의 같은 로직이 이름만 바뀌어 옮겨졌다).

### 멤버십 (파일이 정본 — 본 문서에 복제하지 않음)

- `SHELL_ONLY_TYPES` — 17개 (Calendar/RangeCalendar/Card/Dialog/…/body), 모듈 비공개
- `CHILD_PROP_MERGE_TYPES` — 9개 (Breadcrumbs/ComboBox/GridList/Select/Table/Tabs/TagGroup/Toolbar/Tree), export (옛 `SYNTHETIC_CHILD_PROP_MERGE_TAGS`)

| 소비처                                                       | 효과                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `rulePaint.ts` `_hasChildren` 주입                           | CHILD_PROP_MERGE 면 주입 skip                                                                                              |
| `ruleShapes.ts` `catalogRuleShapes` 의 `shellProps`          | CHILD_PROP_MERGE 면 컨테이너의 children/text/label/**placeholder** 를 undefined 처리 — 자식 노드와의 텍스트 이중 렌더 차단 |
| `compositionRoot.ts` `planInstances` (`partRuleChildren` 등) | 부모 · 자식 · 형제 의존 재계획 — 이번 step 에 계획된 record 를 먼저 읽는다 (옛 stale 자식 ref 교체의 현행 형태)            |

### 주입 로직

```typescript
if (SHELL_ONLY_TYPES.has(type)) props._hasChildren = true;
else if (
  type !== "TreeItem" &&
  !CHILD_PROP_MERGE_TYPES.has(type) &&
  node.children.length > 0
)
  props._hasChildren = true;
```

- **Shell-only**: 자식 수 무관 항상 주입 — 자식을 모두 지워도 standalone 복귀 금지.
- **Child-prop-merge**: 주입 차단 — 부모 shapes 가 자식 props 를 통합 렌더.
- **Plain**: 자식 있을 때만 주입.
- **TreeItem 예외**: 자식 TreeItem 이 있어도 자기 행 (chevron+label) 을 그려야 하므로 제외.

소비 측: `buildCatalogShapes` 는 `_hasChildren` 이면 shell (bg+border) 만 반환하는 early return 을 갖고, CHILD_PROP_MERGE 의 text 차단 (`shellProps`) 과 직교로 동작한다.

## 3. 부모 prop → 자식 반영

Properties 편집은 `catalogSemanticPatchCommand` / `catalogPropertiesPatchCommand` (`catalogRuntime/editContract.ts`) → `workspace.execute` 한 step 이다. 자식에 값을 **복사해 쓰지 않는다** — 자식은 읽는 시점에 아래 채널로 부모 값을 받는다 (Canvas · DOM 공용):

- `{prop}` template binding (`resolution/resolver.ts`)
- `CATALOG_SIZE_PROPAGATION` (`document/sizePropagation.ts`) — 옛 `propagationRegistry` 의 `override: true` 규칙 (쓰기 시 복사) 을 대체
- `catalogDerivedProps` (`catalogRuntime/presence.ts`) — Progress/Meter track fill 등
- part rules (`document/rulePartRules.ts`)

부모와 자식을 실제로 함께 바꿔야 하는 편집은 `composeCommands` 로 한 entry 에 묶는다 (state-management.md).

`utils/propagationRegistry.ts` · `propagationEngine.ts` 의 importer 는 `fullTreeLayout.ts` · `implicitStyles.ts` 뿐이다 — parity 하니스 전용 ([layout-engine.md](../../../rules/layout-engine.md)).

## 4. 텍스트 측정 정합 — 생존 심볼

원칙 정본은 canvas-rendering.md §3. 현행 위치:

| 역할                       | 위치                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 레이아웃 측정 (production) | `catalogRuntime/textMeasure.ts` `catalogTextMeasure` — CanvasKit 준비 후엔 **Canvas 가 그릴 paragraph 로 측정** (Pretendard cv11 같은 기본 font feature 반영), 준비 전엔 Canvas 2D fallback. `main/CatalogBuilderCore.tsx` 가 composition root 에 주입 |
| 페인트 줄바꿈 hint         | `skia/nodeRendererText.ts` — Canvas 2D 가 정한 줄바꿈을 `\n` 으로 넣어 CanvasKit 에 강제 (ADR-051, `needsFallback` 이면 생략)                                                                                                                          |
| 스타일 계약 인터페이스     | `canvas/utils/textMeasure.ts` `TextMeasureStyle`                                                                                                                                                                                                       |
| 렌더러 ParagraphStyle      | `skia/nodeRendererText.ts` `renderText()` — `halfLeading: true`                                                                                                                                                                                        |
| `extractSpecTextStyle`     | `canvas/utils/specTextStyle.ts` — importer 는 `engines/utils.ts` · `fullTreeLayout.ts` 뿐 (parity 전용)                                                                                                                                                |

- 측정용 / 렌더용 ParagraphStyle 은 폭·높이에 영향을 주는 속성 (fontSize, fontFamilies, fontWeight, fontStyle, fontStretch, letterSpacing, wordSpacing, fontVariant→fontFeatures, heightMultiplier+halfLeading) 을 같게 유지한다.
- **주의**: 레이아웃 측정 (CanvasKit paragraph) 과 페인트 줄바꿈 hint (Canvas 2D) 의 기준이 다르다. 줄 수가 갈리면 두 측정기의 차이부터 본다.

### 폭 오차 처리 — layout 이 아닌 렌더링 단 post-layout 교정

layout 경로에 보정치를 넣지 않는다. 교정은 `nodeRendererText.ts` 가 `paragraph.layout()` 뒤에 한다:

- `layoutMaxWidth >= 100000 && !isEllipsis` (nowrap/pre 의 사실상 무한 폭) — CanvasKit 내부 버그 (텍스트 미표시) 회피: `getMaxIntrinsicWidth() + 1` 로 재layout. ellipsis 는 예외 (재layout 하면 "…" 이 사라진다, 2026-09-20).
- `\n` 없는 단일줄 텍스트를 CanvasKit 이 오발 줄바꿈한 경우 (`getLineMetrics().length > 1`): `getMaxIntrinsicWidth() + 1` 로 재layout. break-all/break-word 변환 경로 (`renderableText !== processedText`) 는 legitimate wrap 이므로 skip.

## 5. 신규 자식 type 추가 시 체크리스트

1. **catalog**: `COMPONENT_RULES_TABLE` entry + `bindings/{Name}.binding.ts` (box+text 로 부족하면 `skiaPrimitive` escape 키, draw module 은 `skiaPrimitives.ts`)
2. **템플릿**: 부모 origin 템플릿 (`reusableOriginLibrary.ts`) 에 자식 노드 추가 + 중첩 규칙 (`nesting/nestingRules.ts`)
3. **3-branch 재판정**: 부모가 자식 props 를 shapes 에 통합하면 `CHILD_PROP_MERGE_TYPES` (placeholder 포함 text 이중 렌더 주의), 템플릿이 시각을 자식으로 전부 대체하면 `SHELL_ONLY_TYPES`. 판정 절차는 canvas-rendering.md §2.5
4. **값 전달**: §3 채널 중 하나 (새 채널 금지)
5. **컨테이너 폭 의존 shape**: 우측/중앙 좌표가 상자 폭에 의존하면 `BOX_SIZE_TYPES` (`ruleShapes.ts`) 등록
6. 검증: `pnpm type-check` + `/cross-check` + 자식 전체 삭제 시 shell 유지 (shell-only) / standalone 복귀 (plain) 의도 확인
