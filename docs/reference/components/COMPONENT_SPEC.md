# 컴포넌트 시스템 구조 (현행)

> **검증일**: 2026-09-09
> **검증 방법**: 아래 모든 서술은 이 저장소의 코드를 직접 읽어 확인했다. 각 항목에 `경로:라인` 을 병기한다. 개수는 해당 파일을 스크립트로 센 값이며 세는 방법을 함께 적었다. 실행 검증(live builder / 브라우저)은 하지 않았다 — 정적 코드 사실만 담는다.
> **다루는 범위**: 컴포넌트 1개가 정의·등록·렌더되는 자리와 그 SSOT. 다루지 않는 것: 레이아웃 엔진(`packages/composition-engine`), 상태 파이프라인, 테마/토큰 편집 UI, publish 배포 절차.
> **이 문서가 정본이 아닌 것**: SSOT 3-Domain 규칙의 정본은 [`.claude/rules/ssot-hierarchy.md`](../../../.claude/rules/ssot-hierarchy.md) 다. 본 문서는 그 규칙이 코드의 어느 파일로 구현돼 있는지를 짚는 지도다.

---

## 1. 정본 구조 — catalog

컴포넌트당 정의 파일(구 `*.spec.ts`)은 없다. 코드 정의는 **leaf primitive 의 `PrimitiveBinding`** 하나이고, 조합 컴포넌트는 canonical reusable 문서(데이터)다 (`packages/shared/src/catalog/types.ts:1-16`).

### 1.1 `componentCatalog` — 등록 SSOT

`packages/shared/src/catalog/componentCatalog.ts:1200` 의 `componentCatalog` 배열이 컴포넌트 등록의 단일 진입점이다. 구 6개 레지스트리(Component Panel / Factory / rendererMap / getDefaultProps / BASE_TAG_SPEC_MAP / builder TAG_SPEC_MAP)를 대체한다 (같은 파일 `:1-15` 주석).

entry 는 3종 union (`packages/shared/src/catalog/types.ts:253`):

| kind        | 뜻                                                  | 정의처                             | 개수 |
| ----------- | --------------------------------------------------- | ---------------------------------- | ---: |
| `primitive` | leaf RAC/internal primitive. `binding` 이 코드 정의 | `bindings/*.binding.ts`            |  116 |
| `native`    | composition-native 일급 노드. binding·reusable 없음 | `componentCatalog.ts:1137`, `1142` |    2 |
| `reusable`  | 조합 컴포넌트. `reusableId` → canonical 문서        | `componentCatalog.ts:1166~1193`    |    5 |

- 합계 **123 entry**. 세는 방법: `grep -c "^  primitiveEntry(" packages/shared/src/catalog/componentCatalog.ts` = 116, `"^  nativeEntry("` = 2, `"^  reusableEntry("` = 5.
- `native` 2개는 `frame` 과 `Slot` (`componentCatalog.ts:1137`, `:1142`).
- `reusable` 5개는 `Toolbar` / `Form` / `IconButton` / `InlineAlert` / `Card` (`componentCatalog.ts:1166`, `:1171`, `:1180`, `:1188`, `:1193`).
- binding 파일 개수 116 (`ls packages/shared/src/catalog/bindings/*.binding.ts | wc -l`) 이 `primitive` entry 수와 일치한다.

조회 진입점:

| 함수                        | 위치                       | 답하는 것                                       |
| --------------------------- | -------------------------- | ----------------------------------------------- |
| `getCatalogEntry(type)`     | `componentCatalog.ts:1236` | entry (reusable 제외 인덱스)                    |
| `getPanelMeta(type)`        | `componentCatalog.ts:1266` | 팔레트 표시 메타 (category/label/icon)          |
| `getCatalogCutoverTypes()`  | `componentCatalog.ts:1282` | catalog generic 경로가 적용된 type 집합         |
| `getCatalogDefaultProps()`  | `componentCatalog.ts:1301` | `binding.props.accepts` 의 `default` 만 모은 것 |
| `getPrimitiveBinding(type)` | `bindings/index.ts:470`    | `PrimitiveBinding`                              |
| `isCatalogCutover(type)`    | `cutover.ts:24`            | 렌더·편집 경로 게이트 (단일 게이트)             |

### 1.2 `PrimitiveBinding` — D1 source + D2 편집 계약

`packages/shared/src/catalog/types.ts:69`. leaf primitive 1개당 1개. 시각/변형/구조 필드는 없다.

- `source` (`types.ts:47`) — `kind: "rac"` (react-aria-components 의 export 이름; 렌더러가 `RAC[component]` 로 조회) 또는 `kind: "internal"` (RAC 으로 환원 불가능한 leaf, 예: Icon = Lucide SVG).
- `rac` — RAC primitive 의 parts/slots/states/renderProps/dataAttributes 메타. rac source 전용.
- `props.accepts: Record<string, PropContract>` — 이 primitive 가 받는 canonical props = **D2 편집 SSOT**. `PropContract` 는 `types.ts:195`, `kind` 는 11종 (`boolean` / `enum` / `string` / `string-array` / `number` / `icon` / `variant` / `size` / `fillStyle` / `binding` / `items-manager` — `types.ts:137-148`).
- `props.toRacProps` — canonical props → RAC props 투영기 식별자. 구현은 `outputs/toRacProps.ts:80`.
- `props.propPassthrough` — visual-enum 을 `data-*` 대신 React prop 으로 통과시킬 키 (internal source 의 예외 경로).
- `skiaPrimitive` — box+text 로 표현 못 하는 형상(arc/track/backdrop 등)의 Skia draw module 키. 대부분 미사용.
- `staticAttrs` — `role` / `aria-live` 같은 D1 정적 DOM 속성.

RAC 버전은 workspace catalog 로 고정: `react-aria-components: ^1.21.0` (`pnpm-workspace.yaml:15`).

### 1.3 `COMPONENT_RULES_TABLE` — D3 시각 SSOT

`packages/shared/src/catalog/generated/componentRulesTable.ts:17`.

> **경로 이름이 `generated/` 이지만 자동 생성물이 아니다.** 파일 머리(`componentRulesTable.ts:1-14`)가 명시한다: `generate-rules.ts` 가 1회 생성한 결과를 freeze 해 **직접 편집 정본으로 승격**했고, build chain 의 `generate:rules` step 과 생성기 파일은 삭제됐다. 실측 확인: `packages/specs/package.json` scripts 에 `generate:rules` 없음, `find . -name generate-rules.ts` 결과 0건. 시각 규칙 변경은 이 파일을 직접 편집한다.

- 컴포넌트 키 **124개**. 세는 방법: 파일에서 `^  <Key>: {$` 패턴 매칭 (`Avatar` / `AvatarGroup` / `Badge` / `body` / `Breadcrumb` / …). 키는 PascalCase 가 기본이고 `body` 처럼 canonical lowercase 태그와 맞춘 예외가 있다.
- 한 rule 이 담는 것 (타입: `packages/shared/src/types/composition-document.types.ts:521` `ComponentRule`): `defaultVariant` / `defaultSize` / `variants` (`:155`) / `sizes` (`:297`) / `structure` (`:591`) / `states` (`:640`) / `composition` (`:628`) / `density` (`:473`) / `chart` (`:493`).
- 색은 `fill` preset 구조 (`ComponentRuleFill` `:125`, `ComponentRuleFillState` `:113`) — variant 당 개별 background 필드가 아니라 `fillStyle × state` 2축.
- 값은 TokenRef 문자열(`"{color.neutral-subtle}"`) 그대로 저장하고 런타임이 해소한다 (`componentRulesTable.ts:13`).
- 테이블 타입: `ComponentRulesTable = Record<string, ComponentRule>` (`composition-document.types.ts:658`).

읽기 진입점 (`packages/shared/src/catalog/resolvers/resolveComponentRule.ts`):

| 함수                                 | 라인 | 차이                                                                  |
| ------------------------------------ | ---: | --------------------------------------------------------------------- |
| `resolveComponentRule(type, doc?)`   |   23 | 문서 override(`doc.componentRules`) 우선, 테이블 fallback             |
| `resolveComponentRuleByTag(t, doc?)` |   45 | 위 + lowercase 태그 역인덱스 (layout 이 소문자 태그로 동작)           |
| `resolveStaticComponentRule(type)`   |   87 | doc 파라미터 자체가 없다 — override 유입이 컴파일 오류가 되도록 분리  |
| `usesButtonBaseUtility(type)`        |   74 | `structure.cssEmitMode === "button-base"` 또는 `structure.buttonBase` |

### 1.4 theme / tokens

TokenRef(`{color.accent}`)의 해소는 두 경로가 대응한다:

- canonical 문서 경로: `resolveCanonicalToken(ref, doc)` — `apps/builder/src/adapters/canonical/variablesAdapter.ts:186`. `doc.tokens` 는 전체 세트가 아니라 seed 대비 **델타만** 저장한다 (`variablesAdapter.ts` `buildTokensSnapshot` 주석).
- theme 경로: `resolveToken(ref, theme)` — `packages/specs/src/renderers/utils/tokenResolver.ts`. 두 경로는 같은 theme 으로 빌드된 문서라면 동일 값을 반환한다는 계약이다 (`variablesAdapter.ts:155-160`).

토큰 seed 는 `packages/specs/src/primitives/` (colors / typography / spacing / radius / shadows / font / buttonSizes / fieldSizes / tabSizes / containerSpacing / semanticPaletteMap).

### 1.5 잔존 spec 3개 — Frame / Group / Slot

`packages/specs/src/components/` 에 남은 spec 파일은 3개뿐이다: `Frame.spec.ts` / `Group.spec.ts` / `Slot.spec.ts` (+ `index.ts`, `__tests__/`).

registry 도 3개다 — `packages/specs/src/runtime/tagToElement.ts:103` `BASE_TAG_SPEC_MAP` 의 실제 entry 는 `Group` / `frame` / `Slot` 셋이고 (`:154-158`), `TAG_SPEC_MAP` 은 그 항등 재노출이다 (`:192`). 구 `expandChildSpecs`(childSpecs 자동 등록)는 childSpecs 를 가진 spec 이 전수 삭제되면서 항등 함수가 되어 2026-07-15 제거됐다 (`tagToElement.ts:186-191`).

셋의 역할이 다르다:

| spec    | 역할                                                               | 근거                                               |
| ------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `Group` | **D1 ARIA semantic** — RAC `Group`, `role="group"`                 | `Group.spec.ts:122-123`, `tagToElement.ts:154`     |
| `frame` | **D3 layout container** — ARIA role 없음, `skipCSSGeneration:true` | `Frame.spec.ts:4-7`, `:125`, `tagToElement.ts:157` |
| `Slot`  | 플레이스홀더 컨테이너. `skipCSSGeneration:false`                   | `Slot.spec.ts:1-5`, `:37`, `tagToElement.ts:158`   |

`frame` 은 catalog `native` entry 라 Skia 가 무엇을 그릴지 정하는 자리가 이 spec 의 `render.shapes()` 하나뿐이다 (`Frame.spec.ts:13-14`).

builder 쪽 진입점은 `apps/builder/src/builder/workspace/canvas/styleConversion/tagSpecMap.ts:22` `getSpecForTag(type)` — 이 3개만 non-null 을 반환하고, 그 외에는 `null` 이다. 같은 파일 `:1-8` 주석이 "일반 컴포넌트는 `resolveComponentRule` 을 쓸 것" 이라고 못박는다.

---

## 2. 대칭 consumer — 같은 SSOT 를 읽는 두 경로

D3 는 Builder(Skia) 와 Preview/Publish(DOM+CSS) 가 **대등한 소비자**다. 어느 쪽도 기준이 아니고, 같은 catalog 입력에서 같은 시각 결과가 나오는지가 판정이다.

```
COMPONENT_RULES_TABLE (+ theme/tokens, PrimitiveBinding)
        │
        ├── Builder (Skia, runtime)
        │     resolveComponentRule → buildSpecNodeData → buildCatalogShapes → specShapesToSkia
        │
        └── Preview / Publish (DOM + CSS)
              build-time: generate-css → generated/*.css
              runtime:    toRacProps → RAC primitive · toReactStyle (override)
```

### 2.1 Builder (Skia) leg

`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts:1386` `buildSpecNodeData(input)` 가 분기점이다:

- `:1398-1399` — `getSpecForTag(type)` 로 잔존 spec 3개를 먼저 보고, spec 도 없고 `isCatalogCutover(type)` 도 아니면 `null` (그리지 않음).
- `:1417` — catalog 경로면 `resolveComponentRule` 계열로 rule 을 얻는다.
- `:1873` — `usesGeneric = isCatalogCutover(type)` 로 generic box+text 생성을 결정한다.
- 생성기 본체는 `packages/specs/src/renderers/buildCatalogShapes.ts:272` `buildCatalogShapes(...)`. 파일 머리(`:1-18`)가 명시한다: **컴포넌트 식별 분기 금지** — `if (type === "ToggleButton")` 같은 분기 대신 `props._treeLevel` / `size.indentPerLevel` 처럼 데이터 유무로만 갈린다.
- box+text 로 못 그리는 형상은 `binding.skiaPrimitive` 가 가리키는 draw module (`packages/specs/src/renderers/skiaPrimitives.ts`) 로 escape 하고, 합성 모드는 `getSkiaPrimitiveMode` 가 정한다 (`types.ts:113-124` 주석).
- 시각값 병합기는 `packages/shared/src/catalog/outputs/toSkiaStyle.ts:60` `toSkiaStyle` — base(rule size) ⊕ override(`props.style`) 를 `resolveMergedStyle` 코어로 합치고, Skia 는 런타임에 그려야 하므로 여기서 **TokenRef 를 해소**한다 (`toSkiaStyle.ts:1-27`).

### 2.2 Preview / Publish (DOM + CSS) leg

**build-time (색·크기 base)**: `packages/specs/scripts/generate-css.ts` 가 `getComponentRulesTable()` 을 직접 import 해서(`:16-24`) variant 색상을 주입하고, Node 전용 `generateAllCSS` 로 CSS 파일을 쓴다. 출력 위치는 `generate-css.ts:32-35` → `packages/shared/src/components/styles/generated/` — 현재 **94개 `.css`** (`ls .../generated/*.css | wc -l`). 이 스크립트는 `pnpm install` postinstall 체인(`package.json:45-47` `prepare:specs` → `build:specs` → specs `build` → `generate:css`)에서 돈다.

**runtime (구조·override)**: `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:270` 가 진입점이고 3단으로 갈린다.

1. `:394` — delegating 위임: `rendererMap[type]` 이 self-compose 하고 generic 자식 재귀를 건너뛴다.
2. `:555` — 일반 `rendererMap` 위임.
3. `:570~` — `rendererMap` 미등록 태그의 generic 렌더 (`toRacProps` → RAC primitive).

`rendererMap` 은 `packages/shared/src/renderers/index.ts:19`, **96 entry** (파일의 `^  <Key>: ` 항목 수). 하위 파일은 `FormRenderers` / `SelectionRenderers` / `LayoutRenderers` / `DateRenderers` / `CollectionRenderers` / `TableRenderer` / `DataRenderers` / `IconRenderers` / `ColorRenderers` 9개.

DOM 쪽 인라인 style 은 **override 전용**이다 — base 시각값은 위 generated CSS 가 담당하므로 `toReactStyle` (`packages/shared/src/catalog/outputs/toReactStyle.ts:36`) 은 `props.style` 만 통과시킨다 (`:5-9`). 이것이 Skia 의 `toSkiaStyle` 과 다른 지점이고, 두 어댑터가 같은 `resolveMergedStyle` 코어를 공유해 갈라지지 않게 잡는다 (`toSkiaStyle.ts:5-8`).

**publish 런타임**: `apps/publish/src/registry/ComponentRegistry.tsx:81` 의 `Map` 에 `registerComponent` 로 등록하고 (`:90`), `apps/publish/src/renderer/ElementRenderer.tsx:23` 이 `getComponent(type)` 으로 꺼낸다. 등록 호출 **64건** (`registerComponent("` 매칭). 컴포넌트 실체는 `@composition/shared/components` 에서 온다 (`ComponentRegistry.tsx:15-63`) — Preview 와 같은 구현을 쓴다.

---

## 3. 컴포넌트를 추가할 때 거치는 자리

한 곳이라도 빠지면 그 경로만 조용히 깨진다. 게이트(`pnpm test:registration-contract`, `package.json:20`)가 일부를 막지만 전부는 아니다.

| #   | 자리                 | 파일 / 심볼                                                                                                                                                                                                  | 없으면                                             |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | binding              | `packages/shared/src/catalog/bindings/<Type>.binding.ts` → `bindings/index.ts` `getPrimitiveBinding` (`:470`)                                                                                                | primitive entry 를 만들 수 없다                    |
| 2   | catalog entry        | `packages/shared/src/catalog/componentCatalog.ts` `FAMILY_*_ENTRIES` → `componentCatalog` (`:1200`)                                                                                                          | 팔레트 메타·default props·cutover 게이트 전부 없음 |
| 3   | 시각 rule            | `packages/shared/src/catalog/generated/componentRulesTable.ts` 에 키 추가                                                                                                                                    | 색/크기/구조가 비어 Skia·CSS 양쪽 기본값           |
| 4   | 생성 CSS             | 3번을 넣고 `pnpm -F @composition/specs generate:css` 재실행 → `packages/shared/src/components/styles/generated/`                                                                                             | DOM leg 만 base 스타일 누락                        |
| 5   | 팔레트 노출          | `apps/builder/src/builder/panels/components/paletteItems.ts:171` `PALETTE_ORDER`                                                                                                                             | catalog 에 있어도 **팔레트에서 꺼낼 수 없다**      |
| 6   | factory creator      | `apps/builder/src/builder/factories/ComponentFactory.ts` + `definitions/*.ts`                                                                                                                                | 자식 트리를 만드는 컴포넌트가 빈 껍데기            |
| 7   | default props        | `getCatalogDefaultProps` 자동 파생 (`componentCatalog.ts:1301`) + builder overlay `deriveDefaultPropsFromCatalog` (`apps/builder/src/types/builder/defaultPropsDerivation.ts:89`)                            | 초기 props 없음                                    |
| 8   | DOM 렌더러 (필요 시) | `packages/shared/src/renderers/index.ts:19` `rendererMap` · `apps/builder/src/preview/components/canonicalRendererRegistry.ts:34` `INTERNAL_RENDERERS` (27종) · `renderFacetDeclaration.ts` (위임 선언 SSOT) | generic div 로 떨어짐                              |
| 9   | publish 등록         | `apps/publish/src/registry/ComponentRegistry.tsx` `registerComponent("<Type>", …)`                                                                                                                           | **빌더는 멀쩡한데 배포본에서만 안 그려진다**       |

### 3.1 5번(팔레트)이 별개인 이유

`PALETTE_ORDER` (`paletteItems.ts:171`) 가 **노출 정본**이다 — 노출 대상 선별과 순서를 동시에 표현하고, catalog entry 가 있어도 이 배열에 없으면 팔레트에 안 나온다. 현재 **65항목** (`source: "catalog"` 60 + `source: "overlay"` 5). overlay 5종은 catalog 미등록이라 `PALETTE_ONLY` (`paletteItems.ts:149`) 가 메타를 직접 들고 있다: `AvatarGroup` / `Image` / `CardView` / `ButtonGroup` / `TableView`.

이 자리는 실제로 결손을 냈다. `paletteItems.ts:212-217`, `:194-198` 이 기록한다 — `TextArea` 는 catalog panel meta 와 factory creator 를 처음부터 다 갖췄는데 이 배열에만 빠져 있어 꺼낼 수 없었고, `Pagination` / `ColorField` / `Meter` 도 같은 형태였다 (2026-08-21 creator↔팔레트 전수 대조로 적발).

### 3.2 9번(publish)이 게이트 밖인 이유

`apps/builder/src/builder/factories/__tests__/componentRegistrationContract.test.ts` 가 보는 축은 `rendererMap` / `TAG_SPEC_MAP` / `getDefaultProps` 3개뿐이다 (`:8-11`). publish `ComponentRegistry` 는 그 밖이라, ADR-194 가 `apps/publish/src/__tests__/publishRegistryCoverage.test.ts` 를 추가해 ratchet 으로 막았다 (`:1-14`). 현재 known-missing baseline 은 10종 (`:36-47`): `ColorField` / `DropZone` / `FileTrigger` / `frame` / `IconButton` / `Menu` / `Nav` / `Section` / `Slot` / `TextArea`. baseline 은 줄어들 수만 있다.

### 3.3 등록 불변식 게이트 2종

**`componentRegistrationContract.test.ts`** (ADR-139) — 불변식 A: spec 파일 universe ⟹ `TAG_SPEC_MAP`. 불변식 B: 모든 placeable(`ComponentFactory.creators`) ⟹ `rendererMap` + `TAG_SPEC_MAP` + `getDefaultProps` (`:8-11`). 미등록 쌍은 baseline(known debt) 또는 exception(intended) 에 있을 때만 통과하고, **신규 컴포넌트는 baseline 진입 불가**다 (`:13-14`). baseline 항목 수는 `BASELINE_RATCHET` 로 freeze — 추가하면 FAIL, 해소했는데 상수를 안 고쳐도 FAIL (`:16-18`).

**`entryUniverse.ts`** (ADR-914, `apps/builder/src/builder/factories/entryUniverse.ts`) — 한 entry 가 가진 runtime 권한을 facet 으로 모아 `entryUniverseContract.test.ts` 가 대조한다. facet 5종:

| facet          | 값                                                                                                                               | 라인                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `render`       | `delegating-rac` / `delegating-internal` / `internal` / `generic` + `hasRendererEntry` / `hasTagSpecEntry` / `hasCatalogCutover` | `:63`(타입), `:95`  |
| `defaults`     | `entry-derived` (catalog 파생) 또는 `map` (`DEFAULT_PROPS_MAP` row)                                                              | `:88`(타입), `:111` |
| `creation`     | `none` / `reusableOrigin` / `complex`                                                                                            | `:80`(타입), `:124` |
| `propagation`  | `registerPropagationSpec` 등록 여부                                                                                              | `:127`              |
| `childRuntime` | `syntheticPropMerge` / `popoverHosted` / `fieldVisibleChildTags`                                                                 | `:131`              |

`render.hasTagSpecEntry` 와 `hasCatalogCutover` 두 substrate 가 함께 있는 이유는 불변식 B 의 Skia leg 이 "`TAG_SPEC_MAP` **또는** catalog" 이기 때문이다 (`:16-26`) — 잔존 spec 3개는 앞쪽, 나머지 전부는 뒤쪽으로 통과한다.

`pnpm codex:preflight` (`package.json:25`) 가 guard → format → typecheck → **registration** → agent-catalog → engine-matrix → text-axis-matrix 순으로 돈다.

---

## 4. 3-Domain 경계 (요약)

정본은 [`.claude/rules/ssot-hierarchy.md`](../../../.claude/rules/ssot-hierarchy.md) — 아래는 그 요약과 코드 대응이다.

| Domain             | 권위                                           | 코드 자리                                                                     |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| **D1** DOM/접근성  | Adobe RAC (절대). 관찰·소비만, 개입 금지       | `PrimitiveBinding.source.kind:"rac"` + `binding.rac` 메타 + `staticAttrs`     |
| **D2** Props/API   | RSP 참조 + custom 확장. 타입 선언만            | `binding.props.accepts: Record<string, PropContract>` + `toRacProps`          |
| **D3** 시각 스타일 | catalog `COMPONENT_RULES_TABLE` + theme/tokens | `generated/componentRulesTable.ts` + `primitives/` 토큰. 잔존 spec 3개는 예외 |

- **회색지대 판정**: "Builder 와 Preview 가 시각적으로 달라질 수 있는 요소인가" — 그렇다면 D3.
- **대칭의 정의**: 구현 방법이 아니라 **시각 결과**의 동일성. Skia 가 arc 를 그리든 DOM 이 `border-radius` 를 쓰든 보이는 결과가 같으면 통과.
- **금지**: catalog/spec 이 DOM 구조나 ARIA 지정 (D1 침범) · RSP 미규정 prop 도입 (D2) · SSOT 파생이 아닌 수동 CSS (D3) · `@sync` 주석으로 consumer↔consumer 참조 · Skia 전용 시각 효과 · **일반 컴포넌트에 컴포넌트당 spec 파일 신규 생성** (§5 참조).
- 검증 수단: `/cross-check` (단일 컴포넌트 시각 대칭) · `pnpm -F @composition/builder test:parity` (browser vitest, `apps/builder/package.json:18`) · `pnpm gate:visual-parity` (시각 smoke, `package.json:50`).

공식 결정: [ADR-063](../../adr/completed/063-ssot-chain-charter.md) (SSOT charter) · [ADR-142](../../adr/completed/142-starter-spec-component-system-cutover.md) (D3 SSOT 재정의, Implemented 2026-06-02). 관련: [ADR-130](../../adr/completed/130-layer3-canonical-vocabulary-alignment.md) (Group↔frame 분리) · [ADR-148](../../adr/completed/148-reusable-slot-system-unification.md) (reusable) · [ADR-912](../../adr/completed/912-rac-pencil-rebuild-cutover.md) (cutover 실행) · [ADR-914](../../adr/completed/914-component-entry-universe-collapse.md) (entry universe).

---

## 5. 폐기된 옛 메커니즘 — 컴포넌트당 spec 파일

2026-03 시점의 구조는 **컴포넌트 1개 = spec 파일 1개** 였다. `packages/specs/src/components/<Type>.spec.ts` 가 tokens / variants / sizes / `render.shape()` / `render.react()` / `render.skia()` 를 전부 들고, `BASE_TAG_SPEC_MAP` 이 그것을 등록하고, `CSSGenerator` 가 그것을 CSS 로 변환했다. 규모는 스냅샷 부록 A 기준 작성 당시 73개 → 문서 갱신 시점 75개였고, rules table 을 1회 생성할 때의 입력은 124 spec 이었다 (`componentRulesTable.ts:8`).

이 메커니즘은 폐기됐다:

- ADR-142 (Implemented 2026-06-02) 가 D3 SSOT 를 catalog + theme/tokens 로 재정의했고, ADR-036("Spec-First 정본")은 그에 의해 Superseded 다.
- ADR-912 가 실제 cutover 를 실행했다. `packages/specs/src/runtime/tagToElement.ts:20-101` 과 `packages/specs/src/components/index.ts` 에 어느 spec 이 언제 어떤 근거로 삭제됐는지가 파일별 주석으로 남아 있다.
- `generate-rules.ts`(spec → rules table 생성기)도 삭제됐다 (`componentRulesTable.ts:7-9`).
- 남은 것은 §1.5 의 3개뿐이며, **일반 컴포넌트에 spec 파일을 새로 만드는 것은 금지**다 (`ssot-hierarchy.md` §6).

2026-03 시점 문서 전문은 **[`docs/legacy/COMPONENT_SPEC-2026-03-snapshot.md`](../../legacy/COMPONENT_SPEC-2026-03-snapshot.md)** (325KB / 7,658줄, append-only — 본 분리 시 prettier 포맷만 적용, 내용 무변경) 에 그대로 보존돼 있다. 그 문서의 Phase 0~6 구현 상세·`ElementSprite`·PixiJS·`SPEC_RENDERS_ALL_TAGS`·`CHILD_COMPOSITION_EXCLUDE_TAGS` 서술은 전부 현행과 다르다 — **의사결정 맥락(Why)을 되짚을 때만** 열고, 코드 레퍼런스로는 쓰지 않는다.

스냅샷의 부록 B(React Aria DOM 구조 레퍼런스)·부록 C(ARIA Role 매핑 총표)는 D1 영역이라 성격상 오래 버티는 내용이지만, **D1 정본은 RAC upstream 자체**다. 참조할 일이 생기면 `packages/react-aria-starter/` (upstream 스냅샷, read-only 편집 금지) 와 설치된 `react-aria-components@^1.21.0` 을 대조할 것.

---

## 6. 확인 과정에서 발견한 drift

정정하지 않고 기록만 남긴다 (본 문서 작업 범위 밖):

1. `packages/shared/src/catalog/generated/` 디렉터리 이름이 실제 위상과 어긋난다 — 자동 생성물이 아니라 직접 편집 정본이다. 파일 머리 주석이 이를 설명하지만 경로만 보면 반대로 읽힌다.
2. `apps/builder/src/builder/panels/components/paletteItems.ts:167` 주석의 "catalog 78 중 sub-part/leaf 24 는 미포함" 은 2026-06-11 시점 수치다. 현재 catalog entry 는 123개다.
3. `packages/shared/src/catalog/types.ts:66-68` 의 "약 35개" 는 `PrimitiveBinding` 개수 추정치인데 실제 binding 파일은 116개다.
4. `packages/shared/src/catalog/resolvers/resolveComponentRule.ts:5-6`, `:56` 이 아직 테이블을 "build-time 생성 테이블(124 spec 투영)" 로 서술한다 — 생성 체인은 제거됐다.

---

## 7. 참조

| 용도                | 경로                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| SSOT 3-Domain 정본  | [`.claude/rules/ssot-hierarchy.md`](../../../.claude/rules/ssot-hierarchy.md)                           |
| 코드 패턴 인덱스    | [`.claude/skills/composition-patterns/SKILL.md`](../../../.claude/skills/composition-patterns/SKILL.md) |
| Canvas 렌더 규칙    | [`.claude/rules/canvas-rendering.md`](../../../.claude/rules/canvas-rendering.md)                       |
| ADR 현황            | [`docs/adr/README.md`](../../adr/README.md)                                                             |
| 2026-03 시점 스냅샷 | [`docs/legacy/COMPONENT_SPEC-2026-03-snapshot.md`](../../legacy/COMPONENT_SPEC-2026-03-snapshot.md)     |
