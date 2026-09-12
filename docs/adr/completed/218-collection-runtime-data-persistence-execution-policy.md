# ADR-218: collection 런타임 데이터 영속 · 실행 정책

## Status

Implemented — 2026-09-13 (Phase 0~~3 완료, G0~~G3 PASS)

- Accepted — 2026-09-12 (Round 4 리뷰 이슈 0, 사용자 조건부 승격 지시 충족)
- Phase 0 완료 — 2026-09-12 (G0 PASS: §2 인벤토리 freeze · export 3채널 전수 · BC 0% breaking · m5 조건·통과선 확정 — breakdown §2.1). 제품 코드 변경 0.
- Phase 1 완료 — 2026-09-13 (G1 live 9/9 · `1de25662c`·`b6156c6f5`): executionPolicy 필드 · collection_runtime store(DB_VERSION 22) · sourceRev 지문 · secret revision · hydration 유효성.
- Phase 2 완료 — 2026-09-13 (G2 live 7/7 · `132150f44`): Settings 데이터 소스 UI(endpoint picker + 정책 컨트롤) · set_source{endpointId} dispatcher.
- Phase 3 완료 — 2026-09-13 (G3 live 5/5 · `d014a20a6`): interval 스케줄러 · runSeq single-flight · 채널 projection 분리.

## Context

빌더의 collection(DataTable)은 스키마 + `mockData`(샘플) + `runtimeData`(API 마지막 응답)로 구성된다. 두 가지가 미완성이다:

- **runtimeData 가 memory-only** — `types/builder/data.types.ts:82-83` 주석대로 "메모리에만 존재, DB에 저장 안함". set 경로(`stores/utils/dataActions.ts:209` · `:297` · `:740`)는 전부 Zustand `newMap.set` 만 하고 IndexedDB adapter(`lib/db/indexedDB/adapter.ts:564-598`)를 호출하지 않는다. 그래서 세션을 다시 열면 API 응답이 사라지고, 재실행 전까지 캔버스는 샘플로 돌아가거나 빈 상태가 된다 (§4-0 원칙 4 "무증상 실패 금지" 와 어긋남).
- **collection-level 실행 정책이 없다** — API 실행 진입은 이미 여럿이다: Send 버튼(`ApiEndpointEditor.tsx:122`) · agent 명령(`services/agent/dataAgentCommands.ts:96`) · endpoint 역조회 실행(`BuilderCore.tsx:897-911`) · legacy API binding 의 interval(`packages/shared/src/hooks/useCollectionData.tsx:517-530`). 그러나 **collection 이 "언제 갱신되는가"를 결정하는 정책 필드는 없다** — 사용자가 자동/수동/주기를 고를 수 없고, legacy binding interval 은 collection 소스와 분리된 별개 경로다. API 연결 collection 을 쓰려면 매번 편집기를 열어 Send 해야 한다 (리서치 §4-2 UX-6).

이 둘은 ADR-212(Data 패널 편집기 재설계, Implemented 2026-09-12)가 **collection 저장 형식 불변**(lock-in §2, 사용자 confirm 2026-09-11)을 지키느라 명시적으로 이월한 항목이다. 본 ADR 은 그 lock-in 을 **저장 형식 확장**으로 재정의하고 두 항목을 구현한다.

**Domain 분류**: 본 ADR 은 **데이터 모델 layer**(ADR-152 base 계열)의 확장이다 — 컴포넌트 3-domain(D1 DOM/D2 Props/D3 시각)의 변경이 아니다. 유일한 사용자 표면인 Settings "데이터 소스" UI 는 빌더 도구 UI(RAC 그대로 사용 — D1 준수)이며 Preview/Publish 대응물이 없다.

**Hard Constraints**:

1. **저장 형식 확장은 하위 호환** — 신규 필드는 optional. 기존 프로젝트(executionPolicy 미설정)는 로드 시 현행 동작(manual)을 그대로 유지한다. read 호환 필수.
2. **쓰기는 전부 `applyDataChange`**(ADR-152 §2-3) — 영속·정책 쓰기가 store 를 직접 mutate 하지 않는다. runtimeData 는 History 밖(캐시), 정책 필드는 History 안.
3. **secret·번들·채널별 projection (m3)** — runtimeData 영속이 export envelope(ADR-209)·preview `postMessage`·AI payload 에 원문 secret 을 새로 싣지 않는다. **Preview 와 export 는 서로 반대 계약이므로 같은 projection(`toRuntimeCollection`, `collectionSnapshot.ts:35-45` 단일 allowlist)을 공유해선 안 된다** — Preview 채널 = runtimeData 응답 포함·executionPolicy 제외, export 채널 = executionPolicy 포함(import 에서 보존)·응답 제외. 두 채널 projection 을 분리하고 각 산출물 검사로 지킨다. 실제 헤더 Preview 는 sessionStorage→새 `/publish/` 탭(`BuilderCore.tsx:1152-1159`)이라 iframe `postMessage`(`dataChange.ts:113-123`)와 구별한다. 편집기 lazy 경계(ADR-212 HC5) 유지 — initial Builder chunk 증가 0.
4. **캐시 유효성 (h1)** — 별도 store 의 runtimeData 는 collectionId 만으로 복원해선 안 된다. 캐시는 자신을 만든 **source revision** 을 함께 저장한다. 지문은 endpoint **id 만이 아니라 요청 결과를 바꾸는 정의·실행 파라미터 전부** — `baseUrl + path + method` + **queryParams/header 의 enabled·정규화 key·value** + `bodyType/bodyTemplate` + `responseMapping.dataPath` + schema field key/type. 헤더·쿼리·바디의 **비민감 값은 지문에 그대로 포함**한다(`Accept-Language: ko→en`, `X-Tenant` 등 값 변경이 요청 결과를 바꾸므로 — 실제 소비는 `dataActions.ts:625-635`). **secret 참조(`{{secret.NAME}}`)만 원문 대신 `참조 이름 + 그 참조의 vault revision`** 을 지문에 넣는다 — 같은 이름 secret 값을 교체(`secretVault.ts:72-85` 덮어쓰기)하면 SecretRow 의 **변경 revision(세대)** 이 올라 지문이 갈린다(원문은 지문 메타에 복사 안 함 — HC6 유지). 이 규칙은 URL/query/body/header 어디에 있는 secret 참조든 동일. define_endpoint 가 같은 id 로 정의를 바꿔도(`dataChange.ts:440-479` → `dataActions.ts:593-648`) 지문이 갈린다. hydration·소스 변경 시 revision 불일치면 폐기. field rename 은 값 보존 변환(152 G4 정합), 그 외 정의·mapping·스키마 구조 변경은 무효화. Undo/Redo 는 revision 재계산으로 판정. 진행 중 요청은 **시작 시점 source revision**(secret revision 포함)을 들고 있다가 완료 수용 시 현재 revision 과 대조 — 불일치면 그 응답으로 캐시를 채우지 않는다(소스·인증 변경 직전 응답 차단, h2 와 연동).
5. **요청 경쟁 (h2)** — 타이머 정리만으로는 늦은 응답의 덮어쓰기를 막지 못한다. collection 별 **실행 세대(runSeq)** — 완료 응답은 자신의 seq === 현재 seq 이고 시작 시점 source revision 이 현재와 일치할 때만 store·캐시에 쓴다(stale 무시). **취소 대상은 사용자 명시 재실행·소스/정책 변경뿐** — 이때만 진행 중 요청 abort. hydration(세션 로드)은 seq 0 기준, 첫 유효 응답이 덮어쓴다.
6. **interval 스케줄·누수 0 (h2)** — `interval` 자동 tick 은 **진행 중이면 skip/coalesce** 하거나 **완료 후 N초 재예약** 한다(고정 tick + 매번 abort 금지 — 주기 1초·응답 1.5초인 정상 API 가 매 tick 취소돼 성공 응답을 못 남기는 것 방지). 즉 자동 tick 은 abort 하지 않고 진행 중이면 건너뛴다. 정리 훅으로 타이머 leak 0. `measurement-validity` Q2(불리 케이스 = 대용량 응답·응답시간 > 주기·A/B 역순)·Q4(정책이 실제 실행 경로에 배선).
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

대안 B 는 저장 store 를 정하는 결정일 뿐이며, 다음 **런타임 계약** 을 함께 확정해야 성립한다 (리뷰 round 1·2 반영):

- **캐시 유효성 (h1, HC4)**: `collection_runtime` 엔트리에 `sourceRev` — `baseUrl+path+method` + query/header 의 enabled·정규화 key·**value(비민감 값 포함)** + body + dataPath + schema 지문. **secret 참조만** 원문 대신 `참조 이름 + vault revision`(SecretRow 변경 세대) — 같은 이름 secret 값 교체(`secretVault.ts:72-85`)도 지문이 갈리되 원문은 지문에 없음(HC6). 헤더 값(`Accept-Language`)·secret 값 교체·path/query/body 변경이 전부 revision 에 반영. define_endpoint 동일 id 정의 변경(`dataChange.ts:440-479`→`dataActions.ts:593-648,625-635,660-664`)도 갈린다. hydration·소스·인증 변경 시 불일치면 폐기, rename 만 값 보존 변환. 진행 중 요청은 시작 revision(secret 포함)을 완료 수용 시 대조.
- **요청 경쟁·스케줄 (h2, HC5·HC6)**: collection 별 `runSeq` — 완료 응답은 seq 일치 + 시작 revision 일치 시만 수용. **abort 는 사용자 재실행·소스/정책 변경에만**. `interval` 자동 tick 은 abort 하지 않고 **진행 중이면 skip/coalesce 또는 완료 후 N초 재예약** — 고정 tick + 매 tick abort 로 정상 API(주기 1초·응답 1.5초)의 완료 기회를 뺏지 않는다.
- **endpoint 연결 (m3, FIXED round 2)**: collection↔endpoint cardinality 0..1, 정본 = `endpoint.targetCollectionId`. picker 는 `set_source{endpointId}` 를 **승인 dispatcher 확장**으로 — 새 연결 + 기존 연결 해제를 한 DataChange(역연산 = 이전 연결 복원). `dataChange.ts:785-798` throw 대체.
- **채널별 projection (m4→m3 잔여)**: 정책 실행 host = **Builder**(auto = Preview 열기 전 1회). Preview 와 export 는 **반대 계약이라 `toRuntimeCollection` 공용 projection(`collectionSnapshot.ts:35-45`)을 나눈다** — Preview 채널 = runtimeData 응답 포함·executionPolicy 제외, export 채널 = executionPolicy 포함(import 보존)·응답 제외. 실제 헤더 Preview 는 sessionStorage→새 `/publish/` 탭(`BuilderCore.tsx:1152-1159`, JSON export 는 `:1179-1184` — 둘 다 현재 같은 helper)이라 iframe `postMessage`(`dataChange.ts:113-123`)와도 구별. legacy API binding interval(`useCollectionData.tsx:517-530`)은 별개 경로 유지.

기각 사유:

- **대안 A 기각**: 대용량 응답이 collection 레코드·export envelope 에 실려 목록 로드·직렬화·번들에 성능 HIGH. lock-in §2 재정의 표면도 필드 2개로 넓다.
- **대안 C 기각**: "저장 형식 불변" 을 지키려다 정책을 collection 밖에 두어 조회·정합 코드가 산재(유지보수 HIGH). 사용자가 저장 형식 확장을 이미 confirm 했으므로 무변경 고집의 이득이 없다.

> 구현 상세: [218-collection-runtime-data-persistence-execution-policy-breakdown.md](../design/218-collection-runtime-data-persistence-execution-policy-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                |  심각도  | 대응                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **캐시 유효성** — 지문이 정의 일부만 담으면 옛 캐시가 유효하게 복원: ① 같은 id path/query/method/body 변경(`dataChange.ts:440-479`→`dataActions.ts:593-648`) ② 헤더/쿼리 **비민감 값** 변경(`Accept-Language` ko→en, `dataActions.ts:625-635`) ③ 같은 `{{secret.NAME}}` 값 교체(`secretVault.ts:72-85` 덮어쓰기, `dataActions.ts:660-664` 치환) ④ field rename(`dataChange.ts:679-687`)·스키마 변경 | **HIGH** | HC4 — `sourceRev` 에 비민감 값 포함 + secret 참조는 vault revision(원문 미저장) + 진행 중 요청 시작 revision 대조. G1 에 헤더 값만 수정→reload · 동일 secret 값 교체→무효화 |
| R2  | **요청 경쟁·스케줄** — `dataActions.ts:543-561`(중복 미차단)·`:680-693`(timeout 전용 AbortController)·`:722-745`(무조건 쓰기). ① 늦은 A 가 빠른 B 덮어씀 ② 고정 tick + 매 tick abort 면 응답시간 > 주기인 정상 API 가 매번 취소돼 성공 응답 0(`useCollectionData.tsx:521-524` 고정 setInterval)                                                                                                     | **HIGH** | HC5(seq+revision 수용, abort 는 사용자/소스·정책 변경만) + HC6(자동 tick 은 skip/coalesce·완료 후 재예약). Gate G3 에 A/B 역순 + 응답시간 > 주기 API 성공 갱신 검사         |
| R3  | **endpoint picker 연결/역연산** — `set_source.endpointId` 가 현재 throw(`stores/utils/dataChange.ts:785-798`), 실행은 역조회 첫 endpoint 선택(`main/BuilderCore.tsx:897-911`). picker 가 정본 관계·해제·Undo 없이 붙으면 오류/이전 연결 유지                                                                                                                                                        |   MED    | m3 계약 — cardinality 0..1 · set_source 확장 dispatcher · 역연산. Gate G2                                                                                                   |
| R4  | **Preview 실행 경계** — legacy binding interval(`packages/shared/src/hooks/useCollectionData.tsx:517-530`)과 새 정책 범위 혼동 · Preview auto 소유자·전달 경로 미정(`collectionSnapshot.ts:35-45` allowlist)                                                                                                                                                                                        |   MED    | m4 계약 — host=Builder, snapshot 은 응답만. Gate G3 헤더 Preview 진입 + endpoint 호출 수                                                                                    |
| R5  | **채널 projection 충돌** — Preview(응답 포함·정책 제외)와 export(정책 포함·응답 제외)가 현재 같은 `toRuntimeCollection`(`collectionSnapshot.ts:35-45` 단일 allowlist · `BuilderCore.tsx:1141-1144` Preview · `:1179-1184` export). 공용 변경 시 한쪽 계약이 깨짐. raw response postMessage(`dataChange.ts:113-123`)도 별개 채널                                                                     |   MED    | HC3 — Preview/export 채널 projection 분리, executionPolicy import 보존·runtimeData Preview 한정. Gate G3 에 Preview payload/JSON export/import 대조                         |
| R6  | `interval` 정책 타이머 leak (편집기 닫힘·페이지 전환 후 잔존)                                                                                                                                                                                                                                                                                                                                       |   MED    | HC6 — 정리 훅 + interval 정리 후 타이머 0 (Gate G3)                                                                                                                         |
| R7  | 기존 프로젝트(executionPolicy 없음) 로드 시 동작 변경                                                                                                                                                                                                                                                                                                                                               |   MED    | HC1 — optional 필드, 미설정=manual, BC 로드 (Gate G1)                                                                                                                       |
| R8  | `collection_runtime` store 와 레코드 생명주기 어긋남 (삭제 후 캐시 고아)                                                                                                                                                                                                                                                                                                                            |   MED    | Gate G1 — 삭제 시 캐시 정리 + 고아 0                                                                                                                                        |

HIGH 2건(R1·R2) — 각각 HC4/HC5 계약 + Gate G1/G3 로 1:1 관리.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 실패 시 대안                          |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| G0   | Phase 0 완료 | §2 인벤토리 freeze + export 경로 전수 + BC 정량화(기존 레코드 read 호환). **측정 기준(m5, `measurement-validity` §1)**: fixture 행수 3구간(100·1000·5000)·byte 규모, 대조군 = 현행 memory-only vs 별도 store 영속 arm, 측정 조건(foreground Chromium·DPR2·visible·cold1+warm N), 판정 = 목록 로드 p95 증가 상한 · IDB write/read p95 · initial 집계 단위와 기준 SHA · interval 누적 힙 고수위선                                                                                                                                                                                                                                                                                                                                                                                                        | 실측/기준 미확보면 Phase 1 착수 금지  |
| G1   | Phase 1 완료 | `executionPolicy?` + runtimeData 별도 store 영속, 쓰기 전부 `applyDataChange`, runtimeData History 밖. **캐시 유효성(R1/h1)**: API 응답 저장 → field rename → offline reload 시 현재 key 로 값 표시(옛 key 섞임 0) · **같은 endpoint id 의 path 또는 query 수정 → offline reload 시 revision 불일치 무효화**(교체뿐 아니라 동일 id 내부 변경) · `responseMapping` 교체도 무효화 · **헤더/쿼리 비민감 값만 수정(Accept-Language ko→en)→offline reload 시 무효화** · **동일 secret 이름 값 교체→옛 캐시·진행 중 응답 무효화**(secret 원문은 지문 메타에 0) · Undo 로 스키마 복원 시 재판정. 기존 레코드 로드=manual(R7) · 삭제 시 캐시 정리 고아 0(R8)                                                                                                                                                   | store 생명주기/revision/적용기 재조정 |
| G2   | Phase 2 완료 | Settings "데이터 소스" UI(샘플/실제 + 엔드포인트 picker + 정책 컨트롤), 팝오버/모달 신설 0(HC2), 키보드·`datatable.*` ko/en. **endpoint 연결(R3/m3)**: picker 로 연결 교체 시 이전 endpoint 해제 + 새 연결 1개 · Undo 로 이전 연결 복원 · set_source 확장 DataOp 역연산                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | UI 어법/i18n/dispatcher 수정          |
| G3   | Phase 3 완료 | 정책 3종(auto/manual/interval) 실제 실행 · 세션 재로드 시 runtimeData 복원. **요청 경쟁(R2/h2)**: A(느림)/B(빠름) 역순 완료 시 최신 B 유지(A 무시) · **응답시간 > 주기인 API 를 여러 tick 실행 시 성공 응답이 실제 갱신됨(매 tick 취소 아님)** · 사용자/소스·정책 변경 취소는 즉시 반영 · **동일 secret 이름 값 교체 시 진행 중 요청 응답이 캐시를 못 채움(시작 revision 불일치, R1/h1)** · interval 정리 후 타이머 0(R6). **채널 projection(R5/m3)**: 같은 collection 의 헤더 Preview payload(응답 포함·정책 제외) / JSON export payload(정책 포함·응답 제외) / import 결과(정책 보존) 대조 · 원문 secret 0. **실행 경계(R4/m4)**: 실제 헤더 Preview 진입 시 endpoint 호출 수로 host=Builder 검증 · legacy binding interval 과 구분. axe critical 0 · initial Builder chunk 증가 0 · live 하니스 PASS | 해당 표면 수리                        |

### Live Exercise

2026-09-13, headless Playwright 하니스 (`apps/builder/scripts/adr218-p{1,2,3}-*-live.mjs`), evidence `docs/adr/evidence/218-p{1,2,3}-*-live.md`.

- **G1 9/9** (`adr218-p1-cache-live.mjs`): collection_runtime store 생성(DB_VERSION 22) · execute→영속(runtimeData+sourceRev+fieldKeys) · reload→hydration 복원(재fetch 0=오프라인 캐시) · endpoint path 변경→캐시 무효화(h1) · field rename→캐시 유지(id 지문) · collection 삭제→고아 0(R8) · HC6 지문 원문 0.
- **G2 7/7** (`adr218-p2-settings-live.mjs`): Settings 데이터 소스 UI 렌더 · endpoint picker 연결(set_source targetCollectionId 영속) · 정책 interval(set_execution_policy 영속) · Undo 정책·연결 복원 · native dialog 0(HC2). 영속 결함 1건(targetCollectionId 해제 adapter 병합 미반영) live 에서 발견·수정.
- **G3 5/5** (`adr218-p3-runtime-live.mjs`): interval 주기 반복(응답<주기 자기 재예약) · 정책 제거 후 타이머 0(R6) · 채널 projection export(정책 포함·응답 제외, R5) · dialog 0 · error 0.
- 유닛: sourceRev 10 · runtimeCache hydration 5 · set_execution_policy 왕복 2 · set_source 연결 4 · runSeq A/B 1 · toExportCollection 2 · schema 16-op. 회귀 0, type-check PASS.
- 요청 경쟁 A/B(R2)는 결정적 unit(`dataActions.runSeq.test.ts`) 로 검증(늦은 A/빠른 B→최신 B만).
- **m5 수치 실측 (2026-09-13 후속, `adr218-m5-measure.mjs` · `adr218-m5-heapdiff.mjs`, evidence `docs/adr/evidence/218-m5-measure.md`)** — dev 5173 + production(`fea2f8494` dist, vite preview) 두 arm: IDB put/get p95 5,000행 2.8 / 1.3 ms (≤ 100 PASS) · 목록 로드 p95 A/B(빈 캐시 vs 3×5,000행 hydration) Δ −23 ms, 재fetch 0 (≤ +150 PASS) · interval 1초 × 60 tick 힙 — raw usedSize 기울기 10.5 KB/tick(50 tick 1.20× payload, raw 판정선 ≤1× FAIL) 을 스냅샷 diff 로 분해: V8 code space(JIT tier-up)+브라우저 타임라인 버퍼가 전부, **JS 데이터 Δ 4 KB(0.01× payload) = 누적 0**, 120 tick 기울기 감속(10.7→5.1) · 정책 제거 후 타이머 0 · initial 번들 before `fad429921`→after `fea2f8494` Builder +2,111 B / Preview +449 B gzip (순증 한도 PASS, ADR-217 절대 상한 Builder +1,798 / Preview +548 초과 → 사용자 재승인 항목).

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
