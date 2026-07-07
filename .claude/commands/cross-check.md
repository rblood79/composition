---
description: CSS↔Skia 렌더링 경로 정합성 검증 워크플로 (단일 또는 지정 컴포넌트)
argument-hint: [component-name]
---

`cross-check` skill을 호출하여 $ARGUMENTS 컴포넌트의 렌더링 경로 정합성을 검증한다.

절차:

1. `cross-check` skill 실행 (Skill 도구)
2. 불일치 발견 시 `debugger` agent 위임 (subagent_type=debugger)
3. 수정 후 재실행하여 PASS 확인
4. 완료 시 변경된 경로(spec/factory/CSS renderer/Skia renderer/editor) 명시
