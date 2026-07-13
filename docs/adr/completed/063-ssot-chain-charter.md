# ADR-063: SSOT 체인 정본 정의 — 3-Domain 분할 (RAC/RSP/Spec)

## Status

Accepted — 2026-04-21 (Proposed 2026-04-13 → Accepted 2026-04-21)

**승격 근거**: Charter ADR. 본 문서는 `.claude/rules/ssot-hierarchy.md` 정본 규칙의 공식 ADR. 실질 코드 변경 0 — 규칙 자체는 도입 시점(2026-04-13)부터 작동 중이었고, 이후 후속 ADR 체인(ADR-057~062 / 078/079/083~097 / 098/099/100)이 모두 본 Charter 의 3-domain 분할(D1 DOM/접근성=RAC / D2 Props=RSP 참조 / D3 시각=Spec SSOT) 에 정합하게 land. Gate 조건 없음 — 합의 완료 상태로 Accepted 전환 (`adr-writing.md` Status 전이 규칙: "Proposed → Accepted : Gate 없이 합의 완료").

## Context

composition은 NoCode 웹 빌더로, 두 개의 렌더 경로를 가진다: **Builder(Skia 렌더)**와 **Preview/Publish(DOM + CSS, React Aria Components 기반)**. 두 경로의 시각 정합성이 프로젝트 성패의 핵심.

**역사적 흐름**:

1. **Phase 1 (초기)**: Builder와 Preview 모두 DOM/CSS — Spec 불필요, 정합성 문제 없음
2. **Phase 2 (대규모 한계)**: Builder를 WebGL/Skia로 전환 (ADR-100 완료 2026-04-06). Preview는 DOM/CSS(RAC) 유지 → **두 화면의 렌더 엔진 분기로 정합성 문제 발생**
3. **Phase 3 (SSOT 도입)**: ADR-036 Spec-First + 파생 ADR-057/058/059 등으로 Spec 중심 SSOT 정착 시도
4. **현재**: 원칙 미준수 사례 다수 — `skipCSSGeneration` + 수동 CSS, `@sync` 주석, Spec↔CSS variant 이름 완전 불일치 등. 정합성 문제 재발

**현재까지의 원칙 문구 (기존)**:

> Spec=SSOT. typography 토큰 포함 spec이 유일한 source. Preview/Publish(CSS)와 Builder(Skia)는 symmetric consumer.

이 문구가 커버하지 못한 영역:

- **Spec 자체의 설계 기준 부재** — Spec을 무엇에 기준해서 설계하는지 미규정
- **외부 표준(Adobe RAC/RSP)과 Spec의 권위 관계 모호** — "RSP는 reference"라는 문구가 운영 판정 기준으로 불충분
- **경계 회색지대**: 예를 들어 variant prop이 Spec이 결정할 영역인지 RSP가 결정할 영역인지 판정 규칙 부재
- **용어 혼용**: SSOT / 기준 / consumer / reference / authority의 의미 차이 미명시
- **엣지 케이스**: Skia 전용 시각 표현, 수동 CSS 허용 조건 등 미규정
- **집행 메커니즘**: 원칙 위반을 감지·복구하는 수단 미정의

ADR-059 v2 Phase 1 Step 1(TextField 시험대)과 ADR-062(Field RSP Conformance) 작업 중 이 gap이 구체적으로 드러남 — variant prop이 Spec/CSS에서 완전 불일치하여 manual CSS 절반이 dead code 상태였고, 원칙 해석이 여러 차례 바뀌며 설계 결정이 반복 수정됨.

**사용자 제공 명료화 (2026-04-13)**:

- **RAC 선택 이유**: 디자인(스타일의 자유도) 때문. RAC는 unstyled → composition이 자유로운 시각 스타일 정의 가능
- **Adobe 설계 = 최우선 권위**: 단 내부 분할 존재
  - **RAC = 컴포넌트 코어** (DOM 구조/접근성/키보드 동작) — **composition 관여 금지**
  - **RSP = props API 원천** — RAC가 지원 가능한 범위에서 선별 마이그레이션
- **Spec의 관할**: **"시각 스타일 domain만"**. DOM 구조/접근성에 절대 관여 안 함
- **Spec의 목적**: Builder(Skia)와 Preview/Publish(DOM+CSS)의 **시각 정합성 유지**

이 명료화로 composition 아키텍처는 **3개의 독립 domain**으로 분할됨. 본 ADR은 이 분할을 공식화한다.

**Hard Constraints**:

1. RAC가 출력하는 DOM 구조 + ARIA 속성은 composition이 수정/확장 금지 (D1)
2. Spec에 RSP 미규정 prop 도입 금지 (D2) — ADR-062 사례
3. Spec은 시각 스타일 domain(D3) 외 관여 금지
4. D3 내부에서 Builder(Skia)와 Preview/Publish(DOM/CSS)는 대등 consumer — 한쪽이 다른 쪽의 기준 아님
5. D3 대칭은 "시각 결과의 동일성"으로 판정 — 구현 방법은 자유 (Skia arc vs CSS border-radius OK)
6. 기존 운영과 하위 호환 — 본 ADR은 신규 원칙 도입이 아니라 암묵 원칙의 명문화

**Soft Constraints**:

- ADR-036/057/058/059/062와 정합 — 모두 D3 내부 작업 or D2 정리로 재해석
- 기존 코드/컴포넌트의 소급 리팩토링은 본 ADR 범위 밖 (후속 ADR별 처리)
- 문서/규칙 파일 업데이트 중심. 실질 코드 변경 최소

## Alternatives Considered

### 대안 A: 단일 charter ADR + `.claude/rules/ssot-hierarchy.md` 정본 규칙

- 설명: ADR-063 본문은 결정 기록, 세부 운영 규칙은 `.claude/rules/ssot-hierarchy.md` 정본 파일. CLAUDE.md와 기타 skill/agent/rule에서 정본 파일 포인터 참조. 기존 ADR은 상단 헤더에 "SSOT domain: D3(시각)" 1줄 소급 주석.
- 근거: ADR은 결정의 "왜"를 기록, 규칙 파일은 운영의 "어떻게"를 기록 — 역할 분리. Anthropic hook 인프라가 rule 파일 자동 로드 지원 (glob-scoped), 포인터 참조 구조 효율적.
- 위험:
  - 기술: **L** — 문서 편집만, 코드 변경 0
  - 성능: **L** — 런타임 영향 없음
  - 유지보수: **L** — 정본 단일화로 장기 부담 감소
  - 마이그레이션: **L** — 기존 관행 명문화, 실질 변경 없음

### 대안 B: ADR만 작성, 별도 rule 파일 없음

- 설명: ADR-063 본문에 모든 운영 규칙 직접 포함. rule 파일 신설 안 함. 다른 문서에서 ADR을 직접 링크.
- 근거: 결정의 모든 내용이 한 파일에 집중 → 탐색 단순
- 위험:
  - 기술: **L**
  - 성능: **L**
  - 유지보수: **M** — ADR은 결정 기록용이지 운영 규칙용 아님. Risk-First 템플릿이 "구현 상세는 breakdown으로 분리" 원칙. 운영 규칙을 ADR에 두면 업데이트 시 ADR 수정 빈번 → ADR이 "불변 기록" 원칙 훼손
  - 마이그레이션: **L**

### 대안 C: rule 파일만, ADR 없음

- 설명: `.claude/rules/ssot-hierarchy.md`만 만들고 ADR 생략. 원칙 적용만 하고 결정 이유 공식 기록은 안 함.
- 근거: 기존 관행 명문화일 뿐 신규 결정 아니라고 간주
- 위험:
  - 기술: **L**
  - 성능: **L**
  - 유지보수: **M** — 향후 개발자가 "왜 이 구조인가" 질문 시 추적 불가. ADR 체계의 역사 추적 이점 상실
  - 마이그레이션: **L**

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| :--: | :--: | :--: | :------: | :----------: | :--------: |
|  A   |  L   |  L   |    L     |      L       |     0      |
|  B   |  L   |  L   |    M     |      L       |     0      |
|  C   |  L   |  L   |    M     |      L       |     0      |

모든 대안 HIGH 0, CRITICAL 0. Threshold 통과. 위험 기준이 아닌 **목적 정합성**으로 선택.

## Decision

**대안 A: 단일 charter ADR + 정본 규칙 파일**를 선택한다.

선택 근거:

1. **역할 분리 원칙 준수** — ADR = 결정의 "왜"(불변 기록), 규칙 파일 = 운영의 "어떻게"(버저닝 가능). 두 문서는 성격이 다르며 양쪽 다 필요.
2. **참조 포인터 효율** — Anthropic hook이 glob-scoped로 rule 파일 자동 로드. 개별 skill/agent/rule에서 정본 파일 1곳 참조하면 업데이트 전파 간단.
3. **향후 업데이트 용이** — 운영 규칙이 세분화되면 rule 파일에 추가 (ADR 건드리지 않음). ADR은 결정 기록으로 불변 유지.
4. **역사 추적 확보** — ADR 체계로 "왜 3-domain인가" 추적 가능. C 대안의 rule-only는 이 이점 손실.

기각 사유:

- **대안 B 기각**: ADR에 운영 규칙을 직접 담으면 세부 업데이트마다 ADR 수정 → Risk-First 원칙의 "ADR은 불변 기록, breakdown이 구현 상세" 구조 훼손.
- **대안 C 기각**: 명문화의 공식 기록이 없으면 후속 개발자가 "왜 3-domain인가"를 추적 불가. 본 ADR-063 작성 과정 자체가 명료화 여정이었으므로, 그 결정과 근거를 공식 기록해야 재혼동 방지.

> 구현 상세: [063-ssot-chain-charter-breakdown.md](../../adr/design/063-ssot-chain-charter-breakdown.md)
> 정본 운영 규칙: [.claude/rules/ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)

## Gates

| Gate               | 시점           | 통과 조건                                                                          | 실패 시 대안                     |
| ------------------ | -------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| G1: 정본 규칙 파일 | 본 ADR 커밋 전 | `.claude/rules/ssot-hierarchy.md` 존재 + 3-domain/용어/경계/집행 4섹션 완비        | 규칙 파일 보강                   |
| G2: 문서 체계 갱신 | Phase 1 완료   | CLAUDE.md/README + 4개 기존 rule + 3개 skill + 4개 agent에서 정본 파일 포인터 참조 | 누락 항목 보강                   |
| G3: 소급 주석      | Phase 3 완료   | ADR-036/057/058/059/062 각 상단에 domain 헤더 1줄                                  | 누락 ADR 보강                    |
| G4: 기존 ADR 정합  | Phase 3 완료   | 재해석 매트릭스(breakdown §소급 적용)에 모순 없음                                  | 충돌 ADR 수정 (ADR-062 amend 등) |

잔존 HIGH 위험 없음.

## Consequences

### Positive

- **SSOT 혼동 종결** — 3-domain 분할로 "Spec이 어디까지 결정권 가지나" 판정 명확
- **Adobe 설계 권위 공식화** — RAC(D1)/RSP(D2) 분할 명시로 외부 표준 따를 기준 선명
- **용어 사전 정립** — SSOT/기준/consumer/reference/authority 의미 차이 명시
- **집행 메커니즘 로드맵** — `/cross-check` / `parallel-verify`가 D3 대칭 집행 수단임 공식화. build-time 자동화는 향후 과제로 명시
- **후속 ADR 판정 기준 확보** — 신규 ADR Context에 domain 필드 요구 가능
- **기존 ADR 정합성 확인** — ADR-036/057/058/059/062 모두 D3 내부 or D2 정리로 깔끔히 재해석
- **운영 규칙 버저닝 분리** — 규칙 업데이트는 rule 파일에서, 결정 기록은 ADR에서

### Negative

- **문서 ~23개 업데이트** — 실질 코드 변경 0이지만 문서 규모 큼. 단, 대부분 포인터 추가 수준
- **ADR-062 framing 소급 수정 필요** — "RSP=최우선" → "D1/D2/D3 분할에서 D2 정리"로 재작성. 커밋 전 상태이므로 amend 가능
- **기존 ADR 5개 헤더 소급 추가** — ADR은 "불변 기록" 원칙이므로 본문 수정 아닌 상단 주석 추가 수준으로 최소화
- **build-time 자동 검증 부재** — 집행 메커니즘이 runtime 수동에 의존. 향후 ADR에서 build-time 스크린샷 diff 등 보강 필요
