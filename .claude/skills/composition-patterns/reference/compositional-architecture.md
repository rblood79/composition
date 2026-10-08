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
- 소비자: DOM generated CSS (`packages/rendering/scripts/generate-css.ts` → `packages/shared/src/components/styles/generated/`), Canvas rule 실행기 (`catalogRuntime/ruleShapes.ts` · `rulePaint.ts`), Styles 패널 preset (`specPresetResolver.ts`).
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
Select
├─ Label origin instance                 children = "{label}" · presentWhen
├─ Button origin instance
│  ├─ SelectValue                        placeholder = "{placeholder}"
│  └─ Icon
├─ Description origin instance           children = "{description}" · presentWhen
├─ FieldError origin instance            children = "{errorMessage}"
└─ Popover
   └─ ListBox origin instance
      └─ ListBoxItem origin instance × 4  (ListBox의 slotFills)
```

- 항목은 ListBox가 소유한다. Select 직계 자식으로 넣지 않는다. 실제 template은
  `document/generated/reusableOriginLibrary.ts`, DOM 경로는 `runtime/delegatedDom.tsx`의 `select`다.
- `{label}` 등 원본 prop 바인딩은 `resolution/resolver.ts`가 해석한다. 빈 문구의 존재 조건과
  RAC 값 바인딩은 [RAC 조립 계약](../rules/domain-rac-composition.md)을 따른다.
- 시각값은 rule과 노드의 typed field에서 읽는다. 닫힌 Popover의 자식은 Canvas에서 숨긴다.

### Overlay 원본 (ADR-255)

팔레트 이름과 원본 template의 루트 타입은 다를 수 있다. 원본 ID로 library 정의를 조회한다.

- Popover 원본: `DialogTrigger > Button origin instance + Popover > Heading/Description`
- Tooltip 원본: `TooltipTrigger > Button origin instance + Tooltip > Description`

trigger가 RAC 열림 상태와 anchor context를 제공한다. trigger 없는 overlay를 새 원본 기본
구조로 만들거나 Preview에서 강제로 열어 맞추지 않는다. 닫힌 overlay 편집은 Layers 선택을
사용한다. 구조 정본은 같은 template 파일의 `component-popover` · `component-tooltip`이다.

### 생성 경로

- 팔레트 목록: `PALETTE_REUSABLE_ORIGIN_TYPES` (`catalog/componentCatalog.ts`, ADR-228).
- 정의 선택: `catalogPaletteDefinitionId` (`catalogRuntime/paletteInsert.ts`) — origin 이 library 에 있으면 그 origin, 아니면 타입 정의.
- 삽입: `catalogPaletteInsertPlan` → `insertNodes` 명령 (`commands/structure.ts`). 수용 판정은 명령 안의 `assertNestable` (nestingRules).
- `COMPLEX_COMPONENT_TAGS` (`factories/constants.ts`) 의 남은 소비처는 AI 도구 (`services/ai/tools/compositeMode.ts`) 뿐이다.

## 3. D1/D3 경계 — Frame / Group / Slot (spec 없음)

세 타입의 spec 파일과 `packages/specs` (`BASE_TAG_SPEC_MAP` · `tagToElement.ts` 포함) 는 ADR-248 (`ddc5fc603`) 에서 삭제됐다. 모두 catalog 입력이다 — `COMPONENT_RULES_TABLE` 의 `frame` · `Group` · `Slot` 키 + `componentCatalog.ts` entry.

| 타입    | Domain | 경계                                                                               |
| ------- | ------ | ---------------------------------------------------------------------------------- |
| `Group` | **D1** | RAC ARIA semantic (`role="group"`) — catalog rule 에 시각 책임 추가 금지 (ADR-130) |
| `frame` | **D3** | ADR-130 layout container (lowercase) — ARIA role 없음, RAC Group 과 분리           |
| `Slot`  | —      | 플레이스홀더 컨테이너                                                              |

- Canvas 는 `canvasBinding.ts` 의 `containerWithAuthoredPaint` binding 이 세 타입을 그린다. 옛 builder `TAG_SPEC_MAP` 은 삭제됐다.

## 4. 부모 → 자식 값 전달

문서 graph는 구조·props·시각·상태 정의를 담는다. 원본 prop과 파생 값은 아래 채널로 전달하며, RAC render props의 상태·값은 [RAC 조립 계약](../rules/domain-rac-composition.md)을 따른다. DOM의 실제 RAC 상태 frame과 Canvas의 파생 상태를 같은 실행 경로라고 가정하지 않는다.

| 채널             | 위치                                                                                                                                     | 예                                                                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| template binding | `{prop}` — `resolution/resolver.ts` `bindTemplateValue`                                                                                  | Select Label 텍스트 = `{label}`                                                                                                                                                                   |
| size propagation | `CATALOG_SIZE_PROPAGATION` (`document/sizePropagation.ts`, resolver 가 읽음)                                                             | RadioGroup → RadioItems → Radio → Label, TagGroup → TagList → Tag                                                                                                                                 |
| owner 파생 값    | `catalogDerivedProps` (`catalogRuntime/presence.ts`)                                                                                     | collection item `_isSelected` 등 owner 상태                                                                                                                                                       |
| part rules       | `document/rulePartRules.ts` (`catalogToggleIndicatorBox` · `catalogSubpartDomSelectors` 등) + composition root `partRuleChildren` 재계획 | Checkbox/Radio/Switch 의 `*Indicator` 노드 상자 = toggle rule `sizes[size].indicator` (2026-10-04 부터 indicator 는 문서 노드 — 옛 `catalogIndicatorInset` 의 Label 여백 방식은 `ef1ff8c04` 삭제) |

- 컨테이너 치수 주입: `BOX_SIZE_TYPES` (`catalogRuntime/ruleShapes.ts`) 등록 타입에 `_containerWidth` / `_containerHeight` — 원칙은 canvas-rendering.md §2.
- 옛 메커니즘 (`implicitStyles.ts` indicator marginLeft · `SYNTHETIC_LABEL_TAGS` · `applyParentPropagationProps` · `resolveParentDelegatedSize`) 은 2026-10-05 옛 TS 레이아웃 파이프라인 (`fullTreeLayout.ts` · `propagationRegistry.ts`) 과 함께 삭제됐다 ([layout-engine.md](../../../rules/layout-engine.md)).

## 5. 신규 합성 컴포넌트 추가 시 개요 체크리스트

1. **catalog**: `COMPONENT_RULES_TABLE` entry (variants/sizes/structure) + `bindings/{Name}.binding.ts` (accepts D2 계약) + `componentCatalog.ts` 등록.
2. **템플릿**: reusable origin 정의 · 템플릿 (`reusableOriginLibrary.ts` — 아래 원본 편집 절차) + 팔레트 노출이면 `PALETTE_REUSABLE_ORIGIN_TYPES`.
3. **조립 계약**: `catalogChildKind` · RAC slot · 필수 부품 · 상태 주체는 [RAC 조립 계약](../rules/domain-rac-composition.md).
4. **3-branch 판정**: shell-only / child-prop-merge / plain — 판정 알고리즘은 canvas-rendering.md §2.5, 구현 상세는 [child-composition.md](child-composition.md).
5. **값 전달**: 원본 prop은 §4, RAC 상태·값은 공통 조립 계약의 경로를 사용한다.
6. **등록 계약**: `pnpm test:registration-contract` (루트) (`phase4ePalette.test.ts` + `phase3G3Census.test.tsx`).
7. 검증: `pnpm run codex:typecheck` + 공통 조립 계약의 DOM 구조·저장 검증 + `/cross-check` (Canvas↔Preview 시각 대칭).

### 원본 template 편집·검증

`packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts`는 ADR-248에서 한 번
변환한 뒤 유지하는 typed library 코드 정본이다. 디렉터리명은 `generated`지만 현행 생성기는
없다. 파일 헤더의 `phase3ReusableOriginTemplates.test.ts`·`catalogOrigins.ts`와
`ADR248_WRITE_REUSABLE_ORIGINS=1`은 삭제된 일회 변환 경로이며 다시 만들거나 실행하지 않는다.

- 원본 변경은 이 파일의 `REUSABLE_ORIGIN_DEFINITIONS`·`REUSABLE_ORIGIN_TEMPLATES` 중
  해당 정의와 노드를 편집한다. accepts/defaults·templateRootId·children·slotFills·바인딩의
  참조를 함께 확인한다. 이 코드 정본의 편집 허용을 CSS·dist 등 실제 생성물에 확대하지 않는다.
- template의 `visual`은 CSS 객체가 아니다. `document/types.ts`의 `VisualField`와 실제
  DOM·Canvas 소비자가 기대하는 값 형식을 확인한다. 예를 들어 둥글기를 없애려면
  `borderRadius: "0px"`나 `radius: "0px"`가 아니라 `radius: 0`이다. 값 타입은 넓은
  `AuthoredValue`이므로 typecheck 통과만으로 `NaN` 등 런타임 오류가 배제되지 않는다.
- 큰 template 파일은 기존 표기와 무관한 노드를 보존한다. 포맷 후 파일 전체의 따옴표·공백만
  바뀌었다면 본인 변경에서 생긴 포맷 차이만 제거하고 변경 노드의 diff를 다시 확인한다.
  다른 작업자의 변경을 파일 전체 되돌리기로 지우지 않는다.
- 구조 변경은 [구조 변경 감사](../rules/domain-structure-change-audit.md)의 library contract
  증가·옛 프로젝트 거부·현재 주소 무결성 계약을 적용한다.
- `packages/shared/src/catalog/document/__tests__/codeCatalogLibrary.test.ts`와 변경 family의
  Builder `catalogRuntime/__tests__/adr256*` 인접 테스트를 실행한다. 팔레트 노출·기본 생성이
  바뀌면 `pnpm run test:registration-contract`도 적용한다.
- 실제 Builder에서 새 instance 생성 → Preview 동작 → 저장·재열기를 확인한다.
  CSS 시각 rule도 바뀌었으면 별도로 `pnpm generate:css`와
  `pnpm -F @composition/rendering validate:sync`를 실행한다.
