# ADR-116: Canonical Document SSOT 전환 계획

## Status

Implemented — 2026-05-02. `CompositionDocument` canonical schema 를 저장/편집/export/import 의 최종 SSOT 로 전환했다. feature flag / backup / runtime DB migration / rollback marker 없이 direct cutover 했고, IndexedDB `documents` store + `DatabaseAdapter.documents` 를 primary persistence 로 추가했다. legacy `pages`/`elements` compatibility export/import payload, DB `pages`/`elements`/`layouts` hydrate fallback, DB batch projection, `_meta` migration API, `getByLayout`, `layout_id` index 를 제거했다. legacy field runtime access / Element type schema / broader raw fixture key bucket 은 gate 0으로 닫았다.

> **2026-05-05 Rollback note** — 2026-05-03 에 land 했던 post-cutover persistence / canonical frame scope / Layout Preset / Style Panel write-through fix 군 (총 12 commits, `919e11217..eacedead7`) 은 사용자 환경 회귀 누적 ("프로젝트가 너무 꼬여서 복구 불능", page→body→frame 적용 후 새로고침 시 body 사라짐) 으로 통째 폐기되었다. 폐기 baseline = `225532ea9` (build error fix 직전, codex 작업 mid-point). cutover (`dc498e539`) ~ ADR Implemented 처리 자체는 보존. 폐기 commits 의 history 는 `backup/before-rollback-eacedead7-2026-05-05` branch 에 보존.
>
> 결과: `225532ea9` 시점의 canonical write-through gap (element 생성 후 refresh 시 초기화 / FramesTab body 중복 / Layout Preset Slot 누적 / Style Panel Layout section write-through gap / `legacy-slot-hoisted` Slot 복원) 은 **본 ADR 의 잔존 debt 로 다시 분류**했다.
>
> **2026-05-06 Follow-up closure** — rollback 이후 current main 기준 새 패치군으로 잔존 debt 를 다시 닫았다. 포함 범위: page-frame refresh 후 body/Slot/Skia hatch marker 복원, No Frame 해제 body size 보존, Layout Preset Slot replace, frame/page tab body auto-selection, shared frame multi-page refresh projection, synthetic page-frame projection `order_num` DB write 제외, component origin refresh persistence, instance materialization/properties override/customId 독립성, Nodes panel Pages/Frames `TreeBase`/`section` parity. 이 follow-up 은 2026-05-03 폐기 commits 의 단순 재적용이 아니라 current main 에서 재현/확인된 경로를 새로 닫은 패치군이다.

### 진행 로그

- **2026-04-30**: Proposed. ADR-903/110/111/112/113/114 라인업의 최종 cutover ADR 로 도입. ADR-114 standalone scope 흡수. tier3 entry "다음 Tier 1 = ADR-116 진입" 권고.
- **2026-05-01 — Phase 0 G1 Schema Boundary Freeze land + Accepted 승격**:
  - **framing #3 lock-in** — §Decision 의 "ADR fork checkpoint (4 질문)" 서브섹션에서 ADR-903 의 read-through projection ↔ 본 ADR 의 primary SSOT reverse 가 valid 한 사유 명문화. base/응용 분류 + schema 4 영역 직교성 + reverse 정당화 (ADR-903 transition bridge / ADR-110/111/112/113 누적 / closure ADR 부재) + codex 1차 진입 합의.
  - **타입 land** — `packages/shared/src/types/composition-document.types.ts` 에 (1) `@fileoverview` ADR-116 G1 boundary 4-항 분류표 추가, (2) `CanonicalNode.props?: Record<string, unknown>` 신규 필드 (G1 §2.1 결정), (3) `CanonicalNode.metadata` 주석에 `metadata.legacyProps` transition-only marker, (4) `CompositionExtension` / `CompositionExtendedNode` / `SerializedEventHandler` / `SerializedAction` / `SerializedDataBinding` 타입 (G1 §3 namespace).
  - **legacy marker land** — `apps/builder/src/types/builder/unified.types.ts` 의 `Element.events` / `Element.dataBinding` / `Element.layout_id` / `Element.slot_name` / `Element.componentRole` / `Element.masterId` / `Element.overrides` / `Element.descendants` / `Element.componentName` 9 필드에 ADR-116 G5 / G7 Extension Boundary cleanup target 마커 부착. 기존 `@deprecated ADR-113 Phase 5` 마커와 병기.
  - **design §5 갱신** — Phase 0 산출물 6 항목 모두 ✅ 마크 + baseline 4 grep 결과 (`legacyToCanonical(` 44 / `metadata.legacyProps|legacyProps` 92 / legacy 5필드 broad 1062 / events·dataBinding broad 856) main HEAD `119f0206c` 기준 기록.
  - **검증** — `pnpm type-check` 3/3 PASS (5.23s). 신규 `props?` optional 필드 추가가 기존 41+ canonical consumer 를 깨지 않음을 확증.
  - **Gate G1 (Schema Boundary Freeze) PASS** → Status `Proposed → Accepted` 승격.
- **2026-05-01 — Phase 1 G2 Canonical Document Store API land**:
  - **결정 분기 D1=B / D2=β / D3=i** — Phase 1 land scope = types + skeleton + unit test (R1 명시 "API + unit test 까지만"). storage backing = 별도 Zustand slice (elementsMap wrapper 기각, Phase 2 hot path cutover 시점에 elementsMap 의존 제거 자연스러움). 역방향 adapter = spec only (구현은 Phase 3).
  - **types land** — `packages/shared/src/types/composition-document-actions.types.ts` 신규: (1) `CanonicalDocumentActions` interface 8 method (`getDocument` / `setDocument` / `setCurrentProject` + 5 mutation: `updateNode` / `updateNodeProps` / `insertNode` / `removeNode` / `updateDescendant`), (2) `CanonicalLegacyAdapter<TElement, TPage, TLayout>` generic spec stub (Phase 3 prerequisite), (3) `CanonicalLegacyExport` / `CanonicalLegacyAdapterInput` / `CanonicalRoundtripDiff` / `CanonicalExportDiagnostic` placeholder. barrel `packages/shared/src/types/index.ts` 末尾 export.
  - **store land** — `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts` 신규: Zustand `create<CanonicalDocumentStore>` slice. 활성 document 모델 (`currentProjectId` + `Map<projectId, doc>`) + `documentVersion` 카운터 + clone-on-write immutability + dev warn (silent fail / throw 회피). Phase 1 단순화: `parentPath` / `nodePath` = nodeId (single-segment), `descendantPath` = pencil slash-separated. `selectCanonicalNode` / `selectActiveCanonicalDocument` cold-path selector.
  - **G7 사전 enforcement** — `updateNodeProps` 에서 `events` / `actions` / `dataBinding` key 입력 시 dev warn + skip (Extension Boundary G7 의 props ↔ x-composition 분리 사전 적용).
  - **structural invariant 보호** — `updateNode` 가 `id` / `type` / `props` patch 를 받으면 silently 무시 (id/type 은 구조 invariant, props 는 `updateNodeProps` 사용 권장 — semantic intent 분리, history granularity 보존).
  - **unit test land** — `apps/builder/src/builder/stores/canonical/__tests__/canonicalDocumentStore.test.ts` 신규: 7 action × happy path + edge case + selector + immutability = **37 test PASS**. 검증 항목 = no-active-project no-op, node 미발견 warn, DFS lookup, props undefined 키 삭제, G7 forbidden key skip, descendants 3-mode union add/overwrite, RefNode 외 target reject, documentVersion 카운터, Map reference clone, structural clone 전파.
  - **design §6 갱신** — Phase 1 ✅ 마크 + 6-A~6-G 서브섹션 (산출물표 / 활성 document 모델 / 시그니처 구체화 / 역방향 adapter spec / Phase 1 외부 잔존 / 원칙 / 검증 evidence).
  - **검증** — `pnpm type-check` 3/3 PASS (4.23s, turbo cache miss 후 재실행) + vitest 37/37 PASS (520ms).
  - **Gate G2 (Canonical Store/API) PASS** — `CompositionDocument` read/write/mutation API 와 canonical -> legacy export adapter API 가 `elements[]` 직접 mutation 없이 테스트 가능. Status `Accepted → In Progress` 전이.
- **2026-05-01 — Phase 2 G3 Sub-Phase A: Bridge layer + selector subscription pattern land**:
  - **결정 분기 D4=γ / D5=A / D6=i** — 5 hot path 다중 영역 R2 HIGH risk 대응으로 3-4d bridge first + 1 path pilot 채택 (atomic 1주 단일 PR 기각 / path-by-path 5 PR 보다 회귀 isolation 우선). bridge layer 먼저 land (D5=A). React subscribe 패턴은 `useSyncExternalStore` (D6=i, Zustand v5 selector cache miss 회피 — 세션 36 ElementSlotSelector 무한 루프 이력).
  - **bridge land** — `apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts` 신규 (~140 lines): (1) read API `getCanonicalNode(nodeId)` / `getActiveCanonicalDocument()` (Phase 1 selector wrap), (2) subscribe API `subscribeCanonicalStore(listener)` (Zustand v5 native subscribe — `subscribeWithSelector` middleware 미사용, store 의 clone-on-write 가 snapshot stability 보장하므로 over-subscribe 가 perf 영향 없음), (3) feature flag `isCanonicalBridgeEnabled()` / `setCanonicalBridgeEnabled(value)` (default `false`, Sub-Phase B 진입 시 path 별 enable), (4) React hook 2종 `useCanonicalNode(nodeId): CanonicalNode | null` + `useActiveCanonicalDocument(): CompositionDocument | null` (`useSyncExternalStore` 기반, SSR snapshot = `null` placeholder).
  - **unit test land** — `apps/builder/src/builder/stores/canonical/__tests__/canonicalElementsBridge.test.tsx` 신규: feature flag 3 + read API 7 + subscribe API 4 + `useCanonicalNode` 5 + `useActiveCanonicalDocument` 3 = **22 test PASS**. snapshot stability 검증 (mutation 없음 → 동일 reference) 및 mutation re-render (clone-on-write 후 새 reference) 명시 evidence.
  - **Sub-Phase A scope 명시** — canonical store 단독 read (legacy `elementsMap` fallback 미포함). `legacyToCanonical()` 자동 변환 캐싱 + 5 hot path path-by-path cutover (LayerTree → Selection/properties → Preview sync → BuilderCore → canvas drag/drop) 는 Sub-Phase B 부터 진입.
  - **검증** — `pnpm turbo run type-check` 3/3 PASS (builder cache miss 313ms, shared/publish cache hit) + vitest canonical 전체 59/59 PASS (37 store + 22 bridge — 회귀 0).
  - **Gate G3 진행률**: 5/5 hot path 중 0/5 path 실 cutover (backbone 구축 단계). Sub-Phase B 진입 prerequisite 충족 — `useCanonicalNode` / `useActiveCanonicalDocument` hook 이 LayerTree pilot 의 read backbone 으로 사용 가능.
- **2026-05-01 — Phase 2 G3 Sub-Phase B Step 1a: Legacy → canonical write-through sync land**:
  - **결정 분기 D7=A / D8=β / D9=i** — write-through sync 채택 (canonical store 가 mirror, design §6-E 정통 경로) + Step 1a 단독 land (회귀 isolation, LayerTree cutover 는 다음 세션 Step 1b) + Zustand v5 native subscribe + ref 비교 selector (legacy store 무수정).
  - **CRITICAL 발견 (Sub-Phase A 후속)**: Sub-Phase A bridge land 후 baseline 측정 결과 canonical store `setDocument` 호출 site **0건** — Phase 1 store 가 어디서도 채워지지 않은 상태. LayerTree pilot 진입 시 `useActiveCanonicalDocument()` 가 즉시 `null` 회귀 위험 발견 → write-through sync 가 5 hot path 공통 prerequisite 임이 확정. Sub-Phase B 진입 첫 작업으로 Step 1a 격상.
  - **sync 모듈 land** — `apps/builder/src/builder/stores/canonical/canonicalDocumentSync.ts` 신규 (~150 lines): (1) `startCanonicalDocumentSync(): () => void` 공개 API (3 store subscribe + initial schedule + return unsubscribe), (2) microtask coalesce (`queueMicrotask` 기반, 동일 macrotask 내 다중 mutation → 1번 sync collapse), (3) ref 비교 selector (`elementsMap`/`pages`/`layouts`/`currentProjectId` 동일 ref 시 sync skip), (4) `null` projectId no-op (data store 미초기화 시 안전), (5) `selectCanonicalDocument()` 재사용 (`apps/builder/src/builder/stores/elements.ts:2024` 기존 helper — 신규 변환 로직 0).
  - **호출 site 명시 (Step 1b 진입 prerequisite)**: 본 모듈은 land 만 됐고 실제 `startCanonicalDocumentSync()` 호출은 builder 부트스트랩 (`apps/builder/src/main.tsx` 또는 project init effect) 에 추가 필요. Step 1b (LayerTree pilot) 진입 시점에 함께 land 권장.
  - **unit test land** — `apps/builder/src/builder/stores/canonical/__tests__/canonicalDocumentSync.test.ts` 신규: lifecycle 3 + null projectId 2 + propagation 5 + microtask coalesce 1 = **11 test PASS**. test scheduler override 패턴 (`setSyncScheduler((cb) => cb())`) 으로 microtask flush 대기 없이 결과 검증 가능, default `queueMicrotask` 회복 시 coalesce 검증 (3 mutation → 1 sync, version diff = 1).
  - **검증** — `pnpm turbo run type-check` 3/3 PASS (builder cache miss 313ms) + vitest canonical 전체 70/70 PASS (37 store + 22 bridge + 11 sync — 회귀 0).
  - **Gate G3 진행률**: 5/5 hot path 중 0/5 path 실 cutover. Sub-Phase B Step 1b (LayerTree pilot) 진입 가능 — `useActiveCanonicalDocument()` 가 실제 데이터 수신할 backbone 완성. legacy mutation → canonical store 자동 mirror 경로 단방향 sync 가동.
- **2026-05-01 — Phase 2 G3 Sub-Phase B Step 1b-1: Bootstrap 호출 + env flag land**:
  - **결정 분기 D10=B / D11=β / D12=i** — Builder mount lifecycle 에 sync 호출 (route 이탈 시 cleanup 자동) + Step 1b-1 단독 land (LayerTree dual-mode cutover 는 Step 1b-2 다음 세션) + flag default `false` (보수, LayerTree pilot 검증 시점 사용자 명시 enable).
  - **재추정 발견**: design §7-B "LayerTree pilot 1-2d MED" 가 단일 PR 가정이었으나 실측 작업 분해 시 (1) Bootstrap + flag = LOW ~30분, (2) LayerTree dual-mode cutover = MED ~1d, (3) Chrome MCP visual evidence = MED ~1-2h. Step 1b 가 1b-1 / 1b-2 / 1b-3 으로 세분화. 본 commit = 1b-1 만.
  - **flag land** — `apps/builder/src/utils/featureFlags.ts` 에 `isCanonicalDocumentSyncEnabled()` getter 추가 (`VITE_ADR116_DOCUMENT_SYNC` env, default `false`). 기존 `isFramesTabCanonical()` (ADR-111 P2) 패턴 정합 — `parseBoolean` + env override + emergency rollback (`VITE_ADR116_DOCUMENT_SYNC=false` 즉시 비활성화).
  - **bootstrap 호출 land** — `apps/builder/src/builder/main/BuilderCore.tsx` import chain 에 `isCanonicalDocumentSyncEnabled` + `startCanonicalDocumentSync` 추가. mount useEffect (history useEffect 직전 위치, deps `[]`): flag enabled 시 `startCanonicalDocumentSync()` 호출 + cleanup 으로 unsubscribe 함수 반환 → Builder route 이탈 시 sync 자동 정리.
  - **회귀 안전망**: default `false` 이므로 production 영향 0 — Step 1b-2 진입 사용자 검증 후 명시 enable. canonical store hydrated 되어도 hot path consumer 가 없어 메모리 cost 만 발생 (LayerTree cutover 시점에 의미 발현).
  - **검증** — `pnpm turbo run type-check` 3/3 PASS (builder cache miss 291ms) + vitest canonical 전체 70/70 PASS (apps/builder cwd, 회귀 0). root cwd 실행 시 jsdom 환경 분리 이슈는 pre-existing config 한계 — 본 변경 무관, apps/builder cwd 에서 정상.
  - **Step 1b-2 진입 prerequisite (다음 세션)**: (1) 사용자 환경에서 `VITE_ADR116_DOCUMENT_SYNC=true` 명시 enable + dev console 로그 확인 (canonical store 가 mutation 시 update 되는지), (2) `useLayerTreeData.ts` dual-mode cutover (canonical → LayerTreeNode 변환 helper + virtual children + ref/instance 분기), (3) Chrome MCP visual evidence (legacy vs canonical 모드 LayerTree 표시 정합성).
- **2026-05-01 — Phase 2 G3 Sub-Phase B Step 1b: LayerTree pilot land (1 PR 통합)**:
  - **결정 분기 D13=A / D14=i / D15 통합** — canonical → Element[] derived view helper + metadata.legacyProps 활용 + 1 PR 통합 land (사용자 지시 "쓸데없이 쪼개기 하지마" / "본래 목적을 찾아라" 반영).
  - **schema 보강** — `apps/builder/src/adapters/canonical/legacyMetadata.ts` 의 `buildLegacyElementMetadata()` 가 보존하는 element top-level fields 를 6개 → 7개로 확장 (`element.type` 추가). canonical inverse 변환에서 ref 노드의 원본 element.type 복원 가능 (canonical type === "ref" 만으로는 LayerTree 분기 무력화).
  - **derived view land** — `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` 신규 (~140 lines): (1) `canonicalDocumentToElements(doc)` helper — DFS + metadata.legacyProps 기반 무손실 inverse 변환 (id/parent_id/page_id/layout_id/order_num/fills/type + props spread 7-fields), (2) metadata 미보존 노드는 skip + 자식 parent context 승계 (page placeholder / slot synthetic 안전), (3) `useCanonicalElements()` React hook — `useActiveCanonicalDocument()` + `useMemo` 변환.
  - **dual-mode cutover land** — `apps/builder/src/builder/panels/nodes/tree/LayerTree/useLayerTreeData.ts` 진입점에 source 분기 추가: `isCanonicalDocumentSyncEnabled()` && canonical store hydrated 시 `useCanonicalElements()` 결과 사용, 미충족 시 caller 가 전달한 legacy `elements[]` 유지. 하류 파이프라인 (`resolveCanonicalRefTree` / `buildTreeFromElements` / `convertToLayerTreeNodes`) 변경 0 — 기존 schema/동작 무손실.
  - **회귀 안전망**: flag default `false` 이므로 production 영향 0. flag enable 시에도 canonical → Element[] derived view 라 LayerTreeNode.element / selectedElementId / batchUpdateElements 모두 legacy UUID 기반 유지 → 5 hot path cascade 회피.
  - **unit test land** — `apps/builder/src/builder/stores/canonical/__tests__/canonicalElementsView.test.ts` 신규 (**7 test PASS**): happy path 3 (single root + nested DFS + ref 노드 type 복원) + metadata 미보존 노드 2 + fields 무손실 복원 2.
  - **검증** — `pnpm turbo run type-check` 3/3 PASS (builder cache miss 304ms) + vitest canonical 전체 77/77 PASS (37 store + 22 bridge + 11 sync + 7 view, 회귀 0) + LayerTree 기존 vitest 5/5 PASS (회귀 0).
  - **Gate G3 진행률**: 5/5 hot path 중 **1/5 path cutover backbone 완성** (LayerTree). 사용자 환경 dev enable + Chrome MCP visual evidence 후 LayerTree pilot 완결 → Step 2 (Selection/properties) 진입 가능.
- **2026-05-01 — Step 1b dev 검증 + caller-driven sync 전환**:
  - **회귀 #1 (subscribe 시그니처)**: 사용자 dev 환경 (`VITE_ADR116_DOCUMENT_SYNC=true pnpm dev`) 검증 시 `currentProjectId === null` + `documentVersion === 0` 영구 지속 발견. console 로그 분석 결과 `useDataStore.subscribe(listener)` native fallback 이 fire 0건 (useStore / useLayoutsStore 는 정상). root cause = `useDataStore` 가 `subscribeWithSelector` middleware 사용 (data.ts:313) → selector-aware 시그니처 (`subscribe(selector, listener)`) 필수.
  - **회귀 #2 (dataStore fragility)**: subscribe 시그니처 fix 후에도 `useDataStore.isInitialized === false` 지속 → BuilderCore 의 init useEffect 가 sequential await 중 stuck 또는 condition skip. dataStore 자체가 fragile source 임이 확정.
  - **caller-driven 전환 (근본 fix)**: `startCanonicalDocumentSync()` → `startCanonicalDocumentSync(projectId: string)` 시그니처 변경. caller (BuilderCore) 가 `useParams<{projectId}>()` 의 routing 값을 명시 전달. dataStore 의존 완전 제거 + 2 store subscribe 만 유지 (useStore + useLayoutsStore). routing source 는 dataStore lifecycle 와 무관 — 항상 immediate available.
  - **stop() 시 currentProjectId reset 추가** — 다른 project sync 시작 시 stale 데이터 노출 방지.
  - **dev evidence (사용자 검증)**: Builder 페이지 (`/builder/<projectId>`) 진입 + `VITE_ADR116_DOCUMENT_SYNC=true` enable 후:
    - `window.__canonical_STORE__.getState().currentProjectId === '<route projectId>'` ✅
    - `documentVersion` 페이지 요소 추가 시 7→8→9→10→11 증가 ✅ (sync 정상 trigger)
  - **vitest 갱신**: 11 test 모두 caller-driven 시그니처 사용 (`startCanonicalDocumentSync("proj-a")` 명시). 신규 검증 = stop 시 reset / 동일 projectId skip / start 미호출 시 무시.
  - **검증** — `pnpm turbo run type-check` 3/3 PASS + vitest canonical 전체 77/77 PASS (회귀 0).
  - **Step 1b LayerTree pilot 완결** — sync backbone + caller-driven 전환 + dev evidence 모두 확보. design §7-B Step 2 (Selection/properties) 진입 가능.
- **2026-05-01 — Phase 2 G3 Step 2: Selection/properties cutover land (1 PR 통합)**:
  - **결정 분기 D13=A / D14=A / D15=A** — 1 PR 통합 land (sub-step 분해 회피, 사용자 surface 최소화 정책 준수) + legacy uuid 기준 `metadata.legacyProps.id` DFS lookup (segId 와 다른 lookup 키 분리) + `useSelectedElementData()` 단일 진입점 dual-mode (caller 무수정).
  - **lookup 키 분리 발견**: canonical node.id = segId (stable path, 예: `page:p1/0/2`), legacy element.id = uuid (예: `uuid-xxx`). selectedElementId 는 legacy uuid 이므로 `selectCanonicalNode(uuid)` 미매칭 → `findNodeByLegacyId(doc, legacyId)` 가 `metadata.legacyProps.id === legacyId` DFS 검색.
  - **bridge 시그니처 확장** — `useCanonicalNode(nodeId: string | null)` null 안전 확장 (caller selectedElementId 직접 전달 가능).
  - **view hook land** — `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` 의 `canonicalNodeToElement` export 승격 (Step 1b internal → public, Step 2 hook 재사용) + `findNodeByLegacyId` 내부 helper (DFS metadata 검색) + `useCanonicalSelectedElement(selectedElementId)` 신규 hook (`useActiveCanonicalDocument` + `findNodeByLegacyId` + `canonicalNodeToElement` 조합).
  - **dual-mode 진입점** — `apps/builder/src/builder/stores/index.ts::useSelectedElementData()` 에 `isCanonicalDocumentSyncEnabled() && canonicalSelectedElement !== null` 분기 추가. canonical 우선, fallback legacy `state.elementsMap`. caller (PropertiesPanel + 5+ Style sections + inspector editors) 무수정 단일 SSOT 진입점.
  - **검증** — `pnpm turbo run type-check` 3/3 PASS + vitest canonical 84/84 PASS (77 → 84, +7 신규: bridge `useCanonicalNode(null)` 1 + view `useCanonicalSelectedElement` 6) + 광역 stores+properties+inspector 209/209 PASS (회귀 0).
  - **Gate G3 진행률**: 5/5 path 중 **2/5 path cutover** (LayerTree + Selection/properties).
- **2026-05-01 — Phase 2 G3 Step 3: Preview sync cutover land (1 PR 통합)**:
  - `**useIframeMessenger.ts` elements source dual-mode\*\* — `legacyElements = useStore((state) => state.elements)` rename + `elements = useMemo` dual-mode (canonical mode + active doc 존재 시 `useCanonicalElements()` derived, 그 외 legacy). `sendInitialData` closure 안 `useStore.getState().elements` 호출도 매 호출 시 dual-mode 평가 (`getActiveCanonicalDocument` + `canonicalDocumentToElements`).
  - **postMessage UPDATE_ELEMENTS 채널 무수정** — caller 가 dual-mode source 자동 사용.
  - **ADR-903 P3-D-4 source-text test regex 갱신** — `legacyElements` + `useMemo` 패턴 정합 검증.
  - **검증** — type-check 3/3 + vitest hooks+preview+canonical 101/101 PASS (회귀 0).
  - **Gate G3 진행률**: 5/5 path 중 **3/5 path cutover** (+ Preview sync).
- **2026-05-01 — Phase 2 G3 Step 4: BuilderCore layout refresh cutover land (1 PR 통합)**:
  - `**BuilderCore.tsx` 의 elements 변경 → iframe sync useEffect dual-mode 분기\*\* — `publishElements(sourceElements)` helper 추출 (editMode filter + lastSentRef 비교 + sendElementsToIframe 호출 logic 단일화). canonical mode 시 `subscribeCanonicalStore` listener (canonical store mutation 시 `getActiveCanonicalDocument` + `canonicalDocumentToElements` → `publishElements`). `lastDerivedRef` ref 비교로 중복 publish 방지. doc 부재 시 legacy fallback. legacy mode 는 기존 `useStore.subscribe` 경로 유지.
  - **dual subscribe 회피** — canonical mode 활성 시 canonical store 단일 publish source (write-through sync 가 legacy → canonical propagate 보장).
  - **검증** — type-check 3/3 + vitest hooks+main+stores 200/200 PASS (회귀 0). 광역 vitest 6 fail (factoryOwnership / resolver TC1 / useFillActions) = Step 1b 종결 시점부터 pre-existing — 본 cutover 무관 확정 (별도 처리 권장).
  - **Gate G3 진행률**: 5/5 path 중 **4/5 path cutover** (+ BuilderCore layout refresh).
- **2026-05-01 — Phase 2 G3 Step 5: Canvas drag/drop helper cutover land (1 PR 통합) → Phase 2 G3 종결 ✅**:
  - `**useCanvasDragDropHelpers.ts` doc build 2 site dual-mode\*\* — `findDropTarget` (drag mousemove 빈번 hot path, legacy: 매 호출 O(n) `selectCanonicalDocument`). canonical mode hit 시 `getActiveCanonicalDocument()` pre-built doc 직접 사용 → build cost 0. miss 시 legacy fallback `selectCanonicalDocument(state, pages, layouts)`. `buildReorderUpdates` (drop 시 1회 cold path) 도 동일 패턴 정합 유지.
  - **scope 분리** — `BuilderCanvas.tsx` 의 `useMemo` 캐싱된 doc build 2 site (`computeLayoutGroups` + `computeFrameAreas`) 는 deps 변경 시만 재계산 cold path → Step 5 scope 외, 미수정.
  - **검증** — type-check 3/3 + vitest canvas+canonical 224/224 PASS (회귀 0).
  - **Gate G3 진행률**: **5/5 path ✅ — Phase 2 G3 종결**.
  - **Phase 2 G3 종결 의의** — 5 hot path 모두 dual-mode cutover land 완료 (LayerTree + Selection/properties + Preview sync + BuilderCore layout refresh + canvas drag/drop helper). canonical store 가 read backbone — flag enabled 시 single source publish, flag disabled 시 legacy fallback (production 영향 0). 다음 진입점 = Phase 3 G4 — Persistence Write-Through (canonical primary storage 전환 + legacy export on demand).
- **2026-05-01 — Phase 2 G3 dev evidence 사용자 검증 + Phase 3 G4 design lock-in**:
  - **G3 dev evidence 사용자 검증 PASS** — `VITE_ADR116_DOCUMENT_SYNC=true` enable 후 Builder 진입. `currentProjectId === '<route projectId>'` ✅ + `documentVersion` 7→8→9→10 페이지 요소 추가마다 +1 증가 ✅. ADR-903 P3-E E-4 + ADR-113 P4 dry-run 모두 status=success errors=0. 5 hot path 회귀 0 — G3 monitoring 종결.
  - **Phase 3 G4 fork checkpoint 4 질문 통과 (design §8.0 lock-in)**: (1) base/응용 분류 = 3-A shadow write base / 3-B/C/D 응용, (2) schema 직교성 = read↔write 직교 단 D17=B 채택 시 G3 회귀 검증 의무, (3) baseline framing reverse = ADR-903 read-through ↔ ADR-116 primary SSOT reverse Phase 0 시점 lock-in 그대로 valid, (4) codex 3차 미루지 말 것 = D16~D19 lock-in 직후 codex 1차 진입.
  - **결정 분기 D16~D19 lock-in (design §8.2)**:
    - **D16=A** — 필수 API 3개 stub-first 단독 PR + 3-A logic 후속 별 PR (회귀 isolation, codex stub 단계 review 가능). D16=B 통합 / D16=C PoC-only 기각.
    - **D17=A** — localStorage 우선 canonical primary 전환 (DB schema 미변경, rollback 단순, G3 read path 회귀 0 보장). D17=B DB schema bump 은 3-D 시점 별개 진행 권장 / D17=C 동시 전환 분리 권장.
    - **D18=A** — `exportLegacyDocument(doc)` 단일 SSOT 격리 (grep gate 단순). D18=B cache layer 는 perf 별도 작업.
    - **D19=B** — schemaVersion bump + project-level rollback marker (`canRollback: boolean` + backup snapshot). D19=A bump-only 기각 (rollback 부재) / D19=C automated trigger 분리 권장.
  - **sub-phase 진입 순서 (design §8.3 확정)**: 3-A-stub (LOW ~30분-1h, 필수 API 3개 stub) → 3-A-impl (MED ~1d, 실 구현 + shadow logic) → 3-A monitoring (1-2주, destructive diff 0 확인) → 3-B (MED ~1d, localStorage primary + G3 read 회귀 재검증) → 3-C (LOW ~30분-1h, export adapter 단일 SSOT grep gate) → 3-D (MED ~1d, schemaVersion bump + rollback marker = G4 PASS 시그널).
  - **다음 진입점**: 3-A-stub 단독 PR — 필수 API 3개 (`exportLegacyDocument` / `diffLegacyRoundtrip` / `restoreFromLegacyBackup`) stub + vitest 시그니처 검증. codex 1차 review prerequisite 충족.
- **2026-05-01 — Phase 3 G4 sub-phase 3-A-stub / 3-A-impl / 3-B-3-D 단축 통합 land**: §8.3 step 1~6 sub-phase land. 3-A-stub (필수 API 3 stub + vitest 6) → 3-A-impl (`exportLegacyDocument` / `diffLegacyRoundtrip` / `restoreFromLegacyBackup` 실 구현 + `shadowWriteDiff` evaluator + vitest 25) → 3-B/3-C/3-D 단축 통합 (flag `VITE_ADR116_CANONICAL_PRIMARY` + BuilderCore backup bootstrap + grep gate codify baseline 18 + `_meta.schemaVersion` + `getCanonicalPrimaryStatus` helper). **G4 형식적 PASS 도달 (grep gate baseline 0)** — caller 16 site 가 wrapper 통해 호출. 단 wrapper 내부 진정 reverse 잔존 = drift #1.
- **2026-05-01 — Phase 4 G5 §9.3 strict logic-access PASS marker**: §9.3 grep gate 재정의 (raw → strict, comment/console/TS schema/canonical resolver bucket 분류) + `g5LegacyFieldGrepGate.test.ts` codify. raw 28 → strict 0. 단 진정 logic cleanup (instanceActions / ComponentSlotFillSection / editingSemantics) 은 ADR-111 P3 / ADR-113 P5 base ADR 영역 — ADR-116 G5 scope 외.
- **2026-05-01 — Phase 5 G6-1 Skia Runtime Parity closure**: read site cleanup 47 → 0 (100%). `legacyExtensionFields.ts` apps/builder + packages/shared 양쪽 helper land. dataBinding priority pattern 16 site + helper return type 정밀화 (`unknown` → `DataBinding | undefined`) + `'legacy-only'` priority + direct access 24 + apps/builder cast read 5 cleanup. 잔존 31 site 분석 (3 agent 병렬 dispatch) — 모두 cleanup 의도 외 영역 (write site / write-adjacent / already-resolved derived prop / type schema / comment).
- **2026-05-01 — Phase 5 G7 Extension Boundary closure marker**: events / dataBinding round-trip 보존 (`buildLegacyElementMetadata` + `exportLegacyDocument`) → `x-composition` extension only 본격 cutover → 직렬화 contract + write boundary 분류. metadata.legacyProps dual-storage 종결 — extension 이 단일 SSOT.
- **2026-05-02 — Phase 5 G6-2 first/second/third slice closure**: G6-2 first slice (Preview canonical 렌더 fallback, `extractLegacyPropsFromResolved` G6-1 정합) → G6-2 second slice (history parity 자동 cover, `canonicalDocumentSync` 회로 isolated evidence) → G6-2 third slice closure (DI pattern, `canonicalMutations.ts` ESM circular import 차단 — `useStore` import 제거 + `registerCanonicalMutationStoreActions` callback registration + BuilderCore mount 시점 1회 등록). vitest setup fail 영역 (`itemsActions` + `pagesLayoutInvalidation`) 10/10 PASS + canonical 광역 99/99 PASS + adapter canonical 175/175 PASS.
- **2026-05-02 — compatibility extraction deep cleanup**: `extractLegacyPropsFromResolved` 제거 → `extractCanonicalPropsFromResolved` 전환. resolver/storeBridge/Preview/canonicalElementsView/instanceActions/canonicalRefResolution/editingSemantics/canonicalMutations/exportLegacyDocument 는 `metadata.legacyProps` 를 props source 로 읽지 않고 `CanonicalNode.props` / `ResolvedNode.props` 만 사용한다. `g5LegacyFieldGrepGate` 에 runtime compatibility extraction 재도입 차단 gate 를 추가했다.
- **2026-05-02 — Phase 3 G4 wrapper 진정 reverse (§8.7) — drift #1 본질 해소** (commit `989e7afc2`):
  - **framing 정정 trigger**: §8.6 grep gate baseline 0 도달 = **형식적 PASS** (caller 16 site wrapper 통해 호출 ✅, wrapper 내부 legacy mutation primary ❌). drift #1 = HC #1 ("최종 SSOT 고정 = `CompositionDocument`") reverse 미도달 본질. 사용자 framing 정정 ("drift #1 선행 해소 의무") 후 wrapper 진정 reverse 본격 진입. monitoring 1-2주 framing 정정 — 시간 텀 자체가 mitigation 본질 아님, fixture coverage 가 본질.
  - **design §8.7 신규 보강** — sub-step β (monitoring trigger 선택) / γ (wrapper internal reverse) / δ (canonicalDocumentSync swap) 정의 + monitoring framing 정정 (시간 텀 본질 아님) + wrapper 5 ↔ canonical store action 매핑표 + 4 의문 정밀화 (mergeElements 신규/기존 분기 / setElements 전체 교체 시 pages/layouts 보존 / DB persist 와 in-memory 순서 / 무한 루프 방지) lock-in.
  - **canonicalMutations.ts wrapper 진정 reverse logic land** — `isCanonicalPrimaryEnabled()` flag 분기:
    - in-memory wrapper 2개 (`mergeElements` / `setElements`) reverse path: (1) 현재 legacy snapshot + 입력 elements merge (동일 id 면 입력으로 덮어쓰기) → (2) `legacyToCanonical(merged, deps)` full doc 재구성 → (3) canonical store `setDocument` push → (4) `exportLegacyDocument(doc)` 결과 legacy `setElements` mirror.
    - DB wrapper 3개 (`createElement` / `updateElement` / `createMultipleElements`) reverse 영향 없음 (D17=A 채택, schema 미변경, DB row = legacy export 결과).
    - DI pattern 확장 — `LegacySnapshot` type + `getCurrentLegacySnapshot` / `getCurrentProjectId` 2 callback 추가.
  - **canonicalDocumentSync.ts 방향 swap** — flag enable 시 sync 자체 disable (`currentProjectId` 만 set + listener 등록 skip + cleanup 시 reset). canonical primary path 에서는 wrapper 가 직접 양쪽 처리 → 무한 루프 방지.
  - **BuilderCore.tsx register 호출 확장** — 3 callback 추가 + deps `[projectId]` (route 이탈 시 자동 재등록).
  - **검증** — `pnpm turbo run type-check` 3/3 PASS + vitest canonical 광역 274/274 PASS + setup fail 영역 10/10 PASS + g5 + exportSsot grep gate 5/5 PASS (baseline 0 유지, wrapper 가 `apps/builder/src/adapters/**` exclude 영역 안 배치).
  - **Drift 상태 갱신**: drift #1 logic land ✅ (flag enable 시 canonical primary 활성) / drift #3 자동 충족 path 진입 (reverse path 가 `exportLegacyDocument` SSOT 사용). drift #2 (R4 mitigation framing) = 사용자 결정 영역 변동 없음.
  - **rollback 경로**: `VITE_ADR116_CANONICAL_PRIMARY=false` (default) — 기존 legacy primary path 그대로. 사용자 dev 환경 명시 enable 후 destructive=0 evidence 수집 (선택, fixture coverage 보강용).
- **2026-05-02 — direct cutover 정정 land (feature flag/backup/migration 제거)**:
  - 사용자 결정: 현재는 개발 단계이고 기존 사용자/데이터 보존 의무가 없으므로 `VITE_ADR116_DOCUMENT_SYNC`, `VITE_ADR116_CANONICAL_PRIMARY`, `VITE_FRAMES_TAB_CANONICAL`, backup/rollback API, runtime DB migration helper 를 유지하지 않는다.
  - 코드 정리: canonical sync 는 Builder 진입 시 항상 시작하고, in-memory mutation wrapper 는 항상 canonical primary path 로 동작한다. `restoreFromLegacyBackup`, `createMigrationBackup`, `runLegacyToCanonicalMigration`, `runTagTypeMigration`, `migrationP111` 계열 파일과 테스트를 삭제했다.
  - ADR-111 정리: `PanelSlot`/`BottomPanelSlot` 파일·컴포넌트·CSS class 를 `PanelArea`/`BottomPanelArea` 로 즉시 rename 하고, FramesTab/PageLayoutSelector read path 는 flag 없이 canonical reusable FrameNode projection 으로 고정했다.
  - ADR-113 정리: `normalizeLegacyElement` read-through helper 와 tag→type runtime migration path 를 제거했다. 기존 dev IndexedDB 의 tag-only row 는 보존 대상이 아니며, 신규/현행 format 은 `type` 단일 기준이다.
  - 검증: targeted vitest 7 files / 75 tests PASS (`persistenceWriteThroughStub`, `usePageManager.canonical`, `canonicalDocumentSync`, `exportSsotGrepGate`, `g5LegacyFieldGrepGate`, `FramesTab`, `canonicalElementsBridge`).
- **2026-05-02 — ADR-111/116 G5 first cleanup slice**:
  - `currentLayoutId` backward-compat alias 제거. Layout selection state 는 `selectedReusableFrameId` 단일 기준으로 고정했고, persist payload / fetch auto-select / create-delete selection update / iframe pageInfo / BuilderCore layout publish / ComponentsPanel add-element path 를 갱신했다.
  - 검증: targeted vitest 4 files / 19 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — ADR-111/116 G5 second cleanup slice**:
  - `PageLayoutSelector` page-frame binding write boundary 를 canonical adapter helper 로 이동했다. 컴포넌트는 더 이상 legacy `layout_id` field/persistence helper 를 직접 다루지 않고, `applyPageFrameBindingCanonicalPrimary()` 가 canonical document store 를 먼저 갱신한 뒤 current DB mirror 로 필요한 `pages.layout_id` payload 만 adapter 내부에서 persist 한다.
  - 전체 canonical document DB persistence/export pages adapter 는 아직 별도 후속이다. 이번 slice 의 범위는 legacy field write 를 component layer 밖 adapter boundary 로 격리하는 G5 cleanup 이다.
  - 검증: targeted vitest `pageFrameBinding.test.ts` + `PageLayoutSelector.static.test.ts` 2 files / 3 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — ADR-111/116 G5 third cleanup slice**:
  - `layoutActions` reusable frame cascade 의 legacy field 접근을 `frameLayoutCascade` canonical adapter 로 이동했다. create body 생성, duplicate subtree remap, delete page binding clear/element mirror persistence 는 adapter boundary 에 격리한다.
  - `deleteLayout` 은 canonical document 를 `nextPages + nextLayouts` 로 먼저 재구성하고 `exportLegacyDocument()` 결과를 live `elements` mirror 로 반영한다. current DB 의 `layout_id` payload 는 schema 유지용 mirror 로만 삭제/정리한다.
  - 검증: targeted vitest `layoutActions.test.ts` 1 file / 9 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — ADR-113/116 G5 descendants runtime gate**:
  - `descendants` 는 canonical core 필드이므로 raw grep 0 대신 allowlist gate 로 관리한다. 새 `adr113DescendantsGrepGate.test.ts` 가 adapter 밖 runtime access 를 canonical resolver/store/shared type validator 로 제한한다.
  - legacy `Element.descendants` direct access 는 adapter boundary 밖 runtime code 에서 0건으로 고정했다.
  - 검증: targeted vitest `adr113DescendantsGrepGate.test.ts` 1 file / 1 test PASS.
- **2026-05-02 — ADR-111/116 G5 fourth cleanup slice**:
  - Frame element read/hydration fallback 을 `frameElementLoader` canonical adapter 로 이동했다. `FramesTab`/`BuilderCore`/`usePageManager` 는 frame mirror load API 만 호출하고, legacy `layout_id` matching 은 adapter 내부로 격리한다.
  - 검증: targeted vitest `frameElementLoader.test.ts` + `pageFrameBinding.test.ts` + `FramesTab.static.test.ts` + `BuilderCore.static.test.ts` + `FramesTab.test.tsx` + `usePageManager.canonical.test.ts` 6 files / 29 tests PASS.
- **2026-05-02 — ADR-111/116 G5 fifth cleanup slice**:
  - properties/canvas runtime 의 frame membership 판정을 `isFrameElementForFrame()` adapter predicate 로 통일했다. `matchesLegacyLayoutId` direct import 는 `apps/builder/src/adapters/canonical/**` 내부만 남는다.
  - 검증: targeted vitest `frameElementLoader.test.ts` + `resolvePageWithFrame.test.ts` + `buildFrameRendererInput.test.ts` + `selectionHitTest.test.ts` + `useElementHoverInteraction.test.ts` + `ElementSlotSelector.test.tsx` + `usePresetApply.static.test.ts` 7 files / 36 tests PASS.
- **2026-05-02 — ADR-111/116 G5 sixth cleanup slice**:
  - Page/frame mirror id read/write helper 를 `frameMirror` canonical adapter 로 분리했다. `usePageManager` 의 page 생성/hydrate/frame element 추출과 `PageParentSelector`/`ElementSlotSelector`/`resolvePageWithFrame` 의 page-frame binding read 가 adapter API 를 경유한다.
  - 검증: targeted vitest `frameMirror.test.ts` + `pageFrameBinding.test.ts` + `usePageManager.canonical.test.ts` + `ElementSlotSelector.test.tsx` + `resolvePageWithFrame.test.ts` 5 files / 28 tests PASS.
- **2026-05-02 — ADR-111/116 G5 seventh cleanup slice**:
  - `useIframeMessenger` 와 `AddPageDialog` 의 page-frame mirror read/write 를 `frameMirror` adapter 로 전환했다. Preview payload 와 page URL preview 생성 경로에서 direct `legacyElementFields` import 를 제거했다.
  - 검증: targeted vitest `useIframeMessenger.canonical.test.ts` + `AddPageDialog.static.test.ts` + `frameMirror.test.ts` + `usePageManager.canonical.test.ts` 4 files / 19 tests PASS.
- **2026-05-02 — ADR-111/116 G5 eighth cleanup slice**:
  - Element ownership mirror read/write 를 `frameMirror` adapter 로 확장했다. factory/add, frame element tree, frame slot default insert, slider range thumb insert, multi-element copy, canvas delta sanitize, layout preset slot creation caller 의 direct `legacyElementFields` helper import 를 제거했다.
  - 검증: targeted vitest `frameMirror.test.ts` + `useElementCreator.test.ts` + `multiElementCopy.test.ts` + `elementCreationCanonical.test.ts` + `FrameSlotSection.test.tsx` + `FrameElementTree.test.tsx` + `usePresetApply.static.test.ts` 7 files / 45 tests PASS.
- **2026-05-02 — ADR-111/116 G5 ninth cleanup slice**:
  - Validation/properties/canvas layout/skia read hot path 의 frame ownership read 를 `frameMirror` adapter 로 전환했다. `useValidation`, `useErrorHandler`, `PropertiesPanel`, `LayoutBodyEditor`, `LayerTree` drop validation, `elements` page layout invalidation, canvas selection, layout publish/cache, full-tree layout, Skia overlay/selection/visible roots 의 direct ownership helper import 를 제거했다.
  - 검증: targeted vitest 13 files / 51 tests PASS.
- **2026-05-02 — ADR-111/116 G5 tenth cleanup slice**:
  - Store/canonical bridge 의 frame mirror write 를 `frameMirror` adapter 로 전환했다. `canonicalElementsView` derived view 와 `instanceActions` detach materialization 의 direct ownership write helper import 를 제거했고, G5 strict logic-access grep gate baseline 0 을 유지했다.
  - 검증 중 `instanceActions` canonical detach materialization 의 기존 `activeDescendants` 오타를 `activeLegacyDescendantMap` 으로 수정했다.
  - 검증: targeted vitest `canonicalElementsView.test.ts` + `instanceActions.test.ts` + `frameMirror.test.ts` + `g5LegacyFieldGrepGate.test.ts` 4 files / 46 tests PASS.
- **2026-05-02 — ADR-111/116 G5 eleventh cleanup slice**:
  - Project sync, layout template, Preview runtime 의 frame mirror read/write 를 `frameMirror` adapter 로 전환했다. `projectSync`, `layoutTemplates`, `CanvasRouter`, `CanonicalNodeRenderer`, preview layout resolver/App 의 direct `legacyElementFields` helper import 를 제거했다.
  - 검증: targeted vitest `frameMirror.test.ts` + `projectSync.layoutId.static.test.ts` + `layoutTemplates.static.test.ts` + `previewFrameMirror.static.test.ts` 4 files / 6 tests PASS.
- **2026-05-02 — ADR-113/116 G5 twelfth cleanup slice**:
  - Slot ownership mirror read/write 를 `slotMirror` adapter 로 분리했다. Properties panel, layout preset apply, page/frame resolver, preview slot resolution 은 `slot_name` mirror payload 를 direct legacy helper 로 읽거나 쓰지 않는다.
  - 검증: targeted vitest `slotMirror.test.ts` + `previewFrameMirror.static.test.ts` + `resolvePageWithFrame.test.ts` + `usePresetApply.static.test.ts` 4 files / 16 tests PASS.
- **2026-05-02 — ADR-113/116 G5 thirteenth cleanup slice**:
  - Component semantics mirror read/write 를 `componentSemanticsMirror` adapter 로 분리했다. `ComponentSlotFillSection`, editing semantics fixture, store bridge, instance lifecycle action 의 direct component marker helper import 를 제거했다.
  - `editingSemanticsFixture` 는 canonical export round-trip 이 raw dev evidence marker 를 제거하는 경로를 피하고 dev fixture payload 를 그대로 보존하도록 `setElements()` 경로를 사용한다.
  - 검증: targeted vitest `componentSemanticsMirror.test.ts` + `instanceActions.test.ts` + `ComponentSlotFillSection.test.tsx` + `editingSemanticsFixture.test.ts` + `storeBridge.test.ts` + `g5LegacyFieldGrepGate.test.ts` 6 files / 57 tests PASS.
- **2026-05-02 — ADR-113/116 G5 component mirror type schema / fixture cleanup**:
  - `Element` / shared `Element` type schema 에서 `componentRole` / `masterId` / legacy `overrides` 선언을 제거하고, legacy component mirror payload 타입을 `legacyElementFields` adapter boundary 의 `ElementWithLegacyMirror` 로 격리했다.
  - non-adapter component semantics fixture 는 `withComponentOriginMirror()` / `withComponentInstanceMirror()` 로 전환했다. raw `componentRole` / `masterId` fixture grep 은 0건이다.
  - `g5LegacyFieldGrepGate.test.ts` 는 shared type schema 재도입과 non-adapter raw role/id fixture 재도입을 함께 차단한다.
  - 검증: targeted vitest 7 files / 65 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — ADR-113/116 G5 frame/slot type schema / targeted fixture cleanup**:
  - Builder/shared/preview Element/Page/Preview type schema 에서 `layout_id` / `slot_name` 선언을 제거하고, dead `ElementLayoutFields` / `PageLayoutFields` 를 삭제했다.
  - frame body/render root 와 slot assignment regression fixture 는 `withFrameElementMirrorId()` / `withSlotMirrorName()` helper 로 전환했다. targeted raw `layout_id:` / `slot_name:` fixture grep 은 0건이다.
  - `g5LegacyFieldGrepGate.test.ts` 가 frame/slot type schema 재도입과 targeted raw fixture key 재도입을 차단한다.
  - 검증: targeted vitest 5 files / 30 tests PASS + type-schema grep 0건 + targeted fixture grep 0건.
- **2026-05-02 — ADR-113/116 G5 fourteenth cleanup slice**:
  - `packages/shared` export schema/element utilities 의 내부 helper naming 을 mirror terminology 로 정리했다. `layout_id`/`slot_name` mirror field 는 현재 export schema boundary 에만 남긴다.
  - 검증: `pnpm run codex:preflight` PASS.
- **2026-05-02 — ADR-116 projection removal fifteenth cleanup slice**:
  - Preview runtime 은 Builder 가 보낸 `UPDATE_CANONICAL_DOCUMENT` 를 저장하고 `App.tsx` 에서 수신된 `CompositionDocument` 를 직접 `resolveCanonicalDocument()` 한다. Preview 렌더 경로의 `legacyToCanonical()` 호출은 0건으로 제거했다.
  - Canvas drag/drop helper 와 BuilderCanvas layout/frame memo 는 `selectCanonicalDocument()` rebuild 대신 active canonical document 를 사용한다. active document 가 아직 없으면 drag/drop reorder target/update 는 no-op 으로 빠져 projection fallback 을 재도입하지 않는다.
  - FramesTab/PageLayoutSelector/ComponentsPanel 의 visible panel read/add path 도 active canonical document 기준으로 전환했다. per-render `selectCanonicalDocument()` rebuild 는 수행하지 않는다.
  - 잔여 `selectCanonicalDocument()` / `legacyToCanonical()` 호출은 adapter, hydration/sync, element creation, frame cascade, store bridge, 테스트/문서 경계로 남아 있으며 다음 cleanup slice 의 대상이다.
  - 검증: targeted vitest 8 files / 25 tests PASS.
- **2026-05-02 — ADR-116 projection removal sixteenth cleanup slice**:
  - BuilderCore layout refresh/theme write-through/publish path 는 더 이상 caller level 에서 `selectCanonicalDocument()` 를 호출하지 않는다. refresh/publish 필터링은 `isFrameElementForFrame()` adapter 로 판정하고, theme write-through 는 active canonical document 가 있을 때만 적용한다.
  - `usePageManager.initializeProject` 는 hydrate 시 `allElements + pages + layouts` 로 canonical document 를 재구성하지 않고, project layouts snapshot id set + `getFrameElementMirrorId()` 로 frame elements 를 포함한다.
  - `elementCreation` history/reorder context 는 active canonical document 를 직접 읽고, `layoutActions.getLayoutSlots` 는 active canonical document 의 FrameNode.slot 을 직접 조회한다. 해당 caller/store action 경로의 `selectCanonicalDocument()` 호출은 제거했다.
  - 잔여 production 호출은 `canonicalDocumentSync`, `frameLayoutCascade`, `pageFrameBinding`, `storeBridge`, `elements.ts` adapter 정의로 축소했다.
  - 검증: targeted vitest 12 files / 60 tests PASS.
- **2026-05-02 — ADR-116 projection removal seventeenth cleanup slice**:
  - `usePageManager.initializeProject` 는 legacy snapshot hydrate 대신 `setElementsCanonicalPrimary()` 를 호출해 초기 project hydrate 도 canonical primary wrapper 를 통과한다.
  - `canonicalDocumentSync` 는 legacy `useStore`/`useLayoutsStore` subscribe 와 `selectCanonicalDocument()` projection sync 를 제거하고, active project id lifecycle marker 로만 남겼다. scheduler diagnostic API 는 no-op compatibility surface 로 유지한다.
  - `storeBridge.selectResolvedTree` 는 `elements/pages/layouts` snapshot 을 받지 않고 `CompositionDocument` 를 직접 resolve 한다. 테스트 fixture 도 legacy snapshot 생성 없이 canonical document fixture 로 전환했다.
  - `pageFrameBinding` 과 `frameLayoutCascade` 는 active canonical document 를 직접 갱신한다. page frame binding 변경, reusable frame 삭제, page binding clear 는 canonical document children 을 직접 교체/삭제하고, legacy page/elements payload 는 adapter mirror/persistence 경계에서만 생성한다.
  - production `selectCanonicalDocument()` 호출은 `elements.ts` adapter 정의와 문서/comment 경계만 남았다.
  - 검증: targeted vitest 7 files / 62 tests PASS.
- **2026-05-02 — ADR-116 projection removal eighteenth cleanup slice**:
  - `canonicalMutations` wrapper 내부 `legacyToCanonical()` full document rebuild 를 제거했다. `mergeElementsCanonicalPrimary` 는 active canonical document 에 incoming elements 를 legacy id 기준 upsert 하고, `setElementsCanonicalPrimary` 는 pages/layouts shell 을 만든 뒤 입력 elements 를 upsert 한다.
  - layout Slot element 는 native path 에서 `legacy-slot-hoisted` frame 으로 변환하고, page ref slot fill 은 referenced layout frame 의 slot path 를 찾아 `descendants[slotPath].children` 에 삽입한다.
  - `exportLegacyDocument()` 는 `RefNode.descendants[].children` 까지 DFS 순회해 page frame slot fill mirror 누락을 방지한다.
  - `exportSsotGrepGate` 는 ADR-112 dev-only editing semantics fixture 의 raw visual marker write 만 allowlist 로 분리했다. runtime/persistence write gate baseline 은 0을 유지한다.
  - runtime `legacyToCanonical()` 호출은 `elements.ts`/`index.ts` adapter 정의와 themes/variables/export 문서 comment 경계만 남았다.
  - 검증: targeted vitest 13 files / 141 tests PASS + adapters/canonical 전체 18 files / 185 tests PASS.
- **2026-05-02 — ADR-116 projection removal nineteenth cleanup slice**:
  - `elements.ts` 의 deprecated `selectCanonicalDocument()` selector 를 삭제해 legacy store snapshot → `legacyToCanonical()` projection entrypoint 를 production source 에서 제거했다.
  - production `selectCanonicalDocument()` 호출/정의는 0건이다. `legacyToCanonical()` 은 `apps/builder/src/adapters/canonical/index.ts` adapter import/export boundary 와 adapter 테스트/문서 경계에만 남긴다.
  - 검증: builder `tsc --noEmit` PASS + projection selector removal targeted vitest 17 files / 145 tests PASS.
- **2026-05-02 — ADR-116 G6-3 Slot/Ref/Descendants parity first slice**:
  - `canonicalMutations` native path 에 slot append semantics 와 full replace clear slot fixture 를 추가했다. 같은 page ref slot 에 반복 fill 되는 element 는 referenced frame slot path (`frame-body/content`) 아래 order 를 유지하고, `setElementsCanonicalPrimary()` 전체 교체에서 누락된 slot fill 은 `descendants` 에서 제거된다.
  - `exportLegacyDocument()` 는 export boundary 에서 canonical `props` / `reusable` / `ref` / `descendants` 기반 mirror payload 를 생성한다. events/dataBinding 은 `x-composition` extension 에서만 복원한다.
  - `resolveCanonicalDocument()` 는 RefNode resolve 결과의 top-level `type` 을 master type 으로 명시 고정해 Ref parity contract(`type:"ref"` 가 아니라 resolved master type) 를 보장한다.
  - 검증: canonical adapter/resolver/store targeted vitest 27 files / 358 tests PASS.
- **2026-05-02 — ADR-116 G6-3 Ref navigation parity second slice**:
  - `ComponentSemanticsSection` 의 `Go to component` 는 canonical reference alias helper (`resolveReference`) 로 origin 을 찾는다. origin id 뿐 아니라 `customId`, `componentName`, canonical `name`, metadata `customId`/`componentName` alias 가 navigation 대상이 된다.
  - origin impact 계산도 canonical `name` 과 metadata alias 를 포함해 `Select instances` 가 canonical ref alias 를 빠뜨리지 않는다.
  - 검증: editing semantics / Component semantics UI / instance detach targeted vitest 3 files / 50 tests PASS.
- **2026-05-02 — ADR-116 G6-3 Frame connection parity third slice**:
  - `PageLayoutSelector` / `FramesTab` 의 reusable frame option id 는 `getReusableFrameMirrorId()` 로 정규화한다. `metadata.layoutId` 가 없는 native canonical frame 은 frame id 그대로, `layout-<id>` prefix frame 은 mirror id 로 UI 선택값을 맞춘다.
  - `pageFrameBinding` 은 page ref 생성 시 active canonical document 의 reusable `FrameNode` 를 먼저 찾아 실제 `FrameNode.id` 를 `RefNode.ref` 로 사용한다. native frame 연결에서 `layout-${frameId}` broken ref 를 새로 만들지 않고, legacy-prefixed frame 은 mirror id → canonical id 로 매핑한다.
  - 검증: page frame binding / frame mirror / PageLayoutSelector / FramesTab targeted vitest 5 files / 22 tests PASS.
- **2026-05-02 — ADR-116 G6-3 Slot/Ref/Descendants/Frame parity completion sweep**:
  - G6-3 를 native slot descendants mutation, ref mirror export, resolver master-type parity, origin/instance navigation, frame binding id parity 까지 닫힌 runtime parity slice 로 고정했다.
  - `g6ParityCompletion.static.test.ts` 를 추가해 mutation/export/resolver/navigation/frame binding wiring 이 동시에 유지되는지 검증한다. ADR-111/113 legacy field quarantine 은 G6-3 runtime parity 와 분리된 잔여 cleanup 으로 유지한다.
  - 검증: G6-3 targeted vitest 9 files / 74 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Imports resolver parity first slice**:
  - `resolveCanonicalDocument()` 는 optional `ImportResolverContext` 를 받아 `CompositionDocument.imports` 의 `<importKey>:<nodeId>` ref 를 loaded import document 의 reusable node 로 resolve 할 수 있다. 외부 fetch/prefetch 는 아직 adapter/runtime 후속 경계로 남기고, resolver 는 동기 loaded document 만 소비한다.
  - resolver cache key 의 document version slot 에 imports fingerprint 를 포함한다. host `imports` map/source 와 loaded import document version 이 바뀌면 기존 resolved subtree cache hit 를 재사용하지 않는다.
  - 검증: canonical resolver/cache/storeBridge targeted vitest 3 files / 65 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Imports prefetch/cache registry second slice**:
  - `importRegistry` 를 추가해 `CompositionDocument.imports` source 를 async prefetch 하고, loaded import document 를 `ImportResolverContext` 로 동기 제공한다. fetcher 는 `ImportDocumentFetcher` 로 DI 가능하고, default fetcher 는 JSON `CompositionDocument` payload 만 허용한다.
  - registry 는 동일 importKey/source inflight request 를 dedupe 하고, loaded / loading / failed / idle status 와 실패 error 를 추적한다. `prefetchDocumentImports()` 는 일부 import 실패가 있어도 성공/실패 summary 를 반환한다.
  - `storeBridge.selectResolvedTree()` 의 기본 import context 를 shared import registry 로 연결하고, `prefetchResolvedTreeImports()` helper 를 노출했다. fetch/prefetch 와 render-time sync resolve 경계를 분리한 상태로 외부 `.pen` UI/URL 정책은 다음 slice 로 남긴다.
  - 검증: canonical import registry/resolver/cache/storeBridge targeted vitest 4 files / 72 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Preview import runtime third slice**:
  - Preview runtime 은 수신한 `CompositionDocument` 의 `imports` 를 shared import registry 로 prefetch 한다. import load 성공 시 version state 를 갱신해 같은 document 를 registry context 로 다시 resolve 한다.
  - `App.tsx` 의 dev resolve 와 canonical render resolve 는 모두 `resolveCanonicalDocument(canonicalDocument, undefined, canonicalImportRegistry)` 를 사용한다. Preview 렌더 중 legacy snapshot projection 은 계속 0건이다.
  - 검증: preview import runtime / canonical import registry/resolver/storeBridge targeted vitest 4 files / 57 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Import source URL policy fourth slice**:
  - default import fetcher 는 `resolveCompositionImportSource(source, baseUrl)` 로 source 를 fetch 직전에 정규화한다. relative/root/absolute same-origin URL 은 허용하고, empty source / non-http(s) protocol / cross-origin source 는 차단한다.
  - policy 는 default fetcher 경계에만 적용한다. 테스트/후속 adapter 는 `ImportDocumentFetcher` DI 로 명시적인 다른 source backend 를 붙일 수 있다.
  - 검증: preview import runtime / canonical import registry/resolver/storeBridge targeted vitest 4 files / 60 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Import namespace guard fifth slice**:
  - `importKey` namespace 는 `/^[A-Za-z][A-Za-z0-9_-]*$/` 로 제한하고 `__proto__` / `constructor` / `prototype` reserved object key 를 차단한다.
  - registry prefetch 는 invalid import key 를 fetcher 호출 전에 failed status 로 기록한다. resolver 는 invalid namespace ref (`bad:key:node`) 를 imported ref 로 해석하지 않고 broken local ref 로 둔다.
  - 검증: preview import runtime / canonical import registry/resolver/storeBridge targeted vitest 4 files / 62 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Import payload adapter sixth slice**:
  - `importPayloadAdapter` 를 추가해 fetched JSON payload 를 canonical `CompositionDocument` 또는 Pencil-style node tree 로 판별한다.
  - Pencil-style payload 는 top-level node 를 reusable canonical master 로 승격한다. `rectangle` / `frame` / geometry primitive 는 `frame`, `text` 는 `Text`, `icon_font` 는 `Icon`, note/prompt/context 는 `Text` 로 변환하고 원본 primitive type 은 metadata 에 보존한다.
  - default fetcher 는 same-origin URL policy 통과 후 JSON payload 를 canonical document 로 normalize 한 뒤 registry 에 loaded document 로 저장한다.
  - 검증: preview import runtime / canonical import registry/resolver/storeBridge targeted vitest 4 files / 64 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Import registry stale pruning seventh slice**:
  - `prefetchDocumentImports(doc)` 는 현재 `doc.imports` 에 없는 registry entry 를 retain 대상에서 제거한다. loaded / failed entry 뿐 아니라 pending request token 도 함께 지운다.
  - in-flight request 가 prune 이후 늦게 resolve 되어도 request token mismatch 로 registry 에 다시 loaded entry 를 저장하지 않는다.
  - 검증: preview import runtime / canonical import registry/resolver/storeBridge targeted vitest 4 files / 66 tests PASS.
- **2026-05-02 — ADR-116 G6-4 Imports parity completion sweep**:
  - G6-4 를 resolver loaded-import consumption, imports fingerprint cache invalidation, async prefetch/cache registry, Preview runtime prefetch, same-origin URL policy, namespace guard, canonical/Pencil payload adapter, stale registry pruning까지 닫힌 runtime slice 로 고정했다.
  - `importRegistry.test.ts` 에 completion static contract 를 추가해 fetch payload normalize, URL policy, stale pruning token guard, resolver namespace parse, Preview prefetch/resolve context wiring 이 동시에 유지되는지 검증한다.
  - 검증: preview import runtime / canonical import registry/resolver/storeBridge targeted vitest 4 files / 67 tests PASS.
- **2026-05-02 — ADR-111/116 legacy layout store removal**:
  - `apps/builder/src/builder/stores/layouts.ts` 와 `stores/utils/layoutActions.ts` 를 삭제했다. reusable frame CRUD/selection 의 in-memory SSOT 는 `canonicalFrameStore` + active `CompositionDocument` 이고, DB `layouts` row 는 persistence mirror 로만 남는다.
  - `frameActions` 는 `createReusableFrame` / `deleteReusableFrame` / `updateReusableFrameName` / `selectReusableFrame` 을 canonical document mutation + DB mirror write 로 수행한다. FramesTab, PageLayoutSelector, PageParentSelector, LayoutSlugEditor, AddPageDialog, ComponentsPanel, BuilderCanvas, BuilderCore, useIframeMessenger, usePageManager 는 더 이상 `useLayoutsStore` 를 import 하지 않는다.
  - 초기 hydrate 는 DB `layouts` mirror snapshot 을 `seedCanonicalReusableFrameLayouts()` 로 canonical reusable frame shell 에 먼저 seed 한 뒤 `setElementsCanonicalPrimary()` 로 elements 를 upsert 한다.
  - 검증: targeted vitest 11 files / 51 tests PASS + `pnpm run codex:preflight` PASS.
- **2026-05-02 — ADR-113/116 legacy field quarantine helper boundary cleanup**:
  - component semantics read-through helper (`isMasterElement` / `isInstanceElement` / `getInstanceMasterRef`) 를 `unified.types.ts` 에서 제거하고 `componentSemanticsMirror` adapter 경계로 이동했다.
  - `MasterChangeEvent` / `DetachResult.previousState` 의 legacy-style field 명칭은 `originId` / `overrideProps` / `descendantPatches` 로 전환했다.
  - strict non-adapter field-access grep 은 0건이며, `g5LegacyFieldGrepGate.test.ts` 가 unified types helper 재도입을 차단한다.
  - 검증: targeted vitest 5 files / 58 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — ADR-116 final SSOT closure**:
  - IndexedDB `DB_VERSION` 을 10으로 올리고 `documents` object store + `DatabaseAdapter.documents.{put,get,delete,getAll}` 를 추가했다. Builder hydrate 는 저장된 `CompositionDocument` 가 있으면 이를 먼저 canonical store 에 주입하고, legacy element rows 는 `exportLegacyDocument()` 로만 mirror 생성한다.
  - `BuilderCore` 는 active canonical document 변경을 debounce 하여 `db.documents.put(projectId, doc)` 으로 저장한다. page shell mutation 은 canonical document 를 즉시 갱신해 page 추가/삭제 경로가 legacy page store 에 머물지 않게 했다.
  - shared project export schema 는 `document: CompositionDocument` 를 필수로 검증하고, export/import utility 와 Publish import 타입은 `ProjectExportData.document` 를 기준으로 동작한다.
  - `Element` / shared `Element` schema 에서 legacy `descendants` mirror 선언까지 제거했고, broader non-adapter raw fixture key bucket (`layout_id:` / `slot_name:` / `componentRole:` / `masterId:`) 은 0건으로 닫았다. canonical `RefNode.descendants` 테스트는 합법 canonical field 로 유지한다.
  - 검증: ADR-116 persistence/export/schema targeted builder vitest 5 files / 29 tests PASS, fixture cleanup targeted vitest 14 files / 130 tests PASS, shared export canonical project vitest 1 file / 3 tests PASS, `pnpm run codex:typecheck` PASS.
- **2026-05-02 — ADR-116 residual legacy projection removal final slice**:
  - shared export/import 는 canonical-only payload 로 고정했다. `ProjectExportData` / `ExportedProjectSchema` / `serializeProjectData` / `parseProjectData` 는 `document` 만 싣고 legacy-only `pages`/`elements` payload 를 거부한다.
  - Publish/Preview static HTML 은 필요한 render model 을 `CompositionDocument` 에서 in-memory derive 하며, serialized payload 에 `pages`/`elements` 를 유지하지 않는다.
  - Builder hydrate 는 `db.documents.get(projectId)` 만 canonical seed 로 사용한다. 저장 document 부재 시에도 DB `pages`/`elements`/`layouts` fallback 으로 canonical document 를 재구성하지 않는다.
  - DB batch export/import 에서 `pages`/`elements` projection 을 제거했고, runtime migration `_meta` store/API, `getByLayout` adapter/type surface, `layout_id` index 생성, shared legacy adapter type stub, shared element `layout_id`/`slot_name` utility 를 삭제했다.
  - 검증: shared export canonical project vitest 1 file / 4 tests PASS + builder residual projection vitest 5 files / 16 tests PASS.

## Context

ADR-903은 `CompositionDocument` canonical format, `reusable/ref/descendants/slot` 문법, resolver-first migration을 도입했고, ADR-110은 `themes`/`variables`를 canonical document에 land했다. ADR-111/112/113/114는 그 후속 영역인 frame/slot authoring, editing semantics, `tag -> type`, hybrid field cleanup, imports resolver를 나누어 처리했다. 2026-04-30 기준 ADR-114 독립 계획은 superseded 처리하고, 잔여 `imports` resolver/cache 범위는 본 ADR의 canonical document boundary로 흡수한다.

전환 전 runtime/persistence 구조는 **canonical document가 최종 SSOT가 아니라 read-through projection**에 가까웠다. `elements[] + pages[] + layouts[]`에서 매번 `CompositionDocument`를 만들고, legacy 필드(`layout_id`, `slot_name`, `componentRole`, `masterId`, legacy `overrides/descendants`)를 canonical 의미로 역해석했다. 이 상태는 format 전환기의 완충책으로는 유효했지만, 최종 구조가 되면 성능과 의미 충돌을 계속 만든다.

이 ADR은 기존 후속 ADR들을 폐기하지 않고, 그 위에 **최종 목표를 명확히 고정**했다. 최종 기준은 Pencil 원본 `.pen` schema도, legacy `elements[]` store도 아니다. 최종 기준은 Composition component vocabulary를 유지하는 `**CompositionDocument` canonical schema\*\*다.

**Hard Constraints**:

1. **최종 SSOT 고정** — 저장/편집/렌더/history/preview/publish의 장기 기준은 `CompositionDocument`여야 한다. legacy `elements[]`는 adapter/import/export/migration 경계로 내려간다.
2. **Pencil 원본 schema 비채택** — `frame/ref/descendants/slot` 구조는 Pencil과 정합하지만, `Button`, `Section`, `TextField` 같은 Composition component vocabulary와 Spec/D1-D3 체인은 유지한다.
3. **Component props 위치 확정** — `Button`, `TextField`, `Section` 같은 component semantics는 `metadata.legacyProps`가 아니라 `CanonicalNode.props?: Record<string, unknown>`에 저장한다. `metadata.legacyProps`는 transition adapter 출력일 뿐 최종 SSOT가 아니다.
4. **Hot path projection 금지** — drag, selection, canvas render, preview sync, layer tree update 같은 고빈도 경로에서 `legacyToCanonical()` 전체 문서 재구성을 호출하지 않는다.
5. **Core vs extension 경계 명시** — canonical core에는 문서 구조 문법과 component props만 둔다. Composition app behavior(`events`, `actions`, `dataBinding`, editor state)는 namespaced extension으로 분리한다.
6. **신규 format 직접 전환** — 개발 단계에서는 기존 프로젝트 read-through/rollback 보장을 목표로 두지 않는다. 신규 write는 canonical document를 우선하고, legacy payload는 export/adapter 경계에서만 생성한다.
7. **역방향 adapter 명시** — canonical primary 저장으로 전환하기 전에 `CompositionDocument -> legacy elements[]/pages[]/layouts[]` export adapter와 roundtrip 검증이 존재해야 한다.
8. **시각/데이터 회귀 0** — 전환 후 기존 샘플 프로젝트와 사용자 프로젝트의 Skia/Preview/Publish 렌더 결과와 slot/ref editing semantics가 보존되어야 한다.
9. **ADR-063 경계 유지** — D1(RAC DOM/접근성), D2(RSP Props/API), D3(Spec 시각) SSOT는 canonical document 하위 consumer로 유지하고, 본 ADR은 그 상위 document/source model만 다룬다.

**Soft Constraints**:

- feature flag, backup, runtime DB migration 없이 direct cutover 한다. 검증은 targeted fixture/grep/type-check 로 대체한다.
- ADR-111/113의 기존 phase와 ADR-114의 historical imports scope를 최대한 재사용하되, 최종 cutover gate는 본 ADR에서 통합 관리한다.
- 임시 adapter 최적화는 허용하지만 최종 목표로 삼지 않는다.

## Alternatives Considered

### 대안 A: Legacy `elements[]` 유지 + canonical adapter 강화

- 설명: 현재처럼 legacy store를 SSOT로 두고, `legacyToCanonical()` projection과 resolver cache를 개선한다.
- 근거: 단기 구현량이 작고 기존 저장/스토어/Undo 경로 변경이 적다.
- 위험:
  - 기술: MED — adapter/renderer/store가 계속 양방향 의미 변환을 알아야 한다.
  - 성능: HIGH — 전체 문서 projection이 hot path로 재유입될 위험이 남는다.
  - 유지보수: HIGH — legacy field와 canonical field가 계속 공존한다.
  - 마이그레이션: LOW — destructive migration은 피할 수 있다.

### 대안 B: Pencil `.pen` schema 그대로 채택

- 설명: Composition 내부 저장 format을 Pencil primitive schema에 맞춘다.
- 근거: 외부 Pencil 호환성과 import/export 단순성이 가장 높다.
- 위험:
  - 기술: HIGH — Composition의 component/spec/RAC vocabulary와 primitive scenegraph가 충돌한다.
  - 성능: MED — primitive 변환 layer가 별도로 필요하다.
  - 유지보수: HIGH — Button/TextField/Section 같은 component semantics 손실을 adapter가 계속 복구해야 한다.
  - 마이그레이션: HIGH — 기존 component-centric 데이터의 의미 손실 위험이 크다.

### 대안 C: `CompositionDocument` canonical schema를 최종 SSOT로 전환

- 설명: Composition component vocabulary를 유지한 canonical document를 저장/편집/렌더의 최종 기준으로 승격한다. Pencil 구조 필드는 정합하게 유지하고, Pencil primitive와 app behavior는 adapter/extension으로 분리한다.
- 근거: ADR-903/110/111/113의 실제 전환 방향과 일치하고, format 변경의 목적을 완료 상태까지 밀어붙인다.
- 위험:
  - 기술: MED — canonical document mutation API, history, persistence, preview bridge를 재정렬해야 한다.
  - 성능: LOW — cutover 후 hot path의 legacy projection 제거가 가능하다.
  - 유지보수: LOW — document/source model이 하나로 줄어든다.
  - 마이그레이션: HIGH — 저장/편집/history/preview/publish 경계 전환 범위가 크다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | ---------- |
| A    | MED  | HIGH | HIGH     | LOW          | 2          |
| B    | HIGH | MED  | HIGH     | HIGH         | 3          |
| C    | MED  | LOW  | LOW      | HIGH         | 1          |

대안 C도 migration HIGH가 남지만, 이 위험은 단계별 shadow write/read gate로 관리 가능하다. 대안 A는 현재 문제를 고착시키고, 대안 B는 Composition의 component model을 손상시킨다.

## Decision

**대안 C: `CompositionDocument` canonical schema를 최종 SSOT로 전환**을 선택한다.

선택 근거:

1. format 변경의 목적이 reusable/ref/descendants/slot/frame을 문서 문법으로 승격하는 것이므로, 최종 기준도 문서-네이티브 schema여야 한다.
2. legacy `elements[]`를 최종 SSOT로 두면 `layout_id`, `slot_name`, `componentRole`, `masterId`를 계속 canonical 의미로 변환/역해석해야 한다.
3. Pencil 구조 정합은 유지하되 Pencil primitive schema를 그대로 채택하지 않아야 Composition의 React Aria/Spectrum + Spec component model을 보존할 수 있다.
4. 성능 문제의 근본 처리는 adapter cache가 아니라 hot path에서 legacy projection 자체를 제거하는 것이다.

기각 사유:

- **대안 A 기각**: migration 완충책으로는 유효하지만 최종 구조가 되면 현재 hybrid 비용과 의미 충돌을 영구화한다.
- **대안 B 기각**: Pencil 호환성은 높지만 Composition의 component-centric schema와 충돌한다.

### ADR fork checkpoint (4 질문 lock-in)

`adr-writing.md` §"ADR Fork / 분리 결정 시 framing checkpoint" 의무에 따라, 본 ADR fork 시점에 4 질문을 명시적으로 통과 후 Phase 진입한다.

1. **base / 응용 분류**: 본 ADR (ADR-116) = canonical SSOT 추상 base. ADR-111 (frame-bundled preset 편의 확장) / ADR-113 (`tag → type` rename + hybrid 6 cleanup) / ADR-114 (imports resolver, Superseded) = 응용 specialization. base 가 응용의 prerequisite.
2. **schema 직교성**: canonical core (`children`/`type`/`props`/`reusable`/`ref`/`descendants`/`slot`/`frame`/`themes`/`variables`/`imports`) ⊥ Composition extension (`x-composition.events`/`actions`/`dataBinding`/`editor`) ⊥ legacy adapter (`layout_id`/`slot_name`/`componentRole`/`masterId`/legacy `overrides`/`metadata.legacyProps`) ⊥ Pencil primitive schema. 4 영역 모두 직교.
3. **baseline framing reverse 검증**: ADR-903 의 "canonical = read-through projection" framing 을 본 ADR 이 "canonical = primary SSOT" 로 reverse 한다. 이 reverse 가 valid 한 사유 — (a) ADR-903 의 read-through 는 format 도입을 위한 transition bridge 였고, hot path projection 영구화 의도가 아님 (R2 직접 명시). (b) ADR-110/111/112/113 가 ADR-903 위에 차곡차곡 쌓이면서 canonical document 가 이미 사실상 운영 SSOT 로 성장. legacy `elements[]` 가 SSOT 로 남으면 hybrid 비용이 영구화 (대안 A 기각 사유와 동일). (c) ADR-903 자체의 final cutover gate 가 미정의 상태로 남아 본 ADR 이 그 closure ADR. 따라서 reverse 는 base ADR 의 의도된 후속 결정이며, ADR-903 framing 의 위반이 아닌 완성.
4. **codex 3차까지 미루지 말 것**: framing #3 reverse 정당화는 본 §Decision 시점 lock-in. Phase 0 G1 land 와 동시에 codex 1차 review 진입. 본문 정합 (Risk/Gate 매핑) 은 codex round 에 위임하되, framing reverse 의 valid 성은 본 시점 본문에 명문화한다.

> 구현 상세: [116-canonical-document-ssot-transition-breakdown.md](../design/116-canonical-document-ssot-transition-breakdown.md)

## Risks

| ID  | 위험                                                                                                         | 심각도 | 대응                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------- |
| R1  | canonical document mutation API가 저장/history/undo 경계를 한 번에 바꾸면서 runtime 회귀를 만들 수 있음      | HIGH   | Phase 1 API + unit test, Phase 3 canonical primary wrapper, targeted fixture/grep/type-check 로 즉시 검증       |
| R2  | `legacyToCanonical()` 또는 `selectCanonicalDocument()`가 drag/selection/render hot path에 계속 남을 수 있음  | HIGH   | G3에 hot path projection 0건 grep gate를 두고, cold path/adapter-only 예외를 파일 경로로 제한                   |
| R3  | `events`/`dataBinding`/`actions`가 canonical core에 섞여 Pencil-compatible 구조 경계를 흐릴 수 있음          | MED    | `x-composition` extension namespace를 먼저 고정하고, function callback serialize를 금지                         |
| R4  | ADR-111/113/114가 각자 cleanup을 진행하면서 최종 cutover 기준이 다시 흩어질 수 있음                          | HIGH   | ADR-116 G5를 상위 closure gate로 두고 README row와 각 ADR phase 상태를 동시 갱신                                |
| R5  | legacy field quarantine이 과도하게 빨리 진행되어 현행 Builder 경로가 깨질 수 있음                            | HIGH   | 사용자 데이터 보존 대신 runtime test/grep gate를 우선하고, 깨지는 경로는 canonical adapter boundary로 즉시 수렴 |
| R6  | canonical primary 전환 후 Skia/Preview/Publish 중 한 경로만 다른 tree를 소비할 수 있음                       | MED    | G6에서 3경로 parity matrix와 history/slot/ref 시나리오를 함께 검증                                              |
| R7  | component props가 `metadata.legacyProps`에 계속 남아 canonical document가 사실상 legacy wrapper가 될 수 있음 | HIGH   | G1에서 `CanonicalNode.props`를 shared type에 추가하고, `metadata.legacyProps`는 adapter-only로 제한             |

## Gates

| Gate                          | 시점    | 통과 조건                                                                                                                            | 실패 시 대안                        |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| G1: Schema Boundary Freeze    | Phase 0 | canonical core, `CanonicalNode.props`, Composition extension, legacy adapter field 분류표가 타입/문서에 고정됨                       | Phase 1 진입 보류                   |
| G2: Canonical Store/API       | Phase 1 | `CompositionDocument` read/write/mutation API와 canonical -> legacy export adapter API가 `elements[]` 직접 mutation 없이 테스트 가능 | adapter write-through 유지          |
| G3: Hot Path Cutover          | Phase 2 | drag/selection/render/LayerTree/Preview sync 경로에서 full `legacyToCanonical()` 호출 0건                                            | 해당 경로 fixture 보강 후 수정      |
| G4: Persistence Write-Through | Phase 3 | 신규 저장은 canonical document 우선, legacy 저장은 adapter/export 경계로만 유지                                                      | canonical wrapper 수정              |
| G5: Legacy Field Quarantine   | Phase 4 | `layout_id`, `slot_name`, `componentRole`, `masterId`, legacy `overrides/descendants`가 adapter 디렉터리 밖 runtime read/write 0건   | 필드별 cleanup sub-phase 재분리     |
| G6: Runtime Parity            | Phase 5 | Skia/Preview/Publish/History/Undo/Redo/slot fill/ref detach 샘플 회귀 0건                                                            | fixture 보강 후 canonical 경로 수정 |
| G7: Extension Boundary        | Phase 5 | `events`, `actions`, `dataBinding`이 canonical core가 아닌 namespaced Composition extension으로만 serialize됨                        | extension schema 보강               |

## Consequences

### Positive

- document/source model의 최종 기준이 명확해진다.
- Pencil식 `frame/ref/descendants/slot` 구조와 Composition component vocabulary를 동시에 유지한다.
- legacy-to-canonical projection 비용을 hot path에서 제거할 수 있다.
- slot fill, detach, override reset, origin/ref 관계를 schema 기준으로 판단할 수 있다.
- import/export adapter와 내부 저장 format 경계가 분리된다.

### Negative

- 저장, history, preview bridge, renderer input, LayerTree, properties panel까지 전환 범위가 넓다.
- 전환 기간에는 canonical document와 legacy adapter가 계속 병행된다.
- ADR-111/113/114의 잔여 phase와 의존 관계를 다시 정렬해야 한다.
- extension namespace를 확정하기 전까지 events/dataBinding schema를 성급히 core에 넣을 수 없다.

## References

- [ADR-903: ref/descendants + slot 기본 composition 포맷 전환 계획](903-ref-descendants-slot-composition-format-migration-plan.md)
- [ADR-110: Canonical `themes`/`variables` 필드 Land Plan](110-canonical-themes-variables-land-plan.md)
- [ADR-111: Layout/Slot Frameset 완전 재설계](111-layout-frameset-pencil-redesign.md)
- [ADR-112: Editing Semantics UI 6요소 + Slot section base](112-editing-semantics-ui-5elements.md)
- [ADR-113: `Element.tag -> Element.type` rename + hybrid 6 필드 cleanup](113-tag-type-rename-hybrid-cleanup.md)
- [ADR-114: `imports` resolver + DesignKit 통합](114-imports-resolver-designkit-integration.md) — Superseded; 잔여 `imports` resolver/cache scope 는 본 ADR 이 흡수
- `[CompositionDocument` 타입](../../packages/shared/src/types/composition-document.types.ts)
- [Legacy `Element` 타입](../../apps/builder/src/types/builder/unified.types.ts)
- [Legacy -> canonical adapter](../../apps/builder/src/adapters/canonical/index.ts)
- [Pencil copy clean-room mapping](../pencil-copy/composition-mapping.md)
