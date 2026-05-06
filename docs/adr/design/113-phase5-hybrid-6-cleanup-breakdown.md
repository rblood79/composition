# ADR-113 Phase 5 Implementation Breakdown — Hybrid 6 Fields Cleanup

> 본 문서는 [ADR-113](../completed/113-tag-type-rename-hybrid-cleanup.md) **Phase 5 (HIGH risk, ~2d 예상)** 의 sub-phase 분해 + 영향 영역 + 검증 명령. ADR-903 P3-E + ADR-111/113 Phase 1~4 패턴을 답습하되, 2026-04-30 이후 실행 순서는 [ADR-116](../completed/116-canonical-document-ssot-transition.md) 선행으로 재정렬한다.
>
> **2026-05-05 rollback / 2026-05-06 follow-up**: 2026-05-03 post-cutover fix 군은 폐기됐다. 2026-05-06 current main follow-up 패치는 `layout_id` / `slot_name` / component marker type schema 를 복구하지 않고, frame/component compatibility 를 canonical adapter mirror/export boundary 와 active `CompositionDocument` write-through 기준으로 다시 닫았다. 따라서 Phase 5 type schema cleanup 과 raw fixture key 0건 기준은 유지된다.

## 1. 목표 + Gate G5

ADR-113 line 121 R2 `Element.tag` rename 후 **hybrid 잔존 5 필드** (layout_id 제외 — ADR-111/ADR-116 흡수 영역) 의 cleanup. 단일 SSOT 단일화 도달 후 ADR-113 Status `In Progress → Implemented` 승격. 이 cleanup 은 ADR-116 G5 Legacy Field Quarantine 의 하위 작업으로만 진행한다.

### Gate G5 (Phase 5 종결 조건)

| 조건 | 정의                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- |
| (a)  | hybrid 5 필드 (`componentRole`, `masterId`, `slot_name`, `overrides`, `descendants`) 의 legacy 사용 → canonical 표기 변환 0 miss |
| (b)  | `Element` 타입에서 hybrid 필드 제거 또는 `@deprecated` 마킹 + canonical 진입점만 사용                                            |
| (c)  | runtime/persistence 경로에서 hybrid 필드 read/write 0건                                                                          |
| (d)  | roundtrip Skia/CSS 시각 회귀 0                                                                                                   |
| (e)  | type-check 3/3 + 영향 영역 vitest PASS                                                                                           |

실패 시 fallback: 해당 sub-phase 만 revert, 다른 sub-phase 는 유지 (필드별 독립 진행).

## 2. Inventory (2026-04-27 세션 45 기준)

ADR-113 Phase 1+2 mechanical rename 후 measurement:

| 필드                         | ref 수  |        영향 file 수        | baseline (2026-04-22) |        감소율         |
| ---------------------------- | :-----: | :------------------------: | :-------------------: | :-------------------: |
| `componentRole`              |   43    |             12             |          41           |  +5% (재카운트 차이)  |
| `masterId`                   |   61    |             13             |          55           | +11% (재카운트 차이)  |
| `slot_name`                  |   38    |             12             |          25           | +52% (재카운트 차이)  |
| `overrides`                  |   37    |             13             |          23           | +61% (재카운트 차이)  |
| `descendants`                |   100   |             23             |          39           | +156% (재카운트 차이) |
| **합계 (Phase 5 scope)**     | **279** | **73** (중복 제외 더 적음) |        **183**        |           —           |
| ~~layout_id~~ (ADR-111 흡수) |   207   |             49             |          258          |        -19.8%         |

**baseline 대비 변동 사유**: Phase 1+2 가 `Element.tag → type` rename 에 집중, hybrid 5 필드는 **그대로 유지** (별도 Phase scope). 재카운트 시 grep pattern 차이 (`\bX\b` vs `X.*:` 등) 로 +값 발생. 실제 감소는 Phase 5 land 후 측정 권장.

### 필드별 type 정의 위치

| 필드            | 주 정의 위치                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `componentRole` | `packages/shared/src/types/element.types.ts` + `composition-document.types.ts` + `apps/builder/src/types/builder/unified.types.ts` |
| `masterId`      | `packages/shared/src/types/element.types.ts` + `composition-document.types.ts` + `component.types.ts`                              |
| `slot_name`     | `packages/shared/src/types/element.types.ts` + `renderer.types.ts` + `composition-document.types.ts`                               |
| `overrides`     | `packages/shared/src/types/canonical-resolver.types.ts` + `element.types.ts` + `component.types.ts`                                |
| `descendants`   | `packages/shared/src/types/canonical-resolver.types.ts` + `element.types.ts` + `composition-vocabulary.ts`                         |

## 3. Sub-phase 분해 (필드별 5 sub-step)

각 sub-phase 는 **독립 commit/PR** 가능 단위. 진입 순서는 ref 수가 적은 순 (LOW risk first):

### Phase 5-A — `slot_name` cleanup (~2-3h, MED — 38 ref / 12 file)

**목표**: legacy `element.slot_name` → canonical `frame.slot[]` 진입점 단일화.

**산출물**:

- ADR-111 `convertTemplateToCanonicalFrame` 가 이미 slot_name → canonical slot 변환 처리 (Phase 1 함수 layer)
- legacy `element.slot_name` read site → `frame.slot` array 또는 `metadata.slot_name` (legacy 경로 보존 시)
- `Element.slot_name` type 필드 → `@deprecated` 마킹 + canonical 진입점 우선
- write site 0건 보장 (factory / state action 검사)

**진입 순서 1번 — 가장 적은 ref + ADR-111 인프라 활용 가능**.

### Phase 5-B — `overrides` cleanup (~3-4h, MED — 37 ref / 13 file)

**목표**: legacy `element.overrides` → canonical `descendants[path].props` 단일화.

**산출물**:

- canonical resolver 가 이미 `descendants[path]` 우선 read (ADR-903 P3-E)
- legacy `element.overrides` read site → canonical 경로 변환
- `Element.overrides` type 필드 → `@deprecated` 마킹
- migration script: 기존 IndexedDB legacy overrides → canonical descendants 변환 (Step 4-4 write-through 와 별도, Phase 5-B 진입 시점에 결정)

**진입 순서 2번**.

### Phase 5-C — `componentRole` cleanup (~3-4h, MED — 43 ref / 12 file)

**목표**: legacy `element.componentRole: "master" | "instance"` → canonical `node.type === "ref"` + `reusable: true` 분리 표기 단일화.

**산출물**:

- ADR-111 `componentRoleAdapter.ts` 가 이미 변환 처리 (Phase 1 함수 layer)
- legacy `element.componentRole === "master"` 검사 → `node.reusable === true`
- legacy `element.componentRole === "instance"` 검사 → `node.type === "ref"`
- `Element.componentRole` type 필드 → `@deprecated` 마킹

**진입 순서 3번**.

### Phase 5-D — `masterId` cleanup (~4-5h, MED-HIGH — 61 ref / 13 file)

**목표**: legacy `element.masterId` → canonical `RefNode.ref: string` 단일화.

**산출물**:

- ADR-111 `componentRoleAdapter.ts` 가 이미 `masterId → ref` 변환 처리
- legacy `element.masterId === <id>` 검사 → `node.ref === <id>` (RefNode 한정)
- migration: legacy IndexedDB masterId → canonical ref (read-through compat 유지)
- `Element.masterId` type 필드 → `@deprecated` 마킹

**진입 순서 4번 — ref 수 60+ 로 sweep 범위 큼**.

### Phase 5-E — `descendants` cleanup (~5-6h, HIGH — 100 ref / 23 file)

**목표**: legacy `element.descendants` (record 기반) ↔ canonical `RefNode.descendants?: Record<string, { children?: CanonicalNode[] }>` 정합성 단일화.

**산출물**:

- canonical 의 `descendants` 는 이미 표준 (ADR-903 §3.10)
- legacy 와 canonical 이 같은 이름 사용 → 변환보다는 type 정합성 점검 우선
- `Element.descendants` 와 `RefNode.descendants` 의 schema 차이 0 검증
- 23 file sweep: legacy schema 의존 코드 → canonical 진입점

**진입 순서 5번 — ref 수 100+ + 23 file 로 가장 큰 영향. sub-Phase 내부 분할 (`5-E-1` per file group) 권장**.

## 4. 진입 순서 권장

```
Phase 5-A (slot_name, 38 ref)        — 1번 (LOW, ADR-111 인프라 활용)
  ↓
Phase 5-B (overrides, 37 ref)        — 2번 (MED, descendants 와 함께 검토 가능)
  ↓
Phase 5-C (componentRole, 43 ref)    — 3번 (MED, ADR-111 adapter 활용)
  ↓
Phase 5-D (masterId, 61 ref)         — 4번 (MED-HIGH, ref 수 60+)
  ↓
Phase 5-E (descendants, 100 ref)     — 5번 (HIGH, ref 수 100+ — 내부 분할 권장)
  ↓
Phase 5 종결 + ADR-113 Status Implemented 승격
```

## 5. 진입 prerequisite

- ADR-116 Phase 0/1 통과 — canonical core/props/extension/legacy 분류 고정 + canonical store/API + canonical→legacy export adapter API 존재
- ADR-116 G5 field quarantine baseline 갱신 — `layout_id`, `slot_name`, `componentRole`, `masterId`, legacy `overrides/descendants` 의 adapter-only 기준 확정
- ADR-113 Phase 4 전체 (Step 4-4 + 4-5 + 4-6) 재평가 후 완결 — write-through 방향이 canonical primary/shadow write 정책과 충돌하지 않아야 함
- `Element.tag` 필드 영구 제거 (Step 4-5)

## 6. 진입 비권장 시점

- ADR-116 Phase 0/1 이전 — canonical props/store/export adapter boundary 가 없으면 legacy field cleanup 이 최종 SSOT 와 어긋날 수 있음
- ADR-111 Phase 3 (cascade 재작성) 진행 중 — 두 hybrid 영역 동시 변경 시 회귀 추적 어려움
- prod 빌드 임박 시점 — 5 sub-phase 누적 land 후 1주+ monitoring 권장
- ADR-112 base 와 충돌하는 UI 재설계 동시 진행 금지 — UI 6요소와 Slot section base 는 완료됐으며 본 Phase 는 field quarantine 에만 집중

## 7. 검증 명령 (sub-phase 별)

```bash
# 각 sub-phase 후 영향 영역 vitest
pnpm vitest run apps/builder/src/adapters/canonical
pnpm vitest run apps/builder/src/lib/db
pnpm vitest run packages/specs

# type-check 3/3
pnpm type-check

# Phase 5-X 종결 시 광역 sweep
pnpm vitest run

# field-by-field grep 갱신 (sub-phase 종결 시)
grep -rn "<field>" packages/specs/src apps/builder/src --include="*.ts" --include="*.tsx" | grep -v "__tests__" | wc -l
```

## 8. 회귀 위험 측정

ADR-113 line 121 R2 (mechanical rename + hybrid cleanup):

| 위험                         | 측정                                          | 수용 임계                 |
| ---------------------------- | --------------------------------------------- | ------------------------- |
| canonical 진입점 누락        | grep `\.<field>\b` 0건                        | 0건 (sub-phase 종결 조건) |
| migration 실패 (Phase 5-B/D) | localStorage backup restore round-trip        | 100% PASS                 |
| 시각 회귀                    | Chrome MCP cross-check 또는 cross-check skill | 0건                       |
| type 정합성                  | type-check 3/3 + spec snapshot bit-identical  | PASS                      |

## 9. ADR 본문 진행 로그 entry 형식 (sub-phase 종결 시)

```markdown
- **2026-XX-XX (세션 N)**: **Phase 5-A `slot_name` cleanup land** (commit `<hash>`)
  - sweep: <baseline ref> → <after ref> (감소 %)
  - 변환 site: <N>건 (canonical 진입점 우선)
  - type 필드 `@deprecated` 마킹 + write site 0건 확증
  - 검증: type-check 3/3 + vitest <PASS rate>
```

## 10. 종결 후 후속

- ADR-113 Status `In Progress → Implemented` 승격 (Phase 5-E 종결 후)
- closure 5단계: Status + 본문 + README + completed/ archive + reference link 정합화
- format 변경 ADR 라인업: ADR-903 ✅ + ADR-110 ✅ + ADR-112 ✅ + ADR-116 선행 → ADR-111 잔여 G3/G4/G5 + ADR-113 Phase 4/5. ADR-114 는 Superseded archive 로 이동했고 P5-D/E imports scope 는 ADR-116 으로 흡수

## 관련 문서

- ADR-113: `docs/adr/completed/113-tag-type-rename-hybrid-cleanup.md`
- ADR-113 Phase 4 breakdown: `docs/adr/design/113-phase4-db-schema-migration-breakdown.md`
- ADR-113 inventory (2026-04-27 세션 36): `docs/adr/design/113-tag-type-rename-inventory.md`
- ADR-903 §3.10: `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md`
- ADR-111 (layout_id 흡수): `docs/adr/completed/111-layout-frameset-pencil-redesign.md`
- ADR-116 (canonical document SSOT 선행 gate): `docs/adr/completed/116-canonical-document-ssot-transition.md`
- ADR-114 (Superseded): `docs/adr/completed/114-imports-resolver-designkit-integration.md`
