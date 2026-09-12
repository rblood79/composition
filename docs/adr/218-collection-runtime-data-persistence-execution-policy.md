# ADR-218: collection 런타임 데이터 영속 · 실행 정책

## Status

Proposed — 2026-09-12

## Context

빌더의 collection(DataTable)은 스키마 + `mockData`(샘플) + `runtimeData`(API 마지막 응답)로 구성된다. 두 가지가 미완성이다:

- **runtimeData 가 memory-only** — `types/builder/data.types.ts:82-83` 주석대로 "메모리에만 존재, DB에 저장 안함". set 경로(`stores/utils/dataActions.ts:209` · `:297` · `:740`)는 전부 Zustand `newMap.set` 만 하고 IndexedDB adapter(`lib/db/indexedDB/adapter.ts:564-598`)를 호출하지 않는다. 그래서 세션을 다시 열면 API 응답이 사라지고, 재실행 전까지 캔버스는 샘플로 돌아가거나 빈 상태가 된다 (§4-0 원칙 4 "무증상 실패 금지" 와 어긋남).
- **collection-level 실행 정책이 없다** — API 실행 진입은 이미 여럿이다: Send 버튼(`ApiEndpointEditor.tsx:122`) · agent 명령(`services/agent/dataAgentCommands.ts:96`) · endpoint 역조회 실행(`BuilderCore.tsx:897-911`) · legacy API binding 의 interval(`packages/shared/src/hooks/useCollectionData.tsx:517-530`). 그러나 **collection 이 "언제 갱신되는가"를 결정하는 정책 필드는 없다** — 사용자가 자동/수동/주기를 고를 수 없고, legacy binding interval 은 collection 소스와 분리된 별개 경로다. API 연결 collection 을 쓰려면 매번 편집기를 열어 Send 해야 한다 (리서치 §4-2 UX-6).

이 둘은 ADR-212(Data 패널 편집기 재설계, Implemented 2026-09-12)가 **collection 저장 형식 불변**(lock-in §2, 사용자 confirm 2026-09-11)을 지키느라 명시적으로 이월한 항목이다. 본 ADR 은 그 lock-in 을 **저장 형식 확장**으로 재정의하고 두 항목을 구현한다.

**Domain 분류**: 본 ADR 은 **데이터 모델 layer**(ADR-152 base 계열)의 확장이다 — 컴포넌트 3-domain(D1 DOM/D2 Props/D3 시각)의 변경이 아니다. 유일한 사용자 표면인 Settings "데이터 소스" UI 는 빌더 도구 UI(RAC 그대로 사용 — D1 준수)이며 Preview/Publish 대응물이 없다.

**Hard Constraints**:

1. **저장 형식 확장은 하위 호환** — 신규 필드는 optional. 기존 프로젝트(executionPolicy 미설정)는 로드 시 현행 동작(manual)을 그대로 유지한다. read 호환 필수.
2. **쓰기는 전부 `applyDataChange`**(ADR-152 §2-3) — 영속·정책 쓰기가 store 를 직접 mutate 하지 않는다. runtimeData 는 History 밖(캐시), 정책 필드는 History 안.
3. **secret·번들** — runtimeData 영속이 export envelope(ADR-209)·preview `postMessage`·AI payload 에 원문 secret 을 새로 싣지 않는다. 응답 데이터의 export 포함 여부는 명시 정책으로 고정하고 산출물 검사로 지킨다. 편집기 lazy 경계(ADR-212 HC5) 유지 — initial Builder chunk 증가 0.
4. **캐시 유효성 (h1)** — 별도 store 의 runtimeData 는 collectionId 만으로 복원해선 안 된다. 캐시는 자신을 만든 **source/schema revision** 을 함께 저장하고, hydration 시 현재 collection 의 revision 과 불일치하면 폐기(무효)한다. field rename 은 캐시를 함께 변환(값 보존, 152 G4 계약과 일치), endpoint 교체·`responseMapping` 변경·스키마 구조 변경(필드 추가/삭제/타입)은 revision 불일치로 무효화한다. Undo/Redo 로 스키마가 되돌아가도 revision 재계산으로 유효성이 결정된다.
5. **요청 경쟁 (h2)** — 타이머 정리만으로는 늦은 응답의 덮어쓰기를 막지 못한다. collection 별 **실행 세대(runSeq)** 로 single-flight 를 건다: 새 실행은 진행 중 요청을 abort 하고 seq 를 올리며, 완료 응답은 자신의 seq === 현재 seq 일 때만 store·캐시에 쓴다(stale 무시). interval 해제·페이지 전환·정책 변경은 진행 중 요청 abort + 완료돼도 seq 불일치로 무시. hydration(세션 로드)은 seq 0 기준이고 첫 새 응답이 덮어쓴다.
6. **실행 정책 런타임 누수 0** — `interval` 정책은 정리 훅으로 타이머 leak 0. `measurement-validity` Q2(불리 케이스 = 대용량 응답·interval 누적·A/B 역순 완료)·Q4(정책이 실제 실행 경로에 배선).
7. **i18n** — 신규 문자열은 `datatable.*` 키 ko/en(ADR-200).
8. **스냅 패널 어법**(ADR-212 HC2) — Settings 데이터 소스 UI 는 팝오버/모달 생성 화면을 새로 만들지 않는다.

**Soft Constraints**:

- runtimeData 응답은 대용량일 수 있다(수천 행) — collection 레코드에 그대로 실으면 IDB·export 크기가 부풀고 collection 목록 로드가 무거워진다.
- publish 는 "빌더 안정화 후" 방침 — 서버 프록시 실행은 범위 밖(경고 표시까지).
- ADR-212 가 남긴 자산: Settings 탭·`executeApiEndpoint`·`apiRuns`·`useMockData` 토글은 재사용.

## Alternatives Considered

### 대안 A: collection 레코드에 두 필드 직접 추가 (runtimeData 영속 + executionPolicy)

- 설명: `DataTable` 에 `executionPolicy?` 를 더하고, runtimeData set 경로가 adapter `collections.update` 를 호출해 레코드에 함께 영속. 저장 형식을 정면으로 확장.
- 근거: 가장 단순. Airtable/NocoDB 는 캐시와 메타를 한 레코드 개념에 둔다. `DataTableUpdate` 가 이미 runtimeData 를 받으므로(`data.types.ts:107`) 적용기 재사용 쉬움.
- 위험:
  - 기술: L — 필드 추가 + 적용기 배선
  - 성능: **H** — runtimeData(대용량 응답)가 collection 레코드에 실려 목록 로드·`putToStore` 마다 직렬화, export envelope 가 응답 데이터를 통째 운반
  - 유지보수: M — 캐시와 메타가 한 레코드라 export/redactor 가 응답 데이터까지 항상 고려
  - 마이그레이션: L — optional 필드, read 호환

### 대안 B: executionPolicy 는 레코드 필드, runtimeData 는 별도 `collection_runtime` store (키=collectionId)

- 설명: 저장 형식 확장은 `executionPolicy?` **필드 하나**로 최소화. runtimeData(응답 캐시)는 별도 IndexedDB objectStore 에 collectionId 키로 두어 collection 레코드와 분리. export 는 정책만 싣고 응답 캐시는 기본 제외(필요 시 옵션).
- 근거: Retool/Appsmith 가 쿼리 결과 캐시를 메타와 분리 저장. §4-0 원칙 2("테이블 = 스키마 + 소스 + 샘플")에서 캐시는 소스의 파생이지 정본이 아니다 — 분리가 개념 정합. collection 레코드가 가벼워 목록 로드 무영향, export/redactor 부담이 응답 데이터로 번지지 않음.
- 위험:
  - 기술: M — 신규 objectStore + adapter migration + 두 store 생명주기 동기(삭제 시 캐시 정리)
  - 성능: L — collection 레코드 경량 유지, 캐시는 필요할 때만 읽음
  - 유지보수: L — 캐시(파생)와 메타(정본) 경계 명확, export 는 정책만
  - 마이그레이션: L — 신규 store 추가 + executionPolicy optional, 기존 레코드 read 호환

### 대안 C: runtimeData·executionPolicy 전부 collection 밖 side-store (저장 형식 완전 무변경)

- 설명: 두 항목 모두 collection 레코드 밖 side-table 에. lock-in §2("저장 형식 불변")를 문자 그대로 유지.
- 근거: ADR-212 lock-in §2 를 재정의하지 않아도 됨. 저장 형식 변경 0.
- 위험:
  - 기술: M — 두 side-store + 참조 무결성(고아 방지)
  - 성능: M — 정책을 읽을 때마다 side-store 조회(collection 과 항상 함께 쓰는데 분리)
  - 유지보수: **H** — 정책은 collection 과 생명주기·의미가 붙어 있는데 물리적으로 분리 → 조회·정합 코드가 곳곳에 산재, "저장 형식 불변" 을 지키려다 결합만 늘어남
  - 마이그레이션: L — 기존 레코드 무변경

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  H   |    M     |      L       |     1      |
| B    |  M   |  L   |    L     |      L       |     0      |
| C    |  M   |  M   |    H     |      L       |     1      |

대안 B 가 HIGH 0. A 는 성능(대용량 응답이 레코드·export 에 실림) HIGH, C 는 유지보수(정책과 collection 분리로 결합 증가) HIGH. 루프 불필요.

## Decision

**대안 B: executionPolicy 는 collection 레코드 필드, runtimeData 는 별도 `collection_runtime` store** 를 선택한다.

선택 근거:

1. 저장 형식 확장을 **필드 하나(`executionPolicy?`)로 최소화** — lock-in §2 재정의의 표면을 최소로 두고, 정책은 collection 과 생명주기가 같아 레코드에 두는 것이 자연스럽다.
2. runtimeData(응답 캐시)는 소스의 **파생**이지 정본이 아니다(§4-0 원칙 2) — 별도 store 분리로 collection 레코드 경량 유지, export/redactor 부담이 응답 데이터로 번지지 않아 HC3(secret·번들)을 지키기 쉽다.
3. 파생 캐시라 **버릴 수 있다** — 유효성이 의심되면 무효화하고 재실행으로 채운다. 이 성질이 h1(캐시 유효성)을 안전하게 만든다: 캐시에 source/schema revision 을 함께 저장하고(HC4) hydration 시 불일치면 폐기, rename 만 값 보존 변환.

대안 B 는 저장 store 를 정하는 결정일 뿐이며, 다음 **런타임 계약** 을 함께 확정해야 성립한다 (리뷰 round 1 h1·h2·m3·m4 반영):

- **캐시 유효성 (h1, HC4)**: `collection_runtime` 엔트리에 `sourceRev`(endpoint id + `responseMapping.dataPath` + schema field key/type 집합의 지문) 저장. hydration·rename·소스 변경 시 revision 으로 유효성 판정.
- **요청 경쟁 (h2, HC5)**: collection 별 `runSeq` single-flight — 진행 중 abort, 응답은 seq 일치 시에만 수용.
- **endpoint 연결 (m3)**: collection↔endpoint cardinality 0..1, 정본 = `endpoint.targetCollectionId`. picker 는 `set_source{endpointId}` 를 **승인 dispatcher 확장**으로 처리 — 새 endpoint 연결 + 기존 연결 해제를 한 DataChange(역연산 = 이전 연결 복원). `dataChange.ts:785-798` 의 throw 를 이 경로로 대체.
- **실행 소유자 (m4)**: 정책 실행 host = **Builder**. Builder 가 정책(auto/manual/interval)을 실행하고 Preview 는 결과(runtimeData snapshot)만 받는다 — `collectionSnapshot` allowlist 에 정책 필드 미포함(응답만 투영). auto = Builder 가 Preview 열기 전 1회. legacy API binding interval(`useCollectionData.tsx:517-530`)은 별개 경로로 유지·구분. `postMessage` 제외(`dataChange.ts:113-123` raw response)와 export 제외는 별개 정책.

기각 사유:

- **대안 A 기각**: 대용량 응답이 collection 레코드·export envelope 에 실려 목록 로드·직렬화·번들에 성능 HIGH. lock-in §2 재정의 표면도 필드 2개로 넓다.
- **대안 C 기각**: "저장 형식 불변" 을 지키려다 정책을 collection 밖에 두어 조회·정합 코드가 산재(유지보수 HIGH). 사용자가 저장 형식 확장을 이미 confirm 했으므로 무변경 고집의 이득이 없다.

> 구현 상세: [218-collection-runtime-data-persistence-execution-policy-breakdown.md](design/218-collection-runtime-data-persistence-execution-policy-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                           |  심각도  | 대응                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **캐시 유효성** — field rename(`stores/utils/dataChange.ts:679-687` 가 메모리 runtimeData key 변환)·endpoint 교체·`responseMapping`·스키마 구조 변경 후, 별도 store(`lib/db/indexedDB/adapter.ts:564-598` 계열)의 옛 캐시가 reload 때 현재 schema 와 섞여 복원 | **HIGH** | HC4 — `sourceRev` 지문 + hydration 무효화 + rename 값 보존 변환. Gate G1 에 rename→offline reload · 소스 교체→offline reload 시나리오 |
| R2  | **요청 경쟁** — `stores/utils/dataActions.ts:543-561`(loadingApis 표시만·중복 미차단) · `:680-693`(AbortController 는 함수 내 timeout 전용) · `:722-745`(완료 시 무조건 쓰기). 늦은 A 가 먼저 끝난 B 를 덮어쓰고, 영속화되면 다음 세션까지 stale               | **HIGH** | HC5 — `runSeq` single-flight(진행 중 abort · seq 일치 응답만 수용). Gate G3 에 A/B 역순 완료 · 정지 후 완료 무시                      |
| R3  | **endpoint picker 연결/역연산** — `set_source.endpointId` 가 현재 throw(`stores/utils/dataChange.ts:785-798`), 실행은 역조회 첫 endpoint 선택(`main/BuilderCore.tsx:897-911`). picker 가 정본 관계·해제·Undo 없이 붙으면 오류/이전 연결 유지                   |   MED    | m3 계약 — cardinality 0..1 · set_source 확장 dispatcher · 역연산. Gate G2                                                             |
| R4  | **Preview 실행 경계** — legacy binding interval(`packages/shared/src/hooks/useCollectionData.tsx:517-530`)과 새 정책 범위 혼동 · Preview auto 소유자·전달 경로 미정(`collectionSnapshot.ts:35-45` allowlist)                                                   |   MED    | m4 계약 — host=Builder, snapshot 은 응답만. Gate G3 헤더 Preview 진입 + endpoint 호출 수                                              |
| R5  | runtimeData 영속이 export/postMessage/AI payload 에 응답 데이터·secret 을 새로 실음 (`dataChange.ts:113-123` raw response postMessage 이미 존재)                                                                                                               |   MED    | HC3 — export/postMessage 별개 정책, 산출물 검사 test (Gate G3)                                                                        |
| R6  | `interval` 정책 타이머 leak (편집기 닫힘·페이지 전환 후 잔존)                                                                                                                                                                                                  |   MED    | HC6 — 정리 훅 + interval 정리 후 타이머 0 (Gate G3)                                                                                   |
| R7  | 기존 프로젝트(executionPolicy 없음) 로드 시 동작 변경                                                                                                                                                                                                          |   MED    | HC1 — optional 필드, 미설정=manual, BC 로드 (Gate G1)                                                                                 |
| R8  | `collection_runtime` store 와 레코드 생명주기 어긋남 (삭제 후 캐시 고아)                                                                                                                                                                                       |   MED    | Gate G1 — 삭제 시 캐시 정리 + 고아 0                                                                                                  |

HIGH 2건(R1·R2) — 각각 HC4/HC5 계약 + Gate G1/G3 로 1:1 관리.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 실패 시 대안                          |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| G0   | Phase 0 완료 | §2 인벤토리 freeze + export 경로 전수 + BC 정량화(기존 레코드 read 호환). **측정 기준(m5, `measurement-validity` §1)**: fixture 행수 3구간(100·1000·5000)·byte 규모, 대조군 = 현행 memory-only vs 별도 store 영속 arm, 측정 조건(foreground Chromium·DPR2·visible·cold1+warm N), 판정 = 목록 로드 p95 증가 상한 · IDB write/read p95 · initial 집계 단위와 기준 SHA · interval 누적 힙 고수위선                                                                                                             | 실측/기준 미확보면 Phase 1 착수 금지  |
| G1   | Phase 1 완료 | `executionPolicy?` + runtimeData 별도 store 영속, 쓰기 전부 `applyDataChange`, runtimeData History 밖. **캐시 유효성(R1/h1)**: API 응답 저장 → field rename → offline reload 시 현재 key 로 값 표시(옛 key 섞임 0) · endpoint/`responseMapping` 교체 → offline reload 시 revision 불일치 무효화 · Undo 로 스키마 복원 시 재판정. 기존 레코드 로드=manual(R7) · 삭제 시 캐시 정리 고아 0(R8)                                                                                                                 | store 생명주기/revision/적용기 재조정 |
| G2   | Phase 2 완료 | Settings "데이터 소스" UI(샘플/실제 + 엔드포인트 picker + 정책 컨트롤), 팝오버/모달 신설 0(HC2), 키보드·`datatable.*` ko/en. **endpoint 연결(R3/m3)**: picker 로 연결 교체 시 이전 endpoint 해제 + 새 연결 1개 · Undo 로 이전 연결 복원 · set_source 확장 DataOp 역연산                                                                                                                                                                                                                                     | UI 어법/i18n/dispatcher 수정          |
| G3   | Phase 3 완료 | 정책 3종(auto/manual/interval) 실제 실행 · 세션 재로드 시 runtimeData 복원. **요청 경쟁(R2/h2)**: A(느림)/B(빠름) 역순 완료 시 최신 B 유지(A 무시) · interval 정지·페이지 전환 후 완료 응답 무시 · interval 정리 후 타이머 0(R6). **실행 경계(R4/m4)**: 실제 헤더 Preview 진입 시 endpoint 호출 수로 host=Builder 검증 · legacy binding interval 과 구분. export/postMessage/AI 에 원문 secret·응답 데이터 정책 준수 0(R5, 두 채널 별개) · axe critical 0 · initial Builder chunk 증가 0 · live 하니스 PASS | 해당 표면 수리                        |

### Live Exercise

(Implemented 승격 시 기재 — G1~G3 시나리오 · 결과 · 날짜 · Playwright/Chrome MCP/사용자 confirm 구분. 미기재 시 Stop hook 이 승격을 block.)

## Consequences

### Positive

- API 연결 collection 이 세션을 넘어 마지막 성공 응답을 유지 — 다시 열어도 빈 상자·샘플 회귀가 없다(§4-0 원칙 4).
- 실행 정책(자동/수동/N초)으로 API 데이터 갱신이 사용자 개입 없이 돌아간다(UX-6).
- 캐시(파생)와 메타(정본)가 store 로 분리 — collection 레코드가 가볍고 export/redactor 경계가 명확.
- ADR-212 가 이월한 Settings "데이터 소스" 표면이 완성되어 Data 패널 편집 흐름이 닫힌다.

### Negative

- IndexedDB 에 objectStore 가 하나 늘어(`collection_runtime`) adapter migration·삭제 정리 코드가 는다.
- `interval` 정책은 타이머 생명주기 관리가 필요 — 정리 누락 시 leak(Gate G3 로 방어).
- 저장 형식이 확장되어(executionPolicy) ADR-212 lock-in §2 가 재정의된다 — 이후 collection 저장 형식 변경은 본 ADR 을 기준으로 판단.
