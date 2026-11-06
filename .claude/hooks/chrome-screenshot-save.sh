#!/bin/bash
# PreToolUse Hook (Chrome MCP computer · browser_batch): 스크린샷을 항상 파일로 남긴다.
#
# Chrome MCP 의 `screenshot` · `zoom` 은 기본으로 대화 안에만 남고 파일이 없다. `save_to_disk: true`
# 를 주면 임시 폴더에 저장되고 경로가 결과로 돌아온다. 이 hook 은 그 옵션을 입력에 넣어 준다 —
# live 확인의 증거 파일 (run 폴더 artifacts/) 을 만들 때 다시 찍지 않고 저장된 파일을 복사하면 된다.
#
# 사용자 지시 (2026-11-06): 「save_to_disk: true 설정해」. artifacts/ 로의 복사는 자동이 아니다 —
# 탐색용 스크린샷까지 증거 폴더에 쌓이지 않게, 증거로 쓸 파일만 직접 복사한다.
#
# 판정은 하지 않는다 (permissionDecision 없음) — 입력만 바꾸고, 바꿀 것이 없으면 출력 없이 exit 0.
# `scale` 은 건드리지 않는다: 저장 파일도 그 배율로 줄어드니 증거용은 scale 없이 찍는다.

command -v jq >/dev/null 2>&1 || exit 0
INPUT=$(cat)

printf '%s' "$INPUT" | jq -c '
  def save: if (.action == "screenshot" or .action == "zoom") and (.save_to_disk != true)
            then . + {save_to_disk: true} else . end;
  .tool_name as $tool | .tool_input as $in
  | (if $tool == "mcp__claude-in-chrome__computer" then ($in | save)
     elif $tool == "mcp__claude-in-chrome__browser_batch" and (($in.actions | type) == "array") then
       $in | .actions |= map(if .name == "computer" and ((.input | type) == "object") then .input |= save else . end)
     else $in end) as $out
  | if $out == $in then empty
    else {hookSpecificOutput: {hookEventName: "PreToolUse", updatedInput: $out}} end
' 2>/dev/null
exit 0
