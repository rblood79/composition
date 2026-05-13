# ADR-132: useCollectionData useAsyncList 정합 + data_tables sink 통일

## Status

Proposed — 2026-05-13

진행 로그:

- 2026-05-13 — ADR 본문 발의 (Proposed) + design breakdown land

## Context

### 3-domain 분류 (ADR-063 정합)

본 ADR 은 [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) 의 D1 (DOM/접근성) / D2 (Props/API) / D3 (시각 스타일) 중 **어느 직접 영역에도 속하지 않는 data flow architecture layer** 결정이다. 단 D1 / D2 와 간접 연계 — RAC/RSC collection 컴포넌트 (Table / ListBox / GridList / ComboBox / Select / Tree) 의 `items` prop 흐름이 D1 (RAC 절대 권위) 의 정통 RSP `useAsyncList` 패턴을 따라야 한다는 제약.

### 문제 framing

[ADR-131 Phase 8 revert (2026-05-13)](completed/131-events-data-actions-first-class-collections.md) 가 lock-in 한 사용자 framing — **"RAC/RSC 컴포넌트에서 사용되는 data 의 SSOT = `data_tables`. `Element.dataBinding` 은 element 별 binding reference"** — 의 직접 후속.

`useCollectionData` (read 진입점 hook) 현 코드의 PropertyDataBinding `source="api"` 분기는:

1. `useAsyncList` 정통 RSP 패턴을 **우회** — 별도 `useEffect` + `apiEndpointData` local useState 로 데이터 보관 (`packages/shared/src/hooks/useCollectionData.tsx:317-437`)
2. `data_tables` 를 **우회** — `executeApiEndpoint` 호출 후 결과를 `data_tables.runtimeData` 에 sink 하는 정합 경로 (Builder 측 `dataActions.ts:executeApiEndpoint` Line 605) 가 있는데도, useCollectionData 측은 별도 local state 에 결과 보관
3. Canvas 측은 더 강한 우회 — `/api/proxy` 직접 fetch (line 365-391), `executeApiEndpoint` 미사용, 결과는 local state

이 우회 패턴은 다음 문제를 발생시킨다:

- **중복 호출**: 같은 endpoint 를 2개 element 가 참조 시 element 별 useCollectionData hook 인스턴스 2회 fetch (LRU cache 보조하지만 mount 시점 race)
- **Staleness**: `data_tables.runtimeData` 갱신이 useCollectionData 측 local state 에 반영 안 됨 (reload trigger 명시 호출 시만)
- **mental model 분기**: source="dataTable" 분기는 dataTables 경유, source="api" 분기는 우회 — 같은 hook 안 2 패턴
- **RSP 정통 패턴과의 괴리**: RSP `useAsyncList` 의 load callback 안에서 모든 분기를 처리하는 정합이 흐트러져, 코드 추적 비용 ↑ + 신규 source 추가 시 어디에 박을지 모호

### Hard Constraints

1. **RAC/RSC read 진입점 단일**: collection 컴포넌트가 `useCollectionData` 한 hook 으로 모든 source (`dataTable` / `api` / Legacy `static` / Legacy `api` / `supabase` deferred) 를 동일 인터페이스로 read 가능
2. **data_tables sink 통일**: API endpoint 실행 결과는 반드시 `data_tables.runtimeData` 거쳐 read (사용자 framing — [[project-data-tables-ssot-framing]])
3. **RSP `useAsyncList` 정통 패턴**: `useAsyncList.load` callback 안에서 모든 분기 종결, `list.items` 단일 read 진입점
4. **기존 schema 보존**: `data_tables` / `api_endpoints` / `Element.dataBinding` type 변경 없음 (read 흐름만 정합)
5. **Canvas iframe 호환**: Builder ↔ Canvas 양쪽 동일 fetcher 사용 (DI 가능하면) 또는 분기 명시 lock-in

### Soft Constraints

- Legacy collection (`type:"collection"`) 사용 element 의 마이그레이션 cost — Phase 0 inventory 시 사용 빈도 측정 후 결정
- `apiEndpointData` 류 local state 제거 시 reload UX 동등성 (`list.reload()` 대체 가능 검증)
- `collectionDataCache` LRU 가 `data_tables.runtimeData` 갱신과 staleness 충돌 가능성 — Phase 4 영역
- `executeApiEndpoint` 의 `signal: AbortSignal` 지원 여부 — Phase 0 inventory 시 확인, 미지원 시 추가

### baseline grep (Phase 0 inventory 시 commit hash 와 함께 frozen 예정)

- `apiEndpointData|setApiEndpointData` direct site count
- `loadStaticData|loadApiData` 호출 path (useAsyncList load callback 내부 vs 외부)
- `isCanvasContext|/api/proxy` 분기 site
- `binding\.source === "api"|"dataTable"` 분기 site
- 컴포넌트 read 진입점 (Table / ListBox / GridList / ComboBox / Select / Tree / Breadcrumbs) → useCollectionData 호출 chain

## Alternatives Considered

### 대안 A: useAsyncList load callback 단일화 + data_tables sink 통일 (사용자 framing 정합)

- **설명**: PropertyDataBinding `source="api"` 분기를 `useAsyncList.load` 안으로 흡수. `useEffect` + `apiEndpointData` useState 삭제. load callback 안에서 source 별 분기 처리 → `source="api"` 시 `executeApiEndpoint` 호출 → `targetDataTable.runtimeData` read. `source="dataTable"` 시 directly `dataTables.find(name).runtimeData` read. 결과 모두 `list.items` 단일 출구
- **근거**:
  - RSP `useAsyncList` 정통 패턴 ([react-aria.adobe.com/collections](https://react-aria.adobe.com/collections) 의 Asynchronous loading 섹션) 정합
  - 사용자 framing 명시 lock-in ([[project-data-tables-ssot-framing]] + 2026-05-13 본 세션 explicit confirm)
  - `executeApiEndpoint` 가 이미 `targetDataTable.runtimeData` sink 하므로 useCollectionData 측은 read 만 하면 자연 정합
  - mental model 단순화 — read 진입점은 모든 source 에 대해 `useAsyncList.list.items`
- **위험**:
  - 기술: **LOW** — RSP 정통 패턴 검증 완료, 흡수 패턴은 표준
  - 성능: **LOW** — local useState 삭제로 re-render trigger 감소. cache 는 LRU 유지
  - 유지보수: **LOW** — 단일 hook 인터페이스, 신규 source 추가 시 load callback 안 분기만
  - 마이그레이션: **MEDIUM** — `apiEndpointData` 의존하는 외부 caller 가 있을 경우 surface 측정 필요 (Phase 0 inventory)

### 대안 B: PropertyDataBinding api source 분기를 dataTables direct read 로 (useAsyncList 거치지 않음)

- **설명**: PropertyDataBinding api source 의 useEffect 를 유지하되, 결과를 local state 가 아닌 dataTables Zustand store 의 `setRuntimeData` 로 push. useCollectionData 의 final read 는 dataTables.runtimeData direct (현재 source="dataTable" 분기 패턴 확장)
- **근거**: data_tables sink 정합만 충족, useAsyncList 자체는 손대지 않음
- **위험**:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — 두 분기 (source="dataTable" / source="api") 가 같은 직접 read 패턴 — 정합. 단 useAsyncList load callback 의 dual purpose (Legacy collection 만 처리 vs PropertyDataBinding 도 처리) 모호
  - 마이그레이션: LOW
  - **본질 한계**: RSP `useAsyncList` 정통 패턴과의 괴리 잔존 — Legacy collection 흐름만 useAsyncList 거치고 PropertyDataBinding 흐름은 우회. 사용자 framing 의 "RSP 레퍼런스 방식 사용" 충족 약함

### 대안 C: 현 상태 유지 (no-op) + 외부 cache layer 만 보강

- **설명**: useEffect + apiEndpointData useState 패턴 유지, collectionDataCache LRU 만 강화하여 중복 호출 / staleness 완화
- **근거**: 변경 minimal, 회귀 위험 0
- **위험**:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — 본질 mental model 분기 잔존, 신규 source 추가 시 useEffect / useAsyncList 어디에 박을지 매번 결정. RSP 정통 패턴 ↔ composition 패턴 영구 괴리
  - 마이그레이션: LOW
  - **본질 한계**: 사용자 framing 정합 부재 — "RAC/RSC read 진입점은 data_tables 통일" 미충족. ADR-131 Phase 8 revert 의 후속 framing 정합 약속 무산

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 | 본질 한계             |
| :--: | :--: | :--: | :------: | :----------: | :--------: | :-------------------- |
|  A   |  L   |  L   |    L     |      M       |     0      | 없음                  |
|  B   |  L   |  L   |    M     |      L       |     0      | RSP 정통 괴리         |
|  C   |  L   |  L   |    H     |      L       |     1      | 사용자 framing 미충족 |

- HIGH+ 보유: 대안 C 만 (유지보수 HIGH)
- 모든 대안이 HIGH+ 1개 이상이 아님 → 위험 회피용 신 대안 추가 불필요
- 대안 A 가 HIGH+ 0개 + 본질 한계 없음 → 채택

## Decision

**대안 A 채택** — useAsyncList load callback 단일화 + data_tables sink 통일.

> 구현 상세: [132-usecollectiondata-useasynclist-alignment-breakdown.md](design/132-usecollectiondata-useasynclist-alignment-breakdown.md)

### framing checkpoint 4 질문 lock-in (M2 — 사용자 explicit confirm 2026-05-13)

| #   | 질문                          | 답변                                                                                                                                                                                      |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류              | **응용 ADR**. `data_tables` / `api_endpoints` / `Element.dataBinding` SSOT 는 코드 자연 발생 (명시 base ADR 없음, ADR-131 Phase 8 revert framing 으로 lock-in). 본 ADR 은 read 경로 정합. |
| 2   | schema 직교성                 | type / schema 변경 없음, read 흐름만 정합. ADR-131 events/actions root collection 과 직교 (schema 겹침 0).                                                                                |
| 3   | baseline framing reverse 검증 | ADR-131 Phase 8 revert framing 의 직접 후속. 의존 방향 정방향 (ADR-131 prerequisite → 본 ADR 후속). reverse 검토 시 본 ADR 이 선행했어야 할 가능성 = 0.                                   |
| 4   | codex 3차 미루지 말 것        | scaffold 단계 4 질문 lock-in + 사용자 explicit confirm 통과. codex 1차 review 진입은 Phase 1 본문 land 시점.                                                                              |

### 기각된 대안의 기각 사유

- **대안 B**: data_tables sink 만 정합되고 RSP `useAsyncList` 정통 패턴 괴리 잔존. 사용자 framing "RSP 레퍼런스 방식 사용" 충족 약함.
- **대안 C**: 사용자 framing (data_tables 통일 + RSP 정합) 미충족. 본질 mental model 분기 영구 잔존, 신규 source 추가 시 매번 위치 결정 burden.

## Risks

| ID  | 위험                                                                                         | 심각도 | 대응                                                                                                                                                     |
| :-: | :------------------------------------------------------------------------------------------- | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | useAsyncList load 안 dataTables Zustand selector 접근 패턴 fragile (closure 캡처 stale 가능) |  MED   | hook subscribe + closure read 표준화. [[feedback-zustand-selector-cache]] 적용. dataTables 변경 시 `useEffect(() => list.reload(), [dataTablesVersion])` |
| R2  | Canvas iframe 측 `executeApiEndpoint` DI 미주입 가능성                                       |  MED   | Phase 0 inventory 에서 `apiEndpointService` DI Context 주입 site 확인. 미주입 시 Phase 3 에서 Canvas 측 분기 잔존 또는 DI 추가                           |
| R3  | `collectionDataCache` 가 `data_tables.runtimeData` 갱신과 staleness 충돌                     |  LOW   | dataTables Zustand subscribe + cache invalidate or list.reload                                                                                           |
| R4  | Legacy collection (`type:"collection"`) 사용 element 의 mass migration burden                |  LOW   | Phase 0 inventory 에서 사용 빈도 측정. 0 또는 < 5건 시 (a) 흐름 유지, 그 외 시 별 ADR fork                                                               |
| R5  | `reloadTrigger` 호출처의 UX 회귀                                                             |  LOW   | grep + `list.reload()` 치환                                                                                                                              |

잔존 HIGH 위험 0건.

## Gates

| Gate         |                    시점                     | 통과 조건                                                                                                                                                                                    | 실패 시 대안                                                                                     |
| :----------- | :-----------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| G1 (Phase 1) |        useAsyncList 단일화 land 직후        | `grep apiEndpointData packages/shared apps/builder` = 0건 + useEffect 안 fetch 호출 0건 + useAsyncList load callback 안 api 분기가 `executeApiEndpoint` → `targetDataTable.runtimeData` read | useAsyncList 안 load 안에서 dataTables selector 접근 패턴 검증, 실패 시 list.reload trigger 패턴 |
| G2 (Phase 2) |     Legacy collection 사용 빈도 측정 후     | `type:"collection"` AND `source:"api"` 사용 element grep = 0 또는 < 5건 → 흐름 유지 결정 lock-in                                                                                             | ephemeral data_tables sink 또는 별 ADR fork (Phase 0 inventory 결과 기반)                        |
| G3 (Phase 3) |         Canvas 분기 통합 land 직후          | Canvas / Builder 양쪽 `executeApiEndpoint` 거친 후 data_tables.runtimeData read 정합                                                                                                         | Canvas 분기 잔존 lock-in (DI 미주입 시)                                                          |
| G4 (Phase 4) | cache + dataTables subscribe 정합 land 직후 | dataTables.runtimeData 변경 시 useCollectionData hook list 가 reload 되거나 cache invalidate 됨 (실 동작 smoke)                                                                              | cache key 에 dataTables version 포함                                                             |
| G5 (Phase 5) |           Status Implemented 직전           | 모든 G1-G4 통과 + type-check 3/3 + vitest PASS + Chrome MCP smoke 5 컴포넌트 PASS                                                                                                            | 미해결 Gate 실패 시 Phase 별 rollback                                                            |

## Consequences

### Positive

- `useCollectionData` 단일 hook 안 source 별 분기가 `useAsyncList.load` 한 곳으로 수렴 → 추적 / 신규 source 추가 비용 ↓
- `data_tables.runtimeData` 단일 sink → 같은 endpoint 의 다중 element 참조 시 중복 호출 LRU + Zustand subscribe 두 layer 로 자연 차단
- 사용자 framing ("RAC/RSC read 진입점은 data_tables 통일") 정합 → ADR-131 Phase 8 revert framing 의 후속 약속 land
- RSP `useAsyncList` 정통 패턴 정합 → 향후 RAC/RSC 버전 upgrade 시 정합 비용 ↓

### Negative

- 기존 `apiEndpointData` 의존 caller 가 있을 경우 surface 변경 (Phase 0 inventory 측정)
- useAsyncList load callback 안 dataTables selector closure 패턴이 fragile 한 경우 list.reload trigger useEffect 추가 (1-2 line cost)
- Canvas 측 `executeApiEndpoint` DI 미주입 시 Phase 3 분기 잔존 가능성 (Phase 0 inventory 후 결정)
- Legacy collection 사용 element 가 예상보다 많을 경우 별 ADR fork 의무 (consolidation-burden 차단 카테고리 적용)
