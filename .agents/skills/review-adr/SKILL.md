---
name: review-adr
description: ADR(Architecture Decision Record) 문서를 Risk-First 템플릿 대조 + 코드 검증 + 위험 스트레스 테스트로 검증합니다.
TRIGGER when: user mentions "ADR 리뷰", "ADR 검토", "설계 문서 리뷰", "아키텍처 리뷰", "review ADR", "architecture review", "design review", "ADR 위험 평가", or asks for ADR review, architecture review, or design review.
user-invocable: true
scope: docs/adr/ 디렉토리의 ADR 문서
---

# Review ADR: 아키텍처 결정 문서 검증

ADR 문서의 구조적 완결성, 코드 정합성, 위험 커버리지를 검증합니다.
이슈를 "out of scope"로 스킵하지 않습니다. 발견된 모든 문제를 보고합니다.

## 사전 준비

```
Read docs/adr/README.md          → 전체 ADR 현황 파악
Read {대상 ADR 파일}              → 검증 대상 문서 전체 읽기
```

---

## Phase 1: 구조 검증 (Risk-First 템플릿 대조)

### 필수 섹션 체크리스트

| 섹션                    | 확인 기준                                          |
| ----------------------- | -------------------------------------------------- |
| Context                 | 문제 상황 + 현재 상태 명시 여부                    |
| Alternatives Considered | 최소 2개 대안 + 각 대안에 4축 위험 평가            |
| Decision                | Alternatives 뒤에 위치, "위험 수용 근거" 명시 여부 |
| Risks                   | 구체적 위험 항목 나열                              |
| Gates                   | 구현 전 통과 조건 명시 여부                        |

### 4축 위험 평가 확인

각 대안에 아래 4축이 모두 평가됐는지 확인:

- **기술 위험** — 구현 가능성, 미지의 기술 의존성
- **성능 위험** — FPS, 번들 크기, 메모리
- **유지보수 위험** — 복잡도 증가, 테스트 가능성
- **마이그레이션 위험** — 기존 코드 파괴 범위

---

## Phase 2: 코드 검증 (주장 vs 실제)

ADR에서 언급된 파일, 인터페이스, 함수, 상수를 **실제 코드에서 확인**합니다.
주장만 읽고 PASS 처리하지 않습니다.

### 검증 절차

```
# 1. ADR에서 언급된 파일 경로 추출 → 실제 존재 확인
Glob {언급된 파일 패턴}

# 2. 언급된 함수/인터페이스/상수 grep
Grep "{함수명|인터페이스명}" --type=ts

# 3. "현재 ~를 사용 중" 주장 → 코드에서 실제 사용 패턴 확인
Grep "{주장된 패턴}" apps/builder/src/
```

### 검증 결과 분류

- **VERIFIED** — 코드에서 확인됨, 파일 경로 기록
- **UNVERIFIED** — 코드에서 발견되지 않음, ADR 주장 부정확 가능성
- **PARTIAL** — 일부만 구현됨, 누락 범위 명시

---

## Phase 3: 위험 스트레스 테스트

### 나열된 위험 검증

ADR의 각 Risk 항목에 대해 codebase에서 **구체적 증거**를 grep합니다.

```
# 위험이 실제로 존재하는가? 관련 코드 패턴 검색
Grep "{위험 관련 키워드}" --type=ts -C 3
```

### 누락 위험 탐색

ADR에 명시되지 않은 잠재 위험을 능동적으로 조사합니다:

| 위험 영역         | 탐색 방법                                                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 렌더링 파리티     | CSS↔Skia 경로 양쪽에서 변경 영향 grep                                                                                                                                                                                                                                               |
| 성능 절벽         | O(n) 순회, WASM 반복 호출, 불필요한 리렌더 패턴                                                                                                                                                                                                                                     |
| 마이그레이션 깨짐 | 영향받는 파일 수 grep, import 체인 추적                                                                                                                                                                                                                                             |
| 레이아웃 부작용   | layoutVersion **5-심볼 2계층** 누락 여부 — A(트리거): `LAYOUT_AFFECTING_PROP_KEYS`(props) / `NON_LAYOUT_PROPS_UPDATE`(style blacklist) / `INHERITED_LAYOUT_PROPS_UPDATE` · B(캐시 시그니처): **`LAYOUT_STYLE_KEYS`**(style) / `LAYOUT_PROP_KEYS`(props). A·B 는 AND, 축별 배열 상이 |
| 상태 동기화       | Zustand → Preview postMessage 누락 가능성                                                                                                                                                                                                                                           |

### 대안 위험 레벨 검토

- 모든 대안이 HIGH로 평가됐다면 → 대안 추가 필요 플래그
- LOW/MEDIUM 대안이 있는데 선택하지 않았다면 → Decision 근거 재검토

---

## Phase 4: 결과 보고

검증 결과를 아래 형식으로 출력합니다.

```markdown
## ADR 리뷰 결과: {ADR 제목}

### 구조 검증

| 섹션                    | 존재      | 품질         | 비고 |
| ----------------------- | --------- | ------------ | ---- |
| Context                 | PASS/FAIL | HIGH/MED/LOW |      |
| Alternatives (2개+)     | PASS/FAIL | HIGH/MED/LOW |      |
| 4축 위험 평가           | PASS/FAIL | HIGH/MED/LOW |      |
| Decision 위험 수용 근거 | PASS/FAIL | HIGH/MED/LOW |      |
| Risks                   | PASS/FAIL | HIGH/MED/LOW |      |
| Gates                   | PASS/FAIL | HIGH/MED/LOW |      |

### 코드 검증

| 주장         | 검증 결과                   | 근거 파일   |
| ------------ | --------------------------- | ----------- |
| "{ADR 주장}" | VERIFIED/UNVERIFIED/PARTIAL | {파일 경로} |

### 위험 평가

| 위험             | 증거             | 심각도       | 누락 여부 |
| ---------------- | ---------------- | ------------ | --------- |
| {ADR 나열 위험}  | {grep 결과 요약} | HIGH/MED/LOW | 기재됨    |
| {탐색 발견 위험} | {grep 결과 요약} | HIGH/MED/LOW | **누락**  |

### 종합 판정

- 구조: PASS/FAIL ({실패 섹션 목록})
- 코드 정합: {N}/{M} 검증됨
- 누락 위험: {N}개
- 권고: {수정 사항 또는 "승인 가능"}
```

---

## 이슈 처리 원칙

- HIGH/MEDIUM 이슈는 "범위 외"로 스킵하지 않는다
- 코드 검증 없이 ADR 주장을 사실로 수용하지 않는다
- UNVERIFIED 항목은 반드시 보고하고, ADR 수정 또는 코드 구현 필요 여부를 명시한다
- 위험이 발견됐지만 ADR에 없으면 "누락 위험"으로 분류하고 심각도를 평가한다

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
- "ADR 새로 작성해줘" → ❌ (작성 → documenter 에이전트)
- "PR 리뷰해줘" → ❌ (PR → reviewer 에이전트)
