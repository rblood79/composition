---
name: review-adr
description: docs/adr/ 의 작성된 ADR 문서 검증이 필요할 때 발동 — "ADR 리뷰", "ADR 검토", "설계 문서 리뷰", "아키텍처 리뷰", "review ADR", "architecture review", "design review", "ADR 위험 평가" 요청 시. 코드 리뷰/PR 리뷰에는 사용하지 않는다.
user-invocable: true
---

# Review ADR: 아키텍처 결정 문서 검증

ADR 문서의 구조적 완결성, 코드 정합성, 위험 커버리지를 검증합니다.
이슈를 "out of scope"로 스킵하지 않습니다. 발견된 모든 문제를 보고합니다.

## 🛡️ Anti-Hallucination 5대 규칙 (CRITICAL)

**2026-04-20 추가** — 과거 리뷰 세션에서 ADR 본문과 불일치하는 판정이 반복됐다. 원인은 (a) subagent SendMessage 이어받기 시 원문 컨텍스트 손실, (b) Phase 4 템플릿 slot-fill 완성 편향, (c) reviewer 의 일반 prior 를 특정 ADR 에 투영. 아래 5대 규칙은 이를 차단한다.

1. **증거 없으면 판정 없음** — 모든 구조/코드/위험 판정은 `file:line` 또는 정확한 섹션 인용 1개 이상 필수. 증거 미제시 판정은 자동 `UNVERIFIED` 분류.
2. **"이슈 0건" 정당** — Phase 4 에 HIGH/MEDIUM/LOW 이슈가 없으면 `이슈 없음 — 승인 가능` 으로 보고. 결함을 만들어내려 하지 않는다. "reviewer 가 결함을 찾지 못하면 부실하다" 는 편향 금지.
3. **템플릿 slot 강제 금지** — Phase 4 테이블의 모든 행을 채울 필요 없음. 해당하지 않는 slot 은 생략 가능 (`N/A - 해당 섹션 없음` 명시).
4. **원문 단 1회 재확인 의무** — Phase 4 보고 직전, 각 판정의 인용 라인 번호를 원문에서 재확인. 기억이나 summary 에서 인용 금지.
5. **Subagent 1-shot 원칙** — review-adr 을 subagent 에 위임 시, 중간 중단 후 SendMessage 이어받기 금지. agent context 가 autocompact 되면 원문 손실 → hallucination 필연. 중단되었다면 **main 이 직접 재수행** 또는 **새 agent 1-shot**.

---

## 사전 준비 (Setup)

```
Read docs/adr/README.md                       → 전체 ADR 현황 파악
Read {대상 ADR 본문}                            → 100% 전체 읽기 (절삭 금지)
Read {대상 ADR breakdown} (있으면)              → 구현 상세 확인
Read .claude/rules/adr-writing.md              → 템플릿 체크리스트 (동적 seed 포함)
```

**증거 캐시 시작**: 이 시점부터 `file:line` 또는 `ADR:line_range` 형태로 인용할 것만을 판정 근거로 사용. 기억/추측은 근거 아님.

---

## Phase 1: 구조 검증 (Risk-First 템플릿 대조)

### 필수 섹션 체크리스트 (adr-writing.md 의 7개 + 동적 seed)

| 섹션                    | 확인 기준                                                                   | 증거 형식         |
| ----------------------- | --------------------------------------------------------------------------- | ----------------- |
| Context                 | 측정 가능한 hard constraint 1개 이상                                        | `ADR:line N`      |
| Alternatives Considered | 최소 2개 대안 + 각 대안에 4축 위험 평가                                     | `ADR:line N-M`    |
| Risk Threshold Check    | 테이블 + HIGH+ 루프 판정                                                    | `ADR:line N`      |
| Decision                | Alternatives 뒤, 위험 수용 근거 + 기각 사유                                 | `ADR:line N`      |
| 구현 상세 분리          | 구현 상세가 design 파일에 있는가 (포인터만 본문에)                          | `ADR:line N` 링크 |
| Risks                   | Decision 뒤 / Gates 앞, ID/위험/심각도/대응 표 (또는 "잔존 HIGH 위험 없음") | `ADR:line N`      |
| Gates                   | Gate 테이블 또는 "잔존 HIGH 위험 없음" 명시                                 | `ADR:line N`      |

**adr-writing.md 동적 seed 확인** — 해당 seed 가 활성화되어 있으면 (예: 2026-04-20 반복 패턴 선차단 — 현행 seed 항목, 개수 미고정, adr-writing.md 참조) 추가 검증. 비활성화되었으면 스킵.

### 4축 위험 평가

각 대안에 **기술/성능/유지보수/마이그레이션** 4축이 모두 평가됐는지 확인. 누락 축은 `missing axis: <축>` 으로 기록.

### 구조 검증 판정 규칙

- 섹션 **존재하고 내용이 adr-writing.md 요구 충족** → `PASS + 품질(HIGH/MED/LOW)`
- 섹션 존재하지만 내용 부실 → `PARTIAL` + 부실 부분 인용
- 섹션 **없음** → `FAIL` + ADR 의 어느 line 범위에 있어야 하는지 명시

**reviewer prior 투영 금지**: "일반적으로 Gate 가 약하다" 는 전제로 PASS 를 FAIL 로 내리지 않는다. 실제 본문 line 확인 후 판정.

---

## Phase 2: 코드 검증 (주장 vs 실제)

ADR에서 언급된 파일, 인터페이스, 함수, 상수, 라인 번호를 **실제 코드에서 확인**합니다.
주장만 읽고 PASS 처리하지 않습니다. **증거 없는 VERIFIED 판정 금지**.

### 검증 절차

```
# 1. ADR에서 언급된 파일 경로 추출 → Glob 으로 존재 확인
Glob {언급된 파일 패턴}

# 2. 언급된 함수/인터페이스/상수 → Grep 으로 line 번호 확인
Grep "{함수명|인터페이스명}" --type=ts -n

# 3. "현재 ~를 사용 중" 주장 → 실제 사용 패턴 Grep
Grep "{주장된 패턴}" <경로>

# 4. 라인 번호 인용된 경우 → 해당 line ±5 Read 로 맥락 확증
Read {파일} offset:N-5 limit:10
```

### 검증 결과 분류 (3택 중 하나)

| 분류           | 의미                                                           | 필수 인용   |
| -------------- | -------------------------------------------------------------- | ----------- |
| **VERIFIED**   | 코드/라인에서 확인됨, 주장과 일치                              | `file:line` |
| **UNVERIFIED** | 코드에서 발견되지 않음 OR 확인 시도 실패 OR 인용 라인과 불일치 | 시도한 경로 |
| **PARTIAL**    | 일부만 확인, 누락 범위 구체 명시                               | 확인된 부분 |

**"주장 수 ≠ 판정 수"** — 모든 주장을 검증할 필요 없음. 핵심 주장 (decision 근거, gate 조건, hard constraint) 우선. 주변 서술은 skip 가능.

---

## Phase 3: 위험 스트레스 테스트

### 나열된 위험 검증

ADR의 각 Risk 항목에 대해 codebase에서 **구체적 증거**를 grep합니다.

```
# 위험이 실제로 존재하는가? 관련 코드 패턴 검색
Grep "{위험 관련 키워드}" --type=ts -n -C 3
```

### 누락 위험 탐색 (composition 프로젝트 특화)

ADR에 명시되지 않은 잠재 위험을 능동적으로 조사:

| 위험 영역         | 탐색 방법                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 렌더링 파리티     | CSS↔Skia 경로 양쪽에서 변경 영향 grep                                                                                                          |
| 성능 절벽         | O(n) 순회, WASM 반복 호출, 불필요한 리렌더 패턴                                                                                                |
| 마이그레이션 깨짐 | 영향받는 파일 수 grep, import 체인 추적                                                                                                        |
| 레이아웃 부작용   | layoutVersion 3-심볼 체인 점검: LAYOUT_PROP_KEYS (layoutCache.ts) / NON_LAYOUT_PROPS_UPDATE (elementUpdate.ts) / INHERITED_LAYOUT_PROPS_UPDATE |
| 상태 동기화       | Zustand → Preview postMessage 누락 가능성                                                                                                      |
| SSOT 체인         | `@sync` 주석, consumer-to-consumer 참조 금지                                                                                                   |

### 대안 위험 레벨 검토

- 모든 대안이 HIGH → 대안 추가 필요 플래그
- LOW/MEDIUM 대안이 있는데 선택하지 않았다면 → Decision 근거 재검토

### "누락 위험 없음" 정당 사유

위 영역에서 실제 증거를 찾지 못하면 **"누락 위험 0건"** 으로 보고. 억지로 위험을 만들어내지 않는다.

---

## Phase 3.5: Pre-Report Evidence Freeze (CRITICAL)

**Phase 4 보고 직전 필수 단계.** 지금까지 수집한 판정 중 `file:line` 인용이 있는 것만 최종 보고에 포함시킨다. 인용 없는 판정은 Phase 4 에서 제외하거나 `UNVERIFIED` 로 다운그레이드.

```
# 체크포인트 (mental check):
1. 각 VERIFIED 판정에 file:line 있는가?
2. 각 FAIL 판정에 ADR 의 line 인용 있는가?
3. 모든 "누락 위험 발견" 항목에 grep 결과 있는가?
4. Phase 2 에서 UNVERIFIED 분류된 항목을 Phase 4 에서 FAIL 로 승격하지 않았는가?
```

**증거 부족 시 대응**: 해당 판정을 삭제하거나 `UNVERIFIED - evidence missing` 으로 표기. 무증거 단정 금지.

---

## Phase 4: 결과 보고

### 형식 (slot 전부 채울 필요 없음)

```markdown
## ADR 리뷰 결과: ADR-NNN {제목}

### 구조 검증

| 섹션                                | 판정              | 품질         | 인용         |
| ----------------------------------- | ----------------- | ------------ | ------------ |
| Context                             | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |
| Alternatives (2개+)                 | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |
| 4축 위험 평가                       | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |
| Risk Threshold Check                | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |
| Decision 위험 수용 근거             | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |
| Risks (Decision 뒤/Gates 앞, ID 표) | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |
| Gates                               | PASS/PARTIAL/FAIL | HIGH/MED/LOW | `ADR:line N` |

### 코드 검증 (핵심 주장만)

| 주장     | 판정                        | 근거                  |
| -------- | --------------------------- | --------------------- |
| "{주장}" | VERIFIED/UNVERIFIED/PARTIAL | `file:line` 또는 시도 |

### 위험 평가

| 위험             | 증거        | 심각도       | 상태     |
| ---------------- | ----------- | ------------ | -------- |
| {ADR 나열 위험}  | `file:line` | HIGH/MED/LOW | 기재됨   |
| {탐색 발견 위험} | `grep 결과` | HIGH/MED/LOW | **누락** |

**또는** `누락 위험 없음` — 탐색 결과 추가 위험 미발견.

### 종합 판정

- **구조**: PASS/PARTIAL/FAIL ({FAIL 섹션 있으면 목록})
- **코드 정합**: N/M VERIFIED (검증 시도 수)
- **누락 위험**: N건 (HIGH X / MED Y / LOW Z) 또는 `0건`
- **권고**:
  - **HIGH**: {필수 수정 이슈} 또는 `없음`
  - **MEDIUM**: {권장 수정} 또는 `없음`
  - **LOW**: {선택적 개선} 또는 `없음`
  - **결론**: 승인 가능 / 수정 후 재리뷰 / 재설계 필요
```

### "이슈 0건 권고" 예시

ADR 이 건전하면 아래와 같이 보고:

```
### 종합 판정

- 구조: PASS (7/7 섹션 HIGH 품질)
- 코드 정합: 8/8 VERIFIED
- 누락 위험: 0건
- 권고:
  - HIGH: 없음
  - MEDIUM: 없음
  - LOW: 없음
  - 결론: **승인 가능**
```

---

## Phase 4.5: Layer 0 영속화 (자동 저장)

Phase 4 의 마크다운 결과를 출력한 후, 아래 JSON payload 를 stdin 으로 writer 에 전달하여 `docs/adr/reviews/NNN.md` 에 저장합니다. **Fail-soft** — writer 실패해도 Phase 4 사용자 출력은 영향 받지 않습니다.

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
      "outcome": "pending"
    }
  ],
  "bodyMd": "<Phase 4 마크다운 본문>"
}
EOF
```

`issues` 가 빈 배열(`[]`)이어도 정상 — Layer 0 에 "이슈 없음 승인" 기록으로 저장.

### 출력 처리

- **성공**: `→ saved to docs/adr/reviews/NNN.md (round N)` 한 줄을 Phase 4 결과 끝에 추가. exit 0.
- **Malformed 복구**: `→ saved (malformed recovery) to NNN.{ts}.md` 한 줄 추가. exit 1 무시 (data preserved).
- **Fatal (required 필드 누락, IO 실패)**: `writer: <error>` warning 만 출력. Phase 1~4 정상 완료.

### 스키마 / taxonomy

- **Schema SSOT**: [docs/adr/reviews/README.md](../../../docs/adr/reviews/README.md)
- **Design rationale**: [docs/superpowers/specs/2026-04-20-adr-review-layer0-schema-design.md](../../../docs/superpowers/specs/2026-04-20-adr-review-layer0-schema-design.md)
- **Validator**: `node .claude/scripts/adr-review/validate.mjs`

---

## 이슈 처리 원칙

- HIGH/MEDIUM 이슈는 "범위 외" 로 스킵하지 않는다 — **단, 증거 있는 이슈만 해당**
- 코드 검증 없이 ADR 주장을 사실로 수용하지 않는다 — 동시에 **근거 없이 부정하지도 않는다**
- UNVERIFIED 항목은 반드시 보고하고, ADR 수정 또는 코드 구현 필요 여부를 명시한다
- 위험이 발견됐지만 ADR 에 없으면 "누락 위험" 으로 분류하고 grep 증거를 첨부
- **"이슈 없음" 은 정당한 결론** — 건전한 ADR 을 "결함 있는 것처럼" 보고하지 않는다

---

## Subagent 운영 가이드 (재발 방지)

본 skill 을 subagent 에 위임할 때의 안전 원칙:

### 1-shot 완결 원칙

subagent 를 dispatch 했다면 **처음부터 Phase 4.5 까지 한 번에 수행**. 중간에 "일단 여기까지 보고" 지시 금지.

### 중단 발생 시

subagent 가 Phase 2/3 중간에 응답을 멈추고 새 turn 을 요구하면:

| 상황                   | 권장 조치                                             |
| ---------------------- | ----------------------------------------------------- |
| Main 이 동일 리뷰 가능 | **main 이 직접 재수행** (가장 빠르고 신뢰 높음)       |
| Main 컨텍스트 포화     | **새 agent 1-shot dispatch** (SendMessage 이어받기 X) |
| 결과 일부 이미 유효    | **증거 인용 있는 판정만 채택**, 나머지는 main 이 보충 |

### SendMessage 금지 사유

Subagent 의 context 는 autocompact 되면 원문 세부가 압축된다. SendMessage 로 "최종 보고만 제출" 요청 시 압축된 기억에 의존 → Phase 4 템플릿 slot fill 압박과 결합하여 **hallucination 가능성 HIGH**.

### 확증 역할 분리

Subagent 리뷰 결과는 **가설 (hint)** 로 취급. Main 은 **확증자 (verifier)** 로 file:line 인용을 원문에서 cross-check. 이 역할 분리가 reviewer 개별 신뢰도보다 안전.

---

## Evals

### Positive (이 스킬을 실행해야 하는 경우)

- "이 ADR 리뷰해줘" → ✅
- "설계 문서 검토 부탁" → ✅
- "ADR-051 위험 평가가 맞는지 확인해봐" → ✅
- "아키텍처 결정 문서 리뷰" → ✅
- "review ADR" → ✅

### Negative (이 스킬을 실행하면 안 되는 경우)

- "코드 리뷰해줘" → ❌ (코드 리뷰 → reviewer 에이전트)
- "README 수정해줘" → ❌ (문서 편집)
- "ADR 새로 작성해줘" → ❌ (작성 → create-adr 스킬 (`/new-adr`))
- "PR 리뷰해줘" → ❌ (PR → reviewer 에이전트)
