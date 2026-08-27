# Paperthin·Polysona 분석 — Claude Code 측 결과와 Codex 문서 대조

> 분석일: 2026-08-27
> 작성: Claude Code (Fable 5) 세션. 짝 문서: [Codex 분석](./2026-08-27-paperthin-polysona-agent-automation-analysis.md)
> 목적: 두 저장소를 독립 분석한 결과, composition 적용안, Codex 문서와의 항목별 대조와 병합 순서를 기록한다. 이 문서는 ADR 착수나 구현을 승인하지 않는다.
>
> **역할 구분 (2026-08-27 Codex 확인)**: Codex 문서 = 두 저장소의 상세 구조·근거·composition 적용 원칙. 이 문서 = 독립 분석 대조·상충 판정·**최종 병합 순서 (§6)**. 향후 구현 기준은 §6 이며, §5 상충 3건은 Codex 가 독립 판정으로 동의했다 (polysona hook 미동작 / evidence 최소형 후 runner 보류 / 호스트별 invocation·subagent 정책 분리).

## 1. 실측 근거

- paperthin `main` @ `3bca079` — 전체 clone. 49 commit (2026-06-19 ~ 08-19), 태그 33, npm `0.17.4`. 파일 61 = SKILL.md 28 (1,208줄) + README 11개 언어 + 스크립트 7 + CI 2. 외부 기여 8 commit 은 전부 cherry-pick 으로 반영 (authorship 보존).
- polysona `ralphthon` @ `ad1f263` — tarball + raw 파일. 45 commit 이 2026-03-29 01:09Z ~ 12:04Z 11시간 안에 생성, 저자 1명. ★149. `dev` 브랜치 1 commit (08-19 "docs: start polysona rewrite from scratch"). Ralphthon Seoul #2 1등 (1인 팀, 키보드 터치 패널티 0) 은 luma·threads·team-attention 페이지로 확인.
- composition `.claude/` 인벤토리: skill 10 (전부 model-invocable, `disable-model-invocation` 0건, `../` 교차참조 6건), command 5, agent 8, rule 11 (상시 로드 2), hook 등록 14 / 스크립트 18 (전부 stdin JSON 소비), 메모리 374 (feedback 213 / project 55, 3.2MB), ADR review 93. 상시 로드 컨텍스트 ≈ 78KB (CLAUDE.md + local + rule 2 + MEMORY.md + 글로벌), rules 전체 262KB.
- 이후 Codex 문서 검증 과정에서 추가 실측: `.agents/skills/` 11개 (링크 8 + 실제 디렉터리 3) vs `.agents/skills/INDEX.md` 8개; `react-aria`·`react-spectrum` 은 링크가 아닌 **동일 내용 복사본**; `source-command-review/SKILL.md` 는 `.claude/commands/review.md` 와 본문 동일 (이름만 다른 중복); 라우터 2벌 (`.claude/hooks/route-prompt.sh` 163줄 / `scripts/codex/route-prompt.sh` 81줄) 트리거 집합 상이; `AGENTS.md:91` "병렬/subagent 는 사용자 명시 시에만" 은 Codex 호스트 규칙이고 Claude 쪽 CLAUDE.md 라우팅표는 reviewer/evaluator subagent 를 기본 경로로 둠.

## 2. paperthin 요지

- 명제: "에이전트 스킬은 더하기만 한다 → 우리 스킬은 전부 뺀다." 28개 중 다수가 "찾은 게 없으면 no-op" 를 규칙 1번으로 둠.
- 2×2 축 (cardinality × time): depth 19 / breadth 2 / coil 6 / mesh 1.
- invocation 축: `disable-model-invocation: true` 12개 (hate, macrothink, feynman, reorder, dedash, debloat, re0-git, re0-release, re0-merge, re0-upgrade, re0-plan, prism). 판정 기준 = "트리거가 사람의 결정 (commit/push/publish)" 또는 "손닿는 곳에 있으면 편향". user-invoked 는 다른 user-invoked 를 못 부른다 (트리거 없음) → orchestrator 설계를 규정.
- 격리 sub-session 을 인식론 도구로 사용: shower/feynman/macrothink/autobahn/prism. autobahn 은 공유 파일시스템·메모리 검색까지 차단.
- 카탈로그 무결성 CI 5단계: validate-skills (frontmatter·name=dir·4섹션·description ≤800·plugin.json·README 등록·`../` 금지), check-skill-refs (오타·orphan), check-links, check-catalog-sync (스크립트 배열 ↔ SKILL.md roster 집합), check-deploy-home. roster 는 self-containment 때문에 물리적 단일화 불가 → "복제하되 CI 가 drift 차단" 을 명문화.
- 실측 문제: `check-skill-refs.sh`/`check-links.sh` 는 GNU/bash4 전용 (macOS 실패); `check-catalog-sync.cjs:6` "21-skill" stale; README PROOF 15건은 자기 보고 (mandela #5 verifier=designer); `re0-upgrade` step 9 무확인 자동 star 는 자기 규칙과 모순; "any agent" 는 subagent 스폰 가능 호스트에서만 완전.

## 3. polysona 요지

- 5 agent (profiler/trendsetter/content-writer/virtual-follower/admin) + 8 skill + hook 3 + PLOON Markdown 데이터 + Bun/Hono/React 대시보드 (TSX 1,648줄). Codex 필수 조건 (Statement 1) → `agents/openai.yaml` + AGENTS.md + `.agents/skills` 미러 스크립트.
- 강점: profiler.md (15KB) 의 10 프레임워크 × (목적·질문·출력 필드·주의) 1:1 매핑; 5 agent 공통 "Write → 즉시 Read 확인 → 실패면 실패라고 보고"; append-only interview-log + GAP 프로토콜; QA `context: fork` 격리.
- 실측 문제: **hook 3개 미동작** — `hooks.json` `"type": "bash"` (Claude Code 는 `command`), 스크립트가 `$TOOL_NAME/$FILE_PATH/$TOOL_OUTPUT` 환경변수를 읽지만 실제 전달은 stdin JSON → 경고 분기 실행 불가, 경로도 cwd 상대; 대시보드 QA 점수 = 문자열 해시 `40+|hash%56|` (LLM 평가 아님, agent 가 쓴 `content/qa/` 를 읽지 않음); README 의 `.agents/skills` 미러 커밋 주장 거짓 (404); 버전 `1.3.0` 4곳 하드코딩 (자기 SSOT 규칙 위반); README.ko 가 Jung 을 10 프레임워크에 포함 (목록에 없음); `.gitignore` 가 trends/qa 는 제외 안 함; `process_svg.py` 에 `C:\Users\smsme\Desktop\supersona\` 경로 (개명 잔재); references 3/10; 테스트·CI·릴리즈 0.
- 판정: 프롬프트 층은 제품, 코드 층은 데모 시각화. 교훈 2개 — 죽은 hook 감지, 표면 숫자 ≠ 소비 경로.

## 4. composition 적용안 (Claude 측 원안)

| #   | 항목                                                                                                                                                                                                                                            | 근거 gap                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `.claude/` 카탈로그 drift-guard (`validate-catalog.sh`: frontmatter·name=dir·INDEX/CLAUDE.md 라우팅표/session-start roster 집합 일치·rule `paths:` 매칭 ≥1) + hook self-test (`selftest.sh`: hook 별 샘플 stdin JSON → 기대 결정 assert)        | roster 표면 다수, 검증 0; 폴리소나 죽은 hook                                                                                           |
| P2  | `execute-adr`·`create-adr`·`match-target` 에 `disable-model-invocation: true` + INDEX 에 사유                                                                                                                                                   | 메모리 차단 카테고리 `no-derived-adr-mid-execution`/`execute-adr-surface-minimization` = "손닿는 곳에 있으면 편향" 과 같은 실패 클래스 |
| P3  | review-adr 에 `hate` 단계 (load-bearing 가정 1 + first nail → G0 편입), `prism` 렌즈 (failure mode 기준, 불일치 → 해결 질문 1개); `.claude/rules/measurement-validity.md` (mandela 8-패턴을 실측 함정 메모리 10여 개로 치환, 메모리는 포인터화) | review round 비용 (912=16, 913=11); 측정 함정 메모리 산재                                                                              |
| P4  | 상시 컨텍스트 debloat/re0 — CLAUDE.md 날짜 붙은 "Why" 서사 → rules/memory, MEMORY 374 → family 통합. 사용자 산출물이므로 diff 제시 후 승인                                                                                                      | 78KB 상시 로드; CLAUDE.md 스스로 "규칙 어휘가 응답에 재현" 인정                                                                        |
| P5  | `adr-status-sync-check.sh` 확장 — Implemented 승격 시 `docs/adr/evidence/NNN-*.md` 의 live-exercise 절 존재 요구; `execute-adr` Phase 0 에 `understood as:` 1줄 (readchk)                                                                       | ADR-144 사례 = 폴리소나 해시 QA 와 같은 종류                                                                                           |

제외: autobahn/detool/dedash/reorder/modelchk (해당 문제 없음), coil 6종 (task-state + session-start + 메모리 + archive 가 더 기계적), re0-upgrade notice/sip (로컬 스킬), 폴리소나 전체.

원안 순서: P1 → P2 → P3 → P5 → P4.

## 5. Codex 문서와의 대조

| 주제                              | Codex                                                                        | Claude                             | 관계                                            |
| --------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| 이식 금지, project-local 재구현   | §1, §4.7                                                                     | 제외표                             | 일치                                            |
| 카탈로그 drift 게이트             | P0 (`.claude`+`.agents` 링크+INDEX×2+roster+라우터×2, `codex:agent-catalog`) | P1 (`.claude` 만)                  | 일치 — Codex 범위가 맞음 (Claude 인벤토리 누락) |
| hook self-test                    | 없음                                                                         | P1                                 | 상보                                            |
| invocation 축                     | §4.3 원칙 서술만                                                             | P2 조치 3건                        | 상보                                            |
| 완료 = evidence                   | P1 run.json(`understoodAs`, gates)+evidence.jsonl, P2 `work` runner          | P5 hook 확장 + `understood as` 1줄 | 같은 목표, 다른 무게                            |
| 리뷰 수렴 (hate/prism)            | 없음                                                                         | P3                                 | 상보                                            |
| 측정 무결성 rule                  | 없음                                                                         | P3                                 | 상보                                            |
| 실패 → gate (failure record)      | P3                                                                           | 없음                               | 상보                                            |
| 상시 컨텍스트 debloat             | 없음                                                                         | P4                                 | 상보                                            |
| 폴리소나 hook                     | "유용하지만 경고만"                                                          | 형식 불일치로 미동작               | **상충**                                        |
| subagent 정책                     | "사용자 명시 시에만" (AGENTS.md:91)                                          | Claude 라우팅표는 기본 경로        | 호스트 간 drift                                 |
| ADR-195 agent surface / dashboard | P4·P5 보류                                                                   | 미언급                             | 일치 (보류)                                     |
| 제외 목록                         | §9                                                                           | 제외표                             | 일치                                            |

상충 판정 (Claude 측):

1. 폴리소나 hook — 파일 단위 근거 (`hooks.json` type, 환경변수 vs stdin) 로 "미동작" 채택. hook self-test 의 근거.
2. evidence 무게 — Codex P1 스키마 채택, P2 runner 는 ledger 효용 확인 후로 보류 (restraint).
3. subagent 정책 — 상충이 아니라 호스트 간 drift → 카탈로그 SSOT 에 호스트별 invocation/subagent 정책 열.

## 6. 병합 순서 초안 (Claude 측)

| 단계 | 내용                                                                                                                                | 출처                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1    | 카탈로그 drift 게이트 (Codex P0 범위 + 복사본 동일성 + orphan 검출) → `pnpm codex:agent-catalog`, 안정화 후 preflight               | Codex P0 + Claude P1   |
| 1'   | hook self-test                                                                                                                      | Claude P1              |
| 2    | invocation flip 3건 + 호스트별 정책 열                                                                                              | Claude P2 + Codex §4.3 |
| 3    | evidence 최소형: `.agent/runs/<id>/run.json` + `evidence.jsonl` 을 기존 hook 이 append; Implemented 승격 시 live-exercise 근거 요구 | Codex P1 + Claude P5   |
| 4    | review-adr hate/prism + `measurement-validity.md` (+ Codex P3 failure record 필드 통합), ADR 리뷰 1건 시범                          | Claude P3 + Codex P3   |
| 5    | 상시 컨텍스트 debloat (승인 후)                                                                                                     | Claude P4              |
| 보류 | `work` runner (3단계 효용 확인 후), ADR-195 agent surface (별도 ADR), dashboard                                                     | Codex P2/P4/P5         |

Codex 문서 정정 제안: §5.6-6 (폴리소나 hook 미동작), §4.7/§5.4 (subagent 정책은 Codex 호스트 한정).
