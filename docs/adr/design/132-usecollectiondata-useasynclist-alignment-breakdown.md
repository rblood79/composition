# ADR-132 design breakdown — useCollectionData useAsyncList 정합 + data_tables sink 통일

> 본 문서는 [ADR-132](../132-usecollectiondata-useasynclist-alignment.md) 의 구현 상세. ADR 본문에는 framing 결정 + 잔존 위험 + Gate 만, 본 문서는 Phase 분해 / 파일 목록 / 체크리스트 / 코드 예시.

## §1 framing checkpoint 4 질문 lock-in (M2 — 사용자 explicit confirm 2026-05-13)

| #   | 질문                              | 답변                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **base / 응용 분류**              | **응용 ADR**. `data_tables` (Zustand `useDataStore.state.dataTables`) + `api_endpoints` (fetcher 정의) + `Element.dataBinding` (binding reference) 의 SSOT 는 이미 코드 자연 발생 (명시 base ADR 없음, ADR-131 Phase 8 revert framing 으로 lock-in). 본 ADR 은 read 경로 (`useCollectionData`) 가 그 SSOT 를 우회한 분기를 RSP `useAsyncList` 정통 패턴으로 정합. |
| 2   | **schema 직교성**                 | 본 ADR 은 read 흐름 정합만. `data_tables` / `api_endpoints` / `Element.dataBinding` 의 type / schema 변경 없음. `apiEndpointData` 류 local useState 삭제 + `loadStaticData` / `loadApiData` 내부 흐름 재배선만. ADR-131 events/actions root collection 과 직교 (schema 겹침 0).                                                                                   |
| 3   | **baseline framing reverse 검증** | ADR-131 Phase 8 revert framing ("data_tables = 데이터 단일 SSOT, RAC/RSC read 진입점은 `useCollectionData({ datatableId \| dataBinding })`") 의 **직접 후속**. 의존 방향 정방향 (ADR-131 prerequisite → 본 ADR 후속). reverse 검토: ADR-131 보다 본 ADR 이 선행했어야 할 가능성 = 0 (Phase 8 revert 가 본 framing 의 trigger).                                    |
| 4   | **codex 3차 미루지 말 것**        | scaffold 단계에서 본 4 질문 lock-in + 사용자 explicit confirm 통과. codex 1차 review 진입은 Phase 1 본문 land 시점.                                                                                                                                                                                                                                               |

**차단 메모리 평가** (메모리 충돌 우선순위 표 — MEMORY.md):

- [[feedback-no-derived-adr-mid-execution]] **N/A** — ADR-131 Implemented 상태, mid-execution 아님
- [[feedback-adr-consolidation-burden-not-essence]] **통과** — 사용자가 scope W1 only 로 명시 (AI tool W3 / publish W4 는 별 ADR 분리 권장)
- [[feedback-pr-vs-direct-push]] **준수** — 각 Phase 는 main 직접 push
- [[feedback-external-reference-first]] **통과** — RSP Dynamic Collections + `useAsyncList` 외부 reference (vendor 자체) 기반, self-contained 해법 회피
- [[feedback-adr-revert-after-review-fatigue]] **차단 적용** — Phase 1 land 시점부터 codex review N차 신 HIGH 결함 발견 시 3 질문 자기 차단 (impl 시점 ad-hoc 가능? / lock-in hard 가치? / 원본 framing scope 동일?)

## §2 Phase 0 — inventory baseline freeze

### 대상 파일

- `packages/shared/src/hooks/useCollectionData.tsx` (메인 hook, shared layer)
- `apps/builder/src/builder/hooks/useCollectionData.ts` (builder layer, 거의 mirror — DI 측면 차이)
- `packages/shared/src/hooks/collectionDataContext.tsx` (DI Context)
- `packages/shared/src/hooks/useCollectionDataCache.ts` (LRU cache)
- `packages/shared/src/types/dataBinding.types.ts` (관련 type)

### baseline grep (Phase 0 lock-in 시 HEAD hash 와 함께 frozen)

```bash
# 1. PropertyDataBinding api source 직접 fetch 분기 위치
grep -n "apiEndpointData\|setApiEndpointData" packages/shared/src/hooks/useCollectionData.tsx apps/builder/src/builder/hooks/useCollectionData.ts

# 2. useAsyncList load callback 안 loadApiData / loadStaticData 호출
grep -n "loadStaticData\|loadApiData" packages/shared/src/hooks/useCollectionData.tsx apps/builder/src/builder/hooks/useCollectionData.ts

# 3. isCanvasContext 분기 (Canvas direct fetch vs Builder executeApiEndpoint)
grep -n "isCanvasContext\|/api/proxy" packages/shared/src/hooks/useCollectionData.tsx apps/builder/src/builder/hooks/useCollectionData.ts

# 4. PropertyDataBinding source enum 사용처 ("dataTable" / "api" string literal)
grep -rn 'source: ["\x27]\(dataTable\|api\)["\x27]\|binding\.source ===' packages/shared/src/hooks apps/builder/src/builder/hooks

# 5. processedData 우선순위 4-tier (dataTableData / apiEndpointData / datatableState / list.items)
grep -n "processedData\|dataTableData\|apiEndpointData\|datatableState" packages/shared/src/hooks/useCollectionData.tsx
```

### Phase 0 산출물

- `docs/adr/132-baseline.md` (또는 design 문서 §2 inline) 에 grep 결과 + 라인 표 + HEAD hash freeze
- 통계: PropertyDataBinding api source 분기 LOC, useAsyncList load callback LOC, local useState 개수
- 컴포넌트 read 진입점 dependency 다이어그램 1장
- **frozen 수치 lock-in (adr-writing.md 동적 seed #3 BC 수식화 충족 의무)**:
  - `apiEndpointData` / `setApiEndpointData` / `apiEndpointLoading` / `apiEndpointError` site count (예상 shared 5 + builder 6 = 11 site)
  - `reloadTrigger` 호출처 site count (예상 0-3 site, grep 후 확정)
  - `loadStaticData` / `loadApiData` 사용 element 측정 (Legacy collection 사용 빈도 — R4 평가용)
  - RAC renderer 측 useCollectionData caller site count (Table / ListBox / GridList / ComboBox / Select / Tree / Breadcrumbs)
  - `apiEndpointService` DI Context Canvas 측 주입 site (R2 검증용)
  - `executeApiEndpoint` 의 `signal: AbortSignal` 파라미터 지원 여부 (Soft Constraint line 47)

### Phase 0 commit

`docs(adr-132): Phase 0 inventory baseline freeze`

## §3 Phase 1+ 분해

### Phase 1 — useAsyncList load callback 단일화 (sink read 통일)

**목표**: PropertyDataBinding `source="api"` 분기를 `useAsyncList.load` callback **안으로 흡수**. 별도 `useEffect` + `apiEndpointData` useState 삭제.

**핵심 변경**:

```ts
// Before — useEffect + setApiEndpointData (Line 317-437)
useEffect(() => {
  if (binding.source !== "api") return;
  // ... isCanvasContext 분기 → fetch / executeApiEndpoint
  setApiEndpointData(items);
}, [...]);

// After — useAsyncList load callback 단일화 + error surface 패턴
const list = useAsyncList({
  async load({ signal }) {
    // throw 시 useAsyncList 가 list.error 에 자동 sink, list.isLoading false 로 전환
    // RAC collection 컴포넌트는 list.error / list.isLoading 을 prop binding (Table renderState / ListBox renderEmpty 등)
    if (propertyBindingFormat) {
      const binding = stableDataBinding;
      if (binding.source === "dataTable") {
        const rows = resolveDataTableRows(binding.name);
        if (rows === null) throw new Error(`DataTable not found: ${binding.name}`);
        return { items: rows };
      }
      if (binding.source === "api") {
        const endpoint = apiEndpoints.find(ep => ep.name === binding.name);
        if (!endpoint) throw new Error(`endpoint not found: ${binding.name}`);
        if (!endpoint.targetDataTable) throw new Error(`endpoint.targetDataTable missing: ${binding.name}`);
        // signal: AbortSignal 전파 (Phase 0 inventory 에서 executeApiEndpoint 지원 확인 후)
        await apiEndpointService.executeApiEndpoint(endpoint.id, { signal });
        const rows = resolveDataTableRows(endpoint.targetDataTable);
        if (rows === null) throw new Error(`targetDataTable not found after execute: ${endpoint.targetDataTable}`);
        return { items: rows };
      }
    }
    // Legacy collection 흐름 유지
    if (dataBinding?.type === "collection") {
      if (dataBinding.source === "static") return { items: await loadStaticData(dataBinding) };
      if (dataBinding.source === "api") {
        // Legacy api collection 도 data_tables sink 거치도록 정합
        return { items: await loadLegacyApiData(dataBinding, signal) };
      }
    }
    return { items: [] };
  },
});

// RAC consumer 측 error UX binding (예시)
// <Table ... renderState={list.error ? <ErrorRow message={list.error.message} /> : null}
//        renderEmptyState={() => list.isLoading ? <Spinner /> : <Empty />}>
```

**삭제 대상**:

- `apiEndpointData` / `apiEndpointLoading` / `apiEndpointError` useState 3개 (line 310-314)
- PropertyDataBinding api 분기의 `useEffect` 블록 (line 317-437)
- `processedData` 우선순위 chain 중 `apiEndpointData` tier (line 502-514)
- `reloadTrigger` useState (대신 `list.reload()` 사용)

**유지**:

- `dataTableData` useMemo (line 277-304) — `source="dataTable"` direct read, useAsyncList 거치지 않아도 OK (sync read). 단, `processedData` 우선순위 chain 도 함께 단순화 — 사용자 framing "read 진입점은 data_tables" 충족
- `collectionDataCache` LRU — useAsyncList load 안에서 cache hit 시 즉시 반환

**검증**:

- type-check 3/3 PASS (apps/builder baseline 변동 가능, 측정)
- vitest 기존 PASS 유지
- Storybook / Chrome MCP smoke — Table / ListBox / GridList / ComboBox / Select 의 api source binding element 5종 read 정상
- **error surface smoke (R6 대응)**: 3 케이스 검증 — (1) `endpoint not found` (잘못된 binding.name), (2) `fetch fail` (네트워크 에러 mock), (3) `abort` (component unmount mid-fetch). 각 케이스에 RAC `list.error` / `list.isLoading` 이 collection 컴포넌트 error UX prop 으로 적절히 binding 되는지 확인

**Phase 1 Gate**:

- G1: `grep apiEndpointData packages/shared apps/builder` = **0건**
- G2: `useEffect` 안 fetch 호출 = **0건** (useAsyncList load callback 안만)
- G3: useAsyncList load callback 의 api 분기가 `executeApiEndpoint` 거친 후 targetDataTable.runtimeData read

### Phase 2 — Legacy collection api source 의 data_tables sink 정합

**목표**: `type:"collection", source:"api"` 의 `loadApiData()` 가 결과를 `list.items` 에 직접 반환하는 대신, `data_tables` 의 ephemeral row 에 sink 후 read 하도록 정합.

**문제**: Legacy collection 은 `endpoint` 개념이 없고 `config.baseUrl + endpoint + dataMapping` 인라인 정의. `data_tables` row 가 없으므로 sink 대상 부재.

**대안**:

- (a) Legacy collection api source 사용 element 의 `dataBinding` 을 PropertyDataBinding 형식으로 마이그레이션 권장 (사용자 UI 가이드), 본 ADR scope 에서는 기존 흐름 유지
- (b) Legacy collection api 결과를 ephemeral data*tables row (예: `\_\_legacy*${elementId}`) 로 sink — 임시 SSOT 정합

**Phase 2 잠정 결정**: (a) — Legacy collection 은 사용 element 0건 또는 적은 수 가정 (Phase 0 inventory 에서 grep `type: "collection"` 카운트 확정 후 재평가). (b) 가 필요하면 별 ADR.

**Phase 2 commit**: `feat(adr-132): Phase 2 — legacy collection sink decision lock-in`

### Phase 3 — Canvas vs Builder isCanvasContext 분기 통합

**목표**: Canvas 측 직접 proxy fetch (line 365-391) 와 Builder 측 `executeApiEndpoint` (line 393-395) 의 분기를 단일 경로 (`executeApiEndpoint`) 로 통합.

**전제**: Canvas iframe 에서 `executeApiEndpoint` 호출 가능한가 — `apiEndpointService` DI Context 가 Canvas 측에서도 주입되어 있는가 확인 (Phase 0 inventory 항목).

**기대**: Canvas 측에서도 동일 fetcher → `data_tables.runtimeData` sink. 양쪽 동시 호출 cache 충돌 없음 (`data_tables.runtimeData` 가 single source).

**Phase 3 Gate**:

- G3-1: Canvas 측 read 가 `data_tables.runtimeData` 에서 가져오는지 확인 (`syncDataTablesToCanvas` postMessage 경유)
- G3-2: `isCanvasContext` 분기 제거 또는 단순화

### Phase 4 — collectionDataCache 의 data_tables 정합 검증

**목표**: `collectionDataCache` LRU 가 `data_tables.runtimeData` 와 staleness 충돌 없는지 검증. dataTables Zustand subscribe → 변경 시 cache invalidate 필요.

**의문**: data_tables.runtimeData 가 갱신될 때 useCollectionData hook 의 `list` 가 reload 되는가? — useDataStore 의 dataTables Map 이 selector 로 subscribed 되어 있고 변경 시 hook re-render → useAsyncList load 재실행되어야 함.

**Phase 4 commit**: `feat(adr-132): Phase 4 — collectionDataCache + dataTables subscribe 정합`

### Phase 5 — Status Implemented + README + CHANGELOG

- ADR Status `Proposed → Implemented`
- `docs/adr/README.md` ADR-132 entry 갱신
- `docs/CHANGELOG.md` 신 엔트리

## §4 Gate matrix (Risk ↔ Gate 1:1 매핑)

| Risk                                                                                                                  | Phase | Gate | 통과 조건                                                                                                                        | 실패 시 대안                                                                                                             |
| :-------------------------------------------------------------------------------------------------------------------- | :---: | :--- | :------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| R1 (useAsyncList load 안에서 dataTables Zustand selector subscribe 가능한가 — load 는 async fn 안이라 hook 호출 불가) |   1   | G1   | dataTables / apiEndpoints / endpointService 모두 useAsyncList 바깥에서 hook subscribe + load callback 안에서는 closure 로 access | dataTables 변경 시 `list.reload()` 명시 trigger (useEffect 1 line)                                                       |
| R2 (executeApiEndpoint 가 Canvas 측에서 호출 가능한가 — DI Context 격리)                                              |   3   | G3-1 | `apiEndpointService` DI Context 가 Canvas 측 useCollectionData provider 에 주입되어 있음                                         | Canvas 측은 기존 proxy fetch 유지, Builder 측만 정합 (분기 잔존)                                                         |
| R3 (collectionDataCache 가 data_tables 갱신 시 stale 가능)                                                            |   4   | G4   | dataTables Zustand selector subscribe → 변경 시 cache invalidate or list.reload                                                  | cache key 에 dataTables version 포함                                                                                     |
| R4 (Legacy collection api source 사용 element 가 0건이라는 가정 깨질 경우 mass migration 필요)                        |   2   | G2   | Phase 0 inventory grep `type: "collection"` AND `source: "api"` element 사용 빈도 측정, 0건 또는 < 5건 시 (a) 유지               | (b) ephemeral data_tables sink 또는 별 ADR fork                                                                          |
| R5 (PropertyDataBinding api source element 가 reload UX 회귀 — 기존 reloadTrigger 사용자 노출 surface 어디)           |   1   | G1-2 | reload UX 가 `list.reload()` 로 동작 동등                                                                                        | `reloadTrigger` 호출처 모두 `list.reload()` 로 치환                                                                      |
| R6 (useAsyncList load callback throw 시 RAC/RSC error surface 처리 — happy path 외 검증 누락 가능성)                  |   1   | G1-3 | error surface 3 케이스 (endpoint not found / fetch fail / abort) Storybook + Chrome MCP smoke PASS                               | RAC `list.error` / `list.isLoading` 미binding 시 collection 컴포넌트 error UX 미작동 — Phase 1 land 차단 후 binding 보강 |

## §5 잔존 운영 위험 (Risks)

| ID  | 위험                                                                                            | 심각도  | 대응                                                                                                                                                                                                                                                                       |
| :-: | :---------------------------------------------------------------------------------------------- | :-----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | useAsyncList load 안 dataTables selector 접근 패턴 fragile (closure cache + subscribe fallback) | **MED** | hook subscribe + closure read 패턴 표준화. [[feedback-zustand-selector-cache]] (selector cache 함정) + [[feedback-zustand-subscribe-with-selector-fragility]] (subscribeWithSelector middleware fallback) 양쪽 검토. useDataStore 는 subscribeWithSelector middleware 사용 |
| R2  | Canvas iframe 측 executeApiEndpoint DI 미주입 가능성                                            | **MED** | Phase 0 inventory 에서 DI Context 주입 site 확인 후 Phase 3 진입                                                                                                                                                                                                           |
| R3  | collectionDataCache staleness + Canvas postMessage timing race                                  | **LOW** | dataTables subscribe + list.reload 패턴. Canvas 측은 `syncDataTablesToCanvas` postMessage 수신 후 list.reload trigger                                                                                                                                                      |
| R4  | Legacy collection 사용 element mass migration burden                                            | **LOW** | Phase 0 inventory 확정 후 평가, 본 ADR scope 내 단일 결정 lock-in                                                                                                                                                                                                          |
| R5  | reloadTrigger UX 회귀                                                                           | **LOW** | 사용처 grep + list.reload 치환                                                                                                                                                                                                                                             |
| R6  | useAsyncList load throw 시 RAC/RSC error surface 처리 (list.error / list.isLoading binding)     | **MED** | Phase 1 핵심 변경 시 error surface 패턴 명시 (§3 Phase 1 code 예시 참조) + 3 케이스 smoke (endpoint not found / fetch fail / abort)                                                                                                                                        |

잔존 HIGH 위험 0건.

## §6 검증 흐름

각 Phase 마다:

1. type-check 3/3 (apps/builder + packages/shared + apps/publish)
2. vitest 관련 영역 PASS (`packages/shared/src/hooks/__tests__/useCollectionData.test.tsx` 신규 또는 기존)
3. Chrome MCP smoke — Table / ListBox / GridList / Select / ComboBox 의 dataBinding element 실 동작 (data_tables UI 편집 → canvas 반영 / API endpoint 실행 → canvas 반영)
4. codex review N차 — 통과 시 main 직접 push

## §7 scope 경계 명시

**본 ADR 안**:

- `packages/shared/src/hooks/useCollectionData.tsx` 전수
- `apps/builder/src/builder/hooks/useCollectionData.ts` 전수
- `packages/shared/src/hooks/collectionDataContext.tsx` (DI 영향만)
- `packages/shared/src/hooks/useCollectionDataCache.ts` (Phase 4 영향만)

**본 ADR scope 밖** (별 ADR 발의):

- AI tool `createElement.ts` 의 `element.dataBinding.config` 직접 endpoint 박는 패턴 정정 (W3)
- apps/publish 의 `ProjectData` 직렬화 정합 (W4)
- DataPanel UI 의 정적 입력 / API 결과 표시 UX 개선
- Element.dataBinding type 의 source enum 정합 (현 `static/api/supabase/state/parent` 5종 enum 의 valid 여부 재평가)
