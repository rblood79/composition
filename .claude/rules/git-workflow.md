# Git 작업 흐름 — web PR 자체 금지 정책

> **2026-04-27 강화 (절대 정책)**. 로컬 작업 환경에서 web PR 자체 금지. 예외 없음. 사용자 자동화 흐름 차단 방지가 본질.

## 1. 정책 (CRITICAL)

**default 흐름**:

```bash
git add -A
git commit -m "..."
git push origin main
```

**금지 행위**:

- ❌ `gh pr create` / GitHub web UI PR 생성 — 절대 금지
- ❌ `git checkout -b feature/...` 분기 후 push — 사용자 명시 요청 시에만
- ❌ `git push -u origin <branch>` — 사용자 명시 요청 시에만
- ❌ PR URL 출력 (`https://github.com/.../pull/new/...`) — 금지
- ❌ PR body 템플릿 제공 — 금지
- ❌ "안전 차원에서 PR" / "CRITICAL 이니 PR" / "worktree 라 PR 자연" — 모두 **틀림**

## 2. 왜 — 자동화 흐름 차단이 본질 손실

사용자 지적 (2026-04-27):

- "어느순간 부터 계속 작은 것하나도 웹으로 PR머지 시키는 이유가뭐지?"
- "PR web 머지 때문에 작업 흐름 부터 자동화 작업이 계속 끊긴다"
- "아예 web PR 자체를 금지 시켜라 로컬에서 작업 환경에서는"
- "worktree 인경우도 브런치 분기해서 커밋 하면 되는 문제지않나"

PR 패턴이 일으키는 실제 손실:

1. **claude 후속 자동 작업이 사용자 manual merge 대기로 정지** — push → "PR URL" → 사용자 브라우저 진입 → 머지 클릭 → main pull. **사용자 개입 3-4회**. main 직접 push 면 zero
2. **연쇄 commit 흐름 단절** — fix #1 → fix #2 → closure 가 매 단계 머지 대기로 끊김. 같은 conversation 연속 작업도 모두 차단
3. **hook 자동화 가치 무력화** — Stop hook (type-check) / PostToolUse (auto-format) 가 절약하는 시간보다 PR 머지 대기 시간이 압도적
4. **세션 컨텍스트 비용 누적** — PR 머지 대기 동안 다음 step 진행 불가 → 재진입 시 재로드
5. **gh CLI 부재** → 자동 PR 생성 불가 → URL 만 출력 → 사용자가 브라우저 띄워 manual 처리

PR 패턴은 "안전" 이 아니라 **사용자 워크플로우 강제 차단**.

## 3. worktree 작업 통합 (PR 불필요)

worktree 의 격리 가치 = **작업 중 main 오염 방지**. PR 강제와 무관. main 통합은 일반 merge:

```bash
# 1) worktree 에서 commit (격리된 branch 에 누적)
cd <worktree-path>
git add -A && git commit -m "..."

# 2) main worktree 로 돌아와서 직접 merge + push
cd /Users/admin/work/composition
git merge <worktree-branch>     # fast-forward 또는 --no-ff
git push origin main

# 3) worktree 정리
git worktree remove <worktree-path>
git branch -d <worktree-branch>  # 명시 승인 받은 후
```

## 4. main push 차단 시 대응

`git push origin main` 이 권한 차단되면 **자동 우회 (branch 분리 + push) 절대 금지**:

```
✗ "main 차단됨. 별도 branch 분리 + push 진행" — 자동 우회 절대 금지
✓ "main push 권한 차단됨. 사용자가 ! git push origin main 직접 실행 또는 권한 부여 후 재시도 알려주세요"
```

## 5. settings 우선 — 메모리 entry stale 가능

PR/push 정책 의문 발생 시 **settings 4 파일 + protect-files hook 직접 확인**:

- `/Users/admin/work/composition/.claude/settings.json`
- `/Users/admin/work/composition/.claude/settings.local.json`
- `~/.claude/settings.json`
- `~/.claude/settings.local.json`
- `.claude/hooks/protect-files.sh`

메모리 entry (특히 세션 인수인계 의 "main 차단" 류) 가 stale 일 수 있음. settings 가 우선.

## 6. 사용자 명시 요청 시에만 분기

다음 표현 발견 시에만 branch + push 진행:

- "PR 생성해줘" / "원격에 push 해" / "branch push 해라" / "feature branch 로 분리" 등 명시

그 외 모든 경우 main 직접.

## 7. Red flags (관성 패턴 감지)

- "main 차단되어 있을 테니 PR 진행" — 가정 금지, settings 확인 후
- "안전 차원에서 PR" — 안전이 아니라 **사용자 워크플로우 파괴**
- "작아 보이지만 archive/closure 작업이니 PR" — 작업 분류는 PR 사유 아님
- "CRITICAL 이라 PR" — **CRITICAL 도 main 직접**
- "worktree 라 PR 자연" — **틀림**. worktree = branch 분기 + commit. main merge + push 면 끝

## 8. 위반 이력 (재발 8회+ 누적)

- 2026-04-14~15 ADR-059 closure docs-only PR 반복
- 2026-04-16 ADR-059 B5 PR 반복 → "PR 생성 하지마!!"
- 2026-04-26 세션 31 — Phase C 자동 push + docs branch + PR URL → "강제 PR 생성 그만해라"
- 2026-04-27 세션 37~43 — settings 변경 인지 못 한 채 7+ PR 머지 (#250/#262/#268/#269/#270/#271/#272/#273) → "어느순간 부터 작은 것하나도 웹으로 PR머지 시키는 이유가뭐지?"
- 2026-04-27 정책 강화 → "아예 web PR 자체를 금지 시켜라" (예외 제거, 절대 금지로 전환)

## 관련

- 메모리: `~/.claude/projects/-Users-admin-work-composition/memory/feedback-pr-vs-direct-push.md`
- 메모리: `~/.claude/projects/-Users-admin-work-composition/memory/feedback-settings-precedence-over-stale-memory.md`
- CLAUDE.md §"Git Push 정책 (CRITICAL)"
- AGENTS.md §"Commit & Push Guidelines"
