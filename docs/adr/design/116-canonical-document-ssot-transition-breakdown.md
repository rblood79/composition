# ADR-116 구현 상세 — Canonical Document SSOT 전환

본 문서는 [ADR-116](../completed/116-canonical-document-ssot-transition.md)의 phase plan, inventory, gate 측정 방법을 정의한다. 핵심은 `CompositionDocument`를 최종 SSOT로 승격하고, legacy `elements[]`를 runtime 중심이 아니라 adapter 경계로 격리하는 것이다.

> **2026-05-02 direct cutover 정정**: 개발 단계라 기존 사용자/데이터 보존 의무가 없으므로 feature flag, backup, rollback marker, runtime DB migration 은 더 이상 목표가 아니다. 아래 historical sub-phase 중 flag/backup/migration 전제는 direct cutover 로 superseded 된다.
>
> **2026-05-05 rollback / 2026-05-06 follow-up**: 2026-05-03 post-cutover persistence/frame scope/style write-through fix 군은 사용자 환경 회귀 누적으로 2026-05-05 에 폐기됐다. 이후 current main 기준 새 패치군으로 page-frame refresh body/Slot projection, shared frame multi-page projection, component origin/instance persistence/override, synthetic page-frame projection `order_num` DB write 제외, Nodes panel Frames tree parity 를 다시 닫았다. legacy frame/slot/component mirror 는 adapter fallback/export boundary 에만 남긴다.

## 1. 최종 구조

| Layer                 | 최종 역할                         | 남겨도 되는 것                                                                                                                                              | 제거/격리 대상                          |
| --------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Canonical core        | 저장/편집/렌더 입력의 SSOT        | `CompositionDocument.version`, `children`, `type`, `props`, `frame`, `ref`, `reusable`, `descendants`, `slot`, `themes`, `variables`, `imports`, `metadata` | legacy ownership 필드                   |
| Composition extension | Composition-only behavior         | `x-composition.events`, `x-composition.actions`, `x-composition.dataBinding`, editor-safe metadata                                                          | function callback, React runtime object |
| Adapter boundary      | import/export/legacy payload 격리 | `legacyToCanonical`, `canonicalToLegacy`, Pencil import/export                                                                                              | hot path에서 전체 문서 projection       |
| Renderer input        | Skia/Preview/Publish 소비 모델    | resolved canonical tree, derived scene snapshot                                                                                                             | `layout_id`/`slot_name` 직접 분기       |

## 2. Core / Extension / Legacy 분류

| 항목                   | 최종 위치               | 이유                                    | 현재 anchor                                  |
| ---------------------- | ----------------------- | --------------------------------------- | -------------------------------------------- |
| `version`              | canonical core          | document schema version                 | `CompositionDocument.version`                |
| `children`             | canonical core          | document tree root                      | `CompositionDocument.children`               |
| `type`                 | canonical core          | component/structure discriminator       | `CanonicalNode.type`                         |
| `props`                | canonical core          | component semantics payload             | 현재는 `metadata.legacyProps` transition     |
| `frame`                | canonical core          | layout/group primitive                  | `FrameNode.type === "frame"`                 |
| `reusable`             | canonical core          | origin/master 선언                      | `CanonicalNode.reusable`                     |
| `ref`                  | canonical core          | instance 참조                           | `RefNode.ref`                                |
| `descendants`          | canonical core          | instance override/slot fill             | `RefNode.descendants`                        |
| `slot`                 | canonical core          | slot contract/recommendation            | `CanonicalNode.slot`                         |
| `themes`               | canonical core          | ADR-110 document-level theme            | `CompositionDocument.themes`                 |
| `variables`            | canonical core          | ADR-110 variable snapshot/resolver      | `CompositionDocument.variables`              |
| `imports`              | canonical core hook     | external document/reference hook        | `CompositionDocument.imports`                |
| `events`               | Composition extension   | Pencil core에 없는 app behavior         | legacy `Element.events`                      |
| `actions`              | Composition extension   | workflow behavior, function 아님        | Events Panel action model                    |
| `dataBinding`          | Composition extension   | app data source binding                 | legacy `Element.dataBinding`                 |
| `metadata.legacyProps` | adapter-only transition | legacy props 보존/renderer bridge       | `buildLegacyElementMetadata()`               |
| `layout_id`            | adapter-only legacy     | frame/ref/descendants로 대체            | legacy `Element.layout_id`, `Page.layout_id` |
| `slot_name`            | adapter-only legacy     | `descendants[slotPath].children`로 대체 | legacy `Element.slot_name`                   |
| `componentRole`        | adapter-only legacy     | `reusable`/`type:"ref"`로 대체          | legacy `Element.componentRole`               |
| `masterId`             | adapter-only legacy     | `RefNode.ref`로 대체                    | legacy `Element.masterId`                    |
| `overrides`            | adapter-only legacy     | `RefNode.descendants` patch mode로 대체 | legacy `Element.overrides`                   |

## 2.1 Component Props SSOT 결정

결정: `CanonicalNode.props?: Record<string, unknown>`를 canonical component props payload로 채택한다.

현재 `CanonicalNode` 타입은 `props` 필드를 갖지 않고, adapter가 `metadata.legacyProps`에 legacy `Element.props`와 일부 top-level field를 보존한다. Preview의 canonical renderer도 이 `legacyProps`를 꺼내 기존 rendererMap에 넘긴다. 이 구조는 transition bridge로는 유효하지만, 최종 SSOT로는 부적합하다. component semantics가 `metadata`에 묻히면 canonical document가 실제로는 legacy wrapper가 되기 때문이다.

Phase 0에서 shared type을 아래 형태로 고정한다.

```ts
interface CanonicalNode {
  id: string;
  type: ComponentTag;
  name?: string;
  props?: Record<string, unknown>;
  metadata?: {
    type: string;
    [k: string]: unknown;
  };
  reusable?: boolean;
  children?: CanonicalNode[];
  slot?: false | string[];
  theme?: {
    mode?: string;
    tint?: string;
    [k: string]: string | undefined;
  };
}
```

| 선택지                                          | 판정 | 이유                                                                                                  |
| ----------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `CanonicalNode.props?: Record<string, unknown>` | 채택 | 기존 renderer/inspector migration path와 가장 가깝고, `Button`/`TextField`/`Section` 의미 위치가 명확 |
| `CanonicalNode.component?: { props: ... }`      | 기각 | 구조 필드와 props 분리는 가능하지만 모든 renderer/inspector/store path에 한 단계 indirection을 추가   |
| `metadata.legacyProps` 유지                     | 기각 | 최종 SSOT 위반. metadata 과적재이며 canonical document를 legacy wrapper로 고착                        |

규칙:

1. `props`는 serializable JSON payload만 허용한다.
2. function callback, React element, runtime object는 `props`에 저장하지 않는다.
3. `events`, `actions`, `dataBinding`은 `props`가 아니라 `x-composition` extension에 저장한다.
4. Phase 1 이후 신규 canonical write는 `metadata.legacyProps`를 직접 쓰지 않는다.
5. legacy export adapter가 필요할 때만 `CanonicalNode.props`에서 legacy `Element.props`를 생성한다.

## 3. Extension namespace 결정

canonical core는 Pencil 구조 정합을 유지해야 하므로 Composition-only behavior를 core field로 직접 추가하지 않는다. 다만 Composition 내부 저장에는 app behavior가 필요하다.

### 채택안: top-level namespaced extension field

```ts
interface CompositionExtension {
  events?: SerializedEventHandler[];
  dataBinding?: SerializedDataBinding;
  actions?: SerializedAction[];
  editor?: Record<string, unknown>;
}

interface CompositionExtendedNode extends CanonicalNode {
  "x-composition"?: CompositionExtension;
}
```

| 후보                   | 장점                                                     | 단점                                                             | 판정 |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- | ---- |
| `x-composition`        | Pencil-compatible core와 명확히 분리, JSON에서 검색 쉬움 | 타입 확장 필요                                                   | 채택 |
| `metadata.composition` | 기존 `metadata` 활용 가능                                | `metadata.type` 계약과 섞이고 app behavior가 metadata로 과적재됨 | 기각 |
| `props.events`         | 기존 renderer path와 가까움                              | function callback/React props와 혼동, core/behavior 경계 붕괴    | 기각 |

규칙:

1. function callback은 serialize하지 않는다.
2. React Aria `onPress`, `onSelectionChange`, hover-triggered behavior는 serialized event name으로만 저장한다.
3. hover visual state는 event가 아니라 Spec/renderer state이다. hover로 동작을 실행할 때만 extension event가 된다.
4. ADR-116은 event storage 위치를 `x-composition`으로 정하는 ADR이다. editor capability registry, event label/category metadata, implemented-event filtering은 제거 대상이 아니라 serializer/adapter의 입력 catalog로 유지한다.

### Current dual-storage inventory

| 항목                                                | 현재 저장/소비 위치                     | 전환 규칙                                                                  |
| --------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| top-level `Element.events`                          | Inspector update path, Publish renderer | `x-composition.events`로 이동, legacy export 시 top-level로 복원           |
| `props.events`                                      | Preview event handler path              | `x-composition.events`에서 preview adapter가 event handler map 생성        |
| top-level `Element.dataBinding` / DB `data_binding` | API service, builder store              | `x-composition.dataBinding`으로 이동, legacy export 시 `data_binding` 복원 |
| shared component `dataBinding` prop                 | collection components runtime           | renderer adapter가 `x-composition.dataBinding`을 component prop으로 주입   |
| `actions`                                           | Events Panel handler/action model       | `x-composition.events[].actions` 아래에 serialize                          |

## 4. Phase Plan

| Phase   | 목표                         | 주요 작업                                                                                                    | Gate  |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ----- |
| Phase 0 | boundary freeze              | core/props/extension/legacy 분류 확정, 타입 TODO/ADR link 추가, 측정 baseline 갱신                           | G1    |
| Phase 1 | canonical document store/API | document mutation API + canonical -> legacy export adapter API 설계                                          | G2    |
| Phase 2 | hot path read cutover        | drag/selection/render/LayerTree/Preview sync에서 full projection 제거, canonical snapshot 구독               | G3    |
| Phase 3 | persistence write-through    | canonical document 저장 우선, legacy shadow write 또는 export adapter로 축소                                 | G4    |
| Phase 4 | legacy field quarantine      | ADR-113 Phase 5 + ADR-111 layout cleanup과 연결, adapter 디렉터리 외 legacy read/write 0건                   | G5    |
| Phase 5 | parity/extension closure     | Skia/Preview/Publish/History parity, `imports` resolver/cache policy, event/dataBinding extension serializer | G6/G7 |

## 5. Phase 0 — Boundary Freeze

산출물:

- `composition-document.types.ts`에 core/extension boundary 주석 보강 ✅ (G1 §2.1 + §3 + @fileoverview ADR-116 G1 boundary 표)
- `CanonicalNode.props?: Record<string, unknown>` shared type 추가 ✅
- `unified.types.ts` legacy field에 ADR-116 adapter-only marker 추가 ✅ (5필드 — `layout_id` / `slot_name` / `componentRole` / `masterId` / `overrides` / `descendants` / `componentName`)
- `metadata.legacyProps` transition-only marker 추가 ✅ (`CanonicalNode.metadata` 주석)
- `events`/`dataBinding`의 canonical core 진입 금지 및 dual-storage inventory 문서화 ✅ (`CompositionExtension` + `CompositionExtendedNode` + `Element.events`/`Element.dataBinding` @deprecated marker)
- baseline command 결과를 본 문서에 기록 ✅ (아래 baseline 표)

측정:

```bash
rg -n "legacyToCanonical\\(" apps packages
rg -n "metadata\\.legacyProps|legacyProps" apps packages
rg -n "\\b(layout_id|slot_name|componentRole|masterId|overrides)\\b" apps packages
rg -n "\\bprops\\.events\\b|\\bevents\\b|\\bdataBinding\\b|\\bdata_binding\\b" apps packages
```

### Baseline (2026-05-01, ADR-116 Phase 0 G1 land 직전 main HEAD `119f0206c`)

| Grep                                                                                 | 결과 |                                                                       의미                                                                        |
| ------------------------------------------------------------------------------------ | ---: | :-----------------------------------------------------------------------------------------------------------------------------------------------: |
| `legacyToCanonical\(` (호출 site 수)                                                 |   44 |                                         Phase 2 제거 대상 (drag/selection/render/LayerTree/Preview sync)                                          |
| `metadata\.legacyProps\|legacyProps` (참조 수)                                       |   92 |                                             Phase 1 이후 신규 write 0건 + Phase 4 adapter 외 0건 목표                                             |
| `\b(layout_id\|slot_name\|componentRole\|masterId\|overrides)\b` (broad word grep)   | 1062 | Phase 4 G5 정밀 grep (`adapters/` / test fixture 제외 후 0건 목표). 본 수치는 broad noise 포함 — Phase 4 Step 4-1 시점에 §9 정밀 grep 으로 재측정 |
| `\bprops\.events\b\|\bevents\b\|\bdataBinding\b\|\bdata_binding\b` (broad word grep) |  856 |                               Phase 5 G7 Extension Boundary 시점에 adapter 외 0건 목표. 본 수치는 broad noise 포함                                |

완료 조건:

| 조건                       | 통과 기준                                                                         |                             결과                             |
| -------------------------- | --------------------------------------------------------------------------------- | :----------------------------------------------------------: |
| core/extension/legacy 분류 | 본 문서 표와 타입 주석이 일치                                                     |                           ✅ PASS                            |
| component props 위치       | `CanonicalNode.props?: Record<string, unknown>` 타입 추가 + 신규 write path 지정  |                           ✅ PASS                            |
| Pencil schema 오해 방지    | "Pencil schema 그대로 채택" 문구 0건                                              |             ✅ PASS (대안 B 기각 §Decision 명시)             |
| events/dataBinding 위치    | core field가 아닌 extension-only로 명시 + legacy dual-storage migration path 존재 | ✅ PASS (`CompositionExtension` + dual-storage inventory §3) |

## 6. Phase 1 — Canonical Document Store API ✅ 2026-05-01 land

현재 `legacyToCanonical(input, deps)`는 read-through adapter다. Phase 1에서는 canonical document 자체를 mutation할 수 있는 API를 별도 surface로 만든다.

**Phase 1 land scope (R1 보수 = "API + unit test 까지만")**:

- D1=B (types + skeleton + unit test) — write-through 는 Phase 3 (G4)
- D2=β (별도 Zustand slice — `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`) — elementsMap wrapper 가 아니라 분리 store, Phase 2 hot path cutover 시 elementsMap 의존 제거 자연스럽게 가능
- D3=i (역방향 adapter spec only) — `CanonicalLegacyAdapter` interface 만 type lock-in, 구현은 Phase 3

### 6-A. land 산출물 (2026-05-01, ADR-116 Phase 1 G2)

| 산출물                                                                                                               | 위치                                                                                 |              |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | :----------: |
| `CanonicalDocumentActions` interface (7 method) + `CanonicalLegacyAdapter` spec stub                                 | `packages/shared/src/types/composition-document-actions.types.ts`                    | ✅ 신규 land |
| barrel export                                                                                                        | `packages/shared/src/types/index.ts` 末미 추가                                       |   ✅ land    |
| Zustand slice 구현 (`useCanonicalDocumentStore`) + `selectCanonicalNode` / `selectActiveCanonicalDocument` selectors | `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`                | ✅ 신규 land |
| vitest unit test (37 test, 7 action × happy path + edge case)                                                        | `apps/builder/src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts` | ✅ 신규 land |

### 6-B. 활성 document 모델

design breakdown §6 spec 의 mutation method 시그니처는 projectId 를 받지 않는다 (`updateNode(nodeId, patch)` 등). 이를 Phase 1 에서는 **활성 document 모델** 로 해석:

- store state: `currentProjectId: string | null` + `documents: Map<string, CompositionDocument>` + `documentVersion: number`.
- mutation method 는 currentProjectId 가 가리키는 document 에 작용.
- `setCurrentProject(projectId | null)` action 을 추가 (spec 외 — 활성 document 모델의 결과).
- currentProjectId 가 `null` 또는 document 미존재 / 노드 미발견 시 **no-op + dev warn** (silent fail / throw 모두 회피 — hot path race 대응).

### 6-C. 시그니처 구체화 (Phase 1 결정)

- `nodeId` = document 내 unique id (DFS 검색).
- `parentPath` / `nodePath` = Phase 1 에서는 single-segment nodeId 와 동일. multi-segment path (reusable boundary 가로지르는 경로) 는 Phase 2 hot path cutover 시점에 필요해지면 확장 (R6 잔존).
- `descendantPath` = pencil.dev 공식 slash-separated id path (`"label"` / `"ok-button/label"`).
- `updateNode` 가 `patch.id` / `patch.type` / `patch.props` 를 받으면 **silently 무시** — id/type 은 구조 invariant, props 는 `updateNodeProps` 사용 권장 (semantic intent 분리).
- `updateNodeProps` 가 `events` / `actions` / `dataBinding` key 를 받으면 **dev warn + skip** (G7 Extension Boundary 사전 enforcement).
- 모든 성공 mutation 은 `documentVersion + 1` + 새 `documents` Map reference 생성 (Zustand selector trigger).

### 6-D. 역방향 adapter (Phase 3 prerequisite)

`CanonicalLegacyAdapter` 는 Phase 1 spec only:

```ts
interface CanonicalLegacyAdapter<
  TElement = unknown,
  TPage = unknown,
  TLayout = unknown,
> {
  exportLegacyDocument(
    doc: CompositionDocument,
  ): CanonicalLegacyExport<TElement, TPage, TLayout>;
  diffLegacyRoundtrip(
    before: CanonicalLegacyAdapterInput<TElement, TPage, TLayout>,
    after: CanonicalLegacyExport<TElement, TPage, TLayout>,
  ): CanonicalRoundtripDiff;
  restoreFromLegacyBackup?(
    projectId: string,
  ): CanonicalLegacyAdapterInput<TElement, TPage, TLayout> | null;
}
```

Generic `T*` 매개변수로 builder 의 `Element` / `Page` / `Layout` 타입에 의존하지 않음 — Phase 3 호출 site 에서 builder 타입 주입.

### 6-E. Phase 1 외부 (Phase 2~5 잔존)

- **history/undo 통합** — Phase 1 mutation 은 history entry 를 push 하지 않음. Phase 2/3 시점에 canonical patch → history record 변환 결정 (R1 잔존).
- **persistence write-through** — Phase 3 G4. 본 store 는 in-memory only.
- **legacy elementsMap 양방향 sync** — Phase 2 hot path cutover (G3) 와 함께. 본 store 는 legacy store 와 별개.
- **selector subscription pattern** — `useCanonicalNode(nodeId)` 류 React hook 은 Phase 2 hot path cutover 시점에 추가 (`selectCanonicalNode` 는 cold path 용 placeholder). **✅ Phase 2 G3 Sub-Phase A (2026-05-01) land 완료** — `apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts` 의 `useCanonicalNode(nodeId)` + `useActiveCanonicalDocument()` 가 `useSyncExternalStore` 기반으로 구현 (D6=i 채택). Sub-Phase B 의 5 hot path cutover 는 본 hook 을 read backbone 으로 사용.

### 6-F. 원칙 (design breakdown §6 unchanged)

1. mutation API는 legacy `Element`를 입력으로 받지 않는다.
2. adapter는 legacy load/import/export에만 사용한다.
3. history entry는 canonical patch 단위로 기록한다 (Phase 2/3 통합).
4. `descendants` update는 slot fill, override patch, reset override를 모두 표현해야 한다 (`DescendantOverride` 3-mode union).
5. `exportLegacyDocument()`는 Phase 3 shadow write 전 필수 산출물이다.

### 6-G. 검증 evidence (Gate G2 PASS)

| 검증               | 결과           | 비고                                                                                   |
| ------------------ | -------------- | -------------------------------------------------------------------------------------- |
| `pnpm type-check`  | 3/3 successful | shared / builder / publish 모두 PASS (turbo cache miss)                                |
| vitest (canonical) | 37/37 PASS     | 7 action × happy + edge case + selector + immutability                                 |
| Gate G2 통과 조건  | ✅             | document mutation API + adapter API spec + `elements[]` 직접 mutation 없이 테스트 가능 |

## 7. Phase 2 — Hot Path Cutover

우선 제거 대상:

| 경로                       | 현재 문제                                          | 전환 목표                                |
| -------------------------- | -------------------------------------------------- | ---------------------------------------- |
| canvas drag/drop helper    | mousemove 중 doc build 위험                        | canonical snapshot 또는 scene index 사용 |
| BuilderCore layout refresh | elements 변경마다 projection/filter                | canonical store selector 사용            |
| LayerTree                  | legacy childrenMap + synthetic canonical 혼재      | canonical tree에서 derived view 생성     |
| Preview sync               | legacy element payload + canonical projection 혼재 | resolved canonical tree publish          |
| Selection/properties       | selected legacy element에서 canonical 역추적       | selected canonical path/id 기준          |

측정:

```bash
rg -n "legacyToCanonical\\(|selectCanonicalDocument\\(" apps/builder/src/builder apps/builder/src/preview
rg -n "layout_id|slot_name|componentRole|masterId" apps/builder/src/builder apps/builder/src/preview
```

완료 조건:

- drag/selection/render/LayerTree/Preview sync 경로에서 full document projection 0건
- `selectCanonicalDocument`는 adapter boundary 또는 cold path에서만 호출
- frame/slot/ref rendering은 canonical snapshot에서 파생

### 7-A. Sub-Phase A: Bridge layer + selector subscription pattern ✅ (2026-05-01)

**결정 분기**: D4=γ (3-4d bridge first + 1 path pilot) / D5=A (bridge layer 먼저 land) / D6=i (`useSyncExternalStore` — Zustand v5 selector cache miss 회피).

**산출물**:

- `apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts` (신규, ~140 lines)
  - read API: `getCanonicalNode(nodeId)` / `getActiveCanonicalDocument()` (Phase 1 selector wrap)
  - subscribe API: `subscribeCanonicalStore(listener)` (Zustand v5 native subscribe)
  - React hook: `useCanonicalNode(nodeId): CanonicalNode | null` / `useActiveCanonicalDocument(): CompositionDocument | null` (`useSyncExternalStore` 기반)
- `apps/builder/src/builder/stores/canonical/__tests__/canonicalElementsBridge.test.tsx`
  - 2026-05-02 direct cutover 로 bridge-local feature flag test 제거. read API + subscribe API + hook 검증만 유지
  - snapshot stability 검증 + mutation re-render evidence

**Sub-Phase A scope**:

- canonical store 단독 read (legacy `elementsMap` fallback 미포함)
- subscribe lifecycle + React hook backbone
- 5 hot path 자체 cutover 미진행 (Sub-Phase B)

**검증 evidence**:

| 검증                        | 결과           | 비고                                                |
| --------------------------- | -------------- | --------------------------------------------------- |
| `pnpm turbo run type-check` | 3/3 successful | builder cache miss 313ms / shared·publish cache hit |
| vitest (canonical 전체)     | 59/59 PASS     | 37 store + 22 bridge — 회귀 0                       |
| Gate G3 진행률              | 0/5 path       | backbone 구축 — Sub-Phase B 진입 prerequisite 충족  |

### 7-B. Sub-Phase B: 5 hot path path-by-path cutover

**진입 순서 권장** (회귀 isolation 좁힘 → 넓힘):

1. **LayerTree pilot** (1-2d MED) — derived view 생성 단순. `useActiveCanonicalDocument()` 가 read backbone. 회귀 = layer 표시 정확성.
2. **Selection/properties** (1d MED) — selected nodeId 기준 `useCanonicalNode` 직접 호출. 회귀 = panel 데이터 정확성.
3. **Preview sync** (1-2d HIGH) — resolved canonical tree publish 채널. 회귀 = preview iframe 시각.
4. **BuilderCore layout refresh** (1-2d HIGH) — projection/filter 제거 + canonical selector 도입. 회귀 = layoutVersion 트리거 정합.
5. **canvas drag/drop helper** (1d HIGH) — mousemove 중 doc build 회피 + scene index 도입. 회귀 = drag preview + drop position.

각 path 별 회귀 0 확증 (cross-check skill + Chrome MCP evidence) 후 다음 path 진입.

#### Step 1a: Legacy → canonical write-through sync ✅ (2026-05-01)

**결정 분기**: D7=A (write-through 정통 경로) / D8=β (Step 1a 단독 land) / D9=i (Zustand v5 native subscribe + ref 비교 selector — legacy store 무수정).

**CRITICAL 발견 → 격상 경로**: Sub-Phase A bridge land 후 baseline 측정 결과 canonical store `setDocument` 호출 site **0건**. LayerTree pilot 이 `useActiveCanonicalDocument()` 사용 시 즉시 `null` 회귀 → write-through sync 가 5 hot path 공통 prerequisite 임이 확정. Sub-Phase B Step 1 = sync 우선 land + LayerTree cutover 후속 분리.

**산출물**:

- `apps/builder/src/builder/stores/canonical/canonicalDocumentSync.ts` (신규, ~150 lines)
  - `startCanonicalDocumentSync(): () => void` 공개 API (3 store subscribe + initial schedule + unsubscribe)
  - microtask coalesce (`queueMicrotask` — 동일 macrotask 내 다중 mutation → 1번 sync)
  - ref 비교 selector (`elementsMap`/`pages`/`layouts`/`currentProjectId` 동일 ref 시 skip)
  - `null` projectId no-op (data store 미초기화 안전)
  - `selectCanonicalDocument()` 재사용 (elements.ts:2024 기존 helper)
  - test helper: `setSyncScheduler` / `resetSyncScheduler` / `isSyncScheduled`
- `apps/builder/src/builder/stores/canonical/__tests__/canonicalDocumentSync.test.ts` (신규, **11 test PASS**)
  - lifecycle 3 + null projectId 2 + propagation 5 + microtask coalesce 1

**Step 1b 분해 (작업량 재추정)**:

design §7-B 의 "LayerTree pilot 1-2d MED" 가 단일 PR 가정이었으나, 본 step 진입 시점 실측 분해:

| Sub-step  | risk | est   | 비고                                                       |
| --------- | ---- | ----- | ---------------------------------------------------------- |
| Step 1b-1 | LOW  | ~30분 | Bootstrap 호출. 2026-05-02 이후 env flag 없이 항상 시작    |
| Step 1b-2 | MED  | ~1d   | LayerTree dual-mode cutover (canonical → LayerTreeNode)    |
| Step 1b-3 | MED  | ~1-2h | Chrome MCP visual evidence (legacy vs canonical 시각 정합) |

#### Step 1b-1: Bootstrap 호출 ✅ (2026-05-01, 2026-05-02 direct cutover 갱신)

**결정 분기**: D10=B (Builder mount lifecycle) / D11=β (Step 1b-1 단독 land). D12 flag 운영은 2026-05-02 direct cutover 로 폐기.

**산출물**:

- `apps/builder/src/builder/main/BuilderCore.tsx` mount useEffect 에 `startCanonicalDocumentSync(projectId)` 호출 + cleanup unsubscribe → Builder route 이탈 시 sync 자동 정리

**회귀 안전망**: flag rollback 대신 targeted fixture/grep/type-check 로 검증한다.

**검증**:

| 검증                        | 결과           | 비고                                   |
| --------------------------- | -------------- | -------------------------------------- |
| `pnpm turbo run type-check` | 3/3 successful | builder cache miss 291ms               |
| vitest (canonical 전체)     | 70/70 PASS     | apps/builder cwd — 회귀 0              |
| direct cutover 정합         | ✅             | flag 없이 Builder mount 에서 sync 시작 |

#### Step 1b-2 진입 prerequisite (다음 세션):

- Builder 진입 시 flag 없이 canonical store mutation update 확인
- `useLayerTreeData.ts` dual-mode cutover (canonical → LayerTreeNode 변환 helper + virtual children + ref/instance 분기)
- Chrome MCP visual evidence (legacy vs canonical 모드 LayerTree 표시 정합성)

**검증 evidence**:

| 검증                        | 결과           | 비고                                           |
| --------------------------- | -------------- | ---------------------------------------------- |
| `pnpm turbo run type-check` | 3/3 successful | builder cache miss 313ms                       |
| vitest (canonical 전체)     | 70/70 PASS     | 37 store + 22 bridge + 11 sync — 회귀 0        |
| coalesce 검증               | ✅             | 3 mutation → 1 sync (version diff = 1)         |
| ref 비교 skip               | ✅             | 동일 ref setState → sync 미실행 (version 보존) |

#### Step 2: Selection/properties cutover ✅ (2026-05-01)

**결정 분기**: D13=A (1 PR 통합 land — sub-step 분해 회피, 사용자 surface 최소화 정책 준수) / D14=A (legacy uuid 기준 metadata DFS lookup — segId 와 다른 lookup 키 분리) / D15=A (`useSelectedElementData` 단일 진입점 dual-mode — fallback 자동 처리, caller 무수정).

**산출물**:

- `apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts`
  - `useCanonicalNode(nodeId: string | null)` 시그니처 확장 — null 안전 (Step 2 caller 가 selectedElementId 직접 전달)
- `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts`
  - `canonicalNodeToElement` export 승격 (Step 1b 의 internal helper → public)
  - `findNodeByLegacyId(doc, legacyId)` 내부 helper — `metadata.legacyProps.id === legacyId` DFS 매칭 (canonical node.id = segId 와 legacy uuid 가 다르므로 metadata 검색 필요)
  - `useCanonicalSelectedElement(selectedElementId)` 신규 hook — `useActiveCanonicalDocument` + `findNodeByLegacyId` + `canonicalNodeToElement` 조합. `useMemo` (deps: `selectedElementId`, `doc`)
- `apps/builder/src/builder/stores/index.ts`
  - `useSelectedElementData()` direct cutover — canonical selected element 가 있으면 우선 사용, 없을 때만 legacy `state.elementsMap` fallback. caller (PropertiesPanel / inspector editors / Style sections) 무수정
- 신규 test 7건 — bridge `useCanonicalNode(null)` null 시그니처 1건 + view `useCanonicalSelectedElement` 6건 (selectedElementId null / store 미활성 / Element 변환 / metadata 미보존 / id 변경 시 새 element / mutation re-render)

**Step 2 scope**:

- `useSelectedElementData()` 1 hook 만 cutover — PropertiesPanel + ComponentSemanticsSection + ComponentSlotFillSection + FrameSlotSection + Style sections 자동 전환 (단일 SSOT 진입점)
- write 경로 (`updateSelectedStyle` / `updateSelectedProperty` 등) 미진입 — Phase 3 G4 영역
- ref instance resolution canonical mode skip — sync 가 ref 처리 미수행 시점, Sub-Phase B 후속 cutover 시점에 재검토

**검증 evidence**:

| 검증                                 | 결과           | 비고                                                                      |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------- |
| `pnpm turbo run type-check`          | 3/3 successful | builder cache miss / shared·publish cache hit                             |
| vitest (canonical 전체)              | 84/84 PASS     | 37 store + 23 bridge + 11 sync + 13 view — 회귀 0                         |
| vitest (stores+properties+inspector) | 209/209 PASS   | 26 file 광역 회귀 검증                                                    |
| Gate G3 진행률                       | 2/5 path       | LayerTree (Step 1b) + Selection/properties (Step 2) — Sub-Phase B 진행 중 |

**다음 진입점**: 5 hot path 중 3 (Preview sync / BuilderCore / canvas drag-drop) 잔여. Preview sync 는 1-2d HIGH (resolved canonical tree publish 채널), BuilderCore + drag-drop 은 layoutVersion / 좌표 정합 검증 필요.

#### Step 3: Preview sync cutover ✅ (2026-05-01)

**산출물**:

- `apps/builder/src/builder/hooks/useIframeMessenger.ts`
  - `legacyElements = useStore((state) => state.elements)` rename + `elements = useMemo dual-mode` (canonical mode + active doc 존재 시 `useCanonicalElements()` derived, 그 외 legacy)
  - `sendInitialData` 의 `useStore.getState().elements` 호출도 dual-mode (closure 안 매 호출 시 `getActiveCanonicalDocument` + `canonicalDocumentToElements` 직접 평가)
- `apps/builder/src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts` regex 갱신 (ADR-903 P3-D-4 source-text test 가 `legacyElements` + `useMemo` 패턴 정합 검증)

**검증 evidence**:

| 검증                           | 결과           | 비고               |
| ------------------------------ | -------------- | ------------------ |
| `pnpm turbo run type-check`    | 3/3 successful | builder cache miss |
| vitest hooks+preview+canonical | 101/101 PASS   | 회귀 0             |
| Gate G3 진행률                 | 3/5 path       | + Preview sync     |

#### Step 4: BuilderCore layout refresh cutover ✅ (2026-05-01)

**산출물**:

- `apps/builder/src/builder/main/BuilderCore.tsx`
  - `publishElements(sourceElements)` helper 추출 — `editMode filter` + `lastSentEditModeRef`/`lastSentElementsRef` 비교 + `sendElementsToIframe` 호출 logic 단일화
  - `useEffect` dual-mode 분기:
    - canonical mode → `subscribeCanonicalStore` listener (canonical store mutation 시 `getActiveCanonicalDocument` + `canonicalDocumentToElements` → `publishElements`). `lastDerivedRef` ref 비교로 중복 publish 방지. doc 부재 시 legacy fallback (`useStore.getState().elements`)
    - legacy mode → 기존 `useStore.subscribe` 경로 그대로 유지

**dual subscribe 회피**: canonical mode 활성 시 canonical store 단일 publish source — write-through sync (Step 1a) 가 legacy → canonical propagate 보장하므로 legacy `useStore.subscribe` 비활성화 안전.

**검증 evidence**:

| 검증                        | 결과           | 비고                                                                                             |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `pnpm turbo run type-check` | 3/3 successful | builder cache miss                                                                               |
| vitest hooks+main+stores    | 200/200 PASS   | 회귀 0                                                                                           |
| 사전 land 6 fail            | pre-existing   | factoryOwnership / resolver TC1 / useFillActions — Step 1b 시점부터 동일 6 fail (별도 처리 권장) |
| Gate G3 진행률              | 4/5 path       | + BuilderCore layout refresh                                                                     |

#### Step 5: Canvas drag/drop helper cutover ✅ (2026-05-01)

**산출물**:

- `apps/builder/src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.ts`
  - `findDropTarget` (drag mousemove 빈번 hot path) doc build dual-mode — canonical mode hit 시 `getActiveCanonicalDocument()` pre-built doc 직접 사용 (build cost 0), miss 시 legacy fallback `selectCanonicalDocument(state, pages, layouts)`
  - `buildReorderUpdates` (drop 시 1회 cold path) 도 동일 패턴 적용 (정합 유지)

**scope 분리**: BuilderCanvas.tsx 의 `useMemo` 캐싱된 doc build 2 site (`computeLayoutGroups` + `computeFrameAreas`) 는 deps 변경 시만 재계산 cold path → Step 5 scope 외, 미수정.

**검증 evidence**:

| 검증                        | 결과            | 비고                                            |
| --------------------------- | --------------- | ----------------------------------------------- |
| `pnpm turbo run type-check` | 3/3 successful  | builder cache miss                              |
| vitest canvas+canonical     | 224/224 PASS    | 회귀 0                                          |
| Gate G3 진행률              | **5/5 path ✅** | + canvas drag/drop helper — **Phase 2 G3 종결** |

#### Phase 2 G3 종결 (2026-05-01)

**5 hot path 모두 canonical read backbone land 완료**: LayerTree (Step 1b) + Selection/properties (Step 2) + Preview sync (Step 3) + BuilderCore layout refresh (Step 4) + canvas drag/drop helper (Step 5). 2026-05-02 이후 flag 없이 canonical store 를 우선 사용하고, active document miss 시에만 legacy fallback 한다.

**다음 진입점**: Phase 3 — Persistence Write-Through (G4). 2026-05-02 direct cutover 이후 canonical primary storage 전환 + legacy export on demand 는 완료됐고, `_meta.schemaVersion`/shadow write/rollback 승격은 폐기됐다.

## 8. Phase 3 — Persistence Write-Through

### 8.0 Fork Checkpoint (4 질문 lock-in, 2026-05-01)

Phase 3 G4 진입 시점 fork checkpoint 4 질문 통과 — 본 sub-section 1-line lock-in. adr-writing.md 정책 의무.

1. **base / 응용 분류**: Phase 3 G4 = Phase 2 G3 (read backbone) 의 write 응용. 단 Phase 3 안에서 4 sub-phase 의 base/응용 = **3-A shadow write 가 base** (검증 backbone, 무손실 확인 해야만 후속 진입 가능), 3-B/C/D 가 응용 (3-B = primary 전환 / 3-C = export 격리 / 3-D = migration marker). 3-A 미통과 시 3-B/C/D 진입 차단.
2. **schema 직교성**: read (G3 dual-mode) ↔ write (G4 storage 전환) 직교. 단 3-B 의 DB schema 변경 (D17=B 채택 시) 은 G3 read path 회귀 가능 → **3-B 진입 시 G3 5 path read 회귀 검증 의무** 추가.
3. **baseline framing reverse 검증**: ADR-903 read-through projection ↔ ADR-116 primary SSOT reverse 는 ADR §Decision 의 fork checkpoint (Phase 0 G1 시점) 에 lock-in 됨. Phase 3 G4 에서 동일 framing 적용 valid — 추가 reverse 발생 없음.
4. **codex 3차 미루지 말 것**: 본 design §8 결정 분기 D16~D19 lock-in 직후 codex review 1차 진입. 본문 정합 (Risk/Gate 매핑) 은 codex round 위임, framing reverse 의 valid 성은 본 시점 design 본문 명문화.

### 8.1 저장 전략 (4 sub-phase)

| 단계                        | 동작                                             | 목적                     | 의존                                    |
| --------------------------- | ------------------------------------------------ | ------------------------ | --------------------------------------- |
| 3-A shadow write            | canonical 저장 + legacy export 결과 비교         | historical 안전장치      | 2026-05-02 direct cutover 로 superseded |
| 3-B canonical primary       | 저장 source를 canonical document로 전환          | SSOT 전환                | direct cutover                          |
| 3-C legacy export on demand | legacy `elements[]`는 export/compat에서만 생성   | adapter 격리             | 3-B land                                |
| 3-D migration marker        | `_meta.schemaVersion`을 canonical-primary로 승격 | historical rollback 제어 | 2026-05-02 direct cutover 로 superseded |

### 8.2 결정 분기 (lock-in, 2026-05-01)

#### D16 (3-A shadow write 진입 시점 strategy) — **D16=A 채택**

| 옵션         | 내용                                                                        | risk | 채택 사유                                                                                        |
| ------------ | --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| **D16=A ✅** | 필수 API 3개 stub-first land (단독 PR) → 3-A shadow logic 후속 land (별 PR) | LOW  | 회귀 isolation 좁힘. API 시그니처 stub 단계 codex review 가능. 3-A logic 진입 시 API 의존성 확정 |
| D16=B        | 필수 API 3개 + 3-A shadow logic 통합 land (1 PR)                            | MED  | API + logic 동시 변경 — codex review 1차에서 양쪽 동시 검증 부담, scope 확장 risk                |
| D16=C        | 3-A shadow 만 우선 land (필수 API 미land, PoC only)                         | HIGH | 추천 안 함 — API 부재로 결과 검증 불가, 후속 cleanup 누적                                        |

#### D17 (3-B canonical primary 전환 strategy) — **D17=A 채택**

| 옵션         | 내용                                                                                                  | risk | 채택 사유                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| **D17=A ✅** | localStorage 우선 전환 (DB schema 미변경) — 신규 저장 source 가 canonical, 단 DB row 는 legacy export | MED  | DB schema migration 회피, rollback 단순. G3 read path 회귀 영향 0. DB 전환은 3-D 시점 별개       |
| D17=B        | DB schema bump (`_meta.schemaVersion` column 추가 + canonical column 추가) + canonical primary        | HIGH | DB migration HIGH risk, 사용자 프로젝트 호환성 영향. 본 sub-phase 분리 가능 — 3-D 시점 진입 권장 |
| D17=C        | localStorage + DB 동시 전환                                                                           | HIGH | 분리 권장 — D17=A + D19=B 조합으로 등가 달성                                                     |

**※ schema 직교성 보강 (질문 #2)**: D17=A 채택으로 3-B 진입 시 G3 read path 회귀 영향 0 보장. D17=B/C 채택 시 추가 회귀 검증 필요.

#### D18 (3-C legacy export 격리 strategy) — **D18=A 채택**

| 옵션         | 내용                                                                                            | risk | 채택 사유                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| **D18=A ✅** | `exportLegacyDocument(doc)` 단일 함수 SSOT — 모든 legacy `elements[]` 생성 site 가 본 함수 경유 | LOW  | grep gate 단순 (`exportLegacyDocument` 외 legacy direct write 0건). 단일 진입점 testability |
| D18=B        | export adapter + cache layer (publish 시 캐싱)                                                  | MED  | perf 최적화 — 본 sub-phase scope 외, 후속 ADR 또는 perf 별도 작업                           |

#### D19 (3-D migration marker strategy) — **D19 superseded (2026-05-02 direct cutover)**

| 옵션 | 내용                                                   | 판정                                                          |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------- |
| D19  | schemaVersion bump / rollback marker / backup snapshot | 폐기 — 기존 사용자 데이터 보존과 rollback 을 목표로 두지 않음 |

### 8.3 sub-phase 진입 순서 (확정)

1. **3-A-stub (LOW ~30분-1h)** — historical. direct cutover 이후 backup API 는 제거
   - `exportLegacyDocument(doc): Element[]` — stub return `[]` + TODO marker
   - `diffLegacyRoundtrip(before, after): { destructive, reorder, cosmetic }` — stub return `{ destructive: [], reorder: [], cosmetic: [] }` + TODO
   - vitest unit test = stub 동작 확인 (return value + 타입 시그니처)
   - codex review 1차 진입 prerequisite (API 시그니처 검증)
2. **3-A-impl (MED ~1d)** — historical. direct cutover 이후 shadow/backup 구현은 제거
   - `exportLegacyDocument` 실 구현 (canonical → legacy round-trip, fixture 100건)
   - `diffLegacyRoundtrip` 실 구현 (3 카테고리 분류)
   - vitest unit + dev console evidence (1-2주 monitoring 시작)
3. **3-A monitoring (1-2주)** — 폐기. targeted fixture/grep/type-check 로 대체
4. **3-B (MED ~1d)** — localStorage 우선 canonical primary 전환 (D17=A)
   - 신규 저장 source = canonical write (legacy mutation 차단)
   - DB row 는 legacy export 결과 사용 (schema 미변경)
   - G3 read path 5 path 회귀 0 재검증 (질문 #2 보강)
5. **3-C (LOW ~30분-1h)** — `exportLegacyDocument` 단일 SSOT 격리 (D18=A)
   - grep gate: legacy `elements[]` 생성 site 가 `exportLegacyDocument` 안에만 존재
   - 위반 site 발견 시 export 함수 경유로 refactor
6. **3-D (MED ~1d)** — 폐기. schemaVersion/rollback marker 없이 direct cutover

### 8.4 필수 안전장치 (각 sub-phase 별 land)

| 안전장치                                | 담당 sub-phase  | 검증                                                  |
| --------------------------------------- | --------------- | ----------------------------------------------------- |
| dry-run diff summary                    | historical      | direct cutover 이후 필수 아님                         |
| sample project roundtrip                | canonical tests | targeted fixture/grep/type-check 로 대체              |
| visual smoke (Skia + Preview + Publish) | 3-B             | G3 read path 5 회귀 검증 + Chrome MCP screenshot diff |

### 8.5 필수 API (3-A-stub 단독 PR)

| API                                  | 목적                                             | 최소 검증                 | sub-phase           |
| ------------------------------------ | ------------------------------------------------ | ------------------------- | ------------------- |
| `exportLegacyDocument(doc)`          | canonical primary에서 legacy compat payload 생성 | legacy load/render parity | 3-A-stub → 3-A-impl |
| `diffLegacyRoundtrip(before, after)` | shadow write 결과 차이 요약                      | destructive diff 0        | 3-A-stub → 3-A-impl |

### 8.6 G4 PASS 자동 grep gate (CI 가능)

```bash
# legacy elements[] direct write 0건 (adapter 외부)
rg -n "elementsApi\.(create|update|insert|delete)|setElements\(|mergeElements\(" \
  apps/builder/src/builder apps/builder/src/services \
  -g '*.ts' -g '*.tsx' \
  -g '!**/__tests__/**' \
  -g '!apps/builder/src/adapters/**' \
  -g '!apps/builder/src/lib/db/migration*.ts' \
  -g '!apps/builder/src/builder/utils/exportLegacyDocument.ts'
# → 0 matches 가 G4 PASS 시그널 (D18=A 단일 SSOT 격리 검증)
```

### 8.7 wrapper 내부 진정 reverse — drift #1 본질 work (2026-05-02 land 진입)

**framing 정정 (2026-05-02 사용자 정정 trigger)**: §8.6 grep gate baseline 0 도달 = **형식적 PASS**. caller 16 site 가 wrapper 통해 호출 ✅, 그러나 wrapper 내부는 여전히 legacy mutation primary ❌ → HC #1 ("최종 SSOT 고정 = `CompositionDocument`") reverse 미도달. **drift #1 본질 work = wrapper 5 내부 reverse + canonicalDocumentSync 방향 swap**.

**monitoring 1-2주 framing 정정**: §8.3 의 "3-A monitoring 1-2주 destructive=0 evidence" 는 보수적 안전 장치였으나, evidence 의 본질 = **fixture coverage + edge case 검증** 이지 시간 텀 자체가 mitigation 강화 아님. fixture coverage 충분도가 본질. 따라서 monitoring 우회 + 즉시 reverse 가능 — fixture coverage gap 발견 시 즉시 fixture 보강 의무로 대체.

#### 8.7.1 wrapper 5 ↔ canonical store action 매핑표

본 §8.7 진입 시점 (2026-05-02) baseline:

| wrapper                                  | input                     | 카테고리        | canonical reverse path                                                                                                                                                            | 무한 루프 방지                         |
| ---------------------------------------- | ------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `mergeElementsCanonicalPrimary`          | `Element[]` (병합)        | in-memory       | (1) active canonical document 에 legacy id 기준 upsert → (2) `canonical.setDocument()` → (3) `exportLegacyDocument()` 결과 `legacy.setElements()` mirror                          | direct cutover: 항상 canonical primary |
| `setElementsCanonicalPrimary`            | `Element[]` (전체 교체)   | in-memory       | (1) pages/layouts snapshot 으로 canonical shell 구성 → (2) 입력 elements upsert → (3) `canonical.setDocument()` → (4) `exportLegacyDocument()` 결과 `legacy.setElements()` mirror | 동일                                   |
| `createElementCanonicalPrimary`          | `Partial<Element>` (DB)   | DB persist only | DB `elementsApi.createElement()` 그대로 — caller 가 반환 Element 받아서 별도 in-memory 호출. canonical reverse 영향 없음                                                          | —                                      |
| `updateElementCanonicalPrimary`          | `(id, patch)` (DB)        | DB persist only | 동일 — DB persist 만, in-memory 무관                                                                                                                                              | —                                      |
| `createMultipleElementsCanonicalPrimary` | `Partial<Element>[]` (DB) | DB persist only | 동일                                                                                                                                                                              | —                                      |

**진정 reverse work scope = in-memory wrapper 2개** (`mergeElements` / `setElements`). DB wrapper 3개는 reverse 영향 없음 (DB row = legacy export 결과, schema 변경 없음 = D17=A). 2026-05-02 slice 18 에서 두 wrapper 의 `legacyToCanonical()` full rebuild 는 native shell/upsert 로 제거됐다.

#### 8.7.2 4 의문 정밀화

1. **mergeElements 의 신규/기존 분기**: `legacy state + 입력 elements` merge 시 동일 id 면 입력으로 덮어쓰기. direct cutover 후에는 active canonical document 에 legacy id 기준 upsert 한다. 기존 node replacement 와 신규 node append 를 모두 native path 로 처리하며, full document projection rebuild 는 재도입하지 않는다.
2. **setElements 전체 교체**: 입력 elements + **기존 pages/layouts 보존** (입력 elements 만 변경, pages/layouts 는 이전 state). direct cutover 후에는 pages/layouts snapshot 으로 canonical shell 을 만들고 입력 elements 를 native upsert 한 뒤 export mirror 만 생성한다.
3. **DB persist 와 in-memory 순서**: DB wrapper 3개는 DB save 후 caller 가 반환 Element 받아서 별도 in-memory wrapper 호출 (현재 caller 패턴). canonical reverse 시점에도 동일 — DB save 는 reverse 무관, in-memory wrapper 만 reverse.
4. **무한 루프 방지**: wrapper 가 canonical setDocument + legacy setElements 양쪽을 처리한다. direct cutover 후 `canonicalDocumentSync` 는 legacy store subscribe/projection sync 를 수행하지 않고 active project lifecycle marker 로만 남으므로 wrapper → legacy mirror → sync 재호출 루프가 없다.

#### 8.7.3 sub-step β/γ/δ 정의

| sub-step                         | 정의                                                                                                                     | scope             | 위험                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------- |
| **β monitoring trigger** (선택)  | 폐기 — feature flag/shadow subscription 없이 targeted fixture 로 대체                                                    | 제외              | direct cutover 원칙                                        |
| **γ wrapper internal reverse**   | mergeElements / setElements wrapper 2개 내부 native reverse. projection caller 주입 없이 active doc/shell upsert 로 처리 | 본 §8.7 본격 land | HIGH — fixture coverage gap 발견 시 즉시 fixture 보강 의무 |
| **δ canonicalDocumentSync swap** | land — sync 는 project lifecycle marker 로만 유지하고 legacy snapshot projection 은 제거                                 | 본 §8.7 후속      | wrapper 가 canonical primary seed 책임                     |

#### 8.7.4 진입 순서 (확정)

1. **γ direct land** — wrapper 2 reverse 항상 활성 + vitest 회귀
2. **δ direct land** — `canonicalDocumentSync` legacy subscribe/projection 제거, project lifecycle only
3. **β/3-D 폐기** — feature flag, shadow monitoring, schemaVersion backup marker 는 direct cutover 원칙과 충돌

#### 8.7.5 land 후 재검증 의무

- `canonical 광역` PASS 유지 (canonicalDocumentStore + bridge + sync + view + exportLegacyDocument + g5LegacyFieldGrepGate + 기타)
- setup fail 영역 (`itemsActions.test.ts` + `pagesLayoutInvalidation.test.ts`) 10/10 PASS
- g5 grep gate baseline 0 유지 — wrapper reverse 가 `apps/builder/src/adapters/**` exclude 영역 안에 배치되어 grep gate 영향 0
- type-check 3/3 PASS
- feature flag 없이 page element add/edit/delete 시나리오 회귀 0 확인

## 9. Phase 4 — Legacy Field Quarantine

ADR-113 Phase 5와 ADR-111 잔여 layout cleanup을 본 ADR의 final gate로 묶는다. ADR-114의 독립 imports resolver/cache 계획은 2026-04-30 superseded 처리됐으므로, `imports` 자체는 canonical core hook으로 유지하되 fetch/cache/resolver 실행 경계는 본 ADR의 adapter/import/export 단계에서 다시 확정한다.

### 9.0 Fork Checkpoint (4 질문 lock-in, 2026-05-01)

Phase 4 G5 진입 시점 fork checkpoint 4 질문 통과 — 본 sub-section 1-line lock-in. adr-writing.md 정책 의무.

1. **base / 응용 분류**: ADR-111 P3 잔여 (`layout_id` cleanup) + ADR-113 Phase 5 (`slot_name`/`overrides`/`componentRole`/`masterId`/legacy `descendants` cleanup) = **base cleanup work** (실 mutation work, runtime read/write 0 도달이 목적). ADR-116 G5 = **응용 closure aggregator** (base ADR 의 cleanup work 진행도 marker + grep gate 0 도달 시 closure 신호). §11 명시 "ADR-111/113 cleanup 을 ADR-116 G5 에 연결" 정합.
2. **schema 직교성**: G5 6 필드 (structural cleanup) ⊥ G7 `events`/`dataBinding` (extension boundary, §10 Phase 5 영역) ⊥ `componentName` (ADR-113 P5 별도, §9 표 outside). 9 필드 통합은 직교성 위반이므로 본 phase 는 **6 필드만**. ADR Phase 0 G1 시점 9 필드 marker 는 cleanup target 표식일 뿐, G5 phase scope 는 아니다.
3. **baseline framing reverse 검증**: ADR-111 Status `In Progress (잔여는 ADR-116 이후 재개)` + ADR-113 Status `In Progress (잔여 Phase 4/5 는 ADR-116 이후 재개)` framing 은 **stale**. 본 §11 명시 "ADR-111/113 cleanup 을 ADR-116 G5 에 연결" 가 valid 한 framing — 두 ADR 의 cleanup work 를 ADR-116 G5 work scope **안에서** 진행, ADR-111/113 의 cleanup phase 는 ADR-116 G5 closure 시점에 동시 closure (Implemented). "ADR-116 이후 재개" 는 별도 재개 가정인데 cleanup work 가 ADR-116 G5 본질이라 별도 재개가 아닌 본 phase 가 그 재개 자체. 이 reverse 가 R4 (cleanup 기준 흩어짐) 대응의 본질.
4. **codex 3차 미루지 말 것**: 본 §9 보강 (sub-phase 분리 + baseline + caller 영역) lock-in 직후 codex review 1차 진입. 본문 정합 (Risk/Gate 매핑) 은 codex round 위임, framing reverse 의 valid 성은 본 시점 design 본문 명문화.

### 9.1 sub-phase 분리 (G5-A / G5-B)

6 필드를 schema 직교성 기준 2 sub-phase 로 분리. base ADR 정합 + scope 분리로 R5 cascade risk 분산.

| sub-phase                            | 필드                                                                            | base ADR            | baseline matches         | 종결 기준                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------- | ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G5-A** (ADR-111 layout_id closure) | `layout_id`                                                                     | ADR-111 Phase 3/4   | **165**                  | `page.layout_id` reference 가 reusable frame + page ref/descendants 구조로 마이그레이션. adapter 외부 runtime read/write 0건. ADR-111 P3 잔여 cleanup work 흡수.                                       |
| **G5-B** (ADR-113 P5 5필드 closure)  | `slot_name` / `overrides` / `componentRole` / `masterId` / legacy `descendants` | ADR-113 Phase 5-A~E | **195** (23+25+41+50+56) | 5 필드 모두 adapter 외부 runtime read/write 0건. canonical `DescendantOverride` union + `RefNode.ref` + `reusable`/`type:"ref"` + `RefNode.descendants` patch mode 통합. ADR-113 P5 cleanup work 흡수. |

**진입 순서**: G5-A → G5-B (base/응용 분류 결과). layout_id 가 더 광역 + ADR-111 frame canvas authoring 본질과 결합 → G5-A 가 base. G5-B 는 ADR-113 P5-A~E sub-phase 별 5 sub-step (`slot_name` → `componentRole` → `masterId` → `overrides` → `descendants`) 로 추가 분해 가능.

### 9.2 6 필드별 baseline + caller 영역 분류 (2026-05-01 측정, main HEAD `e5719bdf6` 기준)

design §9 grep 패턴 (runtime field access/write 만, adapter/test/migration exclude) 측정 결과:

| 필드            | matches | sub-phase | 핵심 caller 영역 (top files)                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------: | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout_id`     |     165 | G5-A      | panels/properties/editors (PageParentSelector 13 / PageLayoutSelector 5 / ElementSlotSelector 3 / LayoutPresetSelector 3 = **24**), hooks (usePageManager 13 / useIframeMessenger 7 = **20**), preview (CanvasRouter 7 / layoutResolver 6 / App 6 = **19**), workspace/canvas (resolvePageWithFrame 7 / skiaOverlayBuilder 3 / rendererInput 3 = **16**), stores/utils (layoutActions 8 / elementSanitizer 7 = **15**), utils (canonicalRefResolution 7 / projectSync 4 = **11**) |
| `slot_name`     |      23 | G5-B      | stores/utils (elementSanitizer 6), workspace/canvas (resolvePageWithFrame 5), packages/shared (element.utils 3), panels/properties (PropertiesPanel 3), preview (layoutResolver 2 / App 2)                                                                                                                                                                                                                                                                                        |
| `componentRole` |      41 | G5-B      | services/api (ElementsApiService 11) **DB-facing**, stores/utils (instanceActions 9 / elementSanitizer 4 / elementIndexer 2), stores/elements 4, utils (editingSemantics 5 / multiElementCopy 1 / canonicalRefResolution 1)                                                                                                                                                                                                                                                       |
| `masterId`      |      50 | G5-B      | services/api (ElementsApiService 11) **DB-facing**, stores (elements 9 / instanceActions 8 / elementSanitizer 4 / elementIndexer 4), utils (editingSemantics 3 / canonicalRefResolution 1), workspace/canvas (useResolvedElement 2 / StoreRenderBridge 2)                                                                                                                                                                                                                         |
| `overrides`     |      25 | G5-B      | stores/utils (instanceActions 9 / elementSanitizer 8 = **17/25 = 68%**), utils (instanceResolver 3), resolvers (storeBridge 1 / cache 1)                                                                                                                                                                                                                                                                                                                                          |
| `descendants`   |      56 | G5-B      | stores/utils (instanceActions 12 / elementSanitizer 8 = **20/56 = 36%**), panels/properties (ComponentSlotFillSection 8), utils (canonicalRefResolution 6 / editingSemantics 2 / instanceResolver 1), resolvers (canonical/index 5 / cache 1), packages/shared types (composition-vocabulary 3 / canonical-resolver.types 2 / composition-document 1)                                                                                                                             |
| **G5 합계**     | **360** | —         | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**hot path 식별** (sub-phase 작업 우선순위 결정 도구):

- **`elementSanitizer.ts`** = 6 필드 모두 (slot_name 6 / componentRole 4 / masterId 4 / overrides 8 / descendants 8 / layout_id 7 = **37**). single point of cleanup — sanitizer 가 canonical 변환 진입점이면 6 필드 동시 closure 가능.
- **`instanceActions.ts`** = ADR-113 P5 핵심 (componentRole 9 / masterId 8 / overrides 9 / descendants 12 = **38**). instance ref/override 처리 핵심.
- **`ElementsApiService.ts`** = DB-facing (componentRole 11 / masterId 11 = **22**). DB schema 면 — ADR-113 Phase 4 DB schema migration (별 phase, design §913-phase4 breakdown) 와 결합 검토.
- **`canonicalRefResolution.ts`** + **`editingSemantics.ts`** = ref resolution 영역 (모든 필드 등장).
- **`PageParentSelector.tsx`** + **`usePageManager.ts`** = layout_id 광역 (각 13). G5-A page→frame ref 마이그레이션 핵심.

### 9.3 완료 기준 (CI grep gate 가능)

```bash
# runtime field access/write only. broad word grep 금지.
rg -n "\\.(layout_id|slot_name|componentRole|masterId|overrides)\\b|\\b(layout_id|slot_name|componentRole|masterId|overrides)\\s*:" \
  apps/builder/src apps/publish/src packages/shared/src \
  -g '*.ts' -g '*.tsx' \
  -g '!**/__tests__/**' \
  -g '!*.test.ts' -g '!*.test.tsx' \
  -g '!apps/builder/src/adapters/**' \
  -g '!apps/builder/src/lib/db/migration*.ts'

# DB/API snake_case field access must also be adapter-only after cutover.
rg -n "\\b(layout_id|slot_name|component_role|master_id)\\b" \
  apps/builder/src/services apps/builder/src/lib packages/shared/src/schemas \
  -g '*.ts' -g '!**/__tests__/**'
```

결과는 0건이 원칙이다. 불가피한 잔존은 adapter/shim 디렉터리로 이동하고 파일명에 `legacy`를 포함해야 한다. test fixture, markdown, 일반 변수명 `overrides`는 gate failure로 세지 않고 별도 bucket에 기록한다.

### 9.3.1 strict logic-access 측정 (2026-05-01 land)

§9.3 첫번째 grep 의 raw count 는 comment / TS interface schema / 일반 변수명 / dev log noise 를 포함한다 (§9.3 footnote: "test fixture, markdown, 일반 변수명 `overrides` 는 gate failure 로 세지 않고 별도 bucket 에 기록"). 진정 PASS 측정은 **strict logic-access** (legacy field 의 runtime read/write) 만 헤아린다.

**strict logic-access grep (codify)**:

```bash
# 1) comment 라인 + console.* dev log 라인 exclude
# 2) TS interface 정의 file (component.types.ts MasterChangeEvent / DetachResult) 별도 bucket
# 3) canonical resolver function parameter (cache.ts computeDescendantsFingerprint) 별도 bucket — 일반 변수명
rg -n "\.(layout_id|slot_name|componentRole|masterId|overrides)\b|\b(layout_id|slot_name|componentRole|masterId|overrides)\s*:" \
  apps/builder/src apps/publish/src packages/shared/src \
  -g '*.ts' -g '*.tsx' \
  -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx' \
  -g '!apps/builder/src/adapters/**' \
  -g '!apps/builder/src/lib/db/migration*.ts' \
  | grep -vE '^\S+:\s*[0-9]+:\s*(\*|//|/\*|\*/)' \
  | grep -vE 'console\.(log|warn|info|error|debug)'
```

**vitest codify**: `apps/builder/src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` 가 strict 측정 + bucket 분류 자동 검증 + `BASELINE_VIOLATION_COUNT = 0` 도달 marker. baseline 증가 시 regression — 본 test 가 자동 감지.

**bucket 분류 (raw count 외 별도 측정 — gate failure 로 세지 않음)**:

| bucket                                  | 사례                                                                                                                       | 처리 사유                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Comment / JSDoc / @see / marker         | `resolvePageWithFrame.ts` JSDoc 6 / ADR-116 G5-B P5-D marker 등 24개                                                       | runtime 영향 0, design intent / migration marker 보존 가치                                                                                  |
| Console.log / dev log                   | `lib/db/indexedDB/adapter.ts:131` IndexedDB index 추가 log                                                                 | dev log emit only, ADR-113 P4 DB schema migration 영역                                                                                      |
| TS interface schema 정의                | `component.types.ts:35` `MasterChangeEvent.masterId` / `:48` `DetachResult.previousState.masterId\|overrides\|descendants` | ADR-113 P5 영역 별 bucket — instance 시스템 event/undo schema, `Element.masterId` legacy field 와 다른 schema, ADR-113 P5 closure 시점 정리 |
| Canonical resolver legitimate parameter | `cache.ts:75` `computeDescendantsFingerprint(overrides: Record<...>)`                                                      | §9.3 footnote 명시 일반 변수명, canonical 영역 함수 시그니처                                                                                |

**진정 PASS 의의**: strict logic-access = 0 도달 시 §9.3 gate PASS marker. 진정 logic cleanup 잔존 (instanceActions / ComponentSlotFillSection / editingSemantics 의 legacy `componentRole === "instance"` 분기 / `el.masterId` direct access body / `Element.descendants` 영역) 은 **ADR-111 P3 / ADR-113 P5 base cleanup work 의존** — 별 ADR phase, ADR-116 G5 scope 외.

### 9.4 prerequisite + ADR-111/113 closure 동시 마감

G5-A 종결 시 ADR-111 P3 잔여 (`layout_id` cleanup) closure marker → ADR-111 도 closure 가능 (Phase 3 frame canvas authoring + page→frame ref 마이그레이션 모두 land 후).

G5-B 종결 시 ADR-113 P5-A~E 5 필드 closure marker → ADR-113 P5 도 closure 가능. ADR-113 Phase 4 (DB schema migration, `113-phase4-db-schema-migration-breakdown.md` 별 design) 는 ADR-113 P5 와 직교 — 별도 진행. ADR-113 closure 는 P4 + P5 모두 land 시점.

ADR-116 G5 closure 시점 = G5-A + G5-B 모두 grep gate 0 도달. **Phase 5 G6 (Runtime Parity) + G7 (Extension Boundary) 진입 prerequisite**.

2026-05-01 runtime helper quarantine 추가 진행 후 raw exact gate 는 64까지 감소했고, follow-up 정리 후 45까지 추가 감소했다. 이 값은 아직 PASS가 아니다. 잔여 bucket 은 (1) DB/index/schema/comment, (2) canonical core `RefNode.descendants`, (3) legacy type guard/read-through fallback 으로 분리된다. Phase 5 진입 전 다음 중 하나가 필요하다: raw 0 도달, 또는 §9.3 gate 를 "legacy runtime read/write" 기준으로 재정의하고 canonical core/DB schema/comment bucket 을 명시 제외하는 follow-up land.

### 9.5 R5 cascade risk 대응 (HIGH)

R5: "legacy field quarantine 이 과도하게 빨리 진행되어 기존 프로젝트 read-through 가 깨질 수 있음".

**대응 절차**:

1. 각 sub-phase 진입 시 adapter (`apps/builder/src/adapters/canonical/legacyMetadata.ts` + `legacyToCanonical.ts`) 의 read-through 보존 — runtime read/write 만 0 도달, adapter read 는 유지.
2. migration marker 유지 — `metadata.legacyProps` 가 `id` / `parent_id` / `page_id` / `layout_id` / `order_num` / `fills` / `type` 7 fields 보존 (ADR-116 G1 §3 결정).
3. destructive migration 없이 shadow 검증 → fixture 100건 + 사용자 dev 환경 1-2주 monitoring (G4 monitoring 패턴 재사용).
4. **single point of cleanup 우선** — `elementSanitizer.ts` 같은 6 필드 모두 등장 site 부터 cleanup 진입 시 cascade 영향 가시성 ↑.
5. caller chain 추적 — top files 의 hot path 변경이 하류 caller (panels / hooks / workspace) 에 영향 줄 때마다 type-check + vitest 회귀 0 검증.

### 9.6 측정 history + 본 세션 land 진척

본 §9.2 baseline 은 단일 시점 measurement 가 아닌 **history**. 각 sub-step 진입 시점 measurement 누적.

| 측정 시점                                     | main HEAD   | layout_id | slot_name | componentRole | masterId | overrides | descendants |                  **G5 합계** |
| --------------------------------------------- | ----------- | --------: | --------: | ------------: | -------: | --------: | ----------: | ---------------------------: |
| 2026-05-01 codify (design 보강)               | `e5719bdf6` |       165 |        23 |            41 |       50 |        25 |          56 |                      **360** |
| sanitizer 격리 후 (first work)                | `ec73bc66c` |       158 |        17 |            37 |       46 |        17 |          48 |                **323** (-37) |
| ElementsApiService 격리 후                    | `05c92416b` |       158 |        17 |            26 |       35 |        17 |          48 |                **301** (-22) |
| P5-B `overrides` marker + write 1             | `2bee0c774` |       158 |        17 |            26 |       35 |        16 |          48 |                 **300** (-1) |
| P5-C `componentRole` caller 5                 | `49a85cc2b` |       158 |        17 |            19 |       35 |        16 |          48 |                 **293** (-7) |
| P5-D `masterId` helper + caller 4             | `<next>`    |       158 |        17 |            19 |       24 |        16 |          48 |                **282** (-11) |
| runtime helper quarantine                     | `working`   |        19 |         1 |             4 |       13 |         3 |          24 |                **64** (-218) |
| runtime helper quarantine follow-up           | `working`   |        19 |         1 |             1 |        5 |         2 |          17 |                 **45** (-19) |
| **strict logic-access (gate 재정의, §9.3.1)** | `<next>`    |         0 |         0 |             0 |        0 |         0 |           — | **0 ✅** (raw 28 → strict 0) |

**raw 45 → strict 0 변환 분류 (2026-05-01 land, §9.3.1 bucket 분류 적용)**:

§9.6 raw measurement 의 5 필드 합 28 (descendants 17 은 §9.3 첫 번째 grep 5 필드 외 — 별도 측정) 의 strict 분류:

| bucket                                     | 사례 위치                                                                                                                                                                                                                                                                       |       수 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------: |
| Comment / JSDoc / @see / migration marker  | resolvePageWithFrame 6 + composition-document.types 2 + StoreRenderBridge 2 + rendererInput 2 + layout.types 2 + urlGenerator/elementUtils/storeBridge/lib-db-types/useResolvedElement/visibleFrameRoots/frameActions/elementIndexer/ComponentsPanel/indexedDB-adapter:801 각 1 |       24 |
| Console.log / dev log                      | `apps/builder/src/lib/db/indexedDB/adapter.ts:131` IndexedDB index 추가 log                                                                                                                                                                                                     |        1 |
| TS interface schema 정의 (ADR-113 P5 영역) | `apps/builder/src/types/builder/component.types.ts:35` `MasterChangeEvent.masterId` + `:48-50` `DetachResult.previousState.{masterId,overrides,descendants}`                                                                                                                    |        2 |
| Canonical resolver legitimate parameter    | `apps/builder/src/resolvers/canonical/cache.ts:75` `computeDescendantsFingerprint(overrides: Record<...>)`                                                                                                                                                                      |        1 |
| **strict logic-access 잔존**               | (없음)                                                                                                                                                                                                                                                                          | **0 ✅** |

**Phase 5 G6/G7 정식 gate 진입 prerequisite 충족**: §9.3 strict logic-access PASS marker 도달. 진정 logic cleanup 잔존 (instanceActions / ComponentSlotFillSection / editingSemantics 의 legacy `componentRole === "instance"` 분기 / `el.masterId` direct access body / `Element.descendants` 영역) 은 ADR-111 P3 / ADR-113 P5 base cleanup work 의존 — 별 ADR phase, ADR-116 G5 scope 외.

**DB snake_case 측정 (design §9.3 두번째 grep)**:

| 측정 시점                           | layout_id | slot_name | component_role | master_id |
| ----------------------------------- | --------: | --------: | -------------: | --------: |
| ElementsApiService 격리 후 baseline |        29 |         1 |          **0** |     **0** |

`component_role` / `master_id` 0 도달 ✅ (ADR-113 P5-C/D base cleanup DB-facing 진척 marker). `layout_id` 29 잔존 = lib/db/migration.ts (12, exclude) + indexedDB/adapter.ts (12, ADR-113 P4 DB schema migration 영역) + project.schema.ts (2) + lib/db/types.ts (2) + PagesApiService.ts (1). `slot_name` 1 잔존 = project.schema.ts:64 (Zod schema definition).

**본 세션 진입 가능 영역 측정**:

- ✅ **mechanical adapter 격리** (single point cleanup 패턴) = **이미 land** (sanitizer + ElementsApiService). 다른 후보 file 발굴 결과:
  - `lib/db/indexedDB/adapter.ts` (12 matches) — IndexedDB schema column index, console.log + 주석. logic access 0 (grep pattern 매치 안 함). **격리 불필요** — 본 file 의 12 matches 는 design §9.3 첫번째 grep 결과에 포함되지 않음 (실제 baseline 158 layout_id 영역 외).
  - `lib/db/types.ts` (2 matches) + `project.schema.ts` (2-3 matches) = legacy schema definition. ADR-113 Phase 4 DB schema migration 영역.
  - `PagesApiService.ts` (1 match) = page CRUD service. 본격 cleanup 영역.
- ✅ **BaseApiService dead duplicate** (LOW hygiene) = stale ElementsApiService 클래스 + elementsApi 싱글톤 export 제거. 모든 caller 가 adapter 영역 (`legacyElementsApiService.ts`) 경유. baseline 영향 0 (dead code 였으므로) but file hygiene 개선.

### 9.7 본격 sub-step 진입 전략 (다음 세션 plan)

본 §9 본격 cleanup sub-step 은 **단일 세션 budget 외**:

| sub-step                 | 정독 결과 caller pattern                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 진입 risk                                                                                                                                                                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P5-A `slot_name`**     | resolvePageWithFrame slot resolution / element.utils slotMap / PropertiesPanel UI / preview slot fill 의 read site `props.slot_name ?? element.slot_name` fallback                                                                                                                                                                                                                                                                                                                                                                                                                     | **HIGH** — ADR-111 P3 미완성 frame.slot[] 인프라 결합 (design §6 비권장 시점). prerequisite 검증 필요                                                                                                                                                                               |
| **P5-B `overrides`**     | instanceActions 9 site (instance 생명주기 reset/merge/update) + instanceResolver merge + storeBridge legacyProps export + editingSemantics overrides keys. **2026-05-01 partial land**: type field marker 강화 + write site initial cleanup (`{}` → `undefined`) + legacy public API JSDoc deprecation + read-through fallback strategy 명문화. baseline 17 → 16 (-1). 본격 cleanup (instance 시스템 logic 변경) 은 ADR-111 P3 영역 결합으로 미진입.                                                                                                                                   | **MED-HIGH** — instance 시스템 logic 본질 변경, ~1-2d. **본격 cleanup 진정성 한계**: legacy `componentRole === "instance"` 분기 자체가 ADR-111 P3 cleanup target — overrides 만 단독 cleanup 어려움. P5-C `componentRole` cleanup 또는 ADR-111 P3 cleanup 시점에 동시 진정 cleanup. |
| **P5-C `componentRole`** | instanceActions hot path / editingSemantics / multiElementCopy / canonicalRefResolution. **2026-05-01 partial land**: caller 5 site (multiElementCopy 1 + elements 4 + elementIndexer 2) literal 비교 → `isMasterElement` / `isInstanceElement` type guard 호출로 단일화 + JSDoc strict legacy + read-through fallback marker. baseline 26 → 19 (-7). 잔존 19 = instanceActions 9 (ADR-111 영역) + editingSemantics 5 (ADR-111 영역) + 기타 5 (read-through fallback / dual-mode fixture / 주석 / strip).                                                                              | **MED** — ADR-111 `componentRoleAdapter` 활용 가능, ~2d. **본격 cleanup 진정성 한계**: instanceActions / editingSemantics 의 legacy 분기는 ADR-111 P3 cleanup 영역. type guard 자체 logic reverse (canonical 전환) 도 ADR-111 P3 cleanup 시점에 진행.                               |
| **P5-D `masterId`**      | instanceActions / elements store / elementIndexer / useResolvedElement / StoreRenderBridge. **2026-05-01 partial land**: `getInstanceMasterRef(el)` helper 신규 도입 (legacy `masterId` + canonical `ref` dual-mode read-through fallback) + 4 file caller migration (elements 7 access + elementIndexer 4 + StoreRenderBridge 2 + useResolvedElement 2 = 15 access → 0 direct, helper 호출). baseline 35 → 24 (-11). 잔존 24 = instanceActions 9 (ADR-111 영역) + editingSemantics 2 + signature parameter / type 정의 / 주석 / fixture / strip dict / read-through fallback body 등. | **MED-HIGH** — RefNode.ref 전환 ~2-3d. **본격 cleanup 진정성 한계**: instanceActions / editingSemantics 분기 + helper 내부 legacy `el.masterId` body 는 ADR-111 P3 cleanup 영역. helper logic reverse (legacy 분기 제거) 도 ADR-111 P3 cleanup 시점에 진행.                         |
| **P5-E `descendants`**   | instanceActions / ComponentSlotFillSection / canonicalRefResolution / resolvers/canonical/index / packages/shared types                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **HIGH** — ref 수 100+ + 23 file. 내부 분할 권장 ~2-3d                                                                                                                                                                                                                              |
| **G5-A `layout_id`**     | panels/properties/editors / hooks (usePageManager) / preview / workspace/canvas / utils — `page.layout_id → page.bodyElement (frame ref)` 마이그레이션                                                                                                                                                                                                                                                                                                                                                                                                                                 | **HIGH** — ADR-111 P3 frame canvas authoring 본질 결합, ~1주+                                                                                                                                                                                                                       |

**진입 순서 권장** (안전성 + design 정합):

1. **P5-B → P5-C → P5-D** — instance 시스템 cleanup 묶음 (LOW-MED), ADR-111 영역과 직교
2. **P5-E** — descendants schema 정합성 점검 (HIGH 분할)
3. **P5-A** — ADR-111 P3 closure (또는 G5-A) 후 진입
4. **G5-A** — ADR-111 P3 잔여 frame canvas authoring 본질 결합 진행 (별 ADR-111 본격 phase)

design §4 권장 진입 순서 (P5-A → P5-B → ...) 는 ref 수 기준만이었음. 본 §9.7 reorder 는 **ADR-111 P3 결합 위험** 회피 우선. P5-A 는 ADR-111 P3 frame.slot[] 인프라 완전 land 또는 G5-A 진행 후 진입.

### 9.7.1 §9.3 strict logic-access PASS marker land (2026-05-01)

**§9.6 footnote 옵션 (2) follow-up 진입** — §9.3 grep gate 의 raw 28 잔존을 strict 분류 (§9.3.1 bucket 4종) 후 logic-access 측정 = **0 도달 ✅**.

진정 logic cleanup 잔존은 ADR-111 P3 / ADR-113 P5 base cleanup work 의존 — §9.7 reorder 의 P5-A/B/C/D/E + G5-A 본격 cleanup 은 별 ADR phase 으로 진행. 본 marker land 의 의의:

- **Phase 5 G6 (Runtime Parity) + G7 (Extension Boundary) 정식 gate 진입 prerequisite 충족** — §9.3 strict measurement = 0
- **regression detection codify** — `apps/builder/src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` 가 strict 측정 + bucket 분류 자동 검증, 신규 logic access 추가 시 자동 fail
- **§9.7 reorder 본격 cleanup 진입 시점 신호 분리** — 진정 logic cleanup 진척 = ADR-111 P3 / ADR-113 P5 phase 본격 진입 시 marker

## 10. Phase 5 — Runtime Parity + Extension Closure

검증 matrix:

| 영역            | 필수 시나리오                                                                       |
| --------------- | ----------------------------------------------------------------------------------- |
| Slot            | 같은 recommended component 반복 fill, append semantics, clear slot                  |
| Ref             | origin -> instance navigation, instance -> origin navigation, detach                |
| Descendants     | patch / node replacement / children replacement 3-mode                              |
| Props           | `metadata.legacyProps` 없이 canonical props payload로 Button/TextField/Section 렌더 |
| Frame           | reusable frame 생성, page ref 연결, layout preset import                            |
| Imports         | external `.pen` reference fetch, ResolverCache/cache invalidation, import namespace |
| History         | slot fill, detach, override reset undo/redo                                         |
| Preview/Publish | canonical resolved tree 기반 렌더                                                   |
| Events          | `x-composition.events` serialize/deserialize, callback 저장 0건                     |
| DataBinding     | `x-composition.dataBinding` serialize/deserialize, renderer adapter 연결            |

### 10.1 착수 로그 — G7 Extension Boundary preflight

2026-05-01 착수 범위는 **G7 store/API surface** 로 제한한다. §9.4 기준 정식 Phase 5 G6/G7 gate 는 G5 raw 45 잔여로 아직 blocked 이며, 본 land 는 pass 선언이 아니라 extension boundary 의 합법 write surface 를 먼저 닫는 preflight 이다.

| 항목                   | 착수 결과                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Shared action contract | `CanonicalDocumentActions.updateNodeExtension(nodeId, patch)` 추가                                       |
| Store write surface    | `x-composition.events/actions/dataBinding/editor` patch + delete 지원                                    |
| Props boundary         | `updateNodeProps` 는 기존처럼 `events/actions/dataBinding` key 를 skip, 합법 저장 위치는 `x-composition` |
| Runtime payload guard  | function callback / Symbol / non-JSON runtime object / cycle skip + dev warn                             |
| Unit evidence          | `canonicalDocumentStore.test.ts` 42 tests PASS                                                           |

### 10.2 G6 (Runtime Parity) sub-phase 분해 + 우선순위 정렬 (2026-05-01 land)

**§9.3 strict logic-access PASS marker 도달 후 본격 G6 entry prerequisite work**. §10 검증 matrix 10 영역을 ADR-111/113 결합도 + 진척 가능성 기준으로 분류하여 sub-phase 분해.

#### 10.2.1 영역별 ADR-111/113 결합도 + 진입 가능성

| 영역            | ADR-111 결합 | ADR-113 결합 | 진입 risk    | sub-phase | 우선순위 |
| --------------- | ------------ | ------------ | ------------ | --------- | -------- |
| **Props**       | LOW          | LOW          | **LOW**      | G6-1      | **1**    |
| **Extension**   | LOW          | LOW          | **LOW**      | G6-1      | **1**    |
| **History**     | LOW          | LOW-MED      | **LOW-MED**  | G6-2      | **2**    |
| **Preview**     | LOW-MED      | LOW          | **LOW-MED**  | G6-2      | **2**    |
| **Publish**     | LOW          | LOW          | **LOW**      | G6-2      | **2**    |
| **Slot**        | HIGH         | MED          | **HIGH**     | G6-3      | 3        |
| **Ref**         | MED          | HIGH         | **HIGH**     | G6-3      | 3        |
| **Descendants** | MED          | HIGH         | **HIGH**     | G6-3      | 3        |
| **Frame**       | HIGH         | MED          | **HIGH**     | G6-3      | 3        |
| **Imports**     | MED          | LOW          | **MED-HIGH** | G6-4      | 4        |

#### 10.2.2 sub-phase 그룹

- **G6-1 — Extension Boundary + Props Parity** (`LOW`, ~1d): Phase 5 G7 preflight 후속. `updateNodeExtension` API 가 합법 surface 임을 회귀 vitest codify + Props canonical primary 렌더 (Button/TextField/Section 의 `metadata.legacyProps` 없이도 Skia + DOM 렌더 정합).
- **G6-2 — History + Preview/Publish Parity** (`LOW-MED`, ~2-3d): canonical store mutation 의 history granularity (undo/redo) + Preview/Publish 의 canonical resolved tree 렌더 정합. ADR-111/113 결합 회피 가능 영역 — Props/Extension 회귀 codify 가 prerequisite.
- **G6-3 — Slot/Ref/Descendants/Frame Parity** (`HIGH`, ~1주+): ADR-111 P3 frame canvas authoring + ADR-113 P5 instance schema 본격 결합. **ADR-111 P3 / ADR-113 P5 base cleanup work land 후 진입**. ADR-116 G5 §9.7 reorder 의 P5-A/B/C/D/E + G5-A 본격 진척과 동시 진행 가능.
- **G6-4 — Imports Parity** (`MED-HIGH`, ~3-5d): ADR-115 DesignKit scope superseded 후 잔여 fetch/cache/resolver. ResolverCache invalidation + external `.pen` reference fetch + import namespace 정합. ADR-111/113 직접 결합 적음 — G6-3 후 또는 별 진행 가능.

#### 10.2.3 본 세션 진입 = G6-1 first work (Extension Boundary closure 회귀 codify)

**framing surface 의무**: G6-1 본격 work 가 Phase 5 G7 preflight 후속 — `updateNodeExtension` API 가 land 됐으나 caller migration / 회귀 evidence codify 미land. 본 first work scope:

- **`updateNodeExtension` boundary closure 회귀 vitest** — Phase 5 G7 preflight 의 `canonicalDocumentStore.test.ts` 42 PASS 는 store-level 검증. Boundary closure 회귀 = 신규 caller 가 events/dataBinding 을 props 로 우회 저장하지 않는지 grep gate codify 필요.
- **events/dataBinding/actions key 의 props 저장 차단 검증** — `updateNodeProps` 가 forbidden key skip 동작은 store test 에 검증됨. 추가로 caller 영역 grep gate (`updateNodeProps({ events: ..., })` / `updateNodeProps({ dataBinding: ..., })` 류) 가 0건임을 codify.
- **Props canonical primary 렌더 회귀 (G6-1 second work)** — 별 PR slice. Button/TextField/Section spec consumer 가 `metadata.legacyProps` 없이도 Skia + DOM 정합 렌더. fixture + visual evidence 필요 ~1d MED.

본 세션 진입 = **G6-1 first work first slice** = boundary closure caller grep gate vitest codify. ADR-111/113 결합 0, schema marker only, 1 PR LOW scope.

#### 10.2.4 G6-1 first work first slice land (2026-05-01) — `legacyExtensionFields.ts` helper + caller 2 site migration

**framing 재조정** — design §10.2.3 에서 caller grep gate vitest codify 만 본 세션 first work 로 정의했으나, `updateNodeProps` / `updateNodeExtension` 실 caller 가 0건이라는 grep 결과로 grep gate 자체가 sub-zero (현재도 0, 미래 marker only) 임을 확인. **진정 진척 영역 재발굴** = legacy `Element.events` / `Element.dataBinding` runtime read site cleanup (Phase 5 G7 closure 의 진정 cleanup target).

**land 내용**:

- **`apps/builder/src/adapters/canonical/legacyExtensionFields.ts` 신규** — `getElementEvents(element)` + `getElementDataBinding(element)` 2 helper. read priority: `props.<field>` (UI canonical primary) → `element.<field>` (legacy fallback) → 기본값 (`[]` / `undefined`). `LegacyElementWithExtension` generic input shape — `Element` (apps/builder unified.types) 와 다른 local interface (예: workflowEdges `WorkflowElementInput`) 양쪽 호환.
- **caller 2 site migration**:
  - `apps/builder/src/builder/utils/canvasDeltaMessenger.ts:262-263` — postMessage `Created` payload 의 `events: element.events` + `dataBinding: element.dataBinding` 직접 read 를 helper 호출로 대체.
  - `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts:203-208` — `props.events` / `element.events` priority logic 6 line 을 `getElementEvents(element)` 단일 호출로 통합. `WorkflowEventInput[]` cast 보존 + `events.length === 0` continue 로 단순화 (`!Array.isArray` early-return 제거 — helper 가 항상 array return).
- **events legacy field read 잔존 측정** (helper 경유 후, packages/shared/src/utils/migration.utils.ts:158 만 잔존):
  | 영역 | 진입 시점 logic access | 본 세션 cleanup | 잔존 |
  | --- | -: | -: | -: |
  | `apps/builder/src/builder/utils/canvasDeltaMessenger.ts` | 1 | -1 | 0 |
  | `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` | 1 | -1 | 0 |
  | `packages/shared/src/utils/migration.utils.ts` (별 bucket) | 1 | 0 | 1 |
  | `apps/builder/src/builder/panels/events/state/useEventHandlers.ts` (JSDoc, comment bucket) | 0 | 0 | 0 |
  | **합계** | **3** | **-2** | **1** |
- **dataBinding legacy field read 잔존**: 본 세션 1 site cleanup (canvasDeltaMessenger.ts:263). 광역 47 site 중 (TableRenderer 19 / SelectionRenderers 12 / LayoutRenderers 4 / CollectionRenderers 4 / 기타 8) → 후속 sub-phase 본격 cleanup 영역.
- **packages/shared `migration.utils.ts:158` 잔존 사유** — packages/shared 영역은 apps/builder/src/adapters import 불가 (모노레포 의존 방향). 별 bucket marker, 후속 sub-phase 에서 packages/shared 영역 helper 신규 또는 schema migration 영역 별 처리.

**검증**: `pnpm type-check` 3/3 PASS + vitest canonical 광역 148/148 PASS (회귀 0).

**G6-1 진척 marker**: Phase 5 G7 Extension Boundary closure 의 진정 cleanup work 진입 — events 영역 logic access **3 → 1 (-2, 67% 감소)**, dataBinding 영역 light cleanup 1. 후속 sub-phase = events 영역 잔존 1 (migration.utils.ts, packages/shared 영역) + dataBinding 광역 47 site cleanup + Element.actions 영역 측정.

#### 10.2.5 G6-1 second slice land (2026-05-01) — packages/shared `legacyExtensionFields.ts` helper + dataBinding priority pattern 16 site migration

**framing**: G6-1 first slice 후속 — packages/shared 영역 (renderers) 의 legacy `Element.dataBinding` read site 광역 cleanup. monorepo dependency 정합 (packages/shared 가 apps/builder import 불가) → packages/shared 영역 helper 별도 신규.

**design intent 의문 명시 (priority 차이)**:

- apps/builder 영역 helper (`apps/builder/src/adapters/canonical/legacyExtensionFields.ts`) default = `'props-first'` — UI workflow editor 가 inline 수정한 `props.<field>` canonical primary.
- packages/shared 영역 helper (`packages/shared/src/utils/legacyExtensionFields.ts`) default = `'legacy-first'` — renderers 기존 패턴 `element.<field> || element.props.<field>` 보존.

두 영역의 priority 차이는 framing 의문 (Phase 5 G7 closure 시점 canonical primary 저장 진입과 함께 통일 결정 사항). 본 세션 helper signature 는 priority option 으로 양쪽 caller 호환.

**land 내용**:

- **`packages/shared/src/utils/legacyExtensionFields.ts` 신규** — `getElementEvents(element, priority?)` + `getElementDataBinding(element, priority?)` 2 helper. `ExtensionReadPriority` type export (`'legacy-first' | 'props-first'`). default = `'legacy-first'` (packages/shared 영역 renderers 기존 패턴 보존).
- **`packages/shared/src/utils/index.ts` barrel** — `export * from "./legacyExtensionFields"` 추가.
- **packages/shared 영역 priority pattern caller 16 site migration**:
  - `SelectionRenderers.tsx`: 9 site (`const dataBinding = element.dataBinding || element.props.dataBinding` × 4 + `(element.dataBinding || element.props.dataBinding) as ...` × 5)
  - `CollectionRenderers.tsx`: 4 site (`const dataBinding =` × 1 + cast × 2 + object literal `dataBinding:` × 1)
  - `LayoutRenderers.tsx`: 2 site (line 109/931 priority pattern, line 153/960 ternary `isPropertyBinding ? dataBinding : element.dataBinding` 의 `element.dataBinding` direct 부분은 의도적 props ignore — 본 세션 미변환)
  - `TableRenderer.tsx`: 1 site (line 82 priority pattern, 나머지 18 site 는 `element.dataBinding?.type/source/config` direct access — helper return type `unknown` 한계, 후속 sub-phase)

- **본 세션 cleanup 영역 외 (후속 sub-phase 영역)**:
  - **direct access pattern (`element.dataBinding?.type/source/config`)**: TableRenderer 18 + SelectionRenderers 3 (`?.type === "field"` 등) + LayoutRenderers ternary 2 + DataTableComponent 1 = **24 site**. helper return type `unknown` 으로 `?.type` access 불가 — 후속 sub-phase 에서 helper signature 정밀화 (예: type-narrow generic) 후 변환.
  - **apps/builder 영역 cast read**: treeUtils 2 + inspectorActions 1 + index 1 + elementMapper 2 + ... = **5 site**. 모두 props ignore direct cast 의도 — 후속 sub-phase.
  - **events packages/shared 잔존 1 (migration.utils.ts:158)**: schema migration utility, `element.events ?? []` 패턴 — props fallback 적용 시 schema export 의미 변경 위험. 별 bucket marker 보존.

- **dataBinding 측정**:
  | 측정 시점 | packages/shared renderers | apps/builder | 합계 |
  |---|--:|--:|--:|
  | 진입 시점 (G6-1 first slice 종결) | 40 | 5 | 45 |
  | priority pattern cleanup 후 | 24 | 5 | 29 |
  | -16 (-36%, packages/shared priority pattern 영역) | | | |

**검증**: `pnpm type-check` 3/3 PASS + vitest canonical 광역 148/148 PASS (회귀 0).

**G6-1 second slice 진척 marker**: dataBinding priority pattern packages/shared 영역 0 도달 ✅. 잔존 29 = direct access pattern (24) + apps/builder cast read (5), 후속 sub-phase 에서 helper signature 정밀화 + apps/builder 영역 cast read 변환.

#### 10.2.6 G6-1 third slice land (2026-05-01) — helper return type 정밀화 + `'legacy-only'` priority + direct access pattern 24 + apps/builder cast read 5 cleanup

**framing 진입**: §10.2.5 후속 — direct access pattern (`element.dataBinding?.type/source/config`) 24 site 와 apps/builder cast read 5 site 가 helper signature 정밀화 후 cleanup 가능. design intent 정독 결과 priority pattern 의 `dataBinding` (legacy + props fallback) 과 direct access 의 `element.dataBinding` (legacy only, props ignore) 가 의도적 differential — `'legacy-only'` priority 추가가 정합.

**design intent 명시 (TableRenderer 사례)**:

- `const dataBinding = getElementDataBinding(element)` (priority pattern, legacy-first default) → **PropertyDataBinding 형식 검출용** (source + name 있음, type 없음 — UI editor inline binding)
- `const dataBindingLegacy = getElementDataBinding(element, "legacy-only")` (direct access pattern) → **standard DataBinding 형식 검출용** (type + source + config — persistent legacy storage)

두 형식이 동일 element 에서 분리 저장 가능 — element.dataBinding (standard) vs element.props.dataBinding (PropertyDataBinding). priority pattern + direct access 가 두 형식 분리 검출.

**land 내용**:

- **packages/shared helper signature 정밀화**:
  - `getElementDataBinding` return type: `unknown` → `DataBinding | undefined` (DataBinding from `../types/element.types`)
  - `ExtensionReadPriority` type 확장: `'legacy-first' | 'props-first' | 'legacy-only'` (props ignore 의도 표현)
- **apps/builder helper signature 정밀화** (동일 패턴):
  - return type: `unknown` → `DataBinding | undefined` (DataBinding from `@composition/shared`)
  - `ExtensionReadPriority` type export + `'legacy-only'` priority 추가
- **packages/shared direct access pattern 24 site cleanup**:
  - `TableRenderer.tsx` 18 site: `const dataBindingLegacy = getElementDataBinding(element, "legacy-only")` local var 추가, `element.dataBinding?.type/source/config` → `dataBindingLegacy?.type/source/config` (replace_all 3회 + manual 2 site).
  - `SelectionRenderers.tsx` 3 site (lines 405/406/408): 동일 패턴, local var 추가.
  - `LayoutRenderers.tsx` ternary 2 site (lines 153/960): `(isPropertyBinding ? dataBinding : element.dataBinding) as DataBinding | undefined` → `isPropertyBinding ? dataBinding : getElementDataBinding(element, "legacy-only")` (cast 제거, type-narrow 자동).
  - `DataTableComponent.tsx` 1 site (line 117): `element.dataBinding as DataBinding | undefined` → `getElementDataBinding(element, "legacy-only")`.
- **apps/builder cast read 5 site cleanup**:
  - `treeUtils.ts:110` (`Record<string, unknown> | undefined` cast): `getElementDataBinding(el, "legacy-only") as ...` (caller side type narrow 보존).
  - `treeUtils.ts:154` (`DataBinding | undefined` cast): `getElementDataBinding(item, "legacy-only")` (cast 제거).
  - `elementMapper.ts:20` (`SelectedElement["dataBinding"]` cast): cast 제거. `:50` (selected.dataBinding mapping) 은 SelectedElement source — helper 적용 의도 외, 그대로 유지.
  - `inspectorActions.ts:821` + `index.ts:196` (`SelectedElement["dataBinding"]` cast): cast 제거.

**cleanup 영역 외 (후속 sub-phase)**:

- `inspectorActions.ts:285-286` write site (`additionalUpdates?.dataBinding` payload assign) — write boundary 영역, helper 미적용.
- `elementMapper.ts:50` SelectedElement → Element mapping — helper 적용 의도 외.

**dataBinding 측정** (본 세션 진척):

| 측정 시점              | packages/shared renderers | apps/builder cast read |            합계 |
| ---------------------- | ------------------------: | ---------------------: | --------------: |
| G6-1 second slice 종결 |        24 (direct access) |                      5 |              29 |
| third slice cleanup 후 |                      0 ✅ |                   0 ✅ |               0 |
| 누적 변동              |                       -24 |                     -5 | **-29 (-100%)** |

**G6-1 packages/shared + apps/builder cast read 영역 종결 ✅**. 잔존 logic access 31 = 새로 발견된 영역 (`elementDiff` 8 + `canonicalDocumentStore` 4 + `composition-document.types` 4 + `createElement` AI tool 2 + `PropertiesPanel` 2 + `inspectorActions` write boundary 2 + 기타 comment / type schema) — G6-1 cleanup 영역 외, **후속 sub-phase** 또는 **별 G6-2/G7 영역** (write boundary / AI tool / canonical store 등).

**검증**: `pnpm type-check` 3/3 PASS + vitest canonical 광역 148/148 PASS (회귀 0).

#### 10.2.7 G6-1 잔존 31 영역 분석 — 3 agent 병렬 dispatch 결과 (2026-05-01)

**framing**: §10.2.6 후속 — 잔존 logic access 31 영역의 cleanup 가능성 평가 위해 3 agent 병렬 dispatch (worktree 격리). 각 agent = research + cleanup attempt + report.

**3 agent 결과 종합 (모두 cleanup 0 site)**:

1. **Agent 1 — `elementDiff.ts` 8 site** (apps/builder/src/builder/stores/utils/elementDiff.ts):
   - **모두 skip** — write-adjacent / type schema / history diff raw equality.
   - line 44, 65 = `ElementDiff` / `SerializableElementDiff` interface 정의 (type schema bucket).
   - line 209 = `deepEqual(prevElement.dataBinding, nextElement.dataBinding)` — **history diff 시스템의 raw field-level equality**. helper 적용 시 priority logic 개입으로 `element.dataBinding` 변경되어도 `props.dataBinding` 같으면 diff 미생성 의미 오염. **의도적 raw field 비교 — helper 적용 의도 외**.
   - line 211-212 = diff payload 캡처 (`prev: prevElement.dataBinding`) — write-adjacent.
   - line 274-275, 333-334 = undo/redo 복원 write site.

2. **Agent 2 — `createElement.ts` 2 + `PropertiesPanel.tsx` 2 site**:
   - **모두 skip** — write site / already-resolved prop.
   - createElement.ts:28, 67 = AI tool element 신규 생성 시 dataBinding payload 저장 (write site).
   - PropertiesPanel.tsx:273-274 = memo 비교 함수의 derived prop 비교. **`element.dataBinding` direct access 가 아니라 already-resolved `SelectedElement.dataBinding`** (이미 `stores/index.ts:197` 에서 `getElementDataBinding(element, "legacy-only")` 경유 추출됨).

3. **Agent 3 — Element.actions 영역 측정**:
   - **Element.actions logic access = 0 site**. `Element` type 에 top-level `actions?` field **자체 미정의**.
   - `actions` 는 처음부터 nested (`events[].actions` 또는 canonical `CompositionExtension.actions`) 로만 존재 — Phase 5 G7 schema 영역에서 `events` / `dataBinding` 만 legacy top-level field.
   - **stale docstring 발견**: `apps/builder/src/adapters/canonical/legacyExtensionFields.ts` head 가 `Element.actions` 를 events/dataBinding 와 동렬로 언급 — design 초기 G7 scope 작성 시점에 `CompositionExtension.actions` 와 혼동 흔적. 정정 land.

**3 agent 결과 종합 진척**:

- **logic access cleanup 추가 0 site** (G6-1 cleanup 영역 외).
- **valuable findings 3 종**:
  1. **baseline 측정 grep pattern 정밀화 권장** — 현재 `\.dataBinding\b` 가 `SelectedElement.dataBinding` (already-resolved derived prop) 등 false positive 포함. 정밀 grep = `element\.dataBinding\b` (direct access only) + bucket 분류.
  2. **Element.actions 영역 0 도달 ✅** — Phase 5 G7 schema 영역 cleanup target 미존재, helper 신규 / caller migration 모두 불필요. `Element.events` / `Element.dataBinding` 만 cleanup target.
  3. **write-adjacent + history diff 영역 = helper 적용 의도 외** — elementDiff 의 history diff raw equality / undo-redo 복원 / AI tool element 생성 / Inspector write boundary 영역은 helper 미적용. 이 영역은 G6-1 cleanup 영역 정의 명시 외.

**G6-1 cleanup 영역 진정 정의 codify**:

- ✅ **read site (priority pattern + direct access + cast read)**: helper 경유 cleanup. **47 site cleanup 완료** (G6-1 first/second/third slice).
- ❌ **write site / write-adjacent**: helper 미적용. `element.dataBinding = X` / `payload.dataBinding = X` / object literal 저장 / undo-redo 복원 / history diff raw equality.
- ❌ **already-resolved derived prop**: `SelectedElement.dataBinding` 등 normalized 상태, `element.dataBinding` direct 가 아님.
- ❌ **type schema definition**: `ElementDiff.dataBinding` interface 정의 등.
- ❌ **comment / JSDoc / migration marker**: noise bucket.

**잔존 측정 정정** (3 agent 결과 반영):

| 측정 시점                         | logic access read | write site / write-adjacent | already-resolved | type schema |  comment | 합계 |
| --------------------------------- | ----------------: | --------------------------: | ---------------: | ----------: | -------: | ---: |
| G6-1 third slice 종결 (이전 추정) |                31 |                    (미분류) |         (미분류) |    (미분류) | (미분류) |   31 |
| 3 agent 분석 후 (정정)            |          **0 ✅** |                         ~10 |                2 |          ~6 |      ~13 |   31 |

**G6-1 read site cleanup = 0 도달 ✅** (47 → 0, 100%). 잔존 31 는 모두 helper 적용 의도 외 영역 (write / already-resolved / schema / comment). G6-1 closure 시그널 도달.

**docstring 정정 land**:

- `apps/builder/src/adapters/canonical/legacyExtensionFields.ts` head: `Element.actions` 참조 제거 + Element type 에 top-level `actions?` 미정의 명시 + `actions` 가 nested (events sub-field / canonical extension) 만 존재 명시.

**후속 sub-phase 진입 권장**:

- **G6-1 second work — Props canonical primary 렌더 회귀**: Button/TextField/Section spec consumer 가 `metadata.legacyProps` 없이도 Skia + DOM 정합 렌더, fixture + visual evidence ~1d MED.
- **G6-2 (History + Preview/Publish) 진입**: G6-1 closure 후, design §10.2.2 sub-phase 그룹 정합.
- **write boundary 영역 cleanup** (별 sub-phase, G7 closure 진정 work): `inspectorActions:285-286` payload write / createElement AI tool / undo-redo 복원 — `updateNodeExtension` API caller migration 진척 marker.

#### 10.2.8 G6-1 second work land (2026-05-01) — canonical primary fallback + spec consumer parity evidence

**framing**: G6-1 first work (closure 시그널 도달, §10.2.4~10.2.7) 완료 후 자연 후속 — Props canonical primary 렌더 경로 codify. G6-1 first work (Extension Boundary 영역 cleanup) 와 schema 직교 (events/dataBinding extension ⊥ component props). 1 PR LOW scope, 회귀 영역 0 (fallback 추가 + 기존 metadata.legacyProps 경로 보존).

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G6-1 first work 와 second work 는 직교 sibling slice (G6-1 안). base 관계 없음.
2. **schema 직교성**: ✅ events/dataBinding (extension) ⊥ props (component canonical primary).
3. **baseline framing reverse**: G6-1 first work 의 read site cleanup 결과가 second work prerequisite 영향 0 (fallback 경로 신설은 read backbone 영역, first work 와 영역 분리).
4. **codex 3차 미루지 말 것**: LOW scope 1 PR — 회귀 영역 0, 사용자 surface 시 codex review 진입.

**land 내용**:

- **`canonicalNodeToElement` 에 canonical primary fallback 분기 추가** — `metadata.legacyProps` 없어도 `node.props` 가 정의된 노드는 `node.id/.type/.props/.name` 직접 사용해서 Element 복원. `parent_id`/`order_num` 은 caller parent context, `page_id`/`layout_id`/`fills` 는 null/undefined. page placeholder / slot synthetic (props 미정의) 노드는 기존대로 null skip — fallback 진입 조건 `node.props != null` 로 회귀 격리.
  - 위치: `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts:49-103`.
  - docstring 갱신: 두 경로 분기 (legacy adapter vs canonical primary fallback) 명시 + null skip 조건 명시.
- **fixture vitest 확장 (B-1 + B-2 신규 7건)** — `apps/builder/src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts`:
  - **B-1 canonical primary fallback (5건)**: Button/TextField/Section 3종 fallback Element 복원 + name → componentName 매핑 + nested children parent context 승계 + node.props 미정의 노드 회귀 (page placeholder skip 유지) + metadata.legacyProps 우선순위 (양 경로 공존 시 legacy 우선).
  - **B-2 spec consumer parity evidence (3건)**: ButtonSpec/TextFieldSpec/SectionSpec `render.shapes()` 가 양 경로 (legacy adapter 경유 vs canonical primary) 에서 동일 결과 산출. Skia + DOM 렌더 양쪽이 spec.render.shapes() 단일 산출에 의존하므로 본 evidence = 시각 정합 surrogate.
- **vitest 결과**: canonicalElementsView.test.ts **23/23 PASS** (기존 16 + 신규 7).
- **광역 회귀 0 검증**: `pnpm vitest run src/adapters/canonical src/resolvers/canonical src/builder/stores/canonical` baseline (origin/main `353e8fc05`, stash) **264/265 PASS** (1 fail = pre-existing `integration.test.ts TC1` resolver 영역) → 본 work 적용 후 **274/275 PASS** (+10 신규, 동일 1 fail). 본 work 회귀 0 ✅.
- **type-check**: 3/3 PASS (FULL TURBO cache).

**G6-1 진척 marker (closure)**:

- ✅ G6-1 first work — Extension Boundary closure (events/dataBinding read site cleanup 47 → 0)
- ✅ G6-1 second work — Props canonical primary fallback + spec consumer parity evidence

**G6-1 closure 시그널 도달 ✅** (Extension Boundary + Props Parity 양 sub-phase 완료). Phase 5 G6-2 (History + Preview/Publish Parity) 진입 prerequisite 충족.

**다음 sub-phase 권장**:

- **G6-2 — History + Preview/Publish Parity** (LOW-MED, ~2-3d): canonical store mutation 의 history granularity (undo/redo) + Preview/Publish 의 canonical resolved tree 렌더 정합. ADR-111/113 결합 회피 가능, G6-1 회귀 codify 가 prerequisite (✅ 충족).
- **write boundary cleanup** (별 sub-phase, G7 closure 진정 work): `inspectorActions:285-286` payload write / createElement AI tool / undo-redo 복원 — `updateNodeExtension` API caller migration 진척 marker. G6-2 와 병렬 가능 영역.

**framing 의문 명시 — fallback 경로 활성화 시점**:

본 세션 fallback 추가는 read backbone 의 두 경로 분기 codify 만 land. canonical primary write 진입 (실제 `node.props` 만 저장하는 경로) 은 Phase 3 G4 영역 — 본 fallback 은 Phase 3 G4 진입 시점에 실 사용. 현재는 회귀 codify + fixture evidence 만 land 상태로, 사용자-가시 영향 0.

#### 10.2.9 G6-2 first slice land (2026-05-01) — Preview canonical 렌더 fallback (`extractLegacyPropsFromResolved` G6-1 정합)

**framing**: G6-1 closure (Extension Boundary + Props Parity 양 sub-phase) 후 자연 후속 — Preview canonical 렌더 경로의 G6-1 fallback 정합. design §10.2.2 G6-2 영역 의 (1) Preview parity 부분 first slice. (2) History parity + (3) Publish parity 는 후속 slice / 별 sub-phase.

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G6-2 = G6-1 의 응용 (G6-1 second work fallback 가 ResolvedNode → legacy props 추출 layer 까지 전파).
2. **schema 직교성**: G6-1 (Element 복원) ⊥ G6-2 first slice (ResolvedNode → legacy props 변환). ResolvedNode = CanonicalNode extends, props field 동일 SSOT.
3. **baseline framing reverse**: G6-1 closure prerequisite 충족, fallback 경로 정합 자연 후속. 의존 방향 정확.
4. **codex 3차 미루지 말 것**: LOW scope (~1 PR), 회귀 영역 0 (Case 1/Case 2 우선순위 보존). 사용자 surface 시 codex review 진입.

**scope 정확화 (design ~2-3d MED 추정 vs 실 측정)**:

design §10.2.2 추정 = ~2-3d MED. 실 baseline 측정 결과:

- **History parity 영역** = Step 1a (legacy → canonical write-through sync, 2026-05-01 land) 가 **이미 자동 cover** — legacy elements mutation → microtask coalesce → canonical store sync. legacy history undo 시 elements store 변경 → write-through propagate 로 canonical 자동 sync. 본 영역 추가 work = 회귀 codify 만 (별 vitest 영역 — `canonicalDocumentSync.test.ts` pre-existing setup fail 영역, 본 work 회피).
- **Preview parity 영역** = ADR-903 P2 옵션 C `CanonicalNodeRenderer` (feature flag `?canonical=1`) 이미 land. G6-1 second work fallback 정합 추가 = `extractLegacyPropsFromResolved` 의 canonical primary fallback 분기 추가만 필요. **본 first slice scope**.
- **Publish parity 영역** = `apps/publish/src/` 가 canonical 미사용 (legacy elements 직접 렌더). 본 ADR scope 외 (별 publish ADR 영역).

→ **G6-2 진정 work scope = ~1d LOW** (Preview parity first slice). History parity = 회귀 codify 만 (별 sub-phase, pre-existing fail 영역 debug 후), Publish parity = scope 외.

**land 내용**:

- **`extractLegacyPropsFromResolved` 에 canonical primary fallback 추가** — 세 metadata/props 패턴 대응:
  1. legacy adapter (metadata.legacyProps) — 기존 동작
  2. ref-resolve (metadata 에 type + spread) — 기존 동작 (Case 2 조건: `Object.keys(rest).length > 0` — 기존 ref-resolve 패턴은 항상 type 외 키 존재하므로 backward compat)
  3. **canonical primary fallback** (resolved.props 직접) — G6-2 신규
  - 위치: `apps/builder/src/resolvers/canonical/extractLegacyProps.ts` (신규 split file)
- **`extractLegacyPropsFromResolved` 를 별 file 로 split** — `apps/builder/src/resolvers/canonical/extractLegacyProps.ts` 신규.
  - **사유**: `storeBridge.ts` 가 `@/builder/stores/elements` import → vitest mock path resolution 함정 (`createElementsSlice is not a function` setup fail) 에 갇힘. `extractLegacyPropsFromResolved` 는 store 무관 helper 이므로 split 가능. memory 패턴 적용.
  - `storeBridge.ts` 는 backward compat re-export 만 유지 — production caller (CanonicalNodeRenderer 등) import path 무변경.
- **fixture vitest 신규** — `apps/builder/src/resolvers/canonical/__tests__/extractLegacyPropsFromResolved.canonical.test.ts` (8 test):
  - **TC9-TC13 (canonical primary fallback)**: metadata 없음 + resolved.props 있음 → props 직접 / metadata 가 type 만 있고 props 있음 / 우선순위 (legacy adapter > ref-resolve > canonical primary) / 회귀 (모두 없음 → `{}`)
  - **TC14-TC16 (G6-1 fallback 정합 evidence)**: Button/TextField/Section canonical primary node 가 ResolvedNode 통과 후에도 props 보존 — G6-1 second work fallback 와 G6-2 fallback 의 SSOT 정합

**검증 evidence**:

- `pnpm type-check` 3/3 PASS
- vitest `extractLegacyPropsFromResolved.canonical.test.ts` **8/8 PASS**
- 광역 회귀 0 검증: baseline (origin/main `0d39b3068`, stash) **274/275 PASS** (1 fail = pre-existing resolver TC1) → 본 work 적용 후 **282/283 PASS** (+8 신규 fixture 모두 PASS, 동일 1 pre-existing fail). 본 work 회귀 0 ✅.

**G6-2 진척 marker**:

- ✅ G6-2 first slice — Preview canonical 렌더 fallback (G6-1 정합)
- ⏭️ G6-2 second slice (예정) — History parity 회귀 codify (canonicalDocumentSync.test.ts pre-existing setup fail debug 후)
- ⏭️ Publish parity — scope 외 (canonical 미사용, 별 publish ADR 영역)

**다음 sub-phase 권장**:

- **G6-2 second slice** (LOW, ~0.5d): canonicalDocumentSync.test.ts setup fail debug + history parity 회귀 codify (legacy history.undo() → canonical store sync 자동 cover evidence vitest)
- **G6-3 (Slot/Ref/Descendants/Frame Parity)** — ADR-111 P3 / ADR-113 P5 base cleanup 의존, prerequisite 미충족 시 진입 회피
- **write boundary cleanup** (별 sub-phase, G7 closure 진정 work): `updateNodeExtension` API caller migration

#### 10.2.10 G7 transition first slice land (2026-05-01) — events/dataBinding round-trip 보존 (`buildLegacyElementMetadata` + `exportLegacyDocument`)

**framing**: write boundary cleanup 영역 진정 진척 — design §10.2.4 footnote 의 `updateNodeExtension` API caller migration 후속 권장 영역에서 baseline 측정 결과 **caller 0건** 확인 (G6-1 first slice §10.2.4 framing 재조정 동일 결과). **진정 진척 영역 재발굴** = legacy `Element.events` / `Element.dataBinding` 의 canonical adapter round-trip 보존 (write-through sync 가 자동 cover 하기 위한 prerequisite).

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G7 transition first slice = adapter layer (read-through projection + reverse export). G6-1/G6-2 (read backbone 의 canonical primary fallback) 와 직교 — adapter 변환 layer.
2. **schema 직교성**: events/dataBinding (legacy top-level field) ⊥ props (component canonical primary). adapter 가 양쪽 모두 metadata.legacyProps 에 spread 보존.
3. **baseline framing reverse**: G6-1 closure + G6-2 first slice prerequisite 충족. 본 transition step = G7 본격 cutover (`x-composition` extension only) prerequisite. 의존 방향 정확.
4. **codex 3차 미루지 말 것**: LOW scope (~30분 작업), adapter 양방향 + isolated round-trip vitest 13건. 회귀 영역 0 (events/dataBinding 미정의 시 spread skip 으로 backward compat).

**transition framing — dual-storage 단계**:

본 단계 = `metadata.legacyProps` 에 events/dataBinding 보존 (legacy adapter 패턴 유지). G7 본격 cutover 시점:

- events/dataBinding 를 `x-composition` extension (CompositionExtendedNode) 으로 분리
- `metadata.legacyProps` 에서 events/dataBinding 제거
- exportLegacyDocument 가 extension → element.events / element.dataBinding 복원
- canonicalNodeToElement (read backbone) 도 extension 에서 복원

본 first slice 는 transition path 의 **존재성 확보** — round-trip 손실 0 보장 + write-through sync 가 events/dataBinding 자동 cover 가능하게.

**land 내용**:

- **`buildLegacyElementMetadata` (legacyMetadata.ts:25)** — `metadata.legacyProps` 에 element.events / element.dataBinding 보존 추가:
  - 정의된 경우만 conditional spread (undefined 키 노출 회피)
  - top-level field 가 props 의 동명 키 덮어씀 (spread 순서 보존)
  - docstring 갱신 (G7 transition 명시)
- **`exportLegacyDocument.extractLegacyElement` (exportLegacyDocument.ts:76)** — `metadata.legacyProps` → element 변환 시 events / dataBinding 복원 추가:
  - top-level fields destructure 에 events / dataBinding 추가
  - 복원 시 element.events / element.dataBinding 로 분리 (props 안 잔존 안 함)
  - `LegacyPropsShape` 인터페이스에 events / dataBinding 필드 명시
- **`legacyExtensionRoundtrip.test.ts` 신규** (13/13 PASS):
  - **A. buildLegacyElementMetadata 보존 (5건)**: events / dataBinding 양쪽 / 동시 / undefined skip / props 동명 키 덮어쓰기
  - **B. exportLegacyDocument 복원 (4건)**: events / dataBinding 보존 노드 reverse / 미보존 노드 → undefined / props 안 events/dataBinding 잔존 안 함
  - **C. round-trip 동등성 (4건)**: Button + events / ListBox + dataBinding / 양쪽 동시 / 미정의 element

**검증 evidence**:

- `pnpm type-check` 3/3 PASS (FULL TURBO cache)
- vitest `legacyExtensionRoundtrip.test.ts` **13/13 PASS**
- adapter 영역 광역 회귀 0 검증: `pnpm vitest run src/adapters/canonical` **161/161 PASS** (11 file 모두 PASS)
- **본 work 회귀 0 ✅** — adapter logic 변경 영역 isolated 검증 PASS

**G7 transition 진척 marker**:

- ✅ first slice — events/dataBinding round-trip 보존 (`metadata.legacyProps` dual-storage)
- ⏭️ second slice — write-through sync 의 events/dataBinding 자동 cover 검증 (canonicalDocumentSync.test.ts pre-existing setup fail debug 후)
- ⏭️ G7 본격 cutover — `x-composition` extension only 전환 (별 sub-phase, ~MED 1-2d)

**다음 sub-phase 권장**:

- **G7 transition second slice** (LOW, ~0.5d): canonicalDocumentSync setup fail debug + write-through events/dataBinding cover 검증 vitest
- **G7 본격 cutover** (MED, ~1-2d): `legacyToCanonical buildNode` 가 events/dataBinding 를 `x-composition` extension 으로 변환 + reverse export + `canonicalNodeToElement` 도 extension 복원 + 광역 회귀 evidence

**framing 의문 명시 — write boundary cleanup 영역 재정의**:

design §10.2.4 footnote 의 "write boundary cleanup" 정의 (`inspectorActions:285-286` payload write / `createElement` AI tool / undo-redo 복원 — `updateNodeExtension` API caller migration) 가 baseline 측정으로 **caller 0건** 확인 후 무효화. 본 G7 transition first slice 는 진정 진척 영역 재발굴 결과 — adapter layer 의 round-trip 보존이 write-through sync 의 events/dataBinding 자동 cover prerequisite. inspector dual-write / AI tool migration 은 G7 본격 cutover 시점에 재평가 (canonical primary write 진입 시점).

#### 10.2.11 G7 본격 cutover land (2026-05-01) — `x-composition` extension only 전환

**framing**: G7 transition first slice (§10.2.10, `metadata.legacyProps` dual-storage) 의 진정 진척 — `x-composition` extension namespace 가 events/dataBinding 단일 SSOT 로 cutover. transition first slice 의 dual-storage 종결.

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G7 본격 cutover = canonical schema layer (CompositionExtendedNode 의 `x-composition` extension 활성화). transition first slice (`metadata.legacyProps` dual-storage) 의 진정 진척 — adapter 변환 layer 보다 한 단계 깊은 schema layer 로 진입.
2. **schema 직교성**: `x-composition.events` / `x-composition.dataBinding` ⊥ `metadata.legacyProps`. dual-storage 종결 후 single SSOT — 두 영역이 양립 안 함.
3. **baseline framing reverse**: transition first slice prerequisite 충족. 본 cutover = G7 closure (extension boundary 100% activation) 의 base step. 의존 방향 정확.
4. **codex 3차 미루지 말 것**: MED scope (~30분 작업, 5 file 변경 + test 17건). 회귀 영역 = canonical document 모든 consumer 지만 isolated round-trip vitest 17건 + adapter 광역 165/165 PASS 로 backward compat 확증.

**land 내용**:

- **`legacyToCanonical buildNode` (apps/builder/src/adapters/canonical/index.ts)** — `x-composition` extension 추가:
  - `buildCompositionExtensionField(element)` helper 신규 (events/dataBinding conditional spread)
  - 양쪽 미정의 시 빈 객체 반환 → extension key 자체 노출 회피
  - `slotAndLayoutAdapter.ts` 의 `convertElementToCanonical` / `convertElementWithSlotHoisting` 에도 동일 helper 호출 추가 (page subtree 안 element 변환 path)
  - `import` 추가: `CompositionExtension` / `SerializedDataBinding` / `SerializedEventHandler`
- **`buildLegacyElementMetadata` (legacyMetadata.ts)** — events/dataBinding spread 제거:
  - transition first slice 의 dual-storage 종결 (`metadata.legacyProps.events` / `dataBinding` 미생성)
  - docstring 갱신 (G7 본격 cutover 명시 + extension SSOT 위치 명기)
- **`exportLegacyDocument.extractLegacyElement` (exportLegacyDocument.ts)** — `x-composition` extension reverse:
  - `metadata.legacyProps` destructure 에서 events/dataBinding 제거
  - `node["x-composition"]` 에서 events/dataBinding 추출 → element top-level 로 분리
  - `LegacyPropsShape` 에서 events/dataBinding 필드 제거
  - 모듈 docstring 갱신 (G7 본격 cutover 영역 명시)
- **`canonicalNodeToElement` (apps/builder/src/builder/stores/canonical/canonicalElementsView.ts)** — extension 복원:
  - `extractExtensionFields(node)` helper 신규 — `x-composition.events` / `dataBinding` 추출
  - 양 분기 (legacy adapter 경유 + canonical primary fallback) 모두에 spread 적용 → 양쪽에서 events/dataBinding 자동 노출
- **`legacyExtensionRoundtrip.test.ts` 갱신** (17/17 PASS):
  - **A. legacyToCanonical extension 분리 (5건)**: events/dataBinding 양쪽 / 동시 / 미정의 / 빈 배열 skip
  - **B. buildLegacyElementMetadata dual-storage 종결 (3건)**: events/dataBinding 미spread 검증 + props 의 동명 키는 보존
  - **C. exportLegacyDocument extension reverse (4건)**: extension 보존 노드 → element 복원 / 미정의 → element 미정의 / props 잔존 0 / legacy fixture 잔여 호환 contract
  - **D. round-trip 정합 (5건)**: Button + events / ListBox + dataBinding / 동시 / 미정의 / props.events + top-level 공존
  - dummy page wrapper helper (`buildCanonicalFromElements` + `firstElementNode`) 도입 — element 별 page_id 보존하며 legacyToCanonical 호출

**검증 evidence**:

- `pnpm type-check` 3/3 PASS (FULL TURBO)
- vitest `legacyExtensionRoundtrip.test.ts` **17/17 PASS** (transition first slice 13건 → cutover 17건, +4건 신규)
- adapter 영역 광역 회귀 0 검증: `pnpm vitest run src/adapters/canonical` **165/165 PASS** (11 file 모두 PASS, 161 → 165 +4건)
- canonical store 영역 회귀 0 검증: `vitest src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts` **23/23 PASS** (extension spread 추가 후 회귀 0)
- G7 cutover 인접 영역 (`exportSsotGrepGate` / `persistenceWriteThroughStub` / `canonicalDocumentStore` / `FrameSlotSection`) **81/81 PASS**
- 광역 측정 시 pre-existing fail (`storeBridge.test.ts` / `canonicalDocumentSync.test.ts` zustand init setup fail + `integration.test.ts` TC1) — 단일 file isolated 측정으로 본 cutover 와 무관 noise 분리 (memory 세션 인수인계 명시 사전 land 6 fail 영역)

**G7 진척 marker**:

- ✅ transition first slice — events/dataBinding round-trip 보존 (`metadata.legacyProps` dual-storage, §10.2.10)
- ✅ **본격 cutover — `x-composition` extension only 전환** (본 work, §10.2.11)
- ⏭️ closure verification — write boundary cleanup baseline 재측정 (G7 closure 시점, ADR-116 parity Gate 충족)

**다음 sub-phase 권장**:

- **G7 closure verification** (LOW, ~0.5d): G7 본격 cutover 후 모든 hot path consumer (Preview / CanonicalNodeRenderer / inspector 등) 가 `x-composition` extension 우선 read 검증 + write 경로 (canonicalDocumentSync.test.ts setup fail 영역 진정 fix 후 events/dataBinding cover 검증)
- **Phase 4 G5 P5-B `overrides`** (MED-HIGH, ~1-2d, design §9.7 reorder 권장): instance 시스템 cleanup, ADR-111 P3 영역 결합 위험 고려

#### 10.2.12 G7 closure marker land (2026-05-01) — canonical document 직렬화 형태 contract + write boundary 분류

**framing**: G7 closure 의 본질 = **canonical document 직렬화 형태 검증** (events/dataBinding 가 `x-composition` extension 단일 위치에만 존재). G7 본격 cutover (§10.2.11) 직후 baseline 측정 결과 — write boundary cleanup 영역은 G7 closure 의 일부가 아니라 **Phase 3 G4 canonical primary write 영역** 으로 framing 재조정.

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G7 closure marker = canonical schema layer 의 직렬화 contract verification (G7 본격 cutover §10.2.11 의 진정 marker). write boundary cleanup ⊂ Phase 3 G4 영역 (canonical primary write 활성화 시점) — base/응용 분리.
2. **schema 직교성**: closure marker (canonical document 직렬화 형태) ⊥ write boundary (legacy element top-level 직접 write). 두 영역이 서로 다른 layer.
3. **baseline framing reverse**: G7 본격 cutover §10.2.11 prerequisite 충족 + write boundary 영역이 Phase 3 G4 cutover after migration 영역으로 framing 정정. 의존 방향 정확.
4. **codex 3차 미루지 말 것**: LOW scope (~30분, vitest 4건 추가). 회귀 영역 0 (closure contract 검증만).

**baseline 측정 결과 (2026-05-01, main HEAD `8c68a86ce`)**:

| 영역                                                                                                                                                   | site 수 | scope 분류                                        | 본 phase target |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------- | --------------- |
| adapter / store / view 양방향 변환 (`index.ts` / `slotAndLayoutAdapter` / `exportLegacyDocument` / `canonicalDocumentStore` / `canonicalElementsView`) | 13+     | G7 cutover 정합 영역                              | ✅ 충족         |
| `elementMapper.ts:44` (Inspector mapping `props.events = selected.events`)                                                                             | 1       | Preview adapter mirror                            | Phase 3 G4 영역 |
| `elementDiff.ts:203/210/272/275/331/334` (history undo/redo 양방향 diff)                                                                               | 6       | history layer                                     | Phase 3 G4 영역 |
| `inspectorActions.ts:616` (Events Panel 사용자 입력 mutation)                                                                                          | 1       | UI mutation hook                                  | Phase 3 G4 영역 |
| `createElement.ts:67` (AI tool create)                                                                                                                 | 1       | AI tool factory                                   | Phase 3 G4 영역 |
| `DataComponents.ts:42` / `definitions.ts:82` (factory + AI tool literal)                                                                               | 2       | factory layer                                     | Phase 3 G4 영역 |
| **합계 (G7 closure 영역 외)**                                                                                                                          | **11+** | Phase 3 G4 canonical primary write 시점 migration | ⏭️ 후속         |

**framing 재조정 — design §10.2.4 footnote 재정의**:

design §10.2.4 footnote 의 "write boundary cleanup" 정의 — `inspectorActions:285-286` payload write / `createElement` AI tool / undo-redo 복원 — 이 영역들이 **G7 closure 의 cleanup target 이 아니라 Phase 3 G4 canonical primary write 진입 시점의 migration 영역** 임을 baseline 측정 결과로 확정. G7 closure 의 진정 marker = canonical document 직렬화 형태 검증 (events/dataBinding 가 `x-composition` 단일 위치) — 본 work 의 closure marker grep gate 로 자동화.

**land 내용**:

- **`legacyExtensionRoundtrip.test.ts` G. closure marker section 신규** (4/4 PASS):
  - **E-1**: legacyToCanonical 결과의 모든 metadata.legacyProps 에 events/dataBinding 키 0건 (DFS 순회로 전수 검증)
  - **E-2**: events 정의 element → 해당 노드 `x-composition.events` 단일 위치에만 존재 (다른 위치 0건)
  - **E-3**: dataBinding 정의 element → 해당 노드 `x-composition.dataBinding` 단일 위치에만 존재
  - **E-4**: events/dataBinding 미정의 element → `x-composition` 자체 미노출
- **본 marker 의 의미**: canonical document schema 정합성 자동 검증. Phase 3 G4 canonical primary write 진입 시점에 events/dataBinding 의 SSOT 가 extension 임을 grep gate 로 무손실 보장.

**검증 evidence**:

- `pnpm type-check` 3/3 PASS (FULL TURBO)
- vitest `legacyExtensionRoundtrip.test.ts` **21/21 PASS** (cutover 17건 → closure 21건, +4 marker)
- adapter 영역 광역 회귀 0 검증: `pnpm vitest run src/adapters/canonical` **169/169 PASS** (11 file 모두 PASS, 165 → 169 +4)
- **본 work 회귀 0 ✅** — closure contract 검증만 추가, logic 변경 0

**G7 진척 marker**:

- ✅ transition first slice (§10.2.10)
- ✅ 본격 cutover (§10.2.11)
- ✅ **closure marker — canonical document 직렬화 형태 contract** (본 work, §10.2.12)
- ⏭️ G7 closure verification (consumer side) — `x-composition` 우선 read evidence (Preview adapter / Inspector / CanonicalNodeRenderer 등 hot path 검증, Phase 3 G4 prerequisite 일부)

**다음 sub-phase 권장**:

- **Phase 4 G5 P5-B `overrides`** (MED-HIGH, ~1-2d, design §9.7 reorder 권장): instance 시스템 cleanup, ADR-111 P3 영역 결합 위험 고려. 본 phase 진정 진척과 직교.
- **Phase 3 G4 진입** (HIGH, ~3-5d, write 경로 cutover): canonical primary write 활성화. 본 phase 의 baseline 측정 결과 11+ caller migration 영역 codify (Inspector mapping / history undo-redo / Events Panel / AI tool / factory). G7 closure marker grep gate 가 Phase 3 G4 land 시점에 자동 회귀 보장.

#### 10.2.13 G6-2 second slice land (2026-05-02) — history parity 자동 cover (canonicalDocumentSync 회로) + setup fail framing 재조정

**framing**: design §10.2.9 의 G6-2 second slice "canonicalDocumentSync.test.ts setup fail debug + history parity 회귀 codify" — baseline 측정 결과 `setup fail debug` 가 unbounded scope (memory 세션 인수인계 명시: "elements.ts:1935 dead useStore export + circular import 가능성") 로 확정. **framing 재조정**: setup fail debug 는 별 sub-phase 분리, history parity 회귀 codify 만 isolated vitest 패턴 (memory `feedback-vitest-mock-path-resolution.md` 재활용) 으로 land.

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G6-2 second slice = G6-2 first slice (Preview canonical 렌더 fallback) 의 sibling. history parity 가 G7 본격 cutover (§10.2.11) 의 자동 결과 — 별도 logic land 불필요, 검증 evidence 만 codify.
2. **schema 직교성**: ✅ history undo/redo (mutation forward/reverse) ⊥ G7 cutover schema (`x-composition` extension). 두 영역이 동일 변환 회로 통과 (legacyToCanonical) → schema 직교성 자동 보장.
3. **baseline framing reverse**: G7 본격 cutover prerequisite 충족, history parity 가 cutover 의 결과로 자동 cover. 의존 방향 정확.
4. **codex 3차 미루지 말 것**: LOW scope (~30분, vitest 6건 추가). 회귀 영역 0 (logic 변경 0, 검증 evidence 만).

**baseline 측정 — `canonicalDocumentSync.test.ts` setup fail 영역 분석**:

| 영역                                                                                | 진단                                                                                                                                                                                                                                                                                           | scope                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/builder/src/builder/stores/canonical/__tests__/canonicalDocumentSync.test.ts` | `import { useStore } from "../.."` → `stores/index.ts:55 createElementsSlice(set, get, store)` 호출 → `createElementsSlice is not a function`                                                                                                                                                  | unbounded (별 sub-phase)                       |
| `apps/builder/src/resolvers/canonical/__tests__/storeBridge.test.ts`                | 동일 setup fail (zustand init 영역)                                                                                                                                                                                                                                                            | unbounded (별 sub-phase)                       |
| `apps/builder/src/builder/stores/elements.ts:1935`                                  | `export const useStore = create<ElementsState>(createElementsSlice);` — module evaluation 시 즉시 store 생성, dead duplicate (production caller 0 — `selectCanonicalDocument` 만 사용). test caller 2 site (`itemsActions.test.ts` / `pagesLayoutInvalidation.test.ts`) 가 isolated store 의도 | dead duplicate hygiene + circular eval suspect |

**setup fail unbounded 사유**:

- elements.ts:1935 의 dead useStore 가 module evaluation 시 즉시 `create<T>(creator)` 호출 → vitest jsdom 환경에서 React/zustand internal state 미설정 시 fail 가능. 실제 throw 위치 추적 필요 (debug log 추가 / minimal repro).
- production code 영향 0 (caller 0건), test fixture 격리 의도 가능 — 무차별 제거 시 `itemsActions.test.ts` / `pagesLayoutInvalidation.test.ts` 회귀.
- 진정 fix scope = (a) lazy initialization Proxy 패턴, (b) test 2 file 의 useStore caller 를 stores/index.ts 로 migration, (c) circular import chain 정밀 추적 — 모두 별 sub-phase 영역.

→ **본 phase scope 외, 별 sub-phase (G6-2 third slice 또는 별 hygiene work) 에서 진정 진척**.

**land 내용** — `legacyExtensionRoundtrip.test.ts` F. history parity section (6/6 PASS):

- **F-1 forward mutation (events 추가)** — initial element (events 미정의) → mutation (events 추가) → legacyToCanonical 통과 후 `x-composition.events` 직렬화
- **F-2 reverse mutation (events 제거 = history.undo)** — withEvents element → undone (events undefined) → legacyToCanonical 통과 후 `x-composition` 미노출
- **F-3 re-mutation (events 재추가 = history.redo)** — undone → redone (events 재추가) → legacyToCanonical 통과 후 `x-composition.events` 재직렬화
- **F-4 dataBinding mutation forward/reverse 회로** — initial → withDb → undone (dataBinding undefined) 동일 cover
- **F-5 multi-element mutation (events + dataBinding 동시)** — 2 element 의 양 분리, metadata.legacyProps 미spread (G7 cutover 정합)
- **F-6 round-trip 보장 (forward → reverse → forward 동등)** — original → legacyToCanonical → exportLegacyDocument → events/dataBinding 무손실 복원

**isolated 검증 패턴 — vitest mock path resolution 함정 회피**:

- `canonicalDocumentSync.test.ts` 가 `useStore` import 시 `stores/index.ts` evaluation → `createElementsSlice is not a function` setup fail 영역 (unbounded debug, 별 sub-phase).
- 본 file (`legacyExtensionRoundtrip.test.ts`) 은 `legacyToCanonical` + `exportLegacyDocument` 만 import → store 무경유.
- 회로의 핵심 변환 단계 (`legacyToCanonical`) 단독 검증으로 history parity 자동 cover evidence 도달. memory 패턴 재활용.

**검증 evidence**:

- `pnpm type-check` 3/3 PASS (FULL TURBO)
- vitest `legacyExtensionRoundtrip.test.ts` **27/27 PASS** (closure 21 → history 27, +6 history parity)
- adapter 영역 광역 회귀 0 검증: `pnpm vitest run src/adapters/canonical` **175/175 PASS** (11 file 모두 PASS, 169 → 175 +6)
- **본 work 회귀 0 ✅** — logic 변경 0, 검증 evidence 만 추가

**G6-2 진척 marker**:

- ✅ G6-2 first slice — Preview canonical 렌더 fallback (§10.2.9, G6-1 정합)
- ✅ **G6-2 second slice — history parity 자동 cover** (본 work, §10.2.13)
- ⏭️ G6-2 third slice (예정) — `canonicalDocumentSync.test.ts` setup fail debug + 진정 store-level history granularity 검증 (별 sub-phase, unbounded scope 분리)
- ⏭️ Publish parity — scope 외 (canonical 미사용, 별 publish ADR 영역, §10.2.9 명시)

**framing 의문 명시 — design §10.2.9 추정 vs 실 measurement**:

design §10.2.9 명시 G6-2 second slice = `setup fail debug + history parity 회귀 codify` (LOW ~0.5d). 본 land 결과:

- **history parity 회귀 codify** = 본 work (~30분 LOW) — design 추정 정합.
- **setup fail debug** = unbounded scope (elements.ts:1935 dead useStore + circular import 가능성, test caller 격리 영향) — design 추정 LOW 미정합. 별 sub-phase 분리 결정.

본 framing 재조정으로 G6-2 closure 시점에 setup fail 진정 fix 가 prerequisite 인지 별 G6-2 third slice 로 분리할지 후속 결정. 현재는 isolated 검증 패턴으로 history parity 본질 cover 충족.

**다음 sub-phase 권장**:

- **G6-2 third slice** (MED unbounded debug, 별 work): `canonicalDocumentSync.test.ts` setup fail root cause 진단 + fix (lazy init Proxy / test caller migration / circular import chain 추적 중 1 선택). prerequisite 영역 명시 — G6-2 closure 시점에 별 sub-phase 진입 결정.
- **Phase 4 G5 P5-B `overrides`** (MED-HIGH ~1-2d, design §9.7 reorder, 본격 cleanup ADR-111 P3 영역 결합으로 partial 진척만 가능, §10.2.12 명시).
- **Phase 3 G4 진입** (HIGH ~3-5d, write 경로 cutover, §10.2.12 명시 11+ caller migration 영역 codified).

#### 10.2.14 G6-2 third slice debug attempt + framing 재정의 (2026-05-02) — 진정 unbounded scope 확정

**framing**: §10.2.13 명시 G6-2 third slice = `setup fail debug` (memory 세션 인수인계 명시 "elements.ts:1935 dead useStore export + circular import 가능성", design §10.2.9 추정 LOW ~0.5d). 본 세션 진정 fix 시도 결과 — **dead useStore 와 무관, transitive circular import chain 이 진정 root cause**. 진정 unbounded scope 확정.

**fork checkpoint 4 질문 lock-in**:

1. **base/응용 분류**: G6-2 third slice = setup fail 의 진정 fix work. base 영역 (vitest module loader + zustand init + transitive import chain) — 본 phase scope 외, 별 unbounded sub-phase 분리 정합.
2. **schema 직교성**: setup fail 영역 ⊥ canonical document schema (G7 cutover/closure 와 무관). vitest mock infrastructure 영역.
3. **baseline framing reverse**: §10.2.13 추정 LOW 와 진정 unbounded scope 의 framing 재정의. design §10.2.9 추정 시점에 root cause 정확 진단 미land — 본 §10.2.14 가 framing 재정의 docs.
4. **codex 3차 미루지 말 것**: docs only land (logic 변경 0). framing 재정의 의의 = 후속 phase 진입 시 unbounded debug 회피 신호 명시.

**debug attempt 진단 결과 (2026-05-02 본 세션)**:

| 시도                                                                  | 변경                                                                                                                                                                                                              | 결과                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) dead useStore 제거**                                            | `elements.ts:1935` `export const useStore = create<ElementsState>(createElementsSlice);` + 4 dead selector (`useCurrentPageElements` / `useElementById` / `useChildElements` / `useCurrentPageElementCount`) 제거 | `canonicalDocumentSync.test.ts` + `storeBridge.test.ts` 동일 setup fail 잔존 — error stack `stores/index.ts:55 createElementsSlice is not a function` 동일 |
| **(b) test caller inline create**                                     | `itemsActions.test.ts` / `pagesLayoutInvalidation.test.ts` 의 `useStore from elements` import 를 inline `const useStore = create<ElementsState>(createElementsSlice)` 로 변경                                     | 동일 setup fail 영역 — module evaluation 시점에 createElementsSlice undefined                                                                              |
| **(c) test caller lazy init (`let useStore` + `beforeEach` 안 init)** | (b) 의 module evaluation 시점 회피 시도                                                                                                                                                                           | 동일 setup fail — 즉 module evaluation 진입 자체가 fail (test 의 inline 사용과 무관)                                                                       |

**진정 root cause 추정**:

`stores/index.ts:55` 의 `createElementsSlice(set, get, store)` 호출 시 `createElementsSlice` 가 undefined → test 가 `from "../elements"` 만 import 해도 elements.ts evaluation chain 이 **transitively `stores/index.ts` 진입** → `stores/index.ts` 가 createElementsSlice 를 사용하려 시도 → elements.ts module 이 still loading 상태 → undefined.

elements.ts 의 import chain 후보 (transitive `stores/index.ts` 진입 가능성):

- `historyManager from "./history"` → history.ts → commandDataStore + historyIndexedDB
- `from "./utils/elementHelpers"` (fileExist 미확인 — actual file 추적 필요)
- `from "./utils/elementReorder"` → elementReorder.ts
- `from "./history/historyActions"` → historyActions.ts
- `from "../../utils/element/elementUtils"` → elementUtils.ts
- `from "../../services/api"` → api index → services chain
- `from "../panels/styles/utils/fillExternalIngress"` → panels chain (가장 의심 — UI panel 모듈은 stores 다수 import)

**진정 unbounded 사유**:

- vitest 환경의 module loader 가 swallow 한 throw 위치 추적 (debug log 추가 + minimal repro)
- circular cycle 의 정밀 시작점 + entry 모듈 식별
- production 환경에서는 동일 chain 정상 작동 — vitest jsdom/esbuild bundle 차이 진단
- fix 후 production 회귀 0 보장 위한 광역 회귀 검증

**본 §10.2.14 land = framing 재정의 docs only**:

- 본 세션 dead useStore 제거 + test caller migration 시도 모두 revert (production 회귀 위험 회피)
- design §10.2.13 의 third slice 권장 명시 유지 + 진정 unbounded scope 확정 명시
- G6-2 closure 시점 본격 fix 진입 결정 — 별 sub-phase 또는 별 hygiene work 으로 분리

**G6-2 진척 marker (재정의)**:

- ✅ G6-2 first slice — Preview canonical 렌더 fallback (§10.2.9, G6-1 정합)
- ✅ G6-2 second slice — history parity 자동 cover (§10.2.13, isolated vitest 패턴)
- ⏭️ G6-2 third slice — setup fail debug **진정 unbounded scope 확정** (§10.2.14, 별 sub-phase 분리). G6-2 closure 시점 본격 fix 진입 결정.
- ⏭️ Publish parity — scope 외 (§10.2.9 명시).

**framing 의문 명시 — G6-2 closure 시점 결정 영역**:

본 §10.2.14 framing 재정의 후 G6-2 closure (Preview parity ✅ + history parity ✅ + setup fail third slice 진정 fix) 의 third slice 진정 fix 가 closure prerequisite 인지, 또는 closure 시점에 별 hygiene phase 로 분리할지 후속 결정 영역.

- **옵션 X**: G6-2 closure 충족 = first + second slice + framing 재정의 docs (본 §10.2.14). third slice 는 별 phase, G6-2 closure 후 진척.
- **옵션 Y**: G6-2 closure prerequisite = third slice 진정 fix 필수. 별 unbounded sub-phase 진입 후 G6-2 closure.

본 phase 시점 결정 미land — 후속 phase 진입 시점에 결정. 현재 marker = G6-2 first/second slice land + third slice framing 재정의.

**다음 sub-phase 권장 (재확인)**:

- **Phase 4 G5 P5-B `overrides`** (MED-HIGH ~1-2d, partial only, ADR-111 P3 회피 영역만, §10.2.12 명시). G6-2 closure 와 직교.
- **Phase 3 G4 진입** (HIGH ~3-5d, write 경로 cutover, 11+ caller migration codified, §10.2.12 명시).
- **G6-2 third slice 진정 fix** (별 unbounded debug sub-phase): vitest mock infrastructure + transitive circular import chain 정밀 추적 + production 회귀 0 검증. G6-2 closure 시점 결정.

### §10.2.15 — Phase 5 G6-2 third slice closure ✅ (DI pattern, 2026-05-02)

**framing 결과**: §10.2.14 옵션 Y 채택 (third slice 진정 fix = closure prerequisite). 직전 framing drift 검증에서 발견한 4 drift 중 #4 (G6-2 third slice unbounded → HC #8 영구 보류 위험) 진정 해소.

**진정 root cause 확정 (b7d75f3e4 + §10.2.14 추정 정정)**:

`apps/builder/src/adapters/canonical/canonicalMutations.ts` wrapper API 의 module evaluation timing 이슈가 진정 origin. wrapper body 가 `useStore` 직접 import + 호출 →

```
elements.ts → canonicalMutations.ts → builder/stores/index.ts → elements.ts (circular)
```

→ vitest setup phase 에서 `createElementsSlice` undefined 평가. b7d75f3e4 + §10.2.14 의 "transitive circular import chain" 추정은 정확했으나 origin 파일 (panels chain 으로 의심) 미특정 — 본 §10.2.15 가 정확한 origin (`canonicalMutations.ts` wrapper API 자체) 확정.

**fix 옵션 결정**:

- **옵션 (a) DI pattern (callback registration) 채택** ← 본 §10.2.15 land
- 옵션 (b) `elementsApi` 직접 호출 (wrapper 우회): G4 grep gate baseline 0 회귀 (caller wrapper 우회 시 baseline 다시 증가, D18=A 단일 SSOT 격리 위반) 으로 기각

**land 내용 (3 file, +94 / -6 lines, commit `89f7f3ff4`)**:

- `canonicalMutations.ts`:
  - `useStore` import 제거 (circular chain 차단)
  - `CanonicalMutationStoreActions` 타입 + `registerCanonicalMutationStoreActions(actions)` + `resetCanonicalMutationStoreActions()` + 내부 `getActions()` helper 추가
  - 5 wrapper 중 `mergeElementsCanonicalPrimary` / `setElementsCanonicalPrimary` 2종이 `getActions()` 경유 (`useStore` 의존 wrapper)
  - `createElementCanonicalPrimary` / `updateElementCanonicalPrimary` / `createMultipleElementsCanonicalPrimary` 3종은 `elementsApi` 의존 (변경 0)
- `BuilderCore.tsx`:
  - mount useEffect 에서 `registerCanonicalMutationStoreActions({ mergeElements: useStore.getState().mergeElements, setElements: useStore.getState().setElements })` 1회 호출
  - ADR-116 Phase 2 G3 sync useEffect 직전 위치, deps `[]`
- ADR 본문 (`docs/adr/completed/116-canonical-document-ssot-transition.md`): Status line + 진행 로그 entry (검증 evidence 포함)

**외부 영향**:

- wrapper 외부 시그니처 변경 0 — caller 16 site 무수정
- logic 변경 0 (DI 만 적용)
- production runtime 동작 동일

**검증 evidence**:

- vitest setup fail 영역 (`itemsActions.test.ts` + `pagesLayoutInvalidation.test.ts`): 2 file / 10 tests PASS ✅ (이전 setup phase 에서 fail)
- canonical 광역 (`stores/canonical/__tests__/`): 4 file / 99 tests PASS ✅
- adapter canonical 광역 (`adapters/canonical/__tests__/`): 11 file / 175 tests PASS ✅
- G4 grep gate (`exportSsotGrepGate.test.ts`): 1 file / 2 tests PASS ✅ (baseline 0 유지, D18=A 단일 SSOT 격리 보존)
- type-check (`pnpm -F @composition/builder exec tsc --noEmit --pretty false`): exit 0 PASS ✅

**G6-2 진척 marker (closure)**:

- ✅ G6-2 first slice — Preview canonical 렌더 fallback (§10.2.9, G6-1 정합)
- ✅ G6-2 second slice — history parity 자동 cover (§10.2.13, isolated vitest 패턴)
- ✅ G6-2 third slice — DI pattern circular import 차단 (§10.2.15)
- ⏭️ Publish parity — scope 외 (§10.2.9 명시)

**G6-2 closure 도달 ✅** — G6 Runtime Parity 통과 조건 (Skia/Preview/Publish/History/Undo/Redo 회귀 0) 의 history 영역 회귀 검증 vitest 정상화. **G4 진정 reverse (drift #1) 진입 prerequisite 충족**.

**다음 진입점 (직전 framing drift 분석 정합)**:

- **Phase 3 G4 wrapper 내부 진정 reverse** (HIGH ~3-5d, drift #1 본질 해소): canonical store mutation 우선 + legacy mirror 자동. ADR-116 본질 목표 (canonical primary write) 달성. caller 16 site 무수정 (DI pattern 으로 wrapper 외부 시그니처 보존).
- **Phase 4 G5 P5-B `overrides`** (MED-HIGH ~1-2d, ADR-111 P3 회피 영역만, drift #2 영역 결합 위험).

### §10.2.16 — Projection removal slices 15~19 (2026-05-02)

**목표**: direct cutover 이후 hot/caller path 의 `selectCanonicalDocument()` / `legacyToCanonical()` full projection rebuild 를 제거한다. legacy payload 는 adapter/import/export mirror 경계로 제한한다.

**land 요약**:

- Preview runtime: `UPDATE_CANONICAL_DOCUMENT` payload 를 직접 저장하고 `App.tsx` 에서 수신된 `CompositionDocument` 를 resolve. Preview 렌더 경로 `legacyToCanonical()` 0.
- Canvas/Builder panels: drag/drop helper, BuilderCanvas layout/frame memo, FramesTab, PageLayoutSelector, ComponentsPanel visible path 는 active canonical document / canonical frame surface 사용.
- Builder/store actions: BuilderCore refresh/theme/publish, `usePageManager.initializeProject`, `elementCreation` caller-level `selectCanonicalDocument()` 제거. legacy `layoutActions` store action 본체는 후속 removal slice 에서 삭제.
- Sync/store bridge: `canonicalDocumentSync` 는 project lifecycle marker 로 축소. `storeBridge.selectResolvedTree` 는 `CompositionDocument` 직접 resolve API 로 전환.
- Adapter boundary: `pageFrameBinding`, `frameLayoutCascade` 는 active canonical document children 을 직접 upsert/remove 하고 legacy page/elements 는 mirror persistence/export 로만 생성.
- Wrapper boundary: `canonicalMutations` 의 `mergeElementsCanonicalPrimary` / `setElementsCanonicalPrimary` 는 `legacyToCanonical()` rebuild 없이 native shell/upsert 로 canonical document 를 갱신한다. layout Slot 은 `legacy-slot-hoisted` frame 으로 변환하고 page ref slot fill 은 referenced layout frame 의 slot path 를 찾아 `descendants[slotPath].children` 에 삽입한다.
- Store selector boundary: `elements.ts` 의 deprecated `selectCanonicalDocument()` selector 를 삭제했다. legacy store snapshot → canonical projection entrypoint 는 production source 에 남기지 않는다.
- Export boundary: `exportLegacyDocument()` 는 `RefNode.descendants[].children` 까지 DFS 순회해 page frame slot fill legacy mirror 누락을 방지한다. G6-3 first slice 로 `slot_name` / `componentRole` / `masterId` / legacy `overrides` / legacy `descendants` / `componentName` mirror payload 도 export boundary 에서 top-level 로 복원한다.
- Resolver boundary: `resolveCanonicalDocument()` 는 RefNode resolve 결과의 top-level `type` 을 master type 으로 명시 고정한다. ref identity 는 `id` / `_resolvedFrom` 으로 보존하고 렌더 타입은 master 기준으로 열린다.
- Gate boundary: `exportSsotGrepGate` 는 ADR-112 dev-only editing semantics fixture 의 raw visual marker write 만 명시 allowlist 로 분리한다. runtime/persistence write gate baseline 0은 유지.

**최신 grep 상태**:

- production `selectCanonicalDocument()` 호출/정의: source 0건. 테스트와 문서/comment 경계만 잔존.
- runtime `legacyToCanonical()` 호출: source 0건. `apps/builder/src/adapters/canonical/index.ts` adapter 정의와 themes/variables/export 문서 comment 경계만 잔존. `canonicalMutations` wrapper 내부 호출 0.
- production `useLayoutsStore` 호출/정의: legacy store removal 후 source 0건. 남은 grep hit 는 static negative assertion 테스트뿐이다.

**검증**:

- targeted vitest 7 files / 62 tests PASS (`canonicalDocumentSync`, `usePageManager.canonical`, `BuilderCore.static`, `storeBridge`, `pageFrameBinding`, `PageLayoutSelector.static`, `layoutActions`).
- targeted vitest 13 files / 141 tests PASS (`canonicalMutations`, `pageFrameBinding`, `persistenceWriteThroughStub`, `legacyExtensionRoundtrip`, `layoutActions`, `elementCreationCanonical`, `usePageManager.canonical`, `useIframeMessenger.canonical`, `BuilderCore.static`, `storeBridge`, `FramesTab`, `PageLayoutSelector.static`).
- adapters/canonical 전체 18 files / 185 tests PASS.
- builder `tsc --noEmit` PASS + projection selector removal targeted vitest 17 files / 145 tests PASS.
- canonical adapter/resolver/store targeted vitest 27 files / 358 tests PASS.
- editing semantics / Component semantics UI / instance detach targeted vitest 3 files / 50 tests PASS.
- page frame binding / frame mirror / PageLayoutSelector / FramesTab targeted vitest 5 files / 22 tests PASS.
- canonical resolver/cache/storeBridge targeted vitest 3 files / 65 tests PASS.
- canonical import registry/resolver/cache/storeBridge targeted vitest 4 files / 72 tests PASS.
- legacy layout store removal targeted vitest 11 files / 51 tests PASS + `pnpm run codex:preflight` PASS.

### 10.2.17 G6-3 Slot/Ref/Descendants parity first slice (2026-05-02)

**framing**: G6-3 전체는 ADR-111 P3 frame canvas authoring + ADR-113 P5 instance schema cleanup 과 결합된 HIGH scope 다. 본 slice 는 projection 제거 직후 새 native mutation/export path 에서 회귀 위험이 높은 Slot/Ref/Descendants compatibility evidence 만 먼저 닫는다.

**land 내용**:

- Slot append semantics: 같은 page ref slot 에 반복 fill 되는 element 가 referenced frame slot path (`frame-body/content`) 아래 order 를 유지한다.
- Slot clear semantics: `setElementsCanonicalPrimary()` full replace 에서 누락된 slot fill 은 page ref `descendants` 에 남지 않는다.
- Ref/Descendants mirror export: canonical primary native path 가 만든 master/ref/descendants 구조를 legacy mirror 로 export 할 때 `componentRole` / `masterId` / legacy `overrides` / legacy `descendants` / `componentName` 을 top-level field 로 복원한다.
- Resolver ref parity: RefNode resolve 결과의 top-level `type` 을 master type 으로 고정해 resolved tree consumer 가 `type:"ref"` 를 렌더 타입으로 보지 않는다.

**검증**:

- `canonicalMutations.test.ts` 9 tests PASS.
- `persistenceWriteThroughStub.test.ts` mirror compatibility field round-trip 추가.
- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__ src/resolvers/canonical/__tests__ src/builder/stores/canonical/__tests__` — 27 files / 358 tests PASS.

### 10.2.18 G6-3 Ref navigation parity second slice (2026-05-02)

**framing**: G6-3 Ref parity 는 detach materialization 뿐 아니라 origin ↔ instance navigation 이 같은 reference alias contract 를 써야 닫힌다. 본 slice 는 Properties Component section 의 low-risk navigation 경계를 canonical reference helper 와 맞춘다.

**land 내용**:

- `ComponentSemanticsSection` 의 `Go to component` origin lookup 을 local id/customId/componentName 비교에서 `resolveReference()` 로 전환했다.
- `getEditingSemanticsImpactInstanceIds()` 는 origin 의 canonical `name`, `metadata.customId`, `metadata.componentName` alias 를 포함해 canonical ref instance 를 수집한다.
- UI 회귀 fixture: canonical ref 가 metadata `componentName` alias 로 origin page 에 이동하고, origin 의 metadata alias 로 매칭되는 canonical refs 를 `Select instances` 에서 multi-select 한다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/builder/utils/editingSemantics.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/stores/utils/__tests__/instanceActions.test.ts` — 3 files / 50 tests PASS.

### 10.2.19 G6-3 Frame connection parity third slice (2026-05-02)

**framing**: G6-3 Frame parity 는 page -> reusable frame 연결이 UI 선택값과 canonical `RefNode.ref` 를 혼동하지 않아야 닫힌다. projection 제거 후 native canonical frame 은 `metadata.layoutId` 가 없을 수 있으므로, `layout-${frameId}` 를 무조건 생성하는 경로를 막는다.

**land 내용**:

- `PageLayoutSelector` 와 `FramesTab` 의 canonical reusable frame option id 를 `getReusableFrameMirrorId()` 로 정규화했다. legacy-prefixed `layout-<id>` frame 은 UI/mirror id 로, native canonical frame 은 실제 id 로 노출된다.
- `pageFrameBinding` 은 active canonical document 의 reusable `FrameNode` 를 `id` / mirror id / `metadata.layoutId` / `name` / metadata `customId` / `componentName` alias 로 찾고, 실제 `FrameNode.id` 를 page `RefNode.ref` 로 기록한다.
- fallback 은 기존 legacy bridge 와 동일하게 `layout-<frameId>` ref 를 유지하되, 이미 `layout-` prefix 가 있는 입력은 중복 prefix 를 붙이지 않는다.
- 회귀 fixture: native frame binding 이 `ref: "frame-native"` 를 유지하고, mirror id `"frame-2"` 가 canonical id `"layout-frame-2"` 로 매핑된다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx` — 5 files / 22 tests PASS.

### 10.2.20 G6-4 Imports resolver parity first slice (2026-05-02)

**framing**: G6-4 는 external `.pen` fetch/cache/resolver 전체라서 바로 네트워크 fetch/UI 까지 열지 않는다. 첫 slice 는 core resolver 가 이미 loaded 된 import document 를 `<importKey>:<nodeId>` ref 로 소비하고, cache stale hit 를 막는 동기 경계를 닫는다.

**land 내용**:

- `packages/shared/src/types/canonical-resolver.types.ts` 에 `ImportResolverContext` 를 추가하고 `ResolveFn` 의 optional third parameter 로 노출했다.
- `resolveCanonicalDocument(doc, cache, imports)` 는 host `CompositionDocument.imports` 의 source map 을 확인한 뒤, `imports.resolveImportDocument(importKey, source)` 로 loaded import document 를 동기 조회한다.
- local reusable node lookup 을 우선하고, local miss 시 `<importKey>:<nodeId>` ref 를 imported document 의 reusable node id/name/metadata alias 로 resolve 한다.
- imported master 는 resolved metadata 에 `importedFrom`, `importKey`, `importNodeId`, `importSource` 를 보존한다.
- resolver cache key 는 host document version + sorted imports source + loaded import document version fingerprint 를 포함한다. import document version 변경 시 동일 ref node id 여도 stale resolved subtree cache hit 가 발생하지 않는다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/cache.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 3 files / 65 tests PASS.

### 10.2.21 G6-4 Imports prefetch/cache registry second slice (2026-05-02)

**framing**: 첫 slice 가 resolver 의 동기 import context 를 열었으므로, 두 번째 slice 는 runtime 이 외부 source 를 미리 로드해 그 context 를 채울 수 있는 registry 경계를 닫는다. UI/URL 정책과 IndexedDB fallback 은 아직 열지 않는다.

**land 내용**:

- `apps/builder/src/resolvers/canonical/importRegistry.ts` 신규:
  - `createCanonicalImportRegistry(fetcher)` — loaded document / inflight request / failure status 를 관리한다.
  - `prefetchImport(importKey, source)` — 동일 importKey/source concurrent request 를 1회 fetch 로 dedupe 한다.
  - `prefetchDocumentImports(doc)` — host `CompositionDocument.imports` 를 순회해 성공/실패 summary 를 반환한다. 일부 실패가 전체 prefetch 를 throw 하지 않는다.
  - `resolveImportDocument(importKey, source)` — resolver 가 render-time 에 동기 조회할 loaded document 를 반환한다.
  - `getSharedImportRegistry()` / `resetSharedImportRegistry()` — resolver cache 와 같은 singleton/test isolation 패턴.
- `fetchCompositionDocumentFromSource()` default fetcher 는 source JSON 이 `CompositionDocument` shape (`version` string + `children` array) 인지 검증한다. 실제 URL allowlist/CORS/IndexedDB fallback 정책은 후속 runtime adapter 영역으로 남긴다.
- `storeBridge.selectResolvedTree()` 는 기본 import context 로 shared registry 를 사용한다. `prefetchResolvedTreeImports(doc, registry?)` helper 로 fetch/prefetch 를 render-time resolve 와 분리했다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/cache.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 72 tests PASS.

### 10.2.22 G6-4 Preview import runtime third slice (2026-05-02)

**framing**: registry 가 존재해도 Preview render path 가 registry context 를 넘기지 않으면 external ref 는 계속 broken ref 로 남는다. 본 slice 는 수신된 canonical document 를 Preview runtime 에서 prefetch 하고, render-time resolve 가 같은 registry 를 소비하도록 연결한다.

**land 내용**:

- `apps/builder/src/preview/App.tsx` 는 module-level shared canonical import registry 를 사용한다.
- `canonicalDocument` 수신 시 `prefetchDocumentImports(canonicalDocument)` 를 호출하고, import load 성공 후 version state 를 갱신해 같은 document 를 다시 resolve 하도록 한다.
- dev logging resolve 와 canonical render resolve 는 모두 `resolveCanonicalDocument(canonicalDocument, undefined, canonicalImportRegistry)` 로 registry context 를 전달한다.
- `previewFrameMirror.static.test.ts` 는 Preview App 이 shared import registry prefetch 와 registry-context resolve 2곳을 유지하는지 검사한다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 57 tests PASS.

### 10.2.23 G6-4 Import source URL policy fourth slice (2026-05-02)

**framing**: Preview runtime 이 import prefetch 를 시작했으므로, default fetcher 는 `CompositionDocument.imports` 의 source 문자열을 그대로 `fetch()` 에 넘기면 안 된다. 본 slice 는 URL/path source 를 같은 origin URL로 정규화하고, 위험한 scheme/cross-origin source 를 default runtime 경계에서 닫는다.

**land 내용**:

- `resolveCompositionImportSource(source, baseUrl?)` 를 추가했다.
- relative (`./kit.pen`), root (`/kits/basic.pen`), absolute same-origin URL 은 canonical absolute URL 로 정규화한다.
- empty source, `javascript:`/`data:` 등 non-http(s) protocol, cross-origin URL 은 fetch 전에 reject 한다.
- `fetchCompositionDocumentFromSource()` 는 정규화된 URL만 fetch 하고, 기존 JSON `CompositionDocument` shape 검증을 유지한다.
- custom backend 가 필요한 테스트/후속 adapter 는 기존 `ImportDocumentFetcher` DI 경계를 그대로 사용한다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 60 tests PASS.

### 10.2.24 G6-4 Import namespace guard fifth slice (2026-05-02)

**framing**: source URL policy 가 fetch 대상 URL을 제한해도, `CompositionDocument.imports` 의 key namespace 자체가 열려 있으면 `ref: "<importKey>:<nodeId>"` 해석이 ambiguous 해지고 reserved object key 가 registry 경계에 들어올 수 있다. 본 slice 는 import namespace syntax 를 resolver/registry 공통 helper 로 고정한다.

**land 내용**:

- `importNamespace.ts` 를 추가해 `isValidCompositionImportKey`, `assertCompositionImportKey`, `parseCompositionImportReference` 를 한 곳에 둔다.
- `importKey` 는 `/^[A-Za-z][A-Za-z0-9_-]*$/` 를 통과해야 하며 `__proto__` / `constructor` / `prototype` 은 reserved key 로 금지한다.
- registry 는 invalid import key 를 fetcher 호출 전에 failed status 로 기록하고, valid import 만 fetch/prefetch 한다.
- resolver 는 invalid namespace ref 또는 nested namespace 형태 (`bad:key:node`) 를 imported ref 로 해석하지 않는다. 이 경우 기존 broken ref 안전망으로 남긴다.
- shared `CompositionDocument` 타입 주석에 importKey namespace 규칙을 반영했다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 62 tests PASS.

### 10.2.25 G6-4 Import payload adapter sixth slice (2026-05-02)

**framing**: URL/source/namespace guard 만으로는 external `.pen` source 가 fetch 된 뒤 resolver 에 들어갈 payload shape 가 닫히지 않는다. 본 slice 는 same-origin JSON 응답을 canonical `CompositionDocument` 또는 Pencil-style node tree 로 판별하고, resolver 에는 항상 canonical document 만 전달되도록 adapter boundary 를 둔다.

**land 내용**:

- `importPayloadAdapter.ts` 신규:
  - `normalizeCompositionImportPayload(payload, source)` — canonical document payload 는 그대로 통과.
  - Pencil-style document (`{ children: [...] }`) 또는 single node payload 는 `CompositionDocument` 로 변환한다.
  - top-level Pencil nodes 는 external import master 로 참조 가능해야 하므로 `reusable: true` 로 승격한다.
  - primitive mapping: `rectangle`/geometry/`frame`/`group` -> `frame`, `text` -> `Text`, `icon_font` -> `Icon`, `note`/`prompt`/`context` -> `Text`.
  - 원본 primitive type 은 `metadata.type` / `metadata.pencilType` 에 보존하고, canonical field 외 나머지 primitive payload 는 `props` 에 둔다.
- `fetchCompositionDocumentFromSource()` 는 URL policy 통과 후 JSON 을 normalize 하고, registry 는 normalize 된 canonical document 만 loaded import document 로 보관한다.
- shared `CompositionDocument.imports` 주석에서 P0 stub 문구를 제거하고 ADR-116 G6-4 runtime boundary 로 갱신했다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 64 tests PASS.

### 10.2.26 G6-4 Import registry stale pruning seventh slice (2026-05-02)

**framing**: Preview runtime 이 canonical document update 때마다 import prefetch 를 수행하므로, import map 변경/삭제 후 이전 loaded/pending/failed entry 가 shared registry 에 남으면 stale memory 와 late fetch writeback 이 생길 수 있다. 본 slice 는 active document import map 기준으로 registry entry 를 retain 하고, pruned in-flight request 가 늦게 resolve 되어도 loaded map 에 재삽입하지 못하게 한다.

**land 내용**:

- `CanonicalImportRegistry.retainDocumentImports(doc)` 를 추가했다.
- `prefetchDocumentImports(doc)` 는 prefetch 전에 현재 `doc.imports` 기준으로 loaded / pending / failed / request token map 을 prune 한다.
- `prefetchImport()` 는 request token 을 부여하고, fulfill/catch/finally 단계에서 token 이 여전히 current 인 경우에만 loaded/failure/pending map 을 갱신한다.
- import map 이 `kit: "./old.pen"` 에서 `kit: "./new.pen"` 로 바뀌면 old entry 는 idle 로 돌아가고, 삭제된 pending import 가 늦게 resolve 되어도 registry 에 저장되지 않는다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 66 tests PASS.

### 10.2.27 G6-4 Imports parity completion sweep (2026-05-02)

**framing**: G6-4 는 DesignKit copy pipeline 이 아니라 canonical document import runtime 의 fetch/cache/resolver parity gate 다. 본 sweep 은 새 runtime surface 를 늘리지 않고, 이미 land 된 G6-4 seven slices 를 completion contract 로 묶어 future regression 을 막는다.

**completion 기준**:

| 기준                               | evidence                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| loaded import resolver consumption | resolver 가 `ImportResolverContext` 와 `parseCompositionImportReference(refId)` 로 `<importKey>:<nodeId>` 를 resolve              |
| cache stale hit 방지               | resolver cache document version slot 에 host import map/source 와 loaded import document version fingerprint 포함                 |
| async prefetch/cache registry      | `CanonicalImportRegistry` 가 loaded/loading/failed/idle status, inflight dedupe, shared registry 를 제공                          |
| Preview runtime wiring             | Preview 가 수신 `CompositionDocument.imports` 를 prefetch 하고 dev/render resolve 모두 동일 registry context 사용                 |
| source/namespace/payload policy    | same-origin URL policy, importKey namespace guard, canonical/Pencil payload adapter 를 registry boundary 에 적용                  |
| stale registry pruning             | `prefetchDocumentImports(doc)` 가 현재 import map 밖 loaded/pending/failed/request token 을 prune                                 |
| static completion gate             | `importRegistry.test.ts` 가 URL policy, payload normalize, stale token guard, resolver parse, Preview context wiring 을 동시 확인 |

**land 내용**:

- `importRegistry.test.ts` 에 `keeps the ADR-116 G6-4 import runtime completion contract wired` 정적 테스트를 추가했다.
- G6-4 completion 은 `imports` fetch/cache/resolver runtime parity 를 닫는 기준이다. DesignKit copy/import UX 는 ADR-115 로 무효화됐고, Pencil schema-equivalent export/import product flow 는 ADR-111 G5 로 분리한다.
- README / ADR body / CHANGELOG 의 잔존 범위에서 G6-4 parity 확장 문구를 제거했다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/preview/previewFrameMirror.static.test.ts src/resolvers/canonical/__tests__/importRegistry.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts` — 4 files / 67 tests PASS.

### 10.2.28 G6-3 Slot/Ref/Descendants/Frame parity completion sweep (2026-05-02)

**framing**: G6-3 는 ADR-111/113 legacy field quarantine 자체가 아니라, canonical primary runtime 에서 slot/ref/descendants/frame parity 가 유지되는지를 닫는 gate 다. 본 sweep 은 추가 runtime behavior 를 만들지 않고, 이미 land 된 G6-3 three slices 를 completion contract 로 묶는다. `layout_id` / `slot_name` / `componentRole` / `masterId` / `overrides` / legacy `descendants` field quarantine 은 별도 잔여 cleanup 으로 유지한다.

**completion 기준**:

| 기준                              | evidence                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| native slot descendants mutation  | `canonicalMutations` 가 page ref slot fill 을 `descendants[slotPath].children` 에 upsert 하고 remove 도 지원          |
| ref mirror export                 | `exportLegacyDocument()` 가 `RefNode.descendants[].children` DFS 와 component mirror payload reverse 를 유지          |
| resolver ref parity               | `resolveCanonicalDocument()` 가 resolved ref 의 top-level `type` 을 master type 으로 고정하고 `_resolvedFrom` 을 주입 |
| origin/instance navigation parity | Component section 이 `resolveReference()` 와 `getEditingSemanticsImpactInstanceIds()` 로 alias 기반 탐색              |
| frame binding id parity           | `pageFrameBinding` / `PageLayoutSelector` / `FramesTab` 이 `getReusableFrameMirrorId()` contract 를 공유              |
| static completion gate            | `g6ParityCompletion.static.test.ts` 가 mutation/export/resolver/navigation/frame binding wiring 을 동시 확인          |

**land 내용**:

- `g6ParityCompletion.static.test.ts` 를 추가했다.
- ADR body / README / CHANGELOG 의 잔존 범위에서 G6-3 parity 확장 문구를 제거하고, 잔여를 ADR-111/113 legacy field quarantine 으로 좁혔다.
- 본 completion 은 G6-3 runtime parity closure 이며, ADR-111/113 의 field quarantine closure 를 대체하지 않는다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/g6ParityCompletion.static.test.ts src/adapters/canonical/__tests__/canonicalMutations.test.ts src/adapters/canonical/__tests__/pageFrameBinding.test.ts src/adapters/canonical/__tests__/frameMirror.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/utils/editingSemantics.test.ts src/resolvers/canonical/__tests__/resolver.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts` — 9 files / 74 tests PASS.

### 10.2.29 ADR-111/116 legacy layout store removal (2026-05-02)

**framing**: projection 제거의 root cause 는 visible/caller path 전환만으로는 닫히지 않는다. `useLayoutsStore` / `layoutActions` 가 남아 있으면 frame CRUD/selection 의 SSOT 가 다시 legacy layouts store 로 돌아갈 수 있으므로, direct cutover 전제에 맞춰 dead store 본체를 제거한다.

**land 내용**:

- 신규 `canonicalFrameStore` 를 reusable frame list/selection surface 로 추가했다. list 는 active `CompositionDocument.children` 의 reusable `FrameNode` 에서 `Layout` compatible surface 를 derive 하고, selection 은 별도 canonical frame selection store 로만 보관한다.
- `frameActions` 는 더 이상 legacy layout action 을 wrapper 하지 않는다. create/update/delete/select 는 canonical document 를 직접 upsert/remove/update 하고, current DB `layouts` row 는 persistence mirror 로만 insert/update/delete 한다.
- 초기 hydrate 는 DB `layouts` mirror snapshot 을 `seedCanonicalReusableFrameLayouts()` 로 canonical reusable frame shell 에 먼저 seed 한 뒤 `setElementsCanonicalPrimary()` 로 elements 를 upsert 한다. 이 seed 는 legacy layout store 가 아니라 active `CompositionDocument` shell metadata 갱신이다.
- `FramesTab`, `PageLayoutSelector`, `PageParentSelector`, `LayoutSlugEditor`, `AddPageDialog`, `ComponentsPanel`, `BuilderCanvas`, `BuilderCore`, `useIframeMessenger`, `usePageManager`, `stores/index` 는 `stores/layouts` import 를 제거했다.
- `apps/builder/src/builder/stores/layouts.ts`, `apps/builder/src/builder/stores/utils/layoutActions.ts`, `layoutActions.test.ts` 를 삭제했다. `layout.types.ts` 의 dead Layout store types 도 제거했다.

**grep 상태**:

- `rg -n "useLayoutsStore|from ['\\\"].*stores/layouts|from ['\\\"].*/layouts['\\\"]|useLayouts\\(" apps/builder/src --glob "*.ts" --glob "*.tsx"` 결과는 static negative assertion 테스트 3건뿐이다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/builder/stores/canonical/__tests__/canonicalFrameStore.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/stores/utils/__tests__/selectReusableFrameContext.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/main/BuilderCore.static.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts src/builder/panels/nodes/FramesTab/FramesTab.static.test.ts src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.static.test.ts` — 11 files / 51 tests PASS.
- `pnpm run codex:preflight` — PASS.

### 10.2.30 ADR-113/116 legacy field quarantine helper boundary cleanup (2026-05-02)

**framing**: strict runtime field access 0만으로는 충분하지 않다. read-through helper 가 `unified.types.ts` 같은 shared type surface 에 남아 있으면 legacy component marker read 가 다시 non-adapter 경계로 새어 나갈 수 있으므로, helper 자체도 adapter boundary 로 이동한다.

**land 내용**:

- `isMasterElement` / `isInstanceElement` / `getInstanceMasterRef` 를 `unified.types.ts` 에서 제거했다.
- 기존 소비자는 `componentSemanticsMirror` 의 `isComponentOriginMirrorElement` / `isComponentInstanceMirrorElement` / `getComponentMasterReference` 를 사용한다.
- `MasterChangeEvent` / `DetachResult.previousState` 의 legacy-style field 명칭을 `originId` / `overrideProps` / `descendantPatches` 로 교체했다.
- canonical resolver fingerprint parameter 명칭을 `descendantOverrides` 로 전환해 일반 변수명 `overrides` 가 legacy field grep bucket 에 섞이지 않게 했다.
- `g5LegacyFieldGrepGate.test.ts` 는 strict non-adapter field-access 0과 unified types helper 재도입 금지를 함께 검증한다.

**grep 상태**:

- `rg -n "\\.(layout_id|slot_name|componentRole|masterId|overrides)\\b|\\b(layout_id|slot_name|componentRole|masterId|overrides)\\s*:" apps/builder/src apps/publish/src packages/shared/src -g "*.ts" -g "*.tsx" -g "!**/__tests__/**" -g "!*.test.ts" -g "!*.test.tsx" -g "!apps/builder/src/adapters/**" -g "!apps/builder/src/lib/db/migration*.ts"` 결과 0건.
- `rg -n "from .*types/builder/unified.types.*isMasterElement|from .*types/builder/unified.types.*isInstanceElement|from .*types/builder/unified.types.*getInstanceMasterRef|export function isMasterElement|export function isInstanceElement|export function getInstanceMasterRef" apps/builder/src -g "*.ts" -g "*.tsx"` 결과는 adapter helper 정의와 gate assertion 뿐이다.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/resolvers/canonical/__tests__/cache.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/utils/multiElementCopy.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/workspace/canvas/sprites/useResolvedElement.test.ts src/builder/workspace/canvas/skia/StoreRenderBridge.test.ts` — 5 files / 58 tests PASS.
- `pnpm run codex:typecheck` — PASS.

### 10.2.31 ADR-113/116 component mirror type schema / fixture cleanup (2026-05-02)

**framing**: strict runtime access 0 이후에도 `Element` / shared `Element` type schema 에 `componentRole` / `masterId` / legacy `overrides` 선언이 남으면 새 fixture 와 caller 가 legacy payload 를 정상 schema 로 오인한다. schema 표면은 canonical field 만 유지하고, legacy component mirror payload 는 adapter boundary 타입으로만 표현한다.

**land 내용**:

- `apps/builder/src/types/builder/unified.types.ts` 와 `packages/shared/src/types/element.types.ts` 에서 `componentRole` / `masterId` / legacy `overrides` field 선언을 제거했다.
- `apps/builder/src/adapters/canonical/legacyElementFields.ts` 에 `LegacyElementMirrorFields` / `ElementWithLegacyMirror` 를 추가해 adapter boundary 가 legacy mirror payload 를 명시적으로 소유한다.
- `componentSemanticsMirror` 에 `withComponentOriginMirror()` / `withComponentInstanceMirror()` fixture helper 를 추가했다.
- `editingSemantics`, origin-impact, instance lifecycle, canvas context menu, properties Component semantics, LayerTree row context menu non-adapter tests 는 raw `componentRole` / `masterId` fixture literal 대신 helper 를 사용한다.
- `g5LegacyFieldGrepGate.test.ts` 는 (1) unified/shared Element schema 의 component mirror field 재도입 금지, (2) non-adapter test fixture 의 raw `componentRole` / `masterId` literal 재도입 금지를 검증한다. legacy `overrides:` grep 은 일반 fixture parameter 명칭 noise 가 많으므로 helper 전환 파일 단위로 정리하고, field schema 재도입은 schema regex 로 차단한다.

**grep 상태**:

- `rg -n "\\b(componentRole|masterId|overrides)\\??:" apps/builder/src/types packages/shared/src/types -g "*.ts"` 결과 0건.
- `rg -n "componentRole|masterId" apps/builder/src/builder apps/builder/src/preview packages/shared/src -g "*.test.ts" -g "*.test.tsx"` 결과 0건.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/builder/utils/editingSemantics.test.ts src/builder/stores/utils/__tests__/elementUpdateOriginImpact.test.ts src/builder/stores/utils/__tests__/instanceActions.test.ts src/builder/workspace/canvas/interaction/canvasContextMenu.test.ts src/builder/panels/properties/ComponentSemanticsSection.test.tsx src/builder/panels/nodes/tree/LayerTree/LayerTreeItemContent.test.tsx src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` — 7 files / 65 tests PASS.
- `pnpm run codex:typecheck` — PASS.

### 10.2.32 ADR-113/116 frame/slot type schema / targeted fixture cleanup (2026-05-02)

**framing**: strict runtime access 0 이후에도 `layout_id` / `slot_name` 이 Element/Page/Preview type schema 에 남아 있으면 frame/slot mirror payload 가 정상 domain field 처럼 재확산된다. schema 표면은 canonical fields 만 유지하고, legacy frame/slot mirror payload 는 `frameMirror` / `slotMirror` adapter helper 가 소유한다.

**land 내용**:

- `apps/builder/src/types/builder/unified.types.ts`, `packages/shared/src/types/element.types.ts`, `packages/shared/src/types/renderer.types.ts`, `apps/builder/src/preview/store/types.ts`, `apps/builder/src/preview/types/index.ts` 에서 `layout_id` / `slot_name` 선언을 제거했다.
- `apps/builder/src/types/builder/layout.types.ts` 의 dead `ElementLayoutFields` / `PageLayoutFields` 를 삭제했다.
- `useElementHoverInteraction`, `buildFrameRendererInput`, `visibleFrameRoots` frame body/render root fixture 는 raw `layout_id:` 대신 `withFrameElementMirrorId()` helper 를 사용한다.
- `editingSemanticsRegressionSweep` slot assignment fixture 는 raw `slot_name:` 대신 `SLOT_NAME_MIRROR_FIELD` / `withSlotMirrorName()` 을 사용한다.
- `g5LegacyFieldGrepGate.test.ts` 는 frame/slot schema 파일의 `layout_id` / `slot_name` field 선언 재도입과 targeted fixture 파일의 raw payload key 재도입을 함께 차단한다.

**grep 상태**:

- `rg -n "\\b(layout_id|slot_name)\\??:" apps/builder/src/types packages/shared/src/types apps/builder/src/preview/store apps/builder/src/preview/types -g "*.ts" -g "*.tsx"` 결과 0건.
- `rg -n "\\b(layout_id|slot_name)\\s*:" apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts apps/builder/src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts apps/builder/src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts apps/builder/src/builder/stores/utils/__tests__/editingSemanticsRegressionSweep.test.ts` 결과 0건.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts src/builder/workspace/canvas/hooks/useElementHoverInteraction.test.ts src/builder/workspace/canvas/renderers/__tests__/buildFrameRendererInput.test.ts src/builder/workspace/canvas/skia/visibleFrameRoots.test.ts src/builder/stores/utils/__tests__/editingSemanticsRegressionSweep.test.ts` — 5 files / 30 tests PASS.
- `pnpm run codex:typecheck` — PASS.

### 10.2.33 Final SSOT closure: documents primary storage + export/import canonical-first + raw fixture bucket 0 (2026-05-02)

**framing**: ADR-116 의 근본 목적은 projection 제거 자체가 아니라 `CompositionDocument` canonical schema 를 최종 SSOT 로 만드는 것이다. 따라서 최종 closure 는 (1) DB primary store, (2) export/import schema, (3) legacy mirror field quarantine, (4) docs/status sync 를 함께 닫을 때만 성립한다.

**land 내용**:

- IndexedDB `DB_VERSION` 을 10으로 올리고 `documents` object store 를 추가했다. `DatabaseAdapter.documents` 는 `put/get/delete/getAll` 을 제공하며 `CanonicalDocumentRecord` 가 `project_id + document + updated_at` 을 보관한다.
- `usePageManager.initializeProject` 는 `db.documents.get(projectId)` 를 먼저 읽는다. 저장된 canonical document 가 있으면 canonical store 에 직접 주입하고, render/runtime mirror 는 canonical document 에서 derive 한다.
- `BuilderCore` 는 active canonical store 변경을 microtask debounce 후 `db.documents.put(projectId, doc)` 으로 저장한다. page shell 변경(`appendPageShell` / `setPages` / `removePageLocal`)도 `setElementsCanonicalPrimary()` 를 통해 canonical document 에 반영한다.
- shared `ExportedProjectSchema` 는 `document: CompositionDocumentSchema` 를 필수로 검증한다. `ProjectExportData` 는 canonical document 를 primary payload 로 포함한다. Publish import 타입은 `ProjectExportData` 로 전환했다.
- legacy `descendants` mirror field 는 `apps/builder` / `packages/shared` Element type schema 에서 제거했다. non-adapter raw fixture key bucket (`layout_id:` / `slot_name:` / `componentRole:` / `masterId:`) 은 broader test sweep 기준 0건이다. canonical `RefNode.descendants` fixture 는 합법 canonical schema 검증으로 유지한다.

**grep 상태**:

- `rg -n "\\b(layout_id|slot_name|componentRole|masterId)\\s*:" apps/builder/src packages/shared/src apps/publish/src -g "*.test.ts" -g "*.test.tsx" -g "!apps/builder/src/adapters/**"` 결과 0건.
- `rg -n "\\b(layout_id|slot_name|componentRole|masterId|overrides)\\??:" apps/builder/src/types packages/shared/src/types apps/builder/src/preview/store apps/builder/src/preview/types -g "*.ts" -g "*.tsx"` 결과 0건.
- `rg -n "\\.(layout_id|slot_name|componentRole|masterId|overrides)\\b|\\b(layout_id|slot_name|componentRole|masterId|overrides)\\s*:" apps/builder/src apps/publish/src packages/shared/src -g "*.ts" -g "*.tsx" -g "!**/__tests__/**" -g "!*.test.ts" -g "!*.test.tsx" -g "!apps/builder/src/adapters/**" -g "!apps/builder/src/lib/db/migration*.ts"` 결과 0건.
- `rg -n "\\bdescendants\\??:" apps/builder/src/types/builder/unified.types.ts packages/shared/src/types/element.types.ts` 결과 0건.

**검증**:

- `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts src/adapters/canonical/__tests__/adr113DescendantsGrepGate.test.ts src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts` — 5 files / 29 tests PASS.
- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — 1 file / 3 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/resolvers/canonical/__tests__/integration.test.ts src/resolvers/canonical/__tests__/storeBridge.test.ts src/builder/workspace/canvas/scene/resolvePageWithFrame.test.ts src/builder/workspace/canvas/selection/selectionHitTest.test.ts src/builder/workspace/canvas/skia/skiaWorkflowSelection.test.ts src/builder/panels/nodes/FramesTab/__tests__/FramesTab.test.tsx src/builder/panels/properties/editors/ElementSlotSelector.test.tsx src/builder/hooks/useElementCreator.test.ts src/builder/stores/__tests__/pagesLayoutInvalidation.test.ts src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts src/builder/stores/utils/__tests__/frameActions.test.ts src/builder/stores/utils/__tests__/elementCreationCanonical.test.ts src/builder/workspace/canvas/skia/visiblePageRoots.test.ts src/builder/panels/properties/editors/PageLayoutSelector.static.test.ts` — 14 files / 130 tests PASS.
- `pnpm run codex:typecheck` — PASS.

### 10.2.34 Residual legacy projection removal final slice (2026-05-02)

**framing**: final SSOT closure 뒤에도 compatibility projection 이 payload/schema/hydrate/db batch 에 남으면 `CompositionDocument` 가 최종 SSOT 라는 판정이 약해진다. 개발 단계 direct cutover 결정에 따라 fallback/backup/migration 없이 잔여 projection surface 를 제거한다.

**land 내용**:

- shared export/import schema 는 canonical-only 로 고정했다. `ProjectExportData` / `ExportedProjectSchema` / `serializeProjectData` / `parseProjectData` 는 `document` 만 유지하고 legacy-only `pages`/`elements` payload 를 거부한다.
- Publish import, Builder preview session payload, static HTML export 는 serialized `pages`/`elements` 를 사용하지 않는다. runtime 에 필요한 pages/elements view 는 `deriveProjectRenderModelFromDocument()` 가 `CompositionDocument` 에서 in-memory 로 만든다.
- `usePageManager.initializeProject` 는 DB `pages`/`elements`/`layouts` hydrate fallback 을 제거하고 `db.documents.get(projectId)` 결과만 canonical seed 로 사용한다.
- IndexedDB batch export/import 는 `pages`/`elements` projection 을 제거했다. `getByLayout` adapter/type surface, `layout_id` index 생성, `_meta` migration store/API 도 direct cutover 기준에 맞춰 삭제했다.
- shared `composition-document-actions.types.ts` 의 unused `CanonicalLegacyAdapter*` type stub 과 shared `element.utils.ts` 의 `layout_id`/`slot_name` utility 를 삭제해 shared public surface 에 legacy projection helper 를 남기지 않는다.

**grep 상태**:

- `rg -n "LegacyExported|createProjectCompositionDocument|migrateProject|migration\\.utils|legacy-export-mirror|pages: data\\.pages|elements: data\\.elements|parsed\\.pages|parsed\\.elements|getByLayout\\(" packages/shared/src apps/publish/src apps/builder/src/builder/main/BuilderCore.tsx apps/builder/src/builder/hooks/usePageManager.ts apps/builder/src/lib/db -g "*.ts" -g "*.tsx" -g "!**/__tests__/**" -g "!*.test.ts" -g "!*.test.tsx"` — 0건.
- `rg -n "pages\\?: Page\\[\\]|elements\\?: Element\\[\\]" packages/shared/src/types packages/shared/src/schemas packages/shared/src/utils packages/shared/src/index.ts packages/shared/src/utils/index.ts -g "*.ts" -g "*.tsx" -g "!**/__tests__/**" -g "!*.test.ts" -g "!*.test.tsx"` — 0건.
- `rg -n "db\\.pages|db\\.elements|db\\.layouts|getByLayout\\(|getAllByIndex<Element>\\(\\s*\"elements\",\\s*\"layout_id\"|enqueuePagePersistence|withPageFrameBinding|exportLegacyDocument|applyCollectionItemsMigration" apps/builder/src/builder/hooks/usePageManager.ts apps/builder/src/builder/main/BuilderCore.tsx apps/builder/src/lib/db/indexedDB/adapter.ts apps/builder/src/lib/db/types.ts` — 0건.

**검증**:

- `pnpm -F @composition/shared exec vitest run src/utils/__tests__/exportCanonicalProject.test.ts` — 1 file / 4 tests PASS.
- `pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/lib/db/__tests__/getByLayoutDeprecation.test.ts src/lib/db/__tests__/getByLayoutCanonicalPath.test.ts src/builder/main/BuilderCore.static.test.ts src/builder/hooks/__tests__/usePageManager.canonical.test.ts` — 5 files / 16 tests PASS.

## 11. ADR 의존 관계 정리

| ADR     | ADR-116에서의 역할                        | 조정 필요                                                                                                                                       |
| ------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-903 | canonical format foundation               | completed 유지, final SSOT cutover는 ADR-116이 담당                                                                                             |
| ADR-110 | `themes`/`variables` canonical field land | 그대로 유지                                                                                                                                     |
| ADR-111 | `layout_id`/frame authoring cleanup       | ADR-116 G5의 layout field quarantine에 연결                                                                                                     |
| ADR-112 | editing semantics base                    | ADR-116 parity matrix의 reusable/ref UX 기준으로 사용                                                                                           |
| ADR-113 | `tag -> type` + hybrid cleanup            | ADR-116 G5의 field quarantine에 연결                                                                                                            |
| ADR-114 | imports resolver historical scope         | Superseded. DesignKit scope 는 ADR-115 로 무효화, P5-D/P5-E fetch/cache/resolver 는 ADR-116 import/export adapter + runtime parity gate 로 흡수 |

## 12. 완료 판정

ADR-116은 아래 조건을 모두 충족해 `Implemented`로 이동했다.

| 조건                       | 기준                                                         | 상태 |
| -------------------------- | ------------------------------------------------------------ | ---- |
| canonical primary storage  | 신규 저장 source가 `CompositionDocument`                     | PASS |
| legacy adapter quarantine  | legacy field runtime read/write가 adapter-only               | PASS |
| hot path projection 0      | drag/selection/render/preview sync에 full projection 없음    | PASS |
| extension boundary closure | events/dataBinding/actions가 `x-composition` 아래에만 직렬화 | PASS |
| parity pass                | Skia/Preview/Publish/History/Slot/Ref 시나리오 회귀 0        | PASS |
| docs sync                  | ADR-111/113/114 README row와 본 ADR gate 상태 일치           | PASS |
