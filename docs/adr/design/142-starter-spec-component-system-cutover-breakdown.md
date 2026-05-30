# ADR-142 Breakdown: RAC primitive binding + canonical 문서 기반 컴포넌트 시스템 family 단위 cutover

## 1. 목표

컴포넌트 시스템을 canonical 문서 모델로 통합한다.

- **조합 컴포넌트(composed component)** — Card, Section, 아이콘이 붙은 Button 등 — 는 `reusable: true` canonical frame 노드로 정의한다. 코드가 아니라 데이터다. 인스턴스는 `type:"ref"` 노드다.
- **코드 정의** 는 leaf RAC primitive 약 35개의 `PrimitiveBinding` 으로 한정한다.
- **등록** 은 단일 `componentCatalog` 로 통합한다 (기존 6개 목록 대체).
- **렌더** 는 resolved canonical tree + theme 를 소비하는 generic 렌더러 1개로 한다 (DOM backend + Skia backend).
- **시각** 은 theme/tokens root collection 이 SSOT 다.

기존 `packages/specs` 의 `ComponentSpec`(`render.shapes()` 124개) / `ReactRenderer` / `CSSGenerator` / `specShapesToSkia` / `rendererMap` 은 참조·확장·migration source 가 아니다. legacy boundary 로 격리한다.

cutover 는 공통 기반을 1회 고정한 뒤 family(컴포넌트군) 단위로 4경로(Component Panel / Factory / Preview·Publish / Skia)를 atomic 하게 전환한다.

핵심 산출물:

- starter inventory + primitive/composed 분류표 + 124 `ComponentSpec` legacy 처분 목록
- `PrimitiveBinding` 타입 + `componentCatalog` 타입
- generic 렌더러 (DOM backend + Skia backend) — resolved canonical tree + theme 소비
- Preview resolved-tree 단일 소비 (reusable/ref/descendants/slot 가 실제로 렌더)
- 조합 컴포넌트의 reusable 문서 저작 흐름 (Builder 안 저작 + reusable 승격)
- registration contract 확장 (catalog cross-check + family atomicity 불변식)
- 새 `packages/shared/src/components` primitive wrapper surface + `legacy` boundary
- family 단위 4경로 atomic cutover

## 2. 파일 경계

### 새로 만들 파일

| 파일                                                                  | 책임                                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `docs/reference/audits/2026-05-19-canonical-component-inventory.md`   | starter 컴포넌트 primitive/composed 분류 + shared/Panel/Factory/rendererMap/124 ComponentSpec diff           |
| `packages/shared/src/catalog/types.ts`                                | `PrimitiveBinding` + `ComponentCatalogEntry` + sub-type(`PropContract`/`PanelMeta` 등)                       |
| `packages/shared/src/catalog/bindings/{Primitive}.binding.ts`         | leaf RAC primitive 약 35개의 `PrimitiveBinding` — `react-aria-components` 기준 작성 (D3 시각은 starter 참조) |
| `packages/shared/src/catalog/outputs/toRacProps.ts`                   | canonical props → RAC component props 투영 (유일한 binding 변환기)                                           |
| `packages/shared/src/catalog/outputs/inspectorFields.ts`              | `PropContract` 집합 + theme → Inspector 편집 필드 generic 생성 (컴포넌트당 `SpecField` 분기 대체)            |
| `packages/shared/src/catalog/componentCatalog.ts`                     | primitive + reusable entry 단일 registry + family/cutover/panel metadata                                     |
| `packages/shared/src/catalog/library/`                                | 조합 컴포넌트의 seed reusable canonical 문서 (Phase 2 산출, Builder 저작분 export)                           |
| `packages/shared/src/catalog/__tests__/componentCatalog.test.ts`      | catalog entry 무결성 + family atomicity 검증                                                                 |
| `packages/shared/src/catalog/__tests__/inspectorFields.test.ts`       | `PropContract`→Inspector 필드 생성 / `section` 그룹핑 / `variant` 값 theme 조회 검증                         |
| `apps/builder/src/preview/__tests__/canonicalPreviewRefSlot.test.tsx` | Preview 가 reusable/ref/descendants/slot resolved tree 를 실제 DOM 으로 렌더링하는지 검증 (F1~F4)            |
| `apps/builder/.../skia/__tests__/canonicalSkiaSymmetry.test.ts`       | generic 렌더러 DOM↔Skia 시각 대칭 fixture                                                                    |
| `packages/shared/src/components/legacy/README.md`                     | legacy 구현의 compatibility boundary 규칙                                                                    |

### 수정할 파일

| 파일                                                                                 | 변경                                                                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/preview/App.tsx`                                                   | Preview canonical branch 가 `resolveCanonicalDocument()` resolved tree 를 단일 source 로 소비. legacy `elements[]` 경로 격리  |
| `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`                      | fallback 포함 모든 렌더 경로가 `ResolvedNode.children` 를 잃지 않게 정리 — generic 렌더러 DOM backend 의 단일 진입점으로 승격 |
| `apps/builder/src/resolvers/canonical/index.ts`                                      | reusable/ref/descendants/slot resolved-tree 계약 fixture 보강 (TC8/TC9 버그 수정 포함)                                        |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`                | Skia 경로를 resolved canonical tree + theme 소비로 재작성. `render.shapes()`/`specShapesToSkia` 경로 격리                     |
| `packages/shared/src/components/index.ts`                                            | primitive wrapper barrel export (`react-aria-components` import + `toRacProps`)                                               |
| `packages/shared/src/renderers/index.ts`                                             | `rendererMap` 을 legacy compatibility fallback 으로 격리                                                                      |
| `apps/builder/src/builder/panels/components/ComponentList.tsx`                       | hard-coded catalog 를 `componentCatalog` 소비로 전환                                                                          |
| `apps/builder/src/builder/panels/properties/generic/GenericPropertyEditor.tsx`       | 컴포넌트당 `spec.properties.sections` 대신 `PropContract`/`propsSchema` 기반 generic 필드 소비                                |
| `apps/builder/src/builder/factories/ComponentFactory.ts`                             | primitive 배치 = binding 노드 삽입, 조합 컴포넌트 배치 = reusable 로의 `ref` 삽입                                             |
| `apps/builder/src/builder/factories/__tests__/componentRegistrationContract.test.ts` | catalog cross-check + family atomicity 불변식 C/D/E 추가                                                                      |
| `apps/builder/src/builder/hooks/useElementCreator.ts`                                | Factory 호출 경로가 catalog + canonical props 를 사용하도록 정리                                                              |
| `packages/shared/src/index.ts`                                                       | `PrimitiveBinding` / `componentCatalog` / `toRacProps` / `PropContract` export                                                |

### legacy 처분 파일 (참조·확장 금지 — 격리만)

| 파일                                                | 처분                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/specs/src/components/*.spec.ts` (124)     | legacy. 새 시스템이 import/파생하지 않음. legacy 문서 호환·migration reference 로만 유지 |
| `packages/specs/src/renderers/ReactRenderer.ts`     | legacy. className/dataAttributes/style 만 산출 — RAC 구조 표현 불가                      |
| `packages/specs/src/renderers/CSSGenerator.ts`      | legacy. 새 CSS 는 generic 렌더러가 theme/tokens 에서 생성                                |
| `apps/builder/.../skia/` 의 `specShapesToSkia` 경로 | legacy. 새 Skia 는 generic 렌더러가 resolved tree + theme 소비                           |

### 경계 규칙

- `react-aria-components`(npm): D1 runtime primitive. `PrimitiveBinding` 과 primitive wrapper 가 import 하는 대상.
- `packages/react-aria-starter/src/**`: Adobe starter kit 의 vendored snapshot — D3 시각/구조 참조 코드. runtime import 대상 아님. 원본 직접 수정 금지.
- `packages/shared/src/catalog/**`: `PrimitiveBinding` + `componentCatalog` + `PropContract` + `toRacProps` + `inspectorFields`. 새 시스템의 코드 정의 영역. canonical document 모델(`CompositionDocument`/`CanonicalNode`/`ResolvedNode`)·theme/tokens 를 소비하므로 그 타입이 정의된 `shared` 에 둔다 — `specs` 는 canonical 타입을 모르고 `specs ← shared` 의존 방향상 `shared` 를 import 할 수 없다. catalog 는 같은 패키지인 `shared` 의 canonical/resolver 타입을 직접 쓰고, `shared/components` 의 primitive wrapper 가 catalog 의 `toRacProps` 를 import 한다(동일 패키지 — 순환 없음). legacy `packages/specs/src/components/**`/`renderers/**` 는 import 하지 않는다.
- `packages/specs/src/components/**` + `renderers/ReactRenderer.ts` + `renderers/CSSGenerator.ts`: legacy.
- `packages/shared/src/components/**`: RAC primitive wrapper surface (`react-aria-components` import + `toRacProps`).
- `packages/shared/src/components/legacy/**`: compatibility fallback. active Builder authoring path 에서 직접 import 금지.

## 3. PrimitiveBinding + componentCatalog 모델

새 시스템에는 컴포넌트당 정의 객체가 없다. 코드 정의는 `PrimitiveBinding` 하나뿐이고, 조합 컴포넌트는 canonical reusable 문서다.

```ts
export type ComponentFamily =
  | "primitives"
  | "fields"
  | "selection"
  | "collections"
  | "tree-table"
  | "overlays"
  | "date-color"
  | "composition-native";

export type CutoverState = "legacy" | "cutting-over" | "catalog";

// leaf RAC primitive 1개당 1개. 약 35개. 시각/변형/구조 필드 없음.
export interface PrimitiveBinding {
  source: {
    package: "react-aria-components"; // D1 runtime primitive (npm)
    importPath: string;
    component: string;
  };
  rac: {
    primitive: string;
    parts: string[];
    slots: string[];
    states: string[];
    renderProps: string[];
    dataAttributes: string[];
  };
  props: {
    // 이 primitive 가 받는 canonical props 집합 = primitive D2 SSOT
    accepts: Record<string, PropContract>;
    // canonical props → RAC component props 투영. 유일한 변환기 식별자.
    toRacProps: string; // 구현은 outputs/toRacProps.ts
  };
  // 비-DOM-trivial primitive (arc/track/indicator 등) 의 Skia draw module 키. 대부분 미사용.
  skiaPrimitive?: string;
}

// ── Inspector 편집 계약 ──────────────────────────────────────────────
// canonical prop 1개 = Inspector 편집 필드 1개. 컴포넌트당 properties.sections /
// SpecField 분기를 대체한다. primitive 의 accepts 와 reusable 의 propsSchema 가
// 같은 PropContract 타입을 공유한다. 현 FieldDef 11종 union(spec.types.ts, legacy)의
// 표현력을 흡수한다.
export type InspectorFieldKind =
  | "boolean"
  | "enum"
  | "string"
  | "string-array"
  | "number"
  | "icon"
  | "variant"
  | "size"
  | "binding";

// catalog/types.ts 에 재정의 — legacy spec.types.ts 를 import 하지 않는다.
export interface VisibilityCondition {
  key?: string;
  equals?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  truthy?: boolean;
}

export interface PropContract {
  kind: InspectorFieldKind;
  label?: string;
  default?: unknown;
  // 필드 그룹 태그 — 컴포넌트당 SectionDef[] 대체. generic Inspector 가 이 태그로 묶는다.
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  // enum 전용 고정 옵션. kind:"variant"/"size" 는 options 를 두지 않는다 —
  // 선택 가능한 값을 theme 규칙의 data-* 값 집합에서 읽는다.
  options?: Array<{ value: string; label: string }>;
  min?: number; // number 전용
  max?: number;
  step?: number;
  visibleWhen?: VisibilityCondition;
}

export interface PanelMeta {
  category: string;
  label: string;
  icon: string;
  placeable: boolean;
}

// 컴포넌트 카탈로그 — 6개 레지스트리를 대체하는 단일 등록 SSOT.
export type ComponentCatalogEntry =
  | {
      kind: "primitive";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      binding: PrimitiveBinding;
      panel: PanelMeta;
    }
  | {
      kind: "reusable";
      type: string;
      family: ComponentFamily;
      cutover: CutoverState;
      reusableId: string; // catalog/library 의 canonical reusable frame id
      panel: PanelMeta;
    };
```

규약:

- `kind: "primitive"` — `react-aria-components` 에 leaf RAC primitive 가 있는 항목. 예: Button, TextField, Checkbox, Dialog, ListBox, Tree, Table. `binding` 으로 정의한다.
- `kind: "reusable"` — 조합 컴포넌트. 예: Card, Section, 아이콘이 붙은 Button. `reusableId` 가 canonical reusable 문서를 가리킨다. 코드 정의가 없다.
- composition-native(`Frame`/`Slot`/reusable tooling)는 RAC primitive 없이 catalog 에 등록한다. `family: "composition-native"`.
- `family` 와 `cutover` 가 family 단위 atomic cutover 의 SSOT 다. 한 family 의 모든 entry 는 `cutover` 를 `legacy → cutting-over → catalog` 로 함께 거치며, 같은 family 안에서 `legacy` 와 `catalog` 가 혼재할 수 없다.

Inspector 편집 source (PropContract):

- **primitive** — `PrimitiveBinding.props.accepts: Record<string, PropContract>` 가 D2 편집 SSOT.
- **reusable(조합)** — reusable 컴포넌트가 노출한 `propsSchema: Record<string, PropContract>` 가 편집 SSOT. canonical core schema 는 변경하지 않는다(HC#4) — `propsSchema` 는 reusable 컴포넌트 메타(`x-composition` extension layer, canonical core 와 직교)에 둔다.
- generic 렌더러는 Inspector field renderer 하나(`outputs/inspectorFields.ts`)를 두고, 선택 노드의 `PropContract` 집합 + theme 에서 편집 필드를 generic 하게 만든다. 컴포넌트당 `properties.sections`/`SpecField` 분기가 없다.
- `kind:"variant"`/`"size"` — `options` 를 두지 않는다. generic Inspector 가 theme 규칙이 정의한 `data-*` 값 집합에서 선택 가능한 값을 읽는다.
- `kind:"binding"` — collections(ADR-132) data binding 필드. 현 `ItemsManagerField` 를 대체한다 (collection items 는 canonical 문서가 아니라 collections root 가 소유).
- 현 `FieldDef` 11종 → `PropContract.kind` 전수 매핑은 Phase 0 inventory 산출물이다. 매핑 불가 잔여(`CustomField` 임의 컴포넌트, `derivedUpdateFn`)는 ADR R9.

시각 SSOT 의 위치:

- 컴포넌트의 변형(variant)은 `PrimitiveBinding` 이나 catalog 가 아니라 **노드의 `data-*` 속성 + theme 규칙** 으로 표현한다.
- generic 렌더러의 CSS 생성 단계가 theme/tokens root collection 에서 `data-*` → token 매핑 CSS 를 generic 하게 만든다. 컴포넌트당 CSS 정의가 없다.
- 조합 컴포넌트의 시각은 reusable 문서 노드의 일반 style props 다 — 사용자 콘텐츠와 동일한 데이터.

Tree/Table:

- Tree/Table 은 `kind: "primitive"` 다 — RAC Tree/Table 이 실제 collection 컴포넌트 코드다. 재귀·2D 구조는 RAC 의 collection 렌더링이 담당한다.
- rows/columns/tree node 데이터는 collections root(`useCollectionData`, ADR-132)에서 온다 — canonical 문서에 전수 복제하지 않는다.
- full support 인정 조건: generic 렌더러 + collections 데이터 + `PrimitiveBinding` 으로 Skia·Preview 양쪽에서 동작하는 fixture 통과.

## 4. Phase 계획

Phase 0~5 는 family cutover 착수 전 1회 수행하는 **공통 기반** 단계다. Phase 6 은 family 순서대로 4경로를 동시 전환하는 **반복 단계** 다.

### Phase 0 — Freeze + Inventory

목표: cutover 준비 중 legacy active surface 가 늘지 않게 고정하고, 기존 자산의 처분을 명시한다.

작업:

1. `packages/react-aria-starter/UPSTREAM.md` 정책 기준 starter source 보호 확인. `codex:format`/`codex:guard` 대상 제외 확인.
2. starter 55 컴포넌트를 **primitive**(leaf RAC, → `PrimitiveBinding`)와 **composed**(조합, → reusable 문서)로 분류. 각 primitive 의 D3 시각 참조 starter 파일을 함께 기록 (upstream diff workflow, R7).
3. 기존 124 `ComponentSpec` 처분 명시 — 전수 legacy.
4. 6개 registry(Panel/Factory/rendererMap/getDefaultProps/BASE_TAG_SPEC_MAP/builder TAG_SPEC_MAP) diff 수집.
5. 비-DOM-trivial primitive(arc/track/indicator 등) 목록 식별 — `skiaPrimitive` 후보.
6. `docs/reference/audits/2026-05-19-canonical-component-inventory.md` 작성.

검증: `pnpm run codex:guard` / `pnpm run codex:format`
Gate: G0, G1

### Phase 1 — PrimitiveBinding + generic 렌더러 + Preview resolved-tree (공통 기반 핵심)

목표: 대안 E 의 HIGH 위험(R1)을 다루는 단계. generic 렌더러와 Preview resolved-tree 소비를 동작 상태로 만든다.

작업:

1. `packages/shared/src/catalog/types.ts` — `PrimitiveBinding` + `ComponentCatalogEntry` + sub-type.
2. `outputs/toRacProps.ts` — canonical props → RAC props 투영.
3. **generic 렌더러 DOM backend**: `CanonicalNodeRenderer` 를 resolved canonical tree 의 단일 렌더 진입점으로 승격. fallback 경로가 `ResolvedNode.children` 를 잃지 않게 정리.
4. **Preview resolved-tree 소비**: `App.tsx` 가 `resolveCanonicalDocument()` 결과를 단일 source 로 삼게 한다. legacy `elements[]` 경로 격리.
5. **generic 렌더러 Skia backend**: `buildSpecNodeData.ts` Skia 경로를 resolved canonical tree + theme 소비로 재작성. `render.shapes()`/`specShapesToSkia` 격리.
6. resolver 버그 수정: nested ref `_resolvedFrom` 미주입, descendants mode C `validateSlotContract` 누락.
7. **Button primitive 파일럿**: 첫 `PrimitiveBinding` 작성 + DOM/Skia 양쪽 렌더 확인.
8. **generic Inspector field renderer**: `outputs/inspectorFields.ts` 가 `PropContract` 집합 + theme 로 Inspector 편집 필드를 generic 생성. `GenericPropertyEditor` 가 컴포넌트당 `spec.properties.sections` 대신 이를 소비. `section` 태그 그룹핑 + `variant`/`size` 값 theme 조회 포함. Button `accepts` 로 검증.
9. fixture: `canonicalPreviewRefSlot.test.tsx`(F1 reusable origin / F2 ref instance + descendants A·B·C / F3 slot fill / F4 fallback 경로 resolved children 보존), `canonicalSkiaSymmetry.test.ts`(DOM↔Skia 대칭), `inspectorFields.test.ts`(`PropContract`→필드 생성 / `section` 그룹핑 / `variant` 값 theme 조회).

검증: `pnpm -F @composition/builder test canonicalPreviewRefSlot` / `pnpm -F @composition/builder test resolver` / `pnpm -F @composition/shared test inspectorFields` / `pnpm run codex:typecheck`
Gate: **G2 (공통 기반 gate — R1 1:1)**

> **2026-05-30 Phase 0 inventory recalibration** ([audit](../../reference/audits/2026-05-30-canonical-component-inventory.md)): 작업 #5(Skia backend 재작성)의 실측 scope 가 추정보다 큼 — text 측정 64 spec + 특수 shape 38 + ADR-907 spacing 4 + ADR-908 fill 30 resolver 를 generic Skia backend 가 재현해야 함(ADR R4 → **HIGH**). **G2 를 2 단계로 분해 권장**: (a) **DOM-first** — 작업 #1·#3·#4·#7·#9(F1~F4 + Inspector), `resolveCanonicalDocument`/`CanonicalNodeRenderer` 기존 자산 활용 (저위험) / (b) **Skia-rewrite** — 작업 #5(buildSpecNodeData 재작성 + ADR-907/908 resolver re-home + skiaPrimitive), G2 최대 무게. (b) 통과 전까지 Preview `?canonical` opt-in + Skia legacy fallback 유지하여 primary 렌더 경로 회귀를 막는다.

### Phase 2 — Reusable 컴포넌트 저작 + componentCatalog

목표: 조합 컴포넌트를 reusable canonical 문서로 저작하고, 단일 `componentCatalog` 를 구성한다.

작업:

1. 조합 컴포넌트를 Builder 안에서 만들고 reusable 로 승격하는 흐름 정비 (reusable 승격 tooling). 이 tooling 은 reusable 이 노출하는 편집 prop 의 `propsSchema`(`Record<string, PropContract>`) 저작을 포함한다 — canonical core schema 를 건드리지 않고 `x-composition` extension 메타로 기록(HC#4).
2. family 별 조합 컴포넌트의 seed reusable 문서를 `packages/shared/src/catalog/library/` 로 export.
3. `componentCatalog.ts` — primitive entry(binding) + reusable entry(reusableId) + family/cutover/panel.
4. `componentCatalog.test.ts` — entry 무결성, 같은 family 의 `cutover` 동일성, primitive entry 의 `binding` 존재, reusable entry 의 `reusableId` 가 library 문서에 resolve.

검증: `pnpm -F @composition/shared test componentCatalog` / `pnpm -F @composition/shared type-check`
Gate: G3

### Phase 3 — shared primitive wrapper surface + legacy boundary

목표: `packages/shared/src/components` 를 약 35개의 thin RAC primitive wrapper 로 재정의한다.

작업:

1. 기존 active 구현을 family 별로 `packages/shared/src/components/legacy/` 로 이동할 계획 작성.
2. 새 primitive wrapper 는 기존 public filename 유지 (`Button.tsx` 등). `react-aria-components` import + `toRacProps` + generated CSS class 부착. starter 원본은 수정하지 않는다 (D3 시각 참조 전용).
3. 조합 컴포넌트는 shared 파일을 만들지 않는다 — catalog 의 reusable entry + library 문서.
4. `index.ts` barrel 은 primitive wrapper surface 만 export.
5. `legacy/README.md` 에 import 허용 경계 명시.

검증: `pnpm run codex:typecheck`
Gate: G6 일부 (legacy 격리 경계 확립)

### Phase 4 — Panel + Factory catalog 배선

목표: Component Panel 과 element creation 이 `componentCatalog` 를 소비하도록 배선한다.

작업:

1. `ComponentList.tsx` hard-coded catalog 를 `componentCatalog` 소비로 교체.
2. `ComponentFactory.ts`: primitive 배치 = binding 노드 삽입, 조합 컴포넌트 배치 = reusable 로의 `ref` 노드 삽입.
3. `useElementCreator.ts` 가 catalog + canonical props 를 사용하도록 정리.
4. `componentRegistrationContract.test.ts` 에 불변식 C/D/E 추가.

불변식:

- **C**: `placeable === true && cutover === "catalog"` catalog entry ⟹ Panel + Factory + generic 렌더러(DOM·Skia)가 커버.
- **D (family atomic)**: 같은 `family` 의 entry 는 `cutover` 값이 전부 동일. 혼재 시 FAIL.
- **E**: `cutover === "legacy"` entry 는 Panel official catalog 에서 제외.

검증: `pnpm test:registration-contract` / `pnpm run codex:typecheck`
Gate: G3 (불변식), G4 (family 마다 Phase 6 에서)

### Phase 5 — CSS / Skia generic 생성 정합

목표: 시각 산출을 generic 렌더러로 일원화한다.

작업:

1. CSS 는 generic 렌더러가 theme/tokens root collection + 노드 style/`data-*` 에서 생성. 컴포넌트당 CSS 정의 없음.
2. Skia backend 는 resolved tree + theme 를 그린다. 비-DOM-trivial primitive 는 `skiaPrimitive` draw module.
3. starter CSS 는 D3 시각 참조 diff 로만 사용 (runtime 미포함).
4. generic 생성으로 표현 못 하는 RAC structural CSS 만 좁은 manual escape hatch.

검증: `pnpm -F @composition/specs build` / `pnpm run codex:typecheck`
Gate: G5 (family 마다 Phase 6 에서 `/cross-check`)

### Phase 6 — Family-gated atomic cutover

목표: Phase 0~5 공통 기반 위에서 family 순서대로 4경로를 atomic 하게 전환한다.

family 순서: primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native (§5 표 참조).

각 family 마다 §5 표준 체크리스트 수행. 통과 시 `cutover:"catalog"` flip — 4경로 동시 발효. 실패 시 그 family 만 `cutover:"legacy"` 유지, 다음 family 진행.

전 family 가 `cutover:"catalog"` 도달 시 legacy allowlist 고정 + release note + README/ADR status 갱신 + ADR-036/907/908 status 재평가.

검증 (family 마다): `pnpm run codex:guard` / `pnpm run codex:typecheck` / `pnpm run codex:preflight`
Gate: G4 / G5 / G6 (family 반복), G7 (최종)

## 5. Family 실행 순서 + cutover 체크리스트

| 순서 | Family             | 대표 컴포넌트                                                                                                      | 난이도   | 비고                                                        |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| 1    | primitives/actions | Button, ToggleButton(Group), Link, Separator, Icon, Badge                                                          | LOW      | golden path 파일럿. binding + generic 렌더러 패턴 확립      |
| 2    | fields             | TextField, NumberField, SearchField, DateField, TimeField, ColorField, Form, Field, FileTrigger                    | LOW-MED  | canonical props 검증                                        |
| 3    | selection          | Checkbox(Group), Radio(Group), Switch, Slider                                                                      | MED      | state/data-attribute parity. Slider track = `skiaPrimitive` |
| 4    | collections        | ListBox, GridList, Menu, TagGroup, ComboBox, Select, Tabs                                                          | MED-HIGH | collections 데이터 binding(ADR-132)                         |
| 5    | Tree·Table         | Tree, Table, TableView                                                                                             | HIGH     | RAC primitive binding + collections 데이터. 수동 우회 금지  |
| 6    | overlays           | Dialog, Modal, Popover, Tooltip, Toast, DropZone                                                                   | MED      | portal/overlay structural CSS escape hatch 검증             |
| 7    | date/color         | Calendar, RangeCalendar, DatePicker, DateRangePicker, ColorPicker, ColorArea, ColorWheel, ColorSlider, ColorSwatch | MED-HIGH | arc/wheel = `skiaPrimitive`                                 |
| 8    | composition-native | Frame, Slot, reusable tools                                                                                        | LOW-MED  | RAC primitive 미존재 — catalog 등록만, binding 없음         |

정확한 컴포넌트 → family 배정은 Phase 0 inventory 산출물이 SSOT 다.

### family 표준 cutover 체크리스트 (한 family 마다 반복)

| #   | 단계                                                                        | 파일                                                            |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | catalog entry `cutover: "cutting-over"` 표시                                | `packages/shared/src/catalog/componentCatalog.ts`               |
| 2   | family 의 primitive 멤버 → `PrimitiveBinding` 작성                          | `packages/shared/src/catalog/bindings/{Primitive}.binding.ts`   |
| 3   | family 의 조합 멤버 → reusable canonical 문서 저작                          | `packages/shared/src/catalog/library/` (Builder 저작 후 export) |
| 4   | 해당 family 의 legacy 구현 → `legacy/` 이동 (`git mv`)                      | `packages/shared/src/components/legacy/{Comp}.tsx`              |
| 5   | family 의 primitive wrapper 작성                                            | `packages/shared/src/components/{Primitive}.tsx`                |
| 6   | barrel export 경로 교체                                                     | `packages/shared/src/components/index.ts`                       |
| 7   | Panel/Factory 가 해당 family 를 catalog 로 소비                             | `ComponentList.tsx` / `ComponentFactory.ts`                     |
| 8   | generic 렌더러가 family 커버 확인 (DOM + Skia + Inspector) + `/cross-check` | `CanonicalNodeRenderer.tsx` / `buildSpecNodeData.ts`            |
| 9   | registration contract 불변식 C/D/E + family fixture 통과                    | `pnpm test:registration-contract` + family fixture              |
| 10  | 통과 시 catalog entry `cutover: "catalog"` flip                             | `componentCatalog.ts` — 4경로 동시 발효                         |

- 4~6 사이 빌드 깨짐 구간은 family 의 (legacy 이동 + 새 파일 + barrel) 을 한 cohesive commit 으로 묶어 main 에 깨진 중간 상태가 들어가지 않게 한다.
- 9 미통과 시 10 미실행 — 해당 family `cutover:"legacy"` 유지, 다음 family 진행.

## 6. Legacy Allowlist 원칙

cutover 후 허용되는 legacy usage:

- legacy 문서 import adapter
- export/cloud/publish compatibility projection
- migration fixture
- explicit legacy fallback test

허용되지 않는 usage:

- Component Panel official entry
- component factory creation source
- Preview/Publish primary renderer
- Skia primary renderer
- Inspector props source
- `packages/shared/src/catalog/**` 가 기존 `ComponentSpec` / `ReactRenderer` / `CSSGenerator` 를 import

## 7. 완료 판정

ADR-142 를 Implemented 로 승격하려면 전 family 가 `cutover:"catalog"` 에 도달하고 아래가 모두 참이어야 한다.

1. inventory + `componentCatalog` 가 현재 official component set 을 설명하고, 124 `ComponentSpec` 의 legacy 처분이 명시된다.
2. 조합 컴포넌트가 canonical reusable 문서로 정의되어 있고, 코드 정의가 leaf primitive 약 35개의 `PrimitiveBinding` 으로 한정된다.
3. Component Panel / Factory 가 `componentCatalog` 만 소비한다.
4. Preview/Publish 가 resolved canonical tree 를 단일 render source 로 소비하고, reusable origin / ref instance / descendants 3-mode / slot fill 이 화면에 펼쳐진다.
5. Skia 가 generic 렌더러로 resolved tree + theme 를 그린다 (`render.shapes()` 미사용).
6. Properties Panel 이 `PropContract`(primitive `accepts`) / `propsSchema`(reusable) + theme 로 편집 필드를 generic 생성하고, 컴포넌트당 `properties.sections`/`SpecField` 분기에 대한 active 경로 의존이 0건이다.
7. Tree/Table 이 RAC primitive binding + collections 데이터로 Skia·Preview 양쪽에서 동작한다.
8. legacy import allowlist 외 active usage 0건, active 경로의 `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조 0건.
9. `pnpm run codex:preflight` 통과.
10. ADR 본문·README status 가 Implemented 로 동기화되고, ADR-036/907/908 status 가 재평가된다.
