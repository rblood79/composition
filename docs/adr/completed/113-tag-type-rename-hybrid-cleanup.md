# ADR-113: `Element.tag → Element.type` rename + hybrid 6 필드 cleanup

## Status

Implemented — 2026-05-02. `Element.tag → Element.type` direct cutover 와 hybrid mirror field quarantine 을 완료했다. DB migration/backup/feature flag/read-through helper 없이 현행 runtime 은 `type` 단일 기준이며, legacy mirror field 는 canonical adapter/export boundary 로 격리한다.

> 2026-05-03 post-cutover follow-up 은 2026-05-05 rollback 으로 폐기됐다. 2026-05-06 current main follow-up 패치는 `layout_id` / `slot_name` / component marker type schema 를 되살리지 않고 adapter boundary / canonical write-through 기준으로 frame/component 회귀를 다시 닫았다.

### 진행 로그

- **2026-05-06 — rollback follow-up legacy mirror quarantine confirmation**:
  - page-frame body/Slot projection, shared frame multi-page refresh, component origin/instance materialization/override/customId follow-up 패치가 `layout_id` / `slot_name` / `componentRole` / `masterId` / legacy `overrides` type schema 를 되살리지 않는 것을 확인했다.
  - runtime frame/component compatibility 는 canonical adapter mirror/export boundary 와 active `CompositionDocument` write-through 기준으로 유지한다.
  - 검증: frame/component canonical regression sweep + FramesTab targeted vitest 4 files / 39 tests PASS + `pnpm run codex:preflight` PASS.
- **2026-05-03 — post-cutover legacy mirror quarantine follow-up (ROLLED BACK 2026-05-05)**:
  - ADR-116 frame persistence/render fix 를 `layout_id` / `slot_name` schema 재도입 없이 처리했던 작업. targeted vitest 는 PASS 했지만 상위 patch 군이 사용자 환경 누적 회귀로 폐기되어 완료 근거에서 제외한다.
- **2026-04-26**: Proposed (세션 35 마감)
- **2026-04-27 (세션 36)**: Phase 0-α 진입 — `unified.types.ts` 7 legacy fields `@deprecated` 마킹 (commit `d716da4e`)
- **2026-04-27 (세션 37)**: **Phase 1 + Phase 2 main land** (PR #250, commit `cad82b02`)
  - Phase 1 (Type 정의 8 file) + Phase 2 (mechanical rename ~140 file) 통합 진행
  - IDB adapter `normalizeLegacyElement` read-through compat helper 추가 (P4 까지 backward compat)
  - 변경 규모: 243 files / +2302 / -2034
  - 검증: type-check 0 / specs 322/322 / shared 72/72 / builder 4 failed (baseline 동일 — ADR-113 회귀 0)
  - dev runtime 정상 작동 확인 (사용자 검증)
- **2026-04-27 (세션 44)**: **Phase 4 design breakdown 사전 land** — `docs/adr/design/113-phase4-db-schema-migration-breakdown.md` (DB_VERSION 8→9 migration 6-step + ADR-903 P3-E E-6 패턴 재사용 + 3중 안전망 + 검증 명령). HIGH 위험 사전 설계로 미래 진입 시 즉시 구현 가능 상태 도달
- **2026-04-27 (세션 44)**: **Phase 3 manual review 종결** (회귀 0 확증)
  - sweep 결과 (전수 grep, packages/ + apps/, test/dist 제외):
    - `.tag` 잔존 13건 → 의도된 변수명/CSS class/Tag spec preset 12건 + IDB adapter `(el as { tag?: string }).tag` 1건 (Phase 4 DB schema migration 영역의 의도된 legacy 검사)
    - `tag: literal` 잔존 7건 → 전부 JSDoc BC 재평가 메모 (Card 5종 + Radio/CheckboxItems), 실 코드 0건
    - `.type ===` discriminator 459건 → 모두 Phase 1+2 mechanical rename 결과, narrowing 정상
    - `isCanonicalNode` runtime guard 호출 4건 → hot path 적용 부족 (LOW, 선택적 enhancement Phase 4 진입 시 점진 적용)
  - **회귀 위험: 0** (Phase 1+2 mechanical rename 도구 효율 — agent 추정 146 manual ref → 실제 의심 잔존 0)
  - Body.spec.ts JSDoc `element.tag` → `element.type` 정정 (1줄, comment-only)
- **2026-04-27 (세션 45)**: **Phase 4 Step 4-1 + 4-2 + 4-3 main land** (READ-ONLY 3단계)
  - **Step 4-1** (commit `0e9b5101`) — IndexedDB DB_VERSION 8 → 9 schema bump (no schema change — `tag` index 미존재). `MetaRecord.schemaVersion` enum 에 `"composition-1.1"` 추가 (composition-1.0 = tag 기반 / composition-1.1 = type 기반). `metaStore.test.ts` test 1 갱신. 비파괴: 기존 프로젝트 (composition-1.0) read-through 유지
  - **Step 4-2** (commit `79aaf808`) — 신규 `apps/builder/src/lib/db/migrationTagType.ts` 신설
    - `transformElementTagToType(el)` pure transformer: tag-only → type rename / type-only → no-op / 둘 다 → type 우선 + tag 제거 / 둘 다 missing → null (orphan error)
    - `runTagTypeMigration(adapter, projectId, { dryRun=true })` — composition-1.1 already-migrated → skipped, `createMigrationBackup` 호출 (Step 4-4 fallback 안전망), `elements.getAll()` read-only → transformations 결과 반환
    - `dryRun=false` 호출 → throw (Step 4-4 미구현 안내)
    - `__tests__/migrationTagType.test.ts` 신규 16 tests (TC-T1~T5 transformer + TC-M1~M11 integration, 50 fixture round-trip 포함)
  - **Step 4-3** (commit `19864dfe`) — `usePageManager.initializeProject` 의 P3-E migration 호출 직후에 `runTagTypeMigration(db, projectId, { dryRun: true })` 추가. 진입 조건: `metaRecord` 미존재 또는 `schemaVersion ∈ {legacy, composition-1.0}`. dev console 로그 출력 (`[ADR-113 P4 dry-run] status / transformedCount / errors`). try/catch graceful degrade
  - **검증**: type-check 3/3 PASS / db 영역 vitest 142/142 PASS (기존 126 + 신규 16) / usePageManager.canonical 회귀 0
  - **비파괴**: 3 단계 모두 dryRun=true 고정 → DB 무변경. 실제 transform 은 Step 4-4 (write-through) 로 남았으나, 2026-04-30 이후 진입 조건은 ADR-111 monitoring 이 아니라 ADR-116 G2 canonical store/export adapter 확정으로 재정렬한다.
- **2026-04-27 (세션 45)**: **Phase 5 design breakdown 사전 land** — `docs/adr/design/113-phase5-hybrid-6-cleanup-breakdown.md`
  - Inventory 갱신 (Phase 1+2 mechanical rename 후): componentRole 43 / masterId 61 / slot_name 38 / overrides 37 / descendants 100 = **279 ref / 73 file** (layout_id 207 ref ADR-111 흡수 영역 제외)
  - sub-Phase 5-A~5-E 분할 (필드별 5 단계) — 진입 순서 ref 수 적은 순 (LOW first): 5-A slot_name (38) → 5-B overrides (37) → 5-C componentRole (43) → 5-D masterId (61) → 5-E descendants (100, 내부 분할 권장)
  - 진입 prerequisite: ADR-116 Phase 0/1 (G1/G2) 로 canonical props/store/export adapter boundary 확정 + Phase 4 전체 (Step 4-4/4-5/4-6) 재평가. Phase 5 는 ADR-116 G5 field quarantine 의 하위 작업으로 실행한다.
- **2026-05-02 — Phase 4 direct cutover**:
  - 사용자 결정에 따라 기존 dev 데이터 보존, DB migration, backup, feature flag 를 모두 폐기했다. `runTagTypeMigration` / `migrationTagType.test` 를 삭제하고 `usePageManager.initializeProject` 의 dry-run entry 도 제거했다.
  - IDB read-through helper `normalizeLegacyElement` 를 제거했다. 기존 tag-only row 는 보존 대상이 아니며, 현행 runtime/persistence format 은 `Element.type` 단일 기준이다.
  - Phase 4 Step 4-4/4-5/4-6 은 별도 migration 단계가 아니라 direct cutover 로 종결한다.
- **2026-05-02 — Phase 5-A/C/D runtime access sweep**:
  - `slot_name` sweep: non-adapter / non-test / non-type runtime code 의 직접 field access 0건. page/frame slot fill 경로는 `slotMirror` adapter 로 격리되어 있다.
  - `componentRole` / `masterId` / `overrides` sweep: non-adapter runtime direct access 0건. `elementIndexer`, Skia `StoreRenderBridge`, `useResolvedElement` 는 `isMasterElement()` / `isInstanceElement()` / `getInstanceMasterRef()` helper 또는 canonical resolver param 을 사용하고, properties/fixture/store bridge/instance action 신규 경로는 `componentSemanticsMirror` adapter 로 격리되어 있다.
  - 검증: `g5LegacyFieldGrepGate.test.ts` 1 file / 3 tests PASS. 잔여 Phase 5 는 type schema/comment/test fixture 정리와 `descendants` schema sweep 이다.
- **2026-05-02 — Phase 5-E `descendants` runtime schema sweep**:
  - `descendants` 는 canonical `RefNode.descendants` 필드로 합법 잔존하므로 raw grep 0이 목표가 아니다. 새 `adr113DescendantsGrepGate.test.ts` 가 non-adapter runtime 접근을 canonical resolver (`resolvers/canonical/index.ts`), canonical store (`canonicalDocumentStore.ts`), shared type validator (`composition-vocabulary.ts`) allowlist 로 제한한다.
  - legacy `Element.descendants` 직접 access 는 adapter boundary 밖 runtime code 에서 0건으로 고정했다. comment/type schema/test fixture 는 별도 cleanup 대상으로만 남긴다.
  - 검증: `adr113DescendantsGrepGate.test.ts` 1 file / 1 test PASS.
- **2026-05-02 — Phase 5 shared schema/helper naming cleanup**:
  - `packages/shared` 의 project export schema 와 element utility 내부 `LEGACY_*` / `getLegacy*` 명칭을 mirror terminology 로 전환했다. 현재 `layout_id` / `slot_name` field 는 export schema mirror boundary 로만 유지한다.
  - 검증: `pnpm run codex:preflight` PASS.
- **2026-05-02 — ADR-111/116 legacy layout store removal sync**:
  - `useLayoutsStore` / `layoutActions` 본체 삭제로 G5-F 의 store/path 해체 조건은 닫혔다. `layout_id` field 자체는 DB/export mirror boundary 와 ADR-111/116 legacy field quarantine 잔여로 추적한다.
  - 검증: targeted vitest 11 files / 51 tests PASS + `pnpm run codex:preflight` PASS.
- **2026-05-02 — Phase 5 helper boundary cleanup**:
  - component semantics read-through helper 를 `unified.types.ts` 에서 제거하고 `componentSemanticsMirror` adapter 경계로 고정했다.
  - `MasterChangeEvent` / `DetachResult.previousState` 의 legacy-style field 명칭을 `originId` / `overrideProps` / `descendantPatches` 로 바꿨다.
  - strict non-adapter field-access grep 은 0건이며, `g5LegacyFieldGrepGate.test.ts` 가 unified types helper 재도입을 차단한다.
  - 검증: targeted vitest 5 files / 58 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — Phase 5 component mirror type schema / fixture cleanup**:
  - `apps/builder/src/types/builder/unified.types.ts` 와 `packages/shared/src/types/element.types.ts` 에서 `componentRole` / `masterId` / legacy `overrides` 선언을 제거했다.
  - legacy component mirror payload 타입은 `ElementWithLegacyMirror` / `LegacyElementMirrorFields` 로 adapter boundary 에만 둔다.
  - non-adapter component semantics fixture 는 `withComponentOriginMirror()` / `withComponentInstanceMirror()` helper 로 전환했다. raw `componentRole` / `masterId` fixture grep 은 0건이다.
  - `g5LegacyFieldGrepGate.test.ts` 가 shared type schema 재도입과 non-adapter raw component role/id fixture 재도입을 차단한다.
  - 검증: targeted vitest 7 files / 65 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — Phase 5 frame/slot type schema / targeted fixture cleanup**:
  - Builder/shared/preview Element/Page/Preview type schema 에서 `layout_id` / `slot_name` 선언을 제거하고, dead `ElementLayoutFields` / `PageLayoutFields` 를 삭제했다.
  - frame body/render root 와 slot assignment regression fixture 는 `withFrameElementMirrorId()` / `withSlotMirrorName()` helper 로 전환했다. targeted raw `layout_id:` / `slot_name:` fixture grep 은 0건이다.
  - `g5LegacyFieldGrepGate.test.ts` 가 frame/slot type schema 재도입과 targeted raw fixture key 재도입을 차단한다.
  - 검증: targeted vitest 5 files / 30 tests PASS + type-schema grep 0건 + targeted fixture grep 0건.
- **2026-05-02 — Phase 5 final quarantine closure**:
  - legacy `descendants` mirror field 선언을 `apps/builder` / `packages/shared` Element type schema 에서 제거했다. canonical `RefNode.descendants` 는 합법 canonical field 로 유지한다.
  - resolver/store/canvas/properties 비어댑터 테스트 fixture 의 raw legacy mirror key (`layout_id:` / `slot_name:` / `componentRole:` / `masterId:`) 를 adapter helper 기반으로 전환했다.
  - broader non-adapter raw fixture key grep 은 0건이며, runtime strict field access / type schema / descendants schema grep gate 도 0건이다.
  - 검증: fixture cleanup targeted vitest 14 files / 130 tests PASS + ADR-116 persistence/export/schema targeted builder vitest 5 files / 29 tests PASS + `pnpm run codex:typecheck` PASS.
- **잔여 Phase**:
  - ~~Phase 3 (Manual review)~~ — **종결 (2026-04-27)**
  - ~~Phase 4 (DB schema migration DB_VERSION 8→9)~~ — **direct cutover 로 종결 (2026-05-02)**. Step 4-4 write-through / 4-5 normalize helper / 4-6 validation 은 별도 migration 없이 제거 완료.
  - ~~Phase 5 (Hybrid 5 필드 cleanup, layout_id 제외)~~ — **종결 (2026-05-02)**. runtime access gate, `componentRole` / `masterId` / legacy `overrides` type schema, frame/slot/descendants type schema, broader raw fixture key bucket 모두 0건. 구현 상세: [Phase 5 breakdown](../design/113-phase5-hybrid-6-cleanup-breakdown.md)

## Context

### Domain (SSOT 체인 - [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **D2 (Props/API) — 타입/필드 이름 정합** + **persistence schema** — pencil 공식 schema 정합. ADR-903 의 G5 (b)/(c)/(d)/(e)/(f) 잔여 흡수.

### 배경

[ADR-903](903-ref-descendants-slot-composition-format-migration-plan.md) Implemented (2026-04-26) 후 canonical document 의 schema 는 `type` 필드 (pencil 공식) 기준으로 정의되었으나, **runtime/persistence 경로의 hybrid 잔존**:

- **`Element.tag` → `Element.type` rename** — baseline 2026-04-22 실측 1031 ref / 154 파일 → **Phase 1+2 mechanical rename 후 0 ref 도달** (2026-04-27 세션 36~37, PR #250). 2026-05-02 direct cutover 로 IDB adapter `normalizeLegacyElement` read-through compat helper 도 제거 완료
- **hybrid 6 필드** — baseline 2026-04-22 실측 1472 ref / 184 파일. **2026-04-27 세션 45 재측정 합계 486 ref / Phase 5 scope 279 ref / 73 file** (layout_id 207 ADR-111 흡수 영역 제외):
  - `layout_id` 207 ref (ADR-111 가 G3 영역 흡수, 본 ADR scope 외)
  - `descendants` 100 ref / 23 file (canonical 으로 정의됐으나 legacy `Override` 타입과 혼재)
  - `masterId` 61 ref / 13 file
  - `componentRole` 43 ref / 12 file
  - `slot_name` 38 ref / 12 file
  - `overrides` 37 ref / 13 file
- **`layoutTemplates.ts` 28 Slot 선언** — canonical format serialize 미적용 (ADR-111 Phase 1 함수 layer 가 변환 처리)
- **DB 저장 schema** — runtime DB migration 은 더 진행하지 않는다. 개발 단계 direct cutover 기준에서 tag-only row 보존은 목표가 아니며, 현행 저장/읽기 경로는 `type` 단일 기준이다

이 상태에서 신 컴포넌트 추가 / migration / pencil import-export 모두 hybrid 경로를 거쳐야 함 → SSOT 혼동 + dead code 영구화.

### Hard Constraints

1. **rename 전수 0 miss** — `Element.tag` 1031 ref 가 `Element.type` 으로 일괄 rename. discriminator 오판 (`undefined tag`) 0건
2. **DataBinding.type / FieldDefinition.type 과의 scope 분리** — `Element.type: ComponentTag` (116-literal union) vs `FieldType` (7-literal union) 완전 disjoint. runtime 교집합 0건
3. **DB schema 전환** — 신규/현행 row 는 `type` 단일 기준. 기존 tag-only row migration/read-through 는 보존하지 않는다
4. **roundtrip 시각 회귀 0** — 변환 전후 Skia/CSS 렌더 결과 동일
5. **hybrid 6 필드 cleanup** — adapter shim 한정 또는 0건

### Soft Constraints

1. ast-grep 또는 tsc --noEmit 자동 rename 도구 활용 (수동 review 후 land)
2. runtime type guard `isCanonicalNode(obj): obj is Element` 도입 — `type` + `id` + (optional `children`) 조합
3. direct cutover 이후 `tag → type` DB migration 단계는 유지하지 않는다

## Alternatives Considered

### 대안 A: 단일 ADR + 단일 Phase (전수 일괄 rename + cleanup) — 본 ADR scope

- 설명: `tag → type` rename + hybrid 6 필드 cleanup 을 단일 Phase 로 일괄 진행. ast-grep 도구 + runtime type guard + DB schema 전환 + roundtrip 검증
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(**HIGH**)
- **마이그레이션 HIGH**: 1472 ref / 184 파일 일괄 변경 — 부분 누락 시 runtime 회귀 가능성. 그러나 도구 자동화 + tsc --noEmit gate 로 관리 가능

### 대안 B: 2 ADR 분리 (rename 단독 + hybrid cleanup 단독)

- 설명: ADR-113a (`tag → type` rename) + ADR-113b (hybrid 6 필드 cleanup) 분리. 의존 그래프 명확화
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(M)
- 두 작업이 같은 영역의 schema cleanup → 분리 시 일관성 추적 부담 + 중간 상태 (rename 됐는데 hybrid 잔존) 가 복잡

### 대안 C: 점진 rename (componentRole/masterId 만 우선, tag/layout_id/descendants 후속)

- 설명: 사용 빈도 낮은 hybrid 필드 (componentRole 41 / masterId 55) 만 우선 cleanup. tag rename + layout_id/descendants/slot_name/overrides 는 후속
- 위험: 기술(L) / 성능(L) / 유지보수(**HIGH**) / 마이그레이션(L)
- **유지보수 HIGH**: hybrid 영구 잔존 가능성 + tag/type 혼용 → ADR-903 R1 영구화

### Risk Threshold Check

| 대안 |         HIGH+         | 판정                               |
| ---- | :-------------------: | ---------------------------------- |
| A    | 1 (마이그레이션 HIGH) | 도구 자동화 + Gate 로 수용 가능 ✅ |
| B    |           0           | 가능하지만 중간 상태 복잡          |
| C    |   1 (유지보수 HIGH)   | 회피 (영구 hybrid)                 |

대안 A 채택 — 도구 자동화 + tsc gate + roundtrip 검증으로 마이그레이션 HIGH 관리.

## Decision

**대안 A: 단일 ADR + 단일 Phase 일괄 rename + cleanup** 를 선택한다.

선택 근거:

1. design 문서 `903-phase5-persistence-imports-breakdown.md` 의 **P5-C (adapter shim 완전 해체)** 가 본 ADR scope 와 정합. 신규 design 작성 불필요
2. tag rename + hybrid cleanup 이 같은 영역의 schema 정합 → 분리 시 중간 상태 복잡 + 일관성 추적 부담
3. ast-grep 자동 도구 + tsc --noEmit gate + roundtrip 검증 3중 안전망으로 마이그레이션 HIGH 관리 가능
4. 단일 Phase land 후 SSOT 도달 (legacy 0)

### 기각된 대안 사유

- **대안 B 기각**: 두 작업이 같은 schema 영역 → 분리 시 일관성 추적 부담
- **대안 C 기각**: hybrid 영구 잔존 → ADR-903 R1 영구화

> 구현 상세: [903-phase5-persistence-imports-breakdown.md](../design/903-phase5-persistence-imports-breakdown.md) §P5-C — ADR-903 Phase 5 design 문서 그대로 활용
>
> **Phase 4 direct cutover 상세**: [113-phase4-db-schema-migration-breakdown.md](../design/113-phase4-db-schema-migration-breakdown.md) — 기존 DB migration/backup/flag 계획은 2026-05-02 direct cutover 로 superseded. `type` 단일 기준 + migration/read-through helper 제거가 현행 결정이다.

## Risks

| ID  | 위험                                                                                    | 심각도 | 대응                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 1031 ref `tag` rename 부분 누락 — runtime discriminator 오판 (`undefined tag`)          |  HIGH  | (a) ast-grep 자동 rename 도구 (b) TypeScript 타입 정의에서 `tag` 필드 제거 → tsc --noEmit 로 누락 참조 전량 노출 (c) `isCanonicalNode` runtime guard 도입 (d) tree walker `if (!isCanonicalNode(child)) continue` 방어 |
| R2  | DataBinding.type / FieldDefinition.type 과의 혼동 — `obj.type` 접근 시 잘못된 타입 추론 |  MED   | scope 분리 규칙 명문화 (`element.type` vs `element.props.columnMapping.*.type` vs `element.dataBinding.type` 3단계 nesting) + TypeScript literal union disjoint                                                        |
| R3  | direct cutover 후 tag-only dev 데이터가 로드되지 않을 수 있음                           |  MED   | 기존 데이터 보존은 목표가 아님. runtime 회귀는 `type` 단일 기준 fixture/type-check 로 수정                                                                                                                             |
| R4  | layoutTemplates.ts 28 Slot 변환 후 시각 drift                                           |  MED   | dry-run + roundtrip Skia/CSS 시각 비교 (ADR-111 와 동일 패턴)                                                                                                                                                          |
| R5  | hybrid 6 필드 중 사용 중인 영역 (예: descendants override) 의 의미 손실                 |  MED   | descendants 는 canonical 으로 의미 유지 (구조만 수정). componentRole 변환 시 `metadata.componentRole` 보존 (P5-B 결정 필요)                                                                                            |
| R6  | tsc --noEmit 통과해도 runtime 동작 차이 (예: serializer 의 `tag` literal hardcode)      |  MED   | runtime smoke test — 샘플 프로젝트 100% 시각 회귀 검증 (mockLargeDataV2 + 사용자 프로젝트 5종)                                                                                                                         |

잔존 HIGH 위험 없음 — R1은 Phase 1+2 mechanical rename, Phase 4 direct cutover, Phase 5 quarantine grep/type-check gate 로 닫았다.

## Gates

| Gate                                            | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                |
| ----------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **G5-B**: tag rename 도구 land                  | Phase 1 | (a) ast-grep 자동 rename 1031 ref / 154 파일 / (b) tsc --noEmit 0 error / (c) `isCanonicalNode` runtime guard land                                                                                                                                                                                                                  | 도구 보강 + 수동 review                     |
| **G5-C**: hybrid 6 필드 cleanup                 | Phase 2 | (a) `componentRole` / `masterId` / `slot_name` / `overrides` 4 필드 0 ref (b) `layout_id` adapter shim 한정 또는 0 (c) `descendants` canonical 으로 통합 (legacy Override 타입 제거)                                                                                                                                                | adapter shim 디렉터리 한정 + dead code 제거 |
| **G5-D**: layoutTemplates serialize             | Phase 3 | layoutTemplates.ts 28 Slot 전수 canonical format serialize / dry-run + roundtrip 시각 회귀 0                                                                                                                                                                                                                                        | 변환 도구 보강                              |
| **G5-E**: DB schema direct cutover (R3 매핑)    | Phase 4 | (a) `tag` read-through/migration helper 0건 / (b) `normalizeLegacyElement` 제거 / (c) 신규 runtime path `type` 단일 기준 / (d) backup/flag/fallback 없음                                                                                                                                                                            | runtime path 수정                           |
| **G5-F**: repo-wide legacy layout 0건 (R1 매핑) | Phase 5 | (a) §M7 측정 명령 결과 = 0 또는 `apps/builder/src/adapters/legacy-layout/` 한정 / (b) `useLayoutsStore` 본체 0줄 / (c) `BuilderCore.tsx` / `useIframeMessenger.ts` / `BuilderCanvas.tsx` / `AddPageDialog.tsx` / `PageLayoutSelector.tsx` / `stores/utils/layoutActions.ts` / `workspace/canvas/skia/workflowEdges.ts` 전 경로 해체 | adapter shim 디렉터리 한정                  |

## Consequences

### Positive

- ADR-903 R5 (`tag → type` rename 부분 누락) + R1 (legacy hybrid 영구화) 근본 해소
- pencil 공식 schema 와 1:1 매칭 — 외부 import/export 자연스럽게 지원 (ADR-111 + ADR-116 으로 흡수된 ADR-114 `imports` scope 와 통합)
- legacy 0 도달 → 신 컴포넌트 추가 / migration / pencil import-export 모두 단일 SSOT 경로
- ADR-903 G5 (b)~(f) 잔여 영역 종결

### Negative

- 1472 ref / 184 파일 일괄 변경 — 일회성 작업량 큼
- DB schema 전환 — 기존 사용자 데이터 자동 migration 첫 실행 시 dev 검증 필수
- Phase 1~5 land 동안 일시적 mixed state (일부 rename / 일부 hybrid)

## References

- [ADR-903](903-ref-descendants-slot-composition-format-migration-plan.md) — canonical document migration (Implemented 2026-04-26, 본 ADR 의 G5 (b)~(f) 잔여 흡수)
- [ADR-903 Phase 5 design](../design/903-phase5-persistence-imports-breakdown.md) — P5-C 영역 본 ADR 의 구현 상세 그대로 활용
- [ADR-903 P3-E E-6](#) — IndexedDB schema 자동 migration 패턴 (본 ADR Phase 4 G5-E 에서 재사용)
- [ADR-111](111-layout-frameset-pencil-redesign.md) — Layout/frameset pencil 호환 재설계 (본 ADR 가 hybrid `layout_id` 영역 cleanup 의 일부 흡수)
- [ADR-116](116-canonical-document-ssot-transition.md) — canonical document SSOT 전환. 본 ADR 의 Phase 4 write-through 와 Phase 5 hybrid cleanup 의 선행 gate
- [ADR-114](114-imports-resolver-designkit-integration.md) — Superseded. import/export 관련 잔여 scope 는 ADR-116 으로 흡수
- pencil app schema — 본 ADR 의 `type` 필드 호환 기준
