# 새 세션 진입 prompt — ADR-916 Phase 5 G6-1 후속 진입

> 이 파일은 다음 conversation 의 첫 prompt 로 사용. paste 후 진행.

---

ADR-916 Phase 5 G6-1 closure 시그널 도달 후 후속 sub-phase 진입. 직전 세션 (2026-05-01 세션 57) 에서 read site cleanup 47 → 0 (100%) 도달 + Element.actions 영역 0 도달 + 3 agent 병렬 분석으로 cleanup 영역 진정 정의 codify 완료. 본 세션 = 다음 sub-phase 진입.

## 진척 baseline (verified 2026-05-01 세션 57 종결)

- main HEAD = `353e8fc05`
- working tree clean
- type-check 3/3 PASS (cache hit 가능)
- vitest canonical 광역 148/148 PASS
- ADR-916 Status: In Progress (Phase 0 G1 ✅ + Phase 1 G2 ✅ + Phase 2 G3 ✅ + Phase 3 G4 grep gate ✅ + Phase 4 G5 §9.3 strict marker ✅ + Phase 5 G6-1 closure 시그널 ✅)

## 다음 진입 옵션 (3 종)

### 옵션 A: G6-1 second work — Props canonical primary 렌더 회귀 (~1d MED)

design §10.2 G6-1 sub-phase 의 second work. Button/TextField/Section spec consumer 가 `metadata.legacyProps` 없이도 Skia + DOM 정합 렌더 검증.

- **scope**: spec consumer 영역 + fixture 추가 + visual evidence (사용자 환경 의존)
- **risk**: visual evidence multi-session 가능성, canonical primary 모드 (flag enable) dev 검증 필요
- **prerequisite**: G6-1 read site cleanup 47 → 0 ✅ (충족)

### 옵션 B: G6-2 (History + Preview/Publish) 진입 (~2-3d LOW-MED)

design §10.2.2 sub-phase 그룹 G6-2. canonical store mutation history granularity (undo/redo) + Preview/Publish 의 canonical resolved tree 렌더 정합.

- **scope**: history actions + Preview/Publish 회귀 fixture
- **risk**: history 영역 ADR-913 P5 결합 가능성 (정독 필요)
- **prerequisite**: G6-1 closure 시그널 ✅ (충족, but 옵션 A 완결 권장)

### 옵션 C: write boundary cleanup — `updateNodeExtension` API caller migration (~MED 1-2d)

Phase 5 G7 closure 진정 work. `updateNodeExtension` API (Phase 5 G7 preflight land 완료) 의 실 caller 0건 → events/dataBinding write site (createElement AI tool / inspectorActions:285-286 / undo-redo 복원) 를 `updateNodeExtension` 경유로 변환 → x-composition 영역 진정 저장.

- **scope**: write site → updateNodeExtension caller migration roadmap + 첫 caller migration
- **risk**: write boundary 변경 = canonical primary 저장 동작 변경 = 사용자 dev evidence 필요
- **prerequisite**: G7 schema design 정독 + caller migration roadmap 정의

## 회피 영역 (사용자 신호 정합 — 절대)

- **ADR-911 P3 frame canvas authoring** (instanceActions / ComponentSlotFillSection / editingSemantics 의 legacy `componentRole === "instance"` 분기, `el.masterId` direct access body, `Element.descendants` 영역) — 사용자 명시 "ADR-916 부터 진행, 911/913 진행하지마"
- **ADR-913 P5 영역** (instance 시스템 schema, `MasterChangeEvent.masterId` / `DetachResult.previousState.{masterId,overrides,descendants}`) — 별 ADR phase
- **canonical core 영역** (canonicalDocumentStore.ts / resolvers/canonical/index.ts / RefNode.descendants schema) — cleanup target 아님

## 사전 framing checkpoint (CRITICAL — `.claude/rules/adr-writing.md` §"ADR Fork checkpoint")

진입 전 fork 4 질문 통과:

1. **base/응용 분류**: 본 sub-phase 가 ADR-916 G6/G7 의 어느 응용 work 인지
2. **schema 직교성**: 다른 sub-phase 와 직교 영역인지 검증
3. **baseline framing reverse 검증**: ADR-903 read-through ↔ ADR-916 primary SSOT reverse 그대로 valid 한지
4. **codex 1차 진입 prerequisite**: sub-phase scope 정의 후 codex review 가능 시점

## 진행 권장 순서

본 세션 단일 PR scope 권장:

- **옵션 A 우선** (G6-1 second work) — G6-1 cleanup 영역 완전 closure 후 G6-2 진입 자연스러움
- 옵션 A risk (visual evidence) 가 본 세션 budget 외라면 옵션 C (write boundary) 진입 가능
- 옵션 B 진입 전 G6-1 second work 완결 권장 (design §10.2.2 정합)

## 사용자 정책 정합

- **auto mode 활성화 (예상)**: 즉시 실행, 사용자 surface 최소화, 본질 work 자율 진행
- **쪼개기 금지**: 단일 PR 통합 land, sub-step 분해 surface 회피
- **main 직접 push (web PR 자체 금지)**: `git add -A` → `git commit` → `git push origin main`. `gh pr create` 절대 금지.
- **agent 병렬 dispatch 패턴**: 본 세션 57 에서 효율 입증 (3 agent worktree 격리, research + cleanup + report). file 영역 독립 시 활용 가능.

## 첫 작업 권장

진입 시점에 다음 검증 + 의사결정:

1. `git log --oneline -5` 로 main HEAD = `353e8fc05` 확증
2. ADR-916 본문 line 5 Status + 진행 로그 마지막 entry (line 422 부근, 세션 57) 정독
3. design §10.2 sub-phase 분해 (line 800 부근) + §10.2.7 본 세션 결과 (line 약 970 부근) 정독
4. fork 4 질문 통과 + 옵션 A/B/C 중 선택
5. **단일 PR 통합 land** + main 직접 push

## 예상 진척 시점 (다음 세션 land 후)

- **옵션 A 완결 시**: G6-1 closure (read + Props 렌더 회귀 모두 PASS), G6-2 진입 가능
- **옵션 C 완결 시**: write boundary 첫 caller migration land, x-composition 영역 진정 저장 marker
- ADR-916 Status `In Progress → Implemented` 승격은 §12 완료 판정 6 조건 모두 충족 시 (현재 미충족 — Props 렌더 회귀 + History + Preview/Publish + Imports + Events/DataBinding parity 잔존)

---

**참조 file**:

- 메모리 entry: `~/.claude/projects/-Users-admin-work-composition/memory/session-2026-05-01-session57-adr916-phase5-g6-1-closure.md`
- ADR 본문: `docs/adr/916-canonical-document-ssot-transition.md`
- design breakdown: `docs/adr/design/916-canonical-document-ssot-transition-breakdown.md`
- helper apps/builder: `apps/builder/src/adapters/canonical/legacyExtensionFields.ts`
- helper packages/shared: `packages/shared/src/utils/legacyExtensionFields.ts`
- grep gate test: `apps/builder/src/adapters/canonical/__tests__/g5LegacyFieldGrepGate.test.ts`
