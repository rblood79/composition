## ADR 리뷰 기록

리뷰 결과를 작성한 후, 아래 JSON payload 를 stdin 으로 writer 에 전달하여 `docs/adr/reviews/NNN.md` 에 저장합니다. **Fail-soft** — writer 실패해도 Phase 4 사용자 출력은 영향 받지 않습니다.

### 호출 방법

```bash
cat <<'EOF' | node .claude/scripts/adr-review/writer.mjs
{
  "adr": <ADR번호>,
  "title": "<ADR 제목>",
  "reviewer": "claude",
  "source": "live",
  "issues": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "category": "<.claude/scripts/adr-review/ 9-taxonomy>",
      "summary": "<한 줄 요약>",
      "evidence": "<파일:line>",
      "root_cause": "<...>",
      "outcome": "<기록 시점 실제 상태: pending | fixed | deferred | rejected>"
    }
  ],
  "bodyMd": "<Phase 4 마크다운 본문>",
  "hate": { "assumption": "<load-bearing 가정>", "root": "<반론 1개>", "axis": "<공격 축>", "first_nail": "<가장 싼 반증>", "verdict": "<G{n} 커버 | issue:{id}>" },
  "prism": { "lenses": [ { "lens": "<failure mode>", "verdict": "pass|fail|unclear", "reason": "<이유 1개>" } ], "convergence": "<일치|다른 이유로 일치|불일치>", "question": "<해결 질문 1 | 없음>" }
}
EOF
```

`issues` 가 빈 배열(`[]`)이어도 정상 — Layer 0 에 "이슈 없음 승인" 기록으로 저장. `hate` / `prism` 은 선택 필드 (3-P 미실행이면 `prism` 생략) — writer 가 round frontmatter 에 그대로 보존한다.

### Outcome 종결 의무 (2026-07-11 — 종결 계약 연계, CRITICAL)

- `outcome` 은 **기록 시점의 실제 상태**를 반영한다 — 기본값 `pending` 을 기계적으로 넣지 않는다. 리뷰 중 이미 해소를 확인한 이슈는 `fixed` + `addressed_in` (commit/round 참조) 로 기록.
- **종합 판정이 "승인 가능" 인 round 는 `pending` 잔존 금지** — 각 이슈를 `fixed` / `deferred` / `rejected` 중 하나로 종결한다. 이전 round 의 `pending` 이슈도 해소 여부를 확인해 해당 round frontmatter 의 `outcome` 을 직접 갱신한다 (round 본문은 append-only 보존, frontmatter outcome 필드만 상태 갱신 대상).
- **Why**: execute-adr auto 모드와 전제 확정 종결 계약 (CLAUDE.md §전제·관점 의문 처리) 이 최신 round 의 outcome 을 기계 판독한다. `pending` 잔존 = 실질 승인 ADR 이 미확정으로 판정되어 착수 시점 재질문 루프 재발 (2026-07-11 진단: 912=7 / 913=10 pending 잔존 실측 — 본문 프로즈는 "승인 가능" 인데 frontmatter 는 미종결).

### 출력 처리

- **성공**: `→ saved to docs/adr/reviews/NNN.md (round N)` 한 줄을 Phase 4 결과 끝에 추가. exit 0.
- **Malformed 복구**: `→ saved (malformed recovery) to NNN.{ts}.md` 한 줄 추가. exit 1 무시 (data preserved).
- **Fatal (required 필드 누락, IO 실패)**: `writer: <error>` warning 만 출력. Phase 1~4 정상 완료.

### 스키마 / taxonomy

- **Schema SSOT**: [docs/adr/reviews/README.md](../../../../docs/adr/reviews/README.md)
- **Design rationale**: [docs/reference/schemas/ADR_REVIEW_LAYER0.md](../../../../docs/reference/schemas/ADR_REVIEW_LAYER0.md)
- **Validator**: `node .claude/scripts/adr-review/validate.mjs`

---
