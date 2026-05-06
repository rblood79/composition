# ADR-114: `imports` resolver + DesignKit 통합 — Superseded

## Status

Superseded — 2026-04-30

> **Superseded by [ADR-116](116-canonical-document-ssot-transition.md) + [ADR-115](115-remove-designkit-system.md)**.
> DesignKit integration scope was invalidated by ADR-115. The remaining `imports` fetch/cache/resolver work is no longer executed as a standalone ADR; it is absorbed into ADR-116 canonical document SSOT transition (`imports` canonical core hook + import/export adapter boundary) and ADR-111 G5 Pencil import/export parity.
>
> Historical note: 2026-04-27 partial invalidation had already removed the P5-F DesignKit section. 2026-04-30 closes the remaining P5-D/P5-E/G-Integration scope as ADR-116-owned follow-up.

## Context

### Domain (SSOT 체인 - [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

- **해당 domain (historical)**: **D2 (Props/API) + persistence + 외부 자산 통합** — pencil 공식 `imports` field + composition DesignKit 시스템 통합. ADR-903 의 P5-D/E/F 잔여 흡수.
- **현재 처리**: DesignKit 은 ADR-115 로 제거됐고, `imports` resolver/cache 는 ADR-116 canonical document boundary + ADR-111 G5 import/export parity 로 흡수한다.

### 배경

[ADR-903](903-ref-descendants-slot-composition-format-migration-plan.md) §3.10 의 `imports` field 는 P0 단계에서 **타입 스텁만** land 됨 (실제 fetch / cache / resolver 통합 미구현). 또한 composition DesignKit 시스템 (`kitLoader.ts:259` + `kitExporter.ts:33`) 은 **복사-적용 파이프라인** 으로 동작 — pencil `imports` 의 **참조형 외부 자산 fetch** 와 의미가 다름.

ADR-903 R7 ("DesignKit 을 pencil `imports` 와 혼동 시 범위 과소평가") 를 명시적으로 분리해 **별도 migration track** 으로 처리하기로 결정됐고, 본 ADR 가 그 track 의 land plan.

### 현재 상태

| 영역                                                                  |             상태             |
| --------------------------------------------------------------------- | :--------------------------: |
| pencil `imports` field 타입 스텁 (`imports?: Record<string, string>`) |        ✅ ADR-903 P0         |
| 외부 `.pen` fetch + parse                                             |          ❌ 미구현           |
| ResolverCache 통합 (resolved tree 캐싱)                               |          ❌ 미구현           |
| import 된 reusable 노드의 `<importKey>:<nodeId>` 형식 ref 참조        |          ❌ 미구현           |
| DesignKit (`kitLoader.ts` / `kitExporter.ts`) 복사-적용 파이프라인    | 제거됨 — ADR-115 Implemented |
| DesignKit ↔ canonical document 통합                                   |  무효화 — ADR-115 / ADR-116  |

### Superseded Resolution (2026-04-30)

| 원 ADR scope                        | 현재 소유자                         | 처리                                                                      |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| P5-D `imports` fetch + parse        | ADR-116 Phase 1~3 / G2~G4           | canonical store/API + import/export adapter boundary 안에서 재설계        |
| P5-E ResolverCache                  | ADR-116 Phase 2~5 / G3~G6           | hot path projection 제거 후 resolved canonical tree/cache 정책으로 재평가 |
| G-Integration with ADR-111          | ADR-111 G5 + ADR-116 Runtime Parity | Pencil `.pen` import/export schema-equivalent gate로 흡수                 |
| P5-F DesignKit integration decision | ADR-115                             | DesignKit 시스템 제거로 무효화                                            |

### Hard Constraints

1. ~~**DesignKit 복사-적용 파이프라인 무수정** — 기존 사용자 워크플로 보존. canonical 문서 tree 에 DesignKit 복사본 삽입 시 `metadata.importedFrom: "designkit:<kit-id>"` 출처 추적~~ — **ADR-115 로 무효화**: DesignKit 시스템 자체가 전수 제거됨
2. **`imports` 는 참조형 hook** — pencil 공식 의미 (외부 `.pen` URL/path 참조) 그대로. composition 확장 금지
3. **ResolverCache 통합 시 동기 캐시 히트 + async prefetch** — 사용자 인터랙션 차단 0
4. **ADR-111 (pencil 호환 frame 재설계) 의 import/export adapter 와 통합** — 동일 pencil schema 기반

### Soft Constraints

1. import 된 reusable 노드의 lifecycle (캐시 만료 / 재 fetch / 버전 업데이트) 정책 명문화
2. ~~DesignKit 통합 결정 — 사용자가 DesignKit 자산을 `imports` 로도 참조 가능한지 (또는 복사-적용 전용 유지) 의사결정 필요~~ — **ADR-115 로 무효화**: DesignKit 시스템 제거로 의사결정 불필요

## Alternatives Considered

### 대안 A: 단일 ADR + 3 Phase (imports fetch → ResolverCache 통합 → DesignKit 통합 결정)

- 설명: `imports` resolver 본체 + ResolverCache 통합 + DesignKit 통합 의사결정 + 실행을 단일 ADR + 3 Phase 로 일괄 진행
- 위험: 기술(M) / 성능(M) / 유지보수(L) / 마이그레이션(L)
- 3 영역이 독립적이지만 의존 — 일괄 진행 시 일관된 디자인 언어 + 통합 검증 가능

### 대안 B: 3 ADR 분리 (imports / ResolverCache / DesignKit 통합)

- 설명: P5-D / P5-E / P5-F 각각 별도 ADR
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 의존 그래프 명확하지만 중간 상태 (예: imports land 됐는데 ResolverCache 미통합) 시 캐시 미스 → 매 fetch
- DesignKit 통합 결정만 별도 ADR 화 가능 — 의사결정 (사용자 워크플로 변경 여부) 자체가 ADR 의 핵심

### 대안 C: imports 만 우선, ResolverCache + DesignKit 후속

- 설명: pencil 호환 외부 `.pen` import 만 우선 land. ResolverCache 통합 + DesignKit 통합은 별도 후속
- 위험: 기술(L) / 성능(**MED**) / 유지보수(M) / 마이그레이션(L)
- **성능 MED**: ResolverCache 미통합 시 매 fetch → 60fps 마진 영향 가능
- DesignKit 결정 미진행 → 사용자 혼동 (DesignKit 와 imports 의 차이 불명확)

### Risk Threshold Check

| 대안 |  HIGH+  | 판정                         |
| ---- | :-----: | ---------------------------- |
| A    |    0    | 채택 가능 ✅                 |
| B    |    0    | 가능하지만 의존 그래프 부담  |
| C    | 0 (MED) | 부분 land — 성능/사용자 혼동 |

대안 A 채택 — 3 Phase 분해로 일관된 디자인 + 통합 검증.

## Decision

**2026-04-30 결정**: 본 ADR 의 독립 구현은 폐기한다. `imports` 는 canonical document core hook 으로 남기되, fetch/cache/resolver 실행 계획은 ADR-116 의 canonical primary 전환과 함께 재정의한다. ADR-111 은 ADR-116 이후의 Pencil import/export parity gate에서 이 인터페이스를 소비한다.

Historical decision: **대안 A: 단일 ADR + 3 Phase (imports → ResolverCache → DesignKit 통합 결정)** 를 선택했으나, ADR-115/116 이후 독립 실행 가치가 사라졌다.

선택 근거:

1. design 문서 `903-phase5-persistence-imports-breakdown.md` 의 P5-D/E/F 가 본 ADR scope 와 정합. 신규 design 작성 불필요 (P5-D/E/F section 그대로 활용)
2. 3 영역이 독립적이지만 의존 (imports → ResolverCache → DesignKit) — 일괄 진행 시 통합 검증 가능
3. ADR-111 의 pencil 호환 adapter 와 통합 — 본 ADR 가 외부 `.pen` fetch 를 추가하면 ADR-111 의 import/export adapter 가 직접 사용 가능
4. DesignKit 통합 결정 (사용자 워크플로 변경 여부) 을 ADR 안에 명시 → 의사결정 추적성

### 기각된 대안 사유

- **대안 B 기각**: 의존 그래프 부담 + 중간 상태 (캐시 미스) 운영 비효율
- **대안 C 기각**: ResolverCache 미통합 시 성능 MED + DesignKit 결정 누락 시 사용자 혼동

> 구현 상세: [903-phase5-persistence-imports-breakdown.md](../design/903-phase5-persistence-imports-breakdown.md) §P5-D/E/F — historical reference. P5-D/E 는 ADR-116 으로 재귀속했고 P5-F 는 ADR-115 로 무효화됐다.

## Risks

| ID  | 위험                                                                                                           | 심각도 | 대응                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------- |
| R1  | 외부 `.pen` fetch 실패 / 네트워크 오류 시 import 된 ref 가 unresolvable                                        |  MED   | (a) fetch 실패 시 fallback 빈 노드 + dev console.warn (b) 사용자 알림 toast (c) IndexedDB 캐시 fallback (P5-E)               |
| R2  | 동기 캐시 히트 + async prefetch 설계 시 race condition (캐시 비어있을 때 fetch 진행 중인 동안 사용자 인터랙션) |  MED   | (a) async prefetch 완료까지 placeholder 표시 (b) prefetch 실패 시 fallback (c) Phase 2 (ResolverCache) 의 핵심 검증 시나리오 |
| R3  | ~~DesignKit 통합 결정이 사용자 워크플로 breaking change~~ — **ADR-115 로 무효화**                              |  N/A   | DesignKit 시스템 제거 (ADR-115 Implemented 2026-04-27) → 본 위험 소멸                                                        |
| R4  | ResolverCache 메모리 누수 — 대규모 프로젝트 (수백 imports) 시 캐시 무한 증가                                   |  LOW   | LRU 캐시 + 만료 정책 (Phase 2 Gate)                                                                                          |
| R5  | pencil schema 의 `imports` 형식 변경 시 호환성 깨짐                                                            |  LOW   | composition `version: composition-1.0` 고정 + pencil version detection adapter                                               |
| R6  | ADR-111 의 import/export adapter 와의 인터페이스 불일치                                                        |  MED   | ADR-111 land 후 본 ADR 진입 (의존). 인터페이스 spec 사전 합의                                                                |

잔존 HIGH 위험 없음.

## Gates

아래 gate 는 historical record 다. 독립 실행하지 않고 ADR-116 G2~G6 및 ADR-111 G5 gate 로 이동한다.

| Gate                                     | 시점        | 통과 조건                                                                                                                                                | 실패 시 대안                                                                 |
| ---------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **P5-D**: imports fetch + parse          | Phase 1     | (a) 외부 `.pen` URL/path → CompositionDocument parse / (b) `<importKey>:<nodeId>` ref 참조 정상 / (c) fetch 실패 fallback / (d) 샘플 5 종 import 성공    | fetch 도구 보강                                                              |
| **P5-E**: ResolverCache 통합             | Phase 2     | (a) 동기 캐시 히트 / (b) async prefetch 완료 후 캐시 히트 전환 / (c) IndexedDB 캐시 fallback / (d) LRU 메모리 정책 / (e) race condition 0                | placeholder UI + 재 fetch                                                    |
| ~~**P5-F**: DesignKit 통합 결정 + 실행~~ | ~~Phase 3~~ | ~~(a) Option α / β 결정 land (사용자 의견 반영) / (b) 결정에 따라 DesignKit 통합 또는 무수정 유지 / (c) 사용자 워크플로 회귀 0~~ — **ADR-115 로 무효화** | DesignKit 시스템 제거 (ADR-115 Implemented 2026-04-27) → P5-F gate 자동 소멸 |
| **G-Integration**: ADR-111 와 통합       | Phase 4     | (a) ADR-111 의 import/export adapter 가 본 ADR 의 fetch + ResolverCache 사용 / (b) pencil 샘플 5 종 import → roundtrip export 정합 / (c) 시각 회귀 0     | adapter 인터페이스 재설계                                                    |

## Consequences

### Positive

- ADR-903 §3.10 `imports` field 의 실제 동작 land — pencil 공식 schema 정합 완료
- ADR-111 의 pencil 호환 frame 재설계와 통합 — 외부 디자인 자산 import/export 자연스럽게 지원
- ~~DesignKit 통합 결정 추적성 확보 — 사용자 의사결정 명시적 기록~~ — **ADR-115 로 무효화** (DesignKit 시스템 제거)
- ResolverCache 통합 — 대규모 import 시 60fps 마진 안전
- ADR-903 P5-D/E ~~/F~~ 잔여 영역 종결 (P5-F 는 ADR-115 로 흡수 종료)

### Negative

- 외부 `.pen` fetch — 네트워크 의존성 + 보안 검토 필요 (CORS / CSP)
- 캐시 정책 + LRU 메모리 관리 — 일회성 설계 부담
- ~~DesignKit 통합 결정에 따라 사용자 워크플로 변경 가능~~ — **ADR-115 로 무효화**: DesignKit 시스템 제거로 사용자 워크플로 변경 없음 (ADR-115 §3.B 비교에 따라 외부 직접 의존 0 / DB 영향 0 확인)

## References

- [ADR-116](116-canonical-document-ssot-transition.md) — canonical document SSOT 전환 (본 ADR 의 `imports` resolver/cache 잔여 scope 흡수)
- [ADR-903](903-ref-descendants-slot-composition-format-migration-plan.md) — canonical document migration (Implemented 2026-04-26, 본 ADR 의 P5-D/E ~~/F~~ 잔여 흡수, P5-F 는 ADR-115 로 분리)
- [ADR-903 Phase 5 design](../design/903-phase5-persistence-imports-breakdown.md) — P5-D/E/F historical design reference (P5-F 는 ADR-115 로 무효화, P5-D/E 는 ADR-116 으로 재귀속)
- [ADR-111](111-layout-frameset-pencil-redesign.md) — Layout/frameset pencil 호환 재설계 (ADR-116 이후 G5 import/export parity 통합 대상)
- [ADR-113](113-tag-type-rename-hybrid-cleanup.md) — `tag → type` rename + hybrid cleanup (ADR-116 G5 field quarantine 에 연결)
- [ADR-115](115-remove-designkit-system.md) — DesignKit 시스템 즉시 전수 제거 (Implemented 2026-04-27, 본 ADR 의 P5-F 무효화 근거)
- pencil app `imports` schema — 본 ADR 의 호환 기준
