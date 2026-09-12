# ADR-218 Design Breakdown: collection 런타임 데이터 영속 · 실행 정책

> 본문: [218-collection-runtime-data-persistence-execution-policy.md](../218-collection-runtime-data-persistence-execution-policy.md) · 선행 base: [ADR-152](../completed/152-data-panel-collection-binding-integration.md) (저장 형식 · `DataChange` 적용기) · 분리 출처: [ADR-212](../completed/212-data-panel-editor-redesign.md) Phase 5 이월 2건. 리서치 정본: [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §4-0 · §4-2 (UX-6).

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

## 3. Phase 계획

### Phase 0 — 인벤토리 freeze (게이트 G0)

- [ ] §2 표 확정 + 크기 실측 (collection 레코드 · runtimeData) · export 경로 전수 · redactor 경계
- [ ] BC 정량화: 기존 프로젝트 N개 재직렬화 영향 (optional 필드 추가라 read 호환인지 확인 — 미설정=기존 동작)
- [ ] **측정 기준 freeze (m5, `measurement-validity` §1)**: fixture 행수 3구간(100·1000·5000)·byte 규모 · 대조군(현행 memory-only vs 별도 store 영속 arm) · 측정 조건(foreground Chromium·DPR2·visible·cold1+warm N) · 판정 기준(목록 로드 p95 증가 상한 · IDB write/read p95 · initial 집계 단위와 기준 SHA · interval 누적 힙 고수위선). 수치 실측은 Phase 3 에서 수행, Phase 0 은 조건·통과선 확정만
- [ ] **실행 경로 인벤토리 (m4)**: Send(`ApiEndpointEditor.tsx:122`) · agent(`dataAgentCommands.ts:96`) · endpoint 역조회(`BuilderCore.tsx:897-911`) · legacy binding interval(`useCollectionData.tsx:517-530`) 을 표로 — 새 collection-level 정책과 각 경로의 범위 구분 freeze

### Phase 1 — 저장 형식 확장 + 캐시 유효성 (게이트 G1)

- [ ] `executionPolicy?` 필드 추가 (`DataTable` · `DataTableDefinition`): `{ mode: "auto" | "manual" | "interval"; intervalSec?: number }` (미설정 = manual, BC). DataOp·역연산·`persistablePatch`(`dataChange.ts:1020-1026`) 배선 명시
- [ ] runtimeData 영속: 별도 `collection_runtime` store(대안 B) — 적용기 경로에 영속 배선, History 밖 유지, 삭제 시 캐시 정리(고아 0)
- [ ] **캐시 유효성 (h1/HC4)**: `sourceRev` = `baseUrl+path+method` + query/header 의 enabled·정규화 key·**value(비민감 값 포함, Accept-Language·X-Tenant 등 — 실제 소비 `dataActions.ts:625-635`)** + body + `responseMapping.dataPath` + schema. **secret 참조(`{{secret.NAME}}`)만** 원문 대신 `참조 이름 + vault revision` — SecretRow 에 **변경 세대(revision)** 신설(`secretVault.ts:44-49,72-85` 덮어쓰기 시 bump, `dataActions.ts:660-664` 치환), 원문은 지문 메타에 0(HC6). URL/query/body/header 어디의 secret 참조든 동일. define_endpoint 동일 id 정의 변경(`dataChange.ts:440-479`→`:593-648`) 포함. hydration·소스·인증 변경 시 불일치면 폐기, rename 만 값 보존 변환. Undo/Redo revision 재판정. 진행 중 요청은 시작 revision(secret 포함)을 완료 수용 시 대조
- [ ] `applyDataChange` 경로로만 쓰기 (HC1) · migration: optional 필드라 기존 레코드 read 호환

### Phase 2 — Settings "데이터 소스" UI + endpoint 연결 (게이트 G2)

- [ ] `DataTableEditor` Settings 탭 → "데이터 소스": 샘플/실제(`useMockData`) + 엔드포인트 picker + 실행 정책 컨트롤(자동/수동/N초) — 스냅 패널 어법(HC2), 신규 문자열 `datatable.*` ko/en (HC7)
- [ ] **endpoint 연결 계약 (m3)**: collection↔endpoint cardinality 0..1, 정본 = `endpoint.targetCollectionId`. picker 는 `set_source{endpointId}` 를 승인 dispatcher 확장으로 — 새 연결 + 기존 연결 해제를 한 DataChange(역연산 = 이전 연결 복원). `dataChange.ts:785-798` throw 대체. 연결만 = set_source 확장 / endpoint 정의 변경 = define_endpoint
- [ ] 쓰기 전부 `applyDataChange` (HC1)

### Phase 3 — 실행 정책 런타임 + 요청 경쟁 + closure (게이트 G3)

- [ ] 정책 런타임: `auto`(Builder 가 Preview 열기 전 1회) · `manual`(Send/새로고침 버튼) · `interval`(N초). **interval 스케줄(h2/HC6)**: 자동 tick 은 abort 하지 않고 **진행 중이면 skip/coalesce 또는 완료 후 N초 재예약**(고정 tick + 매 tick abort 금지 — 응답시간 > 주기인 정상 API 완료 기회 보장, 현행 `useCollectionData.tsx:521-524` 고정 setInterval 대비). 정리 훅으로 leak 0
- [ ] **실행 host = Builder**(m4) — Builder 가 정책 실행, Preview 는 runtimeData snapshot 만 수신. **채널별 projection(m3)**: `toRuntimeCollection`(`collectionSnapshot.ts:35-45` 단일 allowlist, 현재 `BuilderCore.tsx:1141-1144` Preview·`:1179-1184` export 공용)을 분리 — Preview 채널 = 응답 포함·정책 제외, export 채널 = 정책 포함(import 보존)·응답 제외. postMessage(`dataChange.ts:113-123`) 별개. legacy binding interval 은 별개 경로 유지
- [ ] **요청 경쟁 (h2/HC5)**: collection 별 `runSeq` — 완료는 seq 일치 + 시작 revision 일치 시만 store·캐시 수용(현행 `dataActions.ts:543-561` 미차단·`:680-693` timeout 전용·`:722-745` 무조건 쓰기 대체). **abort 는 사용자 재실행·소스/정책 변경에만**, 자동 tick 은 abort 대신 skip. hydration seq 0 기준
- [ ] runtimeData 영속 → 다음 세션 로드 시 마지막 성공 응답 표시 (오프라인/미실행 상태에서도 빈 상자 아님), hydration vs 새 응답 우선순위(첫 새 응답이 덮어씀)
- [ ] export/redactor: runtimeData 포함 정책(기본 제외) · `postMessage`(`dataChange.ts:113-123` raw response) 제외는 export 제외와 **별개 정책** · 번들 영향 0 확인
- [ ] a11y: 정책 컨트롤 키보드·`role=status` · axe critical 0 · live 하니스 `scripts/adr218-*-live.mjs`(A/B 역순 완료·정지 후 완료·rename→offline reload·헤더 Preview 진입 endpoint 호출 수 포함)
- [ ] CHANGELOG · README Implemented · `### Live Exercise`

## 4. 파일 변경표 (추정 — Phase 0 freeze)

| 파일                                                                                                                                 | Phase | 변경                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | :---: | --------------------------------------------------------------------------------------------------------- |
| `types/builder/data.types.ts` · `packages/shared/src/types/collection.types.ts`                                                      |   1   | `executionPolicy?` · runtimeData 영속 계약 갱신                                                           |
| `lib/db/indexedDB/adapter.ts`                                                                                                        |   1   | `collection_runtime` objectStore + migration + 삭제 정리                                                  |
| `packages/shared/src/schemas/dataChange.ts` · `stores/utils/dataChange.ts`                                                           |  1·2  | `set_source{endpointId}` throw 대체 · executionPolicy DataOp·역연산·`persistablePatch` · rename 캐시 변환 |
| `stores/utils/dataActions.ts`                                                                                                        |  1·3  | 영속 배선 · `runSeq` single-flight · 응답 수용 게이트(`:543-561`·`:680-693`·`:722-745`)                   |
| `panels/datatable/utils/secretVault.ts` | 1 | SecretRow 변경 revision(세대) — 값 교체 시 bump, sourceRev 가 참조(원문 미저장) |
| `main/BuilderCore.tsx` · `packages/shared/src/hooks/useCollectionData.tsx` · `packages/shared/src/collections/collectionSnapshot.ts` |   3   | 실행 host=Builder 경계 · legacy interval 구분 · Preview snapshot 응답만                                   |
| `panels/datatable/editors/DataTableEditor.tsx` (SettingsEditor)                                                                      |   2   | 데이터 소스 picker + 정책 컨트롤 + endpoint 연결                                                          |
| `i18n/translations.ts` (`datatable.*`)                                                                                               |   2   | 키 추가 ko/en                                                                                             |
| `scripts/adr218-*-live.mjs` (신규)                                                                                                   |   3   | live 하니스                                                                                               |

## 5. 검증 전략

- 원복 RED: 저장 형식 확장·정책 런타임·캐시 유효성·single-flight 는 동작 변경 → 전량. UI 는 axe + 키보드.
- live 필수 시나리오(리뷰 round 1·2 회귀): (a) **rename→offline reload** — API 응답 저장 → field rename → offline reload 시 현재 key 표시, 옛 key 섞임 0 (h1) (a2) **같은 endpoint id path/query/헤더 비민감 값 수정→offline reload** — revision 불일치로 이전 소스 응답 무효화 (round 2·3 h1) (a3) **동일 secret 이름 값 교체→옛 캐시·진행 중 응답 무효화** — vault revision bump, 원문 지문 0 (round 3 h1) (b) **A/B 역순 완료** — 느린 A·빠른 B 시 최신 B 유지 (b2) **응답시간 > 주기 API 를 여러 tick 실행** — 성공 응답 실제 갱신(매 tick 취소 아님) (round 2 h2) (c) endpoint picker 연결 교체 + Undo 복원 (m3) (d) 헤더 Preview payload / JSON export payload / import 결과 대조 — Preview=응답 포함·정책 제외, export=정책 포함·응답 제외, secret 0 (round 2 m3) (e) 정책 3종 실행 + 세션 재로드 복원 + interval 정리 후 타이머 0.
- 측정(m5, `measurement-validity` §1·Q2·Q4): fixture 3구간(100·1000·5000행) · 대조군(memory-only vs 영속) · 조건(foreground·DPR2·visible·cold1+warm N) · 판정선(목록 로드 p95 증가 상한·IDB p95·initial 증가 0·interval 누적 힙). Q2 불리 케이스 = 대용량 응답·interval 누적·A/B 역순, Q4 = 정책이 실제 실행 경로에 배선.
- BC: 기존 프로젝트(executionPolicy 없음) 로드 시 manual 동작 유지 확인.
