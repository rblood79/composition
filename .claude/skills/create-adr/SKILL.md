---
name: create-adr
description: 아키텍처 결정을 새 ADR 문서로 기록해야 할 때 발동 — "ADR 생성/작성/만들어", "new ADR", 설계 결정 문서 추가 요청 시. 기존 ADR 리뷰/수정에는 사용하지 않는다.
TRIGGER when: "ADR 생성", "ADR 작성", "새 ADR", "ADR 만들어", "create ADR", "new ADR", "아키텍처 결정 문서 작성", "설계 문서 생성", "ADR 추가"
user-invocable: true
scope: docs/adr/ 디렉토리에 새 ADR 문서 생성
---

# Create ADR: 아키텍처 결정 문서 생성

새 ADR을 Risk-First Design Loop 템플릿으로 생성합니다.
번호 자동 할당, README.md 테이블 동시 갱신까지 한 번에 처리합니다.

---

## Phase 0: Fork 게이트 (기존 ADR 분리/fork 인 경우)

기존 ADR 의 잔여 영역 분리, base/응용 split, 선행 ADR 에 흡수 불가한 영역의 신규 제안이면 — `.claude/rules/adr-writing.md` §"ADR Fork / 분리 결정 시 전제·관점 점검" 의 **4 질문 lock-in + AskUserQuestion 사용자 explicit confirm (M2)** 을 먼저 통과해야 한다. **미통과 시 본 스킬 진행 금지** (파일 생성 차단). 완전 신규 주제 ADR 은 이 게이트 해당 없음.

---

## Phase 1: 번호 할당 + 파일 생성

### 1-1. 다음 번호 결정

```bash
# docs/adr/ + docs/adr/completed/ 양쪽 스캔 — 900 미만 정규 밴드의 최대 번호
ls docs/adr/ docs/adr/completed/ | grep -oE '^[0-9]+' | sort -n | awk '$1<900' | tail -1
```

→ **900 미만 정규 밴드의 최대 + 1** = 새 ADR 번호 (3자리 zero-pad; 현재 다음 번호 `148`)

> **900+ 밴드**: 인프라/렌더링 특수 트랙 (현 최대 920). **사용자가 명시 요청할 때만** 900 밴드 최대 + 1 사용:
>
> ```bash
> ls docs/adr/ docs/adr/completed/ | grep -oE '^[0-9]+' | sort -n | awk '$1>=900' | tail -1
> ```

> **주의**: `docs/adr/` 과 `docs/adr/completed/` 양쪽 모두 스캔. 번호 충돌 방지.

### 1-2. 제목 결정

사용자가 제목을 제공하지 않았으면 **반드시 질문**:

> "ADR 제목(영문 kebab-case)과 한글 제목을 알려주세요. 예: `canvas-text-caching` / 캔버스 텍스트 캐싱"

### 1-3. 파일 생성

파일명: `docs/adr/{NNN}-{kebab-title}.md`

```
예: docs/adr/148-canvas-text-caching.md
```

---

## Phase 2: 스캐폴딩 + design 파일 생성 (CRITICAL: 내용 전에 구조 먼저)

> **규칙 단일 소스**: `.claude/rules/adr-writing.md` — 필수 순서, 작성 순서, 4축 위험 평가, Threshold Check, 검증 체크리스트, 금지 패턴이 정의되어 있다. 이 규칙을 **전부** 따른다.

### 2-1. 구현 상세가 필요한 ADR인지 판단

- Phase/단계가 있거나, 파일 변경 목록이 있거나, 체크리스트가 필요하면 → **design 파일 필요**
- 간단한 결정(기술 선택 등)이면 → design 파일 불필요

### 2-2. design 파일 먼저 생성 (필요시)

```
docs/adr/design/{NNN}-{kebab-title}-breakdown.md
```

구현 상세(Phase 목록, 파일 변경표, 체크리스트, 코드 예시)는 **이 파일에만** 작성.

### 2-3. ADR 스캐폴딩 생성

**빈 섹션 헤더만 먼저** 생성하여 구조를 확정한 후 내용을 채운다. Decision 직후에 design 파일 포인터를 배치한다.

### 템플릿 (복사 아님 — 규칙 참조 기반 생성)

```markdown
# ADR-{NNN}: {한글 제목}

## Status

Proposed — {YYYY-MM-DD}

## Context

[문제 설명]

**Hard Constraints**:

1. [측정 가능한 제약 — 성능 수치, API 계약, 하위 호환 등]

**Soft Constraints**:

- [팀 역량, 일정, 외부 의존성 성숙도 등]

## Alternatives Considered

### 대안 A: [이름]

- 설명: ...
- 근거: [외부 리서치 — 경쟁사, 오픈소스, 업계 패턴]
- 위험:
  - 기술: L/M/H/C — [사유]
  - 성능: L/M/H/C — [사유]
  - 유지보수: L/M/H/C — [사유]
  - 마이그레이션: L/M/H/C — [사유]

### 대안 B: [이름]

- 설명: ...
- 근거: [외부 리서치]
- 위험:
  - 기술: L/M/H/C — [사유]
  - 성능: L/M/H/C — [사유]
  - 유지보수: L/M/H/C — [사유]
  - 마이그레이션: L/M/H/C — [사유]

### 대안 C: [이름]

- 설명: ...
- 근거: [외부 리서치]
- 위험:
  - 기술: L/M/H/C — [사유]
  - 성능: L/M/H/C — [사유]
  - 유지보수: L/M/H/C — [사유]
  - 마이그레이션: L/M/H/C — [사유]

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    |      |      |          |              |            |
| B    |      |      |          |              |            |
| C    |      |      |          |              |            |

[루프 판정: 모든 대안 HIGH 1+이면 새 대안 추가, CRITICAL 1+이면 근본적 다른 접근 추가]

## Decision

**대안 X: [이름]**를 선택한다.

선택 근거:

1. [위험 수용 근거 — 왜 이 대안의 잔존 위험이 수용 가능한가]

기각 사유:

- **대안 Y 기각**: [이유]
- **대안 Z 기각**: [이유]

> 구현 상세: [{NNN}-{title}-breakdown.md](design/{NNN}-{title}-breakdown.md)

## Risks

| ID  | 위험 | 심각도 | 대응 |
| --- | ---- | :----: | ---- |
| R1  | ...  |  MED   | ...  |

[또는 "잔존 HIGH 위험 없음"]

## Gates

| Gate | 시점 | 통과 조건 | 실패 시 대안 |
| ---- | ---- | --------- | ------------ |
|      |      |           |              |

[또는: 잔존 HIGH 위험 없음]

## Consequences

### Positive

- [구체적 영향 — 어떤 파일, 어떤 워크플로우]

### Negative

- [구체적 영향 — 어떤 파일, 어떤 워크플로우]
```

---

## Phase 3: README.md 테이블 갱신

ADR 파일 생성 후 **반드시** `docs/adr/README.md`의 테이블에 항목을 추가한다.

### 추가 위치 결정

```
Read docs/adr/README.md
```

- Status가 `Proposed` → `### 미구현 (Proposed)` 섹션 테이블에 추가
- 번호 순서 유지

### 추가 형식

```markdown
| [{NNN}]({NNN}-{kebab-title}.md) | {한글 제목} | Proposed | - | {비고} |
```

### 현황 요약 카운트 갱신

README 상단 `## 현황 요약` 표의 `미구현/진행 (Proposed/In Progress)` 행 카운트를 +1 갱신하고, 합계도 +1 갱신한다.

---

## Phase 4: 자기 검증

생성된 ADR에 대해 `.claude/rules/adr-writing.md` §"검증 체크리스트 (작성 완료 시)" **전체 항목 (7개) + "반복 패턴 선차단" seed (현행 5항목 — 개수 미고정, 정본 참조)** 를 실행한다. 사본 나열 대신 정본 파일을 직접 열어 대조한다.

특히 놓치기 쉬운 항목:

- [ ] **Risks 섹션이 Decision 뒤 / Gates 앞에 있고, ID 표 형식으로 잔존 운영 위험을 집약했는가?** (또는 "잔존 HIGH 위험 없음" 명시)

**하나라도 실패하면 해당 섹션을 보강한 후 완료 보고.**

> 사용자가 주제만 언급하고 세부 내용을 제공하지 않은 경우, 빈 템플릿 자리에 `[TODO: ...]` 플레이스홀더를 남기고 체크리스트에서 미완성 항목을 명시한다.

---

## Architect 에이전트 연동

ADR 주제가 복잡하거나 외부 리서치가 필요한 경우, `architect` 에이전트를 호출하여 대안 생성 + 위험 평가를 위임할 수 있다.

```
Agent(architect): "{주제}에 대한 ADR 대안 분석 요청.
최소 3개 대안 + 4축 위험 평가 + Risk Threshold Check 수행.
외부 리서치(경쟁사, 오픈소스) 포함."
```

에이전트 결과를 받아 Phase 2 템플릿에 채워넣는다.

---

## 금지 패턴

- ❌ 번호 수동 할당 (자동 스캔 필수)
- ❌ README.md 미갱신 (파일 생성과 동시 갱신)
- ❌ Context → Decision → Risks 순서 (Risk-First 필수)
- ❌ 대안 1개만 제시 (최소 2개, 권장 3개)
- ❌ 위험 평가 없는 대안
- ❌ 외부 리서치 없이 직관만으로 대안 나열
- ❌ 구현 상세를 ADR 본문에 장문으로 포함 (Phase 목록, 파일 변경표, 체크리스트, 코드 예시)
- ❌ 내용 먼저 작성 후 구조 검증 (스캐폴딩 먼저 → design 파일 → 내용 채움 순서 필수)

---

## Evals

### Positive (이 스킬을 실행해야 하는 경우)

- "ADR 생성해줘" → ✅
- "새 ADR 만들어" → ✅
- "ADR 작성" → ✅
- "아키텍처 결정 문서 추가해줘" → ✅
- "create ADR for text caching" → ✅
- "텍스트 캐싱 관련 설계 문서 만들어줘" → ✅

### Negative (이 스킬을 실행하면 안 되는 경우)

- "ADR 리뷰해줘" → ❌ (리뷰 → review-adr 스킬)
- "ADR 수정해줘" → ❌ (직접 편집)
- "ADR-051 상태 변경해줘" → ❌ (직접 편집)
- "설계 문서 읽어줘" → ❌ (Read 도구)
