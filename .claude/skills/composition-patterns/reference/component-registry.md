# Component Registry & Tag Sets — 구현 상세

> **정본 분리**: `_hasChildren` 3분류 원칙·판정 알고리즘·금지 패턴 정본은
> [.claude/rules/canvas-rendering.md](../../../rules/canvas-rendering.md) §2.5. 본 문서는
> **어떤 Set/registry 가 어디 있고 무엇을 제어하는지**의 위치 지도와 신규 등록 점검 순서만 담는다.
>
> **공식 결정 계보**: ADR-072 (`_hasChildren` 3분류) → ADR-142 (componentCatalog 단일 등록 SSOT) →
> ADR-914 (Entry Universe facet spine) → ADR-912 (spec 삭제·catalog 전환 완결). 본 문서 기준일: 2026-07-07.

## Drift 방지 원칙 (CRITICAL)

**본 문서는 Set 멤버를 나열하지 않는다** — 파일:라인 포인터만 기재한다.
**Why**: 2026-07 audit 에서 구 문서의 멤버 스냅샷이 실제 코드와 불일치했다
(SHELL_ONLY 15 vs 실제 17 / SYNTHETIC 10~11 vs 실제 9). 멤버십이 필요하면 항상 해당 파일을 Read 한다.
멤버 수 표기는 "2026-07-07 기준" 참고값이며 정본이 아니다.

---

## 1. 등록 SSOT — componentCatalog (ADR-142)

컴포넌트 등록의 단일 SSOT 는 `packages/shared/src/catalog/componentCatalog.ts` 다.
구 6개 레지스트리(Component Panel / Factory / rendererMap / getDefaultProps /
BASE_TAG_SPEC_MAP / builder TAG_SPEC_MAP)를 대체한다.

| 심볼                                                                                     | 위치                                      | 내용                                                                                                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `componentCatalog`                                                                       | `componentCatalog.ts:1108`                | 전체 entry 배열. `kind: "primitive"`(leaf, `binding` 정의) 또는 `kind: "reusable"`(`reusableId` → canonical reusable 문서)                  |
| `ComponentFamily`                                                                        | `catalog/types.ts:20`                     | 8 family: primitives / fields / selection / collections / tree-table / overlays / date-color / composition-native                           |
| `CutoverState`                                                                           | `catalog/types.ts:35`                     | `legacy → cutting-over → catalog`. **family 단위 atomic** — 같은 family 안 혼재 금지 (불변식 D)                                             |
| `isCatalogCutover(type)`                                                                 | `catalog/cutover.ts:24`                   | `cutover === "catalog"` entry 에서 모듈 로드 시 1회 파생되는 단일 게이트. DOM(Preview)/Inspector/Skia 가 동시에 catalog generic 경로로 전환 |
| `getCatalogEntry` / `getPanelMeta` / `getCatalogCutoverTypes` / `getCatalogDefaultProps` | `componentCatalog.ts:1124/1135/1151/1170` | 조회 진입점                                                                                                                                 |
| `PrimitiveBinding`                                                                       | `catalog/types.ts:69`                     | leaf 의 DOM source(`rac`/`internal`) + props schema + skiaPrimitive 참조. 개별 정의: `catalog/bindings/{Type}.binding.ts`                   |

### D3 시각 규칙 — COMPONENT_RULES_TABLE

| 심볼                               | 위치                                                           | 내용                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COMPONENT_RULES_TABLE`            | `packages/shared/src/catalog/generated/componentRulesTable.ts` | **직접 편집 정본** (ADR-912 1A-(a) 로 freeze — 더 이상 build-time 생성물 아님, 생성기 물리 삭제됨). 124 spec 투영 결과가 출발점. variants/sizes/fill 변경은 이 파일을 직접 편집 |
| `resolveComponentRule(type, doc?)` | `catalog/resolvers/resolveComponentRule.ts:23`                 | doc override(`doc.componentRules`) 우선 + 테이블 fallback — generic 렌더러의 D3 단일 진입점                                                                                     |
| `resolveStaticComponentRule(type)` | 동일 파일                                                      | doc 파라미터 없는 theme rule base 전용 (ADR-916 P2-CAT 정적 스냅샷용 — override 유입이 compile error)                                                                           |
| `resolveSkiaRule(type)`            | `canvas/skia/resolveSkiaVisualRule.ts:78`                      | builder Skia 측 read-through wrapper                                                                                                                                            |
| `buildCatalogShapes`               | `packages/specs/src/renderers/buildCatalogShapes.ts:110`       | component-agnostic generic box+text 생성기. **컴포넌트 식별 분기 금지** — 비-trivial primitive(원/선/아이콘)는 `binding.skiaPrimitive`(`renderers/skiaPrimitives.ts`) 가 담당   |

Skia 진입 게이트: `StoreRenderBridge.ts:135` `isSpecPath()` = `getSpecForTag(type) || isCatalogCutover(type)`.
**Why**: spec 파일이 삭제된 catalog 전환 type(Text/Heading 등)은 TAG_SPEC_MAP 에 없지만
generic 경로(buildCatalogShapes)로 그릴 수 있어야 한다 — 등록 여부만 보면 Skia 노드 미생성.

---

## 2. Entry Universe — facet spine (ADR-914)

`apps/builder/src/builder/factories/entryUniverse.ts` 의 `resolveComponentEntryRuntime(type)`(:270) 이
한 component type 의 runtime 권한 5 facet 을 노출한다. 각 facet 의 membership SSOT 는
**기존 Set 을 그대로 읽는다** (별도 declaration 파일 신설 금지 — 손등록 surface 감소가 collapse 목적).
`factories/__tests__/entryUniverseContract.test.ts` 가 양방향 parity 를 primary gate 로 검증한다.

| facet                                          | 값                                                                | membership SSOT (파일:라인)                                                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.mode`                                  | `delegating-rac` / `delegating-internal` / `internal` / `generic` | `RENDER_FACET_DELEGATIONS` — `preview/components/renderFacetDeclaration.ts:68` (순수 데이터, CanonicalNodeRenderer 와 entryUniverse 가 공유 파생). internal 은 `INTERNAL_RENDERERS`(CanonicalNodeRenderer.tsx)                  |
| `render.hasTagSpecEntry` / `hasCatalogCutover` | boolean                                                           | `TAG_SPEC_MAP`(@composition/specs) / `getCatalogCutoverTypes()` — ADR-139 invariant B (`placeable ⟹ TAG_SPEC_MAP OR catalog`) substrate                                                                                         |
| `defaults.source`                              | `entry-derived` / `map`                                           | `ENTRY_DERIVED_DEFAULT_TYPES` + `deriveDefaultPropsFromCatalog`(`types/builder/defaultPropsDerivation.ts`) vs `DEFAULT_PROPS_MAP`(`types/builder/unified.types.ts`)                                                             |
| `creation.mode`                                | `reusableOrigin` > `complex` > `none`                             | `REUSABLE_COMPOSITE_ORIGINS`(`components/reusableCompositeOrigins.ts`, `isReusableCompositeType`) / `COMPLEX_COMPONENT_TAGS`(`factories/constants.ts:28`). palette-add 소비: `useElementCreator.ts:192` 가 동일 우선순위로 분기 |
| `propagation.registered`                       | boolean                                                           | `getRegisteredPropagationTags()`(`utils/propagationRegistry.ts`)                                                                                                                                                                |
| `childRuntime.syntheticPropMerge`              | boolean                                                           | `SYNTHETIC_CHILD_PROP_MERGE_TAGS`(`buildSpecNodeData.ts:214`)                                                                                                                                                                   |
| `childRuntime.popoverHosted`                   | boolean                                                           | `POPOVER_CHILDREN_TAGS`(`implicitStyles.ts:430`)                                                                                                                                                                                |
| `childRuntime.fieldVisibleChildTags`           | string[] \| null                                                  | `FIELD_VISIBLE_CHILD_TAGS`(`implicitStyles.ts:453`)                                                                                                                                                                             |

placeable universe 열거: `getEntryUniverseTypes()`(:304) = `ComponentFactory.getRegisteredTypes()`
(`factories/ComponentFactory.ts:177`). factory 정의 본체: `factories/definitions/` 10 파일
(FormComponents / SelectionComponents / LayoutComponents 등).

---

## 3. 분류 Set 지도

멤버가 필요하면 **파일을 Read** — 아래는 위치와 제어 대상만.

### Skia 렌더 분기 (`canvas/skia/buildSpecNodeData.ts`)

| Set                                                                                                                                                                                         | 위치                                | export | 제어 대상                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHELL_ONLY_CONTAINER_TAGS`                                                                                                                                                                 | :153 (17개, 2026-07-07)             |   ✅   | 자식 수 무관 `_hasChildren=true` 항상 주입 — standalone 복귀 차단. lowercase `"body"` 포함 주의 (Set.has 정확 매칭)                                                     |
| `SYNTHETIC_CHILD_PROP_MERGE_TAGS`                                                                                                                                                           | :214 (9개, 2026-07-07)              |   ✅   | `_hasChildren` 주입 **차단** (자식 props 를 부모 shapes 에 통합). childRuntime facet 의 SSOT. 소비처 5곳이 헤더 주석에 명시 (buildSpecNodeData 2 + StoreRenderBridge 3) |
| `CONTAINER_DIMENSION_TAGS`                                                                                                                                                                  | :96                                 |   ❌   | `_containerWidth`/`_containerHeight` 주입 (:1416) — spec/catalog shapes 가 엔진 결과 폭을 알아야 우측/중앙 배치 가능                                                    |
| `NOWRAP_PARENTS` / `FORM_INHERITANCE_TAGS` / `PARENT_LABEL_PROP_SOURCE_TAGS` / `DATE_INPUT_PARENT_TAGS` / `BUTTON_BASE_PARENT_TAGS` / `BUTTON_CHILD_INHERIT_TAGS` / `COLUMN_REARRANGE_TAGS` | :230/:243/:250/:258/:646/:653/:1143 |   ❌   | 태그별 보조 분기 (텍스트 nowrap / 부모 상속 / label prop source / column 재배치 등) — 로컬 상수, 파일 내 주석 참조                                                      |

`_hasChildren` 3-branch 실제 코드: `buildSpecNodeData.ts:1391-1413` —
SHELL_ONLY → 항상 주입 / TreeItem 은 명시 예외 (자식 있어도 자기 행 렌더, `_hasTreeChildren` 별도) /
SYNTHETIC → 차단 / 그 외 → `childElements.length > 0` 일 때만. 판정 알고리즘은 정본 §2.5.

### 창발 소비처 — StoreRenderBridge (`canvas/skia/StoreRenderBridge.ts`)

- `incrementalSync` rebuild 확장 (:308-332): 변경 요소의 부모가 SYNTHETIC 이면 부모도 rebuild,
  변경 요소 자신이 SYNTHETIC 이면 자식+손자까지 확장. **Why**: 자식 props 가 부모 shapes 에 통합되므로
  한쪽만 갱신하면 시각 stale.
- stale 자식 ref 교체 (:549 부근) — SYNTHETIC 부모의 자식 참조 최신화.

### 레이아웃 측정 분기 (`canvas/layout/engines/`)

| Set                                                   | 위치                         | export | 제어 대상                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INLINE_BLOCK_TAGS`                                   | `utils.ts:3846`              |   ✅   | `enrichWithIntrinsicSize` 가 `calculateContentWidth` 텍스트 기반 intrinsic 폭을 주입하는 합성 leaf. **미등록 증상**: `needsWidth=false` → width 0 ("0×24" selection) 또는 fit-content 부모에서 stretch 발산 (CalendarGrid 2026-07-07 사례) |
| `TEXT_LEAF_TAGS`                                      | `utils.ts:3900`              |   ✅   | 줄바꿈 시 height 가 width 의존 — 2-pass 재계산 대상                                                                                                                                                                                        |
| `SPEC_SHAPES_INPUT_TAGS`                              | `utils.ts:3923`              |   ❌   | contentHeight=0 이어도 height 주입이 필요한 self-render 태그 (progressbar/listbox/taglist 등)                                                                                                                                              |
| `IMAGE_INTRINSIC_TAGS` / `INTRINSIC_SIZE_KEYWORDS`    | `utils.ts:3920/:3912`        |   ❌   | replaced element 자연 치수 / intrinsic 키워드 개입 판정                                                                                                                                                                                    |
| `POPOVER_CHILDREN_TAGS`                               | `implicitStyles.ts:430`      |   ✅   | Taffy 레이아웃 제외 (popover-hosted — Calendar/RangeCalendar)                                                                                                                                                                              |
| `FIELD_VISIBLE_CHILD_TAGS`                            | `implicitStyles.ts:453`      |   ✅   | Field 컨테이너의 비-Label 가시 자식 화이트리스트                                                                                                                                                                                           |
| `VERTICAL_ALIGN_MIDDLE_TAGS`                          | `taffyDisplayAdapter.ts:152` |   ✅   | vertical-align middle 시뮬레이션 대상                                                                                                                                                                                                      |
| `LABEL_DELEGATION_PARENT_TAGS` / `LABEL_WRAPPER_TAGS` | `fullTreeLayout.ts:96/:122`  |   ❌   | Label size DFS 주입 대상 부모 / 구조적 래퍼 (정본 rules/layout-engine.md §Label size delegation)                                                                                                                                           |

### Spec/렌더 매핑

| 심볼                            | 위치                            | 내용                                                                                                                                                            |
| ------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TAG_SPEC_MAP` (builder merged) | `canvas/sprites/tagSpecMap.ts`  | packages/specs 정본(102 entries, childSpecs 자동 확장 포함) + `BUILDER_ALIAS_MAP`(8 alias, `sprites/builderAliasMap.ts`). 충돌 시 정본 우선 (alias spread 먼저) |
| `getSpecForTag(type)`           | 동일 파일                       | null 반환 가능 — catalog 전환 type 은 §1 `isSpecPath` 의 OR 게이트로 커버                                                                                       |
| `IMAGE_TAGS`                    | `tagSpecMap.ts:42`              | ImageSprite/buildImageNodeData 경로 (layout 무관)                                                                                                               |
| `rendererMap`                   | `@composition/shared/renderers` | DOM(Preview) 렌더러 매핑 — ADR-907 Layer C 계약 (`rendererStyleContract.test.ts`)                                                                               |

---

## 4. 신규 컴포넌트 등록 점검 순서

정본 판정(3분류 알고리즘·금지 패턴)은 canvas-rendering.md §2.5/§2.6, 아래는 작업 순서와 파일 위치.

1. **catalog entry 등록** — `catalog/bindings/{Type}.binding.ts` 작성 + `componentCatalog.ts` entry 추가
   (kind / family / cutover / panel meta). family 의 현행 `cutover` 상태와 일치시킬 것 (불변식 D —
   같은 family 안 legacy/catalog 혼재 금지).
2. **시각 규칙** — `generated/componentRulesTable.ts` 에 variants/sizes/fill 직접 편집
   (ADR-908 `FillTokenSpec` 구조 준수, 정본 canvas-rendering.md §2.5.5).
3. **factory** — 자식 트리가 필요하면 `factories/definitions/` 에 creator 작성 +
   `COMPLEX_COMPONENT_TAGS`(constants.ts:28) 추가. reusable composite 면 대신
   `REUSABLE_COMPOSITE_ORIGINS` (creation facet 우선순위: reusableOrigin > complex > none).
   layout 기본값(display/flex/gap)은 **factory props.style longhand** 로 (정본 style-ssot.md).
4. **default props** — 신규는 catalog binding 파생(`ENTRY_DERIVED_DEFAULT_TYPES`) 경로 우선.
   `DEFAULT_PROPS_MAP` literal row 는 전환 미완 type 전용.
5. **`_hasChildren` 3분류 판정** — 정본 알고리즘으로 SHELL_ONLY / SYNTHETIC / Plain 판정 후
   `buildSpecNodeData.ts` 해당 Set 등록 (Plain 은 무등록).
6. **레이아웃 Set 판정** — 자식 없는 합성 leaf 인가? → `INLINE_BLOCK_TAGS`.
   shapes 가 컨테이너 폭 좌표를 쓰는가? → `CONTAINER_DIMENSION_TAGS`.
   contentHeight 0 self-render 인가? → `SPEC_SHAPES_INPUT_TAGS`.
   collection 컨테이너면 ADR-907 Layer B/C/D 체크리스트 (정본 §2.6).
7. **검증** — `entryUniverseContract.test.ts` (facet parity) + `rendererStyleContract.test.ts`
   (collection root style) + `pnpm type-check` + `/cross-check` (CSS↔Skia 시각 대칭) +
   **live builder exercise** (test PASS 단독 종결 금지 — CLAUDE.md 완료 기준).

**흔한 누락 증상 → 원인 매핑**:

| 증상                                            | 누락 지점                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| palette 에서 추가해도 자식 트리 미생성          | `COMPLEX_COMPONENT_TAGS` 미등록 (useElementCreator else 분기로 단일 element 생성) |
| 자식 전부 삭제 시 standalone 렌더 복귀          | SHELL_ONLY 미등록                                                                 |
| 자식 UI 가 이중 렌더 (Calendar 2026-04-17 유형) | SHELL_ONLY 대상을 SYNTHETIC 에 혼입                                               |
| 자식 props 편집이 부모 시각에 미반영            | SYNTHETIC 미등록 (incrementalSync 확장 누락)                                      |
| Skia 노드 자체가 안 생김 (텍스트 미표시)        | TAG_SPEC_MAP 도 catalog cutover 도 아님 — `isSpecPath` false                      |
| width 0 / fit-content 부모에서 폭 발산          | `INLINE_BLOCK_TAGS` 미등록                                                        |
| shapes 우측/중앙 좌표가 box 밖으로 어긋남       | `CONTAINER_DIMENSION_TAGS` 미등록                                                 |

---

## 5. 역사적 맥락

- **Wave 4 등급제 (2026-02)**: A/B+/B/D 컴포넌트 등급, `SPEC_RENDERS_ALL_TAGS(_SET)` /
  `UI_SELECT_CHILD_TAGS` / `NON_CONTAINER_TAGS` 기반 opt-out 컨테이너 — **전부 소멸**
  (2026-07-07 grep 0건). PixiJS 제거(ADR-100)와 함께 ElementSprite 중심 분기가 Skia
  `buildSpecNodeData`/`StoreRenderBridge` 로 이전.
- **ADR-072 (2026-04)**: `_hasChildren` 주입을 3-branch (SHELL_ONLY / SYNTHETIC / Plain) 로 정식화.
- **ADR-914 (2026-06)**: 손등록 registry 들을 Entry Universe facet 으로 수렴 —
  각 Set 자체를 facet 의 membership SSOT 로 명문화하고 contract test 가 parity 를 검증.
  delegating 렌더 SSOT 는 `renderFacetDeclaration.ts` 로 방향 역전.
- **ADR-142 + ADR-912 (2026-05~06)**: componentCatalog 단일 등록 SSOT + family 단위 atomic cutover.
  124 spec 파일 삭제, `COMPONENT_RULES_TABLE` freeze 승격 (생성기 삭제). 잔존 spec 은 3개
  (영구 frame · Slot/Group D1 ARIA — memory `project-spec-deletion-inventory`).
