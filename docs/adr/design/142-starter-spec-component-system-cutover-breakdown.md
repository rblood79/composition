# ADR-142 Breakdown: Starter + Spec 기반 컴포넌트 시스템 family 단위 cutover

## 1. 목표

새 컴포넌트 시스템을 `packages/react-aria-starter/src` 원본과 `packages/specs/src/components` ComponentSpec 기준으로 구축하고, 공통 기반 gate 를 먼저 고정한 뒤 Builder 의 공식 Component Panel / Factory / Preview / Publish / Skia 경로를 **family 단위로 atomic 하게** cutover 한다 (family-gated atomic cutover — 전역 단일 스위치 금지).

핵심 산출물:

- starter inventory + current registry diff
- `starterComponentManifest` (family + cutover 상태 필드 포함)
- Spec-required component registration contract (manifest cross-check + family atomicity 불변식)
- 새 `packages/shared/src/components` official runtime surface
- legacy boundary 격리
- Component Panel / Factory / Preview / Publish / Skia active path 의 family 단위 cutover
- CSS/generated/Skia parity fixture
- Tree/Table 구조 표현력 contract. 구버전 Spec SSOT 가 실패한 Tree/Table 을 새 시스템의 acceptance test 로 삼고, Tree 는 재귀 구조로, Table 은 row/column/cell/header structure 로 풀어낸다.
- Preview reusable/origin/instance/slot resolved-tree fixture. 현재 Preview 에서 복제된 instance 와 slot fill 이 보이지 않는 문제를 cutover blocker 로 두고, resolved canonical tree 가 실제 render input 으로 소비되는지 검증한다.

## 2. 파일 경계

### 새로 만들 파일

| 파일                                                                                   | 책임                                                                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/reference/audits/2026-05-18-starter-spec-component-inventory.md`                 | starter source, current shared, Component Panel, Factory, rendererMap, TAG_SPEC_MAP 차이 inventory  |
| `packages/specs/src/starter/starterComponentManifest.ts`                               | placeable component manifest. Panel/Factory/Preview/Skia support level + family/cutover 상태 source |
| `packages/specs/src/starter/types.ts`                                                  | manifest entry, support level, source/family/cutover classification 타입                            |
| `packages/specs/src/starter/__tests__/starterComponentManifest.test.ts`                | placeable entry 가 Spec/default props/runtime support 를 선언하는지 검증                            |
| `packages/shared/src/components/legacy/README.md`                                      | 기존 shared 구현의 compatibility boundary 규칙                                                      |
| `apps/builder/src/builder/panels/components/__tests__/componentPanelManifest.test.tsx` | Panel 이 manifest+Spec 기준으로만 등록하는지 검증                                                   |
| `apps/builder/src/builder/factories/__tests__/componentFactoryManifest.test.ts`        | Factory creator/default props 가 manifest+Spec 기준으로 생성되는지 검증                             |
| `apps/builder/src/preview/__tests__/canonicalPreviewRefSlot.test.tsx`                  | Preview 가 reusable/ref/descendants/slot resolved tree 를 실제 DOM 으로 렌더링하는지 검증           |

### 수정할 파일

| 파일                                                                                 | 변경                                                                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `packages/specs/src/components/index.ts`                                             | manifest 가 참조할 ComponentSpec export 누락 정리                                           |
| `packages/specs/src/index.ts`                                                        | starter manifest export                                                                     |
| `packages/shared/src/components/index.ts`                                            | cutover 후 official component surface barrel export                                         |
| `packages/shared/src/components/index.css`                                           | generated CSS + structural CSS import 순서 재정의                                           |
| `packages/shared/src/components/styles/index.css`                                    | manual structural CSS allowlist 로 축소                                                     |
| `packages/shared/src/renderers/index.ts`                                             | `rendererMap` 을 compatibility fallback 으로 격리                                           |
| `apps/builder/src/builder/panels/components/ComponentList.tsx`                       | hard-coded component list 를 manifest 소비로 전환                                           |
| `apps/builder/src/builder/factories/ComponentFactory.ts`                             | manual creator map 을 manifest/Spec default 기반으로 전환                                   |
| `apps/builder/src/builder/factories/__tests__/componentRegistrationContract.test.ts` | manifest cross-check + family 단위 `cutover` 동일성 불변식 추가 (family 내 신·구 혼재 차단) |
| `apps/builder/src/builder/hooks/useElementCreator.ts`                                | Factory 호출 경로가 canonical props + manifest 를 사용하도록 정리                           |
| `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`                    | builder merged `TAG_SPEC_MAP` 와 manifest support level cross-check                         |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`                | Skia path 가 Spec visual contract 를 소비하는지 fixture 추가                                |
| `apps/builder/src/resolvers/canonical/index.ts`                                      | reusable/ref/descendants/slot fill resolved tree 계약 fixture 보강                          |
| `apps/builder/src/preview/App.tsx`                                                   | Preview canonical render branch 가 resolved tree 를 source 로 삼도록 정리                   |
| `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`                      | rendererMap fallback 포함 모든 렌더 경로가 `ResolvedNode.children` 를 잃지 않게 정리        |

### 경계 규칙

- `packages/react-aria-starter/src/**`: 원본 snapshot. product behavior 직접 수정 금지.
- `packages/shared/src/components/**`: cutover 후 official runtime surface.
- `packages/shared/src/components/legacy/**`: compatibility fallback. active Builder authoring path 에서 직접 import 금지.
- `packages/specs/src/starter/**`: starter inventory 와 component manifest. Builder 가 직접 starter source 를 알지 않게 하는 registry boundary.

## 3. Component 분류 모델

`starterComponentManifest` entry 는 최소 아래 정보를 가진다.

```ts
export type StarterComponentSource =
  | "starter"
  | "composition-native"
  | "legacy-hidden";

export type StarterComponentSupportLevel =
  | "full"
  | "preview-only"
  | "skia-visual-only"
  | "hidden";

export type StarterComponentStructureKind =
  | "leaf"
  | "slots"
  | "collection"
  | "recursive-collection"
  | "table";

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

export interface StarterComponentManifestEntry {
  type: string;
  source: StarterComponentSource;
  family: StarterComponentFamily;
  cutover: StarterComponentCutoverState;
  starterImport?: string;
  sharedExport: string;
  spec: string;
  panel: {
    category: string;
    label: string;
    icon: string;
    placeable: boolean;
  };
  defaultProps: Record<string, unknown>;
  dynamicProps: string[];
  slots: string[];
  states: string[];
  structure: {
    kind: StarterComponentStructureKind;
    requiresSpecContract: boolean;
    notes?: string;
  };
  resource: {
    repeatedStructure: "direct-node" | "origin-template-ref-delta";
    materializationBoundary?: "canonical" | "resolved-projection";
    notes?: string;
  };
  support: {
    preview: StarterComponentSupportLevel;
    publish: StarterComponentSupportLevel;
    skia: StarterComponentSupportLevel;
  };
}
```

`family` 와 `cutover` 가 family-gated atomic cutover 의 SSOT 다. 한 family 의 모든 entry 는 `cutover` 를 `legacy → cutting-over → starter` 로 함께 거치며, 어떤 시점에도 같은 family 안에서 `legacy` 와 `starter` 가 혼재할 수 없다 (registration contract 불변식이 강제). `cutting-over` 는 해당 family 의 cutover 작업이 진행 중인 commit 범위 표시다.

분류 기준:

- `starter`: starter 에 원본이 있는 RAC 컴포넌트. 예: Button, TextField, Checkbox, Select, Dialog.
- `composition-native`: starter 에 없지만 composition authoring/runtime 에 필요한 컴포넌트. 예: Frame, Slot, reusable tooling.
- `legacy-hidden`: 기존 shared 구현이지만 새 official Panel 에 노출하지 않는 compatibility target.

Tree/Table 특수 규칙:

- Tree 는 `structure.kind: "recursive-collection"` 이다. Tree 자체는 재귀 구조이므로 충분히 Spec 으로 표현 가능하다. 다만 `items[]` 만으로 끝내지 않고 expansion state, recursive item identity, child traversal, drop indicator, row-level selection/focus state 를 Spec 이 표현해야 한다.
- Table 은 `structure.kind: "table"` 이다. columns/column groups/header/body/row/cell, sorting, selection, resizing, virtualized row layout, empty/loading state 를 Spec 이 표현해야 한다.
- Tree/Table 이 `support.preview: "full"` 또는 `support.skia: "full"` 을 주장하려면 전용 structure contract fixture 를 통과해야 한다.
- 기존 수동 Tree/Table 구현을 유지하는 것만으로 Tree·Table family cutover 완료로 보지 않는다. Tree/Table structure contract 가 실패하면 컴포넌트를 숨기는 것으로 완료 처리하지 않고 Tree·Table family cutover 자체를 보류한다.

Resource 특수 규칙:

- 반복 구조가 큰 컴포넌트(Tree, Table, TableView, virtualized collection)는 `resource.repeatedStructure: "origin-template-ref-delta"` 를 기본값으로 삼는다.
- canonical document 에 row/cell/tree node 를 전수 materialize 하지 않는다. canonical 저장 모델은 reusable origin/template, `type:"ref"` instance, slot fill, `descendants` delta 로 표현한다.
- 대량 materialized node 는 Preview/Skia/layout 을 위한 resolved projection/cache boundary 에서만 생성한다.
- `resource.materializationBoundary: "canonical"` 은 작은 정적 구조에만 허용하고, Tree/Table family 에서는 Gate 실패로 본다.

## 4. Phase 계획

cutover 는 전역 단일 스위치가 아니라 **family-gated atomic cutover** 다. Phase 0~5 는 family cutover 착수 전 1회 수행하는 **공통 기반 + infrastructure** 단계다 — manifest / Spec contract / Tree·Table structure contract / Preview resolved-tree resolver / shared official surface / Panel·Factory·Preview·Skia 의 manifest 소비 배선을 갖춘다. 이 단계의 "cutover"·"전환" 표현은 해당 경로를 manifest 기반으로 읽도록 배선하는 **infrastructure 변경**을 뜻하며, 특정 family 를 활성화하지 않는다. Phase 6 은 family 순서대로 manifest 의 `cutover` 필드를 flip 해 한 family 의 4경로를 동시에 활성화하는 **반복 단계**다.

### Phase 0 — Freeze + Baseline

목표: 새 cutover 준비 중 legacy active surface 가 더 늘지 않게 고정한다.

작업:

1. `packages/react-aria-starter/UPSTREAM.md` 정책을 기준으로 starter source 직접 수정 금지 확인.
2. `packages/react-aria-starter/**` 가 `codex:format` 대상에서 제외되는지 확인.
3. current registry baseline 수집:
   - `packages/react-aria-starter/src`
   - `packages/shared/src/components`
   - `packages/specs/src/components`
   - `apps/builder/src/builder/panels/components/ComponentList.tsx`
   - `apps/builder/src/builder/factories/ComponentFactory.ts`
   - `packages/shared/src/renderers/index.ts`
   - `apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`
4. `docs/reference/audits/2026-05-18-starter-spec-component-inventory.md` 작성.

검증:

```bash
pnpm run codex:guard
pnpm run codex:format
```

Gate:

- G0: 신규 active component registration 이 legacy/manual list 로 추가되지 않음.
- G1: inventory 가 starter/current shared/spec/panel/factory/renderer/skia registry 를 모두 포함.

### Phase 1 — Manifest + Spec Contract

목표: Component Panel 과 Factory 가 소비할 단일 manifest 를 만든다.

작업:

1. `packages/specs/src/starter/types.ts` 생성.
2. `packages/specs/src/starter/starterComponentManifest.ts` 생성.
3. `packages/specs/src/index.ts` 에 manifest export 추가.
4. `starterComponentManifest.test.ts` 작성:
   - `placeable === true` 인 entry 는 `spec` 존재.
   - `sharedExport` 존재.
   - `defaultProps` 가 object.
   - `support.preview !== "hidden"` 인 entry 는 preview support 명시.
   - `support.skia` 가 `"hidden"` 이면 Panel 노출 여부가 명시 사유를 가진다.
   - 모든 entry 가 `family` 와 `cutover` 를 가지며, 같은 `family` 의 entry 는 `cutover` 값이 동일하다.
   - `structure.kind === "recursive-collection"` 인 entry 는 recursive item identity + expansion state + selection state contract 를 선언한다.
   - `structure.kind === "table"` 인 entry 는 columns/header/body/row/cell + sorting/selection/resizing/virtualization support policy 를 선언한다.
   - `structure.kind === "recursive-collection"` 또는 `"table"` 인 entry 는 `resource.repeatedStructure === "origin-template-ref-delta"` 이고 `resource.materializationBoundary === "resolved-projection"` 이다.

검증:

```bash
pnpm -F @composition/specs test starterComponentManifest
pnpm -F @composition/specs build
```

Gate:

- G2: placeable entry 100% 가 Spec/default props/panel/support/family/cutover metadata 를 가진다.
- G2-T: Tree/Table full support 는 structure contract 없이는 금지. contract 미충족 시 Tree·Table family cutover 를 보류한다.
- G2-R: Tree/Table 반복 구조가 reusable origin/template + ref instance + slot + descendants delta 로 저장되고, canonical 전수 materialize 를 금지한다.

### Phase 1-T — Tree/Table Spec 표현력 Gate

목표: 구버전 Spec SSOT 가 구현하지 못한 Tree/Table 을 새 시스템의 proof gate 로 분리한다. 전제는 "불가능"이 아니라 "구버전 표현력 부족"이다. Tree 는 recursive collection contract 로, Table 은 table structure contract 로 구현한다.

작업:

1. `TreeSpec` 를 새 structure contract 기준으로 재평가한다.
   - recursive item identity
   - expansion state
   - selected/focused/drag/drop state
   - child traversal/indentation
   - TreeItem row visual model
2. `TableSpec` / `TableViewSpec` 를 새 structure contract 기준으로 재평가한다.
   - columns / column groups
   - header/body/row/cell
   - sorting
   - selection
   - resizing
   - virtualized row layout
   - loading/empty state
3. Preview fixture + Skia visual model fixture 를 먼저 작성한다.
4. fixture 가 실패하면 Tree/Table 을 숨기는 것으로 완료하지 않고 Tree·Table family cutover 를 보류한다.

검증:

```bash
pnpm -F @composition/specs test starterComponentManifest
pnpm -F @composition/builder test tagSpecMap
pnpm run codex:typecheck
```

Gate:

- G2-T-1: Tree full support 는 recursive collection fixture 없이 금지.
- G2-T-2: Table full support 는 table structure fixture 없이 금지.
- G2-T-3: Tree/Table fixture 실패 시 Tree·Table family cutover 보류.

### Phase 1-P — Preview Canonical Resolver/Renderer Gate

목표: 현재 Preview 에서 `reusable` origin, `type:"ref"` instance, `descendants`, `slot` fill 이 보이지 않는 문제를 cutover blocker 로 고정한다. resolver 가 tree 를 풀어내는 것만으로는 부족하며, Preview render consumer 가 resolved `node.children` 를 실제 렌더 source 로 소비해야 한다.

작업:

1. `resolveCanonicalDocument()` fixture 를 보강한다.
   - reusable origin root
   - `type:"ref"` instance
   - root `props` override
   - descendants mode A props patch
   - descendants mode B node replacement
   - descendants mode C children replacement
   - slot path children replacement
2. `CanonicalNodeRenderer` 가 rendererMap fallback 을 사용할 때도 resolved `node.children` 를 잃지 않도록 render context 를 분리한다.
3. Preview canonical branch 가 legacy `elements[]` length 또는 legacy parent lookup 에 기대어 ref/slot children 을 렌더링하지 않게 한다.
4. origin 은 명시적으로 canvas/page tree 에 놓인 경우만 보이고, instance 는 origin visual contract 를 resolve 해서 보인다. unintended duplicate 또는 invisible slot content 를 실패로 처리한다.

검증:

```bash
pnpm -F @composition/builder test canonicalPreviewRefSlot
pnpm -F @composition/builder test resolver
pnpm run codex:typecheck
```

Gate:

- G4-P-1: reusable origin + ref instance 가 Preview 에서 동시에 의도된 visibility 로 렌더된다.
- G4-P-2: root props override 와 descendants 3-mode override 가 Preview DOM 에 반영된다.
- G4-P-3: slot fill children replacement 가 Preview 에서 보인다.
- G4-P-4: rendererMap fallback 이 resolved children 을 legacy `elements[]` lookup 으로 잃어버리지 않는다.

### Phase 2 — Shared Official Surface 재구성

목표: `packages/shared/src/components` 를 새 official surface 로 재정의한다.

작업:

1. 기존 active 구현을 component family 별로 `packages/shared/src/components/legacy` 로 격리할 이동 계획 작성.
2. 새 official files 는 기존 public filename 을 유지한다. 예: `Button.tsx`, `TextField.tsx`, `Checkbox.tsx`.
3. starter source 를 직접 수정하지 않고 shared official component 가 starter component 를 import/adapt 한다.
4. composition-native component(Frame, Slot 등)는 `source: "composition-native"` 로 manifest 에 등록한다.
5. `packages/shared/src/components/index.ts` 는 새 official surface 만 export 한다.
6. `legacy/README.md` 에 import 허용 경계를 명시한다.

검증:

```bash
pnpm run codex:typecheck
```

Gate:

- G3: `packages/shared/src/components` barrel export 가 새 official surface 로 빌드된다.
- G6: active Builder/Preview/Publish path 에서 legacy import allowlist 외 직접 사용 0건.

### Phase 3 — Builder Panel + Factory manifest 배선

목표: Component Panel 과 element creation 이 manifest+Spec 을 source 로 소비하도록 **배선**한다. 이 단계는 infrastructure 변경이며, 어떤 family 가 새 경로로 활성화될지는 manifest 의 `cutover` 필드가 결정한다 (Phase 6).

작업:

1. `ComponentList.tsx` 의 hard-coded component catalog 를 manifest 기반으로 교체.
2. Panel category/label/icon/placeable 여부는 manifest 에서 읽는다.
3. `ComponentFactory.ts` 의 manual creator map 은 manifest + Spec defaults 를 우선 사용한다.
4. complex component 는 manifest 의 `slots`/`defaultProps`/`dynamicProps` 로 생성 규칙을 선언한다.
5. `useElementCreator.ts` 는 `getDefaultProps(type)` fallback 보다 manifest/Spec default 를 우선한다.
6. 기존 manual creator 가 필요한 component 는 `legacy-hidden` 또는 `composition-native` 사유를 manifest 에 기록한다.

검증:

```bash
pnpm -F @composition/builder test componentPanelManifest
pnpm -F @composition/builder test componentFactoryManifest
pnpm run codex:typecheck
```

Gate:

- G4: Component Panel / Factory / Inspector authoring path 가 manifest+Spec 를 source 로 사용 (family 마다 Phase 6 에서 검증).

### Phase 4 — Preview/Publish Runtime 배선

목표: Preview/Publish 가 새 shared component surface 와 Spec runtime registry 를 소비하도록 **배선**한다.

작업:

1. `packages/shared/src/renderers/index.ts` 의 `rendererMap` 을 fallback boundary 로 낮춘다.
2. 새 placeable component 는 Spec runtime path 가 우선한다.
3. legacy payload import/export compatibility 는 adapter boundary 로 격리한다.
4. Preview 가 legacy `elements[]` 길이만 보고 빈 화면을 판단하지 않는지 canonical document 기준으로 재확인한다.
5. Phase 1-P fixture 를 실제 Preview cutover path 에 연결한다.
   - `resolveCanonicalDocument()` 결과를 `ResolvedNode` tree 로 유지한다.
   - `CanonicalNodeRenderer` 는 rendererMap fallback 에 resolved-child-aware render context 를 전달한다.
   - `slot` fill 은 legacy layout slot replacement 와 canonical descendants children replacement 를 혼합하지 않고 canonical resolved tree 기준으로 렌더링한다.
   - `reusable` origin 은 authoring placement 여부와 page/layout visibility contract 에 따라 보이고, `type:"ref"` instance 는 origin visual 을 resolve 해서 보인다.

검증:

```bash
pnpm -F @composition/builder test canonicalPreviewRefSlot
pnpm run codex:typecheck
pnpm run codex:preflight
```

Gate:

- G5-preview: canonical fixture 가 Preview 에서 새 shared component 로 렌더된다 (family 마다 Phase 6 에서 검증).
- G4-P: reusable/ref/descendants/slot Preview fixture 가 invisible/duplicate node 없이 통과한다.
- G6: active runtime direct legacy import 0건.

### Phase 5 — CSS + Skia Parity 기반

목표: starter visual baseline 을 Spec D3 contract 로 흡수하고, generated CSS 와 Skia visual model 이 같은 fixture 를 통과하게 한다.

작업:

1. starter CSS 는 reference diff 로만 사용한다.
2. ComponentSpec 에 token/state/variant/slot/render shape 를 반영한다.
3. `CSSGenerator` snapshot 을 갱신한다.
4. Skia path 는 starter CSS 를 파싱하지 않고 Spec visual model 을 소비한다.
5. manual CSS 는 generator 가 표현하지 못하는 RAC structural CSS 에 한정한다.

검증:

```bash
pnpm -F @composition/specs build
pnpm -F @composition/specs test CSSGenerator
pnpm -F @composition/builder test tagSpecMap
pnpm run codex:typecheck
```

Gate:

- G5-skia: canonical fixture 가 generated CSS snapshot 과 Skia draw/visual model snapshot 을 동시에 통과 (family 마다 Phase 6 에서 검증).

### Phase 6 — Family-gated Atomic Cutover

목표: Phase 0~5 의 공통 기반·infrastructure 가 고정된 뒤, family 순서대로 각 family 의 4경로(Component Panel / Factory / Preview·Publish / Skia)를 atomic 하게 전환한다. 전역 단일 스위치가 아니라 family 단위 반복이다.

family 순서: primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native (§5 표 참조).

각 family 에 대해 §5 의 표준 cutover 체크리스트를 순서대로 수행한다. 핵심:

1. 해당 family 의 manifest entry `cutover` 를 `cutting-over` 로 표시.
2. 해당 family 구현을 `packages/shared/src/components/legacy/` 로 이동하고 새 official adapter 컴포넌트 작성.
3. 해당 family 의 4경로(Panel catalog / Factory creation / Preview·Publish runtime / Skia support)를 manifest 기반으로 활성화.
4. generated CSS 재생성 + registration contract + targeted fixture 통과 확인.
5. 통과 시 manifest entry `cutover` 를 `starter` 로 flip — 4경로 동시 발효.
6. 실패 시 그 family 만 `cutover: "legacy"` 유지 (fallback 또는 hidden), 다음 family 진행. 다른 family 는 막지 않는다.

전 family 가 `cutover: "starter"` 에 도달하면 legacy allowlist 고정 + cutover release note + README/ADR status 갱신.

검증 (family 마다):

```bash
pnpm run codex:guard
pnpm run codex:typecheck
pnpm run codex:preflight
```

Gate:

- G4 / G5 / G6: family 마다 반복 적용 — 한 family 의 Panel·Factory·Preview·Publish·Skia·legacy 격리를 동시에 검증.
- G7: 전 family 가 `cutover: "starter"` 에 도달 + 모든 family gate 통과. 실패 family 는 legacy fallback/hidden 유지, 해당 family commit revert (다른 family 영향 없음).

## 5. Family 실행 순서 + cutover 체크리스트

구현 준비는 family 단위로 병렬 진행할 수 있고, **active cutover 도 family 단위 atomic** 으로 수행한다 (Phase 6). 공통 기반·infrastructure(Phase 0~5)가 고정된 뒤 아래 순서대로 각 family 의 4경로를 동시에 전환하며, 한 family cutover 가 실패하면 그 family 만 legacy fallback/hidden 으로 두고 다음 family 를 진행한다.

| 순서 | Family             | 대표 컴포넌트                                                                                                      | 난이도   | 비고                                                                                                                                  |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | primitives/actions | Button, ToggleButton(Group), Link, Separator, Icon, Badge                                                          | LOW      | Panel/Factory/Preview/Skia golden path 파일럿. adapter 패턴 확립                                                                      |
| 2    | fields             | TextField, NumberField, SearchField, DateField, TimeField, ColorField, Form, Field, FileTrigger                    | LOW-MED  | D2 props/dynamic props 검증                                                                                                           |
| 3    | selection          | Checkbox(Group), Radio(Group), Switch, Slider                                                                      | MED      | state/data-attribute parity 검증                                                                                                      |
| 4    | collections        | ListBox, GridList, Menu, TagGroup, ComboBox, Select, Tabs                                                          | MED-HIGH | flat items/selection/section/virtual child 모델 검증                                                                                  |
| 5    | Tree·Table         | Tree, Table, TableView                                                                                             | HIGH     | 구버전 Spec SSOT 실패 영역. recursive/table structure contract(G2-T) + reusable origin/ref/slot/descendants delta resource(G2-R) 검증 |
| 6    | overlays           | Dialog, Modal, Popover, Tooltip, Toast, DropZone                                                                   | MED      | portal/overlay/manual structural CSS 경계 검증                                                                                        |
| 7    | date/color         | Calendar, RangeCalendar, DatePicker, DateRangePicker, ColorPicker, ColorArea, ColorWheel, ColorSlider, ColorSwatch | MED-HIGH | generated CSS 한계와 manual escape hatch 검증                                                                                         |
| 8    | composition-native | Frame, Slot, reusable tools                                                                                        | LOW-MED  | starter 미존재 — adapter 미적용, Spec/manifest 등록만 동일 요구                                                                       |

정확한 컴포넌트 → family 배정은 Phase 0 inventory(`2026-05-18-starter-spec-component-inventory.md`) 산출물이 SSOT 다.

### family 표준 cutover 체크리스트 (한 family 마다 반복)

| #   | 단계                                             | 파일                                                                  |
| --- | ------------------------------------------------ | --------------------------------------------------------------------- |
| 1   | manifest entry `cutover: "cutting-over"` 표시    | `packages/specs/src/starter/starterComponentManifest.ts`              |
| 2   | Spec 정합 (D2 props / D3 token·state·variant)    | `packages/specs/src/components/{Comp}.spec.ts`                        |
| 3   | 구현 → legacy 이동 (`git mv`)                    | `packages/shared/src/components/legacy/{Comp}.tsx`                    |
| 4   | 새 adapter 작성 (starter import + adapter 6항목) | `packages/shared/src/components/{Comp}.tsx`                           |
| 5   | barrel export 경로 교체                          | `packages/shared/src/components/index.ts`                             |
| 6   | generated CSS 재생성                             | `pnpm -F @composition/specs build` → `styles/generated/{Comp}.css`    |
| 7   | Panel catalog → manifest 소비                    | `apps/builder/src/builder/panels/components/ComponentList.tsx`        |
| 8   | Factory creator → manifest/Spec default          | `apps/builder/src/builder/factories/ComponentFactory.ts`              |
| 9   | rendererMap → fallback 격리                      | `packages/shared/src/renderers/index.ts`                              |
| 10  | Skia: Spec visual contract 소비 확인             | `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` |
| 11  | registration contract + targeted fixture 통과    | `pnpm test:registration-contract` + family fixture                    |
| 12  | 통과 시 manifest `cutover: "starter"` flip       | manifest — 4경로 동시 발효                                            |

- 3~5 사이 빌드 깨짐 구간은 family 의 (legacy 이동 + 새 파일 + barrel) 을 한 cohesive commit 으로 묶어 main 에 깨진 중간 상태가 들어가지 않게 한다.
- 11 미통과 시 12 미실행 — 해당 family `cutover: "legacy"` 유지, 다음 family 진행.
- adapter 6항목: composition props mapping / canonical payload normalization / Spec default·dynamic props 연결 / generated CSS class·data-attribute 연결 / event·action·data binding boundary / composition-native 확장 동작.

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

## 7. 완료 판정

ADR-142 를 Implemented 로 승격하려면 전 family 가 `cutover: "starter"` 에 도달하고 아래가 모두 참이어야 한다.

1. starter inventory + manifest 가 현재 official component set 을 설명한다.
2. Component Panel 이 manifest+Spec source 로만 구성된다.
3. Factory/default props 가 canonical props + Spec defaults 기준으로 생성된다.
4. Preview/Publish 는 새 shared official surface 를 우선 사용한다.
5. Preview 는 reusable origin, ref instance, descendants 3-mode override, slot fill 을 resolved canonical tree 기준으로 렌더한다.
6. Skia 는 Spec visual contract 로 동일 fixture 를 렌더한다.
7. Tree/Table 은 recursive/table structure contract 를 통과해 official full support 로 등록되어 있다.
8. Tree/Table 반복 구조는 reusable origin/template + ref instance + slot + descendants delta 로 저장되고, materialized projection 은 cache boundary 에 한정된다.
9. legacy import allowlist 외 active usage 가 0건이다.
10. `pnpm run codex:preflight` 가 통과한다.
11. ADR 본문과 README 상태가 Implemented 로 동기화된다.
