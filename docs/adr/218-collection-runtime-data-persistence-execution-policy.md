# ADR-218: collection 런타임 데이터 영속 · 실행 정책

## Status

Proposed — 2026-09-12

## Context

빌더의 collection(DataTable)은 스키마 + `mockData`(샘플) + `runtimeData`(API 마지막 응답)로 구성된다. 두 가지가 미완성이다:

- **runtimeData 가 memory-only** — `types/builder/data.types.ts:82-83` 주석대로 "메모리에만 존재, DB에 저장 안함". set 경로(`stores/utils/dataActions.ts:209` · `:297` · `:740`)는 전부 Zustand `newMap.set` 만 하고 IndexedDB adapter(`lib/db/indexedDB/adapter.ts:564-598`)를 호출하지 않는다. 그래서 세션을 다시 열면 API 응답이 사라지고, 재실행 전까지 캔버스는 샘플로 돌아가거나 빈 상태가 된다 (§4-0 원칙 4 "무증상 실패 금지" 와 어긋남).
- **실행 정책이 없다** — `executeApiEndpoint` 는 Send 클릭에서만 실행된다(`ApiEndpointEditor.tsx:122`). refreshInterval/자동 실행/열 때 실행이 0이라, API 연결 collection 을 쓰려면 매번 편집기를 열어 Send 해야 한다 (리서치 §4-2 UX-6).

이 둘은 ADR-212(Data 패널 편집기 재설계, Implemented 2026-09-12)가 **collection 저장 형식 불변**(lock-in §2, 사용자 confirm 2026-09-11)을 지키느라 명시적으로 이월한 항목이다. 본 ADR 은 그 lock-in 을 **저장 형식 확장**으로 재정의하고 두 항목을 구현한다.

**Domain 분류**: 본 ADR 은 **데이터 모델 layer**(ADR-152 base 계열)의 확장이다 — 컴포넌트 3-domain(D1 DOM/D2 Props/D3 시각)의 변경이 아니다. 유일한 사용자 표면인 Settings "데이터 소스" UI 는 빌더 도구 UI(RAC 그대로 사용 — D1 준수)이며 Preview/Publish 대응물이 없다.

**Hard Constraints**:

1. **저장 형식 확장은 하위 호환** — 신규 필드는 optional. 기존 프로젝트(executionPolicy 미설정)는 로드 시 현행 동작(manual)을 그대로 유지한다. read 호환 필수.
2. **쓰기는 전부 `applyDataChange`**(ADR-152 §2-3) — 영속·정책 쓰기가 store 를 직접 mutate 하지 않는다. runtimeData 는 History 밖(캐시), 정책 필드는 History 안.
3. **secret·번들** — runtimeData 영속이 export envelope(ADR-209)·preview `postMessage`·AI payload 에 원문 secret 을 새로 싣지 않는다. 응답 데이터의 export 포함 여부는 명시 정책으로 고정하고 산출물 검사로 지킨다. 편집기 lazy 경계(ADR-212 HC5) 유지 — initial Builder chunk 증가 0.
4. **실행 정책 런타임 누수 0** — `interval` 정책은 정리 훅으로 타이머 leak 0. `measurement-validity` Q2(불리 케이스 = 대용량 응답·interval 누적)·Q4(정책이 실제 실행 경로에 배선).
5. **i18n** — 신규 문자열은 `datatable.*` 키 ko/en(ADR-200).
6. **스냅 패널 어법**(ADR-212 HC2) — Settings 데이터 소스 UI 는 팝오버/모달 생성 화면을 새로 만들지 않는다.

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
3. 잔존 위험(신규 store migration·두 store 생명주기 동기)은 MEDIUM 기술 위험이며 Gate G1 의 삭제-시-캐시-정리 + BC 로드 시나리오로 관리 가능하다.

기각 사유:

- **대안 A 기각**: 대용량 응답이 collection 레코드·export envelope 에 실려 목록 로드·직렬화·번들에 성능 HIGH. lock-in §2 재정의 표면도 필드 2개로 넓다.
- **대안 C 기각**: "저장 형식 불변" 을 지키려다 정책을 collection 밖에 두어 조회·정합 코드가 산재(유지보수 HIGH). 사용자가 저장 형식 확장을 이미 confirm 했으므로 무변경 고집의 이득이 없다.

> 구현 상세: [218-collection-runtime-data-persistence-execution-policy-breakdown.md](design/218-collection-runtime-data-persistence-execution-policy-breakdown.md)

## Risks

| ID  | 위험                                                                                                | 심각도 | 대응                                                                       |
| --- | --------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------- |
| R1  | 신규 `collection_runtime` store 와 collection 레코드 생명주기 어긋남 (collection 삭제 후 캐시 고아) |  MED   | Gate G1 — collection 삭제 시 캐시 store 정리 + 고아 0 확인                 |
| R2  | runtimeData 영속이 export/postMessage/AI payload 에 응답 데이터·secret 을 새로 실음                 |  MED   | HC3 — export 는 정책만(응답 기본 제외), 산출물 검사 test 로 고정 (Gate G3) |
| R3  | `interval` 정책 타이머 leak (편집기 닫힘·페이지 전환 후 잔존)                                       |  MED   | HC4 — 정리 훅 + live 하니스에서 interval 정리 후 타이머 0 (Gate G3)        |
| R4  | 기존 프로젝트(executionPolicy 없음) 로드 시 동작 변경                                               |  MED   | HC1 — optional 필드, 미설정=manual, BC 로드 시나리오 (Gate G1)             |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                        | 실패 시 대안                    |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| G0   | Phase 0 완료 | §2 인벤토리 freeze + collection·runtimeData 크기 실측 + export 경로 전수 + BC 정량화(기존 레코드 read 호환)                                                                                                                                      | 실측 미확보면 Phase 1 착수 금지 |
| G1   | Phase 1 완료 | `executionPolicy?` + runtimeData 별도 store 영속, 쓰기 전부 `applyDataChange`. collection 삭제 시 캐시 정리(R1) · 기존 레코드 로드=manual(R4) · runtimeData History 밖                                                                           | store 생명주기/적용기 재조정    |
| G2   | Phase 2 완료 | Settings "데이터 소스" UI(샘플/실제 + 엔드포인트 picker + 정책 컨트롤), 팝오버/모달 신설 0(HC2), 키보드·`datatable.*` ko/en                                                                                                                      | UI 어법/i18n 수정               |
| G3   | Phase 3 완료 | 정책 3종(auto/manual/interval) 실제 실행 · 세션 재로드 시 runtimeData 복원 · interval 정리 후 타이머 0(R3) · export/postMessage/AI 에 원문 secret·응답 데이터 정책 준수 0(R2) · axe critical 0 · initial Builder chunk 증가 0 · live 하니스 PASS | 해당 표면 수리                  |

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
