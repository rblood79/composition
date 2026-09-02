---
description: 패밀리 단위 일괄 검증 — parallel-verify skill로 spec/factory/renderer/CSS 정합성 동시 확인
argument-hint: [패밀리명 또는 글롭]
---

"$ARGUMENTS" 범위에 대해 패밀리 단위 병렬 검증을 수행한다.

절차:

1. `parallel-verify` skill 호출 — 서브에이전트가 컴포넌트별로 spec/factory/CSS renderer/Skia renderer/editor 5개 레이어 동시 검증
2. 불일치 요약 테이블 생성
3. 동일 패턴 반복 시 codebase grep → 한 번에 수정 (배치 sweep)
4. 수정 후 `/cross-check` 샘플 재실행

**PR 자동 생성 금지** — `.claude/rules/git-workflow.md` 절대 정책 준수. fix 는 동일 세션 또는 사용자 승인 후 main 직접 push.

**금지 패턴**:

- ❌ stale `.spec-rebuild-pending` flag 보류 상태에서 sweep 진입 — Phase 0 dist 신선도 게이트 통과 필수 (cross-check skill §5.0 동일 기준)
