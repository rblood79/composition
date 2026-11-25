---
name: commit-push
description: 사용자가 「커밋하고 push」 · 「커밋해」 를 요청할 때 사용. 병렬 세션이 같은 checkout 을 쓰는 상태에서 이 세션의 변경만 가려 확인 · 커밋 · main push 하고, 남은 미커밋 파일을 출처별로 보고한다. 요청이 없으면 커밋하지 않는다.
argument-hint: [all — 남의 변경까지 묶어 커밋할지 물음 · 생략 시 이 세션 변경만]
---

# 커밋 · push (병렬 세션 안전)

정본 규칙은 `.claude/rules/git-workflow.md` §1 이다. 이 skill 은 그 규칙을 순서로 고정한 것이다. 흐름은 main 직접 push — 분기 · PR 금지 (§1 금지 행위).

## 1. 내 변경 가려내기

```bash
git status --short
cat .agent/session-edits/${CLAUDE_SESSION_ID}.txt 2>/dev/null   # track-session-edits.sh 가 기록한 이 세션의 Edit/Write 경로
```

- **내 파일** = 위 기록 + 이 세션이 Bash (생성기 · 스크립트 · `git mv`) 로 바꾼 파일. 기록이 비어 있으면 대화에서 고친 파일 목록으로 판단한다 (기록은 Claude hook 이 만든다 — Codex 세션에는 없다).
- **남의 파일** = 나머지. 스테이징하지 않는다. 이미 다른 세션이 스테이징한 경로가 있으면 `git commit -- <paths>` (pathspec 커밋) 로 그것을 건드리지 않는다.
- 남의 세션도 고치는 파일에 내 hunk 만 커밋해야 하면 메모리 `reference-stage-own-hunks-of-shared-dirty-file` 절차를 따른다.
- `.agent/task-state.json` 은 로컬 전용 — 커밋하지 않는다.

## 2. 커밋 전 확인

- `.ts` · `.tsx` 가 있으면 `pnpm type-check` (이 턴에 이미 PASS 면 생략).
- 소스 동작 변경이면 `/verify` 절차 (영향 영역 live 1회). docs · tests · `.claude/**` 만이면 생략.
- 실패가 보이면 HEAD 에서도 실패하는지 대조한 뒤 원인을 판정한다 — 내 변경 탓이면 커밋하지 않고 보고.
- CHANGELOG 트리거 (CLAUDE.md §CHANGELOG 관리) 에 해당하면 `docs/CHANGELOG.md` 를 같은 커밋에 넣는다.

## 3. 스테이징 · 커밋

경로는 zsh 배열이나 직접 적은 경로로 넘긴다. 따옴표 없는 문자열 변수는 zsh 가 나누지 않아 실패한다. 목록에 없는 경로가 하나라도 있으면 전부 스테이징되지 않으니 결과를 확인한다.

```bash
files=(path/a path/b)
git add -- "${files[@]}" && git diff --cached --name-only
git commit -m "<type>(<scope>): <요약>

<본문>

Co-Authored-By: ..." -- "${files[@]}"
```

- 메시지는 저장소 관례 (`feat(adr-NNN): …` · `fix(scope): …` · `docs: …`) 와 한국어 본문. `protect-commit-vocabulary.sh` 는 금지 어휘 중 한 단어만 막는다 — 나머지는 `~/.claude/CLAUDE.md` 의 어휘 표로 스스로 점검한다.
- 서명 줄은 대화에 주어진 attribution 을 따른다.
- `protect-git-add-all.sh` 가 확인을 물으면 목록을 읽고 남의 파일이 섞였는지 다시 본다.

## 4. push 전 번호 충돌

```bash
git fetch origin && git log --oneline HEAD..origin/main
```

- origin/main 에 새 커밋이 있으면 그 커밋이 같은 contract 버전 · ADR 번호 · 번들 상한 값을 올렸는지 본다. 겹치면 내 번호를 다음 값으로 고친 뒤 커밋을 고친다.
- origin 이 앞서 있으면 합친 뒤 `git push origin main`. 합치는 방법은 작업 트리 상태로 고른다 (사용자 결정 2026-11-25):
  - `git status --porcelain` 이 비어 있으면 `git pull --rebase origin main` (이력이 한 줄).
  - 다른 세션의 미커밋 변경이 있으면 `git pull --no-rebase --ff origin main` (merge 커밋 — 이 저장소 설정 `pull.ff=only` 를 `--ff` 가 이 명령에서만 푼다). `--autostash` · `git stash` 는 쓰지 않는다 — 남의 WIP 를 stash 에 넣었다 되돌리다 충돌하면 작업 트리에서 사라진다 (2026-11-22 stash 사고). merge 는 origin 이 바꾼 파일이 로컬 미커밋 파일과 겹치면 시작 전에 거부하니, 그때는 멈추고 사용자에게 보고한다.
- push 가 차단되면 우회하지 않고 사용자에게 `! git push origin main` 을 요청한다 (`.claude/rules/git-workflow.md` §4).

## 5. 보고

- 커밋 hash · 메시지 첫 줄 · 파일 수 · 실제로 한 확인 (type-check · live 무엇).
- **남은 미커밋 파일**을 출처 추정별로 묶어 보여 준다 (예: 「ADR-306 Phase 6 진행 중 — 다른 세션」 · 「Cursor 수동 편집으로 보임」). 인자가 `all` 이거나 사용자가 원하면 묶음별 별도 커밋을 제안하고, 승인 뒤에만 커밋한다. 말없이 남겨 두지 않는다.
- 보고는 한국어.
