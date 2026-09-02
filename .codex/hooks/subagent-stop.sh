#!/usr/bin/env bash
# SubagentStop hook — DEPRECATED 2026-04-30
#
# 이전 동작: payload 의 .agent_type 을 stats/agents.jsonl 에 기록
# 폐기 사유: 65% 가 빈 문자열로 기록 (302/492 entries) — payload schema 일관성 결함
# 집계가 필요하면 transcript 를 직접 센다 (`.claude/hooks/weekly-report.sh`)
#
# 본 hook 은 no-op 으로 유지 — 필요 시 settings.json 에서 SubagentStop 항목 제거 가능
exit 0
