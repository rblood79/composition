# ADR-218 Design Breakdown: collection 런타임 데이터 영속 · 실행 정책

> 본문: [218-collection-runtime-data-persistence-execution-policy.md](../completed/218-collection-runtime-data-persistence-execution-policy.md) · 선행 base: [ADR-152](../completed/152-data-panel-collection-binding-integration.md) (저장 형식 · `DataChange` 적용기) · 분리 출처: [ADR-212](../completed/212-data-panel-editor-redesign.md) Phase 5 이월 2건. 리서치 정본: [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §4-0 · §4-2 (UX-6).

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-09-12)

ADR-212 가 이월한 2건(runtimeData 영속 · 실행 정책 필드)을 신규 ADR 로 분리한다. Fork 게이트 4 질문:

1. **base / 응용**: base = **ADR-152** (collection 저장 형식 + `DataChange` 적용기 + IndexedDB 영속). 본 ADR = **응용/확장** — 152 의 저장 형식에 필드를 더하고 152 적용기에 영속·정책 경로를 얹는다. 본 ADR 의 모든 쓰기도 `applyDataChange` 를 지난다.
2. **schema 직교성**: 직교 아님 — 본 ADR 은 **152 저장 형식의 specialization** (collection 레코드 확장 + 런타임 캐시 store). specialization 쪽이 base 의 후속이므로 본 ADR 은 152 의 후속이다.
3. **선행 ADR 전제 reverse 검증**: 152 → 218 방향이 valid (152 없이는 저장/적용기 없음). 역방향 없음. ADR-212(응용 UI)는 이미 Implemented·종결이며 본 ADR 에 의존하지 않는다 — 본 ADR 이 212 가 이월한 Settings 데이터 소스 UI 를 **추가**로 소유한다 (212 종결 표면에 얹음, 212 재개 아님).
4. **codex 3차 미루지 않음**: 본 §1 lock-in + 사용자 confirm(2026-09-12, scope "이월분 전부" · title) 후 codex 1차 진입.

**사용자 confirm (2026-09-12)**: scope = 이월분 전부 (저장 필드 + Settings 데이터 소스 UI + 실행 정책 런타임). "212 원래 설계 의도대로" = 이월 2건은 저장 형식을 바꾸는 데이터-모델 변경이라 212 밖 → 본 ADR. 저장 형식 확장을 본 ADR 이 lock-in §2 재정의로 정식 도입.

## 2. 현행 인벤토리 (2026-09-12 실측 — Phase 0 에서 freeze)

| 항목                 | 코드 사실 (경로:라인)                                                                                                                                                        | 상태           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| runtimeData 계약     | `types/builder/data.types.ts:82-83` "런타임 데이터 (API 응답 저장) - 메모리에만 존재, DB에 저장 안함" · `packages/shared/src/types/collection.types.ts:41`                   | memory-only    |
| runtimeData set 경로 | `stores/utils/dataActions.ts:209` (`updateCollection` 안, History 밖) · `:297` (`setCollectionData`) · `:740` (API 실행 결과) — 전부 Zustand `newMap.set` 만, adapter 미호출 | IDB 미기록     |
| collection 영속      | `lib/db/indexedDB/adapter.ts:564-598` `collections.create/update` = `putToStore("collections", …)` — 전달된 객체 통째 저장 (runtimeData 를 넣으면 실림)                      | 영속 경로 존재 |
| 실행 정책            | 없음 — `executeApiEndpoint` 는 Send 클릭만 (`ApiEndpointEditor.tsx:122`). refreshInterval/setInterval/onOpen 자동 실행 0                                                     | 미존재         |
| Settings 탭          | `editors/DataTableEditor.tsx:101-160` SettingsEditor = 테이블 이름 + `useMockData` 토글뿐. 엔드포인트 picker·정책 0                                                          | 최소           |
| export/redactor      | `stores/utils/dataChange.ts` · `dataActions.ts` redactor 경계 (secret) — runtimeData 는 현재 export 대상 아님 (memory-only)                                                  | 영향 검토 필요 |
| useMockData          | `data.types.ts:86` (필수) · sample/real 토글은 현행 유지 (본 ADR 은 "데이터 소스" 개념으로 감쌈, §4-0 원칙 2)                                                                | 유지           |

**Phase 0 freeze 산출물**: 위 표 확정 + (a) collection 레코드 현재 평균/최대 크기와 runtimeData 실측 크기(영속 시 IDB·export 증가량) (b) export envelope 가 collection 을 싣는 경로 전수 + runtimeData 포함 시 redactor/번들 영향 (c) `DataTableUpdate` 가 이미 runtimeData 를 받음(`data.types.ts:107`) — 적용기 재사용 가능 여부.

## 2.1 Phase 0 freeze 결과 (2026-09-12 — 게이트 G0)

§2 표의 코드 사실 전량 재검증 (working tree clean · round 4 검증분과 일치, drift 0). 아래는 Phase 0 이 추가로 확정한 freeze 산출물.

**(a) 크기 — 구조 경계 (수치 실측은 Phase 3/m5)**: `runtimeData` = API 응답 배열 전체 (행수 × 필드수에 선형, 상한 없음). 대안 B 채택으로 `collections` store 레코드 크기는 **불변** — runtimeData 는 별도 `collection_runtime` store 로 격리되고, `executionPolicy` 만 레코드에 추가(`{mode}` 문자열 + optional `intervalSec`, ≈ 30~50 byte). export/Preview 의 `toRuntimeCollection` 은 이미 runtimeData 를 제외하므로 **export 크기는 runtimeData 영속과 무관**. 3구간(100·1000·5000행) byte·IDB write/read p95 는 Phase 3 에서 실측.

**(b) export/sync 경로 전수 (3 채널) + redactor·번들**:

| 채널                             | 위치                                              | 현재 collection 투영                                       | runtimeData |                  executionPolicy(신규)                  |
| -------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | :---------: | :-----------------------------------------------------: |
| in-page Preview (postMessage)    | `dataChange.ts:113-123` `UPDATE_DATA_TABLES`      | id·name·schema·mockData·**runtimeData**·useMockData 인라인 |    포함     |                 Phase 3: **제외**(명시)                 |
| new-tab Preview (sessionStorage) | `BuilderCore.tsx:1141-1153` `toRuntimeCollection` | id·name·schema·mockData·useMockData                        |    제외     | Phase 3: 제외(Preview 계약) → **runtimeData 포함 필요** |
| JSON export                      | `BuilderCore.tsx:1179-1184` `toRuntimeCollection` | id·name·schema·mockData·useMockData                        |    제외     |    Phase 3: **포함**(import 보존) · runtimeData 제외    |

- **R5 확정**: new-tab Preview 와 JSON export 가 `toRuntimeCollection` **단일 함수 공용** → 한쪽 계약(Preview=응답 포함·정책 제외 / export=정책 포함·응답 제외)이 서로 배타라 반드시 **채널별 projection 분리** (Phase 3, HC3). in-page postMessage 는 별도 인라인 투영이라 executionPolicy 를 실수로 싣지 않도록 명시 제외 필요.
- **redactor/HC6**: 세 채널 모두 endpoint 는 `toRuntimeApiEndpoint`(`collectionSnapshot.ts`, BuilderCore:1147·1183)로 headers 를 싣되 값은 `{{secret.NAME}}` **참조**뿐 — 원문은 별도 vault DB(`composition-secrets`, `secretVault.ts`)에만. runtimeData 는 API **응답**이라 요청 secret 을 담지 않는다. 원문 secret 이 export/postMessage 에 실릴 경로 = **0 (현행 유지)**. Phase 1 의 sourceRev 지문도 secret 참조는 이름+revision 만(원문 미저장).
- **번들**: `executionPolicy` 필드 추가 + `collection_runtime` store 는 initial-chunk import 를 늘리지 않음 — Phase 3 에서 initial Builder chunk 증가 0 검증(G3).

**(c) 적용기 재사용**: `DataTableUpdate`(`data.types.ts:107`)의 Pick 이 **이미 `runtimeData` 포함** → runtimeData 영속은 새 DataOp 형상 없이 기존 `applyDataChange` 경로 재사용 가능. `executionPolicy` 는 Pick·DataOp·역연산·`persistablePatch`에 신설 필요(Phase 1).

**BC 정량화 (R7)**: `executionPolicy` optional 필드 — 기존 레코드 로드 시 부재=manual, **재직렬화 불요 (read 호환, 0% breaking)**. runtimeData 영속은 신규 별도 store 라 기존 `collections` 레코드 무변경 (additive). 기존 레코드는 다음 명시 편집(`applyDataChange`) 때만 executionPolicy 를 얻음.

**저장소 현행**: `adapter.ts:32` `DB_VERSION = 21` — `collection_runtime` objectStore **부재** → Phase 1 이 22 로 bump + `createObjectStore("collection_runtime")` + upgrade 경로. `collections.update`(`:576-592`)는 `{...existing,...updates}` 스프레드라 runtimeData 를 넣으면 실림 — 오늘 runtimeData set 3경로(`dataActions.ts:209/297/740`)가 adapter 미호출이라 미기록(§2 정합).

**m4 실행 경로 인벤토리 (새 collection-level 정책과 범위 구분)**:

| 경로                    | 위치                                                                                                                | 트리거                           | 새 정책 관계                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| Send(수동)              | `ApiEndpointEditor.tsx:122` `executeApiEndpoint(id)`                                                                | 편집기 Send 버튼                 | `manual` 정책과 동일 표면                                                   |
| endpoint 역조회         | `BuilderCore.tsx:897-911` `targetCollectionId`(정본)·`targetCollection` name 폴백 → `executeApiEndpoint(linked.id)` | Preview 진입 로드                | `auto` 정책의 host=Builder 실행점 (cardinality 0..1 근거)                   |
| agent                   | `services/agent/dataAgentCommands.ts`                                                                               | AI 데이터 명령                   | 정책 밖 (사용자 명시 실행)                                                  |
| legacy binding interval | `useCollectionData.tsx:519-528` 고정 `setInterval(reload)`                                                          | 컴포넌트 dataBinding refreshMode | **별개 경로 유지** — 새 `interval` 정책(coalesce/재예약)과 혼동 금지(R2·R4) |

**m5 측정 기준 freeze (조건·통과선만, 수치는 Phase 3)**: fixture 3구간 100·1000·5000행 · 대조군 = 현행 memory-only arm vs 별도 store 영속 arm · 조건 = foreground Chromium·DPR2·visible·cold1+warm N · 판정선 = 목록 로드 p95 증가 상한 · IDB write/read p95 · initial 집계 단위 + 기준 SHA · interval 누적 힙 고수위선. Q2 불리 케이스 = 대용량 응답·interval 누적·A/B 역순, Q4 = 정책이 실제 실행 경로에 배선.

**G0 판정**: §2 freeze + export 3채널 전수 + BC 정량화 + m5 조건·통과선 확정 완료 → **G0 PASS**. Phase 1 착수 조건(실측/기준 확보) 충족.

## 3. Phase 계획

### Phase 0 — 인벤토리 freeze (게이트 G0)

- [x] §2 표 확정 + 크기 실측 (collection 레코드 · runtimeData) · export 경로 전수 · redactor 경계 — §2.1 (a)(b)
- [x] BC 정량화: 기존 프로젝트 N개 재직렬화 영향 (optional 필드 추가라 read 호환인지 확인 — 미설정=기존 동작) — §2.1 BC(0% breaking, read 호환)
- [x] **측정 기준 freeze (m5, `measurement-validity` §1)**: fixture 행수 3구간(100·1000·5000)·byte 규모 · 대조군(현행 memory-only vs 별도 store 영속 arm) · 측정 조건(foreground Chromium·DPR2·visible·cold1+warm N) · 판정 기준(목록 로드 p95 증가 상한 · IDB write/read p95 · initial 집계 단위와 기준 SHA · interval 누적 힙 고수위선). 수치 실측은 Phase 3 에서 수행, Phase 0 은 조건·통과선 확정만 — §2.1 m5
- [x] **실행 경로 인벤토리 (m4)**: Send(`ApiEndpointEditor.tsx:122`) · agent(`dataAgentCommands.ts`) · endpoint 역조회(`BuilderCore.tsx:897-911`) · legacy binding interval(`useCollectionData.tsx:519-528`) 을 표로 — 새 collection-level 정책과 각 경로의 범위 구분 freeze — §2.1 m4

### Phase 1 — 저장 형식 확장 + 캐시 유효성 (게이트 G1) — ✅ Implemented 2026-09-13 (`1de25662c`·`b6156c6f5`)

- [x] `executionPolicy?` 필드 추가 (`DataTable` · `DataTableDefinition`): `{ mode: "auto" | "manual" | "interval"; intervalSec?: number }` (미설정 = manual, BC). `set_execution_policy` DataOp(역연산=이전 정책, HUMAN_ONLY)·`persistablePatch` 배선 완료
- [x] runtimeData 영속: 별도 `collection_runtime` store(대안 B, DB_VERSION 21→22) — execute sink 에 영속 배선(sourceRev+fieldKeys), History 밖 유지, 삭제 시 캐시 정리(고아 0, 적용기 persist + hydration 양쪽)
- [x] **캐시 유효성 (h1/HC4)**: `sourceRev`(`sourceRev.ts`) = `baseUrl+path+method` + query/header enabled·정규화 key·**비민감 값** + body + `dataPath` + schema(**field.id+type** — rename 안정). **secret 참조만** 원문 대신 `참조 이름 + vault revision` — SecretRow `revision` 신설(덮어쓰기 시 bump, 사용자 승인 편집), `getSecretRevisions`(값 미반환), 원문 지문 0(HC6). hydration 불일치면 폐기, rename 은 fieldKeys 로 값 보존 remap. 진행 중 요청은 시작 revision(startRev)을 완료 수용 시 재계산 대조(endRev)
- [x] `applyDataChange` 경로로만 정의 쓰기 (HC1) · migration: optional 필드 read 호환 (runtimeData 캐시는 정의가 아닌 별도 store 라 History 밖)

**G1 live 9/9** (`scripts/adr218-p1-cache-live.mjs`, evidence `docs/adr/evidence/218-p1-cache-live.md`): store 생성·영속·hydration 복원(재fetch 0)·path 변경 무효화(h1)·rename 캐시 유지·삭제 고아 0·HC6. 유닛 `sourceRev.test.ts` 10 + `dataActions.runtimeCache.test.ts` 5 + set_execution_policy 왕복 2, 회귀 0.

### Phase 2 — Settings "데이터 소스" UI + endpoint 연결 (게이트 G2) — ✅ Implemented 2026-09-13

- [x] `DataTableEditor` Settings 탭 → "데이터 소스": 샘플/실제(`useMockData`) + 엔드포인트 picker(PropertySelect) + 실행 정책 컨트롤(자동/수동/N초, interval 시 N초 입력) — 스냅 패널 어법(HC2, Select 드롭다운은 표준 컨트롤·생성 팝오버 0), 신규 문자열 `datatable.*` ko/en 11×2 (HC7, parity 확인)
- [x] **endpoint 연결 계약 (m3)**: cardinality 0..1, 정본 = `endpoint.targetCollectionId`. `set_source{endpointId}` throw 대체 — `""`=해제 · `<id>`=연결(교체 시 기존 해제) · 역연산 = 단일 set_source 로 이전 연결 재현. **해제는 `targetCollectionId: undefined` 명시 대입**(adapter.update `{...existing,...next}` 병합이라 delete 는 IDB 미반영 — G2 live 에서 발견·수정)
- [x] 쓰기 전부 `applyDataChange` (HC1) — 정책·연결 모두 op 경유

**G2 live 7/7** (`scripts/adr218-p2-settings-live.mjs`, evidence `docs/adr/evidence/218-p2-settings-live.md`): 데이터 소스 UI 렌더 · picker 연결(set_source targetCollectionId 영속) · 정책 interval(set_execution_policy 영속) · Undo 정책·연결 복원(undos=2 순서 정확) · native dialog 0(HC2) · page error 0. 유닛 set_source 연결 4(교체·역연산 왕복·disconnect·없는 id throw), 회귀 0(ADR-218 스위트).

### Phase 3 — 실행 정책 런타임 + 요청 경쟁 + closure (게이트 G3) — ✅ Implemented 2026-09-13 (`d014a20a6`)

- [x] 정책 런타임: `auto`(handlePreview 가 Preview 열기 전 mode==="auto" collection 실행) · `manual`(Send/새로고침) · `interval`(`useExecutionPolicyScheduler`). **interval 스케줄(h2/HC6)**: 자기 재예약 setTimeout — 완료 후에야 다음 tick N초 예약(응답>주기 정상 완료 보장)·진행 중이면 skip(coalesce)·정리 훅 타이머 leak 0. 정책 시그니처 dep 이라 데이터 변경엔 재스케줄 0
- [x] **실행 host = Builder**(m4) · **채널별 projection(m3/R5)**: `toExportCollection` 신설 — export=executionPolicy 포함·runtimeData 제외 / Preview sessionStorage=`toRuntimeCollection`(둘 다 제외) / postMessage=runtimeData 포함·정책 제외. `project.schema` executionPolicy 추가(import 보존). legacy binding interval 별개 유지
- [x] **요청 경쟁 (h2/HC5)**: `runSeqByCollection` single-flight — 완료 수용은 시작 seq 최신 + 시작/완료 지문 일치 시만. abort 는 timeout 전용 유지, 자동 tick 은 abort 아닌 skip
- [x] runtimeData 영속 → 다음 세션 hydration 복원(Phase 1 G1) · 새 응답이 덮어씀(execute set)
- [x] export/redactor: export=정책 포함·응답 제외, postMessage=응답 포함·정책 제외(별개 채널), secret 원문 0(HC6). initial 번들 순증: lazy 청크 밖 신규 import 0(스케줄러는 BuilderCore 경유·이미 로드)
- [x] a11y: 정책 컨트롤 = PropertySelect(RAC, 키보드·이름 D1) · G2 live native dialog 0 · G3 live page error 0
- [x] CHANGELOG · README Implemented · `### Live Exercise`

**G3 live 5/5** (`scripts/adr218-p3-runtime-live.mjs`, evidence `docs/adr/evidence/218-p3-runtime-live.md`): interval 주기 반복(응답<주기 자기 재예약)·정책 제거 후 타이머 0(R6)·채널 projection export(정책 포함·응답 제외, R5)·dialog 0·error 0. 유닛 runSeq A/B 1(늦은 A/빠른 B→B만)·toExportCollection 2, 회귀 0.

- [x] **m5 수치 실측 (2026-09-13 후속)** — `scripts/adr218-m5-measure.mjs` (IDB p95 · 로드 A/B · interval 힙) + `adr218-m5-heapdiff.mjs` (스냅샷 diff) + 번들 before/after worktree, evidence `docs/adr/evidence/218-m5-measure.md`. 결과: IDB 5,000행 put/get p95 2.8/1.3 ms PASS · 로드 Δp95 −23 ms(캐시 3×5,000 hydration ≤ 31 ms, 재fetch 0) PASS · 힙 = JS 데이터 누적 0(raw usedSize 기울기는 JIT code space + 타임라인 버퍼 — raw 판정선 FAIL 수치와 분해를 evidence 에 그대로 둠, 재측정 판정선은 JS 데이터 Δ ≤ 1× payload) · 번들 Builder +2,111 / Preview +449 B gzip — 순증 한도 PASS, 217 절대 상한 초과(+1,798 / +548) 는 **사용자 재승인 2026-09-13 (새 상한 Builder 1,281,643 / Preview 666,309, 만료 2026-10-13)**. 후속 후보(범위 밖): 5,000행 tick 당 `set({collections})` long task 1 (production 127 ms).

## 4. 파일 변경표 (추정 — Phase 0 freeze)

| 파일                                                                                                                                 | Phase | 변경                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | :---: | --------------------------------------------------------------------------------------------------------- |
| `types/builder/data.types.ts` · `packages/shared/src/types/collection.types.ts`                                                      |   1   | `executionPolicy?` · runtimeData 영속 계약 갱신                                                           |
| `lib/db/indexedDB/adapter.ts`                                                                                                        |   1   | `collection_runtime` objectStore + migration + 삭제 정리                                                  |
| `packages/shared/src/schemas/dataChange.ts` · `stores/utils/dataChange.ts`                                                           |  1·2  | `set_source{endpointId}` throw 대체 · executionPolicy DataOp·역연산·`persistablePatch` · rename 캐시 변환 |
| `stores/utils/dataActions.ts`                                                                                                        |  1·3  | 영속 배선 · `runSeq` single-flight · 응답 수용 게이트(`:543-561`·`:680-693`·`:722-745`)                   |
| `panels/datatable/utils/secretVault.ts`                                                                                              |   1   | SecretRow 변경 revision(세대) — 값 교체 시 bump, sourceRev 가 참조(원문 미저장)                           |
| `main/BuilderCore.tsx` · `packages/shared/src/hooks/useCollectionData.tsx` · `packages/shared/src/collections/collectionSnapshot.ts` |   3   | 실행 host=Builder 경계 · legacy interval 구분 · Preview snapshot 응답만                                   |
| `panels/datatable/editors/DataTableEditor.tsx` (SettingsEditor)                                                                      |   2   | 데이터 소스 picker + 정책 컨트롤 + endpoint 연결                                                          |
| `i18n/translations.ts` (`datatable.*`)                                                                                               |   2   | 키 추가 ko/en                                                                                             |
| `scripts/adr218-*-live.mjs` (신규)                                                                                                   |   3   | live 하니스                                                                                               |

## 5. 검증 전략

- 원복 RED: 저장 형식 확장·정책 런타임·캐시 유효성·single-flight 는 동작 변경 → 전량. UI 는 axe + 키보드.
- live 필수 시나리오(리뷰 round 1·2 회귀): (a) **rename→offline reload** — API 응답 저장 → field rename → offline reload 시 현재 key 표시, 옛 key 섞임 0 (h1) (a2) **같은 endpoint id path/query/헤더 비민감 값 수정→offline reload** — revision 불일치로 이전 소스 응답 무효화 (round 2·3 h1) (a3) **동일 secret 이름 값 교체→옛 캐시·진행 중 응답 무효화** — vault revision bump, 원문 지문 0 (round 3 h1) (b) **A/B 역순 완료** — 느린 A·빠른 B 시 최신 B 유지 (b2) **응답시간 > 주기 API 를 여러 tick 실행** — 성공 응답 실제 갱신(매 tick 취소 아님) (round 2 h2) (c) endpoint picker 연결 교체 + Undo 복원 (m3) (d) 헤더 Preview payload / JSON export payload / import 결과 대조 — Preview=응답 포함·정책 제외, export=정책 포함·응답 제외, secret 0 (round 2 m3) (e) 정책 3종 실행 + 세션 재로드 복원 + interval 정리 후 타이머 0.
- 측정(m5, `measurement-validity` §1·Q2·Q4): fixture 3구간(100·1000·5000행) · 대조군(memory-only vs 영속) · 조건(foreground·DPR2·visible·cold1+warm N) · 판정선(목록 로드 p95 증가 상한·IDB p95·initial 증가 0·interval 누적 힙). Q2 불리 케이스 = 대용량 응답·interval 누적·A/B 역순, Q4 = 정책이 실제 실행 경로에 배선.
- BC: 기존 프로젝트(executionPolicy 없음) 로드 시 manual 동작 유지 확인.
