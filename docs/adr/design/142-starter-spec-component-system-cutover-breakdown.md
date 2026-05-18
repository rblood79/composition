# ADR-142 Breakdown: Starter + Spec vNext 기반 컴포넌트 시스템 family 단위 cutover

## 1. 목표

새 컴포넌트 시스템을 `packages/react-aria-starter/src` 원본과 **새로 정의하는 `StarterComponentContract`(Spec vNext)** 기준으로 구축하고, 공통 기반 gate 를 먼저 고정한 뒤 Builder 의 공식 Component Panel / Factory / Preview / Publish / Skia 경로를 **family 단위로 atomic 하게** cutover 한다 (family-gated atomic cutover — 전역 단일 스위치 금지).

**기존 `packages/specs` 의 `ComponentSpec`(`render.shapes()` 모델)은 참조·확장·migration 대상이 아니다.** `StarterComponentContract` 는 starter 컴포넌트 + canonical format 으로부터 새로 작성한다. 기존 `ComponentSpec`(124) / `ReactRenderer` / `specShapesToSkia` / `rendererMap` 은 legacy boundary 로 격리하며 새 시스템이 import 하지 않는다.

핵심 산출물:

- starter inventory + current registry diff + 기존 124 `ComponentSpec` 의 legacy 처분 목록
- `StarterComponentContract`(Spec vNext) 타입 + sub-contract 정의
- 4 outputs 변환기 — `toRacProps` / `toGeneratedCss` / `toSkiaVisualModel` / `toInspectorFields`
- `starterComponentManifest` (contract registry + family/cutover/panel/support metadata)
- registration contract 확장 (manifest cross-check + family atomicity 불변식)
- Preview reusable/ref/descendants/slot resolved-tree resolver gate
- 새 `packages/shared/src/components` official adapter surface + `legacy` boundary
- family 단위 4경로 atomic cutover

## 2. 파일 경계

### 새로 만들 파일

| 파일                                                                                   | 책임                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `docs/reference/audits/2026-05-18-starter-spec-component-inventory.md`                 | starter source / current shared / Panel / Factory / rendererMap / 기존 124 ComponentSpec 처분 inventory     |
| `packages/specs/src/starter/types.ts`                                                  | `StarterComponentContract` + sub-contract(Part/Slot/Prop/DynamicProp/ChildrenPlan/Visual\*) + manifest 타입 |
| `packages/specs/src/starter/contracts/{Component}.contract.ts`                         | per-component `StarterComponentContract` — starter 컴포넌트 기준 신규 작성                                  |
| `packages/specs/src/starter/outputs/toRacProps.ts`                                     | contract → RAC component props 변환기                                                                       |
| `packages/specs/src/starter/outputs/toGeneratedCss.ts`                                 | contract → generated CSS 변환기                                                                             |
| `packages/specs/src/starter/outputs/toSkiaVisualModel.ts`                              | contract → Skia ResolvedVisualModel / DrawCommand 변환기                                                    |
| `packages/specs/src/starter/outputs/toInspectorFields.ts`                              | contract → Inspector property fields 변환기                                                                 |
| `packages/specs/src/starter/starterComponentManifest.ts`                               | contract registry + Panel/Factory/Preview/Skia support level + family/cutover 상태 source                   |
| `packages/specs/src/starter/__tests__/starterComponentManifest.test.ts`                | placeable entry 가 contract/default props/runtime support/family/cutover 를 선언하는지 검증                 |
| `packages/shared/src/components/legacy/README.md`                                      | 기존 shared 구현의 compatibility boundary 규칙                                                              |
| `apps/builder/src/builder/panels/components/__tests__/componentPanelManifest.test.tsx` | Panel 이 manifest + contract 기준으로만 등록하는지 검증                                                     |
| `apps/builder/src/builder/factories/__tests__/componentFactoryManifest.test.ts`        | Factory creator/default props 가 manifest + contract 기준으로 생성되는지 검증                               |
| `apps/builder/src/preview/__tests__/canonicalPreviewRefSlot.test.tsx`                  | Preview 가 reusable/ref/descendants/slot resolved tree 를 실제 DOM 으로 렌더링하는지 검증                   |

### 수정할 파일

| 파일                                                                                 | 변경                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `packages/specs/src/index.ts`                                                        | `StarterComponentContract` / `starterComponentManifest` / outputs 변환기 export                |
| `packages/shared/src/components/index.ts`                                            | cutover 후 official component surface barrel export (starter import + contract adapter)        |
| `packages/shared/src/components/index.css`                                           | generated CSS + structural CSS import 순서 재정의                                              |
| `packages/shared/src/components/styles/index.css`                                    | manual structural CSS allowlist 로 축소                                                        |
| `packages/shared/src/renderers/index.ts`                                             | `rendererMap` 을 legacy compatibility fallback 으로 격리                                       |
| `apps/builder/src/builder/panels/components/ComponentList.tsx`                       | hard-coded component list 를 manifest 소비로 전환                                              |
| `apps/builder/src/builder/factories/ComponentFactory.ts`                             | manual creator map 을 manifest + `contract.canonical.defaults` 기반으로 전환                   |
| `apps/builder/src/builder/factories/__tests__/componentRegistrationContract.test.ts` | manifest cross-check + family 단위 `cutover` 동일성 불변식 추가 (family 내 신·구 혼재 차단)    |
| `apps/builder/src/builder/hooks/useElementCreator.ts`                                | Factory 호출 경로가 canonical props + manifest 를 사용하도록 정리                              |
| `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`                    | builder merged tag→contract map 과 manifest support level cross-check                          |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`                | Skia path 가 `contract.outputs.toSkiaVisualModel` 을 소비하도록 전환 (render.shapes 경로 격리) |
| `apps/builder/src/resolvers/canonical/index.ts`                                      | reusable/ref/descendants/slot fill resolved tree 계약 fixture 보강                             |
| `apps/builder/src/preview/App.tsx`                                                   | Preview canonical render branch 가 resolved tree 를 단일 source 로 삼도록 정리                 |
| `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`                      | fallback 포함 모든 렌더 경로가 `ResolvedNode.children` 를 잃지 않게 정리                       |

### legacy 처분 파일 (참조·확장 금지 — 격리만)

| 파일                                            | 처분                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `packages/specs/src/components/*.spec.ts` (124) | legacy. 새 contract 가 import/파생하지 않음. legacy document 호환·migration reference 로만 유지 |
| `packages/specs/src/renderers/ReactRenderer.ts` | legacy. className/dataAttributes/style 만 산출 — RAC 구조 표현 불가                             |
| `packages/specs/src/renderers/CSSGenerator.ts`  | legacy. 새 CSS 는 `outputs/toGeneratedCss.ts`                                                   |

### 경계 규칙

- `packages/react-aria-starter/src/**`: 원본 snapshot. product behavior 직접 수정 금지.
- `packages/specs/src/starter/**`: `StarterComponentContract` + manifest + outputs 변환기. 새 시스템의 D2/D3 SSOT.
- `packages/specs/src/components/**` + `renderers/ReactRenderer.ts` + `renderers/CSSGenerator.ts`: legacy. 새 `starter/**` 가 import 하지 않는다.
- `packages/shared/src/components/**`: cutover 후 official runtime surface (starter import + contract adapter).
- `packages/shared/src/components/legacy/**`: compatibility fallback. active Builder authoring path 에서 직접 import 금지.

## 3. StarterComponentContract (Spec vNext) 모델

새 SSOT 는 shape 생성 함수가 아니라 **contract** 다. starter 컴포넌트의 구조를 선언하고, CSS·RAC props·Skia draw command·Inspector fields 를 모두 contract 의 output 으로 산출한다.

```ts
export type StarterComponentSource =
  | "starter"
  | "composition-native"
  | "legacy-hidden";

export type StarterComponentFamily =
  | "primitives"
  | "fields"
  | "selection"
  | "collections"
  | "tree-table"
  | "overlays"
  | "date-color"
  | "composition-native";

export type StarterComponentCutoverState =
  | "legacy"
  | "cutting-over"
  | "starter";

export type StarterComponentSupportLevel =
  | "full"
  | "preview-only"
  | "skia-visual-only"
  | "hidden";

export type StarterComponentStructureKind =
  | "leaf"
  | "slot-container"
  | "collection"
  | "recursive-collection"
  | "table";

// per-component SSOT — starter 컴포넌트 + canonical 으로부터 신규 작성
export interface StarterComponentContract {
  source: {
    package: "@composition/react-aria-starter-upstream";
    importPath: string;
    component: string;
  };
  rac: {
    primitive: string;
    parts: Record<string, PartContract>;
    slots: Record<string, SlotContract>;
    states: string[];
    renderProps: string[];
    dataAttributes: string[];
  };
  canonical: {
    propsSchema: Record<string, PropContract>;
    defaults: Record<string, unknown>;
    dynamicProps: DynamicPropContract[];
    serializationPolicy: "canonical-props-only";
  };
  structure: {
    kind: StarterComponentStructureKind;
    childrenPlan: ChildrenPlan;
    resourceStrategy?: "materialized" | "template-ref-delta" | "virtualized";
  };
  visual: {
    tokens: VisualTokenContract;
    variants: VariantContract[];
    states: StateVisualContract[];
    parts: PartVisualContract[];
  };
  outputs: {
    toRacProps: unknown; // contract → RAC component props
    toGeneratedCss: unknown; // contract → generated CSS
    toSkiaVisualModel: unknown; // contract → ResolvedVisualModel / DrawCommand
    toInspectorFields: unknown; // contract → Inspector property fields
  };
}

// manifest = contract registry + family-gated cutover / panel metadata
export interface StarterComponentManifestEntry {
  type: string;
  classification: StarterComponentSource;
  family: StarterComponentFamily;
  cutover: StarterComponentCutoverState;
  contract: StarterComponentContract;
  panel: {
    category: string;
    label: string;
    icon: string;
    placeable: boolean;
  };
  support: {
    preview: StarterComponentSupportLevel;
    publish: StarterComponentSupportLevel;
    skia: StarterComponentSupportLevel;
  };
}
```

- `StarterComponentContract` 가 컴포넌트별 D2(`canonical`)/D3(`visual`+`structure`) SSOT 다. `render.shapes()` 같은 그리기 함수가 아니라 선언 + output 변환기 계약이다.
- sub-contract(`PartContract`/`SlotContract`/`PropContract`/`DynamicPropContract`/`ChildrenPlan`/`VisualTokenContract`/`VariantContract`/`StateVisualContract`/`PartVisualContract`)는 Phase 1 에서 정의한다.
- `family` 와 `cutover` 가 family-gated atomic cutover 의 SSOT 다. 한 family 의 모든 entry 는 `cutover` 를 `legacy → cutting-over → starter` 로 함께 거치며, 같은 family 안에서 `legacy` 와 `starter` 가 혼재할 수 없다 (registration contract 불변식 강제).

분류 기준 (`classification`):

- `starter`: starter 에 원본이 있는 RAC 컴포넌트. 예: Button, TextField, Checkbox, Select, Dialog.
- `composition-native`: starter 에 없지만 composition authoring/runtime 에 필요. 예: Frame, Slot, reusable tooling. starter import 없이 contract 만 작성.
- `legacy-hidden`: 기존 shared 구현이지만 새 official Panel 에 노출하지 않는 compatibility target.

Tree/Table 특수 규칙:

- Tree 는 `structure.kind: "recursive-collection"` — recursive item identity, expansion state, child traversal, drop indicator, row-level selection/focus state 를 contract 가 표현해야 한다.
- Table 은 `structure.kind: "table"` — columns/column groups/header/body/row/cell, sorting, selection, resizing, virtualized row layout, empty/loading state 를 contract 가 표현해야 한다.
- `support.preview: "full"` / `support.skia: "full"` 주장은 전용 structure contract fixture 통과 시에만 인정.
- 기존 수동 Tree/Table 구현 유지만으로는 Tree·Table family cutover 완료로 보지 않는다 — structure contract 실패 시 family cutover 보류.

Resource 특수 규칙:

- 반복 구조가 큰 컴포넌트(Tree/Table/TableView/virtualized collection)는 `structure.resourceStrategy: "template-ref-delta"` 또는 `"virtualized"`.
- canonical document 에 row/cell/tree node 를 전수 materialize 하지 않는다 — reusable origin/template + `type:"ref"` instance + slot fill + `descendants` delta 로 표현.
- 대량 materialized node 는 Preview/Skia/layout 의 resolved projection/cache boundary 에서만 생성.

## 4. Phase 계획

cutover 는 전역 단일 스위치가 아니라 **family-gated atomic cutover** 다. Phase 0~5 는 family cutover 착수 전 1회 수행하는 **공통 기반 + infrastructure** 단계다 — `StarterComponentContract` 정의 / 4 outputs 변환기 / manifest / Tree·Table structure contract / Preview resolved-tree resolver / shared official surface / Panel·Factory·Preview·Skia 의 manifest 소비 배선을 갖춘다. 이 단계의 "cutover"·"전환" 표현은 해당 경로를 manifest 기반으로 읽도록 배선하는 **infrastructure 변경**을 뜻하며 특정 family 를 활성화하지 않는다. Phase 6 은 family 순서대로 manifest 의 `cutover` 필드를 flip 해 한 family 의 4경로를 동시에 활성화하는 **반복 단계**다.

### Phase 0 — Freeze + Inventory Baseline

목표: cutover 준비 중 legacy active surface 가 더 늘지 않게 고정하고, 기존 자산의 처분을 명시한다.

작업:

1. `packages/react-aria-starter/UPSTREAM.md` 정책 기준 starter source 직접 수정 금지 확인. `packages/react-aria-starter/**` 가 `codex:format` 대상에서 제외되는지 확인.
2. current registry baseline 수집: starter src / `packages/shared/src/components` / `ComponentList.tsx` / `ComponentFactory.ts` / `renderers/index.ts` / `tagSpecMap.ts`.
3. 기존 124 `ComponentSpec`(`packages/specs/src/components/*.spec.ts`)의 처분을 명시 — 전수 legacy(새 contract 가 참조하지 않음, legacy document 호환·migration reference 로만).
4. `docs/reference/audits/2026-05-18-starter-spec-component-inventory.md` 작성 — starter 컴포넌트 ↔ shared ↔ Panel ↔ Factory ↔ rendererMap ↔ legacy ComponentSpec diff.

검증: `pnpm run codex:guard` / `pnpm run codex:format`

Gate:

- G0: 신규 active component registration 이 legacy/manual list 로 추가되지 않음.
- G1: inventory 가 starter/shared/panel/factory/renderer registry + 기존 124 ComponentSpec 의 legacy 처분을 포함.

### Phase 1 — StarterComponentContract 정의 + manifest

목표: Spec vNext 의 핵심 — `StarterComponentContract` 타입 + sub-contract + 4 outputs 변환기 + manifest 를 만든다. 기존 `ComponentSpec` 을 참조하지 않는다.

작업:

1. `packages/specs/src/starter/types.ts` — `StarterComponentContract` + sub-contract(`PartContract`/`SlotContract`/`PropContract`/`DynamicPropContract`/`ChildrenPlan`/`VisualTokenContract`/`VariantContract`/`StateVisualContract`/`PartVisualContract`) + manifest 타입.
2. `packages/specs/src/starter/outputs/{toRacProps,toGeneratedCss,toSkiaVisualModel,toInspectorFields}.ts` — 4 outputs 변환기.
3. primitives/Button 으로 contract + 4 outputs 를 **파일럿 확정** — 새 모델이 RAC parts/slots/render-prop/state 를 표현하는지 검증.
4. `packages/specs/src/starter/contracts/` 에 family 별 contract 작성 (Phase 6 family cutover 시점에 family 별로 채움 — Phase 1 은 primitives 파일럿까지).
5. `packages/specs/src/starter/starterComponentManifest.ts` — contract registry + family/cutover/panel/support.
6. `packages/specs/src/index.ts` 에 contract/manifest/outputs export.
7. `starterComponentManifest.test.ts`:
   - `placeable === true` entry 는 `contract` 존재 + `contract.canonical.defaults` 가 object.
   - 모든 entry 가 `family`/`cutover` 를 가지며 같은 `family` 는 `cutover` 동일.
   - `structure.kind === "recursive-collection"` 은 recursive identity + expansion + selection contract 선언.
   - `structure.kind === "table"` 은 columns/header/body/row/cell + sorting/selection/resizing/virtualization 선언.
   - recursive-collection/table 은 `resourceStrategy` 가 `"template-ref-delta"` 또는 `"virtualized"`.

검증: `pnpm -F @composition/specs test starterComponentManifest` / `pnpm -F @composition/specs build`

Gate:

- G2: placeable entry 100% 가 `StarterComponentContract`/default props/panel/support/family/cutover metadata 를 가진다.
- G2-T: Tree/Table full support 는 structure contract 없이는 금지 — 미충족 시 Tree·Table family cutover 보류.
- G2-R: Tree/Table 반복 구조가 reusable origin/template + ref instance + slot + descendants delta 로 저장되고, canonical 전수 materialize 금지.

### Phase 1-T — Tree/Table Contract 표현력 Gate

목표: 구버전 Spec 이 표현 못 한 Tree/Table 을 새 contract 의 proof gate 로 분리한다.

작업:

1. `Tree` contract 작성 — `structure.kind: "recursive-collection"`: recursive item identity / expansion state / selected·focused·drag·drop state / child traversal·indentation / TreeItem row visual model.
2. `Table` / `TableView` contract 작성 — `structure.kind: "table"`: columns·column groups / header·body·row·cell / sorting / selection / resizing / virtualized row layout / loading·empty state.
3. Preview fixture + Skia visual model fixture 를 먼저 작성.
4. fixture 실패 시 Tree/Table 을 숨기는 것으로 완료하지 않고 Tree·Table family cutover 를 보류.

검증: `pnpm -F @composition/specs test starterComponentManifest` / `pnpm -F @composition/builder test tagSpecMap` / `pnpm run codex:typecheck`

Gate:

- G2-T-1: Tree full support 는 recursive collection fixture 없이 금지.
- G2-T-2: Table full support 는 table structure fixture 없이 금지.
- G2-T-3: Tree/Table fixture 실패 시 Tree·Table family cutover 보류.

### Phase 1-P — Preview Canonical Resolver/Renderer Gate

목표: Preview 에서 `reusable` origin / `type:"ref"` instance / `descendants` / `slot` fill 이 보이지 않는 문제를 cutover blocker 로 고정한다. resolver 가 tree 를 푸는 것만으로는 부족하며, Preview render consumer 가 resolved `node.children` 를 실제 렌더 source 로 소비해야 한다.

작업:

1. `resolveCanonicalDocument()` fixture 보강 — reusable origin root / `type:"ref"` instance / root `props` override / descendants mode A·B·C / slot path children replacement.
2. `CanonicalNodeRenderer` 가 fallback 경로에서도 resolved `node.children` 를 잃지 않도록 render context 분리.
3. Preview canonical branch 가 legacy `elements[]` length / legacy parent lookup 에 기대어 ref/slot children 을 렌더링하지 않게 한다.
4. origin 은 명시적으로 canvas/page tree 에 놓인 경우만 보이고, instance 는 origin visual contract 를 resolve 해서 보인다. unintended duplicate / invisible slot content 를 실패로 처리.

검증: `pnpm -F @composition/builder test canonicalPreviewRefSlot` / `pnpm -F @composition/builder test resolver` / `pnpm run codex:typecheck`

Gate:

- G4-P-1: reusable origin + ref instance 가 Preview 에서 동시에 의도된 visibility 로 렌더.
- G4-P-2: root props override + descendants 3-mode override 가 Preview DOM 에 반영.
- G4-P-3: slot fill children replacement 가 Preview 에서 보임.
- G4-P-4: fallback 경로가 resolved children 을 legacy `elements[]` lookup 으로 잃지 않음.

### Phase 2 — Shared Official Surface 재구성

목표: `packages/shared/src/components` 를 새 official adapter surface 로 재정의한다.

작업:

1. 기존 active 구현을 component family 별로 `packages/shared/src/components/legacy` 로 격리할 이동 계획 작성.
2. 새 official file 은 기존 public filename 유지 (`Button.tsx` 등).
3. 새 official component 는 starter component 를 import 하고 adapter 6항목만 부착 (§5 참조). starter source 직접 수정 금지.
4. composition-native component(Frame/Slot 등)는 `classification: "composition-native"` 로 manifest 에 등록.
5. `packages/shared/src/components/index.ts` 는 새 official surface 만 export.
6. `legacy/README.md` 에 import 허용 경계 명시.

검증: `pnpm run codex:typecheck`

Gate:

- G3: barrel export 가 새 official surface 로 빌드 + Preview 가 resolved tree 단일 소비 (F1~F4 통과).
- G6: active path 에서 legacy import allowlist 외 직접 사용 0건.

### Phase 3 — Builder Panel + Factory manifest 배선

목표: Component Panel 과 element creation 이 manifest + contract 를 source 로 소비하도록 **배선**한다. 어떤 family 가 활성화될지는 manifest `cutover` 필드가 결정(Phase 6).

작업:

1. `ComponentList.tsx` hard-coded catalog 를 manifest 기반으로 교체. category/label/icon/placeable 은 manifest 에서 읽음.
2. `ComponentFactory.ts` manual creator map 을 manifest + `contract.canonical.defaults` 기반으로 전환.
3. complex component 는 `contract.structure.childrenPlan` 으로 생성 규칙 선언.
4. `useElementCreator.ts` 는 `getDefaultProps(type)` fallback 보다 manifest/contract default 우선.

검증: `pnpm -F @composition/builder test componentPanelManifest` / `pnpm -F @composition/builder test componentFactoryManifest` / `pnpm run codex:typecheck`

Gate:

- G4: Component Panel / Factory / Inspector authoring path 가 manifest + contract 를 source 로 사용 (family 마다 Phase 6 에서 검증).

### Phase 4 — Preview/Publish Runtime 배선

목표: Preview/Publish 가 새 shared component surface 와 contract runtime 을 소비하도록 **배선**한다.

작업:

1. `rendererMap` / `ReactRenderer` 를 legacy fallback boundary 로 낮춤.
2. 새 placeable component 는 starter import + `contract.outputs.toRacProps` runtime path 우선.
3. legacy payload import/export compatibility 는 adapter boundary 로 격리.
4. Phase 1-P fixture 를 실제 Preview cutover path 에 연결 — resolved `ResolvedNode` tree 가 단일 source, fallback 경로도 resolved children 소비.

검증: `pnpm -F @composition/builder test canonicalPreviewRefSlot` / `pnpm run codex:typecheck` / `pnpm run codex:preflight`

Gate:

- G5-preview: canonical fixture 가 Preview 에서 새 shared component 로 렌더 (family 마다 Phase 6 에서 검증).
- G4-P: reusable/ref/descendants/slot Preview fixture 가 invisible/duplicate node 없이 통과.
- G6: active runtime direct legacy import 0건.

### Phase 5 — CSS + Skia Parity 기반

목표: starter visual baseline 을 `contract.visual` 로 흡수하고, `toGeneratedCss` 와 `toSkiaVisualModel` 이 같은 fixture 를 통과하게 한다.

작업:

1. starter CSS 는 reference diff 로만 사용.
2. `contract.visual`(tokens/variants/states/parts)에 starter style delta 반영.
3. `outputs/toGeneratedCss.ts` 산출물 snapshot 갱신.
4. Skia path 는 `outputs/toSkiaVisualModel.ts` (ResolvedVisualModel/DrawCommand)를 소비 — starter CSS 미파싱, 기존 `render.shapes()`/`specShapesToSkia` 경로 격리.
5. manual CSS 는 generator 가 표현하지 못하는 RAC structural CSS 에 한정.

검증: `pnpm -F @composition/specs build` / `pnpm -F @composition/builder test tagSpecMap` / `pnpm run codex:typecheck`

Gate:

- G5-skia: canonical fixture 가 `toGeneratedCss` snapshot 과 `toSkiaVisualModel`/draw command snapshot 을 동시 통과.

### Phase 6 — Family-gated Atomic Cutover

목표: Phase 0~5 의 공통 기반·infrastructure 가 고정된 뒤, family 순서대로 각 family 의 4경로(Component Panel / Factory / Preview·Publish / Skia)를 atomic 하게 전환한다. 전역 단일 스위치가 아니라 family 단위 반복이다.

family 순서: primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native (§5 표 참조).

각 family 에 대해 §5 의 표준 cutover 체크리스트를 수행한다. 핵심:

1. 해당 family 의 manifest entry `cutover` 를 `cutting-over` 로 표시.
2. family 별 `StarterComponentContract` 작성 + 구현을 `legacy/` 로 이동 + 새 official adapter 컴포넌트 작성.
3. 해당 family 의 4경로(Panel catalog / Factory creation / Preview·Publish runtime / Skia support)를 manifest 기반으로 활성화.
4. `toGeneratedCss` 재생성 + registration contract + targeted fixture 통과 확인.
5. 통과 시 manifest entry `cutover` 를 `starter` 로 flip — 4경로 동시 발효.
6. 실패 시 그 family 만 `cutover: "legacy"` 유지(fallback/hidden), 다음 family 진행.

전 family 가 `cutover: "starter"` 도달 시 legacy allowlist 고정 + cutover release note + README/ADR status 갱신.

검증 (family 마다): `pnpm run codex:guard` / `pnpm run codex:typecheck` / `pnpm run codex:preflight`

Gate:

- G4 / G5 / G6: family 마다 반복 — 한 family 의 Panel·Factory·Preview·Publish·Skia·legacy 격리를 동시 검증.
- G7: 전 family 가 `cutover: "starter"` 도달 + 모든 family gate 통과. 실패 family 는 legacy fallback/hidden 유지, 해당 family commit revert (다른 family 영향 없음).

## 5. Family 실행 순서 + cutover 체크리스트

구현 준비는 family 단위로 병렬 진행할 수 있고, **active cutover 도 family 단위 atomic** 으로 수행한다 (Phase 6). 공통 기반·infrastructure(Phase 0~5)가 고정된 뒤 아래 순서대로 각 family 의 4경로를 동시에 전환하며, 한 family cutover 가 실패하면 그 family 만 legacy fallback/hidden 으로 두고 다음 family 를 진행한다.

| 순서 | Family             | 대표 컴포넌트                                                                                                      | 난이도   | 비고                                                                                                                                   |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | primitives/actions | Button, ToggleButton(Group), Link, Separator, Icon, Badge                                                          | LOW      | Panel/Factory/Preview/Skia golden path 파일럿. contract + 4 outputs 변환기 패턴 확립                                                   |
| 2    | fields             | TextField, NumberField, SearchField, DateField, TimeField, ColorField, Form, Field, FileTrigger                    | LOW-MED  | `canonical` props/dynamic props 검증                                                                                                   |
| 3    | selection          | Checkbox(Group), Radio(Group), Switch, Slider                                                                      | MED      | state/data-attribute parity 검증                                                                                                       |
| 4    | collections        | ListBox, GridList, Menu, TagGroup, ComboBox, Select, Tabs                                                          | MED-HIGH | flat items/selection/section/virtual child 모델 검증                                                                                   |
| 5    | Tree·Table         | Tree, Table, TableView                                                                                             | HIGH     | 구버전 Spec 실패 영역. recursive/table structure contract(G2-T) + reusable origin/ref/slot/descendants delta resource(G2-R) acceptance |
| 6    | overlays           | Dialog, Modal, Popover, Tooltip, Toast, DropZone                                                                   | MED      | portal/overlay/manual structural CSS 경계 검증                                                                                         |
| 7    | date/color         | Calendar, RangeCalendar, DatePicker, DateRangePicker, ColorPicker, ColorArea, ColorWheel, ColorSlider, ColorSwatch | MED-HIGH | generated CSS 한계와 manual escape hatch 검증                                                                                          |
| 8    | composition-native | Frame, Slot, reusable tools                                                                                        | LOW-MED  | starter 미존재 — starter import 없이 contract 만 작성, manifest 등록 동일 요구                                                         |

정확한 컴포넌트 → family 배정은 Phase 0 inventory 산출물이 SSOT 다.

### family 표준 cutover 체크리스트 (한 family 마다 반복)

| #   | 단계                                             | 파일                                                                  |
| --- | ------------------------------------------------ | --------------------------------------------------------------------- |
| 1   | manifest entry `cutover: "cutting-over"` 표시    | `packages/specs/src/starter/starterComponentManifest.ts`              |
| 2   | `StarterComponentContract` 작성 (starter 기준)   | `packages/specs/src/starter/contracts/{Comp}.contract.ts`             |
| 3   | 구현 → legacy 이동 (`git mv`)                    | `packages/shared/src/components/legacy/{Comp}.tsx`                    |
| 4   | 새 adapter 작성 (starter import + adapter 6항목) | `packages/shared/src/components/{Comp}.tsx`                           |
| 5   | barrel export 경로 교체                          | `packages/shared/src/components/index.ts`                             |
| 6   | `toGeneratedCss` 재생성                          | `pnpm -F @composition/specs build` → generated CSS                    |
| 7   | Panel catalog → manifest 소비                    | `apps/builder/src/builder/panels/components/ComponentList.tsx`        |
| 8   | Factory creator → manifest/contract default      | `apps/builder/src/builder/factories/ComponentFactory.ts`              |
| 9   | rendererMap/ReactRenderer → legacy 격리          | `packages/shared/src/renderers/index.ts`                              |
| 10  | Skia: `toSkiaVisualModel` 소비 확인              | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` |
| 11  | registration contract + targeted fixture 통과    | `pnpm test:registration-contract` + family fixture                    |
| 12  | 통과 시 manifest `cutover: "starter"` flip       | manifest — 4경로 동시 발효                                            |

- 3~5 사이 빌드 깨짐 구간은 family 의 (legacy 이동 + 새 파일 + barrel) 을 한 cohesive commit 으로 묶어 main 에 깨진 중간 상태가 들어가지 않게 한다.
- 11 미통과 시 12 미실행 — 해당 family `cutover: "legacy"` 유지, 다음 family 진행.
- adapter 6항목: composition props mapping / canonical payload normalization / `contract.canonical` default·dynamic props 연결 / generated CSS class·data-attribute 연결 / event·action·data binding boundary / composition-native 확장 동작.

## 6. Legacy Allowlist 원칙

cutover 후 허용되는 legacy usage:

- legacy document import adapter
- export/cloud/publish compatibility projection
- migration fixture
- explicit legacy fallback test

허용되지 않는 usage:

- Component Panel official entry
- new component factory creation source
- Preview/Publish primary renderer
- Skia primary renderer
- Inspector props source
- 새 `StarterComponentContract` / `packages/specs/src/starter/**` 가 기존 `ComponentSpec` / `ReactRenderer` / `CSSGenerator` 를 import

## 7. 완료 판정

ADR-142 를 Implemented 로 승격하려면 전 family 가 `cutover: "starter"` 에 도달하고 아래가 모두 참이어야 한다.

1. starter inventory + manifest 가 현재 official component set 을 설명하고, 기존 124 `ComponentSpec` 의 legacy 처분이 명시된다.
2. Component Panel 이 manifest + `StarterComponentContract` source 로만 구성된다.
3. Factory/default props 가 canonical props + `contract.canonical.defaults` 기준으로 생성된다.
4. Preview/Publish 는 새 shared official surface(starter import + contract adapter)를 우선 사용한다.
5. Preview 는 reusable origin, ref instance, descendants 3-mode override, slot fill 을 resolved canonical tree 기준으로 렌더한다.
6. Skia 는 `contract.outputs.toSkiaVisualModel` 로 동일 fixture 를 렌더한다 (`render.shapes()` 미사용).
7. Tree/Table 은 recursive/table structure contract 를 통과해 official full support 로 등록되어 있다.
8. Tree/Table 반복 구조는 reusable origin/template + ref instance + slot + descendants delta 로 저장되고, materialized projection 은 cache boundary 에 한정된다.
9. legacy import allowlist 외 active usage 가 0건이고, active 경로의 `ComponentSpec`/`ReactRenderer`/`render.shapes` 참조가 0건이다.
10. `pnpm run codex:preflight` 가 통과한다.
11. ADR 본문과 README 상태가 Implemented 로 동기화된다.
