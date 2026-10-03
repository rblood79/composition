# Component Registry & Type Sets — 구현 상세

> **정본 분리**: `_hasChildren` 3분류 원칙·판정 알고리즘·금지 패턴 정본은
> [.claude/rules/canvas-rendering.md](../../../rules/canvas-rendering.md) §2.5. 본 문서는
> **어떤 Set/registry 가 어디 있고 무엇을 제어하는지**의 위치 지도와 신규 등록 점검 순서만 담는다.
>
> **공식 결정 계보**: ADR-072 (`_hasChildren` 3분류) → ADR-142 (componentCatalog 단일 등록 SSOT) → ADR-912 (spec 삭제·catalog 전환) → ADR-248 (catalog 문서 · library 정의, 2026-10-03 Phase 4 — factory · Entry Universe · `buildSpecNodeData` · `StoreRenderBridge` 삭제). 본 문서 기준일: 2026-10-04.

## Drift 방지 원칙 (CRITICAL)

**본 문서는 Set 멤버를 나열하지 않는다** — 심볼과 파일만 적는다. 멤버십이 필요하면 해당 파일을 Read 한다.
**Why**: 2026-07 audit 에서 구 문서의 멤버 스냅샷이 코드와 어긋났다 (SHELL_ONLY 15 vs 실제 17 등).

---

## 1. 등록 SSOT — componentCatalog → library 정의

| 심볼                                                                                                             | 위치                                                  | 내용                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `componentCatalog`                                                                                               | `packages/shared/src/catalog/componentCatalog.ts`     | 전체 entry 배열. `kind: "primitive"` (leaf, `binding` 정의) 또는 `kind: "reusable"` (`reusableId` → reusable origin)                     |
| `getCatalogEntry` / `getPanelMeta` / `getCatalogCutoverTypes` / `getCatalogDefaultProps` / `getReusableOriginId` | 같은 파일                                             | 조회 진입점                                                                                                                              |
| `ComponentFamily` · `CutoverState`                                                                               | `catalog/types.ts`                                    | family 분류 · `legacy → cutting-over → catalog` (family 단위 atomic, 불변식 D)                                                           |
| `PrimitiveBinding`                                                                                               | `catalog/types.ts`                                    | leaf 의 DOM source (`rac`/`internal`) + props schema (`accepts`) + `skiaPrimitive` 참조. 개별 정의: `catalog/bindings/{Type}.binding.ts` |
| `ruleTypeDefinition`                                                                                             | `catalog/document/ruleDefinition.ts`                  | 등록 타입 → typed library 정의. rule 이 있으면 `ruleId = type`                                                                           |
| `catalogTypeDefinitionId`                                                                                        | `catalog/document/codeCatalogLibrary.ts`              | 타입명 → `lib:definition:type-<Type>`                                                                                                    |
| `REUSABLE_ORIGIN_DEFINITIONS` · 템플릿                                                                           | `catalog/document/generated/reusableOriginLibrary.ts` | 합성 컴포넌트 origin 정의 + 템플릿 트리 (생성 절차는 파일 헤더)                                                                          |
| `PALETTE_REUSABLE_ORIGIN_TYPES`                                                                                  | `componentCatalog.ts`                                 | 팔레트가 origin instance 로 만드는 타입 (ADR-228)                                                                                        |

### D3 시각 규칙 — COMPONENT_RULES_TABLE

| 심볼                               | 위치                                                           | 내용                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `COMPONENT_RULES_TABLE`            | `packages/shared/src/catalog/generated/componentRulesTable.ts` | **직접 편집 정본** (ADR-912 로 freeze, 생성기 삭제). variants/sizes/fill 변경은 이 파일을 직접 편집                                                                      |
| `resolveComponentRule(type, doc?)` | `catalog/resolvers/resolveComponentRule.ts`                    | doc override 우선 + 테이블 fallback (Properties edit contract · Styles preset 이 읽음)                                                                                   |
| `resolveStaticComponentRule(type)` | 같은 파일                                                      | override 없는 theme rule base 전용 (ADR-916 P2-CAT)                                                                                                                      |
| library rules                      | `graph.library.rules`                                          | Canvas rule 실행기 (`canvasBinding.ts` `ruleNodeData`) 가 `node.ruleId` 로 조회                                                                                          |
| `buildCatalogShapes`               | `packages/specs/src/renderers/buildCatalogShapes.ts`           | component-agnostic generic box+text 생성기. **컴포넌트 식별 분기 금지** — 비-trivial primitive (원/선/아이콘) 는 `binding.skiaPrimitive` (`renderers/skiaPrimitives.ts`) |

Canvas 게이트: `canvasBinding.ts` — `bindingKey(node)` 가 bindings 표에 있거나 `node.ruleId` 가 있어야 그린다. 둘 다 없으면 `CATALOG_CANVAS_BINDING_REQUIRED`, rule 이 library 에 없으면 `CATALOG_CANVAS_RULE_REQUIRED` 로 throw 한다 (조용히 빈 노드를 두지 않는다).

---

## 2. DOM 렌더 매핑

| 심볼                                                | 위치                                                               | 내용                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `domBinding.tsx`                                    | `apps/builder/src/builder/catalogRuntime/`                         | catalog consumer 노드 → React (Canvas 와 같은 해석 결과)    |
| `CATALOG_DOM_CHILD_OWNING_BINDINGS`                 | `domBinding.tsx`                                                   | 자식을 스스로 그리는 binding (RAC 컬렉션 등)                |
| renderer registry                                   | `apps/builder/src/preview/components/canonicalRendererRegistry.ts` | 타입 → shared 컴포넌트 (`@composition/shared/components/*`) |
| `RENDER_FACET_DELEGATIONS`                          | `apps/builder/src/preview/components/renderFacetDeclaration.ts`    | delegating 렌더 선언 (순수 데이터)                          |
| `ENTRY_DERIVED_DEFAULT_TYPES` · `DEFAULT_PROPS_MAP` | `types/builder/defaultPropsDerivation.ts` · `unified.types.ts`     | 기본 props — 신규는 catalog binding 파생 경로 우선          |

---

## 3. 분류 Set 지도

멤버가 필요하면 **파일을 Read** — 아래는 위치와 제어 대상만.

### Canvas 렌더 분기 (`apps/builder/src/builder/catalogRuntime/`)

| Set                        | 위치               | export | 제어 대상                                                                                                             |
| -------------------------- | ------------------ | :----: | --------------------------------------------------------------------------------------------------------------------- |
| `SHELL_ONLY_TYPES`         | `rulePaint.ts`     |   ❌   | 자식 수 무관 `_hasChildren=true` — standalone 복귀 차단. lowercase `"body"` 포함 주의 (Set.has 정확 매칭)             |
| `CHILD_PROP_MERGE_TYPES`   | `rulePaint.ts`     |   ✅   | `_hasChildren` 주입 **차단** + `ruleShapes.ts` `shellProps` 가 컨테이너 text/label/placeholder 를 지워 이중 렌더 차단 |
| `BOX_SIZE_TYPES`           | `ruleShapes.ts`    |   ❌   | `_containerWidth` / `_containerHeight` 주입 — shape 생성기가 상자 폭으로 우측/중앙 배치                               |
| `bindings` 표              | `canvasBinding.ts` |   ❌   | rule 대신 전용 binding 으로 그리는 키 (composite · frame · group · slot · box · icon · selecttrigger · 텍스트 계열 …) |
| `TRIGGER_OVERLAY_CHILDREN` | `presence.ts`      |   ❌   | 닫힌 overlay 의 자식 — 레이아웃 상자 0, Canvas 미렌더 (옛 `POPOVER_CHILDREN_TAGS`)                                    |

`_hasChildren` 3-branch 코드: `rulePaint.ts` — SHELL_ONLY → 항상 / TreeItem 명시 예외 / CHILD_PROP_MERGE → 차단 / 그 외 → `node.children.length > 0`. 판정 알고리즘은 정본 §2.5.

부모 · 자식 의존 재계획 (옛 `StoreRenderBridge` incrementalSync 확장의 현행 형태): `compositionRoot.ts` `planInstances` — `partRuleChildren` · presence dependents · breadcrumb items 를 같은 step 에 다시 계획한다.

### 레이아웃 측정 분기 — parity 하니스 전용

`layout/engines/utils.ts` (`INTRINSIC_MEASURE_TAGS` · `TEXT_LEAF_TAGS` · `SPEC_SHAPES_INPUT_TAGS` · `IMAGE_INTRINSIC_TAGS`), `implicitStyles.ts` (`POPOVER_CHILDREN_TAGS` · `FIELD_VISIBLE_CHILD_TAGS`), `fullTreeLayout.ts` (`LABEL_DELEGATION_PARENT_TAGS` · `LABEL_WRAPPER_TAGS`) 는 `fullTreeLayout.ts` parity 경로만 읽는다. production 레이아웃 입력은 `compositionRoot.ts` `styleOf` 하나 — [layout-engine.md](../../../rules/layout-engine.md) 「레이아웃 재계산 경로」.

### Spec/렌더 매핑

| 심볼                            | 위치                                             | 내용                                                                     |
| ------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `TAG_SPEC_MAP` (builder merged) | `workspace/canvas/styleConversion/tagSpecMap.ts` | packages/specs 정본 + `BUILDER_ALIAS_MAP`. catalog Canvas 는 쓰지 않는다 |
| `rendererMap`                   | `@composition/shared/renderers`                  | DOM 렌더러 매핑 — ADR-907 Layer C 계약 (`rendererStyleContract.test.ts`) |

---

## 4. 신규 컴포넌트 등록 점검 순서

정본 판정 (3분류 알고리즘·금지 패턴) 은 canvas-rendering.md §2.5/§2.6.

1. **catalog entry** — `catalog/bindings/{Type}.binding.ts` + `componentCatalog.ts` entry (kind / family / cutover / panel meta). family 의 `cutover` 상태와 일치 (불변식 D).
2. **시각 규칙** — `componentRulesTable.ts` 직접 편집 (ADR-908 `FillTokenSpec` 구조, 정본 canvas-rendering.md §2.5.5).
3. **합성 구조** — 자식 트리가 필요하면 reusable origin 정의 · 템플릿 (`reusableOriginLibrary.ts`) + 팔레트 노출이면 `PALETTE_REUSABLE_ORIGIN_TYPES`. 레이아웃 기본값은 템플릿 노드의 `layout` typed field (style-ssot.md).
4. **중첩 규칙** — `catalog/nesting/nestingRules.ts`.
5. **`_hasChildren` 3분류** — SHELL_ONLY / CHILD_PROP_MERGE / Plain 판정 후 `rulePaint.ts` Set 등록 (Plain 은 무등록).
6. **Canvas 실행** — rule 로 그릴 수 없는 시각이면 `skiaPrimitive` 또는 `canvasBinding.ts` bindings. shape 가 상자 폭 좌표를 쓰면 `BOX_SIZE_TYPES`.
7. **검증** — `pnpm test:registration-contract` (`phase4ePalette.test.ts` + `phase3G3Census.test.tsx`) + `rendererStyleContract.test.ts` + `pnpm type-check` + `/cross-check` + **live builder exercise** (CLAUDE.md 완료 기준).

**흔한 누락 증상 → 원인 매핑**:

| 증상                                              | 누락 지점                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 팔레트에서 추가해도 자식이 없음                   | reusable origin 정의 · 템플릿 부재 (타입 정의로 떨어짐 — `catalogPaletteDefinitionId`) |
| 자식 전부 삭제 시 standalone 렌더 복귀            | `SHELL_ONLY_TYPES` 미등록                                                              |
| 자식 UI 가 이중 렌더 (Calendar 2026-04-17 유형)   | SHELL_ONLY 대상을 `CHILD_PROP_MERGE_TYPES` 에 혼입                                     |
| Canvas 가 throw `CATALOG_CANVAS_BINDING_REQUIRED` | binding 도 rule 도 없음 — binding 표 또는 `COMPONENT_RULES_TABLE` 등록                 |
| Canvas 가 throw `CATALOG_CANVAS_RULE_REQUIRED`    | `ruleId` 는 붙었는데 library rules 에 없음                                             |
| shape 우측/중앙 좌표가 상자 밖으로 어긋남         | `BOX_SIZE_TYPES` 미등록                                                                |
| 삽입이 `NESTING_NOT_ALLOWED` 로 거부              | `nestingRules.ts`                                                                      |

---

## 5. 역사적 맥락

- **Wave 4 등급제 (2026-02)**: `SPEC_RENDERS_ALL_TAGS` / `UI_SELECT_CHILD_TAGS` 등 opt-out 컨테이너 — PixiJS 제거 (ADR-100) 와 함께 소멸.
- **ADR-072 (2026-04)**: `_hasChildren` 3-branch 정식화.
- **ADR-914 (2026-06)**: Entry Universe facet spine (`factories/entryUniverse.ts`) — ADR-248 로 factory 계층과 함께 삭제됐다. 등록 계약은 위 §4-7 의 두 테스트가 대신한다.
- **ADR-142 + ADR-912 (2026-05~06)**: componentCatalog 단일 등록 + family 단위 cutover, `COMPONENT_RULES_TABLE` freeze. 잔존 spec 3개 (Frame · Slot · Group).
- **ADR-248 (2026-10)**: 문서가 `CatalogGraph` 로, 생성이 library 정의 · 템플릿으로, Canvas 분기가 `canvasBinding` / `rulePaint` / `ruleShapes` 로 옮겨졌다 (`buildSpecNodeData` 의 Set 이 이름만 바뀌어 이전).
