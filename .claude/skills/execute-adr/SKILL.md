---
name: execute-adr
description: Accepted 상태 ADR 의 미반영 phase 를 자율 실행해야 할 때 사용 — "ADR 실행", "execute adr", "Phase 실행해", "ADR-NNN 진행해줘", "다음 Phase 실행" 요청 또는 ADR 번호 + 진행 의지 결합 시 발동. fork checkpoint / HIGH 위험 phase / 전제·관점 의문은 사용자에게 surface.
user-invocable: true
disable-model-invocation: true
---

# Execute-ADR: Multi-Phase Autonomous Implementation

ADR + design breakdown 파일을 읽어 미반영 phase 를 순차 자율 실행. composition 의 모든 절대 정책 (git-workflow / 전제·관점 의문 제기 / fork checkpoint / SSOT 3-domain) 준수.

## SSOT 체인 내 위상

본 skill 은 **워크플로 orchestration** layer. Spec / DOM / API 의 어느 domain 에도 직접 mutation 권한을 갖지 않으며, **각 phase 가 정의한 mutation scope 내에서만 phase 별 implementer / debugger / cross-check 를 호출**. ADR fork 발생 시 [adr-writing.md fork checkpoint 4 질문](../../rules/adr-writing.md) 의무 발동.

## 입력 요구사항

| 입력           | 형식                                | 예시                                                               |
| -------------- | ----------------------------------- | ------------------------------------------------------------------ |
| **ADR 번호**   | 정수 (NNN)                          | `912`                                                              |
| **phase 범위** | (optional) `P3-α` / `Phase 2` 등    | `P3-α` (생략 시 다음 미반영 phase 자동 선택)                       |
| **mode**       | `auto` / `confirm-each-phase` 중 1  | default: 리뷰 승인 기록 있으면 `auto`, 없으면 `confirm-each-phase` |
| **max phases** | (optional) 한 세션 내 최대 phase 수 | default 3 (HIGH 비용 작업 누적 차단)                               |

**mode default 판정 (2026-07-11 종결 계약 — CLAUDE.md §전제·관점 의문 처리, 사용자 승인)**: `docs/adr/reviews/{NNN}.md` 최신 round 가 이슈 0건, 또는 모든 이슈 outcome 이 종결 상태 (`fixed`/`deferred`/`rejected` — `pending` 0건) 이고 CRITICAL/HIGH 는 전부 `fixed` 면 default `auto` — phase 시작/종료 surface 생략. **HIGH+ phase surface 는 auto 에서도 유지** (해당 phase 단위 판정 — §HIGH+ 차단 룰). 리뷰 승인 기록이 없으면 default `confirm-each-phase`. 사용자 명시 지정이 항상 우선.

## Phase 0: 사전 조건 (CRITICAL — 미충족 시 즉시 종료)

Phase 1 진입 전 모두 통과:

- [ ] `docs/adr/{NNN}-*.md` 또는 `docs/adr/completed/{NNN}-*.md` 존재 + Status 가 `Accepted` 또는 `In Progress` (Implemented / Superseded → 진입 거부. `completed/` 매치 = 이미 Implemented → 진입 거부 — completed/ 탐색은 이 거부 사유를 확정하기 위한 것). **`Proposed` + 아래 전제 확정 조건 충족 시 → 되묻지 않고 `Accepted` 승격을 착수 절차에 포함** (Status 변경 + README.md 테이블 동시 갱신 후 진행 — adr-writing.md §Status 전이 "합의 완료" 가 리뷰 승인 기록으로 성립. 리뷰 승인 기록 없는 `Proposed` 만 진입 거부. Why: 리뷰 승인 ↔ Status 승격을 잇는 자동 절차 부재가 착수 시점 재질문의 1차 원인 — 2026-07-11 진단, ADR-148/149 실측)
- [ ] design breakdown (`docs/adr/design/{NNN}-*-breakdown.md`) 존재 — 없으면 즉시 종료 + "design breakdown 없는 ADR 자율 실행 금지 (adr-writing.md 위반)" 보고
- [ ] git working tree clean — 단 **auto-dirty 파일 allowlist 는 dirty 판정에서 제외**: `.claude/stats/*` (SessionStart hook 자동 갱신) 는 잔여 커밋으로 선행 정리 후 통과 (사용자에게 되묻지 않음). 그 외 파일의 uncommitted 변경 있으면 사용자에게 commit / stash 요청 (Why: stats hook 이 매 세션 tree 를 dirty 로 만들어 세션 첫 착수마다 불필요 재질문 발생 — 2026-07-11 진단)
- [ ] `git status` 의 branch 가 `main` — 다른 branch 면 "main 에서 직접 진행 (git-workflow.md 절대 정책)" 알림 + 사용자 confirm
- [ ] `pnpm type-check` baseline PASS — 시작 시점 회귀 0 보장
- [ ] dist 신선도 (cross-check skill §5.0) — `.spec-rebuild-pending` flag 없음 + dist 존재
- [ ] **전제 확정 확인 (종결 계약 — CLAUDE.md §전제·관점 의문 처리)**: `docs/adr/reviews/{NNN}.md` 최신 round 가 이슈 0건, 또는 모든 이슈 outcome 이 종결 상태 (`pending` 0건) 이고 CRITICAL/HIGH 전부 `fixed` 면 전제 확정 — 재점검·재질문 없이 통과 (scope 무변경 전제. `deferred`/`rejected` 는 종결 상태로 인정 — "전부 fixed" 단독 기준 금지). 리뷰 기록이 없을 때만 design breakdown 의 fork checkpoint 4 질문 lock-in 확인 (adr-writing.md)

미충족 시 budget 0 사용 후 종료 — phase 1 진입 금지.

## Phase 1: phase 식별 + 사용자 surface

```
1. ADR 본문의 Status / Phase 진행 로그 / Gate 표 파싱
2. design breakdown 의 §Phase 분해 섹션에서 미반영 phase 식별
   - "Implemented" / "반영 완료" / "✅" 마킹된 phase 제외 (legacy 문서의 "Land 완료" 마킹도 동일 취급)
   - 다음 미반영 phase 의 prerequisite phase 가 모두 반영됐는지 확인
3. 식별된 phase 의 risk-level / mutation scope / 예상 시간 표시
4. mode=confirm-each-phase 면 사용자에게 surface:
   "Phase {X} 진행 권장. risk={LEVEL}, est={duration}, scope={files}. 진행?"
   - 사용자가 "진행" / "yes" / "ok" 답하면 Phase 2 진입
   - HIGH+ phase 는 mode=auto 라도 무조건 surface (사용자 승인 필수)
   - 사용자가 "잠깐" / "확인할게" / "아니" 답하면 종료 + 결과 요약
```

### HIGH+ phase 자동 진행 차단 룰 (phase 단위 판정 — 2026-07-11 정정)

**해당 phase 에 귀속된 위험만 판정한다**. 다음 중 하나면 무조건 사용자 surface:

- design breakdown 의 **해당 phase** risk-level 표기가 HIGH / CRITICAL
- ADR Risks 표에서 **해당 phase 에 매핑된** R{ID} 심각도가 HIGH / CRITICAL
- **해당 phase 의 작업 내용**에 DB schema 변경 / migration / breaking change 포함

**문서 전체 키워드 grep 금지**: Risk-First 템플릿 특성상 "HIGH" 문자열은 4축 평가·Risk Threshold Check 로 거의 모든 ADR 문서에 존재한다. 문서 단위 검출은 리뷰 승인 auto 모드를 사실상 무효화하며, 착수 시점 불필요 재질문의 구조 원인이었다 (2026-07-11 진단).

## Phase 2: 구현 사이클 (단일 phase)

phase 안에서 다음 사이클 실행:

```
1. PLAN — design breakdown 의 phase 본문에서 작업 항목 추출 (3-7 단계)
2. RED  — TDD 적용 가능하면 vitest 실패 테스트 먼저 작성 (`tester` agent TDD)
3. GREEN — 구현
   - 단일 영역 / LOW risk → 직접 Edit/Write
   - 다중 파일 / MEDIUM+ risk → implementer agent dispatch (worktree 격리 권장)
4. agent dispatch 시 5-안전망 prompt 의무:
   - "commit + push exit code 명시 보고"
   - "type-check + vitest evidence 첨부"
   - "scope 외 작업 금지"
   - "PR 생성 절대 금지 — main 직접 push"
   - "사용자 승인 없이 destructive 작업 금지"
5. REFACTOR — 직관 개선
6. INTEGRATE (worktree 격리 시) — main worktree 로 돌아와 git merge + push origin main
   (rules/git-workflow.md §3 절차 — PR 경유 금지)
```

## Phase 3: 검증 게이트 (모두 PASS 필수)

phase 종료 marking 전 모두 통과:

- [ ] `pnpm type-check` 0 error
- [ ] vitest 관련 테스트 PASS (있는 경우)
- [ ] `cross-check` skill 실행 — **렌더링 또는 registration/wiring/schema 영향 phase 면 필수**
  - Phase 5.0 dist 신선도 게이트 통과
  - 5-레이어 정합성 0 CRITICAL/HIGH
  - **Why (ADR-144 사례)**: "렌더링 영향 phase 만 필수" 로 좁히면 Inspector/registration/wiring 변경이 게이트를 빠져나간다. ADR-144 Wave C 가 test/type-check PASS 로 Implemented 승격됐으나 live builder 에서 composite registration 이 동작 안 함 → closure rollback → 34 commit revert. **비-렌더 wiring 변경도 live 검증 대상.**
- [ ] **live behavior 확인 (CRITICAL — test/type-check PASS 단독으로 phase 종료 금지)**: 사용자-가시 동작이 실제 builder 에서 작동하는지 확인. registration / resolved-tree wiring / schema 변경은 unit-test 가 통과해도 live 에서 깨질 수 있음. Chrome MCP (builder 탭 조작) 또는 사용자 confirm 으로 실동작 1회 exercise. **무엇을 실제로 exercise 했는지 commit 검증 블록에 명시.**
- [ ] design breakdown 의 phase Gate 조건 충족 (Gate 표가 있으면)
- [ ] ADR Risks 섹션의 해당 phase 관련 위험 R{ID} 잔존 평가 — 새 위험 발견 시 ADR 본문 update

검증 실패 시:

- type-check 실패 → 즉시 fix 시도 (1회) → 재실패 시 사용자 surface
- cross-check 실패 → `debugger` agent 위임 (root-cause 4단계)
- Gate 조건 미충족 → 사용자 surface (Gate 강제 통과 금지)

## Phase 4: 종결 + commit + push

검증 통과 후:

```bash
# 1) 변경 파일 확인 (개별 add — git add -A 위험)
git status
git diff --stat

# 2) phase 정의 범위의 변경 파일만 개별 add
git add <file1> <file2> ...

# 3) commit message: ADR 번호 + phase 명 + 핵심 변경 1줄 요약
git commit -m "$(cat <<'COMMIT_EOF'
{type}(adr-{NNN}): Phase {X} {brief}

{detailed body — 3-7 lines, why 중심}

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
COMMIT_EOF
)"

# 4) push origin main 직접 (PR 금지 — git-workflow.md 절대 정책)
git push origin main
PUSH_EXIT=$?
if [ $PUSH_EXIT -ne 0 ]; then
  # main push 차단 시 자동 branch 우회 절대 금지
  echo "main push 차단됨 (exit=$PUSH_EXIT). 사용자에게 직접 실행 요청"
  exit 0
fi

# 5) ADR 본문 진행 로그 update — Phase {X} → "Implemented {YYYY-MM-DD}"
#    (별도 commit 또는 같은 commit 에 포함)
```

## Phase 5: 다음 phase 결정

- 모든 phase 반영 → ADR Status `Accepted → Implemented` 승격 + closure 5단계 적용 (memory feedback-adr-closure-5-step.md 참조):
  1. Status 변경
  2. 진행 로그 entry
  3. README.md 카운트 + 진행 중 row 제거
  4. 본문 archive (`docs/adr/completed/`) 이동 + path 정합화
  5. CHANGELOG.md 엔트리 추가 (rules/changelog.md trigger #1)
- 미반영 phase 잔존 + max_phases 미초과 → Phase 1 으로 복귀
- max_phases 도달 → "본 세션 budget 종료. 다음 세션 진입점 = Phase {Y}" 보고 후 종료

## 안전 가드 (CRITICAL — 위반 시 즉시 종료)

- ❌ **PR 생성 절대 금지** — gh pr create / GitHub web UI / PR URL 출력 모두 금지 (git-workflow.md §1)
- ❌ **자동 branch 분리 금지** — main push 차단 시 자동 우회 금지, 사용자 직접 실행 요청
- ❌ **scope 외 작업 금지** — phase 정의 외 파일 수정 시 즉시 stop + revert 검토
- ❌ **HIGH+ phase mode=auto 진행 금지** — 무조건 surface
- ❌ **fork checkpoint 4 질문 미통과 phase 진입 금지** — adr-writing.md base/응용 분류 / schema 직교성 / 선행 ADR 전제 reverse 검증 / codex 3차 미루지 말 것
- ❌ **ADR fork 자동 작성 금지** — phase 중 별도 ADR 필요성 발견 시 사용자 surface, 자동 신규 ADR 작성 안 함
- ❌ **commit message 와 실제 변경 불일치 금지** — agent dispatch 결과 검증 의무 (feedback-agent-completion-failure-pattern, [session-2026-04-28-session50-adr912-wave1-landed] 학습)
- ❌ **destructive 작업 자동 금지** — git reset --hard / git push --force / branch -D / file delete 등 사용자 승인 필수
- ❌ **Spec D1/D2 침범 금지** — phase 가 D3 시각만 허용해도 D1/D2 변경 발생 시 즉시 stop

## 적용 흐름 (예상 시나리오)

| 시나리오                          | 입력                                 | 진행                                                                                           |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| ADR-912 wave #2 Phase A1 반영     | `912` + 다음 phase 자동              | Phase 0 통과 → Phase 1 P3-α surface → 사용자 confirm → 구현 + cross-check → commit + main push |
| ADR-911 P3-θ slot fill resolution | `911 P3-θ` + mode=confirm-each-phase | HIGH risk 인식 → 강제 surface → 사용자 D7/D8/D9 결정 분기 confirm → 구현 → fixture 검증        |
| ADR-913 Phase 4 DB migration      | `913 P4`                             | DB schema 키워드 감지 → 무조건 surface → 사용자 확인 후 step-by-step 진행                      |
| 모든 phase 반영, Status 승격      | `912` (마지막 phase)                 | Phase 5 closure 5단계 적용 — README + archive + reference path + CHANGELOG entry               |

## Evals

### Positive

- "ADR-912 다음 phase 진행" → ✅
- "execute adr 911" → ✅
- "ADR-913 P4 step 4-1 반영해줘" → ✅
- "/execute-adr 100" → ✅

### Negative

- "ADR-911 의 P3-θ 가 뭐야?" → ❌ 단순 질문 (Read 도구 직접)
- "ADR 새로 작성해줘" → ❌ create-adr skill
- "ADR 본문 수정만 해줘" → ❌ Edit 도구 직접
- design breakdown 없는 ADR → ❌ Phase 0 미충족 즉시 종료

## 종결 보고 포맷

```markdown
## execute-adr 결과

- ADR: NNN ({title})
- 실행 phase: P{X1}, P{X2}, ...
- 결과: 모두 반영 ✅ / 부분 반영 (남은: P{Y}) / 종료 (이유)
- commit hash: {hash1}, {hash2}
- 검증: type-check ✅ / vitest ✅ / cross-check ✅
- ADR Status 변동: Accepted → Implemented (있는 경우)
- 다음 세션 진입점: P{Y} 또는 ADR closure 5단계 잔여
```
