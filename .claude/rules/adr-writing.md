---
description: ADR 문서 작성/편집 시 Risk-First Design Loop 가이드라인 적용
globs:
  - "docs/adr/**"
---

# ADR 작성 규칙 — Risk-First Design Loop

> **SSOT 체인 연계 (CRITICAL)**: 새 ADR의 Context 섹션에 **3-domain 분할(D1 DOM/접근성 / D2 Props/API / D3 시각 스타일) 중 어느 것에 해당하는지** 명시 필수. 경계 교차 시 정당화 필요. 정본 원칙: [ssot-hierarchy.md](ssot-hierarchy.md). 공식 결정: [ADR-063](../../docs/adr/063-ssot-chain-charter.md).

## 왜 이 프로세스인가

ADR의 목적은 **미래의 개발자가 "왜 이렇게 결정했는가"를 이해하는 것**이다. 결론을 먼저 쓰고 위험을 나중에 붙이면 confirmation bias가 작동하여 위험이 과소 평가된다. 대안을 먼저 나열하고, 각각의 위험을 독립 평가한 뒤, 그 결과로 결정을 내려야 사후 합리화를 방지할 수 있다.

## 필수 순서 (CRITICAL)

```
[금지]  Context → Decision → Consequences/Risks (결론 먼저, 위험 나중)
[필수]  Context → Alternatives → Risk per Alternative → Threshold Check → Decision → Gates
```

## 작성 순서 — 스캐폴딩 먼저 (CRITICAL)

```
[금지]  내용 작성 → 파일 저장 → 체크리스트 → 위반 발견 → 사후 분리
[필수]  1. ADR 섹션 스캐폴딩 (빈 섹션 헤더만)
        2. design 파일 먼저 생성 (구현 상세 대상이면)
        3. Decision 직후에 `> 구현 상세: [링크]` 포인터 배치
        4. 각 섹션 내용 채움 (구현 상세는 design 파일에만)
        5. 체크리스트 최종 검증
```

대화 맥락에 분석 데이터가 이미 있어도 ADR 본문에 직접 삽입 금지. 구현 상세(Phase, 파일 목록, 체크리스트, 코드 예시)는 반드시 `docs/adr/design/*-breakdown.md`에 분리.

## ADR Fork / 분리 결정 시 framing checkpoint (CRITICAL)

> **배경**: 2026-04-26~28 ADR-111/112 사례 — baseline (ADR-903 P4) framing 을 자동 승계하여 응용 ADR (ADR-111 frame preset) 을 base ADR (ADR-112 component 추상) 의 선행 ADR 로 잘못 framing. 24+ commits / sub-phase α/β/γ/δ/θ 진행 후 codex 3차 review 에서야 reverse 정정. 본 절차는 동일 손실 재발 차단 contract.

### 적용 시점 — fork / 분리 결정의 모든 시점

- 기존 ADR 의 잔여 영역을 신규 ADR 로 분리할 때
- baseline ADR 에 흡수 미가능한 영역을 신규 ADR 로 발의할 때
- ADR 한 개를 base / 응용 두 개로 split 할 때
- 두 ADR 의 의존 방향이 의심될 때 (사용자가 "이거 거꾸로 아닌가" 트리거 시)

### 사용자 explicit confirm 의무 (M2 — 2026-05-11 추가)

4 질문 통과 후 ADR 본문 작성 직전, **claude 가 AskUserQuestion 으로 사용자 명시 confirm 요청 의무**. ADR 본문에 4 질문 lock-in 만으로 confirm 자동 처리 금지 (ADR-127 우회 패턴: 본문 self-lock-in 으로 사용자 confirm 단계 skip). confirm 받은 적 없으면 fork 차단 — 현 ADR scope 안 흡수 (옵션 1) 또는 직후 phase 흡수 (옵션 2). 본 규칙 근거: `~/.claude/plans/adr-123-124-125-126-sunny-crescent.md` M2.

### 4 질문 통과 절차 (사용자 1회 confirm 필수)

ADR 분리 결정을 commit 하기 **전에** 다음 4 질문을 ADR 본문 또는 design breakdown §1 에 1줄씩 lock-in 한다. 사용자 confirm 받기 전에는 sub-phase 분해 (α/β/γ/δ 류) 진입 금지.

1. **base / 응용 분류**: 두 ADR 중 하나가 추상 (component / format / SSOT) 이고 다른 하나가 응용 (frame / page / preset 같은 구체 적용) 인가? 그렇다면 base 가 응용의 prerequisite. 본 분류를 본문 §Context 또는 §Decision 에 1줄 명시.
2. **schema 직교성**: 두 ADR 의 schema 가 직교인가, 한쪽이 다른 쪽의 specialization 인가? specialization 쪽이 base 의 후속.
3. **baseline framing reverse 검증**: baseline ADR 의 의존 방향을 그대로 옮기는 것이 fork 후에도 valid 한가? grep + 사용자 1회 confirm. baseline framing 자동 승계 금지.
4. **codex 3차 review 까지 미루지 말 것**: 1차 (표면 이슈) / 2차 (gate 정합) 후 3차에 가서야 framing 잡히는 패턴 회피. fork 시점에 위 1-3 질문 통과 후 codex 1차 진입.

### Extended thinking 진입 의무

framing 검증은 표면 사고로 처리 금지. ADR fork 결정 시 명시적으로 깊은 사고 모드 진입 후 4 질문 통과. token 효율 학습 압력 (짧은 답변 / plan→execute→done 사이클) 회피 — Anthropic 자체 가이드 정렬.

### sub-phase 분해 진입 차단 게이트

본 4 질문이 ADR 본문 또는 design §1 에 lock-in 되지 않았으면 design breakdown 의 sub-phase α/β/γ/δ 분해 자체 차단. 분해된 sub-phase 가 많을수록 framing 위반 인지 비용이 piecewise 분산 누적되어 본질 검증 trigger 못 걸림.

### Phase scope inflation / sub-group N≥3 시 사용자 confirm 의무 (M4 — 2026-05-11 추가)

design breakdown 의 phase 실행 중 다음 조건 발견 시 **AskUserQuestion 의무** (의문문 형식, statement 금지):

- **scope inflation 1.5x 이상**: design 추정 작업량 (예: ~28 file) 대비 실측 (예: 70 file) 이 1.5배 이상. 사용자 question 예시: "design 추정 vs 실측 gap 발견 — 이게 framing trigger 인가, design Phase 0 inventory 절차 결함인가?"
- **sub-group N≥3 분할**: 단일 phase 를 Phase 2-A/B/C/D/E 같이 3 개 이상 sub-group 으로 분할 시도. 사용자 question 예시: "Phase 2 를 5 sub-group 으로 분할 vs 단일 phase 안 진행 vs design 재freeze, 어느 쪽?"
- **commit 단위 sliver 분해**: `narrow ADR-NNN ...` / `Phase X-α/β/γ` 형식 commit 이 5 개 이상 누적 예상. 사용자 question 예시: "본 phase 가 5+ commit 으로 분해 예상 — 단일 commit 통합 land 가능?"

confirm 받지 못하면 분할/inflation 차단, 단일 phase 안 진행 또는 design 재freeze 사용자 결정. ADR-126 Phase 2 sub-group 5 분할 + 22+ "narrow ..." commit 패턴 재발 차단 (~/.claude/plans/adr-123-124-125-126-sunny-crescent.md M4).

### 금지 패턴

- ❌ baseline ADR 의 framing 을 자동 승계 (fork 시점 의존 방향 별도 검증 안 함)
- ❌ "이미 ADR 본문 작성됐으니 분해 진입" — 본 4 질문 미통과 시 분해 차단
- ❌ codex 1차 / 2차 review 가 framing 검증을 한다고 가정 (codex review 는 본문 정합 layer, framing layer 아님)
- ❌ revision 사이클 (1→2→3) 이 framing 검증을 cover 한다고 가정 (revision 은 표면 변경 layer)
- ❌ design breakdown 에 추가 결정 (옵션 D1/D2/D3 / 결정 분기 등) 이 흘러 들어가서 ADR 본문 framing 위반에 침묵

## 섹션별 요구사항

### Context

- **측정 가능한 제약** (hard constraints): 성능 수치(60fps, <3초, <500KB), API 계약, 하위 호환
- **측정 불가능한 제약**: 팀 역량, 일정, 외부 의존성 성숙도
- 제약이 없으면 결정의 자유도가 무한 → Context가 약하면 Decision도 약하다

### Alternatives Considered

- **최소 2개, 권장 3개** — 하나의 접근법만 제시하는 것은 ADR이 아니라 제안서
- 외부 리서치 근거 포함 (경쟁사, 오픈소스, 업계 패턴). 리서치 없이 직관만으로 대안 나열 금지
- 직관적 "정답"도 대안 중 하나일 뿐
- 각 대안에 4축 위험 평가 필수 (아래 참조)

### Decision

- 선택된 대안 + **위험 수용 근거** ("왜 이 대안의 잔존 위험이 수용 가능한가")
- **기각된 대안별 기각 사유** 명시 — 미래의 개발자가 "대안 A를 왜 안 했지?"를 물어보지 않게
- 구현 상세(phase, 파일 경계, 작업 순서)는 `docs/adr/design/*-breakdown.md`로 분리. ADR에는 `> 구현 상세: [링크]` 포인터만

### Risks (Decision 이후 잔존 운영 위험)

- Alternatives 단계의 4축 위험 평가는 **대안 비교용** 이고, 본 섹션은 **선정 대안 이행 중 관리해야 할 잔존 운영 위험** 을 집약한다
- 위치: **Decision 뒤, Gates 앞** — 결정 선언 직후 "이 결정에도 불구하고 남는 위험" 을 명시하고, 그 다음 Gates 가 이를 어떻게 통과 조건으로 관리하는지 이어짐
- ID (R1/R2/...) + 위험 + 심각도 + 대응의 표 형식 권장
- HIGH+ 위험은 Gates 테이블 조건과 1:1 대응 (각 HIGH Risk 에 최소 1개 Gate 필수)
- "잔존 HIGH 위험 없음" 케이스는 표 아래에 그 사실을 명시
- 예시 Risks: inter-ADR 계약 파괴 / scope 밖 영역 debt / 성능 누적 / 문서 stale / 수동 관리 부담

| ID  | 위험 | 심각도 | 대응 |
| --- | ---- | :----: | ---- |

### Gates

- 선택된 대안에 HIGH 위험이 남아있으면 Gate 테이블 필수
- HIGH 위험이 없으면 "잔존 HIGH 위험 없음" 명시
- Gate 테이블 형식:

| Gate | 시점 | 통과 조건 | 실패 시 대안 |
| ---- | ---- | --------- | ------------ |

### Consequences

- Positive / Negative 분리
- 구체적 영향 명시 (어떤 파일, 어떤 워크플로우에 영향)

## 위험 평가 4축

| 축            | 평가 내용                        |
| ------------- | -------------------------------- |
| 기술 위험     | 미검증 기술, 복잡도, 외부 의존성 |
| 성능 위험     | FPS, 번들, 로딩, 메모리          |
| 유지보수 위험 | 향후 변경 비용, 결합도           |
| 마이그레이션  | 롤백 난이도, 하위 호환           |

등급: **LOW** / **MEDIUM** / **HIGH** / **CRITICAL**

## Risk Threshold Check (필수 루프)

- 모든 대안이 HIGH 1개 이상 → 위험을 회피하는 새 대안 추가
- 어떤 대안이든 CRITICAL 1개 이상 → 근본적으로 다른 접근 추가
- 최대 2회 루프 후에도 HIGH 이상이면 "위험 수용 근거" 명시

## Status 전이 규칙

```
Proposed → Accepted    : Decision 섹션이 Gate를 모두 통과, 또는 Gate 없이 합의 완료
Accepted → Implemented : 코드가 main에 머지, 검증 통과
Any      → Deprecated  : 더 이상 유효하지 않으나 후속 ADR 없음
Any      → Superseded  : 후속 ADR이 이 결정을 대체. 본문 상단에 "Superseded by ADR-NNN" 필수
```

- Superseded 시 **후속 ADR 링크 필수** — 체인이 끊기면 히스토리 추적 불가
- Status 변경 시 `docs/adr/README.md` 테이블도 동시 갱신

## 템플릿

```markdown
# ADR-NNN: [Title]

## Status

Proposed — YYYY-MM-DD

## Context

[문제 설명 + hard constraints + soft constraints]

## Alternatives Considered

### 대안 A: [이름]

- 설명: ...
- 위험: 기술(L/M/H/C) / 성능(L/M/H/C) / 유지보수(L/M/H/C) / 마이그레이션(L/M/H/C)

### 대안 B: [이름]

- 설명: ...
- 위험: 기술(L/M/H/C) / 성능(L/M/H/C) / 유지보수(L/M/H/C) / 마이그레이션(L/M/H/C)

### Risk Threshold Check

[대안별 HIGH+ 요약 테이블 + 루프 판정]

## Decision

[선택된 대안 + 위험 수용 근거 + 기각된 대안별 기각 사유]

> 구현 상세: [NNN-title-breakdown.md](design/NNN-title-breakdown.md)

## Risks

| ID  | 위험 | 심각도 | 대응 |
| --- | ---- | :----: | ---- |
| R1  | ...  |  MED   | ...  |

[또는 "잔존 HIGH 위험 없음"]

## Gates

[Gate 테이블 또는 "잔존 HIGH 위험 없음"]

## Consequences

### Positive

### Negative
```

## 검증 체크리스트 (작성 완료 시)

ADR 작성 후 아래를 자가 검증한다. 하나라도 실패하면 해당 섹션 보강:

- [ ] Context에 측정 가능한 hard constraint가 1개 이상 있는가?
- [ ] 대안이 2개 이상이고, 각각 4축 위험 평가가 있는가?
- [ ] Risk Threshold Check 테이블이 있고, HIGH+ 대안에 대한 루프 판정이 있는가?
- [ ] Decision에 기각된 대안의 기각 사유가 있는가?
- [ ] 구현 상세가 ADR 본문이 아닌 design 문서에 있는가? (또는 구현 상세가 불필요한 수준인가?)
- [ ] **Risks 섹션이 Decision 뒤 / Gates 앞에 있고, ID 표 형식으로 잔존 운영 위험을 집약했는가?** (또는 "잔존 HIGH 위험 없음" 명시)
- [ ] Gate가 있거나, "잔존 HIGH 위험 없음"이 명시되어 있는가?

### 반복 패턴 선차단 (experimental seed — introduced: 2026-04-20, review: 2026-10-20)

> 2026-04-19 최근 10-ADR(054/056/063/075/076/078/079/100/102) 메타 분석에서 추출한 review-adr CRITICAL/HIGH 반복 카테고리 Top 1~3을 설계 단계에서 선차단.
>
> **Sunset 정책**: 각 항목은 6개월 후(2026-10-20) effectiveness 재평가 필수. 해당 카테고리 빈도가 10-ADR 샘플에서 **1/10 이하로 감소**하면 본 서브섹션에서 제거(demotion). 미감소 시 유지. 다른 카테고리가 3/10 이상으로 부상하면 교체. **파이프라인 자체(이 서브섹션의 존재 근거)도 같은 시점에 counterfactual 재평가** — 이 seed가 없었다면 리뷰 품질이 어땠을까를 점검, 효용 불명확 시 전체 해체 고려.
>
> 근거: Top 1 = 5/10 (Proposed 단계 코드 경로 확증 부재), Top 2 = 3/10 (SSOT/Spec 확장 시 Generator 미지원), Top 3 = 3/10 (BC migration cost 미수식화), 부차 = 3/10 (HIGH 누적 후 Phase 분리 후행).

- [ ] HIGH+ 위험을 명시할 때 **해당 코드 경로 파일/함수 3곳 이상 구체 인용**했는가? (#1, 5/10 — 추상 서술 대신 grep 가능한 경로 요구)
- [ ] Spec/Generator 확장 ADR이면 **"Generator가 자식 selector/variant emit을 지원하는가?"** 를 Context에 선언했는가? (#2, 3/10 — SSOT debt 영구화 선차단)
- [ ] BC 훼손 가능성이 있으면 **"X% 사용자 영향 / 평균 Y 파일 재직렬화"** 같이 수식화했는가? (#3, 3/10 — "기존 프로젝트 호환" 암묵화 차단)
- [ ] HIGH+ threshold 초과 시 **"이 Phase를 별도 ADR로 분리 가능한가?"** 질문을 거쳤는가? (부차, 누적 착시 방지)
- [ ] **추정 vs 실측 gap** (예: 추정 28 file vs 실측 70 file, 2.5배) 이 ADR fork 정당화 사유로 인용되었는가? **gap 은 절차 결함 (Phase 0 inventory freeze 부실), framing trigger 아님**. 본 ADR 안 Phase 0 inventory 보강 commit 으로 흡수, 새 ADR fork 사유 금지 (M3 — 2026-05-11, ADR-127 우회 사례)

## 금지 패턴

- Context → Decision → Risks 순서 (결론 먼저 금지)
- 대안 1개만 제시 (비교 없는 결정 금지)
- 위험 평가 없는 결정
- 기각된 대안에 기각 사유 없음
- 구현 상세를 ADR 본문에 장문으로 포함 (Phase 목록, 파일 변경표, 체크리스트, 코드 예시 포함)
- 내용 먼저 작성 후 구조 검증 (스캐폴딩 먼저 필수)
- Superseded 시 후속 ADR 링크 누락
- Status 변경 시 README.md 미갱신
