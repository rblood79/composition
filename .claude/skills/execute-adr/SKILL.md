---
name: execute-adr
description: ADR 번호를 입력받아 design breakdown 의 미-land phase 를 순차 자율 실행. type-check + cross-check + 회귀 fixture 검증 후 main 직접 push. fork checkpoint / HIGH 위험 phase / framing 의문 시 사용자에게 surface.
TRIGGER when: user mentions "ADR 실행", "execute adr", "Phase 실행해", "ADR-NNN 진행해줘", "ADR 자동 land", "다음 Phase 실행" 또는 ADR 번호 + 진행 의지 결합.
user_invocable: true
---

# Execute-ADR: Multi-Phase Autonomous Implementation

ADR + design breakdown 파일을 읽어 미-land phase 를 순차 자율 실행. composition 의 모든 절대 정책 (git-workflow / framing raise / fork checkpoint / SSOT 3-domain) 준수.

## SSOT 체인 내 위상

본 skill 은 **워크플로 orchestration** layer. Spec / DOM / API 의 어느 domain 에도 직접 mutation 권한을 갖지 않으며, **각 phase 가 정의한 mutation scope 내에서만 phase 별 implementer / debugger / cross-check 를 호출**. ADR fork 발생 시 [adr-writing.md fork checkpoint 4 질문](../../rules/adr-writing.md) 의무 발동.

## 입력 요구사항

| 입력           | 형식                                | 예시                                          |
| -------------- | ----------------------------------- | --------------------------------------------- |
| **ADR 번호**   | 정수 (NNN)                          | `912`                                         |
| **phase 범위** | (optional) `P3-α` / `Phase 2` 등    | `P3-α` (생략 시 다음 미-land phase 자동 선택) |
| **mode**       | `auto` / `confirm-each-phase` 중 1  | default `confirm-each-phase`                  |
| **max phases** | (optional) 한 세션 내 최대 phase 수 | default 3 (HIGH 비용 작업 누적 차단)          |

`auto` 는 사용자가 명시적으로 지정한 경우만. default 는 phase 시작 / 종료마다 사용자 surface.

## Phase 0: 사전 조건 (CRITICAL — 미충족 시 즉시 종료)

Phase 1 진입 전 모두 통과:

- [ ] `docs/adr/{NNN}-*.md` 또는 `docs/adr/completed/{NNN}-*.md` 존재 + Status 가 `Accepted` 또는 `In Progress` (Proposed / Implemented / Superseded → 진입 거부)
- [ ] design breakdown (`docs/adr/design/{NNN}-*-breakdown.md`) 존재 — 없으면 즉시 종료 + "design breakdown 없는 ADR 자율 실행 금지 (adr-writing.md 위반)" 보고
- [ ] git working tree clean — uncommitted 변경 있으면 사용자에게 commit / stash 요청
- [ ] `git status` 의 branch 가 `main` — 다른 branch 면 "main 에서 직접 진행 (git-workflow.md 절대 정책)" 알림 + 사용자 confirm
- [ ] `pnpm type-check` baseline PASS — 시작 시점 회귀 0 보장
- [ ] dist 신선도 (cross-check skill §5.0) — `.spec-rebuild-pending` flag 없음 + dist 존재
- [ ] **framing 의문 자가 점검**: ADR 의 base / 응용 분류, 의존 방향, SSOT 경계 가 design breakdown 본문에서 1-line lock-in 되어 있는가? (adr-writing.md fork checkpoint 4 질문 통과 흔적 확인)

미충족 시 budget 0 사용 후 종료 — phase 1 진입 금지.

## Phase 1: phase 식별 + 사용자 surface

```
1. ADR 본문의 Status / Phase 진행 로그 / Gate 표 파싱
2. design breakdown 의 §Phase 분해 섹션에서 미-land phase 식별
   - "Implemented" / "Land 완료" / "✅" 마킹된 phase 제외
   - 다음 미-land phase 의 prerequisite phase 가 모두 land 됐는지 확인
3. 식별된 phase 의 risk-level / mutation scope / 예상 시간 표시
4. mode=confirm-each-phase 면 사용자에게 surface:
   "Phase {X} 진행 권장. risk={LEVEL}, est={duration}, scope={files}. 진행?"
   - 사용자가 "진행" / "yes" / "ok" 답하면 Phase 2 진입
   - HIGH+ phase 는 mode=auto 라도 무조건 surface (사용자 승인 필수)
   - 사용자가 "잠깐" / "확인할게" / "아니" 답하면 종료 + 결과 요약
```

### HIGH+ phase 자동 진행 차단 룰

design breakdown 또는 ADR Risks 섹션에서 다음 키워드 발견 시 무조건 사용자 surface:

- HIGH / CRITICAL 위험
- DB schema 변경 / migration
- breaking change
- Phase 분리 가능 표현 (adr-writing.md "이 Phase 를 별도 ADR 로 분리 가능한가?")

## Phase 2: 구현 사이클 (단일 phase)

phase 안에서 다음 사이클 실행:

```
1. PLAN — design breakdown 의 phase 본문에서 작업 항목 추출 (3-7 단계)
2. RED  — TDD 적용 가능하면 vitest 실패 테스트 먼저 작성 (test-driven-development skill)
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
- [ ] `cross-check` skill 실행 — 렌더링 영향 phase 면 필수
  - Phase 5.0 dist 신선도 게이트 통과
  - 5-레이어 정합성 0 CRITICAL/HIGH
- [ ] design breakdown 의 phase Gate 조건 충족 (Gate 표가 있으면)
- [ ] ADR Risks 섹션의 해당 phase 관련 위험 R{ID} 잔존 평가 — 새 위험 발견 시 ADR 본문 update

검증 실패 시:

- type-check 실패 → 즉시 fix 시도 (1회) → 재실패 시 사용자 surface
- cross-check 실패 → `debugger` agent 위임 (systematic-debugging 4단계)
- Gate 조건 미충족 → 사용자 surface (Gate 강제 통과 금지)

## Phase 4: 종결 + commit + push

검증 통과 후:

```bash
# 1) 변경 파일 확인 (개별 add 권장 — git add -A 위험)
git status
git diff --stat

# 2) commit message: ADR 번호 + phase 명 + 핵심 변경 1줄 요약
git commit -m "$(cat <<'COMMIT_EOF'
{type}(adr-{NNN}): Phase {X} {brief}

{detailed body — 3-7 lines, why 중심}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT_EOF
)"

# 3) push origin main 직접 (PR 금지 — git-workflow.md 절대 정책)
git push origin main
PUSH_EXIT=$?
if [ $PUSH_EXIT -ne 0 ]; then
  # main push 차단 시 자동 branch 우회 절대 금지
  echo "main push 차단됨 (exit=$PUSH_EXIT). 사용자에게 직접 실행 요청"
  exit 0
fi

# 4) ADR 본문 진행 로그 update — Phase {X} → "Implemented {YYYY-MM-DD}"
#    (별도 commit 또는 같은 commit 에 포함)
```

## Phase 5: 다음 phase 결정

- 모든 phase land → ADR Status `Accepted → Implemented` 승격 + closure 5단계 적용 (memory feedback-adr-closure-5-step.md 참조):
  1. Status 변경
  2. 진행 로그 entry
  3. README.md 카운트 + 진행 중 row 제거
  4. 본문 archive (`docs/adr/completed/`) 이동 + path 정합화
  5. CHANGELOG.md 엔트리 추가 (rules/changelog.md trigger #1)
- 미-land phase 잔존 + max_phases 미초과 → Phase 1 으로 복귀
- max_phases 도달 → "본 세션 budget 종료. 다음 세션 진입점 = Phase {Y}" 보고 후 종료

## 안전 가드 (CRITICAL — 위반 시 즉시 종료)

- ❌ **PR 생성 절대 금지** — gh pr create / GitHub web UI / PR URL 출력 모두 금지 (git-workflow.md §1)
- ❌ **자동 branch 분리 금지** — main push 차단 시 자동 우회 금지, 사용자 직접 실행 요청
- ❌ **scope 외 작업 금지** — phase 정의 외 파일 수정 시 즉시 stop + revert 검토
- ❌ **HIGH+ phase mode=auto 진행 금지** — 무조건 surface
- ❌ **fork checkpoint 4 질문 미통과 phase 진입 금지** — adr-writing.md base/응용 분류 / schema 직교성 / framing reverse 검증 / codex 3차 미루지 말 것
- ❌ **ADR fork 자동 발의 금지** — phase 중 별도 ADR 필요성 발견 시 사용자 surface, 자동 신규 ADR 작성 안 함
- ❌ **commit message 와 실제 변경 불일치 금지** — agent dispatch 결과 검증 의무 (feedback-agent-completion-failure-pattern, [session-2026-04-28-session50-adr912-wave1-landed] 학습)
- ❌ **destructive 작업 자동 금지** — git reset --hard / git push --force / branch -D / file delete 등 사용자 승인 필수
- ❌ **Spec D1/D2 침범 금지** — phase 가 D3 시각만 허용해도 D1/D2 변경 발생 시 즉시 stop

## 적용 흐름 (예상 시나리오)

| 시나리오                          | 입력                                 | 진행                                                                                           |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| ADR-912 wave #2 Phase A1 land     | `912` + 다음 phase 자동              | Phase 0 통과 → Phase 1 P3-α surface → 사용자 confirm → 구현 + cross-check → commit + main push |
| ADR-911 P3-θ slot fill resolution | `911 P3-θ` + mode=confirm-each-phase | HIGH risk 인식 → 강제 surface → 사용자 D7/D8/D9 결정 분기 confirm → 구현 → fixture 검증        |
| ADR-913 Phase 4 DB migration      | `913 P4`                             | DB schema 키워드 감지 → 무조건 surface → 사용자 확인 후 step-by-step 진행                      |
| 모든 phase land, Status 승격      | `912` (마지막 phase)                 | Phase 5 closure 5단계 적용 — README + archive + reference path + CHANGELOG entry               |

## Evals

### Positive

- "ADR-912 다음 phase 진행" → ✅
- "execute adr 911" → ✅
- "ADR-913 P4 step 4-1 land 해줘" → ✅
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
- 결과: 모두 land ✅ / 부분 land (남은: P{Y}) / 종료 (이유)
- commit hash: {hash1}, {hash2}
- 검증: type-check ✅ / vitest ✅ / cross-check ✅
- ADR Status 변동: Accepted → Implemented (있는 경우)
- 다음 세션 진입점: P{Y} 또는 ADR closure 5단계 잔여
```
