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

### Phase 1 — 저장 형식 확장 (게이트 G1)

- [ ] `executionPolicy?` 필드 추가 (`DataTable` · `DataTableDefinition`): `{ mode: "auto" | "manual" | "interval"; intervalSec?: number }` (미설정 = manual, BC)
- [ ] runtimeData 영속: 선택된 대안에 따라 (A=레코드 필드 / B=별도 `collection_runtime` store / C=side-store) — 적용기 경로에 영속 배선, History 밖 유지
- [ ] `applyDataChange` 경로로만 쓰기 (HC1) · migration: optional 필드라 기존 레코드 read 호환

### Phase 2 — Settings "데이터 소스" UI (게이트 G2)

- [ ] `DataTableEditor` Settings 탭 → "데이터 소스": 샘플/실제(`useMockData`) + 엔드포인트 picker + 실행 정책 컨트롤(자동/수동/N초) — 스냅 패널 어법(HC2), 신규 문자열 `datatable.*` ko/en (HC7)
- [ ] 쓰기 전부 `applyDataChange` (HC1)

### Phase 3 — 실행 정책 런타임 + closure (게이트 G3)

- [ ] 정책 런타임: `auto`(편집기/미리보기 열 때 1회) · `manual`(Send/새로고침 버튼) · `interval`(N초, 정리 훅으로 leak 0)
- [ ] runtimeData 영속 → 다음 세션 로드 시 마지막 성공 응답 표시 (오프라인/미실행 상태에서도 빈 상자 아님)
- [ ] export/redactor: runtimeData 포함 정책 결정 (기본 제외 or 마스킹) · 번들 영향 0 확인
- [ ] a11y: 정책 컨트롤 키보드·`role=status` · axe critical 0 · live 하니스 `scripts/adr218-*-live.mjs`
- [ ] CHANGELOG · README Implemented · `### Live Exercise`

## 4. 파일 변경표 (추정 — Phase 0 freeze)

| 파일                                                                            | Phase | 변경                                                              |
| ------------------------------------------------------------------------------- | :---: | ----------------------------------------------------------------- |
| `types/builder/data.types.ts` · `packages/shared/src/types/collection.types.ts` |   1   | `executionPolicy?` · runtimeData 영속 계약 갱신                   |
| `lib/db/indexedDB/adapter.ts`                                                   |   1   | runtimeData 영속 store (대안 B/C 시 신규 objectStore + migration) |
| `stores/utils/dataActions.ts` · `dataChange.ts`                                 |  1·3  | 영속 배선 · 정책 런타임 · export/redactor 경계                    |
| `panels/datatable/editors/DataTableEditor.tsx` (SettingsEditor)                 |   2   | 데이터 소스 picker + 정책 컨트롤                                  |
| `i18n/translations.ts` (`datatable.*`)                                          |   2   | 키 추가 ko/en                                                     |
| `scripts/adr218-*-live.mjs` (신규)                                              |   3   | live 하니스                                                       |

## 5. 검증 전략

- 원복 RED: 저장 형식 확장·정책 런타임은 동작 변경 → 전량. UI 는 axe + 키보드.
- live: 정책 3종(auto/manual/interval) 실제 실행 + 세션 재로드 시 runtimeData 복원 + interval 정리(leak 0) + export 에 secret/응답 정책 확인. `measurement-validity` Q2(불리 케이스=대용량 응답·interval 누적) · Q4(정책이 실제 실행 경로에 배선).
- BC: 기존 프로젝트(executionPolicy 없음) 로드 시 manual 동작 유지 확인.
