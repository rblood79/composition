# Child Composition — 자식 합성 구현 상세 (현행)

> **정본 분리**: `_hasChildren` 3-branch 원칙·판정 알고리즘·금지 패턴은 [canvas-rendering.md](../../../rules/canvas-rendering.md) §2.5 정본. 텍스트 측정 원칙(3곳 동기화, Layout 보정 금지)은 같은 파일 §3 정본. 본 문서는 **코드 레벨 부연**만 담는다.
>
> **역사적 맥락 (1구획)**: 구 문서의 "Child Spec 등록 표" (LabelSpec/FieldErrorSpec/SliderTrackSpec 등 13행) 와 `TAG_SPEC_MAP` per-child 등록 절차는 ADR-912 spec 물리 삭제로 소멸했다. `useSyncChildProp`/`useSyncGrandchildProp` 훅도 삭제됨 (grep 0건) — prop 동기화는 propagation registry 로 일원화됐다. 구 문서의 "`Math.ceil()+2` 텍스트 폭 보정 필수(CRITICAL)" 서술은 정본 canvas-rendering.md §3 "Layout 보정 금지" 와 모순이었고, 현행 코드에서 해당 보정은 layout 경로에서 제거됐다 (`engines/utils.ts` grep 0건) — 교정은 렌더링 단 post-layout 에서 수행한다 (§4).

## 1. 현행 자식 합성 흐름

```
palette drop
  → factory ComponentDefinition.children (자식 Element 자동 생성)
  → canonical document children 배열 (순서 SSOT)
  → 렌더:
     DOM(Preview)  — catalog binding renderer 가 RAC 합성
     Skia(builder) — buildSpecNodeData 가 노드별 shape 생성
                      + _hasChildren 3-branch 로 부모/자식 렌더 분담 결정
```

자식별 독립 spec 등록은 없다. 자식 type (SelectValue, SelectIcon, CalendarGrid 등)도 catalog entry (`COMPONENT_RULES_TABLE` + binding) 로 시각이 정의되고, `isCatalogCutover(type)` 게이트로 Skia generic 경로에 진입한다.

## 2. `_hasChildren` 3-branch — buildSpecNodeData.ts 구현

위치: `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`

### 멤버십 (파일이 정본 — 본 문서에 복제하지 않음)

- `SHELL_ONLY_CONTAINER_TAGS` (`:153`) — 17개 (Calendar/RangeCalendar/Card/Dialog/…/body)
- `SYNTHETIC_CHILD_PROP_MERGE_TAGS` (`:214`) — 9개 (Breadcrumbs/ComboBox/GridList/Select/Table/Tabs/TagGroup/Toolbar/Tree)

`SYNTHETIC_CHILD_PROP_MERGE_TAGS` 는 ADR-914 Phase 6 에서 entry universe `childRuntime.syntheticPropMerge` facet 의 **membership SSOT** 로 명문화됐다 — `entryUniverseContract.test.ts` 가 `syntheticPropMerge ⟺ set.has(type)` 양방향 parity 를 검증한다. 소비처 5곳 전부 단순 `set.has(type)` boolean 분기:

| 소비처                                     | 효과                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| buildSpecNodeData `shellOnlyProps`         | SYNTHETIC 면 컨테이너 노드의 children/text/label/**placeholder** 를 undefined 처리 — 자식 element 와의 텍스트 이중 렌더 차단 |
| buildSpecNodeData `_hasChildren` 주입 가드 | SYNTHETIC 면 주입 skip                                                                                                       |
| `StoreRenderBridge.ts:315/320`             | incrementalSync 자식 변경 → 부모 rebuild expansion                                                                           |
| `StoreRenderBridge.ts:549`                 | stale 자식 ref 교체                                                                                                          |
| `entryUniverse.ts:140`                     | facet mirror                                                                                                                 |

### 주입 로직 실코드 (`:1404-1413`)

```typescript
if (SHELL_ONLY_CONTAINER_TAGS.has(type)) {
  specProps = { ...specProps, _hasChildren: true };
} else if (
  type !== "TreeItem" &&
  !SYNTHETIC_CHILD_PROP_MERGE_TAGS.has(type) &&
  childElements &&
  childElements.length > 0
) {
  specProps = { ...specProps, _hasChildren: true };
}
```

- **Shell-only**: 자식 수 무관 항상 주입 — 자식을 모두 삭제해도 standalone 복귀 금지.
- **Synthetic-merge**: 주입 차단 — 부모 shapes 가 자식 props/projection 을 통합 렌더.
- **Plain**: 자식 있을 때만 주입.
- **TreeItem 예외**: 자식 TreeItem 이 있어도 자기 행(chevron+label)을 그려야 하므로 `_hasChildren` 제외. chevron 표시 조건은 별도 `_hasTreeChildren` (+ `_treeLevel` depth) 로 분리 주입 (`:1381-1389`).

소비 측: `buildCatalogShapes` 는 `_hasChildren` 이면 shell(bg+border)만 반환하는 early return 을 갖고, SYNTHETIC 의 text 차단(`shellOnlyProps`, `:1032-1040`)과 직교로 동작한다 — 둘 중 하나만 성립해도 shell-only.

## 3. 자식 prop 편집 동기화 — propagation registry 단일 경로

부모 컨테이너의 prop 을 Properties Panel 에서 편집하면 자식 Element 의 대응 prop 도 갱신돼야 한다. 현행 경로는 두 층으로 나뉜다 — **Store 갱신 (Inspector 경로)** 과 **렌더 시점 투영 (Skia 경로)** 이 같은 registry 를 소비한다.

### 규칙 정의 — propagationRegistry

`apps/builder/src/builder/utils/propagationRegistry.ts` (ADR-048): `PropagationRule` (`packages/specs/src/types/spec.types.ts:676`) 을 정방향/역방향 인덱스로 관리. spec 삭제 후 각 컴포넌트의 규칙은 `createPropagationOnlySpec` 인라인으로 이 파일에 이관됐다 (Select/ComboBox/Slider/DateField/Calendar/TagGroup 등 — 파일 상단 이력 주석 참조).

- `childPath: string` — 직계 자식 매칭
- `childPath: string[]` — 중첩 경로 (손자). 예: Slider `["SliderTrack","SliderThumb"]`. **string 은 직계만 매칭하므로 손자 규칙에 string 사용 시 dead rule**

### Inspector 경로 (Store 갱신, 단일 batch 히스토리)

`apps/builder/src/builder/panels/properties/PropertiesPanel.tsx:234-268` `handleSemanticUpdate`:

```typescript
const rules = getPropagationRules(propagationElement.type);
if (rules && rules.some((r) => typeof r.parentProp === "string" && r.parentProp in changedProps)) {
  const childUpdates = buildPropagationUpdates(propagationElement, changedProps, rules, ...);
  if (childUpdates.length > 0) {
    state.updateSelectedPropertiesWithChildren(changedProps, batchChildUpdates);
    return;
  }
}
state.updateSelectedProperties(changedProps);
```

- `buildPropagationUpdates` (`apps/builder/src/builder/utils/propagationEngine.ts:113`) — childrenMap 으로 중첩 childPath 해석, 동일 elementId merge.
- `updateSelectedPropertiesWithChildren` (`apps/builder/src/builder/stores/inspectorActions.ts:904`) — 부모+자식을 **단일 batch** 로 구성 → `batchUpdateElementProps` (단일 set + batch 히스토리 1 entry + IndexedDB). Undo 1회로 전체 원복.
- component instance 선택 시 분기: `buildInstanceDescendantPatches` → descendants mirror field 로 저장 (`:911-926`).
- 다른 소비처: `panels/properties/editors/SliderEditor.tsx:68`.

### Skia 경로 (렌더 시점 방어 투영)

`buildSpecNodeData.ts` 의 `applyParentPropagationProps` 가 동일 registry 규칙을 조상 체인에서 해석해 자식 specProps 에 주입한다 (`propagationPathMatches` 로 childPath 경로 검증). Store 값이 없는 경로(마이그레이션 직후, 순수 로드)에서도 Canvas 가 CSS 경로와 동일 시각을 내기 위한 방어층 — `resolveTagListItemsFromParent` 주석이 이 상보 관계를 명시한다.

## 4. 텍스트 측정 정합 — 생존 심볼

원칙 정본은 canvas-rendering.md §3 (3곳 동시 업데이트, fontFamilies 배열 정합, strutStyle, **Layout 보정 금지**). 현행 심볼 위치:

| 역할                            | 위치                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 측정기 (CanvasKit Paragraph)    | `apps/builder/src/builder/workspace/canvas/utils/canvaskitTextMeasurer.ts`                                                              |
| 스타일 계약 인터페이스          | `canvas/utils/textMeasure.ts:28` `TextMeasureStyle`                                                                                     |
| Spec/catalog 텍스트 스타일 추출 | `canvas/utils/specTextStyle.ts:183` `extractSpecTextStyle(tag, props)` — 텍스트 props 없이 호출 금지 (null 반환 → fallback 측정 불일치) |
| 렌더러 ParagraphStyle           | `canvas/skia/nodeRendererText.ts:88` `renderText()` — `halfLeading: true` (`:375/:419/:550`)                                            |

측정용/렌더용 ParagraphStyle 은 폭·높이에 영향을 주는 속성(fontSize, fontFamilies, fontWeight, fontStyle, fontStretch, letterSpacing, wordSpacing, fontVariant→fontFeatures, heightMultiplier+halfLeading)을 동일하게 유지해야 한다.

### 폭 오차 처리 — layout 이 아닌 렌더링 단 post-layout 교정

Canvas 2D ↔ CanvasKit 의 sub-pixel 측정 차이는 **layout 경로에 보정치를 넣지 않는다** (Layout = Canvas 2D = CSS 정합 원칙). 교정은 `nodeRendererText.ts` 가 `paragraph.layout()` 후 수행:

- `:563-570` — `layoutMaxWidth >= 100000` (nowrap/pre 의 사실상 무한 폭) 시 CanvasKit 내부 버그(텍스트 미표시) 회피: `getMaxIntrinsicWidth() + 1` 로 재layout.
- `:581-596` — `\n` 없는 단일줄 텍스트를 CanvasKit 이 오발 줄바꿈한 경우 (`getLineMetrics().length > 1`): `getMaxIntrinsicWidth() + 1` 로 재layout. break-all/break-word 변환 경로(`renderableText !== processedText`)는 legitimate wrap 이므로 skip.

CanvasKit 자체 측정 기반이므로 경험적 tolerance(+2 등) 불필요 — layout 경로(`engines/utils.ts` 의 `calculateContentWidth` 등)에 보정 추가는 금지 패턴 (canvas-rendering.md §3, §7).

## 5. 신규 자식 type 추가 시 체크리스트

1. **catalog**: `COMPONENT_RULES_TABLE` entry + `bindings/{Name}.binding.ts` — 자식 type 도 독립 catalog entry (box+text 로 부족하면 `skiaPrimitive` escape 키 등록, draw module 은 `skiaPrimitives.ts`)
2. **factory**: 부모 `create{Parent}Definition` 의 `children` 에 `ChildDefinition` 추가 (재귀 중첩 가능)
3. **3-branch 재판정**: 부모가 자식 props 를 shapes 에 통합하면 SYNTHETIC (text 이중 렌더 주의 — placeholder 포함), factory 가 시각을 자식으로 전부 대체하면 SHELL_ONLY. 판정 절차는 canvas-rendering.md §2.5
4. **prop 동기화**: 부모 prop 편집이 자식에 반영돼야 하면 `propagationRegistry.ts` 규칙 추가 — 손자는 `childPath` 배열
5. **컨테이너 폭 의존 shape**: 우측/중앙 좌표가 컨테이너 폭에 의존하면 `CONTAINER_DIMENSION_TAGS` (buildSpecNodeData.ts:96) 등록
6. **layout 보조**: indicator 류 트리 밖 시각이면 implicitStyles 주입 검토 ([compositional-architecture.md](compositional-architecture.md) §4)
7. 검증: `pnpm type-check` + `/cross-check` + 자식 전체 삭제 시 shell 유지 (shell-only) / standalone 복귀 (plain) 의도 확인
