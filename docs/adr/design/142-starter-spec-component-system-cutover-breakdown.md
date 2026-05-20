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
- 단일 `packages/react-aria-starter/design.md` — Google DESIGN.md section set 을 차용한 starter token/패턴 중복 제거 reference (검증·확정)
- `PrimitiveBinding` 타입 + `componentCatalog` 타입
- generic 렌더러 (DOM backend + Skia backend) — resolved canonical tree + theme 소비
- Preview resolved-tree 단일 소비 (reusable/ref/descendants/slot 가 실제로 렌더)
- 조합 컴포넌트의 reusable 문서 저작 흐름 (Builder 안 저작 + reusable 승격)
- registration contract 확장 (catalog cross-check + family atomicity 불변식)
- 새 `packages/shared/src/components` primitive wrapper surface + `legacy` boundary
- family 단위 4경로 atomic cutover

## 2. 파일 경계

### 새로 만들 파일

| 파일                                                                           | 책임                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `docs/reference/audits/2026-05-19-canonical-component-inventory.md`            | starter 컴포넌트 primitive/composed 분류 + shared/Panel/Factory/rendererMap/124 ComponentSpec diff           |
| `packages/shared/src/catalog/types.ts`                                         | `PrimitiveBinding` + `ComponentCatalogEntry` + sub-type(`PropContract`/`PanelMeta` 등)                       |
| `packages/shared/src/catalog/primitives/{Primitive}.ts`                        | leaf RAC primitive 약 35개의 `PrimitiveBinding` — `react-aria-components` 기준 작성 (D3 시각은 starter 참조) |
| `packages/shared/src/catalog/outputs/toRacProps.ts`                            | canonical props → RAC component props 투영 (유일한 binding 변환기)                                           |
| `packages/shared/src/catalog/registry.ts`                                      | Phase 1a/1b primitive binding lookup surface                                                                 |
| `packages/shared/src/catalog/outputs/inspectorFields.ts`                       | `PropContract` 집합 + theme → Inspector 편집 필드 generic 생성 (컴포넌트당 `SpecField` 분기 대체)            |
| `packages/shared/src/catalog/componentCatalog.ts`                              | primitive + reusable entry 단일 registry + family/cutover/panel metadata                                     |
| `packages/shared/src/catalog/library/`                                         | 조합 컴포넌트의 seed reusable canonical 문서 (Phase 2 산출, Builder 저작분 export)                           |
| `packages/shared/src/catalog/__tests__/componentCatalog.test.ts`               | catalog entry 무결성 + family atomicity 검증                                                                 |
| `packages/shared/src/catalog/__tests__/inspectorFields.test.ts`                | `PropContract`→Inspector 필드 생성 / `section` 그룹핑 / `variant` 값 theme 조회 검증                         |
| `apps/builder/src/preview/__tests__/canonicalPreviewRefSlot.test.tsx`          | Preview 가 reusable/ref/descendants/slot resolved tree 를 실제 DOM 으로 렌더링하는지 검증 (F1~F4)            |
| `apps/builder/src/preview/components/CanonicalNodeRenderer.adr142.test.tsx`    | Phase 1a Button primitive + reusable ref DOM proof fixture                                                   |
| `apps/builder/src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts` | generic 렌더러 DOM↔Skia 시각 대칭 + worst-case 부하 Skia frame budget(G2c) fixture                           |
| `apps/builder/src/builder/panels/properties/generic/CatalogField.tsx`          | `InspectorFieldModel` 을 Builder property controls 로 렌더하는 Phase 1b bridge                               |
| `packages/shared/src/components/legacy/README.md`                              | legacy 구현의 compatibility boundary 규칙                                                                    |

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
- `packages/react-aria-starter/design.md`: starter/src 56 CSS 의 중복 제거 token/패턴 **단일** reference (Phase 0 검증·확정 산출물). Google DESIGN.md section set 을 차용하되 composition 확장(Motion / Mapping / Appendix)을 Components 뒤에 삽입하고 Do's and Don'ts 를 최종 guardrail 로 둔다. YAML hex-token front matter layer 는 채택하지 않는다. markdown — runtime import 대상 아님, theme/tokens 저작의 입력 가이드이며 런타임 계약 아님. `src/` 하위 컴포넌트별 design.md 생성 금지 (중복 SSOT 방지).
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
7. **단일 `packages/react-aria-starter/design.md` 검증·확정** — starter/src 56 CSS 의 token/패턴을 중복 제거해 정규화한 단일 reference 가 누락·stale 없이 완전한지 검증·보강한다. 구조는 Overview / Colors / Typography / Layout / Elevation & Depth / Shapes / Components / Motion / Mapping / Appendix / Do's and Don'ts 순서다. Google DESIGN.md section set 을 차용하되 composition 확장을 Components 뒤에 삽입하고, Do's and Don'ts 를 최종 guardrail 로 둔다. Google DESIGN.md 의 YAML hex-token front matter layer 는 채택하지 않고, starter 의 OKLCH relative-color 모델·light/dark adaptation·forced-colors 경계를 보존한다. 이 문서는 Phase 1~6 의 theme/tokens 저작·`PrimitiveBinding` 작성·reusable 문서 저작의 **필수 선행 입력**이며, runtime D3 SSOT(theme/tokens root collection)로 승격하지 않는다.

검증: `pnpm run codex:guard` / `pnpm run codex:format`
Gate: G0, G1

Status: Implemented — 2026-05-20. 산출물:
`docs/reference/audits/2026-05-19-canonical-component-inventory.md`.
검증: `pnpm run codex:guard`, `pnpm run codex:typecheck`,
`pnpm test:registration-contract`, `pnpm run codex:format`,
`pnpm run codex:preflight`.

### Phase 1 — PrimitiveBinding + generic 렌더러 + Preview resolved-tree (공통 기반 핵심)

Phase 1 은 공통 기반의 핵심이자 대안 E 의 kill-switch 단계다. **Phase 1a (proof slice)** 가 핵심 베팅(R1·R10)을 최소 수직 슬라이스로 falsify-가능하게 증명한 뒤에만 **Phase 1b (공통 기반 완성)** 로 진입한다. Phase 1a 가 실패하면 family cutover 가 아니라 ADR-142 대안 E 자체를 재검토한다.

#### Phase 1a — Proof slice (kill-switch)

목표: 'resolved canonical tree → generic 렌더러(DOM+Skia) → theme' 경로가 (1) primitive 노드와 ref 노드 양쪽에서 연결되는지 (2) worst-case 부하에서 60fps 인지를 최소 코드로 증명한다. 1a 는 spike — proof 통과 시 1b 가 확장하는 실제 기반이 되고, kill-switch 발동 시 폐기 대상이다.

작업:

1. `packages/shared/src/catalog/types.ts` — proof 에 필요한 최소 `PrimitiveBinding` 타입 (Button 1개분).
2. `outputs/toRacProps.ts` — Button 투영분.
3. **generic 렌더러 DOM backend**: `CanonicalNodeRenderer` 를 resolved canonical tree 의 단일 렌더 진입점으로 승격.
4. **generic 렌더러 Skia backend**: `buildSpecNodeData.ts` Skia 경로의 generic traversal core 를 resolved tree + theme 소비로 작성. `render.shapes()`/`specShapesToSkia` 미사용 경로.
5. **Preview resolved-tree 소비**: `App.tsx` 가 `resolveCanonicalDocument()` 결과를 단일 source 로 삼게 한다.
6. **Button 수직 슬라이스 (primitive 노드)**: 첫 `PrimitiveBinding` 작성(검증·확정한 `design.md` Components / Utilities 공통 유틸 패턴 참조) + resolved tree → DOM/Skia/theme 렌더. Inspector 편집 proof 는 1b/G2d.
7. **최소 composed 수직 슬라이스 (ref 노드)**: reusable-origin + `type:"ref"` instance 1쌍을 generic 렌더러로 렌더. 조합 컴포넌트 = reusable 문서가 ADR-142 의 핵심 thesis 이므로, 렌더러가 primitive 노드뿐 아니라 ref 노드를 처리함을 proof 에 포함한다.
8. **worst-case 부하 측정 (R1·R10)**: 200+ 노드(ref 노드 포함) collection canonical 문서를 generic 렌더러 Skia backend 로 인터랙션 re-render. (a) 절대 60fps + (b) 현 `render.shapes()` 경로 대비 frame 비용 회귀 한계 이내 — 양쪽 측정. 측정 환경은 대표 device profile 로 명시. Button 은 최저부하라 R10 의 비용 축(generic traversal × 노드 수)을 증명하지 못한다.
9. fixture: `canonicalSkiaSymmetry.test.ts`(Button + ref proof set 의 DOM↔Skia 시각 대칭 + worst-case 부하 frame budget).

검증: `pnpm -F @composition/builder test canonicalSkiaSymmetry` / `pnpm run codex:typecheck`
Gate: **G2a / G2b / G2c (proof gate — kill-switch)**

Status: Implemented — 2026-05-20. 산출물:
`packages/shared/src/catalog/types.ts`,
`packages/shared/src/catalog/outputs/toRacProps.ts`,
`packages/shared/src/catalog/primitives/button.ts`,
`packages/shared/src/catalog/registry.ts`,
`apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`,
`apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`.
Fixture:
`apps/builder/src/preview/components/CanonicalNodeRenderer.adr142.test.tsx`,
`apps/builder/src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts`.
검증: `pnpm -F @composition/builder exec vitest run
src/preview/components/CanonicalNodeRenderer.adr142.test.tsx`,
`pnpm -F @composition/builder exec vitest run
src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts`,
`pnpm -F @composition/builder exec vitest run
src/preview/components/CanonicalNodeRenderer.adr142.test.tsx
src/builder/workspace/canvas/skia/canonicalSkiaSymmetry.test.ts`,
`pnpm run codex:typecheck`. G2c 는 205개 Button ref canonical 문서 fixture 에서
`durationMs <= 16.67` / `estimatedFps >= 60` 으로 고정했다. Phase 1a 는
family cutover, generic Inspector, `componentCatalog` 완성을 포함하지 않는다.

#### Phase 1b — 공통 기반 완성

목표: Phase 1a proof gate 통과 후 나머지 공통 기반을 완성한다.

작업:

1. `PrimitiveBinding` + `ComponentCatalogEntry` + sub-type 타입 전체 확정.
2. resolver 버그 수정: nested ref `_resolvedFrom` 미주입, descendants mode C `validateSlotContract` 누락.
3. Preview fallback 경로가 `ResolvedNode.children` 를 잃지 않게 정리. legacy `elements[]` 경로 격리.
4. **generic Inspector field renderer**: `outputs/inspectorFields.ts` 가 `PropContract` 집합 + theme 로 Inspector 편집 필드를 generic 생성. `GenericPropertyEditor` 가 컴포넌트당 `spec.properties.sections` 대신 이를 소비. `section` 태그 그룹핑 + `variant`/`size` 값 theme 조회 포함. Button `accepts` 로 검증.
5. fixture: `canonicalPreviewRefSlot.test.tsx`(F1 reusable origin / F2 ref instance + descendants A·B·C / F3 slot fill / F4 fallback 경로 resolved children 보존), `inspectorFields.test.ts`(`PropContract`→필드 생성 / `section` 그룹핑 / `variant` 값 theme 조회).

검증: `pnpm -F @composition/builder test canonicalPreviewRefSlot` / `pnpm -F @composition/builder test resolver` / `pnpm -F @composition/shared test inspectorFields` / `pnpm run codex:typecheck`
Gate: **G2d (공통 기반 완성)**

Status: Implemented — 2026-05-20. 산출물:
`packages/shared/src/catalog/types.ts`,
`packages/shared/src/catalog/outputs/inspectorFields.ts`,
`packages/shared/src/catalog/primitives/button.ts`,
`apps/builder/src/builder/panels/properties/generic/CatalogField.tsx`,
`apps/builder/src/builder/panels/properties/generic/GenericPropertyEditor.tsx`.
Fixture:
`packages/shared/src/catalog/__tests__/inspectorFields.test.ts`,
`apps/builder/src/preview/__tests__/canonicalPreviewRefSlot.test.tsx`,
`apps/builder/src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts`.
검증: `pnpm -F @composition/shared exec vitest run
src/catalog/__tests__/inspectorFields.test.ts`,
`pnpm -F @composition/builder exec vitest run
src/builder/panels/properties/generic/genericEditorCanonical.static.test.ts
src/preview/__tests__/canonicalPreviewRefSlot.test.tsx`,
`pnpm run codex:typecheck`. G2d 는 Button `accepts` 기준 generic Inspector
field 생성, theme lookup 기반 `variant`/`size` option 생성, reusable
origin/ref/descendants 3-mode/slot fill/fallback children Preview fixture 를
고정한다. Phase 1b 는 `componentCatalog` 완성 또는 family cutover 를 포함하지
않는다.

### Phase 2 — Reusable 컴포넌트 저작 + componentCatalog

목표: 조합 컴포넌트를 reusable canonical 문서로 저작하고, 단일 `componentCatalog` 를 구성한다.

작업:

1. 조합 컴포넌트를 Builder 안에서 만들고 reusable 로 승격하는 흐름 정비 (reusable 승격 tooling). 이 tooling 은 reusable 이 노출하는 편집 prop 의 `propsSchema`(`Record<string, PropContract>`) 저작을 포함한다 — canonical core schema 를 건드리지 않고 `x-composition` extension 메타로 기록(HC#4).
2. family 별 조합 컴포넌트의 seed reusable 문서를 `packages/shared/src/catalog/library/` 로 export.
3. `componentCatalog.ts` — primitive entry(binding) + reusable entry(reusableId) + family/cutover/panel.
4. `componentCatalog.test.ts` — entry 무결성, 같은 family 의 `cutover` 동일성, primitive entry 의 `binding` 존재, reusable entry 의 `reusableId` 가 library 문서에 resolve.

검증: `pnpm -F @composition/shared test componentCatalog` / `pnpm -F @composition/shared type-check`
Gate: G3

Status: Implemented — 2026-05-20 (catalog/library slice). 산출물:
`packages/shared/src/catalog/componentCatalog.ts`,
`packages/shared/src/catalog/library/card.ts`,
`packages/shared/src/catalog/library/section.ts`,
`packages/shared/src/catalog/__tests__/componentCatalog.test.ts`.
Button primitive entry 는 `cutover:"catalog"` 로 active 등록하고, Card/Section 은
reusable canonical document seed 로 등록하되 `cutover:"legacy"` 로 유지한다.
reusable exposed props 는 canonical core schema 를 바꾸지 않고
`x-composition.catalog.propsSchema` extension meta 에 둔다. registration contract
불변식 C/D/E 를 추가해 active catalog coverage, family atomicity, legacy active
노출 차단을 검증한다. G3 의 Panel/Factory catalog-only 배선은 Phase 4 잔여다.
검증: `pnpm -F @composition/shared exec vitest run
src/catalog/__tests__/componentCatalog.test.ts
src/catalog/__tests__/inspectorFields.test.ts`,
`pnpm -F @composition/builder exec vitest run
src/builder/factories/__tests__/componentRegistrationContract.test.ts`,
`pnpm -F @composition/shared type-check`,
`pnpm run codex:typecheck`.

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

Status: In Progress — 2026-05-20 (Button / Separator / Link / Breadcrumbs /
Breadcrumb subpart / ToggleButton / ToggleButtonGroup / Toolbar / TextField /
NumberField / SearchField / DateField / TimeField / ColorField / Form /
FileTrigger / DropZone / Tooltip / Dialog / Checkbox / CheckboxGroup / Radio / RadioGroup / Slider /
ListBox / GridList / TagGroup / Menu / ComboBox / Select / Tabs /
Tree / Table / TableView primitive wrapper boundary slices; Button Icon
PropContract parity). `packages/shared/src/components/Button.tsx` 는
`toButtonRacProps()` 를,
`packages/shared/src/components/Separator.tsx` 는 `toSeparatorRacProps()` 를,
`packages/shared/src/components/Link.tsx` 는 `toLinkRacProps()` 를,
`packages/shared/src/components/Breadcrumbs.tsx` 는 `toBreadcrumbsRacProps()` 를,
`packages/shared/src/components/Breadcrumb.tsx` 는 `toBreadcrumbRacProps()` 를,
`packages/shared/src/components/ToggleButton.tsx` 는 `toToggleButtonRacProps()` 를,
`packages/shared/src/components/ToggleButtonGroup.tsx` 는
`toToggleButtonGroupRacProps()` 를, `packages/shared/src/components/Toolbar.tsx` 는
`toToolbarRacProps()` 를, `packages/shared/src/components/TextField.tsx` 는
`toTextFieldRacProps()` 를, `packages/shared/src/components/NumberField.tsx` 는
`toNumberFieldRacProps()` 를, `packages/shared/src/components/SearchField.tsx` 는
`toSearchFieldRacProps()` 를, `packages/shared/src/components/DateField.tsx` 는
`toDateFieldRacProps()` 를, `packages/shared/src/components/TimeField.tsx` 는
`toTimeFieldRacProps()` 를, `packages/shared/src/components/ColorField.tsx` 는
`toColorFieldRacProps()` 를, `packages/shared/src/components/Form.tsx` 는
`toFormRacProps()` 를, `packages/shared/src/components/FileTrigger.tsx` 는
`toFileTriggerRacProps()` 를, `packages/shared/src/components/DropZone.tsx` 는
`toDropZoneRacProps()` 를, `packages/shared/src/components/Tooltip.tsx` 는
`toTooltipRacProps()` 를, `packages/shared/src/components/Dialog.tsx` 는
`toDialogRacProps()` 를, `packages/shared/src/components/Checkbox.tsx` 는
`toCheckboxRacProps()` 를, `packages/shared/src/components/CheckboxGroup.tsx` 는
`toCheckboxGroupRacProps()` 를, `packages/shared/src/components/Radio.tsx` 는
`toRadioRacProps()` 를, `packages/shared/src/components/RadioGroup.tsx` 는
`toRadioGroupRacProps()` 를, `packages/shared/src/components/Slider.tsx` 는
`toSliderRacProps()` 를, `packages/shared/src/components/Tabs.tsx` 는
`toTabsRacProps()` 를, `packages/shared/src/components/Tree.tsx` 는
`toTreeRacProps()` 를, `packages/shared/src/components/Table.tsx` 는
`toTableRacProps()` 를 사용해 catalog binding projection 을 shared wrapper 의
props source 로 소비한다. TableView 는 별도 RAC primitive 가 아니라 `Table`
runtime exportName 을 쓰는 catalog entry 로 유지한다.
Breadcrumbs/ToggleButtonGroup/Toolbar/Form/FileTrigger 은
`PrimitiveBinding.placement` child template 으로 기본 자식 생성을 catalog payload 에
포함한다. Button 은 `buttonPrimitiveBinding.props.accepts` 의 `Icon` section 으로
`iconName` / `iconPosition` / `iconStrokeWidth` 를 노출하고 shared Button wrapper 가
이를 Icon child 로 렌더한다. `packages/shared/src/components/legacy/README.md` 는
compatibility fallback 허용 범위와 active Builder authoring import 금지 경계를
문서화했다. 이 slice 는 active primitive wrapper slices plus Breadcrumb subpart 의
G6 boundary 를 고정하지만, 전체 primitive wrapper family 이동과 `index.ts` barrel
정리는 아직 남아 있다.

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

Status: Implemented — 2026-05-20. Active catalog entry bridge 완료:
`apps/builder/src/builder/panels/components/componentPanelCatalog.ts` 가
`cutover:"catalog"` entry 를 panel item 으로 매핑하고 같은 type 의 legacy panel
definition 을 제자리 replacement 한다. `useElementCreator` 의
`resolveDefaultPropsForCreation()` 은 active primitive catalog entry 의
`binding.defaultProps` 를 legacy `getDefaultProps` 보다 먼저 사용한다.
`packages/shared/src/catalog/panelInventory.ts` 가 기존 Component Panel 7개 카테고리
inventory 를 보유하고, `ComponentList` 는 이 shared catalog inventory 를 소비한다.
`resolveCatalogElementCreation()` 은 reusable catalog entry 가 `cutover:"catalog"` 로
전환될 때 `type:"ref"` + `ref/masterId/componentRole:"instance"` payload 를 만든다.
Fixture: `componentPanelCatalog.test.ts`, `useElementCreator.catalog.test.ts`.
실제 reusable active flip 은 family cutover gate 에서 수행한다.

### Phase 5 — CSS / Skia generic 생성 정합

목표: 시각 산출을 generic 렌더러로 일원화한다.

작업:

1. CSS 는 generic 렌더러가 theme/tokens root collection + 노드 style/`data-*` 에서 생성. 컴포넌트당 CSS 정의 없음.
2. Skia backend 는 resolved tree + theme 를 그린다. 비-DOM-trivial primitive 는 `skiaPrimitive` draw module.
3. theme/tokens 저작 및 generic CSS 생성은 raw starter CSS 가 아니라 Phase 0 에서 검증·확정한 단일 `design.md`(token/패턴 정규화)를 입력으로 한다. starter CSS 자체는 D3 시각 참조 diff 로만 사용 (runtime 미포함).
4. generic 생성으로 표현 못 하는 RAC structural CSS 만 좁은 manual escape hatch.

검증: `pnpm -F @composition/specs build` / `pnpm run codex:typecheck`
Gate: G5 (family 마다 Phase 6 에서 `/cross-check`)

Status: In Progress — 2026-05-20 (Separator line + Link/Breadcrumb/TextField/NumberField/SearchField/DateField/TimeField/ColorField text +
ToggleButton button-like + Switch track/thumb/label + Checkbox box/indicator/label + CheckboxGroup label/children + Slider label/output/track/fill/thumb + DropZone dashed container + Tooltip bubble/text/arrow + Dialog panel/text + ToggleButtonGroup/Toolbar/Form/FileTrigger child-recursive generic
Skia slices + Tabs tab-list/panel + Tree row/disclosure + Table/TableView
header/row/cell generic Skia slices; Button icon_path parity).
`PrimitiveSkiaDescriptor.kind` 에 `separator` / `link` /
`breadcrumb` / `text-field` / `number-field` / `search-field` / `date-field` / `time-field` / `color-field` / `drop-zone` / `tooltip` / `dialog` / `toggle-button` / `switch` / `checkbox` / `checkbox-group` / `slider` / `list-box` / `grid-list` / `tag-group` / `menu` / `combo-box` / `select` / `tabs` / `tree` / `table` 를 추가하고, generic Skia path 가
Separator resolved node 를 `line` node 로, Link resolved node 를 underline text node
로, Breadcrumb subpart 를 text node 로, TextField/NumberField/SearchField/DateField/TimeField/ColorField resolved node 를
label/input/value container/text node 로, ColorField swatch 를 box node 로, ToggleButton resolved node 를 selected/emphasized 상태의
button-like container/text node 로, Switch resolved node 를 track/thumb/label container+box/text node 로,
Checkbox resolved node 를 box/indicator/label container+box/text node 로,
CheckboxGroup resolved node 를 label text node + resolved Checkbox children 으로,
Slider resolved node 를 label/output/track/fill/thumb container+text/box node 로,
DropZone resolved node 를 dashed container + upload icon + label/description node 로,
Tooltip resolved node 를 bubble + text + optional arrow node 로,
Dialog resolved node 를 panel + text node 로,
Tree resolved node 를 hierarchical row/disclosure/text node 로,
Table/TableView resolved node 를 header/row/cell container+text node 로 렌더한다.
ToggleButtonGroup/Toolbar/Form/FileTrigger 은 dedicated `skiaPrimitive` 없이 generic container +
resolved children 재귀 렌더 경로로 커버한다. Button `iconName` 은 generic Skia
Button node 의 `icon_path` child 로 렌더된다. `canonicalSkiaSymmetry.test.ts` 는
`ButtonSpec.render.shapes()`,
`SeparatorSpec.render.shapes()`, `LinkSpec.render.shapes()`,
`BreadcrumbsSpec.render.shapes()`, `BreadcrumbSpec.render.shapes()`,
`TextFieldSpec.render.shapes()`, `NumberFieldSpec.render.shapes()`,
`SearchFieldSpec.render.shapes()`, `DateFieldSpec.render.shapes()`,
`TimeFieldSpec.render.shapes()`, `ColorFieldSpec.render.shapes()`,
`FormSpec.render.shapes()`, `FileTriggerSpec.render.shapes()`,
`DropZoneSpec.render.shapes()`,
`TooltipSpec.render.shapes()`,
`DialogSpec.render.shapes()`,
`ToggleButtonSpec.render.shapes()`,
`SwitchSpec.render.shapes()`,
`CheckboxSpec.render.shapes()`,
`CheckboxGroupSpec.render.shapes()`,
`SliderSpec.render.shapes()`,
`ToggleButtonGroupSpec.render.shapes()`,
`ToolbarSpec.render.shapes()`, `TabsSpec.render.shapes()`,
`TreeSpec.render.shapes()`, `TableSpec.render.shapes()`,
`TableViewSpec.render.shapes()` 미호출을 검증한다.
Button/Separator/Link/Breadcrumbs/TextField/NumberField/SearchField/DateField/TimeField/ColorField/Form/FileTrigger/DropZone/Tooltip/Dialog/ToggleButton/Switch/Checkbox/CheckboxGroup/Radio/RadioGroup/Slider/ToggleButtonGroup/Toolbar/ListBox/GridList/TagGroup/Menu/ComboBox/Select/Tabs/Tree/Table/TableView 외
primitive 의 CSS/Skia generic 정합은 아직 남아 있다.

2026-05-20 추가 slice: active primitive Inspector source 를 legacy specRegistry 에서
분리했다. `apps/builder/src/builder/inspector/editors/registry.ts` 는 catalog
primitive 를 만나면 `getPropertyEditorSpec(type)` 호출 전 `getPrimitiveBinding(type)`
결과로 `GenericPropertyEditor({ componentType })` 를 만든다.
`GenericPropertyEditor.tsx` 는 `spec?: ComponentSpec` 로 legacy fallback 을 좁히고,
catalog path 는 `componentType` → `PrimitiveBinding.props.accepts` →
`buildInspectorFieldSections()` 만 소비한다. 따라서 현재 `cutover:"catalog"` 인
actions/fields/selection/collections/Tree·Table primitive 의 Inspector active path 는 `properties.sections` /
`SpecField` 를 통하지 않는다.

2026-05-20 추가 slice: Switch selection primitive 를 `cutover:"catalog"` 로 등록했다.
`switchPrimitiveBinding` / `toSwitchRacProps()` / shared `Switch.tsx` projection /
Preview primitive branch / generic Skia track-thumb-label fixture 를 추가했고,
`SwitchSpec.render.shapes()` 미호출을 검증한다. 이는 selection family 의 첫 slice 이며
이후 Checkbox slice 로 확장했다.

2026-05-20 추가 slice: Checkbox selection primitive 를 `cutover:"catalog"` 로 등록했다.
`checkboxPrimitiveBinding` / `toCheckboxRacProps()` / shared `Checkbox.tsx` projection /
Preview primitive branch / generic Skia box-indicator-label fixture 를 추가했고,
`CheckboxSpec.render.shapes()` 미호출을 검증한다. Checkbox 는 TreeItem 내부 slot 예외를
wrapper 에 유지한다. 이후 Slider slice 로 확장했다.

2026-05-20 추가 slice: Slider selection primitive 를 `cutover:"catalog"` 로 등록했다.
`sliderPrimitiveBinding` / `toSliderRacProps()` / shared `Slider.tsx` projection /
Preview primitive branch / generic Skia label-output-track-fill-thumb fixture 를 추가했고,
`SliderSpec.render.shapes()` 미호출을 검증한다. 이후 CheckboxGroup slice 로 확장했다.

2026-05-20 추가 slice: CheckboxGroup selection primitive 를 `cutover:"catalog"` 로 등록했다.
`checkboxGroupPrimitiveBinding` / `toCheckboxGroupRacProps()` / shared
`CheckboxGroup.tsx` projection / Preview primitive branch / generic Skia
label+children fixture 를 추가했고, `CheckboxGroupSpec.render.shapes()` 와 child
`CheckboxSpec.render.shapes()` 미호출을 검증한다. 이후 Radio/RadioGroup slice 로
확장했다.

2026-05-20 추가 slice: Radio/RadioGroup selection primitive 를 `cutover:"catalog"` 로
등록했다. `radioPrimitiveBinding` / `radioGroupPrimitiveBinding` /
`toRadioRacProps()` / `toRadioGroupRacProps()` / shared `Radio.tsx` 와
`RadioGroup.tsx` projection / Preview RadioGroup primitive branch / generic Skia
ring-dot-label 및 group label+children fixture 를 추가했고,
`RadioSpec.render.shapes()` / `RadioGroupSpec.render.shapes()` 미호출을 검증한다.
Radio 는 React Aria `RadioGroup` context 가 필요한 subpart 이므로 catalog 에서는
non-placeable active primitive 로 두고, standalone Preview 는 legacy fallback 을 유지한다.
selection family pilot 은 이 slice 로 완료됐고 다음 entrypoint 는 collections family 다.

2026-05-20 추가 slice: ListBox collections primitive 를 `cutover:"catalog"` 로
등록했다. `listBoxPrimitiveBinding` / `toListBoxRacProps()` / shared `ListBox.tsx`
projection / Preview ListBox primitive branch / generic Skia container+item row fixture 를
추가했고, `ListBoxSpec.render.shapes()` 미호출을 검증한다. 이는 collections family 의
첫 pilot 이며, ADR-132 collection 데이터 binding 전체 전환과 GridList/Menu/TagGroup/
ComboBox/Select/Tabs 는 잔여다.

2026-05-20 추가 slice: GridList collections primitive 를 `cutover:"catalog"` 로
등록했다. `gridListPrimitiveBinding` / `toGridListRacProps()` / shared `GridList.tsx`
projection / Preview GridList primitive branch / generic Skia card label+description fixture 를
추가했고, `GridListSpec.render.shapes()` 미호출을 검증한다. 이는 ListBox 에 이은
collections family 두 번째 pilot 이며, ADR-132 collection 데이터 binding 전체 전환과
Menu/TagGroup/ComboBox/Select/Tabs 는 잔여다.

2026-05-20 추가 slice: TagGroup collections primitive 를 `cutover:"catalog"` 로
등록했다. `tagGroupPrimitiveBinding` / `toTagGroupRacProps()` / shared `TagGroup.tsx`
projection / Preview TagGroup primitive branch / generic Skia label+chip fixture 를
추가했고, `TagGroupSpec.render.shapes()` 미호출을 검증한다. 이는 ListBox/GridList 에
이은 collections family 세 번째 pilot 이며, ADR-132 collection 데이터 binding 전체
전환과 Menu/ComboBox/Select/Tabs 는 잔여다.

2026-05-20 추가 slice: Menu collections primitive 를 `cutover:"catalog"` 로 등록했다.
`menuPrimitiveBinding` / `toMenuRacProps()` / shared `Menu.tsx` projection / Preview
Menu primitive branch / generic Skia trigger+item row fixture 를 추가했고,
`MenuSpec.render.shapes()` 미호출을 검증한다. Menu 는 collections family 소속이지만
기존 Component Panel 위치는 `buttons` category 로 보존한다. ADR-132 collection 데이터
binding 전체 전환과 ComboBox/Select/Tabs 는 잔여다.

2026-05-20 추가 slice: ComboBox collections primitive 를 `cutover:"catalog"` 로
등록했다. `comboBoxPrimitiveBinding` / `toComboBoxRacProps()` / shared
`ComboBox.tsx` projection / Preview ComboBox primitive branch / generic Skia
label+input+item row fixture 를 추가했고, `ComboBoxSpec.render.shapes()` 미호출을
검증한다. ComboBox 는 collections family 소속이지만 기존 Component Panel 위치는
`forms` category 로 보존한다. ADR-132 collection 데이터 binding 전체 전환과
Select/Tabs 는 잔여다.

2026-05-20 추가 slice: Select collections primitive 를 `cutover:"catalog"` 로
등록했다. `selectPrimitiveBinding` / `toSelectRacProps()` / shared `Select.tsx`
projection / Preview Select primitive branch / generic Skia label+trigger+item row
fixture 를 추가했고, `SelectSpec.render.shapes()` 미호출을 검증한다. Select 는
collections family 소속이지만 기존 Component Panel 위치는 `forms` category 로
보존한다. 이후 Tabs slice 로 확장했다.

2026-05-20 추가 slice: Tabs collections primitive 를 `cutover:"catalog"` 로 등록했다.
`tabsPrimitiveBinding` / `toTabsRacProps()` / shared `Tabs.tsx` projection / Preview
Tabs primitive branch / generic Skia tab-list+panel fixture 를 추가했고,
`TabsSpec.render.shapes()` 미호출을 검증한다. Tabs 는 기존 Component Panel 위치를
`collections` category 로 유지한다. ListBox/GridList/TagGroup/Menu/ComboBox/Select/Tabs
pilot 으로 §5 collections row 의 primitive pilot 은 완료됐으며, ADR-132 collection
데이터 binding 전체 전환은 잔여다.

2026-05-20 추가 slice: Tree·Table HIGH family 를 `cutover:"catalog"` 로 등록했다.
`treePrimitiveBinding` / `tablePrimitiveBinding` / `tableViewPrimitiveBinding` /
`toTreeRacProps()` / `toTableRacProps()` / shared `Tree.tsx` 와 `Table.tsx`
projection / Preview Tree·Table primitive branch / generic Skia row-disclosure 및
header-row-cell fixture 를 추가했고, `TreeSpec.render.shapes()` /
`TableSpec.render.shapes()` / `TableViewSpec.render.shapes()` 미호출을 검증한다.
TableView 는 별도 RAC primitive 가 없으므로 canonical tag 는 `TableView` 로 유지하되
runtime exportName 은 `Table` binding 을 사용한다. 이 slice 는 Tree·Table row 의
primitive pilot 완료이며, ADR-132 collection 데이터 binding 전체 전환은 잔여다.

2026-05-20 추가 slice: DropZone overlays primitive 를 `cutover:"catalog"` 로 등록했다.
`dropZonePrimitiveBinding` / `toDropZoneRacProps()` / shared `DropZone.tsx`
projection / Preview DropZone primitive branch / generic Skia dashed container +
upload icon + label/description fixture 를 추가했고, `DropZoneSpec.render.shapes()`
미호출을 검증한다. DropZone 은 overlays family 소속이지만 기존 Component Panel 위치는
`forms` category 로 보존한다.

2026-05-20 추가 slice: Tooltip overlays primitive 를 `cutover:"catalog"` 로 등록했다.
`tooltipPrimitiveBinding` / `toTooltipRacProps()` / shared `Tooltip.tsx` projection /
Preview Tooltip primitive branch / generic Skia bubble+text+arrow fixture 를 추가했고,
`TooltipSpec.render.shapes()` 미호출을 검증한다. shared Tooltip wrapper 는 기존
TooltipTrigger context 안에서는 RAC Tooltip 을 그대로 쓰고, catalog/Preview 단독
surface 에서는 controlled TooltipTrigger anchor 로 실제 tooltip DOM 을 생성한다.
2026-05-20 추가 slice: Dialog overlays primitive 를 `cutover:"catalog"` 로 등록했다.
`dialogPrimitiveBinding` / `toDialogRacProps()` / shared `Dialog.tsx` projection /
Preview Dialog primitive branch / generic Skia panel+text fixture 를 추가했고,
`DialogSpec.render.shapes()` 미호출을 검증한다. Modal/Popover/Toast overlays slice 는
잔여다.

### Phase 6 — Family-gated atomic cutover

목표: Phase 0~5 공통 기반 위에서 family 순서대로 4경로를 atomic 하게 전환한다.

family 순서: primitives·actions → fields → selection → collections → Tree·Table → overlays → date·color → composition-native (§5 표 참조).

각 family 마다 §5 표준 체크리스트 수행. 통과 시 `cutover:"catalog"` flip — 4경로 동시 발효. 실패 시 그 family 만 `cutover:"legacy"` 유지, 다음 family 진행.

전 family 가 `cutover:"catalog"` 도달 시 legacy allowlist 고정 + release note + README/ADR status 갱신 + ADR-036/907/908/140/141 status 재평가.

검증 (family 마다): `pnpm run codex:guard` / `pnpm run codex:typecheck` / `pnpm run codex:preflight`
Gate: G4 / G5 / G6 (family 반복), G7 (최종)

## 5. Family 실행 순서 + cutover 체크리스트

| 순서 | Family             | 대표 컴포넌트                                                                                                                               | 난이도   | 비고                                                        |
| ---- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| 1    | primitives/actions | Button, ToggleButton(Group), Link, Separator, Icon, Badge                                                                                   | LOW      | golden path 파일럿. binding + generic 렌더러 패턴 확립      |
| 2    | fields             | TextField, NumberField, SearchField, DateField, TimeField, ColorField, Form, FileTrigger (`Field` 는 helper/DataField surface 로 별도 분류) | LOW-MED  | canonical props 검증                                        |
| 3    | selection          | Checkbox(Group), Radio(Group), Switch, Slider                                                                                               | MED      | state/data-attribute parity. Slider track = `skiaPrimitive` |
| 4    | collections        | ListBox, GridList, Menu, TagGroup, ComboBox, Select, Tabs                                                                                   | MED-HIGH | collections 데이터 binding(ADR-132)                         |
| 5    | Tree·Table         | Tree, Table, TableView                                                                                                                      | HIGH     | RAC primitive binding + collections 데이터. 수동 우회 금지  |
| 6    | overlays           | Dialog, Modal, Popover, Tooltip, Toast, DropZone                                                                                            | MED      | portal/overlay structural CSS escape hatch 검증             |
| 7    | date/color         | Calendar, RangeCalendar, DatePicker, DateRangePicker, ColorPicker, ColorArea, ColorWheel, ColorSlider, ColorSwatch                          | MED-HIGH | arc/wheel = `skiaPrimitive`                                 |
| 8    | composition-native | Frame, Slot, reusable tools                                                                                                                 | LOW-MED  | RAC primitive 미존재 — catalog 등록만, binding 없음         |

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

- 2~3(`PrimitiveBinding` 작성 / reusable 문서 저작)·8(generic 렌더러 커버)은 Phase 0 에서 검증·확정한 단일 `design.md` 를 일관 적용 체크리스트로 사용한다 — token/유틸/상태/구조 패턴을 family 전체에 동일 기준으로 적용. 결과는 `componentCatalog` / `PrimitiveBinding` / reusable canonical 문서로만 반영하고, design.md 를 런타임 계약으로 승격하지 않는다.
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

2026-05-20 현황: Button/Separator/Link/Breadcrumbs/ToggleButton/ToggleButtonGroup/Toolbar
및 TextField/NumberField/SearchField/DateField/TimeField/ColorField/Form/FileTrigger,
selection family, ListBox/GridList/TagGroup/Menu/ComboBox/Select/Tabs 의
Inspector props source 는 `getPrimitiveBinding()` 우선 경로로 진입한다. legacy
`specRegistry` 는 catalog binding 이 없는 component fallback 으로만 남아 있다.

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
10. ADR 본문·README status 가 Implemented 로 동기화되고, ADR-036/907/908/140/141 status 가 재평가된다.
