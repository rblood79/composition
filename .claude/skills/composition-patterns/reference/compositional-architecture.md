# Compositional Architecture — 합성 컴포넌트 구성 (현행)

> **정본 분리**: 원칙은 `.claude/rules/` 가 정본이다 — 3-Domain 분할은 [ssot-hierarchy.md](../../../rules/ssot-hierarchy.md), `_hasChildren` 3-branch / container pipeline 은 [canvas-rendering.md](../../../rules/canvas-rendering.md) §2.5/§2.6, 문서 · 명령 · 편집 파이프라인은 [state-management.md](../../../rules/state-management.md). 본 문서는 **구현 상세와 파일 경로**만 다룬다.
>
> **역사적 맥락**: 컴포넌트별 `*.spec.ts` + ElementSprite/PixiJS 체계는 ADR-100 · ADR-912 로 소멸했다. ADR-248 Phase 4 (2026-10-03) 에서 factory 계층 (`factories/definitions/*.ts` · `ComponentFactory.ts` · `useElementCreator` · `entryUniverse.ts`) 과 Skia 진입점 `buildSpecNodeData.ts` 도 삭제됐다. `factories/` 에는 `constants.ts` · `creationStyleDefaults.ts` 만 남았다.

## 1. 3층 구조 — 합성 컴포넌트가 구성되는 방식

| 층                        | 담당                                                                                        | 위치                                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **문서 (CatalogGraph)**   | 노드 트리 — `NodeEntry.children` 배열 순서가 SSOT, 노드는 `definitionId` 로 정의를 가리킨다 | `packages/shared/src/catalog/document/graph.ts` · `types.ts`                                                                                                                                       |
| **library (정의·템플릿)** | 타입 정의 + 합성 컴포넌트의 템플릿 트리 (palette 가 만드는 origin)                          | `ruleTypeDefinition` (`document/ruleDefinition.ts`) · `catalogTypeDefinitionId` (`document/codeCatalogLibrary.ts`) · `REUSABLE_ORIGIN_DEFINITIONS` (`document/generated/reusableOriginLibrary.ts`) |
| **시각 (D3 rule)**        | 색상/크기/변형/구조 CSS                                                                     | `packages/shared/src/catalog/generated/componentRulesTable.ts` (`COMPONENT_RULES_TABLE`) + `catalog/bindings/*.binding.ts`                                                                         |

- 노드의 타입명은 `definitionTypeName` (`commands/context.ts`) 이 `definitionId` 에서 유도한다. 문서 노드에 `type` · `parent_id` 필드는 없다.
- 합성 노드 하나를 만들면 **노드 1개**가 생기고, 자식은 정의의 템플릿 (`DefinitionEntry.templateRootId`) 을 resolver 가 펼쳐 보여 준다 — 자식 레코드를 복제하지 않는다. 템플릿 위치 편집은 instance 의 `DescendantOverride` 로 남는다.

### 시각 SSOT = catalog

- `COMPONENT_RULES_TABLE` 은 **직접 편집 정본** (ADR-912). 생성기는 삭제됐다.
- 소비자: DOM generated CSS (`packages/specs/scripts/generate-css.ts` → `packages/shared/src/components/styles/generated/`), Canvas rule 실행기 (`catalogRuntime/ruleShapes.ts` · `rulePaint.ts`), Styles 패널 preset (`specPresetResolver.ts`).
- 타입 정의에 rule 이 있으면 `ruleTypeDefinition` 이 `definition.ruleId = type` 을 붙인다 — Canvas 는 이 `ruleId` 로 rule 실행기를 고른다.
- binding: `catalog/bindings/{Component}.binding.ts` 의 `PrimitiveBinding` (`catalog/types.ts`) — `source.kind`, `props.accepts` (D2 편집 계약 — Properties 필드 정의), `skiaPrimitive` (비-box 시각의 escape 키), `toRacProps`.
- `isCatalogCutover` (`catalog/cutover.ts`) 는 남아 있지만 catalog Canvas 의 분기 게이트가 아니다 (catalogRuntime 호출 0).

### Canvas 렌더 경로

`catalogRuntime/canvasBinding.ts` 가 레코드마다 하나를 고른다:

```
bindingKey(node) 가 bindings 표에 있음 → 전용 binding
  (composite · frame · group · slot = containerWithAuthoredPaint, radioitems · checkboxitems = container,
   box · icon · selecttrigger · 텍스트 등)
binding 없고 node.ruleId 있음 → ruleNodeData → catalogRuleNodeData / catalogRuleShapes (ruleShapes.ts)
  ├─ binding.skiaPrimitive "replace" → 전용 draw module
  └─ 없으면 buildCatalogShapes — 보편 box+text
둘 다 없음 → throw CATALOG_CANVAS_BINDING_REQUIRED:<definitionId>
rule 이 table 에 없음 → throw CATALOG_CANVAS_RULE_REQUIRED:<ruleId>
```

DOM (Preview) 은 `catalogRuntime/domBinding.tsx` 가 같은 해석 결과 (`CatalogConsumerNode`) 를 렌더한다 — 두 경로는 catalog 의 **대등한 symmetric consumer** (ssot-hierarchy.md D3).

## 2. 대표 사례 — Select (템플릿 자식)

`lib:definition:origin-component-select` (`mode: "composite"`, `accepts: { label }`, `defaults: { label: "Select" }`) 의 템플릿 `lib:template:component-select`:

```
Select (props: label, placeholder, labelPosition, isInvalid …)
├─ Label            props.children = "{label}"   ← template binding
├─ SelectTrigger    layout.display = "flex"
│  ├─ SelectValue   props.children = "Choose an option..."
│  └─ SelectIcon
└─ ListBoxItem origin instance × 4  (lib:definition:origin-component-listbox-item-default)
```

- 옵션은 **ListBoxItem origin instance 자식**이다 (옛 factory 의 `items: StoredSelectItem[]` 데이터 prop 이 아니다).
- `{label}` 은 resolver 의 template binding (`resolution/resolver.ts` `bindTemplateValue`, ADR-148 계약) 이 instance 의 `label` 값으로 채운다.
- 템플릿에는 인라인 `style` 이 없다 — 시각값은 rule 이 준다.

### 생성 경로

- 팔레트 목록: `PALETTE_REUSABLE_ORIGIN_TYPES` (`catalog/componentCatalog.ts`, ADR-228).
- 정의 선택: `catalogPaletteDefinitionId` (`catalogRuntime/paletteInsert.ts`) — origin 이 library 에 있으면 그 origin, 아니면 타입 정의.
- 삽입: `catalogPaletteInsertPlan` → `insertNodes` 명령 (`commands/structure.ts`). 수용 판정은 명령 안의 `assertNestable` (nestingRules).
- `COMPLEX_COMPONENT_TAGS` (`factories/constants.ts`) 의 남은 소비처는 AI 도구 (`services/ai/tools/compositeMode.ts`) 뿐이다.

## 3. D1/D3 경계 — 잔존 spec 3종

`packages/specs/src/components/` 의 spec 은 **Frame / Group / Slot 3개뿐** (`BASE_TAG_SPEC_MAP`, `packages/specs/src/runtime/tagToElement.ts`).

| Spec            | Domain | 잔존 이유                                                                        |
| --------------- | ------ | -------------------------------------------------------------------------------- |
| `Group.spec.ts` | **D1** | RAC ARIA semantic (`role="group"`) — catalog 로 흡수 시 D1 침범                  |
| `Frame.spec.ts` | **D3** | ADR-130 layout container (lowercase `frame`) — ARIA role 없음, RAC Group 과 분리 |
| `Slot.spec.ts`  | —      | 플레이스홀더 컨테이너                                                            |

- catalog Canvas 는 이 3종을 spec shapes 로 그리지 않는다 — `frame` · `group` · `slot` 은 `canvasBinding.ts` 의 `containerWithAuthoredPaint` binding 이 그린다.
- builder 측 `TAG_SPEC_MAP` (`workspace/canvas/styleConversion/tagSpecMap.ts`) 은 catalog Canvas 가 쓰지 않는다.

## 4. 부모 → 자식 값 전달 — 4채널

catalog 는 시각값만 담으므로, 트리 밖 시각 요소와 부모→자식 값 전달은 아래 채널이 담당한다. 모두 resolver 또는 composition root 에서 한 번 계산해 Canvas · DOM 이 같이 읽는다.

| 채널             | 위치                                                                                                  | 예                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| template binding | `{prop}` — `resolution/resolver.ts` `bindTemplateValue`                                               | Select Label 텍스트 = `{label}`                                                              |
| size propagation | `CATALOG_SIZE_PROPAGATION` (`document/sizePropagation.ts`, resolver 가 읽음)                          | RadioGroup → RadioItems → Radio → Label, TagGroup → TagList → Tag                            |
| owner 파생 값    | `catalogDerivedProps` (`catalogRuntime/presence.ts`)                                                  | ProgressBar/Meter 의 value → Track fill, collection item `_isSelected`                       |
| part rules       | `document/rulePartRules.ts` (`catalogIndicatorInset` 등) + composition root `partRuleChildren` 재계획 | Checkbox/Radio/Switch indicator 폭 + gap 만큼 Label 인라인 여백 (트리에 indicator 노드 없음) |

- 컨테이너 치수 주입: `BOX_SIZE_TYPES` (`catalogRuntime/ruleShapes.ts`) 등록 타입에 `_containerWidth` / `_containerHeight` — 원칙은 canvas-rendering.md §2.
- 옛 메커니즘 (`implicitStyles.ts` indicator marginLeft · `SYNTHETIC_LABEL_TAGS` · `applyParentPropagationProps` · `resolveParentDelegatedSize`) 은 `fullTreeLayout.ts` parity 하니스와 `utils/propagationRegistry.ts` 에만 남았다 — production 경로 아님 ([layout-engine.md](../../../rules/layout-engine.md)).

## 5. 신규 합성 컴포넌트 추가 시 개요 체크리스트

1. **catalog**: `COMPONENT_RULES_TABLE` entry (variants/sizes/structure) + `bindings/{Name}.binding.ts` (accepts D2 계약) + `componentCatalog.ts` 등록.
2. **템플릿**: reusable origin 정의 · 템플릿 (`reusableOriginLibrary.ts` — 생성 절차는 파일 헤더) + 팔레트 노출이면 `PALETTE_REUSABLE_ORIGIN_TYPES`.
3. **중첩 규칙**: `catalog/nesting/nestingRules.ts` (RAC 조합 · HTML content model).
4. **3-branch 판정**: shell-only / child-prop-merge / plain — 판정 알고리즘은 canvas-rendering.md §2.5, 구현 상세는 [child-composition.md](child-composition.md).
5. **값 전달**: §4 의 채널 중 하나로 (템플릿 binding 우선). 새 채널을 만들지 않는다.
6. **등록 계약**: `pnpm test:registration-contract` (루트) (`phase4ePalette.test.ts` + `phase3G3Census.test.tsx`).
7. 검증: `pnpm type-check` + `/cross-check` (Canvas↔Preview 시각 대칭).
