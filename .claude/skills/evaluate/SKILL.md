---
name: evaluate
description: 런타임 검증 — 실행 중 builder 를 Chrome MCP 로 직접 조작해 기능·시각·안정성·인터랙션 4축을 채점하고 FAIL 은 재현 경로와 함께 보고한다. 구현한 세션과 분리된 컨텍스트에서 실행 (생성-평가 분리). "실제로 되는지 확인", "live 검증", "동작 확인", "evaluate" 요청 또는 사용자-가시 변경의 완료 선언 전 live exercise 근거가 필요할 때 발동. CSS↔Skia 시각 대칭은 cross-check.
argument-hint: [검증 대상 기능 + 완료 기준 (한 줄씩)]
context: fork
agent: general-purpose
background: false
---

# Evaluate — 런타임 검증 (격리 실행)

이 skill 은 별도 컨텍스트에서 실행된다 (`context: fork`). 구현 세션의 "완료" 선언을 신뢰하지 않고 직접 확인한다. 수정하지 않는다 — 판정과 재현 경로만 반환하고 수정은 메인 세션이 한다.

## 0. 완료 기준

`$ARGUMENTS` 의 완료 기준을 항목별 PASS / FAIL 표로 판정한다. 기준이 없으면 `git diff` 의 변경 내용에서 사용자-가시 동작을 스스로 열거하고 그것을 기준으로 삼는다 (열거한 기준을 보고에 명시).

## 1. 환경 확인

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

dev 서버가 없으면 `pnpm dev` 실행 요청으로 즉시 반환한다. 가짜 판정 금지.

## 2. Chrome MCP 절차

1. `tabs_context_mcp` → 현재 탭 확인 (탭 ID 는 세션 간 재사용 금지)
2. `navigate` / `tabs_create_mcp` → 대상 페이지
3. `computer(screenshot)` → 초기 상태
4. `find` / `form_input` / `computer` → 인터랙션
5. `computer(screenshot)` → 결과 상태
6. `read_console_messages` → 에러·경고

주의: alert / confirm / prompt 트리거 금지 (브라우저 이벤트 차단). 2~3회 실패 시 재시도를 멈추고 상황을 보고한다. hidden 탭은 RAF 가 멈춰 overlay 가 stale 하다 — 측정 탭은 활성 상태로 둔다.

## 3. 4축 채점 (1~10, 근거 명시)

| 축        | 평가 내용                                          | 가중치 |
| --------- | -------------------------------------------------- | ------ |
| 기능성    | 완료 기준 동작, 핵심 플로우 완료 가능              | 40%    |
| 시각 품질 | 정렬·색·타이포·간격, Builder ↔ Preview 시각 동일성 | 25%    |
| 안정성    | 콘솔 에러·예외·깜빡임·누수 징후                    | 20%    |
| 인터랙션  | hover / click / focus, 키보드 접근성, 전환         | 15%    |

합격: 가중 평균 7.0 이상 + 기능성 8.0 이상.

## 4. composition 검증 포인트

- Canvas: 요소 추가 / 선택 / 이동 즉시 반영, Preview iframe ↔ Builder Canvas 동기화, frame time p95 (60Hz 최소선)
- 상태: Undo / Redo, 속성 변경이 Inspector ↔ Canvas ↔ Preview 3곳 반영, 페이지 전환 시 상태 전환
- 테마 / 반응형: dark mode 전환이 Canvas + Preview 모두 반영, 뷰포트 리사이즈 시 레이아웃 유지

## 5. 보고 형식

```markdown
## Evaluation Report

### 실제로 exercise 한 것

- (동작 1: 경로 → 관찰 결과)

### 완료 기준

| #   | 기준 | 결과      | 근거 |
| --- | ---- | --------- | ---- |
| 1   | ...  | PASS/FAIL | ...  |

### 품질 채점

| 축            | 점수       | 근거 |
| ------------- | ---------- | ---- |
| 기능성        | X/10       | ...  |
| 시각 품질     | X/10       | ...  |
| 안정성        | X/10       | ...  |
| 인터랙션      | X/10       | ...  |
| **가중 평균** | **X.X/10** |      |

### 발견된 이슈

1. [CRITICAL/HIGH/MEDIUM] 이슈 — 재현 경로 / 스크린샷 / 콘솔 에러

### 판정

PASS · CONDITIONAL PASS (경미한 이슈, 기능 정상) · FAIL (재작업 필요 — 사유)
```

- 모든 판정에 스크린샷 또는 콘솔 출력 근거. 주관적 표현 ("좀 이상해 보인다") 금지 — 기준과 비교해 판정.
- "실제로 exercise 한 것" 목록은 CLAUDE.md §완료 기준 보고 요건이다. 한국어 설명, 코드·기술 용어는 영어 유지.
